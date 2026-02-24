import { GraphQLError } from 'graphql';
import type { RequestHandler } from 'express';
import { AccessRequest, RequestStatus, Role } from '../models/AccessRequest';
import { Permission } from '../models/Permission';
import { authRateLimiter, createRequestRateLimiter } from '../middleware/rateLimiter.middleware';
import type { GraphQLContext } from './context';

export enum GraphQLErrorCode {
  UNAUTHENTICATED   = 'UNAUTHENTICATED',
  FORBIDDEN         = 'FORBIDDEN',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
}

/**
 * Throws UNAUTHENTICATED when no actor is present in the context.
 * Used as the first line of defence in every protected resolver.
 */
function requireActor(ctx: GraphQLContext): void {
  if (!ctx.actor) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: GraphQLErrorCode.UNAUTHENTICATED },
    });
  }
}

/**
 * Asserts the authenticated actor holds the given permission.
 * Throws UNAUTHENTICATED if there is no actor, FORBIDDEN if the permission
 * is not granted by the actor's role.
 */
function requirePermission(ctx: GraphQLContext, permission: Permission): void {
  requireActor(ctx);
  if (!ctx.authorizationService.hasPermission(ctx.actor!, permission)) {
    throw new GraphQLError(
      `Access denied: role '${ctx.actor!.role}' does not have permission '${permission}'`,
      { extensions: { code: GraphQLErrorCode.FORBIDDEN } }
    );
  }
}

// Minimal resolver function type — keeps withPermission generic without `any`.
type ResolverFn<TArgs = Record<string, unknown>> = (
  parent: unknown,
  args: TArgs,
  ctx: GraphQLContext
) => Promise<unknown>;

/**
 * Declarative resolver wrapper that enforces authentication and a single
 * permission before delegating to the wrapped resolver.
 *
 * After the wrapper runs, ctx.actor is guaranteed to be non-null inside the
 * inner resolver, so it is safe to write ctx.actor! there.
 */
function withPermission<TArgs = Record<string, unknown>>(
  permission: Permission,
  resolver: ResolverFn<TArgs>
): ResolverFn<TArgs> {
  return async (parent, args, ctx) => {
    requirePermission(ctx, permission);
    return resolver(parent, args, ctx);
  };
}

/**
 * Declarative resolver wrapper that enforces an express-rate-limit policy
 * before delegating to the wrapped resolver.
 *
 * The limiter must use handler: (_req, _res, next) => next(error) so that a
 * rejected request propagates through the Promise below instead of writing a
 * raw HTTP 429 response to the socket.  Both authRateLimiter and
 * createRequestRateLimiter are configured this way in rateLimiter.middleware.ts.
 */
function withRateLimit<TArgs = Record<string, unknown>>(
  limiter: RequestHandler,
  resolver: ResolverFn<TArgs>
): ResolverFn<TArgs> {
  return async (parent, args, ctx) => {
    await new Promise<void>((resolve, reject) => {
      limiter(ctx.req, ctx.res, (err?: unknown) => {
        if (err) reject(err);
        else resolve();
      });
    }).catch(() => {
      throw new GraphQLError('Too many requests. Please try again later.', {
        extensions: { code: GraphQLErrorCode.TOO_MANY_REQUESTS },
      });
    });

    return resolver(parent, args, ctx);
  };
}


/** Converts Date fields to ISO strings for the GraphQL transport layer. */
function serializeRequest(request: AccessRequest) {
  return {
    ...request,
    createdAt: request.createdAt instanceof Date
      ? request.createdAt.toISOString()
      : request.createdAt,
    decisionAt: request.decisionAt instanceof Date
      ? request.decisionAt.toISOString()
      : request.decisionAt,
    approvals: request.approvals.map((a) => ({
      ...a,
      approvedAt: a.approvedAt instanceof Date ? a.approvedAt.toISOString() : a.approvedAt,
    })),
  };
}


export const resolvers = {
  Query: {
    myRequests: async (
      _: unknown,
      { userId }: { userId: string },
      ctx: GraphQLContext
    ) => {
      requireActor(ctx);

      const canViewAll = ctx.authorizationService.hasPermission(
        ctx.actor!,
        Permission.ACCESS_REQUEST_VIEW_ALL
      );
      if (!canViewAll && ctx.actor!.sub !== userId) {
        throw new GraphQLError('You can only view your own access requests', {
          extensions: { code: GraphQLErrorCode.FORBIDDEN },
        });
      }

      const requests = await ctx.accessRequestService.getByUser(userId);
      return requests.map(serializeRequest);
    },

    allRequests: withPermission(
      Permission.ACCESS_REQUEST_VIEW_ALL,
      async (_, __, ctx) => {
        const requests = await ctx.accessRequestService.getAll();
        return requests.map(serializeRequest);
      }
    ),

    requestsByStatus: withPermission(
      Permission.ACCESS_REQUEST_VIEW_BY_STATUS,
      async (_, { status }: { status: RequestStatus }, ctx) => {
        const requests = await ctx.accessRequestService.getByStatus(status);
        return requests.map(serializeRequest);
      }
    ),

    riskAssessment: async (
      _: unknown,
      { requestId }: { requestId: string },
      ctx: GraphQLContext
    ) => {
      requireActor(ctx);

      const request = await ctx.accessRequestService.getById(requestId);

      const canViewAll = ctx.authorizationService.hasPermission(
        ctx.actor!,
        Permission.ACCESS_REQUEST_VIEW_ALL
      );
      if (!canViewAll && request.createdBy !== ctx.actor!.sub) {
        throw new GraphQLError('Not authorized to view this request', {
          extensions: { code: GraphQLErrorCode.FORBIDDEN },
        });
      }

      const result = await ctx.riskAssessmentAgent.assess(request);
      return {
        ...result,
        assessedAt: result.assessedAt instanceof Date
          ? result.assessedAt.toISOString()
          : result.assessedAt,
      };
    },
  },

  Mutation: {
    login: withRateLimit(
      authRateLimiter,
      async (_: unknown, { email, password }: { email: string; password: string }, ctx) => {
        return ctx.authService.login(email, password);
      }
    ),

    createRequest: withRateLimit(
      createRequestRateLimiter,
      withPermission(
        Permission.ACCESS_REQUEST_CREATE,
        async (
          _,
          { applicationName, justification }: { applicationName: string; justification: string },
          ctx
        ) => {
          const request = await ctx.accessRequestService.create(
            { applicationName, justification },
            ctx.actor!
          );
          return serializeRequest(request);
        }
      )
    ),

    decideRequest: withPermission(
      Permission.ACCESS_REQUEST_DECIDE,
      async (
        _,
        { id, decision, decisionNote }: { id: string; decision: RequestStatus; decisionNote?: string },
        ctx
      ) => {
        // Pre-fetch the request so the role-boundary check can run before
        // any mutating business logic executes.
        const request = await ctx.accessRequestService.getById(id);

        if (
          ctx.actor!.role !== Role.ADMIN &&
          !request.requiredApprovals.includes(ctx.actor!.role)
        ) {
          throw new GraphQLError(
            `Role '${ctx.actor!.role}' is not authorized to approve requests for '${request.applicationName}'`,
            { extensions: { code: GraphQLErrorCode.FORBIDDEN } }
          );
        }

        const updated = await ctx.accessRequestService.decide(
          id,
          { decision: decision as RequestStatus.APPROVED | RequestStatus.DENIED, decisionNote },
          ctx.actor!
        );
        return serializeRequest(updated);
      }
    ),
  },
};
