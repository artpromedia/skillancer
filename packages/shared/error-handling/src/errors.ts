/**
 * @module @skillancer/error-handling/errors
 * Custom error classes for Skillancer applications
 */

import {
  ErrorCode,
  ErrorMessage,
  type ErrorCodeValue,
} from './constants.js';

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * Field-level validation error
 */
export interface FieldError {
  field: string;
  message: string;
  code?: string;
  value?: unknown;
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

/**
 * Base error details interface
 */
export interface ErrorDetails {
  [key: string]: unknown;
}

/**
 * Serialized error format for logging/transmission
 */
export interface SerializedError {
  name: string;
  message: string;
  code: ErrorCodeValue;
  statusCode: number;
  isOperational: boolean;
  details?: ErrorDetails;
  stack?: string;
  cause?: SerializedError;
  timestamp: string;
  requestId?: string;
}

/**
 * API error response from the server
 */
export interface ApiErrorResponse {
  error?: {
    code?: string;
    message?: string;
    details?: ErrorDetails;
    fields?: FieldError[];
  };
  message?: string;
  statusCode?: number;
  code?: string;
}

// =============================================================================
// BASE API ERROR
// =============================================================================

/**
 * Base error class for all API-related errors
 *
 * @example
 * ```typescript
 * throw new ApiError('Something went wrong', {
 *   code: ErrorCode.SERVER_INTERNAL,
 *   statusCode: 500,
 *   details: { endpoint: '/api/users' }
 * });
 * ```
 */
export class ApiError extends Error {
  /** Error name that identifies the error type */
  public override name: string;

  /** Error code for programmatic handling */
  public readonly code: ErrorCodeValue;

  /** HTTP status code */
  public readonly statusCode: number;

  /**
   * Whether this error is operational (expected) vs programmer error
   * Operational errors are expected in normal operation (e.g., validation failures)
   * Non-operational errors indicate bugs that need fixing
   */
  public readonly isOperational: boolean;

  /** Additional error details */
  public readonly details?: ErrorDetails;

  /** Original error that caused this error */
  public override readonly cause?: Error;

  /** Request ID for tracing */
  public readonly requestId?: string;

  /** Timestamp when error occurred */
  public readonly timestamp: Date;

  constructor(
    message: string,
    options?: {
      code?: ErrorCodeValue;
      statusCode?: number;
      isOperational?: boolean;
      details?: ErrorDetails;
      cause?: Error;
      requestId?: string;
    }
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = options?.code ?? ErrorCode.CLIENT_UNKNOWN;
    this.statusCode = options?.statusCode ?? 500;
    this.isOperational = options?.isOperational ?? true;
    this.details = options?.details;
    this.cause = options?.cause;
    this.requestId = options?.requestId;
    this.timestamp = new Date();

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get user-friendly error message from constants
   */
  getUserMessage(): string {
    return ErrorMessage[this.code] || this.message;
  }

  /**
   * Serialize error for logging or API response
   */
  serialize(includeStack = false): SerializedError {
    const serialized: SerializedError = {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      timestamp: this.timestamp.toISOString(),
    };

    if (this.details) {
      serialized.details = this.details;
    }

    if (this.requestId) {
      serialized.requestId = this.requestId;
    }

    if (includeStack && this.stack) {
      serialized.stack = this.stack;
    }

    if (this.cause instanceof ApiError) {
      serialized.cause = this.cause.serialize(includeStack);
    }

    return serialized;
  }

  /**
   * Create an ApiError from a plain object (e.g., from API response)
   */
  static fromObject(obj: Partial<SerializedError>): ApiError {
    return new ApiError(obj.message || 'Unknown error', {
      code: obj.code,
      statusCode: obj.statusCode,
      details: obj.details,
      requestId: obj.requestId,
    });
  }

  /**
   * Check if an error is an ApiError
   */
  static isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
  }
}

// =============================================================================
// AUTHENTICATION ERROR
// =============================================================================

/**
 * Error for authentication failures (401 Unauthorized)
 *
 * @example
 * ```typescript
 * throw new AuthenticationError('Token expired', {
 *   code: ErrorCode.AUTH_TOKEN_EXPIRED
 * });
 * ```
 */
export class AuthenticationError extends ApiError {
  constructor(
    message = 'Authentication required',
    options?: {
      code?: ErrorCodeValue;
      details?: ErrorDetails;
      cause?: Error;
      requestId?: string;
    }
  ) {
    super(message, {
      code: options?.code ?? ErrorCode.AUTH_TOKEN_INVALID,
      statusCode: 401,
      isOperational: true,
      details: options?.details,
      cause: options?.cause,
      requestId: options?.requestId,
    });
    this.name = 'AuthenticationError';
  }

  /**
   * Create error for expired token
   */
  static tokenExpired(options?: { details?: ErrorDetails; requestId?: string }): AuthenticationError {
    return new AuthenticationError('Token expired', {
      code: ErrorCode.AUTH_TOKEN_EXPIRED,
      ...options,
    });
  }

  /**
   * Create error for invalid token
   */
  static tokenInvalid(options?: { details?: ErrorDetails; requestId?: string }): AuthenticationError {
    return new AuthenticationError('Invalid token', {
      code: ErrorCode.AUTH_TOKEN_INVALID,
      ...options,
    });
  }

  /**
   * Create error for missing token
   */
  static tokenMissing(options?: { details?: ErrorDetails; requestId?: string }): AuthenticationError {
    return new AuthenticationError('Token missing', {
      code: ErrorCode.AUTH_TOKEN_MISSING,
      ...options,
    });
  }

  /**
   * Create error for invalid credentials
   */
  static invalidCredentials(options?: { details?: ErrorDetails; requestId?: string }): AuthenticationError {
    return new AuthenticationError('Invalid credentials', {
      code: ErrorCode.AUTH_INVALID_CREDENTIALS,
      ...options,
    });
  }
}

// =============================================================================
// AUTHORIZATION ERROR
// =============================================================================

/**
 * Error for authorization failures (403 Forbidden)
 *
 * @example
 * ```typescript
 * throw new AuthorizationError('Insufficient permissions', {
 *   code: ErrorCode.AUTHZ_INSUFFICIENT_PERMISSIONS,
 *   details: { requiredRole: 'admin' }
 * });
 * ```
 */
export class AuthorizationError extends ApiError {
  constructor(
    message = 'Access denied',
    options?: {
      code?: ErrorCodeValue;
      details?: ErrorDetails;
      cause?: Error;
      requestId?: string;
    }
  ) {
    super(message, {
      code: options?.code ?? ErrorCode.AUTHZ_FORBIDDEN,
      statusCode: 403,
      isOperational: true,
      details: options?.details,
      cause: options?.cause,
      requestId: options?.requestId,
    });
    this.name = 'AuthorizationError';
  }

  /**
   * Create error for insufficient permissions
   */
  static insufficientPermissions(
    requiredPermissions: string[],
    options?: { details?: ErrorDetails; requestId?: string }
  ): AuthorizationError {
    return new AuthorizationError('Insufficient permissions', {
      code: ErrorCode.AUTHZ_INSUFFICIENT_PERMISSIONS,
      details: { requiredPermissions, ...options?.details },
      requestId: options?.requestId,
    });
  }

  /**
   * Create error for required role
   */
  static roleRequired(
    requiredRole: string,
    options?: { details?: ErrorDetails; requestId?: string }
  ): AuthorizationError {
    return new AuthorizationError(`Role '${requiredRole}' required`, {
      code: ErrorCode.AUTHZ_ROLE_REQUIRED,
      details: { requiredRole, ...options?.details },
      requestId: options?.requestId,
    });
  }
}

// =============================================================================
// VALIDATION ERROR
// =============================================================================

/**
 * Error for validation failures (400 Bad Request)
 *
 * @example
 * ```typescript
 * throw new ValidationError('Invalid input', {
 *   fields: [
 *     { field: 'email', message: 'Invalid email format' }
 *   ]
 * });
 * ```
 */
export class ValidationError extends ApiError {
  /** Field-level validation errors */
  public readonly fields?: FieldError[];

  constructor(
    message = 'Validation failed',
    options?: {
      code?: ErrorCodeValue;
      fields?: FieldError[];
      details?: ErrorDetails;
      cause?: Error;
      requestId?: string;
    }
  ) {
    super(message, {
      code: options?.code ?? ErrorCode.VAL_INVALID_INPUT,
      statusCode: 400,
      isOperational: true,
      details: options?.details,
      cause: options?.cause,
      requestId: options?.requestId,
    });
    this.name = 'ValidationError';
    this.fields = options?.fields;
  }

  /**
   * Get error message for a specific field
   */
  getFieldError(fieldName: string): string | undefined {
    const field = this.fields?.find((f) => f.field === fieldName);
    return field?.message;
  }

  /**
   * Get all field errors as a map
   */
  getErrorMap(): Record<string, string> {
    const map: Record<string, string> = {};
    if (this.fields) {
      for (const field of this.fields) {
        map[field.field] = field.message;
      }
    }
    return map;
  }

  /**
   * Check if a specific field has an error
   */
  hasFieldError(fieldName: string): boolean {
    return this.fields?.some((f) => f.field === fieldName) ?? false;
  }

  /**
   * Create validation error for missing required field
   */
  static missingField(
    fieldName: string,
    options?: { requestId?: string }
  ): ValidationError {
    return new ValidationError(`${fieldName} is required`, {
      code: ErrorCode.VAL_MISSING_FIELD,
      fields: [{ field: fieldName, message: `${fieldName} is required` }],
      requestId: options?.requestId,
    });
  }

  /**
   * Create validation error for invalid format
   */
  static invalidFormat(
    fieldName: string,
    expectedFormat: string,
    options?: { requestId?: string }
  ): ValidationError {
    return new ValidationError(`Invalid ${fieldName} format`, {
      code: ErrorCode.VAL_INVALID_FORMAT,
      fields: [
        {
          field: fieldName,
          message: `Expected format: ${expectedFormat}`,
        },
      ],
      requestId: options?.requestId,
    });
  }
}

// =============================================================================
// NOT FOUND ERROR
// =============================================================================

/**
 * Error for resource not found (404 Not Found)
 *
 * @example
 * ```typescript
 * throw new NotFoundError('User not found', {
 *   details: { userId: '123' }
 * });
 * ```
 */
export class NotFoundError extends ApiError {
  constructor(
    message = 'Resource not found',
    options?: {
      code?: ErrorCodeValue;
      details?: ErrorDetails;
      cause?: Error;
      requestId?: string;
    }
  ) {
    super(message, {
      code: options?.code ?? ErrorCode.NOT_FOUND_RESOURCE,
      statusCode: 404,
      isOperational: true,
      details: options?.details,
      cause: options?.cause,
      requestId: options?.requestId,
    });
    this.name = 'NotFoundError';
  }

  /**
   * Create error for resource not found
   */
  static resource(
    resourceType: string,
    resourceId: string,
    options?: { requestId?: string }
  ): NotFoundError {
    return new NotFoundError(`${resourceType} not found`, {
      code: ErrorCode.NOT_FOUND_RESOURCE,
      details: { resourceType, resourceId },
      requestId: options?.requestId,
    });
  }

  /**
   * Create error for user not found
   */
  static user(
    userId: string,
    options?: { requestId?: string }
  ): NotFoundError {
    return new NotFoundError('User not found', {
      code: ErrorCode.NOT_FOUND_USER,
      details: { userId },
      requestId: options?.requestId,
    });
  }
}

// =============================================================================
// RATE LIMIT ERROR
// =============================================================================

/**
 * Error for rate limiting (429 Too Many Requests)
 *
 * @example
 * ```typescript
 * throw new RateLimitError('Too many requests', {
 *   rateLimit: { limit: 100, remaining: 0, reset: new Date(), retryAfter: 60 }
 * });
 * ```
 */
export class RateLimitError extends ApiError {
  /** Rate limit information */
  public readonly rateLimit?: RateLimitInfo;

  constructor(
    message = 'Rate limit exceeded',
    options?: {
      code?: ErrorCodeValue;
      rateLimit?: RateLimitInfo;
      details?: ErrorDetails;
      cause?: Error;
      requestId?: string;
    }
  ) {
    super(message, {
      code: options?.code ?? ErrorCode.RATE_LIMIT_EXCEEDED,
      statusCode: 429,
      isOperational: true,
      details: options?.details,
      cause: options?.cause,
      requestId: options?.requestId,
    });
    this.name = 'RateLimitError';
    this.rateLimit = options?.rateLimit;
  }

  /**
   * Get seconds until rate limit resets
   */
  getRetryAfter(): number {
    if (this.rateLimit?.retryAfter) {
      return this.rateLimit.retryAfter;
    }
    if (this.rateLimit?.reset) {
      return Math.max(0, Math.ceil((this.rateLimit.reset.getTime() - Date.now()) / 1000));
    }
    return 60; // Default to 60 seconds
  }
}

// =============================================================================
// NETWORK ERROR
// =============================================================================

/**
 * Error for network-related failures
 *
 * @example
 * ```typescript
 * throw new NetworkError('Connection failed', {
 *   code: ErrorCode.NETWORK_TIMEOUT
 * });
 * ```
 */
export class NetworkError extends ApiError {
  constructor(
    message = 'Network error',
    options?: {
      code?: ErrorCodeValue;
      details?: ErrorDetails;
      cause?: Error;
      requestId?: string;
    }
  ) {
    super(message, {
      code: options?.code ?? ErrorCode.NETWORK_DISCONNECTED,
      statusCode: 0,
      isOperational: true,
      details: options?.details,
      cause: options?.cause,
      requestId: options?.requestId,
    });
    this.name = 'NetworkError';
  }

  /**
   * Create error for timeout
   */
  static timeout(
    timeoutMs?: number,
    options?: { details?: ErrorDetails; requestId?: string }
  ): NetworkError {
    return new NetworkError('Request timed out', {
      code: ErrorCode.NETWORK_TIMEOUT,
      details: { timeoutMs, ...options?.details },
      requestId: options?.requestId,
    });
  }

  /**
   * Create error for offline state
   */
  static offline(options?: { requestId?: string }): NetworkError {
    return new NetworkError('No internet connection', {
      code: ErrorCode.NETWORK_DISCONNECTED,
      requestId: options?.requestId,
    });
  }
}

// =============================================================================
// SERVER ERROR
// =============================================================================

/**
 * Error for server-side failures (500+)
 *
 * @example
 * ```typescript
 * throw new ServerError('Internal server error', {
 *   code: ErrorCode.SERVER_INTERNAL
 * });
 * ```
 */
export class ServerError extends ApiError {
  constructor(
    message = 'Server error',
    options?: {
      code?: ErrorCodeValue;
      statusCode?: number;
      details?: ErrorDetails;
      cause?: Error;
      requestId?: string;
    }
  ) {
    super(message, {
      code: options?.code ?? ErrorCode.SERVER_INTERNAL,
      statusCode: options?.statusCode ?? 500,
      isOperational: true,
      details: options?.details,
      cause: options?.cause,
      requestId: options?.requestId,
    });
    this.name = 'ServerError';
  }

  /**
   * Create error for service unavailable
   */
  static unavailable(options?: { details?: ErrorDetails; requestId?: string }): ServerError {
    return new ServerError('Service unavailable', {
      code: ErrorCode.SERVER_UNAVAILABLE,
      statusCode: 503,
      ...options,
    });
  }

  /**
   * Create error for maintenance mode
   */
  static maintenance(options?: { details?: ErrorDetails; requestId?: string }): ServerError {
    return new ServerError('System under maintenance', {
      code: ErrorCode.SERVER_MAINTENANCE,
      statusCode: 503,
      ...options,
    });
  }
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if an error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Type guard to check if an error is an AuthenticationError
 */
export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

/**
 * Type guard to check if an error is an AuthorizationError
 */
export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

/**
 * Type guard to check if an error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard to check if an error is a NotFoundError
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

/**
 * Type guard to check if an error is a RateLimitError
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

/**
 * Type guard to check if an error is a NetworkError
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * Type guard to check if an error is a ServerError
 */
export function isServerError(error: unknown): error is ServerError {
  return error instanceof ServerError;
}
