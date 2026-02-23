import { v4 as uuidv4 } from 'uuid';
import { AccessRequest, RequestStatus, TokenPayload } from '../models/AccessRequest';
import { Permission } from '../models/Permission';
import { IAccessRequestRepository } from '../repositories/IAccessRequestRepository';
import { AuthorizationService } from './AuthorizationService';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

export interface CreateAccessRequestInput {
  applicationName: string;
  justification: string;
}

export interface DecideAccessRequestInput {
  decision: RequestStatus.APPROVED | RequestStatus.DENIED;
  decisionNote?: string;
}

export class AccessRequestService {
  constructor(
    private readonly repository: IAccessRequestRepository,
    private readonly authz: AuthorizationService
  ) {}

  async create(input: CreateAccessRequestInput, actor: TokenPayload): Promise<AccessRequest> {
    const request: AccessRequest = {
      id: uuidv4(),
      applicationName: input.applicationName,
      justification: input.justification,
      status: RequestStatus.PENDING,
      createdBy: actor.sub,
      createdByEmail: actor.email,
      createdAt: new Date(),
    };

    const saved = await this.repository.save(request);
    logger.info('Access request created', { requestId: saved.id, createdBy: actor.email });
    return saved;
  }

  async decide(
    requestId: string,
    input: DecideAccessRequestInput,
    actor: TokenPayload
  ): Promise<AccessRequest> {
    this.authz.assertPermission(actor, Permission.ACCESS_REQUEST_DECIDE);

    const request = await this.repository.findById(requestId);
    if (!request) {
      throw new AppError(`Access request '${requestId}' not found`, 404);
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new AppError(
        `Cannot decide on a request with status '${request.status}'. Only PENDING requests can be decided.`,
        409
      );
    }

    const updated: AccessRequest = {
      ...request,
      status: input.decision,
      decisionBy: actor.sub,
      decisionByEmail: actor.email,
      decisionAt: new Date(),
      decisionNote: input.decisionNote,
    };

    const result = await this.repository.update(updated);

    logger.info('Access request decided', {
      requestId,
      decision: input.decision,
      decidedBy: actor.email,
    });

    return result;
  }

  async getByUser(userId: string, actor: TokenPayload): Promise<AccessRequest[]> {
    // Actors without VIEW_ALL can only query their own requests.
    if (!this.authz.hasPermission(actor, Permission.ACCESS_REQUEST_VIEW_ALL) && actor.sub !== userId) {
      throw new AppError('You can only view your own access requests', 403);
    }
    return this.repository.findByUserId(userId);
  }

  async getByStatus(status: RequestStatus, actor: TokenPayload): Promise<AccessRequest[]> {
    this.authz.assertPermission(actor, Permission.ACCESS_REQUEST_VIEW_BY_STATUS);
    return this.repository.findByStatus(status);
  }

  async getAll(actor: TokenPayload): Promise<AccessRequest[]> {
    this.authz.assertPermission(actor, Permission.ACCESS_REQUEST_VIEW_ALL);
    return this.repository.findAll();
  }

  async getById(id: string, actor: TokenPayload): Promise<AccessRequest> {
    const request = await this.repository.findById(id);

    if (!request) {
      throw new AppError('Request not found', 404);
    }

    // Actors without VIEW_ALL can only see their own requests.
    if (!this.authz.hasPermission(actor, Permission.ACCESS_REQUEST_VIEW_ALL) && request.createdBy !== actor.sub) {
      throw new AppError('Not authorized to view this request', 403);
    }

    return request;
  }
}
