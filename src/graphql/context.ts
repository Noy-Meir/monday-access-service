import { TokenPayload } from '../models/AccessRequest';
import { AccessRequestService } from '../services/AccessRequestService';
import { AuthService } from '../services/AuthService';
import { IRiskAssessmentAgent } from '../modules/ai-agent/agent/IRiskAssessmentAgent';

export interface GraphQLContext {
  actor: TokenPayload | null;
  accessRequestService: AccessRequestService;
  authService: AuthService;
  riskAssessmentAgent: IRiskAssessmentAgent;
}
