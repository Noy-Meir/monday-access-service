export const typeDefs = `#graphql
  enum Role {
    EMPLOYEE
    APPROVER
  }

  enum RequestStatus {
    PENDING
    APPROVED
    DENIED
  }

  enum RiskLevel {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  type User {
    id: ID!
    email: String!
    name: String!
    role: Role!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type AccessRequest {
    id: ID!
    applicationName: String!
    justification: String!
    status: RequestStatus!
    createdBy: String!
    createdByEmail: String!
    createdAt: String!
    decisionBy: String
    decisionByEmail: String
    decisionAt: String
    decisionNote: String
  }

  type RiskAssessmentMetrics {
    executionTimeMs: Int!
    provider: String!
    tokensUsed: Int
    modelId: String
  }

  type RiskAssessmentResult {
    requestId: ID!
    score: Int!
    riskLevel: RiskLevel!
    reasoning: String!
    assessedAt: String!
    metrics: RiskAssessmentMetrics!
  }

  type Query {
    # Returns requests created by the given userId.
    # Employees can only query their own; approvers can query any user.
    myRequests(userId: ID!): [AccessRequest!]!

    # Returns all access requests. Requires APPROVER role.
    allRequests: [AccessRequest!]!

    # Returns requests filtered by status. Requires APPROVER role.
    requestsByStatus(status: RequestStatus!): [AccessRequest!]!

    # Runs an AI risk assessment on the given request.
    riskAssessment(requestId: ID!): RiskAssessmentResult!
  }

  type Mutation {
    # Authenticates a user and returns a JWT token.
    login(email: String!, password: String!): AuthPayload!

    # Creates a new access request for the authenticated user.
    createRequest(applicationName: String!, justification: String!): AccessRequest!

    # Approves or denies a PENDING request. Requires APPROVER role.
    decideRequest(
      id: ID!
      decision: RequestStatus!
      decisionNote: String
    ): AccessRequest!
  }
`;
