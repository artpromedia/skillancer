/**
 * Web Market API Client
 *
 * Configured API client using the shared-api-client package.
 * Handles authentication, token refresh, and error handling specific to web-market.
 */

import {
  createApiClient,
  LocalStorageTokenStorage,
  type BaseApiClient,
  type ApiClientConfig,
  type TokenStorage,
  getEnvironmentConfig,
  detectEnvironment,
} from '@skillancer/shared-api-client';

// =============================================================================
// Constants
// =============================================================================

const AUTH_TOKEN_KEY = 'skillancer_access_token';
const REFRESH_TOKEN_KEY = 'skillancer_refresh_token';

// =============================================================================
// Token Storage
// =============================================================================

/**
 * Custom token storage that uses localStorage with skillancer-specific keys
 */
class WebMarketTokenStorage implements TokenStorage {
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

// =============================================================================
// Client Configuration
// =============================================================================

/**
 * Get the API base URL from environment
 */
function getApiBaseUrl(): string {
  // Check for environment-specific URL first
  if (typeof process !== 'undefined') {
    if (process.env.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL;
    }
  }

  // Fall back to environment config
  const env = detectEnvironment();
  const config = getEnvironmentConfig(env);
  return config.apiGateway;
}

/**
 * Create the API client configuration for web-market
 */
function createWebMarketConfig(): ApiClientConfig {
  const baseUrl = getApiBaseUrl();
  const tokenStorage = new WebMarketTokenStorage();

  return {
    baseUrl,
    timeout: 30000,
    retries: 3,
    tokenStorage,
    debug: process.env.NODE_ENV === 'development',
    onAuthFailure: () => {
      // Clear tokens and redirect to login
      tokenStorage.clearTokens();

      // Only redirect on client-side
      if (typeof window !== 'undefined') {
        // Dispatch custom event for auth failure
        window.dispatchEvent(
          new CustomEvent('auth:logout', { detail: { reason: 'token_expired' } })
        );

        // Redirect to login with return URL
        const currentPath = window.location.pathname + window.location.search;
        window.location.href = `/login?returnUrl=${encodeURIComponent(currentPath)}`;
      }
    },
    onTokenRefresh: (tokens) => {
      // Dispatch event when tokens are refreshed
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('auth:token_refreshed', { detail: { accessToken: tokens.accessToken } })
        );
      }
    },
    errorHandler: (error) => {
      // Log errors in development
      if (process.env.NODE_ENV === 'development') {
        console.error('[API Error]', {
          code: error.code,
          message: error.message,
          status: error.status,
          details: error.details,
        });
      }

      // Track errors in production
      if (process.env.NODE_ENV === 'production') {
        // TODO: Send to error tracking service (Sentry, etc.)
      }
    },
  };
}

// =============================================================================
// Singleton Client Instance
// =============================================================================

let apiClientInstance: BaseApiClient | null = null;

/**
 * Get the singleton API client instance
 */
export function getApiClient(): BaseApiClient {
  if (!apiClientInstance) {
    apiClientInstance = createApiClient(createWebMarketConfig());
  }
  return apiClientInstance;
}

/**
 * Reset the API client (useful for testing or logout)
 */
export function resetApiClient(): void {
  if (apiClientInstance) {
    apiClientInstance.cancelAllRequests();
    apiClientInstance.clearTokens();
  }
  apiClientInstance = null;
}

// =============================================================================
// Authentication Helpers
// =============================================================================

/**
 * Set authentication tokens
 */
export function setAuthTokens(accessToken: string, refreshToken: string): void {
  const client = getApiClient();
  client.setTokens(accessToken, refreshToken);
}

/**
 * Clear authentication tokens and reset client
 */
export function clearAuthTokens(): void {
  const client = getApiClient();
  client.clearTokens();
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const client = getApiClient();
  return client.isAuthenticated();
}

// =============================================================================
// Default Export
// =============================================================================

/**
 * Default API client instance
 */
export const apiClient = {
  get client() {
    return getApiClient();
  },
  setTokens: setAuthTokens,
  clearTokens: clearAuthTokens,
  isAuthenticated,
  reset: resetApiClient,
};

export default apiClient;
