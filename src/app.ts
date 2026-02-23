import express from 'express';
import helmet from 'helmet';
import { container } from './container';
import { createAuthRouter } from './routes/auth.routes';
import { requestLoggerMiddleware } from './middleware/requestLogger.middleware';
import { generalRateLimiter } from './middleware/rateLimiter.middleware';
import { errorMiddleware } from './middleware/error.middleware';

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

// ── Health Check (no auth required) ──────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', createAuthRouter(container.authController));
app.use('/api/access-requests', container.accessRequestRouter);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: { message: 'Route not found' } });
});

// ── Global Error Handler (must be registered last) ────────────────────────────
app.use(errorMiddleware);

export default app;
