/**
 * GraphQL Resolver Tests
 *
 * Uses ApolloServer.executeOperation() to test the full resolver pipeline
 * (schema validation → variable coercion → resolver → serialisation) without
 * spinning up an HTTP server.  All service dependencies are replaced with
 * jest mocks so each test is fully isolated from business-logic internals.
 */
import { ApolloServer } from '@apollo/server';
import { typeDefs } from '../../src/graphql/typeDefs';
import { resolvers } from '../../src/graphql/resolvers';
import type { GraphQLContext } from '../../src/graphql/context';
import { RequestStatus, Role, TokenPayload } from '../../src/models/AccessRequest';
import { AppError } from '../../src/utils/AppError';
import {
  mockEmployeePayload,
  mockITPayload,
  mockAdminPayload,
  mockHRPayload,
  mockUser,
  mockPendingRequest,
  mockApprovedRequest,
  mockDeniedRequest,
  mockPartiallyApprovedRequest,
  mockMultiApprovalRequest,
} from '../helpers/fixtures';

// ── Test helpers ───────────────────────────────────────────────────────────────

/** Creates a fresh ApolloServer backed by the real schema + resolvers. */
function buildTestServer(): ApolloServer<GraphQLContext> {
  return new ApolloServer<GraphQLContext>({ typeDefs, resolvers });
}

/**
 * Creates a mock GraphQLContext.  Every service method is a fresh jest.fn()
 * so tests can configure only what they need without any shared state.
 */
function buildMockContext(
  actor: TokenPayload | null = null,
  overrides: Partial<GraphQLContext> = {}
): GraphQLContext {
  return {
    actor,
    authService: {
      login: jest.fn(),
      verifyToken: jest.fn(),
      findUserById: jest.fn(),
      getUserRole: jest.fn(),
      registerUser: jest.fn(),
    } as unknown as GraphQLContext['authService'],
    accessRequestService: {
      create: jest.fn(),
      decide: jest.fn(),
      getByUser: jest.fn(),
      getByStatus: jest.fn(),
      getAll: jest.fn(),
      getById: jest.fn(),
    } as unknown as GraphQLContext['accessRequestService'],
    riskAssessmentAgent: {
      assess: jest.fn(),
    } as unknown as GraphQLContext['riskAssessmentAgent'],
    ...overrides,
  };
}

/**
 * Unwraps a singleResult from an executeOperation response.
 * Throws if the response is unexpectedly multi-part (incremental delivery).
 * data is cast to Record<string, any> so tests can access resolver-specific
 * fields without fighting the generic `Record<string, unknown>` return type.
 */
function unwrap(
  response: Awaited<ReturnType<ApolloServer<GraphQLContext>['executeOperation']>>
) {
  if (response.body.kind !== 'single') {
    throw new Error(`Expected single result, got: ${response.body.kind}`);
  }
  const { data, errors, extensions } = response.body.singleResult;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { data: data as Record<string, any> | null | undefined, errors, extensions };
}

// ── Shared GraphQL documents ───────────────────────────────────────────────────

const LOGIN_MUTATION = `
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user { id email name role }
    }
  }
`;

const MY_REQUESTS_QUERY = `
  query MyRequests($userId: ID!) {
    myRequests(userId: $userId) {
      id
      applicationName
      status
      requiredApprovals
      approvals { role approvedBy approvedByEmail approvedAt }
      createdBy
      createdByEmail
      createdAt
    }
  }
`;

const ALL_REQUESTS_QUERY = `
  query {
    allRequests {
      id
      applicationName
      status
      requiredApprovals
      approvals { role approvedBy approvedByEmail approvedAt }
      createdAt
    }
  }
`;

const REQUESTS_BY_STATUS_QUERY = `
  query RequestsByStatus($status: RequestStatus!) {
    requestsByStatus(status: $status) {
      id
      status
      requiredApprovals
      approvals { role approvedBy approvedByEmail approvedAt }
      createdAt
    }
  }
`;

const RISK_ASSESSMENT_QUERY = `
  query RiskAssessment($requestId: ID!) {
    riskAssessment(requestId: $requestId) {
      requestId
      score
      riskLevel
      reasoning
      assessedAt
      metrics { executionTimeMs provider tokensUsed modelId }
    }
  }
`;

const CREATE_REQUEST_MUTATION = `
  mutation CreateRequest($applicationName: String!, $justification: String!) {
    createRequest(applicationName: $applicationName, justification: $justification) {
      id
      applicationName
      justification
      status
      requiredApprovals
      approvals { role approvedBy approvedByEmail approvedAt }
      createdBy
      createdByEmail
      createdAt
    }
  }
`;

const DECIDE_REQUEST_MUTATION = `
  mutation DecideRequest($id: ID!, $decision: RequestStatus!, $decisionNote: String) {
    decideRequest(id: $id, decision: $decision, decisionNote: $decisionNote) {
      id
      status
      requiredApprovals
      approvals { role approvedBy approvedByEmail approvedAt }
      createdAt
      decisionBy
      decisionByEmail
      decisionAt
      decisionNote
    }
  }
`;

// ── Suite ──────────────────────────────────────────────────────────────────────

describe('GraphQL Resolvers', () => {
  let server: ApolloServer<GraphQLContext>;

  beforeAll(async () => {
    server = buildTestServer();
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  // ── Mutation.login ──────────────────────────────────────────────────────────
  describe('Mutation.login', () => {
    it('returns token and user on successful login', async () => {
      const ctx = buildMockContext();
      (ctx.authService.login as jest.Mock).mockResolvedValue({
        token: 'jwt-token-abc',
        user: { id: mockUser.id, email: mockUser.email, name: mockUser.name, role: mockUser.role },
      });

      const { data, errors } = unwrap(
        await server.executeOperation(
          { query: LOGIN_MUTATION, variables: { email: 'alice@company.com', password: 'Password123!' } },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeUndefined();
      expect(data?.login.token).toBe('jwt-token-abc');
      expect(data?.login.user.role).toBe('EMPLOYEE');
    });

    it('calls authService.login with the supplied credentials', async () => {
      const ctx = buildMockContext();
      (ctx.authService.login as jest.Mock).mockResolvedValue({
        token: 'tok',
        user: { id: mockUser.id, email: mockUser.email, name: mockUser.name, role: mockUser.role },
      });

      await server.executeOperation(
        { query: LOGIN_MUTATION, variables: { email: 'alice@company.com', password: 'Password123!' } },
        { contextValue: ctx }
      );

      expect(ctx.authService.login).toHaveBeenCalledWith('alice@company.com', 'Password123!');
    });

    it('does not require an actor — login is a public endpoint', async () => {
      const ctx = buildMockContext(null); // no actor
      (ctx.authService.login as jest.Mock).mockResolvedValue({
        token: 'tok',
        user: { id: mockUser.id, email: mockUser.email, name: mockUser.name, role: mockUser.role },
      });

      const { errors } = unwrap(
        await server.executeOperation(
          { query: LOGIN_MUTATION, variables: { email: 'alice@company.com', password: 'Password123!' } },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeUndefined();
    });

    it('returns a GraphQL error when credentials are invalid', async () => {
      const ctx = buildMockContext();
      (ctx.authService.login as jest.Mock).mockRejectedValue(
        new AppError('Invalid credentials', 401)
      );

      const { errors } = unwrap(
        await server.executeOperation(
          { query: LOGIN_MUTATION, variables: { email: 'alice@company.com', password: 'wrong' } },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeDefined();
      expect(errors![0].message).toBe('Invalid credentials');
    });

    it('returns user role as a valid GraphQL enum value', async () => {
      const ctx = buildMockContext();
      (ctx.authService.login as jest.Mock).mockResolvedValue({
        token: 'tok',
        user: {
          id: mockITPayload.sub,
          email: mockITPayload.email,
          name: mockITPayload.name,
          role: Role.IT,
        },
      });

      const { data, errors } = unwrap(
        await server.executeOperation(
          { query: LOGIN_MUTATION, variables: { email: 'carol@company.com', password: 'Password123!' } },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeUndefined();
      expect(data?.login.user.role).toBe('IT');
    });
  });

  // ── Query.myRequests ────────────────────────────────────────────────────────
  describe('Query.myRequests', () => {
    it('returns UNAUTHENTICATED when no actor is present', async () => {
      const ctx = buildMockContext(null);

      const { errors } = unwrap(
        await server.executeOperation(
          { query: MY_REQUESTS_QUERY, variables: { userId: mockEmployeePayload.sub } },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeDefined();
      expect(errors![0].extensions?.code).toBe('UNAUTHENTICATED');
    });

    it('returns serialized requests for an authenticated user', async () => {
      const ctx = buildMockContext(mockEmployeePayload);
      (ctx.accessRequestService.getByUser as jest.Mock).mockResolvedValue([mockPendingRequest]);

      const { data, errors } = unwrap(
        await server.executeOperation(
          { query: MY_REQUESTS_QUERY, variables: { userId: mockEmployeePayload.sub } },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeUndefined();
      expect(data?.myRequests).toHaveLength(1);
      expect(data?.myRequests[0].id).toBe(mockPendingRequest.id);
      expect(data?.myRequests[0].applicationName).toBe(mockPendingRequest.applicationName);
    });

    it('serializes createdAt Date to an ISO string', async () => {
      const ctx = buildMockContext(mockEmployeePayload);
      (ctx.accessRequestService.getByUser as jest.Mock).mockResolvedValue([mockPendingRequest]);

      const { data } = unwrap(
        await server.executeOperation(
          { query: MY_REQUESTS_QUERY, variables: { userId: mockEmployeePayload.sub } },
          { contextValue: ctx }
        )
      );

      expect(data?.myRequests[0].createdAt).toBe(mockPendingRequest.createdAt.toISOString());
    });

    it('serializes approvals[].approvedAt Date to an ISO string', async () => {
      const ctx = buildMockContext(mockITPayload);
      (ctx.accessRequestService.getByUser as jest.Mock).mockResolvedValue([mockApprovedRequest]);

      const { data } = unwrap(
        await server.executeOperation(
          { query: MY_REQUESTS_QUERY, variables: { userId: mockApprovedRequest.createdBy } },
          { contextValue: ctx }
        )
      );

      const expectedISO = mockApprovedRequest.approvals[0].approvedAt.toISOString();
      expect(data?.myRequests[0].approvals[0].approvedAt).toBe(expectedISO);
    });

    it('passes userId and actor to the service', async () => {
      const ctx = buildMockContext(mockEmployeePayload);
      (ctx.accessRequestService.getByUser as jest.Mock).mockResolvedValue([]);

      await server.executeOperation(
        { query: MY_REQUESTS_QUERY, variables: { userId: mockEmployeePayload.sub } },
        { contextValue: ctx }
      );

      expect(ctx.accessRequestService.getByUser).toHaveBeenCalledWith(
        mockEmployeePayload.sub,
        mockEmployeePayload
      );
    });

    it('returns an empty array when the user has no requests', async () => {
      const ctx = buildMockContext(mockEmployeePayload);
      (ctx.accessRequestService.getByUser as jest.Mock).mockResolvedValue([]);

      const { data } = unwrap(
        await server.executeOperation(
          { query: MY_REQUESTS_QUERY, variables: { userId: mockEmployeePayload.sub } },
          { contextValue: ctx }
        )
      );

      expect(data?.myRequests).toEqual([]);
    });

    it('propagates a 403 AppError when EMPLOYEE requests another user\'s data', async () => {
      const ctx = buildMockContext(mockEmployeePayload);
      (ctx.accessRequestService.getByUser as jest.Mock).mockRejectedValue(
        new AppError('You can only view your own access requests', 403)
      );

      const { errors } = unwrap(
        await server.executeOperation(
          { query: MY_REQUESTS_QUERY, variables: { userId: 'other-user-id' } },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeDefined();
      expect(errors![0].message).toBe('You can only view your own access requests');
    });

    it('returns multiple requests', async () => {
      const ctx = buildMockContext(mockITPayload);
      (ctx.accessRequestService.getByUser as jest.Mock).mockResolvedValue([
        mockPendingRequest,
        mockApprovedRequest,
      ]);

      const { data } = unwrap(
        await server.executeOperation(
          { query: MY_REQUESTS_QUERY, variables: { userId: mockPendingRequest.createdBy } },
          { contextValue: ctx }
        )
      );

      expect(data?.myRequests).toHaveLength(2);
    });
  });

  // ── Query.allRequests ───────────────────────────────────────────────────────
  describe('Query.allRequests', () => {
    it('returns UNAUTHENTICATED when no actor is present', async () => {
      const ctx = buildMockContext(null);

      const { errors } = unwrap(
        await server.executeOperation({ query: ALL_REQUESTS_QUERY }, { contextValue: ctx })
      );

      expect(errors).toBeDefined();
      expect(errors![0].extensions?.code).toBe('UNAUTHENTICATED');
    });

    it('returns all requests for an authenticated approver', async () => {
      const ctx = buildMockContext(mockITPayload);
      (ctx.accessRequestService.getAll as jest.Mock).mockResolvedValue([
        mockPendingRequest,
        mockApprovedRequest,
        mockDeniedRequest,
      ]);

      const { data, errors } = unwrap(
        await server.executeOperation({ query: ALL_REQUESTS_QUERY }, { contextValue: ctx })
      );

      expect(errors).toBeUndefined();
      expect(data?.allRequests).toHaveLength(3);
    });

    it('passes actor to the service', async () => {
      const ctx = buildMockContext(mockITPayload);
      (ctx.accessRequestService.getAll as jest.Mock).mockResolvedValue([]);

      await server.executeOperation({ query: ALL_REQUESTS_QUERY }, { contextValue: ctx });

      expect(ctx.accessRequestService.getAll).toHaveBeenCalledWith(mockITPayload);
    });

    it('serializes createdAt Date fields', async () => {
      const ctx = buildMockContext(mockITPayload);
      (ctx.accessRequestService.getAll as jest.Mock).mockResolvedValue([mockPendingRequest]);

      const { data } = unwrap(
        await server.executeOperation({ query: ALL_REQUESTS_QUERY }, { contextValue: ctx })
      );

      expect(data?.allRequests[0].createdAt).toBe(mockPendingRequest.createdAt.toISOString());
    });

    it('propagates a 403 AppError when EMPLOYEE calls allRequests', async () => {
      const ctx = buildMockContext(mockEmployeePayload);
      (ctx.accessRequestService.getAll as jest.Mock).mockRejectedValue(
        new AppError(
          `Access denied: role '${Role.EMPLOYEE}' does not have permission 'access_request:view:all'`,
          403
        )
      );

      const { errors } = unwrap(
        await server.executeOperation({ query: ALL_REQUESTS_QUERY }, { contextValue: ctx })
      );

      expect(errors).toBeDefined();
      expect(errors![0].message).toContain('Access denied');
    });

    it('returns an empty array when there are no requests', async () => {
      const ctx = buildMockContext(mockITPayload);
      (ctx.accessRequestService.getAll as jest.Mock).mockResolvedValue([]);

      const { data } = unwrap(
        await server.executeOperation({ query: ALL_REQUESTS_QUERY }, { contextValue: ctx })
      );

      expect(data?.allRequests).toEqual([]);
    });
  });

  // ── Query.requestsByStatus ──────────────────────────────────────────────────
  describe('Query.requestsByStatus', () => {
    it('returns UNAUTHENTICATED when no actor is present', async () => {
      const ctx = buildMockContext(null);

      const { errors } = unwrap(
        await server.executeOperation(
          { query: REQUESTS_BY_STATUS_QUERY, variables: { status: 'PENDING' } },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeDefined();
      expect(errors![0].extensions?.code).toBe('UNAUTHENTICATED');
    });

    it('returns PENDING requests', async () => {
      const ctx = buildMockContext(mockITPayload);
      (ctx.accessRequestService.getByStatus as jest.Mock).mockResolvedValue([mockPendingRequest]);

      const { data, errors } = unwrap(
        await server.executeOperation(
          { query: REQUESTS_BY_STATUS_QUERY, variables: { status: 'PENDING' } },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeUndefined();
      expect(data?.requestsByStatus[0].status).toBe('PENDING');
    });

    it('returns PARTIALLY_APPROVED requests', async () => {
      const ctx = buildMockContext(mockITPayload);
      (ctx.accessRequestService.getByStatus as jest.Mock).mockResolvedValue([
        mockPartiallyApprovedRequest,
      ]);

      const { data } = unwrap(
        await server.executeOperation(
          { query: REQUESTS_BY_STATUS_QUERY, variables: { status: 'PARTIALLY_APPROVED' } },
          { contextValue: ctx }
        )
      );

      expect(data?.requestsByStatus[0].status).toBe('PARTIALLY_APPROVED');
    });

    it('returns APPROVED requests', async () => {
      const ctx = buildMockContext(mockITPayload);
      (ctx.accessRequestService.getByStatus as jest.Mock).mockResolvedValue([mockApprovedRequest]);

      const { data } = unwrap(
        await server.executeOperation(
          { query: REQUESTS_BY_STATUS_QUERY, variables: { status: 'APPROVED' } },
          { contextValue: ctx }
        )
      );

      expect(data?.requestsByStatus[0].status).toBe('APPROVED');
    });

    it('returns DENIED requests', async () => {
      const ctx = buildMockContext(mockITPayload);
      (ctx.accessRequestService.getByStatus as jest.Mock).mockResolvedValue([mockDeniedRequest]);

      const { data } = unwrap(
        await server.executeOperation(
          { query: REQUESTS_BY_STATUS_QUERY, variables: { status: 'DENIED' } },
          { contextValue: ctx }
        )
      );

      expect(data?.requestsByStatus[0].status).toBe('DENIED');
    });

    it('passes status enum value and actor to the service', async () => {
      const ctx = buildMockContext(mockITPayload);
      (ctx.accessRequestService.getByStatus as jest.Mock).mockResolvedValue([]);

      await server.executeOperation(
        { query: REQUESTS_BY_STATUS_QUERY, variables: { status: 'PENDING' } },
        { contextValue: ctx }
      );

      expect(ctx.accessRequestService.getByStatus).toHaveBeenCalledWith(
        RequestStatus.PENDING,
        mockITPayload
      );
    });

    it('propagates a 403 AppError when EMPLOYEE calls requestsByStatus', async () => {
      const ctx = buildMockContext(mockEmployeePayload);
      (ctx.accessRequestService.getByStatus as jest.Mock).mockRejectedValue(
        new AppError(
          `Access denied: role '${Role.EMPLOYEE}' does not have permission 'access_request:view:by_status'`,
          403
        )
      );

      const { errors } = unwrap(
        await server.executeOperation(
          { query: REQUESTS_BY_STATUS_QUERY, variables: { status: 'PENDING' } },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeDefined();
      expect(errors![0].message).toContain('Access denied');
    });

    it('rejects an invalid status value at the schema level', async () => {
      const ctx = buildMockContext(mockITPayload);

      const { errors } = unwrap(
        await server.executeOperation(
          { query: REQUESTS_BY_STATUS_QUERY, variables: { status: 'NOT_A_REAL_STATUS' } },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeDefined();
      // Schema-level coercion failure — resolver is never called
      expect(ctx.accessRequestService.getByStatus).not.toHaveBeenCalled();
    });

    it('serializes approvals[].approvedAt Date in results', async () => {
      const ctx = buildMockContext(mockITPayload);
      (ctx.accessRequestService.getByStatus as jest.Mock).mockResolvedValue([
        mockPartiallyApprovedRequest,
      ]);

      const { data } = unwrap(
        await server.executeOperation(
          { query: REQUESTS_BY_STATUS_QUERY, variables: { status: 'PARTIALLY_APPROVED' } },
          { contextValue: ctx }
        )
      );

      const expectedISO = mockPartiallyApprovedRequest.approvals[0].approvedAt.toISOString();
      expect(data?.requestsByStatus[0].approvals[0].approvedAt).toBe(expectedISO);
    });
  });

  // ── Query.riskAssessment ────────────────────────────────────────────────────
  describe('Query.riskAssessment', () => {
    const mockAssessmentResult = {
      requestId: mockPendingRequest.id,
      score: 8,
      riskLevel: 'LOW' as const,
      reasoning: 'Low-risk application with adequate justification.',
      assessedAt: new Date('2024-01-15T12:00:00Z'),
      metrics: {
        executionTimeMs: 42,
        provider: 'mock',
        tokensUsed: undefined,
        modelId: undefined,
      },
    };

    it('returns UNAUTHENTICATED when no actor is present', async () => {
      const ctx = buildMockContext(null);

      const { errors } = unwrap(
        await server.executeOperation(
          { query: RISK_ASSESSMENT_QUERY, variables: { requestId: mockPendingRequest.id } },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeDefined();
      expect(errors![0].extensions?.code).toBe('UNAUTHENTICATED');
    });

    it('returns the risk assessment result for an authenticated user', async () => {
      const ctx = buildMockContext(mockEmployeePayload);
      (ctx.accessRequestService.getById as jest.Mock).mockResolvedValue(mockPendingRequest);
      (ctx.riskAssessmentAgent.assess as jest.Mock).mockResolvedValue(mockAssessmentResult);

      const { data, errors } = unwrap(
        await server.executeOperation(
          { query: RISK_ASSESSMENT_QUERY, variables: { requestId: mockPendingRequest.id } },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeUndefined();
      expect(data?.riskAssessment.requestId).toBe(mockPendingRequest.id);
      expect(data?.riskAssessment.score).toBe(8);
      expect(data?.riskAssessment.riskLevel).toBe('LOW');
      expect(data?.riskAssessment.reasoning).toBe(mockAssessmentResult.reasoning);
    });

    it('serializes assessedAt Date to an ISO string', async () => {
      const ctx = buildMockContext(mockEmployeePayload);
      (ctx.accessRequestService.getById as jest.Mock).mockResolvedValue(mockPendingRequest);
      (ctx.riskAssessmentAgent.assess as jest.Mock).mockResolvedValue(mockAssessmentResult);

      const { data } = unwrap(
        await server.executeOperation(
          { query: RISK_ASSESSMENT_QUERY, variables: { requestId: mockPendingRequest.id } },
          { contextValue: ctx }
        )
      );

      expect(data?.riskAssessment.assessedAt).toBe('2024-01-15T12:00:00.000Z');
    });

    it('calls getById then assess with the retrieved request', async () => {
      const ctx = buildMockContext(mockEmployeePayload);
      (ctx.accessRequestService.getById as jest.Mock).mockResolvedValue(mockPendingRequest);
      (ctx.riskAssessmentAgent.assess as jest.Mock).mockResolvedValue(mockAssessmentResult);

      await server.executeOperation(
        { query: RISK_ASSESSMENT_QUERY, variables: { requestId: mockPendingRequest.id } },
        { contextValue: ctx }
      );

      expect(ctx.accessRequestService.getById).toHaveBeenCalledWith(
        mockPendingRequest.id,
        mockEmployeePayload
      );
      expect(ctx.riskAssessmentAgent.assess).toHaveBeenCalledWith(mockPendingRequest);
    });

    it('includes metrics in the response', async () => {
      const ctx = buildMockContext(mockEmployeePayload);
      (ctx.accessRequestService.getById as jest.Mock).mockResolvedValue(mockPendingRequest);
      (ctx.riskAssessmentAgent.assess as jest.Mock).mockResolvedValue(mockAssessmentResult);

      const { data } = unwrap(
        await server.executeOperation(
          { query: RISK_ASSESSMENT_QUERY, variables: { requestId: mockPendingRequest.id } },
          { contextValue: ctx }
        )
      );

      expect(data?.riskAssessment.metrics.executionTimeMs).toBe(42);
      expect(data?.riskAssessment.metrics.provider).toBe('mock');
    });

    it('propagates a 404 AppError when the request is not found', async () => {
      const ctx = buildMockContext(mockEmployeePayload);
      (ctx.accessRequestService.getById as jest.Mock).mockRejectedValue(
        new AppError('Request not found', 404)
      );

      const { errors } = unwrap(
        await server.executeOperation(
          { query: RISK_ASSESSMENT_QUERY, variables: { requestId: 'non-existent-id' } },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeDefined();
      expect(errors![0].message).toBe('Request not found');
    });

    it('propagates a 403 AppError when the user cannot view the request', async () => {
      const ctx = buildMockContext(mockEmployeePayload);
      (ctx.accessRequestService.getById as jest.Mock).mockRejectedValue(
        new AppError('Not authorized to view this request', 403)
      );

      const { errors } = unwrap(
        await server.executeOperation(
          { query: RISK_ASSESSMENT_QUERY, variables: { requestId: 'req-other-001' } },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeDefined();
      expect(errors![0].message).toBe('Not authorized to view this request');
    });

    it('propagates an agent error when the AI assessment fails', async () => {
      const ctx = buildMockContext(mockEmployeePayload);
      (ctx.accessRequestService.getById as jest.Mock).mockResolvedValue(mockPendingRequest);
      (ctx.riskAssessmentAgent.assess as jest.Mock).mockRejectedValue(
        new AppError('AI provider unavailable', 503)
      );

      const { errors } = unwrap(
        await server.executeOperation(
          { query: RISK_ASSESSMENT_QUERY, variables: { requestId: mockPendingRequest.id } },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeDefined();
      expect(errors![0].message).toBe('AI provider unavailable');
    });
  });

  // ── Mutation.createRequest ──────────────────────────────────────────────────
  describe('Mutation.createRequest', () => {
    it('returns UNAUTHENTICATED when no actor is present', async () => {
      const ctx = buildMockContext(null);

      const { errors } = unwrap(
        await server.executeOperation(
          {
            query: CREATE_REQUEST_MUTATION,
            variables: { applicationName: 'GitHub', justification: 'Need access.' },
          },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeDefined();
      expect(errors![0].extensions?.code).toBe('UNAUTHENTICATED');
    });

    it('returns the created and serialized request', async () => {
      const ctx = buildMockContext(mockEmployeePayload);
      (ctx.accessRequestService.create as jest.Mock).mockResolvedValue(mockPendingRequest);

      const { data, errors } = unwrap(
        await server.executeOperation(
          {
            query: CREATE_REQUEST_MUTATION,
            variables: { applicationName: 'GitHub', justification: 'Need access for Q3.' },
          },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeUndefined();
      expect(data?.createRequest.id).toBe(mockPendingRequest.id);
      expect(data?.createRequest.status).toBe('PENDING');
      expect(data?.createRequest.applicationName).toBe(mockPendingRequest.applicationName);
    });

    it('serializes createdAt Date to an ISO string', async () => {
      const ctx = buildMockContext(mockEmployeePayload);
      (ctx.accessRequestService.create as jest.Mock).mockResolvedValue(mockPendingRequest);

      const { data } = unwrap(
        await server.executeOperation(
          {
            query: CREATE_REQUEST_MUTATION,
            variables: { applicationName: 'GitHub', justification: 'Need access.' },
          },
          { contextValue: ctx }
        )
      );

      expect(data?.createRequest.createdAt).toBe(mockPendingRequest.createdAt.toISOString());
    });

    it('passes applicationName, justification, and actor to the service', async () => {
      const ctx = buildMockContext(mockEmployeePayload);
      (ctx.accessRequestService.create as jest.Mock).mockResolvedValue(mockPendingRequest);

      await server.executeOperation(
        {
          query: CREATE_REQUEST_MUTATION,
          variables: { applicationName: 'GitHub', justification: 'Need access for Q3.' },
        },
        { contextValue: ctx }
      );

      expect(ctx.accessRequestService.create).toHaveBeenCalledWith(
        { applicationName: 'GitHub', justification: 'Need access for Q3.' },
        mockEmployeePayload
      );
    });

    it('reflects requiredApprovals returned by the service', async () => {
      const ctx = buildMockContext(mockEmployeePayload);
      (ctx.accessRequestService.create as jest.Mock).mockResolvedValue(mockMultiApprovalRequest);

      const { data } = unwrap(
        await server.executeOperation(
          {
            query: CREATE_REQUEST_MUTATION,
            variables: { applicationName: 'Database Access', justification: 'Incident investigation.' },
          },
          { contextValue: ctx }
        )
      );

      expect(data?.createRequest.requiredApprovals).toEqual(['MANAGER', 'IT']);
    });

    it('returns an empty approvals array for a new request', async () => {
      const ctx = buildMockContext(mockEmployeePayload);
      (ctx.accessRequestService.create as jest.Mock).mockResolvedValue(mockPendingRequest);

      const { data } = unwrap(
        await server.executeOperation(
          {
            query: CREATE_REQUEST_MUTATION,
            variables: { applicationName: 'GitHub', justification: 'Need access.' },
          },
          { contextValue: ctx }
        )
      );

      expect(data?.createRequest.approvals).toEqual([]);
    });
  });

  // ── Mutation.decideRequest ──────────────────────────────────────────────────
  describe('Mutation.decideRequest', () => {
    it('returns UNAUTHENTICATED when no actor is present', async () => {
      const ctx = buildMockContext(null);

      const { errors } = unwrap(
        await server.executeOperation(
          { query: DECIDE_REQUEST_MUTATION, variables: { id: mockPendingRequest.id, decision: 'APPROVED' } },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeDefined();
      expect(errors![0].extensions?.code).toBe('UNAUTHENTICATED');
    });

    it('returns the updated APPROVED request', async () => {
      const ctx = buildMockContext(mockITPayload);
      (ctx.accessRequestService.decide as jest.Mock).mockResolvedValue(mockApprovedRequest);

      const { data, errors } = unwrap(
        await server.executeOperation(
          { query: DECIDE_REQUEST_MUTATION, variables: { id: mockPendingRequest.id, decision: 'APPROVED' } },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeUndefined();
      expect(data?.decideRequest.status).toBe('APPROVED');
    });

    it('returns the updated DENIED request', async () => {
      const ctx = buildMockContext(mockITPayload);
      (ctx.accessRequestService.decide as jest.Mock).mockResolvedValue(mockDeniedRequest);

      const { data } = unwrap(
        await server.executeOperation(
          {
            query: DECIDE_REQUEST_MUTATION,
            variables: { id: mockPendingRequest.id, decision: 'DENIED', decisionNote: 'Not justified.' },
          },
          { contextValue: ctx }
        )
      );

      expect(data?.decideRequest.status).toBe('DENIED');
    });

    it('returns PARTIALLY_APPROVED for the first approval of a multi-step request', async () => {
      const ctx = buildMockContext(mockITPayload);
      (ctx.accessRequestService.decide as jest.Mock).mockResolvedValue(mockPartiallyApprovedRequest);

      const { data } = unwrap(
        await server.executeOperation(
          {
            query: DECIDE_REQUEST_MUTATION,
            variables: { id: mockMultiApprovalRequest.id, decision: 'APPROVED' },
          },
          { contextValue: ctx }
        )
      );

      expect(data?.decideRequest.status).toBe('PARTIALLY_APPROVED');
    });

    it('passes id, decision, decisionNote, and actor to the service', async () => {
      const ctx = buildMockContext(mockITPayload);
      (ctx.accessRequestService.decide as jest.Mock).mockResolvedValue(mockApprovedRequest);

      await server.executeOperation(
        {
          query: DECIDE_REQUEST_MUTATION,
          variables: { id: mockPendingRequest.id, decision: 'APPROVED', decisionNote: 'LGTM' },
        },
        { contextValue: ctx }
      );

      expect(ctx.accessRequestService.decide).toHaveBeenCalledWith(
        mockPendingRequest.id,
        { decision: RequestStatus.APPROVED, decisionNote: 'LGTM' },
        mockITPayload
      );
    });

    it('passes undefined decisionNote when it is omitted from the mutation', async () => {
      const ctx = buildMockContext(mockITPayload);
      (ctx.accessRequestService.decide as jest.Mock).mockResolvedValue(mockApprovedRequest);

      await server.executeOperation(
        { query: DECIDE_REQUEST_MUTATION, variables: { id: mockPendingRequest.id, decision: 'APPROVED' } },
        { contextValue: ctx }
      );

      expect(ctx.accessRequestService.decide).toHaveBeenCalledWith(
        mockPendingRequest.id,
        { decision: RequestStatus.APPROVED, decisionNote: undefined },
        mockITPayload
      );
    });

    it('serializes decisionAt Date to an ISO string in the response', async () => {
      const ctx = buildMockContext(mockITPayload);
      (ctx.accessRequestService.decide as jest.Mock).mockResolvedValue(mockApprovedRequest);

      const { data } = unwrap(
        await server.executeOperation(
          { query: DECIDE_REQUEST_MUTATION, variables: { id: mockApprovedRequest.id, decision: 'APPROVED' } },
          { contextValue: ctx }
        )
      );

      expect(data?.decideRequest.decisionAt).toBe(mockApprovedRequest.decisionAt!.toISOString());
    });

    it('returns null decisionAt for a PARTIALLY_APPROVED request', async () => {
      const ctx = buildMockContext(mockITPayload);
      (ctx.accessRequestService.decide as jest.Mock).mockResolvedValue(mockPartiallyApprovedRequest);

      const { data } = unwrap(
        await server.executeOperation(
          { query: DECIDE_REQUEST_MUTATION, variables: { id: mockPartiallyApprovedRequest.id, decision: 'APPROVED' } },
          { contextValue: ctx }
        )
      );

      expect(data?.decideRequest.decisionAt).toBeNull();
    });

    it('propagates a 403 AppError when role is not in requiredApprovals', async () => {
      const ctx = buildMockContext(mockITPayload);
      (ctx.accessRequestService.decide as jest.Mock).mockRejectedValue(
        new AppError(`Role '${Role.IT}' is not authorized to approve requests for 'HiBob'`, 403)
      );

      const { errors } = unwrap(
        await server.executeOperation(
          { query: DECIDE_REQUEST_MUTATION, variables: { id: 'req-hr-001', decision: 'APPROVED' } },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeDefined();
      expect(errors![0].message).toContain('IT');
    });

    it('propagates a 403 AppError when EMPLOYEE attempts to decide', async () => {
      const ctx = buildMockContext(mockEmployeePayload);
      (ctx.accessRequestService.decide as jest.Mock).mockRejectedValue(
        new AppError(
          `Access denied: role '${Role.EMPLOYEE}' does not have permission 'access_request:decide'`,
          403
        )
      );

      const { errors } = unwrap(
        await server.executeOperation(
          { query: DECIDE_REQUEST_MUTATION, variables: { id: mockPendingRequest.id, decision: 'APPROVED' } },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeDefined();
      expect(errors![0].message).toContain('Access denied');
    });

    it('propagates a 404 AppError when the request does not exist', async () => {
      const ctx = buildMockContext(mockITPayload);
      (ctx.accessRequestService.decide as jest.Mock).mockRejectedValue(
        new AppError("Access request 'non-existent' not found", 404)
      );

      const { errors } = unwrap(
        await server.executeOperation(
          { query: DECIDE_REQUEST_MUTATION, variables: { id: 'non-existent', decision: 'APPROVED' } },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeDefined();
      expect(errors![0].message).toContain('not found');
    });

    it('propagates a 409 AppError when the request is already finalized', async () => {
      const ctx = buildMockContext(mockITPayload);
      (ctx.accessRequestService.decide as jest.Mock).mockRejectedValue(
        new AppError(
          `Cannot decide on a request with status 'APPROVED'. Only PENDING or PARTIALLY_APPROVED requests can be decided.`,
          409
        )
      );

      const { errors } = unwrap(
        await server.executeOperation(
          { query: DECIDE_REQUEST_MUTATION, variables: { id: mockApprovedRequest.id, decision: 'DENIED' } },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeDefined();
      expect(errors![0].message).toContain('APPROVED');
    });

    it('propagates a 409 AppError when the same role tries to approve twice', async () => {
      const ctx = buildMockContext(mockITPayload);
      (ctx.accessRequestService.decide as jest.Mock).mockRejectedValue(
        new AppError(`Role '${Role.IT}' has already approved this request`, 409)
      );

      const { errors } = unwrap(
        await server.executeOperation(
          {
            query: DECIDE_REQUEST_MUTATION,
            variables: { id: mockPartiallyApprovedRequest.id, decision: 'APPROVED' },
          },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeDefined();
      expect(errors![0].message).toContain('already approved');
    });

    it('ADMIN can decide any request — passes ADMIN actor to the service', async () => {
      const ctx = buildMockContext(mockAdminPayload);
      const adminApprovedRequest = { ...mockMultiApprovalRequest, status: RequestStatus.APPROVED };
      (ctx.accessRequestService.decide as jest.Mock).mockResolvedValue(adminApprovedRequest);

      const { data, errors } = unwrap(
        await server.executeOperation(
          { query: DECIDE_REQUEST_MUTATION, variables: { id: mockMultiApprovalRequest.id, decision: 'APPROVED' } },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeUndefined();
      expect(data?.decideRequest.status).toBe('APPROVED');
      expect(ctx.accessRequestService.decide).toHaveBeenCalledWith(
        mockMultiApprovalRequest.id,
        expect.objectContaining({ decision: RequestStatus.APPROVED }),
        mockAdminPayload
      );
    });

    it('HR can decide HR-only requests — passes HR actor to the service', async () => {
      const hrRequest = {
        ...mockPendingRequest,
        id: 'req-hr-001',
        applicationName: 'HiBob',
        requiredApprovals: [Role.HR],
        approvals: [],
      };
      const approvedHR = { ...hrRequest, status: RequestStatus.APPROVED };
      const ctx = buildMockContext(mockHRPayload);
      (ctx.accessRequestService.decide as jest.Mock).mockResolvedValue(approvedHR);

      const { data, errors } = unwrap(
        await server.executeOperation(
          { query: DECIDE_REQUEST_MUTATION, variables: { id: hrRequest.id, decision: 'APPROVED' } },
          { contextValue: ctx }
        )
      );

      expect(errors).toBeUndefined();
      expect(data?.decideRequest.status).toBe('APPROVED');
      expect(ctx.accessRequestService.decide).toHaveBeenCalledWith(
        hrRequest.id,
        expect.any(Object),
        mockHRPayload
      );
    });
  });
});
