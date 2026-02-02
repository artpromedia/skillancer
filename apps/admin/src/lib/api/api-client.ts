/**
 * Admin API Client
 *
 * Admin-specific API client configuration with elevated permission headers.
 * This client includes admin-specific interceptors and token management.
 */

import { createApiClient, type ApiClientOptions } from '@skillancer/shared-api-client';

// =============================================================================
// Configuration
// =============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
const CLIENT_APP_NAME = 'skillancer-admin';

// =============================================================================
// Admin Token Storage
// =============================================================================

/**
 * Admin-specific token storage with elevated access token management
 */
class AdminTokenStorage {
  private static ACCESS_TOKEN_KEY = 'admin_access_token';
  private static REFRESH_TOKEN_KEY = 'admin_refresh_token';
  private static ADMIN_SESSION_KEY = 'admin_session_id';

  static getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  static getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  static getSessionId(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(this.ADMIN_SESSION_KEY);
  }

  static setTokens(accessToken: string, refreshToken?: string, sessionId?: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    }
    if (sessionId) {
      sessionStorage.setItem(this.ADMIN_SESSION_KEY, sessionId);
    }
  }

  static clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(this.ADMIN_SESSION_KEY);
  }
}

// =============================================================================
// API Client Instance
// =============================================================================

let apiClientInstance: ReturnType<typeof createApiClient> | null = null;

/**
 * Get or create the admin API client instance
 */
export function getApiClient() {
  if (apiClientInstance) {
    return apiClientInstance;
  }

  const options: ApiClientOptions = {
    baseURL: API_BASE_URL,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,

    getAccessToken: () => AdminTokenStorage.getAccessToken(),
    getRefreshToken: () => AdminTokenStorage.getRefreshToken(),

    onTokenRefresh: async (newAccessToken: string, newRefreshToken?: string) => {
      AdminTokenStorage.setTokens(newAccessToken, newRefreshToken);
    },

    onAuthError: () => {
      AdminTokenStorage.clearTokens();
      // Redirect to admin login
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    },
  };

  apiClientInstance = createApiClient(options);

  // Add admin-specific request interceptor for elevated permissions
  const axiosInstance = apiClientInstance.getAxiosInstance();

  axiosInstance.interceptors.request.use((config) => {
    // Add client app header
    config.headers['X-Client-App'] = CLIENT_APP_NAME;

    // Add admin role header for elevated permissions
    config.headers['X-Admin-Role'] = 'true';

    // Add admin session ID if available
    const sessionId = AdminTokenStorage.getSessionId();
    if (sessionId) {
      config.headers['X-Admin-Session'] = sessionId;
    }

    // Add request timestamp for audit logging
    config.headers['X-Request-Timestamp'] = new Date().toISOString();

    return config;
  });

  // Add response interceptor for admin-specific error handling
  axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
      // Handle admin-specific errors
      if (error.response?.status === 403) {
        // Forbidden - insufficient admin privileges
        console.error('Admin access denied:', error.response?.data?.message);

        // Could trigger a permissions error UI here
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('admin:permission-denied', {
            detail: { message: error.response?.data?.message },
          });
          window.dispatchEvent(event);
        }
      }

      if (error.response?.status === 423) {
        // Locked - admin action requires additional verification
        console.error('Admin action locked:', error.response?.data?.message);

        if (typeof window !== 'undefined') {
          const event = new CustomEvent('admin:verification-required', {
            detail: {
              message: error.response?.data?.message,
              verificationUrl: error.response?.data?.verificationUrl,
            },
          });
          window.dispatchEvent(event);
        }
      }

      return Promise.reject(error);
    }
  );

  return apiClientInstance;
}

/**
 * Reset the API client instance (useful for testing or logout)
 */
export function resetApiClient(): void {
  apiClientInstance = null;
}

// =============================================================================
// Auth Helpers
// =============================================================================

/**
 * Set auth tokens for the admin user
 */
export function setAuthTokens(
  accessToken: string,
  refreshToken?: string,
  sessionId?: string
): void {
  AdminTokenStorage.setTokens(accessToken, refreshToken, sessionId);
}

/**
 * Clear auth tokens (logout)
 */
export function clearAuthTokens(): void {
  AdminTokenStorage.clearTokens();
  resetApiClient();
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!AdminTokenStorage.getAccessToken();
}

/**
 * Get current session ID
 */
export function getSessionId(): string | null {
  return AdminTokenStorage.getSessionId();
}

// =============================================================================
// Admin-Specific Utilities
// =============================================================================

/**
 * Perform an action with audit logging
 * Wraps API calls with admin audit context
 */
export async function withAuditContext<T>(
  action: string,
  resource: string,
  resourceId: string | undefined,
  apiCall: () => Promise<T>
): Promise<T> {
  const client = getApiClient();
  const axiosInstance = client.getAxiosInstance();

  // Add audit headers temporarily
  const originalInterceptor = axiosInstance.interceptors.request.use((config) => {
    config.headers['X-Audit-Action'] = action;
    config.headers['X-Audit-Resource'] = resource;
    if (resourceId) {
      config.headers['X-Audit-Resource-Id'] = resourceId;
    }
    return config;
  });

  try {
    return await apiCall();
  } finally {
    // Remove the temporary interceptor
    axiosInstance.interceptors.request.eject(originalInterceptor);
  }
}

/**
 * Request elevated permissions for sensitive actions
 */
export async function requestElevatedPermissions(
  action: string,
  reason: string
): Promise<{ granted: boolean; expiresAt?: string }> {
  const client = getApiClient();
  return client.post<{ granted: boolean; expiresAt?: string }>('/admin/permissions/elevate', {
    action,
    reason,
  });
}
