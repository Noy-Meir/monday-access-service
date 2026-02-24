import { EventEmitter } from 'events';
import { Request, Response, NextFunction } from 'express';
import { requestLoggerMiddleware } from '../../src/middleware/requestLogger.middleware';
import { mockEmployeePayload } from '../helpers/fixtures';

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Import after mocking so we get the mocked version
import { logger } from '../../src/utils/logger';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Creates a minimal Request-like object with the properties the middleware
 * actually uses: method, path, ip, body, get(), and optionally user.
 */
function buildRequest(
  props: { method: string; path: string; user?: unknown; body?: unknown } = { method: 'GET', path: '/' }
): Request {
  return {
    method: props.method,
    path:   props.path,
    ip:     '127.0.0.1',
    body:   props.body ?? {},
    user:   props.user,
    get:    jest.fn().mockReturnValue(undefined),
  } as unknown as Request;
}

/**
 * Creates a minimal Response-like object that supports res.on('finish', …).
 * Returns both the fake response and an emit helper so tests can trigger
 * the 'finish' event manually.
 */
function buildResponse(statusCode: number): {
  res: Response;
  finish: () => void;
} {
  const emitter = new EventEmitter();
  const res = {
    statusCode,
    on: (event: string, listener: (...args: unknown[]) => void) => {
      emitter.on(event, listener);
    },
  } as unknown as Response;

  return { res, finish: () => emitter.emit('finish') };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('requestLoggerMiddleware', () => {
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    next = jest.fn();
  });

  it('calls next() immediately (before the response finishes)', () => {
    const req = buildRequest({ method: 'GET', path: '/health' });
    const { res } = buildResponse(200);

    requestLoggerMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  // ── Log level selection ────────────────────────────────────────────────────

  it('uses logger.info for 2xx responses', () => {
    const req = buildRequest({ method: 'GET', path: '/api/access-requests', user: mockEmployeePayload });
    const { res, finish } = buildResponse(200);

    requestLoggerMiddleware(req, res, next);
    finish();

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('GET'), expect.objectContaining({ statusCode: 200 }));
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('uses logger.warn for 4xx responses', () => {
    const req = buildRequest({ method: 'PATCH', path: '/api/access-requests/1/decision', user: mockEmployeePayload });
    const { res, finish } = buildResponse(403);

    requestLoggerMiddleware(req, res, next);
    finish();

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('PATCH'), expect.objectContaining({ statusCode: 403 }));
    expect(logger.info).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ statusCode: 403 }));
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('uses logger.warn for 404 responses', () => {
    const req = buildRequest({ method: 'GET', path: '/api/access-requests/unknown-id', user: mockEmployeePayload });
    const { res, finish } = buildResponse(404);

    requestLoggerMiddleware(req, res, next);
    finish();

    expect(logger.warn).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ statusCode: 404 }));
  });

  it('uses logger.error for 5xx responses', () => {
    const req = buildRequest({ method: 'POST', path: '/api/access-requests', user: mockEmployeePayload });
    const { res, finish } = buildResponse(500);

    requestLoggerMiddleware(req, res, next);
    finish();

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('POST'), expect.objectContaining({ statusCode: 500 }));
    expect(logger.info).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ statusCode: 500 }));
    expect(logger.warn).not.toHaveBeenCalled();
  });

  // ── Log entry shape ────────────────────────────────────────────────────────

  it('includes method, path, statusCode, and durationMs in the log entry', () => {
    const req = buildRequest({ method: 'GET', path: '/api/access-requests', user: mockEmployeePayload });
    const { res, finish } = buildResponse(200);

    requestLoggerMiddleware(req, res, next);
    finish();

    expect(logger.info).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: 'GET',
        path: '/api/access-requests',
        statusCode: 200,
        durationMs: expect.any(Number),
      })
    );
  });

  it('logs the authenticated userId from req.user', () => {
    const req = buildRequest({ method: 'GET', path: '/api/access-requests', user: mockEmployeePayload });
    const { res, finish } = buildResponse(200);

    requestLoggerMiddleware(req, res, next);
    finish();

    expect(logger.info).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: mockEmployeePayload.sub })
    );
  });

  it('logs "anonymous" when no user is present on the request', () => {
    const req = buildRequest({ method: 'GET', path: '/health' });
    const { res, finish } = buildResponse(200);

    requestLoggerMiddleware(req, res, next);
    finish();

    expect(logger.info).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'anonymous' })
    );
  });
});
