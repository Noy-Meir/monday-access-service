import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Global request logger that captures the full lifecycle of a request.
 * Logs entry points for visibility and completion for performance (latency) and status.
 * Specialized to extract GraphQL operation names from the request body.
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, path, ip } = req;

  const operationName = req.body?.operationName || 'unknown';
  const isGraphQL = path === '/graphql';
  const label = isGraphQL ? `GraphQL: ${operationName}` : `HTTP: ${path}`;

  logger.info(`Incoming ${method} ${label}`, {
    method,
    path,
    operationName: isGraphQL ? operationName : undefined,
    ip,
    userAgent: req.get('user-agent'),
  });

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const statusCode = res.statusCode;

    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    logger[level](`Completed ${method} ${label}`, {
      method,
      path,
      operationName: isGraphQL ? operationName : undefined,
      statusCode,
      durationMs,
      userId: (req as any).user?.sub ?? 'anonymous',
    });
  });

  next();
}
