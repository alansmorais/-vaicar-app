import { Response } from 'express';

export interface LiveClient {
  id: string;
  userId?: string;
  res: Response;
  connectedAt: string;
}

const clients = new Map<string, LiveClient>();

// Ping all active clients every 20 seconds to prevent proxy / Cloud Run timeouts
let pingInterval: NodeJS.Timeout | null = null;

function ensurePingInterval() {
  if (pingInterval) return;
  pingInterval = setInterval(() => {
    for (const [id, client] of clients.entries()) {
      try {
        client.res.write(': ping\n\n');
      } catch {
        clients.delete(id);
      }
    }
    if (clients.size === 0 && pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  }, 20000);
  if (pingInterval.unref) pingInterval.unref();
}

export function addLiveClient(id: string, res: Response, userId?: string): void {
  clients.set(id, {
    id,
    userId,
    res,
    connectedAt: new Date().toISOString(),
  });
  ensurePingInterval();
}

export function removeLiveClient(id: string): void {
  clients.delete(id);
}

export function getLiveClientCount(): number {
  return clients.size;
}

/**
 * Broadcasts an event via Server-Sent Events to all connected clients,
 * or targeted to a specific userId if specified.
 */
export function broadcastLiveEvent(eventType: string, data: any, targetUserId?: string | string[]): void {
  const payload = JSON.stringify({
    type: eventType,
    data,
    timestamp: new Date().toISOString(),
  });

  const message = `event: ${eventType}\ndata: ${payload}\n\n`;
  const targets = Array.isArray(targetUserId)
    ? targetUserId.filter(Boolean)
    : targetUserId
    ? [targetUserId]
    : null;

  for (const [id, client] of clients.entries()) {
    if (!targets || (client.userId && targets.includes(client.userId))) {
      try {
        client.res.write(message);
      } catch (err) {
        console.error(`[SSE] Error writing to client ${id}:`, err);
        clients.delete(id);
      }
    }
  }
}
