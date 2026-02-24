import Anthropic from '@anthropic-ai/sdk';
import { AiProvider, config } from '../../../config';
import { AppError } from '../../../utils/AppError';
import { IAiProvider } from './IAiProvider';
import { RiskAssessmentInput, ProviderResult, RiskLevel } from '../types';

const VALID_RISK_LEVELS: RiskLevel[] = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL];

const SYSTEM_PROMPT = `You are a security risk assessment AI. Analyze the provided access request and respond with ONLY a valid JSON object — no markdown, no explanation, no code blocks — with exactly these fields:
{
  "score": <integer 0-100 where 100 is maximum risk>,
  "riskLevel": <"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">,
  "reasoning": <brief string explaining the assessment>
}`;

export class ClaudeAiProvider implements IAiProvider {
  readonly providerName = AiProvider.CLAUDE;
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: config.ai.apiKey });
  }

  async assess(input: RiskAssessmentInput): Promise<ProviderResult> {
    const userMessage =
      `Assess the risk of this access request:\n` +
      `Application: ${input.applicationName}\n` +
      `Justification: ${input.justification}\n` +
      `Requested by: ${input.createdByEmail}\n` +
      `Requested at: ${input.createdAt.toISOString()}`;

    let response: Awaited<ReturnType<Anthropic['messages']['create']>>;
    try {
      response = await this.client.messages.create({
        model: config.ai.model,
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });
    } catch {
      throw new AppError('AI provider unavailable', 503);
    }

    const textBlock = response.content.find(
      (b): b is Extract<(typeof response.content)[number], { type: 'text' }> => b.type === 'text'
    );
    if (!textBlock) {
      throw new AppError('AI provider returned no text content', 503);
    }

    const rawText = textBlock.text;
    const jsonString = this.extractJson(rawText);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new AppError('AI provider returned unparseable JSON', 502);
    }

    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
    return this.validateAndMap(parsed, tokensUsed, response.model);
  }

  private extractJson(text: string): string {
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) return fenceMatch[1].trim();
    return text.trim();
  }

  private validateAndMap(parsed: unknown, tokensUsed: number, modelId: string): ProviderResult {
    if (typeof parsed !== 'object' || parsed === null) {
      throw new AppError('AI response is not a JSON object', 502);
    }

    const obj = parsed as Record<string, unknown>;

    if (typeof obj['score'] !== 'number' || typeof obj['reasoning'] !== 'string' || typeof obj['riskLevel'] !== 'string') {
      throw new AppError('AI response missing required fields: score, riskLevel, reasoning', 502);
    }

    if (!VALID_RISK_LEVELS.includes(obj['riskLevel'] as RiskLevel)) {
      throw new AppError(`AI response contains invalid riskLevel: "${obj['riskLevel']}"`, 502);
    }

    const score = Math.max(0, Math.min(100, Math.round(obj['score'])));

    return {
      score,
      riskLevel: obj['riskLevel'] as RiskLevel,
      reasoning: obj['reasoning'],
      tokensUsed,
      modelId,
    };
  }
}
