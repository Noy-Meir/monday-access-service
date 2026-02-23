import rateLimit from 'express-rate-limit';

/**
 * Shared response shape for rate-limit rejections.
 * Mirrors the AppError JSON envelope so clients always receive a consistent error format.
 */
const rateLimitMessage = (detail: string) => ({
  error: { message: `Too many requests — ${detail}. Please try again later.` },
});

/**
 * General-purpose limiter applied to every route.
 * Acts as a broad backstop against accidental floods and scripted crawlers.
 * 200 req / 15 min per IP is generous for normal interactive use.
 */
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: 'draft-7', // emit the modern `RateLimit` header
  legacyHeaders: false,        // suppress deprecated `X-RateLimit-*`
  message: rateLimitMessage('you have exceeded the global request limit'),
});

/**
 * Strict limiter for POST /api/auth/login.
 */
export const authRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitMessage('too many login attempts — wait 5 minutes before retrying'),
});

/**
 * Limiter for POST /api/access-requests (submit a new request).
 * Prevents a single user from spamming the approval queue.
 */
export const createRequestRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitMessage('you are submitting access requests too quickly'),
});
