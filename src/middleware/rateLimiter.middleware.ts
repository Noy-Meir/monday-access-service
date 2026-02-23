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
 * 10 attempts per 15 min defends against credential-stuffing attacks
 * without locking out a user who misremembers their password a few times.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitMessage('too many login attempts — wait 15 minutes before retrying'),
});

/**
 * Limiter for POST /api/access-requests (submit a new request).
 * Prevents a single user from spamming the approval queue.
 * 30 submissions per 15 min is more than enough for legitimate use.
 */
export const createRequestRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitMessage('you are submitting access requests too quickly'),
});
