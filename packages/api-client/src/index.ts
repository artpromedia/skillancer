/**
 * @skillancer/api-client
 * Unified API client for Skillancer platform
 */

// Main client
export {
  createSkillancerClient,
  type SkillancerClient,
  type SkillancerClientConfig,
} from './skillancer-client';

// HTTP client
export {
  HttpClient,
  createHttpClient,
  type HttpClientConfig,
  type TokenStorage,
  type ApiResponse,
  type ApiError,
  type ValidationError as ApiValidationError,
} from './http';

// Token storage implementations
export {
  LocalStorageTokenStorage,
  MemoryTokenStorage,
  CookieTokenStorage,
  SessionStorageTokenStorage,
  createLocalStorageTokenStorage,
  createMemoryTokenStorage,
  createCookieTokenStorage,
  createSessionStorageTokenStorage,
} from './storage';

// Service clients
export * from './services';

// WebSocket client
export {
  WebSocketClient,
  createWebSocketClient,
  type WebSocketConfig,
  type WebSocketEvent,
  type WebSocketEventType,
  type EventHandler,
  type ConnectionHandler,
  type ErrorHandler,
} from './websocket';

// Error handling
export {
  SkillancerApiError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationErrorClass as ValidationError,
  RateLimitError,
  ServerError,
  NetworkError,
  TimeoutError,
  isApiError,
  isUnauthorizedError,
  isValidationError,
  isRateLimitError,
  isNetworkError,
  normalizeError,
  getErrorMessage,
  getErrorCode,
  createErrorHandler,
  type ErrorHandlerOptions,
} from './errors';

// Legacy exports (maintain backwards compatibility)
export * from './client';
export * from './executive';
export * from './integrations';
