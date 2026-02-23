import { api } from './api';
import type {
  AccessRequest,
  ApiResponse,
  CreateRequestPayload,
  DecisionPayload,
  RiskAssessmentResult,
} from '../types';

export const requestsService = {
  async create(payload: CreateRequestPayload): Promise<AccessRequest> {
    const { data } = await api.post<ApiResponse<AccessRequest>>('/api/access-requests', payload);
    return data.data;
  },

  async getMyRequests(userId: string): Promise<AccessRequest[]> {
    const { data } = await api.get<ApiResponse<AccessRequest[]>>(
      `/api/access-requests/user/${userId}`
    );
    return data.data;
  },

  async getAll(): Promise<AccessRequest[]> {
    const { data } = await api.get<ApiResponse<AccessRequest[]>>('/api/access-requests');
    return data.data;
  },

  async getByStatus(status: string): Promise<AccessRequest[]> {
    const { data } = await api.get<ApiResponse<AccessRequest[]>>(
      `/api/access-requests/status/${status}`
    );
    return data.data;
  },

  async decide(id: string, payload: DecisionPayload): Promise<AccessRequest> {
    const { data } = await api.patch<ApiResponse<AccessRequest>>(
      `/api/access-requests/${id}/decision`,
      payload
    );
    return data.data;
  },

  async getRiskAssessment(id: string): Promise<RiskAssessmentResult> {
    const { data } = await api.post<ApiResponse<RiskAssessmentResult>>(
      `/api/access-requests/${id}/risk-assessment`
    );
    return data.data;
  },
};
