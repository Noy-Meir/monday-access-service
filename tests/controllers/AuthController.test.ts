import { AuthController } from '../../src/controllers/AuthController';
import { AuthService } from '../../src/services/AuthService';
import { AppError } from '../../src/utils/AppError';
import { mockUser } from '../helpers/fixtures';
import { createMockNext, createMockRequest, createMockResponse } from '../helpers/mockExpress';

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ── AuthService mock ──────────────────────────────────────────────────────────
function buildMockAuthService(): jest.Mocked<Pick<AuthService, 'login'>> {
  return { login: jest.fn() };
}

describe('AuthController', () => {
  let authService: jest.Mocked<Pick<AuthService, 'login'>>;
  let controller: AuthController;

  beforeEach(() => {
    authService = buildMockAuthService();
    controller = new AuthController(authService as unknown as AuthService);
  });

  describe('login', () => {
    const validBody = { email: 'alice@company.com', password: 'Password123!' };
    const serviceResult = {
      token: 'mock.jwt.token',
      user: { id: mockUser.id, email: mockUser.email, name: mockUser.name, role: mockUser.role },
    };

    it('calls authService.login with email and password from req.body', async () => {
      authService.login.mockResolvedValue(serviceResult);
      const req = createMockRequest({ body: validBody });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.login(req, res, next);

      expect(authService.login).toHaveBeenCalledWith(validBody.email, validBody.password);
    });

    it('responds with 200 and { data: { token, user } } on success', async () => {
      authService.login.mockResolvedValue(serviceResult);
      const req = createMockRequest({ body: validBody });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.login(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ data: serviceResult });
    });

    it('does not call next on success', async () => {
      authService.login.mockResolvedValue(serviceResult);
      const req = createMockRequest({ body: validBody });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.login(req, res, next);

      expect(next).not.toHaveBeenCalled();
    });

    it('calls next with the error when authService.login throws AppError 401', async () => {
      const error = new AppError('Invalid credentials', 401);
      authService.login.mockRejectedValue(error);
      const req = createMockRequest({ body: validBody });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.login(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.json).not.toHaveBeenCalled();
    });

    it('calls next with unexpected errors (e.g. db failure)', async () => {
      const unexpectedError = new Error('Something blew up');
      authService.login.mockRejectedValue(unexpectedError);
      const req = createMockRequest({ body: validBody });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.login(req, res, next);

      expect(next).toHaveBeenCalledWith(unexpectedError);
    });
  });
});
