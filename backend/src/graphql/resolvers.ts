import { GraphQLError } from 'graphql';
import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError';
import { z } from 'zod';
import { AccessRequest, RequestStatus, Role } from '../models/AccessRequest';
import { Permission } from '../models/Permission';
import { authRateLimiter, createRequestRateLimiter } from '../middleware/rateLimiter.middleware';
import { loginSchema } from '../validators/login.schema';
import { createAccessRequestSchema } from '../validators/createAccessRequest.schema';
import { decideAccessRequestSchema } from '../validators/decideAccessRequest.schema';
import type { GraphQLContext } from './context';

export enum GraphQLErrorCode {
  UNAUTHENTICATED   = 'UNAUTHENTICATED',
  FORBIDDEN         = 'FORBIDDEN',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  BAD_USER_INPUT    = 'BAD_USER_INPUT',
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

/**
 * Declarative resolver wrapper that validates incoming args against a Zod
 * schema before delegating to the wrapped resolver.
 *
 * Throws BAD_USER_INPUT with all Zod error messages joined on failure.
 * On success, passes the parsed (trimmed/coerced) data to the inner resolver.
 */
function withValidation<TArgs>(
  schema: z.ZodType<TArgs>,
  resolver: ResolverFn<TArgs>
): ResolverFn<TArgs> {
  return async (parent, args, ctx) => {
    const result = schema.safeParse(args);
    if (!result.success) {
      throw new GraphQLError(
        result.error.errors.map(e => e.message).join('; '),
        { extensions: { code: GraphQLErrorCode.BAD_USER_INPUT } }
      );
    }
    return resolver(parent, result.data, ctx);
  };
}


/**
 * Re-throws an AppError as a GraphQLError with an appropriate extension code
 */
function toGraphQLError(err: unknown): never {
  if (err instanceof AppError) {
    const code =
      err.statusCode === 401 ? 'UNAUTHENTICATED'
      : err.statusCode === 403 ? 'FORBIDDEN'
      : err.statusCode === 404 ? 'NOT_FOUND'
      : err.statusCode === 409 ? 'CONFLICT'
      : err.statusCode >= 500  ? 'INTERNAL_SERVER_ERROR'
      : 'BAD_USER_INPUT';
    throw new GraphQLError(err.message, { extensions: { code } });
  }
  throw err;
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
    ...(request.aiAssessment ? {
      aiAssessment: {
        ...request.aiAssessment,
        assessedAt: request.aiAssessment.assessedAt instanceof Date
          ? request.aiAssessment.assessedAt.toISOString()
          : request.aiAssessment.assessedAt,
      },
    } : {}),
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

  },

  Mutation: {
    login: withRateLimit(
      authRateLimiter,
      withValidation(
        loginSchema,
        async (_: unknown, { email, password }, ctx) => {
          return ctx.authService.login(email, password).catch(toGraphQLError);
        }
      )
    ),

    createRequest: withRateLimit(
      createRequestRateLimiter,
      withPermission(
        Permission.ACCESS_REQUEST_CREATE,
        withValidation(
          createAccessRequestSchema,
          async (_, { applicationName, justification }, ctx) => {
            const request = await ctx.accessRequestService.create(
              { applicationName, justification },
              ctx.actor!
            ).catch(toGraphQLError);
            return serializeRequest(request);
          }
        )
      )
    ),

    assessRequestRisk: async (
      _: unknown,
      { requestId }: { requestId: string },
      ctx: GraphQLContext
    ) => {
      requireActor(ctx);

      const request = await ctx.accessRequestService.getById(requestId).catch(toGraphQLError);

      const canViewAll = ctx.authorizationService.hasPermission(
        ctx.actor!,
        Permission.ACCESS_REQUEST_VIEW_ALL
      );
      if (!canViewAll && request.createdBy !== ctx.actor!.sub) {
        throw new GraphQLError('Not authorized to view this request', {
          extensions: { code: GraphQLErrorCode.FORBIDDEN },
        });
      }

      const result = await ctx.accessRequestService.getAiRiskAssessment(requestId, ctx.actor!).catch(toGraphQLError);
      return {
        ...result,
        assessedAt: result.assessedAt instanceof Date
          ? result.assessedAt.toISOString()
          : result.assessedAt,
      };
    },

    decideRequest: withPermission(
      Permission.ACCESS_REQUEST_DECIDE,
      withValidation(
        decideAccessRequestSchema.extend({ id: z.string() }),
        async (_, { id, decision, decisionNote }, ctx) => {
          // Pre-fetch the request so the role-boundary check can run before
          // any mutating business logic executes.
          const request = await ctx.accessRequestService.getById(id).catch(toGraphQLError);

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
          ).catch(toGraphQLError);
          return serializeRequest(updated);
        }
      )
    ),
  },
};
