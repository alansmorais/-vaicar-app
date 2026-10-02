import { Router, Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCode } from '../../../shared/src/errors.js';
import { getReceipt } from '../services/firestore.js';

export const receiptsRouter = Router();

receiptsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const receipt = await getReceipt(req.params.id);
    if (!receipt) throw new AppError(ErrorCode.NOT_FOUND, 'Recibo não encontrado.', 404);

    res.json({
      success: true,
      requestId: req.id,
      data: receipt,
    });
  } catch (error) {
    next(error);
  }
});

receiptsRouter.get('/:id/html', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const receipt = await getReceipt(req.params.id);
    if (!receipt) throw new AppError(ErrorCode.NOT_FOUND, 'Recibo não encontrado.', 404);

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Recibo VaiCar - ${receipt.receiptNumber}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #020617; color: #F8FAFC; margin: 0; padding: 40px; display: flex; justify-content: center; }
          .receipt-card { background: #0F172A; border: 1px solid #16A34A; border-radius: 16px; padding: 32px; max-width: 500px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          .header { text-align: center; border-bottom: 1px solid #334155; padding-bottom: 20px; margin-bottom: 24px; }
          .logo { font-size: 28px; font-weight: 800; color: #16A34A; letter-spacing: -1px; }
          .logo span { color: #22C55E; }
          .number { font-size: 13px; color: #94A3B8; margin-top: 4px; }
          .amount-box { text-align: center; background: #1E293B; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
          .amount-label { font-size: 14px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px; }
          .amount { font-size: 36px; font-weight: 800; color: #22C55E; margin: 6px 0; }
          .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #334155; font-size: 14px; }
          .row:last-child { border-bottom: none; }
          .label { color: #94A3B8; }
          .val { font-weight: 600; color: #F8FAFC; text-align: right; }
          .addresses { margin-top: 20px; background: #1E293B; border-radius: 8px; padding: 16px; }
          .addr-item { font-size: 13px; margin-bottom: 10px; }
          .addr-item:last-child { margin-bottom: 0; }
          .addr-tag { color: #16A34A; font-weight: bold; margin-right: 6px; }
          .footer { text-align: center; font-size: 12px; color: #64748B; margin-top: 28px; }
          @media print {
            body { background: white; color: black; padding: 0; }
            .receipt-card { border: 1px solid #ccc; background: white; color: black; box-shadow: none; }
            .amount-box, .addresses { background: #f8f9fa; }
            .val, .amount { color: #16A34A; }
          }
        </style>
      </head>
      <body>
        <div class="receipt-card">
          <div class="header">
            <div class="logo">VAI<span>CAR</span></div>
            <div class="number">Recibo Oficial nº ${receipt.receiptNumber}</div>
            <div style="font-size: 12px; color: #94A3B8; margin-top: 4px;">São Sebastião — Litoral Norte SP</div>
          </div>
          <div class="amount-box">
            <div class="amount-label">Valor Pago</div>
            <div class="amount">R$ ${receipt.fareAmount.toFixed(2)}</div>
            <div style="font-size: 13px; color: #CBD5E1;">${receipt.paymentMethod} • ${receipt.paymentStatus}</div>
          </div>
          <div class="row"><span class="label">Passageiro</span><span class="val">${receipt.passengerName}</span></div>
          <div class="row"><span class="label">Motorista</span><span class="val">${receipt.driverName}</span></div>
          <div class="row"><span class="label">Veículo</span><span class="val">${receipt.vehicleDescription} (${receipt.vehiclePlate})</span></div>
          <div class="row"><span class="label">Data / Hora</span><span class="val">${new Date(receipt.dateTime).toLocaleString('pt-BR')}</span></div>
          <div class="row"><span class="label">Distância</span><span class="val">${receipt.distanceKm.toFixed(1)} km</span></div>
          <div class="row"><span class="label">Duração</span><span class="val">${receipt.durationMinutes} minutos</span></div>

          <div class="addresses">
            <div class="addr-item"><span class="addr-tag">Partida:</span> ${receipt.originAddress}</div>
            <div class="addr-item"><span class="addr-tag">Destino:</span> ${receipt.destinationAddress}</div>
          </div>

          <div class="footer">
            VaiCar Tecnologia e Mobilidade Urbana Ltda.<br/>
            Comprovante gerado eletronicamente em ${new Date(receipt.generatedAt).toLocaleString('pt-BR')}
          </div>
        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    next(error);
  }
});
