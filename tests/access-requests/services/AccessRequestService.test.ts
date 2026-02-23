import { AccessRequestService } from '../../../src/modules/access-requests/services/AccessRequestService';
import { AuthorizationService } from '../../../src/modules/auth/services/AuthorizationService';
import { IAccessRequestRepository } from '../../../src/modules/access-requests/repositories/IAccessRequestRepository';
import { AppError } from '../../../src/utils/AppError';
import { RequestStatus, Role } from '../../../src/models/AccessRequest';
import { Permission } from '../../../src/models/Permission';
import {
  mockEmployeePayload,
  mockITPayload,
  mockManagerPayload,
  mockHRPayload,
  mockAdminPayload,
  mockPendingRequest,
  mockApprovedRequest,
  mockDeniedRequest,
  mockMultiApprovalRequest,
  mockPartiallyApprovedRequest,
} from '../../helpers/fixtures';

// ── Module mocks ──────────────────────────────────────────────────────────────
jest.mock('uuid', () => ({ v4: jest.fn().mockReturnValue('generated-uuid') }));

jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ── Repository mock ───────────────────────────────────────────────────────────
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
    // Use a real AuthorizationService — it is stateless and has no external deps.
    service = new AccessRequestService(repository, new AuthorizationService());
  });

  // ── create ─────────────────────────────────────────────────────────────────
  describe('create', () => {
    const input = {
      applicationName: 'GitHub',
      justification: 'Need access for Q3 campaign management.',
    };

    it('saves a request with PENDING status', async () => {
      repository.save.mockResolvedValue(mockPendingRequest);

      await service.create(input, mockEmployeePayload);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: RequestStatus.PENDING })
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

      await service.create({ applicationName: 'GitHub', justification: 'Need access.' }, mockEmployeePayload);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ requiredApprovals: [Role.IT] })
      );
    });

    it('sets requiredApprovals to [ADMIN] for an unknown app name', async () => {
      repository.save.mockResolvedValue(mockPendingRequest);

      await service.create({ applicationName: 'UnknownApp123', justification: 'Need access.' }, mockEmployeePayload);

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

  // ── decide ─────────────────────────────────────────────────────────────────
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

    it('denies a PENDING request immediately regardless of role', async () => {
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
      // Even a [MANAGER, IT] request gets immediately approved by ADMIN
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

    it('throws AppError 403 when an EMPLOYEE calls decide', async () => {
      await expect(
        service.decide(mockPendingRequest.id, { decision: RequestStatus.APPROVED }, mockEmployeePayload)
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 403,
          message: `Access denied: role '${Role.EMPLOYEE}' does not have permission '${Permission.ACCESS_REQUEST_DECIDE}'`,
        })
      );
    });

    it('throws AppError 403 when IT tries to approve an [HR]-only request', async () => {
      const hrRequest = {
        ...mockPendingRequest,
        id: 'req-hr-001',
        applicationName: 'HiBob',
        requiredApprovals: [Role.HR],
      };
      repository.findById.mockResolvedValue(hrRequest);

      await expect(
        service.decide(hrRequest.id, { decision: RequestStatus.APPROVED }, mockITPayload)
      ).rejects.toThrow(expect.objectContaining({ statusCode: 403 }));
    });

    it('throws AppError 403 when HR tries to approve a [IT]-only tech request', async () => {
      repository.findById.mockResolvedValue(mockPendingRequest); // requiredApprovals: [Role.IT]

      await expect(
        service.decide(mockPendingRequest.id, { decision: RequestStatus.APPROVED }, mockHRPayload)
      ).rejects.toThrow(expect.objectContaining({ statusCode: 403 }));
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

      await service.decide(mockApprovedRequest.id, { decision: RequestStatus.DENIED }, mockITPayload)
        .catch(() => {});

      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  // ── getByUser ──────────────────────────────────────────────────────────────
  describe('getByUser', () => {
    it('returns requests for an EMPLOYEE viewing their own userId', async () => {
      repository.findByUserId.mockResolvedValue([mockPendingRequest]);

      const result = await service.getByUser(mockEmployeePayload.sub, mockEmployeePayload);

      expect(repository.findByUserId).toHaveBeenCalledWith(mockEmployeePayload.sub);
      expect(result).toEqual([mockPendingRequest]);
    });

    it('throws AppError 403 when an EMPLOYEE tries to view another user\'s requests', async () => {
      await expect(
        service.getByUser('other-user-id', mockEmployeePayload)
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 403,
          message: 'You can only view your own access requests',
        })
      );
    });

    it('does not call the repository when the EMPLOYEE is blocked by the 403 guard', async () => {
      await service.getByUser('other-user-id', mockEmployeePayload).catch(() => {});
      expect(repository.findByUserId).not.toHaveBeenCalled();
    });

    it('allows an IT user to view any user\'s requests', async () => {
      repository.findByUserId.mockResolvedValue([mockPendingRequest]);

      const result = await service.getByUser('user-alice-001', mockITPayload);

      expect(repository.findByUserId).toHaveBeenCalledWith('user-alice-001');
      expect(result).toEqual([mockPendingRequest]);
    });

    it('returns an empty array when the user has no requests', async () => {
      repository.findByUserId.mockResolvedValue([]);

      const result = await service.getByUser(mockEmployeePayload.sub, mockEmployeePayload);

      expect(result).toEqual([]);
    });
  });

  // ── getByStatus ────────────────────────────────────────────────────────────
  describe('getByStatus', () => {
    it('returns PENDING requests for an IT user', async () => {
      repository.findByStatus.mockResolvedValue([mockPendingRequest]);

      const result = await service.getByStatus(RequestStatus.PENDING, mockITPayload);

      expect(repository.findByStatus).toHaveBeenCalledWith(RequestStatus.PENDING);
      expect(result).toEqual([mockPendingRequest]);
    });

    it('returns PARTIALLY_APPROVED requests', async () => {
      repository.findByStatus.mockResolvedValue([mockPartiallyApprovedRequest]);

      const result = await service.getByStatus(RequestStatus.PARTIALLY_APPROVED, mockITPayload);

      expect(repository.findByStatus).toHaveBeenCalledWith(RequestStatus.PARTIALLY_APPROVED);
      expect(result).toEqual([mockPartiallyApprovedRequest]);
    });

    it('throws AppError 403 when an EMPLOYEE calls getByStatus', async () => {
      await expect(
        service.getByStatus(RequestStatus.PENDING, mockEmployeePayload)
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 403,
          message: `Access denied: role '${Role.EMPLOYEE}' does not have permission '${Permission.ACCESS_REQUEST_VIEW_BY_STATUS}'`,
        })
      );
    });

    it('does not call the repository when the EMPLOYEE is blocked', async () => {
      await service.getByStatus(RequestStatus.PENDING, mockEmployeePayload).catch(() => {});
      expect(repository.findByStatus).not.toHaveBeenCalled();
    });

    it('works for APPROVED status', async () => {
      repository.findByStatus.mockResolvedValue([mockApprovedRequest]);

      const result = await service.getByStatus(RequestStatus.APPROVED, mockITPayload);

      expect(repository.findByStatus).toHaveBeenCalledWith(RequestStatus.APPROVED);
      expect(result).toEqual([mockApprovedRequest]);
    });

    it('works for DENIED status', async () => {
      repository.findByStatus.mockResolvedValue([mockDeniedRequest]);

      const result = await service.getByStatus(RequestStatus.DENIED, mockITPayload);

      expect(result).toEqual([mockDeniedRequest]);
    });
  });

  // ── getAll ─────────────────────────────────────────────────────────────────
  describe('getAll', () => {
    it('returns all requests for an IT user', async () => {
      const all = [mockPendingRequest, mockApprovedRequest, mockDeniedRequest];
      repository.findAll.mockResolvedValue(all);

      const result = await service.getAll(mockITPayload);

      expect(repository.findAll).toHaveBeenCalled();
      expect(result).toEqual(all);
    });

    it('throws AppError 403 when an EMPLOYEE calls getAll', async () => {
      await expect(service.getAll(mockEmployeePayload)).rejects.toThrow(
        expect.objectContaining({
          statusCode: 403,
          message: `Access denied: role '${Role.EMPLOYEE}' does not have permission '${Permission.ACCESS_REQUEST_VIEW_ALL}'`,
        })
      );
    });

    it('does not call the repository when the EMPLOYEE is blocked', async () => {
      await service.getAll(mockEmployeePayload).catch(() => {});
      expect(repository.findAll).not.toHaveBeenCalled();
    });

    it('returns an empty array when there are no requests', async () => {
      repository.findAll.mockResolvedValue([]);

      const result = await service.getAll(mockITPayload);

      expect(result).toEqual([]);
    });
  });
});
