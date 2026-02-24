import { AccessRequest } from '../../../models/AccessRequest';
import { logger } from '../../../utils/logger';
import { IAiProvider } from '../providers/IAiProvider';
import { IRiskAssessmentAgent } from './IRiskAssessmentAgent';
import { RiskAssessmentResult, toRiskAssessmentInput } from '../types';

export class RiskAssessmentAgent implements IRiskAssessmentAgent {
  constructor(private readonly provider: IAiProvider) {}

  async assess(request: AccessRequest): Promise<RiskAssessmentResult> {
    const input = toRiskAssessmentInput(request);

    logger.debug('Starting risk assessment', {
      requestId: input.requestId,
      provider: this.provider.providerName,
      applicationName: input.applicationName,
    });

    const startTime = Date.now();
    const providerResult = await this.provider.assess(input);
    const executionTimeMs = Date.now() - startTime;

    const result: RiskAssessmentResult = {
      requestId: input.requestId,
      score: providerResult.score,
      riskLevel: providerResult.riskLevel,
      reasoning: providerResult.reasoning,
      assessedAt: new Date(),
      metrics: {
        executionTimeMs,
        provider: this.provider.providerName,
        ...(providerResult.tokensUsed !== undefined && { tokensUsed: providerResult.tokensUsed }),
        ...(providerResult.modelId !== undefined && { modelId: providerResult.modelId }),
      },
    };

    if (result.riskLevel === 'LOW' || result.riskLevel === 'MEDIUM') {
      logger.info('Risk assessment complete', {
        requestId: result.requestId,
        riskLevel: result.riskLevel,
        score: result.score,
        provider: this.provider.providerName,
        executionTimeMs,
      });
    } else {
      logger.warn('Elevated risk detected', {
        requestId: result.requestId,
        riskLevel: result.riskLevel,
        score: result.score,
        provider: this.provider.providerName,
        executionTimeMs,
      });
    }

    return result;
  }
}
