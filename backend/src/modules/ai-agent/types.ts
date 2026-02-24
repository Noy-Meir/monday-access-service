import { AccessRequest } from '../../models/AccessRequest';

export enum RiskLevel {
  LOW      = 'LOW',
  MEDIUM   = 'MEDIUM',
  HIGH     = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface RiskAssessmentInput {
  requestId: string;
  applicationName: string;
  justification: string;
  createdByEmail: string;
  createdAt: Date;
}

export interface ProviderResult {
  score: number;
  riskLevel: RiskLevel;
  reasoning: string;
  tokensUsed?: number;
  modelId?: string;
}

export interface AssessmentMetrics {
  executionTimeMs: number;
  provider: string;
  tokensUsed?: number;
  modelId?: string;
}

export interface RiskAssessmentResult {
  requestId: string;
  score: number;
  riskLevel: RiskLevel;
  reasoning: string;
  assessedAt: Date;
  metrics: AssessmentMetrics;
}

export function toRiskAssessmentInput(request: AccessRequest): RiskAssessmentInput {
  return {
    requestId: request.id,
    applicationName: request.applicationName,
    justification: request.justification,
    createdByEmail: request.createdByEmail,
    createdAt: request.createdAt,
  };
}
