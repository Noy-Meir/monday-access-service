import { TokenPayload } from '../models/AccessRequest';
import { AccessRequestService } from '../services/AccessRequestService';
import { AuthService } from '../services/AuthService';
import { AuthorizationService } from '../services/AuthorizationService';
import { IRiskAssessmentAgent } from '../modules/ai-agent/agent/IRiskAssessmentAgent';

export interface GraphQLContext {
  actor: TokenPayload | null;
  accessRequestService: AccessRequestService;
  authService: AuthService;
  /** Used exclusively by resolvers to enforce RBAC. Services must not receive this. */
  authorizationService: AuthorizationService;
  riskAssessmentAgent: IRiskAssessmentAgent;
}
