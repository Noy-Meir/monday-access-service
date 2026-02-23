import { AccessRequest } from '../../models/AccessRequest';
import { RiskAssessmentResult } from '../types';

export interface IRiskAssessmentAgent {
  assess(request: AccessRequest): Promise<RiskAssessmentResult>;
}
