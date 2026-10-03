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
  getUserProfile,
  saveUserProfile,
  listAllRides,
  listRidesForDriver,
  getActiveRideForUser,
  getPlatformPricing,
} from '../services/firestore.js';
import { DriverCustomPricing, FixedRoutePricing } from '../../../shared/src/types.js';

export const driversRouter = Router();

/**
 * Public route for passengers to view online approved drivers on map
 */
driversRouter.get('/online', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const drivers = await listOnlineDrivers();
    // Return minimal safe data (no private CPF/CNH exposed to public map)
    const publicDrivers = drivers.map(d => ({
      uid: d.uid,
      name: d.name,
      photoUrl: d.photoUrl,
      vehicle: {
        type: d.vehicle.type || (d.isCourier ? 'motorcycle' : 'car'),
        brand: d.vehicle.brand,
        model: d.vehicle.model,
        color: d.vehicle.color,
        plate: d.vehicle.plate,
      },
      currentLocation: d.currentLocation,
      rating: d.rating,
      operatingZones: d.operatingZones,
      isCourier: d.isCourier,
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

    res.json({
      success: true,
      requestId: req.id,
      data: {
        customPricing,
        platformFloor: {
          minimumFare: platform.minimumFare,
          perKmRate: platform.perKmRate,
          perMinuteRate: 0,
        },
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

    const now = new Date().toISOString();
    const updatedPricing: DriverCustomPricing = {
      minimumFare: Math.round(minFareNum * 100) / 100,
      perKmRate: Math.round(perKmNum * 100) / 100,
      perMinuteRate: Math.round(perMinNum * 100) / 100,
      allowFixedRoutes: Boolean(allowFixedRoutes),
      fixedRoutes: cleanedFixedRoutes,
      updatedAt: now,
    };

    driver.customPricing = updatedPricing;
    driver.updatedAt = now;
    await saveDriverProfile(driver);

    res.json({
      success: true,
      requestId: req.id,
      data: {
        customPricing: updatedPricing,
        platformFloor: {
          minimumFare: platform.minimumFare,
          perKmRate: platform.perKmRate,
          perMinuteRate: 0,
        },
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
        `Você já está ativo no plano ${plan === 'weekly_percent_10' ? '10% Semanal' : 'Mensalidade R$ 100/mês'}.`,
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
      subscriptionPlan: plan,
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
          plan === 'weekly_percent_10' ? '10% Semanal (Acerto Semanal)' : 'Mensalidade de R$ 100/mês'
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
    const { lat, lng, heading } = req.body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Coordenadas lat e lng válidas são obrigatórias.', 400);
    }

    const driver = await resolveDriverProfile(uid, req.user!.email);
    if (!driver) throw new AppError(ErrorCode.NOT_FOUND, 'Motorista não encontrado.', 404);

    const updated = {
      ...driver,
      currentLocation: {
        lat,
        lng,
        heading: typeof heading === 'number' ? heading : 0,
        updatedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };

    await saveDriverProfile(updated);

    res.json({
      success: true,
      requestId: req.id,
      data: updated.currentLocation,
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
    const available = allRides.filter(r => r.status === 'REQUESTED');

    res.json({
      success: true,
      requestId: req.id,
      data: available,
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
      data: active,
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
      data: rides.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()),
    });
  } catch (error) {
    next(error);
  }
});
