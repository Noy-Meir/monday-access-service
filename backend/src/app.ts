import express from 'express';
import helmet from 'helmet';
import { requestLoggerMiddleware } from './middleware/requestLogger.middleware';
import { generalRateLimiter } from './middleware/rateLimiter.middleware';
import cors from 'cors';

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(generalRateLimiter);

app.use(express.json());
app.use(requestLoggerMiddleware);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// NOTE: The /graphql route, 404 handler, and global error handler are
// registered in src/index.ts after the async Apollo Server setup completes.

export default app;
