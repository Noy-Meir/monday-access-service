import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Logs every HTTP request once the response is fully sent.
 *
 * Log level is chosen based on the response status code so that dashboards
 * and alerting tools can filter by severity without parsing the message:
 *   5xx → error  (unexpected failures — page the on-call engineer)
 *   4xx → warn   (client errors — useful for detecting abuse or bad clients)
 *   2xx/3xx → info (normal flow)
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const statusCode = res.statusCode;
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    logger[level]('HTTP request', {
      method: req.method,
      path: req.path,
      statusCode,
      durationMs: Date.now() - start,
      userId: req.user?.sub ?? 'anonymous',
    });
  });

  next();
}
