import { Role } from './AccessRequest';

/**
 * Granular, namespaced permissions that describe every action in the system.
 * Naming convention: <resource>:<verb>[:<scope>]
 *
 * Adding a new capability = adding a value here + updating ROLE_PERMISSIONS below.
 * No other file needs to change.
 */
export enum Permission {
  ACCESS_REQUEST_CREATE         = 'access_request:create',
  ACCESS_REQUEST_VIEW_OWN       = 'access_request:view:own',
  ACCESS_REQUEST_VIEW_ALL       = 'access_request:view:all',
  ACCESS_REQUEST_VIEW_BY_STATUS = 'access_request:view:by_status',
  ACCESS_REQUEST_DECIDE         = 'access_request:decide',
}

/**
 * The authoritative permission matrix.
 * Maps every Role to the exact set of Permissions it is granted.
 *
 * This is the single source of truth for "what can each role do?"
 * Both the authorization middleware and the AuthorizationService read from here.
 */
export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  [Role.EMPLOYEE]: new Set([
    Permission.ACCESS_REQUEST_CREATE,
    Permission.ACCESS_REQUEST_VIEW_OWN,
  ]),

  [Role.APPROVER]: new Set([
    Permission.ACCESS_REQUEST_CREATE,
    Permission.ACCESS_REQUEST_VIEW_OWN,
    Permission.ACCESS_REQUEST_VIEW_ALL,
    Permission.ACCESS_REQUEST_VIEW_BY_STATUS,
    Permission.ACCESS_REQUEST_DECIDE,
  ]),
} as const;
