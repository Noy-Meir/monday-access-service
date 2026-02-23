import { AccessRequestService } from '../../../src/services/AccessRequestService';
import { AuthorizationService } from '../../../src/services/AuthorizationService';
import { IAccessRequestRepository } from '../../../src/repositories/IAccessRequestRepository';
import { AppError } from '../../../src/utils/AppError';
import { RequestStatus, Role } from '../../../src/models/AccessRequest';
import { Permission } from '../../../src/models/Permission';
import {
  mockEmployeePayload,
  mockApproverPayload,
  mockPendingRequest,
  mockApprovedRequest,
  mockDeniedRequest,
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
    // This exercises the full permission matrix rather than hiding it behind a mock.
    service = new AccessRequestService(repository, new AuthorizationService());
  });

  // ── create ─────────────────────────────────────────────────────────────────
  describe('create', () => {
    const input = {
      applicationName: 'Salesforce CRM',
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
  });

  // ── decide ─────────────────────────────────────────────────────────────────
  describe('decide', () => {
    it('approves a PENDING request and persists correct audit fields', async () => {
      const approved = { ...mockPendingRequest, status: RequestStatus.APPROVED };
      repository.findById.mockResolvedValue(mockPendingRequest);
      repository.update.mockResolvedValue(approved);

      const result = await service.decide(
        mockPendingRequest.id,
        { decision: RequestStatus.APPROVED, decisionNote: 'Looks good.' },
        mockApproverPayload
      );

      expect(repository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockPendingRequest.id,
          status: RequestStatus.APPROVED,
          decisionBy: mockApproverPayload.sub,
          decisionByEmail: mockApproverPayload.email,
          decisionNote: 'Looks good.',
          decisionAt: expect.any(Date),
        })
      );
      expect(result).toEqual(approved);
    });

    it('denies a PENDING request', async () => {
      const denied = { ...mockPendingRequest, status: RequestStatus.DENIED };
      repository.findById.mockResolvedValue(mockPendingRequest);
      repository.update.mockResolvedValue(denied);

      const result = await service.decide(
        mockPendingRequest.id,
        { decision: RequestStatus.DENIED, decisionNote: 'Not justified.' },
        mockApproverPayload
      );

      expect(repository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: RequestStatus.DENIED })
      );
      expect(result).toEqual(denied);
    });

    it('persists optional decisionNote when provided', async () => {
      repository.findById.mockResolvedValue(mockPendingRequest);
      repository.update.mockResolvedValue(mockPendingRequest);

      await service.decide(
        mockPendingRequest.id,
        { decision: RequestStatus.APPROVED, decisionNote: 'My note' },
        mockApproverPayload
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
        mockApproverPayload
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

    it('throws AppError 404 when the request does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.decide('non-existent-id', { decision: RequestStatus.APPROVED }, mockApproverPayload)
      ).rejects.toThrow(expect.objectContaining({ statusCode: 404 }));
    });

    it('throws AppError 409 when the request is already APPROVED', async () => {
      repository.findById.mockResolvedValue(mockApprovedRequest);

      await expect(
        service.decide(mockApprovedRequest.id, { decision: RequestStatus.DENIED }, mockApproverPayload)
      ).rejects.toThrow(expect.objectContaining({ statusCode: 409 }));
    });

    it('throws AppError 409 when the request is already DENIED', async () => {
      repository.findById.mockResolvedValue(mockDeniedRequest);

      await expect(
        service.decide(mockDeniedRequest.id, { decision: RequestStatus.APPROVED }, mockApproverPayload)
      ).rejects.toThrow(expect.objectContaining({ statusCode: 409 }));
    });

    it('does not call repository.update when the request is not PENDING', async () => {
      repository.findById.mockResolvedValue(mockApprovedRequest);

      await service.decide(mockApprovedRequest.id, { decision: RequestStatus.DENIED }, mockApproverPayload)
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

    it('allows an APPROVER to view any user\'s requests', async () => {
      repository.findByUserId.mockResolvedValue([mockPendingRequest]);

      const result = await service.getByUser('user-alice-001', mockApproverPayload);

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
    it('returns PENDING requests for an APPROVER', async () => {
      repository.findByStatus.mockResolvedValue([mockPendingRequest]);

      const result = await service.getByStatus(RequestStatus.PENDING, mockApproverPayload);

      expect(repository.findByStatus).toHaveBeenCalledWith(RequestStatus.PENDING);
      expect(result).toEqual([mockPendingRequest]);
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

      const result = await service.getByStatus(RequestStatus.APPROVED, mockApproverPayload);

      expect(repository.findByStatus).toHaveBeenCalledWith(RequestStatus.APPROVED);
      expect(result).toEqual([mockApprovedRequest]);
    });

    it('works for DENIED status', async () => {
      repository.findByStatus.mockResolvedValue([mockDeniedRequest]);

      const result = await service.getByStatus(RequestStatus.DENIED, mockApproverPayload);

      expect(result).toEqual([mockDeniedRequest]);
    });
  });

  // ── getAll ─────────────────────────────────────────────────────────────────
  describe('getAll', () => {
    it('returns all requests for an APPROVER', async () => {
      const all = [mockPendingRequest, mockApprovedRequest, mockDeniedRequest];
      repository.findAll.mockResolvedValue(all);

      const result = await service.getAll(mockApproverPayload);

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

      const result = await service.getAll(mockApproverPayload);

      expect(result).toEqual([]);
    });
  });
});
