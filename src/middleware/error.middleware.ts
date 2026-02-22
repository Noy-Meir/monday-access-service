import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

/**
 * Global Express error handler. Must be registered last (after all routes).
 * - AppError (operational errors): logged as warn, status from the error.
 * - Everything else (programmer errors): logged as error, always returns 500.
 */
export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  // Express requires the 4-parameter signature for error handlers even if _next is unused.
  _next: NextFunction
): void {
  const isAppError = err instanceof AppError || (err as AppError).isOperational === true;

  if (isAppError) {
    const appErr = err as AppError;
    logger.warn('Operational error', {
      statusCode: appErr.statusCode,
      message: appErr.message,
      details: appErr.details,
      path: req.path,
      method: req.method,
    });

    res.status(appErr.statusCode).json({
      error: {
        message: appErr.message,
        ...(appErr.details !== undefined ? { details: appErr.details } : {}),
      },
    });
    return;
  }

  // Unknown / programmer error — log the full stack but never expose it to the client.
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: { message: 'Internal server error' },
  });
}
