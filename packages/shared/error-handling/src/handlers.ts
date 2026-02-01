/**
 * @module @skillancer/error-handling/handlers
 * Error handling utilities for parsing, transforming, and managing errors
 */

import type { AxiosError } from 'axios';
import {
  ErrorCode,
  HttpStatusToErrorCode,
  RetryableErrorCodes,
  DefaultRetryConfig,
  type ErrorCodeValue,
} from './constants.js';
import {
  ApiError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  NetworkError,
  ServerError,
  type ApiErrorResponse,
  type SerializedError,
} from './errors.js';

// =============================================================================
// ERROR PARSING
// =============================================================================

/**
 * Parse any error into an ApiError
 *
 * @example
 * ```typescript
 * try {
 *   await apiCall();
 * } catch (error) {
 *   const apiError = parseApiError(error);
 *   console.log(apiError.getUserMessage());
 * }
 * ```
 */
export function parseApiError(error: unknown): ApiError {
  // Already an ApiError
  if (error instanceof ApiError) {
    return error;
  }

  // Axios error
  if (isAxiosError(error)) {
    return parseAxiosError(error);
  }

  // Fetch Response
  if (error instanceof Response) {
    return parseFetchResponse(error);
  }

  // Standard Error
  if (error instanceof Error) {
    return new ApiError(error.message, {
      code: ErrorCode.CLIENT_UNKNOWN,
      cause: error,
    });
  }

  // String error
  if (typeof error === 'string') {
    return new ApiError(error, {
      code: ErrorCode.CLIENT_UNKNOWN,
    });
  }

  // Object with message
  if (error && typeof error === 'object' && 'message' in error) {
    return new ApiError(String((error as { message: unknown }).message), {
      code: ErrorCode.CLIENT_UNKNOWN,
    });
  }

  // Unknown error
  return new ApiError('An unknown error occurred', {
    code: ErrorCode.CLIENT_UNKNOWN,
    details: { originalError: String(error) },
  });
}

/**
 * Type guard for Axios errors
 */
function isAxiosError(error: unknown): error is AxiosError<ApiErrorResponse> {
  return (
    error !== null &&
    typeof error === 'object' &&
    'isAxiosError' in error &&
    (error as AxiosError).isAxiosError === true
  );
}

/**
 * Parse an Axios error into an ApiError
 */
export function parseAxiosError(error: AxiosError<ApiErrorResponse>): ApiError {
  const response = error.response;
  const requestId = response?.headers?.['x-request-id'] as string | undefined;

  // No response - network error
  if (!response) {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return new NetworkError('Request timed out', {
        code: ErrorCode.NETWORK_TIMEOUT,
        cause: error,
        requestId,
      });
    }

    if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
      return new NetworkError('Network error', {
        code: ErrorCode.NETWORK_DISCONNECTED,
        cause: error,
        requestId,
      });
    }

    return new NetworkError(error.message || 'Network error', {
      code: ErrorCode.NETWORK_DISCONNECTED,
      cause: error,
      requestId,
    });
  }

  const status = response.status;
  const data = response.data;
  const errorData = data?.error || data;

  // Extract message and code from response
  const message = errorData?.message || data?.message || error.message || 'Request failed';
  const code =
    (errorData?.code as ErrorCodeValue) ||
    HttpStatusToErrorCode[status] ||
    ErrorCode.CLIENT_UNKNOWN;

  // Create appropriate error type based on status
  switch (status) {
    case 401:
      return new AuthenticationError(message, {
        code,
        details: errorData?.details,
        cause: error,
        requestId,
      });

    case 403:
      return new AuthorizationError(message, {
        code,
        details: errorData?.details,
        cause: error,
        requestId,
      });

    case 400:
    case 422:
      return new ValidationError(message, {
        code,
        fields: errorData?.fields,
        details: errorData?.details,
        cause: error,
        requestId,
      });

    case 404:
      return new NotFoundError(message, {
        code,
        details: errorData?.details,
        cause: error,
        requestId,
      });

    case 429: {
      const rateLimitInfo = {
        limit: Number.parseInt(response.headers['x-ratelimit-limit'] || '0', 10),
        remaining: Number.parseInt(response.headers['x-ratelimit-remaining'] || '0', 10),
        reset: new Date(Number.parseInt(response.headers['x-ratelimit-reset'] || '0', 10) * 1000),
        retryAfter: Number.parseInt(response.headers['retry-after'] || '60', 10),
      };
      return new RateLimitError(message, {
        code,
        rateLimit: rateLimitInfo,
        details: errorData?.details,
        cause: error,
        requestId,
      });
    }

    case 500:
    case 502:
    case 503:
    case 504:
      return new ServerError(message, {
        code,
        statusCode: status,
        details: errorData?.details,
        cause: error,
        requestId,
      });

    default:
      return new ApiError(message, {
        code,
        statusCode: status,
        details: errorData?.details,
        cause: error,
        requestId,
      });
  }
}

/**
 * Parse a Fetch Response error
 */
export async function parseFetchResponse(response: Response): Promise<ApiError> {
  const requestId = response.headers.get('x-request-id') || undefined;
  const status = response.status;

  let data: ApiErrorResponse | null = null;
  try {
    data = await response.json();
  } catch {
    // Response is not JSON
  }

  const errorData = data?.error || data;
  const message = errorData?.message || data?.message || response.statusText || 'Request failed';
  const code =
    (errorData?.code as ErrorCodeValue) ||
    HttpStatusToErrorCode[status] ||
    ErrorCode.CLIENT_UNKNOWN;

  switch (status) {
    case 401:
      return new AuthenticationError(message, { code, details: errorData?.details, requestId });

    case 403:
      return new AuthorizationError(message, { code, details: errorData?.details, requestId });

    case 400:
    case 422:
      return new ValidationError(message, {
        code,
        fields: errorData?.fields,
        details: errorData?.details,
        requestId,
      });

    case 404:
      return new NotFoundError(message, { code, details: errorData?.details, requestId });

    case 429:
      return new RateLimitError(message, {
        code,
        rateLimit: {
          limit: Number.parseInt(response.headers.get('x-ratelimit-limit') || '0', 10),
          remaining: Number.parseInt(response.headers.get('x-ratelimit-remaining') || '0', 10),
          reset: new Date(
            Number.parseInt(response.headers.get('x-ratelimit-reset') || '0', 10) * 1000
          ),
          retryAfter: Number.parseInt(response.headers.get('retry-after') || '60', 10),
        },
        details: errorData?.details,
        requestId,
      });

    case 500:
    case 502:
    case 503:
    case 504:
      return new ServerError(message, {
        code,
        statusCode: status,
        details: errorData?.details,
        requestId,
      });

    default:
      return new ApiError(message, {
        code,
        statusCode: status,
        details: errorData?.details,
        requestId,
      });
  }
}

// =============================================================================
// ERROR UTILITIES
// =============================================================================

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.getUserMessage();
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred';
}

/**
 * Get error code from any error
 */
export function getErrorCode(error: unknown): ErrorCodeValue {
  if (error instanceof ApiError) {
    return error.code;
  }

  return ErrorCode.CLIENT_UNKNOWN;
}

/**
 * Get HTTP status code from error
 */
export function getStatusCode(error: unknown): number {
  if (error instanceof ApiError) {
    return error.statusCode;
  }

  return 500;
}

/**
 * Get validation field errors from error
 */
export function getValidationErrors(error: unknown): Record<string, string> {
  if (error instanceof ValidationError) {
    return error.getErrorMap();
  }

  return {};
}

/**
 * Check if error is retryable
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof ApiError) {
    return RetryableErrorCodes.has(error.code);
  }

  return false;
}

/**
 * Calculate retry delay with exponential backoff
 */
export function getRetryDelay(attempt: number, config = DefaultRetryConfig): number {
  const delay = Math.min(
    config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
    config.maxDelayMs
  );

  // Add jitter (±10%)
  const jitter = delay * 0.1;
  return Math.floor(delay + (Math.random() * 2 - 1) * jitter);
}

/**
 * Check if should retry based on attempt count and error
 */
export function shouldRetry(
  error: unknown,
  attempt: number,
  maxRetries = DefaultRetryConfig.maxRetries
): boolean {
  if (attempt >= maxRetries) {
    return false;
  }

  return isRetryable(error);
}

// =============================================================================
// ERROR SERIALIZATION
// =============================================================================

/**
 * Serialize an error for logging or transmission
 */
export function serializeError(error: unknown, includeStack = false): SerializedError {
  const apiError = parseApiError(error);
  return apiError.serialize(includeStack);
}

/**
 * Deserialize an error from JSON
 */
export function deserializeError(data: SerializedError): ApiError {
  return ApiError.fromObject(data);
}

// =============================================================================
// ERROR HANDLERS
// =============================================================================

/**
 * Create an error handler for API responses
 */
export function createApiErrorHandler(options?: {
  onAuthError?: (error: AuthenticationError) => void;
  onForbiddenError?: (error: AuthorizationError) => void;
  onValidationError?: (error: ValidationError) => void;
  onNotFoundError?: (error: NotFoundError) => void;
  onRateLimitError?: (error: RateLimitError) => void;
  onNetworkError?: (error: NetworkError) => void;
  onServerError?: (error: ServerError) => void;
  onUnknownError?: (error: ApiError) => void;
}) {
  return (error: unknown): ApiError => {
    const apiError = parseApiError(error);

    if (apiError instanceof AuthenticationError) {
      options?.onAuthError?.(apiError);
    } else if (apiError instanceof AuthorizationError) {
      options?.onForbiddenError?.(apiError);
    } else if (apiError instanceof ValidationError) {
      options?.onValidationError?.(apiError);
    } else if (apiError instanceof NotFoundError) {
      options?.onNotFoundError?.(apiError);
    } else if (apiError instanceof RateLimitError) {
      options?.onRateLimitError?.(apiError);
    } else if (apiError instanceof NetworkError) {
      options?.onNetworkError?.(apiError);
    } else if (apiError instanceof ServerError) {
      options?.onServerError?.(apiError);
    } else {
      options?.onUnknownError?.(apiError);
    }

    return apiError;
  };
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  handler?: (error: ApiError) => void
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      const apiError = parseApiError(error);
      handler?.(apiError);
      throw apiError;
    }
  }) as T;
}

/**
 * Execute with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (error: ApiError, attempt: number, delay: number) => void;
  }
): Promise<T> {
  const config = {
    ...DefaultRetryConfig,
    ...options,
  };

  let lastError: ApiError | undefined;

  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = parseApiError(error);

      if (!shouldRetry(lastError, attempt, config.maxRetries)) {
        throw lastError;
      }

      const delay = getRetryDelay(attempt, config);
      options?.onRetry?.(lastError, attempt, delay);

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
