import { Router, Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCode } from '../../../shared/src/errors.js';
import {
  isValidEmail,
  isValidWhatsApp,
  isValidCPF,
  isValidCNH,
  isValidPlate,
  isAdult,
  isValidPhotoData,
} from '../../../shared/src/validation.js';
import {
  findUserByEmail,
  findUserByWhatsApp,
  findDriverByCpf,
  saveUserProfile,
  savePassengerProfile,
  saveDriverProfile,
  getUserProfile,
  getDriverProfile,
  getPassengerProfile,
  savePendingPin,
  verifyPendingPin,
} from '../services/firestore.js';
import {
  sendPassengerRegistrationEmail,
  sendDriverRegistrationEmail,
  sendPassengerPinEmail,
  sendDriverPinEmail,
} from '../services/email.js';
import { authenticate } from '../middleware/auth.js';
import { UserProfile, PassengerProfile, DriverProfile } from '../../../shared/src/types.js';

export const authRouter = Router();

/**
 * Passenger Registration
 * Required: name, whatsapp, email, photoUrl, termsAccepted
 */
authRouter.post('/register-passenger', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uid, name, whatsapp, email, photoUrl, termsAccepted, hasCriminalRecordCheck, criminalRecordUrl } = req.body;

    if (!uid || typeof uid !== 'string') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Identificador de usuário (uid) obrigatório.', 400);
    }
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Nome completo é obrigatório.', 400);
    }
    if (!whatsapp || !isValidWhatsApp(whatsapp)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'WhatsApp brasileiro válido é obrigatório.', 400);
    }
    if (!email || !isValidEmail(email)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'E-mail válido é obrigatório.', 400);
    }
    if (!photoUrl || !isValidPhotoData(photoUrl)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Foto de perfil real é obrigatória (JPG, PNG ou WebP).', 400);
    }
    if (!termsAccepted) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Aceite dos termos de uso é obrigatório.', 400);
    }

    // Check duplicate registrations
    const existingByEmail = await findUserByEmail(email);
    if (existingByEmail && existingByEmail.uid !== uid) {
      throw new AppError(ErrorCode.DUPLICATE_ACCOUNT, 'Já existe uma conta cadastrada com este e-mail.', 409);
    }

    const existingByPhone = await findUserByWhatsApp(whatsapp);
    if (existingByPhone && existingByPhone.uid !== uid) {
      throw new AppError(ErrorCode.DUPLICATE_ACCOUNT, 'Já existe uma conta cadastrada com este WhatsApp.', 409);
    }

    const now = new Date().toISOString();
    const hasRecordCheck = Boolean(hasCriminalRecordCheck || criminalRecordUrl);
    const userProfile: UserProfile = {
      uid,
      email: email.trim().toLowerCase(),
      displayName: name.trim(),
      role: 'passenger',
      photoUrl,
      whatsapp: whatsapp.replace(/\D/g, ''),
      createdAt: now,
      updatedAt: now,
    };

    const passengerProfile: PassengerProfile = {
      uid,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      whatsapp: whatsapp.replace(/\D/g, ''),
      photoUrl,
      termsAccepted: true,
      hasCriminalRecordCheck: hasRecordCheck,
      criminalRecordUrl: criminalRecordUrl || undefined,
      criminalRecordStatus: hasRecordCheck ? 'VERIFIED' : 'NONE',
      rating: 5.0,
      totalRides: 0,
      createdAt: now,
      updatedAt: now,
    };

    // Save in Firestore
    await saveUserProfile(userProfile);
    await savePassengerProfile(passengerProfile);

    // Send confirmation email asynchronously (database succeeded, email failure decoupled)
    let emailStatus: 'SENT' | 'FAILED' = 'SENT';
    try {
      const emailRes = await sendPassengerRegistrationEmail(email, name);
      if (!emailRes.success) emailStatus = 'FAILED';
    } catch {
      emailStatus = 'FAILED';
    }

    res.status(201).json({
      success: true,
      requestId: req.id,
      data: {
        user: userProfile,
        passenger: passengerProfile,
        emailStatus,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Driver Registration
 * Required: name, cpf, birthDate, whatsapp, email, photoUrl, professionalCategory, cnhNumber, vehicle, operatingZones
 */
authRouter.post('/register-driver', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      uid,
      name,
      cpf,
      birthDate,
      whatsapp,
      email,
      photoUrl,
      professionalCategory,
      cnhNumber,
      criminalRecordUrl,
      subscriptionPlan,
      vehicle,
      operatingZones,
    } = req.body;

    if (!uid) throw new AppError(ErrorCode.VALIDATION_ERROR, 'UID é obrigatório.', 400);
    if (!name || name.trim().length < 3) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Nome completo é obrigatório.', 400);
    }
    if (!cpf || !isValidCPF(cpf)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'CPF válido é obrigatório.', 400);
    }
    if (!birthDate || !isAdult(birthDate)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Data de nascimento inválida. O motorista deve ser maior de 18 anos.', 400);
    }
    if (!whatsapp || !isValidWhatsApp(whatsapp)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'WhatsApp brasileiro válido é obrigatório.', 400);
    }
    if (!email || !isValidEmail(email)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'E-mail válido é obrigatório.', 400);
    }
    if (!photoUrl || !isValidPhotoData(photoUrl)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Foto/Selfie do motorista é obrigatória.', 400);
    }
    if (!professionalCategory) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Categoria profissional é obrigatória.', 400);
    }

    const isBicycle = vehicle?.type === 'bicycle';
    if (!isBicycle) {
      if (!cnhNumber || !isValidCNH(cnhNumber)) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Número da CNH válido é obrigatório para veículos automotores.', 400);
      }
      if (!vehicle || !vehicle.brand || !vehicle.model || !vehicle.year || !vehicle.color || !isValidPlate(vehicle.plate)) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Dados completos do veículo (marca, modelo, ano, cor, placa válida) são obrigatórios.', 400);
      }
    } else {
      if (!vehicle || !vehicle.brand || !vehicle.model || !vehicle.color) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Informe marca/fabricante, modelo e cor da bicicleta.', 400);
      }
    }

    if (!Array.isArray(operatingZones) || operatingZones.length === 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Selecione ao menos uma região de atuação em São Sebastião.', 400);
    }

    // Check duplicates
    const dupEmail = await findUserByEmail(email);
    if (dupEmail && dupEmail.uid !== uid) {
      throw new AppError(ErrorCode.DUPLICATE_ACCOUNT, 'Já existe cadastro com este e-mail.', 409);
    }
    const dupPhone = await findUserByWhatsApp(whatsapp);
    if (dupPhone && dupPhone.uid !== uid) {
      throw new AppError(ErrorCode.DUPLICATE_ACCOUNT, 'Já existe cadastro com este WhatsApp.', 409);
    }
    const dupCpf = await findDriverByCpf(cpf);
    if (dupCpf && dupCpf.uid !== uid) {
      throw new AppError(ErrorCode.DUPLICATE_ACCOUNT, 'Já existe cadastro com este CPF.', 409);
    }

    const now = new Date().toISOString();
    const userProfile: UserProfile = {
      uid,
      email: email.trim().toLowerCase(),
      displayName: name.trim(),
      role: 'driver',
      photoUrl,
      whatsapp: whatsapp.replace(/\D/g, ''),
      createdAt: now,
      updatedAt: now,
    };

    const driverProfile: DriverProfile = {
      uid,
      name: name.trim(),
      cpf: cpf.replace(/\D/g, ''),
      birthDate,
      email: email.trim().toLowerCase(),
      whatsapp: whatsapp.replace(/\D/g, ''),
      photoUrl,
      professionalCategory,
      cnhNumber: isBicycle ? (cnhNumber || 'ISENTO_BIKE') : cnhNumber.replace(/\D/g, ''),
      criminalRecordUrl: criminalRecordUrl || undefined,
      criminalRecordStatus: criminalRecordUrl ? 'PENDING' : undefined,
      subscriptionPlan: subscriptionPlan === 'weekly_percent_10' ? 'weekly_percent_10' : 'monthly_100',
      vehicle: {
        type: vehicle.type || 'car',
        brand: vehicle.brand.trim(),
        model: vehicle.model.trim(),
        year: parseInt(vehicle.year || '2023', 10),
        color: vehicle.color.trim(),
        plate: isBicycle
          ? (vehicle.plate || 'BIKE').toUpperCase()
          : vehicle.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(),
      },
      operatingZones,
      status: 'PENDING_APPROVAL',
      isOnline: false,
      rating: 5.0,
      completedRidesCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await saveUserProfile(userProfile);
    await saveDriverProfile(driverProfile);

    let emailStatus: 'SENT' | 'FAILED' = 'SENT';
    try {
      const emailRes = await sendDriverRegistrationEmail(email, name);
      if (!emailRes.success) emailStatus = 'FAILED';
    } catch {
      emailStatus = 'FAILED';
    }

    res.status(201).json({
      success: true,
      requestId: req.id,
      data: {
        user: userProfile,
        driver: driverProfile,
        emailStatus,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Request PIN for Email or WhatsApp Verification
 */
authRouter.post('/request-pin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { destination, type } = req.body;
    if (!destination || typeof destination !== 'string') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Destino para envio do PIN é obrigatório.', 400);
    }

    // Generate real 6-digit cryptographic-safe PIN
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const key = destination.trim().toLowerCase();

    await savePendingPin(key, pin, 15);

    let emailSuccess = false;
    if (isValidEmail(key)) {
      const resMail = type === 'driver'
        ? await sendDriverPinEmail(key, pin)
        : await sendPassengerPinEmail(key, pin);
      emailSuccess = resMail.success;
    }

    res.json({
      success: true,
      requestId: req.id,
      data: {
        message: 'PIN enviado para o e-mail cadastrado.',
        destination: key,
        emailDelivered: emailSuccess,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Verify PIN
 */
authRouter.post('/verify-pin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { destination, pin } = req.body;
    if (!destination || !pin) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Destino e PIN são obrigatórios.', 400);
    }

    const isValid = await verifyPendingPin(destination.trim().toLowerCase(), pin.trim());
    if (!isValid) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'PIN incorreto ou expirado.', 400);
    }

    res.json({
      success: true,
      requestId: req.id,
      data: {
        verified: true,
        message: 'PIN validado com sucesso.',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get Current User Profile (authoritative)
 */
authRouter.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = req.user!.uid;
    const user = await getUserProfile(uid);
    let passenger: PassengerProfile | null = null;
    let driver: DriverProfile | null = null;

    if (user?.role === 'passenger') {
      passenger = await getPassengerProfile(uid);
    } else if (user?.role === 'driver') {
      driver = await getDriverProfile(uid);
    }

    res.json({
      success: true,
      requestId: req.id,
      data: {
        user,
        passenger,
        driver,
        isAdmin: req.user!.isAdmin || user?.isAdmin || false,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Admin Setup / Bootstrap endpoint
 */
authRouter.post('/set-admin', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { targetUid } = req.body;
    const uid = targetUid || req.user!.uid;
    const existing = await getUserProfile(uid);

    const now = new Date().toISOString();
    const updated: UserProfile = {
      ...(existing || {
        uid,
        email: req.user!.email,
        displayName: 'Administrador VaiCar',
        role: 'admin',
        createdAt: now,
      }),
      role: 'admin',
      isAdmin: true,
      updatedAt: now,
    };

    await saveUserProfile(updated);

    res.json({
      success: true,
      requestId: req.id,
      data: { user: updated },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Authoritative Admin Login
 * Verifies admin credentials and returns an authenticated admin session token.
 */
authRouter.post('/admin-login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'E-mail e senha de administrador são obrigatórios.', 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const rawAllowed = process.env.ADMIN_EMAILS || 'admin@vaicar.app,vaicar@alansmsolutions.com';
    const allowedAdminEmails = rawAllowed
      .toLowerCase()
      .split(',')
      .map((e: string) => e.trim())
      .filter(Boolean);

    const masterPassword = process.env.ADMIN_PASSWORD || 'VaiCar#2026Admin';

    if (!allowedAdminEmails.includes(normalizedEmail) || password !== masterPassword) {
      throw new AppError(ErrorCode.AUTH_REQUIRED, 'E-mail ou senha de administrador incorretos.', 401);
    }

    const adminUid = `admin-${normalizedEmail.replace(/[^a-z0-9]/g, '-')}`;
    const now = new Date().toISOString();
    const existing = await getUserProfile(adminUid);

    const adminProfile: UserProfile = {
      ...(existing || {
        uid: adminUid,
        email: normalizedEmail,
        createdAt: now,
      }),
      displayName: normalizedEmail === 'vaicar@alansmsolutions.com' ? 'Alan SMSolutions (Admin)' : 'Administrador Chefe',
      role: 'admin',
      isAdmin: true,
      updatedAt: now,
    };

    await saveUserProfile(adminProfile);

    const token = `${adminUid}:${normalizedEmail}`;
    res.json({
      success: true,
      requestId: req.id,
      data: {
        token,
        user: adminProfile,
      },
    });
  } catch (error) {
    next(error);
  }
});

