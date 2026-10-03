import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCode } from '../../../shared/src/errors.js';
import {
  getAdminMetrics,
  listAllDrivers,
  getDriverProfile,
  saveDriverProfile,
  deleteDriverProfile,
  listAllPassengers,
  getPassengerProfile,
  savePassengerProfile,
  deletePassengerProfile,
  listAllRides,
  listAllReports,
  getReport,
  saveReport,
  getPlatformPricing,
  updatePlatformPricing,
} from '../services/firestore.js';
import { sendDriverStatusEmail, sendDocumentsRequestedEmail, emailLogs, sendTransactionalEmail } from '../services/email.js';

export const adminRouter = Router();

// Enforce admin authentication
adminRouter.use(authenticate, requireAdmin);

adminRouter.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = await getAdminMetrics();
    res.json({
      success: true,
      requestId: req.id,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/drivers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    let drivers = await listAllDrivers();
    if (status && typeof status === 'string') {
      drivers = drivers.filter(d => d.status === status);
    }
    res.json({
      success: true,
      requestId: req.id,
      data: drivers,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/drivers/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driver = await getDriverProfile(String(req.params.id));
    if (!driver) throw new AppError(ErrorCode.NOT_FOUND, 'Motorista não encontrado.', 404);

    const updated = {
      ...driver,
      status: 'APPROVED' as const,
      updatedAt: new Date().toISOString(),
    };
    delete (updated as any).rejectionReason;

    await saveDriverProfile(updated);

    // Send email notification asynchronously
    sendDriverStatusEmail(driver.email, driver.name, 'APPROVED').catch(console.error);

    res.json({
      success: true,
      requestId: req.id,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/drivers/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driver = await getDriverProfile(String(req.params.id));
    if (!driver) throw new AppError(ErrorCode.NOT_FOUND, 'Motorista não encontrado.', 404);

    const { reason } = req.body;
    const updated = {
      ...driver,
      status: 'REJECTED' as const,
      isOnline: false,
      rejectionReason: reason || 'Documentação não atendeu aos critérios da plataforma.',
      updatedAt: new Date().toISOString(),
    };

    await saveDriverProfile(updated);

    sendDriverStatusEmail(driver.email, driver.name, 'REJECTED', updated.rejectionReason).catch(console.error);

    res.json({
      success: true,
      requestId: req.id,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/drivers/:id/suspend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driver = await getDriverProfile(String(req.params.id));
    if (!driver) throw new AppError(ErrorCode.NOT_FOUND, 'Motorista não encontrado.', 404);

    const { reason } = req.body;
    const updated = {
      ...driver,
      status: 'SUSPENDED' as const,
      isOnline: false,
      rejectionReason: reason || 'Conta temporariamente suspensa por infração aos termos.',
      updatedAt: new Date().toISOString(),
    };

    await saveDriverProfile(updated);

    sendDriverStatusEmail(driver.email, driver.name, 'SUSPENDED', updated.rejectionReason).catch(console.error);

    res.json({
      success: true,
      requestId: req.id,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/drivers/:id/request-docs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driverId = String(req.params.id);
    const driver = await getDriverProfile(driverId);
    if (!driver) throw new AppError(ErrorCode.NOT_FOUND, 'Motorista não encontrado.', 404);

    const { requestedDocs, reason } = req.body;
    if (!requestedDocs) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Especifique os documentos solicitados.', 400);
    }

    const updated = {
      ...driver,
      status: 'PENDING_APPROVAL' as const,
      isOnline: false,
      documentsRequested: requestedDocs,
      rejectionReason: `Documentação pendente: ${requestedDocs}`,
      updatedAt: new Date().toISOString(),
    };

    await saveDriverProfile(updated);

    sendDocumentsRequestedEmail(driver.email, driver.name, requestedDocs, reason).catch(console.error);

    res.json({
      success: true,
      requestId: req.id,
      message: 'Solicitação de documentos enviada por e-mail com sucesso.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/drivers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driverId = String(req.params.id);
    const driver = await getDriverProfile(driverId);
    if (!driver) throw new AppError(ErrorCode.NOT_FOUND, 'Motorista não encontrado.', 404);

    await deleteDriverProfile(driverId);

    res.json({
      success: true,
      requestId: req.id,
      message: `Motorista/Entregador "${driver.name}" excluído com sucesso.`,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/drivers/:id/delete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driverId = String(req.params.id);
    const driver = await getDriverProfile(driverId);
    if (!driver) throw new AppError(ErrorCode.NOT_FOUND, 'Motorista não encontrado.', 404);

    await deleteDriverProfile(driverId);

    res.json({
      success: true,
      requestId: req.id,
      message: `Motorista/Entregador "${driver.name}" excluído com sucesso.`,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/passengers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const passengers = await listAllPassengers();
    res.json({
      success: true,
      requestId: req.id,
      data: passengers,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/passengers/:id/block', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const passenger = await getPassengerProfile(String(req.params.id));
    if (!passenger) throw new AppError(ErrorCode.NOT_FOUND, 'Passageiro não encontrado.', 404);

    const { reason, unpaidAmount } = req.body;
    const updated = {
      ...passenger,
      isBlocked: true,
      blockedReason: reason || 'Bloqueado administrativamente por falta de pagamento ou conduta inadequada.',
      hasUnpaidDebt: unpaidAmount ? true : passenger.hasUnpaidDebt,
      unpaidAmount: unpaidAmount !== undefined ? Number(unpaidAmount) : passenger.unpaidAmount,
      updatedAt: new Date().toISOString(),
    };

    await savePassengerProfile(updated);

    res.json({
      success: true,
      requestId: req.id,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/passengers/:id/unblock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const passenger = await getPassengerProfile(String(req.params.id));
    if (!passenger) throw new AppError(ErrorCode.NOT_FOUND, 'Passageiro não encontrado.', 404);

    const updated = {
      ...passenger,
      isBlocked: false,
      hasUnpaidDebt: false,
      unpaidAmount: 0,
      updatedAt: new Date().toISOString(),
    };
    delete (updated as any).blockedReason;

    await savePassengerProfile(updated);

    res.json({
      success: true,
      requestId: req.id,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/passengers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const passengerId = String(req.params.id);
    const passenger = await getPassengerProfile(passengerId);
    if (!passenger) throw new AppError(ErrorCode.NOT_FOUND, 'Passageiro não encontrado.', 404);

    await deletePassengerProfile(passengerId);

    res.json({
      success: true,
      requestId: req.id,
      message: `Passageiro ${passenger.name} excluído com sucesso.`,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/passengers/:id/delete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const passengerId = String(req.params.id);
    const passenger = await getPassengerProfile(passengerId);
    if (!passenger) throw new AppError(ErrorCode.NOT_FOUND, 'Passageiro não encontrado.', 404);

    await deletePassengerProfile(passengerId);

    res.json({
      success: true,
      requestId: req.id,
      message: `Passageiro ${passenger.name} excluído com sucesso.`,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/passengers/:id/request-docs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const passengerId = String(req.params.id);
    const passenger = await getPassengerProfile(passengerId);
    if (!passenger) throw new AppError(ErrorCode.NOT_FOUND, 'Passageiro não encontrado.', 404);

    const { requestedDocs, reason } = req.body;
    if (!requestedDocs) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Especifique os documentos solicitados.', 400);
    }

    const updated = {
      ...passenger,
      documentsRequested: requestedDocs,
      criminalRecordStatus: 'PENDING' as const,
      updatedAt: new Date().toISOString(),
    };

    await savePassengerProfile(updated);

    sendDocumentsRequestedEmail(passenger.email, passenger.name, requestedDocs, reason).catch(console.error);

    res.json({
      success: true,
      requestId: req.id,
      message: 'Solicitação de documentos enviada por e-mail com sucesso.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reports = await listAllReports();
    res.json({
      success: true,
      requestId: req.id,
      data: reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/reports/:id/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await getReport(String(req.params.id));
    if (!report) throw new AppError(ErrorCode.NOT_FOUND, 'Relato não encontrado.', 404);

    const { resolutionNote, status } = req.body;
    const updated = {
      ...report,
      status: status === 'DISMISSED' ? ('DISMISSED' as const) : ('RESOLVED' as const),
      resolutionNote: resolutionNote || 'Resolvido pela administração.',
      resolvedAt: new Date().toISOString(),
    };

    await saveReport(updated);

    res.json({
      success: true,
      requestId: req.id,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/rides', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rides = await listAllRides();
    res.json({
      success: true,
      requestId: req.id,
      data: rides.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()),
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/pricing', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pricing = await getPlatformPricing();
    res.json({
      success: true,
      requestId: req.id,
      data: pricing,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/pricing', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { baseFare, perKmRate, perMinuteRate, minimumFare, nightSurchargeMultiplier } = req.body;
    const updated = await updatePlatformPricing({
      ...(baseFare !== undefined ? { baseFare: Number(baseFare) } : {}),
      ...(perKmRate !== undefined ? { perKmRate: Number(perKmRate) } : {}),
      ...(perMinuteRate !== undefined ? { perMinuteRate: Number(perMinuteRate) } : {}),
      ...(minimumFare !== undefined ? { minimumFare: Number(minimumFare) } : {}),
      ...(nightSurchargeMultiplier !== undefined ? { nightSurchargeMultiplier: Number(nightSurchargeMultiplier) } : {}),
    });

    res.json({
      success: true,
      requestId: req.id,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/email-diagnostics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({
      success: true,
      requestId: req.id,
      data: emailLogs,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/email-diagnostics/resend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { logId } = req.body;
    const entry = emailLogs.find(l => l.id === logId);
    if (!entry) throw new AppError(ErrorCode.NOT_FOUND, 'Log de e-mail não encontrado.', 404);

    const result = await sendTransactionalEmail({
      to: entry.to,
      subject: `[Reenvio] ${entry.subject}`,
      template: entry.template,
      html: `<p>Reenvio de notificação VaiCar.</p>`,
    });

    res.json({
      success: true,
      requestId: req.id,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});
