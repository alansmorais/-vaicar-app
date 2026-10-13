import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireDriver } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCode } from '../../../shared/src/errors.js';
import {
  getDriverProfile,
  resolveDriverProfile,
  saveDriverProfile,
  listOnlineDrivers,
  listAllDrivers,
  findDriverByEmail,
  findDriverByWhatsApp,
  savePendingPin,
  verifyPendingPin,
  canRequestPin,
  getUserProfile,
  saveUserProfile,
  listAllRides,
  listRidesForDriver,
  getActiveRideForUser,
  getPlatformPricing,
  getActivePendingOfferForDriver,
  getRide,
  saveRide,
  isDriverCurrentlyEligible,
  isDriverGpsFresh,
} from '../services/firestore.js';
import { acceptOffer, declineOffer, expireOffer, calculateHaversineDistanceKm } from '../services/dispatch.js';
import { signServerJwt } from '../services/jwt.js';
import { sendDriverPinEmail } from '../services/email.js';
import { config } from '../config/index.js';
import crypto from 'crypto';
import {
  DriverCustomPricing,
  FixedRoutePricing,
  DriverDeliveryPricing,
  ServiceType,
  DriverSubscriptionPlan,
  Ride,
} from '../../../shared/src/types.js';
import { formatRidePayload, approveRidePaymentHandler } from './rides.js';

export const driversRouter = Router();

/**
 * Public route for passengers to view online approved drivers on map
 */
driversRouter.get('/online', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const serviceType = typeof req.query.serviceType === 'string' ? req.query.serviceType : undefined;
    const drivers = await listOnlineDrivers({ serviceType });

    // Filter out drivers who are currently busy on an ongoing ride
    const availableDrivers: typeof drivers = [];
    for (const d of drivers) {
      const activeRide = await getActiveRideForUser(d.uid, 'driver');
      const isBusy = Boolean(activeRide && activeRide.status !== 'COMPLETED');
      const isFresh = isDriverGpsFresh(d.currentLocation);
      const lat = d.currentLocation?.lat;
      const lng = d.currentLocation?.lng;
      const zoneEligible = (config.testMode && typeof lat === 'number' && typeof lng === 'number') ||
        (typeof lat === 'number' && typeof lng === 'number'
          ? (lat >= -24.1 && lat <= -23.5 && lng >= -45.9 && lng <= -45.2)
          : false);
      const services = d.servicesOffered || (d.isCourier ? ['delivery'] : ['ride']);
      const serviceEligible = !serviceType || services.includes(serviceType as any);
      const isEligible = !isBusy && isFresh && serviceEligible;

      if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_ELIGIBILITY === 'true' || process.env.K_SERVICE) {
        console.log(
          `[DRIVER_ELIGIBILITY]\n` +
          `driver=${d.uid}\n` +
          `online=${Boolean(d.isOnline)}\n` +
          `gpsTimestamp=${d.currentLocation?.updatedAt || 'none'}\n` +
          `gpsFresh=${isFresh}\n` +
          `lat=${lat ?? 'none'}\n` +
          `lng=${lng ?? 'none'}\n` +
          `zoneEligible=${zoneEligible}\n` +
          `serviceEligible=${serviceEligible}\n` +
          `busy=${isBusy}\n` +
          `eligible=${isEligible}`
        );
      }

      if (!activeRide || activeRide.status === 'COMPLETED') {
        availableDrivers.push(d);
      }
    }

    // Return minimal safe data (no private CPF/CNH exposed to public map)
    const publicDrivers = availableDrivers.map(d => ({
      uid: d.uid,
      name: d.name,
      photoUrl: d.photoUrl,
      vehicle: {
        type: d.vehicle?.type || (d.isCourier ? 'motorcycle' : 'car'),
        brand: d.vehicle?.brand || 'Veículo',
        model: d.vehicle?.model || 'Padrão',
        color: d.vehicle?.color || 'Branco',
        plate: d.vehicle?.plate || '',
      },
      currentLocation: d.currentLocation,
      rating: d.rating || 5.0,
      operatingZones: d.operatingZones || [],
      isCourier: d.isCourier,
      servicesOffered: d.servicesOffered || (d.isCourier ? ['delivery'] : ['ride']),
    }));

    res.json({
      success: true,
      requestId: req.id,
      data: publicDrivers,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/drivers/auth
 * Server-authoritative driver authentication endpoint.
 * Accepts:
 * 1. { email, password } -> verifies credentials and returns server HMAC-SHA256 JWT
 * 2. { email/phone, verificationCode } -> verifies PIN and returns server HMAC-SHA256 JWT
 * 3. { email/phone } -> dispatches a new PIN to the driver
 */
driversRouter.post('/auth', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, phone, password, verificationCode, pin, code } = req.body;
    const providedCode = (verificationCode || pin || code)?.toString().trim();

    const normalizedEmail = email ? String(email).trim().toLowerCase() : undefined;
    const cleanPhone = phone ? String(phone).trim() : undefined;

    if (!normalizedEmail && !cleanPhone) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'E-mail ou WhatsApp/telefone é obrigatório.', 400);
    }

    // Locate driver in Firestore
    let driver = normalizedEmail
      ? await findDriverByEmail(normalizedEmail)
      : cleanPhone
      ? await findDriverByWhatsApp(cleanPhone)
      : null;

    if (!driver && normalizedEmail && cleanPhone) {
      driver = await findDriverByWhatsApp(cleanPhone);
    }

    if (!driver) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Nenhum credenciamento de motorista encontrado com estes dados.', 404);
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
                email: driver.email,
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
          console.error('[DriverAuth] Server password verification error:', authErr);
        }
      }

      if (!passwordValid) {
        throw new AppError(ErrorCode.AUTH_REQUIRED, 'Senha incorreta. Verifique suas credenciais.', 401);
      }

      // Link and refresh driver document
      const resolved = await resolveDriverProfile(driver.uid, driver.email);
      const activeDriver = resolved || driver;

      // Issue server-authoritative HMAC-SHA256 JWT
      const token = signServerJwt({
        uid: activeDriver.uid,
        email: activeDriver.email,
        role: 'driver',
        isDriver: true,
        driverId: activeDriver.uid,
      });

      return res.json({
        success: true,
        requestId: req.id,
        token,
        driver: activeDriver,
        message: 'Motorista autenticado com sucesso no VaiCar Cockpit.',
      });
    }

    // 2. PIN-based verification
    if (providedCode) {
      const pinKey = driver.email.toLowerCase().trim();
      const isValidPin = await verifyPendingPin(pinKey, providedCode);

      if (!isValidPin) {
        const phoneDigits = (driver.whatsapp || cleanPhone || '').replace(/\D/g, '');
        const isValidByPhone = phoneDigits ? await verifyPendingPin(`driver-${phoneDigits}`, providedCode) : false;
        if (!isValidByPhone) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'Código PIN incorreto, expirado ou tentativas excedidas.', 400);
        }
      }

      const resolved = await resolveDriverProfile(driver.uid, driver.email);
      const activeDriver = resolved || driver;

      const token = signServerJwt({
        uid: activeDriver.uid,
        email: activeDriver.email,
        role: 'driver',
        isDriver: true,
        driverId: activeDriver.uid,
      });

      return res.json({
        success: true,
        requestId: req.id,
        token,
        driver: activeDriver,
        message: 'PIN verificado com sucesso.',
      });
    }

    // 3. Request PIN dispatch (when neither password nor code is provided)
    const pinKey = driver.email.toLowerCase().trim();
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

    const emailRes = await sendDriverPinEmail(pinKey, generatedPin);

    return res.json({
      success: true,
      requestId: req.id,
      codeSent: true,
      emailSent: emailRes.success,
      message: emailRes.success
        ? 'Código PIN enviado para o e-mail cadastrado do motorista.'
        : 'Código gerado, mas houve falha no envio do e-mail.',
    });
  } catch (error) {
    next(error);
  }
});

// Authenticated driver routes below
driversRouter.use(authenticate, requireDriver);

driversRouter.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driver = await resolveDriverProfile(req.user!.uid, req.user!.email);
    if (!driver) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Perfil de motorista não encontrado.', 404);
    }
    res.json({
      success: true,
      requestId: req.id,
      data: driver,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get current driver's custom pricing and platform minimum floor
 */
driversRouter.get('/pricing', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driver = await resolveDriverProfile(req.user!.uid, req.user!.email);
    if (!driver) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Perfil de motorista não encontrado.', 404);
    }
    const platform = await getPlatformPricing();

    const customPricing: DriverCustomPricing = driver.customPricing || {
      minimumFare: platform.minimumFare,
      perKmRate: platform.perKmRate,
      perMinuteRate: platform.perMinuteRate || 0,
      allowFixedRoutes: false,
      fixedRoutes: [],
      updatedAt: driver.updatedAt,
    };

    const deliveryFloor = {
      minimumDeliveryFee: platform.deliveryMinimumFee ?? 10.0,
      perKmRate: platform.deliveryPerKmRate ?? 2.0,
      waitingPerMinuteRate: platform.deliveryWaitingPerMinuteRate ?? 0.5,
    };

    const customDeliveryPricing: DriverDeliveryPricing = driver.customDeliveryPricing || {
      minimumDeliveryFee: deliveryFloor.minimumDeliveryFee,
      perKmRate: deliveryFloor.perKmRate,
      waitingPerMinuteRate: deliveryFloor.waitingPerMinuteRate,
      updatedAt: driver.updatedAt,
    };

    res.json({
      success: true,
      requestId: req.id,
      data: {
        customPricing,
        customDeliveryPricing,
        servicesOffered: driver.servicesOffered || (driver.isCourier ? ['delivery'] : ['ride']),
        platformFloor: {
          minimumFare: platform.minimumFare,
          perKmRate: platform.perKmRate,
          perMinuteRate: 0,
        },
        deliveryPlatformFloor: deliveryFloor,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Configure driver custom pricing (must not be lower than platform floor)
 */
driversRouter.put('/pricing', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driver = await resolveDriverProfile(req.user!.uid, req.user!.email);
    if (!driver) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Perfil de motorista não encontrado.', 404);
    }
    const platform = await getPlatformPricing();

    const {
      minimumFare,
      perKmRate,
      perMinuteRate,
      allowFixedRoutes,
      fixedRoutes,
    } = req.body;

    const now = new Date().toISOString();
    const deliveryFloor = {
      minimumDeliveryFee: platform.deliveryMinimumFee ?? 10.0,
      perKmRate: platform.deliveryPerKmRate ?? 2.0,
      waitingPerMinuteRate: platform.deliveryWaitingPerMinuteRate ?? 0.5,
    };

    // 1. Update ride custom pricing if minimumFare or perKmRate is provided
    let updatedPricing: DriverCustomPricing | undefined = driver.customPricing;
    if (minimumFare !== undefined || perKmRate !== undefined) {
      const minFareNum = Number(minimumFare);
      const perKmNum = Number(perKmRate);
      const perMinNum = perMinuteRate !== undefined && perMinuteRate !== null ? Number(perMinuteRate) : 0;

      if (isNaN(minFareNum) || minFareNum < platform.minimumFare) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          `O valor mínimo da corrida não pode ser menor que o piso da plataforma (R$ ${platform.minimumFare.toFixed(2)}).`,
          400
        );
      }

      if (isNaN(perKmNum) || perKmNum < platform.perKmRate) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          `O valor por KM não pode ser menor que o piso da plataforma (R$ ${platform.perKmRate.toFixed(2)}/km).`,
          400
        );
      }

      if (isNaN(perMinNum) || perMinNum < 0) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'O valor por minuto deve ser zero ou um valor positivo.',
          400
        );
      }

      const cleanedFixedRoutes: FixedRoutePricing[] = [];
      if (Array.isArray(fixedRoutes)) {
        for (const r of fixedRoutes) {
          if (!r.name || r.price === undefined || r.price === null) continue;
          const priceNum = Number(r.price);
          if (isNaN(priceNum) || priceNum < platform.minimumFare) {
            throw new AppError(
              ErrorCode.VALIDATION_ERROR,
              `O preço da rota fixa "${r.name}" não pode ser menor que o valor mínimo da plataforma (R$ ${platform.minimumFare.toFixed(2)}).`,
              400
            );
          }
          cleanedFixedRoutes.push({
            id: r.id || `fr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: String(r.name).trim(),
            originZone: String(r.originZone || '').trim(),
            destinationZone: String(r.destinationZone || '').trim(),
            price: Math.round(priceNum * 100) / 100,
          });
        }
      }

      updatedPricing = {
        minimumFare: Math.round(minFareNum * 100) / 100,
        perKmRate: Math.round(perKmNum * 100) / 100,
        perMinuteRate: Math.round(perMinNum * 100) / 100,
        allowFixedRoutes: Boolean(allowFixedRoutes),
        fixedRoutes: cleanedFixedRoutes,
        updatedAt: now,
      };
      driver.customPricing = updatedPricing;
    }

    // 2. Update delivery custom pricing if provided
    let updatedDeliveryPricing: DriverDeliveryPricing | undefined = driver.customDeliveryPricing;
    if (req.body.customDeliveryPricing) {
      const { minimumDeliveryFee, perKmRate: delivKmRate, waitingPerMinuteRate } = req.body.customDeliveryPricing;
      const minDelivNum = Number(minimumDeliveryFee);
      const delivKmNum = Number(delivKmRate);
      const waitMinNum = waitingPerMinuteRate !== undefined && waitingPerMinuteRate !== null ? Number(waitingPerMinuteRate) : 0;

      if (!isNaN(minDelivNum) && minDelivNum < deliveryFloor.minimumDeliveryFee) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          `O valor mínimo de entrega não pode ser menor que o piso da plataforma (R$ ${deliveryFloor.minimumDeliveryFee.toFixed(2)}).`,
          400
        );
      }
      if (!isNaN(delivKmNum) && delivKmNum < deliveryFloor.perKmRate) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          `O valor por KM da entrega não pode ser menor que o piso da plataforma (R$ ${deliveryFloor.perKmRate.toFixed(2)}/km).`,
          400
        );
      }
      if (!isNaN(waitMinNum) && waitMinNum < 0) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'A taxa de espera da entrega deve ser zero ou um valor positivo.',
          400
        );
      }

      updatedDeliveryPricing = {
        minimumDeliveryFee: Math.round(minDelivNum * 100) / 100,
        perKmRate: Math.round(delivKmNum * 100) / 100,
        waitingPerMinuteRate: Math.round(waitMinNum * 100) / 100,
        updatedAt: now,
      };
      driver.customDeliveryPricing = updatedDeliveryPricing;
    }

    // 3. Update services offered if provided
    if (Array.isArray(req.body.servicesOffered)) {
      const valid = req.body.servicesOffered.filter((s: string) => s === 'ride' || s === 'delivery') as ServiceType[];
      if (driver.vehicle?.type === 'bicycle' && valid.includes('ride')) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Condutores com bicicleta só podem prestar serviços de entrega (delivery).',
          400
        );
      }
      if (valid.length > 0) {
        driver.servicesOffered = valid;
      }
    }

    driver.updatedAt = now;
    await saveDriverProfile(driver);

    res.json({
      success: true,
      requestId: req.id,
      data: {
        customPricing: driver.customPricing,
        customDeliveryPricing: driver.customDeliveryPricing,
        servicesOffered: driver.servicesOffered || (driver.isCourier ? ['delivery'] : ['ride']),
        platformFloor: {
          minimumFare: platform.minimumFare,
          perKmRate: platform.perKmRate,
          perMinuteRate: 0,
        },
        deliveryPlatformFloor: deliveryFloor,
        message: 'Tarifas personalizadas atualizadas com sucesso!',
      },
    });
  } catch (error) {
    next(error);
  }
});

driversRouter.patch('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = req.user!.uid;
    const driver = await resolveDriverProfile(uid, req.user!.email);
    if (!driver) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Perfil não encontrado.', 404);
    }

    const {
      name,
      whatsapp,
      cnhNumber,
      vehicle,
      operatingZones,
      photoUrl,
      cnhUrl,
      crlvUrl,
      proofOfAddressUrl,
      criminalRecordUrl,
      clearDocumentsRequested,
      servicesOffered,
      customDeliveryPricing,
    } = req.body;

    const now = new Date().toISOString();
    const hasNewDocs = cnhUrl || crlvUrl || proofOfAddressUrl || criminalRecordUrl;

    const updated = {
      ...driver,
      ...(name ? { name: String(name).trim() } : {}),
      ...(whatsapp ? { whatsapp: String(whatsapp).trim() } : {}),
      ...(cnhNumber ? { cnhNumber: String(cnhNumber).trim() } : {}),
      ...(vehicle ? { vehicle: { ...driver.vehicle, ...vehicle } } : {}),
      ...(operatingZones ? { operatingZones } : {}),
      ...(photoUrl ? { photoUrl } : {}),
      ...(cnhUrl ? { cnhUrl } : {}),
      ...(crlvUrl ? { crlvUrl } : {}),
      ...(proofOfAddressUrl ? { proofOfAddressUrl } : {}),
      ...(criminalRecordUrl ? { criminalRecordUrl, criminalRecordStatus: 'PENDING' as const } : {}),
      ...(clearDocumentsRequested || hasNewDocs ? { documentsRequested: undefined, documentsResubmittedAt: now } : {}),
      ...(Array.isArray(servicesOffered) ? { servicesOffered: servicesOffered.filter((s: string) => s === 'ride' || s === 'delivery') as ServiceType[] } : {}),
      ...(customDeliveryPricing ? { customDeliveryPricing } : {}),
      updatedAt: now,
    };

    await saveDriverProfile(updated);

    // Sync all matching driver documents across all UIDs with same email or CPF
    if (driver.email || driver.cpf) {
      const allDrivers = await listAllDrivers();
      for (const d of allDrivers) {
        const matchesEmail = driver.email && d.email?.toLowerCase() === driver.email.toLowerCase();
        const matchesCpf = driver.cpf && d.cpf === driver.cpf;
        if ((matchesEmail || matchesCpf) && d.uid !== driver.uid) {
          await saveDriverProfile({
            ...d,
            ...updated,
            uid: d.uid,
          });
        }
      }
    }

    // Sync base user profile
    const user = await getUserProfile(uid);
    if (user) {
      await saveUserProfile({
        ...user,
        ...(name ? { displayName: String(name).trim() } : {}),
        ...(whatsapp ? { whatsapp: String(whatsapp).trim() } : {}),
        ...(photoUrl ? { photoUrl } : {}),
        updatedAt: now,
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

/**
 * Change Driver Subscription / Partnership Plan
 * Business Rule:
 * - Switching from monthly_100 (R$ 100/mês) is allowed after 1 month (30 days) from plan selection.
 * - Switching from weekly_percent_10 (10% semanal) is allowed after 1 week (7 days) from plan selection.
 */
driversRouter.post('/change-plan', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = req.user!.uid;
    const { plan } = req.body;

    if (plan !== 'monthly_100' && plan !== 'weekly_percent_10') {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Plano inválido. Escolha entre "monthly_100" (R$ 100/mês) ou "weekly_percent_10" (10% semanal).',
        400
      );
    }

    const driver = await resolveDriverProfile(uid, req.user!.email);
    if (!driver) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Perfil de motorista não encontrado.', 404);
    }

    if (driver.subscriptionPlan === plan) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `Você já está ativo no plano ${
          plan === 'weekly_percent_10'
            ? '10% Semanal'
            : 'Mensalidade R$ 100/mês'
        }.`,
        400
      );
    }

    const now = new Date();
    const currentPlan = driver.subscriptionPlan || 'monthly_100';
    const isWeekly = currentPlan === 'weekly_percent_10';
    const minDays = isWeekly ? 7 : 30;

    const selectedAt = driver.subscriptionPlanSelectedAt
      ? new Date(driver.subscriptionPlanSelectedAt)
      : new Date(driver.createdAt || Date.now());

    const eligibleDate = driver.nextPlanSwitchAllowedAt
      ? new Date(driver.nextPlanSwitchAllowedAt)
      : new Date(selectedAt.getTime() + minDays * 24 * 60 * 60 * 1000);

    if (now.getTime() < eligibleDate.getTime()) {
      const msDiff = eligibleDate.getTime() - now.getTime();
      const daysRemaining = Math.max(1, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));
      const formattedDate = eligibleDate.toLocaleDateString('pt-BR');
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `A troca de plano só é permitida após ${isWeekly ? '1 semana (7 dias)' : '1 mês (30 dias)'}. Você poderá alterar em ${formattedDate} (faltam ${daysRemaining} dia(s)).`,
        400
      );
    }

    // Eligible: apply plan switch
    const switchTimestamp = now.toISOString();
    const nextAllowedDate = new Date(now.getTime() + (plan === 'weekly_percent_10' ? 7 : 30) * 24 * 60 * 60 * 1000);

    const updated = {
      ...driver,
      subscriptionPlan: plan as DriverSubscriptionPlan,
      subscriptionPlanSelectedAt: switchTimestamp,
      nextPlanSwitchAllowedAt: nextAllowedDate.toISOString(),
      updatedAt: switchTimestamp,
    };

    await saveDriverProfile(updated);

    res.json({
      success: true,
      requestId: req.id,
      data: {
        driver: updated,
        message: `Plano alterado com sucesso para ${
          plan === 'weekly_percent_10'
            ? '10% Semanal (Acerto Semanal)'
            : 'Mensalidade de R$ 100/mês (Veículo Próprio)'
        }. Próxima alteração permitida a partir de ${nextAllowedDate.toLocaleDateString('pt-BR')}.`,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Toggle Driver Online/Offline
 * Business Rule: Driver CANNOT go online before approval!
 */
driversRouter.post('/toggle-online', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = req.user!.uid;
    const driver = await resolveDriverProfile(uid, req.user!.email);
    if (!driver) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Perfil de motorista não encontrado.', 404);
    }

    const { isOnline } = req.body;
    const targetState = typeof isOnline === 'boolean' ? isOnline : !driver.isOnline;

    if (targetState === true && driver.status !== 'APPROVED') {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        `Não é possível ficar online. Sua conta está com status: ${driver.status}. Aguarde a aprovação do administrador.`,
        403
      );
    }

    const updated = {
      ...driver,
      isOnline: targetState,
      updatedAt: new Date().toISOString(),
    };

    await saveDriverProfile(updated);

    res.json({
      success: true,
      requestId: req.id,
      data: {
        isOnline: updated.isOnline,
        status: updated.status,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update Driver Location
 */
driversRouter.post('/location', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = req.user!.uid;
    const { lat, lng, heading, speed, accuracy, isOnline } = req.body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Coordenadas lat e lng válidas são obrigatórias.', 400);
    }

    const driver = await resolveDriverProfile(uid, req.user!.email);
    if (!driver) throw new AppError(ErrorCode.NOT_FOUND, 'Motorista não encontrado.', 404);

    const now = new Date().toISOString();
    // Maintain or restore isOnline: true if transmitting device is online
    const targetOnline = typeof isOnline === 'boolean'
      ? (isOnline && driver.status === 'APPROVED')
      : driver.isOnline;

    const updated = {
      ...driver,
      isOnline: targetOnline,
      currentLocation: {
        lat,
        lng,
        heading: typeof heading === 'number' ? heading : 0,
        speed: typeof speed === 'number' ? speed : undefined,
        accuracy: typeof accuracy === 'number' ? accuracy : undefined,
        updatedAt: now,
      },
      updatedAt: now,
    };

    await saveDriverProfile(updated);

    res.json({
      success: true,
      requestId: req.id,
      data: {
        ...updated.currentLocation,
        isOnline: updated.isOnline,
        isEligible: isDriverCurrentlyEligible(updated),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/drivers/fcm-token and POST /api/v1/drivers/:id/fcm-token
 * Associate device FCM push token with authenticated driver profile.
 */
driversRouter.post(['/fcm-token', '/:id/fcm-token'], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = req.user!.uid;
    const requestedId = req.params.id ? String(req.params.id) : uid;

    if (requestedId !== uid && !req.user!.isAdmin) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Acesso não autorizado ao cadastro de outro motorista.', 403);
    }

    const { fcmToken } = req.body;
    if (!fcmToken || typeof fcmToken !== 'string') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'fcmToken válido é obrigatório.', 400);
    }

    const driver = await resolveDriverProfile(uid, req.user!.email);
    if (!driver) throw new AppError(ErrorCode.NOT_FOUND, 'Motorista não encontrado.', 404);

    const now = new Date().toISOString();
    const updated = {
      ...driver,
      fcmToken: fcmToken.trim(),
      updatedAt: now,
    };

    await saveDriverProfile(updated);

    res.json({
      success: true,
      requestId: req.id,
      data: {
        driverId: driver.uid,
        fcmToken: updated.fcmToken,
        updatedAt: now,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * List Incoming / Available Rides for Drivers (in REQUESTED status)
 */
driversRouter.get('/available-rides', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driver = await resolveDriverProfile(req.user!.uid, req.user!.email);
    if (!driver || driver.status !== 'APPROVED' || !driver.isOnline) {
      return res.json({ success: true, requestId: req.id, data: [] });
    }

    const allRides = await listAllRides();
    const isBicycle = driver.vehicle?.type === 'bicycle';
    const servicesOffered = driver.servicesOffered || (driver.isCourier || isBicycle ? ['delivery'] : ['ride']);
    const offersDelivery = servicesOffered.includes('delivery');
    const offersRide = !isBicycle && servicesOffered.includes('ride');

    const now = Date.now();
    const MAX_AGE_MS = 10 * 60 * 1000;

    const available = allRides.filter((r) => {
      if (!['REQUESTED', 'OFFERED'].includes(r.status)) return false;
      if (r.driverId && r.driverId !== driver.uid) return false;
      if (r.declinedDriverIds && r.declinedDriverIds.includes(driver.uid)) return false;

      // Auto-expire stale ride
      const reqTime = new Date(r.requestedAt || (r as any).createdAt || 0).getTime();
      if (now - reqTime > MAX_AGE_MS) {
        saveRide({
          ...r,
          status: 'CANCELLED_BY_SYSTEM',
          cancelledAt: new Date().toISOString(),
          cancelledBy: 'system',
          cancelReason: 'Tempo limite de busca expirado.',
        }).catch(console.error);
        return false;
      }

      // Check distance to pickup for general pool rides unless testMode or explicitly requested for this driver
      if (!config.testMode && r.driverId !== driver.uid && driver.currentLocation?.lat && r.origin?.lat) {
        const dist = calculateHaversineDistanceKm(
          driver.currentLocation.lat,
          driver.currentLocation.lng,
          r.origin.lat,
          r.origin.lng
        );
        if (dist > 15.0) return false;
      }

      const rideService = r.serviceType || 'ride';
      if (rideService === 'delivery' && !offersDelivery) return false;
      if (rideService === 'ride' && !offersRide) return false;
      return true;
    });

    res.json({
      success: true,
      requestId: req.id,
      data: available.map(formatRidePayload),
    });
  } catch (error) {
    next(error);
  }
});



driversRouter.get('/active-ride', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driver = await resolveDriverProfile(req.user!.uid, req.user!.email);
    const driverId = driver ? driver.uid : req.user!.uid;
    const active = await getActiveRideForUser(driverId, 'driver');
    res.json({
      success: true,
      requestId: req.id,
      data: active ? formatRidePayload(active) : null,
    });
  } catch (error) {
    next(error);
  }
});

driversRouter.get('/rides', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driver = await resolveDriverProfile(req.user!.uid, req.user!.email);
    const driverId = driver ? driver.uid : req.user!.uid;
    const rides = await listRidesForDriver(driverId);
    res.json({
      success: true,
      requestId: req.id,
      data: rides.map(formatRidePayload).sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/drivers/offers/pending
 * Returns active targeted pending offer for the authenticated online driver with exact seconds remaining.
 */
driversRouter.get('/offers/pending', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driver = await resolveDriverProfile(req.user!.uid, req.user!.email);
    if (!driver || driver.status !== 'APPROVED' || !driver.isOnline) {
      return res.json({ success: true, requestId: req.id, data: null });
    }

    const offer = await getActivePendingOfferForDriver(driver.uid);
    if (!offer) {
      return res.json({ success: true, requestId: req.id, data: null });
    }

    const now = Date.now();
    const expiresMs = new Date(offer.expiresAt).getTime();

    // Check expiration
    if (now >= expiresMs) {
      await expireOffer(offer.id);
      return res.json({ success: true, requestId: req.id, data: null });
    }

    // Verify underlying ride status
    const ride = await getRide(offer.rideId);
    if (!ride || ride.driverId || !['REQUESTED', 'OFFERED'].includes(ride.status)) {
      await expireOffer(offer.id);
      return res.json({ success: true, requestId: req.id, data: null });
    }

    const secondsRemaining = Math.max(0, Math.ceil((expiresMs - now) / 1000));

    res.json({
      success: true,
      requestId: req.id,
      data: {
        ...offer,
        secondsRemaining,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/drivers/offers/:id/accept
 * Driver accepts the targeted offer atomically.
 */
driversRouter.post('/offers/:id/accept', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driver = await resolveDriverProfile(req.user!.uid, req.user!.email);
    if (!driver || driver.status !== 'APPROVED') {
      throw new AppError(ErrorCode.FORBIDDEN, 'Apenas motoristas credenciados e aprovados podem aceitar chamados.', 403);
    }
    const updatedRide = await acceptOffer(String(req.params.id), driver.uid);
    res.json({
      success: true,
      requestId: req.id,
      data: formatRidePayload(updatedRide),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/drivers/offers/:id/decline
 * Driver declines the targeted offer.
 */
driversRouter.post('/offers/:id/decline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driver = await resolveDriverProfile(req.user!.uid, req.user!.email);
    if (!driver) throw new AppError(ErrorCode.NOT_FOUND, 'Motorista não encontrado.', 404);
    await declineOffer(String(req.params.id), driver.uid);
    res.json({
      success: true,
      requestId: req.id,
      data: { declined: true },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/drivers/rides/:id/approve-payment
 * Driver confirms receipt of passenger's payment
 */
driversRouter.post('/rides/:id/approve-payment', approveRidePaymentHandler);
