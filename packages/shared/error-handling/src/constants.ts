/**
 * @module @skillancer/error-handling/constants
 * Error codes, messages, and related constants
 */

// =============================================================================
// ERROR CODES
// =============================================================================

/**
 * Error code categories:
 * - AUTH_* : Authentication errors (401)
 * - AUTHZ_* : Authorization errors (403)
 * - VAL_* : Validation errors (400)
 * - NOT_FOUND_* : Resource not found errors (404)
 * - RATE_* : Rate limiting errors (429)
 * - NETWORK_* : Network/connectivity errors
 * - SERVER_* : Server errors (500+)
 * - CLIENT_* : Client-side errors
 */
export const ErrorCode = {
  // Authentication errors (401)
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_ACCOUNT_DISABLED: 'AUTH_ACCOUNT_DISABLED',
  AUTH_ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',
  AUTH_MFA_REQUIRED: 'AUTH_MFA_REQUIRED',
  AUTH_MFA_INVALID: 'AUTH_MFA_INVALID',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  AUTH_EMAIL_NOT_VERIFIED: 'AUTH_EMAIL_NOT_VERIFIED',

  // Authorization errors (403)
  AUTHZ_FORBIDDEN: 'AUTHZ_FORBIDDEN',
  AUTHZ_INSUFFICIENT_PERMISSIONS: 'AUTHZ_INSUFFICIENT_PERMISSIONS',
  AUTHZ_ROLE_REQUIRED: 'AUTHZ_ROLE_REQUIRED',
  AUTHZ_RESOURCE_ACCESS_DENIED: 'AUTHZ_RESOURCE_ACCESS_DENIED',
  AUTHZ_SUBSCRIPTION_REQUIRED: 'AUTHZ_SUBSCRIPTION_REQUIRED',

  // Validation errors (400)
  VAL_INVALID_INPUT: 'VAL_INVALID_INPUT',
  VAL_MISSING_FIELD: 'VAL_MISSING_FIELD',
  VAL_INVALID_FORMAT: 'VAL_INVALID_FORMAT',
  VAL_DUPLICATE_ENTRY: 'VAL_DUPLICATE_ENTRY',
  VAL_CONSTRAINT_VIOLATION: 'VAL_CONSTRAINT_VIOLATION',
  VAL_FILE_TOO_LARGE: 'VAL_FILE_TOO_LARGE',
  VAL_INVALID_FILE_TYPE: 'VAL_INVALID_FILE_TYPE',

  // Not found errors (404)
  NOT_FOUND_RESOURCE: 'NOT_FOUND_RESOURCE',
  NOT_FOUND_USER: 'NOT_FOUND_USER',
  NOT_FOUND_ENDPOINT: 'NOT_FOUND_ENDPOINT',

  // Rate limiting errors (429)
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  RATE_LIMIT_API: 'RATE_LIMIT_API',
  RATE_LIMIT_LOGIN: 'RATE_LIMIT_LOGIN',

  // Network errors
  NETWORK_DISCONNECTED: 'NETWORK_DISCONNECTED',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_CORS: 'NETWORK_CORS',
  NETWORK_DNS: 'NETWORK_DNS',

  // Server errors (500+)
  SERVER_INTERNAL: 'SERVER_INTERNAL',
  SERVER_UNAVAILABLE: 'SERVER_UNAVAILABLE',
  SERVER_MAINTENANCE: 'SERVER_MAINTENANCE',
  SERVER_OVERLOADED: 'SERVER_OVERLOADED',
  SERVER_DEPENDENCY_FAILED: 'SERVER_DEPENDENCY_FAILED',

  // Client errors
  CLIENT_UNKNOWN: 'CLIENT_UNKNOWN',
  CLIENT_CANCELLED: 'CLIENT_CANCELLED',
  CLIENT_OFFLINE: 'CLIENT_OFFLINE',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

// =============================================================================
// ERROR MESSAGES
// =============================================================================

/**
 * User-friendly error messages for each error code
 * These messages are safe to display to end users
 */
export const ErrorMessage: Record<ErrorCodeValue, string> = {
  // Authentication
  [ErrorCode.AUTH_TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
  [ErrorCode.AUTH_TOKEN_INVALID]: 'Your session is invalid. Please log in again.',
  [ErrorCode.AUTH_TOKEN_MISSING]: 'Authentication required. Please log in.',
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: 'Invalid email or password.',
  [ErrorCode.AUTH_ACCOUNT_DISABLED]: 'Your account has been disabled. Please contact support.',
  [ErrorCode.AUTH_ACCOUNT_LOCKED]:
    'Your account has been locked due to too many failed attempts. Please try again later.',
  [ErrorCode.AUTH_MFA_REQUIRED]: 'Two-factor authentication is required.',
  [ErrorCode.AUTH_MFA_INVALID]: 'Invalid verification code. Please try again.',
  [ErrorCode.AUTH_SESSION_EXPIRED]: 'Your session has expired. Please log in again.',
  [ErrorCode.AUTH_EMAIL_NOT_VERIFIED]: 'Please verify your email address to continue.',

  // Authorization
  [ErrorCode.AUTHZ_FORBIDDEN]: "You don't have permission to perform this action.",
  [ErrorCode.AUTHZ_INSUFFICIENT_PERMISSIONS]:
    "You don't have the required permissions for this action.",
  [ErrorCode.AUTHZ_ROLE_REQUIRED]: 'This action requires a specific role.',
  [ErrorCode.AUTHZ_RESOURCE_ACCESS_DENIED]: "You don't have access to this resource.",
  [ErrorCode.AUTHZ_SUBSCRIPTION_REQUIRED]: 'This feature requires an active subscription.',

  // Validation
  [ErrorCode.VAL_INVALID_INPUT]: 'Please check your input and try again.',
  [ErrorCode.VAL_MISSING_FIELD]: 'Please fill in all required fields.',
  [ErrorCode.VAL_INVALID_FORMAT]: 'The input format is invalid.',
  [ErrorCode.VAL_DUPLICATE_ENTRY]: 'This entry already exists.',
  [ErrorCode.VAL_CONSTRAINT_VIOLATION]: 'The input violates a constraint.',
  [ErrorCode.VAL_FILE_TOO_LARGE]: 'The file is too large. Please choose a smaller file.',
  [ErrorCode.VAL_INVALID_FILE_TYPE]: 'This file type is not supported.',

  // Not found
  [ErrorCode.NOT_FOUND_RESOURCE]: 'The requested resource was not found.',
  [ErrorCode.NOT_FOUND_USER]: 'User not found.',
  [ErrorCode.NOT_FOUND_ENDPOINT]: 'The requested endpoint does not exist.',

  // Rate limiting
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please slow down.',
  [ErrorCode.RATE_LIMIT_API]: 'API rate limit exceeded. Please try again later.',
  [ErrorCode.RATE_LIMIT_LOGIN]: 'Too many login attempts. Please try again later.',

  // Network
  [ErrorCode.NETWORK_DISCONNECTED]:
    'No internet connection. Please check your network and try again.',
  [ErrorCode.NETWORK_TIMEOUT]: 'Request timed out. Please try again.',
  [ErrorCode.NETWORK_CORS]: 'Request blocked by security policy.',
  [ErrorCode.NETWORK_DNS]: 'Could not connect to the server.',

  // Server
  [ErrorCode.SERVER_INTERNAL]: 'Something went wrong. Please try again later.',
  [ErrorCode.SERVER_UNAVAILABLE]: 'Service temporarily unavailable. Please try again later.',
  [ErrorCode.SERVER_MAINTENANCE]: 'System is under maintenance. Please try again later.',
  [ErrorCode.SERVER_OVERLOADED]: 'Server is busy. Please try again in a moment.',
  [ErrorCode.SERVER_DEPENDENCY_FAILED]: 'A required service is unavailable. Please try again.',

  // Client
  [ErrorCode.CLIENT_UNKNOWN]: 'An unexpected error occurred.',
  [ErrorCode.CLIENT_CANCELLED]: 'Operation was cancelled.',
  [ErrorCode.CLIENT_OFFLINE]: 'You appear to be offline. Please check your connection.',
};

// =============================================================================
// HTTP STATUS CODES
// =============================================================================

/**
 * HTTP status code to error code mapping
 */
export const HttpStatusToErrorCode: Record<number, ErrorCodeValue> = {
  400: ErrorCode.VAL_INVALID_INPUT,
  401: ErrorCode.AUTH_TOKEN_INVALID,
  403: ErrorCode.AUTHZ_FORBIDDEN,
  404: ErrorCode.NOT_FOUND_RESOURCE,
  408: ErrorCode.NETWORK_TIMEOUT,
  409: ErrorCode.VAL_DUPLICATE_ENTRY,
  422: ErrorCode.VAL_INVALID_INPUT,
  429: ErrorCode.RATE_LIMIT_EXCEEDED,
  500: ErrorCode.SERVER_INTERNAL,
  502: ErrorCode.SERVER_DEPENDENCY_FAILED,
  503: ErrorCode.SERVER_UNAVAILABLE,
  504: ErrorCode.NETWORK_TIMEOUT,
};

// =============================================================================
// ERROR SEVERITY
// =============================================================================

/**
 * Error severity levels for logging and alerting
 */
export const ErrorSeverity = {
  DEBUG: 'debug',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
} as const;

export type ErrorSeverityValue = (typeof ErrorSeverity)[keyof typeof ErrorSeverity];

/**
 * Map error codes to severity levels
 */
export const ErrorCodeSeverity: Record<ErrorCodeValue, ErrorSeverityValue> = {
  // Authentication - INFO/WARNING (expected in normal operation)
  [ErrorCode.AUTH_TOKEN_EXPIRED]: ErrorSeverity.INFO,
  [ErrorCode.AUTH_TOKEN_INVALID]: ErrorSeverity.WARNING,
  [ErrorCode.AUTH_TOKEN_MISSING]: ErrorSeverity.INFO,
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: ErrorSeverity.INFO,
  [ErrorCode.AUTH_ACCOUNT_DISABLED]: ErrorSeverity.WARNING,
  [ErrorCode.AUTH_ACCOUNT_LOCKED]: ErrorSeverity.WARNING,
  [ErrorCode.AUTH_MFA_REQUIRED]: ErrorSeverity.INFO,
  [ErrorCode.AUTH_MFA_INVALID]: ErrorSeverity.INFO,
  [ErrorCode.AUTH_SESSION_EXPIRED]: ErrorSeverity.INFO,
  [ErrorCode.AUTH_EMAIL_NOT_VERIFIED]: ErrorSeverity.INFO,

  // Authorization - WARNING
  [ErrorCode.AUTHZ_FORBIDDEN]: ErrorSeverity.WARNING,
  [ErrorCode.AUTHZ_INSUFFICIENT_PERMISSIONS]: ErrorSeverity.WARNING,
  [ErrorCode.AUTHZ_ROLE_REQUIRED]: ErrorSeverity.WARNING,
  [ErrorCode.AUTHZ_RESOURCE_ACCESS_DENIED]: ErrorSeverity.WARNING,
  [ErrorCode.AUTHZ_SUBSCRIPTION_REQUIRED]: ErrorSeverity.INFO,

  // Validation - INFO (user input errors)
  [ErrorCode.VAL_INVALID_INPUT]: ErrorSeverity.INFO,
  [ErrorCode.VAL_MISSING_FIELD]: ErrorSeverity.INFO,
  [ErrorCode.VAL_INVALID_FORMAT]: ErrorSeverity.INFO,
  [ErrorCode.VAL_DUPLICATE_ENTRY]: ErrorSeverity.INFO,
  [ErrorCode.VAL_CONSTRAINT_VIOLATION]: ErrorSeverity.INFO,
  [ErrorCode.VAL_FILE_TOO_LARGE]: ErrorSeverity.INFO,
  [ErrorCode.VAL_INVALID_FILE_TYPE]: ErrorSeverity.INFO,

  // Not found - INFO/WARNING
  [ErrorCode.NOT_FOUND_RESOURCE]: ErrorSeverity.INFO,
  [ErrorCode.NOT_FOUND_USER]: ErrorSeverity.INFO,
  [ErrorCode.NOT_FOUND_ENDPOINT]: ErrorSeverity.WARNING,

  // Rate limiting - WARNING
  [ErrorCode.RATE_LIMIT_EXCEEDED]: ErrorSeverity.WARNING,
  [ErrorCode.RATE_LIMIT_API]: ErrorSeverity.WARNING,
  [ErrorCode.RATE_LIMIT_LOGIN]: ErrorSeverity.WARNING,

  // Network - WARNING/ERROR
  [ErrorCode.NETWORK_DISCONNECTED]: ErrorSeverity.WARNING,
  [ErrorCode.NETWORK_TIMEOUT]: ErrorSeverity.WARNING,
  [ErrorCode.NETWORK_CORS]: ErrorSeverity.ERROR,
  [ErrorCode.NETWORK_DNS]: ErrorSeverity.ERROR,

  // Server - ERROR/CRITICAL
  [ErrorCode.SERVER_INTERNAL]: ErrorSeverity.ERROR,
  [ErrorCode.SERVER_UNAVAILABLE]: ErrorSeverity.ERROR,
  [ErrorCode.SERVER_MAINTENANCE]: ErrorSeverity.INFO,
  [ErrorCode.SERVER_OVERLOADED]: ErrorSeverity.WARNING,
  [ErrorCode.SERVER_DEPENDENCY_FAILED]: ErrorSeverity.ERROR,

  // Client - WARNING/ERROR
  [ErrorCode.CLIENT_UNKNOWN]: ErrorSeverity.ERROR,
  [ErrorCode.CLIENT_CANCELLED]: ErrorSeverity.DEBUG,
  [ErrorCode.CLIENT_OFFLINE]: ErrorSeverity.INFO,
};

// =============================================================================
// RETRY CONFIGURATION
// =============================================================================

/**
 * Error codes that are retryable
 */
export const RetryableErrorCodes: Set<ErrorCodeValue> = new Set([
  ErrorCode.NETWORK_DISCONNECTED,
  ErrorCode.NETWORK_TIMEOUT,
  ErrorCode.SERVER_UNAVAILABLE,
  ErrorCode.SERVER_OVERLOADED,
  ErrorCode.SERVER_DEPENDENCY_FAILED,
  ErrorCode.RATE_LIMIT_EXCEEDED,
  ErrorCode.RATE_LIMIT_API,
]);

/**
 * Default retry configuration
 */
export const DefaultRetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
} as const;
