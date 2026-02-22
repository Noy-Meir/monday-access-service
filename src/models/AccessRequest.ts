export enum Role {
  EMPLOYEE = 'EMPLOYEE',
  APPROVER = 'APPROVER',
}

export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED',
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
  // Audit fields
  createdBy: string;
  createdByEmail: string;
  createdAt: Date;
  decisionBy?: string;
  decisionByEmail?: string;
  decisionAt?: Date;
  decisionNote?: string;
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
