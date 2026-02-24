/**
 * Dependency Injection container.
 * This is the single place where all concrete classes are instantiated
 * and their dependencies wired together. Nothing else in the codebase
 * calls `new` on a service or repository.
 */
import { InMemoryUserRepository } from './repositories/InMemoryUserRepository';
import { InMemoryAccessRequestRepository } from './repositories/InMemoryAccessRequestRepository';
import { AuthService } from './services/AuthService';
import { AuthorizationService } from './services/AuthorizationService';
import { AccessRequestService } from './services/AccessRequestService';
import { IAiProvider } from './modules/ai-agent/providers/IAiProvider';
import { MockAiProvider } from './modules/ai-agent/providers/MockAiProvider';
import { ClaudeAiProvider } from './modules/ai-agent/providers/ClaudeAiProvider';
import { RiskAssessmentAgent } from './modules/ai-agent/agent/RiskAssessmentAgent';
import { AiProvider, config } from './config';
import { logger } from './utils/logger';

// ── Repositories ──────────────────────────────────────────────────────────────
const userRepository = new InMemoryUserRepository();
const accessRequestRepository = new InMemoryAccessRequestRepository();

// ── Services ──────────────────────────────────────────────────────────────────
const authService = new AuthService(userRepository);
const authorizationService = new AuthorizationService();
const accessRequestService = new AccessRequestService(accessRequestRepository);

// ── AI ────────────────────────────────────────────────────────────────────────
function createAiProvider(): IAiProvider {
  if (config.ai.provider === AiProvider.CLAUDE) {
    if (!config.ai.apiKey) {
      logger.warn('AI_PROVIDER=claude but ANTHROPIC_API_KEY not set — falling back to mock');
      return new MockAiProvider();
    }
    return new ClaudeAiProvider();
  }
  return new MockAiProvider();
}

const riskAssessmentAgent = new RiskAssessmentAgent(createAiProvider());

export const container = {
  userRepository,
  accessRequestRepository,
  authService,
  authorizationService,
  accessRequestService,
  riskAssessmentAgent,
} as const;
