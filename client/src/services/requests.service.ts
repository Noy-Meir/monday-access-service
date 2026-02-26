import { apolloClient } from '../graphql/apolloClient';
import {
  MY_REQUESTS_QUERY,
  ALL_REQUESTS_QUERY,
  REQUESTS_BY_STATUS_QUERY,
} from '../graphql/queries';
import {
  CREATE_REQUEST_MUTATION,
  DECIDE_REQUEST_MUTATION,
  ASSESS_REQUEST_RISK_MUTATION,
} from '../graphql/mutations';
import type {
  AccessRequest,
  CreateRequestPayload,
  DecisionPayload,
  RiskAssessmentResult,
} from '../types';

export const requestsService = {
  async create(payload: CreateRequestPayload): Promise<AccessRequest> {
    const { data } = await apolloClient.mutate({
      mutation: CREATE_REQUEST_MUTATION,
      variables: {
        applicationName: payload.applicationName,
        justification: payload.justification,
      },
    });
    return data.createRequest;
  },

  async getMyRequests(userId: string): Promise<AccessRequest[]> {
    const { data } = await apolloClient.query({
      query: MY_REQUESTS_QUERY,
      variables: { userId },
    });
    return data.myRequests;
  },

  async getAll(): Promise<AccessRequest[]> {
    const { data } = await apolloClient.query({ query: ALL_REQUESTS_QUERY });
    return data.allRequests;
  },

  async getByStatus(status: string): Promise<AccessRequest[]> {
    const { data } = await apolloClient.query({
      query: REQUESTS_BY_STATUS_QUERY,
      variables: { status },
    });
    return data.requestsByStatus;
  },

  async decide(id: string, payload: DecisionPayload): Promise<AccessRequest> {
    const { data } = await apolloClient.mutate({
      mutation: DECIDE_REQUEST_MUTATION,
      variables: {
        id,
        decision: payload.decision,
        decisionNote: payload.decisionNote,
      },
    });
    return data.decideRequest;
  },

  async getRiskAssessment(id: string): Promise<RiskAssessmentResult> {
    const { data } = await apolloClient.mutate({
      mutation: ASSESS_REQUEST_RISK_MUTATION,
      variables: { requestId: id },
    });
    return data.assessRequestRisk;
  },
};
