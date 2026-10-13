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
  listAllRides,
  getRideOffer,
  saveRideOffer,
  isDriverGpsFresh,
  processReferralRewardOnCompletion,
  createRideAtomic,
  debitReferralCreditForRide,
  refundReferralCreditForRide,
  listOffersForRide,
} from '../services/firestore.js';
import { sendRideReceiptEmail } from '../services/email.js';
import { dispatchNextCandidate, expireOffer } from '../services/dispatch.js';
import { config } from '../config/index.js';
import { broadcastLiveEvent } from '../services/liveStream.js';
import {
  Ride,
  RideStatus,
  Receipt,
  PaymentMethod,
  DriverProfile,
  DriverRideOption,
  PlatformPricingSettings,
  ServiceType,
  DeliveryDetails,
  DriverDeliveryPricing,
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

export function getDriverPixInfo(driver: DriverProfile | null | undefined): {
  pixKey: string;
  pixKeyType: string;
  pixName: string;
} {
  if (!driver) {
    return { pixKey: '', pixKeyType: 'PHONE', pixName: 'Motorista Parceiro' };
  }
  const pixName = driver.pixName || driver.name || 'Motorista Parceiro';
  if (driver.pixKey) {
    return {
      pixKey: driver.pixKey,
      pixKeyType: driver.pixKeyType || 'PHONE',
      pixName,
    };
  }
  if (driver.whatsapp) {
    return {
      pixKey: driver.whatsapp,
      pixKeyType: 'PHONE',
      pixName,
    };
  }
  if (driver.cpf) {
    return {
      pixKey: driver.cpf.replace(/\D/g, ''),
      pixKeyType: 'CPF',
      pixName,
    };
  }
  if (driver.email) {
    return {
      pixKey: driver.email,
      pixKeyType: 'EMAIL',
      pixName,
    };
  }
  return {
    pixKey: '',
    pixKeyType: 'PHONE',
    pixName,
  };
}

export function formatRidePayload(ride: Ride | null | undefined): any {
  if (!ride) return null;
  const fare = ride.fareAmount ?? (ride as any).fare ?? (ride as any).fareBrl ?? 0;
  const hasDriver = Boolean(ride.driverId);
  const vehicleStr = (ride as any).driverVehicle || (ride.vehicle ? `${ride.vehicle.make || (ride.vehicle as any).brand || ''} ${ride.vehicle.model || ''}`.trim() : undefined);
  const plateStr = (ride as any).driverLicensePlate || ride.vehicle?.plate || (ride.vehicle as any)?.licensePlate;
  const isPaymentPending = (ride.status === 'COMPLETED' && (ride.paymentStatus !== 'PAID' || ride.paymentApprovedByDriver === false));
  const accountStatus = isPaymentPending ? 'PAYMENT_REQUIRED' : 'ACTIVE';
  return {
    ...ride,
    fare,
    fareAmount: fare,
    fareBrl: fare,
    estimatedPrice: fare,
    passengerFareAmount: ride.passengerFareAmount ?? fare,
    driverTotalEntitlement: ride.driverTotalEntitlement ?? (ride.originalFareAmount || fare),
    platformSubsidyAmount: ride.platformSubsidyAmount ?? 0,
    platformSubsidyStatus: ride.platformSubsidyStatus ?? 'NONE',
    referralCreditApplied: Boolean(ride.referralCreditApplied),
    referralCreditAmount: ride.referralCreditAmount ?? 0,
    originLat: ride.origin?.lat ?? (ride as any).originLat,
    originLng: ride.origin?.lng ?? (ride as any).originLng,
    originAddress: ride.origin?.address ?? (ride as any).originAddress,
    destinationLat: ride.destination?.lat ?? (ride as any).destinationLat,
    destinationLng: ride.destination?.lng ?? (ride as any).destinationLng,
    destinationAddress: ride.destination?.address ?? (ride as any).destinationAddress,
    originZoneId: ride.originZoneId || (ride as any).originZone || '',
    destinationZoneId: ride.destinationZoneId || (ride as any).destinationZone || '',
    driverVehicle: hasDriver ? (vehicleStr || 'Veículo Autorizado') : undefined,
    driverLicensePlate: hasDriver ? (plateStr || '') : undefined,
    driverPixKey: (ride as any).driverPixKey,
    driverPixName: (ride as any).driverPixName,
    driverPixKeyType: (ride as any).driverPixKeyType,
    accountStatus,
  };
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
 * Calculates delivery fee configured by the specific driver (or fallback to platform floor)
 * Formula: minimum delivery fee + distance × price/km + waiting time × waiting price/minute
 */
export function calculateDeliveryFeeForDriver(
  driver: DriverProfile | null,
  distanceKm: number,
  waitingMinutes: number = 0,
  platformPricing: PlatformPricingSettings
): {
  fare: number;
  customDeliveryPricing: DriverDeliveryPricing;
} {
  const cdp = driver?.customDeliveryPricing;
  const minDeliveryFloor = platformPricing.deliveryMinimumFee ?? 10.0;
  const perKmFloor = platformPricing.deliveryPerKmRate ?? 2.0;
  const waitingFloor = platformPricing.deliveryWaitingPerMinuteRate ?? 0.5;

  const minFee = cdp?.minimumDeliveryFee ? Math.max(cdp.minimumDeliveryFee, minDeliveryFloor) : minDeliveryFloor;
  const kmRate = cdp?.perKmRate ? Math.max(cdp.perKmRate, perKmFloor) : perKmFloor;
  const waitingRate = cdp?.waitingPerMinuteRate !== undefined ? Math.max(0, cdp.waitingPerMinuteRate) : waitingFloor;

  let rawFare = minFee + (distanceKm * kmRate) + (waitingMinutes * waitingRate);
  if (rawFare < minFee) rawFare = minFee;

  return {
    fare: Math.round(rawFare * 100) / 100,
    customDeliveryPricing: {
      minimumDeliveryFee: minFee,
      perKmRate: kmRate,
      waitingPerMinuteRate: waitingRate,
    },
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

    const serviceType: ServiceType = req.body.serviceType === 'delivery' ? 'delivery' : 'ride';
    const isDelivery = serviceType === 'delivery';

    const distanceKm = Math.max(0.5, calculateDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng));
    // Average urban speed ~2.5 min/km
    const durationMinutes = Math.max(3, Math.round(distanceKm * 2.5));

    const pricing = await getPlatformPricing();

    let hasDiscount = Boolean(req.body.hasCriminalRecordCheck);
    let hasReferralDiscount = false;
    let hasReferralCredit = false;
    let referralCreditAmount = 0;
    let availableReferralCredit = 0;

    if (req.user) {
      const passenger = await resolvePassengerProfile(req.user.uid, req.user.email);
      if (passenger?.hasCriminalRecordCheck || passenger?.criminalRecordStatus === 'VERIFIED') {
        hasDiscount = true;
      }
      if (passenger?.referralDiscountAvailable && (!passenger.totalRides || passenger.totalRides === 0)) {
        hasReferralDiscount = true;
      }
      availableReferralCredit = passenger?.referralCreditBalance || 0;
      if (req.body.applyReferralCredit && !hasReferralDiscount && availableReferralCredit >= 5.00) {
        hasReferralCredit = true;
        referralCreditAmount = 5.00;
      }
    }

    // Default platform base fare calculation (fallback when no specific driver selected)
    let platformBaseFare = 0;
    if (isDelivery) {
      const minDeliveryFloor = pricing.deliveryMinimumFee ?? 10.0;
      const perKmFloor = pricing.deliveryPerKmRate ?? 2.0;
      platformBaseFare = minDeliveryFloor + (perKmFloor * distanceKm);
    } else {
      platformBaseFare = pricing.baseFare + pricing.perKmRate * distanceKm + pricing.perMinuteRate * durationMinutes;
      if (platformBaseFare < pricing.minimumFare) {
        platformBaseFare = pricing.minimumFare;
      }
    }
    platformBaseFare = Math.round(platformBaseFare * 100) / 100;
    let defaultDiscountAmount = 0;
    if (hasDiscount) {
      defaultDiscountAmount += Math.round(platformBaseFare * 0.05 * 100) / 100;
    }
    let defaultReferralDiscountAmt = 0;
    if (hasReferralDiscount) {
      defaultReferralDiscountAmt = Math.min(5.00, Math.max(0, platformBaseFare - defaultDiscountAmount - 5.00));
      defaultDiscountAmount += defaultReferralDiscountAmt;
    }
    let defaultReferralCreditAmt = 0;
    if (hasReferralCredit) {
      defaultReferralCreditAmt = Math.min(referralCreditAmount, Math.max(0, platformBaseFare - defaultDiscountAmount - 5.00));
      defaultDiscountAmount += defaultReferralCreditAmt;
    }
    defaultDiscountAmount = Math.round(defaultDiscountAmount * 100) / 100;
    const defaultFinalFare = Math.max(5.00, Math.round((platformBaseFare - defaultDiscountAmount) * 100) / 100);
    const defaultPlatformSubsidyAmount = defaultReferralDiscountAmt + defaultReferralCreditAmt;
    const defaultDriverEntitlement = platformBaseFare;

    // Fetch online approved drivers and filter by service offering
    const onlineDrivers = await listOnlineDrivers();
    const availableDrivers: DriverRideOption[] = [];

    const eligibleDrivers = onlineDrivers.filter((driver) => {
      if (isDelivery) {
        return (
          (driver.servicesOffered && driver.servicesOffered.includes('delivery')) ||
          Boolean(driver.isCourier) ||
          driver.vehicle?.type === 'bicycle'
        );
      } else {
        // Passenger ride: bicycles cannot carry passengers!
        if (driver.vehicle?.type === 'bicycle') return false;
        if (driver.servicesOffered && !driver.servicesOffered.includes('ride')) return false;
        return true;
      }
    });

    for (const driver of eligibleDrivers) {
      // Driver distance & ETA to passenger pickup
      let distToPickup = 1.2;
      if (driver.currentLocation?.lat && driver.currentLocation?.lng) {
        distToPickup = calculateDistanceKm(driver.currentLocation.lat, driver.currentLocation.lng, origin.lat, origin.lng);
      }
      const etaMinutes = Math.max(2, Math.round(distToPickup * 2.5));

      // Exclude driver if already busy on an ongoing ride
      const activeRide = await getActiveRideForUser(driver.uid, 'driver');
      const isBusy = Boolean(activeRide && activeRide.status !== 'COMPLETED');
      const isFresh = isDriverGpsFresh(driver.currentLocation);
      const lat = driver.currentLocation?.lat;
      const lng = driver.currentLocation?.lng;
      const zoneEligible = (typeof lat === 'number' && typeof lng === 'number') ? distToPickup <= 50 : false;
      const services = driver.servicesOffered || (driver.isCourier ? ['delivery'] : ['ride']);
      const serviceEligible = isDelivery ? services.includes('delivery') : services.includes('ride');
      const isEligible = !isBusy && isFresh && zoneEligible && serviceEligible;

      if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_ELIGIBILITY === 'true' || process.env.K_SERVICE) {
        console.log(
          `[DRIVER_ELIGIBILITY]\n` +
          `driver=${driver.uid}\n` +
          `online=${Boolean(driver.isOnline)}\n` +
          `gpsTimestamp=${driver.currentLocation?.updatedAt || 'none'}\n` +
          `gpsFresh=${isFresh}\n` +
          `lat=${lat ?? 'none'}\n` +
          `lng=${lng ?? 'none'}\n` +
          `zoneEligible=${zoneEligible}\n` +
          `serviceEligible=${serviceEligible}\n` +
          `busy=${isBusy}\n` +
          `eligible=${isEligible}`
        );
      }

      if (activeRide) {
        continue;
      }

      if (isDelivery) {
        const delivCalc = calculateDeliveryFeeForDriver(driver, distanceKm, 0, pricing);
        const originalFare = delivCalc.fare;
        let driverDiscountAmt = 0;
        if (hasDiscount) {
          driverDiscountAmt += Math.round(originalFare * 0.05 * 100) / 100;
        }
        let driverRefDiscountAmt = 0;
        if (hasReferralDiscount) {
          driverRefDiscountAmt = Math.min(5.00, Math.max(0, originalFare - driverDiscountAmt - 5.00));
          driverDiscountAmt += driverRefDiscountAmt;
        }
        let driverRefCreditAmt = 0;
        if (hasReferralCredit) {
          driverRefCreditAmt = Math.min(referralCreditAmount, Math.max(0, originalFare - driverDiscountAmt - 5.00));
          driverDiscountAmt += driverRefCreditAmt;
        }
        driverDiscountAmt = Math.round(driverDiscountAmt * 100) / 100;
        const finalFare = Math.max(5.00, Math.round((originalFare - driverDiscountAmt) * 100) / 100);
        const driverSubsidy = driverRefDiscountAmt + driverRefCreditAmt;
        const anyDiscount = driverDiscountAmt > 0;

        availableDrivers.push({
          driverId: driver.uid,
          name: driver.name,
          photoUrl: driver.photoUrl,
          rating: driver.rating || 5.0,
          completedRidesCount: driver.completedRidesCount || 0,
          vehicle: driver.vehicle,
          isCourier: driver.isCourier,
          serviceType: 'delivery',
          distanceToPickupKm: distToPickup,
          etaMinutes,
          fareAmount: finalFare,
          originalFareAmount: originalFare,
          driverTotalEntitlement: originalFare,
          platformSubsidyAmount: driverSubsidy,
          discountApplied: anyDiscount,
          customDeliveryPricing: delivCalc.customDeliveryPricing,
        });
      } else {
        // Calculate fare configured by this specific driver
        const calc = calculateFareForDriver(driver, origin, destination, distanceKm, durationMinutes, pricing);
        const originalFare = calc.fare;
        let driverDiscountAmt = 0;
        if (hasDiscount) {
          driverDiscountAmt += Math.round(originalFare * 0.05 * 100) / 100;
        }
        let driverRefDiscountAmt = 0;
        if (hasReferralDiscount) {
          driverRefDiscountAmt = Math.min(5.00, Math.max(0, originalFare - driverDiscountAmt - 5.00));
          driverDiscountAmt += driverRefDiscountAmt;
        }
        let driverRefCreditAmt = 0;
        if (hasReferralCredit) {
          driverRefCreditAmt = Math.min(referralCreditAmount, Math.max(0, originalFare - driverDiscountAmt - 5.00));
          driverDiscountAmt += driverRefCreditAmt;
        }
        driverDiscountAmt = Math.round(driverDiscountAmt * 100) / 100;
        const finalFare = Math.max(5.00, Math.round((originalFare - driverDiscountAmt) * 100) / 100);
        const driverSubsidy = driverRefDiscountAmt + driverRefCreditAmt;
        const anyDiscount = driverDiscountAmt > 0;

        availableDrivers.push({
          driverId: driver.uid,
          name: driver.name,
          photoUrl: driver.photoUrl,
          rating: driver.rating || 5.0,
          completedRidesCount: driver.completedRidesCount || 0,
          vehicle: driver.vehicle,
          isCourier: driver.isCourier,
          serviceType: 'ride',
          distanceToPickupKm: distToPickup,
          etaMinutes,
          fareAmount: finalFare,
          originalFareAmount: originalFare,
          driverTotalEntitlement: originalFare,
          platformSubsidyAmount: driverSubsidy,
          discountApplied: anyDiscount,
          isFixedRoute: calc.isFixedRoute,
          fixedRouteName: calc.fixedRouteName,
          customPricing: calc.customPricing,
        });
      }
    }

    // Sort available drivers: lower fare first, then closer distance
    availableDrivers.sort((a, b) => a.fareAmount - b.fareAmount || a.distanceToPickupKm - b.distanceToPickupKm);

    const bestDriver = availableDrivers.length > 0 ? availableDrivers[0] : null;
    const finalFareAmount = bestDriver ? bestDriver.fareAmount : defaultFinalFare;
    const finalOriginalFare = bestDriver ? bestDriver.originalFareAmount! : platformBaseFare;
    const finalDriverEntitlement = bestDriver ? (bestDriver.driverTotalEntitlement ?? bestDriver.originalFareAmount!) : defaultDriverEntitlement;
    const finalSubsidyAmount = bestDriver ? (bestDriver.platformSubsidyAmount ?? 0) : defaultPlatformSubsidyAmount;

    res.json({
      success: true,
      requestId: req.id,
      data: {
        serviceType,
        distanceKm,
        durationMinutes,
        fareAmount: finalFareAmount,
        originalFareAmount: finalOriginalFare,
        passengerFareAmount: finalFareAmount,
        driverTotalEntitlement: finalDriverEntitlement,
        platformSubsidyAmount: finalSubsidyAmount,
        platformSubsidyStatus: finalSubsidyAmount > 0 ? 'PENDING_SETTLEMENT' : 'NONE',
        discountAmount: defaultDiscountAmount,
        discountApplied: defaultDiscountAmount > 0,
        discountPercentage: hasDiscount ? 5 : 0,
        referralDiscountApplied: hasReferralDiscount,
        referralDiscountAmount: hasReferralDiscount ? 5.00 : 0,
        referralCreditApplied: hasReferralCredit,
        referralCreditAmount: hasReferralCredit ? 5.00 : 0,
        availableReferralCreditBalance: availableReferralCredit,
        pricing,
        availableDrivers,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Request Ride or Delivery (Passenger/Customer)
 */
ridesRouter.post(['/request', '/'], async (req: Request, res: Response, next: NextFunction) => {
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
      if (existingActive.status === 'COMPLETED' && (existingActive.paymentStatus !== 'PAID' || existingActive.paymentApprovedByDriver === false)) {
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

    const origin = req.body.origin || {
      address: req.body.originAddress || req.body.originZoneId || 'Origem',
      lat: req.body.originLat ?? req.body.pickupLat ?? -23.7928,
      lng: req.body.originLng ?? req.body.pickupLng ?? -45.3999,
    };
    const destination = req.body.destination || {
      address: req.body.destinationAddress || req.body.destAddress || req.body.destinationZoneId || 'Destino',
      lat: req.body.destinationLat ?? req.body.destLat ?? -23.8050,
      lng: req.body.destinationLng ?? req.body.destLng ?? -45.4050,
    };
    const { paymentMethod, requestedDriverId } = req.body;
    if (!origin?.address || !destination?.address) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Origem e destino são obrigatórios.', 400);
    }

    const serviceType: ServiceType = req.body.serviceType === 'delivery' ? 'delivery' : 'ride';
    const isDelivery = serviceType === 'delivery';

    const deliveryDetails: DeliveryDetails | undefined =
      isDelivery && req.body.deliveryDetails
        ? {
            recipientName: String(req.body.deliveryDetails.recipientName || '').trim(),
            recipientPhone: String(req.body.deliveryDetails.recipientPhone || '').trim(),
            packageNotes: req.body.deliveryDetails.packageNotes ? String(req.body.deliveryDetails.packageNotes).trim() : undefined,
          }
        : undefined;

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

    let fare = 0;
    if (isDelivery) {
      const delivCalc = calculateDeliveryFeeForDriver(chosenDriver, distanceKm, 0, pricing);
      fare = delivCalc.fare;
    } else {
      // Calculate fare: if specific driver was chosen by passenger, use that driver's configured pricing!
      const calc = calculateFareForDriver(chosenDriver, origin, destination, distanceKm, durationMinutes, pricing);
      fare = calc.fare;
      isFixedRoute = calc.isFixedRoute;
      fixedRouteName = calc.fixedRouteName;
    }

    const hasDiscount = Boolean(passenger.hasCriminalRecordCheck || passenger.criminalRecordStatus === 'VERIFIED');
    const hasReferralDiscount = Boolean(passenger.referralDiscountAvailable && (!passenger.totalRides || passenger.totalRides === 0));

    const wantsCreditRedemption = Boolean(req.body.applyReferralCredit);
    const availableCredit = passenger.referralCreditBalance || 0;
    if (wantsCreditRedemption) {
      if (availableCredit < 5.00) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Saldo de créditos de indicação insuficiente para resgate (mínimo R$ 5,00).', 400);
      }
      if (hasReferralDiscount) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Não é possível cumular desconto de primeira corrida com resgate de créditos.', 400);
      }
    }
    const canRedeemCredit = wantsCreditRedemption && !hasReferralDiscount && availableCredit >= 5.00;

    const originalFare = fare;
    let discountAmount = 0;
    if (hasDiscount) {
      discountAmount += Math.round(originalFare * 0.05 * 100) / 100;
    }
    let referralDiscountAmt = 0;
    if (hasReferralDiscount) {
      referralDiscountAmt = Math.min(5.00, Math.max(0, originalFare - discountAmount - 5.00));
      discountAmount += referralDiscountAmt;
    }
    let referralCreditAmt = 0;
    if (canRedeemCredit) {
      referralCreditAmt = Math.min(5.00, Math.max(0, originalFare - discountAmount - 5.00));
      discountAmount += referralCreditAmt;
    }
    discountAmount = Math.round(discountAmount * 100) / 100;
    const finalFare = Math.max(5.00, Math.round((originalFare - discountAmount) * 100) / 100);
    const anyDiscountApplied = discountAmount > 0;

    const platformSubsidyAmt = referralDiscountAmt + referralCreditAmt;
    const platformSubsidyStatus = platformSubsidyAmt > 0 ? 'PENDING_SETTLEMENT' : 'NONE';
    const driverTotalEntitlement = originalFare;

    const rideId = `ride-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const ride: Ride = {
      id: rideId,
      serviceType,
      deliveryDetails,
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
      passengerFareAmount: finalFare,
      driverTotalEntitlement,
      platformSubsidyAmount: platformSubsidyAmt,
      platformSubsidyStatus,
      discountAmount,
      discountApplied: anyDiscountApplied,
      referralDiscountApplied: hasReferralDiscount,
      referralDiscountAmount: referralDiscountAmt,
      referralCreditApplied: canRedeemCredit,
      referralCreditAmount: referralCreditAmt,
      fixedRouteApplied: isFixedRoute,
      fixedRouteName: fixedRouteName,
      paymentMethod: method,
      paymentStatus: 'PENDING',
      status: initialStatus,
      requestedAt: now,
      acceptedAt: undefined,
    };

    if (req.body.__simulateRideCreationFailure) {
      (ride as any).__simulateRideCreationFailure = true;
    }

    // Atomically save the ride and debit referral credit (if redeemed) in a single ACID transaction
    const creditDebitAmt = (canRedeemCredit && referralCreditAmt > 0) ? referralCreditAmt : 0;
    const atomicResult = await createRideAtomic(ride, creditDebitAmt);
    if (!atomicResult.success) {
      if (atomicResult.errorReason === 'INSUFFICIENT_CREDIT') {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Saldo de crédito de indicação insuficiente para resgate.', 400);
      }
      throw new AppError(ErrorCode.INTERNAL_ERROR, atomicResult.errorReason || 'Erro ao processar criação da corrida.', 500);
    }

    const payload = formatRidePayload(ride);
    broadcastLiveEvent('RIDE_CREATED', payload);

    // Asynchronously trigger server-side dispatch to find eligible driver and create targeted 20s offer
    dispatchNextCandidate(ride.id).catch(err => {
      console.error(`[Dispatch] Error triggering dispatch for ride ${ride.id}:`, err);
    });

    res.status(201).json({
      success: true,
      requestId: req.id,
      data: payload,
      ...payload,
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

    if (!['REQUESTED', 'OFFERED'].includes(ride.status)) {
      throw new AppError(ErrorCode.INVALID_RIDE_STATE, `Esta corrida não está mais disponível (status: ${ride.status}).`, 409);
    }

    const now = new Date().toISOString();
    if (ride.currentOfferId) {
      const offer = await getRideOffer(ride.currentOfferId);
      if (offer && offer.status === 'PENDING') {
        await saveRideOffer({ ...offer, status: 'ACCEPTED', respondedAt: now });
      }
    }
    const pixInfo = getDriverPixInfo(driver);
    const updatedRide: Ride = {
      ...ride,
      driverId: driver.uid,
      driverName: driver.name,
      driverPhone: driver.whatsapp,
      driverPhotoUrl: driver.photoUrl,
      vehicle: driver.vehicle,
      driverPixKey: pixInfo.pixKey,
      driverPixName: pixInfo.pixName,
      driverPixKeyType: pixInfo.pixKeyType,
      status: 'DRIVER_ARRIVING',
      acceptedAt: now,
    };

    await saveRide(updatedRide);

    const payload = formatRidePayload(updatedRide);
    broadcastLiveEvent('RIDE_UPDATED', payload);

    res.json({
      success: true,
      requestId: req.id,
      data: payload,
      ride: payload,
      ...payload,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Driver Arrived at Pickup
 * Transition: DRIVER_ARRIVING -> ARRIVED (starts 4-minute waiting timer)
 */
const handleDriverArrived = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ride = await getRide(String(req.params.id));
    if (!ride) throw new AppError(ErrorCode.NOT_FOUND, 'Corrida não encontrada.', 404);

    const driver = await resolveDriverProfile(req.user!.uid, req.user!.email);
    const isOwner = (driver && ride.driverId === driver.uid) || ride.driverId === req.user!.uid || req.user!.isAdmin;
    if (!isOwner) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Apenas o motorista responsável pode atualizar este status.', 403);
    }

    if (ride.status !== 'DRIVER_ARRIVING' && ride.status !== 'ACCEPTED' && (ride.status as string) !== 'EN_ROUTE') {
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

    const payload = formatRidePayload(updatedRide);
    broadcastLiveEvent('RIDE_UPDATED', payload);

    res.json({
      success: true,
      requestId: req.id,
      data: payload,
      ride: payload,
      ...payload,
    });
  } catch (error) {
    next(error);
  }
};

ridesRouter.post('/:id/arrived', handleDriverArrived);
ridesRouter.post('/:id/arrive', handleDriverArrived);

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

    const payload = formatRidePayload(updatedRide);
    broadcastLiveEvent('RIDE_UPDATED', payload);

    res.json({
      success: true,
      requestId: req.id,
      data: payload,
      ride: payload,
      ...payload,
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
        passengerFareAmount: ride.passengerFareAmount || ride.fareAmount,
        driverTotalEntitlement: ride.driverTotalEntitlement || (ride.originalFareAmount || ride.fareAmount),
        platformSubsidyAmount: ride.platformSubsidyAmount || 0,
        platformSubsidyStatus: ride.platformSubsidyStatus || (ride.platformSubsidyAmount ? 'PENDING_SETTLEMENT' : 'NONE'),
        discountAmount: ride.discountAmount,
        discountApplied: ride.discountApplied,
        referralDiscountApplied: ride.referralDiscountApplied,
        referralDiscountAmount: ride.referralDiscountAmount,
        referralCreditApplied: ride.referralCreditApplied,
        referralCreditAmount: ride.referralCreditAmount,
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
      paymentStatus: isPaymentApproved ? 'PAID' : (ride.paymentStatus || 'PENDING'),
      paymentApprovedByDriver: isPaymentApproved,
      paymentApprovedAt: isPaymentApproved ? now : undefined,
      completedAt: now,
      receiptId,
      emailStatus: isPaymentApproved ? 'PENDING' : undefined,
    };

    await saveRide(updatedRide);

    // Process referral reward for qualifying first completed ride
    await processReferralRewardOnCompletion(updatedRide);

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

    const payload = formatRidePayload(updatedRide);
    broadcastLiveEvent('RIDE_UPDATED', payload);

    res.json({
      success: true,
      requestId: req.id,
      data: {
        ride: payload,
        receipt,
        ...payload,
      },
      ride: payload,
      ...payload,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Driver (or Admin) Approves Payment for Ride
 * Unlocks passenger to request new rides and issues official receipt
 */
export async function approveRidePaymentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const ride = await getRide(String(req.params.id));
    if (!ride) throw new AppError(ErrorCode.NOT_FOUND, 'Corrida não encontrada.', 404);

    const driver = await resolveDriverProfile(req.user!.uid, req.user!.email);
    const isOwner = (driver && ride.driverId === driver.uid) || ride.driverId === req.user!.uid || req.user!.isAdmin;
    if (!isOwner) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Apenas o motorista responsável pode aprovar o pagamento.', 403);
    }

    if (ride.paymentApprovedByDriver && ride.paymentStatus === 'PAID') {
      const receipt = ride.receiptId ? await getReceipt(ride.receiptId) : null;
      return res.json({
        success: true,
        requestId: req.id,
        message: 'Pagamento já confirmado anteriormente.',
        data: {
          ride: formatRidePayload(ride),
          receipt,
        },
      });
    }

    if (ride.status.startsWith('CANCELLED')) {
      throw new AppError(ErrorCode.INVALID_RIDE_STATE, 'Não é possível aprovar pagamento de corrida cancelada.', 400);
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
        passengerFareAmount: ride.passengerFareAmount || ride.fareAmount,
        driverTotalEntitlement: ride.driverTotalEntitlement || (ride.originalFareAmount || ride.fareAmount),
        platformSubsidyAmount: ride.platformSubsidyAmount || 0,
        platformSubsidyStatus: ride.platformSubsidyStatus || (ride.platformSubsidyAmount ? 'PENDING_SETTLEMENT' : 'NONE'),
        discountAmount: ride.discountAmount,
        discountApplied: ride.discountApplied,
        referralDiscountApplied: ride.referralDiscountApplied,
        referralDiscountAmount: ride.referralDiscountAmount,
        referralCreditApplied: ride.referralCreditApplied,
        referralCreditAmount: ride.referralCreditAmount,
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

    // Process referral reward for qualifying first completed ride
    await processReferralRewardOnCompletion(updatedRide);

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

    const payload = formatRidePayload(updatedRide);
    broadcastLiveEvent('RIDE_UPDATED', payload);

    res.json({
      success: true,
      requestId: req.id,
      data: {
        ride: payload,
        receipt,
      },
    });
  } catch (error) {
    next(error);
  }
}

ridesRouter.post('/:id/approve-payment', approveRidePaymentHandler);

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

    const formattedReason = isEmergency
      ? `[EMERGÊNCIA] ${String(reason || '').trim() || 'Ocorrência emergencial informada durante a viagem'}`
      : (String(reason || '').trim() || 'Cancelado pelo usuário');

    // Rule: If driver cancels before trip starts (DRIVER_ARRIVING or ARRIVED), detach driver, record in declinedDriverIds, return to REQUESTED and redispatch!
    if (isDriver && ride.status !== 'IN_PROGRESS') {
      const declined = ride.declinedDriverIds || [];
      const updatedDeclined = declined.includes(uid) ? declined : [...declined, uid];
      const now = new Date().toISOString();

      const redispatchedRide: Ride = {
        ...ride,
        driverId: undefined,
        driverName: undefined,
        driverPhone: undefined,
        driverPhotoUrl: undefined,
        vehicle: undefined,
        acceptedAt: undefined,
        arrivedAt: undefined,
        waitingTimerStartedAt: undefined,
        declinedDriverIds: updatedDeclined,
        lastDriverCancelledAt: now,
        lastDriverCancelReason: formattedReason,
        status: 'REQUESTED',
        currentOfferId: undefined,
      };

      await saveRide(redispatchedRide);
      const redispatchPayload = formatRidePayload(redispatchedRide);
      broadcastLiveEvent('RIDE_UPDATED', redispatchPayload);

      // Immediately redispatch to the next eligible online driver
      dispatchNextCandidate(redispatchedRide.id).catch(err => {
        console.error(`[Dispatch] Error redispatching after driver cancellation for ride ${redispatchedRide.id}:`, err);
      });

      return res.json({
        success: true,
        requestId: req.id,
        data: {
          ...redispatchPayload,
          redispatched: true,
        },
      });
    }

    // Expire any active targeted offers for this ride
    const pendingOffers = await listOffersForRide(ride.id);
    for (const off of pendingOffers) {
      if (off.status === 'PENDING') {
        await saveRideOffer({
          ...off,
          status: 'EXPIRED',
          respondedAt: new Date().toISOString(),
        });
      }
    }

    // If passenger redeemed referral credit on this ride, atomically refund it
    if (ride.referralCreditApplied && (ride.referralCreditAmount || 0) > 0) {
      await refundReferralCreditForRide(ride);
    }

    const cancelledBy = isAdmin ? 'ADMIN' : isPassenger ? 'passenger' : isDriver ? 'driver' : 'system';
    const newStatus: RideStatus = isAdmin ? 'CANCELLED_BY_ADMIN' : isPassenger ? 'CANCELLED_BY_PASSENGER' : isDriver ? 'CANCELLED_BY_DRIVER' : 'CANCELLED_BY_SYSTEM';

    const updatedRide: Ride = {
      ...ride,
      status: newStatus,
      cancelledAt: new Date().toISOString(),
      cancelledBy,
      cancelReason: formattedReason,
      isEmergencyCancellation: !!isEmergency,
      currentOfferId: undefined,
      platformSubsidyStatus: (ride.platformSubsidyAmount || 0) > 0 ? 'CANCELLED' : 'NONE',
    };

    await saveRide(updatedRide);

    const payload = formatRidePayload(updatedRide);
    broadcastLiveEvent('RIDE_UPDATED', payload);
    broadcastLiveEvent('RIDE_CANCELLED', { rideId: updatedRide.id, reason: formattedReason, cancelledBy });

    res.json({
      success: true,
      requestId: req.id,
      data: payload,
      ride: payload,
      ...payload,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/rides
 * Returns available requested rides for drivers, or active rides for passengers
 */
ridesRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driver = await resolveDriverProfile(req.user!.uid, req.user!.email);
    if (driver && driver.status === 'APPROVED') {
      const allRides = await listAllRides();
      const isBicycle = driver.vehicle?.type === 'bicycle';
      const servicesOffered = driver.servicesOffered || (driver.isCourier || isBicycle ? ['delivery'] : ['ride']);
      const offersDelivery = servicesOffered.includes('delivery');
      const offersRide = !isBicycle && servicesOffered.includes('ride');

      const now = Date.now();
      const MAX_AGE_MS = 10 * 60 * 1000;

      const available = allRides.filter((r) => {
        if (r.status !== 'REQUESTED') return false;
        if (r.driverId && r.driverId !== driver.uid) return false;
        if (r.declinedDriverIds && r.declinedDriverIds.includes(driver.uid)) return false;

        // Auto-expire stale ride
        const reqTime = new Date(r.requestedAt || (r as any).createdAt || 0).getTime();
        if (now - reqTime > MAX_AGE_MS) {
          saveRide({
            ...r,
            status: 'CANCELLED_BY_SYSTEM',
            cancelledAt: new Date().toISOString(),
            cancelledBy: 'system',
            cancelReason: 'Tempo limite de busca expirado.',
          }).catch(console.error);
          return false;
        }

        // Distance matching (unless testMode is active)
        if (!config.testMode && driver.currentLocation?.lat && r.origin?.lat) {
          const dist = calculateDistanceKm(driver.currentLocation.lat, driver.currentLocation.lng, r.origin.lat, r.origin.lng);
          if (dist > 15.0) return false;
        }

        const rideService = r.serviceType || 'ride';
        if (rideService === 'delivery' && !offersDelivery) return false;
        if (rideService === 'ride' && !offersRide) return false;
        return true;
      });

      return res.json({ success: true, requestId: req.id, data: available.map(formatRidePayload) });
    }

    const active = await getActiveRideForUser(req.user!.uid, 'passenger');
    return res.json({ success: true, requestId: req.id, data: active ? [formatRidePayload(active)] : [] });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH or POST /api/v1/rides/:id/status
 * Unified ride status transition endpoint for mobile/web clients
 */
ridesRouter.all('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, cancellationReason } = req.body;
    const rideId = String(req.params.id);
    const ride = await getRide(rideId);
    if (!ride) throw new AppError(ErrorCode.NOT_FOUND, 'Corrida não encontrada.', 404);

    if (status === 'ACCEPTED' || status === 'DRIVER_ARRIVING') {
      const driver = await resolveDriverProfile(req.user!.uid, req.user!.email);
      if (!driver || driver.status !== 'APPROVED') {
        throw new AppError(ErrorCode.FORBIDDEN, 'Apenas motoristas aprovados podem aceitar corridas.', 403);
      }
      if (!driver.isOnline) {
        throw new AppError(ErrorCode.FORBIDDEN, 'Você deve estar online para aceitar corridas.', 403);
      }
      const pixInfo = getDriverPixInfo(driver);
      const updatedRide: Ride = {
        ...ride,
        driverId: driver.uid,
        driverName: driver.name,
        driverPhone: driver.whatsapp,
        driverPhotoUrl: driver.photoUrl,
        vehicle: driver.vehicle,
        driverPixKey: pixInfo.pixKey,
        driverPixName: pixInfo.pixName,
        driverPixKeyType: pixInfo.pixKeyType,
        status: 'DRIVER_ARRIVING',
        acceptedAt: new Date().toISOString(),
      };
      await saveRide(updatedRide);
      const payload = formatRidePayload(updatedRide);
      broadcastLiveEvent('RIDE_UPDATED', payload);
      return res.json({ success: true, requestId: req.id, data: payload, ride: payload, ...payload });
    }

    const updatedRide: Ride = {
      ...ride,
      status: status || ride.status,
      cancelReason: cancellationReason || ride.cancelReason,
    };
    await saveRide(updatedRide);
    const payload = formatRidePayload(updatedRide);
    broadcastLiveEvent('RIDE_UPDATED', payload);
    res.json({ success: true, requestId: req.id, data: payload, ride: payload, ...payload });
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

    let populatedRide = ride;
    if (ride.driverId && (!ride.driverPixKey || !ride.driverPixName)) {
      const driver = await getDriverProfile(ride.driverId);
      if (driver) {
        const pixInfo = getDriverPixInfo(driver);
        populatedRide = {
          ...ride,
          driverPixKey: pixInfo.pixKey,
          driverPixName: pixInfo.pixName,
          driverPixKeyType: pixInfo.pixKeyType,
        };
      }
    }

    const payload = formatRidePayload(populatedRide);
    res.json({
      success: true,
      requestId: req.id,
      data: payload,
      ride: payload,
      ...payload,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/rides/:id/pix
 * Secure endpoint to fetch driver PIX details for an active ride.
 * Access is strictly restricted to:
 * 1. Assigned Passenger
 * 2. Assigned Driver
 * 3. Admin
 */
ridesRouter.get('/:id/pix', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ride = await getRide(String(req.params.id));
    if (!ride) throw new AppError(ErrorCode.NOT_FOUND, 'Corrida não encontrada.', 404);

    const uid = req.user!.uid;
    const isPassenger = ride.passengerId === uid;
    const isDriver = ride.driverId === uid;
    const isAdmin = !!req.user!.isAdmin;

    if (!isPassenger && !isDriver && !isAdmin) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Acesso restrito aos dados de pagamento desta corrida.', 403);
    }

    let pixKey = ride.driverPixKey;
    let pixName = ride.driverPixName;
    let pixKeyType = ride.driverPixKeyType || 'PHONE';

    if ((!pixKey || !pixName) && ride.driverId) {
      const driver = await getDriverProfile(ride.driverId);
      if (driver) {
        const pix = getDriverPixInfo(driver);
        pixKey = pix.pixKey;
        pixName = pix.pixName;
        pixKeyType = pix.pixKeyType;
      }
    }

    const fareAmount = ride.fareAmount ?? (ride as any).fareBrl ?? (ride as any).fare ?? 0;

    res.json({
      success: true,
      requestId: req.id,
      rideId: ride.id,
      driverName: ride.driverName || pixName || 'Motorista Parceiro',
      driverPixKey: pixKey || '',
      driverPixName: pixName || ride.driverName || 'Motorista Parceiro',
      driverPixKeyType: pixKeyType,
      fareAmount,
      status: ride.status,
      paymentStatus: ride.paymentStatus || 'PENDING',
      paymentApprovedByDriver: !!ride.paymentApprovedByDriver,
      paymentDeclaredAt: ride.paymentDeclaredAt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/rides/:id/declare-payment
 * Called by passenger when they press "JÁ FIZ O PAGAMENTO".
 * Sets ride.paymentStatus = 'PAYMENT_PENDING_DRIVER_CONFIRMATION'.
 * Passenger declaration DOES NOT approve the payment or unlock the account.
 */
ridesRouter.post('/:id/declare-payment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ride = await getRide(String(req.params.id));
    if (!ride) throw new AppError(ErrorCode.NOT_FOUND, 'Corrida não encontrada.', 404);

    const uid = req.user!.uid;
    const isPassenger = ride.passengerId === uid;
    const isAdmin = !!req.user!.isAdmin;

    if (!isPassenger && !isAdmin) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Apenas o passageiro pode informar o pagamento.', 403);
    }

    const now = new Date().toISOString();
    const updatedRide: Ride = {
      ...ride,
      paymentStatus: 'PAYMENT_PENDING_DRIVER_CONFIRMATION',
      paymentDeclaredAt: now,
    };

    await saveRide(updatedRide);

    let populatedRide = updatedRide;
    if (updatedRide.driverId && (!updatedRide.driverPixKey || !updatedRide.driverPixName)) {
      const driver = await getDriverProfile(updatedRide.driverId);
      if (driver) {
        const pixInfo = getDriverPixInfo(driver);
        populatedRide = {
          ...updatedRide,
          driverPixKey: pixInfo.pixKey,
          driverPixName: pixInfo.pixName,
          driverPixKeyType: pixInfo.pixKeyType,
        };
      }
    }

    const payload = formatRidePayload(populatedRide);
    broadcastLiveEvent('RIDE_UPDATED', payload);

    res.json({
      success: true,
      requestId: req.id,
      message: 'Pagamento informado com sucesso. Aguardando confirmação do motorista.',
      data: payload,
      ride: payload,
      ...payload,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/rides/:id/driver-location
 * Returns real-time driver GPS telemetry, distance, and ETA to passenger
 */
ridesRouter.get('/:id/driver-location', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ride = await getRide(String(req.params.id));
    if (!ride) throw new AppError(ErrorCode.NOT_FOUND, 'Corrida não encontrada.', 404);

    const uid = req.user!.uid;
    const isPassenger = ride.passengerId === uid;
    const isDriver = ride.driverId === uid;
    const isAdmin = !!req.user!.isAdmin;
    if (!isPassenger && !isDriver && !isAdmin) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Acesso restrito à localização desta corrida.', 403);
    }

    if (!ride.driverId) {
      return res.json({
        success: true,
        hasLiveLocation: false,
        status: ride.status,
        arrivedAt: ride.arrivedAt,
      });
    }

    const driver = await getDriverProfile(ride.driverId);
    const loc = driver?.currentLocation || ride.driverLocation;

    if (!loc || !loc.lat || !loc.lng) {
      return res.json({
        success: true,
        hasLiveLocation: false,
        status: ride.status,
        arrivedAt: ride.arrivedAt,
      });
    }

    const targetLat = (ride.status === 'IN_PROGRESS' && ride.destination) ? ride.destination.lat : ride.origin.lat;
    const targetLng = (ride.status === 'IN_PROGRESS' && ride.destination) ? ride.destination.lng : ride.origin.lng;

    const distanceKm = Math.round(calculateDistanceKm(loc.lat, loc.lng, targetLat, targetLng) * 10) / 10;
    const etaMinutes = Math.max(1, Math.round((distanceKm / 30) * 60)); // ~30 km/h urban speed

    const updatedAtMs = loc.updatedAt ? new Date(loc.updatedAt).getTime() : Date.now();
    const secondsAgo = Math.max(0, Math.floor((Date.now() - updatedAtMs) / 1000));
    const isStale = (driver as any)?.isGpsStale ?? (secondsAgo > 60);

    const driverLocation = {
      lat: loc.lat,
      lng: loc.lng,
      heading: loc.heading ?? null,
      speed: loc.speed ?? null,
      accuracy: loc.accuracy ?? null,
      updatedAt: loc.updatedAt || new Date().toISOString(),
      distanceKm,
      etaMinutes,
      isStale,
      secondsAgo,
    };

    return res.json({
      success: true,
      hasLiveLocation: true,
      status: ride.status,
      arrivedAt: ride.arrivedAt,
      driverLocation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/rides/:id/driver-location
 * Updates live location for active ride and driver profile
 */
ridesRouter.post('/:id/driver-location', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ride = await getRide(String(req.params.id));
    if (!ride) throw new AppError(ErrorCode.NOT_FOUND, 'Corrida não encontrada.', 404);

    const uid = req.user!.uid;
    const driver = await resolveDriverProfile(uid, req.user!.email);
    const isAssignedDriver = (driver && ride.driverId === driver.uid) || ride.driverId === uid || !!req.user!.isAdmin;
    if (!isAssignedDriver) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Apenas o motorista atribuído à corrida pode atualizar a localização.', 403);
    }

    const { lat, lng, heading, speed, accuracy } = req.body;
    if (lat === undefined || lng === undefined) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Latitude e longitude são obrigatórias.', 400);
    }

    const driverId = ride.driverId || driver?.uid || uid;
    const now = new Date().toISOString();
    const driverLoc = {
      lat: Number(lat),
      lng: Number(lng),
      heading: heading !== undefined ? Number(heading) : undefined,
      speed: speed !== undefined ? Number(speed) : undefined,
      accuracy: accuracy !== undefined ? Number(accuracy) : undefined,
      updatedAt: now,
    };

    if (driverId) {
      const driver = await getDriverProfile(driverId);
      if (driver) {
        await saveDriverProfile({
          ...driver,
          currentLocation: driverLoc,
          updatedAt: now,
        });
      }
    }

    const updatedRide: Ride = {
      ...ride,
      driverLocation: driverLoc,
    };
    await saveRide(updatedRide);

    broadcastLiveEvent('DRIVER_LOCATION_UPDATED', {
      rideId: ride.id,
      driverId,
      driverLocation: driverLoc,
    });

    res.json({
      success: true,
      requestId: req.id,
      driverLocation: driverLoc,
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
