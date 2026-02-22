import { AccessRequest, RequestStatus, Role, TokenPayload, User } from '../../src/models/AccessRequest';

export const mockEmployeePayload: TokenPayload = {
  sub: 'user-alice-001',
  email: 'alice@company.com',
  name: 'Alice Employee',
  role: Role.EMPLOYEE,
};

export const mockApproverPayload: TokenPayload = {
  sub: 'user-carol-003',
  email: 'carol@company.com',
  name: 'Carol Approver',
  role: Role.APPROVER,
};

export const mockUser: User = {
  id: 'user-alice-001',
  email: 'alice@company.com',
  passwordHash: '$2b$10$hashed',
  name: 'Alice Employee',
  role: Role.EMPLOYEE,
};

export const mockApproverUser: User = {
  id: 'user-carol-003',
  email: 'carol@company.com',
  passwordHash: '$2b$10$hashed',
  name: 'Carol Approver',
  role: Role.APPROVER,
};

export const mockPendingRequest: AccessRequest = {
  id: 'req-pending-001',
  applicationName: 'Salesforce CRM',
  justification: 'Need access to manage enterprise accounts.',
  status: RequestStatus.PENDING,
  createdBy: 'user-alice-001',
  createdByEmail: 'alice@company.com',
  createdAt: new Date('2024-01-01T10:00:00Z'),
};

export const mockApprovedRequest: AccessRequest = {
  ...mockPendingRequest,
  id: 'req-approved-002',
  status: RequestStatus.APPROVED,
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
