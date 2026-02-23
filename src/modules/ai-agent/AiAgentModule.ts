import { config } from '../../config';
import { logger } from '../../utils/logger';
import { MockAiProvider } from './providers/MockAiProvider';
import { ClaudeAiProvider } from './providers/ClaudeAiProvider';
import { AiAgentService } from './AiAgentService';
import { IAiProvider } from './providers/IAiProvider';

export class AiAgentModule {
  static create(): AiAgentService {
    return new AiAgentService(AiAgentModule.resolveProvider());
  }

  private static resolveProvider(): IAiProvider {
    if (config.ai.provider === 'claude') {
      if (!config.ai.apiKey) {
        logger.warn('AI_PROVIDER=claude but ANTHROPIC_API_KEY not set — falling back to mock');
        return new MockAiProvider();
      }
      return new ClaudeAiProvider();
    }
    return new MockAiProvider();
  }
}
