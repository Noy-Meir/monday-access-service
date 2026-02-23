import { GraphQLError } from 'graphql';
import { AccessRequest, RequestStatus } from '../models/AccessRequest';
import type { GraphQLContext } from './context';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Throws an UNAUTHENTICATED GraphQL error when no actor is present in context. */
function requireActor(ctx: GraphQLContext) {
  if (!ctx.actor) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
}

/** Serialises Date fields to ISO strings for the GraphQL transport layer. */
function serializeRequest(request: AccessRequest) {
  return {
    ...request,
    createdAt: request.createdAt instanceof Date
      ? request.createdAt.toISOString()
      : request.createdAt,
    decisionAt: request.decisionAt instanceof Date
      ? request.decisionAt.toISOString()
      : request.decisionAt,
  };
}

// ── Resolvers ─────────────────────────────────────────────────────────────────

export const resolvers = {
  // ── Queries ──────────────────────────────────────────────────────────────
  Query: {
    myRequests: async (
      _: unknown,
      { userId }: { userId: string },
      ctx: GraphQLContext
    ) => {
      requireActor(ctx);
      const requests = await ctx.accessRequestService.getByUser(userId, ctx.actor!);
      return requests.map(serializeRequest);
    },

    allRequests: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireActor(ctx);
      const requests = await ctx.accessRequestService.getAll(ctx.actor!);
      return requests.map(serializeRequest);
    },

    requestsByStatus: async (
      _: unknown,
      { status }: { status: RequestStatus },
      ctx: GraphQLContext
    ) => {
      requireActor(ctx);
      const requests = await ctx.accessRequestService.getByStatus(status, ctx.actor!);
      return requests.map(serializeRequest);
    },

    riskAssessment: async (
      _: unknown,
      { requestId }: { requestId: string },
      ctx: GraphQLContext
    ) => {
      requireActor(ctx);
      const request = await ctx.accessRequestService.getById(requestId, ctx.actor!);
      const result = await ctx.riskAssessmentAgent.assess(request);
      return {
        ...result,
        assessedAt: result.assessedAt instanceof Date
          ? result.assessedAt.toISOString()
          : result.assessedAt,
      };
    },
  },

  // ── Mutations ─────────────────────────────────────────────────────────────
  Mutation: {
    login: async (
      _: unknown,
      { email, password }: { email: string; password: string },
      ctx: GraphQLContext
    ) => {
      return ctx.authService.login(email, password);
    },

    createRequest: async (
      _: unknown,
      { applicationName, justification }: { applicationName: string; justification: string },
      ctx: GraphQLContext
    ) => {
      requireActor(ctx);
      const request = await ctx.accessRequestService.create(
        { applicationName, justification },
        ctx.actor!
      );
      return serializeRequest(request);
    },

    decideRequest: async (
      _: unknown,
      {
        id,
        decision,
        decisionNote,
      }: { id: string; decision: RequestStatus; decisionNote?: string },
      ctx: GraphQLContext
    ) => {
      requireActor(ctx);
      const request = await ctx.accessRequestService.decide(
        id,
        { decision: decision as RequestStatus.APPROVED | RequestStatus.DENIED, decisionNote },
        ctx.actor!
      );
      return serializeRequest(request);
    },
  },
};
