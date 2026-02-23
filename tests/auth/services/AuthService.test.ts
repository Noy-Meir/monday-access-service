import { AuthService } from '../../../src/services/AuthService';
import { AppError } from '../../../src/utils/AppError';
import { Role, User } from '../../../src/models/AccessRequest';
import { mockUser } from '../../helpers/fixtures';

// ── Module mocks ──────────────────────────────────────────────────────────────
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
  verify: jest.fn(),
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildService(users: User[] = []): AuthService {
  const map = new Map(users.map((u) => [u.id, u]));
  return new AuthService(map);
}

describe('AuthService', () => {
  // ── login ──────────────────────────────────────────────────────────────────
  describe('login', () => {
    it('returns a token and safe user when credentials are valid', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const service = buildService([mockUser]);

      const result = await service.login(mockUser.email, 'Password123!');

      expect(result.token).toBe('mock.jwt.token');
      expect(result.user.email).toBe(mockUser.email);
      expect(result.user.role).toBe(mockUser.role);
    });

    it('does not expose passwordHash in the returned user', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const service = buildService([mockUser]);

      const result = await service.login(mockUser.email, 'Password123!');

      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('calls jwt.sign with the correct payload shape', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const service = buildService([mockUser]);

      await service.login(mockUser.email, 'Password123!');

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
        }),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('throws AppError 401 for an unknown email', async () => {
      const service = buildService([mockUser]);

      await expect(service.login('nobody@company.com', 'Password123!')).rejects.toThrow(
        new AppError('Invalid credentials', 401)
      );
    });

    it('throws AppError 401 for a wrong password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const service = buildService([mockUser]);

      await expect(service.login(mockUser.email, 'WrongPass!')).rejects.toThrow(
        new AppError('Invalid credentials', 401)
      );
    });

    it('uses the same error message for unknown email and wrong password (anti-enumeration)', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const service = buildService([mockUser]);

      let unknownEmailErr: AppError | null = null;
      let wrongPassErr: AppError | null = null;

      try {
        await service.login('nobody@company.com', 'Password123!');
      } catch (e) {
        unknownEmailErr = e as AppError;
      }

      try {
        await service.login(mockUser.email, 'WrongPass!');
      } catch (e) {
        wrongPassErr = e as AppError;
      }

      expect(unknownEmailErr?.message).toBe(wrongPassErr?.message);
    });

    it('does not call bcrypt.compare when the email is not found', async () => {
      const service = buildService([mockUser]);

      await service.login('nobody@company.com', 'Password123!').catch(() => {});

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });
  });

  // ── verifyToken ────────────────────────────────────────────────────────────
  describe('verifyToken', () => {
    it('returns the decoded payload for a valid token', () => {
      const payload = { sub: 'user-1', email: 'a@b.com', role: Role.EMPLOYEE };
      (jwt.verify as jest.Mock).mockReturnValue(payload);
      const service = buildService();

      const result = service.verifyToken('valid.token.here');

      expect(result).toEqual(payload);
    });

    it('throws AppError 401 when jwt.verify throws (invalid token)', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('invalid signature');
      });
      const service = buildService();

      expect(() => service.verifyToken('bad.token')).toThrow(
        new AppError('Invalid or expired token', 401)
      );
    });

    it('throws AppError 401 when jwt.verify throws (expired token)', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('jwt expired');
      });
      const service = buildService();

      expect(() => service.verifyToken('expired.token')).toThrow(
        new AppError('Invalid or expired token', 401)
      );
    });
  });

  // ── findUserById ───────────────────────────────────────────────────────────
  describe('findUserById', () => {
    it('returns the user when found', () => {
      const service = buildService([mockUser]);
      expect(service.findUserById(mockUser.id)).toEqual(mockUser);
    });

    it('returns undefined for a non-existent id', () => {
      const service = buildService([mockUser]);
      expect(service.findUserById('no-such-id')).toBeUndefined();
    });
  });

  // ── registerUser ───────────────────────────────────────────────────────────
  describe('registerUser', () => {
    it('makes the user discoverable by findUserById after registration', () => {
      const service = buildService();
      const newUser: User = { ...mockUser, id: 'new-user-999' };

      service.registerUser(newUser);

      expect(service.findUserById('new-user-999')).toEqual(newUser);
    });

    it('overwrites an existing user when registered with the same id', () => {
      const service = buildService([mockUser]);
      const updated: User = { ...mockUser, name: 'Updated Name' };

      service.registerUser(updated);

      expect(service.findUserById(mockUser.id)?.name).toBe('Updated Name');
    });
  });

  // ── getUserRole ────────────────────────────────────────────────────────────
  describe('getUserRole', () => {
    it('returns the role for an existing user', () => {
      const service = buildService([mockUser]);
      expect(service.getUserRole(mockUser.id)).toBe(Role.EMPLOYEE);
    });

    it('returns undefined for an unknown user', () => {
      const service = buildService();
      expect(service.getUserRole('ghost')).toBeUndefined();
    });
  });
});
