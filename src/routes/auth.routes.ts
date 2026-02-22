import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { createValidateMiddleware } from '../middleware/validate.middleware';
import { loginSchema } from '../validators/login.schema';

export function createAuthRouter(authController: AuthController): Router {
  const router = Router();

  router.post('/login', createValidateMiddleware(loginSchema), authController.login);

  return router;
}
