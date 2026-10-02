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
  });
});
