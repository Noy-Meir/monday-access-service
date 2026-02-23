import { TokenPayload } from '../models/AccessRequest';
import { Permission, ROLE_PERMISSIONS } from '../models/Permission';
import { AppError } from '../utils/AppError';

/**
 * Centralised authorization service.
 *
 * All permission checks flow through here — the service layer never inspects
 * `actor.role` directly. This decouples business logic from the role model:
 * adding a new role only requires updating ROLE_PERMISSIONS, not service code.
 *
 * Two complementary APIs:
 *  - hasPermission  → boolean, for conditional behaviour ("show extra fields if allowed")
 *  - assertPermission → throws AppError 403, for hard guards at method entry points
 */
export class AuthorizationService {
  /**
   * Returns true if the actor's role has been granted the requested permission.
   */
  hasPermission(actor: TokenPayload, permission: Permission): boolean {
    return ROLE_PERMISSIONS[actor.role]?.has(permission) ?? false;
  }

  /**
   * Throws AppError 403 when the actor does not hold the required permission.
   * The error message includes both the role and the permission so that
   * operators can diagnose access-denied events from logs alone.
   */
  assertPermission(actor: TokenPayload, permission: Permission): void {
    if (!this.hasPermission(actor, permission)) {
      throw new AppError(
        `Access denied: role '${actor.role}' does not have permission '${permission}'`,
        403
      );
    }
  }
}
