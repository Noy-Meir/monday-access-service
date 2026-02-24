import { Request, Response, NextFunction } from 'express';
import { Permission, ROLE_PERMISSIONS } from '../models/Permission';
import { AppError } from '../utils/AppError';

/**
 * Factory that returns a permission-based authorization middleware.
 * Must be used after createAuthenticateMiddleware (requires req.user to be set).
 *
 * Accepts a single Permission instead of a role list, so routes read as
 */
export function createAuthorizeMiddleware(requiredPermission: Permission) {
  return function authorize(req: Request, _res: Response, next: NextFunction): void {
    if (!req.user) {
      next(new AppError('Unauthenticated — token missing', 401));
      return;
    }

    if (!ROLE_PERMISSIONS[req.user.role]?.has(requiredPermission)) {
      next(
        new AppError(
          `Access denied: role '${req.user.role}' does not have permission '${requiredPermission}'`,
          403
        )
      );
      return;
    }

    next();
  };
}
