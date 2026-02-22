import { Request, Response, NextFunction } from 'express';
import { Role } from '../models/AccessRequest';
import { AppError } from '../utils/AppError';

/**
 * Factory that returns a role-based authorization middleware.
 * Must be used after createAuthenticateMiddleware (requires req.user to be set).
 */
export function createAuthorizeMiddleware(allowedRoles: Role[]) {
  return function authorize(req: Request, _res: Response, next: NextFunction): void {
    if (!req.user) {
      next(new AppError('Unauthenticated — token missing', 401));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        new AppError(
          `Role '${req.user.role}' is not authorized for this action. Required: ${allowedRoles.join(', ')}`,
          403
        )
      );
      return;
    }

    next();
  };
}
