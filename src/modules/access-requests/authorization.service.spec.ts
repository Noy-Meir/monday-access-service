import { AuthorizationService } from './service/AuthorizationService';
import { Permission } from '../../models/Permission';
import { Role } from '../../models/AccessRequest';
import { mockEmployeePayload, mockApproverPayload } from '../../../tests/helpers/fixtures';

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

    describe('APPROVER role', () => {
      it.each<[Permission, boolean]>([
        [Permission.ACCESS_REQUEST_CREATE,          true],
        [Permission.ACCESS_REQUEST_VIEW_OWN,        true],
        [Permission.ACCESS_REQUEST_VIEW_ALL,         true],
        [Permission.ACCESS_REQUEST_VIEW_BY_STATUS,  true],
        [Permission.ACCESS_REQUEST_DECIDE,           true],
      ])('%s → %s', (permission, expected) => {
        expect(authz.hasPermission(mockApproverPayload, permission)).toBe(expected);
      });
    });
  });

  // ── assertPermission ───────────────────────────────────────────────────────
  describe('assertPermission', () => {
    it('does not throw when the actor holds the required permission', () => {
      expect(() =>
        authz.assertPermission(mockApproverPayload, Permission.ACCESS_REQUEST_DECIDE)
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

    it('allows APPROVER to assert every permission without throwing', () => {
      Object.values(Permission).forEach((permission) => {
        expect(() =>
          authz.assertPermission(mockApproverPayload, permission)
        ).not.toThrow();
      });
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
