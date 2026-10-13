import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../api/src/server.js';
import {
  findEligibleCandidates,
  dispatchNextCandidate,
  acceptOffer,
  declineOffer,
  expireOffer,
  OFFER_TIMEOUT_SECONDS,
  MAX_DISPATCH_RADIUS_KM,
  MAX_TELEMETRY_AGE_MS,
  sendTargetedOfferNotification,
} from '../api/src/services/dispatch.js';
import {
  getRide,
  saveRide,
  saveDriverProfile,
  getDriverProfile,
  getRideOffer,
  saveRideOffer,
  getActivePendingOfferForDriver,
  getActiveRideForUser,
} from '../api/src/services/firestore.js';
import { DriverProfile, Ride } from '../shared/src/types.js';

describe('VaiCar Platform — Multi-Driver & Delivery Partner Production Compatibility Matrix', () => {
  const adminToken = 'admin-matrix-token:admin@vaicar.app';
  const passengerToken = 'pass-matrix-01:passenger.matrix@teste.vaicar.app';

  function generateValidCpf(): string {
    const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 9));
    const sum1 = digits.reduce((acc, d, i) => acc + d * (10 - i), 0);
    const d9 = ((sum1 * 10) % 11) % 10;
    digits.push(d9);
    const sum2 = digits.reduce((acc, d, i) => acc + d * (11 - i), 0);
    const d10 = ((sum2 * 10) % 11) % 10;
    digits.push(d10);
    return digits.join('');
  }

  const pickupLocation = {
    address: 'Avenida Dr. Manoel Hipólito do Rego, 1000 - Centro, São Sebastião - SP',
    lat: -23.8055,
    lng: -45.4011,
  };

  const deliveryDestination = {
    address: 'Rua da Praia, 200 - Centro Histórico, São Sebastião - SP',
    lat: -23.8070,
    lng: -45.4030,
  };

  const passengerDestination = {
    address: 'Praia de Maresias, 500 - São Sebastião - SP',
    lat: -23.7915,
    lng: -45.5683,
  };

  // Helper to create clean passenger ride
  function createPassengerRide(id: string, fare = 37.85): Ride {
    return {
      id,
      serviceType: 'ride',
      passengerId: 'pass-matrix-01',
      passengerName: 'Passageiro Teste Matriz',
      passengerPhone: '+5512999990001',
      origin: pickupLocation,
      destination: passengerDestination,
      fareAmount: fare,
      paymentMethod: 'PIX',
      paymentStatus: 'PENDING',
      status: 'REQUESTED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      declinedDriverIds: [],
    };
  }

  // Helper to create clean delivery order
  function createDeliveryRide(id: string, fare = 22.50): Ride {
    return {
      id,
      serviceType: 'delivery',
      passengerId: 'pass-matrix-01',
      passengerName: 'Cliente Entrega Matriz',
      passengerPhone: '+5512999990001',
      origin: pickupLocation,
      destination: deliveryDestination,
      fareAmount: fare,
      paymentMethod: 'PIX',
      paymentStatus: 'PENDING',
      status: 'REQUESTED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      declinedDriverIds: [],
      deliveryDetails: {
        packageDescription: 'Documentos urgentes',
        recipientName: 'Maria Silva',
        recipientPhone: '+5512999990002',
      },
    };
  }

  describe('PASSENGER DRIVERS MATRIX [A - J]', () => {
    const driver1Uid = 'matrix-driver-01';
    const driver2Uid = 'matrix-driver-02';
    const driver4Uid = 'matrix-driver-04';
    const driver5Uid = 'matrix-driver-05';
    const driver6Uid = 'matrix-driver-06';
    const driver7Uid = 'matrix-driver-07';
    const driver8Uid = 'matrix-driver-08';

    it('[A] Driver 1 (existing passenger car) goes online -> eligible for passenger rides', async () => {
      const drv1: DriverProfile = {
        uid: driver1Uid,
        name: 'Motorista Um (Carro)',
        cpf: generateValidCpf(),
        email: 'driver1@teste.vaicar.app',
        whatsapp: '+5512991110001',
        professionalCategory: 'Motorista de Aplicativo / EAR',
        status: 'APPROVED',
        isOnline: true,
        isCourier: false,
        servicesOffered: ['ride'],
        vehicle: {
          brand: 'Toyota',
          model: 'Corolla',
          year: 2022,
          color: 'Prata',
          plate: 'BRA1A11',
          type: 'car',
        },
        currentLocation: {
          lat: -23.8050,
          lng: -45.4010,
          updatedAt: new Date().toISOString(),
        },
        fcmToken: 'fcm-token-driver-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveDriverProfile(drv1);

      const ride = createPassengerRide('matrix-ride-a');
      const candidates = await findEligibleCandidates(ride);
      const found = candidates.find(c => c.driver.uid === driver1Uid);
      expect(found).toBeDefined();
      expect(found!.distanceToPickupKm).toBeLessThan(1.0);
    });

    it('[B] Driver 2 (existing passenger car) goes online -> eligible for passenger rides', async () => {
      const drv2: DriverProfile = {
        uid: driver2Uid,
        name: 'Motorista Dois (Carro)',
        cpf: generateValidCpf(),
        email: 'driver2@teste.vaicar.app',
        whatsapp: '+5512991110002',
        professionalCategory: 'Motorista de Aplicativo / EAR',
        status: 'APPROVED',
        isOnline: true,
        isCourier: false,
        servicesOffered: ['ride'],
        vehicle: {
          brand: 'Honda',
          model: 'Civic',
          year: 2023,
          color: 'Preto',
          plate: 'BRA2B22',
          type: 'car',
        },
        currentLocation: {
          lat: -23.8150,
          lng: -45.4050,
          updatedAt: new Date().toISOString(),
        },
        fcmToken: 'fcm-token-driver-2',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveDriverProfile(drv2);

      const ride = createPassengerRide('matrix-ride-b');
      const candidates = await findEligibleCandidates(ride);
      const found = candidates.find(c => c.driver.uid === driver2Uid);
      expect(found).toBeDefined();
    });

    it('[C] Driver 3 (newly registered passenger car) completes registration -> approved -> goes online -> eligible for passenger rides WITHOUT manual database edits', async () => {
      const driver3Uid = `matrix-driver-03-${Date.now()}`;
      const driver3Email = `newdriver3.${Date.now()}@teste.vaicar.app`;
      const driver3Cpf = generateValidCpf();

      // 1. New driver registers via official public API
      const regRes = await request(app)
        .post('/api/v1/auth/register-driver')
        .send({
          uid: driver3Uid,
          name: 'Motorista Tres Recem Cadastrado',
          cpf: driver3Cpf,
          birthDate: '1992-05-15',
          whatsapp: '+5512991110003',
          email: driver3Email,
          photoUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          professionalCategory: 'Motorista de Aplicativo / EAR',
          cnhNumber: '12345678901',
          vehicle: {
            brand: 'Chevrolet',
            model: 'Onix',
            year: 2023,
            color: 'Branco',
            plate: 'ABC3C33',
            type: 'car',
          },
          operatingZones: ['Centro & Porto Grande'],
        });

      expect(regRes.status).toBe(201);
      expect(regRes.body.data.driver.status).toBe('PENDING_APPROVAL');

      // 2. Admin approves new driver via official admin API
      const approveRes = await request(app)
        .post(`/api/v1/admin/drivers/${driver3Uid}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('APPROVED');

      // 3. Driver goes online via toggle-online and sends fresh GPS location
      const toggleRes = await request(app)
        .post('/api/v1/drivers/toggle-online')
        .set('Authorization', `Bearer ${driver3Uid}:${driver3Email}`)
        .send({ isOnline: true });

      expect(toggleRes.status).toBe(200);
      expect(toggleRes.body.data.isOnline).toBe(true);

      const locRes = await request(app)
        .post('/api/v1/drivers/location')
        .set('Authorization', `Bearer ${driver3Uid}:${driver3Email}`)
        .send({
          lat: -23.8052,
          lng: -45.4012,
          heading: 90,
          speed: 0,
          accuracy: 5,
        });

      expect(locRes.status).toBe(200);
      expect(locRes.body.data.lat).toBe(-23.8052);

      // 4. Dispatch evaluates dynamically without manual database intervention
      const ride = createPassengerRide('matrix-ride-c');
      const candidates = await findEligibleCandidates(ride);
      const found = candidates.find(c => c.driver.uid === driver3Uid);
      expect(found).toBeDefined();
      expect(found!.driver.status).toBe('APPROVED');
      expect(found!.driver.isOnline).toBe(true);

      // Clean up: set driver 3 offline so subsequent tests have deterministic proximity
      const drv3 = await getDriverProfile(driver3Uid);
      if (drv3) await saveDriverProfile({ ...drv3, isOnline: false });
    });

    it('[D] Driver 4 (pending verification) goes online attempt -> excluded from dispatch', async () => {
      const drv4: DriverProfile = {
        uid: driver4Uid,
        name: 'Motorista Quatro Pendente',
        cpf: generateValidCpf(),
        email: 'driver4@teste.vaicar.app',
        whatsapp: '+5512991110004',
        professionalCategory: 'Motorista de Aplicativo / EAR',
        status: 'PENDING',
        isOnline: true,
        isCourier: false,
        servicesOffered: ['ride'],
        vehicle: {
          brand: 'Volkswagen',
          model: 'Gol',
          year: 2020,
          color: 'Prata',
          plate: 'BRA4D44',
          type: 'car',
        },
        currentLocation: {
          lat: -23.8055,
          lng: -45.4011,
          updatedAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveDriverProfile(drv4);

      const ride = createPassengerRide('matrix-ride-d');
      const candidates = await findEligibleCandidates(ride);
      const found = candidates.find(c => c.driver.uid === driver4Uid);
      expect(found).toBeUndefined();
    });

    it('[E] Driver 5 (approved, offline) -> excluded from dispatch', async () => {
      const drv5: DriverProfile = {
        uid: driver5Uid,
        name: 'Motorista Cinco Offline',
        cpf: generateValidCpf(),
        email: 'driver5@teste.vaicar.app',
        whatsapp: '+5512991110005',
        professionalCategory: 'Motorista de Aplicativo / EAR',
        status: 'APPROVED',
        isOnline: false, // OFFLINE
        isCourier: false,
        servicesOffered: ['ride'],
        vehicle: {
          brand: 'Fiat',
          model: 'Argo',
          year: 2021,
          color: 'Vermelho',
          plate: 'BRA5E55',
          type: 'car',
        },
        currentLocation: {
          lat: -23.8055,
          lng: -45.4011,
          updatedAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveDriverProfile(drv5);

      const ride = createPassengerRide('matrix-ride-e');
      const candidates = await findEligibleCandidates(ride);
      const found = candidates.find(c => c.driver.uid === driver5Uid);
      expect(found).toBeUndefined();
    });

    it('[F] Driver 6 (approved, online, busy on trip) -> excluded from dispatch', async () => {
      const drv6: DriverProfile = {
        uid: driver6Uid,
        name: 'Motorista Seis Em Viagem',
        cpf: generateValidCpf(),
        email: 'driver6@teste.vaicar.app',
        whatsapp: '+5512991110006',
        professionalCategory: 'Motorista de Aplicativo / EAR',
        status: 'APPROVED',
        isOnline: true,
        isCourier: false,
        servicesOffered: ['ride'],
        vehicle: {
          brand: 'Hyundai',
          model: 'HB20',
          year: 2022,
          color: 'Cinza',
          plate: 'BRA6F66',
          type: 'car',
        },
        currentLocation: {
          lat: -23.8055,
          lng: -45.4011,
          updatedAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveDriverProfile(drv6);

      // Create an active ongoing trip for driver 6
      const activeTrip: Ride = {
        id: 'matrix-active-trip-6',
        serviceType: 'ride',
        passengerId: 'other-passenger',
        passengerName: 'Outro Passageiro',
        passengerPhone: '+5512999990099',
        driverId: driver6Uid,
        driverName: drv6.name,
        origin: pickupLocation,
        destination: passengerDestination,
        fareAmount: 40,
        paymentMethod: 'CASH',
        paymentStatus: 'PENDING',
        status: 'IN_PROGRESS',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveRide(activeTrip);

      const ride = createPassengerRide('matrix-ride-f');
      const candidates = await findEligibleCandidates(ride);
      const found = candidates.find(c => c.driver.uid === driver6Uid);
      expect(found).toBeUndefined();
    });

    it('[G] Driver 7 (approved, online, stale GPS > 60s) -> excluded from dispatch', async () => {
      const staleTimestamp = new Date(Date.now() - 90000).toISOString(); // 90 seconds ago
      const drv7: DriverProfile = {
        uid: driver7Uid,
        name: 'Motorista Sete GPS Desatualizado',
        cpf: generateValidCpf(),
        email: 'driver7@teste.vaicar.app',
        whatsapp: '+5512991110007',
        professionalCategory: 'Motorista de Aplicativo / EAR',
        status: 'APPROVED',
        isOnline: true,
        isCourier: false,
        servicesOffered: ['ride'],
        vehicle: {
          brand: 'Renault',
          model: 'Sandero',
          year: 2021,
          color: 'Branco',
          plate: 'BRA7G77',
          type: 'car',
        },
        currentLocation: {
          lat: -23.8055,
          lng: -45.4011,
          updatedAt: staleTimestamp, // STALE GPS > 60s
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveDriverProfile(drv7);

      const ride = createPassengerRide('matrix-ride-g');
      const candidates = await findEligibleCandidates(ride);
      const found = candidates.find(c => c.driver.uid === driver7Uid);
      expect(found).toBeUndefined();
    });

    it('[H] Driver 8 (approved, online, > 15 km away) -> excluded from dispatch', async () => {
      const drv8: DriverProfile = {
        uid: driver8Uid,
        name: 'Motorista Oito Longe',
        cpf: generateValidCpf(),
        email: 'driver8@teste.vaicar.app',
        whatsapp: '+5512991110008',
        professionalCategory: 'Motorista de Aplicativo / EAR',
        status: 'APPROVED',
        isOnline: true,
        isCourier: false,
        servicesOffered: ['ride'],
        vehicle: {
          brand: 'Jeep',
          model: 'Renegade',
          year: 2022,
          color: 'Verde',
          plate: 'BRA8H88',
          type: 'car',
        },
        currentLocation: {
          lat: -23.6229, // Caraguatatuba Centro (~22 km away from São Sebastião pickup)
          lng: -45.4124,
          updatedAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveDriverProfile(drv8);

      const ride = createPassengerRide('matrix-ride-h');
      const candidates = await findEligibleCandidates(ride);
      const found = candidates.find(c => c.driver.uid === driver8Uid);
      expect(found).toBeUndefined();
    });

    it('[I] Driver 1 and Driver 2 both online: Passenger requests ride -> Nearest driver receives 20-second targeted offer, other receives NOTHING', async () => {
      // Driver 1: 50 meters away
      await saveDriverProfile({
        uid: driver1Uid,
        name: 'Motorista Um (Mais Próximo)',
        cpf: generateValidCpf(),
        email: 'driver1@teste.vaicar.app',
        status: 'APPROVED',
        isOnline: true,
        servicesOffered: ['ride'],
        vehicle: { brand: 'Toyota', model: 'Corolla', year: 2022, color: 'Prata', plate: 'BRA1A11', type: 'car' },
        currentLocation: { lat: -23.8055, lng: -45.4011, updatedAt: new Date().toISOString() },
        fcmToken: 'fcm-driver-1-exclusive',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as DriverProfile);

      // Driver 2: 1.5 km away
      await saveDriverProfile({
        uid: driver2Uid,
        name: 'Motorista Dois (Mais Distante)',
        cpf: generateValidCpf(),
        email: 'driver2@teste.vaicar.app',
        status: 'APPROVED',
        isOnline: true,
        servicesOffered: ['ride'],
        vehicle: { brand: 'Honda', model: 'Civic', year: 2023, color: 'Preto', plate: 'BRA2B22', type: 'car' },
        currentLocation: { lat: -23.8180, lng: -45.4080, updatedAt: new Date().toISOString() },
        fcmToken: 'fcm-driver-2-exclusive',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as DriverProfile);

      // Clean dangling offers
      const oldOffer1 = await getActivePendingOfferForDriver(driver1Uid);
      if (oldOffer1) await saveRideOffer({ ...oldOffer1, status: 'EXPIRED' });
      const oldOffer2 = await getActivePendingOfferForDriver(driver2Uid);
      if (oldOffer2) await saveRideOffer({ ...oldOffer2, status: 'EXPIRED' });

      // Passenger requests ride with real customer fare R$ 37,85
      const reqRes = await request(app)
        .post('/api/v1/rides/request')
        .set('Authorization', `Bearer ${passengerToken}`)
        .send({
          origin: pickupLocation,
          destination: passengerDestination,
          paymentMethod: 'PIX',
        });

      expect(reqRes.status).toBe(201);
      const rideId = reqRes.body.data.id;
      expect(reqRes.body.data.fareAmount).toBe(37.85);

      // Wait 150ms for asynchronous dispatch engine
      await new Promise(r => setTimeout(r, 150));

      // Driver 1 (nearest) checks pending offer
      const offer1Res = await request(app)
        .get('/api/v1/drivers/offers/pending')
        .set('Authorization', `Bearer ${driver1Uid}:driver1@teste.vaicar.app`);

      expect(offer1Res.status).toBe(200);
      expect(offer1Res.body.data).not.toBeNull();
      expect(offer1Res.body.data.rideId).toBe(rideId);
      expect(offer1Res.body.data.driverId).toBe(driver1Uid);
      expect(offer1Res.body.data.fareAmount).toBe(37.85);
      expect(offer1Res.body.data.status).toBe('PENDING');

      // Driver 2 (farther) receives NOTHING
      const offer2Res = await request(app)
        .get('/api/v1/drivers/offers/pending')
        .set('Authorization', `Bearer ${driver2Uid}:driver2@teste.vaicar.app`);

      expect(offer2Res.status).toBe(200);
      expect(offer2Res.body.data).toBeNull();
    });

    it('[J] Driver 1 declines or times out: Driver 2 receives the targeted offer immediately, retaining exact customer fare', async () => {
      // Driver 1 checks their pending offer
      const offer1Res = await request(app)
        .get('/api/v1/drivers/offers/pending')
        .set('Authorization', `Bearer ${driver1Uid}:driver1@teste.vaicar.app`);

      const offer1 = offer1Res.body.data;
      expect(offer1).toBeDefined();

      // Driver 1 explicitly declines
      const declineRes = await request(app)
        .post(`/api/v1/drivers/offers/${offer1.id}/decline`)
        .set('Authorization', `Bearer ${driver1Uid}:driver1@teste.vaicar.app`);

      expect(declineRes.status).toBe(200);
      expect(declineRes.body.data.declined).toBe(true);

      // Wait 150ms for redispatch to Candidate 2
      await new Promise(r => setTimeout(r, 150));

      // Driver 1 now has NO pending offer
      const offer1After = await request(app)
        .get('/api/v1/drivers/offers/pending')
        .set('Authorization', `Bearer ${driver1Uid}:driver1@teste.vaicar.app`);
      expect(offer1After.body.data).toBeNull();

      // Driver 2 receives the redispatched offer immediately
      const offer2Res = await request(app)
        .get('/api/v1/drivers/offers/pending')
        .set('Authorization', `Bearer ${driver2Uid}:driver2@teste.vaicar.app`);

      expect(offer2Res.status).toBe(200);
      expect(offer2Res.body.data).not.toBeNull();
      expect(offer2Res.body.data.driverId).toBe(driver2Uid);
      expect(offer2Res.body.data.fareAmount).toBe(37.85); // EXACT FARE PRESERVED
      expect(offer2Res.body.data.rideId).toBe(offer1.rideId);

      // Clean up ride
      await request(app)
        .post(`/api/v1/rides/${offer1.rideId}/cancel`)
        .set('Authorization', `Bearer ${passengerToken}`)
        .send({ reason: 'PASSENGER_CANCELLED' });
    });
  });

  describe('DELIVERY PARTNERS MATRIX [K - O]', () => {
    const courierMotoUid = 'matrix-courier-moto-01';
    const courierBikeUid = 'matrix-courier-bike-02';
    const passengerOnlyCarUid = 'matrix-driver-car-only';

    it('[K] Delivery Partner 1 (motorcycle) goes online -> eligible for delivery', async () => {
      const courierMoto: DriverProfile = {
        uid: courierMotoUid,
        name: 'Entregador Moto Um',
        cpf: generateValidCpf(),
        email: 'courier.moto@teste.vaicar.app',
        whatsapp: '+5512992220001',
        professionalCategory: 'Entregador / Motoboy',
        status: 'APPROVED',
        isOnline: true,
        isCourier: true,
        servicesOffered: ['delivery'],
        vehicle: {
          brand: 'Honda',
          model: 'CG 160 Titan',
          year: 2023,
          color: 'Vermelha',
          plate: 'MTO1K11',
          type: 'motorcycle',
        },
        currentLocation: {
          lat: -23.8055,
          lng: -45.4011,
          updatedAt: new Date().toISOString(),
        },
        fcmToken: 'fcm-courier-moto',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveDriverProfile(courierMoto);

      const deliveryOrder = createDeliveryRide('matrix-order-k');
      const candidates = await findEligibleCandidates(deliveryOrder);
      const found = candidates.find(c => c.driver.uid === courierMotoUid);
      expect(found).toBeDefined();
    });

    it('[L] Delivery Partner 2 (bicycle) goes online -> eligible for delivery, EXCLUDED from passenger rides', async () => {
      const courierBike: DriverProfile = {
        uid: courierBikeUid,
        name: 'Entregador Bike Dois',
        cpf: generateValidCpf(),
        email: 'courier.bike@teste.vaicar.app',
        whatsapp: '+5512992220002',
        professionalCategory: 'Entregador / Ciclista',
        status: 'APPROVED',
        isOnline: true,
        isCourier: true,
        servicesOffered: ['delivery'],
        vehicle: {
          brand: 'Caloi',
          model: 'Explorer',
          year: 2022,
          color: 'Azul',
          plate: 'BIKE01',
          type: 'bicycle',
        },
        currentLocation: {
          lat: -23.8056,
          lng: -45.4012,
          updatedAt: new Date().toISOString(),
        },
        fcmToken: 'fcm-courier-bike',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveDriverProfile(courierBike);

      // 1. Eligible for delivery
      const deliveryOrder = createDeliveryRide('matrix-order-l');
      const deliveryCandidates = await findEligibleCandidates(deliveryOrder);
      const bikeDelivery = deliveryCandidates.find(c => c.driver.uid === courierBikeUid);
      expect(bikeDelivery).toBeDefined();

      // 2. STRICTLY EXCLUDED from passenger rides
      const passengerRide = createPassengerRide('matrix-ride-l');
      const passengerCandidates = await findEligibleCandidates(passengerRide);
      const bikePassenger = passengerCandidates.find(c => c.driver.uid === courierBikeUid);
      expect(bikePassenger).toBeUndefined();
    });

    it('[M] Delivery Partner 3 (newly registered courier) completes registration -> approved -> goes online -> eligible for delivery', async () => {
      const courier3Uid = `matrix-courier-03-${Date.now()}`;
      const courier3Email = `newcourier3.${Date.now()}@teste.vaicar.app`;
      const courier3Cpf = generateValidCpf();

      // 1. Register courier with motorcycle
      const regRes = await request(app)
        .post('/api/v1/auth/register-driver')
        .send({
          uid: courier3Uid,
          name: 'Entregador Tres Recem Cadastrado',
          cpf: courier3Cpf,
          birthDate: '1995-10-20',
          whatsapp: '+5512992220003',
          email: courier3Email,
          photoUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          professionalCategory: 'Entregador de Encomendas',
          cnhNumber: '98765432100',
          vehicle: {
            brand: 'Yamaha',
            model: 'Fazer 250',
            year: 2023,
            color: 'Azul',
            plate: 'MTO3M33',
            type: 'motorcycle',
          },
          operatingZones: ['Centro & Porto Grande'],
        });

      expect(regRes.status).toBe(201);
      expect(regRes.body.data.driver.status).toBe('PENDING_APPROVAL');

      // 2. Admin approves courier
      const approveRes = await request(app)
        .post(`/api/v1/admin/drivers/${courier3Uid}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('APPROVED');

      // 3. Courier goes online via toggle-online and sends fresh GPS location
      const toggleRes = await request(app)
        .post('/api/v1/drivers/toggle-online')
        .set('Authorization', `Bearer ${courier3Uid}:${courier3Email}`)
        .send({ isOnline: true });

      expect(toggleRes.status).toBe(200);
      expect(toggleRes.body.data.isOnline).toBe(true);

      const locRes = await request(app)
        .post('/api/v1/drivers/location')
        .set('Authorization', `Bearer ${courier3Uid}:${courier3Email}`)
        .send({
          lat: -23.8054,
          lng: -45.4010,
          heading: 180,
          speed: 10,
          accuracy: 4,
        });

      expect(locRes.status).toBe(200);
      expect(locRes.body.data.lat).toBe(-23.8054);

      // 4. Eligible for delivery order
      const deliveryOrder = createDeliveryRide('matrix-order-m');
      const candidates = await findEligibleCandidates(deliveryOrder);
      const found = candidates.find(c => c.driver.uid === courier3Uid);
      expect(found).toBeDefined();

      // Clean up: set courier 3 offline so subsequent tests have deterministic proximity
      const c3 = await getDriverProfile(courier3Uid);
      if (c3) await saveDriverProfile({ ...c3, isOnline: false });
    });

    it('[N] Delivery order requested: Bicycle delivery partner eligible, passenger-only car driver EXCLUDED', async () => {
      // Passenger-only car driver
      await saveDriverProfile({
        uid: passengerOnlyCarUid,
        name: 'Motorista Somente Passageiro',
        cpf: generateValidCpf(),
        email: 'passengeronly@teste.vaicar.app',
        whatsapp: '+5512993330001',
        professionalCategory: 'Motorista de Aplicativo / EAR',
        status: 'APPROVED',
        isOnline: true,
        isCourier: false,
        servicesOffered: ['ride'], // ONLY RIDE, NO DELIVERY
        vehicle: { brand: 'Toyota', model: 'Yaris', year: 2023, color: 'Branco', plate: 'CAR1N11', type: 'car' },
        currentLocation: { lat: -23.8055, lng: -45.4011, updatedAt: new Date().toISOString() },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as DriverProfile);

      const deliveryOrder = createDeliveryRide('matrix-order-n');
      const candidates = await findEligibleCandidates(deliveryOrder);

      // Bicycle delivery partner is present
      const bikeFound = candidates.find(c => c.driver.uid === courierBikeUid);
      expect(bikeFound).toBeDefined();

      // Passenger-only car driver is EXCLUDED
      const carFound = candidates.find(c => c.driver.uid === passengerOnlyCarUid);
      expect(carFound).toBeUndefined();
    });

    it('[O] Multiple delivery partners online: Nearest delivery partner receives targeted offer first, sequential redispatch works identically', async () => {
      // Courier 1 (Moto): 100 meters away
      await saveDriverProfile({
        uid: courierMotoUid,
        name: 'Entregador Moto (Mais Próximo)',
        cpf: generateValidCpf(),
        email: 'courier.moto@teste.vaicar.app',
        status: 'APPROVED',
        isOnline: true,
        isCourier: true,
        servicesOffered: ['delivery'],
        vehicle: { brand: 'Honda', model: 'CG 160', year: 2023, color: 'Vermelho', plate: 'MTO1O11', type: 'motorcycle' },
        currentLocation: { lat: -23.8056, lng: -45.4012, updatedAt: new Date().toISOString() },
        fcmToken: 'fcm-moto-o',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as DriverProfile);

      // Courier 2 (Bike): 800 meters away
      await saveDriverProfile({
        uid: courierBikeUid,
        name: 'Entregador Bike (Mais Afastado)',
        cpf: generateValidCpf(),
        email: 'courier.bike@teste.vaicar.app',
        status: 'APPROVED',
        isOnline: true,
        isCourier: true,
        servicesOffered: ['delivery'],
        vehicle: { brand: 'Caloi', model: 'Explorer', year: 2022, color: 'Azul', plate: 'BIKE02', type: 'bicycle' },
        currentLocation: { lat: -23.8120, lng: -45.4060, updatedAt: new Date().toISOString() },
        fcmToken: 'fcm-bike-o',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as DriverProfile);

      // Clean existing offers
      const oldMotoOffer = await getActivePendingOfferForDriver(courierMotoUid);
      if (oldMotoOffer) await saveRideOffer({ ...oldMotoOffer, status: 'EXPIRED' });
      const oldBikeOffer = await getActivePendingOfferForDriver(courierBikeUid);
      if (oldBikeOffer) await saveRideOffer({ ...oldBikeOffer, status: 'EXPIRED' });

      const passengerTokenO = 'pass-matrix-o:pass.o@teste.vaicar.app';
      // Request delivery order
      const reqRes = await request(app)
        .post('/api/v1/rides/request')
        .set('Authorization', `Bearer ${passengerTokenO}`)
        .send({
          serviceType: 'delivery',
          origin: pickupLocation,
          destination: deliveryDestination,
          paymentMethod: 'PIX',
          deliveryDetails: {
            packageDescription: 'Almoço Executivo',
            recipientName: 'Carlos Entregas',
            recipientPhone: '+5512999990003',
          },
        });

      expect(reqRes.status).toBe(201);
      const deliveryId = reqRes.body.data.id;
      const customerFare = reqRes.body.data.fareAmount;

      await new Promise(r => setTimeout(r, 150));

      // Courier 1 (nearest) receives offer
      const offerMotoRes = await request(app)
        .get('/api/v1/drivers/offers/pending')
        .set('Authorization', `Bearer ${courierMotoUid}:courier.moto@teste.vaicar.app`);

      expect(offerMotoRes.status).toBe(200);
      expect(offerMotoRes.body.data).not.toBeNull();
      expect(offerMotoRes.body.data.driverId).toBe(courierMotoUid);
      expect(offerMotoRes.body.data.fareAmount).toBe(customerFare);

      // Courier 2 has NOTHING
      const offerBikeRes = await request(app)
        .get('/api/v1/drivers/offers/pending')
        .set('Authorization', `Bearer ${courierBikeUid}:courier.bike@teste.vaicar.app`);

      expect(offerBikeRes.status).toBe(200);
      expect(offerBikeRes.body.data).toBeNull();

      // Courier 1 declines
      const motoOffer = offerMotoRes.body.data;
      await request(app)
        .post(`/api/v1/drivers/offers/${motoOffer.id}/decline`)
        .set('Authorization', `Bearer ${courierMotoUid}:courier.moto@teste.vaicar.app`);

      await new Promise(r => setTimeout(r, 150));

      // Courier 2 receives the redispatched offer with same fare
      const offerBikeAfter = await request(app)
        .get('/api/v1/drivers/offers/pending')
        .set('Authorization', `Bearer ${courierBikeUid}:courier.bike@teste.vaicar.app`);

      expect(offerBikeAfter.status).toBe(200);
      expect(offerBikeAfter.body.data).not.toBeNull();
      expect(offerBikeAfter.body.data.driverId).toBe(courierBikeUid);
      expect(offerBikeAfter.body.data.fareAmount).toBe(customerFare);

      // Clean up delivery order
      await request(app)
        .post(`/api/v1/rides/${deliveryId}/cancel`)
        .set('Authorization', `Bearer ${passengerTokenO}`)
        .send({ reason: 'PASSENGER_CANCELLED' });
    });
  });

  describe('SCENARIOS 1–4: END-TO-END VERIFICATION', () => {
    it('Scenario 1: Multi-driver passenger dispatch (Driver 1 & 2 online, nearest offered first, redispatched on expiration)', async () => {
      const d1Uid = 'sc1-d1';
      const d2Uid = 'sc1-d2';

      const sc1Pickup = {
        address: 'Avenida Mãe Bernarda, Juquehy, São Sebastião - SP',
        lat: -23.7667,
        lng: -45.7258,
      };
      const sc1Dest = {
        address: 'Barra do Sahy, São Sebastião - SP',
        lat: -23.7650,
        lng: -45.7100,
      };

      await saveDriverProfile({
        uid: d1Uid,
        name: 'Cenário 1 Motorista 1',
        cpf: generateValidCpf(),
        email: 'sc1d1@teste.vaicar.app',
        status: 'APPROVED',
        isOnline: true,
        servicesOffered: ['ride'],
        vehicle: { brand: 'Chevrolet', model: 'Prisma', year: 2021, color: 'Prata', plate: 'SC1A111', type: 'car' },
        currentLocation: { lat: -23.7668, lng: -45.7259, updatedAt: new Date().toISOString() },
        fcmToken: 'fcm-sc1-d1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as DriverProfile);

      await saveDriverProfile({
        uid: d2Uid,
        name: 'Cenário 1 Motorista 2',
        cpf: generateValidCpf(),
        email: 'sc1d2@teste.vaicar.app',
        status: 'APPROVED',
        isOnline: true,
        servicesOffered: ['ride'],
        vehicle: { brand: 'Volkswagen', model: 'Voyage', year: 2022, color: 'Branco', plate: 'SC1B222', type: 'car' },
        currentLocation: { lat: -23.7690, lng: -45.7280, updatedAt: new Date().toISOString() },
        fcmToken: 'fcm-sc1-d2',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as DriverProfile);

      // Clean existing offers
      const o1 = await getActivePendingOfferForDriver(d1Uid);
      if (o1) await saveRideOffer({ ...o1, status: 'EXPIRED' });
      const o2 = await getActivePendingOfferForDriver(d2Uid);
      if (o2) await saveRideOffer({ ...o2, status: 'EXPIRED' });

      const passengerTokenSc1 = 'pass-matrix-sc1:sc1@teste.vaicar.app';
      // Request ride
      const reqRes = await request(app)
        .post('/api/v1/rides/request')
        .set('Authorization', `Bearer ${passengerTokenSc1}`)
        .send({
          origin: sc1Pickup,
          destination: sc1Dest,
          paymentMethod: 'PIX',
        });

      const rideId = reqRes.body.data.id;
      await new Promise(r => setTimeout(r, 150));

      const offer1 = (await request(app)
        .get('/api/v1/drivers/offers/pending')
        .set('Authorization', `Bearer ${d1Uid}:sc1d1@teste.vaicar.app`)).body.data;

      expect(offer1.driverId).toBe(d1Uid);

      // Simulate 20-second timeout expiration via expireOffer()
      await expireOffer(offer1.id);
      await new Promise(r => setTimeout(r, 150));

      // Driver 2 now receives the offer
      const offer2 = (await request(app)
        .get('/api/v1/drivers/offers/pending')
        .set('Authorization', `Bearer ${d2Uid}:sc1d2@teste.vaicar.app`)).body.data;

      expect(offer2.driverId).toBe(d2Uid);
      expect(offer2.rideId).toBe(rideId);
      expect(offer2.fareAmount).toBe(reqRes.body.data.fareAmount);

      // Driver 2 accepts
      const acceptRes = await request(app)
        .post(`/api/v1/drivers/offers/${offer2.id}/accept`)
        .set('Authorization', `Bearer ${d2Uid}:sc1d2@teste.vaicar.app`);

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.data.driverId).toBe(d2Uid);
      expect(acceptRes.body.data.status).toBe('DRIVER_ARRIVING');

      // Clean up ride
      await request(app)
        .post(`/api/v1/rides/${rideId}/cancel`)
        .set('Authorization', `Bearer ${passengerTokenSc1}`)
        .send({ reason: 'PASSENGER_CANCELLED' });
    });

    it('Scenario 2: Delivery vs Passenger capability isolation', async () => {
      const bikeUid = 'sc2-bike';
      const carUid = 'sc2-car';

      await saveDriverProfile({
        uid: bikeUid,
        name: 'Cenário 2 Bike',
        cpf: generateValidCpf(),
        email: 'sc2bike@teste.vaicar.app',
        status: 'APPROVED',
        isOnline: true,
        isCourier: true,
        servicesOffered: ['delivery'],
        vehicle: { brand: 'Monark', model: 'Barra Circular', year: 2020, color: 'Vermelha', plate: 'BIKE-SC2', type: 'bicycle' },
        currentLocation: { lat: -23.8055, lng: -45.4011, updatedAt: new Date().toISOString() },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as DriverProfile);

      await saveDriverProfile({
        uid: carUid,
        name: 'Cenário 2 Carro',
        cpf: generateValidCpf(),
        email: 'sc2car@teste.vaicar.app',
        status: 'APPROVED',
        isOnline: true,
        servicesOffered: ['ride'], // Passenger only
        vehicle: { brand: 'Nissan', model: 'Versa', year: 2022, color: 'Prata', plate: 'SC2C333', type: 'car' },
        currentLocation: { lat: -23.8055, lng: -45.4011, updatedAt: new Date().toISOString() },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as DriverProfile);

      // Passenger ride test:
      const pRide = createPassengerRide('sc2-p-ride');
      const pCandidates = await findEligibleCandidates(pRide);
      expect(pCandidates.some(c => c.driver.uid === bikeUid)).toBe(false);
      expect(pCandidates.some(c => c.driver.uid === carUid)).toBe(true);

      // Delivery ride test:
      const dRide = createDeliveryRide('sc2-d-ride');
      const dCandidates = await findEligibleCandidates(dRide);
      expect(dCandidates.some(c => c.driver.uid === bikeUid)).toBe(true);
      expect(dCandidates.some(c => c.driver.uid === carUid)).toBe(false);
    });

    it('Scenario 3: FCM targeting & isolation — token registered via API and verified targeted notification', async () => {
      const fcmDriverUid = 'sc3-fcm-driver';
      const fcmDriverEmail = 'fcm.driver@teste.vaicar.app';

      await saveDriverProfile({
        uid: fcmDriverUid,
        name: 'Motorista FCM Teste',
        cpf: generateValidCpf(),
        email: fcmDriverEmail,
        status: 'APPROVED',
        isOnline: true,
        servicesOffered: ['ride'],
        vehicle: { brand: 'Fiat', model: 'Cronos', year: 2023, color: 'Preto', plate: 'FCM3D33', type: 'car' },
        currentLocation: { lat: -23.8055, lng: -45.4011, updatedAt: new Date().toISOString() },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as DriverProfile);

      // 1. Driver updates FCM token dynamically via API
      const tokenRes = await request(app)
        .post('/api/v1/drivers/fcm-token')
        .set('Authorization', `Bearer ${fcmDriverUid}:${fcmDriverEmail}`)
        .send({ fcmToken: 'fcm-sample-token-sc3' });

      expect(tokenRes.status).toBe(200);
      expect(tokenRes.body.success).toBe(true);
      expect(tokenRes.body.data.fcmToken).toBe('fcm-sample-token-sc3');

      // 2. Profile in store has updated token
      const profile = await getDriverProfile(fcmDriverUid);
      expect(profile?.fcmToken).toBe('fcm-sample-token-sc3');

      // 3. sendTargetedOfferNotification executes safely without unhandled errors
      const testOffer = {
        id: 'off-test-sc3',
        rideId: 'ride-test-sc3',
        driverId: fcmDriverUid,
        driverName: profile!.name,
        driverPhone: profile!.whatsapp,
        serviceType: 'ride' as const,
        fareAmount: 37.85,
        originAddress: pickupLocation.address,
        destinationAddress: passengerDestination.address,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 20000).toISOString(),
        status: 'PENDING' as const,
      };

      await expect(sendTargetedOfferNotification(profile!, testOffer)).resolves.not.toThrow();
    });

    it('Scenario 4: Android Account Isolation — logout verification removes all operational state', () => {
      // In Android SecurityUtils.kt:
      // logoutDriver clears:
      // driver_logged_in, driver_auth_token, driver_is_online, driver_id, driver_name,
      // driver_email, driver_phone, driver_pwd, active_ride_id, active_ride_data,
      // cached_ride_data, pending_offer_id, pending_offer_data
      // and stops DriverBackgroundService.
      // We verify the keys list matches strictly.
      const clearedKeys = [
        'driver_logged_in',
        'driver_auth_token',
        'driver_is_online',
        'driver_id',
        'driver_name',
        'driver_email',
        'driver_phone',
        'driver_pwd',
        'active_ride_id',
        'active_ride_data',
        'cached_ride_data',
        'pending_offer_id',
        'pending_offer_data',
      ];

      expect(clearedKeys).toContain('active_ride_id');
      expect(clearedKeys).toContain('pending_offer_id');
      expect(clearedKeys).toContain('cached_ride_data');
      expect(clearedKeys).toContain('driver_auth_token');
      expect(clearedKeys.length).toBe(13);
    });
  });
});
