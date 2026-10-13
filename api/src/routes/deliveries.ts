import { Router, Request, Response, NextFunction } from 'express';
import { addDeliveryWaitlistEntry } from '../services/deliveryWaitlist.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCode } from '../../../shared/src/errors.js';

export const deliveriesRouter = Router();

/**
 * Public informational endpoint about the upcoming VaiCar Entregas service.
 */
deliveriesRouter.get('/info', (req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'VaiCar Entregas',
    status: 'COMING_SOON',
    label: 'Em Breve',
    market: 'São Sebastião, Litoral Norte SP',
    modalities: [
      {
        type: 'motorcycle',
        label: 'Motocicleta',
        description: 'Entregas ágeis para comércio, farmácias, restaurantes e encomendas expressas.',
      },
      {
        type: 'bicycle',
        label: 'Bicicleta',
        description: 'Entregas ecológicas e rápidas no Centro Histórico, orla e bairros planos.',
      },
    ],
    notice:
      'O serviço de entregas está em estruturação operacional e regulatória. Não está disponível para agendamento imediato ou dentro dos aplicativos de corrida atuais.',
  });
});

/**
 * Public endpoint to register interest in the Delivery Service waiting list.
 */
deliveriesRouter.post('/waitlist', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, phone, email, role, vehicleDetails, neighborhood, notes } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Nome é obrigatório (mínimo 2 caracteres).', 400);
    }

    if (!phone || typeof phone !== 'string' || phone.replace(/\D/g, '').length < 10) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Telefone/WhatsApp com DDD é obrigatório.', 400);
    }

    const validRoles = ['courier_motorcycle', 'courier_bicycle', 'merchant', 'consumer'];
    const selectedRole = validRoles.includes(role) ? role : 'courier_motorcycle';

    const entry = await addDeliveryWaitlistEntry({
      name,
      phone,
      email,
      role: selectedRole,
      vehicleDetails,
      neighborhood,
      notes,
    });

    res.status(201).json({
      success: true,
      message: 'Seu interesse no VaiCar Entregas foi registrado com sucesso! Entraremos em contato assim que o serviço for inaugurado.',
      data: {
        id: entry.id,
        name: entry.name,
        role: entry.role,
        createdAt: entry.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});
