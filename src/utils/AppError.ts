/**
 * Represents a known, operational error (e.g. 400, 401, 403, 404, 409).
 * Caught by the global error middleware and serialised into a structured response.
 * Distinguished from unexpected programmer errors (which produce 500).
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly isOperational = true as const;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;

    // Required when extending built-in classes in TypeScript compiled to CommonJS
    // Without this, `instanceof AppError` fails at runtime.
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
