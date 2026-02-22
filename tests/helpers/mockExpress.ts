import { NextFunction, Request, Response } from 'express';
import { TokenPayload } from '../../src/models/AccessRequest';

export function createMockRequest(overrides: {
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  query?: Record<string, string>;
  user?: TokenPayload;
} = {}): Request {
  return {
    body: overrides.body ?? {},
    params: overrides.params ?? {},
    query: overrides.query ?? {},
    headers: {},
    user: overrides.user,
  } as unknown as Request;
}

export function createMockResponse(): jest.Mocked<Response> {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as jest.Mocked<Response>;

  (res.status as jest.Mock).mockReturnValue(res);
  (res.json as jest.Mock).mockReturnValue(res);

  return res;
}

export function createMockNext(): jest.MockedFunction<NextFunction> {
  return jest.fn() as jest.MockedFunction<NextFunction>;
}
