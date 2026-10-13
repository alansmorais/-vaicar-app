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
} from '../api/src/services/dispatch.js';
import {
  getRide,
  saveRide,
  saveDriverProfile,
  getDriverProfile,
  listAllDrivers,
  getRideOffer,
  saveRideOffer,
  resolveDriverProfile,
  getActivePendingOfferForDriver,
  savePassengerProfile,
  savePendingPin,
} from '../api/src/services/firestore.js';
import { DriverProfile, Ride } from '../shared/src/types.js';

describe('VaiCar Platform - API Automated Tests', () => {
  // Test authentication tokens for dev/test mode
  const passengerToken = 'test-pass-01:passenger@teste.vaicar.app';
  const driverToken = 'test-driv-01:motorista@teste.vaicar.app';
  const adminToken = 'test-admin-01:admin@vaicar.app';

  function generateValidTestCpf(): string {
    const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 9));
    const sum1 = digits.reduce((acc, d, i) => acc + d * (10 - i), 0);
    const d9 = ((sum1 * 10) % 11) % 10;
    digits.push(d9);
    const sum2 = digits.reduce((acc, d, i) => acc + d * (11 - i), 0);
    const d10 = ((sum2 * 10) % 11) % 10;
    digits.push(d10);
    return digits.join('');
  }

  it('1. Health check returns 200 and São Sebastião market', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.market).toContain('São Sebastião');
    expect(res.body.requestId).toBeDefined();
  });

  describe('Passenger Registration Validation', () => {
    it('rejects registration with missing WhatsApp', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register-passenger')
        .send({
          uid: 'p-invalid-phone',
          name: 'João Silva',
          whatsapp: '',
          email: 'joao.silva@teste.com',
          photoUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          termsAccepted: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects registration with fake local email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register-passenger')
        .send({
          uid: 'p-invalid-email',
          name: 'João Silva',
          whatsapp: '(12) 99123-4567',
          email: 'joao@vaicar.local',
          photoUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          termsAccepted: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects registration with missing photo', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register-passenger')
        .send({
          uid: 'p-invalid-photo',
          name: 'João Silva',
          whatsapp: '(12) 99123-4567',
          email: 'joao@teste.com',
          photoUrl: '',
          termsAccepted: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('successfully registers valid passenger and creates account', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register-passenger')
        .send({
          uid: 'test-pass-01',
          name: 'Maria Fernandes',
          whatsapp: '(12) 99123-4567',
          email: 'passenger@teste.vaicar.app',
          photoUrl: 'https://storage.googleapis.com/vaicar-bucket/users/test-pass-01/photo.jpg',
          termsAccepted: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.passenger.name).toBe('Maria Fernandes');
      expect(res.body.data.user.role).toBe('passenger');
    });

    it('rejects duplicate registration with identical email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register-passenger')
        .send({
          uid: 'test-pass-dup',
          name: 'Outra Maria',
          whatsapp: '(12) 99222-3344',
          email: 'passenger@teste.vaicar.app',
          photoUrl: 'https://storage.googleapis.com/vaicar-bucket/users/photo.jpg',
          termsAccepted: true,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_ACCOUNT');
    });
  });

  describe('Driver Registration & Approval Flow', () => {
    it('rejects driver with invalid CPF', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register-driver')
        .send({
          uid: 'd-inv-cpf',
          name: 'Carlos Oliveira',
          cpf: '111.111.111-11', // Invalid check digits
          birthDate: '1985-05-15',
          whatsapp: '(12) 99888-7766',
          email: 'carlos@teste.com',
          photoUrl: 'https://storage.googleapis.com/vaicar/photo.jpg',
          professionalCategory: 'EAR',
          cnhNumber: '12345678901',
          vehicle: { brand: 'Toyota', model: 'Corolla', year: 2022, color: 'Prata', plate: 'ABC1D23' },
          operatingZones: ['Centro & Porto Grande'],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects driver under 18 years old', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register-driver')
        .send({
          uid: 'd-minor',
          name: 'Jovem Oliveira',
          cpf: '52998224725', // Valid algorithmic test CPF format
          birthDate: '2020-01-01', // Minor
          whatsapp: '(12) 99888-7766',
          email: 'jovem@teste.com',
          photoUrl: 'https://storage.googleapis.com/vaicar/photo.jpg',
          professionalCategory: 'EAR',
          cnhNumber: '12345678901',
          vehicle: { brand: 'Toyota', model: 'Corolla', year: 2022, color: 'Prata', plate: 'ABC1D23' },
          operatingZones: ['Centro & Porto Grande'],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('successfully registers valid driver in PENDING_APPROVAL status', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register-driver')
        .send({
          uid: 'test-driv-01',
          name: 'Carlos Santos',
          cpf: '52998224725',
          birthDate: '1990-08-12',
          whatsapp: '(12) 99777-6655',
          email: 'motorista@teste.vaicar.app',
          photoUrl: 'https://storage.googleapis.com/vaicar/users/test-driv-01/photo.jpg',
          professionalCategory: 'Motorista de Aplicativo / EAR',
          cnhNumber: '12345678901',
          vehicle: { brand: 'Chevrolet', model: 'Onix Plus', year: 2023, color: 'Branco', plate: 'BRA2E19' },
          operatingZones: ['Centro & Porto Grande', 'Maresias & Paúba'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.driver.status).toBe('PENDING_APPROVAL');
      expect(res.body.data.driver.isOnline).toBe(false);
    });

    it('prevents unapproved driver from going ONLINE', async () => {
      const res = await request(app)
        .post('/api/v1/drivers/toggle-online')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ isOnline: true });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('admin approves driver and driver can now go online', async () => {
      // Approve via admin
      const approveRes = await request(app)
        .post('/api/v1/admin/drivers/test-driv-01/approve')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('APPROVED');

      // Now driver toggles online
      const onlineRes = await request(app)
        .post('/api/v1/drivers/toggle-online')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ isOnline: true });

      expect(onlineRes.status).toBe(200);
      expect(onlineRes.body.data.isOnline).toBe(true);
    });

    it('driver updates live GPS location', async () => {
      const res = await request(app)
        .post('/api/v1/drivers/location')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ lat: -23.8055, lng: -45.4011, heading: 90 });

      expect(res.status).toBe(200);
      expect(res.body.data.lat).toBe(-23.8055);
      expect(res.body.data.lng).toBe(-45.4011);
    });
  });

  describe('Ride State Machine & Fare Calculation', () => {
    let createdRideId = '';

    it('calculates fare estimate between Centro and Maresias', async () => {
      const res = await request(app)
        .post('/api/v1/rides/estimate')
        .set('Authorization', `Bearer ${passengerToken}`)
        .send({
          origin: { address: 'Centro Histórico, São Sebastião - SP', lat: -23.8055, lng: -45.4011 },
          destination: { address: 'Praia de Maresias, São Sebastião - SP', lat: -23.7915, lng: -45.5683 },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.distanceKm).toBeGreaterThan(10);
      expect(res.body.data.fareAmount).toBeGreaterThan(30);
    });

    it('passenger requests ride -> status REQUESTED', async () => {
      const res = await request(app)
        .post('/api/v1/rides/request')
        .set('Authorization', `Bearer ${passengerToken}`)
        .send({
          origin: { address: 'Centro Histórico, São Sebastião', lat: -23.8055, lng: -45.4011 },
          destination: { address: 'Praia de Barequeçaba, São Sebastião', lat: -23.8266, lng: -45.4389 },
          paymentMethod: 'PIX',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('REQUESTED');
      createdRideId = res.body.data.id;
    });

    it('driver accepts ride -> status DRIVER_ARRIVING', async () => {
      const res = await request(app)
        .post(`/api/v1/rides/${createdRideId}/accept`)
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('DRIVER_ARRIVING');
      expect(res.body.data.driverId).toBe('test-driv-01');
    });

    it('driver marks arrived -> status ARRIVED and starts waiting timer', async () => {
      const res = await request(app)
        .post(`/api/v1/rides/${createdRideId}/arrived`)
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ARRIVED');
      expect(res.body.data.waitingTimerStartedAt).toBeDefined();
    });

    it('driver starts ride -> status IN_PROGRESS', async () => {
      const res = await request(app)
        .post(`/api/v1/rides/${createdRideId}/start`)
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('IN_PROGRESS');
      expect(res.body.data.startedAt).toBeDefined();
    });

    it('driver completes ride -> status COMPLETED and generates receipt', async () => {
      const res = await request(app)
        .post(`/api/v1/rides/${createdRideId}/complete`)
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.ride.status).toBe('COMPLETED');
      expect(res.body.data.receipt).toBeDefined();
      expect(res.body.data.receipt.receiptNumber).toMatch(/^VCR-/);
    });
  });

  describe('Admin Portal Features', () => {
    it('returns platform metrics with completed rides and active drivers', async () => {
      const res = await request(app)
        .get('/api/v1/admin/metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalRides).toBeGreaterThanOrEqual(1);
      expect(res.body.data.completedRides).toBeGreaterThanOrEqual(1);
      expect(res.body.data.grossVolumeBRL).toBeGreaterThan(0);
    });

    it('updates pricing settings', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/pricing')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ baseFare: 8.50, perKmRate: 4.00 });

      expect(res.status).toBe(200);
      expect(res.body.data.baseFare).toBe(8.50);
      expect(res.body.data.perKmRate).toBe(4.00);
    });

    it('lists email diagnostics', async () => {
      const res = await request(app)
        .get('/api/v1/admin/email-diagnostics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('rejects admin login with incorrect password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/admin-login')
        .send({
          email: 'admin@vaicar.app',
          password: 'WrongPassword123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects admin login with non-admin email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/admin-login')
        .send({
          email: 'imposter@random.com',
          password: 'VaiCar#2026Admin',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('successfully authenticates admin with admin@vaicar.app and VaiCar#2026Admin', async () => {
      const res = await request(app)
        .post('/api/v1/auth/admin-login')
        .send({
          email: 'admin@vaicar.app',
          password: 'VaiCar#2026Admin',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.role).toBe('admin');
      expect(res.body.data.user.isAdmin).toBe(true);

      // Verify that the generated token works on admin metrics
      const metricsRes = await request(app)
        .get('/api/v1/admin/metrics')
        .set('Authorization', `Bearer ${res.body.data.token}`);
      expect(metricsRes.status).toBe(200);
    });

    it('successfully authenticates admin with vaicar@alansmsolutions.com', async () => {
      const res = await request(app)
        .post('/api/v1/auth/admin-login')
        .send({
          email: 'vaicar@alansmsolutions.com',
          password: 'VaiCar#2026Admin',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('vaicar@alansmsolutions.com');
    });

    it('accepts passenger registration with relative /uploads/ path', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register-passenger')
        .send({
          uid: 'test-pass-relative-upload',
          name: 'Renata Litoral',
          whatsapp: '(12) 99765-4321',
          email: 'renata.uploads@teste.vaicar.app',
          photoUrl: '/uploads/users/test-pass-relative-upload/photo.jpg',
          termsAccepted: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.passenger.photoUrl).toBe('/uploads/users/test-pass-relative-upload/photo.jpg');
    });
  });

  describe('Dual Registration & International Phone Numbers', () => {
    const dualUserEmail = 'dual.user@teste.vaicar.app';
    const internationalPhone = '+55 12 99888-7766';

    it('allows passenger registration with international phone format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register-passenger')
        .send({
          uid: 'test-dual-user-pass',
          name: 'Carlos Dual',
          whatsapp: internationalPhone,
          email: dualUserEmail,
          photoUrl: 'https://storage.googleapis.com/vaicar-bucket/users/photo.jpg',
          termsAccepted: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.passenger.whatsapp).toContain('5512998887766');
    });

    it('allows the same user (same email & whatsapp) to also register as driver', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register-driver')
        .send({
          uid: 'test-dual-user-driver',
          name: 'Carlos Dual',
          cpf: '11144477735',
          birthDate: '1990-08-12',
          cnhNumber: '12345678901',
          professionalCategory: 'Motorista de Aplicativo / EAR',
          operatingZones: ['Centro & Porto Grande'],
          whatsapp: internationalPhone,
          email: dualUserEmail,
          photoUrl: 'https://storage.googleapis.com/vaicar-bucket/users/photo.jpg',
          vehicle: {
            plate: 'ABC1D23',
            model: 'Onix',
            brand: 'Chevrolet',
            year: 2022,
            color: 'Prata',
            category: 'CAR',
          },
          criminalRecordDocUrl: 'https://storage.googleapis.com/vaicar-bucket/users/doc.pdf',
          subscriptionPlan: 'weekly_percent_10',
          termsAccepted: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.driver.subscriptionPlan).toBe('weekly_percent_10');
    });

    it('returns both passenger and driver profiles in /auth/me for dual account', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer test-dual-user-driver:${dualUserEmail}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.isDriver).toBe(true);
      expect(res.body.data.user.isPassenger).toBe(true);
      expect(res.body.data.driverProfile).toBeDefined();
      expect(res.body.data.passengerProfile).toBeDefined();
    });
  });

  describe('Non-Payment (Calote) Reporting & Automatic Account Blocking', () => {
    const victimPassengerUid = 'test-calote-passenger';
    const victimEmail = 'caloteiro@teste.vaicar.app';
    const victimToken = `${victimPassengerUid}:${victimEmail}`;

    it('registers a test passenger for non-payment testing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register-passenger')
        .send({
          uid: victimPassengerUid,
          name: 'Caloteiro Teste',
          whatsapp: '+55 12 99999-0001',
          email: victimEmail,
          photoUrl: 'https://storage.googleapis.com/vaicar-bucket/users/photo.jpg',
          termsAccepted: true,
        });

      expect(res.status).toBe(201);
    });

    it('driver reports passenger for UNPAID_FARE and passenger gets immediately blocked', async () => {
      const res = await request(app)
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          targetId: victimPassengerUid,
          targetRole: 'passenger',
          category: 'UNPAID_FARE',
          description: 'Passageiro saiu do carro dizendo que faria Pix e não enviou comprovante.',
          unpaidAmount: 45.0,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.report.category).toBe('UNPAID_FARE');
      expect(res.body.data.passengerBlocked).toBe(true);
    });

    it('blocked passenger is rejected from requesting new rides with HTTP 403', async () => {
      const res = await request(app)
        .post('/api/v1/rides/request')
        .set('Authorization', `Bearer ${victimToken}`)
        .send({
          origin: {
            lat: -23.7788,
            lng: -45.4123,
            address: 'Praia Grande, São Sebastião',
          },
          destination: {
            lat: -23.7654,
            lng: -45.4012,
            address: 'Maresias, São Sebastião',
          },
          paymentMethod: 'CASH',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.details.isBlocked).toBe(true);
    });

    it('admin can list reports and resolve the incident', async () => {
      const reportsRes = await request(app)
        .get('/api/v1/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(reportsRes.status).toBe(200);
      expect(reportsRes.body.data.length).toBeGreaterThan(0);

      const unpaidReport = reportsRes.body.data.find(
        (r: any) => r.targetId === victimPassengerUid && r.category === 'UNPAID_FARE'
      );
      expect(unpaidReport).toBeDefined();

      // Admin resolves report
      const resolveRes = await request(app)
        .post(`/api/v1/admin/reports/${unpaidReport.id}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resolution: 'RESOLVED',
          adminNotes: 'Acordo firmado e comprovante de pagamento apresentado.',
        });

      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.data.status).toBe('RESOLVED');
    });

    it('admin unblocks the passenger who can now request rides again', async () => {
      const unblockRes = await request(app)
        .post(`/api/v1/admin/passengers/${victimPassengerUid}/unblock`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(unblockRes.status).toBe(200);
      expect(unblockRes.body.data.isBlocked).toBe(false);

      // Now ride request proceeds past blocked check (may fail if no driver online, but not 403 PASSENGER_BLOCKED)
      const rideRes = await request(app)
        .post('/api/v1/rides/request')
        .set('Authorization', `Bearer ${victimToken}`)
        .send({
          origin: {
            lat: -23.7788,
            lng: -45.4123,
            address: 'Praia Grande, São Sebastião',
          },
          destination: {
            lat: -23.7654,
            lng: -45.4012,
            address: 'Maresias, São Sebastião',
          },
          paymentMethod: 'CASH',
        });

      expect(rideRes.status).not.toBe(403);
      if (rideRes.body?.data?.id) {
        await request(app)
          .post(`/api/v1/rides/${rideRes.body.data.id}/cancel`)
          .set('Authorization', `Bearer ${victimToken}`)
          .send({ reason: 'PASSENGER_CANCELLED' });
      }
    });

    it('admin can delete a passenger from the platform', async () => {
      const deleteRes = await request(app)
        .delete(`/api/v1/admin/passengers/${victimPassengerUid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      const listRes = await request(app)
        .get('/api/v1/admin/passengers')
        .set('Authorization', `Bearer ${adminToken}`);

      const found = listRes.body.data.find((p: any) => p.uid === victimPassengerUid);
      expect(found).toBeUndefined();
    });

    it('admin can reject a driver and re-approve without undefined field errors', async () => {
      // 1. Reject driver
      const rejectRes = await request(app)
        .post('/api/v1/admin/drivers/test-driv-01/reject')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Foto de CNH ilegível, reenvie por favor.' });

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.data.status).toBe('REJECTED');
      expect(rejectRes.body.data.rejectionReason).toBeDefined();

      // 2. Re-approve driver (previously threw Firestore undefined error on rejectionReason)
      const approveRes = await request(app)
        .post('/api/v1/admin/drivers/test-driv-01/approve')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('APPROVED');
      expect(approveRes.body.data.rejectionReason).toBeUndefined();
    });
  });

  describe('Driver Partnership Plan Switching', () => {
    const planDriverUid = 'test-plan-driver-uid';
    const planDriverEmail = 'plan.driver@teste.vaicar.app';

    it('registers a test driver with monthly_100 plan and plan dates', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register-driver')
        .send({
          uid: planDriverUid,
          name: 'Motorista Planos',
          cpf: '22233344405',
          birthDate: '1985-05-15',
          whatsapp: '(12) 99999-8888',
          email: planDriverEmail,
          photoUrl: 'https://storage.googleapis.com/vaicar-bucket/users/photo.jpg',
          professionalCategory: 'Motorista de Aplicativo / EAR',
          cnhNumber: '98765432100',
          vehicle: {
            plate: 'BRA2E20',
            model: 'Corolla',
            brand: 'Toyota',
            year: 2021,
            color: 'Branco',
          },
          operatingZones: ['Centro & Porto Grande'],
          subscriptionPlan: 'monthly_100',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.driver.subscriptionPlan).toBe('monthly_100');
      expect(res.body.data.driver.subscriptionPlanSelectedAt).toBeDefined();
      expect(res.body.data.driver.nextPlanSwitchAllowedAt).toBeDefined();
    });

    it('rejects plan switch before 1 month has elapsed for monthly_100', async () => {
      const res = await request(app)
        .post('/api/v1/drivers/change-plan')
        .set('Authorization', `Bearer ${planDriverUid}:${planDriverEmail}`)
        .send({ plan: 'weekly_percent_10' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('A troca de plano só é permitida após 1 mês (30 dias)');
    });

    it('allows plan switch after 1 month (simulated elapsed date)', async () => {
      const { getDriverProfile, saveDriverProfile } = await import('../api/src/services/firestore.js');
      const driver = await getDriverProfile(planDriverUid);
      expect(driver).toBeDefined();

      // Backdate plan selection date by 31 days
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
      const pastAllowedDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
      await saveDriverProfile({
        ...driver!,
        subscriptionPlanSelectedAt: thirtyOneDaysAgo,
        nextPlanSwitchAllowedAt: pastAllowedDate,
      });

      const res = await request(app)
        .post('/api/v1/drivers/change-plan')
        .set('Authorization', `Bearer ${planDriverUid}:${planDriverEmail}`)
        .send({ plan: 'weekly_percent_10' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.driver.subscriptionPlan).toBe('weekly_percent_10');
      expect(res.body.data.message).toContain('10% Semanal');
    });

    it('rejects switching back before 1 week has elapsed for weekly_percent_10', async () => {
      const res = await request(app)
        .post('/api/v1/drivers/change-plan')
        .set('Authorization', `Bearer ${planDriverUid}:${planDriverEmail}`)
        .send({ plan: 'monthly_100' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('A troca de plano só é permitida após 1 semana (7 dias)');
    });

    it('allows switching back after 1 week (simulated elapsed date for weekly)', async () => {
      const { getDriverProfile, saveDriverProfile } = await import('../api/src/services/firestore.js');
      const driver = await getDriverProfile(planDriverUid);
      expect(driver).toBeDefined();

      // Backdate by 8 days
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      const pastAllowedDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
      await saveDriverProfile({
        ...driver!,
        subscriptionPlanSelectedAt: eightDaysAgo,
        nextPlanSwitchAllowedAt: pastAllowedDate,
      });

      const res = await request(app)
        .post('/api/v1/drivers/change-plan')
        .set('Authorization', `Bearer ${planDriverUid}:${planDriverEmail}`)
        .send({ plan: 'monthly_100' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.driver.subscriptionPlan).toBe('monthly_100');
      expect(res.body.data.message).toContain('Mensalidade de R$ 100/mês');
    });
  });

  describe('Passenger Profile Auto-Healing and Ride Ordering Resilience', () => {
    it('allows an authenticated user without pre-existing passenger record to request a ride directly', async () => {
      const newPassengerUid = 'auto-pass-01';
      const newPassengerEmail = 'auto.passenger@teste.vaicar.app';

      const res = await request(app)
        .post('/api/v1/rides/request')
        .set('Authorization', `Bearer ${newPassengerUid}:${newPassengerEmail}`)
        .send({
          origin: { address: 'Barequeçaba, São Sebastião - SP', lat: -23.8241, lng: -45.4332 },
          destination: { address: 'Centro Histórico, São Sebastião - SP', lat: -23.8055, lng: -45.4011 },
          paymentMethod: 'PIX',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toMatch(/^ride-/);
      expect(res.body.data.passengerId).toBe(newPassengerUid);
      expect(res.body.data.fareAmount).toBeGreaterThan(0);
      expect(res.body.data.status).toBe('REQUESTED');
      if (res.body?.data?.id) {
        await request(app)
          .post(`/api/v1/rides/${res.body.data.id}/cancel`)
          .set('Authorization', `Bearer ${newPassengerUid}:${newPassengerEmail}`)
          .send({ reason: 'PASSENGER_CANCELLED' });
      }
    });

    it('returns auto-healed profile on GET /api/v1/passengers/me for authenticated user', async () => {
      const newPassengerUid = 'auto-pass-02';
      const newPassengerEmail = 'auto.passenger2@teste.vaicar.app';

      const res = await request(app)
        .get('/api/v1/passengers/me')
        .set('Authorization', `Bearer ${newPassengerUid}:${newPassengerEmail}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.uid).toBe(newPassengerUid);
      expect(res.body.data.email).toBe(newPassengerEmail);
      expect(res.body.data.rating).toBe(5.0);
    });
  });

  describe('Driver Payment Approval & Passenger Lock Flow', () => {
    const pUid = 'pass-approval-test';
    const pEmail = 'pass.approval@teste.vaicar.app';
    const dUid = 'test-driv-01'; // already approved test driver
    const dEmail = 'motorista@teste.vaicar.app';
    let rideId: string;

    it('creates and starts a ride between passenger and driver', async () => {
      // Ensure driver is approved, online, and positioned near pickup
      let drv = await getDriverProfile(dUid);
      if (!drv) drv = await resolveDriverProfile(dUid, dEmail);
      if (!drv) {
        drv = {
          uid: dUid,
          name: 'Carlos Santos',
          cpf: '52998224725',
          birthDate: '1990-08-12',
          whatsapp: '(12) 99777-6655',
          email: dEmail,
          photoUrl: 'https://storage.googleapis.com/vaicar/users/test-driv-01/photo.jpg',
          professionalCategory: 'Motorista de Aplicativo / EAR',
          cnhNumber: '12345678901',
          vehicle: { brand: 'Chevrolet', model: 'Onix Plus', year: 2023, color: 'Branco', plate: 'BRA2E19', type: 'car' },
          operatingZones: ['Centro & Porto Grande', 'Maresias & Paúba'],
          status: 'APPROVED',
          isOnline: true,
          rating: 5,
          completedRidesCount: 10,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as DriverProfile;
      }
      await saveDriverProfile({
        ...drv,
        status: 'APPROVED',
        isOnline: true,
        vehicle: drv.vehicle ? { ...drv.vehicle, type: 'car' } : { brand: 'Chevrolet', model: 'Onix Plus', year: 2023, color: 'Branco', plate: 'BRA2E19', type: 'car' },
        currentLocation: { lat: -23.7915, lng: -45.5683, updatedAt: new Date().toISOString() },
      });

      // 1. Passenger requests ride
      const reqRes = await request(app)
        .post('/api/v1/rides/request')
        .set('Authorization', `Bearer ${pUid}:${pEmail}`)
        .send({
          origin: { address: 'Maresias, São Sebastião', lat: -23.7915, lng: -45.5683 },
          destination: { address: 'Boiçucanga, São Sebastião', lat: -23.7788, lng: -45.6123 },
          paymentMethod: 'PIX',
        });

      expect(reqRes.status).toBe(201);
      rideId = reqRes.body.data.id;

      // 2. Driver accepts ride
      const acceptRes = await request(app)
        .post(`/api/v1/rides/${rideId}/accept`)
        .set('Authorization', `Bearer ${dUid}:${dEmail}`);
      if (acceptRes.status !== 200) throw new Error('FAIL acceptRes: ' + JSON.stringify(acceptRes.body));
      expect(acceptRes.status).toBe(200);

      // 3. Driver marks arrived
      const arrivedRes = await request(app)
        .post(`/api/v1/rides/${rideId}/arrived`)
        .set('Authorization', `Bearer ${dUid}:${dEmail}`);
      expect(arrivedRes.status).toBe(200);

      // 4. Driver starts ride
      const startRes = await request(app)
        .post(`/api/v1/rides/${rideId}/start`)
        .set('Authorization', `Bearer ${dUid}:${dEmail}`);
      expect(startRes.status).toBe(200);
      expect(startRes.body.data.status).toBe('IN_PROGRESS');
    });

    it('driver completes ride with paymentApproved: false', async () => {
      const compRes = await request(app)
        .post(`/api/v1/rides/${rideId}/complete`)
        .set('Authorization', `Bearer ${dUid}:${dEmail}`)
        .send({ paymentApproved: false });

      expect(compRes.status).toBe(200);
      expect(compRes.body.data.ride.status).toBe('COMPLETED');
      expect(compRes.body.data.ride.paymentStatus).toBe('PENDING');
      expect(compRes.body.data.ride.paymentApprovedByDriver).toBe(false);
    });

    it('passenger is blocked from requesting new ride while previous payment is unapproved', async () => {
      const blockRes = await request(app)
        .post('/api/v1/rides/request')
        .set('Authorization', `Bearer ${pUid}:${pEmail}`)
        .send({
          origin: { address: 'Boiçucanga, São Sebastião', lat: -23.7788, lng: -45.6123 },
          destination: { address: 'Cambury, São Sebastião', lat: -23.7654, lng: -45.6412 },
          paymentMethod: 'CASH',
        });

      expect(blockRes.status).toBe(403);
      expect(blockRes.body.error.message).toContain('pagamento pendente de confirmação');
    });

    it('driver approves payment, releasing passenger and generating receipt', async () => {
      const appRes = await request(app)
        .post(`/api/v1/rides/${rideId}/approve-payment`)
        .set('Authorization', `Bearer ${dUid}:${dEmail}`);

      expect(appRes.status).toBe(200);
      expect(appRes.body.data.ride.paymentStatus).toBe('PAID');
      expect(appRes.body.data.ride.paymentApprovedByDriver).toBe(true);
      expect(appRes.body.data.receipt).toBeDefined();
      expect(appRes.body.data.receipt.paymentStatus).toBe('PAID');
    });

    it('re-approving payment is idempotent and returns 200', async () => {
      const reAppRes = await request(app)
        .post(`/api/v1/drivers/rides/${rideId}/approve-payment`)
        .set('Authorization', `Bearer ${dUid}:${dEmail}`);

      expect(reAppRes.status).toBe(200);
      expect(reAppRes.body.data.ride.paymentStatus).toBe('PAID');
      expect(reAppRes.body.message).toContain('já confirmado anteriormente');
    });

    it('rejects payment approval from an unauthorized driver with 403', async () => {
      const otherUid = 'test-other-drv-' + Date.now();
      const otherEmail = `other.${Date.now()}@driver.vaicar.app`;
      await saveDriverProfile({
        uid: otherUid,
        name: 'Outro Motorista',
        email: otherEmail,
        whatsapp: '11999999999',
        status: 'APPROVED',
        isOnline: true,
      } as any);

      const unauthRes = await request(app)
        .post(`/api/v1/drivers/rides/${rideId}/approve-payment`)
        .set('Authorization', `Bearer ${otherUid}:${otherEmail}`);

      expect(unauthRes.status).toBe(403);
      expect(unauthRes.body.error.message).toContain('Apenas o motorista responsável pode aprovar o pagamento');
    });

    it('passenger can now request new rides successfully after driver approval', async () => {
      const newRideRes = await request(app)
        .post('/api/v1/rides/request')
        .set('Authorization', `Bearer ${pUid}:${pEmail}`)
        .send({
          origin: { address: 'Boiçucanga, São Sebastião', lat: -23.7788, lng: -45.6123 },
          destination: { address: 'Cambury, São Sebastião', lat: -23.7654, lng: -45.6412 },
          paymentMethod: 'CASH',
        });

      expect(newRideRes.status).toBe(201);
      expect(newRideRes.body.data.status).toBe('REQUESTED');
      expect(newRideRes.body.data.passengerId).toBe(pUid);

      if (newRideRes.body?.data?.id) {
        await request(app)
          .post(`/api/v1/rides/${newRideRes.body.data.id}/cancel`)
          .set('Authorization', `Bearer ${pUid}:${pEmail}`)
          .send({ reason: 'PASSENGER_CANCELLED' });
      }
    });
  });

  describe('Driver Profile Resolution & Auto-Healing', () => {
    const driverEmail = `heal.driver.${Date.now()}@teste.vaicar.app`;
    const origUid = `orig-driver-${Date.now()}`;
    const newAuthUid = `auth-driver-${Date.now()}`;

    it('registers driver under origUid and approves via admin', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register-driver')
        .send({
          uid: origUid,
          name: 'Renato Motorista Real',
          cpf: '12345678909',
          birthDate: '1985-05-15',
          whatsapp: '(12) 99876-5432',
          email: driverEmail,
          photoUrl: 'https://storage.googleapis.com/vaicar/users/orig-driver/photo.jpg',
          professionalCategory: 'Motorista com EAR / Autônomo',
          cnhNumber: '12345678901',
          vehicle: { brand: 'Fiat', model: 'Argo', year: 2023, color: 'Branco', plate: 'BRA2E19' },
          operatingZones: ['Centro & Porto Grande'],
        });

      expect(regRes.status).toBe(201);

      // Approve via admin
      const approveRes = await request(app)
        .post(`/api/v1/admin/drivers/${origUid}/approve`)
        .set('Authorization', 'Bearer test-admin-01:admin@vaicar.app');

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('APPROVED');
    });

    it('resolves and auto-heals driver profile when logged in with a different UID having same email', async () => {
      // Driver logs in on a new device or Firebase Auth issues newAuthUid
      const meRes = await request(app)
        .get('/api/v1/drivers/me')
        .set('Authorization', `Bearer ${newAuthUid}:${driverEmail}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.name).toBe('Renato Motorista Real');
      expect(meRes.body.data.vehicle.brand).toBe('Fiat');
      expect(meRes.body.data.vehicle.model).toBe('Argo');
      expect(meRes.body.data.status).toBe('APPROVED');
    });

    it('allows driver to toggle online without "Perfil não encontrado" error', async () => {
      const toggleRes = await request(app)
        .post('/api/v1/drivers/toggle-online')
        .set('Authorization', `Bearer ${newAuthUid}:${driverEmail}`)
        .send({ isOnline: true });

      expect(toggleRes.status).toBe(200);
      expect(toggleRes.body.data.isOnline).toBe(true);
      expect(toggleRes.body.data.status).toBe('APPROVED');
    });
  });

  describe('Driver Controlled Pricing & Passenger Price Comparison', () => {
    const driverUid = `pricing-driver-${Date.now()}`;
    const driverEmail = `pricing.driver.${Date.now()}@teste.vaicar.app`;
    const driverToken = `${driverUid}:${driverEmail}`;

    const passUid = `pricing-pass-${Date.now()}`;
    const passEmail = `pricing.pass.${Date.now()}@teste.vaicar.app`;
    const passToken = `${passUid}:${passEmail}`;

    it('registers driver and passenger for pricing tests', async () => {
      // Register passenger
      const passRes = await request(app)
        .post('/api/v1/auth/register-passenger')
        .send({
          uid: passUid,
          name: 'Passageiro Comparador',
          email: passEmail,
          whatsapp: '(12) 99999-0099',
          photoUrl: 'https://storage.googleapis.com/vaicar/photo.jpg',
          termsAccepted: true,
        });
      expect(passRes.status).toBe(201);

      // Register driver
      const drvRes = await request(app)
        .post('/api/v1/auth/register-driver')
        .send({
          uid: driverUid,
          name: 'Carlos Motorista Empreendedor',
          cpf: '85384620080',
          birthDate: '1988-06-15',
          email: driverEmail,
          whatsapp: '(12) 98888-7766',
          photoUrl: 'https://storage.googleapis.com/vaicar/users/carlos.jpg',
          professionalCategory: 'Motorista de Aplicativo / EAR',
          cnhNumber: '99887766554',
          vehicle: { brand: 'Toyota', model: 'Corolla', year: 2022, color: 'Prata', plate: 'CAR2A22' },
          operatingZones: ['Centro', 'Maresias'],
        });
      expect(drvRes.status).toBe(201);

      // Approve driver
      await request(app)
        .post(`/api/v1/admin/drivers/${driverUid}/approve`)
        .set('Authorization', 'Bearer test-admin-01:admin@vaicar.app');

      // Set online and send location
      const onlineRes = await request(app)
        .post('/api/v1/drivers/toggle-online')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ isOnline: true });
      expect(onlineRes.status).toBe(200);

      await request(app)
        .post('/api/v1/drivers/location')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ lat: -23.8055, lng: -45.4011 });
    });

    it('rejects custom pricing below platform floor', async () => {
      // Try minimumFare below platform floor (R$ 10)
      const res1 = await request(app)
        .put('/api/v1/drivers/pricing')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          minimumFare: 5.00,
          perKmRate: 5.00,
        });
      expect(res1.status).toBe(400);
      expect(res1.body.error.message).toContain('piso da plataforma');

      // Try perKmRate below platform floor
      const res2 = await request(app)
        .put('/api/v1/drivers/pricing')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          minimumFare: 15.00,
          perKmRate: 2.00,
        });
      expect(res2.status).toBe(400);
      expect(res2.body.error.message).toContain('piso da plataforma');
    });

    it('successfully configures driver custom pricing and fixed route', async () => {
      const res = await request(app)
        .put('/api/v1/drivers/pricing')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          minimumFare: 20.00,
          perKmRate: 5.00,
          perMinuteRate: 0.50,
          allowFixedRoutes: true,
          fixedRoutes: [
            {
              name: 'Centro → Maresias',
              originZone: 'Centro',
              destinationZone: 'Maresias',
              price: 80.00,
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customPricing.minimumFare).toBe(20.00);
      expect(res.body.data.customPricing.perKmRate).toBe(5.00);
      expect(res.body.data.customPricing.fixedRoutes).toHaveLength(1);
    });

    it('passenger estimates ride and sees driver with fixed route pricing of R$ 80', async () => {
      const res = await request(app)
        .post('/api/v1/rides/estimate')
        .set('Authorization', `Bearer ${passToken}`)
        .send({
          origin: { address: 'Centro Histórico, São Sebastião - SP', lat: -23.8055, lng: -45.4011 },
          destination: { address: 'Praia de Maresias, São Sebastião - SP', lat: -23.7915, lng: -45.5683 },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.availableDrivers).toBeDefined();

      const carlos = res.body.data.availableDrivers.find((d: any) => d.driverId === driverUid);
      expect(carlos).toBeDefined();
      expect(carlos.isFixedRoute).toBe(true);
      expect(carlos.fixedRouteName).toBe('Centro → Maresias');
      expect(carlos.fareAmount).toBe(80.00);
    });

    it('passenger requests ride locking in chosen driver and custom fare', async () => {
      const res = await request(app)
        .post('/api/v1/rides/request')
        .set('Authorization', `Bearer ${passToken}`)
        .send({
          origin: { address: 'Centro Histórico, São Sebastião', lat: -23.8055, lng: -45.4011 },
          destination: { address: 'Praia de Maresias, São Sebastião', lat: -23.7915, lng: -45.5683 },
          paymentMethod: 'PIX',
          requestedDriverId: driverUid,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.fareAmount).toBe(80.00);
      expect(res.body.data.fixedRouteApplied).toBe(true);
      expect(res.body.data.fixedRouteName).toBe('Centro → Maresias');
      expect(res.body.data.driverId).toBe(driverUid);
      expect(res.body.data.driverName).toBe('Carlos Motorista Empreendedor');
      expect(res.body.data.status).toBe('REQUESTED');
    });

    it('allows driver to receive incoming ride in REQUESTED status and decline to release to pool', async () => {
      // 0. Cancel previous ride so passenger is free
      const activeRes = await request(app)
        .get('/api/v1/passengers/active-ride')
        .set('Authorization', `Bearer ${passToken}`);
      if (activeRes.body.data) {
        await request(app)
          .post(`/api/v1/rides/${activeRes.body.data.id}/cancel`)
          .set('Authorization', `Bearer ${passToken}`)
          .send({ reason: 'Teste concluído' });
      }

      // 1. Create a ride requested for driverUid
      const rideRes = await request(app)
        .post('/api/v1/rides/request')
        .set('Authorization', `Bearer ${passToken}`)
        .send({
          origin: { address: 'Centro, Caraguatatuba - SP', lat: -23.6229, lng: -45.4124 },
          destination: { address: 'Centro, São Sebastião - SP', lat: -23.8055, lng: -45.4011 },
          paymentMethod: 'PIX',
          requestedDriverId: driverUid,
        });

      expect(rideRes.status).toBe(201);
      const rideId = rideRes.body.data.id;
      expect(rideRes.body.data.status).toBe('REQUESTED');

      // 2. Driver polls available-rides and receives the incoming ride
      const availableRes = await request(app)
        .get('/api/v1/drivers/available-rides')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(availableRes.status).toBe(200);
      const incoming = availableRes.body.data.find((r: any) => r.id === rideId);
      expect(incoming).toBeDefined();
      expect(incoming.status).toBe('REQUESTED');

      // 3. Driver declines the ride
      const declineRes = await request(app)
        .post(`/api/v1/rides/${rideId}/decline`)
        .set('Authorization', `Bearer ${driverToken}`);

      expect(declineRes.status).toBe(200);
      expect(declineRes.body.data.driverId).toBeUndefined();

      // 4. Ride is still in REQUESTED status, but now open in the general pool
      const openRideRes = await request(app)
        .get(`/api/v1/rides/${rideId}`)
        .set('Authorization', `Bearer ${passToken}`);

      expect(openRideRes.status).toBe(200);
      expect(openRideRes.body.data.status).toBe('REQUESTED');
      expect(openRideRes.body.data.driverId).toBeUndefined();

      if (rideId) {
        await request(app)
          .post(`/api/v1/rides/${rideId}/cancel`)
          .set('Authorization', `Bearer ${passToken}`)
          .send({ reason: 'PASSENGER_CANCELLED' });
      }
    });
  });

  describe('Maps Open Search for Any Brazilian City', () => {
    it('allows autocomplete for any city in Brazil without forcing Sao Sebastiao', async () => {
      const res = await request(app)
        .post('/api/v1/maps/autocomplete')
        .send({ input: 'Caraguatatuba' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      // Ensure description does NOT forcefully append ", São Sebastião - SP" to Caraguatatuba
      const match = res.body.data[0];
      expect(match.description).not.toContain('Caraguatatuba, São Sebastião');
    });

    it('geocodes addresses across neighboring cities without forcing Sao Sebastiao', async () => {
      const res = await request(app)
        .post('/api/v1/maps/geocode')
        .send({ address: 'Praia Martim de Sa, Caraguatatuba, SP' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.lat).toBeDefined();
      expect(res.body.data.lng).toBeDefined();
      expect(res.body.data.address).not.toContain('São Sebastião');
    });
  });

  describe('Ride Cancellation Policy: Emergency Only Once IN_PROGRESS', () => {
    let testRideId = '';

    beforeAll(async () => {
      // Ensure test driver is approved, online, and positioned near pickup in Centro
      let drv = await getDriverProfile('test-driv-01');
      if (!drv) {
        drv = {
          uid: 'test-driv-01',
          name: 'Carlos Santos',
          cpf: '52998224725',
          email: 'motorista@teste.vaicar.app',
          whatsapp: '(12) 99777-6655',
          status: 'APPROVED',
          isOnline: true,
          isCourier: false,
          servicesOffered: ['ride'],
          vehicle: { brand: 'Chevrolet', model: 'Onix Plus', year: 2023, color: 'Branco', plate: 'BRA2E19', type: 'car' },
          currentLocation: { lat: -23.8055, lng: -45.4011, updatedAt: new Date().toISOString() },
        } as any;
      } else {
        drv = {
          ...drv,
          status: 'APPROVED',
          isOnline: true,
          vehicle: drv.vehicle ? { ...drv.vehicle, type: 'car', plate: drv.vehicle.plate || 'BRA2E19' } : { brand: 'Chevrolet', model: 'Onix Plus', year: 2023, color: 'Branco', plate: 'BRA2E19', type: 'car' },
          currentLocation: { lat: -23.8055, lng: -45.4011, updatedAt: new Date().toISOString() },
        };
      }
      await saveDriverProfile(drv);
      const danglingOffer = await getActivePendingOfferForDriver('test-driv-01');
      if (danglingOffer) {
        const offer = await getRideOffer(danglingOffer.id);
        if (offer) {
          await saveRideOffer({ ...offer, status: 'EXPIRED' });
        }
      }
    });

    it('allows passenger or driver to cancel before IN_PROGRESS (e.g. in REQUESTED)', async () => {
      const rideRes = await request(app)
        .post('/api/v1/rides/request')
        .set('Authorization', `Bearer ${passengerToken}`)
        .send({
          origin: { address: 'Centro, São Sebastião - SP', lat: -23.8055, lng: -45.4011 },
          destination: { address: 'Maresias, São Sebastião - SP', lat: -23.7915, lng: -45.5683 },
          paymentMethod: 'PIX',
        });
      expect(rideRes.status).toBe(201);
      const rideId = rideRes.body.data.id;

      const cancelRes = await request(app)
        .post(`/api/v1/rides/${rideId}/cancel`)
        .set('Authorization', `Bearer ${passengerToken}`)
        .send({ reason: 'Mudei de ideia' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('CANCELLED_BY_PASSENGER');
      expect(cancelRes.body.data.cancelReason).toBe('Mudei de ideia');
    });

    it('blocks normal cancellation once ride transitions to IN_PROGRESS', async () => {
      const rideRes = await request(app)
        .post('/api/v1/rides/request')
        .set('Authorization', `Bearer ${passengerToken}`)
        .send({
          origin: { address: 'Centro, São Sebastião - SP', lat: -23.8055, lng: -45.4011 },
          destination: { address: 'Maresias, São Sebastião - SP', lat: -23.7915, lng: -45.5683 },
          paymentMethod: 'PIX',
        });
      testRideId = rideRes.body.data.id;

      await request(app)
        .post(`/api/v1/rides/${testRideId}/accept`)
        .set('Authorization', `Bearer ${driverToken}`);

      await request(app)
        .post(`/api/v1/rides/${testRideId}/arrived`)
        .set('Authorization', `Bearer ${driverToken}`);

      const startRes = await request(app)
        .post(`/api/v1/rides/${testRideId}/start`)
        .set('Authorization', `Bearer ${driverToken}`);
      expect(startRes.body.data.status).toBe('IN_PROGRESS');

      const passCancelRes = await request(app)
        .post(`/api/v1/rides/${testRideId}/cancel`)
        .set('Authorization', `Bearer ${passengerToken}`)
        .send({ reason: 'Não quero mais a corrida' });

      expect(passCancelRes.status).toBe(400);
      expect(passCancelRes.body.error.message).toContain('A corrida já está em andamento');

      const drivCancelRes = await request(app)
        .post(`/api/v1/rides/${testRideId}/cancel`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ reason: 'Quero desistir da viagem' });

      expect(drivCancelRes.status).toBe(400);
      expect(drivCancelRes.body.error.message).toContain('A corrida já está em andamento');
    });

    it('rejects emergency cancellation if emergency reason is missing or empty', async () => {
      const res = await request(app)
        .post(`/api/v1/rides/${testRideId}/cancel`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ isEmergency: true, reason: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('é obrigatório informar o motivo detalhado');
    });

    it('successfully processes emergency cancellation with isEmergency: true and valid reason', async () => {
      const res = await request(app)
        .post(`/api/v1/rides/${testRideId}/cancel`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          isEmergency: true,
          reason: 'Pane mecânica: Pneu furado e defeito elétrico na rodovia',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED_BY_DRIVER');
      expect(res.body.data.cancelReason).toContain('[EMERGÊNCIA]');
      expect(res.body.data.cancelReason).toContain('Pneu furado');
      expect(res.body.data.isEmergencyCancellation).toBe(true);
    });
  });

  describe('Phase 1 — Stage 1: Data Model, Service Types (Ride vs Delivery), and Delivery Pricing', () => {
    const stage1CourierUid = `courier-stg1-${Date.now()}`;
    const stage1CourierEmail = `courier.stg1.${Date.now()}@teste.vaicar.app`;
    const stage1CourierToken = `${stage1CourierUid}:${stage1CourierEmail}`;

    const stage1BikeUid = `bike-stg1-${Date.now()}`;
    const stage1BikeEmail = `bike.stg1.${Date.now()}@teste.vaicar.app`;
    const stage1BikeToken = `${stage1BikeUid}:${stage1BikeEmail}`;

    const stage1PassUid = `pass-stg1-${Date.now()}`;
    const stage1PassEmail = `pass.stg1.${Date.now()}@teste.vaicar.app`;
    const stage1PassToken = `${stage1PassUid}:${stage1PassEmail}`;

    it('registers passenger and drivers with different vehicle types and plans', async () => {
      // 1. Register passenger
      const pRes = await request(app)
        .post('/api/v1/auth/register-passenger')
        .send({
          uid: stage1PassUid,
          name: 'Cliente Entrega',
          whatsapp: '(12) 99333-1122',
          email: stage1PassEmail,
          photoUrl: 'https://storage.googleapis.com/vaicar-bucket/users/photo.jpg',
          termsAccepted: true,
        });
      expect(pRes.status).toBe(201);

      // 2. Register motorcycle courier with monthly_100 plan
      const dRes = await request(app)
        .post('/api/v1/auth/register-driver')
        .send({
          uid: stage1CourierUid,
          name: 'Entregador Moto',
          cpf: generateValidTestCpf(),
          birthDate: '1992-05-10',
          whatsapp: '(12) 99444-2233',
          email: stage1CourierEmail,
          photoUrl: 'https://storage.googleapis.com/vaicar-bucket/users/courier.jpg',
          professionalCategory: 'Entregador / Motoboy (Delivery e Encomendas)',
          cnhNumber: '99887766554',
          subscriptionPlan: 'monthly_100',
          servicesOffered: ['ride', 'delivery'],
          vehicle: {
            type: 'motorcycle',
            brand: 'Honda',
            model: 'CG 160',
            year: 2023,
            color: 'Preto',
            plate: 'MOT1D23',
          },
          operatingZones: ['Centro', 'Maresias'],
        });
      expect(dRes.status).toBe(201);
      expect(dRes.body.data.driver.subscriptionPlan).toBe('monthly_100');
      expect(dRes.body.data.driver.servicesOffered).toContain('delivery');

      // 3. Register bicycle courier
      const bRes = await request(app)
        .post('/api/v1/auth/register-driver')
        .send({
          uid: stage1BikeUid,
          name: 'Ciclista Entregador',
          cpf: generateValidTestCpf(),
          birthDate: '1998-08-20',
          whatsapp: '(12) 99555-3344',
          email: stage1BikeEmail,
          photoUrl: 'https://storage.googleapis.com/vaicar-bucket/users/bike.jpg',
          professionalCategory: 'Entregador / Ciclista (Bike e Encomendas)',
          cnhNumber: 'ISENTO_BIKE',
          subscriptionPlan: 'monthly_100',
          servicesOffered: ['delivery'],
          vehicle: {
            type: 'bicycle',
            brand: 'Caloi',
            model: 'Aro 29',
            year: 2022,
            color: 'Azul',
            plate: 'BIKE',
          },
          operatingZones: ['Centro'],
        });
      expect(bRes.status).toBe(201);
      expect(bRes.body.data.driver.vehicle.type).toBe('bicycle');
      expect(bRes.body.data.driver.servicesOffered).toEqual(['delivery']);

      // Approve both drivers via admin
      await request(app)
        .post(`/api/v1/admin/drivers/${stage1CourierUid}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      await request(app)
        .post(`/api/v1/admin/drivers/${stage1BikeUid}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Set both online and send location
      await request(app)
        .post('/api/v1/drivers/toggle-online')
        .set('Authorization', `Bearer ${stage1CourierToken}`)
        .send({ isOnline: true });
      await request(app)
        .post('/api/v1/drivers/location')
        .set('Authorization', `Bearer ${stage1CourierToken}`)
        .send({ lat: -23.8055, lng: -45.4011 });

      await request(app)
        .post('/api/v1/drivers/toggle-online')
        .set('Authorization', `Bearer ${stage1BikeToken}`)
        .send({ isOnline: true });
      await request(app)
        .post('/api/v1/drivers/location')
        .set('Authorization', `Bearer ${stage1BikeToken}`)
        .send({ lat: -23.8060, lng: -45.4015 });
    });

    it('allows driver to configure custom delivery pricing and validates platform floor', async () => {
      // 1. Rejects delivery pricing below platform floor (R$ 10 min, R$ 2/km)
      const invalidRes = await request(app)
        .put('/api/v1/drivers/pricing')
        .set('Authorization', `Bearer ${stage1CourierToken}`)
        .send({
          customDeliveryPricing: {
            minimumDeliveryFee: 5.0, // Platform floor is 10.0
            perKmRate: 1.0,          // Platform floor is 2.0
            waitingPerMinuteRate: 0.2,
          },
        });
      expect(invalidRes.status).toBe(400);
      expect(invalidRes.body.error.message).toContain('piso da plataforma');

      // 2. Successfully updates valid custom delivery pricing
      const validRes = await request(app)
        .put('/api/v1/drivers/pricing')
        .set('Authorization', `Bearer ${stage1CourierToken}`)
        .send({
          customDeliveryPricing: {
            minimumDeliveryFee: 15.0,
            perKmRate: 3.5,
            waitingPerMinuteRate: 0.8,
          },
          servicesOffered: ['ride', 'delivery'],
        });
      expect(validRes.status).toBe(200);
      expect(validRes.body.data.customDeliveryPricing.minimumDeliveryFee).toBe(15.0);
      expect(validRes.body.data.customDeliveryPricing.perKmRate).toBe(3.5);
      expect(validRes.body.data.servicesOffered).toContain('delivery');

      // 3. GET /pricing returns delivery pricing and floor
      const getRes = await request(app)
        .get('/api/v1/drivers/pricing')
        .set('Authorization', `Bearer ${stage1CourierToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.customDeliveryPricing.minimumDeliveryFee).toBe(15.0);
      expect(getRes.body.data.deliveryPlatformFloor.minimumDeliveryFee).toBe(10.0);
      expect(getRes.body.data.deliveryPlatformFloor.perKmRate).toBe(2.0);
    });

    it('blocks bicycle couriers from offering passenger rides', async () => {
      const res = await request(app)
        .put('/api/v1/drivers/pricing')
        .set('Authorization', `Bearer ${stage1BikeToken}`)
        .send({
          servicesOffered: ['ride', 'delivery'],
        });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Condutores com bicicleta só podem prestar serviços de entrega');
    });

    it('filters available drivers correctly between serviceType: delivery and serviceType: ride', async () => {
      const origin = { address: 'Centro, São Sebastião - SP', lat: -23.8055, lng: -45.4011 };
      const destination = { address: 'Maresias, São Sebastião - SP', lat: -23.7915, lng: -45.5683 };

      // 1. Estimate for delivery: Both courier and bike courier should be eligible
      const delivRes = await request(app)
        .post('/api/v1/rides/estimate')
        .set('Authorization', `Bearer ${stage1PassToken}`)
        .send({
          origin,
          destination,
          serviceType: 'delivery',
        });
      expect(delivRes.status).toBe(200);
      expect(delivRes.body.data.serviceType).toBe('delivery');
      const delivDrivers = delivRes.body.data.availableDrivers;
      const driverUids = delivDrivers.map((d: any) => d.driverId);
      expect(driverUids).toContain(stage1CourierUid);
      expect(driverUids).toContain(stage1BikeUid);

      // Verify courier custom delivery pricing was applied: minFee 15 + (dist * 3.5)
      const courierOption = delivDrivers.find((d: any) => d.driverId === stage1CourierUid);
      expect(courierOption.customDeliveryPricing.minimumDeliveryFee).toBe(15.0);
      expect(courierOption.customDeliveryPricing.perKmRate).toBe(3.5);
      expect(courierOption.fareAmount).toBeGreaterThan(15.0);

      // 2. Estimate for passenger ride: Bicycle MUST be excluded from rides
      const rideRes = await request(app)
        .post('/api/v1/rides/estimate')
        .set('Authorization', `Bearer ${stage1PassToken}`)
        .send({
          origin,
          destination,
          serviceType: 'ride',
        });
      expect(rideRes.status).toBe(200);
      expect(rideRes.body.data.serviceType).toBe('ride');
      const rideDrivers = rideRes.body.data.availableDrivers;
      const rideDriverUids = rideDrivers.map((d: any) => d.driverId);
      expect(rideDriverUids).not.toContain(stage1BikeUid); // Bicycle excluded!
    });

    it('creates a delivery with serviceType: delivery and deliveryDetails (backward-compatible)', async () => {
      const origin = { address: 'Rua da Coleta 100, Centro', lat: -23.8055, lng: -45.4011 };
      const destination = { address: 'Av. da Entrega 500, Maresias', lat: -23.7915, lng: -45.5683 };

      const reqRes = await request(app)
        .post('/api/v1/rides/request')
        .set('Authorization', `Bearer ${stage1PassToken}`)
        .send({
          origin,
          destination,
          paymentMethod: 'PIX',
          requestedDriverId: stage1CourierUid,
          serviceType: 'delivery',
          deliveryDetails: {
            recipientName: 'Carlos Destinatário',
            recipientPhone: '(12) 98888-7777',
            packageNotes: 'Documentos lacrados em envelope pardo',
          },
        });

      expect(reqRes.status).toBe(201);
      expect(reqRes.body.data.serviceType).toBe('delivery');
      expect(reqRes.body.data.deliveryDetails).toBeDefined();
      expect(reqRes.body.data.deliveryDetails.recipientName).toBe('Carlos Destinatário');
      expect(reqRes.body.data.deliveryDetails.recipientPhone).toBe('(12) 98888-7777');
      expect(reqRes.body.data.deliveryDetails.packageNotes).toBe('Documentos lacrados em envelope pardo');

      // Courier can accept and progress the delivery through standard states
      const acceptRes = await request(app)
        .post(`/api/v1/rides/${reqRes.body.data.id}/accept`)
        .set('Authorization', `Bearer ${stage1CourierToken}`);
      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.data.status).toBe('DRIVER_ARRIVING');
      expect(acceptRes.body.data.serviceType).toBe('delivery');

      // Arrived at pickup
      const arrivedRes = await request(app)
        .post(`/api/v1/rides/${reqRes.body.data.id}/arrived`)
        .set('Authorization', `Bearer ${stage1CourierToken}`);
      expect(arrivedRes.status).toBe(200);
      expect(arrivedRes.body.data.status).toBe('ARRIVED');

      // Picked up / start delivery in progress
      const startRes = await request(app)
        .post(`/api/v1/rides/${reqRes.body.data.id}/start`)
        .set('Authorization', `Bearer ${stage1CourierToken}`);
      expect(startRes.status).toBe(200);
      expect(startRes.body.data.status).toBe('IN_PROGRESS');

      // Completed / delivered
      const completeRes = await request(app)
        .post(`/api/v1/rides/${reqRes.body.data.id}/complete`)
        .set('Authorization', `Bearer ${stage1CourierToken}`)
        .send({ paymentApproved: true });
      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.ride.status).toBe('COMPLETED');
      expect(completeRes.body.data.ride.serviceType).toBe('delivery');
    });

    it('defaults serviceType to ride when omitted to guarantee 100% backward compatibility', async () => {
      const origin = { address: 'Rua Teste 1, Centro', lat: -23.8055, lng: -45.4011 };
      const destination = { address: 'Rua Teste 2, Maresias', lat: -23.7915, lng: -45.5683 };

      const legacyReq = await request(app)
        .post('/api/v1/rides/request')
        .set('Authorization', `Bearer ${stage1PassToken}`)
        .send({
          origin,
          destination,
          paymentMethod: 'CASH',
        });

      expect(legacyReq.status).toBe(201);
      expect(legacyReq.body.data.serviceType).toBe('ride');
      expect(legacyReq.body.data.deliveryDetails).toBeUndefined();
    });
  });

  describe('Phase 1 — Stage 2: Passenger / Customer Delivery Interface & End-to-End Flow', () => {
    const stage2PassUid = `pass-stg2-${Date.now()}`;
    const stage2PassEmail = `pass.stg2.${Date.now()}@teste.vaicar.app`;
    const stage2PassToken = `${stage2PassUid}:${stage2PassEmail}`;

    const stage2BikeUid = `bike-stg2-${Date.now()}`;
    const stage2BikeEmail = `bike.stg2.${Date.now()}@teste.vaicar.app`;
    const stage2BikeToken = `${stage2BikeUid}:${stage2BikeEmail}`;

    beforeAll(async () => {
      // 1. Passenger registration
      const passRes = await request(app)
        .post('/api/v1/auth/register-passenger')
        .send({
          uid: stage2PassUid,
          name: 'Cliente Entrega VaiCar',
          whatsapp: '(12) 99111-2222',
          email: stage2PassEmail,
          photoUrl: 'https://storage.googleapis.com/vaicar-bucket/users/photo2.jpg',
          termsAccepted: true,
        });
      expect(passRes.status).toBe(201);

      // 2. Bicycle courier registration
      const bikeRes = await request(app)
        .post('/api/v1/auth/register-driver')
        .send({
          uid: stage2BikeUid,
          name: 'Entregador Ciclista Stg2',
          cpf: generateValidTestCpf(),
          birthDate: '1995-05-15',
          whatsapp: '(12) 99333-4444',
          email: stage2BikeEmail,
          photoUrl: 'https://storage.googleapis.com/vaicar-bucket/users/bike2.jpg',
          professionalCategory: 'Entregador / Ciclista (Bike e Encomendas)',
          cnhNumber: 'ISENTO_BIKE_STG2',
          subscriptionPlan: 'monthly_100',
          servicesOffered: ['delivery'],
          vehicle: {
            brand: 'Caloi',
            model: 'Bicicleta Cargueira',
            color: 'Preta',
            year: 2023,
            plate: '',
            type: 'bicycle',
          },
          operatingZones: ['Centro', 'Maresias'],
        });
      expect(bikeRes.status).toBe(201);

      // 3. Admin approval
      await request(app)
        .post(`/api/v1/admin/drivers/${stage2BikeUid}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      // 4. Set bike online and configure delivery pricing
      await request(app)
        .post('/api/v1/drivers/toggle-online')
        .set('Authorization', `Bearer ${stage2BikeToken}`)
        .send({ isOnline: true });

      await request(app)
        .post('/api/v1/drivers/location')
        .set('Authorization', `Bearer ${stage2BikeToken}`)
        .send({ lat: -23.8055, lng: -45.4011 });

      await request(app)
        .put('/api/v1/drivers/pricing')
        .set('Authorization', `Bearer ${stage2BikeToken}`)
        .send({
          customDeliveryPricing: {
            minimumDeliveryFee: 12.0,
            perKmRate: 2.5,
          },
        });
    });

    it('returns delivery estimate and active delivery status to passenger', async () => {
      const origin = { address: 'Rua do Comércio 20, Centro, São Sebastião - SP', lat: -23.8055, lng: -45.4011 };
      const destination = { address: 'Av. Dr. Francisco Loup 1500, Maresias, São Sebastião - SP', lat: -23.7915, lng: -45.5683 };

      // 1. Estimate for delivery
      const estRes = await request(app)
        .post('/api/v1/rides/estimate')
        .set('Authorization', `Bearer ${stage2PassToken}`)
        .send({
          origin,
          destination,
          serviceType: 'delivery',
        });
      expect(estRes.status).toBe(200);
      expect(estRes.body.data.serviceType).toBe('delivery');
      expect(estRes.body.data.availableDrivers.length).toBeGreaterThan(0);

      const bikePartner = estRes.body.data.availableDrivers.find((d: any) => d.driverId === stage2BikeUid);
      expect(bikePartner).toBeDefined();
      expect(bikePartner.vehicle.type).toBe('bicycle');

      // 2. Request delivery with recipient details & direct PIX payment
      const reqRes = await request(app)
        .post('/api/v1/rides/request')
        .set('Authorization', `Bearer ${stage2PassToken}`)
        .send({
          origin,
          destination,
          paymentMethod: 'PIX',
          requestedDriverId: stage2BikeUid,
          serviceType: 'delivery',
          deliveryDetails: {
            recipientName: 'Mariana Costa (Recebedora)',
            recipientPhone: '(12) 99888-1122',
            packageNotes: 'Caixa de remédios lacrada da farmácia',
          },
        });
      expect(reqRes.status).toBe(201);
      const deliveryRide = reqRes.body.data;
      expect(deliveryRide.serviceType).toBe('delivery');
      expect(deliveryRide.deliveryDetails.recipientName).toBe('Mariana Costa (Recebedora)');
      expect(deliveryRide.deliveryDetails.recipientPhone).toBe('(12) 99888-1122');
      expect(deliveryRide.deliveryDetails.packageNotes).toBe('Caixa de remédios lacrada da farmácia');

      // 3. Passenger verifies active ride via GET /passengers/active-ride
      const activeRes = await request(app)
        .get('/api/v1/passengers/active-ride')
        .set('Authorization', `Bearer ${stage2PassToken}`);
      expect(activeRes.status).toBe(200);
      expect(activeRes.body.data).not.toBeNull();
      expect(activeRes.body.data.id).toBe(deliveryRide.id);
      expect(activeRes.body.data.serviceType).toBe('delivery');
      expect(activeRes.body.data.deliveryDetails.recipientName).toBe('Mariana Costa (Recebedora)');

      // 4. Bike courier accepts the delivery
      const acceptRes = await request(app)
        .post(`/api/v1/rides/${deliveryRide.id}/accept`)
        .set('Authorization', `Bearer ${stage2BikeToken}`);
      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.data.status).toBe('DRIVER_ARRIVING');

      // 5. Arrived at pickup
      await request(app)
        .post(`/api/v1/rides/${deliveryRide.id}/arrived`)
        .set('Authorization', `Bearer ${stage2BikeToken}`);

      // 6. Collected package & in progress
      await request(app)
        .post(`/api/v1/rides/${deliveryRide.id}/start`)
        .set('Authorization', `Bearer ${stage2BikeToken}`);

      // 7. Normal passenger cancellation is blocked during transit
      const cancelAttempt = await request(app)
        .post(`/api/v1/rides/${deliveryRide.id}/cancel`)
        .set('Authorization', `Bearer ${stage2PassToken}`)
        .send({ reason: 'Desisti do envio' });
      expect(cancelAttempt.status).toBe(400);

      // 8. Completed delivery with direct payment approval
      const completeRes = await request(app)
        .post(`/api/v1/rides/${deliveryRide.id}/complete`)
        .set('Authorization', `Bearer ${stage2BikeToken}`)
        .send({ paymentApproved: true });
      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.ride.status).toBe('COMPLETED');
      expect(completeRes.body.data.ride.serviceType).toBe('delivery');
      expect(completeRes.body.data.ride.paymentApprovedByDriver).toBe(true);
    });
  });

  describe('Phase 1 — Stage 3: Driver / Delivery Partner Interface & End-to-End Workflow', () => {
    const timestamp = Date.now();
    let stage3PassToken: string;
    let stage3PassUid: string;
    let stage3CarDriverToken: string;
    let stage3CarDriverUid: string;
    let stage3BikeDriverToken: string;
    let stage3BikeDriverUid: string;

    it('registers passenger, car partner (ride + delivery), and bicycle courier (enforced delivery only)', async () => {
      // 1. Passenger
      stage3PassUid = `pass-stg3-${timestamp}`;
      const stage3PassEmail = `pass.stg3.${timestamp}@teste.vaicar.app`;
      stage3PassToken = `${stage3PassUid}:${stage3PassEmail}`;
      await request(app)
        .post('/api/v1/auth/register-passenger')
        .send({
          uid: stage3PassUid,
          name: 'Cliente Etapa 3',
          cpf: generateValidTestCpf(),
          birthDate: '1990-05-10',
          whatsapp: '+55 12 99123-3333',
          email: stage3PassEmail,
          photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          termsAccepted: true,
        });

      // 2. Car Driver offering both ride and delivery
      stage3CarDriverUid = `driver-car-stg3-${timestamp}`;
      const stage3CarDriverEmail = `cardriver.stg3.${timestamp}@teste.vaicar.app`;
      stage3CarDriverToken = `${stage3CarDriverUid}:${stage3CarDriverEmail}`;
      const carReg = await request(app)
        .post('/api/v1/auth/register-driver')
        .send({
          uid: stage3CarDriverUid,
          name: 'Motorista Multi-Serviço',
          cpf: generateValidTestCpf(),
          birthDate: '1988-02-14',
          whatsapp: '+55 12 99444-5555',
          email: stage3CarDriverEmail,
          photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          professionalCategory: 'Motorista Autônomo e Entregador',
          cnhNumber: '12345678901',
          criminalRecordUrl: 'https://storage.vaicar.app/drivers/records.pdf',
          subscriptionPlan: 'monthly_100',
          servicesOffered: ['ride', 'delivery'],
          vehicle: {
            type: 'car',
            brand: 'Toyota',
            model: 'Corolla',
            year: 2022,
            color: 'Prata',
            plate: 'VAI3C33',
          },
          operatingZones: ['Centro & Porto Grande'],
        });
      expect(carReg.status).toBe(201);
      expect(carReg.body.data.driver.servicesOffered).toEqual(expect.arrayContaining(['ride', 'delivery']));

      // 3. Bicycle Courier attempting to select ride + delivery
      stage3BikeDriverUid = `driver-bike-stg3-${timestamp}`;
      const stage3BikeDriverEmail = `bike.stg3.${timestamp}@teste.vaicar.app`;
      stage3BikeDriverToken = `${stage3BikeDriverUid}:${stage3BikeDriverEmail}`;
      const bikeReg = await request(app)
        .post('/api/v1/auth/register-driver')
        .send({
          uid: stage3BikeDriverUid,
          name: 'Ciclista Entregador',
          cpf: generateValidTestCpf(),
          birthDate: '1995-09-20',
          whatsapp: '+55 12 99777-8888',
          email: stage3BikeDriverEmail,
          photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          professionalCategory: 'Entregador / Ciclista',
          cnhNumber: 'ISENTO_BIKE',
          criminalRecordUrl: 'https://storage.vaicar.app/drivers/records.pdf',
          subscriptionPlan: 'monthly_100',
          servicesOffered: ['ride', 'delivery'], // should be locked down to ['delivery']
          vehicle: {
            type: 'bicycle',
            brand: 'Caloi',
            model: 'Aro 29',
            year: 2023,
            color: 'Preta',
            plate: 'BIKE',
          },
          operatingZones: ['Centro & Porto Grande'],
        });
      expect(bikeReg.status).toBe(201);
      // Bicycle must be strictly delivery only
      expect(bikeReg.body.data.driver.servicesOffered).toEqual(['delivery']);

      // 4. Admin approves both
      await request(app)
        .post(`/api/v1/admin/drivers/${stage3CarDriverUid}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      await request(app)
        .post(`/api/v1/admin/drivers/${stage3BikeDriverUid}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      // 5. Both go online and set location
      await request(app)
        .post('/api/v1/drivers/toggle-online')
        .set('Authorization', `Bearer ${stage3CarDriverToken}`)
        .send({ isOnline: true });
      await request(app)
        .post('/api/v1/drivers/location')
        .set('Authorization', `Bearer ${stage3CarDriverToken}`)
        .send({ lat: -23.8055, lng: -45.4011 });

      await request(app)
        .post('/api/v1/drivers/toggle-online')
        .set('Authorization', `Bearer ${stage3BikeDriverToken}`)
        .send({ isOnline: true });
      await request(app)
        .post('/api/v1/drivers/location')
        .set('Authorization', `Bearer ${stage3BikeDriverToken}`)
        .send({ lat: -23.8060, lng: -45.4015 });
    });

    it('driver queries and updates pricing for delivery and ride services', async () => {
      // 1. Get initial pricing
      const getRes = await request(app)
        .get('/api/v1/drivers/pricing')
        .set('Authorization', `Bearer ${stage3CarDriverToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.deliveryPlatformFloor).toBeDefined();
      expect(getRes.body.data.deliveryPlatformFloor.minimumDeliveryFee).toBe(10.0);
      expect(getRes.body.data.deliveryPlatformFloor.perKmRate).toBe(2.0);

      // 2. Update with custom delivery and ride pricing
      const updateRes = await request(app)
        .put('/api/v1/drivers/pricing')
        .set('Authorization', `Bearer ${stage3CarDriverToken}`)
        .send({
          minimumFare: 22.0,
          perKmRate: 4.8,
          perMinuteRate: 0.6,
          customDeliveryPricing: {
            minimumDeliveryFee: 16.0,
            perKmRate: 3.2,
            waitingPerMinuteRate: 0.8,
          },
          servicesOffered: ['ride', 'delivery'],
        });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.customPricing.minimumFare).toBe(22.0);
      expect(updateRes.body.data.customPricing.perKmRate).toBe(4.8);
      expect(updateRes.body.data.customDeliveryPricing.minimumDeliveryFee).toBe(16.0);
      expect(updateRes.body.data.customDeliveryPricing.perKmRate).toBe(3.2);
      expect(updateRes.body.data.customDeliveryPricing.waitingPerMinuteRate).toBe(0.8);
      expect(updateRes.body.data.servicesOffered).toEqual(expect.arrayContaining(['ride', 'delivery']));

      // 3. Bicycle courier cannot add ride service
      const bikeUpdateFail = await request(app)
        .put('/api/v1/drivers/pricing')
        .set('Authorization', `Bearer ${stage3BikeDriverToken}`)
        .send({
          servicesOffered: ['ride', 'delivery'],
        });
      expect(bikeUpdateFail.status).toBe(400);
      expect(bikeUpdateFail.body.error.message).toContain('Condutores com bicicleta só podem prestar serviços de entrega');

      // 4. Updating delivery fee below platform floor is rejected
      const floorFail = await request(app)
        .put('/api/v1/drivers/pricing')
        .set('Authorization', `Bearer ${stage3CarDriverToken}`)
        .send({
          customDeliveryPricing: {
            minimumDeliveryFee: 5.0, // Floor is 10.0
            perKmRate: 2.5,
          },
        });
      expect(floorFail.status).toBe(400);
      expect(floorFail.body.error.message).toContain('piso da plataforma');
    });

    it('filters incoming available rides according to driver servicesOffered and vehicle rules', async () => {
      const origin = { address: 'Rua da Praia 10, Centro, São Sebastião - SP', lat: -23.8055, lng: -45.4011 };
      const destination = { address: 'Porto Grande 50, São Sebastião - SP', lat: -23.8010, lng: -45.3950 };

      // 1. Create a DELIVERY request open to all available couriers
      const delivReq = await request(app)
        .post('/api/v1/rides/request')
        .set('Authorization', `Bearer ${stage3PassToken}`)
        .send({
          origin,
          destination,
          paymentMethod: 'DINHEIRO',
          serviceType: 'delivery',
          deliveryDetails: {
            recipientName: 'Juliana Fernandes',
            recipientPhone: '+55 12 98877-6655',
            packageNotes: 'Documentos urgentes de cartório',
          },
        });
      expect(delivReq.status).toBe(201);
      const deliveryId = delivReq.body.data.id;

      // 2. Bike driver calls available-rides -> Sees the delivery!
      const bikeAvail = await request(app)
        .get('/api/v1/drivers/available-rides')
        .set('Authorization', `Bearer ${stage3BikeDriverToken}`);
      expect(bikeAvail.status).toBe(200);
      expect(bikeAvail.body.data.some((r: any) => r.id === deliveryId)).toBe(true);

      // 3. Car driver (offering both) calls available-rides -> Also sees the delivery!
      const carAvail = await request(app)
        .get('/api/v1/drivers/available-rides')
        .set('Authorization', `Bearer ${stage3CarDriverToken}`);
      expect(carAvail.status).toBe(200);
      expect(carAvail.body.data.some((r: any) => r.id === deliveryId)).toBe(true);

      // 4. Cancel this delivery so passenger can request a ride
      await request(app)
        .post(`/api/v1/rides/${deliveryId}/cancel`)
        .set('Authorization', `Bearer ${stage3PassToken}`)
        .send({ reason: 'Teste de filtro de corridas' });

      // 5. Create a PASSENGER RIDE request
      const rideReq = await request(app)
        .post('/api/v1/rides/request')
        .set('Authorization', `Bearer ${stage3PassToken}`)
        .send({
          origin,
          destination,
          paymentMethod: 'PIX',
          serviceType: 'ride',
        });
      expect(rideReq.status).toBe(201);
      const rideId = rideReq.body.data.id;

      // 6. Car driver calls available-rides -> Sees the passenger ride!
      const carRideAvail = await request(app)
        .get('/api/v1/drivers/available-rides')
        .set('Authorization', `Bearer ${stage3CarDriverToken}`);
      expect(carRideAvail.status).toBe(200);
      expect(carRideAvail.body.data.some((r: any) => r.id === rideId)).toBe(true);

      // 7. Bicycle courier calls available-rides -> MUST NOT see the passenger ride!
      const bikeRideAvail = await request(app)
        .get('/api/v1/drivers/available-rides')
        .set('Authorization', `Bearer ${stage3BikeDriverToken}`);
      expect(bikeRideAvail.status).toBe(200);
      expect(bikeRideAvail.body.data.some((r: any) => r.id === rideId)).toBe(false);

      // Clean up ride
      await request(app)
        .post(`/api/v1/rides/${rideId}/cancel`)
        .set('Authorization', `Bearer ${stage3PassToken}`)
        .send({ reason: 'Teste de filtro finalizado' });
    });

    it('executes full driver delivery lifecycle with direct payment and approval', async () => {
      const origin = { address: 'Rua Frei Galvão 100, São Sebastião - SP', lat: -23.8055, lng: -45.4011 };
      const destination = { address: 'Rua José Bonifácio 400, São Sebastião - SP', lat: -23.8100, lng: -45.4050 };

      // 1. Passenger requests delivery specifically for the bicycle partner
      const reqRes = await request(app)
        .post('/api/v1/rides/request')
        .set('Authorization', `Bearer ${stage3PassToken}`)
        .send({
          origin,
          destination,
          paymentMethod: 'CARD_MACHINE',
          serviceType: 'delivery',
          requestedDriverId: stage3BikeDriverUid,
          deliveryDetails: {
            recipientName: 'Lucas Lima',
            recipientPhone: '+55 12 99111-2233',
            packageNotes: 'Chaves de casa e controle de portão',
          },
        });
      expect(reqRes.status).toBe(201);
      const deliveryId = reqRes.body.data.id;
      expect(reqRes.body.data.serviceType).toBe('delivery');
      expect(reqRes.body.data.paymentMethod).toBe('CARD_MACHINE');

      // 2. Driver accepts delivery
      const acceptRes = await request(app)
        .post(`/api/v1/rides/${deliveryId}/accept`)
        .set('Authorization', `Bearer ${stage3BikeDriverToken}`);
      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.data.status).toBe('DRIVER_ARRIVING');
      expect(acceptRes.body.data.driverId).toBe(stage3BikeDriverUid);

      // 3. Driver arrives at pickup
      const arrRes = await request(app)
        .post(`/api/v1/rides/${deliveryId}/arrived`)
        .set('Authorization', `Bearer ${stage3BikeDriverToken}`);
      expect(arrRes.status).toBe(200);
      expect(arrRes.body.data.status).toBe('ARRIVED');

      // 4. Driver collects package and starts route
      const startRes = await request(app)
        .post(`/api/v1/rides/${deliveryId}/start`)
        .set('Authorization', `Bearer ${stage3BikeDriverToken}`);
      expect(startRes.status).toBe(200);
      expect(startRes.body.data.status).toBe('IN_PROGRESS');

      // 5. Driver completes delivery with payment pending confirmation
      const compRes = await request(app)
        .post(`/api/v1/rides/${deliveryId}/complete`)
        .set('Authorization', `Bearer ${stage3BikeDriverToken}`)
        .send({ paymentApproved: false });
      expect(compRes.status).toBe(200);
      expect(compRes.body.data.ride.status).toBe('COMPLETED');
      expect(compRes.body.data.ride.paymentApprovedByDriver).toBe(false);
      expect(compRes.body.data.ride.paymentStatus).toBe('PENDING');

      // 6. Driver approves direct payment received on card machine
      const appRes = await request(app)
        .post(`/api/v1/rides/${deliveryId}/approve-payment`)
        .set('Authorization', `Bearer ${stage3BikeDriverToken}`);
      expect(appRes.status).toBe(200);
      expect(appRes.body.data.ride.paymentApprovedByDriver).toBe(true);
      expect(appRes.body.data.ride.paymentStatus).toBe('PAID');
    });
  });

  describe('Stage 4 - Admin Panel, Platform Pricing Floors & R$100 Driver Plan', () => {
    it('admin metrics return service-type breakdowns and volumes for rides vs deliveries', async () => {
      const res = await request(app)
        .get('/api/v1/admin/metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const metrics = res.body.data;
      expect(metrics.totalRides).toBeDefined();
      expect(metrics.totalPassengerRides).toBeDefined();
      expect(metrics.totalDeliveries).toBeDefined();
      expect(metrics.completedPassengerRides).toBeDefined();
      expect(metrics.completedDeliveries).toBeDefined();
      expect(metrics.activeOnlineRideDrivers).toBeDefined();
      expect(metrics.activeOnlineDeliveryPartners).toBeDefined();
      expect(metrics.grossVolumeRidesBRL).toBeDefined();
      expect(metrics.grossVolumeDeliveriesBRL).toBeDefined();
    });

    it('admin can list rides and inspect service types and delivery details', async () => {
      const res = await request(app)
        .get('/api/v1/admin/rides')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const delivery = res.body.data.find((r: any) => r.serviceType === 'delivery');
      if (delivery) {
        expect(delivery.serviceType).toBe('delivery');
        expect(delivery.deliveryDetails).toBeDefined();
        expect(delivery.deliveryDetails.recipientName).toBeDefined();
      }
    });

    it('admin can inspect driver list with servicesOffered and vehicle info', async () => {
      const res = await request(app)
        .get('/api/v1/admin/drivers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const bikeDriver = res.body.data.find((d: any) => d.vehicle?.type === 'bicycle');
      if (bikeDriver) {
        expect(bikeDriver.servicesOffered).toEqual(['delivery']);
      }
    });

    it('admin can configure platform delivery pricing floors via PATCH /api/v1/admin/pricing', async () => {
      const updateRes = await request(app)
        .patch('/api/v1/admin/pricing')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deliveryMinimumFee: 14.0,
          deliveryPerKmRate: 2.5,
          deliveryWaitingPerMinuteRate: 0.6,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.deliveryMinimumFee).toBe(14.0);
      expect(updateRes.body.data.deliveryPerKmRate).toBe(2.5);
      expect(updateRes.body.data.deliveryWaitingPerMinuteRate).toBe(0.6);

      // Verify GET returns the new values
      const getRes = await request(app)
        .get('/api/v1/admin/pricing')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.deliveryMinimumFee).toBe(14.0);
      expect(getRes.body.data.deliveryPerKmRate).toBe(2.5);
      expect(getRes.body.data.deliveryWaitingPerMinuteRate).toBe(0.6);
    });

    it('driver cannot set delivery pricing below the updated platform floor', async () => {
      // Use approved driverToken
      // Try setting delivery fee to 12.00, below platform floor of 14.00
      const putRes = await request(app)
        .put('/api/v1/drivers/pricing')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          customDeliveryPricing: {
            minimumDeliveryFee: 12.0,
            perKmRate: 2.5,
          },
        });

      expect(putRes.status).toBe(400);
      expect(putRes.body.error.message).toContain('piso da plataforma');

      // Now set above floor (15.00 >= 14.00)
      const validPutRes = await request(app)
        .put('/api/v1/drivers/pricing')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          customDeliveryPricing: {
            minimumDeliveryFee: 15.0,
            perKmRate: 3.0,
          },
        });

      expect(validPutRes.status).toBe(200);
      expect(validPutRes.body.data.customDeliveryPricing.minimumDeliveryFee).toBe(15.0);
    });

    it('non-admin user cannot modify platform pricing (403 Forbidden)', async () => {
      const nonAdminToken = 'some-user-uid:user@teste.vaicar.app';
      const res = await request(app)
        .patch('/api/v1/admin/pricing')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .send({
          deliveryMinimumFee: 99.0,
        });

      expect(res.status).toBe(403);
    });

    it('represents monthly_100 driver plan correctly in driver profiles and admin list', async () => {
      const timestamp = Date.now();
      const p100DriverUid = `test-driver-100-${timestamp}`;
      const p100DriverEmail = `driver100.${timestamp}@teste.vaicar.app`;
      const p100DriverPhone = `+55 12 997${String(timestamp).slice(-6)}`;

      const regRes = await request(app)
        .post('/api/v1/auth/register-driver')
        .send({
          uid: p100DriverUid,
          name: 'Motorista Plano 100',
          cpf: generateValidTestCpf(),
          birthDate: '1990-01-01',
          whatsapp: p100DriverPhone,
          email: p100DriverEmail,
          photoUrl: 'https://storage.googleapis.com/vaicar-bucket/users/photo100.jpg',
          professionalCategory: 'Motorista de Aplicativo / EAR',
          cnhNumber: '11223344556',
          vehicle: {
            plate: 'VAI1000',
            model: 'Onix',
            brand: 'Chevrolet',
            year: 2022,
            color: 'Prata',
            type: 'car',
          },
          operatingZones: ['Centro & Porto Grande'],
          subscriptionPlan: 'monthly_100',
          servicesOffered: ['ride', 'delivery'],
        });

      expect(regRes.status).toBe(201);
      const effectiveDriverUid = regRes.body.data.driver.uid;
      expect(regRes.body.data.driver.subscriptionPlan).toBe('monthly_100');

      // Verify in admin list
      const adminListRes = await request(app)
        .get('/api/v1/admin/drivers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminListRes.status).toBe(200);
      const foundDriver = adminListRes.body.data.find((d: any) => d.uid === effectiveDriverUid || d.email === p100DriverEmail);
      expect(foundDriver).toBeDefined();
      expect(foundDriver.subscriptionPlan).toBe('monthly_100');
      expect(foundDriver.servicesOffered).toEqual(['ride', 'delivery']);
    });
  });

  describe('Phase 3 - Cryptographic Authentication & Account Migration Security', () => {
    const testMigEmail = `driver.mig.${Date.now()}@teste.vaicar.app`;
    let testMigDriverUid = '';

    beforeAll(async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register-driver')
        .send({
          uid: `old-driver-${Date.now()}`,
          name: 'Motorista Legado',
          cpf: generateValidTestCpf(),
          birthDate: '1988-04-12',
          whatsapp: `+5512996${String(Date.now()).slice(-6)}`,
          email: testMigEmail,
          photoUrl: 'https://storage.googleapis.com/vaicar-bucket/users/photo.jpg',
          professionalCategory: 'Motorista de Aplicativo / EAR',
          cnhNumber: '99887766554',
          vehicle: {
            plate: 'MIG2026',
            model: 'HB20',
            brand: 'Hyundai',
            year: 2021,
            color: 'Branco',
            type: 'car',
          },
          operatingZones: ['Centro & Porto Grande'],
          subscriptionPlan: 'monthly_100',
          servicesOffered: ['ride'],
        });

      expect(regRes.status).toBe(201);
      testMigDriverUid = regRes.body.data.driver.uid;
    });

    it('check-account identifies existing unmigrated Firestore account', async () => {
      const res = await request(app)
        .post('/api/v1/auth/check-account')
        .send({ email: testMigEmail });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.existsInFirestore).toBe(true);
      expect(res.body.data.role).toBe('driver');
      expect(res.body.data.name).toBe('Motorista Legado');
    });

    it('check-account safely returns false for non-existent account', async () => {
      const res = await request(app)
        .post('/api/v1/auth/check-account')
        .send({ email: 'inexistente.12345@teste.vaicar.app' });

      expect(res.status).toBe(200);
      expect(res.body.data.existsInFirestore).toBe(false);
      expect(res.body.data.needsMigration).toBe(false);
    });

    it('request-pin enforces rate-limiting 45-second cooldown', async () => {
      const firstRes = await request(app)
        .post('/api/v1/auth/request-pin')
        .send({ destination: testMigEmail, type: 'driver' });

      expect(firstRes.status).toBe(200);
      expect(firstRes.body.success).toBe(true);

      const secondRes = await request(app)
        .post('/api/v1/auth/request-pin')
        .send({ destination: testMigEmail, type: 'driver' });

      expect(secondRes.status).toBe(429);
      expect(secondRes.body.error.message).toContain('segundos antes de solicitar');
    });

    it('verify-pin rejects invalid PIN', async () => {
      const res = await request(app)
        .post('/api/v1/auth/verify-pin')
        .send({ destination: testMigEmail, pin: '000000' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('PIN incorreto');
    });

    it('verify-pin locks out after excessive consecutive failed attempts (> 5)', async () => {
      const bruteForceEmail = `brute.${Date.now()}@teste.vaicar.app`;
      await request(app)
        .post('/api/v1/auth/request-pin')
        .send({ destination: bruteForceEmail, type: 'driver' });

      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/auth/verify-pin')
          .send({ destination: bruteForceEmail, pin: `99999${i}` });
      }

      const lockedRes = await request(app)
        .post('/api/v1/auth/verify-pin')
        .send({ destination: bruteForceEmail, pin: '123456' });

      expect(lockedRes.status).toBe(400);
      expect(lockedRes.body.error.message).toContain('limite de tentativas excedido');
    });

    it('migrate-account rejects migration with invalid PIN', async () => {
      const res = await request(app)
        .post('/api/v1/auth/migrate-account')
        .send({
          email: testMigEmail,
          pin: '999999',
          password: 'NovaSenhaSegura123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('PIN incorreto');
    });

    it('migrate-account rejects password shorter than 6 characters', async () => {
      const res = await request(app)
        .post('/api/v1/auth/migrate-account')
        .send({
          email: testMigEmail,
          pin: '123456',
          password: '123',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('middleware rejects unauthenticated requests to protected endpoints', async () => {
      const noAuthRes = await request(app).get('/api/v1/auth/me');
      expect(noAuthRes.status).toBe(401);
      expect(noAuthRes.body.error.code).toBe('AUTH_REQUIRED');

      const nonBearerRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Basic dXNlcjpwYXNz');
      expect(nonBearerRes.status).toBe(401);

      const invalidTokenRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer forged-token-without-signature');
      expect(invalidTokenRes.status).toBe(401);
    });

    it('middleware prevents admin privilege escalation via forged admin UID prefix', async () => {
      const forgedToken = 'admin-hacker-uid:hacker@externo.com';
      const escalateRes = await request(app)
        .get('/api/v1/admin/drivers')
        .set('Authorization', `Bearer ${forgedToken}`);

      expect(escalateRes.status).toBe(403);
      expect(escalateRes.body.error.code).toBe('FORBIDDEN');
    });

    it('POST /api/v1/drivers/auth authenticates driver with password and issues server HMAC JWT', async () => {
      const authRes = await request(app)
        .post('/api/v1/drivers/auth')
        .send({
          email: testMigEmail,
          password: 'SecretPassword@2026',
        });

      expect(authRes.status).toBe(200);
      expect(authRes.body.success).toBe(true);
      expect(authRes.body.token).toBeDefined();
      expect(authRes.body.token.split('.').length).toBe(3);
      expect(authRes.body.driver).toBeDefined();
      expect(authRes.body.driver.email).toBe(testMigEmail);

      // Verify server HMAC JWT grants access to protected /drivers/me
      const serverJwt = authRes.body.token;
      const meRes = await request(app)
        .get('/api/v1/drivers/me')
        .set('Authorization', `Bearer ${serverJwt}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data.email).toBe(testMigEmail);
    });

    it('POST /api/v1/drivers/auth rejects unknown driver email with 404', async () => {
      const authRes = await request(app)
        .post('/api/v1/drivers/auth')
        .send({
          email: 'inexistente.driver@vaicar.app',
          password: 'Password123!',
        });

      expect(authRes.status).toBe(404);
      expect(authRes.body.error.code).toBe('NOT_FOUND');
    });

    it('middleware rejects tampered server HMAC JWT with 401', async () => {
      const authRes = await request(app)
        .post('/api/v1/drivers/auth')
        .send({
          email: testMigEmail,
          password: 'SecretPassword@2026',
        });
      expect(authRes.status).toBe(200);

      // Tamper signature
      const validJwt = authRes.body.token;
      const tamperedJwt = validJwt.slice(0, -5) + 'XXXXX';

      const tamperedRes = await request(app)
        .get('/api/v1/drivers/me')
        .set('Authorization', `Bearer ${tamperedJwt}`);

      expect(tamperedRes.status).toBe(401);
      expect(tamperedRes.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('POST /api/v1/passengers/auth authenticates passenger with password and returns server HMAC JWT', async () => {
      // 1. Create a test passenger
      const pEmail = `passenger.unified.${Date.now()}@teste.vaicar.app`;
      const pUid = `pass-uni-${Date.now()}`;
      await request(app)
        .post('/api/v1/auth/register-passenger')
        .send({
          uid: pUid,
          name: 'Passageiro Unificado',
          email: pEmail,
          whatsapp: '(12) 99888-1122',
          photoUrl: 'https://storage.googleapis.com/vaicar/pass.jpg',
          termsAccepted: true,
        });

      // 2. Authenticate via POST /api/v1/passengers/auth
      const authRes = await request(app)
        .post('/api/v1/passengers/auth')
        .send({
          email: pEmail,
          password: 'SecretPassword@2026',
        });

      expect(authRes.status).toBe(200);
      expect(authRes.body.success).toBe(true);
      expect(authRes.body.token).toBeDefined();
      expect(authRes.body.token.split('.').length).toBe(3);
      expect(authRes.body.passenger).toBeDefined();
      expect(authRes.body.passenger.email).toBe(pEmail);

      // 3. Passenger token can access /passengers/me
      const meRes = await request(app)
        .get('/api/v1/passengers/me')
        .set('Authorization', `Bearer ${authRes.body.token}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.data.email).toBe(pEmail);

      // 4. Passenger token is strictly forbidden from accessing driver endpoints
      const drvMeRes = await request(app)
        .get('/api/v1/drivers/me')
        .set('Authorization', `Bearer ${authRes.body.token}`);
      expect(drvMeRes.status).toBe(403);
      expect(drvMeRes.body.error.code).toBe('FORBIDDEN');
    });

    it('POST /api/v1/passengers/auth rejects unknown email with 404', async () => {
      const authRes = await request(app)
        .post('/api/v1/passengers/auth')
        .send({
          email: 'unknown.passenger@inexistente.com',
          password: 'Password123!',
        });

      expect(authRes.status).toBe(404);
      expect(authRes.body.error.code).toBe('NOT_FOUND');
    });

    it('POST /api/v1/passengers/auth dispatches 6-digit PIN on first access', async () => {
      const pEmail = `firstaccess.${Date.now()}@teste.vaicar.app`;
      const res = await request(app)
        .post('/api/v1/passengers/auth')
        .send({
          email: pEmail,
          phone: '(12) 99111-2233',
          name: 'Passageiro Primeiro Acesso',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.codeSent).toBe(true);
    });

    it('POST /api/v1/passengers/auth rejects incomplete 4-digit PIN with 400', async () => {
      const pEmail = `pin4test.${Date.now()}@teste.vaicar.app`;
      const res = await request(app)
        .post('/api/v1/passengers/auth')
        .send({
          email: pEmail,
          verificationCode: '1234',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('6 dígitos');
    });

    it('POST /api/v1/passengers/auth authenticates passenger with 6-digit PIN and returns server HMAC JWT', async () => {
      const pEmail = `pin6test.${Date.now()}@teste.vaicar.app`;
      const pUid = `pass-pin-${Date.now()}`;
      await savePassengerProfile({
        uid: pUid,
        email: pEmail,
        name: 'Passageiro PIN 6',
        whatsapp: '5512992223344',
      } as any);

      // Save a valid 6-digit PIN
      await savePendingPin(pEmail.toLowerCase().trim(), '654321', 15);

      const authRes = await request(app)
        .post('/api/v1/passengers/auth')
        .send({
          email: pEmail,
          verificationCode: '654321',
        });

      expect(authRes.status).toBe(200);
      expect(authRes.body.success).toBe(true);
      expect(authRes.body.token).toBeDefined();
      expect(authRes.body.token.split('.').length).toBe(3);
      expect(authRes.body.passenger).toBeDefined();
      expect(authRes.body.passenger.email).toBe(pEmail);
    });

    it('POST /api/v1/auth/login provides unified multi-role authentication', async () => {
      // Create user who has a driver account
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testMigEmail,
          password: 'SecretPassword@2026',
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.token).toBeDefined();
      expect(loginRes.body.token.split('.').length).toBe(3);
      expect(loginRes.body.roles).toBeDefined();
      expect(Array.isArray(loginRes.body.roles)).toBe(true);
      expect(loginRes.body.roles).toContain('driver');
    });

    it('POST /api/v1/auth/forgot-password and POST /api/v1/auth/reset-password flow works end-to-end', async () => {
      // 1. Request password reset PIN
      const forgotRes = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({
          email: testMigEmail,
        });

      expect(forgotRes.status).toBe(200);
      expect(forgotRes.body.success).toBe(true);
      expect(forgotRes.body.data.emailDelivered).toBe(true);

      // In unit test environment, PIN is deterministic or stored in pendingPins
      // Let's test resetting with an invalid PIN first
      const badResetRes = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          email: testMigEmail,
          pin: '000000',
          newPassword: 'BrandNewPassword@2026',
        });

      expect(badResetRes.status).toBe(400);
      expect(badResetRes.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('role isolation: driver token cannot access admin routes', async () => {
      const driverAuthRes = await request(app)
        .post('/api/v1/drivers/auth')
        .send({
          email: testMigEmail,
          password: 'SecretPassword@2026',
        });
      expect(driverAuthRes.status).toBe(200);
      const driverJwt = driverAuthRes.body.token;

      const adminAttempt = await request(app)
        .get('/api/v1/admin/drivers')
        .set('Authorization', `Bearer ${driverJwt}`);

      expect(adminAttempt.status).toBe(403);
      expect(adminAttempt.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Production Dispatch Engine & Targeted Ride Offers (20s Expiry, Sequential Redispatch, Fare & Driver Cancellation)', () => {
    const passengerUid = 'pass-dispatch-test-01';
    const passengerAuthToken = `${passengerUid}:dispatch.pass@teste.vaicar.app`;

    const passenger2Uid = 'pass-dispatch-test-02';
    const passenger2Token = `${passenger2Uid}:dispatch.pass2@teste.vaicar.app`;

    const passenger3Uid = 'pass-dispatch-test-03';
    const passenger3Token = `${passenger3Uid}:dispatch.pass3@teste.vaicar.app`;

    const drv1Uid = 'drv-dispatch-01';
    const drv1Token = `${drv1Uid}:dispatch.drv1@teste.vaicar.app`;

    const drv2Uid = 'drv-dispatch-02';
    const drv2Token = `${drv2Uid}:dispatch.drv2@teste.vaicar.app`;

    const drvFarUid = 'drv-dispatch-far';
    const drvOfflineUid = 'drv-dispatch-offline';
    const drvUnapprovedUid = 'drv-dispatch-unapproved';
    const drvCourierUid = 'drv-dispatch-courier';

    let testRideId = '';
    let testOfferId = '';

    beforeAll(async () => {
      // 0. Ensure all existing drivers from earlier test suites are offline to guarantee isolation
      const allDrivers = await listAllDrivers();
      for (const d of allDrivers) {
        if (d.isOnline) {
          await saveDriverProfile({ ...d, isOnline: false });
        }
      }

      // 1. Create Passengers
      await request(app)
        .post('/api/v1/auth/register-passenger')
        .send({
          uid: passengerUid,
          name: 'Passageiro Dispatch Test',
          whatsapp: '(12) 99111-2233',
          email: 'dispatch.pass@teste.vaicar.app',
          photoUrl: 'https://storage.googleapis.com/vaicar/pass.jpg',
          termsAccepted: true,
        });

      await request(app)
        .post('/api/v1/auth/register-passenger')
        .send({
          uid: passenger2Uid,
          name: 'Passageiro Dispatch Test 2',
          whatsapp: '(12) 99111-2234',
          email: 'dispatch.pass2@teste.vaicar.app',
          photoUrl: 'https://storage.googleapis.com/vaicar/pass.jpg',
          termsAccepted: true,
        });

      await request(app)
        .post('/api/v1/auth/register-passenger')
        .send({
          uid: passenger3Uid,
          name: 'Passageiro Dispatch Test 3',
          whatsapp: '(12) 99111-2235',
          email: 'dispatch.pass3@teste.vaicar.app',
          photoUrl: 'https://storage.googleapis.com/vaicar/pass.jpg',
          termsAccepted: true,
        });

      // 2. Driver 1: Approved, Online, 1.2 km away from Centro (-23.8055, -45.4011)
      await saveDriverProfile({
        uid: drv1Uid,
        name: 'Motorista Proximo 1',
        email: 'dispatch.drv1@teste.vaicar.app',
        whatsapp: '(12) 99111-0001',
        phone: '(12) 99111-0001',
        status: 'APPROVED',
        isOnline: true,
        isCourier: false,
        servicesOffered: ['ride'],
        currentLocation: {
          lat: -23.8100,
          lng: -45.4050,
          updatedAt: new Date().toISOString(),
        },
        vehicle: {
          brand: 'Toyota',
          model: 'Yaris',
          year: 2022,
          color: 'Prata',
          plate: 'DIS1A01',
          category: 'CAR',
          type: 'car',
        },
        pricing: {
          baseFare: 10,
          perKmRate: 2.5,
          perMinuteRate: 0.25,
          minimumFare: 10,
          ratePerKm: 2.5,
          pricingType: 'KM_ONLY',
        },
      } as any);

      // 3. Driver 2: Approved, Online, 3.5 km away from Centro
      await saveDriverProfile({
        uid: drv2Uid,
        name: 'Motorista Proximo 2',
        email: 'dispatch.drv2@teste.vaicar.app',
        whatsapp: '(12) 99111-0002',
        phone: '(12) 99111-0002',
        status: 'APPROVED',
        isOnline: true,
        isCourier: false,
        servicesOffered: ['ride'],
        currentLocation: {
          lat: -23.8300,
          lng: -45.4200,
          updatedAt: new Date().toISOString(),
        },
        vehicle: {
          brand: 'Hyundai',
          model: 'HB20',
          year: 2021,
          color: 'Branco',
          plate: 'DIS2B02',
          category: 'CAR',
          type: 'car',
        },
        pricing: {
          baseFare: 10,
          perKmRate: 2.5,
          perMinuteRate: 0.25,
          minimumFare: 10,
          ratePerKm: 2.5,
          pricingType: 'KM_ONLY',
        },
      } as any);

      // 4. Driver Far: > 15 km away in Caraguatatuba (-23.6229, -45.4124)
      await saveDriverProfile({
        uid: drvFarUid,
        name: 'Motorista Longe Caragua',
        email: 'dispatch.far@teste.vaicar.app',
        whatsapp: '(12) 99111-0003',
        status: 'APPROVED',
        isOnline: true,
        isCourier: false,
        servicesOffered: ['ride'],
        currentLocation: {
          lat: -23.6229,
          lng: -45.4124,
          updatedAt: new Date().toISOString(),
        },
        vehicle: {
          brand: 'Chevrolet',
          model: 'Onix',
          year: 2020,
          color: 'Preto',
          plate: 'FAR3C03',
          category: 'CAR',
          type: 'car',
        },
      } as any);

      // 5. Driver Offline: Approved, but isOnline = false
      await saveDriverProfile({
        uid: drvOfflineUid,
        name: 'Motorista Desconectado',
        email: 'dispatch.offline@teste.vaicar.app',
        whatsapp: '(12) 99111-0004',
        status: 'APPROVED',
        isOnline: false,
        currentLocation: {
          lat: -23.8055,
          lng: -45.4011,
          updatedAt: new Date().toISOString(),
        },
      } as any);

      // 6. Driver Unapproved: status = PENDING_APPROVAL
      await saveDriverProfile({
        uid: drvUnapprovedUid,
        name: 'Motorista Nao Aprovado',
        email: 'dispatch.unapproved@teste.vaicar.app',
        whatsapp: '(12) 99111-0005',
        status: 'PENDING_APPROVAL',
        isOnline: true,
        currentLocation: {
          lat: -23.8055,
          lng: -45.4011,
          updatedAt: new Date().toISOString(),
        },
      } as any);

      // 7. Driver Courier (Bicycle): servicesOffered = ['delivery'] only
      await saveDriverProfile({
        uid: drvCourierUid,
        name: 'Entregador Bike',
        email: 'dispatch.courier@teste.vaicar.app',
        whatsapp: '(12) 99111-0006',
        status: 'APPROVED',
        isOnline: true,
        isCourier: true,
        servicesOffered: ['delivery'],
        vehicle: {
          type: 'bicycle',
          brand: 'Caloi',
          model: 'Explorer',
        },
        currentLocation: {
          lat: -23.8055,
          lng: -45.4011,
          updatedAt: new Date().toISOString(),
        },
      } as any);
    });

    it('1. findEligibleCandidates accurately filters out offline, unapproved, far (>15km), and courier drivers', async () => {
      const mockRide: Ride = {
        id: 'mock-ride-candidates',
        passengerId: passengerUid,
        passengerName: 'Passageiro Test',
        passengerPhone: '(12) 99111-2233',
        origin: { address: 'Centro Histórico, São Sebastião', lat: -23.8055, lng: -45.4011 },
        destination: { address: 'Praia Grande, São Sebastião', lat: -23.8200, lng: -45.4100 },
        distanceKm: 2.0,
        fareAmount: 37.85,
        fareBrl: 37.85,
        estimatedPrice: 37.85,
        status: 'REQUESTED',
        serviceType: 'ride',
        paymentMethod: 'PIX',
        declinedDriverIds: [],
        createdAt: new Date().toISOString(),
      };

      const candidates = await findEligibleCandidates(mockRide);
      const candidateUids = candidates.map((c) => c.driver.uid);

      // Must include Driver 1 and Driver 2
      expect(candidateUids).toContain(drv1Uid);
      expect(candidateUids).toContain(drv2Uid);

      // Must exclude offline, unapproved, far (>15km), and bicycle courier
      expect(candidateUids).not.toContain(drvOfflineUid);
      expect(candidateUids).not.toContain(drvUnapprovedUid);
      expect(candidateUids).not.toContain(drvFarUid);
      expect(candidateUids).not.toContain(drvCourierUid);
    });

    it('2. findEligibleCandidates sorts candidates nearest first by Haversine distance', async () => {
      const mockRide: Ride = {
        id: 'mock-ride-sort',
        passengerId: passengerUid,
        passengerName: 'Passageiro Test',
        passengerPhone: '(12) 99111-2233',
        origin: { address: 'Centro Histórico, São Sebastião', lat: -23.8055, lng: -45.4011 },
        destination: { address: 'Praia Grande, São Sebastião', lat: -23.8200, lng: -45.4100 },
        distanceKm: 2.0,
        fareAmount: 37.85,
        fareBrl: 37.85,
        estimatedPrice: 37.85,
        status: 'REQUESTED',
        serviceType: 'ride',
        paymentMethod: 'PIX',
        declinedDriverIds: [],
        createdAt: new Date().toISOString(),
      };

      const candidates = await findEligibleCandidates(mockRide);
      expect(candidates.length).toBeGreaterThanOrEqual(2);
      expect(candidates[0].driver.uid).toBe(drv1Uid); // Driver 1 (~0.6 km) is nearer than Driver 2 (~3.4 km)
      expect(candidates[1].driver.uid).toBe(drv2Uid);
      expect(candidates[0].distanceToPickupKm).toBeLessThan(candidates[1].distanceToPickupKm);
    });

    it('3. POST /api/v1/rides/request creates a targeted 20-second offer for the nearest driver', async () => {
      const res = await request(app)
        .post('/api/v1/rides/request')
        .set('Authorization', `Bearer ${passengerAuthToken}`)
        .send({
          origin: { address: 'Centro Histórico, São Sebastião', lat: -23.8055, lng: -45.4011 },
          destination: { address: 'Barequeçaba, São Sebastião', lat: -23.8266, lng: -45.4389 },
          paymentMethod: 'PIX',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      testRideId = res.body.data.id;

      // Allow background dispatchNextCandidate to run
      await new Promise((r) => setTimeout(r, 100));

      const ride = await getRide(testRideId);
      expect(ride).toBeDefined();
      expect(ride!.status).toBe('OFFERED');
      expect(ride!.currentOfferId).toBeDefined();
      testOfferId = ride!.currentOfferId!;

      const offer = await getRideOffer(testOfferId);
      expect(offer).toBeDefined();
      expect(offer!.driverId).toBe(drv1Uid); // Targeted to nearest driver
      expect(offer!.status).toBe('PENDING');
      expect(offer!.fareAmount).toBe(ride!.fareAmount);

      // Verify strict 20-second expiration window
      const createdAtMs = new Date(offer!.createdAt).getTime();
      const expiresAtMs = new Date(offer!.expiresAt).getTime();
      const diffSec = Math.round((expiresAtMs - createdAtMs) / 1000);
      expect(diffSec).toBe(OFFER_TIMEOUT_SECONDS);
      expect(OFFER_TIMEOUT_SECONDS).toBe(20);
    });

    it('4. GET /api/v1/drivers/offers/pending returns targeted offer with real customer fare for Driver 1', async () => {
      const res = await request(app)
        .get('/api/v1/drivers/offers/pending')
        .set('Authorization', `Bearer ${drv1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBe(testOfferId);
      expect(res.body.data.driverId).toBe(drv1Uid);
      expect(res.body.data.fareAmount).toBeGreaterThan(0);
      expect(res.body.data.secondsRemaining).toBeGreaterThanOrEqual(1);
      expect(res.body.data.secondsRemaining).toBeLessThanOrEqual(20);
      expect(res.body.data.origin.address).toContain('Centro');
    });

    it('5. GET /api/v1/drivers/offers/pending returns null for non-targeted Driver 2', async () => {
      const res = await request(app)
        .get('/api/v1/drivers/offers/pending')
        .set('Authorization', `Bearer ${drv2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeNull();
    });

    it('6. POST /api/v1/drivers/offers/:id/accept rejects unauthorized driver with 403', async () => {
      const res = await request(app)
        .post(`/api/v1/drivers/offers/${testOfferId}/accept`)
        .set('Authorization', `Bearer ${drv2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('7. POST /api/v1/drivers/offers/:id/accept atomically accepts offer for Driver 1 -> status DRIVER_ARRIVING', async () => {
      const res = await request(app)
        .post(`/api/v1/drivers/offers/${testOfferId}/accept`)
        .set('Authorization', `Bearer ${drv1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DRIVER_ARRIVING');
      expect(res.body.data.driverId).toBe(drv1Uid);
      expect(res.body.data.acceptedAt).toBeDefined();

      const offer = await getRideOffer(testOfferId);
      expect(offer!.status).toBe('ACCEPTED');
    });

    it('8. POST /api/v1/drivers/offers/:id/accept rejects already-accepted offer with 409 conflict', async () => {
      const res = await request(app)
        .post(`/api/v1/drivers/offers/${testOfferId}/accept`)
        .set('Authorization', `Bearer ${drv1Token}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('9. Driver cancellation during DRIVER_ARRIVING detaches driver, sets declinedDriverIds, and redispatches to Driver 2', async () => {
      const cancelRes = await request(app)
        .post(`/api/v1/rides/${testRideId}/cancel`)
        .set('Authorization', `Bearer ${drv1Token}`)
        .send({ reason: 'Pneu furou no caminho' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.success).toBe(true);
      expect(cancelRes.body.data.redispatched).toBe(true);

      const ride = await getRide(testRideId);
      expect(ride).toBeDefined();
      expect(ride!.driverId).toBeUndefined();
      expect(ride!.declinedDriverIds).toContain(drv1Uid);
      expect(ride!.lastDriverCancelledAt).toBeDefined();
      expect(ride!.lastDriverCancelReason).toBe('Pneu furou no caminho');

      // Allow redispatch to run
      await new Promise((r) => setTimeout(r, 100));

      const refreshedRide = await getRide(testRideId);
      expect(refreshedRide!.status).toBe('OFFERED');
      expect(refreshedRide!.currentOfferId).toBeDefined();

      const newOffer = await getRideOffer(refreshedRide!.currentOfferId!);
      expect(newOffer).toBeDefined();
      expect(newOffer!.driverId).toBe(drv2Uid); // Redispatched to next candidate Driver 2!
      testOfferId = newOffer!.id;
    });

    it('10. Driver 2 receives the redispatched offer via GET /api/v1/drivers/offers/pending with original customer fare', async () => {
      const res = await request(app)
        .get('/api/v1/drivers/offers/pending')
        .set('Authorization', `Bearer ${drv2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBe(testOfferId);
      expect(res.body.data.driverId).toBe(drv2Uid);
      expect(res.body.data.fareAmount).toBeGreaterThan(0);
    });

    it('11. Driver 2 declines the offer via POST /api/v1/drivers/offers/:id/decline', async () => {
      const res = await request(app)
        .post(`/api/v1/drivers/offers/${testOfferId}/decline`)
        .set('Authorization', `Bearer ${drv2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const offer = await getRideOffer(testOfferId);
      expect(offer!.status).toBe('DECLINED');

      const ride = await getRide(testRideId);
      expect(ride!.declinedDriverIds).toContain(drv2Uid);
    });

    it('12. Exhaustion of all candidates transitions ride to CANCELLED_BY_SYSTEM', async () => {
      // Both Driver 1 and Driver 2 declined, no more eligible drivers in range
      await new Promise((r) => setTimeout(r, 100));

      const ride = await getRide(testRideId);
      expect(ride).toBeDefined();
      expect(ride!.status).toBe('CANCELLED_BY_SYSTEM');
      expect(ride!.cancelReason).toBe('Nenhum motorista disponível');
      expect(ride!.cancelledBy).toBe('system');
    });

    it('13. Expired offer handling via expireOffer() marks offer EXPIRED, records declined driver, and advances dispatch', async () => {
      // Reset Driver 1 and Driver 2 for a new ride
      const d1 = await getDriverProfile(drv1Uid);
      if (d1) await saveDriverProfile({ ...d1, isOnline: true });
      const d2 = await getDriverProfile(drv2Uid);
      if (d2) await saveDriverProfile({ ...d2, isOnline: true });

      const newRideRes = await request(app)
        .post('/api/v1/rides/request')
        .set('Authorization', `Bearer ${passenger2Token}`)
        .send({
          origin: { address: 'Centro Histórico, São Sebastião', lat: -23.8055, lng: -45.4011 },
          destination: { address: 'Ilhabela Ferry, São Sebastião', lat: -23.8150, lng: -45.3900 },
          paymentMethod: 'CASH',
        });

      expect(newRideRes.status).toBe(201);
      const secondRideId = newRideRes.body.data.id;

      await new Promise((r) => setTimeout(r, 100));
      const ride = await getRide(secondRideId);
      const firstOfferId = ride!.currentOfferId!;
      expect(firstOfferId).toBeDefined();

      const firstOffer = await getRideOffer(firstOfferId);
      expect(firstOffer!.driverId).toBe(drv1Uid);

      // Trigger expiration of Driver 1's offer
      await expireOffer(firstOfferId);

      const expiredOffer = await getRideOffer(firstOfferId);
      expect(expiredOffer!.status).toBe('EXPIRED');

      const updatedRide = await getRide(secondRideId);
      expect(updatedRide!.declinedDriverIds).toContain(drv1Uid);

      // Advanced to Driver 2
      const secondOffer = await getRideOffer(updatedRide!.currentOfferId!);
      expect(secondOffer!.driverId).toBe(drv2Uid);
      expect(secondOffer!.status).toBe('PENDING');
    });

    it('14. Driver travel to pickup (DRIVER_ARRIVING) is isolated from passenger trip fare', async () => {
      // Ensure Driver 1 is online for this ride
      const d1 = await getDriverProfile(drv1Uid);
      if (d1) await saveDriverProfile({ ...d1, isOnline: true });

      // Create a ride with established fare
      const rideRes = await request(app)
        .post('/api/v1/rides/request')
        .set('Authorization', `Bearer ${passenger3Token}`)
        .send({
          origin: { address: 'Centro Histórico, São Sebastião', lat: -23.8055, lng: -45.4011 },
          destination: { address: 'Barequeçaba, São Sebastião', lat: -23.8266, lng: -45.4389 },
          paymentMethod: 'PIX',
        });

      const rideId = rideRes.body.data.id;
      const initialFare = rideRes.body.data.fareAmount;
      expect(initialFare).toBeGreaterThan(0);

      await new Promise((r) => setTimeout(r, 100));
      const ride = await getRide(rideId);
      const offerId = ride!.currentOfferId!;

      // Driver accepts
      await request(app)
        .post(`/api/v1/drivers/offers/${offerId}/accept`)
        .set('Authorization', `Bearer ${drv1Token}`);

      // Driver updates location during approach (DRIVER_ARRIVING)
      await request(app)
        .post('/api/v1/drivers/location')
        .set('Authorization', `Bearer ${drv1Token}`)
        .send({ lat: -23.8080, lng: -45.4030, heading: 45 });

      const rideDuringApproach = await getRide(rideId);
      expect(rideDuringApproach!.status).toBe('DRIVER_ARRIVING');
      expect(rideDuringApproach!.fareAmount).toBe(initialFare); // Fare unchanged

      // Driver arrives at pickup
      await request(app)
        .post(`/api/v1/rides/${rideId}/arrived`)
        .set('Authorization', `Bearer ${drv1Token}`);

      const rideAtPickup = await getRide(rideId);
      expect(rideAtPickup!.status).toBe('ARRIVED');
      expect(rideAtPickup!.fareAmount).toBe(initialFare); // Fare unchanged
    });

    it('15. Driver with an active trip in progress is not offered new rides', async () => {
      // Driver 1 is currently in DRIVER_ARRIVING / ARRIVED from previous test
      const busyCandidates = await findEligibleCandidates({
        id: 'mock-test-busy',
        origin: { address: 'Centro', lat: -23.8055, lng: -45.4011 },
        destination: { address: 'Barequeçaba', lat: -23.8266, lng: -45.4389 },
        serviceType: 'ride',
        declinedDriverIds: [],
      } as any);

      const busyUids = busyCandidates.map((c) => c.driver.uid);
      expect(busyUids).not.toContain(drv1Uid); // Driver 1 is busy with active ride
    });

    it('16. Real customer fare (e.g. R$ 37,85) is preserved through the entire dispatch lifecycle', async () => {
      // Driver 2 is available with fresh GPS in Centro, clear any prior offers
      const lingeringOffer = await getActivePendingOfferForDriver(drv2Uid);
      if (lingeringOffer) {
        await expireOffer(lingeringOffer.id);
      }
      const d2 = await getDriverProfile(drv2Uid);
      if (d2) {
        await saveDriverProfile({
          ...d2,
          isOnline: true,
          status: 'APPROVED',
          currentLocation: { lat: -23.8060, lng: -45.4020, updatedAt: new Date().toISOString() },
        });
      }

      const customFareRide: Ride = {
        id: 'mock-custom-fare-test',
        passengerId: passengerUid,
        passengerName: 'Passageiro R$37.85',
        passengerPhone: '(12) 99111-2233',
        origin: { address: 'Centro, São Sebastião', lat: -23.8055, lng: -45.4011 },
        destination: { address: 'Praia Maresias, São Sebastião', lat: -23.7915, lng: -45.5683 },
        distanceKm: 27.5,
        fareAmount: 37.85,
        fareBrl: 37.85,
        estimatedPrice: 37.85,
        status: 'REQUESTED',
        serviceType: 'ride',
        paymentMethod: 'PIX',
        declinedDriverIds: [],
        createdAt: new Date().toISOString(),
      };
      await saveRide(customFareRide);

      const offer = await dispatchNextCandidate(customFareRide.id);
      expect(offer).toBeDefined();
      expect(offer!.fareAmount).toBe(37.85); // Preserved exactly

      const fetchedOffer = await getRideOffer(offer!.id);
      expect(fetchedOffer!.fareAmount).toBe(37.85);
    });
  });

  describe('Driver APK Mobile Distribution & Download Endpoints', () => {
    it('GET /api/v1/download/driver/metadata returns verified package info and checksum', async () => {
      const res = await request(app).get('/api/v1/download/driver/metadata');
      expect(res.status).toBe(200);
      expect(res.body.app).toBe('VaiCar Driver');
      expect(res.body.package).toBe('com.vaicar.driver');
      expect(res.body.version).toBe('1.0.0');
      expect(res.body.build).toBe(1);
      expect(res.body.sizeBytes).toBeGreaterThan(15_000_000);
      expect(res.body.downloadUrl).toBe('https://vaicar.app/downloads/vaicar-driver.apk');
    });

    it('GET /downloads/vaicar-driver.apk serves the real binary with Android MIME type and headers', async () => {
      const res = await request(app).head('/downloads/vaicar-driver.apk');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/vnd.android.package-archive');
      expect(res.headers['content-disposition']).toContain('vaicar-driver.apk');
      expect(parseInt(res.headers['content-length'])).toBeGreaterThan(15_000_000);
    });

    it('GET /download/driver.apk alias also serves the APK binary with correct headers', async () => {
      const res = await request(app).head('/download/driver.apk');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/vnd.android.package-archive');
      expect(res.headers['content-disposition']).toContain('vaicar-driver.apk');
    });

    it('POST /api/v1/rides (Android root route) creates ride with 201 and spreads payload', async () => {
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${passengerToken}`)
        .send({
          originAddress: 'Centro, São Sebastião',
          destinationAddress: 'Maresias, São Sebastião',
          originLat: -23.7928,
          originLng: -45.3999,
          destinationLat: -23.8050,
          destinationLng: -45.4050,
          paymentMethod: 'PIX',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toMatch(/^ride-/);
      expect(res.body.id).toBe(res.body.data.id); // Spread top-level for Android gson root parsing
      expect(res.body.status).toBe('REQUESTED');
    });

    it('POST /api/v1/search/drivers NEVER returns synthetic drivers and returns real candidates only', async () => {
      // 1. Search when drivers are offline: returns totalFound = 0, results = [], standardFare > 0
      const resEmpty = await request(app)
        .post('/api/v1/search/drivers')
        .send({
          pickupLat: -23.7928,
          pickupLng: -45.3999,
          destLat: -23.8050,
          destLng: -45.4050,
          originAddress: 'Centro, São Sebastião',
          destAddress: 'Maresias, São Sebastião',
        });

      expect(resEmpty.status).toBe(200);
      expect(resEmpty.body.standardFare).toBeGreaterThanOrEqual(10.0);
      // Ensure zero synthetic placeholders
      for (const drv of resEmpty.body.results) {
        expect(drv.name).not.toBe('Tarifa Oficial da Plataforma');
        expect(drv.name).not.toBe('VaiCar Oficial');
      }

      // 2. Set Bruno online with fresh GPS
      const brunoProfile: DriverProfile = {
        uid: 'drv-bruno-test',
        name: 'Bruno Alexandre Rocha',
        email: 'bruno.test@vaicar.app',
        whatsapp: '+5512999990001',
        status: 'APPROVED',
        isOnline: true,
        servicesOffered: ['ride'],
        rating: 5.0,
        vehicle: {
          brand: 'Chevrolet',
          model: 'Onix',
          plate: 'BRA2E19',
          color: 'Prata',
        } as any,
        currentLocation: {
          lat: -23.7930,
          lng: -45.4000,
          updatedAt: new Date().toISOString(),
        },
      } as any;
      await saveDriverProfile(brunoProfile);

      const resBrunoOnly = await request(app)
        .post('/api/v1/search/drivers')
        .send({
          pickupLat: -23.7928,
          pickupLng: -45.3999,
          destLat: -23.8050,
          destLng: -45.4050,
        });

      expect(resBrunoOnly.status).toBe(200);
      expect(resBrunoOnly.body.totalFound).toBeGreaterThanOrEqual(1);
      const brunoFound = resBrunoOnly.body.results.find((d: any) => d.driverId === 'drv-bruno-test');
      expect(brunoFound).toBeDefined();
      expect(brunoFound.name).toBe('Bruno Alexandre Rocha');
      expect(brunoFound.vehicle.licensePlate).toBe('BRA2E19');

      // 3. Set Alan online with fresh GPS
      const alanProfile: DriverProfile = {
        uid: 'drv-alan-test',
        name: 'Alan da Silva Morais',
        email: 'alan.test@vaicar.app',
        whatsapp: '+5512999990002',
        status: 'APPROVED',
        isOnline: true,
        servicesOffered: ['ride'],
        rating: 5.0,
        vehicle: {
          brand: 'Fiat',
          model: 'Argo',
          plate: 'ALA2026',
          color: 'Preto',
        } as any,
        currentLocation: {
          lat: -23.7935,
          lng: -45.4005,
          updatedAt: new Date().toISOString(),
        },
      } as any;
      await saveDriverProfile(alanProfile);

      const resBoth = await request(app)
        .post('/api/v1/search/drivers')
        .send({
          pickupLat: -23.7928,
          pickupLng: -45.3999,
          destLat: -23.8050,
          destLng: -45.4050,
        });

      expect(resBoth.status).toBe(200);
      expect(resBoth.body.totalFound).toBeGreaterThanOrEqual(2);
      const names = resBoth.body.results.map((d: any) => d.name);
      expect(names).toContain('Bruno Alexandre Rocha');
      expect(names).toContain('Alan da Silva Morais');
      expect(names).not.toContain('Tarifa Oficial da Plataforma');
      expect(names).not.toContain('VaiCar Oficial');
    });

    it('GET /api/v1/meta returns platform zones and metrics with HTTP 200', async () => {
      const res = await request(app).get('/api/v1/meta');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.zones)).toBe(true);
      expect(res.body.zones.length).toBeGreaterThanOrEqual(10);
      expect(res.body.zones[0]).toHaveProperty('id');
      expect(res.body.zones[0]).toHaveProperty('name');
      expect(res.body.zones[0]).toHaveProperty('lat');
      expect(res.body.zones[0]).toHaveProperty('lng');
      expect(res.body.metrics).toHaveProperty('totalDrivers');
      expect(res.body.metrics).toHaveProperty('approvedDrivers');
      expect(res.body.metrics).toHaveProperty('onlineDrivers');
      expect(res.body.metrics).toHaveProperty('totalPassengers');
      expect(res.body.metrics).toHaveProperty('totalRides');
    });
  });

  describe('Phase 4 — Production Hardening & Security Authorization Suite', () => {
    const secDriverUid = `sec-driver-${Date.now()}`;
    const secDriverEmail = `sec.driver.${Date.now()}@teste.vaicar.app`;
    const secDriverToken = `${secDriverUid}:${secDriverEmail}`;

    const secPassengerUid = `sec-pass-${Date.now()}`;
    const secPassengerEmail = `sec.pass.${Date.now()}@teste.vaicar.app`;
    const secPassengerToken = `${secPassengerUid}:${secPassengerEmail}`;

    const attackerUid = `attacker-${Date.now()}`;
    const attackerEmail = `attacker.${Date.now()}@teste.vaicar.app`;
    const attackerToken = `${attackerUid}:${attackerEmail}`;

    let secRideId: string;

    beforeAll(async () => {
      // 1. Create Driver
      await saveDriverProfile({
        uid: secDriverUid,
        name: 'Motorista Autorizado Segurança',
        cpf: '12345678901',
        email: secDriverEmail,
        status: 'APPROVED',
        isOnline: true,
        currentLocation: { lat: -23.8055, lng: -45.4011, updatedAt: new Date().toISOString() },
        servicesOffered: ['ride'],
      } as any);

      // 2. Create Passenger
      await savePassengerProfile({
        uid: secPassengerUid,
        name: 'Passageiro Autorizado Segurança',
        email: secPassengerEmail,
        termsAccepted: true,
      } as any);

      // 3. Create Attacker
      await savePassengerProfile({
        uid: attackerUid,
        name: 'Atacante Não Autorizado',
        email: attackerEmail,
        termsAccepted: true,
      } as any);

      // 4. Create Ride
      secRideId = `ride-sec-${Date.now()}`;
      await saveRide({
        id: secRideId,
        serviceType: 'ride',
        passengerId: secPassengerUid,
        passengerName: 'Passageiro Autorizado Segurança',
        driverId: secDriverUid,
        driverName: 'Motorista Autorizado Segurança',
        origin: { address: 'Centro, São Sebastião', lat: -23.8055, lng: -45.4011 },
        destination: { address: 'Boiçucanga, São Sebastião', lat: -23.7842, lng: -45.6175 },
        distanceKm: 12.0,
        durationMinutes: 25,
        fareAmount: 28.25,
        paymentMethod: 'PIX',
        paymentStatus: 'PENDING',
        status: 'IN_PROGRESS',
        requestedAt: new Date().toISOString(),
      } as any);
    });

    it('GET /api/v1/rides/:id/driver-location rejects unassigned attacker with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/rides/${secRideId}/driver-location`)
        .set('Authorization', `Bearer ${attackerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Acesso restrito');
    });

    it('GET /api/v1/rides/:id/driver-location allows assigned passenger', async () => {
      const res = await request(app)
        .get(`/api/v1/rides/${secRideId}/driver-location`)
        .set('Authorization', `Bearer ${secPassengerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.hasLiveLocation).toBe(true);
      expect(res.body.driverLocation.lat).toBe(-23.8055);
    });

    it('POST /api/v1/rides/:id/driver-location rejects attacker attempt to spoof GPS with 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/v1/rides/${secRideId}/driver-location`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({
          lat: -23.5000,
          lng: -46.5000,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Apenas o motorista atribuído');
    });

    it('POST /api/v1/rides/:id/driver-location allows assigned driver to update GPS location', async () => {
      const res = await request(app)
        .post(`/api/v1/rides/${secRideId}/driver-location`)
        .set('Authorization', `Bearer ${secDriverToken}`)
        .send({
          lat: -23.8060,
          lng: -45.4020,
          heading: 180,
          speed: 40,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.driverLocation.lat).toBe(-23.8060);
      expect(res.body.driverLocation.lng).toBe(-45.4020);
    });

    it('POST /api/v1/auth/admin-login rejects incorrect password with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/admin-login')
        .send({
          email: 'admin@vaicar.app',
          password: 'WrongPassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('incorretos');
    });
  });
});


