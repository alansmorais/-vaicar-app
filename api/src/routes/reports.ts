import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCode } from '../../../shared/src/errors.js';
import { Report, ReportCategory } from '../../../shared/src/types.js';
import {
  saveReport,
  listReportsForUser,
  getRide,
  saveRide,
  getPassengerProfile,
  savePassengerProfile,
  getDriverProfile,
  getUserProfile,
} from '../services/firestore.js';

export const reportsRouter = Router();

// Authentication required for reporting
reportsRouter.use(authenticate);

/**
 * Submit an incident report (Driver reports passenger, or Passenger reports driver)
 * If category is 'UNPAID_FARE' (calote), passenger is automatically blocked from requesting new rides.
 */
reportsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { rideId, targetUserId, category, description, unpaidAmount } = req.body;

    if (!category) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Categoria da denúncia é obrigatória.', 400);
    }
    if (!description || typeof description !== 'string' || description.trim().length < 5) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Descreva o ocorrido com no mínimo 5 caracteres.', 400);
    }

    const targetInput = req.body.targetUserId || req.body.targetId;
    let reporterRole: 'driver' | 'passenger' = 'passenger';
    let reporterName = user.email || 'Usuário';
    let reporterPhone: string | undefined = undefined;
    let targetRole: 'driver' | 'passenger' = 'driver';
    let targetId = targetInput || '';
    let targetName = 'Usuário';

    let ride = null;
    if (rideId) {
      ride = await getRide(String(rideId));
      if (!ride) {
        throw new AppError(ErrorCode.NOT_FOUND, 'Corrida informada não foi encontrada.', 404);
      }

      const isDriver = ride.driverId === user.uid;
      const isPassenger = ride.passengerId === user.uid;

      if (!isDriver && !isPassenger && !user.isAdmin) {
        throw new AppError(ErrorCode.FORBIDDEN, 'Você só pode reportar corridas em que participou.', 403);
      }

      if (isDriver) {
        reporterRole = 'driver';
        reporterName = ride.driverName || 'Motorista';
        reporterPhone = ride.driverPhone;
        targetRole = 'passenger';
        targetId = ride.passengerId;
        targetName = ride.passengerName;
      } else {
        reporterRole = 'passenger';
        reporterName = ride.passengerName;
        reporterPhone = ride.passengerPhone;
        targetRole = 'driver';
        targetId = ride.driverId || '';
        targetName = ride.driverName || 'Motorista';
      }
    } else if (targetInput) {
      // Lookup target
      const targetPassenger = await getPassengerProfile(targetInput);
      const targetDriver = await getDriverProfile(targetInput);
      if (targetPassenger) {
        targetRole = 'passenger';
        targetId = targetPassenger.uid;
        targetName = targetPassenger.name;
        reporterRole = 'driver';
      } else if (targetDriver) {
        targetRole = 'driver';
        targetId = targetDriver.uid;
        targetName = targetDriver.name;
        reporterRole = 'passenger';
      }
      const myProfile = await getUserProfile(user.uid);
      reporterName = myProfile?.displayName || user.email || 'Usuário';
      reporterPhone = myProfile?.whatsapp;
    }

    let passengerBlocked = false;
    // If driver reports that passenger didn't pay (UNPAID_FARE / calote):
    if (category === 'UNPAID_FARE' && targetRole === 'passenger' && targetId) {
      const finalUnpaid = typeof unpaidAmount === 'number' && unpaidAmount > 0 
        ? unpaidAmount 
        : (ride ? ride.fareAmount : 0);

      if (ride) {
        ride.paymentStatus = 'CONTESTED';
        await saveRide(ride);
      }

      // Block the passenger from using the platform immediately
      const passenger = await getPassengerProfile(targetId);
      if (passenger) {
        await savePassengerProfile({
          ...passenger,
          isBlocked: true,
          hasUnpaidDebt: true,
          unpaidAmount: finalUnpaid,
          blockedReason: ride
            ? `Conta bloqueada por falta de pagamento da corrida (${ride.origin.address} ➔ ${ride.destination.address}). Valor pendente: R$ ${finalUnpaid.toFixed(2)}. Regularize junto ao suporte no WhatsApp.`
            : `Conta bloqueada por falta de pagamento ao motorista. Valor pendente: R$ ${finalUnpaid.toFixed(2)}. Regularize junto ao suporte no WhatsApp.`,
          updatedAt: new Date().toISOString(),
        });
        passengerBlocked = true;
      }
    }

    const reportId = `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const report: Report = {
      id: reportId,
      rideId: rideId || undefined,
      reporterRole,
      reporterId: user.uid,
      reporterName,
      reporterPhone,
      targetRole,
      targetId,
      targetName,
      category: category as ReportCategory,
      description: description.trim(),
      unpaidAmount: category === 'UNPAID_FARE' ? (unpaidAmount || (ride ? ride.fareAmount : undefined)) : undefined,
      status: 'PENDING',
      createdAt: now,
    };

    await saveReport(report);

    res.status(201).json({
      success: true,
      requestId: req.id,
      data: {
        report,
        passengerBlocked,
        message: category === 'UNPAID_FARE'
          ? 'Relato de não pagamento registrado. O passageiro foi bloqueado da plataforma até regularização.'
          : 'Relato registrado com sucesso. Nossa equipe local analisará o ocorrido.',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * List my reports
 */
reportsRouter.get('/my-reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reports = await listReportsForUser(req.user!.uid);
    res.json({
      success: true,
      requestId: req.id,
      data: reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    });
  } catch (error) {
    next(error);
  }
});
