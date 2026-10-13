import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../api/src/server.js';
import {
  saveDriverProfile,
  getDriverProfile,
  listOnlineDrivers,
  saveRide,
  isDriverGpsFresh,
  isDriverLiveAndEligible,
  GPS_FRESHNESS_THRESHOLD_MS,
} from '../api/src/services/firestore.js';
import { findEligibleCandidates } from '../api/src/services/dispatch.js';
import { DriverProfile, Ride } from '../shared/src/types.js';

describe('VaiCar Platform — GPS Freshness, Offline State & Driver Availability Test Matrix', () => {
  const passengerToken = 'test-token:passenger-freshness@vaicar.app';

  function createTestDriver(overrides: Partial<DriverProfile>): DriverProfile {
    const uid = overrides.uid || `drv-fresh-${Math.random().toString(36).substring(2, 9)}`;
    return {
      uid,
      name: `Condutor Teste ${uid}`,
      email: `${uid}@teste.vaicar.app`,
      whatsapp: '12999990000',
      photoUrl: '/uploads/drivers/test.jpg',
      professionalCategory: 'EAR',
      cnhNumber: '12345678900',
      status: 'APPROVED',
      isOnline: true,
      vehicle: {
        brand: 'Volkswagen',
        model: 'Polo',
        year: 2023,
        color: 'Branco',
        plate: 'ABC1D23',
        type: 'car',
      },
      operatingZones: ['Centro & Porto Grande'],
      servicesOffered: ['ride'],
      rating: 5.0,
      completedRidesCount: 10,
      currentLocation: {
        lat: -23.8055,
        lng: -45.4011,
        heading: 90,
        updatedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  const pickup = { lat: -23.8050, lng: -45.4010, address: 'Rua da Praia, 100 - Centro' };
  const destination = { lat: -23.7915, lng: -45.5683, address: 'Praia de Maresias, 500' };

  const testRide: Ride = {
    id: 'ride-fresh-matrix-01',
    passengerId: 'pass-01',
    passengerName: 'Passageiro Teste',
    passengerPhone: '12988887777',
    serviceType: 'ride',
    origin: pickup,
    pickupLocation: pickup,
    destination: destination,
    destinationLocation: destination,
    distanceKm: 27.5,
    durationMinutes: 38,
    fareAmount: 37.85,
    paymentMethod: 'PIX',
    paymentStatus: 'PENDING',
    status: 'REQUESTED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('CASE 1: Driver approved + online + fresh GPS (<= 60s) -> visible, counted, dispatch eligible', async () => {
    const freshDriver = createTestDriver({
      uid: 'drv-c1-fresh',
      status: 'APPROVED',
      isOnline: true,
      currentLocation: {
        lat: -23.8055,
        lng: -45.4011,
        heading: 90,
        updatedAt: new Date(Date.now() - 10000).toISOString(), // 10s ago
      },
    });
    await saveDriverProfile(freshDriver);

    // 1. Authoritative eligibility check
    expect(isDriverGpsFresh(freshDriver.currentLocation)).toBe(true);
    expect(isDriverLiveAndEligible(freshDriver)).toBe(true);

    // 2. GET /api/v1/drivers/online
    const res = await request(app).get('/api/v1/drivers/online');
    expect(res.status).toBe(200);
    const visibleUids = res.body.data.map((d: any) => d.uid);
    expect(visibleUids).toContain('drv-c1-fresh');

    // 3. POST /api/v1/rides/estimate
    const estRes = await request(app)
      .post('/api/v1/rides/estimate')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ origin: pickup, destination });
    expect(estRes.status).toBe(200);
    const estDriverIds = estRes.body.data.availableDrivers.map((d: any) => d.driverId);
    expect(estDriverIds).toContain('drv-c1-fresh');

    // 4. Dispatch eligibility
    const candidates = await findEligibleCandidates(testRide);
    const candidateUids = candidates.map(c => c.driver.uid);
    expect(candidateUids).toContain('drv-c1-fresh');
  });

  it('CASE 2: Driver approved + online + GPS older than 60 seconds -> NOT visible, NOT counted, NOT dispatch eligible', async () => {
    const staleDriver = createTestDriver({
      uid: 'drv-c2-stale',
      status: 'APPROVED',
      isOnline: true,
      currentLocation: {
        lat: -23.8055,
        lng: -45.4011,
        heading: 90,
        updatedAt: new Date(Date.now() - 75000).toISOString(), // 75s ago (> 60s)
      },
    });
    await saveDriverProfile(staleDriver);

    // 1. Authoritative eligibility check
    expect(isDriverGpsFresh(staleDriver.currentLocation)).toBe(false);
    expect(isDriverLiveAndEligible(staleDriver)).toBe(false);

    // 2. GET /api/v1/drivers/online
    const res = await request(app).get('/api/v1/drivers/online');
    expect(res.status).toBe(200);
    const visibleUids = res.body.data.map((d: any) => d.uid);
    expect(visibleUids).not.toContain('drv-c2-stale');

    // 3. POST /api/v1/rides/estimate
    const estRes = await request(app)
      .post('/api/v1/rides/estimate')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ origin: pickup, destination });
    expect(estRes.status).toBe(200);
    const estDriverIds = estRes.body.data.availableDrivers.map((d: any) => d.driverId);
    expect(estDriverIds).not.toContain('drv-c2-stale');

    // 4. Dispatch eligibility
    const candidates = await findEligibleCandidates(testRide);
    const candidateUids = candidates.map(c => c.driver.uid);
    expect(candidateUids).not.toContain('drv-c2-stale');
  });

  it('CASE 3: Driver approved + offline + recent GPS -> NOT visible, NOT counted, NOT dispatch eligible', async () => {
    const offlineDriver = createTestDriver({
      uid: 'drv-c3-offline',
      status: 'APPROVED',
      isOnline: false,
      currentLocation: {
        lat: -23.8055,
        lng: -45.4011,
        heading: 90,
        updatedAt: new Date(Date.now() - 5000).toISOString(), // 5s ago but offline
      },
    });
    await saveDriverProfile(offlineDriver);

    expect(isDriverLiveAndEligible(offlineDriver)).toBe(false);

    const res = await request(app).get('/api/v1/drivers/online');
    expect(res.status).toBe(200);
    const visibleUids = res.body.data.map((d: any) => d.uid);
    expect(visibleUids).not.toContain('drv-c3-offline');

    const estRes = await request(app)
      .post('/api/v1/rides/estimate')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ origin: pickup, destination });
    expect(estRes.status).toBe(200);
    const estDriverIds = estRes.body.data.availableDrivers.map((d: any) => d.driverId);
    expect(estDriverIds).not.toContain('drv-c3-offline');

    const candidates = await findEligibleCandidates(testRide);
    const candidateUids = candidates.map(c => c.driver.uid);
    expect(candidateUids).not.toContain('drv-c3-offline');
  });

  it('CASE 4: Driver approved + online + no GPS timestamp -> NOT visible, NOT counted, NOT dispatch eligible', async () => {
    const noTimestampDriver = createTestDriver({
      uid: 'drv-c4-no-timestamp',
      status: 'APPROVED',
      isOnline: true,
      currentLocation: {
        lat: -23.8055,
        lng: -45.4011,
        heading: 90,
        updatedAt: '', // Missing timestamp
      },
    });
    await saveDriverProfile(noTimestampDriver);

    expect(isDriverGpsFresh(noTimestampDriver.currentLocation)).toBe(false);
    expect(isDriverLiveAndEligible(noTimestampDriver)).toBe(false);

    const res = await request(app).get('/api/v1/drivers/online');
    expect(res.status).toBe(200);
    const visibleUids = res.body.data.map((d: any) => d.uid);
    expect(visibleUids).not.toContain('drv-c4-no-timestamp');

    const candidates = await findEligibleCandidates(testRide);
    const candidateUids = candidates.map(c => c.driver.uid);
    expect(candidateUids).not.toContain('drv-c4-no-timestamp');
  });

  it('CASE 5: Driver unapproved + online + fresh GPS -> NOT visible, NOT counted, NOT dispatch eligible', async () => {
    const pendingDriver = createTestDriver({
      uid: 'drv-c5-pending',
      status: 'PENDING_APPROVAL',
      isOnline: true,
      currentLocation: {
        lat: -23.8055,
        lng: -45.4011,
        heading: 90,
        updatedAt: new Date().toISOString(),
      },
    });
    await saveDriverProfile(pendingDriver);

    expect(isDriverLiveAndEligible(pendingDriver)).toBe(false);

    const res = await request(app).get('/api/v1/drivers/online');
    expect(res.status).toBe(200);
    const visibleUids = res.body.data.map((d: any) => d.uid);
    expect(visibleUids).not.toContain('drv-c5-pending');

    const candidates = await findEligibleCandidates(testRide);
    const candidateUids = candidates.map(c => c.driver.uid);
    expect(candidateUids).not.toContain('drv-c5-pending');
  });

  it('CASE 6: Driver approved + online + fresh GPS + busy on active ride -> NOT available for new ride', async () => {
    const busyDriver = createTestDriver({
      uid: 'drv-c6-busy',
      status: 'APPROVED',
      isOnline: true,
      currentLocation: {
        lat: -23.8055,
        lng: -45.4011,
        heading: 90,
        updatedAt: new Date().toISOString(),
      },
    });
    await saveDriverProfile(busyDriver);

    // Create an ongoing ride for this driver
    const ongoingRide: Ride = {
      id: 'active-trip-c6',
      passengerId: 'pass-99',
      passengerName: 'Outro Passageiro',
      passengerPhone: '12999998888',
      driverId: busyDriver.uid,
      driverName: busyDriver.name,
      driverPhone: busyDriver.whatsapp,
      serviceType: 'ride',
      pickupLocation: pickup,
      destinationLocation: destination,
      distanceKm: 10,
      durationMinutes: 15,
      fareAmount: 25.0,
      paymentMethod: 'PIX',
      paymentStatus: 'PENDING',
      status: 'IN_PROGRESS', // Currently busy on this trip!
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveRide(ongoingRide);

    // 1. Must NOT appear on public available drivers (/drivers/online)
    const res = await request(app).get('/api/v1/drivers/online');
    expect(res.status).toBe(200);
    const visibleUids = res.body.data.map((d: any) => d.uid);
    expect(visibleUids).not.toContain('drv-c6-busy');

    // 2. Must NOT appear as an available ride option (/rides/estimate)
    const estRes = await request(app)
      .post('/api/v1/rides/estimate')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ origin: pickup, destination });
    expect(estRes.status).toBe(200);
    const estDriverIds = estRes.body.data.availableDrivers.map((d: any) => d.driverId);
    expect(estDriverIds).not.toContain('drv-c6-busy');

    // 3. Must NOT be eligible for automatic dispatch
    const candidates = await findEligibleCandidates(testRide);
    const candidateUids = candidates.map(c => c.driver.uid);
    expect(candidateUids).not.toContain('drv-c6-busy');
  });

  it('CASE 7: Driver goes from ONLINE -> OFFLINE -> passenger stops seeing driver, count decreases', async () => {
    const toggleDriver = createTestDriver({
      uid: 'drv-c7-toggle',
      status: 'APPROVED',
      isOnline: true,
      currentLocation: {
        lat: -23.8055,
        lng: -45.4011,
        heading: 90,
        updatedAt: new Date().toISOString(),
      },
    });
    await saveDriverProfile(toggleDriver);

    // 1. While online, visible in /drivers/online
    let res = await request(app).get('/api/v1/drivers/online');
    expect(res.status).toBe(200);
    expect(res.body.data.map((d: any) => d.uid)).toContain('drv-c7-toggle');
    const initialCount = res.body.data.length;

    // 2. Driver switches offline via toggle-online
    const driverToken = `${toggleDriver.uid}:${toggleDriver.email}`;
    const toggleRes = await request(app)
      .post('/api/v1/drivers/toggle-online')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ isOnline: false });
    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.data.isOnline).toBe(false);

    // 3. Immediately stops being returned in /drivers/online and count drops
    res = await request(app).get('/api/v1/drivers/online');
    expect(res.status).toBe(200);
    expect(res.body.data.map((d: any) => d.uid)).not.toContain('drv-c7-toggle');
    expect(res.body.data.length).toBe(initialCount - 1);
  });

  it('CASE 8: Driver stops sending GPS while online -> after freshness threshold expires, marker disappears', async () => {
    // 1. Driver was online with fresh GPS (30s ago)
    const stopGpsDriver = createTestDriver({
      uid: 'drv-c8-stops-gps',
      status: 'APPROVED',
      isOnline: true,
      currentLocation: {
        lat: -23.8055,
        lng: -45.4011,
        heading: 90,
        updatedAt: new Date(Date.now() - 30000).toISOString(), // 30s ago (fresh)
      },
    });
    await saveDriverProfile(stopGpsDriver);

    // Driver is initially visible
    let res = await request(app).get('/api/v1/drivers/online');
    expect(res.body.data.map((d: any) => d.uid)).toContain('drv-c8-stops-gps');

    // 2. Driver app stops sending GPS (e.g. killed / closed / no signal).
    // Now timestamp exceeds 60 seconds (e.g. 65 seconds ago)
    const agedDriver: DriverProfile = {
      ...stopGpsDriver,
      currentLocation: {
        ...stopGpsDriver.currentLocation!,
        updatedAt: new Date(Date.now() - 65000).toISOString(), // 65s ago (stale > 60s)
      },
    };
    await saveDriverProfile(agedDriver);

    // 3. Verification: Driver is immediately filtered out of /drivers/online
    res = await request(app).get('/api/v1/drivers/online');
    expect(res.status).toBe(200);
    expect(res.body.data.map((d: any) => d.uid)).not.toContain('drv-c8-stops-gps');

    // 4. Ineligible for ride estimate
    const estRes = await request(app)
      .post('/api/v1/rides/estimate')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ origin: pickup, destination });
    expect(estRes.status).toBe(200);
    expect(estRes.body.data.availableDrivers.map((d: any) => d.driverId)).not.toContain('drv-c8-stops-gps');

    // 5. Ineligible for dispatch
    const candidates = await findEligibleCandidates(testRide);
    expect(candidates.map(c => c.driver.uid)).not.toContain('drv-c8-stops-gps');
  });
});
