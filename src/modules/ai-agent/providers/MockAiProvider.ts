import { IAiProvider } from './IAiProvider';
import { RiskAssessmentInput, ProviderResult, RiskLevel } from '../types';

const HIGH_RISK_KEYWORDS = ['production', 'prod', 'admin', 'root', 'database', 'db', 'backup', 'privileged', 'secret'];
const MEDIUM_RISK_KEYWORDS = ['staging', 'analytics', 'finance', 'hr', 'payroll', 'billing', 'customer'];

function matchesKeywords(applicationName: string, keywords: string[]): boolean {
  const lower = applicationName.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

export class MockAiProvider implements IAiProvider {
  readonly providerName = 'mock';

  async assess(input: RiskAssessmentInput): Promise<ProviderResult> {
    const justLen = input.justification.length;
    const isHigh = matchesKeywords(input.applicationName, HIGH_RISK_KEYWORDS);
    const isMedium = !isHigh && matchesKeywords(input.applicationName, MEDIUM_RISK_KEYWORDS);

    let score: number;
    let riskLevel: RiskLevel;
    let reasoning: string;

    if (isHigh) {
      if (justLen < 50) {
        score = 88;
        riskLevel = 'CRITICAL';
        reasoning = `High-risk application "${input.applicationName}" with insufficient justification (${justLen} chars). Escalation required.`;
      } else if (justLen < 100) {
        score = 72;
        riskLevel = 'HIGH';
        reasoning = `High-risk application "${input.applicationName}" with moderate justification. Requires approver scrutiny.`;
      } else {
        score = 55;
        riskLevel = 'MEDIUM';
        reasoning = `High-risk application "${input.applicationName}" but detailed justification provided (${justLen} chars).`;
      }
    } else if (isMedium) {
      if (justLen < 50) {
        score = 45;
        riskLevel = 'MEDIUM';
        reasoning = `Medium-risk application "${input.applicationName}" with brief justification (${justLen} chars).`;
      } else {
        score = 20;
        riskLevel = 'LOW';
        reasoning = `Medium-risk application "${input.applicationName}" with adequate justification.`;
      }
    } else {
      if (justLen < 50) {
        score = 18;
        riskLevel = 'LOW';
        reasoning = `Standard application "${input.applicationName}" with brief justification.`;
      } else {
        score = 8;
        riskLevel = 'LOW';
        reasoning = `Standard application "${input.applicationName}" with adequate justification. Low risk.`;
      }
    }

    return { score, riskLevel, reasoning };
  }
}
