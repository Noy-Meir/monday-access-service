
import { AccessRequestController } from '../../../src/controllers/AccessRequestController';
import { AccessRequestService } from '../../../src/services/AccessRequestService';
import { AppError } from '../../../src/utils/AppError';
import { RequestStatus } from '../../../src/models/AccessRequest';
// @ts-ignore
import {
  mockEmployeePayload,
  mockApproverPayload,
  mockPendingRequest,
  mockApprovedRequest,
  mockDeniedRequest,
} from '../../helpers/fixtures';
import { createMockNext, createMockRequest, createMockResponse } from '../../helpers/mockExpress';

jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ── AccessRequestService mock ─────────────────────────────────────────────────
function buildMockService(): jest.Mocked<
  Pick<AccessRequestService, 'create' | 'decide' | 'getByUser' | 'getByStatus' | 'getAll'>
> {
  return {
    create: jest.fn(),
    decide: jest.fn(),
    getByUser: jest.fn(),
    getByStatus: jest.fn(),
    getAll: jest.fn(),
  };
}

describe('AccessRequestController', () => {
  let service: ReturnType<typeof buildMockService>;
  let controller: AccessRequestController;

  beforeEach(() => {
    service = buildMockService();
    controller = new AccessRequestController(service as unknown as AccessRequestService);
  });

  // ── create ─────────────────────────────────────────────────────────────────
  describe('create', () => {
    const body = {
      applicationName: 'Salesforce CRM',
      justification: 'Need for Q3 campaign.',
    };

    it('calls service.create with req.body and req.user', async () => {
      service.create.mockResolvedValue(mockPendingRequest);
      const req = createMockRequest({ body, user: mockEmployeePayload });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.create(req, res, next);

      expect(service.create).toHaveBeenCalledWith(body, mockEmployeePayload);
    });

    it('responds with HTTP 201 and { data: request } on success', async () => {
      service.create.mockResolvedValue(mockPendingRequest);
      const req = createMockRequest({ body, user: mockEmployeePayload });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ data: mockPendingRequest });
    });

    it('does not call next on success', async () => {
      service.create.mockResolvedValue(mockPendingRequest);
      const req = createMockRequest({ body, user: mockEmployeePayload });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.create(req, res, next);

      expect(next).not.toHaveBeenCalled();
    });

    it('calls next with the error when service.create throws', async () => {
      const error = new AppError('Some error', 500);
      service.create.mockRejectedValue(error);
      const req = createMockRequest({ body, user: mockEmployeePayload });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.create(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // ── decide ─────────────────────────────────────────────────────────────────
  describe('decide', () => {
    const decisionBody = { decision: RequestStatus.APPROVED, decisionNote: 'LGTM' };

    it('calls service.decide with params.id, req.body, and req.user', async () => {
      service.decide.mockResolvedValue(mockApprovedRequest);
      const req = createMockRequest({
        params: { id: mockPendingRequest.id },
        body: decisionBody,
        user: mockApproverPayload,
      });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.decide(req, res, next);

      expect(service.decide).toHaveBeenCalledWith(
        mockPendingRequest.id,
        decisionBody,
        mockApproverPayload
      );
    });

    it('responds with 200 and { data: updatedRequest } on approval', async () => {
      service.decide.mockResolvedValue(mockApprovedRequest);
      const req = createMockRequest({
        params: { id: mockPendingRequest.id },
        body: decisionBody,
        user: mockApproverPayload,
      });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.decide(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ data: mockApprovedRequest });
    });

    it('responds with 200 and { data: updatedRequest } on denial', async () => {
      service.decide.mockResolvedValue(mockDeniedRequest);
      const req = createMockRequest({
        params: { id: mockPendingRequest.id },
        body: { decision: RequestStatus.DENIED },
        user: mockApproverPayload,
      });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.decide(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ data: mockDeniedRequest });
    });

    it('calls next with AppError 409 when service throws (already decided)', async () => {
      const error = new AppError('Request is already APPROVED', 409);
      service.decide.mockRejectedValue(error);
      const req = createMockRequest({
        params: { id: mockApprovedRequest.id },
        body: decisionBody,
        user: mockApproverPayload,
      });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.decide(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('calls next with AppError 403 when service throws (wrong role)', async () => {
      const error = new AppError('Only APPROVERs can make decisions', 403);
      service.decide.mockRejectedValue(error);
      const req = createMockRequest({
        params: { id: mockPendingRequest.id },
        body: decisionBody,
        user: mockEmployeePayload,
      });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.decide(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ── getByUser ──────────────────────────────────────────────────────────────
  describe('getByUser', () => {
    it('calls service.getByUser with params.userId and req.user', async () => {
      service.getByUser.mockResolvedValue([mockPendingRequest]);
      const req = createMockRequest({
        params: { userId: mockEmployeePayload.sub },
        user: mockEmployeePayload,
      });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.getByUser(req, res, next);

      expect(service.getByUser).toHaveBeenCalledWith(mockEmployeePayload.sub, mockEmployeePayload);
    });

    it('responds with 200 and { data: requests }', async () => {
      service.getByUser.mockResolvedValue([mockPendingRequest]);
      const req = createMockRequest({
        params: { userId: mockEmployeePayload.sub },
        user: mockEmployeePayload,
      });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.getByUser(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ data: [mockPendingRequest] });
    });

    it('responds with an empty array when the user has no requests', async () => {
      service.getByUser.mockResolvedValue([]);
      const req = createMockRequest({
        params: { userId: mockEmployeePayload.sub },
        user: mockEmployeePayload,
      });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.getByUser(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ data: [] });
    });

    it('calls next with the error when service throws AppError 403', async () => {
      const error = new AppError('Employees can only view their own requests', 403);
      service.getByUser.mockRejectedValue(error);
      const req = createMockRequest({
        params: { userId: 'other-user' },
        user: mockEmployeePayload,
      });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.getByUser(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ── getByStatus ────────────────────────────────────────────────────────────
  describe('getByStatus', () => {
    it('calls service.getByStatus with the status param and req.user', async () => {
      service.getByStatus.mockResolvedValue([mockPendingRequest]);
      const req = createMockRequest({
        params: { status: RequestStatus.PENDING },
        user: mockApproverPayload,
      });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.getByStatus(req, res, next);

      expect(service.getByStatus).toHaveBeenCalledWith(RequestStatus.PENDING, mockApproverPayload);
    });

    it('responds with 200 and { data: requests } for a valid status', async () => {
      service.getByStatus.mockResolvedValue([mockPendingRequest]);
      const req = createMockRequest({
        params: { status: RequestStatus.PENDING },
        user: mockApproverPayload,
      });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.getByStatus(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ data: [mockPendingRequest] });
    });

    it('calls next with AppError 400 for an unknown status value', async () => {
      const req = createMockRequest({
        params: { status: 'INVALID_STATUS' },
        user: mockApproverPayload,
      });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.getByStatus(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 })
      );
      expect(service.getByStatus).not.toHaveBeenCalled();
    });

    it('calls next with the error when service.getByStatus throws AppError 403', async () => {
      const error = new AppError('Only APPROVERs can filter by status', 403);
      service.getByStatus.mockRejectedValue(error);
      const req = createMockRequest({
        params: { status: RequestStatus.PENDING },
        user: mockEmployeePayload,
      });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.getByStatus(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('correctly handles APPROVED status', async () => {
      service.getByStatus.mockResolvedValue([mockApprovedRequest]);
      const req = createMockRequest({
        params: { status: RequestStatus.APPROVED },
        user: mockApproverPayload,
      });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.getByStatus(req, res, next);

      expect(service.getByStatus).toHaveBeenCalledWith(RequestStatus.APPROVED, mockApproverPayload);
    });

    it('correctly handles DENIED status', async () => {
      service.getByStatus.mockResolvedValue([mockDeniedRequest]);
      const req = createMockRequest({
        params: { status: RequestStatus.DENIED },
        user: mockApproverPayload,
      });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.getByStatus(req, res, next);

      expect(service.getByStatus).toHaveBeenCalledWith(RequestStatus.DENIED, mockApproverPayload);
    });
  });

  // ── getAll ─────────────────────────────────────────────────────────────────
  describe('getAll', () => {
    it('calls service.getAll with req.user', async () => {
      const all = [mockPendingRequest, mockApprovedRequest, mockDeniedRequest];
      service.getAll.mockResolvedValue(all);
      const req = createMockRequest({ user: mockApproverPayload });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.getAll(req, res, next);

      expect(service.getAll).toHaveBeenCalledWith(mockApproverPayload);
    });

    it('responds with 200 and { data: all requests }', async () => {
      const all = [mockPendingRequest, mockApprovedRequest, mockDeniedRequest];
      service.getAll.mockResolvedValue(all);
      const req = createMockRequest({ user: mockApproverPayload });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.getAll(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ data: all });
    });

    it('calls next with AppError 403 when service throws (wrong role)', async () => {
      const error = new AppError('Only APPROVERs can list all access requests', 403);
      service.getAll.mockRejectedValue(error);
      const req = createMockRequest({ user: mockEmployeePayload });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.getAll(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.json).not.toHaveBeenCalled();
    });

    it('responds with an empty array when there are no requests', async () => {
      service.getAll.mockResolvedValue([]);
      const req = createMockRequest({ user: mockApproverPayload });
      const res = createMockResponse();
      const next = createMockNext();

      await controller.getAll(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ data: [] });
    });
  });
});
