import { RiskAssessmentResult } from '../modules/ai-agent/types';

export { RiskAssessmentResult };

export enum Role {
  EMPLOYEE = 'EMPLOYEE',
  MANAGER  = 'MANAGER',
  IT       = 'IT',
  HR       = 'HR',
  ADMIN    = 'ADMIN',
}

export enum RequestStatus {
  PENDING             = 'PENDING',
  PARTIALLY_APPROVED  = 'PARTIALLY_APPROVED',
  APPROVED            = 'APPROVED',
  DENIED              = 'DENIED',
}

export interface Approval {
  role: Role;
  approvedBy: string;
  approvedByEmail: string;
  approvedAt: Date;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
}

export interface AccessRequest {
  id: string;
  applicationName: string;
  justification: string;
  status: RequestStatus;
  requiredApprovals: Role[];
  approvals: Approval[];
  // Audit fields
  createdBy: string;
  createdByEmail: string;
  createdAt: Date;
  decisionBy?: string;
  decisionByEmail?: string;
  decisionAt?: Date;
  decisionNote?: string;
  aiAssessment?: RiskAssessmentResult;
}

/** JWT payload stored inside the signed token */
export interface TokenPayload {
  sub: string; // user id
  email: string;
  name: string;
  role: Role;
  iat?: number;
  exp?: number;
}
