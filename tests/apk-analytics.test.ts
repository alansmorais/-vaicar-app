import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from '../api/src/server.js';
import { localApkStore, TRACKING_STARTED_AT } from '../api/src/services/apkAnalytics.js';
import { localWaitlistStore } from '../api/src/services/deliveryWaitlist.js';

describe('VaiCar — APK Download Analytics & Delivery Waitlist Suite', () => {
  const adminToken = 'test-admin-01:admin@vaicar.app';
  const driverToken = 'test-driv-01:motorista@teste.vaicar.app';
  const passengerToken = 'test-pass-01:passenger@teste.vaicar.app';

  beforeEach(() => {
    // Reset in-memory test stores
    localApkStore.summary.totalPassengerDownloads = 0;
    localApkStore.summary.totalDriverDownloads = 0;
    localApkStore.summary.totalDownloads = 0;
    localApkStore.summary.lastPassengerDownloadAt = null;
    localApkStore.summary.lastDriverDownloadAt = null;
    localApkStore.summary.lastDownloadAt = null;
    localApkStore.daily.clear();
    localApkStore.events = [];
    localWaitlistStore.length = 0;
  });

  describe('1. Physical APK Integrity & Hash Verification', () => {
    it('confirms vaicar-driver.apk exists, has size 18181773 and matching SHA-256', () => {
      const apkPath = path.resolve(process.cwd(), 'public', 'downloads', 'vaicar-driver.apk');
      expect(fs.existsSync(apkPath)).toBe(true);

      const stat = fs.statSync(apkPath);
      expect(stat.size).toBe(18181773);

      const buffer = fs.readFileSync(apkPath);
      const hash = crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
      expect(hash).toBe('C0C8B5AD33907BF78C61512566ECE712AE68A2F68DF2B68085F2F037BEC37814');
    });

    it('confirms vaicar-passenger.apk exists, has size 16826125 and matching SHA-256', () => {
      const apkPath = path.resolve(process.cwd(), 'public', 'downloads', 'vaicar-passenger.apk');
      expect(fs.existsSync(apkPath)).toBe(true);

      const stat = fs.statSync(apkPath);
      expect(stat.size).toBe(16826125);

      const buffer = fs.readFileSync(apkPath);
      const hash = crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
      expect(hash).toBe('15191069932046F5F2E0702914B6BC10FE2485AF9638EBA106538C0CB9B202F2');
    });
  });

  describe('2. APK Download Endpoint & HEAD vs GET Analytics', () => {
    it('serves HEAD /downloads/vaicar-driver.apk with headers but NEVER increments counter', async () => {
      const res = await request(app)
        .head('/downloads/vaicar-driver.apk')
        .set('User-Agent', 'Mozilla/5.0 (Linux; Android 14)');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/vnd.android.package-archive');
      expect(res.headers['content-length']).toBe('18181773');
      expect(res.headers['content-disposition']).toContain('attachment; filename="vaicar-driver.apk"');

      // Verify counter was NOT incremented on HEAD
      expect(localApkStore.summary.totalDriverDownloads).toBe(0);
      expect(localApkStore.summary.totalDownloads).toBe(0);
    });

    it('serves HEAD /downloads/vaicar-passenger.apk with headers but NEVER increments counter', async () => {
      const res = await request(app)
        .head('/downloads/vaicar-passenger.apk')
        .set('User-Agent', 'Mozilla/5.0 (Linux; Android 14)');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/vnd.android.package-archive');
      expect(res.headers['content-length']).toBe('16826125');
      expect(res.headers['content-disposition']).toContain('attachment; filename="vaicar-passenger.apk"');

      // Verify counter was NOT incremented on HEAD
      expect(localApkStore.summary.totalPassengerDownloads).toBe(0);
      expect(localApkStore.summary.totalDownloads).toBe(0);
    });

    it('increments passenger download counter on successful GET', async () => {
      const res = await request(app)
        .get('/downloads/vaicar-passenger.apk')
        .set('User-Agent', 'Mozilla/5.0 (Linux; Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0')
        .set('X-Forwarded-For', '200.100.50.1');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/vnd.android.package-archive');

      // Allow async firestore/local write
      await new Promise((r) => setTimeout(r, 80));

      expect(localApkStore.summary.totalPassengerDownloads).toBe(1);
      expect(localApkStore.summary.totalDriverDownloads).toBe(0);
      expect(localApkStore.summary.totalDownloads).toBe(1);
      expect(localApkStore.summary.lastPassengerDownloadAt).not.toBeNull();
    });

    it('increments driver download counter on successful GET', async () => {
      const res = await request(app)
        .get('/downloads/vaicar-driver.apk')
        .set('User-Agent', 'Mozilla/5.0 (Linux; Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0')
        .set('X-Forwarded-For', '200.100.50.2');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/vnd.android.package-archive');

      await new Promise((r) => setTimeout(r, 80));

      expect(localApkStore.summary.totalPassengerDownloads).toBe(0);
      expect(localApkStore.summary.totalDriverDownloads).toBe(1);
      expect(localApkStore.summary.totalDownloads).toBe(1);
      expect(localApkStore.summary.lastDriverDownloadAt).not.toBeNull();
    });

    it('excludes known crawler bots (e.g. Googlebot, WhatsApp, UptimeRobot) from metrics', async () => {
      const res = await request(app)
        .get('/downloads/vaicar-passenger.apk')
        .set('User-Agent', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')
        .set('X-Forwarded-For', '66.249.66.1');

      expect(res.status).toBe(200);

      await new Promise((r) => setTimeout(r, 80));

      // Bot request must NOT count towards downloads
      expect(localApkStore.summary.totalPassengerDownloads).toBe(0);
      expect(localApkStore.summary.totalDownloads).toBe(0);
    });

    it('deduplicates rapid repeated downloads from the same client within 5 minutes', async () => {
      const clientIp = '189.120.30.40';
      const clientUa = 'Mozilla/5.0 (Linux; Android 14; Pixel 8)';

      // 1st download
      const res1 = await request(app)
        .get('/downloads/vaicar-driver.apk')
        .set('User-Agent', clientUa)
        .set('X-Forwarded-For', clientIp);
      expect(res1.status).toBe(200);
      await new Promise((r) => setTimeout(r, 80));
      expect(localApkStore.summary.totalDriverDownloads).toBe(1);

      // 2nd rapid download from same client
      const res2 = await request(app)
        .get('/downloads/vaicar-driver.apk')
        .set('User-Agent', clientUa)
        .set('X-Forwarded-For', clientIp);
      expect(res2.status).toBe(200);
      await new Promise((r) => setTimeout(r, 80));

      // Must remain 1 due to 5-minute deduplication window
      expect(localApkStore.summary.totalDriverDownloads).toBe(1);
    });
  });

  describe('3. Admin Download Analytics Access Control & Schema', () => {
    it('rejects unauthenticated requests to GET /api/v1/admin/analytics/downloads with 401', async () => {
      const res = await request(app).get('/api/v1/admin/analytics/downloads');
      expect(res.status).toBe(401);
    });

    it('rejects non-admin (driver or passenger) requests with 403 Forbidden', async () => {
      const resDriver = await request(app)
        .get('/api/v1/admin/analytics/downloads')
        .set('Authorization', `Bearer ${driverToken}`);
      expect(resDriver.status).toBe(403);

      const resPass = await request(app)
        .get('/api/v1/admin/analytics/downloads')
        .set('Authorization', `Bearer ${passengerToken}`);
      expect(resPass.status).toBe(403);
    });

    it('returns structured analytics data for authenticated admin', async () => {
      // Seed some test counts in local store
      localApkStore.summary.totalPassengerDownloads = 15;
      localApkStore.summary.totalDriverDownloads = 8;
      localApkStore.summary.totalDownloads = 23;
      localApkStore.summary.lastPassengerDownloadAt = new Date().toISOString();
      localApkStore.summary.lastDriverDownloadAt = new Date().toISOString();
      localApkStore.summary.lastDownloadAt = new Date().toISOString();

      const res = await request(app)
        .get('/api/v1/admin/analytics/downloads')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('summary');
      expect(res.body.data.summary.totalPassengerDownloads).toBe(15);
      expect(res.body.data.summary.totalDriverDownloads).toBe(8);
      expect(res.body.data.summary.totalDownloads).toBe(23);
      expect(res.body.data.summary.trackingStartedAt).toBe(TRACKING_STARTED_AT);
      expect(res.body.data).toHaveProperty('last7Days');
      expect(Array.isArray(res.body.data.last7Days)).toBe(true);
      expect(res.body.data.last7Days.length).toBe(7);
      expect(res.body.data).toHaveProperty('last30Days');
      expect(res.body.data.last30Days.length).toBe(30);
      expect(res.body.data).toHaveProperty('notice');
    });

    it('prevents public write or tampering with analytics endpoints', async () => {
      const resPost = await request(app).post('/api/v1/admin/analytics/downloads').send({ fakeCount: 999 });
      // Either 401 (auth required) or 404/405 (method not allowed)
      expect([401, 404, 405]).toContain(resPost.status);
    });
  });

  describe('4. Delivery Service Waiting List (Real Data Handling)', () => {
    it('GET /api/v1/deliveries/info returns public status COMING_SOON and modalities', async () => {
      const res = await request(app).get('/api/v1/deliveries/info');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('COMING_SOON');
      expect(res.body.label).toBe('Em Breve');
      expect(res.body.modalities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'motorcycle' }),
          expect.objectContaining({ type: 'bicycle' }),
        ])
      );
    });

    it('POST /api/v1/deliveries/waitlist validates required name and phone', async () => {
      const resBad = await request(app)
        .post('/api/v1/deliveries/waitlist')
        .send({ name: 'A', phone: '' });

      expect(resBad.status).toBe(400);
      expect(resBad.body.success).toBe(false);
    });

    it('POST /api/v1/deliveries/waitlist successfully registers courier/merchant interest', async () => {
      const res = await request(app)
        .post('/api/v1/deliveries/waitlist')
        .send({
          name: 'Carlos Oliveira',
          phone: '(12) 99888-7766',
          email: 'carlos@teste.com',
          role: 'courier_motorcycle',
          vehicleDetails: 'Honda CG 160 Fan 2024',
          neighborhood: 'Centro, São Sebastião',
          notes: 'Disponibilidade imediata para entregas comerciais.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe('Carlos Oliveira');
      expect(res.body.data.role).toBe('courier_motorcycle');

      // Verify entry is saved in store
      expect(localWaitlistStore.length).toBe(1);
      expect(localWaitlistStore[0].name).toBe('Carlos Oliveira');
    });

    it('GET /api/v1/admin/deliveries/waitlist allows authenticated admin to list entries', async () => {
      localWaitlistStore.push({
        id: 'waitlist_seed_1',
        name: 'Restaurante Sabor da Ilha',
        phone: '12997776655',
        email: 'contato@sabordailha.com.br',
        role: 'merchant',
        neighborhood: 'Maresias',
        createdAt: new Date().toISOString(),
      });

      const res = await request(app)
        .get('/api/v1/admin/deliveries/waitlist')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((e: any) => e.name === 'Restaurante Sabor da Ilha')).toBe(true);
    });

    it('POST /api/v1/deliveries/waitlist registers restaurant and pousada commercial partnership leads with business details', async () => {
      const res = await request(app)
        .post('/api/v1/deliveries/waitlist')
        .send({
          name: 'Pizzaria Maresias (Carlos Silva)',
          phone: '(12) 99123-4567',
          email: 'contato@pizzariamaresias.com.br',
          role: 'merchant',
          neighborhood: 'Maresias',
          vehicleDetails: 'Restaurante / Bar / Gastronomia',
          notes: 'Responsável: Carlos Silva | Interesse: Entregas Rápidas de Moto/Bike | Observações: Entregas no jantar',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe('Pizzaria Maresias (Carlos Silva)');
      expect(res.body.data.role).toBe('merchant');

      // Verify lead is stored in the list
      const saved = localWaitlistStore.find((e) => e.id === res.body.data.id);
      expect(saved).toBeDefined();
      expect(saved?.vehicleDetails).toBe('Restaurante / Bar / Gastronomia');
      expect(saved?.neighborhood).toBe('Maresias');
    });

    it('POST /api/v1/deliveries/waitlist rejects invalid phone number (< 10 digits)', async () => {
      const res = await request(app)
        .post('/api/v1/deliveries/waitlist')
        .send({
          name: 'Pousada Canto Verde',
          phone: '12345',
          role: 'merchant',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Telefone/WhatsApp');
    });
  });
});
