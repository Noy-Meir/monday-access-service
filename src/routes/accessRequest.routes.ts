import { Router } from 'express';
import { AccessRequestController } from '../controllers/AccessRequestController';
import { AuthService } from '../services/AuthService';
import { createAuthenticateMiddleware } from '../middleware/authenticate.middleware';
import { createAuthorizeMiddleware } from '../middleware/authorize.middleware';
import { createValidateMiddleware } from '../middleware/validate.middleware';
import { createAccessRequestSchema } from '../validators/createAccessRequest.schema';
import { decideAccessRequestSchema } from '../validators/decideAccessRequest.schema';
import { Permission } from '../models/Permission';

export function createAccessRequestRouter(
  controller: AccessRequestController,
  authService: AuthService
): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(authService);

  // All routes in this router require a valid JWT
  router.use(authenticate);

  // Any authenticated user can submit a request
  router.post(
    '/',
    createValidateMiddleware(createAccessRequestSchema),
    controller.create
  );

  // Requires ACCESS_REQUEST_DECIDE — approve or deny a PENDING request
  router.patch(
    '/:id/decision',
    createAuthorizeMiddleware(Permission.ACCESS_REQUEST_DECIDE),
    createValidateMiddleware(decideAccessRequestSchema),
    controller.decide
  );

  // Get requests for a specific user (service enforces own-only for employees)
  router.get('/user/:userId', controller.getByUser);

  // Requires ACCESS_REQUEST_VIEW_BY_STATUS — filter all requests by status
  router.get(
    '/status/:status',
    createAuthorizeMiddleware(Permission.ACCESS_REQUEST_VIEW_BY_STATUS),
    controller.getByStatus
  );

  // Requires ACCESS_REQUEST_VIEW_ALL — list every request in the system
  router.get(
    '/',
    createAuthorizeMiddleware(Permission.ACCESS_REQUEST_VIEW_ALL),
    controller.getAll
  );

  // Get a single request by ID — must be registered last to avoid shadowing
  // the more specific /user/:userId and /status/:status routes above
  router.get('/:id', controller.getById);

  return router;
}
