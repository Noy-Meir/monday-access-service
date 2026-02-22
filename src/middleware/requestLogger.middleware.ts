import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Logs every HTTP request after it finishes, including method, path,
 * status code, response time, and authenticated user (if any).
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    logger.info('HTTP request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      userId: req.user?.sub ?? 'anonymous',
    });
  });

  next();
}
