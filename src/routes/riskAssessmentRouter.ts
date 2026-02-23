import { Router } from 'express';
import { RiskAssessmentController } from '../controllers/RiskAssessmentController';
import { createAuthenticateMiddleware } from '../middleware/authenticate.middleware';
import {AuthService} from "../services/AuthService";

export function createRiskAssessmentRouter(
    authService: AuthService,
  riskController: RiskAssessmentController
): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(authService);

  // All routes in this router require a valid JWT
  router.use(authenticate);

  // Risk assessment — registered before GET /:id to avoid route shadowing
  router.post('/:id/risk-assessment', riskController.assess);


  return router;
}
