import type { Request, Response } from 'express';
import { TokenPayload } from '../models/AccessRequest';
import { AccessRequestService } from '../services/AccessRequestService';
import { AuthService } from '../services/AuthService';
import { AuthorizationService } from '../services/AuthorizationService';

export interface GraphQLContext {
  req: Request;
  res: Response;
  actor: TokenPayload | null;
  accessRequestService: AccessRequestService;
  authService: AuthService;
  /** Used exclusively by resolvers to enforce RBAC. Services must not receive this. */
  authorizationService: AuthorizationService;
}
