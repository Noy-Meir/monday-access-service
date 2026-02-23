import { AppError } from '../../src/utils/AppError';
import { RiskAssessmentInput } from '../../src/ai/types';

// ── Mock @anthropic-ai/sdk ────────────────────────────────────────────────────
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn(),
  __esModule: true,
}));

// ── Mock config ───────────────────────────────────────────────────────────────
jest.mock('../../src/config', () => ({
  config: {
    ai: {
      provider: 'claude',
      apiKey: 'test-api-key',
      model: 'claude-haiku-test',
    },
  },
}));

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAiProvider } from '../../src/ai/providers/ClaudeAiProvider';

const baseInput: RiskAssessmentInput = {
  requestId: 'req-001',
  applicationName: 'Salesforce CRM',
  justification: 'Need access for Q3 sales cycle management.',
  createdByEmail: 'alice@company.com',
  createdAt: new Date('2024-01-01T10:00:00Z'),
};

function buildSuccessResponse(overrides: {
  text?: string;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
} = {}) {
  return {
    content: [{ type: 'text', text: overrides.text ?? '{"score":42,"riskLevel":"MEDIUM","reasoning":"Test reasoning"}' }],
    usage: {
      input_tokens: overrides.inputTokens ?? 100,
      output_tokens: overrides.outputTokens ?? 50,
    },
    model: overrides.model ?? 'claude-haiku-test',
  };
}

describe('ClaudeAiProvider', () => {
  let mockCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate = jest.fn();
    (Anthropic as unknown as jest.Mock).mockImplementation(() => ({
      messages: { create: mockCreate },
    }));
  });

  // ── Success path ──────────────────────────────────────────────────────────
  it('returns correctly mapped result on success', async () => {
    mockCreate.mockResolvedValueOnce(buildSuccessResponse({
      text: '{"score":42,"riskLevel":"MEDIUM","reasoning":"Moderate risk identified"}',
      inputTokens: 120,
      outputTokens: 60,
      model: 'claude-haiku-test',
    }));

    const provider = new ClaudeAiProvider();
    const result = await provider.assess(baseInput);

    expect(result.score).toBe(42);
    expect(result.riskLevel).toBe('MEDIUM');
    expect(result.reasoning).toBe('Moderate risk identified');
    expect(result.tokensUsed).toBe(180); // 120 + 60
    expect(result.modelId).toBe('claude-haiku-test');
  });

  it('has providerName "claude"', () => {
    (Anthropic as unknown as jest.Mock).mockImplementation(() => ({
      messages: { create: jest.fn() },
    }));
    const provider = new ClaudeAiProvider();
    expect(provider.providerName).toBe('claude');
  });

  it('clamps score to 0–100', async () => {
    mockCreate.mockResolvedValueOnce(buildSuccessResponse({
      text: '{"score":150,"riskLevel":"HIGH","reasoning":"Over-scored"}',
    }));

    const provider = new ClaudeAiProvider();
    const result = await provider.assess(baseInput);

    expect(result.score).toBe(100);
  });

  it('clamps negative score to 0', async () => {
    mockCreate.mockResolvedValueOnce(buildSuccessResponse({
      text: '{"score":-5,"riskLevel":"LOW","reasoning":"Under-scored"}',
    }));

    const provider = new ClaudeAiProvider();
    const result = await provider.assess(baseInput);

    expect(result.score).toBe(0);
  });

  // ── Markdown-wrapped JSON ─────────────────────────────────────────────────
  it('extracts JSON from markdown code fences', async () => {
    const wrappedJson = '```json\n{"score":30,"riskLevel":"LOW","reasoning":"Low risk"}\n```';
    mockCreate.mockResolvedValueOnce(buildSuccessResponse({ text: wrappedJson }));

    const provider = new ClaudeAiProvider();
    const result = await provider.assess(baseInput);

    expect(result.score).toBe(30);
    expect(result.riskLevel).toBe('LOW');
    expect(result.reasoning).toBe('Low risk');
  });

  it('extracts JSON from plain markdown fences (no language tag)', async () => {
    const wrappedJson = '```\n{"score":75,"riskLevel":"HIGH","reasoning":"High risk"}\n```';
    mockCreate.mockResolvedValueOnce(buildSuccessResponse({ text: wrappedJson }));

    const provider = new ClaudeAiProvider();
    const result = await provider.assess(baseInput);

    expect(result.score).toBe(75);
    expect(result.riskLevel).toBe('HIGH');
  });

  // ── SDK failure → AppError 503 ────────────────────────────────────────────
  it('throws AppError 503 when the Anthropic SDK throws', async () => {
    mockCreate.mockRejectedValue(new Error('Network error'));

    const provider = new ClaudeAiProvider();
    await expect(provider.assess(baseInput)).rejects.toMatchObject({
      statusCode: 503,
    });
    await expect(provider.assess(baseInput)).rejects.toBeInstanceOf(AppError);
  });

  // ── Missing required JSON fields → AppError 502 ───────────────────────────
  it('throws AppError 502 when response JSON is missing "score"', async () => {
    mockCreate.mockResolvedValueOnce(buildSuccessResponse({
      text: '{"riskLevel":"LOW","reasoning":"Missing score"}',
    }));

    const provider = new ClaudeAiProvider();
    await expect(provider.assess(baseInput)).rejects.toMatchObject({ statusCode: 502 });
  });

  it('throws AppError 502 when response JSON is missing "riskLevel"', async () => {
    mockCreate.mockResolvedValueOnce(buildSuccessResponse({
      text: '{"score":10,"reasoning":"Missing riskLevel"}',
    }));

    const provider = new ClaudeAiProvider();
    await expect(provider.assess(baseInput)).rejects.toMatchObject({ statusCode: 502 });
  });

  it('throws AppError 502 when response JSON is missing "reasoning"', async () => {
    mockCreate.mockResolvedValueOnce(buildSuccessResponse({
      text: '{"score":10,"riskLevel":"LOW"}',
    }));

    const provider = new ClaudeAiProvider();
    await expect(provider.assess(baseInput)).rejects.toMatchObject({ statusCode: 502 });
  });

  // ── Bad JSON → AppError 502 ───────────────────────────────────────────────
  it('throws AppError 502 when response is not valid JSON', async () => {
    mockCreate.mockResolvedValueOnce(buildSuccessResponse({
      text: 'This is not JSON at all.',
    }));

    const provider = new ClaudeAiProvider();
    await expect(provider.assess(baseInput)).rejects.toMatchObject({ statusCode: 502 });
  });

  // ── Invalid riskLevel → AppError 502 ─────────────────────────────────────
  it('throws AppError 502 when riskLevel is not a valid value', async () => {
    mockCreate.mockResolvedValueOnce(buildSuccessResponse({
      text: '{"score":50,"riskLevel":"UNKNOWN","reasoning":"Bad level"}',
    }));

    const provider = new ClaudeAiProvider();
    await expect(provider.assess(baseInput)).rejects.toMatchObject({ statusCode: 502 });
  });

  // ── No text content → AppError 503 ───────────────────────────────────────
  it('throws AppError 503 when response has no text content block', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'tu_001', name: 'tool', input: {} }],
      usage: { input_tokens: 10, output_tokens: 5 },
      model: 'claude-haiku-test',
    });

    const provider = new ClaudeAiProvider();
    await expect(provider.assess(baseInput)).rejects.toMatchObject({ statusCode: 503 });
  });
});
