/**
 * @skillancer/shared-api-client
 * Base HTTP client with interceptors, retry logic, and request cancellation
 */

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type AxiosError,
  type InternalAxiosRequestConfig,
  type CancelTokenSource,
} from 'axios';

import {
  type ApiResponse,
  type ApiClientConfig,
  type RequestConfig,
  type RequestOptions,
  type AuthTokens,
  type TokenStorage,
  type ErrorDetails,
  ApiError,
} from './types';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_RETRIES = 3;
const RETRY_DELAY_BASE = 1000;
const TOKEN_REFRESH_THRESHOLD_MS = 60000; // Refresh token 1 minute before expiry

// =============================================================================
// Token Utilities
// =============================================================================

/**
 * Parse JWT and extract payload
 */
function parseJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr =
      typeof atob !== 'undefined' ? atob(base64) : Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Check if token is about to expire
 */
function isTokenExpiringSoon(
  token: string,
  thresholdMs: number = TOKEN_REFRESH_THRESHOLD_MS
): boolean {
  const payload = parseJwt(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  const expiresAt = payload.exp * 1000;
  return Date.now() >= expiresAt - thresholdMs;
}

/**
 * Check if token is expired
 */
function isTokenExpired(token: string): boolean {
  const payload = parseJwt(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  return Date.now() >= payload.exp * 1000;
}

// =============================================================================
// Request Cancellation Manager
// =============================================================================

/**
 * Manages request cancellation tokens
 */
export class RequestCancellationManager {
  private cancelTokens: Map<string, CancelTokenSource> = new Map();

  /**
   * Create a new cancellation token for a request
   */
  create(requestId: string): CancelTokenSource {
    // Cancel any existing request with the same ID
    this.cancel(requestId);

    const source = axios.CancelToken.source();
    this.cancelTokens.set(requestId, source);
    return source;
  }

  /**
   * Cancel a specific request
   */
  cancel(requestId: string, reason?: string): void {
    const source = this.cancelTokens.get(requestId);
    if (source) {
      source.cancel(reason ?? `Request ${requestId} cancelled`);
      this.cancelTokens.delete(requestId);
    }
  }

  /**
   * Cancel all pending requests
   */
  cancelAll(reason?: string): void {
    this.cancelTokens.forEach((source, id) => {
      source.cancel(reason ?? `Request ${id} cancelled`);
    });
    this.cancelTokens.clear();
  }

  /**
   * Remove a completed request from tracking
   */
  remove(requestId: string): void {
    this.cancelTokens.delete(requestId);
  }

  /**
   * Check if a request is pending
   */
  isPending(requestId: string): boolean {
    return this.cancelTokens.has(requestId);
  }

  /**
   * Get count of pending requests
   */
  get pendingCount(): number {
    return this.cancelTokens.size;
  }
}

// =============================================================================
// Base API Client
// =============================================================================

/**
 * Base HTTP client with interceptors, retry logic, and request cancellation
 */
export class BaseApiClient {
  private client: AxiosInstance;
  private config: ApiClientConfig;
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string) => void> = [];
  private cancellationManager: RequestCancellationManager;

  constructor(config: ApiClientConfig) {
    this.config = {
      timeout: DEFAULT_TIMEOUT,
      retries: DEFAULT_RETRIES,
      ...config,
    };

    this.cancellationManager = new RequestCancellationManager();

    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: this.config.timeout ?? DEFAULT_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      withCredentials: true,
    });

    this.setupInterceptors();
  }

  // ===========================================================================
  // Interceptors Setup
  // ===========================================================================

  private setupInterceptors(): void {
    // Request interceptor - add auth token and request ID
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        // Skip auth if explicitly requested
        if ((config as InternalAxiosRequestConfig & { skipAuth?: boolean }).skipAuth) {
          return config;
        }

        // Get token from storage or getter function
        let token = this.config.tokenStorage?.getAccessToken() ?? this.config.getAuthToken?.();

        if (token) {
          // Check if token needs refresh
          if (isTokenExpiringSoon(token) && !this.isRefreshing) {
            try {
              await this.refreshAccessToken();
              token = this.config.tokenStorage?.getAccessToken() ?? this.config.getAuthToken?.();
            } catch (error) {
              // Token refresh failed, continue with current token
              this.log('Token refresh failed:', error);
            }
          }

          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }

        // Add request ID for tracing
        const requestId = this.generateRequestId();
        config.headers['X-Request-ID'] = requestId;

        // Apply custom request interceptor
        if (this.config.requestInterceptor) {
          const modifiedConfig = await this.config.requestInterceptor(
            config as unknown as RequestOptions
          );
          return modifiedConfig as unknown as InternalAxiosRequestConfig;
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle errors and token refresh
    this.client.interceptors.response.use(
      async (response: AxiosResponse) => {
        // Apply custom response interceptor
        if (this.config.responseInterceptor) {
          const modifiedResponse = await this.config.responseInterceptor(response.data);
          response.data = modifiedResponse;
        }
        return response;
      },
      async (error: AxiosError<{ message?: string; code?: string; details?: unknown }>) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Handle request cancellation
        if (axios.isCancel(error)) {
          throw new ApiError({
            code: 'TIMEOUT',
            message: 'Request was cancelled',
            status: 0,
            retryable: false,
          });
        }

        // Handle 401 - Unauthorized
        if (error.response?.status === 401 && !originalRequest._retry) {
          const refreshToken =
            this.config.tokenStorage?.getRefreshToken() ?? this.config.getRefreshToken?.();

          if (refreshToken && !isTokenExpired(refreshToken)) {
            originalRequest._retry = true;

            if (!this.isRefreshing) {
              try {
                await this.refreshAccessToken();
                const newToken =
                  this.config.tokenStorage?.getAccessToken() ?? this.config.getAuthToken?.();
                if (newToken) {
                  originalRequest.headers.Authorization = `Bearer ${newToken}`;
                  return this.client(originalRequest);
                }
              } catch {
                this.handleAuthFailure();
              }
            } else {
              // Wait for ongoing refresh
              return new Promise((resolve, reject) => {
                this.refreshSubscribers.push((token: string) => {
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                  this.client(originalRequest).then(resolve).catch(reject);
                });
              });
            }
          } else {
            this.handleAuthFailure();
          }
        }

        // Normalize and throw error
        const apiError = this.normalizeError(error);

        // Call custom error handler
        if (this.config.errorHandler) {
          this.config.errorHandler(apiError);
        }

        throw apiError;
      }
    );
  }

  // ===========================================================================
  // Token Refresh
  // ===========================================================================

  private async refreshAccessToken(): Promise<void> {
    const refreshToken =
      this.config.tokenStorage?.getRefreshToken() ?? this.config.getRefreshToken?.();

    if (!refreshToken || isTokenExpired(refreshToken)) {
      throw new Error('No valid refresh token');
    }

    this.isRefreshing = true;

    try {
      const response = await axios.post<AuthTokens>(`${this.config.baseUrl}/auth/refresh`, {
        refreshToken,
      });

      const { accessToken, refreshToken: newRefreshToken } = response.data;

      // Update token storage
      this.config.tokenStorage?.setTokens(accessToken, newRefreshToken);

      // Notify callback
      this.config.onTokenRefresh?.({
        accessToken,
        refreshToken: newRefreshToken,
      });

      // Notify all subscribers waiting for refresh
      this.refreshSubscribers.forEach((callback) => callback(accessToken));
      this.refreshSubscribers = [];
    } finally {
      this.isRefreshing = false;
    }
  }

  private handleAuthFailure(): void {
    this.config.tokenStorage?.clearTokens();
    this.config.onAuthFailure?.();
  }

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  private normalizeError(
    error: AxiosError<{
      message?: string;
      code?: string;
      details?: unknown;
      errors?: Array<{ field: string; message: string }>;
    }>
  ): ApiError {
    const errorDetails: ErrorDetails = {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      status: 0,
    };

    if (error.response) {
      errorDetails.status = error.response.status;
      errorDetails.message = error.response.data?.message ?? error.message;
      if (error.response.data?.details) {
        errorDetails.details = error.response.data.details as Record<string, unknown>;
      }

      // Map status to error code
      switch (error.response.status) {
        case 400:
          errorDetails.code = 'VALIDATION_ERROR';
          if (error.response.data?.errors) {
            errorDetails.validationErrors = error.response.data.errors;
          }
          break;
        case 401:
          errorDetails.code = 'UNAUTHORIZED';
          break;
        case 403:
          errorDetails.code = 'FORBIDDEN';
          break;
        case 404:
          errorDetails.code = 'NOT_FOUND';
          break;
        case 409:
          errorDetails.code = 'CONFLICT';
          break;
        case 429:
          errorDetails.code = 'RATE_LIMITED';
          errorDetails.retryable = true;
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          errorDetails.code = 'SERVICE_UNAVAILABLE';
          errorDetails.retryable = true;
          break;
        default:
          errorDetails.code =
            (error.response.data?.code as ErrorDetails['code']) ?? 'INTERNAL_ERROR';
      }
    } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      errorDetails.code = 'TIMEOUT';
      errorDetails.message = 'Request timed out';
      errorDetails.retryable = true;
    } else if (!error.response) {
      errorDetails.code = 'NETWORK_ERROR';
      errorDetails.message = 'Unable to connect to server';
      errorDetails.retryable = true;
    }

    // Extract request ID from response headers
    const requestId = error.response?.headers?.['x-request-id'];
    if (requestId) {
      errorDetails.requestId = requestId;
    }

    return new ApiError(errorDetails);
  }

  // ===========================================================================
  // Retry Logic
  // ===========================================================================

  private async requestWithRetry<T>(
    config: AxiosRequestConfig,
    retries?: number
  ): Promise<AxiosResponse<T>> {
    const maxRetries = retries ?? this.config.retries ?? DEFAULT_RETRIES;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.client.request<T>(config);
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        if (error instanceof ApiError && !error.retryable) {
          throw error;
        }

        const axiosError = error as AxiosError;

        // Don't retry on client errors (4xx) except 429
        if (
          axiosError.response?.status &&
          axiosError.response.status >= 400 &&
          axiosError.response.status < 500 &&
          axiosError.response.status !== 429
        ) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff with jitter
        const baseDelay = (config as RequestConfig).retryDelay ?? RETRY_DELAY_BASE;
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        this.log(`Retrying request (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms`);
        await this.delay(delay);
      }
    }

    throw lastError;
  }

  // ===========================================================================
  // Public Request Methods
  // ===========================================================================

  /**
   * Make a GET request
   */
  async get<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    const response = await this.requestWithRetry<ApiResponse<T>>(
      { ...this.transformConfig(config), method: 'GET', url },
      config?.retries
    );
    return response.data;
  }

  /**
   * Make a POST request
   */
  async post<T, D = unknown>(
    url: string,
    data?: D,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.requestWithRetry<ApiResponse<T>>(
      { ...this.transformConfig(config), method: 'POST', url, data },
      config?.retries
    );
    return response.data;
  }

  /**
   * Make a PUT request
   */
  async put<T, D = unknown>(
    url: string,
    data?: D,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.requestWithRetry<ApiResponse<T>>(
      { ...this.transformConfig(config), method: 'PUT', url, data },
      config?.retries
    );
    return response.data;
  }

  /**
   * Make a PATCH request
   */
  async patch<T, D = unknown>(
    url: string,
    data?: D,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.requestWithRetry<ApiResponse<T>>(
      { ...this.transformConfig(config), method: 'PATCH', url, data },
      config?.retries
    );
    return response.data;
  }

  /**
   * Make a DELETE request
   */
  async delete<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    const response = await this.requestWithRetry<ApiResponse<T>>(
      { ...this.transformConfig(config), method: 'DELETE', url },
      config?.retries
    );
    return response.data;
  }

  /**
   * Make a request with full options
   */
  async request<T, D = unknown>(options: RequestOptions<D>): Promise<ApiResponse<T>> {
    const { url, method, data, ...config } = options;
    const response = await this.requestWithRetry<ApiResponse<T>>(
      { ...this.transformConfig(config), method, url, data },
      config?.retries
    );
    return response.data;
  }

  // ===========================================================================
  // Request Cancellation
  // ===========================================================================

  /**
   * Create a cancellable request
   */
  createCancellableRequest<T>(
    requestId: string,
    requestFn: (cancelToken: CancelTokenSource) => Promise<T>
  ): { promise: Promise<T>; cancel: (reason?: string) => void } {
    const source = this.cancellationManager.create(requestId);

    const promise = requestFn(source).finally(() => {
      this.cancellationManager.remove(requestId);
    });

    return {
      promise,
      cancel: (reason?: string) => this.cancellationManager.cancel(requestId, reason),
    };
  }

  /**
   * Cancel a specific request by ID
   */
  cancelRequest(requestId: string, reason?: string): void {
    this.cancellationManager.cancel(requestId, reason);
  }

  /**
   * Cancel all pending requests
   */
  cancelAllRequests(reason?: string): void {
    this.cancellationManager.cancelAll(reason);
  }

  /**
   * Get cancellation manager for advanced usage
   */
  getCancellationManager(): RequestCancellationManager {
    return this.cancellationManager;
  }

  // ===========================================================================
  // Token Management
  // ===========================================================================

  /**
   * Set authentication tokens
   */
  setTokens(accessToken: string, refreshToken: string): void {
    this.config.tokenStorage?.setTokens(accessToken, refreshToken);
  }

  /**
   * Clear authentication tokens
   */
  clearTokens(): void {
    this.config.tokenStorage?.clearTokens();
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const token = this.config.tokenStorage?.getAccessToken() ?? this.config.getAuthToken?.();
    return !!token && !isTokenExpired(token);
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  /**
   * Update client configuration
   */
  updateConfig(config: Partial<ApiClientConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.baseUrl) {
      this.client.defaults.baseURL = config.baseUrl;
    }
    if (config.timeout) {
      this.client.defaults.timeout = config.timeout;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ApiClientConfig {
    return { ...this.config };
  }

  /**
   * Get underlying axios instance for advanced usage
   */
  getAxiosInstance(): AxiosInstance {
    return this.client;
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  private transformConfig(config?: RequestConfig): AxiosRequestConfig {
    if (!config) return {};

    return {
      headers: config.headers,
      params: config.params,
      timeout: config.timeout,
      signal: config.signal,
      responseType: config.responseType,
      withCredentials: config.credentials === 'include',
      skipAuth: config.skipAuth,
    } as AxiosRequestConfig & { skipAuth?: boolean };
  }

  private generateRequestId(): string {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[ApiClient]', ...args);
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new API client instance
 */
export function createApiClient(config: ApiClientConfig): BaseApiClient {
  return new BaseApiClient(config);
}

// =============================================================================
// Token Storage Implementations
// =============================================================================

/**
 * Local storage token storage implementation
 */
export class LocalStorageTokenStorage implements TokenStorage {
  private readonly accessTokenKey: string;
  private readonly refreshTokenKey: string;

  constructor(prefix = 'skillancer') {
    this.accessTokenKey = `${prefix}_access_token`;
    this.refreshTokenKey = `${prefix}_refresh_token`;
  }

  getAccessToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(this.accessTokenKey);
  }

  getRefreshToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(this.refreshTokenKey);
  }

  setTokens(accessToken: string, refreshToken: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(this.accessTokenKey, accessToken);
    localStorage.setItem(this.refreshTokenKey, refreshToken);
  }

  clearTokens(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.refreshTokenKey);
  }
}

/**
 * Memory token storage implementation (for SSR/testing)
 */
export class MemoryTokenStorage implements TokenStorage {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
  }
}

/**
 * Session storage token storage implementation
 */
export class SessionStorageTokenStorage implements TokenStorage {
  private readonly accessTokenKey: string;
  private readonly refreshTokenKey: string;

  constructor(prefix = 'skillancer') {
    this.accessTokenKey = `${prefix}_access_token`;
    this.refreshTokenKey = `${prefix}_refresh_token`;
  }

  getAccessToken(): string | null {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(this.accessTokenKey);
  }

  getRefreshToken(): string | null {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(this.refreshTokenKey);
  }

  setTokens(accessToken: string, refreshToken: string): void {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(this.accessTokenKey, accessToken);
    sessionStorage.setItem(this.refreshTokenKey, refreshToken);
  }

  clearTokens(): void {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(this.accessTokenKey);
    sessionStorage.removeItem(this.refreshTokenKey);
  }
}

// =============================================================================
// Zustand Auth Store Integration
// =============================================================================

/**
 * Create token storage that integrates with a Zustand auth store
 */
export function createZustandTokenStorage(
  getState: () => { accessToken: string | null; refreshToken: string | null },
  setTokens: (accessToken: string, refreshToken: string) => void,
  clearTokens: () => void
): TokenStorage {
  return {
    getAccessToken: () => getState().accessToken,
    getRefreshToken: () => getState().refreshToken,
    setTokens,
    clearTokens,
  };
}

// =============================================================================
// Re-exports
// =============================================================================

export * from './types';
export * from './endpoints';
