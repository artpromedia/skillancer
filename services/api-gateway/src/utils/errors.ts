/**
 * @module @skillancer/api-gateway/utils/errors
 * Custom error classes
 */

// ============================================================================
// BASE ERROR
// ============================================================================

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

// ============================================================================
// CLIENT ERRORS (4xx)
// ============================================================================

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: unknown) {
    super(message, 'BAD_REQUEST', 400, details);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: unknown) {
    super(message, 'CONFLICT', 409, details);
    this.name = 'ConflictError';
  }
}

export class TooManyRequestsError extends AppError {
  constructor(
    message = 'Too many requests',
    public readonly retryAfter?: number
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, { retryAfter });
    this.name = 'TooManyRequestsError';
  }
}

export class ValidationError extends AppError {
  constructor(errors: Array<{ field: string; message: string }>) {
    super('Validation failed', 'VALIDATION_ERROR', 400, { errors });
    this.name = 'ValidationError';
  }
}

// ============================================================================
// SERVER ERRORS (5xx)
// ============================================================================

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 'INTERNAL_SERVER_ERROR', 500);
    this.name = 'InternalServerError';
  }
}

export class BadGatewayError extends AppError {
  constructor(message = 'Bad gateway', serviceName?: string) {
    super(message, 'BAD_GATEWAY', 502, { serviceName });
    this.name = 'BadGatewayError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service unavailable', serviceName?: string) {
    super(message, 'SERVICE_UNAVAILABLE', 503, { serviceName });
    this.name = 'ServiceUnavailableError';
  }
}

export class GatewayTimeoutError extends AppError {
  constructor(message = 'Gateway timeout', serviceName?: string) {
    super(message, 'GATEWAY_TIMEOUT', 504, { serviceName });
    this.name = 'GatewayTimeoutError';
  }
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
