/**
 * Web Cockpit API Client
 *
 * Configured API client using the shared-api-client package.
 * Handles authentication, token refresh, and error handling specific to web-cockpit.
 */

import {
  createApiClient,
  type BaseApiClient,
  type ApiClientConfig,
  type TokenStorage,
  getEnvironmentConfig,
  detectEnvironment,
} from '@skillancer/shared-api-client';

// =============================================================================
// Constants
// =============================================================================

const AUTH_TOKEN_KEY = 'skillancer_cockpit_access_token';
const REFRESH_TOKEN_KEY = 'skillancer_cockpit_refresh_token';
const TENANT_ID_KEY = 'skillancer_cockpit_tenant_id';

// =============================================================================
// Token Storage
// =============================================================================

/**
 * Custom token storage that uses localStorage with cockpit-specific keys
 */
class CockpitTokenStorage implements TokenStorage {
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
// Tenant Management
// =============================================================================

/**
 * Get current tenant ID for multi-tenant support
 */
export function getCurrentTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TENANT_ID_KEY);
}

/**
 * Set current tenant ID
 */
export function setCurrentTenantId(tenantId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TENANT_ID_KEY, tenantId);
}

/**
 * Clear current tenant ID
 */
export function clearCurrentTenantId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TENANT_ID_KEY);
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
    if (process.env.NEXT_PUBLIC_COCKPIT_API_URL) {
      return process.env.NEXT_PUBLIC_COCKPIT_API_URL;
    }
  }

  // Fall back to environment config
  const env = detectEnvironment();
  const config = getEnvironmentConfig(env);
  return config.cockpit;
}

/**
 * Create the API client configuration for web-cockpit
 */
function createCockpitConfig(): ApiClientConfig {
  const baseUrl = getApiBaseUrl();
  const tokenStorage = new CockpitTokenStorage();

  return {
    baseUrl,
    timeout: 30000,
    retries: 3,
    tokenStorage,
    debug: process.env.NODE_ENV === 'development',
    // Add cockpit-specific headers
    defaultHeaders: {
      'X-Client-App': 'web-cockpit',
      'X-Client-Version': process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    },
    onAuthFailure: () => {
      // Clear tokens and redirect to login
      tokenStorage.clearTokens();
      clearCurrentTenantId();

      // Only redirect on client-side
      if (typeof window !== 'undefined') {
        // Dispatch custom event for auth failure
        window.dispatchEvent(
          new CustomEvent('auth:logout', { detail: { reason: 'token_expired' } })
        );

        // Redirect to login after a small delay
        setTimeout(() => {
          window.location.href =
            '/auth/login?redirect=' + encodeURIComponent(window.location.pathname);
        }, 100);
      }
    },
  };
}

// =============================================================================
// Client Instance
// =============================================================================

let apiClientInstance: BaseApiClient | null = null;

/**
 * Get the singleton API client instance
 */
export function getApiClient(): BaseApiClient {
  if (!apiClientInstance) {
    const config = createCockpitConfig();
    apiClientInstance = createApiClient(config);

    // Add request interceptor to include tenant ID
    const client = apiClientInstance.getAxiosInstance();
    client.interceptors.request.use((requestConfig) => {
      const tenantId = getCurrentTenantId();
      if (tenantId) {
        requestConfig.headers['X-Tenant-Id'] = tenantId;
      }
      return requestConfig;
    });
  }
  return apiClientInstance;
}

/**
 * Reset the API client (useful for testing or after logout)
 */
export function resetApiClient(): void {
  apiClientInstance = null;
}

// =============================================================================
// Auth Helpers
// =============================================================================

const tokenStorage = new CockpitTokenStorage();

/**
 * Set authentication tokens
 */
export function setAuthTokens(accessToken: string, refreshToken: string): void {
  tokenStorage.setTokens(accessToken, refreshToken);
}

/**
 * Clear authentication tokens
 */
export function clearAuthTokens(): void {
  tokenStorage.clearTokens();
  clearCurrentTenantId();
  resetApiClient();
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!tokenStorage.getAccessToken();
}

// =============================================================================
// Export the default client
// =============================================================================

export const apiClient = {
  get instance() {
    return getApiClient();
  },
  get: <T>(url: string, config?: Parameters<BaseApiClient['get']>[1]) =>
    getApiClient().get<T>(url, config),
  post: <T, D = unknown>(url: string, data?: D, config?: Parameters<BaseApiClient['post']>[2]) =>
    getApiClient().post<T, D>(url, data, config),
  put: <T, D = unknown>(url: string, data?: D, config?: Parameters<BaseApiClient['put']>[2]) =>
    getApiClient().put<T, D>(url, data, config),
  patch: <T, D = unknown>(url: string, data?: D, config?: Parameters<BaseApiClient['patch']>[2]) =>
    getApiClient().patch<T, D>(url, data, config),
  delete: <T>(url: string, config?: Parameters<BaseApiClient['delete']>[1]) =>
    getApiClient().delete<T>(url, config),
};
