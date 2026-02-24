import { TokenPayload } from '../models/AccessRequest';
import { Permission, ROLE_PERMISSIONS } from '../models/Permission';
import { AppError } from '../utils/AppError';

/**
 * Centralized authorization service.
 * * Decouples logic from roles: Checks permissions via ROLE_PERMISSIONS (no direct role inspection).
 * * Two APIs:
 * - hasPermission: Returns boolean for conditional logic.
 * - assertPermission: Throws 403 AppError for hard guards.
 */
export class AuthorizationService {

  hasPermission(actor: TokenPayload, permission: Permission): boolean {
    return ROLE_PERMISSIONS[actor.role]?.has(permission) ?? false;
  }


  assertPermission(actor: TokenPayload, permission: Permission): void {
    if (!this.hasPermission(actor, permission)) {
      throw new AppError(
        `Access denied: role '${actor.role}' does not have permission '${permission}'`,
        403
      );
    }
  }
}
