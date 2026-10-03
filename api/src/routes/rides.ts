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
  saveDriverProfile,
  savePassengerProfile,
  getPlatformPricing,
  saveReceipt,
  getActiveRideForUser,
} from '../services/firestore.js';
import { sendRideReceiptEmail } from '../services/email.js';
import { Ride, RideStatus, Receipt, PaymentMethod } from '../../../shared/src/types.js';

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

/**
 * Estimate Fare
 */
ridesRouter.post('/estimate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { origin, destination } = req.body;
    if (!origin || !destination || typeof origin.lat !== 'number' || typeof destination.lat !== 'number') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Origem e destino válidos com lat e lng são obrigatórios.', 400);
    }

    const distanceKm = Math.max(0.5, calculateDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng));
    // Average urban speed 30km/h => ~2 min/km
    const durationMinutes = Math.max(3, Math.round(distanceKm * 2.5));

    const pricing = await getPlatformPricing();
    let fare = pricing.baseFare + pricing.perKmRate * distanceKm + pricing.perMinuteRate * durationMinutes;
    if (fare < pricing.minimumFare) {
      fare = pricing.minimumFare;
    }
    fare = Math.round(fare * 100) / 100;

    let hasDiscount = Boolean(req.body.hasCriminalRecordCheck);
    if (!hasDiscount && req.user) {
      const passenger = await resolvePassengerProfile(req.user.uid, req.user.email);
      if (passenger?.hasCriminalRecordCheck || passenger?.criminalRecordStatus === 'VERIFIED') {
        hasDiscount = true;
      }
    }
    const originalFare = fare;
    const finalFare = hasDiscount ? Math.round(fare * 0.95 * 100) / 100 : fare;
    const discountAmount = hasDiscount ? Math.round((originalFare - finalFare) * 100) / 100 : 0;

    res.json({
      success: true,
      requestId: req.id,
      data: {
        distanceKm,
        durationMinutes,
        fareAmount: finalFare,
        originalFareAmount: originalFare,
        discountAmount,
        discountApplied: hasDiscount,
        discountPercentage: hasDiscount ? 5 : 0,
        pricing,
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

    // Check if passenger already has active ride
    const existingActive = (await getActiveRideForUser(passengerId, 'passenger')) ||
      (passenger.uid !== passengerId ? await getActiveRideForUser(passenger.uid, 'passenger') : null);
    if (existingActive) {
      throw new AppError(ErrorCode.INVALID_RIDE_STATE, 'Você já possui uma corrida em andamento.', 409, {
        activeRideId: existingActive.id,
      });
    }

    const { origin, destination, paymentMethod } = req.body;
    if (!origin?.address || !destination?.address) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Origem e destino são obrigatórios.', 400);
    }

    const validPaymentMethods: PaymentMethod[] = ['CASH', 'PIX', 'CARD_MACHINE'];
    const method: PaymentMethod = validPaymentMethods.includes(paymentMethod) ? paymentMethod : 'PIX';

    const distanceKm = Math.max(0.5, calculateDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng));
    const durationMinutes = Math.max(3, Math.round(distanceKm * 2.5));
    const pricing = await getPlatformPricing();
    let fare = pricing.baseFare + pricing.perKmRate * distanceKm + pricing.perMinuteRate * durationMinutes;
    if (fare < pricing.minimumFare) fare = pricing.minimumFare;
    fare = Math.round(fare * 100) / 100;

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
      paymentMethod: method,
      paymentStatus: 'PENDING',
      status: 'REQUESTED',
      requestedAt: now,
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
 * Driver Accepts Ride
 * Transition: REQUESTED -> DRIVER_ARRIVING
 */
ridesRouter.post('/:id/accept', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driverId = req.user!.uid;
    const driver = await getDriverProfile(driverId);
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

    if (ride.driverId !== req.user!.uid && !req.user!.isAdmin) {
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

    if (ride.driverId !== req.user!.uid && !req.user!.isAdmin) {
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

    if (ride.driverId !== req.user!.uid && !req.user!.isAdmin) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Apenas o motorista responsável pode finalizar a corrida.', 403);
    }

    if (ride.status !== 'IN_PROGRESS') {
      throw new AppError(ErrorCode.INVALID_RIDE_STATE, `Transição inválida de ${ride.status} para COMPLETED.`, 400);
    }

    const now = new Date().toISOString();
    const receiptId = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const receiptNumber = `VCR-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    const passenger = await getPassengerProfile(ride.passengerId);
    const passengerEmail = passenger?.email || '';

    const receipt: Receipt = {
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

    // Save receipt in Firestore
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

    const updatedRide: Ride = {
      ...ride,
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      completedAt: now,
      receiptId,
      emailStatus: 'PENDING',
    };

    await saveRide(updatedRide);

    // Send receipt email asynchronously
    if (passengerEmail) {
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

    const { reason } = req.body;
    const cancelledBy = isPassenger ? 'passenger' : isDriver ? 'driver' : 'system';
    const newStatus: RideStatus = isPassenger ? 'CANCELLED_BY_PASSENGER' : isDriver ? 'CANCELLED_BY_DRIVER' : 'CANCELLED_BY_SYSTEM';

    const updatedRide: Ride = {
      ...ride,
      status: newStatus,
      cancelledAt: new Date().toISOString(),
      cancelledBy,
      cancelReason: reason || 'Cancelado pelo usuário',
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
