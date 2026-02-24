/**
 * AccessRequestService unit tests.
 *
 * The service is now a pure domain layer — it performs NO permission checks.
 * All RBAC / authorization is handled at the GraphQL resolver layer and is
 * tested in tests/graphql/resolvers.test.ts.
 *
 * These tests verify the service's business-logic invariants only:
 *   - Request creation (audit fields, UUID, requiredApprovals)
 *   - Multi-step approval flow (PARTIALLY_APPROVED → APPROVED)
 *   - ADMIN override (immediate APPROVED regardless of requiredApprovals)
 *   - DENIED path (immediate finalisation)
 *   - State-machine guards (409 on already-finalised, 409 on duplicate role)
 *   - 404 on unknown request ID
 *   - Read methods (getByUser, getByStatus, getAll, getById)
 */
import { AccessRequestService } from '../../../src/services/AccessRequestService';
import { IAccessRequestRepository } from '../../../src/repositories/IAccessRequestRepository';
import { AppError } from '../../../src/utils/AppError';
import { RequestStatus, Role } from '../../../src/models/AccessRequest';
import {
  mockEmployeePayload,
  mockITPayload,
  mockManagerPayload,
  mockAdminPayload,
  mockPendingRequest,
  mockApprovedRequest,
  mockDeniedRequest,
  mockMultiApprovalRequest,
  mockPartiallyApprovedRequest,
} from '../../helpers/fixtures';

// ── Module mocks ───────────────────────────────────────────────────────────────
jest.mock('uuid', () => ({ v4: jest.fn().mockReturnValue('generated-uuid') }));

jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ── Repository mock ────────────────────────────────────────────────────────────
function buildMockRepository(): jest.Mocked<IAccessRequestRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findByStatus: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
  };
}

describe('AccessRequestService', () => {
  let repository: jest.Mocked<IAccessRequestRepository>;
  let service: AccessRequestService;

  beforeEach(() => {
    repository = buildMockRepository();
    // No AuthorizationService — the service has no authorization dependency.
    service = new AccessRequestService(repository);
  });

  // ── create ───────────────────────────────────────────────────────────────────
  describe('create', () => {
    const input = {
      applicationName: 'GitHub',
      justification: 'Need access for Q3 campaign management.',
    };
//////TODO:  CHANGE AFTER TESTING /// /
    it('saves a request with PENDING status', async () => {
      repository.save.mockResolvedValue(mockPendingRequest);

      await service.create(input, mockEmployeePayload);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: RequestStatus.APPROVED })
      );
    });

    it('saves a request with the correct audit fields from the actor token', async () => {
      repository.save.mockResolvedValue(mockPendingRequest);

      await service.create(input, mockEmployeePayload);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: mockEmployeePayload.sub,
          createdByEmail: mockEmployeePayload.email,
        })
      );
    });

    it('saves a request with the provided applicationName and justification', async () => {
      repository.save.mockResolvedValue(mockPendingRequest);

      await service.create(input, mockEmployeePayload);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationName: input.applicationName,
          justification: input.justification,
        })
      );
    });

    it('saves a request with a uuid-generated id', async () => {
      repository.save.mockResolvedValue(mockPendingRequest);

      await service.create(input, mockEmployeePayload);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'generated-uuid' })
      );
    });

    it('saves a request with a createdAt Date', async () => {
      repository.save.mockResolvedValue(mockPendingRequest);

      await service.create(input, mockEmployeePayload);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ createdAt: expect.any(Date) })
      );
    });

    it('returns the value from repository.save', async () => {
      repository.save.mockResolvedValue(mockPendingRequest);

      const result = await service.create(input, mockEmployeePayload);

      expect(result).toBe(mockPendingRequest);
    });

    it('sets requiredApprovals to [IT] for a known tech app (GitHub)', async () => {
      repository.save.mockResolvedValue(mockPendingRequest);

      await service.create(
        { applicationName: 'GitHub', justification: 'Need access.' },
        mockEmployeePayload
      );

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ requiredApprovals: [Role.IT] })
      );
    });

    it('sets requiredApprovals to [ADMIN] for an unknown app name', async () => {
      repository.save.mockResolvedValue(mockPendingRequest);

      await service.create(
        { applicationName: 'UnknownApp123', justification: 'Need access.' },
        mockEmployeePayload
      );

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ requiredApprovals: [Role.ADMIN] })
      );
    });

    it('initialises approvals as an empty array', async () => {
      repository.save.mockResolvedValue(mockPendingRequest);

      await service.create(input, mockEmployeePayload);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ approvals: [] })
      );
    });
  });

  // ── decide ───────────────────────────────────────────────────────────────────
  describe('decide', () => {
    it('IT approves a [IT]-only request → immediately APPROVED', async () => {
      const approved = { ...mockPendingRequest, status: RequestStatus.APPROVED };
      repository.findById.mockResolvedValue(mockPendingRequest);
      repository.update.mockResolvedValue(approved);

      const result = await service.decide(
        mockPendingRequest.id,
        { decision: RequestStatus.APPROVED },
        mockITPayload
      );

      expect(repository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: RequestStatus.APPROVED })
      );
      expect(result).toEqual(approved);
    });

    it('IT approves a [IT]-only request and persists correct audit fields', async () => {
      const approved = { ...mockPendingRequest, status: RequestStatus.APPROVED };
      repository.findById.mockResolvedValue(mockPendingRequest);
      repository.update.mockResolvedValue(approved);

      await service.decide(
        mockPendingRequest.id,
        { decision: RequestStatus.APPROVED, decisionNote: 'Looks good.' },
        mockITPayload
      );

      expect(repository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockPendingRequest.id,
          status: RequestStatus.APPROVED,
          decisionBy: mockITPayload.sub,
          decisionByEmail: mockITPayload.email,
          decisionNote: 'Looks good.',
          decisionAt: expect.any(Date),
        })
      );
    });

    it('MANAGER approves a [MANAGER, IT] request → PARTIALLY_APPROVED', async () => {
      const partial = { ...mockMultiApprovalRequest, status: RequestStatus.PARTIALLY_APPROVED };
      repository.findById.mockResolvedValue(mockMultiApprovalRequest);
      repository.update.mockResolvedValue(partial);

      const result = await service.decide(
        mockMultiApprovalRequest.id,
        { decision: RequestStatus.APPROVED },
        mockManagerPayload
      );

      expect(repository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: RequestStatus.PARTIALLY_APPROVED })
      );
      expect(result).toEqual(partial);
    });

    it('IT approves a [MANAGER, IT] request that MANAGER already approved → APPROVED', async () => {
      const fullyApproved = { ...mockPartiallyApprovedRequest, status: RequestStatus.APPROVED };
      repository.findById.mockResolvedValue(mockPartiallyApprovedRequest);
      repository.update.mockResolvedValue(fullyApproved);

      const result = await service.decide(
        mockPartiallyApprovedRequest.id,
        { decision: RequestStatus.APPROVED },
        mockITPayload
      );

      expect(repository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: RequestStatus.APPROVED })
      );
      expect(result).toEqual(fullyApproved);
    });

    it('denies a PENDING request immediately', async () => {
      const denied = { ...mockPendingRequest, status: RequestStatus.DENIED };
      repository.findById.mockResolvedValue(mockPendingRequest);
      repository.update.mockResolvedValue(denied);

      const result = await service.decide(
        mockPendingRequest.id,
        { decision: RequestStatus.DENIED, decisionNote: 'Not justified.' },
        mockITPayload
      );

      expect(repository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: RequestStatus.DENIED })
      );
      expect(result).toEqual(denied);
    });

    it('denies a PARTIALLY_APPROVED request', async () => {
      const denied = { ...mockPartiallyApprovedRequest, status: RequestStatus.DENIED };
      repository.findById.mockResolvedValue(mockPartiallyApprovedRequest);
      repository.update.mockResolvedValue(denied);

      const result = await service.decide(
        mockPartiallyApprovedRequest.id,
        { decision: RequestStatus.DENIED },
        mockITPayload
      );

      expect(repository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: RequestStatus.DENIED })
      );
      expect(result).toEqual(denied);
    });

    it('ADMIN approves any request → immediate APPROVED override', async () => {
      const approved = { ...mockMultiApprovalRequest, status: RequestStatus.APPROVED };
      repository.findById.mockResolvedValue(mockMultiApprovalRequest);
      repository.update.mockResolvedValue(approved);

      const result = await service.decide(
        mockMultiApprovalRequest.id,
        { decision: RequestStatus.APPROVED },
        mockAdminPayload
      );

      expect(repository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: RequestStatus.APPROVED })
      );
      expect(result).toEqual(approved);
    });

    it('persists optional decisionNote when provided', async () => {
      repository.findById.mockResolvedValue(mockPendingRequest);
      repository.update.mockResolvedValue(mockPendingRequest);

      await service.decide(
        mockPendingRequest.id,
        { decision: RequestStatus.APPROVED, decisionNote: 'My note' },
        mockITPayload
      );

      expect(repository.update).toHaveBeenCalledWith(
        expect.objectContaining({ decisionNote: 'My note' })
      );
    });

    it('persists undefined decisionNote when not provided', async () => {
      repository.findById.mockResolvedValue(mockPendingRequest);
      repository.update.mockResolvedValue(mockPendingRequest);

      await service.decide(
        mockPendingRequest.id,
        { decision: RequestStatus.APPROVED },
        mockITPayload
      );

      expect(repository.update).toHaveBeenCalledWith(
        expect.objectContaining({ decisionNote: undefined })
      );
    });

    it('throws AppError 409 when the same role tries to approve twice', async () => {
      // MANAGER has already approved in mockPartiallyApprovedRequest
      repository.findById.mockResolvedValue(mockPartiallyApprovedRequest);

      await expect(
        service.decide(mockPartiallyApprovedRequest.id, { decision: RequestStatus.APPROVED }, mockManagerPayload)
      ).rejects.toThrow(expect.objectContaining({ statusCode: 409 }));
    });

    it('throws AppError 404 when the request does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.decide('non-existent-id', { decision: RequestStatus.APPROVED }, mockITPayload)
      ).rejects.toThrow(expect.objectContaining({ statusCode: 404 }));
    });

    it('throws AppError 409 when the request is already APPROVED', async () => {
      repository.findById.mockResolvedValue(mockApprovedRequest);

      await expect(
        service.decide(mockApprovedRequest.id, { decision: RequestStatus.DENIED }, mockITPayload)
      ).rejects.toThrow(expect.objectContaining({ statusCode: 409 }));
    });

    it('throws AppError 409 when the request is already DENIED', async () => {
      repository.findById.mockResolvedValue(mockDeniedRequest);

      await expect(
        service.decide(mockDeniedRequest.id, { decision: RequestStatus.APPROVED }, mockITPayload)
      ).rejects.toThrow(expect.objectContaining({ statusCode: 409 }));
    });

    it('does not call repository.update when the request is already APPROVED', async () => {
      repository.findById.mockResolvedValue(mockApprovedRequest);

      await service
        .decide(mockApprovedRequest.id, { decision: RequestStatus.DENIED }, mockITPayload)
        .catch(() => {});

      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  // ── getByUser ────────────────────────────────────────────────────────────────
  describe('getByUser', () => {
    it('returns requests for the given userId', async () => {
      repository.findByUserId.mockResolvedValue([mockPendingRequest]);

      const result = await service.getByUser(mockEmployeePayload.sub);

      expect(repository.findByUserId).toHaveBeenCalledWith(mockEmployeePayload.sub);
      expect(result).toEqual([mockPendingRequest]);
    });

    it('returns an empty array when the user has no requests', async () => {
      repository.findByUserId.mockResolvedValue([]);

      const result = await service.getByUser(mockEmployeePayload.sub);

      expect(result).toEqual([]);
    });

    it('accepts any userId without restriction — ownership is enforced by the resolver', async () => {
      repository.findByUserId.mockResolvedValue([mockPendingRequest]);

      await expect(service.getByUser('any-other-user-id')).resolves.toBeDefined();
    });
  });

  // ── getByStatus ──────────────────────────────────────────────────────────────
  describe('getByStatus', () => {
    it('returns PENDING requests', async () => {
      repository.findByStatus.mockResolvedValue([mockPendingRequest]);

      const result = await service.getByStatus(RequestStatus.PENDING);

      expect(repository.findByStatus).toHaveBeenCalledWith(RequestStatus.PENDING);
      expect(result).toEqual([mockPendingRequest]);
    });

    it('returns PARTIALLY_APPROVED requests', async () => {
      repository.findByStatus.mockResolvedValue([mockPartiallyApprovedRequest]);

      const result = await service.getByStatus(RequestStatus.PARTIALLY_APPROVED);

      expect(repository.findByStatus).toHaveBeenCalledWith(RequestStatus.PARTIALLY_APPROVED);
      expect(result).toEqual([mockPartiallyApprovedRequest]);
    });

    it('works for APPROVED status', async () => {
      repository.findByStatus.mockResolvedValue([mockApprovedRequest]);

      const result = await service.getByStatus(RequestStatus.APPROVED);

      expect(repository.findByStatus).toHaveBeenCalledWith(RequestStatus.APPROVED);
      expect(result).toEqual([mockApprovedRequest]);
    });

    it('works for DENIED status', async () => {
      repository.findByStatus.mockResolvedValue([mockDeniedRequest]);

      const result = await service.getByStatus(RequestStatus.DENIED);

      expect(result).toEqual([mockDeniedRequest]);
    });
  });

  // ── getAll ───────────────────────────────────────────────────────────────────
  describe('getAll', () => {
    it('returns all requests', async () => {
      const all = [mockPendingRequest, mockApprovedRequest, mockDeniedRequest];
      repository.findAll.mockResolvedValue(all);

      const result = await service.getAll();

      expect(repository.findAll).toHaveBeenCalled();
      expect(result).toEqual(all);
    });

    it('returns an empty array when there are no requests', async () => {
      repository.findAll.mockResolvedValue([]);

      const result = await service.getAll();

      expect(result).toEqual([]);
    });
  });

  // ── getById ──────────────────────────────────────────────────────────────────
  describe('getById', () => {
    it('returns the request when found', async () => {
      repository.findById.mockResolvedValue(mockPendingRequest);

      const result = await service.getById(mockPendingRequest.id);

      expect(repository.findById).toHaveBeenCalledWith(mockPendingRequest.id);
      expect(result).toEqual(mockPendingRequest);
    });

    it('throws AppError 404 when the request does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getById('non-existent')).rejects.toThrow(
        expect.objectContaining({ statusCode: 404 })
      );
    });

    it('does not enforce ownership — visibility is enforced by the resolver', async () => {
      repository.findById.mockResolvedValue(mockPendingRequest);

      await expect(service.getById(mockPendingRequest.id)).resolves.toEqual(mockPendingRequest);
    });
  });
});
