/**
 * @module @skillancer/utils/errors
 * Custom error classes and error handling utilities
 */

/**
 * Base application error class
 * All custom errors should extend this class
 */
export class AppError extends Error {
  public override readonly name: string = 'AppError';
  public readonly timestamp: Date;

  /**
   * Create a new AppError
   * @param message - Error message
   * @param code - Error code for identification
   * @param statusCode - HTTP status code (default: 500)
   * @param details - Additional error details
   */
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.timestamp = new Date();

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON-serializable object
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
    };
  }

  /**
   * Create an AppError from an unknown error
   */
  static from(error: unknown, defaultCode: string = 'UNKNOWN_ERROR'): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError(error.message, defaultCode, 500, {
        originalName: error.name,
        stack: error.stack,
      });
    }

    return new AppError(String(error), defaultCode);
  }
}

/**
 * Validation error for invalid input data
 * HTTP Status: 400 Bad Request
 */
export class ValidationError extends AppError {
  public override readonly name = 'ValidationError';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

/**
 * Error for resources that cannot be found
 * HTTP Status: 404 Not Found
 */
export class NotFoundError extends AppError {
  public override readonly name = 'NotFoundError';

  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, { resource, id });
  }
}

/**
 * Error for unauthorized access (missing or invalid credentials)
 * HTTP Status: 401 Unauthorized
 */
export class UnauthorizedError extends AppError {
  public override readonly name = 'UnauthorizedError';

  constructor(message: string = 'Authentication required') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

/**
 * Error for forbidden access (valid credentials but insufficient permissions)
 * HTTP Status: 403 Forbidden
 */
export class ForbiddenError extends AppError {
  public override readonly name = 'ForbiddenError';

  constructor(message: string = 'Access denied') {
    super(message, 'FORBIDDEN', 403);
  }
}

/**
 * Error for resource conflicts (e.g., duplicate entries)
 * HTTP Status: 409 Conflict
 */
export class ConflictError extends AppError {
  public override readonly name = 'ConflictError';

  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}

/**
 * Error for rate limiting
 * HTTP Status: 429 Too Many Requests
 */
export class RateLimitError extends AppError {
  public override readonly name = 'RateLimitError';

  constructor(
    message: string = 'Too many requests',
    public readonly retryAfterMs?: number
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, { retryAfterMs });
  }
}

/**
 * Error for bad gateway responses
 * HTTP Status: 502 Bad Gateway
 */
export class BadGatewayError extends AppError {
  public override readonly name = 'BadGatewayError';

  constructor(message: string = 'Bad gateway') {
    super(message, 'BAD_GATEWAY', 502);
  }
}

/**
 * Error for service unavailability
 * HTTP Status: 503 Service Unavailable
 */
export class ServiceUnavailableError extends AppError {
  public override readonly name = 'ServiceUnavailableError';

  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 'SERVICE_UNAVAILABLE', 503);
  }
}

/**
 * Error for timeout situations
 * HTTP Status: 504 Gateway Timeout
 */
export class TimeoutError extends AppError {
  public override readonly name = 'TimeoutError';

  constructor(message: string = 'Request timed out') {
    super(message, 'TIMEOUT', 504);
  }
}

/**
 * Type guard to check if an error is an AppError
 * @param error - The error to check
 * @returns True if the error is an instance of AppError
 * @example
 * if (isAppError(error)) {
 *   console.log(error.code);
 * }
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Formatted error response
 */
export interface FormattedError {
  message: string;
  code: string;
  statusCode: number;
}

/**
 * Format any error into a consistent structure
 * @param error - The error to format
 * @returns Formatted error object
 * @example
 * const formatted = formatError(new Error('Something went wrong'));
 * // { message: 'Something went wrong', code: 'INTERNAL_ERROR', statusCode: 500 }
 */
export function formatError(error: unknown): FormattedError {
  if (isAppError(error)) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    };
  }

  return {
    message: String(error),
    code: 'UNKNOWN_ERROR',
    statusCode: 500,
  };
}

/**
 * Wrap a function to catch and transform errors
 * @param fn - The function to wrap
 * @param transformer - Optional error transformer
 * @returns Wrapped function
 */
export function withErrorHandling<T extends (...args: unknown[]) => unknown>(
  fn: T,
  transformer?: (error: unknown) => AppError
): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args);

      if (result instanceof Promise) {
        return result.catch((error) => {
          throw transformer ? transformer(error) : AppError.from(error);
        });
      }

      return result;
    } catch (error) {
      throw transformer ? transformer(error) : AppError.from(error);
    }
  }) as T;
}

/**
 * Assert a condition and throw if false
 * @param condition - The condition to check
 * @param message - Error message if condition is false
 * @param ErrorClass - Error class to throw (default: ValidationError)
 */
export function assert(
  condition: unknown,
  message: string,
  ErrorClass: new (message: string) => Error = ValidationError
): asserts condition {
  if (!condition) {
    throw new ErrorClass(message);
  }
}

/**
 * Assert a value is not null or undefined
 * @param value - The value to check
 * @param message - Error message if value is nullish
 * @returns The value (narrowed type)
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message: string = 'Value is required'
): T {
  if (value === null || value === undefined) {
    throw new ValidationError(message);
  }
  return value;
}
