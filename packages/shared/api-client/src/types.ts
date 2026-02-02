/**
 * @skillancer/shared-api-client - Types
 * Shared API response types, error types, and pagination types
 */

// =============================================================================
// Base API Response Types
// =============================================================================

/**
 * Standard API success response wrapper
 */
export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta?: PaginationMeta;
  timestamp?: string;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  success: false;
  error: ErrorDetails;
  timestamp?: string;
}

/**
 * Combined API response type (success or error)
 */
export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse;

// =============================================================================
// Error Types
// =============================================================================

/**
 * Detailed error information
 */
export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  status: number;
  details?: Record<string, unknown>;
  validationErrors?: ValidationError[];
  requestId?: string;
  retryable?: boolean;
}

/**
 * Field-level validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
  value?: unknown;
}

/**
 * Standard error codes used across the API
 */
export type ErrorCode =
  // Authentication & Authorization
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'SESSION_EXPIRED'
  | 'MFA_REQUIRED'
  // Validation
  | 'VALIDATION_ERROR'
  | 'INVALID_INPUT'
  | 'INVALID_FORMAT'
  | 'MISSING_REQUIRED_FIELD'
  // Resource
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'CONFLICT'
  | 'GONE'
  // Rate Limiting
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  // Server
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  // Business Logic
  | 'INSUFFICIENT_FUNDS'
  | 'SUBSCRIPTION_REQUIRED'
  | 'PAYMENT_REQUIRED'
  | 'RESOURCE_LOCKED'
  | 'OPERATION_NOT_ALLOWED';

/**
 * Error code to HTTP status mapping
 */
export const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  TOKEN_EXPIRED: 401,
  TOKEN_INVALID: 401,
  SESSION_EXPIRED: 401,
  MFA_REQUIRED: 403,
  VALIDATION_ERROR: 400,
  INVALID_INPUT: 400,
  INVALID_FORMAT: 400,
  MISSING_REQUIRED_FIELD: 400,
  NOT_FOUND: 404,
  ALREADY_EXISTS: 409,
  CONFLICT: 409,
  GONE: 410,
  RATE_LIMITED: 429,
  QUOTA_EXCEEDED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  TIMEOUT: 408,
  NETWORK_ERROR: 0,
  INSUFFICIENT_FUNDS: 402,
  SUBSCRIPTION_REQUIRED: 402,
  PAYMENT_REQUIRED: 402,
  RESOURCE_LOCKED: 423,
  OPERATION_NOT_ALLOWED: 405,
};

// =============================================================================
// Pagination Types
// =============================================================================

/**
 * Pagination request parameters
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page (max 100) */
  limit?: number;
  /** Field to sort by */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Pagination metadata in responses
 */
export interface PaginationMeta {
  /** Current page number */
  page: number;
  /** Items per page */
  limit: number;
  /** Total number of items */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there are more pages */
  hasMore: boolean;
  /** Whether there is a previous page */
  hasPrevious: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: PaginationMeta;
}

/**
 * Cursor-based pagination parameters
 */
export interface CursorPaginationParams {
  /** Cursor for next page */
  cursor?: string;
  /** Items per page */
  limit?: number;
  /** Sort direction */
  direction?: 'forward' | 'backward';
}

/**
 * Cursor-based pagination metadata
 */
export interface CursorPaginationMeta {
  /** Cursor for next page (null if no more items) */
  nextCursor: string | null;
  /** Cursor for previous page (null if at start) */
  previousCursor: string | null;
  /** Whether there are more items */
  hasMore: boolean;
}

/**
 * Cursor-paginated response wrapper
 */
export interface CursorPaginatedResponse<T> {
  success: true;
  data: T[];
  message?: string;
  meta: CursorPaginationMeta;
  timestamp?: string;
}

// =============================================================================
// Request Types
// =============================================================================

/**
 * HTTP methods supported by the API client
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Request configuration options
 */
export interface RequestConfig {
  /** Request headers */
  headers?: Record<string, string>;
  /** Query parameters */
  params?: Record<string, string | number | boolean | undefined>;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** AbortController signal for cancellation */
  signal?: AbortSignal;
  /** Skip automatic token attachment */
  skipAuth?: boolean;
  /** Number of retry attempts (0 = no retry) */
  retries?: number;
  /** Custom retry delay in milliseconds */
  retryDelay?: number;
  /** Response type */
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer';
  /** Cache mode */
  cache?: 'default' | 'no-cache' | 'reload' | 'force-cache' | 'only-if-cached';
  /** Credentials mode */
  credentials?: 'include' | 'same-origin' | 'omit';
}

/**
 * Full request options including method and data
 */
export interface RequestOptions<TData = unknown> extends RequestConfig {
  method: HttpMethod;
  url: string;
  data?: TData;
}

// =============================================================================
// Authentication Types
// =============================================================================

/**
 * Authentication tokens
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  tokenType?: 'Bearer';
}

/**
 * Token storage interface for persisting authentication state
 */
export interface TokenStorage {
  /** Get the current access token */
  getAccessToken(): string | null;
  /** Get the current refresh token */
  getRefreshToken(): string | null;
  /** Store both tokens */
  setTokens(accessToken: string, refreshToken: string): void;
  /** Clear all tokens */
  clearTokens(): void;
  /** Optional callback when tokens are refreshed */
  onTokenRefreshed?(accessToken: string, refreshToken: string): void;
}

/**
 * Auth store interface for React/Zustand integration
 */
export interface AuthStore {
  /** Current access token */
  accessToken: string | null;
  /** Current refresh token */
  refreshToken: string | null;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Set tokens */
  setTokens(accessToken: string, refreshToken: string): void;
  /** Clear tokens and logout */
  logout(): void;
}

// =============================================================================
// Client Configuration Types
// =============================================================================

/**
 * API client configuration
 */
export interface ApiClientConfig {
  /** Base URL for API requests */
  baseUrl: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Default number of retries for failed requests */
  retries?: number;
  /** Token storage implementation */
  tokenStorage?: TokenStorage;
  /** Function to get token from auth store (alternative to tokenStorage) */
  getAuthToken?: () => string | null;
  /** Function to get refresh token from auth store */
  getRefreshToken?: () => string | null;
  /** Callback when tokens are refreshed */
  onTokenRefresh?: (tokens: AuthTokens) => void;
  /** Callback when authentication fails */
  onAuthFailure?: () => void;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom request interceptor */
  requestInterceptor?: (config: RequestOptions) => RequestOptions | Promise<RequestOptions>;
  /** Custom response interceptor */
  responseInterceptor?: <T>(response: ApiResponse<T>) => ApiResponse<T> | Promise<ApiResponse<T>>;
  /** Custom error handler */
  errorHandler?: (error: ApiError) => void;
}

// =============================================================================
// API Error Class
// =============================================================================

/**
 * Custom API error class with detailed error information
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;
  readonly validationErrors: ValidationError[] | undefined;
  readonly requestId: string | undefined;
  readonly retryable: boolean;

  constructor(errorDetails: ErrorDetails) {
    super(errorDetails.message);
    this.name = 'ApiError';
    this.code = errorDetails.code;
    this.status = errorDetails.status;
    this.details = errorDetails.details;
    this.validationErrors = errorDetails.validationErrors;
    this.requestId = errorDetails.requestId;
    this.retryable = errorDetails.retryable ?? this.isRetryable(errorDetails.code);

    // Maintain proper stack trace (V8 engines only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  private isRetryable(code: ErrorCode): boolean {
    return ['TIMEOUT', 'NETWORK_ERROR', 'SERVICE_UNAVAILABLE', 'RATE_LIMITED'].includes(code);
  }

  /**
   * Check if this is an authentication error
   */
  isAuthError(): boolean {
    return ['UNAUTHORIZED', 'TOKEN_EXPIRED', 'TOKEN_INVALID', 'SESSION_EXPIRED'].includes(
      this.code
    );
  }

  /**
   * Check if this is a validation error
   */
  isValidationError(): boolean {
    return [
      'VALIDATION_ERROR',
      'INVALID_INPUT',
      'INVALID_FORMAT',
      'MISSING_REQUIRED_FIELD',
    ].includes(this.code);
  }

  /**
   * Check if this is a rate limit error
   */
  isRateLimitError(): boolean {
    return ['RATE_LIMITED', 'QUOTA_EXCEEDED'].includes(this.code);
  }

  /**
   * Check if this is a not found error
   */
  isNotFoundError(): boolean {
    return this.code === 'NOT_FOUND';
  }

  /**
   * Get validation error for a specific field
   */
  getFieldError(field: string): ValidationError | undefined {
    return this.validationErrors?.find((e) => e.field === field);
  }

  /**
   * Convert to JSON-serializable object
   */
  toJSON(): {
    code: ErrorCode;
    message: string;
    status: number;
    details?: Record<string, unknown>;
    validationErrors?: ValidationError[];
    requestId?: string;
    retryable: boolean;
  } {
    const result: {
      code: ErrorCode;
      message: string;
      status: number;
      details?: Record<string, unknown>;
      validationErrors?: ValidationError[];
      requestId?: string;
      retryable: boolean;
    } = {
      code: this.code,
      message: this.message,
      status: this.status,
      retryable: this.retryable,
    };
    if (this.details) result.details = this.details;
    if (this.validationErrors) result.validationErrors = this.validationErrors;
    if (this.requestId) result.requestId = this.requestId;
    return result;
  }
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a response is successful
 */
export function isApiSuccess<T>(result: ApiResult<T>): result is ApiResponse<T> {
  return result.success === true;
}

/**
 * Check if a response is an error
 */
export function isApiError<T>(result: ApiResult<T>): result is ApiErrorResponse {
  return result.success === false;
}

/**
 * Check if an error is an ApiError instance
 */
export function isApiErrorInstance(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Extract data type from an ApiResponse
 */
export type ExtractData<T> = T extends ApiResponse<infer D> ? D : never;

/**
 * Create a response type for a given data type
 */
export type ResponseOf<T> = ApiResponse<T>;

/**
 * Create a paginated response type for a given item type
 */
export type PaginatedOf<T> = PaginatedResponse<T>;

/**
 * Unwrap a Promise type
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/**
 * Make specific properties optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make specific properties required
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;
