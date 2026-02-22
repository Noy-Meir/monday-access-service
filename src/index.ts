import app from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { seedData } from './seed';
import { container } from './container';

async function bootstrap(): Promise<void> {
  // Populate in-memory store before the server starts accepting connections
  await seedData(container.authService, container.accessRequestRepository);

  app.listen(config.port, () => {
    logger.info('monday-access-service started', {
      port: config.port,
      env: config.nodeEnv,
    });
  });
}

bootstrap().catch((err: unknown) => {
  logger.error('Failed to start server', { error: err });
  process.exit(1);
});
