import { Server } from 'http';
import { ApolloServer, HeaderMap } from '@apollo/server';
import type { Request, Response, NextFunction } from 'express';
import app from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { seedData } from './seed';
import { container } from './container';
import { typeDefs } from './graphql/typeDefs';
import { resolvers } from './graphql/resolvers';
import { errorMiddleware } from './middleware/error.middleware';
import type { GraphQLContext } from './graphql/context';

async function bootstrap(): Promise<void> {
  // Populate in-memory store before the server starts accepting connections
  await seedData(container.userRepository, container.accessRequestRepository);

  // ── GraphQL / Apollo Server ─────────────────────────────────────────────
  const apolloServer = new ApolloServer<GraphQLContext>({ typeDefs, resolvers });
  await apolloServer.start();

  // Manual Express handler — equivalent to expressMiddleware() from
  // @apollo/server/express4, but avoids the ESM/CJS interop issue that arises
  // when tsx (CJS mode) tries to require() an "type":"module" subpath package.
  app.use('/graphql', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // ── Build context (JWT extraction) ────────────────────────────────────
      const authHeader = req.headers.authorization;
      let actor: GraphQLContext['actor'] = null;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
          actor = container.authService.verifyToken(token);
        } catch {
          // Invalid token — actor stays null; resolvers that need auth will throw.
        }
      }

      // ── Convert Express request headers to Apollo HeaderMap ───────────────
      const headers = new HeaderMap();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) {
          headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        }
      }

      // ── Query string ──────────────────────────────────────────────────────
      const reqUrl = req.url ?? '/';
      const searchIndex = reqUrl.indexOf('?');
      const search = searchIndex !== -1 ? reqUrl.slice(searchIndex) : '';

      // ── Execute ───────────────────────────────────────────────────────────
      const result = await apolloServer.executeHTTPGraphQLRequest({
        httpGraphQLRequest: {
          method: req.method.toUpperCase(),
          headers,
          search,
          body: req.body,
        },
        context: async () => ({
          req,
          res,
          actor,
          accessRequestService: container.accessRequestService,
          authService: container.authService,
          authorizationService: container.authorizationService,
          riskAssessmentAgent: container.riskAssessmentAgent,
        }),
      });

      // ── Send response ─────────────────────────────────────────────────────
      for (const [key, value] of result.headers) {
        res.setHeader(key, value);
      }
      res.statusCode = result.status ?? 200;

      if (result.body.kind === 'complete') {
        res.send(result.body.string);
      } else {
        for await (const chunk of result.body.asyncIterator) {
          res.write(chunk);
        }
        res.end();
      }
    } catch (e) {
      next(e);
    }
  });

  logger.info('GraphQL endpoint ready', { path: '/graphql' });

  // ── 404 + Error handlers (must come after all routes, including /graphql) ──
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: { message: 'Route not found' } });
  });
  app.use(errorMiddleware);

  const server: Server = app.listen(config.port, () => {
    logger.info('monday-access-service started', {
      port: config.port,
      env: config.nodeEnv,
    });
  });

  registerShutdownHandlers(server);
}

/**
 * Registers SIGTERM and SIGINT handlers for graceful shutdown.
 *
 * Shutdown sequence:
 *   1. Stop accepting new TCP connections (server.close).
 *   2. Wait for in-flight requests to drain naturally.
 *   3. Flush Winston transports so no log lines are dropped.
 *   4. Exit with code 0.
 *
 * A 10-second watchdog fires if draining stalls (e.g. a client holding a
 * keep-alive connection open). It exits with code 1 to signal an unclean stop
 * to the container orchestrator (Kubernetes, ECS, etc.).
 */
function registerShutdownHandlers(server: Server): void {
  const shutdown = (signal: string): void => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    // Watchdog: force-exit if drain takes longer than 10 s.
    // .unref() prevents the timer from keeping the event loop alive by itself.
    const watchdog = setTimeout(() => {
      logger.error('Graceful shutdown timed out after 10 s. Forcing exit.', { signal });
      process.exit(1);
    }, 10_000).unref();

    server.close(() => {
      clearTimeout(watchdog);
      logger.info('HTTP server closed — no longer accepting new connections.');

      // Give Winston one more I/O tick to flush its internal write buffers
      // before we hand control back to the OS.
      setImmediate(() => process.exit(0));
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

bootstrap().catch((err: unknown) => {
  logger.error('Failed to start server', { error: err });
  process.exit(1);
});
