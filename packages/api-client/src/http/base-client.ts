/**
 * @module @skillancer/api-client/http/base-client
 * Enhanced HTTP client with interceptors, token refresh, and retry logic
 */

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';

// =============================================================================
// Types
// =============================================================================

export interface TokenStorage {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  setTokens(accessToken: string, refreshToken: string): void;
  clearTokens(): void;
  onTokenRefreshed?(accessToken: string, refreshToken: string): void;
}

export interface HttpClientConfig {
  baseUrl: string;
  timeout?: number;
  tokenStorage?: TokenStorage;
  onUnauthorized?: () => void;
  onForbidden?: (message?: string) => void;
  onServerError?: (error: ApiError) => void;
  onNetworkError?: () => void;
  onRateLimited?: (retryAfter?: number) => void;
}

export interface ApiResponse<T = unknown> {
  data: T;
  success: boolean;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  status: number;
  details?: Record<string, unknown>;
  validationErrors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000;
const REFRESH_THRESHOLD_MS = 60000; // Refresh token 1 minute before expiry

// =============================================================================
// Token Helpers
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
    const jsonStr = atob(base64);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Check if token is about to expire
 */
function isTokenExpiringSoon(token: string, thresholdMs: number = REFRESH_THRESHOLD_MS): boolean {
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
// HTTP Client Class
// =============================================================================

export class HttpClient {
  private client: AxiosInstance;
  private config: HttpClientConfig;
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string) => void> = [];

  constructor(config: HttpClientConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    this.setupInterceptors();
  }

  // ===========================================================================
  // Interceptors
  // ===========================================================================

  private setupInterceptors(): void {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const token = this.config.tokenStorage?.getAccessToken();

        if (token) {
          // Check if token needs refresh
          if (isTokenExpiringSoon(token) && !this.isRefreshing) {
            await this.refreshAccessToken();
            const newToken = this.config.tokenStorage?.getAccessToken();
            if (newToken) {
              config.headers.Authorization = `Bearer ${newToken}`;
            }
          } else {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }

        // Add request ID for tracing
        config.headers['X-Request-ID'] = crypto.randomUUID();

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<{ message?: string; code?: string; details?: unknown }>) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Handle 401 - Unauthorized
        if (error.response?.status === 401) {
          // Try to refresh token if not already retried
          if (!originalRequest._retry && this.config.tokenStorage?.getRefreshToken()) {
            originalRequest._retry = true;

            if (!this.isRefreshing) {
              try {
                await this.refreshAccessToken();
                const newToken = this.config.tokenStorage?.getAccessToken();
                if (newToken) {
                  originalRequest.headers.Authorization = `Bearer ${newToken}`;
                  return this.client(originalRequest);
                }
              } catch {
                // Refresh failed, redirect to login
                this.config.tokenStorage?.clearTokens();
                this.config.onUnauthorized?.();
              }
            } else {
              // Wait for ongoing refresh
              return new Promise((resolve) => {
                this.refreshSubscribers.push((token: string) => {
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                  resolve(this.client(originalRequest));
                });
              });
            }
          } else {
            this.config.tokenStorage?.clearTokens();
            this.config.onUnauthorized?.();
          }
        }

        // Handle 403 - Forbidden
        if (error.response?.status === 403) {
          this.config.onForbidden?.(error.response?.data?.message);
        }

        // Handle 429 - Rate Limited
        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '60', 10);
          this.config.onRateLimited?.(retryAfter);
        }

        // Handle 5xx - Server errors
        if (error.response?.status && error.response.status >= 500) {
          this.config.onServerError?.({
            code: error.response?.data?.code || 'SERVER_ERROR',
            message: error.response?.data?.message || 'An unexpected error occurred',
            status: error.response.status,
            details: error.response?.data?.details as Record<string, unknown> | undefined,
          });
        }

        // Handle network errors
        if (!error.response && error.code === 'ECONNABORTED') {
          this.config.onNetworkError?.();
        }

        return Promise.reject(this.normalizeError(error));
      }
    );
  }

  // ===========================================================================
  // Token Refresh
  // ===========================================================================

  private async refreshAccessToken(): Promise<void> {
    const refreshToken = this.config.tokenStorage?.getRefreshToken();
    if (!refreshToken || isTokenExpired(refreshToken)) {
      throw new Error('No valid refresh token');
    }

    this.isRefreshing = true;

    try {
      const response = await axios.post<{
        accessToken: string;
        refreshToken: string;
      }>(`${this.config.baseUrl}/auth/refresh`, { refreshToken });

      const { accessToken, refreshToken: newRefreshToken } = response.data;

      this.config.tokenStorage?.setTokens(accessToken, newRefreshToken);
      this.config.tokenStorage?.onTokenRefreshed?.(accessToken, newRefreshToken);

      // Notify all subscribers
      this.refreshSubscribers.forEach((callback) => callback(accessToken));
      this.refreshSubscribers = [];
    } finally {
      this.isRefreshing = false;
    }
  }

  // ===========================================================================
  // Error Normalization
  // ===========================================================================

  private normalizeError(
    error: AxiosError<{
      message?: string;
      code?: string;
      details?: unknown;
      errors?: ValidationError[];
    }>
  ): ApiError {
    if (error.response) {
      return {
        code: error.response.data?.code || `HTTP_${error.response.status}`,
        message: error.response.data?.message || error.message,
        status: error.response.status,
        details: error.response.data?.details as Record<string, unknown> | undefined,
        validationErrors: error.response.data?.errors,
      };
    }

    if (error.code === 'ECONNABORTED') {
      return {
        code: 'TIMEOUT',
        message: 'Request timed out',
        status: 0,
      };
    }

    return {
      code: 'NETWORK_ERROR',
      message: 'Unable to connect to server',
      status: 0,
    };
  }

  // ===========================================================================
  // Request Methods with Retry
  // ===========================================================================

  private async requestWithRetry<T>(
    config: AxiosRequestConfig,
    retries: number = MAX_RETRIES
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.client.request<T>(config);
        return response.data;
      } catch (error) {
        lastError = error;
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
        if (attempt === retries) {
          throw error;
        }

        // Exponential backoff with jitter
        const delay = RETRY_DELAY_BASE * Math.pow(2, attempt) + Math.random() * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  // ===========================================================================
  // Public Request Methods
  // ===========================================================================

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.requestWithRetry<T>({ ...config, method: 'GET', url });
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.requestWithRetry<T>({ ...config, method: 'POST', url, data });
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.requestWithRetry<T>({ ...config, method: 'PUT', url, data });
  }

  async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.requestWithRetry<T>({ ...config, method: 'PATCH', url, data });
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.requestWithRetry<T>({ ...config, method: 'DELETE', url });
  }

  // ===========================================================================
  // Token Management
  // ===========================================================================

  setToken(token: string): void {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearToken(): void {
    delete this.client.defaults.headers.common['Authorization'];
  }

  // ===========================================================================
  // Raw Client Access
  // ===========================================================================

  getAxiosInstance(): AxiosInstance {
    return this.client;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createHttpClient(config: HttpClientConfig): HttpClient {
  return new HttpClient(config);
}
