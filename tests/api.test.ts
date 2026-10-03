import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../api/src/server.js';

describe('VaiCar Platform - API Automated Tests', () => {
  // Test authentication tokens for dev/test mode
  const passengerToken = 'test-pass-01:passenger@teste.vaicar.app';
  const driverToken = 'test-driv-01:motorista@teste.vaicar.app';
  const adminToken = 'test-admin-01:admin@vaicar.app';

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
      // Ensure driver is approved and online
      await request(app)
        .post(`/api/v1/admin/drivers/${dUid}/approve`)
        .set('Authorization', `Bearer admin@vaicar.app:VaiCar#2026Admin`);

      await request(app)
        .post('/api/v1/drivers/toggle-online')
        .set('Authorization', `Bearer ${dUid}:${dEmail}`)
        .send({ isOnline: true });

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

      // Set online
      const onlineRes = await request(app)
        .post('/api/v1/drivers/toggle-online')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ isOnline: true });
      expect(onlineRes.status).toBe(200);
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
    });
  });
});
