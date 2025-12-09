/**
 * @module @skillancer/service-template/utils
 * Utility exports
 */

export { getLogger, createChildLogger, logOperation } from './logger.js';

export {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  TooManyRequestsError,
  InternalServerError,
  ServiceUnavailableError,
  DatabaseError,
  ExternalServiceError,
  isAppError,
  isOperationalError,
  wrapError,
  type AppErrorOptions,
} from './errors.js';

export {
  validate,
  validateOrThrow,
  validateAsync,
  validateOrThrowAsync,
  formatZodErrors,
  getFirstZodError,
  emptyStringToUndefined,
  trimmedString,
  nullable,
  optionalNullish,
  coerceBoolean,
  commaSeparatedArray,
  jsonString,
  parsePagination,
  calculateOffset,
  calculateTotalPages,
  buildPaginationMeta,
  zodToFastifySchema,
  z,
  type ValidationResult,
  type ZodSchema,
  type ZodError,
  type ZodIssue,
} from './validation.js';

export {
  createHttpClient,
  withRetry,
  createCircuitBreaker,
  sleep,
  timeout,
  buildQueryString,
  parseQueryString,
  type HttpClientOptions,
  type RequestOptions,
  type HttpResponse,
  type RetryOptions,
  type CircuitBreakerOptions,
  type HttpClient,
  type CircuitBreaker,
} from './http.js';
