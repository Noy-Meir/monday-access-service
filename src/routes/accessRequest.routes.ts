import { Router } from 'express';
import { AccessRequestController } from '../controllers/AccessRequestController';
import { AuthService } from '../services/AuthService';
import { createAuthenticateMiddleware } from '../middleware/authenticate.middleware';
import { createAuthorizeMiddleware } from '../middleware/authorize.middleware';
import { createValidateMiddleware } from '../middleware/validate.middleware';
import { createAccessRequestSchema } from '../validators/createAccessRequest.schema';
import { decideAccessRequestSchema } from '../validators/decideAccessRequest.schema';
import { Role } from '../models/AccessRequest';

export function createAccessRequestRouter(
  controller: AccessRequestController,
  authService: AuthService
): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(authService);

  // All routes in this router require a valid JWT
  router.use(authenticate);

  router.get('/:id', controller.getById);

  // Any authenticated user can submit a request
  router.post(
    '/',
    createValidateMiddleware(createAccessRequestSchema),
    controller.create
  );

  // APPROVER only: approve or deny a PENDING request
  router.patch(
    '/:id/decision',
    createAuthorizeMiddleware([Role.APPROVER]),
    createValidateMiddleware(decideAccessRequestSchema),
    controller.decide
  );

  // Get requests for a specific user (employees: own only, approvers: any)
  router.get('/user/:userId', controller.getByUser);

  // APPROVER only: filter all requests by status
  router.get(
    '/status/:status',
    createAuthorizeMiddleware([Role.APPROVER]),
    controller.getByStatus
  );

  // APPROVER only: list all requests
  router.get(
    '/',
    createAuthorizeMiddleware([Role.APPROVER]),
    controller.getAll
  );

  return router;
}
