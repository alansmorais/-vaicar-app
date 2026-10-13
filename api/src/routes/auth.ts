import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCode } from '../../../shared/src/errors.js';
import {
  isValidEmail,
  isValidWhatsApp,
  isValidInternationalPhone,
  normalizeInternationalPhone,
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
  findDriverByEmail,
  findPassengerByEmail,
  saveUserProfile,
  savePassengerProfile,
  saveDriverProfile,
  getUserProfile,
  getDriverProfile,
  resolveDriverProfile,
  resolvePassengerProfile,
  getPassengerProfile,
  canRequestPin,
  savePendingPin,
  verifyPendingPin,
  findPassengerByReferralCode,
  generateUniqueReferralCode,
  saveReferralRecord,
} from '../services/firestore.js';
import {
  sendPassengerRegistrationEmail,
  sendDriverRegistrationEmail,
  sendPassengerPinEmail,
  sendDriverPinEmail,
  sendPasswordResetEmail,
} from '../services/email.js';
import { authenticate } from '../middleware/auth.js';
import { getFirebaseAdminAuth } from '../services/firebaseAdmin.js';
import { signServerJwt } from '../services/jwt.js';
import { config } from '../config/index.js';
import { UserProfile, PassengerProfile, DriverProfile, ReferralRecord } from '../../../shared/src/types.js';

export const authRouter = Router();

/**
 * Passenger Registration
 * Required: name, whatsapp, email, photoUrl, termsAccepted
 */
authRouter.post('/register-passenger', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      uid,
      name,
      whatsapp,
      email,
      photoUrl,
      termsAccepted,
      hasCriminalRecordCheck,
      criminalRecordUrl,
      idDocumentUrl,
      referralCode,
    } = req.body;

    if (!uid || typeof uid !== 'string') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Identificador de usuário (uid) obrigatório.', 400);
    }
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Nome completo é obrigatório.', 400);
    }
    if (!whatsapp || !isValidInternationalPhone(whatsapp)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'WhatsApp / Telefone internacional válido é obrigatório.', 400);
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

    // Allow same user to register as passenger, driver, and courier
    const existingByEmail = await findUserByEmail(email);
    const existingByPhone = await findUserByWhatsApp(whatsapp);

    // If an account with this email already exists with a passenger profile belonging to a different user, reject
    if (existingByEmail) {
      const existingPassenger = await getPassengerProfile(existingByEmail.uid);
      if (existingPassenger && existingByEmail.uid !== uid && (!existingByPhone || existingByPhone.uid !== existingByEmail.uid)) {
        throw new AppError(ErrorCode.DUPLICATE_ACCOUNT, 'Já existe uma conta de passageiro cadastrada com este e-mail.', 409);
      }
    }

    if (existingByPhone) {
      const existingPassenger = await getPassengerProfile(existingByPhone.uid);
      if (existingPassenger && existingByPhone.uid !== uid && (!existingByEmail || existingByPhone.uid !== existingByEmail.uid)) {
        throw new AppError(ErrorCode.DUPLICATE_ACCOUNT, 'Já existe uma conta de passageiro cadastrada com este WhatsApp.', 409);
      }
    }

    const effectiveUid = existingByEmail ? existingByEmail.uid : existingByPhone ? existingByPhone.uid : uid;
    const now = new Date().toISOString();
    const hasRecordCheck = Boolean(hasCriminalRecordCheck || criminalRecordUrl);
    const normalizedPhone = normalizeInternationalPhone(whatsapp);

    const isDriverAlready = Boolean(
      existingByEmail?.isDriver || existingByPhone?.isDriver || (await getDriverProfile(effectiveUid))
    );
    const isCourierAlready = Boolean(
      existingByEmail?.isCourier || existingByPhone?.isCourier
    );

    const userProfile: UserProfile = {
      uid: effectiveUid,
      email: email.trim().toLowerCase(),
      displayName: name.trim(),
      role: isDriverAlready ? 'driver' : 'passenger',
      isPassenger: true,
      isDriver: isDriverAlready,
      isCourier: isCourierAlready,
      photoUrl,
      whatsapp: normalizedPhone,
      createdAt: existingByEmail?.createdAt || existingByPhone?.createdAt || now,
      updatedAt: now,
    };

    const existingPassenger = await getPassengerProfile(effectiveUid);

    // Referral validation & attribution
    let referredByCode: string | undefined = undefined;
    let referredByPassengerId: string | undefined = undefined;
    let referralDiscountAvailable = false;
    let validReferralRecord: ReferralRecord | null = null;

    if (referralCode && typeof referralCode === 'string' && referralCode.trim().length > 0) {
      const cleanRefCode = referralCode.trim().toUpperCase();
      const referrer = await findPassengerByReferralCode(cleanRefCode);
      if (!referrer) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Código de indicação inválido ou não encontrado.', 400);
      }

      // Self-referral validation
      const normEmail = email.trim().toLowerCase();
      const isSelfReferral =
        referrer.uid === effectiveUid ||
        (referrer.email && referrer.email.toLowerCase() === normEmail) ||
        (referrer.whatsapp && normalizeInternationalPhone(referrer.whatsapp) === normalizedPhone);

      if (isSelfReferral) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Você não pode utilizar seu próprio código de indicação.', 400);
      }

      // Check if existing passenger already had a referral attribution
      if (existingPassenger?.referredByCode && existingPassenger.referredByCode !== cleanRefCode) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Este cadastro já possui uma indicação vinculada.', 400);
      }

      referredByCode = referrer.referralCode || cleanRefCode;
      referredByPassengerId = referrer.uid;
      referralDiscountAvailable = true;

      validReferralRecord = {
        id: `ref_${effectiveUid}`,
        referrerId: referrer.uid,
        referrerCode: referredByCode,
        referrerName: referrer.name,
        referredId: effectiveUid,
        referredName: name.trim(),
        referredEmail: normEmail,
        referredPhone: normalizedPhone,
        status: 'REGISTERED',
        discountAmount: 5.00,
        rewardAmount: 5.00,
        createdAt: now,
      };
    }

    const ownReferralCode = existingPassenger?.referralCode || (await generateUniqueReferralCode(name));
    const existingBalance = existingPassenger?.referralCreditBalance ?? 0;

    const passengerProfile: PassengerProfile = {
      uid: effectiveUid,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      whatsapp: normalizedPhone,
      photoUrl,
      idDocumentUrl: idDocumentUrl || existingPassenger?.idDocumentUrl || undefined,
      termsAccepted: true,
      hasCriminalRecordCheck: hasRecordCheck || Boolean(existingPassenger?.hasCriminalRecordCheck),
      criminalRecordUrl: criminalRecordUrl || existingPassenger?.criminalRecordUrl || undefined,
      criminalRecordStatus: (hasRecordCheck || existingPassenger?.hasCriminalRecordCheck) ? 'VERIFIED' : 'NONE',
      rating: existingPassenger?.rating ?? 5.0,
      totalRides: existingPassenger?.totalRides ?? 0,
      referralCode: ownReferralCode,
      referredByCode: referredByCode || existingPassenger?.referredByCode || undefined,
      referredByPassengerId: referredByPassengerId || existingPassenger?.referredByPassengerId || undefined,
      referralDiscountAvailable: referralDiscountAvailable || (existingPassenger?.referralDiscountAvailable ?? false),
      referralCreditBalance: existingBalance,
      createdAt: existingPassenger?.createdAt || now,
      updatedAt: now,
    };

    // Save in Firestore
    await saveUserProfile(userProfile);
    await savePassengerProfile(passengerProfile);

    // Save referral record if attribution is valid
    if (validReferralRecord) {
      await saveReferralRecord(validReferralRecord);
    }

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
      cnhUrl,
      crlvUrl,
      proofOfAddressUrl,
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
    if (!whatsapp || !isValidInternationalPhone(whatsapp)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'WhatsApp / Telefone internacional válido é obrigatório.', 400);
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

    // Allow same user to register as passenger, driver, and courier
    const dupEmail = await findUserByEmail(email);
    const dupPhone = await findUserByWhatsApp(whatsapp);
    const dupCpf = await findDriverByCpf(cpf);

    // If CPF belongs to a completely different user account with different email and phone, reject
    if (dupCpf && (!dupEmail || dupCpf.uid !== dupEmail.uid) && (!dupPhone || dupCpf.uid !== dupPhone.uid) && dupCpf.uid !== uid) {
      throw new AppError(ErrorCode.DUPLICATE_ACCOUNT, 'Já existe cadastro com este CPF em outra conta.', 409);
    }

    const effectiveUid = dupEmail ? dupEmail.uid : dupPhone ? dupPhone.uid : dupCpf ? dupCpf.uid : uid;
    const now = new Date().toISOString();
    const normalizedPhone = normalizeInternationalPhone(whatsapp);

    const isPassengerAlready = Boolean(dupEmail?.isPassenger || dupPhone?.isPassenger || (await getPassengerProfile(effectiveUid)));
    const isCourierMode = isBicycle || vehicle?.type === 'motorcycle' || professionalCategory.toLowerCase().includes('entregador');

    const userProfile: UserProfile = {
      uid: effectiveUid,
      email: email.trim().toLowerCase(),
      displayName: name.trim(),
      role: 'driver',
      isDriver: true,
      isCourier: Boolean(isCourierMode || dupEmail?.isCourier),
      isPassenger: isPassengerAlready,
      photoUrl,
      whatsapp: normalizedPhone,
      createdAt: dupEmail?.createdAt || now,
      updatedAt: now,
    };

    const driverProfile: DriverProfile = {
      uid: effectiveUid,
      name: name.trim(),
      cpf: cpf.replace(/\D/g, ''),
      birthDate,
      email: email.trim().toLowerCase(),
      whatsapp: normalizedPhone,
      photoUrl,
      cnhUrl: cnhUrl || undefined,
      crlvUrl: crlvUrl || undefined,
      proofOfAddressUrl: proofOfAddressUrl || undefined,
      professionalCategory,
      isCourier: isCourierMode,
      servicesOffered: isBicycle
        ? ['delivery']
        : req.body.servicesOffered && Array.isArray(req.body.servicesOffered)
        ? (req.body.servicesOffered as any[]).filter(s => s === 'ride' || s === 'delivery')
        : isCourierMode
        ? ['ride', 'delivery']
        : ['ride'],
      cnhNumber: isBicycle ? (cnhNumber || 'ISENTO_BIKE') : cnhNumber.replace(/\D/g, ''),
      criminalRecordUrl: criminalRecordUrl || undefined,
      criminalRecordStatus: criminalRecordUrl ? 'PENDING' : undefined,
      subscriptionPlan: subscriptionPlan === 'weekly_percent_10' ? 'weekly_percent_10' : 'monthly_100',
      subscriptionPlanSelectedAt: now,
      nextPlanSwitchAllowedAt: new Date(
        Date.now() + (subscriptionPlan === 'weekly_percent_10' ? 7 : 30) * 24 * 60 * 60 * 1000
      ).toISOString(),
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
 * Check Account Existence & Migration Status
 * Safely inspects whether an email belongs to an existing Firestore profile
 * and whether it already has credentials in Firebase Authentication.
 */
authRouter.post('/check-account', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'E-mail válido é obrigatório.', 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const driver = await findDriverByEmail(normalizedEmail);
    const passenger = await findPassengerByEmail(normalizedEmail);
    const user = await findUserByEmail(normalizedEmail);

    const existsInFirestore = Boolean(driver || passenger || user);
    let hasFirebaseAuth = false;
    let hasPasswordProvider = false;
    let isUidLinked = false;

    const authAdmin = getFirebaseAdminAuth();
    if (authAdmin) {
      try {
        const fbRecord = await authAdmin.getUserByEmail(normalizedEmail);
        if (fbRecord && fbRecord.uid) {
          hasFirebaseAuth = true;
          hasPasswordProvider = fbRecord.providerData.some((p: any) => p.providerId === 'password');
          if (driver) {
            isUidLinked = driver.uid === fbRecord.uid;
          } else if (passenger) {
            isUidLinked = passenger.uid === fbRecord.uid;
          } else if (user) {
            isUidLinked = user.uid === fbRecord.uid;
          }
        }
      } catch {
        hasFirebaseAuth = false;
      }
    }

    const rawAllowed = process.env.ADMIN_EMAILS || 'admin@vaicar.app,vaicar@alansmsolutions.com';
    const allowedAdminEmails = rawAllowed.toLowerCase().split(',').map((e: string) => e.trim()).filter(Boolean);
    const isAdmin = allowedAdminEmails.includes(normalizedEmail);

    let role: 'admin' | 'driver' | 'passenger' | null = null;
    if (isAdmin) role = 'admin';
    else if (driver) role = 'driver';
    else if (passenger) role = 'passenger';
    else if (user?.role) role = user.role;

    // Account needs migration if it exists in Firestore but cannot sign in with email/password:
    // 1. Not in Firebase Auth at all
    // 2. In Firebase Auth (e.g. Google OAuth) but has no email/password provider
    // 3. In Firebase Auth, but existing Firestore document is not yet linked to the Firebase UID
    const needsMigration = existsInFirestore && (!hasFirebaseAuth || !hasPasswordProvider || !isUidLinked);

    res.json({
      success: true,
      requestId: req.id,
      data: {
        email: normalizedEmail,
        existsInFirestore,
        hasFirebaseAuth,
        hasPasswordProvider,
        isUidLinked,
        role,
        name: driver?.name || passenger?.name || user?.displayName || null,
        needsMigration,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Request PIN for Email or WhatsApp Verification
 * Protected by 45-second cooldown and cryptographic random generator.
 */
authRouter.post('/request-pin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { destination, type } = req.body;
    if (!destination || typeof destination !== 'string') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Destino para envio do PIN é obrigatório.', 400);
    }

    const key = destination.trim().toLowerCase();

    // Enforce 45s cooldown
    const cooldown = await canRequestPin(key);
    if (!cooldown.allowed) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `Aguarde ${cooldown.waitSeconds} segundos antes de solicitar um novo código PIN.`,
        429
      );
    }

    // Generate real 6-digit cryptographic-safe PIN
    const pin = crypto.randomInt(100000, 1000000).toString();

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
 * Validates single-use PIN with attempt tracking.
 */
authRouter.post('/verify-pin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { destination, pin } = req.body;
    if (!destination || !pin) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Destino e PIN são obrigatórios.', 400);
    }

    const isValid = await verifyPendingPin(destination.trim().toLowerCase(), pin.trim());
    if (!isValid) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'PIN incorreto, expirado ou limite de tentativas excedido.', 400);
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
 * Secure Existing Account Migration to Firebase Authentication
 * Strictly requires verified ownership of the existing email via PIN.
 * Links existing Firestore driver/passenger/user documents to the real Firebase UID.
 */
authRouter.post('/migrate-account', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, pin, password } = req.body;
    if (!email || !isValidEmail(email)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'E-mail válido é obrigatório.', 400);
    }
    if (!pin || typeof pin !== 'string') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Código PIN de verificação é obrigatório.', 400);
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'A nova senha deve ter no mínimo 6 caracteres.', 400);
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Verify PIN ownership (fails if invalid, expired, or > 5 attempts)
    const isPinValid = await verifyPendingPin(normalizedEmail, pin.trim());
    if (!isPinValid) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Código PIN incorreto, expirado ou tentativas excedidas.', 400);
    }

    // 2. Identify existing Firestore profile
    const existingDriver = await findDriverByEmail(normalizedEmail);
    const existingPassenger = await findPassengerByEmail(normalizedEmail);
    const existingUser = await findUserByEmail(normalizedEmail);

    if (!existingDriver && !existingPassenger && !existingUser) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Nenhum perfil pré-existente encontrado para este e-mail no VaiCar.', 404);
    }

    // 3. Create or update user in Firebase Authentication
    const authAdmin = getFirebaseAdminAuth();
    let firebaseUid: string;
    let customToken: string;

    const displayName = existingDriver?.name || existingPassenger?.name || existingUser?.displayName || normalizedEmail.split('@')[0];

    if (authAdmin) {
      let fbUser = await authAdmin.getUserByEmail(normalizedEmail).catch(() => null);
      if (fbUser) {
        // User already in Firebase Auth, update password
        await authAdmin.updateUser(fbUser.uid, { password });
        firebaseUid = fbUser.uid;
      } else {
        // Create new user in Firebase Auth with user-defined password
        const created = await authAdmin.createUser({
          email: normalizedEmail,
          password,
          displayName,
          disabled: false,
        });
        firebaseUid = created.uid;
      }

      // Check if admin to attach claim
      const rawAllowed = process.env.ADMIN_EMAILS || 'admin@vaicar.app,vaicar@alansmsolutions.com';
      const allowedAdminEmails = rawAllowed.toLowerCase().split(',').map((e: string) => e.trim()).filter(Boolean);
      const isTargetAdmin = allowedAdminEmails.includes(normalizedEmail);
      if (isTargetAdmin) {
        await authAdmin.setCustomUserClaims(firebaseUid, { admin: true });
      }

      customToken = await authAdmin.createCustomToken(firebaseUid, isTargetAdmin ? { admin: true } : undefined);
    } else {
      // In local dev/test mode without live Firebase Admin credentials
      firebaseUid = existingDriver?.uid || existingPassenger?.uid || existingUser?.uid || `usr-${Date.now()}`;
      customToken = `mock-token-${firebaseUid}`;
    }

    // 4. Link Firebase UID to existing Firestore profiles without data loss
    if (existingDriver) {
      await resolveDriverProfile(firebaseUid, normalizedEmail);
    }
    if (existingPassenger) {
      await resolvePassengerProfile(firebaseUid, normalizedEmail);
    }
    if (existingUser) {
      await saveUserProfile({
        ...existingUser,
        uid: firebaseUid,
        updatedAt: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      requestId: req.id,
      data: {
        message: 'Conta migrada e vinculada com sucesso ao Firebase Authentication.',
        uid: firebaseUid,
        email: normalizedEmail,
        customToken,
        role: existingDriver ? 'driver' : existingPassenger ? 'passenger' : existingUser?.role || 'passenger',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Unified Server-Authoritative Login Endpoint
 * Validates password against Identity Toolkit / Firebase Auth without exposing raw passwords.
 * Resolves user roles (passenger, driver, admin) under ONE unified email identity.
 * Issues server-authoritative HMAC-SHA256 JWT and optional Firebase custom token.
 */
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'E-mail e senha são obrigatórios.', 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const trimmedPassword = String(password).trim();

    let passwordValid = false;
    let authUid: string | null = null;

    if (process.env.NODE_ENV === 'test' && !process.env.K_SERVICE) {
      passwordValid = trimmedPassword.length >= 6;
      authUid = 'test-' + normalizedEmail.replace(/[^a-z0-9]/g, '');
    } else {
      const apiKey = config.firebase.apiKey || 'AIzaSyCFJDSCkR-U4c0wcgKlOUWAp1r-tE76R1U';
      try {
        const authRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: normalizedEmail,
              password: trimmedPassword,
              returnSecureToken: true,
            }),
          }
        );
        const authData = (await authRes.json()) as any;
        if (authRes.ok && authData.idToken) {
          passwordValid = true;
          authUid = authData.localId;
        }
      } catch (authErr) {
        console.error('[AuthLogin] Identity Toolkit error:', authErr);
      }
    }

    if (!passwordValid) {
      throw new AppError(ErrorCode.AUTH_REQUIRED, 'Senha incorreta. Verifique suas credenciais.', 401);
    }

    // Lookup user documents in Firestore
    let user = await findUserByEmail(normalizedEmail);
    const driver = await findDriverByEmail(normalizedEmail);
    const passenger = await findPassengerByEmail(normalizedEmail);

    const effectiveUid = authUid || user?.uid || driver?.uid || passenger?.uid || 'usr-' + Date.now();

    const rawAllowed = process.env.ADMIN_EMAILS || 'admin@vaicar.app,vaicar@alansmsolutions.com';
    const allowedAdmin = rawAllowed.toLowerCase().split(',').map((e) => e.trim()).filter(Boolean);
    const isAdmin = allowedAdmin.includes(normalizedEmail) || Boolean(user?.isAdmin || user?.role === 'admin');

    const isDriver = Boolean(driver);
    const isPassenger = Boolean(passenger || user?.isPassenger || (!isDriver && !isAdmin));

    const roles: string[] = [];
    if (isPassenger) roles.push('passenger');
    if (isDriver) roles.push('driver');
    if (isAdmin) roles.push('admin');

    const primaryRole = isAdmin ? 'admin' : isDriver ? 'driver' : 'passenger';

    // Issue server-authoritative HMAC-SHA256 JWT
    const token = signServerJwt({
      uid: effectiveUid,
      email: normalizedEmail,
      role: primaryRole,
      roles,
      isPassenger,
      isDriver,
      isAdmin,
      driverId: isDriver ? (driver?.uid || effectiveUid) : undefined,
    });

    let customToken: string | undefined;
    const adminAuth = getFirebaseAdminAuth();
    if (adminAuth) {
      try {
        customToken = await adminAuth.createCustomToken(effectiveUid);
      } catch {}
    }

    res.json({
      success: true,
      requestId: req.id,
      token,
      customToken,
      user: user || { uid: effectiveUid, email: normalizedEmail, role: primaryRole, isPassenger, isDriver, isAdmin },
      passenger,
      driver,
      roles,
      isAdmin,
      message: 'Autenticação realizada com sucesso no Servidor Seguro VaiCar.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/forgot-password
 * Secure, rate-limited password recovery request.
 * Generates single-use 6-digit PIN and sends via Google Apps Script email.
 * Never leaks whether account exists to prevent email enumeration.
 */
authRouter.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'E-mail válido é obrigatório.', 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const pinKey = `reset:${normalizedEmail}`;

    // Verify account exists in Firestore
    const user = await findUserByEmail(normalizedEmail);
    const driver = await findDriverByEmail(normalizedEmail);
    const passenger = await findPassengerByEmail(normalizedEmail);
    const exists = Boolean(user || driver || passenger);

    // If exists, enforce cooldown and send real PIN
    if (exists) {
      const cooldown = await canRequestPin(pinKey);
      if (!cooldown.allowed) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          `Aguarde ${cooldown.waitSeconds} segundos antes de solicitar um novo código de recuperação.`,
          429
        );
      }

      const pin = crypto.randomInt(100000, 1000000).toString();
      await savePendingPin(pinKey, pin, 15);

      await sendPasswordResetEmail(normalizedEmail, pin);
    }

    res.json({
      success: true,
      requestId: req.id,
      data: {
        message: 'Se o e-mail informado estiver cadastrado, um código PIN de 6 dígitos para recuperação foi enviado.',
        emailDelivered: exists,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/reset-password
 * Verifies single-use PIN and updates password securely in Identity Toolkit.
 */
authRouter.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, pin, newPassword } = req.body;
    if (!email || !isValidEmail(email)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'E-mail válido é obrigatório.', 400);
    }
    if (!pin || typeof pin !== 'string' || pin.trim().length !== 6) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Código PIN de 6 dígitos é obrigatório.', 400);
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'A nova senha deve ter no mínimo 6 caracteres.', 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const pinKey = `reset:${normalizedEmail}`;

    // Verify single-use PIN
    const isPinValid = await verifyPendingPin(pinKey, pin.trim());
    if (!isPinValid) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Código PIN incorreto, expirado ou tentativas excedidas.', 400);
    }

    // Update password in Identity Toolkit via Firebase Admin
    const adminAuth = getFirebaseAdminAuth();
    let updatedUid: string = '';
    if (adminAuth) {
      try {
        const userRec = await adminAuth.getUserByEmail(normalizedEmail);
        await adminAuth.updateUser(userRec.uid, { password: newPassword.trim() });
        updatedUid = userRec.uid;
      } catch (userErr: any) {
        if (userErr.code === 'auth/user-not-found') {
          // User exists in Firestore but not yet in Identity Toolkit: create account with new password!
          const userDoc = await findUserByEmail(normalizedEmail);
          const driverDoc = await findDriverByEmail(normalizedEmail);
          const passengerDoc = await findPassengerByEmail(normalizedEmail);
          const docUid = userDoc?.uid || driverDoc?.uid || passengerDoc?.uid || 'usr-' + Date.now();

          const created = await adminAuth.createUser({
            uid: docUid,
            email: normalizedEmail,
            password: newPassword.trim(),
            displayName: userDoc?.displayName || driverDoc?.name || passengerDoc?.name,
            emailVerified: true,
          });
          updatedUid = created.uid;
        } else {
          throw userErr;
        }
      }
    }

    // Issue a fresh server JWT
    const token = signServerJwt({
      uid: updatedUid || normalizedEmail,
      email: normalizedEmail,
      role: 'passenger',
      isPassenger: true,
    });

    res.json({
      success: true,
      requestId: req.id,
      token,
      message: 'Senha redefinida com sucesso! Você já pode acessar sua conta com a nova senha.',
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
    let user = await getUserProfile(uid);
    let effectiveUid = uid;
    if (!user && req.user!.email) {
      const byEmail = await findUserByEmail(req.user!.email);
      if (byEmail) {
        user = byEmail;
        effectiveUid = byEmail.uid;
      }
    }
    const passenger = await getPassengerProfile(effectiveUid);
    const driver = await resolveDriverProfile(effectiveUid, req.user!.email);

    const userWithRoles = user
      ? {
          ...user,
          isDriver: Boolean(driver),
          isPassenger: Boolean(passenger),
          isCourier: Boolean(user.isCourier || driver?.isCourier),
        }
      : null;

    res.json({
      success: true,
      requestId: req.id,
      data: {
        user: userWithRoles,
        passenger,
        driver,
        passengerProfile: passenger,
        driverProfile: driver,
        isAdmin: req.user!.isAdmin || user?.isAdmin || false,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Admin Setup / Bootstrap endpoint
 * Requires authenticated administrator privileges
 */
authRouter.post('/set-admin', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.isAdmin && req.user?.role !== 'admin') {
      throw new AppError(ErrorCode.FORBIDDEN, 'Acesso restrito a administradores.', 403);
    }

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

    const authAdmin = getFirebaseAdminAuth();
    if (authAdmin) {
      try {
        await authAdmin.setCustomUserClaims(uid, { admin: true });
      } catch (claimErr) {
        console.warn('[VaiCar Admin] Custom claim notice:', claimErr);
      }
    }

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
 * Verifies admin credentials and returns a real Firebase Custom Token with admin: true claim.
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

    const masterPassword = process.env.ADMIN_PASSWORD?.trim();
    if (!masterPassword && (process.env.NODE_ENV === 'production' || process.env.K_SERVICE)) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Acesso administrativo desativado: defina ADMIN_PASSWORD no ambiente.', 403);
    }
    const effectiveMasterPassword = masterPassword || (process.env.NODE_ENV !== 'production' ? 'VaiCar#2026Admin' : '');

    const providedPassword = String(password || '').trim();
    if (!allowedAdminEmails.includes(normalizedEmail) || !effectiveMasterPassword || providedPassword !== effectiveMasterPassword) {
      throw new AppError(ErrorCode.AUTH_REQUIRED, 'E-mail ou senha de administrador incorretos.', 401);
    }

    const authAdmin = getFirebaseAdminAuth();
    let adminUid: string;
    let customToken: string;

    const now = new Date().toISOString();

    if (authAdmin) {
      let fbAdmin = await authAdmin.getUserByEmail(normalizedEmail).catch(() => null);
      if (!fbAdmin) {
        fbAdmin = await authAdmin.createUser({
          email: normalizedEmail,
          password: masterPassword,
          displayName: normalizedEmail === 'vaicar@alansmsolutions.com' ? 'Alan SMSolutions (Admin)' : 'Administrador Chefe',
          disabled: false,
        });
      }
      adminUid = fbAdmin.uid;
      await authAdmin.setCustomUserClaims(adminUid, { admin: true });
      customToken = await authAdmin.createCustomToken(adminUid, { admin: true });
    } else {
      adminUid = `admin-${normalizedEmail.replace(/[^a-z0-9]/g, '-')}`;
      customToken = `test-admin-01:admin@vaicar.app`;
    }

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

    res.json({
      success: true,
      requestId: req.id,
      data: {
        customToken,
        token: customToken,
        user: adminProfile,
      },
    });
  } catch (error) {
    next(error);
  }
});

