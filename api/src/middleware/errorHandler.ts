import { Request, Response, NextFunction } from 'express';
import { ErrorCode, ErrorCodeType, getFriendlyErrorMessage } from '../../../shared/src/errors.js';

export class AppError extends Error {
  public code: ErrorCodeType;
  public statusCode: number;
  public details?: any;

  constructor(code: ErrorCodeType, message?: string, statusCode = 400, details?: any) {
    super(message || getFriendlyErrorMessage(code));
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const requestId = req.id || 'req-unknown';
  const statusCode = err.statusCode || (err.status ? Number(err.status) : 500);
  const code: ErrorCodeType = err.code && Object.values(ErrorCode).includes(err.code)
    ? err.code
    : ErrorCode.INTERNAL_ERROR;
  
  const message = err.message || getFriendlyErrorMessage(code);
  const details = err.details || undefined;

  // Log error safely without leaking sensitive information
  console.error(`[Error] [${requestId}] [${code}] ${message}`, err.stack ? `\n${err.stack}` : '');

  res.status(statusCode).json({
    success: false,
    requestId,
    error: {
      code,
      message,
      ...(details ? { details } : {})
    }
  });
}
