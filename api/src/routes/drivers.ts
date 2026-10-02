import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireDriver } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCode } from '../../../shared/src/errors.js';
import {
  getDriverProfile,
  saveDriverProfile,
  listOnlineDrivers,
  listAllRides,
  listRidesForDriver,
  getActiveRideForUser,
} from '../services/firestore.js';

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
      name: d.name.split(' ')[0], // first name
      photoUrl: d.photoUrl,
      vehicle: {
        brand: d.vehicle.brand,
        model: d.vehicle.model,
        color: d.vehicle.color,
      },
      currentLocation: d.currentLocation,
      rating: d.rating,
      operatingZones: d.operatingZones,
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
    const driver = await getDriverProfile(req.user!.uid);
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

driversRouter.patch('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = req.user!.uid;
    const driver = await getDriverProfile(uid);
    if (!driver) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Perfil não encontrado.', 404);
    }

    const { vehicle, operatingZones, photoUrl } = req.body;
    const updated = {
      ...driver,
      ...(vehicle ? { vehicle: { ...driver.vehicle, ...vehicle } } : {}),
      ...(operatingZones ? { operatingZones } : {}),
      ...(photoUrl ? { photoUrl } : {}),
      updatedAt: new Date().toISOString(),
    };

    await saveDriverProfile(updated);

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
 * Toggle Driver Online/Offline
 * Business Rule: Driver CANNOT go online before approval!
 */
driversRouter.post('/toggle-online', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = req.user!.uid;
    const driver = await getDriverProfile(uid);
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

    const driver = await getDriverProfile(uid);
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
    const driver = await getDriverProfile(req.user!.uid);
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
    const active = await getActiveRideForUser(req.user!.uid, 'driver');
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
    const rides = await listRidesForDriver(req.user!.uid);
    res.json({
      success: true,
      requestId: req.id,
      data: rides.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()),
    });
  } catch (error) {
    next(error);
  }
});
