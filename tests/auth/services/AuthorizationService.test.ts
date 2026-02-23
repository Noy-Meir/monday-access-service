import { AuthorizationService } from '../../../src/modules/auth/services/AuthorizationService';
import { Permission } from '../../../src/models/Permission';
import { Role } from '../../../src/models/AccessRequest';
import {
  mockEmployeePayload,
  mockITPayload,
  mockManagerPayload,
  mockHRPayload,
  mockAdminPayload,
} from '../../helpers/fixtures';

describe('AuthorizationService', () => {
  let authz: AuthorizationService;

  beforeEach(() => {
    authz = new AuthorizationService();
  });

  // ── hasPermission ──────────────────────────────────────────────────────────
  describe('hasPermission', () => {
    /**
     * These tables are the machine-readable version of the ROLE_PERMISSIONS matrix.
     * If a permission is added to or removed from a role, the test will fail here
     * first — making the change intentional and visible in the diff.
     */
    describe('EMPLOYEE role', () => {
      it.each<[Permission, boolean]>([
        [Permission.ACCESS_REQUEST_CREATE,          true],
        [Permission.ACCESS_REQUEST_VIEW_OWN,        true],
        [Permission.ACCESS_REQUEST_VIEW_ALL,         false],
        [Permission.ACCESS_REQUEST_VIEW_BY_STATUS,  false],
        [Permission.ACCESS_REQUEST_DECIDE,           false],
      ])('%s → %s', (permission, expected) => {
        expect(authz.hasPermission(mockEmployeePayload, permission)).toBe(expected);
      });
    });

    describe('IT role', () => {
      it.each<[Permission, boolean]>([
        [Permission.ACCESS_REQUEST_CREATE,          true],
        [Permission.ACCESS_REQUEST_VIEW_OWN,        true],
        [Permission.ACCESS_REQUEST_VIEW_ALL,         true],
        [Permission.ACCESS_REQUEST_VIEW_BY_STATUS,  true],
        [Permission.ACCESS_REQUEST_DECIDE,           true],
      ])('%s → %s', (permission, expected) => {
        expect(authz.hasPermission(mockITPayload, permission)).toBe(expected);
      });
    });

    describe('MANAGER role', () => {
      it.each<[Permission, boolean]>([
        [Permission.ACCESS_REQUEST_CREATE,          true],
        [Permission.ACCESS_REQUEST_VIEW_OWN,        true],
        [Permission.ACCESS_REQUEST_VIEW_ALL,         true],
        [Permission.ACCESS_REQUEST_VIEW_BY_STATUS,  true],
        [Permission.ACCESS_REQUEST_DECIDE,           true],
      ])('%s → %s', (permission, expected) => {
        expect(authz.hasPermission(mockManagerPayload, permission)).toBe(expected);
      });
    });

    describe('HR role', () => {
      it.each<[Permission, boolean]>([
        [Permission.ACCESS_REQUEST_CREATE,          true],
        [Permission.ACCESS_REQUEST_VIEW_OWN,        true],
        [Permission.ACCESS_REQUEST_VIEW_ALL,         true],
        [Permission.ACCESS_REQUEST_VIEW_BY_STATUS,  true],
        [Permission.ACCESS_REQUEST_DECIDE,           true],
      ])('%s → %s', (permission, expected) => {
        expect(authz.hasPermission(mockHRPayload, permission)).toBe(expected);
      });
    });

    describe('ADMIN role', () => {
      it.each<[Permission, boolean]>([
        [Permission.ACCESS_REQUEST_CREATE,          true],
        [Permission.ACCESS_REQUEST_VIEW_OWN,        true],
        [Permission.ACCESS_REQUEST_VIEW_ALL,         true],
        [Permission.ACCESS_REQUEST_VIEW_BY_STATUS,  true],
        [Permission.ACCESS_REQUEST_DECIDE,           true],
      ])('%s → %s', (permission, expected) => {
        expect(authz.hasPermission(mockAdminPayload, permission)).toBe(expected);
      });
    });
  });

  // ── assertPermission ───────────────────────────────────────────────────────
  describe('assertPermission', () => {
    it('does not throw when the actor holds the required permission', () => {
      expect(() =>
        authz.assertPermission(mockITPayload, Permission.ACCESS_REQUEST_DECIDE)
      ).not.toThrow();
    });

    it('throws AppError 403 when the actor lacks the permission', () => {
      expect(() =>
        authz.assertPermission(mockEmployeePayload, Permission.ACCESS_REQUEST_DECIDE)
      ).toThrow(expect.objectContaining({ statusCode: 403 }));
    });

    it('includes both the role name and the permission in the error message', () => {
      expect(() =>
        authz.assertPermission(mockEmployeePayload, Permission.ACCESS_REQUEST_DECIDE)
      ).toThrow(
        expect.objectContaining({
          message: `Access denied: role '${Role.EMPLOYEE}' does not have permission '${Permission.ACCESS_REQUEST_DECIDE}'`,
        })
      );
    });

    it('allows IT to assert every permission without throwing', () => {
      Object.values(Permission).forEach((permission) => {
        expect(() =>
          authz.assertPermission(mockITPayload, permission)
        ).not.toThrow();
      });
    });

    it('allows MANAGER to assert every permission without throwing', () => {
      Object.values(Permission).forEach((permission) => {
        expect(() =>
          authz.assertPermission(mockManagerPayload, permission)
        ).not.toThrow();
      });
    });

    it('allows HR to assert every permission without throwing', () => {
      Object.values(Permission).forEach((permission) => {
        expect(() =>
          authz.assertPermission(mockHRPayload, permission)
        ).not.toThrow();
      });
    });

    it('allows ADMIN to assert every permission without throwing', () => {
      Object.values(Permission).forEach((permission) => {
        expect(() =>
          authz.assertPermission(mockAdminPayload, permission)
        ).not.toThrow();
      });
    });

    it('EMPLOYEE cannot DECIDE', () => {
      expect(() =>
        authz.assertPermission(mockEmployeePayload, Permission.ACCESS_REQUEST_DECIDE)
      ).toThrow(expect.objectContaining({ statusCode: 403 }));
    });

    it('denies EMPLOYEE every permission outside their granted set', () => {
      const denied = [
        Permission.ACCESS_REQUEST_VIEW_ALL,
        Permission.ACCESS_REQUEST_VIEW_BY_STATUS,
        Permission.ACCESS_REQUEST_DECIDE,
      ];
      denied.forEach((permission) => {
        expect(() =>
          authz.assertPermission(mockEmployeePayload, permission)
        ).toThrow(expect.objectContaining({ statusCode: 403 }));
      });
    });
  });
});
