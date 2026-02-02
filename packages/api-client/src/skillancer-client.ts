/**
 * @module @skillancer/api-client
 * Unified Skillancer API Client
 */

import { createErrorHandler, type ErrorHandlerOptions } from './errors';
import {
  type HttpClient,
  createHttpClient,
  type HttpClientConfig,
  type TokenStorage,
} from './http';
import {
  AuthServiceClient,
  UserServiceClient,
  JobServiceClient,
  MessagingServiceClient,
  BillingServiceClient,
} from './services';
import { type WebSocketClient, createWebSocketClient, type WebSocketConfig } from './websocket';

// =============================================================================
// Types
// =============================================================================

export interface SkillancerClientConfig {
  /** Base URL for API requests (e.g., 'https://api.skillancer.com/v1') */
  baseUrl: string;
  /** WebSocket URL for real-time features (e.g., 'wss://api.skillancer.com/ws') */
  wsUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Token storage implementation */
  tokenStorage?: TokenStorage;
  /** Enable debug logging */
  debug?: boolean;
  /** Error handler options */
  errorHandlers?: ErrorHandlerOptions;
}

export interface SkillancerClient {
  /** HTTP client for custom requests */
  http: HttpClient;
  /** WebSocket client for real-time features */
  ws: WebSocketClient | null;
  /** Authentication service */
  auth: AuthServiceClient;
  /** User profile service */
  users: UserServiceClient;
  /** Job/Gig marketplace service */
  jobs: JobServiceClient;
  /** Messaging service */
  messages: MessagingServiceClient;
  /** Billing & payments service */
  billing: BillingServiceClient;
  /** Centralized error handler */
  handleError: (error: unknown) => void;
  /** Connect WebSocket */
  connectWebSocket: () => void;
  /** Disconnect WebSocket */
  disconnectWebSocket: () => void;
  /** Set authentication tokens */
  setTokens: (accessToken: string, refreshToken: string) => void;
  /** Clear authentication tokens */
  clearTokens: () => void;
  /** Check if user is authenticated */
  isAuthenticated: () => boolean;
}

// =============================================================================
// Client Factory
// =============================================================================

/**
 * Create a new Skillancer API client
 */
export function createSkillancerClient(config: SkillancerClientConfig): SkillancerClient {
  // Create HTTP client
  const httpConfig: HttpClientConfig = {
    baseUrl: config.baseUrl,
    timeout: config.timeout,
    tokenStorage: config.tokenStorage,
    onUnauthorized: config.errorHandlers?.onUnauthorized,
    onForbidden: config.errorHandlers?.onForbidden,
    onServerError: (error) => {
      if (config.errorHandlers?.onServerError) {
        const { SkillancerApiError } = require('./errors');
        config.errorHandlers.onServerError(new SkillancerApiError(error));
      }
    },
    onNetworkError: config.errorHandlers?.onNetworkError,
    onRateLimited: config.errorHandlers?.onRateLimit,
  };

  const httpClient = createHttpClient(httpConfig);

  // Create WebSocket client if URL provided
  let wsClient: WebSocketClient | null = null;
  if (config.wsUrl) {
    const wsConfig: WebSocketConfig = {
      url: config.wsUrl,
      token: config.tokenStorage?.getAccessToken() ?? undefined,
      debug: config.debug,
    };
    wsClient = createWebSocketClient(wsConfig);
  }

  // Create service clients
  const authService = new AuthServiceClient(httpClient, '/auth');
  const userService = new UserServiceClient(httpClient, '/users');
  const jobService = new JobServiceClient(httpClient, '/jobs');
  const messagingService = new MessagingServiceClient(httpClient, '/messages');
  const billingService = new BillingServiceClient(httpClient, '/billing');

  // Create error handler
  const errorHandler = createErrorHandler(config.errorHandlers || {});

  return {
    http: httpClient,
    ws: wsClient,
    auth: authService,
    users: userService,
    jobs: jobService,
    messages: messagingService,
    billing: billingService,
    handleError: errorHandler,

    connectWebSocket: () => {
      if (wsClient) {
        const token = config.tokenStorage?.getAccessToken();
        if (token) {
          wsClient.setToken(token);
        }
        wsClient.connect();
      }
    },

    disconnectWebSocket: () => {
      wsClient?.disconnect();
    },

    setTokens: (accessToken: string, refreshToken: string) => {
      config.tokenStorage?.setTokens(accessToken, refreshToken);
      httpClient.setToken(accessToken);
      wsClient?.setToken(accessToken);
    },

    clearTokens: () => {
      config.tokenStorage?.clearTokens();
      httpClient.clearToken();
      wsClient?.clearToken();
    },

    isAuthenticated: () => {
      const token = config.tokenStorage?.getAccessToken();
      return !!token;
    },
  };
}

// =============================================================================
// Re-exports
// =============================================================================

// HTTP
export {
  HttpClient,
  createHttpClient,
  type HttpClientConfig,
  type TokenStorage,
  type ApiResponse,
  type ApiError,
  type ValidationError,
} from './http';

// Storage
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

// Services
export * from './services';

// WebSocket
export {
  WebSocketClient,
  createWebSocketClient,
  type WebSocketConfig,
  type WebSocketEvent,
  type WebSocketEventType,
} from './websocket';

// Errors
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
