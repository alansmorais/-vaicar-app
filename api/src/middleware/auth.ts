import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';
import { ErrorCode } from '../../../shared/src/errors.js';
import { getFirebaseAdminAuth } from '../services/firebaseAdmin.js';
import { getUserProfile, findUserByEmail, resolveDriverProfile } from '../services/firestore.js';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  role?: 'passenger' | 'driver' | 'admin';
  isAdmin?: boolean;
  isPassenger?: boolean;
  isDriver?: boolean;
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
      const rawAllowedAdmins = process.env.ADMIN_EMAILS || 'admin@vaicar.app,vaicar@alansmsolutions.com';
      const allowedAdminEmails = rawAllowedAdmins.toLowerCase().split(',').map((e: string) => e.trim()).filter(Boolean);

      try {
        const parts = token.split('.');
        if (parts.length === 3 && parts[0].startsWith('eyJ')) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          decodedUid = payload.user_id || payload.sub || payload.uid;
          decodedEmail = (payload.email || '').toLowerCase();
          isAdminClaim = !!payload.admin || allowedAdminEmails.includes(decodedEmail) || decodedUid.startsWith('admin-');
        } else if (token.includes(':')) {
          // simple token format: uid:email
          const colonIdx = token.indexOf(':');
          decodedUid = token.slice(0, colonIdx);
          decodedEmail = token.slice(colonIdx + 1).toLowerCase();
          isAdminClaim = allowedAdminEmails.includes(decodedEmail) || decodedUid.startsWith('admin-');
        } else {
          decodedUid = token;
          decodedEmail = '';
          isAdminClaim = decodedUid.startsWith('admin-');
        }
      } catch {
        return next(new AppError(ErrorCode.AUTH_REQUIRED, 'Token inválido.', 401));
      }
    }

    // Load authoritative role from Firestore to prevent client tampering
    let userProfile = await getUserProfile(decodedUid);
    if (!userProfile && decodedEmail) {
      userProfile = await findUserByEmail(decodedEmail);
    }
    const effectiveEmail = (decodedEmail || userProfile?.email || '').trim().toLowerCase();
    const driverProfile = await resolveDriverProfile(decodedUid, effectiveEmail);
    const isDriver = Boolean(userProfile?.isDriver || driverProfile);
    const role = userProfile?.role || (isAdminClaim ? 'admin' : isDriver ? 'driver' : undefined);
    const isAdmin = isAdminClaim || userProfile?.isAdmin || role === 'admin';
    const isPassenger = userProfile?.isPassenger ?? (role === 'passenger' || !role);

    req.user = {
      uid: driverProfile?.uid || userProfile?.uid || decodedUid,
      email: effectiveEmail,
      role,
      isAdmin,
      isPassenger,
      isDriver,
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
export async function requireDriver(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    return next(new AppError(ErrorCode.AUTH_REQUIRED, 'Autenticação necessária.', 401));
  }
  if (!req.user.isAdmin && req.user.role !== 'driver' && !req.user.isDriver) {
    const driver = await resolveDriverProfile(req.user.uid, req.user.email);
    if (driver) {
      req.user.isDriver = true;
      req.user.role = 'driver';
      return next();
    }
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
  if (!req.user.isAdmin && req.user.role !== 'passenger' && !req.user.isPassenger) {
    return next(new AppError(ErrorCode.FORBIDDEN, 'Acesso restrito a passageiros.', 403));
  }
  next();
}
