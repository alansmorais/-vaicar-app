import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: {
        uid: string;
        email: string;
        role?: string;
        isAdmin?: boolean;
      };
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const reqId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
}
