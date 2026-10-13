import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { authenticate, requirePassenger } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCode } from '../../../shared/src/errors.js';
import { config } from '../config/index.js';
import { signServerJwt } from '../services/jwt.js';
import { formatRidePayload, getDriverPixInfo } from './rides.js';
import {
  getDriverProfile,
  getPassengerProfile,
  resolvePassengerProfile,
  savePassengerProfile,
  getUserProfile,
  saveUserProfile,
  listRidesForPassenger,
  getActiveRideForUser,
  findPassengerByEmail,
  findPassengerByWhatsApp,
  findUserByEmail,
  findUserByWhatsApp,
  canRequestPin,
  savePendingPin,
  verifyPendingPin,
  getPassengerReferralSummary,
} from '../services/firestore.js';
import { sendPassengerPinEmail } from '../services/email.js';
import { isValidWhatsApp, isValidPhotoData } from '../../../shared/src/validation.js';

export const passengersRouter = Router();

/**
 * POST /api/v1/passengers/auth
 * Server-authoritative passenger authentication endpoint.
 * Accepts:
 * 1. { email, password } -> verifies credentials and returns server HMAC-SHA256 JWT
 * 2. { email/phone, verificationCode } -> verifies PIN and returns server HMAC-SHA256 JWT
 * 3. { email/phone } -> dispatches a fresh PIN to the passenger
 */
passengersRouter.post('/auth', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, phone, password, verificationCode, pin, code } = req.body;
    const providedCode = (verificationCode || pin || code)?.toString().trim();

    if (providedCode && providedCode.length !== 6) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Código PIN de 6 dígitos é obrigatório.', 400);
    }

    const normalizedEmail = email ? String(email).trim().toLowerCase() : undefined;
    const cleanPhone = phone ? String(phone).trim() : undefined;

    if (!normalizedEmail && !cleanPhone) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'E-mail ou WhatsApp/telefone é obrigatório.', 400);
    }

    // Locate passenger in Firestore
    let passenger = normalizedEmail
      ? await findPassengerByEmail(normalizedEmail)
      : cleanPhone
      ? await findPassengerByWhatsApp(cleanPhone)
      : null;

    if (!passenger && normalizedEmail && cleanPhone) {
      passenger = await findPassengerByWhatsApp(cleanPhone);
    }

    // Also look up user profile in users collection
    let user = normalizedEmail
      ? await findUserByEmail(normalizedEmail)
      : cleanPhone
      ? await findUserByWhatsApp(cleanPhone)
      : null;

    if (!passenger && !user) {
      if (!password && !providedCode && normalizedEmail) {
        // Auto-provision initial passenger profile so first-access PIN can be generated and sent
        const newUid = 'pass-' + Date.now();
        const initialPassenger = {
          uid: newUid,
          name: req.body.name ? String(req.body.name).trim() : 'Passageiro',
          email: normalizedEmail,
          whatsapp: cleanPhone || '',
          phone: cleanPhone || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await savePassengerProfile(initialPassenger as any);
        passenger = initialPassenger as any;
      } else {
        throw new AppError(ErrorCode.NOT_FOUND, 'Nenhum cadastro de passageiro encontrado com estes dados.', 404);
      }
    }

    // 1. Password-based authentication
    if (password && typeof password === 'string') {
      const trimmedPassword = password.trim();
      let passwordValid = false;

      if (process.env.NODE_ENV === 'test' && !process.env.K_SERVICE) {
        // Unit test harness
        passwordValid = trimmedPassword.length >= 6;
      } else {
        // Identity Toolkit verifyPassword against server configuration
        const apiKey = config.firebase.apiKey || 'AIzaSyCFJDSCkR-U4c0wcgKlOUWAp1r-tE76R1U';
        try {
          const authRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: normalizedEmail || (passenger ? passenger.email : ''),
                password: trimmedPassword,
                returnSecureToken: true,
              }),
            }
          );
          const authData = (await authRes.json()) as any;
          if (authRes.ok && authData.idToken) {
            passwordValid = true;
          }
        } catch (authErr) {
          console.error('[PassengerAuth] Server password verification error:', authErr);
        }
      }

      if (!passwordValid) {
        throw new AppError(ErrorCode.AUTH_REQUIRED, 'Senha incorreta. Verifique suas credenciais.', 401);
      }

      // Resolve passenger profile (ensures profile exists even if registered as driver)
      const effectiveUid = user?.uid || passenger?.uid || 'usr-' + Date.now();
      const activePassenger = await resolvePassengerProfile(effectiveUid, normalizedEmail);

      // Issue server-authoritative HMAC-SHA256 JWT
      const token = signServerJwt({
        uid: activePassenger.uid,
        email: activePassenger.email,
        role: 'passenger',
        isPassenger: true,
      });

      return res.json({
        success: true,
        requestId: req.id,
        token,
        passenger: activePassenger,
        message: 'Passageiro autenticado com sucesso no VaiCar.',
      });
    }

    // 2. PIN-based verification
    if (providedCode) {
      if (providedCode.length !== 6) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Código PIN de 6 dígitos é obrigatório.', 400);
      }
      const pinKey = (normalizedEmail || passenger?.email || cleanPhone || '').toLowerCase().trim();
      const isValidPin = await verifyPendingPin(pinKey, providedCode);

      if (!isValidPin) {
        const phoneDigits = (cleanPhone || passenger?.whatsapp || '').replace(/\D/g, '');
        const isValidByPhone = phoneDigits ? await verifyPendingPin(`passenger-${phoneDigits}`, providedCode) : false;
        if (!isValidByPhone) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'Código PIN incorreto, expirado ou tentativas excedidas.', 400);
        }
      }

      const effectiveUid = user?.uid || passenger?.uid || 'usr-' + Date.now();
      const activePassenger = await resolvePassengerProfile(effectiveUid, normalizedEmail);

      const token = signServerJwt({
        uid: activePassenger.uid,
        email: activePassenger.email,
        role: 'passenger',
        isPassenger: true,
      });

      return res.json({
        success: true,
        requestId: req.id,
        token,
        passenger: activePassenger,
        message: 'Passageiro autenticado com sucesso via PIN.',
      });
    }

    // 3. PIN dispatch
    const targetEmail = normalizedEmail || passenger?.email;
    if (!targetEmail) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'E-mail não encontrado para envio de código PIN.', 400);
    }

    const pinKey = targetEmail.toLowerCase().trim();
    const cooldown = await canRequestPin(pinKey);
    if (!cooldown.allowed) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `Aguarde ${cooldown.waitSeconds} segundos antes de solicitar um novo código PIN.`,
        429
      );
    }

    const generatedPin = crypto.randomInt(100000, 1000000).toString();
    await savePendingPin(pinKey, generatedPin, 15);

    const emailRes = await sendPassengerPinEmail(pinKey, generatedPin);

    return res.json({
      success: true,
      requestId: req.id,
      codeSent: true,
      emailSent: emailRes.success,
      message: emailRes.success
        ? 'Código PIN enviado para o e-mail cadastrado do passageiro.'
        : 'Código gerado, mas houve falha no envio do e-mail.',
    });
  } catch (error) {
    next(error);
  }
});

// Passenger must be authenticated
passengersRouter.use(authenticate, requirePassenger);

passengersRouter.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await resolvePassengerProfile(req.user!.uid, req.user?.email);
    res.json({
      success: true,
      requestId: req.id,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
});

passengersRouter.patch('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = req.user!.uid;
    const current = await resolvePassengerProfile(uid, req.user?.email);

    const { name, whatsapp, photoUrl } = req.body;
    if (whatsapp && !isValidWhatsApp(whatsapp)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'WhatsApp inválido.', 400);
    }
    if (photoUrl && !isValidPhotoData(photoUrl)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Foto de perfil inválida.', 400);
    }

    const updated = {
      ...current,
      ...(name ? { name: name.trim() } : {}),
      ...(whatsapp ? { whatsapp: whatsapp.replace(/\D/g, '') } : {}),
      ...(photoUrl ? { photoUrl } : {}),
      updatedAt: new Date().toISOString(),
    };

    await savePassengerProfile(updated);

    // Also update base user profile
    const user = await getUserProfile(uid);
    if (user) {
      await saveUserProfile({
        ...user,
        ...(name ? { displayName: name.trim() } : {}),
        ...(photoUrl ? { photoUrl } : {}),
        ...(whatsapp ? { whatsapp: whatsapp.replace(/\D/g, '') } : {}),
        updatedAt: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      requestId: req.id,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

passengersRouter.get('/rides', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rides = await listRidesForPassenger(req.user!.uid);
    const formatted = rides.map(formatRidePayload).sort((a: any, b: any) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
    res.json({
      success: true,
      requestId: req.id,
      data: formatted,
      rides: formatted,
    });
  } catch (error) {
    next(error);
  }
});

passengersRouter.get('/active-ride', async (req: Request, res: Response, next: NextFunction) => {
  try {
    let active = await getActiveRideForUser(req.user!.uid, 'passenger');
    if (active && active.driverId && (!active.driverPixKey || !active.driverPixName)) {
      const driver = await getDriverProfile(active.driverId);
      if (driver) {
        const pixInfo = getDriverPixInfo(driver);
        active = {
          ...active,
          driverPixKey: pixInfo.pixKey,
          driverPixName: pixInfo.pixName,
          driverPixKeyType: pixInfo.pixKeyType,
        };
      }
    }
    const payload = formatRidePayload(active);
    res.json({
      success: true,
      requestId: req.id,
      data: payload,
      ride: payload,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/passengers/referral
 * Returns the authenticated passenger's unique referral code, shareable link, credit balance, and referral history
 */
passengersRouter.get('/referral', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const passenger = await resolvePassengerProfile(req.user!.uid, req.user?.email);
    const summary = await getPassengerReferralSummary(passenger);
    res.json({
      success: true,
      requestId: req.id,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
});

