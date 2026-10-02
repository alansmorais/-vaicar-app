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

// Serve uploaded files statically
const publicUploads = path.resolve(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(publicUploads)) {
  fs.mkdirSync(publicUploads, { recursive: true });
}
app.use('/uploads', express.static(publicUploads));

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

// Mount /api/v1 routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/passengers', passengersRouter);
app.use('/api/v1/drivers', driversRouter);
app.use('/api/v1/rides', ridesRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/maps', mapsRouter);
app.use('/api/v1/receipts', receiptsRouter);
app.use('/api/v1/storage', storageRouter);

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
}

// Global Error Handler
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`🚀 [VaiCar API] Running on port ${config.port} | Mode: ${config.env}`);
    console.log(`📍 Market: São Sebastião, SP | Domain: https://vaicar.app`);
  });
}
