import { Router, Request, Response, NextFunction } from 'express';
import { listOnlineDrivers, getPlatformPricing, getActiveRideForUser, isDriverGpsFresh } from '../services/firestore.js';
import { calculateHaversineDistanceKm, MAX_DISPATCH_RADIUS_KM } from '../services/dispatch.js';
import { calculateFareForDriver } from './rides.js';
import { config } from '../config/index.js';

export const searchRouter = Router();

/**
 * POST /api/v1/search/drivers and /search/drivers
 * Authoritative driver search and fare quote endpoint for mobile & web clients.
 */
searchRouter.post(['/drivers', '/'], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      originLat,
      pickupLat,
      originLng,
      pickupLng,
      destinationLat,
      destLat,
      destinationLng,
      destLng,
      originAddress,
      destinationAddress,
      destAddress,
    } = req.body;

    const lat1 = typeof originLat === 'number' ? originLat : typeof pickupLat === 'number' ? pickupLat : -23.7928;
    const lon1 = typeof originLng === 'number' ? originLng : typeof pickupLng === 'number' ? pickupLng : -45.3999;
    const lat2 = typeof destinationLat === 'number' ? destinationLat : typeof destLat === 'number' ? destLat : -23.8050;
    const lon2 = typeof destinationLng === 'number' ? destinationLng : typeof destLng === 'number' ? destLng : -45.4050;

    const originAddr = String(originAddress || 'Origem').trim();
    const destAddr = String(destinationAddress || destAddress || 'Destino').trim();

    const distanceKm = Math.max(0.5, calculateHaversineDistanceKm(lat1, lon1, lat2, lon2));
    const durationMinutes = Math.max(3, Math.round(distanceKm * 2.5));

    const pricing = await getPlatformPricing();
    const platformBaseFare = Math.max(
      pricing.minimumFare,
      pricing.baseFare + (distanceKm * pricing.perKmRate) + (durationMinutes * pricing.perMinuteRate)
    );

    const onlineDrivers = await listOnlineDrivers({ serviceType: 'ride' });
    const candidateResults: any[] = [];

    for (const driver of onlineDrivers) {
      if (driver.status !== 'APPROVED' || !driver.isOnline) continue;

      // Check GPS
      if (!driver.currentLocation || typeof driver.currentLocation.lat !== 'number' || typeof driver.currentLocation.lng !== 'number') {
        continue;
      }
      if (!isDriverGpsFresh(driver.currentLocation)) {
        continue;
      }

      // Check ongoing trip
      const activeRide = await getActiveRideForUser(driver.uid, 'driver');
      if (activeRide && ['ACCEPTED', 'DRIVER_ARRIVING', 'ARRIVED', 'IN_PROGRESS'].includes(activeRide.status)) {
        continue;
      }

      // Distance to pickup
      const distToPickup = calculateHaversineDistanceKm(
        driver.currentLocation.lat,
        driver.currentLocation.lng,
        lat1,
        lon1
      );

      if (!config.testMode && distToPickup > MAX_DISPATCH_RADIUS_KM) {
        continue;
      }

      const etaMin = Math.max(2, Math.round(distToPickup * 2.5));
      const originObj = { address: originAddr, lat: lat1, lng: lon1 };
      const destObj = { address: destAddr, lat: lat2, lng: lon2 };

      const calc = calculateFareForDriver(driver, originObj, destObj, distanceKm, durationMinutes, pricing);

      candidateResults.push({
        driverId: driver.uid,
        name: driver.name,
        avatarUrl: driver.photoUrl || '',
        ratingAverage: driver.rating || 5.0,
        ratingCount: 15,
        ridesCompleted: 35,
        professionalCategory: 'MOTORISTA',
        vehicle: {
          id: driver.vehicle?.plate || 'veh-1',
          brand: driver.vehicle?.brand || 'Veículo',
          model: driver.vehicle?.model || 'Padrão',
          year: 2022,
          color: driver.vehicle?.color || 'Branco',
          licensePlate: driver.vehicle?.plate || '',
          passengerCapacity: 4,
          isApproved: true,
        },
        fare: calc.fare,
        distanceKm: Math.round(distanceKm * 10) / 10,
        estimatedDurationMin: durationMinutes,
        arrivalTimeMin: etaMin,
        isOnline: true,
        distanceToPickupKm: Math.round(distToPickup * 10) / 10,
        estimatedArrivalMinutes: etaMin,
        currentLat: driver.currentLocation.lat,
        currentLng: driver.currentLocation.lng,
      });
    }

    // Sort nearest first
    candidateResults.sort((a, b) => (a.distanceToPickupKm || 0) - (b.distanceToPickupKm || 0));

    res.json({
      totalFound: candidateResults.length,
      distanceKm: Math.round(distanceKm * 10) / 10,
      estimatedDurationMin: durationMinutes,
      dynamicMultiplier: 1.0,
      isDynamicActive: false,
      standardFare: Math.round(platformBaseFare * 100) / 100,
      results: candidateResults,
    });
  } catch (error) {
    next(error);
  }
});
