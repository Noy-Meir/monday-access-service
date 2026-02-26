import { gql } from '@apollo/client';

// ── Access Request fragment ───────────────────────────────────────────────────
export const ACCESS_REQUEST_FIELDS = gql`
  fragment AccessRequestFields on AccessRequest {
    id
    applicationName
    justification
    status
    requiredApprovals
    approvals {
      role
      approvedBy
      approvedByEmail
      approvedAt
    }
    createdBy
    createdByEmail
    createdAt
    decisionBy
    decisionByEmail
    decisionAt
    decisionNote
  }
`;

// ── Queries ───────────────────────────────────────────────────────────────────

export const MY_REQUESTS_QUERY = gql`
  ${ACCESS_REQUEST_FIELDS}
  query MyRequests($userId: ID!) {
    myRequests(userId: $userId) {
      ...AccessRequestFields
    }
  }
`;

export const ALL_REQUESTS_QUERY = gql`
  ${ACCESS_REQUEST_FIELDS}
  query AllRequests {
    allRequests {
      ...AccessRequestFields
    }
  }
`;

export const REQUESTS_BY_STATUS_QUERY = gql`
  ${ACCESS_REQUEST_FIELDS}
  query RequestsByStatus($status: RequestStatus!) {
    requestsByStatus(status: $status) {
      ...AccessRequestFields
    }
  }
`;

