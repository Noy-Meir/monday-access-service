import { v4 as uuidv4 } from 'uuid';
import { AccessRequest, RequestStatus, Role, TokenPayload } from '../models/AccessRequest';
import { IAccessRequestRepository } from '../repositories/IAccessRequestRepository';
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
  constructor(private readonly repository: IAccessRequestRepository) {}

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
    if (actor.role !== Role.APPROVER) {
      throw new AppError('Only APPROVERs can make decisions on requests', 403);
    }

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
    // Employees can only retrieve their own requests; approvers can retrieve any user's.
    if (actor.role === Role.EMPLOYEE && actor.sub !== userId) {
      throw new AppError('Employees can only view their own access requests', 403);
    }
    return this.repository.findByUserId(userId);
  }

  async getByStatus(status: RequestStatus, actor: TokenPayload): Promise<AccessRequest[]> {
    if (actor.role !== Role.APPROVER) {
      throw new AppError('Only APPROVERs can filter requests by status', 403);
    }
    return this.repository.findByStatus(status);
  }

  async getAll(actor: TokenPayload): Promise<AccessRequest[]> {
    if (actor.role !== Role.APPROVER) {
      throw new AppError('Only APPROVERs can list all access requests', 403);
    }
    return this.repository.findAll();
  }

  async getById(id: string, actor: TokenPayload): Promise<AccessRequest> {
    const request = await this.repository.findById(id);

    if (!request) {
      throw new AppError('Request not found', 404);
    }

    if (actor.role !== Role.APPROVER && request.createdBy !== actor.sub) {
      throw new AppError('Not authorized to view this request', 403);
    }

    return request;
  }
}
