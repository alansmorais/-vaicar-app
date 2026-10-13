import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { addLiveClient, removeLiveClient, broadcastLiveEvent, getLiveClientCount } from '../services/liveStream.js';
import { verifyServerJwt } from '../services/jwt.js';

export const liveRouter = Router();

/**
 * GET /api/v1/live/stream
 * Server-Sent Events (SSE) live event stream.
 */
liveRouter.get('/stream', (req: Request, res: Response) => {
  // Extract user info if token is provided via query or Authorization header
  let userId: string | undefined = undefined;
  const authHeader = req.headers.authorization;
  const token = (typeof req.query.token === 'string' ? req.query.token : undefined) ||
    (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined);

  if (token) {
    const verified = verifyServerJwt(token);
    if (verified && verified.uid) {
      userId = verified.uid;
    }
  }

  // Set SSE HTTP response headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  const clientId = `client-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  addLiveClient(clientId, res, userId);

  // Send initial handshake event
  res.write(`event: CONNECTED\ndata: ${JSON.stringify({ type: 'CONNECTED', clientId, activeClients: getLiveClientCount(), timestamp: new Date().toISOString() })}\n\n`);

  req.on('close', () => {
    removeLiveClient(clientId);
  });
});

/**
 * GET /api/v1/live/status
 * Health inspection for SSE stream
 */
liveRouter.get('/status', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    activeClients: getLiveClientCount(),
    timestamp: new Date().toISOString(),
  });
});
