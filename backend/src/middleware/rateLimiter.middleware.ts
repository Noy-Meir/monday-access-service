import rateLimit from 'express-rate-limit';

/**
 * General-purpose limiter applied to every route.
 * Acts as a broad backstop against accidental floods and scripted crawlers.
 */
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: 'draft-7', // emit the modern `RateLimit` header
  legacyHeaders: false,        // suppress deprecated `X-RateLimit-*`
  message: { error: { message: 'Too many requests — you have exceeded the global request limit. Please try again later.' } },
});

/**
 * Strict limiter for the login mutation.
 *
 * Uses a next(error) handler instead of a direct res. send so that the
 * withRateLimit resolver wrapper can detect rejection via the Promise and
 * convert it into a GraphQLError with code TOO_MANY_REQUESTS.
 */
export const authRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new Error('Too many login attempts — wait 5 minutes before retrying'));
  },
});

/**
 * Limiter for the createRequest mutation.
 * Prevents a single user from spamming the approval queue.
 *
 * Same next(error) pattern as authRateLimiter — consumed by withRateLimit.
 */
export const createRequestRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new Error('You are submitting access requests too quickly'));
  },
});
