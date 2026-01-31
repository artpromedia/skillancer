/**
 * @module @skillancer/error-handling
 * Centralized error handling for Skillancer applications
 */

// Export constants
export {
  ErrorCode,
  ErrorMessage,
  HttpStatusToErrorCode,
  ErrorSeverity,
  ErrorCodeSeverity,
  RetryableErrorCodes,
  DefaultRetryConfig,
  type ErrorCodeValue,
  type ErrorSeverityValue,
} from './constants.js';

// Export error classes
export {
  ApiError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  NetworkError,
  ServerError,
  isApiError,
  isAuthenticationError,
  isAuthorizationError,
  isValidationError,
  isNotFoundError,
  isRateLimitError,
  isNetworkError,
  isServerError,
  type FieldError,
  type RateLimitInfo,
  type ErrorDetails,
  type SerializedError,
  type ApiErrorResponse,
} from './errors.js';

// Export handlers
export {
  parseApiError,
  parseAxiosError,
  parseFetchResponse,
  getErrorMessage,
  getErrorCode,
  getStatusCode,
  getValidationErrors,
  isRetryable,
  getRetryDelay,
  shouldRetry,
  serializeError,
  deserializeError,
  createApiErrorHandler,
  withErrorHandling,
  withRetry,
} from './handlers.js';
