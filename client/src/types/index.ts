// ── Enums ──────────────────────────────────────────────────────────────────────

export enum Role {
  EMPLOYEE = 'EMPLOYEE',
  APPROVER = 'APPROVER',
}

export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED',
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// ── Domain models ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface AccessRequest {
  id: string;
  applicationName: string;
  justification: string;
  status: RequestStatus;
  createdBy: string;
  createdByEmail: string;
  createdAt: string; // ISO string
  decisionBy?: string;
  decisionByEmail?: string;
  decisionAt?: string;
  decisionNote?: string;
}

export interface RiskAssessmentMetrics {
  executionTimeMs: number;
  provider: string;
  tokensUsed?: number;
  modelId?: string;
}

export interface RiskAssessmentResult {
  requestId: string;
  score: number;
  riskLevel: RiskLevel;
  reasoning: string;
  assessedAt: string;
  metrics: RiskAssessmentMetrics;
}

// ── API payloads ───────────────────────────────────────────────────────────────

export interface CreateRequestPayload {
  applicationName: string;
  justification: string;
}

export interface DecisionPayload {
  decision: RequestStatus.APPROVED | RequestStatus.DENIED;
  decisionNote?: string;
}

// ── API response wrappers ──────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
}

export interface LoginResponse {
  data: {
    token: string;
    user: User;
  };
}

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    message: string;
    details?: ApiErrorDetail[];
  };
}
