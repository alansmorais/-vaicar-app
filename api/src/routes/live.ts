import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { addLiveClient, removeLiveClient, broadcastLiveEvent, getLiveClientCount } from '../services/liveStream.js';
import { verifyServerJwt } from '../services/jwt.js';
import { getFirebaseAdminAuth } from '../services/firebaseAdmin.js';

export const liveRouter = Router();

/**
 * GET /api/v1/live/stream
 * EventSource cannot set Authorization headers, so browsers pass their current
 * Firebase ID token (or server JWT) as a query parameter. Verify it exactly as
 * the authenticated API does before associating the stream with a user.
 */
liveRouter.get('/stream', async (req: Request, res: Response) => {
  let userId: string | undefined;
  const authHeader = req.headers.authorization;
  const token = (typeof req.query.token === 'string' ? req.query.token : undefined) ||
    (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined);

  if (token) {
    const serverPayload = verifyServerJwt(token);
    if (serverPayload?.uid) {
      userId = serverPayload.uid;
    } else {
      const authAdmin = getFirebaseAdminAuth();
      if (authAdmin) {
        try {
          const decoded = await authAdmin.verifyIdToken(token);
          userId = decoded.uid;
        } catch {
          // Invalid/expired credentials receive a public stream only. The
          // authenticated API remains authoritative for all user data/actions.
        }
      }
    }
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  const clientId = `client-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  addLiveClient(clientId, res, userId);
  res.write(`event: CONNECTED\ndata: ${JSON.stringify({ type: 'CONNECTED', clientId, activeClients: getLiveClientCount(), timestamp: new Date().toISOString() })}\n\n`);

  req.on('close', () => removeLiveClient(clientId));
});

/**
 * GET /api/v1/live/status
 * Health inspection for SSE stream
 */
liveRouter.get('/status', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    activeClients: getLiveClientCount(),
    timestamp: new Date().toISOString(),
  });
});
