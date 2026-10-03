import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePassenger } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCode } from '../../../shared/src/errors.js';
import {
  getPassengerProfile,
  resolvePassengerProfile,
  savePassengerProfile,
  getUserProfile,
  saveUserProfile,
  listRidesForPassenger,
  getActiveRideForUser,
} from '../services/firestore.js';
import { isValidWhatsApp, isValidPhotoData } from '../../../shared/src/validation.js';

export const passengersRouter = Router();

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
    res.json({
      success: true,
      requestId: req.id,
      data: rides.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()),
    });
  } catch (error) {
    next(error);
  }
});

passengersRouter.get('/active-ride', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const active = await getActiveRideForUser(req.user!.uid, 'passenger');
    res.json({
      success: true,
      requestId: req.id,
      data: active,
    });
  } catch (error) {
    next(error);
  }
});
