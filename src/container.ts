import { AuthService } from './services/AuthService';
import { AuthController } from './controllers/AuthController';
import { AiAgentModule } from './modules/ai-agent';
import { AccessRequestModule } from './modules/access-requests';

const authService = new AuthService(new Map());
const authController = new AuthController(authService);
const aiAgentService = AiAgentModule.create();
const { router: accessRequestRouter, repository: accessRequestRepository } =
  AccessRequestModule.create(authService, aiAgentService);

export const container = {
  authService,
  authController,
  accessRequestRouter,
  accessRequestRepository,
} as const;
