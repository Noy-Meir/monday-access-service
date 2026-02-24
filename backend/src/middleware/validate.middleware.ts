import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from '../utils/AppError';

/**
 * Factory that returns a request body validation middleware using a Zod schema.
 * On success, replaces req. body with the parsed (coerced + stripped) output.
 * On failure, passes a structured AppError to the global error handler.
 */
export function createValidateMiddleware(schema: ZodSchema) {
  return function validate(req: Request, _res: Response, next: NextFunction): void {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = (result.error as ZodError).errors.map((e) => ({
        field: e.path.join('.') || 'body',
        message: e.message,
      }));
      next(new AppError('Validation failed', 400, details));
      return;
    }

    req.body = result.data;
    next();
  };
}
