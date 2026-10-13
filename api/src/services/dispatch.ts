import { getFirebaseAdminFirestore, getFirebaseAdminMessaging } from './firebaseAdmin.js';
import {
  getRide,
  saveRide,
  saveRideOffer,
  getRideOffer,
  listOnlineDrivers,
  getActiveRideForUser,
  resolveDriverProfile,
  getActivePendingOfferForDriver,
} from './firestore.js';
import { Ride, RideOffer, DriverProfile } from '../../../shared/src/types.js';
import { AppError, ErrorCode } from '../middleware/errorHandler.js';
import { config } from '../config/index.js';
import { broadcastLiveEvent } from './liveStream.js';

export const OFFER_TIMEOUT_SECONDS = 20; // STRICT: exactly 20 seconds server-authoritative timer
export const MAX_DISPATCH_RADIUS_KM = 15.0; // STRICT: maximum 15 km
export const MAX_TELEMETRY_AGE_MS = 60000; // STRICT: telemetry no older than 60 seconds

// Active in-memory timers for wakeup optimization (authoritative state is in Firestore)
const activeOfferTimers = new Map<string, NodeJS.Timeout>();

export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export interface CandidateDriver {
  driver: DriverProfile;
  distanceToPickupKm: number;
}

/**
 * Finds eligible online approved drivers sorted nearest first.
 */
export async function findEligibleCandidates(ride: Ride): Promise<CandidateDriver[]> {
  const drivers = await listOnlineDrivers();
  try {
    const fs = await import('fs');
    fs.appendFileSync('scratch/debug.log', `[findEligibleCandidates for ${ride.id}] drivers: ${drivers.map(d => `${d.uid}(${d.status},online=${d.isOnline})`).join(', ')}\n`);
  } catch {}
  const candidates: CandidateDriver[] = [];
  const now = Date.now();
  const isDelivery = ride.serviceType === 'delivery';
  const declinedIds = ride.declinedDriverIds || [];

  for (const driver of drivers) {
    // 1. Must be APPROVED and online
    if (driver.status !== 'APPROVED' || !driver.isOnline) {
      if (driver.uid === 'test-driv-01') {
        try { (await import('fs')).appendFileSync('scratch/debug.log', `[SKIP 1] status=${driver.status} online=${driver.isOnline}\n`); } catch {}
      }
      continue;
    }

    // 2. Must not be in declined list for this ride
    if (declinedIds.includes(driver.uid)) {
      continue;
    }

    // 3. Must have valid GPS location
    if (
      !driver.currentLocation ||
      typeof driver.currentLocation.lat !== 'number' ||
      typeof driver.currentLocation.lng !== 'number'
    ) {
      continue;
    }

    // 4. GPS Telemetry freshness: strictly required and <= 60 seconds
    if (!driver.currentLocation.updatedAt) {
      continue;
    }
    const telemetryTime = new Date(driver.currentLocation.updatedAt).getTime();
    if (isNaN(telemetryTime)) {
      continue;
    }
    const ageMs = now - telemetryTime;
    if (ageMs > MAX_TELEMETRY_AGE_MS || ageMs < -5000) {
      continue;
    }

    // 5. Vehicle / Capability match:
    const vehicleType = driver.vehicle?.type || (driver.isCourier ? 'motorcycle' : 'car');
    const isBicycle = vehicleType === 'bicycle';
    const services = driver.servicesOffered && driver.servicesOffered.length > 0
      ? driver.servicesOffered
      : (driver.isCourier || isBicycle ? ['delivery'] : ['ride']);

    if (isDelivery) {
      if (!services.includes('delivery')) {
        continue;
      }
      const validDeliveryVehicles = ['car', 'motorcycle', 'van', 'bicycle'];
      if (!validDeliveryVehicles.includes(vehicleType)) {
        continue;
      }
    } else {
      if (isBicycle) {
        continue;
      }
      if (!services.includes('ride')) {
        continue;
      }
      const validPassengerVehicles = ['car', 'motorcycle', 'van'];
      if (!validPassengerVehicles.includes(vehicleType)) {
        continue;
      }
      if (!driver.vehicle || !driver.vehicle.plate) {
        continue;
      }
    }

    // 6. Availability: Driver must not have an active ongoing trip
    const activeRide = await getActiveRideForUser(driver.uid, 'driver');
    if (
      activeRide &&
      activeRide.id !== ride.id &&
      ['ACCEPTED', 'DRIVER_ARRIVING', 'ARRIVED', 'IN_PROGRESS'].includes(activeRide.status)
    ) {
      continue;
    }

    // 7. Driver must not have an active pending offer for another ride that is currently active
    const pendingOffer = await getActivePendingOfferForDriver(driver.uid);
    if (pendingOffer && pendingOffer.rideId !== ride.id) {
      const pendingRide = await getRide(pendingOffer.rideId);
      if (pendingRide && ['REQUESTED', 'OFFERED'].includes(pendingRide.status)) {
        const expiresMs = new Date(pendingOffer.expiresAt).getTime();
        if (expiresMs > now) {
          continue;
        }
      }
    }

    // 8. Maximum 15 km Haversine distance
    const dist = calculateHaversineDistanceKm(
      driver.currentLocation.lat,
      driver.currentLocation.lng,
      ride.origin.lat,
      ride.origin.lng
    );
    if (!config.testMode && dist > MAX_DISPATCH_RADIUS_KM) {
      continue;
    }

    candidates.push({ driver, distanceToPickupKm: dist });
  }

  // Sort nearest driver first
  candidates.sort((a, b) => a.distanceToPickupKm - b.distanceToPickupKm);
  return candidates;
}

/**
 * Dispatches the ride to the next eligible driver, creating a 20-second targeted offer.
 * If all candidates are exhausted, transitions ride to CANCELLED_BY_SYSTEM.
 */
export async function dispatchNextCandidate(rideId: string): Promise<RideOffer | null> {
  const ride = await getRide(rideId);
  if (!ride) return null;

  // If already assigned or cancelled/completed, stop dispatch
  if (ride.driverId || !['REQUESTED', 'OFFERED'].includes(ride.status)) {
    return null;
  }

  // Check if current offer is still active
  if (ride.currentOfferId) {
    const currentOffer = await getRideOffer(ride.currentOfferId);
    if (currentOffer && currentOffer.status === 'PENDING') {
      const isUnexpired = new Date(currentOffer.expiresAt).getTime() > Date.now();
      if (isUnexpired) {
        return currentOffer;
      } else {
        // Expired -> mark EXPIRED and add to declined
        await expireOffer(currentOffer.id);
        const refreshed = await getRide(rideId);
        if (!refreshed || refreshed.driverId || !['REQUESTED', 'OFFERED'].includes(refreshed.status)) {
          return null;
        }
      }
    }
  }

  // Find next eligible candidate
  const currentRide = (await getRide(rideId)) || ride;
  const candidates = await findEligibleCandidates(currentRide);

  if (candidates.length === 0) {
    // All drivers exhausted -> CANCELLED_BY_SYSTEM
    const now = new Date().toISOString();
    const cancelledRide: Ride = {
      ...currentRide,
      status: 'CANCELLED_BY_SYSTEM',
      cancelReason: 'Nenhum motorista disponível',
      cancelledAt: now,
      cancelledBy: 'system',
      currentOfferId: undefined,
    };
    await saveRide(cancelledRide);
    return null;
  }

  const chosen = candidates[0];
  const now = Date.now();
  const offerId = `off-${now}-${Math.random().toString(36).substring(2, 7)}`;
  const expiresAt = new Date(now + OFFER_TIMEOUT_SECONDS * 1000).toISOString();

  const offer: RideOffer = {
    id: offerId,
    rideId: currentRide.id,
    driverId: chosen.driver.uid,
    status: 'PENDING',
    createdAt: new Date(now).toISOString(),
    expiresAt,
    distanceKm: chosen.distanceToPickupKm,
    fareAmount: currentRide.fareAmount,
    originalFareAmount: currentRide.originalFareAmount,
    driverTotalEntitlement: currentRide.driverTotalEntitlement || currentRide.originalFareAmount || currentRide.fareAmount,
    platformSubsidyAmount: currentRide.platformSubsidyAmount || 0,
    origin: currentRide.origin,
    destination: currentRide.destination,
    passengerName: currentRide.passengerName,
    passengerPhone: currentRide.passengerPhone,
    passengerPhotoUrl: currentRide.passengerPhotoUrl,
    serviceType: currentRide.serviceType || 'ride',
    deliveryDetails: currentRide.deliveryDetails,
    notes: currentRide.notes || currentRide.deliveryDetails?.packageNotes,
  };

  await saveRideOffer(offer);

  const updatedRide: Ride = {
    ...currentRide,
    status: 'OFFERED',
    currentOfferId: offer.id,
  };
  await saveRide(updatedRide);

  // Send account-specific FCM push notification to target driver
  await sendTargetedOfferNotification(chosen.driver, offer);

  // Set timeout optimization to wake server after 20 seconds
  scheduleOfferTimeout(offer.id, OFFER_TIMEOUT_SECONDS * 1000);

  return offer;
}

/**
 * Sends a targeted FCM push notification to the specific authenticated driver who received the offer.
 * Never broadcasts indiscriminately; uses driver's registered fcmToken.
 */
export async function sendTargetedOfferNotification(driver: DriverProfile, offer: RideOffer): Promise<void> {
  const messaging = getFirebaseAdminMessaging();
  if (!messaging || !driver.fcmToken) return;

  try {
    const isDelivery = offer.serviceType === 'delivery';
    const payload = {
      token: driver.fcmToken,
      data: {
        rideId: offer.rideId,
        offerId: offer.id,
        passengerName: offer.passengerName || (isDelivery ? 'Remetente' : 'Passageiro'),
        passengerPhone: offer.passengerPhone || '',
        originAddress: offer.origin?.address || '',
        destAddress: offer.destination?.address || '',
        fare: String(offer.fareAmount || 0),
        notes: offer.notes || '',
        serviceType: offer.serviceType || 'ride',
        expiresAt: offer.expiresAt,
      },
      android: {
        priority: 'high' as const,
        notification: {
          title: isDelivery ? 'NOVA ENTREGA DISPONÍVEL' : 'NOVA CORRIDA DISPONÍVEL',
          body: `Valor: R$ ${(offer.fareAmount || 0).toFixed(2).replace('.', ',')} • ${offer.origin?.address || 'Origem'}`,
          channelId: 'nova_corrida_channel',
          sound: 'default',
        },
      },
    };
    await messaging.send(payload);
  } catch (err: any) {
    console.warn(`[Dispatch] FCM notification skipped or failed for driver ${driver.uid}:`, err?.message || err);
  }
}

function scheduleOfferTimeout(offerId: string, delayMs: number) {
  if (activeOfferTimers.has(offerId)) {
    clearTimeout(activeOfferTimers.get(offerId)!);
  }
  const timer = setTimeout(async () => {
    activeOfferTimers.delete(offerId);
    try {
      const offer = await getRideOffer(offerId);
      if (offer && offer.status === 'PENDING') {
        await expireOffer(offerId);
      }
    } catch (err) {
      console.error(`[Dispatch] Error handling offer timeout for ${offerId}:`, err);
    }
  }, delayMs);
  activeOfferTimers.set(offerId, timer);
}

/**
 * Driver accepts the targeted offer atomically via Firestore Transaction.
 */
export async function acceptOffer(offerId: string, driverUid: string): Promise<Ride> {
  const db = getFirebaseAdminFirestore();
  const now = new Date().toISOString();

  // Clear timeout timer if active
  if (activeOfferTimers.has(offerId)) {
    clearTimeout(activeOfferTimers.get(offerId)!);
    activeOfferTimers.delete(offerId);
  }

  const driver = await resolveDriverProfile(driverUid);
  if (!driver || driver.status !== 'APPROVED') {
    throw new AppError(ErrorCode.FORBIDDEN, 'Apenas motoristas aprovados podem aceitar corridas.', 403);
  }

  if (db) {
    let resultRide: Ride | null = null;
    await db.runTransaction(async (transaction) => {
      const offerRef = db.collection('ride_offers').doc(offerId);
      const offerDoc = await transaction.get(offerRef);
      if (!offerDoc.exists) throw new AppError(ErrorCode.NOT_FOUND, 'Oferta não encontrada.', 404);
      const offer = offerDoc.data() as RideOffer;

      if (offer.driverId !== driver.uid) {
        throw new AppError(ErrorCode.FORBIDDEN, 'Esta oferta não pertence a este motorista.', 403);
      }
      if (offer.status !== 'PENDING') {
        throw new AppError(ErrorCode.CONFLICT, 'Esta oferta já foi processada ou expirou.', 409);
      }
      if (new Date(offer.expiresAt).getTime() <= Date.now()) {
        transaction.update(offerRef, { status: 'EXPIRED', respondedAt: now });
        throw new AppError(ErrorCode.GONE, 'Tempo esgotado para aceitar a oferta (limite de 20s).', 410);
      }

      const rideRef = db.collection('rides').doc(offer.rideId);
      const rideDoc = await transaction.get(rideRef);
      if (!rideDoc.exists) throw new AppError(ErrorCode.NOT_FOUND, 'Corrida não encontrada.', 404);
      const ride = rideDoc.data() as Ride;

      if (ride.driverId || !['REQUESTED', 'OFFERED'].includes(ride.status)) {
        transaction.update(offerRef, { status: 'EXPIRED', respondedAt: now });
        throw new AppError(ErrorCode.CONFLICT, 'Corrida já foi aceita por outro motorista ou cancelada.', 409);
      }

      transaction.update(offerRef, {
        status: 'ACCEPTED',
        respondedAt: now,
      });

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

      transaction.update(rideRef, updatedRide as any);
      resultRide = updatedRide;
    });

    if (!resultRide) throw new AppError(ErrorCode.INTERNAL_ERROR, 'Falha ao aceitar oferta.', 500);
    broadcastLiveEvent('RIDE_UPDATED', resultRide);
    return resultRide;
  } else {
    // Local in-memory transaction fallback for testing
    const offer = await getRideOffer(offerId);
    if (!offer) throw new AppError(ErrorCode.NOT_FOUND, 'Oferta não encontrada.', 404);
    if (offer.driverId !== driver.uid) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Esta oferta não pertence a este motorista.', 403);
    }
    if (offer.status !== 'PENDING') {
      throw new AppError(ErrorCode.CONFLICT, 'Esta oferta já foi processada ou expirou.', 409);
    }
    if (new Date(offer.expiresAt).getTime() <= Date.now()) {
      await saveRideOffer({ ...offer, status: 'EXPIRED', respondedAt: now });
      throw new AppError(ErrorCode.GONE, 'Tempo esgotado para aceitar a oferta (limite de 20s).', 410);
    }

    const ride = await getRide(offer.rideId);
    if (!ride) throw new AppError(ErrorCode.NOT_FOUND, 'Corrida não encontrada.', 404);
    if (ride.driverId || !['REQUESTED', 'OFFERED'].includes(ride.status)) {
      await saveRideOffer({ ...offer, status: 'EXPIRED', respondedAt: now });
      throw new AppError(ErrorCode.CONFLICT, 'Corrida já foi aceita por outro motorista ou cancelada.', 409);
    }

    await saveRideOffer({ ...offer, status: 'ACCEPTED', respondedAt: now });
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
    broadcastLiveEvent('RIDE_UPDATED', updatedRide);
    return updatedRide;
  }
}

/**
 * Driver declines the targeted offer.
 * Atomically marks offer DECLINED, records driver in declinedDriverIds, and advances dispatch.
 */
export async function declineOffer(offerId: string, driverUid: string): Promise<void> {
  const db = getFirebaseAdminFirestore();
  const now = new Date().toISOString();

  if (activeOfferTimers.has(offerId)) {
    clearTimeout(activeOfferTimers.get(offerId)!);
    activeOfferTimers.delete(offerId);
  }

  let rideIdToAdvance: string | null = null;

  if (db) {
    await db.runTransaction(async (transaction) => {
      const offerRef = db.collection('ride_offers').doc(offerId);
      const offerDoc = await transaction.get(offerRef);
      if (!offerDoc.exists) throw new AppError(ErrorCode.NOT_FOUND, 'Oferta não encontrada.', 404);
      const offer = offerDoc.data() as RideOffer;

      if (offer.driverId !== driverUid) {
        throw new AppError(ErrorCode.FORBIDDEN, 'Esta oferta não pertence a este motorista.', 403);
      }
      if (offer.status !== 'PENDING') return;

      transaction.update(offerRef, { status: 'DECLINED', respondedAt: now });

      const rideRef = db.collection('rides').doc(offer.rideId);
      const rideDoc = await transaction.get(rideRef);
      if (rideDoc.exists) {
        const ride = rideDoc.data() as Ride;
        const declined = ride.declinedDriverIds || [];
        if (!declined.includes(driverUid)) {
          transaction.update(rideRef, {
            declinedDriverIds: [...declined, driverUid],
            status: 'REQUESTED',
            currentOfferId: undefined,
          });
        }
        if (!ride.driverId && ['REQUESTED', 'OFFERED'].includes(ride.status)) {
          rideIdToAdvance = ride.id;
        }
      }
    });
  } else {
    const offer = await getRideOffer(offerId);
    if (!offer) throw new AppError(ErrorCode.NOT_FOUND, 'Oferta não encontrada.', 404);
    if (offer.driverId !== driverUid) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Esta oferta não pertence a este motorista.', 403);
    }
    if (offer.status === 'PENDING') {
      await saveRideOffer({ ...offer, status: 'DECLINED', respondedAt: now });
      const ride = await getRide(offer.rideId);
      if (ride) {
        const declined = ride.declinedDriverIds || [];
        if (!declined.includes(driverUid)) {
          await saveRide({
            ...ride,
            declinedDriverIds: [...declined, driverUid],
            status: 'REQUESTED',
            currentOfferId: undefined,
          });
        }
        if (!ride.driverId && ['REQUESTED', 'OFFERED'].includes(ride.status)) {
          rideIdToAdvance = ride.id;
        }
      }
    }
  }

  // Advance dispatch to next candidate
  if (rideIdToAdvance) {
    await dispatchNextCandidate(rideIdToAdvance);
  }
}

/**
 * Offer expired after 20 seconds.
 * Atomically marks offer EXPIRED, records driver in declinedDriverIds, and advances dispatch.
 */
export async function expireOffer(offerId: string): Promise<void> {
  const db = getFirebaseAdminFirestore();
  const now = new Date().toISOString();

  if (activeOfferTimers.has(offerId)) {
    clearTimeout(activeOfferTimers.get(offerId)!);
    activeOfferTimers.delete(offerId);
  }

  let rideIdToAdvance: string | null = null;

  if (db) {
    await db.runTransaction(async (transaction) => {
      const offerRef = db.collection('ride_offers').doc(offerId);
      const offerDoc = await transaction.get(offerRef);
      if (!offerDoc.exists) return;
      const offer = offerDoc.data() as RideOffer;

      if (offer.status !== 'PENDING') return;

      transaction.update(offerRef, { status: 'EXPIRED', respondedAt: now });

      const rideRef = db.collection('rides').doc(offer.rideId);
      const rideDoc = await transaction.get(rideRef);
      if (rideDoc.exists) {
        const ride = rideDoc.data() as Ride;
        const declined = ride.declinedDriverIds || [];
        if (!declined.includes(offer.driverId)) {
          transaction.update(rideRef, {
            declinedDriverIds: [...declined, offer.driverId],
            status: 'REQUESTED',
            currentOfferId: undefined,
          });
        }
        if (!ride.driverId && ['REQUESTED', 'OFFERED'].includes(ride.status)) {
          rideIdToAdvance = ride.id;
        }
      }
    });
  } else {
    const offer = await getRideOffer(offerId);
    if (offer && offer.status === 'PENDING') {
      await saveRideOffer({ ...offer, status: 'EXPIRED', respondedAt: now });
      const ride = await getRide(offer.rideId);
      if (ride) {
        const declined = ride.declinedDriverIds || [];
        if (!declined.includes(offer.driverId)) {
          await saveRide({
            ...ride,
            declinedDriverIds: [...declined, offer.driverId],
            status: 'REQUESTED',
            currentOfferId: undefined,
          });
        }
        if (!ride.driverId && ['REQUESTED', 'OFFERED'].includes(ride.status)) {
          rideIdToAdvance = ride.id;
        }
      }
    }
  }

  // Advance dispatch to next candidate
  if (rideIdToAdvance) {
    await dispatchNextCandidate(rideIdToAdvance);
  }
}
