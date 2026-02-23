import { v4 as uuidv4 } from 'uuid';
import { AccessRequest, Approval, RequestStatus, Role, TokenPayload } from '../models/AccessRequest';
import { Permission } from '../models/Permission';
import { IAccessRequestRepository } from '../repositories/IAccessRequestRepository';
import { AuthorizationService } from './AuthorizationService';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { getRequiredApprovals } from '../../../config/applications';

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
      requiredApprovals: getRequiredApprovals(input.applicationName),
      approvals: [],
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
    // 1. Assert DECIDE permission (role-level gate)
    this.authz.assertPermission(actor, Permission.ACCESS_REQUEST_DECIDE);

    // 2. Find request
    const request = await this.repository.findById(requestId);
    if (!request) {
      throw new AppError(`Access request '${requestId}' not found`, 404);
    }

    // 3. Reject if already finalized
    if (request.status === RequestStatus.APPROVED || request.status === RequestStatus.DENIED) {
      throw new AppError(
        `Cannot decide on a request with status '${request.status}'. Only PENDING or PARTIALLY_APPROVED requests can be decided.`,
        409
      );
    }

    // 4. Role boundary: non-ADMIN actors must be in requiredApprovals
    if (actor.role !== Role.ADMIN && !request.requiredApprovals.includes(actor.role)) {
      throw new AppError(
        `Role '${actor.role}' is not authorized to approve requests for '${request.applicationName}'`,
        403
      );
    }

    // 5. DENIED — immediate finalization for any authorized role
    if (input.decision === RequestStatus.DENIED) {
      const updated: AccessRequest = {
        ...request,
        status: RequestStatus.DENIED,
        decisionBy: actor.sub,
        decisionByEmail: actor.email,
        decisionAt: new Date(),
        decisionNote: input.decisionNote,
      };
      const result = await this.repository.update(updated);
      logger.info('Access request denied', { requestId, decidedBy: actor.email });
      return result;
    }

    // 6. APPROVED + ADMIN — immediate full-approval override
    if (actor.role === Role.ADMIN) {
      const updated: AccessRequest = {
        ...request,
        status: RequestStatus.APPROVED,
        decisionBy: actor.sub,
        decisionByEmail: actor.email,
        decisionAt: new Date(),
        decisionNote: input.decisionNote,
      };
      const result = await this.repository.update(updated);
      logger.info('Access request approved by ADMIN (override)', { requestId, decidedBy: actor.email });
      return result;
    }

    // 7. APPROVED + non-ADMIN — multi-step approval
    const alreadyApproved = request.approvals.some((a) => a.role === actor.role);
    if (alreadyApproved) {
      throw new AppError(
        `Role '${actor.role}' has already approved this request`,
        409
      );
    }

    const newApproval: Approval = {
      role: actor.role,
      approvedBy: actor.sub,
      approvedByEmail: actor.email,
      approvedAt: new Date(),
    };
    const approvals = [...request.approvals, newApproval];

    const allCovered = request.requiredApprovals.every((r) =>
      approvals.some((a) => a.role === r)
    );

    const updated: AccessRequest = {
      ...request,
      approvals,
      status: allCovered ? RequestStatus.APPROVED : RequestStatus.PARTIALLY_APPROVED,
      ...(allCovered
        ? {
            decisionBy: actor.sub,
            decisionByEmail: actor.email,
            decisionAt: new Date(),
            decisionNote: input.decisionNote,
          }
        : {}),
    };

    const result = await this.repository.update(updated);
    logger.info('Access request decided', {
      requestId,
      decision: updated.status,
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
