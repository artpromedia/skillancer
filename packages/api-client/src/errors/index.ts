/**
 * @module @skillancer/api-client/errors
 * Error handling utilities for API errors
 */

import type { ApiError, ValidationError } from '../http/base-client';

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Base API error class
 */
export class SkillancerApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;
  public readonly validationErrors?: ValidationError[];
  public readonly originalError?: unknown;

  constructor(error: ApiError, originalError?: unknown) {
    super(error.message);
    this.name = 'SkillancerApiError';
    this.code = error.code;
    this.status = error.status;
    this.details = error.details;
    this.validationErrors = error.validationErrors;
    this.originalError = originalError;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SkillancerApiError);
    }
  }

  toJSON(): ApiError {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      details: this.details,
      validationErrors: this.validationErrors,
    };
  }
}

/**
 * Authentication error (401)
 */
export class UnauthorizedError extends SkillancerApiError {
  constructor(message: string = 'Authentication required', originalError?: unknown) {
    super(
      {
        code: 'UNAUTHORIZED',
        message,
        status: 401,
      },
      originalError
    );
    this.name = 'UnauthorizedError';
  }
}

/**
 * Authorization error (403)
 */
export class ForbiddenError extends SkillancerApiError {
  constructor(
    message: string = 'You do not have permission to perform this action',
    originalError?: unknown
  ) {
    super(
      {
        code: 'FORBIDDEN',
        message,
        status: 403,
      },
      originalError
    );
    this.name = 'ForbiddenError';
  }
}

/**
 * Resource not found error (404)
 */
export class NotFoundError extends SkillancerApiError {
  constructor(resource?: string, originalError?: unknown) {
    super(
      {
        code: 'NOT_FOUND',
        message: resource ? `${resource} not found` : 'Resource not found',
        status: 404,
      },
      originalError
    );
    this.name = 'NotFoundError';
  }
}

/**
 * Validation error (422)
 */
export class ValidationErrorClass extends SkillancerApiError {
  constructor(
    errors: ValidationError[],
    message: string = 'Validation failed',
    originalError?: unknown
  ) {
    super(
      {
        code: 'VALIDATION_ERROR',
        message,
        status: 422,
        validationErrors: errors,
      },
      originalError
    );
    this.name = 'ValidationError';
  }

  /**
   * Get error for specific field
   */
  getFieldError(field: string): string | undefined {
    return this.validationErrors?.find((e) => e.field === field)?.message;
  }

  /**
   * Get all field errors as a map
   */
  getFieldErrors(): Record<string, string> {
    const errors: Record<string, string> = {};
    this.validationErrors?.forEach((e) => {
      errors[e.field] = e.message;
    });
    return errors;
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends SkillancerApiError {
  public readonly retryAfter?: number;

  constructor(retryAfter?: number, originalError?: unknown) {
    super(
      {
        code: 'RATE_LIMITED',
        message: retryAfter
          ? `Too many requests. Please try again in ${retryAfter} seconds.`
          : 'Too many requests. Please try again later.',
        status: 429,
        details: retryAfter ? { retryAfter } : undefined,
      },
      originalError
    );
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Server error (5xx)
 */
export class ServerError extends SkillancerApiError {
  constructor(
    message: string = 'An unexpected error occurred. Please try again later.',
    status: number = 500,
    originalError?: unknown
  ) {
    super(
      {
        code: 'SERVER_ERROR',
        message,
        status,
      },
      originalError
    );
    this.name = 'ServerError';
  }
}

/**
 * Network error (no connection)
 */
export class NetworkError extends SkillancerApiError {
  constructor(
    message: string = 'Unable to connect to the server. Please check your internet connection.',
    originalError?: unknown
  ) {
    super(
      {
        code: 'NETWORK_ERROR',
        message,
        status: 0,
      },
      originalError
    );
    this.name = 'NetworkError';
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends SkillancerApiError {
  constructor(message: string = 'Request timed out. Please try again.', originalError?: unknown) {
    super(
      {
        code: 'TIMEOUT',
        message,
        status: 0,
      },
      originalError
    );
    this.name = 'TimeoutError';
  }
}

// =============================================================================
// Error Detection & Handling
// =============================================================================

/**
 * Check if error is an API error
 */
export function isApiError(error: unknown): error is SkillancerApiError {
  return error instanceof SkillancerApiError;
}

/**
 * Check if error is an authentication error
 */
export function isUnauthorizedError(error: unknown): error is UnauthorizedError {
  return error instanceof UnauthorizedError || (isApiError(error) && error.status === 401);
}

/**
 * Check if error is a validation error
 */
export function isValidationError(error: unknown): error is ValidationErrorClass {
  return error instanceof ValidationErrorClass || (isApiError(error) && error.status === 422);
}

/**
 * Check if error is a rate limit error
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError || (isApiError(error) && error.status === 429);
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError || (isApiError(error) && error.code === 'NETWORK_ERROR');
}

/**
 * Convert unknown error to SkillancerApiError
 */
export function normalizeError(error: unknown): SkillancerApiError {
  if (error instanceof SkillancerApiError) {
    return error;
  }

  // Check if it's an object with our ApiError shape
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'status' in error
  ) {
    const apiError = error as ApiError;

    switch (apiError.status) {
      case 401:
        return new UnauthorizedError(apiError.message, error);
      case 403:
        return new ForbiddenError(apiError.message, error);
      case 404:
        return new NotFoundError(undefined, error);
      case 422:
        return new ValidationErrorClass(apiError.validationErrors || [], apiError.message, error);
      case 429:
        return new RateLimitError(apiError.details?.retryAfter as number | undefined, error);
      default:
        if (apiError.status >= 500) {
          return new ServerError(apiError.message, apiError.status, error);
        }
        return new SkillancerApiError(apiError, error);
    }
  }

  // Handle regular Error objects
  if (error instanceof Error) {
    return new SkillancerApiError(
      {
        code: 'UNKNOWN_ERROR',
        message: error.message,
        status: 0,
      },
      error
    );
  }

  // Handle unknown errors
  return new SkillancerApiError(
    {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      status: 0,
    },
    error
  );
}

// =============================================================================
// User-Friendly Error Messages
// =============================================================================

const ERROR_MESSAGES: Record<string, string> = {
  // Auth errors
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_NOT_VERIFIED: 'Please verify your email address',
  ACCOUNT_DISABLED: 'Your account has been disabled',
  MFA_REQUIRED: 'Multi-factor authentication required',
  INVALID_MFA_CODE: 'Invalid verification code',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',

  // User errors
  USER_NOT_FOUND: 'User not found',
  EMAIL_ALREADY_EXISTS: 'An account with this email already exists',
  USERNAME_TAKEN: 'This username is already taken',

  // Job errors
  JOB_NOT_FOUND: 'Job posting not found',
  JOB_CLOSED: 'This job is no longer accepting proposals',
  PROPOSAL_ALREADY_SUBMITTED: 'You have already submitted a proposal for this job',

  // Contract errors
  CONTRACT_NOT_FOUND: 'Contract not found',
  CONTRACT_COMPLETED: 'This contract has already been completed',

  // Payment errors
  PAYMENT_FAILED: 'Payment failed. Please try again or use a different payment method.',
  INSUFFICIENT_FUNDS: 'Insufficient funds in your wallet',
  INVALID_PAYMENT_METHOD: 'Invalid or expired payment method',

  // General errors
  UNAUTHORIZED: 'Please log in to continue',
  FORBIDDEN: 'You do not have permission to perform this action',
  NOT_FOUND: 'The requested resource was not found',
  VALIDATION_ERROR: 'Please check your input and try again',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  SERVER_ERROR: 'Something went wrong. Please try again later.',
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  TIMEOUT: 'Request timed out. Please try again.',
};

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return ERROR_MESSAGES[error.code] || error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

/**
 * Get error code for tracking/logging
 */
export function getErrorCode(error: unknown): string {
  if (isApiError(error)) {
    return error.code;
  }

  return 'UNKNOWN_ERROR';
}

// =============================================================================
// Error Handler Builder
// =============================================================================

export interface ErrorHandlerOptions {
  onUnauthorized?: () => void;
  onForbidden?: (message?: string) => void;
  onValidationError?: (errors: ValidationError[]) => void;
  onRateLimit?: (retryAfter?: number) => void;
  onNetworkError?: () => void;
  onServerError?: (error: SkillancerApiError) => void;
  onUnknownError?: (error: unknown) => void;
  showToast?: (message: string, type: 'error' | 'warning' | 'info') => void;
}

/**
 * Create a centralized error handler
 */
export function createErrorHandler(options: ErrorHandlerOptions) {
  return function handleError(error: unknown): void {
    const apiError = normalizeError(error);

    // Show toast notification if available
    if (options.showToast) {
      const message = getErrorMessage(apiError);
      const type = apiError.status >= 500 ? 'error' : apiError.status >= 400 ? 'warning' : 'error';
      options.showToast(message, type);
    }

    // Call specific handlers
    switch (true) {
      case isUnauthorizedError(apiError):
        options.onUnauthorized?.();
        break;
      case apiError.status === 403:
        options.onForbidden?.(apiError.message);
        break;
      case isValidationError(apiError):
        options.onValidationError?.(apiError.validationErrors || []);
        break;
      case isRateLimitError(apiError):
        options.onRateLimit?.((apiError as RateLimitError).retryAfter);
        break;
      case isNetworkError(apiError):
        options.onNetworkError?.();
        break;
      case apiError.status >= 500:
        options.onServerError?.(apiError);
        break;
      default:
        options.onUnknownError?.(error);
    }
  };
}
