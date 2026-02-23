import { AccessRequest, Approval, RequestStatus, Role, TokenPayload, User } from '../../src/models/AccessRequest';

export const mockEmployeePayload: TokenPayload = {
  sub: 'user-alice-001',
  email: 'alice@company.com',
  name: 'Alice Employee',
  role: Role.EMPLOYEE,
};

export const mockITPayload: TokenPayload = {
  sub: 'user-carol-003',
  email: 'carol@company.com',
  name: 'Carol IT',
  role: Role.IT,
};

export const mockManagerPayload: TokenPayload = {
  sub: 'user-eve-005',
  email: 'eve@company.com',
  name: 'Eve Manager',
  role: Role.MANAGER,
};

export const mockHRPayload: TokenPayload = {
  sub: 'user-dave-004',
  email: 'dave@company.com',
  name: 'Dave HR',
  role: Role.HR,
};

export const mockAdminPayload: TokenPayload = {
  sub: 'user-frank-006',
  email: 'frank@company.com',
  name: 'Frank Admin',
  role: Role.ADMIN,
};

export const mockUser: User = {
  id: 'user-alice-001',
  email: 'alice@company.com',
  passwordHash: '$2b$10$hashed',
  name: 'Alice Employee',
  role: Role.EMPLOYEE,
};

export const mockITUser: User = {
  id: 'user-carol-003',
  email: 'carol@company.com',
  passwordHash: '$2b$10$hashed',
  name: 'Carol IT',
  role: Role.IT,
};

export const mockPendingRequest: AccessRequest = {
  id: 'req-pending-001',
  applicationName: 'GitHub',
  justification: 'Need access to manage enterprise accounts.',
  status: RequestStatus.PENDING,
  requiredApprovals: [Role.IT],
  approvals: [],
  createdBy: 'user-alice-001',
  createdByEmail: 'alice@company.com',
  createdAt: new Date('2024-01-01T10:00:00Z'),
};

export const mockApprovedRequest: AccessRequest = {
  ...mockPendingRequest,
  id: 'req-approved-002',
  status: RequestStatus.APPROVED,
  approvals: [
    {
      role: Role.IT,
      approvedBy: 'user-carol-003',
      approvedByEmail: 'carol@company.com',
      approvedAt: new Date('2024-01-02T10:00:00Z'),
    } as Approval,
  ],
  decisionBy: 'user-carol-003',
  decisionByEmail: 'carol@company.com',
  decisionAt: new Date('2024-01-02T10:00:00Z'),
  decisionNote: 'Approved after review.',
};

export const mockDeniedRequest: AccessRequest = {
  ...mockPendingRequest,
  id: 'req-denied-003',
  status: RequestStatus.DENIED,
  decisionBy: 'user-carol-003',
  decisionByEmail: 'carol@company.com',
  decisionAt: new Date('2024-01-02T10:00:00Z'),
  decisionNote: 'Insufficient justification.',
};

export const mockMultiApprovalRequest: AccessRequest = {
  id: 'req-multi-004',
  applicationName: 'Database Access',
  justification: 'Need read access for incident investigation.',
  status: RequestStatus.PENDING,
  requiredApprovals: [Role.MANAGER, Role.IT],
  approvals: [],
  createdBy: 'user-alice-001',
  createdByEmail: 'alice@company.com',
  createdAt: new Date('2024-01-01T10:00:00Z'),
};

export const mockPartiallyApprovedRequest: AccessRequest = {
  ...mockMultiApprovalRequest,
  id: 'req-partial-005',
  status: RequestStatus.PARTIALLY_APPROVED,
  approvals: [
    {
      role: Role.MANAGER,
      approvedBy: 'user-eve-005',
      approvedByEmail: 'eve@company.com',
      approvedAt: new Date('2024-01-02T09:00:00Z'),
    } as Approval,
  ],
};
