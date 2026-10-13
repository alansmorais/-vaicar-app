import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';
import { ErrorCode } from '../../../shared/src/errors.js';
import { getFirebaseAdminAuth } from '../services/firebaseAdmin.js';
import { getUserProfile, findUserByEmail, resolveDriverProfile } from '../services/firestore.js';
import { verifyServerJwt } from '../services/jwt.js';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  role?: 'passenger' | 'driver' | 'admin';
  isAdmin?: boolean;
  isPassenger?: boolean;
  isDriver?: boolean;
}

/**
 * Verifies either the server HMAC-SHA256 JWT or Firebase ID Token from Authorization header.
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

    const rawAllowedAdmins = process.env.ADMIN_EMAILS || 'admin@vaicar.app,vaicar@alansmsolutions.com';
    const allowedAdminEmails = rawAllowedAdmins.toLowerCase().split(',').map((e: string) => e.trim()).filter(Boolean);

    // 1. Authoritative verification of server-signed HMAC-SHA256 JWT
    const serverPayload = verifyServerJwt(token);
    if (serverPayload && serverPayload.uid) {
      decodedUid = serverPayload.uid;
      decodedEmail = (serverPayload.email || '').toLowerCase();
      isAdminClaim = Boolean(serverPayload.isAdmin || serverPayload.role === 'admin' || (Boolean(decodedEmail) && allowedAdminEmails.includes(decodedEmail)));
    } else if (authAdmin) {
      // 2. Cryptographic verification with Firebase Admin
      try {
        const decoded = await authAdmin.verifyIdToken(token);
        decodedUid = decoded.uid;
        decodedEmail = (decoded.email || '').toLowerCase();
        isAdminClaim = Boolean(decoded.admin) || (Boolean(decodedEmail) && allowedAdminEmails.includes(decodedEmail));
      } catch (err: any) {
        if (err.code === 'auth/id-token-expired') {
          return next(new AppError(ErrorCode.AUTH_EXPIRED, 'Sessão expirada. Faça login novamente.', 401));
        }
        return next(new AppError(ErrorCode.AUTH_REQUIRED, 'Token de autenticação inválido ou não autorizado.', 401));
      }
    } else if (process.env.NODE_ENV === 'test' && !process.env.K_SERVICE) {
      // STRICT TEST HARNESS ONLY: Active solely during unit tests running without Google Cloud credentials
      if (token.includes(':')) {
        const colonIdx = token.indexOf(':');
        decodedUid = token.slice(0, colonIdx);
        decodedEmail = token.slice(colonIdx + 1).toLowerCase();
        isAdminClaim = allowedAdminEmails.includes(decodedEmail);
      } else {
        return next(new AppError(ErrorCode.AUTH_REQUIRED, 'Token de teste inválido.', 401));
      }
    } else {
      // Fail closed: No unverified token is ever accepted
      return next(new AppError(ErrorCode.AUTH_REQUIRED, 'Token de autenticação inválido ou não autorizado.', 401));
    }

    // Load authoritative role from Firestore to prevent client tampering
    let userProfile = await getUserProfile(decodedUid);
    if (!userProfile && decodedEmail) {
      userProfile = await findUserByEmail(decodedEmail);
    }
    const effectiveEmail = (decodedEmail || userProfile?.email || '').trim().toLowerCase();
    const driverProfile = await resolveDriverProfile(decodedUid, effectiveEmail);
    const isDriver = Boolean(userProfile?.isDriver || driverProfile);
    const role = isAdminClaim ? 'admin' : isDriver ? 'driver' : 'passenger';
    const isAdmin = Boolean(isAdminClaim || (userProfile?.isAdmin && allowedAdminEmails.includes(effectiveEmail)));
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
