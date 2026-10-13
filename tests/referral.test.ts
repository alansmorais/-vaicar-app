import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../api/src/server.js';
import {
  savePassengerProfile,
  getPassengerProfile,
  saveDriverProfile,
  saveRide,
  getRide,
  getDriverProfile,
  getReferralByReferredId,
  saveRideOffer,
  listOffersForRide,
  getActivePendingOfferForDriver,
  createRideAtomic,
  refundReferralCreditForRide,
} from '../api/src/services/firestore.js';
import { PassengerProfile, DriverProfile, Ride } from '../shared/src/types.js';

describe('VaiCar Platform — Passenger Referral System Suite', () => {
  const referrerUid = 'ref-user-alice';
  const referrerEmail = 'alice.referrer@teste.vaicar.app';
  const referrerToken = `${referrerUid}:${referrerEmail}`;
  const referrerCode = 'ALICE100';

  const driverUid = 'driv-referral-test';
  const driverEmail = 'carlos.driver@teste.vaicar.app';
  const driverToken = `${driverUid}:${driverEmail}`;

  beforeAll(async () => {
    // Setup initial referring passenger Alice
    const aliceProfile: PassengerProfile = {
      uid: referrerUid,
      name: 'Alice Referrer',
      email: referrerEmail,
      whatsapp: '+5512991112222',
      photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      termsAccepted: true,
      referralCode: referrerCode,
      referralCreditBalance: 0,
      referralDiscountAvailable: false,
      totalRides: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await savePassengerProfile(aliceProfile);

    // Setup an approved online test driver Carlos
    const driverProfile: DriverProfile = {
      uid: driverUid,
      name: 'Carlos Motorista',
      cpf: '12345678901',
      birthDate: '1985-05-15',
      email: driverEmail,
      whatsapp: '+5512993334444',
      photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      professionalCategory: 'A',
      cnhNumber: '12345678900',
      status: 'APPROVED',
      isOnline: true,
      rating: 4.9,
      completedRidesCount: 20,
      vehicle: {
        brand: 'Chevrolet',
        model: 'Onix',
        year: 2021,
        color: 'Prata',
        plate: 'ABC1D23',
      },
      operatingZones: ['Centro', 'Maresias'],
      servicesOffered: ['ride'],
      currentLocation: {
        lat: -23.7928,
        lng: -45.3999,
        updatedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveDriverProfile(driverProfile);
  });

  describe('1. Registration Business Rules', () => {
    it('allows normal passenger registration without referral code and assigns a unique referral code', async () => {
      const normalUid = 'pass-normal-' + Date.now();
      const normalEmail = `normal.${Date.now()}@teste.vaicar.app`;
      const res = await request(app)
        .post('/api/v1/auth/register-passenger')
        .send({
          uid: normalUid,
          name: 'Bruno Normal',
          whatsapp: '+5512997771111',
          email: normalEmail,
          photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          termsAccepted: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.passenger.referralCode).toBeDefined();
      expect(res.body.data.passenger.referralCode.length).toBeGreaterThanOrEqual(6);
      expect(res.body.data.passenger.referredByCode).toBeUndefined();
      expect(res.body.data.passenger.referralDiscountAvailable).toBe(false);
      expect(res.body.data.passenger.referralCreditBalance).toBe(0);
    });

    it('rejects registration with an invalid non-existent referral code', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register-passenger')
        .send({
          uid: 'pass-invalid-ref-' + Date.now(),
          name: 'Daniel Teste',
          whatsapp: '+5512997772222',
          email: `daniel.${Date.now()}@teste.vaicar.app`,
          photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          termsAccepted: true,
          referralCode: 'CODIGO_INEXISTENTE_999',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Código de indicação inválido ou não encontrado.');
    });

    it('prevents self-referral using own email or phone', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register-passenger')
        .send({
          uid: 'pass-self-ref-' + Date.now(),
          name: 'Alice Clone',
          whatsapp: '+5512991112222', // Alice's phone
          email: referrerEmail,        // Alice's email
          photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          termsAccepted: true,
          referralCode: referrerCode,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Você não pode utilizar seu próprio código de indicação.');
    });

    it('successfully registers passenger using Alice referral code and marks discount available', async () => {
      const bobUid = 'pass-bob-' + Date.now();
      const bobEmail = `bob.referred.${Date.now()}@teste.vaicar.app`;
      const res = await request(app)
        .post('/api/v1/auth/register-passenger')
        .send({
          uid: bobUid,
          name: 'Bob Convidado',
          whatsapp: '+5512998883333',
          email: bobEmail,
          photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          termsAccepted: true,
          referralCode: referrerCode.toLowerCase(), // case-insensitive check
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.passenger.referredByCode).toBe(referrerCode);
      expect(res.body.data.passenger.referredByPassengerId).toBe(referrerUid);
      expect(res.body.data.passenger.referralDiscountAvailable).toBe(true);

      // Check referral record persisted
      const refRecord = await getReferralByReferredId(bobUid);
      expect(refRecord).toBeDefined();
      expect(refRecord?.referrerId).toBe(referrerUid);
      expect(refRecord?.referrerCode).toBe(referrerCode);
      expect(refRecord?.status).toBe('REGISTERED');
      expect(refRecord?.discountAmount).toBe(5.00);
      expect(refRecord?.rewardAmount).toBe(5.00);
    });
  });

  describe('2. Referral Dashboard & Info Endpoint', () => {
    it('GET /api/v1/passengers/referral returns referral code, share URL, balance and referred list', async () => {
      const res = await request(app)
        .get('/api/v1/passengers/referral')
        .set('Authorization', `Bearer ${referrerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.referralCode).toBe(referrerCode);
      expect(res.body.data.shareUrl).toBe(`https://vaicar.app/passenger/register?ref=${referrerCode}`);
      expect(res.body.data.referralCreditBalance).toBe(0);
      expect(res.body.data.totalReferrals).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.data.referrals)).toBe(true);
    });
  });

  describe('3. Ride Lifecycle, Discount & Reward Attribution', () => {
    const referredBobUid = 'pass-bob-rider-' + Date.now();
    const referredBobEmail = `bob.rider.${Date.now()}@teste.vaicar.app`;
    const referredBobToken = `${referredBobUid}:${referredBobEmail}`;

    beforeAll(async () => {
      // Register Bob with Alice's code
      await request(app)
        .post('/api/v1/auth/register-passenger')
        .send({
          uid: referredBobUid,
          name: 'Bob Rider',
          whatsapp: '+5512999995555',
          email: referredBobEmail,
          photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          termsAccepted: true,
          referralCode: referrerCode,
        });
    });

    it('applies R$ 5 referral discount on first ride estimate and request', async () => {
      const origin = { address: 'Rua da Praia, 100, Centro, São Sebastião', lat: -23.7928, lng: -45.3999 };
      const destination = { address: 'Avenida Dr. Altino Arantes, Centro, São Sebastião', lat: -23.8050, lng: -45.4050 };

      // Estimate
      const estRes = await request(app)
        .post('/api/v1/rides/estimate')
        .set('Authorization', `Bearer ${referredBobToken}`)
        .send({ origin, destination, serviceType: 'ride' });

      expect(estRes.status).toBe(200);
      expect(estRes.body.data.referralDiscountApplied).toBe(true);
      expect(estRes.body.data.discountAmount).toBeGreaterThanOrEqual(5.00);

      // Create Ride Request
      const rideRes = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${referredBobToken}`)
        .send({
          origin,
          destination,
          paymentMethod: 'PIX',
          serviceType: 'ride',
        });

      expect(rideRes.status).toBe(201);
      expect(rideRes.body.data.referralDiscountApplied).toBe(true);
      expect(rideRes.body.data.originalFareAmount).toBeGreaterThan(rideRes.body.data.fareAmount);
      expect(rideRes.body.data.driverTotalEntitlement).toBe(rideRes.body.data.originalFareAmount);
      expect(rideRes.body.data.platformSubsidyAmount).toBe(5.00);
      expect(rideRes.body.data.platformSubsidyStatus).toBe('PENDING_SETTLEMENT');

      // Cancel this initial test ride so Bob does not remain with an active ride in progress
      const cancelRes = await request(app)
        .post(`/api/v1/rides/${rideRes.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${referredBobToken}`)
        .send({ reason: 'Teste de estimativa concluído' });

      expect(cancelRes.status).toBe(200);
    });

    it('does NOT reward referrer if the ride is cancelled', async () => {
      const origin = { address: 'Centro, São Sebastião', lat: -23.7928, lng: -45.3999 };
      const destination = { address: 'Barequeçaba, São Sebastião', lat: -23.8150, lng: -45.4250 };

      const rideRes = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${referredBobToken}`)
        .send({
          origin,
          destination,
          paymentMethod: 'PIX',
          serviceType: 'ride',
        });

      const rideId = rideRes.body.data.id;

      // Cancel the ride
      const cancelRes = await request(app)
        .post(`/api/v1/rides/${rideId}/cancel`)
        .set('Authorization', `Bearer ${referredBobToken}`)
        .send({ reason: 'Mudança de planos' });

      expect(cancelRes.status).toBe(200);

      // Verify referrer Alice did NOT receive credits
      const aliceAfterCancel = await getPassengerProfile(referrerUid);
      expect(aliceAfterCancel?.referralCreditBalance).toBe(0);

      // Verify referral record is still REGISTERED
      const refRec = await getReferralByReferredId(referredBobUid);
      expect(refRec?.status).toBe('REGISTERED');

      // Verify Bob still has referral discount available for their next try
      const bobAfterCancel = await getPassengerProfile(referredBobUid);
      expect(bobAfterCancel?.referralDiscountAvailable).toBe(true);
    });

    it('rewards referrer with R$ 5 when referred passenger completes their first valid ride', async () => {
      const origin = { address: 'Centro, São Sebastião', lat: -23.7928, lng: -45.3999 };
      const destination = { address: 'Praia Grande, São Sebastião', lat: -23.8200, lng: -45.4200 };

      const rideRes = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${referredBobToken}`)
        .send({
          origin,
          destination,
          paymentMethod: 'PIX',
          serviceType: 'ride',
          requestedDriverId: driverUid,
        });

      const rideId = rideRes.body.data.id;

      // Driver accepts ride
      await request(app)
        .post(`/api/v1/rides/${rideId}/accept`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({});

      // Driver arrives at pickup
      await request(app)
        .post(`/api/v1/rides/${rideId}/arrived`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({});

      // Driver starts ride
      await request(app)
        .post(`/api/v1/rides/${rideId}/start`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({});

      // Driver completes ride
      const completeRes = await request(app)
        .post(`/api/v1/rides/${rideId}/complete`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ paymentApproved: true });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.ride.status).toBe('COMPLETED');
      expect(completeRes.body.data.receipt.referralDiscountApplied).toBe(true);
      expect(completeRes.body.data.receipt.driverTotalEntitlement).toBe(completeRes.body.data.ride.originalFareAmount);
      expect(completeRes.body.data.receipt.platformSubsidyAmount).toBe(5.00);
      expect(completeRes.body.data.receipt.platformSubsidyStatus).toBe('PENDING_SETTLEMENT');

      // Verify referral record transitioned to REWARDED
      const refRec = await getReferralByReferredId(referredBobUid);
      expect(refRec?.status).toBe('REWARDED');
      expect(refRec?.qualifyingRideId).toBe(rideId);
      expect(refRec?.completedAt).toBeDefined();

      // Verify referrer Alice received R$ 5.00 in referralCreditBalance
      const aliceAfterComplete = await getPassengerProfile(referrerUid);
      expect(aliceAfterComplete?.referralCreditBalance).toBe(5.00);

      // Verify Bob's referral discount is consumed
      const bobAfterComplete = await getPassengerProfile(referredBobUid);
      expect(bobAfterComplete?.referralDiscountAvailable).toBe(false);

      // Verify referral dashboard reflects updated balance and completed count
      const dashRes = await request(app)
        .get('/api/v1/passengers/referral')
        .set('Authorization', `Bearer ${referrerToken}`);

      expect(dashRes.status).toBe(200);
      expect(dashRes.body.data.referralCreditBalance).toBe(5.00);
      expect(dashRes.body.data.completedReferrals).toBeGreaterThanOrEqual(1);
    });

    it('is idempotent: duplicate completion or payment approval does NOT award duplicate rewards', async () => {
      // Find the completed ride from previous test
      const refRec = await getReferralByReferredId(referredBobUid);
      const rideId = refRec?.qualifyingRideId;
      expect(rideId).toBeDefined();

      // Attempt to re-approve payment
      const secondApproval = await request(app)
        .post(`/api/v1/rides/${rideId}/approve-payment`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({});

      expect(secondApproval.status).toBe(200);

      // Referrer Alice balance must remain exactly R$ 5.00 (NOT R$ 10.00)
      const aliceAfterDuplicate = await getPassengerProfile(referrerUid);
      expect(aliceAfterDuplicate?.referralCreditBalance).toBe(5.00);
    });

    it('does NOT apply referral discount on Bob second ride after first ride is completed', async () => {
      const origin = { address: 'Centro, São Sebastião', lat: -23.7928, lng: -45.3999 };
      const destination = { address: 'Porto Grande, São Sebastião', lat: -23.8010, lng: -45.4020 };

      const secondRideRes = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${referredBobToken}`)
        .send({
          origin,
          destination,
          paymentMethod: 'PIX',
          serviceType: 'ride',
        });

      expect(secondRideRes.status).toBe(201);
      expect(secondRideRes.body.data.referralDiscountApplied).toBe(false);
      expect(secondRideRes.body.data.referralDiscountAmount).toBe(0);

      // Clean up second test ride so driver is not held busy
      await request(app)
        .post(`/api/v1/rides/${secondRideRes.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${referredBobToken}`)
        .send({ reason: 'Fim do teste de desconto' });
    });
  });

  describe('4. Financial Accounting & Driver Entitlement Protection', () => {
    const referredEduardoUid = 'pass-eduardo-' + Date.now();
    const referredEduardoEmail = `eduardo.${Date.now()}@teste.vaicar.app`;
    const referredEduardoToken = `${referredEduardoUid}:${referredEduardoEmail}`;

    beforeAll(async () => {
      // Register Eduardo with Alice's referral code
      await request(app)
        .post('/api/v1/auth/register-passenger')
        .send({
          uid: referredEduardoUid,
          name: 'Eduardo Teste',
          whatsapp: '+5512999996666',
          email: referredEduardoEmail,
          photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          termsAccepted: true,
          referralCode: referrerCode,
        });
    });

    it('guarantees driver total entitlement matches original fare while VaiCar subsidizes R$ 5,00', async () => {
      const origin = { address: 'Centro, São Sebastião', lat: -23.7928, lng: -45.3999 };
      const destination = { address: 'Maresias, São Sebastião', lat: -23.7950, lng: -45.5560 };

      // 1. Estimate
      const estRes = await request(app)
        .post('/api/v1/rides/estimate')
        .set('Authorization', `Bearer ${referredEduardoToken}`)
        .send({ origin, destination, serviceType: 'ride' });

      expect(estRes.status).toBe(200);
      expect(estRes.body.data.referralDiscountApplied).toBe(true);
      expect(estRes.body.data.discountAmount).toBe(5.00);
      expect(estRes.body.data.platformSubsidyAmount).toBe(5.00);
      expect(estRes.body.data.driverTotalEntitlement).toBe(estRes.body.data.originalFareAmount);
      expect(estRes.body.data.fareAmount).toBe(estRes.body.data.originalFareAmount - 5.00);

      // Verify each candidate driver option also specifies driverTotalEntitlement and platformSubsidyAmount
      if (estRes.body.data.availableDrivers && estRes.body.data.availableDrivers.length > 0) {
        const option = estRes.body.data.availableDrivers[0];
        expect(option.platformSubsidyAmount).toBe(5.00);
        expect(option.driverTotalEntitlement).toBe(option.originalFareAmount);
        expect(option.fareAmount).toBe(option.originalFareAmount - 5.00);
      }

      // Ensure driver is online with fresh GPS for automatic dispatch
      const dProfile = await getDriverProfile(driverUid);
      if (dProfile) {
        await saveDriverProfile({
          ...dProfile,
          isOnline: true,
          currentLocation: {
            ...dProfile.currentLocation!,
            updatedAt: new Date().toISOString(),
          },
        });
      }

      // 2. Request Ride (Automatic dispatch creates targeted RideOffer)
      const rideRes = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${referredEduardoToken}`)
        .send({
          origin,
          destination,
          paymentMethod: 'PIX',
          serviceType: 'ride',
        });

      expect(rideRes.status).toBe(201);
      const ride = rideRes.body.data;
      expect(ride.originalFareAmount).toBeGreaterThan(0);
      expect(ride.fareAmount).toBe(ride.originalFareAmount - 5.00);
      expect(ride.passengerFareAmount).toBe(ride.fareAmount);
      expect(ride.driverTotalEntitlement).toBe(ride.originalFareAmount);
      expect(ride.platformSubsidyAmount).toBe(5.00);
      expect(ride.platformSubsidyStatus).toBe('PENDING_SETTLEMENT');

      // 3. Verify driver's dispatch offer carries the full entitlement and subsidy info
      await new Promise((r) => setTimeout(r, 60));
      const offers = await listOffersForRide(ride.id);
      expect(offers.length).toBeGreaterThan(0);
      const pendingOffer = offers[0];
      expect(pendingOffer).toBeDefined();
      expect(pendingOffer?.driverTotalEntitlement).toBe(ride.originalFareAmount);
      expect(pendingOffer?.platformSubsidyAmount).toBe(5.00);
      expect(pendingOffer?.originalFareAmount).toBe(ride.originalFareAmount);

      // Driver accepts and completes ride
      await request(app)
        .post(`/api/v1/rides/${ride.id}/accept`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({});

      await request(app)
        .post(`/api/v1/rides/${ride.id}/arrived`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({});

      await request(app)
        .post(`/api/v1/rides/${ride.id}/start`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({});

      const completeRes = await request(app)
        .post(`/api/v1/rides/${ride.id}/complete`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ paymentApproved: true });

      expect(completeRes.status).toBe(200);
      const receipt = completeRes.body.data.receipt;
      expect(receipt).toBeDefined();
      expect(receipt.fareAmount).toBe(ride.fareAmount);
      expect(receipt.passengerFareAmount).toBe(ride.fareAmount);
      expect(receipt.driverTotalEntitlement).toBe(ride.originalFareAmount);
      expect(receipt.platformSubsidyAmount).toBe(5.00);
      expect(receipt.platformSubsidyStatus).toBe('PENDING_SETTLEMENT');
    });
  });

  describe('5. Concurrency & Mutex Protection Against Duplicate Rewards', () => {
    it('ensures concurrent completion and payment approval calls never duplicate referral rewards', async () => {
      const referredFabioUid = 'pass-fabio-' + Date.now();
      const referredFabioEmail = `fabio.${Date.now()}@teste.vaicar.app`;
      const referredFabioToken = `${referredFabioUid}:${referredFabioEmail}`;

      // Register Fabio under Alice
      await request(app)
        .post('/api/v1/auth/register-passenger')
        .send({
          uid: referredFabioUid,
          name: 'Fabio Concorrente',
          whatsapp: '+5512999997777',
          email: referredFabioEmail,
          photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          termsAccepted: true,
          referralCode: referrerCode,
        });

      // Get Alice balance before
      const aliceBefore = await getPassengerProfile(referrerUid);
      const balanceBefore = aliceBefore?.referralCreditBalance || 0;

      // Fabio creates ride
      const rideRes = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${referredFabioToken}`)
        .send({
          origin: { address: 'Centro, São Sebastião', lat: -23.7928, lng: -45.3999 },
          destination: { address: 'Juquehy, São Sebastião', lat: -23.7600, lng: -45.7200 },
          paymentMethod: 'CARD_MACHINE',
          serviceType: 'ride',
          requestedDriverId: driverUid,
        });

      const rideId = rideRes.body.data.id;

      await request(app).post(`/api/v1/rides/${rideId}/accept`).set('Authorization', `Bearer ${driverToken}`).send({});
      await request(app).post(`/api/v1/rides/${rideId}/arrived`).set('Authorization', `Bearer ${driverToken}`).send({});
      await request(app).post(`/api/v1/rides/${rideId}/start`).set('Authorization', `Bearer ${driverToken}`).send({});

      // Fire 3 simultaneous completion / approval requests concurrently
      const results = await Promise.all([
        request(app).post(`/api/v1/rides/${rideId}/complete`).set('Authorization', `Bearer ${driverToken}`).send({ paymentApproved: true }),
        request(app).post(`/api/v1/rides/${rideId}/complete`).set('Authorization', `Bearer ${driverToken}`).send({ paymentApproved: true }),
        request(app).post(`/api/v1/rides/${rideId}/approve-payment`).set('Authorization', `Bearer ${driverToken}`).send({}),
      ]);

      // At least one should succeed with 200
      expect(results.some((r) => r.status === 200)).toBe(true);

      // Verify Alice received EXACTLY 5.00 once, not 10.00 or 15.00
      const aliceAfter = await getPassengerProfile(referrerUid);
      expect(aliceAfter?.referralCreditBalance).toBe(balanceBefore + 5.00);

      // Referral record status is REWARDED with exactly 5.00
      const refRec = await getReferralByReferredId(referredFabioUid);
      expect(refRec?.status).toBe('REWARDED');
      expect(refRec?.rewardAmount).toBe(5.00);
    });
  });

  describe('6. Referral Credit Redemption on Future Rides', () => {
    it('allows a referring passenger to redeem R$ 5,00 credit on a future ride', async () => {
      // Alice currently has credits
      const aliceProfile = await getPassengerProfile(referrerUid);
      expect(aliceProfile?.referralCreditBalance).toBeGreaterThanOrEqual(5.00);
      const balanceBefore = aliceProfile!.referralCreditBalance;
      const redeemedBefore = aliceProfile!.referralCreditRedeemed || 0;

      const origin = { address: 'Centro, São Sebastião', lat: -23.7928, lng: -45.3999 };
      const destination = { address: 'Topolândia, São Sebastião', lat: -23.7850, lng: -45.4120 };

      // 1. Estimate with applyReferralCredit: true
      const estRes = await request(app)
        .post('/api/v1/rides/estimate')
        .set('Authorization', `Bearer ${referrerToken}`)
        .send({
          origin,
          destination,
          serviceType: 'ride',
          applyReferralCredit: true,
        });

      expect(estRes.status).toBe(200);
      expect(estRes.body.data.referralCreditApplied).toBe(true);
      expect(estRes.body.data.referralCreditAmount).toBe(5.00);
      expect(estRes.body.data.platformSubsidyAmount).toBe(5.00);
      expect(estRes.body.data.driverTotalEntitlement).toBe(estRes.body.data.originalFareAmount);
      expect(estRes.body.data.fareAmount).toBe(estRes.body.data.originalFareAmount - 5.00);

      // 2. Request Ride with applyReferralCredit: true
      const rideRes = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${referrerToken}`)
        .send({
          origin,
          destination,
          paymentMethod: 'PIX',
          serviceType: 'ride',
          applyReferralCredit: true,
          requestedDriverId: driverUid,
        });

      expect(rideRes.status).toBe(201);
      const ride = rideRes.body.data;
      expect(ride.referralCreditApplied).toBe(true);
      expect(ride.referralCreditAmount).toBe(5.00);
      expect(ride.fareAmount).toBe(ride.originalFareAmount - 5.00);
      expect(ride.driverTotalEntitlement).toBe(ride.originalFareAmount);
      expect(ride.platformSubsidyAmount).toBe(5.00);
      expect(ride.platformSubsidyStatus).toBe('PENDING_SETTLEMENT');

      // 3. Verify Alice\'s balance was debited atomically
      const aliceAfterDebit = await getPassengerProfile(referrerUid);
      expect(aliceAfterDebit?.referralCreditBalance).toBe(balanceBefore - 5.00);
      expect(aliceAfterDebit?.referralCreditRedeemed).toBe(redeemedBefore + 5.00);

      // 4. Verify referral summary reflects debited balance and redeemed amount
      const summaryRes = await request(app)
        .get('/api/v1/passengers/referral')
        .set('Authorization', `Bearer ${referrerToken}`);

      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.data.referralCreditBalance).toBe(balanceBefore - 5.00);
      expect(summaryRes.body.data.referralCreditRedeemed).toBe(redeemedBefore + 5.00);

      // Complete the ride and verify receipt preserves redemption
      await request(app).post(`/api/v1/rides/${ride.id}/accept`).set('Authorization', `Bearer ${driverToken}`).send({});
      await request(app).post(`/api/v1/rides/${ride.id}/arrived`).set('Authorization', `Bearer ${driverToken}`).send({});
      await request(app).post(`/api/v1/rides/${ride.id}/start`).set('Authorization', `Bearer ${driverToken}`).send({});
      const completeRes = await request(app)
        .post(`/api/v1/rides/${ride.id}/complete`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ paymentApproved: true });

      expect(completeRes.status).toBe(200);
      const receipt = completeRes.body.data.receipt;
      expect(receipt.referralCreditApplied).toBe(true);
      expect(receipt.referralCreditAmount).toBe(5.00);
      expect(receipt.driverTotalEntitlement).toBe(ride.originalFareAmount);
      expect(receipt.platformSubsidyAmount).toBe(5.00);
    });

    it('rejects credit redemption if passenger balance is insufficient', async () => {
      // Passenger with zero balance
      const brokeUid = 'pass-broke-' + Date.now();
      const brokeEmail = `broke.${Date.now()}@teste.vaicar.app`;
      const brokeToken = `${brokeUid}:${brokeEmail}`;

      await request(app)
        .post('/api/v1/auth/register-passenger')
        .send({
          uid: brokeUid,
          name: 'Passageiro Sem Saldo',
          whatsapp: '+5512999998888',
          email: brokeEmail,
          photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          termsAccepted: true,
        });

      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${brokeToken}`)
        .send({
          origin: { address: 'Centro, São Sebastião', lat: -23.7928, lng: -45.3999 },
          destination: { address: 'Topolândia, São Sebastião', lat: -23.7850, lng: -45.4120 },
          paymentMethod: 'PIX',
          serviceType: 'ride',
          applyReferralCredit: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Saldo de créditos de indicação insuficiente');
    });
  });

  describe('7. Ride Cancellation & Credit Refund Flow', () => {
    it('atomically refunds redeemed referral credits if the ride is cancelled', async () => {
      const claraUid = 'pass-clara-' + Date.now();
      const claraEmail = `clara.${Date.now()}@teste.vaicar.app`;
      const claraToken = `${claraUid}:${claraEmail}`;

      // Create Clara with R$ 5,00 balance
      const claraProfile: PassengerProfile = {
        uid: claraUid,
        name: 'Clara Reembolso',
        email: claraEmail,
        whatsapp: '+5512999999999',
        photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        termsAccepted: true,
        referralCode: 'CLARA77',
        referralCreditBalance: 5.00,
        referralCreditRedeemed: 0,
        referralDiscountAvailable: false,
        totalRides: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await savePassengerProfile(claraProfile);

      // Ensure test driver is online and has fresh GPS location
      const driver = await getDriverProfile(driverUid);
      if (driver) {
        await saveDriverProfile({
          ...driver,
          isOnline: true,
          currentLocation: {
            ...driver.currentLocation!,
            updatedAt: new Date().toISOString(),
          },
        });
      }

      // Clara creates ride with applyReferralCredit: true
      const rideRes = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${claraToken}`)
        .send({
          origin: { address: 'Centro, São Sebastião', lat: -23.7928, lng: -45.3999 },
          destination: { address: 'Maresias, São Sebastião', lat: -23.7950, lng: -45.5560 },
          paymentMethod: 'PIX',
          serviceType: 'ride',
          requestedDriverId: driverUid,
          applyReferralCredit: true,
        });

      expect(rideRes.status).toBe(201);
      const rideId = rideRes.body.data.id;

      // Clara balance was debited
      const claraDuringRide = await getPassengerProfile(claraUid);
      expect(claraDuringRide?.referralCreditBalance).toBe(0);
      expect(claraDuringRide?.referralCreditRedeemed).toBe(5.00);

      // Cancel the ride
      const cancelRes = await request(app)
        .post(`/api/v1/rides/${rideId}/cancel`)
        .set('Authorization', `Bearer ${claraToken}`)
        .send({ reason: 'Preciso remarcar' });

      expect(cancelRes.status).toBe(200);

      // Check ride platform subsidy status is CANCELLED
      const cancelledRide = await getRide(rideId);
      expect(cancelledRide?.status).toBe('CANCELLED_BY_PASSENGER');
      expect(cancelledRide?.platformSubsidyStatus).toBe('CANCELLED');

      // Clara\'s balance must be refunded back to R$ 5,00 and redeemed back to 0
      const claraAfterCancel = await getPassengerProfile(claraUid);
      expect(claraAfterCancel?.referralCreditBalance).toBe(5.00);
      expect(claraAfterCancel?.referralCreditRedeemed).toBe(0);
    });
  });

  describe('8. Admin Subsidy Settlement & Metrics', () => {
    const adminToken = 'test-admin-01:admin@vaicar.app';

    it('lists pending platform subsidies and provides settlement action', async () => {
      // 1. List Subsidies
      const listRes = await request(app)
        .get('/api/v1/admin/subsidies')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(Array.isArray(listRes.body.data.subsidies)).toBe(true);
      expect(listRes.body.data.totalSubsidyLiabilityBRL).toBeGreaterThanOrEqual(0);

      const pendingSubsidies = listRes.body.data.subsidies.filter(
        (s: any) => s.platformSubsidyStatus === 'PENDING_SETTLEMENT'
      );
      expect(pendingSubsidies.length).toBeGreaterThan(0);

      // 2. Settle the first pending subsidy
      const targetSubsidy = pendingSubsidies[0];
      const settleRes = await request(app)
        .post(`/api/v1/admin/subsidies/${targetSubsidy.id}/settle`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(settleRes.status).toBe(200);
      expect(settleRes.body.success).toBe(true);
      expect(settleRes.body.data.platformSubsidyStatus).toBe('SETTLED');
      expect(settleRes.body.data.platformSubsidySettledAt).toBeDefined();

      // 3. Verify Admin Metrics reflect subsidy liability and settled amounts
      const metricsRes = await request(app)
        .get('/api/v1/admin/metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(metricsRes.status).toBe(200);
      expect(metricsRes.body.data.totalPlatformSubsidyLiabilityBRL).toBeDefined();
      expect(metricsRes.body.data.pendingSubsidyCount).toBeDefined();
      expect(metricsRes.body.data.settledSubsidyAmountBRL).toBeGreaterThanOrEqual(5.00);
    });
  });

  describe('9. Dual-Write Atomicity, Safe Retries & Concurrency Guarantees', () => {
    it('1. Successfully creates ride with referral credit in a single atomic operation', async () => {
      const passUid = 'pass-atomic-success-' + Date.now();
      const passEmail = `atomic.success.${Date.now()}@teste.vaicar.app`;
      const passToken = `${passUid}:${passEmail}`;

      const profile: PassengerProfile = {
        uid: passUid,
        name: 'Passageiro Atomico Sucesso',
        email: passEmail,
        whatsapp: '+5512999991111',
        photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        termsAccepted: true,
        referralCode: 'ATOMIC1',
        referralCreditBalance: 5.00,
        referralCreditRedeemed: 0,
        referralDiscountAvailable: false,
        totalRides: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await savePassengerProfile(profile);

      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${passToken}`)
        .send({
          origin: { address: 'Centro, São Sebastião', lat: -23.7928, lng: -45.3999 },
          destination: { address: 'Maresias, São Sebastião', lat: -23.7950, lng: -45.5560 },
          paymentMethod: 'PIX',
          serviceType: 'ride',
          applyReferralCredit: true,
          requestedDriverId: driverUid,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const ride = res.body.data;
      expect(ride.referralCreditApplied).toBe(true);
      expect(ride.referralCreditAmount).toBe(5.00);
      expect(ride.fareAmount).toBe(ride.originalFareAmount - 5.00);
      expect(ride.driverTotalEntitlement).toBe(ride.originalFareAmount);
      expect(ride.platformSubsidyAmount).toBe(5.00);
      expect(ride.platformSubsidyStatus).toBe('PENDING_SETTLEMENT');

      // Passenger balance must be debited atomically
      const passAfter = await getPassengerProfile(passUid);
      expect(passAfter?.referralCreditBalance).toBe(0);
      expect(passAfter?.referralCreditRedeemed).toBe(5.00);
    });

    it('2. Prevents permanent credit loss when ride creation fails (Atomic Rollback)', async () => {
      const passUid = 'pass-atomic-fail-' + Date.now();
      const passEmail = `atomic.fail.${Date.now()}@teste.vaicar.app`;
      const passToken = `${passUid}:${passEmail}`;

      const profile: PassengerProfile = {
        uid: passUid,
        name: 'Passageiro Atomico Falha',
        email: passEmail,
        whatsapp: '+5512999992222',
        photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        termsAccepted: true,
        referralCode: 'ATOMIC2',
        referralCreditBalance: 5.00,
        referralCreditRedeemed: 0,
        referralDiscountAvailable: false,
        totalRides: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await savePassengerProfile(profile);

      // Attempt ride creation with simulated storage failure
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${passToken}`)
        .send({
          origin: { address: 'Centro, São Sebastião', lat: -23.7928, lng: -45.3999 },
          destination: { address: 'Maresias, São Sebastião', lat: -23.7950, lng: -45.5560 },
          paymentMethod: 'PIX',
          serviceType: 'ride',
          applyReferralCredit: true,
          requestedDriverId: driverUid,
          __simulateRideCreationFailure: true,
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);

      // CRITICAL: Passenger balance MUST remain intact at R$ 5,00 without any credit loss!
      const passAfter = await getPassengerProfile(passUid);
      expect(passAfter?.referralCreditBalance).toBe(5.00);
      expect(passAfter?.referralCreditRedeemed).toBe(0);
    });

    it('3. Prevents double-spend when concurrent requests attempt to spend the same credit balance', async () => {
      const passUid = 'pass-atomic-race-' + Date.now();
      const passEmail = `atomic.race.${Date.now()}@teste.vaicar.app`;
      const passToken = `${passUid}:${passEmail}`;

      // Exactly R$ 5,00 in balance
      const profile: PassengerProfile = {
        uid: passUid,
        name: 'Passageiro Concorrente',
        email: passEmail,
        whatsapp: '+5512999993333',
        photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        termsAccepted: true,
        referralCode: 'ATOMIC3',
        referralCreditBalance: 5.00,
        referralCreditRedeemed: 0,
        referralDiscountAvailable: false,
        totalRides: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await savePassengerProfile(profile);

      // Fire 2 simultaneous ride creation requests competing for the exact same R$ 5,00 balance
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/rides')
          .set('Authorization', `Bearer ${passToken}`)
          .send({
            origin: { address: 'Centro, São Sebastião', lat: -23.7928, lng: -45.3999 },
            destination: { address: 'Maresias, São Sebastião', lat: -23.7950, lng: -45.5560 },
            paymentMethod: 'PIX',
            serviceType: 'ride',
            applyReferralCredit: true,
            requestedDriverId: driverUid,
          }),
        request(app)
          .post('/api/v1/rides')
          .set('Authorization', `Bearer ${passToken}`)
          .send({
            origin: { address: 'Centro, São Sebastião', lat: -23.7928, lng: -45.3999 },
            destination: { address: 'Juquehy, São Sebastião', lat: -23.7600, lng: -45.7200 },
            paymentMethod: 'PIX',
            serviceType: 'ride',
            applyReferralCredit: true,
            requestedDriverId: driverUid,
          }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one must succeed (201) and the second must be rejected (400 insufficient credit or 409 active ride)
      expect(statuses[0]).toBe(201);
      expect([400, 409]).toContain(statuses[1]);

      // Passenger balance must be deducted exactly once to 0.00 (never negative or double-spent)
      const passAfter = await getPassengerProfile(passUid);
      expect(passAfter?.referralCreditBalance).toBe(0.00);
      expect(passAfter?.referralCreditRedeemed).toBe(5.00);
    });

    it('4. Enforces safe retries without duplicate rides or duplicate refunds', async () => {
      const passUid = 'pass-atomic-retry-' + Date.now();
      const passEmail = `atomic.retry.${Date.now()}@teste.vaicar.app`;
      const passToken = `${passUid}:${passEmail}`;

      const profile: PassengerProfile = {
        uid: passUid,
        name: 'Passageiro Retry Seguro',
        email: passEmail,
        whatsapp: '+5512999994444',
        photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        termsAccepted: true,
        referralCode: 'ATOMIC4',
        referralCreditBalance: 5.00,
        referralCreditRedeemed: 0,
        referralDiscountAvailable: false,
        totalRides: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await savePassengerProfile(profile);

      // 1. Create ride with referral credit
      const rideRes = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${passToken}`)
        .send({
          origin: { address: 'Centro, São Sebastião', lat: -23.7928, lng: -45.3999 },
          destination: { address: 'Maresias, São Sebastião', lat: -23.7950, lng: -45.5560 },
          paymentMethod: 'PIX',
          serviceType: 'ride',
          applyReferralCredit: true,
          requestedDriverId: driverUid,
        });

      expect(rideRes.status).toBe(201);
      const rideId = rideRes.body.data.id;

      // 2. Retry creating another ride while ride is active -> Rejected with 409 (cannot duplicate active ride)
      const retryCreate = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${passToken}`)
        .send({
          origin: { address: 'Centro, São Sebastião', lat: -23.7928, lng: -45.3999 },
          destination: { address: 'Maresias, São Sebastião', lat: -23.7950, lng: -45.5560 },
          paymentMethod: 'PIX',
          serviceType: 'ride',
          applyReferralCredit: true,
          requestedDriverId: driverUid,
        });
      expect(retryCreate.status).toBe(409);

      // 3. Cancel ride -> 1st cancellation refunds the credit
      const cancel1 = await request(app)
        .post(`/api/v1/rides/${rideId}/cancel`)
        .set('Authorization', `Bearer ${passToken}`)
        .send({ reason: 'Cancelamento normal' });

      expect(cancel1.status).toBe(200);

      const passAfterCancel1 = await getPassengerProfile(passUid);
      expect(passAfterCancel1?.referralCreditBalance).toBe(5.00);
      expect(passAfterCancel1?.referralCreditRedeemed).toBe(0);

      // 4. Retry cancellation on already-cancelled ride -> Rejected with 400
      const cancelRetry = await request(app)
        .post(`/api/v1/rides/${rideId}/cancel`)
        .set('Authorization', `Bearer ${passToken}`)
        .send({ reason: 'Tentativa duplicada' });

      expect(cancelRetry.status).toBe(400);

      // 5. Direct or concurrent attempt to invoke refundReferralCreditForRide on the same ride -> Idempotently returns false
      const directRide = await getRide(rideId);
      expect(directRide).toBeDefined();
      const directRefundRes = await refundReferralCreditForRide(directRide!);
      expect(directRefundRes.refunded).toBe(false);

      // CRITICAL: Balance remains exactly 5.00 (NEVER double refunded to 10.00)
      const passAfterCancelRetry = await getPassengerProfile(passUid);
      expect(passAfterCancelRetry?.referralCreditBalance).toBe(5.00);
      expect(passAfterCancelRetry?.referralCreditRedeemed).toBe(0);

      // 6. Now spend the refunded credit on a new ride (balance becomes 0)
      const newRideRes = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${passToken}`)
        .send({
          origin: { address: 'Centro, São Sebastião', lat: -23.7928, lng: -45.3999 },
          destination: { address: 'Maresias, São Sebastião', lat: -23.7950, lng: -45.5560 },
          paymentMethod: 'PIX',
          serviceType: 'ride',
          applyReferralCredit: true,
          requestedDriverId: driverUid,
        });
      expect(newRideRes.status).toBe(201);

      // Complete this new ride so passenger has no active ride
      await request(app).post(`/api/v1/rides/${newRideRes.body.data.id}/accept`).set('Authorization', `Bearer ${driverToken}`).send({});
      await request(app).post(`/api/v1/rides/${newRideRes.body.data.id}/arrived`).set('Authorization', `Bearer ${driverToken}`).send({});
      await request(app).post(`/api/v1/rides/${newRideRes.body.data.id}/start`).set('Authorization', `Bearer ${driverToken}`).send({});
      await request(app).post(`/api/v1/rides/${newRideRes.body.data.id}/complete`).set('Authorization', `Bearer ${driverToken}`).send({ paymentApproved: true });

      // 7. Now retry requesting with 0 balance -> Rejected with 400 (insufficient credit)
      const retryZeroBal = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${passToken}`)
        .send({
          origin: { address: 'Centro, São Sebastião', lat: -23.7928, lng: -45.3999 },
          destination: { address: 'Maresias, São Sebastião', lat: -23.7950, lng: -45.5560 },
          paymentMethod: 'PIX',
          serviceType: 'ride',
          applyReferralCredit: true,
          requestedDriverId: driverUid,
        });
      expect(retryZeroBal.status).toBe(400);
      expect(retryZeroBal.body.error.message).toContain('insuficiente');
    });

    it('5. Normal ride creation without referral credit operates completely unchanged', async () => {
      const passUid = 'pass-atomic-normal-' + Date.now();
      const passEmail = `atomic.normal.${Date.now()}@teste.vaicar.app`;
      const passToken = `${passUid}:${passEmail}`;

      const profile: PassengerProfile = {
        uid: passUid,
        name: 'Passageiro Sem Credito',
        email: passEmail,
        whatsapp: '+5512999995555',
        photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        termsAccepted: true,
        referralCode: 'ATOMIC5',
        referralCreditBalance: 15.00,
        referralCreditRedeemed: 0,
        referralDiscountAvailable: false,
        totalRides: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await savePassengerProfile(profile);

      // Normal request without applyReferralCredit
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${passToken}`)
        .send({
          origin: { address: 'Centro, São Sebastião', lat: -23.7928, lng: -45.3999 },
          destination: { address: 'Maresias, São Sebastião', lat: -23.7950, lng: -45.5560 },
          paymentMethod: 'CASH',
          serviceType: 'ride',
          requestedDriverId: driverUid,
        });

      expect(res.status).toBe(201);
      const ride = res.body.data;
      expect(ride.referralCreditApplied).toBe(false);
      expect(ride.referralCreditAmount).toBe(0);
      expect(ride.platformSubsidyAmount).toBe(0);
      expect(ride.platformSubsidyStatus).toBe('NONE');
      expect(ride.driverTotalEntitlement).toBe(ride.originalFareAmount);
      expect(ride.fareAmount).toBe(ride.originalFareAmount);

      // Passenger balance remains 15.00 untouched
      const passAfter = await getPassengerProfile(passUid);
      expect(passAfter?.referralCreditBalance).toBe(15.00);
      expect(passAfter?.referralCreditRedeemed).toBe(0);
    });
  });
});
