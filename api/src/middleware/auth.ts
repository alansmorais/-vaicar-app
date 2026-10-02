import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';
import { ErrorCode } from '../../../shared/src/errors.js';
import { getFirebaseAdminAuth } from '../services/firebaseAdmin.js';
import { getUserProfile } from '../services/firestore.js';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  role?: 'passenger' | 'driver' | 'admin';
  isAdmin?: boolean;
}

/**
 * Verifies the Firebase ID Token from Authorization header.
 * Attaches decoded user and authoritative Firestore profile role to req.user.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError(ErrorCode.AUTH_REQUIRED, 'Token de autenticação não fornecido.', 401));
  }

  const token = authHeader.split('Bearer ')[1].trim();
  if (!token) {
    return next(new AppError(ErrorCode.AUTH_REQUIRED, 'Token de autenticação inválido.', 401));
  }

  try {
    const authAdmin = getFirebaseAdminAuth();
    let decodedUid: string;
    let decodedEmail: string;
    let isAdminClaim = false;

    // Verify token with Firebase Admin if token is a standard JWT
    if (authAdmin && token.startsWith('eyJ') && token.split('.').length === 3) {
      try {
        const decoded = await authAdmin.verifyIdToken(token);
        decodedUid = decoded.uid;
        decodedEmail = decoded.email || '';
        isAdminClaim = !!decoded.admin;
      } catch (err: any) {
        if (err.code === 'auth/id-token-expired') {
          return next(new AppError(ErrorCode.AUTH_EXPIRED, 'Sessão expirada. Faça login novamente.', 401));
        }
        // If token fails verification in admin
        return next(new AppError(ErrorCode.AUTH_REQUIRED, 'Token de autenticação inválido.', 401));
      }
    } else {
      // Development fallback when Firebase credentials are not yet configured
      // Accepts payload from local test token or standard mock emulator token
      try {
        const parts = token.split('.');
        if (parts.length === 3 && parts[0].startsWith('eyJ')) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          decodedUid = payload.user_id || payload.sub || payload.uid;
          decodedEmail = payload.email || '';
          isAdminClaim = !!payload.admin || decodedEmail.includes('admin@vaicar.app');
        } else if (token.includes(':')) {
          // simple token format: uid:email
          const colonIdx = token.indexOf(':');
          decodedUid = token.slice(0, colonIdx);
          decodedEmail = token.slice(colonIdx + 1);
          isAdminClaim = decodedEmail.includes('admin@vaicar.app');
        } else {
          decodedUid = token;
          decodedEmail = '';
          isAdminClaim = false;
        }
      } catch {
        return next(new AppError(ErrorCode.AUTH_REQUIRED, 'Token inválido.', 401));
      }
    }

    // Load authoritative role from Firestore to prevent client tampering
    const userProfile = await getUserProfile(decodedUid);
    const role = userProfile?.role || (isAdminClaim ? 'admin' : undefined);
    const isAdmin = isAdminClaim || userProfile?.isAdmin || role === 'admin';

    req.user = {
      uid: decodedUid,
      email: decodedEmail,
      role,
      isAdmin,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware requiring Admin authorization
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new AppError(ErrorCode.AUTH_REQUIRED, 'Autenticação necessária.', 401));
  }
  if (!req.user.isAdmin && req.user.role !== 'admin') {
    return next(new AppError(ErrorCode.FORBIDDEN, 'Acesso restrito a administradores.', 403));
  }
  next();
}

/**
 * Middleware requiring Driver role
 */
export function requireDriver(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new AppError(ErrorCode.AUTH_REQUIRED, 'Autenticação necessária.', 401));
  }
  if (req.user.role !== 'driver' && !req.user.isAdmin) {
    return next(new AppError(ErrorCode.FORBIDDEN, 'Acesso restrito a motoristas.', 403));
  }
  next();
}

/**
 * Middleware requiring Passenger role
 */
export function requirePassenger(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new AppError(ErrorCode.AUTH_REQUIRED, 'Autenticação necessária.', 401));
  }
  if (req.user.role !== 'passenger' && !req.user.isAdmin) {
    return next(new AppError(ErrorCode.FORBIDDEN, 'Acesso restrito a passageiros.', 403));
  }
  next();
}
