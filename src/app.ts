import express from 'express';
import helmet from 'helmet';
import { container } from './container';
import { createAuthRouter } from './routes/auth.routes';
import { createAccessRequestRouter } from './routes/accessRequest.routes';
import { requestLoggerMiddleware } from './middleware/requestLogger.middleware';
import { generalRateLimiter } from './middleware/rateLimiter.middleware';
import cors from 'cors';

const app = express();

// ── Security Headers ──────────────────────────────────────────────────────────
// Helmet sets ~15 HTTP response headers in one call (X-Frame-Options,
// Content-Security-Policy, X-Content-Type-Options, etc.).
// Applied first so every response — including error responses — carries them.
app.use(helmet());

// ── Global Rate Limiter ───────────────────────────────────────────────────────
// Applied before route handlers so even 404 paths consume quota.
// Stricter per-endpoint limiters are registered directly on their routes.
app.use(generalRateLimiter);

// ── Body Parsing & Observability ──────────────────────────────────────────────
app.use(express.json());
app.use(requestLoggerMiddleware);

app.use(cors());

// ── Health Check (no auth required) ──────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', createAuthRouter(container.authController));
app.use(
  '/api/access-requests',
  createAccessRequestRouter(container.accessRequestController, container.authService, container.riskAssessmentController)
);

// NOTE: The 404 handler and global error handler are intentionally registered
// in src/index.ts (after the async GraphQL middleware is added) so that
// /graphql is reachable before the catch-all fires.

export default app;
