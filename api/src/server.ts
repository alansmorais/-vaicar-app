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
