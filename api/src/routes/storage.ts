import { Router, Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';
import { ErrorCode } from '../../../shared/src/errors.js';
import { validateImageBuffer, storeImage } from '../services/storage.js';

export const storageRouter = Router();

// Uploads contain identity and vehicle documents; require a verified account token.
storageRouter.use(authenticate);

storageRouter.post('/upload', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileData, pathPrefix, uid } = req.body;
    const authenticatedUid = req.user!.uid;
    const allowedFolders = new Set(['users', 'drivers']);
    if (typeof uid !== 'string' || (uid !== authenticatedUid && !uid.startsWith(`${authenticatedUid}_`))) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Você só pode enviar arquivos para sua própria conta.', 403);
    }
    if (pathPrefix !== undefined && !allowedFolders.has(pathPrefix)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Pasta de destino inválida.', 400);
    }
    if (!fileData || typeof fileData !== 'string') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Dados do arquivo de imagem não fornecidos.', 400);
    }

    // Extract base64 payload
    let base64Content = fileData;
    let declaredMime: string | undefined;
    if (fileData.includes(';base64,')) {
      const parts = fileData.split(';base64,');
      declaredMime = parts[0].replace(/^data:/, '').toLowerCase();
      base64Content = parts[1];
    }
    // Remove all whitespace, line breaks or carriage returns from base64
    base64Content = base64Content.replace(/\s+/g, '');

    const buffer = Buffer.from(base64Content, 'base64');
    let validation = validateImageBuffer(buffer);

    // If buffer magic bytes fell through but declared MIME is a standard image and safety check passes
    if (!validation.valid && declaredMime && ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(declaredMime)) {
      const headerStr = buffer.toString('utf-8', 0, Math.min(buffer.length, 100)).toLowerCase();
      if (!headerStr.includes('<svg') && !headerStr.includes('<?xml') && !headerStr.includes('<html')) {
        validation = { valid: true, mimeType: declaredMime === 'image/jpg' ? 'image/jpeg' : declaredMime };
      }
    }

    if (!validation.valid || !validation.mimeType) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, validation.error || 'Arquivo inválido. Envie imagem (JPG, PNG, WebP) ou documento PDF.', 400);
    }

    const ext = validation.mimeType === 'application/pdf'
      ? 'pdf'
      : validation.mimeType === 'image/jpeg'
      ? 'jpg'
      : validation.mimeType === 'image/png'
      ? 'png'
      : 'webp';

    const folder = pathPrefix || 'users';
    const userPart = uid;
    const storagePath = `${folder}/${userPart}/file.${ext}`;

    const uploadResult = await storeImage(storagePath, buffer, validation.mimeType);

    res.json({
      success: true,
      requestId: req.id,
      data: uploadResult,
    });
  } catch (error) {
    next(error);
  }
});
