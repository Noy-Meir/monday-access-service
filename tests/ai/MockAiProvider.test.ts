import { MockAiProvider } from '../../src/modules/ai-agent/providers/MockAiProvider';
import { RiskAssessmentInput } from '../../src/modules/ai-agent/types';

function makeInput(applicationName: string, justification: string): RiskAssessmentInput {
  return {
    requestId: 'req-001',
    applicationName,
    justification,
    createdByEmail: 'alice@company.com',
    createdAt: new Date('2024-01-01T10:00:00Z'),
  };
}

describe('MockAiProvider', () => {
  let provider: MockAiProvider;

  beforeEach(() => {
    provider = new MockAiProvider();
  });

  it('has providerName "mock"', () => {
    expect(provider.providerName).toBe('mock');
  });

  // ── HIGH-risk app × short justification → CRITICAL (88) ───────────────────
  it.each([
    'production',
    'prod',
    'admin',
    'root',
    'database',
    'db',
    'backup',
    'privileged',
    'secret',
  ])('HIGH-risk keyword "%s" + justification < 50 chars → score 88, CRITICAL', async (keyword) => {
    const result = await provider.assess(makeInput(`${keyword} system`, 'Short reason'));
    expect(result.score).toBe(88);
    expect(result.riskLevel).toBe('CRITICAL');
    expect(result.reasoning).toBeTruthy();
  });

  // ── HIGH-risk app × 50–99 chars → HIGH (72) ───────────────────────────────
  it('HIGH-risk app + justification 50–99 chars → score 72, HIGH', async () => {
    const justification = 'a'.repeat(50); // exactly 50 chars
    const result = await provider.assess(makeInput('Production DB', justification));
    expect(result.score).toBe(72);
    expect(result.riskLevel).toBe('HIGH');
    expect(result.reasoning).toBeTruthy();
  });

  it('HIGH-risk app + justification 99 chars → score 72, HIGH', async () => {
    const justification = 'a'.repeat(99);
    const result = await provider.assess(makeInput('Admin Portal', justification));
    expect(result.score).toBe(72);
    expect(result.riskLevel).toBe('HIGH');
  });

  // ── HIGH-risk app × ≥ 100 chars → MEDIUM (55) ─────────────────────────────
  it('HIGH-risk app + justification ≥ 100 chars → score 55, MEDIUM', async () => {
    const justification = 'a'.repeat(100);
    const result = await provider.assess(makeInput('Root Access', justification));
    expect(result.score).toBe(55);
    expect(result.riskLevel).toBe('MEDIUM');
    expect(result.reasoning).toBeTruthy();
  });

  // ── MEDIUM-risk app × < 50 chars → MEDIUM (45) ────────────────────────────
  it.each([
    'staging',
    'analytics',
    'finance',
    'hr',
    'payroll',
    'billing',
    'customer',
  ])('MEDIUM-risk keyword "%s" + justification < 50 chars → score 45, MEDIUM', async (keyword) => {
    const result = await provider.assess(makeInput(`${keyword} portal`, 'Short'));
    expect(result.score).toBe(45);
    expect(result.riskLevel).toBe('MEDIUM');
    expect(result.reasoning).toBeTruthy();
  });

  // ── MEDIUM-risk app × ≥ 50 chars → LOW (20) ───────────────────────────────
  it('MEDIUM-risk app + justification ≥ 50 chars → score 20, LOW', async () => {
    const justification = 'a'.repeat(50);
    const result = await provider.assess(makeInput('Finance Dashboard', justification));
    expect(result.score).toBe(20);
    expect(result.riskLevel).toBe('LOW');
    expect(result.reasoning).toBeTruthy();
  });

  // ── Any other app × < 50 chars → LOW (18) ─────────────────────────────────
  it('standard app + justification < 50 chars → score 18, LOW', async () => {
    const result = await provider.assess(makeInput('Slack', 'Need it for team chat'));
    expect(result.score).toBe(18);
    expect(result.riskLevel).toBe('LOW');
    expect(result.reasoning).toBeTruthy();
  });

  // ── Any other app × ≥ 50 chars → LOW (8) ──────────────────────────────────
  it('standard app + justification ≥ 50 chars → score 8, LOW', async () => {
    const justification = 'a'.repeat(50);
    const result = await provider.assess(makeInput('Slack', justification));
    expect(result.score).toBe(8);
    expect(result.riskLevel).toBe('LOW');
    expect(result.reasoning).toBeTruthy();
  });

  // ── Result shape ───────────────────────────────────────────────────────────
  it('result contains all required fields', async () => {
    const result = await provider.assess(makeInput('Slack', 'Need it for team chat'));
    expect(typeof result.score).toBe('number');
    expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(result.riskLevel);
    expect(typeof result.reasoning).toBe('string');
    expect(result.reasoning.length).toBeGreaterThan(0);
    // Mock provider does not provide tokensUsed / modelId
    expect(result.tokensUsed).toBeUndefined();
    expect(result.modelId).toBeUndefined();
  });

  // ── Boundary: justification length exactly 49 (< 50) ─────────────────────
  it('justification length 49 is treated as < 50', async () => {
    const justification = 'a'.repeat(49);
    const result = await provider.assess(makeInput('Admin console', justification));
    expect(result.score).toBe(88);
    expect(result.riskLevel).toBe('CRITICAL');
  });

  // ── Boundary: justification length exactly 50 (≥ 50) ─────────────────────
  it('justification length 50 is treated as >= 50', async () => {
    const justification = 'a'.repeat(50);
    const result = await provider.assess(makeInput('Admin console', justification));
    expect(result.score).toBe(72);
    expect(result.riskLevel).toBe('HIGH');
  });
});
