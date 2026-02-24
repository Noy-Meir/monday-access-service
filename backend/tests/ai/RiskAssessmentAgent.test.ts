import { RiskAssessmentAgent } from '../../src/modules/ai-agent/agent/RiskAssessmentAgent';
import { IAiProvider } from '../../src/modules/ai-agent/providers/IAiProvider';
import { ProviderResult, RiskAssessmentInput, RiskLevel } from '../../src/modules/ai-agent/types';
import { AccessRequest, RequestStatus } from '../../src/models/AccessRequest';

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { logger } from '../../src/utils/logger';

const mockRequest: AccessRequest = {
  id: 'req-test-001',
  applicationName: 'Salesforce CRM',
  justification: 'Need access to manage enterprise accounts for the Q3 sales cycle.',
  status: RequestStatus.PENDING,
  requiredApprovals: [],
  approvals: [],
  createdBy: 'user-alice-001',
  createdByEmail: 'alice@company.com',
  createdAt: new Date('2024-01-01T10:00:00Z'),
};

function buildMockProvider(result: Partial<ProviderResult> = {}): jest.Mocked<IAiProvider> {
  return {
    providerName: 'mock',
    assess: jest.fn().mockResolvedValue({
      score: 10,
      riskLevel: RiskLevel.LOW,
      reasoning: 'Low risk assessment',
      ...result,
    } as ProviderResult),
  };
}

describe('RiskAssessmentAgent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Input mapping ──────────────────────────────────────────────────────────
  it('calls provider.assess with correctly mapped input', async () => {
    const mockProvider = buildMockProvider();
    const agent = new RiskAssessmentAgent(mockProvider);

    await agent.assess(mockRequest);

    expect(mockProvider.assess).toHaveBeenCalledTimes(1);
    const input: RiskAssessmentInput = mockProvider.assess.mock.calls[0][0];
    expect(input.requestId).toBe(mockRequest.id);
    expect(input.applicationName).toBe(mockRequest.applicationName);
    expect(input.justification).toBe(mockRequest.justification);
    expect(input.createdByEmail).toBe(mockRequest.createdByEmail);
    expect(input.createdAt).toEqual(mockRequest.createdAt);
  });

  // ── Result shape ───────────────────────────────────────────────────────────
  it('result contains all required fields', async () => {
    const agent = new RiskAssessmentAgent(buildMockProvider());
    const result = await agent.assess(mockRequest);

    expect(result.requestId).toBe(mockRequest.id);
    expect(typeof result.score).toBe('number');
    expect(Object.values(RiskLevel)).toContain(result.riskLevel);
    expect(typeof result.reasoning).toBe('string');
    expect(result.assessedAt).toBeInstanceOf(Date);
    expect(result.metrics).toBeDefined();
  });

  it('metrics.executionTimeMs is a non-negative number', async () => {
    const agent = new RiskAssessmentAgent(buildMockProvider());
    const result = await agent.assess(mockRequest);

    expect(typeof result.metrics.executionTimeMs).toBe('number');
    expect(result.metrics.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('metrics.provider matches the provider name', async () => {
    const agent = new RiskAssessmentAgent(buildMockProvider());
    const result = await agent.assess(mockRequest);

    expect(result.metrics.provider).toBe('mock');
  });

  // ── tokensUsed + modelId propagation ──────────────────────────────────────
  it('propagates tokensUsed from provider into metrics', async () => {
    const mockProvider = buildMockProvider({ tokensUsed: 250 });
    const agent = new RiskAssessmentAgent(mockProvider);
    const result = await agent.assess(mockRequest);

    expect(result.metrics.tokensUsed).toBe(250);
  });

  it('propagates modelId from provider into metrics', async () => {
    const mockProvider = buildMockProvider({ modelId: 'claude-haiku-4-5-20251001' });
    const agent = new RiskAssessmentAgent(mockProvider);
    const result = await agent.assess(mockRequest);

    expect(result.metrics.modelId).toBe('claude-haiku-4-5-20251001');
  });

  it('does not set tokensUsed in metrics when provider omits it', async () => {
    const mockProvider = buildMockProvider({ tokensUsed: undefined });
    const agent = new RiskAssessmentAgent(mockProvider);
    const result = await agent.assess(mockRequest);

    expect(result.metrics.tokensUsed).toBeUndefined();
  });

  // ── Logging: LOW → logger.info ────────────────────────────────────────────
  it('calls logger.info for LOW risk level', async () => {
    const agent = new RiskAssessmentAgent(buildMockProvider({ riskLevel: RiskLevel.LOW }));
    await agent.assess(mockRequest);

    expect(logger.info).toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('calls logger.info for MEDIUM risk level', async () => {
    const agent = new RiskAssessmentAgent(buildMockProvider({ riskLevel: RiskLevel.MEDIUM }));
    await agent.assess(mockRequest);

    expect(logger.info).toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  // ── Logging: HIGH/CRITICAL → logger.warn ──────────────────────────────────
  it('calls logger.warn for HIGH risk level', async () => {
    const agent = new RiskAssessmentAgent(buildMockProvider({ riskLevel: RiskLevel.HIGH, score: 72 }));
    await agent.assess(mockRequest);

    expect(logger.warn).toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('calls logger.warn for CRITICAL risk level', async () => {
    const agent = new RiskAssessmentAgent(buildMockProvider({ riskLevel: RiskLevel.CRITICAL, score: 88 }));
    await agent.assess(mockRequest);

    expect(logger.warn).toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  // ── logger.debug is always called ─────────────────────────────────────────
  it('calls logger.debug before the provider call', async () => {
    const agent = new RiskAssessmentAgent(buildMockProvider());
    await agent.assess(mockRequest);

    expect(logger.debug).toHaveBeenCalled();
  });

  // ── Error propagation ──────────────────────────────────────────────────────
  it('propagates errors thrown by the provider', async () => {
    const error = new Error('Provider failure');
    const mockProvider: jest.Mocked<IAiProvider> = {
      providerName: 'mock',
      assess: jest.fn().mockRejectedValue(error),
    };
    const agent = new RiskAssessmentAgent(mockProvider);

    await expect(agent.assess(mockRequest)).rejects.toThrow('Provider failure');
  });
});
