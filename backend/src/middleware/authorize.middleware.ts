import { Request, Response, NextFunction } from 'express';
import { Permission, ROLE_PERMISSIONS } from '../models/Permission';
import { AppError } from '../utils/AppError';

/**
 * Factory that returns a permission-based authorization middleware.
 * Must be used after createAuthenticateMiddleware (requires req.user to be set).
 *
 * Accepts a single Permission instead of a role list, so routes read as
 * plain English:  authorize(Permission.ACCESS_REQUEST_DECIDE)
 * rather than:    authorize([Role.APPROVER])
 *
 * The permission → role mapping lives entirely in ROLE_PERMISSIONS (models/Permission.ts).
 * No role name ever appears in route definitions.
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
