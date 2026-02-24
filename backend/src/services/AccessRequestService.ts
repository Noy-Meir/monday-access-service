import { v4 as uuidv4 } from 'uuid';
import { AccessRequest, Approval, RequestStatus, Role, TokenPayload } from '../models/AccessRequest';
import { IAccessRequestRepository } from '../repositories/IAccessRequestRepository';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { getRequiredApprovals } from '../config/applications';

export interface CreateAccessRequestInput {
  applicationName: string;
  justification: string;
}

export interface DecideAccessRequestInput {
  decision: RequestStatus.APPROVED | RequestStatus.DENIED;
  decisionNote?: string;
}

/**
 * Pure domain service for access-request lifecycle management.
 *
 * Authorization (RBAC, permission checks, role boundaries) is the
 * responsibility of the caller — the GraphQL resolver layer.  This service
 * assumes every call has already been authorized and focuses exclusively on
 * business logic: request creation, multi-step approval flow, audit trail,
 * and state-machine invariants.
 */
export class AccessRequestService {
  constructor(private readonly repository: IAccessRequestRepository) {}

  /** Creates a new PENDING access request with the correct requiredApprovals. */
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

  /**
   * Records a decision (APPROVED / DENIED) on an existing request.
   *
   * Business-logic invariants enforced here:
   *  - Already-finalised requests cannot be decided again (409).
   *  - DENIED is always immediate, regardless of role.
   *  - ADMIN approval is an immediate full-approval override (domain rule).
   *  - Non-ADMIN approval contributes to multi-step flow:
   *      duplicate role → 409; all roles covered → APPROVED; otherwise → PARTIALLY_APPROVED.
   *
   * The caller (resolver) is responsible for:
   *  - Verifying the actor holds the DECIDE permission.
   *  - Verifying the actor's role is listed in request.requiredApprovals
   *    (unless the actor is ADMIN).
   */
  async decide(
    requestId: string,
    input: DecideAccessRequestInput,
    actor: TokenPayload
  ): Promise<AccessRequest> {
    const request = await this.repository.findById(requestId);
    if (!request) {
      throw new AppError(`Access request '${requestId}' not found`, 404);
    }

    // State-machine invariant: only PENDING or PARTIALLY_APPROVED can be decided.
    if (request.status === RequestStatus.APPROVED || request.status === RequestStatus.DENIED) {
      throw new AppError(
        `Cannot decide on a request with status '${request.status}'. Only PENDING or PARTIALLY_APPROVED requests can be decided.`,
        409
      );
    }

    // DENIED — immediate finalisation for any authorized role.
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

    // APPROVED + ADMIN — immediate full-approval override (domain rule).
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

    // APPROVED + non-ADMIN — multi-step approval flow.
    const alreadyApproved = request.approvals.some((a) => a.role === actor.role);
    if (alreadyApproved) {
      throw new AppError(`Role '${actor.role}' has already approved this request`, 409);
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

  /** Returns all requests created by the given user. No permission check — caller is responsible. */
  async getByUser(userId: string): Promise<AccessRequest[]> {
    return this.repository.findByUserId(userId);
  }

  /** Returns requests filtered by status. No permission check — caller is responsible. */
  async getByStatus(status: RequestStatus): Promise<AccessRequest[]> {
    return this.repository.findByStatus(status);
  }

  /** Returns all requests. No permission check — caller is responsible. */
  async getAll(): Promise<AccessRequest[]> {
    return this.repository.findAll();
  }

  /**
   * Retrieves a request by ID, throwing 404 if absent.
   * Ownership / visibility checks are the caller's responsibility.
   */
  async getById(id: string): Promise<AccessRequest> {
    const request = await this.repository.findById(id);
    if (!request) {
      throw new AppError('Request not found', 404);
    }
    return request;
  }
}
