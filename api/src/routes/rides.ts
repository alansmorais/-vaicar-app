import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCode } from '../../../shared/src/errors.js';
import {
  getRide,
  saveRide,
  getPassengerProfile,
  resolvePassengerProfile,
  getDriverProfile,
  resolveDriverProfile,
  saveDriverProfile,
  savePassengerProfile,
  getPlatformPricing,
  getReceipt,
  saveReceipt,
  getActiveRideForUser,
  listOnlineDrivers,
} from '../services/firestore.js';
import { sendRideReceiptEmail } from '../services/email.js';
import {
  Ride,
  RideStatus,
  Receipt,
  PaymentMethod,
  DriverProfile,
  DriverRideOption,
  PlatformPricingSettings,
} from '../../../shared/src/types.js';

export const ridesRouter = Router();

ridesRouter.use(authenticate);

// Calculate haversine distance in km between two lat/lng points
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function normalizeZoneStr(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/**
 * Calculates fare configured by the specific driver (or fallback to platform floor)
 */
export function calculateFareForDriver(
  driver: DriverProfile | null,
  origin: { address: string; lat: number; lng: number },
  destination: { address: string; lat: number; lng: number },
  distanceKm: number,
  durationMinutes: number,
  platformPricing: PlatformPricingSettings
): {
  fare: number;
  isFixedRoute: boolean;
  fixedRouteName?: string;
  customPricing?: { minimumFare: number; perKmRate: number; perMinuteRate?: number };
} {
  const normOrigin = normalizeZoneStr(origin.address);
  const normDest = normalizeZoneStr(destination.address);

  const cp = driver?.customPricing;

  // 1. Check fixed routes if driver enabled them
  if (cp?.allowFixedRoutes && Array.isArray(cp.fixedRoutes) && cp.fixedRoutes.length > 0) {
    for (const r of cp.fixedRoutes) {
      const rOrigin = normalizeZoneStr(r.originZone);
      const rDest = normalizeZoneStr(r.destinationZone);
      const rName = normalizeZoneStr(r.name);

      const matchesForward = rOrigin && rDest && normOrigin.includes(rOrigin) && normDest.includes(rDest);
      const matchesBackward = rOrigin && rDest && normOrigin.includes(rDest) && normDest.includes(rOrigin);
      const nameParts = (r.name.includes('->') || r.name.includes('→')) ? r.name.split(/->|→/) : [];
      const matchesName = nameParts.length === 2 &&
        normOrigin.includes(normalizeZoneStr(nameParts[0])) &&
        normDest.includes(normalizeZoneStr(nameParts[1]));

      if (matchesForward || matchesBackward || matchesName) {
        const fixedFare = Math.max(r.price, platformPricing.minimumFare);
        return {
          fare: Math.round(fixedFare * 100) / 100,
          isFixedRoute: true,
          fixedRouteName: r.name,
          customPricing: {
            minimumFare: cp.minimumFare,
            perKmRate: cp.perKmRate,
            perMinuteRate: cp.perMinuteRate,
          },
        };
      }
    }
  }

  // 2. Custom pricing rate calculation (with platform floor guarantee)
  const minFare = cp?.minimumFare ? Math.max(cp.minimumFare, platformPricing.minimumFare) : platformPricing.minimumFare;
  const kmRate = cp?.perKmRate ? Math.max(cp.perKmRate, platformPricing.perKmRate) : platformPricing.perKmRate;
  const minRate = cp?.perMinuteRate !== undefined ? Math.max(0, cp.perMinuteRate) : (platformPricing.perMinuteRate || 0);

  const baseFare = platformPricing.baseFare || 0;
  let rawFare = baseFare + (distanceKm * kmRate) + (durationMinutes * minRate);
  if (rawFare < minFare) rawFare = minFare;
  if (rawFare < platformPricing.minimumFare) rawFare = platformPricing.minimumFare;

  return {
    fare: Math.round(rawFare * 100) / 100,
    isFixedRoute: false,
    customPricing: cp ? {
      minimumFare: cp.minimumFare,
      perKmRate: cp.perKmRate,
      perMinuteRate: cp.perMinuteRate,
    } : undefined,
  };
}

/**
 * Estimate Fare & Compare Available Drivers
 */
ridesRouter.post('/estimate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { origin, destination } = req.body;
    if (!origin || !destination || typeof origin.lat !== 'number' || typeof destination.lat !== 'number') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Origem e destino válidos com lat e lng são obrigatórios.', 400);
    }

    const distanceKm = Math.max(0.5, calculateDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng));
    // Average urban speed ~2.5 min/km
    const durationMinutes = Math.max(3, Math.round(distanceKm * 2.5));

    const pricing = await getPlatformPricing();

    let hasDiscount = Boolean(req.body.hasCriminalRecordCheck);
    if (!hasDiscount && req.user) {
      const passenger = await resolvePassengerProfile(req.user.uid, req.user.email);
      if (passenger?.hasCriminalRecordCheck || passenger?.criminalRecordStatus === 'VERIFIED') {
        hasDiscount = true;
      }
    }

    // Default platform base fare calculation (fallback when no specific driver selected)
    let platformBaseFare = pricing.baseFare + pricing.perKmRate * distanceKm + pricing.perMinuteRate * durationMinutes;
    if (platformBaseFare < pricing.minimumFare) {
      platformBaseFare = pricing.minimumFare;
    }
    platformBaseFare = Math.round(platformBaseFare * 100) / 100;
    const defaultFinalFare = hasDiscount ? Math.round(platformBaseFare * 0.95 * 100) / 100 : platformBaseFare;
    const defaultDiscountAmount = hasDiscount ? Math.round((platformBaseFare - defaultFinalFare) * 100) / 100 : 0;

    // Fetch online approved drivers and calculate each driver's individual fare
    const onlineDrivers = await listOnlineDrivers();
    const availableDrivers: DriverRideOption[] = [];

    for (const driver of onlineDrivers) {
      // Driver distance & ETA to passenger pickup
      let distToPickup = 1.2;
      if (driver.currentLocation?.lat && driver.currentLocation?.lng) {
        distToPickup = calculateDistanceKm(driver.currentLocation.lat, driver.currentLocation.lng, origin.lat, origin.lng);
      }
      const etaMinutes = Math.max(2, Math.round(distToPickup * 2.5));

      // Calculate fare configured by this specific driver
      const calc = calculateFareForDriver(driver, origin, destination, distanceKm, durationMinutes, pricing);
      const originalFare = calc.fare;
      const finalFare = hasDiscount ? Math.round(originalFare * 0.95 * 100) / 100 : originalFare;

      availableDrivers.push({
        driverId: driver.uid,
        name: driver.name,
        photoUrl: driver.photoUrl,
        rating: driver.rating || 5.0,
        completedRidesCount: driver.completedRidesCount || 0,
        vehicle: driver.vehicle,
        isCourier: driver.isCourier,
        distanceToPickupKm: distToPickup,
        etaMinutes,
        fareAmount: finalFare,
        originalFareAmount: originalFare,
        discountApplied: hasDiscount,
        isFixedRoute: calc.isFixedRoute,
        fixedRouteName: calc.fixedRouteName,
        customPricing: calc.customPricing,
      });
    }

    // Sort available drivers: lower fare first, then closer distance
    availableDrivers.sort((a, b) => a.fareAmount - b.fareAmount || a.distanceToPickupKm - b.distanceToPickupKm);

    res.json({
      success: true,
      requestId: req.id,
      data: {
        distanceKm,
        durationMinutes,
        fareAmount: availableDrivers.length > 0 ? availableDrivers[0].fareAmount : defaultFinalFare,
        originalFareAmount: availableDrivers.length > 0 ? availableDrivers[0].originalFareAmount : platformBaseFare,
        discountAmount: defaultDiscountAmount,
        discountApplied: hasDiscount,
        discountPercentage: hasDiscount ? 5 : 0,
        pricing,
        availableDrivers,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Request Ride (Passenger)
 */
ridesRouter.post('/request', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const passengerId = req.user!.uid;
    const passenger = await resolvePassengerProfile(passengerId, req.user?.email);

    // Check if passenger is blocked (e.g. for not paying the driver)
    if (passenger.isBlocked) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        passenger.blockedReason ||
          'Sua conta está impossibilitada de solicitar novas corridas devido a pendências de pagamento com motoristas. Entre em contato com o suporte para regularizar.',
        403,
        {
          isBlocked: true,
          hasUnpaidDebt: passenger.hasUnpaidDebt,
          unpaidAmount: passenger.unpaidAmount,
        }
      );
    }

    // Check if passenger already has active ride or unapproved payment from previous trip
    const existingActive = (await getActiveRideForUser(passengerId, 'passenger')) ||
      (passenger.uid !== passengerId ? await getActiveRideForUser(passenger.uid, 'passenger') : null);
    if (existingActive) {
      if (existingActive.status === 'COMPLETED' && (existingActive.paymentStatus === 'PENDING' || existingActive.paymentApprovedByDriver === false)) {
        throw new AppError(
          ErrorCode.FORBIDDEN,
          `Você possui uma viagem/entrega anterior no valor de R$ ${existingActive.fareAmount.toFixed(2)} com pagamento pendente de confirmação. O motorista/entregador parceiro precisa aprovar o recebimento do pagamento antes que novos pedidos possam ser realizados na plataforma.`,
          403,
          {
            activeRideId: existingActive.id,
            pendingPayment: true,
            fareAmount: existingActive.fareAmount,
            driverName: existingActive.driverName,
            paymentMethod: existingActive.paymentMethod,
          }
        );
      }
      throw new AppError(ErrorCode.INVALID_RIDE_STATE, 'Você já possui uma corrida em andamento.', 409, {
        activeRideId: existingActive.id,
      });
    }

    const { origin, destination, paymentMethod, requestedDriverId } = req.body;
    if (!origin?.address || !destination?.address) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Origem e destino são obrigatórios.', 400);
    }

    const validPaymentMethods: PaymentMethod[] = ['CASH', 'PIX', 'CARD_MACHINE'];
    const method: PaymentMethod = validPaymentMethods.includes(paymentMethod) ? paymentMethod : 'PIX';

    const distanceKm = Math.max(0.5, calculateDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng));
    const durationMinutes = Math.max(3, Math.round(distanceKm * 2.5));
    const pricing = await getPlatformPricing();

    let initialStatus: RideStatus = 'REQUESTED';
    let chosenDriver: DriverProfile | null = null;
    let isFixedRoute = false;
    let fixedRouteName: string | undefined = undefined;

    if (requestedDriverId) {
      chosenDriver = await getDriverProfile(requestedDriverId);
      // Keep initialStatus as REQUESTED so driver receives pop-up alert with Accept / Decline modal!
      initialStatus = 'REQUESTED';
    }

    // Calculate fare: if specific driver was chosen by passenger, use that driver's configured pricing!
    const calc = calculateFareForDriver(chosenDriver, origin, destination, distanceKm, durationMinutes, pricing);
    const fare = calc.fare;
    isFixedRoute = calc.isFixedRoute;
    fixedRouteName = calc.fixedRouteName;

    const hasDiscount = Boolean(passenger.hasCriminalRecordCheck || passenger.criminalRecordStatus === 'VERIFIED');
    const originalFare = fare;
    const finalFare = hasDiscount ? Math.round(fare * 0.95 * 100) / 100 : fare;
    const discountAmount = hasDiscount ? Math.round((originalFare - finalFare) * 100) / 100 : 0;

    const rideId = `ride-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const ride: Ride = {
      id: rideId,
      passengerId,
      passengerName: passenger.name,
      passengerPhone: passenger.whatsapp,
      passengerPhotoUrl: passenger.photoUrl,
      driverId: chosenDriver ? chosenDriver.uid : undefined,
      driverName: chosenDriver ? chosenDriver.name : undefined,
      driverPhone: chosenDriver ? chosenDriver.whatsapp : undefined,
      driverPhotoUrl: chosenDriver ? chosenDriver.photoUrl : undefined,
      vehicle: chosenDriver ? chosenDriver.vehicle : undefined,
      origin: {
        address: origin.address,
        lat: origin.lat,
        lng: origin.lng,
      },
      destination: {
        address: destination.address,
        lat: destination.lat,
        lng: destination.lng,
      },
      distanceKm,
      durationMinutes,
      fareAmount: finalFare,
      originalFareAmount: originalFare,
      discountAmount,
      discountApplied: hasDiscount,
      fixedRouteApplied: isFixedRoute,
      fixedRouteName: fixedRouteName,
      paymentMethod: method,
      paymentStatus: 'PENDING',
      status: initialStatus,
      requestedAt: now,
      acceptedAt: undefined,
    };

    await saveRide(ride);

    res.status(201).json({
      success: true,
      requestId: req.id,
      data: ride,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Driver Declines Ride Request
 * Releases the ride back to the general pool (driverId: undefined) so other online drivers can take it
 */
ridesRouter.post('/:id/decline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ride = await getRide(String(req.params.id));
    if (!ride) throw new AppError(ErrorCode.NOT_FOUND, 'Corrida não encontrada.', 404);

    if (ride.status === 'REQUESTED') {
      const updatedRide: Ride = {
        ...ride,
        driverId: undefined,
        driverName: undefined,
        driverPhone: undefined,
        driverPhotoUrl: undefined,
        vehicle: undefined,
      };
      await saveRide(updatedRide);
      return res.json({ success: true, requestId: req.id, data: updatedRide });
    }

    res.json({ success: true, requestId: req.id, data: ride });
  } catch (error) {
    next(error);
  }
});

/**
 * Driver Accepts Ride
 * Transition: REQUESTED -> DRIVER_ARRIVING
 */
ridesRouter.post('/:id/accept', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driverId = req.user!.uid;
    const driver = await resolveDriverProfile(driverId, req.user!.email);
    if (!driver || driver.status !== 'APPROVED') {
      throw new AppError(ErrorCode.FORBIDDEN, 'Apenas motoristas aprovados podem aceitar corridas.', 403);
    }
    if (!driver.isOnline) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Você deve estar online para aceitar corridas.', 403);
    }

    const ride = await getRide(String(req.params.id));
    if (!ride) throw new AppError(ErrorCode.NOT_FOUND, 'Corrida não encontrada.', 404);

    if (ride.status !== 'REQUESTED') {
      throw new AppError(ErrorCode.INVALID_RIDE_STATE, `Esta corrida não está mais disponível (status: ${ride.status}).`, 409);
    }

    const now = new Date().toISOString();
    const updatedRide: Ride = {
      ...ride,
      driverId: driver.uid,
      driverName: driver.name,
      driverPhone: driver.whatsapp,
      driverPhotoUrl: driver.photoUrl,
      vehicle: driver.vehicle,
      status: 'DRIVER_ARRIVING',
      acceptedAt: now,
    };

    await saveRide(updatedRide);

    res.json({
      success: true,
      requestId: req.id,
      data: updatedRide,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Driver Arrived at Pickup
 * Transition: DRIVER_ARRIVING -> ARRIVED (starts 4-minute waiting timer)
 */
ridesRouter.post('/:id/arrived', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ride = await getRide(String(req.params.id));
    if (!ride) throw new AppError(ErrorCode.NOT_FOUND, 'Corrida não encontrada.', 404);

    const driver = await resolveDriverProfile(req.user!.uid, req.user!.email);
    const isOwner = (driver && ride.driverId === driver.uid) || ride.driverId === req.user!.uid || req.user!.isAdmin;
    if (!isOwner) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Apenas o motorista responsável pode atualizar este status.', 403);
    }

    if (ride.status !== 'DRIVER_ARRIVING') {
      throw new AppError(ErrorCode.INVALID_RIDE_STATE, `Transição inválida de ${ride.status} para ARRIVED.`, 400);
    }

    const now = new Date().toISOString();
    const updatedRide: Ride = {
      ...ride,
      status: 'ARRIVED',
      arrivedAt: now,
      waitingTimerStartedAt: now,
    };

    await saveRide(updatedRide);

    res.json({
      success: true,
      requestId: req.id,
      data: updatedRide,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Driver Starts Trip
 * Transition: ARRIVED -> IN_PROGRESS
 */
ridesRouter.post('/:id/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ride = await getRide(String(req.params.id));
    if (!ride) throw new AppError(ErrorCode.NOT_FOUND, 'Corrida não encontrada.', 404);

    const driver = await resolveDriverProfile(req.user!.uid, req.user!.email);
    const isOwner = (driver && ride.driverId === driver.uid) || ride.driverId === req.user!.uid || req.user!.isAdmin;
    if (!isOwner) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Apenas o motorista responsável pode iniciar a corrida.', 403);
    }

    if (ride.status !== 'ARRIVED') {
      throw new AppError(ErrorCode.INVALID_RIDE_STATE, `Transição inválida de ${ride.status} para IN_PROGRESS.`, 400);
    }

    const now = new Date().toISOString();
    const updatedRide: Ride = {
      ...ride,
      status: 'IN_PROGRESS',
      startedAt: now,
    };

    await saveRide(updatedRide);

    res.json({
      success: true,
      requestId: req.id,
      data: updatedRide,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Driver Completes Trip
 * Transition: IN_PROGRESS -> COMPLETED
 * Generates Receipt and dispatches receipt email
 */
ridesRouter.post('/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ride = await getRide(String(req.params.id));
    if (!ride) throw new AppError(ErrorCode.NOT_FOUND, 'Corrida não encontrada.', 404);

    const driver = await resolveDriverProfile(req.user!.uid, req.user!.email);
    const isOwner = (driver && ride.driverId === driver.uid) || ride.driverId === req.user!.uid || req.user!.isAdmin;
    if (!isOwner) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Apenas o motorista responsável pode finalizar a corrida.', 403);
    }

    if (ride.status !== 'IN_PROGRESS') {
      throw new AppError(ErrorCode.INVALID_RIDE_STATE, `Transição inválida de ${ride.status} para COMPLETED.`, 400);
    }

    const isPaymentApproved = req.body.paymentApproved !== false;
    const now = new Date().toISOString();

    const passenger = await getPassengerProfile(ride.passengerId);
    const passengerEmail = passenger?.email || '';

    let receiptId: string | undefined = undefined;
    let receipt: Receipt | undefined = undefined;

    if (isPaymentApproved) {
      receiptId = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const receiptNumber = `VCR-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

      receipt = {
        id: receiptId,
        rideId: ride.id,
        receiptNumber,
        passengerName: ride.passengerName,
        passengerEmail,
        passengerPhone: ride.passengerPhone,
        driverName: ride.driverName || 'Motorista VaiCar',
        vehicleDescription: `${ride.vehicle?.brand || ''} ${ride.vehicle?.model || ''}`,
        vehiclePlate: ride.vehicle?.plate || '',
        dateTime: now,
        originAddress: ride.origin.address,
        destinationAddress: ride.destination.address,
        distanceKm: ride.distanceKm,
        durationMinutes: ride.durationMinutes,
        fareAmount: ride.fareAmount,
        originalFareAmount: ride.originalFareAmount,
        discountAmount: ride.discountAmount,
        discountApplied: ride.discountApplied,
        paymentMethod: ride.paymentMethod,
        paymentStatus: 'PAID',
        generatedAt: now,
      };

      await saveReceipt(receipt);

      // Update driver completed ride count
      if (ride.driverId) {
        const driver = await getDriverProfile(ride.driverId);
        if (driver) {
          await saveDriverProfile({
            ...driver,
            completedRidesCount: (driver.completedRidesCount || 0) + 1,
            updatedAt: now,
          });
        }
      }

      // Update passenger total rides
      if (passenger) {
        await savePassengerProfile({
          ...passenger,
          totalRides: (passenger.totalRides || 0) + 1,
          updatedAt: now,
        });
      }
    }

    const updatedRide: Ride = {
      ...ride,
      status: 'COMPLETED',
      paymentStatus: isPaymentApproved ? 'PAID' : 'PENDING',
      paymentApprovedByDriver: isPaymentApproved,
      paymentApprovedAt: isPaymentApproved ? now : undefined,
      completedAt: now,
      receiptId,
      emailStatus: isPaymentApproved ? 'PENDING' : undefined,
    };

    await saveRide(updatedRide);

    // Send receipt email asynchronously if approved
    if (isPaymentApproved && passengerEmail && receipt) {
      sendRideReceiptEmail(passengerEmail, receipt)
        .then(resMail => {
          saveRide({
            ...updatedRide,
            emailStatus: resMail.success ? 'SENT' : 'FAILED',
          }).catch(console.error);
        })
        .catch(console.error);
    }

    res.json({
      success: true,
      requestId: req.id,
      data: {
        ride: updatedRide,
        receipt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Driver (or Admin) Approves Payment for Ride
 * Unlocks passenger to request new rides and issues official receipt
 */
ridesRouter.post('/:id/approve-payment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ride = await getRide(String(req.params.id));
    if (!ride) throw new AppError(ErrorCode.NOT_FOUND, 'Corrida não encontrada.', 404);

    const driver = await resolveDriverProfile(req.user!.uid, req.user!.email);
    const isOwner = (driver && ride.driverId === driver.uid) || ride.driverId === req.user!.uid || req.user!.isAdmin;
    if (!isOwner) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Apenas o motorista responsável pode aprovar o pagamento.', 403);
    }

    const now = new Date().toISOString();
    let receiptId = ride.receiptId;
    let receipt: Receipt | null = receiptId ? await getReceipt(receiptId) : null;

    const passenger = await getPassengerProfile(ride.passengerId);
    const passengerEmail = passenger?.email || '';

    if (!receipt) {
      receiptId = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const receiptNumber = `VCR-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

      receipt = {
        id: receiptId,
        rideId: ride.id,
        receiptNumber,
        passengerName: ride.passengerName,
        passengerEmail,
        passengerPhone: ride.passengerPhone,
        driverName: ride.driverName || 'Motorista VaiCar',
        vehicleDescription: `${ride.vehicle?.brand || ''} ${ride.vehicle?.model || ''}`,
        vehiclePlate: ride.vehicle?.plate || '',
        dateTime: now,
        originAddress: ride.origin.address,
        destinationAddress: ride.destination.address,
        distanceKm: ride.distanceKm,
        durationMinutes: ride.durationMinutes,
        fareAmount: ride.fareAmount,
        originalFareAmount: ride.originalFareAmount,
        discountAmount: ride.discountAmount,
        discountApplied: ride.discountApplied,
        paymentMethod: ride.paymentMethod,
        paymentStatus: 'PAID',
        generatedAt: now,
      };

      await saveReceipt(receipt);
    } else {
      receipt.paymentStatus = 'PAID';
      await saveReceipt(receipt);
    }

    // Update driver completed ride count if not counted
    if (ride.driverId && !ride.paymentApprovedByDriver) {
      const driver = await getDriverProfile(ride.driverId);
      if (driver) {
        await saveDriverProfile({
          ...driver,
          completedRidesCount: (driver.completedRidesCount || 0) + 1,
          updatedAt: now,
        });
      }
    }

    // Update passenger total rides if not counted
    if (passenger && !ride.paymentApprovedByDriver) {
      await savePassengerProfile({
        ...passenger,
        totalRides: (passenger.totalRides || 0) + 1,
        updatedAt: now,
      });
    }

    const updatedRide: Ride = {
      ...ride,
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      paymentApprovedByDriver: true,
      paymentApprovedAt: now,
      receiptId,
      emailStatus: 'PENDING',
    };

    await saveRide(updatedRide);

    // Send receipt email
    if (passengerEmail && receipt) {
      sendRideReceiptEmail(passengerEmail, receipt)
        .then(resMail => {
          saveRide({
            ...updatedRide,
            emailStatus: resMail.success ? 'SENT' : 'FAILED',
          }).catch(console.error);
        })
        .catch(console.error);
    }

    res.json({
      success: true,
      requestId: req.id,
      data: {
        ride: updatedRide,
        receipt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Cancel Ride
 * Valid for passenger or driver before in-progress
 */
ridesRouter.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ride = await getRide(String(req.params.id));
    if (!ride) throw new AppError(ErrorCode.NOT_FOUND, 'Corrida não encontrada.', 404);

    const uid = req.user!.uid;
    const isPassenger = ride.passengerId === uid;
    const isDriver = ride.driverId === uid;
    const isAdmin = !!req.user!.isAdmin;

    if (!isPassenger && !isDriver && !isAdmin) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Você não tem permissão para cancelar esta corrida.', 403);
    }

    if (ride.status === 'COMPLETED' || ride.status.startsWith('CANCELLED')) {
      throw new AppError(ErrorCode.INVALID_RIDE_STATE, `Não é possível cancelar uma corrida com status: ${ride.status}.`, 400);
    }

    const { reason, isEmergency } = req.body;

    // Regra estrita: Se a corrida já começou (IN_PROGRESS), nem passageiro nem motorista podem cancelar normalmente, apenas em emergência
    if (ride.status === 'IN_PROGRESS' && !isEmergency && !isAdmin) {
      throw new AppError(
        ErrorCode.INVALID_RIDE_STATE,
        'A corrida já está em andamento. O cancelamento não é permitido após o início da viagem, exceto em caso de emergência comprovada (ex: pane mecânica, emergência médica, colisão ou risco à segurança).',
        400
      );
    }

    if (ride.status === 'IN_PROGRESS' && isEmergency && (!reason || !String(reason).trim())) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Para cancelar uma corrida já iniciada em caso de emergência, é obrigatório informar o motivo detalhado.',
        400
      );
    }

    const cancelledBy = isPassenger ? 'passenger' : isDriver ? 'driver' : 'system';
    const newStatus: RideStatus = isPassenger ? 'CANCELLED_BY_PASSENGER' : isDriver ? 'CANCELLED_BY_DRIVER' : 'CANCELLED_BY_SYSTEM';

    const formattedReason = isEmergency
      ? `[EMERGÊNCIA] ${String(reason || '').trim() || 'Ocorrência emergencial informada durante a viagem'}`
      : (String(reason || '').trim() || 'Cancelado pelo usuário');

    const updatedRide: Ride = {
      ...ride,
      status: newStatus,
      cancelledAt: new Date().toISOString(),
      cancelledBy,
      cancelReason: formattedReason,
      isEmergencyCancellation: !!isEmergency,
    };

    await saveRide(updatedRide);

    res.json({
      success: true,
      requestId: req.id,
      data: updatedRide,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get Ride by ID
 */
ridesRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ride = await getRide(String(req.params.id));
    if (!ride) throw new AppError(ErrorCode.NOT_FOUND, 'Corrida não encontrada.', 404);

    const uid = req.user!.uid;
    if (ride.passengerId !== uid && ride.driverId !== uid && !req.user!.isAdmin) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Acesso restrito.', 403);
    }

    res.json({
      success: true,
      requestId: req.id,
      data: ride,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Passenger Rates Driver
 */
ridesRouter.post('/:id/rate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ride = await getRide(String(req.params.id));
    if (!ride) throw new AppError(ErrorCode.NOT_FOUND, 'Corrida não encontrada.', 404);

    if (ride.passengerId !== req.user!.uid) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Apenas o passageiro pode avaliar esta corrida.', 403);
    }

    const { rating, feedback } = req.body;
    const numericRating = Number(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Nota deve ser entre 1 e 5 estrelas.', 400);
    }

    const updatedRide: Ride = {
      ...ride,
      ratingByPassenger: numericRating,
      feedbackByPassenger: feedback || '',
    };
    await saveRide(updatedRide);

    // Update driver rating average
    if (ride.driverId) {
      const driver = await getDriverProfile(ride.driverId);
      if (driver) {
        const count = driver.completedRidesCount || 1;
        const currentAvg = driver.rating || 5.0;
        const newAvg = Math.round(((currentAvg * (count - 1) + numericRating) / count) * 10) / 10;
        await saveDriverProfile({
          ...driver,
          rating: newAvg,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    res.json({
      success: true,
      requestId: req.id,
      data: updatedRide,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Driver Rates Passenger
 */
ridesRouter.post('/:id/rate-passenger', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ride = await getRide(String(req.params.id));
    if (!ride) throw new AppError(ErrorCode.NOT_FOUND, 'Corrida não encontrada.', 404);

    const driver = await resolveDriverProfile(req.user!.uid, req.user!.email);
    if (!driver || (ride.driverId && ride.driverId !== driver.uid && ride.driverId !== req.user!.uid)) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Apenas o motorista parceiro pode avaliar o passageiro desta corrida.', 403);
    }

    const { rating, feedback } = req.body;
    const numericRating = Number(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Nota deve ser entre 1 e 5 estrelas.', 400);
    }

    const updatedRide: Ride = {
      ...ride,
      ratingByDriver: numericRating,
      feedbackByDriver: feedback || '',
    };
    await saveRide(updatedRide);

    // Update passenger rating average
    if (ride.passengerId) {
      const passenger = await getPassengerProfile(ride.passengerId);
      if (passenger) {
        const count = passenger.totalRides || 1;
        const currentAvg = passenger.rating || 5.0;
        const newAvg = Math.round(((currentAvg * (count - 1) + numericRating) / count) * 10) / 10;
        await savePassengerProfile({
          ...passenger,
          rating: newAvg,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    res.json({
      success: true,
      requestId: req.id,
      data: updatedRide,
    });
  } catch (error) {
    next(error);
  }
});
