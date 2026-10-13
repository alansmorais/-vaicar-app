import crypto from 'crypto';
import { Request, Response } from 'express';
import fs from 'fs';
import { getFirebaseAdminFirestore } from './firebaseAdmin.js';
import {
  ApkAppType,
  ApkDownloadAnalyticsResponse,
  ApkDownloadSummary,
  ApkDailyDownloadStat,
} from '../../../shared/src/types.js';

// Fixed date when server-side tracking began
export const TRACKING_STARTED_AT = '2026-10-09T14:00:00.000Z';

// In-memory deduplication cache: `${appType}:${anonymizedHash}` -> timestamp ms
const recentDownloads = new Map<string, number>();
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// In-memory fallback store for tests or offline environments without Firestore credentials
export const localApkStore = {
  summary: {
    totalPassengerDownloads: 0,
    totalDriverDownloads: 0,
    totalDownloads: 0,
    lastPassengerDownloadAt: null as string | null,
    lastDriverDownloadAt: null as string | null,
    lastDownloadAt: null as string | null,
    trackingStartedAt: TRACKING_STARTED_AT,
  },
  daily: new Map<string, { passenger: number; driver: number }>(),
  events: [] as Array<{
    appType: ApkAppType;
    downloadedAt: string;
    date: string;
    userAgentSummary: string;
  }>,
};

// Known crawlers, link previewers, and monitoring bots to exclude from download metrics
const BOT_USER_AGENTS = [
  'googlebot',
  'bingbot',
  'slurp',
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'facebookexternalhit',
  'facebot',
  'twitterbot',
  'whatsapp',
  'telegrambot',
  'slackbot',
  'discordbot',
  'linkedinbot',
  'applebot',
  'uptimerobot',
  'pingdom',
  'google-cloud-run-healthcheck',
  'postmanruntime',
];

/**
 * Checks if a user agent string belongs to an automated crawler, bot, or health check.
 */
export function isBotUserAgent(userAgent?: string): boolean {
  if (!userAgent) return false;
  const lower = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some((bot) => lower.includes(bot));
}

/**
 * Computes an anonymized, salted hash of the client without storing raw IP addresses.
 */
export function computeAnonymizedClientHash(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  const salt = 'vaicar-apk-dl-salt-2026';
  return crypto.createHash('sha256').update(`${ip}:${ua}:${salt}`).digest('hex').substring(0, 16);
}

/**
 * Formats a clean date string YYYY-MM-DD in America/Sao_Paulo (or UTC)
 */
export function getFormattedDateString(d: Date = new Date()): string {
  return d.toISOString().split('T')[0];
}

/**
 * Records an APK download event durably in Firestore (or local fallback).
 * Uses atomic increments so concurrent downloads are never lost.
 */
export async function recordApkDownload(appType: ApkAppType, req: Request): Promise<boolean> {
  const userAgent = req.headers['user-agent'] || '';
  if (isBotUserAgent(userAgent)) {
    return false;
  }

  const clientHash = computeAnonymizedClientHash(req);
  const dedupKey = `${appType}:${clientHash}`;
  const nowMs = Date.now();

  // Deduplication check: ignore repeat downloads from the same client within 5 minutes
  const lastDownload = recentDownloads.get(dedupKey);
  if (lastDownload && nowMs - lastDownload < DEDUP_WINDOW_MS) {
    return false;
  }
  recentDownloads.set(dedupKey, nowMs);

  // Periodic cleanup of deduplication map
  if (recentDownloads.size > 5000) {
    for (const [key, timestamp] of recentDownloads.entries()) {
      if (nowMs - timestamp > DEDUP_WINDOW_MS) {
        recentDownloads.delete(key);
      }
    }
  }

  const nowIso = new Date().toISOString();
  const dateKey = getFormattedDateString();
  const uaSummary = userAgent.substring(0, 120);

  const db = getFirebaseAdminFirestore();
  if (db) {
    try {
      const summaryRef = db.collection('apk_analytics').doc('summary');
      const dailyRef = db.collection('apk_analytics').doc(`daily_${dateKey}`);
      const eventsRef = db.collection('apk_download_events');

      const isPassenger = appType === 'passenger';
      const FieldValue = (await import('firebase-admin')).default.firestore.FieldValue;

      const batch = db.batch();

      batch.set(
        summaryRef,
        {
          totalPassengerDownloads: isPassenger ? FieldValue.increment(1) : FieldValue.increment(0),
          totalDriverDownloads: !isPassenger ? FieldValue.increment(1) : FieldValue.increment(0),
          totalDownloads: FieldValue.increment(1),
          ...(isPassenger
            ? { lastPassengerDownloadAt: nowIso, lastDownloadAt: nowIso }
            : { lastDriverDownloadAt: nowIso, lastDownloadAt: nowIso }),
          trackingStartedAt: TRACKING_STARTED_AT,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      batch.set(
        dailyRef,
        {
          date: dateKey,
          passenger: isPassenger ? FieldValue.increment(1) : FieldValue.increment(0),
          driver: !isPassenger ? FieldValue.increment(1) : FieldValue.increment(0),
          total: FieldValue.increment(1),
          updatedAt: nowIso,
        },
        { merge: true }
      );

      // Append anonymized event audit log
      const eventDoc = eventsRef.doc();
      batch.set(eventDoc, {
        appType,
        clientHash,
        userAgentSummary: uaSummary,
        downloadedAt: nowIso,
        date: dateKey,
      });

      await batch.commit();
      return true;
    } catch (err) {
      console.error('[ApkAnalytics] Error recording download to Firestore, using fallback:', err);
    }
  }

  // Local fallback (in-memory)
  const isPassenger = appType === 'passenger';
  if (isPassenger) {
    localApkStore.summary.totalPassengerDownloads += 1;
    localApkStore.summary.lastPassengerDownloadAt = nowIso;
  } else {
    localApkStore.summary.totalDriverDownloads += 1;
    localApkStore.summary.lastDriverDownloadAt = nowIso;
  }
  localApkStore.summary.totalDownloads += 1;
  localApkStore.summary.lastDownloadAt = nowIso;

  const currentDaily = localApkStore.daily.get(dateKey) || { passenger: 0, driver: 0 };
  if (isPassenger) {
    currentDaily.passenger += 1;
  } else {
    currentDaily.driver += 1;
  }
  localApkStore.daily.set(dateKey, currentDaily);

  localApkStore.events.push({
    appType,
    downloadedAt: nowIso,
    date: dateKey,
    userAgentSummary: uaSummary,
  });

  return true;
}

/**
 * Retrieves the consolidated download analytics for the authenticated admin dashboard.
 */
export async function getApkDownloadAnalytics(): Promise<ApkDownloadAnalyticsResponse> {
  const db = getFirebaseAdminFirestore();

  // Generate date array for the last 30 days (today backwards)
  const dates: string[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(getFormattedDateString(d));
  }

  let summary: ApkDownloadSummary = {
    totalPassengerDownloads: 0,
    totalDriverDownloads: 0,
    totalDownloads: 0,
    lastPassengerDownloadAt: null,
    lastDriverDownloadAt: null,
    lastDownloadAt: null,
    trackingStartedAt: TRACKING_STARTED_AT,
  };

  const dailyMap = new Map<string, { passenger: number; driver: number }>();

  if (db) {
    try {
      const summaryDoc = await db.collection('apk_analytics').doc('summary').get();
      if (summaryDoc.exists) {
        const data = summaryDoc.data() || {};
        summary = {
          totalPassengerDownloads: data.totalPassengerDownloads || 0,
          totalDriverDownloads: data.totalDriverDownloads || 0,
          totalDownloads: data.totalDownloads || 0,
          lastPassengerDownloadAt: data.lastPassengerDownloadAt || null,
          lastDriverDownloadAt: data.lastDriverDownloadAt || null,
          lastDownloadAt: data.lastDownloadAt || null,
          trackingStartedAt: data.trackingStartedAt || TRACKING_STARTED_AT,
        };
      }

      // Query daily documents for the last 30 days in parallel chunks
      const dailyDocs = await Promise.all(
        dates.map((dateStr) => db.collection('apk_analytics').doc(`daily_${dateStr}`).get())
      );

      for (let i = 0; i < dates.length; i++) {
        const doc = dailyDocs[i];
        if (doc && doc.exists) {
          const d = doc.data() || {};
          dailyMap.set(dates[i], {
            passenger: d.passenger || 0,
            driver: d.driver || 0,
          });
        }
      }
    } catch (err) {
      console.error('[ApkAnalytics] Error fetching analytics from Firestore, falling back to local store:', err);
    }
  }

  // If local store has data and Firestore was empty/offline
  if (summary.totalDownloads === 0 && localApkStore.summary.totalDownloads > 0) {
    summary = { ...localApkStore.summary };
    for (const [dateStr, counts] of localApkStore.daily.entries()) {
      dailyMap.set(dateStr, counts);
    }
  }

  // Build daily stats for last 30 days
  const last30Days: ApkDailyDownloadStat[] = dates.map((dateStr) => {
    const counts = dailyMap.get(dateStr) || { passenger: 0, driver: 0 };
    return {
      date: dateStr,
      passenger: counts.passenger,
      driver: counts.driver,
      total: counts.passenger + counts.driver,
    };
  });

  // Last 7 days slice (most recent 7 days)
  const last7Days = last30Days.slice(-7);

  return {
    summary,
    last7Days,
    last30Days,
    notice: 'Rastreamento auditado iniciado em 09/10/2026. Contabiliza exclusivamente transferências completadas com sucesso via HTTP GET. Requisições HEAD, robôs de busca e pré-visualizações são descartados.',
  };
}

/**
 * Express handler to serve an APK file with strict analytics tracking:
 * - HEAD requests: serve headers only, no count increment.
 * - Non-GET requests: handled appropriately.
 * - GET requests: stream file; record download ONLY if transfer completes successfully.
 */
export function handleApkDownloadServing(
  appType: ApkAppType,
  fileCandidates: string[],
  filename: string
) {
  return (req: Request, res: Response) => {
    let targetPath: string | null = null;
    for (const candidate of fileCandidates) {
      if (fs.existsSync(candidate)) {
        targetPath = candidate;
        break;
      }
    }

    if (!targetPath) {
      return res.status(404).send(`Arquivo ${filename} não encontrado.`);
    }

    const stat = fs.statSync(targetPath);

    // Set authoritative APK headers
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Accept-Ranges', 'bytes');

    // HEAD requests: MUST NEVER increment download counters
    if (req.method === 'HEAD') {
      return res.status(200).end();
    }

    // GET requests: serve file and register download upon successful delivery
    res.sendFile(targetPath, (err) => {
      if (err) {
        // Download was interrupted, cancelled by client, or failed before completion
        return;
      }

      // Check if response completed with success status code and was not prematurely closed
      if (res.statusCode >= 200 && res.statusCode < 300 && !req.destroyed) {
        // Record download asynchronously without blocking response
        recordApkDownload(appType, req).catch((recErr) => {
          console.error(`[ApkAnalytics] Failed to record ${appType} download:`, recErr);
        });
      }
    });
  };
}
