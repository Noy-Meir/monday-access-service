import express from 'express';
import { container } from './container';
import { createAuthRouter } from './routes/auth.routes';
import { createAccessRequestRouter } from './routes/accessRequest.routes';
import { requestLoggerMiddleware } from './middleware/requestLogger.middleware';
import { errorMiddleware } from './middleware/error.middleware';

const app = express();

// ── Global Middleware ─────────────────────────────────────────────────────────
app.use(express.json());
app.use(requestLoggerMiddleware);

// ── Health Check (no auth required) ──────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', createAuthRouter(container.authController));
app.use(
  '/api/access-requests',
  createAccessRequestRouter(container.accessRequestController, container.authService)
);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: { message: 'Route not found' } });
});

// ── Global Error Handler (must be registered last) ────────────────────────────
app.use(errorMiddleware);

export default app;
