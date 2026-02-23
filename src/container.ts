/**
 * Dependency Injection container.
 * This is the single place where all concrete classes are instantiated
 * and their dependencies wired together. Nothing else in the codebase
 * calls `new` on a service or repository.
 */
import { InMemoryAccessRequestRepository } from './repositories/InMemoryAccessRequestRepository';
import { AuthService } from './services/AuthService';
import { AuthorizationService } from './services/AuthorizationService';
import { AccessRequestService } from './services/AccessRequestService';
import { AccessRequestController } from './controllers/AccessRequestController';
import { AuthController } from './controllers/AuthController';
import { RiskAssessmentController } from './controllers/RiskAssessmentController';
import { IAiProvider } from './modules/ai-agent/providers/IAiProvider';
import { MockAiProvider } from './modules/ai-agent/providers/MockAiProvider';
import { ClaudeAiProvider } from './modules/ai-agent/providers/ClaudeAiProvider';
import { RiskAssessmentAgent } from './modules/ai-agent/agent/RiskAssessmentAgent';
import { config } from './config';
import { logger } from './utils/logger';

// ── Repositories ──────────────────────────────────────────────────────────────
const accessRequestRepository = new InMemoryAccessRequestRepository();

// ── Services ──────────────────────────────────────────────────────────────────
// AuthService owns the user Map; seedData() populates it via registerUser().
const authService = new AuthService(new Map());
const authorizationService = new AuthorizationService();
const accessRequestService = new AccessRequestService(accessRequestRepository, authorizationService);

// ── AI ────────────────────────────────────────────────────────────────────────
function createAiProvider(): IAiProvider {
  if (config.ai.provider === 'claude') {
    if (!config.ai.apiKey) {
      logger.warn('AI_PROVIDER=claude but ANTHROPIC_API_KEY not set — falling back to mock');
      return new MockAiProvider();
    }
    return new ClaudeAiProvider();
  }
  return new MockAiProvider();
}

const riskAssessmentAgent = new RiskAssessmentAgent(createAiProvider());

// ── Controllers ───────────────────────────────────────────────────────────────
const accessRequestController = new AccessRequestController(accessRequestService);
const authController = new AuthController(authService);
const riskAssessmentController = new RiskAssessmentController(accessRequestService, riskAssessmentAgent);

export const container = {
  accessRequestRepository,
  authService,
  authorizationService,
  accessRequestService,
  riskAssessmentAgent,
  accessRequestController,
  authController,
  riskAssessmentController,
} as const;
