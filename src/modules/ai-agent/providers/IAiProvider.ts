import { RiskAssessmentInput, ProviderResult } from '../types';

export interface IAiProvider {
  readonly providerName: string;
  assess(input: RiskAssessmentInput): Promise<ProviderResult>;
}
