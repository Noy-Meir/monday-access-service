import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../modules/auth/services/AuthService';

/**
 * Factory that returns a JWT authentication middleware.
 * Extracts the Bearer token from the Authorization header,
 * verifies it, and attaches the decoded payload to req.user.
 */
export function createAuthenticateMiddleware(authService: AuthService) {
  return function authenticate(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: { message: 'Missing or malformed Authorization header. Expected: Bearer <token>' } });
      return;
    }

    const token = authHeader.slice(7);

    try {
      req.user = authService.verifyToken(token);
      next();
    } catch (err) {
      next(err);
    }
  };
}
