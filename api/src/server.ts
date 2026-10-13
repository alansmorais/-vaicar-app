import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initFirebaseAdmin } from './services/firebaseAdmin.js';

import { authRouter } from './routes/auth.js';
import { passengersRouter } from './routes/passengers.js';
import { driversRouter } from './routes/drivers.js';
import { ridesRouter } from './routes/rides.js';
import { adminRouter } from './routes/admin.js';
import { mapsRouter } from './routes/maps.js';
import { receiptsRouter } from './routes/receipts.js';
import { storageRouter } from './routes/storage.js';
import { reportsRouter } from './routes/reports.js';
import { liveRouter } from './routes/live.js';
import { searchRouter } from './routes/search.js';
import { deliveriesRouter } from './routes/deliveries.js';
import { handleApkDownloadServing } from './services/apkAnalytics.js';
import { listAllDrivers, listAllPassengers, listAllRides } from './services/firestore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// Initialize Firebase Admin SDK
initFirebaseAdmin();

// Global Middlewares
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(requestIdMiddleware);

import { getStoredFile } from './services/storage.js';

// Serve uploaded files statically
const publicUploads = path.resolve(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(publicUploads)) {
  fs.mkdirSync(publicUploads, { recursive: true });
}
app.use('/uploads', express.static(publicUploads));

// Fallback for multi-instance Cloud Run: retrieve from Firestore stored_files
app.get('/uploads/*', async (req, res, next) => {
  try {
    const relPath = req.path.replace(/^\/uploads\/?/, '');
    const stored = await getStoredFile(relPath);
    if (stored) {
      res.setHeader('Content-Type', stored.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      return res.send(stored.buffer);
    }
    return res.status(404).send('Arquivo não encontrado');
  } catch (err) {
    next(err);
  }
});

// Direct APK download endpoints with correct MIME type
const driverApkFileCandidates = [
  path.resolve(process.cwd(), 'public', 'downloads', 'vaicar-driver.apk'),
  path.resolve(process.cwd(), 'dist', 'web', 'downloads', 'vaicar-driver.apk'),
  path.resolve(process.cwd(), 'dist', 'downloads', 'vaicar-driver.apk'),
];

const passengerApkFileCandidates = [
  path.resolve(process.cwd(), 'public', 'downloads', 'vaicar-passenger.apk'),
  path.resolve(process.cwd(), 'dist', 'web', 'downloads', 'vaicar-passenger.apk'),
  path.resolve(process.cwd(), 'dist', 'downloads', 'vaicar-passenger.apk'),
];

const driverApkRoutes = [
  '/downloads/vaicar-driver.apk',
  '/download/vaicar-driver.apk',
  '/downloads/driver.apk',
  '/download/driver.apk',
];

const passengerApkRoutes = [
  '/downloads/vaicar-passenger.apk',
  '/download/vaicar-passenger.apk',
  '/downloads/passenger.apk',
  '/download/passenger.apk',
];

const serveDriverApk = handleApkDownloadServing('driver', driverApkFileCandidates, 'vaicar-driver.apk');
const servePassengerApk = handleApkDownloadServing('passenger', passengerApkFileCandidates, 'vaicar-passenger.apk');

// Direct APK download routes with strict analytics tracking and HEAD support
app.get(driverApkRoutes, serveDriverApk);
app.head(driverApkRoutes, serveDriverApk);

app.get(passengerApkRoutes, servePassengerApk);
app.head(passengerApkRoutes, servePassengerApk);

// Driver APK metadata endpoint
app.get('/api/v1/download/driver/metadata', (req, res) => {
  res.json({
    app: 'VaiCar Driver',
    package: 'com.vaicar.driver',
    version: '1.0.0',
    build: 1,
    generated: '2026-10-08 05:47:19 UTC',
    file: 'vaicar-driver.apk',
    downloadUrl: 'https://vaicar.app/downloads/vaicar-driver.apk',
    sizeBytes: 18181773,
    sizeFormatted: '18.2 MB',
    sha256: 'C0C8B5AD33907BF78C61512566ECE712AE68A2F68DF2B68085F2F037BEC37814',
    minSdk: 24,
    targetSdk: 34,
  });
});

// Passenger APK metadata endpoint
app.get('/api/v1/download/passenger/metadata', (req, res) => {
  res.json({
    app: 'VaiCar Passageiro',
    package: 'com.vaicar.passenger',
    version: '1.0.0',
    build: 1,
    generated: '2026-10-08 19:21:36 UTC',
    file: 'vaicar-passenger.apk',
    downloadUrl: 'https://vaicar.app/downloads/vaicar-passenger.apk',
    sizeBytes: 16826125,
    sizeFormatted: '16.8 MB',
    sha256: '15191069932046F5F2E0702914B6BC10FE2485AF9638EBA106538C0CB9B202F2',
    minSdk: 24,
    targetSdk: 34,
  });
});


// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    platform: 'VaiCar API v1',
    market: 'São Sebastião, Litoral Norte SP',
    timestamp: new Date().toISOString(),
    requestId: req.id,
  });
});

export const SAO_SEBASTIAO_ZONES = [
  { id: 'z-centro', name: 'Centro & Porto Grande', slug: 'centro-porto-grande', lat: -23.8055, lng: -45.4011, distanceFromCenterKm: 0.0, isActive: true },
  { id: 'z-topolandia', name: 'Topolândia & Itatinga', slug: 'topolandia-itatinga', lat: -23.8012, lng: -45.4120, distanceFromCenterKm: 1.5, isActive: true },
  { id: 'z-sao-francisco', name: 'São Francisco & Enseada', slug: 'sao-francisco-enseada', lat: -23.7543, lng: -45.3985, distanceFromCenterKm: 6.0, isActive: true },
  { id: 'z-barequecaba', name: 'Barequeçaba & Pitangueiras', slug: 'barequecaba-pitangueiras', lat: -23.8266, lng: -45.4389, distanceFromCenterKm: 4.8, isActive: true },
  { id: 'z-guaeca', name: 'Praia de Guaecá', slug: 'praia-de-guaeca', lat: -23.8291, lng: -45.4678, distanceFromCenterKm: 8.2, isActive: true },
  { id: 'z-toque-toque', name: 'Toque-Toque Grande e Pequeno', slug: 'toque-toque', lat: -23.8320, lng: -45.5230, distanceFromCenterKm: 14.0, isActive: true },
  { id: 'z-maresias', name: 'Maresias & Paúba', slug: 'maresias-pauba', lat: -23.7915, lng: -45.5683, distanceFromCenterKm: 27.5, isActive: true },
  { id: 'z-boicucanga', name: 'Boiçucanga', slug: 'boicucanga', lat: -23.7842, lng: -45.6175, distanceFromCenterKm: 34.0, isActive: true },
  { id: 'z-cambury', name: 'Cambury & Camburizinho', slug: 'cambury-camburizinho', lat: -23.7744, lng: -45.6492, distanceFromCenterKm: 38.0, isActive: true },
  { id: 'z-baleia-sahy', name: 'Baleia & Barra do Sahy', slug: 'baleia-barra-do-sahy', lat: -23.7745, lng: -45.6790, distanceFromCenterKm: 42.0, isActive: true },
  { id: 'z-juquehy', name: 'Juquehy', slug: 'juquehy', lat: -23.7661, lng: -45.7275, distanceFromCenterKm: 48.0, isActive: true },
  { id: 'z-barra-do-una', name: 'Barra do Una & Boracéia', slug: 'barra-do-una-boraceia', lat: -23.7550, lng: -45.7920, distanceFromCenterKm: 56.0, isActive: true },
];

// Platform metadata endpoint for Passenger & Driver apps
app.get(['/api/v1/meta', '/meta'], async (req, res) => {
  try {
    const [allRides, allDrivers, allPassengers] = await Promise.all([
      listAllRides().catch(() => []),
      listAllDrivers().catch(() => []),
      listAllPassengers().catch(() => []),
    ]);

    const approved = allDrivers.filter((d: any) => d.status === 'APPROVED');
    const online = approved.filter((d: any) => d.isOnline);
    const pending = allDrivers.filter((d: any) => d.status === 'PENDING_APPROVAL');
    const completed = allRides.filter((r: any) => r.status === 'COMPLETED');
    const active = allRides.filter((r: any) => ['REQUESTED', 'OFFERED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(r.status));

    const metrics = {
      totalDrivers: allDrivers.length,
      approvedDrivers: approved.length,
      onlineDrivers: online.length,
      pendingDrivers: pending.length,
      totalPassengers: allPassengers.length,
      activeSubscriptions: approved.length,
      monthlyRecurringRevenue: approved.length * 150.0,
      totalRides: allRides.length,
      completedRides: completed.length,
      activeRides: active.length,
      whatsappContactEvents: 0,
    };

    res.json({
      success: true,
      zones: SAO_SEBASTIAO_ZONES,
      metrics,
      data: {
        zones: SAO_SEBASTIAO_ZONES,
        metrics,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao obter metadados da plataforma',
    });
  }
});

// Mount /api/v1 routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/passengers', passengersRouter);
app.use('/api/v1/drivers', driversRouter);
app.use('/api/v1/rides', ridesRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/maps', mapsRouter);
app.use('/api/v1/receipts', receiptsRouter);
app.use('/api/v1/storage', storageRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/live', liveRouter);
app.use(['/api/v1/search', '/search'], searchRouter);
app.use('/api/v1/deliveries', deliveriesRouter);

// Serve frontend build if dist/web exists (for Production Cloud Run container)
const distWebPath = path.resolve(process.cwd(), 'dist', 'web');
const fallbackDistPath = path.resolve(process.cwd(), 'dist');

if (fs.existsSync(distWebPath)) {
  app.use(express.static(distWebPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distWebPath, 'index.html'));
  });
} else if (fs.existsSync(fallbackDistPath) && fs.existsSync(path.join(fallbackDistPath, 'index.html'))) {
  app.use(express.static(fallbackDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(fallbackDistPath, 'index.html'));
  });
} else {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>VaiCar — Servidor Ativo</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: system-ui, -apple-system, sans-serif; background: #020617; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box;">
        <div style="background: #0f172a; padding: 32px; border-radius: 16px; border: 1px solid #1e293b; max-width: 480px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <h2 style="color: #22c55e; margin: 0 0 12px;">VaiCar — Servidor Ativo</h2>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">A API está operando na porta 5001. Para carregar a interface web completa, compile o frontend executando:</p>
          <div style="background: #020617; color: #22c55e; padding: 12px; border-radius: 8px; font-family: monospace; font-weight: bold; margin-bottom: 12px; border: 1px solid #334155; text-align: left;">npm run build</div>
          <p style="color: #64748b; font-size: 13px; margin: 0;">Ou utilize <code style="color: #38bdf8;">npm run dev</code> para modo desenvolvedor na porta 5173.</p>
        </div>
      </body>
      </html>
    `);
  });
}

// Global Error Handler
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`🚀 [VaiCar API] Running on port ${config.port} | Mode: ${config.env}`);
    console.log(`📍 Market: São Sebastião, SP | Domain: https://vaicar.app`);
  });
}
