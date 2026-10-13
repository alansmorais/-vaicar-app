import crypto from 'crypto';
import { config } from '../config/index.js';

export interface ServerJwtPayload {
  uid: string;
  email: string;
  role: 'driver' | 'passenger' | 'admin';
  isDriver?: boolean;
  isPassenger?: boolean;
  isAdmin?: boolean;
  driverId?: string;
  iat?: number;
  exp?: number;
  [key: string]: any;
}

/**
 * Signs a server-authoritative HMAC-SHA256 JWT for session management.
 * Standard RFC 7519 format (header.payload.signature) encoded in base64url.
 */
export function signServerJwt(payload: ServerJwtPayload, expiresInSeconds = 30 * 24 * 3600): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: ServerJwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', config.jwtSecret)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url');

  return `${b64Header}.${b64Payload}.${signature}`;
}

/**
 * Verifies an HMAC-SHA256 JWT using constant-time comparison to prevent timing attacks.
 * Returns null if invalid, expired, or tampered.
 */
export function verifyServerJwt(token: string): ServerJwtPayload | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [b64Header, b64Payload, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', config.jwtSecret)
      .update(`${b64Header}.${b64Payload}`)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8')) as ServerJwtPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
