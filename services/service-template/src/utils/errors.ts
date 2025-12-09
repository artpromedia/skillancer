/**
 * @module @skillancer/service-template/utils/errors
 * Custom error classes
 */

// ============================================================================
// BASE ERROR
// ============================================================================

export interface AppErrorOptions {
  cause?: Error;
  details?: unknown;
}

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number, code: string, options: AppErrorOptions = {}) {
    super(message);
    if (options.cause) {
      this.cause = options.cause;
    }

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = options.details;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      details: this.details,
    };
  }
}

// ============================================================================
// HTTP ERRORS
// ============================================================================

/**
 * 400 Bad Request
 */
export class BadRequestError extends AppError {
  constructor(message = 'Bad request', options: AppErrorOptions = {}) {
    super(message, 400, 'BAD_REQUEST', options);
  }
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', options: AppErrorOptions = {}) {
    super(message, 401, 'UNAUTHORIZED', options);
  }
}

/**
 * 403 Forbidden
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', options: AppErrorOptions = {}) {
    super(message, 403, 'FORBIDDEN', options);
  }
}

/**
 * 404 Not Found
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', options: AppErrorOptions = {}) {
    super(message, 404, 'NOT_FOUND', options);
  }
}

/**
 * 409 Conflict
 */
export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', options: AppErrorOptions = {}) {
    super(message, 409, 'CONFLICT', options);
  }
}

/**
 * 422 Unprocessable Entity (Validation Error)
 */
export class ValidationError extends AppError {
  public readonly errors: Array<{ field: string; message: string; code?: string }>;

  constructor(
    errors: Array<{ field: string; message: string; code?: string }>,
    message = 'Validation failed',
    options: AppErrorOptions = {}
  ) {
    super(message, 422, 'VALIDATION_ERROR', { ...options, details: errors });
    this.errors = errors;
  }
}

/**
 * 429 Too Many Requests
 */
export class TooManyRequestsError extends AppError {
  public readonly retryAfter?: number;

  constructor(message = 'Too many requests', retryAfter?: number, options: AppErrorOptions = {}) {
    super(message, 429, 'TOO_MANY_REQUESTS', options);
    this.retryAfter = retryAfter;
  }
}

/**
 * 500 Internal Server Error
 */
export class InternalServerError extends AppError {
  constructor(message = 'Internal server error', options: AppErrorOptions = {}) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', options);
    this.isOperational = false;
  }
}

/**
 * 503 Service Unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service unavailable', options: AppErrorOptions = {}) {
    super(message, 503, 'SERVICE_UNAVAILABLE', options);
  }
}

// ============================================================================
// DOMAIN ERRORS
// ============================================================================

/**
 * Database operation error
 */
export class DatabaseError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, 500, 'DATABASE_ERROR', options);
    this.isOperational = false;
  }
}

/**
 * External service error
 */
export class ExternalServiceError extends AppError {
  public readonly serviceName: string;

  constructor(serviceName: string, message: string, options: AppErrorOptions = {}) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR', options);
    this.serviceName = serviceName;
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Check if error is operational (expected)
 */
export function isOperationalError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Wrap unknown error into AppError
 */
export function wrapError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalServerError(error.message, { cause: error });
  }

  return new InternalServerError(String(error));
}
