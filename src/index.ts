import { Server } from 'http';
import app from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { seedData } from './seed';
import { container } from './container';

async function bootstrap(): Promise<void> {
  // Populate in-memory store before the server starts accepting connections
  await seedData(container.authService, container.accessRequestRepository);

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
