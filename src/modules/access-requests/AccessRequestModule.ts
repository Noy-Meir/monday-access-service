import { Router } from 'express';
import { AuthService } from '../../services/AuthService';
import { IAiAgentService } from '../ai-agent';
import { InMemoryAccessRequestRepository } from './repository/InMemoryAccessRequestRepository';
import { AuthorizationService } from './service/AuthorizationService';
import { AccessRequestService } from './service/AccessRequestService';
import { AccessRequestController } from './controllers/AccessRequestController';
import { RiskAssessmentController } from './controllers/RiskAssessmentController';
import { createAccessRequestRouter } from './access-requests.router';

export class AccessRequestModule {
  static create(
    authService: AuthService,
    aiAgentService: IAiAgentService
  ): { router: Router; repository: InMemoryAccessRequestRepository } {
    const repository = new InMemoryAccessRequestRepository();
    const authz = new AuthorizationService();
    const service = new AccessRequestService(repository, authz);
    const controller = new AccessRequestController(service);
    const riskController = new RiskAssessmentController(service, aiAgentService);
    const router = createAccessRequestRouter(controller, authService, riskController);
    return { router, repository };
  }
}
