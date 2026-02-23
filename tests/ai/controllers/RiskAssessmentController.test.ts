import { RiskAssessmentController } from '../../../src/controllers/RiskAssessmentController';
import { AccessRequestService } from '../../../src/services/AccessRequestService';
import { IRiskAssessmentAgent } from '../../../src/modules/ai-agent/agent/IRiskAssessmentAgent';
import { RiskAssessmentResult } from '../../../src/modules/ai-agent/types';
import { AppError } from '../../../src/utils/AppError';
import {
  mockEmployeePayload,
  mockApproverPayload,
  mockPendingRequest,
} from '../../helpers/fixtures';
import { createMockNext, createMockRequest, createMockResponse } from '../../helpers/mockExpress';

jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

function buildMockService(): jest.Mocked<Pick<AccessRequestService, 'getById'>> {
  return { getById: jest.fn() };
}

function buildMockAgent(): jest.Mocked<IRiskAssessmentAgent> {
  return { assess: jest.fn() };
}

const mockResult: RiskAssessmentResult = {
  requestId: mockPendingRequest.id,
  score: 8,
  riskLevel: 'LOW',
  reasoning: 'Standard application with adequate justification.',
  assessedAt: new Date('2024-01-01T11:00:00Z'),
  metrics: {
    executionTimeMs: 12,
    provider: 'mock',
  },
};

describe('RiskAssessmentController', () => {
  let service: ReturnType<typeof buildMockService>;
  let agent: jest.Mocked<IRiskAssessmentAgent>;
  let controller: RiskAssessmentController;

  beforeEach(() => {
    service = buildMockService();
    agent = buildMockAgent();
    controller = new RiskAssessmentController(
      service as unknown as AccessRequestService,
      agent
    );
  });

  // ── Success path ──────────────────────────────────────────────────────────
  it('responds 200 with { data: result } on success', async () => {
    service.getById.mockResolvedValue(mockPendingRequest);
    agent.assess.mockResolvedValue(mockResult);

    const req = createMockRequest({ params: { id: mockPendingRequest.id }, user: mockEmployeePayload });
    const res = createMockResponse();
    const next = createMockNext();

    await controller.assess(req, res, next);

    expect(service.getById).toHaveBeenCalledWith(mockPendingRequest.id, mockEmployeePayload);
    expect(agent.assess).toHaveBeenCalledWith(mockPendingRequest);
    expect(res.json).toHaveBeenCalledWith({ data: mockResult });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next and does not call agent when getById throws 404', async () => {
    const error = new AppError(`Access request '${mockPendingRequest.id}' not found`, 404);
    service.getById.mockRejectedValue(error);

    const req = createMockRequest({ params: { id: mockPendingRequest.id }, user: mockApproverPayload });
    const res = createMockResponse();
    const next = createMockNext();

    await controller.assess(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(agent.assess).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('calls next and does not call agent when getById throws 403', async () => {
    const error = new AppError('You can only view your own access requests', 403);
    service.getById.mockRejectedValue(error);

    const req = createMockRequest({ params: { id: mockPendingRequest.id }, user: mockEmployeePayload });
    const res = createMockResponse();
    const next = createMockNext();

    await controller.assess(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(agent.assess).not.toHaveBeenCalled();
  });

  it('calls next when the agent throws', async () => {
    service.getById.mockResolvedValue(mockPendingRequest);
    const error = new AppError('AI provider unavailable', 503);
    agent.assess.mockRejectedValue(error);

    const req = createMockRequest({ params: { id: mockPendingRequest.id }, user: mockEmployeePayload });
    const res = createMockResponse();
    const next = createMockNext();

    await controller.assess(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.json).not.toHaveBeenCalled();
  });

  it('works for approver assessing any request', async () => {
    service.getById.mockResolvedValue(mockPendingRequest);
    agent.assess.mockResolvedValue(mockResult);

    const req = createMockRequest({ params: { id: mockPendingRequest.id }, user: mockApproverPayload });
    const res = createMockResponse();
    const next = createMockNext();

    await controller.assess(req, res, next);

    expect(service.getById).toHaveBeenCalledWith(mockPendingRequest.id, mockApproverPayload);
    expect(res.json).toHaveBeenCalledWith({ data: mockResult });
  });
});
