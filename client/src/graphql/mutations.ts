import { gql } from '@apollo/client';

import { ACCESS_REQUEST_FIELDS } from './queries';

// ── Mutations ─────────────────────────────────────────────────────────────────

export const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        id
        email
        name
        role
      }
    }
  }
`;

export const CREATE_REQUEST_MUTATION = gql`
  ${ACCESS_REQUEST_FIELDS}
  mutation CreateRequest($applicationName: String!, $justification: String!) {
    createRequest(applicationName: $applicationName, justification: $justification) {
      ...AccessRequestFields
    }
  }
`;

export const DECIDE_REQUEST_MUTATION = gql`
  ${ACCESS_REQUEST_FIELDS}
  mutation DecideRequest($id: ID!, $decision: RequestStatus!, $decisionNote: String) {
    decideRequest(id: $id, decision: $decision, decisionNote: $decisionNote) {
      ...AccessRequestFields
    }
  }
`;

export const ASSESS_REQUEST_RISK_MUTATION = gql`
  mutation AssessRequestRisk($requestId: ID!) {
    assessRequestRisk(requestId: $requestId) {
      requestId score riskLevel reasoning assessedAt
      metrics { executionTimeMs provider tokensUsed modelId }
    }
  }
`;
