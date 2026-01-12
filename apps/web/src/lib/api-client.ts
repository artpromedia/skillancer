/**
 * API Client for web application
 *
 * Provides a typed interface for making API requests using the shared
 * @skillancer/api-client package with proper authentication handling.
 */

import {
  ApiClient,
  createApiClient,
  ExecutiveApiClient,
  IntegrationsApiClient,
  createIntegrationsClient,
} from '@skillancer/api-client';

// ===========================================
// CONFIGURATION
// ===========================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
const DEFAULT_TIMEOUT = 30000;

// ===========================================
// AUTH TOKEN MANAGEMENT
// ===========================================

let authToken: string | null = null;

/**
 * Set the authentication token for API requests
 */
export function setAuthToken(token: string | null): void {
  authToken = token;
  if (sharedClient) {
    if (token) {
      sharedClient.setToken(token);
    } else {
      sharedClient.clearToken();
    }
  }
}

/**
 * Get the current authentication token
 */
export function getAuthToken(): string | null {
  // In browser, try to get from localStorage if not set
  if (typeof window !== 'undefined' && !authToken) {
    const stored = localStorage.getItem('skillancer_auth_token');
    if (stored) {
      authToken = stored;
    }
  }
  return authToken;
}

/**
 * Clear the authentication token
 */
export function clearAuthToken(): void {
  authToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('skillancer_auth_token');
  }
  if (sharedClient) {
    sharedClient.clearToken();
  }
}

// ===========================================
// API ERROR HANDLING
// ===========================================

export interface ApiErrorDetails {
  status: number;
  statusText: string;
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly code: string | undefined;
  public readonly errors: Record<string, string[]> | undefined;

  constructor(details: ApiErrorDetails) {
    super(details.message);
    this.name = 'ApiError';
    this.status = details.status;
    this.statusText = details.statusText;
    this.code = details.code;
    this.errors = details.errors;
  }

  static isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
  }

  static isUnauthorized(error: unknown): boolean {
    return ApiError.isApiError(error) && error.status === 401;
  }

  static isForbidden(error: unknown): boolean {
    return ApiError.isApiError(error) && error.status === 403;
  }

  static isNotFound(error: unknown): boolean {
    return ApiError.isApiError(error) && error.status === 404;
  }

  static isValidationError(error: unknown): boolean {
    return ApiError.isApiError(error) && error.status === 422;
  }
}

// ===========================================
// SHARED CLIENT INSTANCE
// ===========================================

let sharedClient: ApiClient | null = null;

/**
 * Get or create the shared API client instance
 */
function getClient(): ApiClient {
  if (!sharedClient) {
    const token = getAuthToken();
    sharedClient = createApiClient({
      baseUrl: API_BASE_URL,
      timeout: DEFAULT_TIMEOUT,
      ...(token && { token }),
    });
  }
  return sharedClient;
}

// ===========================================
// FETCH OPTIONS INTERFACE (for backward compatibility)
// ===========================================

interface FetchOptions {
  headers?: Record<string, string>;
  cache?: RequestCache;
}

// ===========================================
// WRAPPED API CLIENT WITH ERROR HANDLING
// ===========================================

/**
 * Wrapper that provides backward-compatible interface with enhanced error handling
 */
async function handleRequest<T>(requestFn: () => Promise<T>): Promise<T> {
  try {
    return await requestFn();
  } catch (error: unknown) {
    // Handle axios errors
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as {
        response?: {
          status: number;
          statusText: string;
          data?: { message?: string; code?: string; errors?: Record<string, string[]> };
        };
        message: string;
      };

      if (axiosError.response) {
        const { status, statusText, data } = axiosError.response;

        // Handle 401 - clear token and redirect if in browser
        if (status === 401) {
          clearAuthToken();
          if (typeof window !== 'undefined') {
            // Dispatch event for auth state listeners
            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
          }
        }

        const errorDetails: ApiErrorDetails = {
          status,
          statusText,
          message: data?.message || `API Error: ${status} ${statusText}`,
        };
        if (data?.code) {
          errorDetails.code = data.code;
        }
        if (data?.errors) {
          errorDetails.errors = data.errors;
        }
        throw new ApiError(errorDetails);
      }
    }

    // Handle network errors
    if (error instanceof Error) {
      throw new ApiError({
        status: 0,
        statusText: 'Network Error',
        message: error.message || 'A network error occurred',
      });
    }

    // Unknown error
    throw new ApiError({
      status: 0,
      statusText: 'Unknown Error',
      message: 'An unexpected error occurred',
    });
  }
}

// ===========================================
// EXPORTED API CLIENT
// ===========================================

interface ApiClientInterface {
  get<T>(path: string, options?: FetchOptions): Promise<T>;
  post<T, D = unknown>(path: string, data?: D, options?: FetchOptions): Promise<T>;
  put<T, D = unknown>(path: string, data?: D, options?: FetchOptions): Promise<T>;
  patch<T, D = unknown>(path: string, data?: D, options?: FetchOptions): Promise<T>;
  delete<T>(path: string, options?: FetchOptions): Promise<T>;
}

export const apiClient: ApiClientInterface = {
  async get<T>(path: string, options?: FetchOptions): Promise<T> {
    return handleRequest(() =>
      getClient().get<T>(path, options?.headers ? { headers: options.headers } : undefined)
    );
  },

  async post<T, D = unknown>(path: string, data?: D, options?: FetchOptions): Promise<T> {
    return handleRequest(() =>
      getClient().post<T>(path, data, options?.headers ? { headers: options.headers } : undefined)
    );
  },

  async put<T, D = unknown>(path: string, data?: D, options?: FetchOptions): Promise<T> {
    return handleRequest(() =>
      getClient().put<T>(path, data, options?.headers ? { headers: options.headers } : undefined)
    );
  },

  async patch<T, D = unknown>(path: string, data?: D, options?: FetchOptions): Promise<T> {
    return handleRequest(() =>
      getClient().patch<T>(path, data, options?.headers ? { headers: options.headers } : undefined)
    );
  },

  async delete<T>(path: string, options?: FetchOptions): Promise<T> {
    return handleRequest(() =>
      getClient().delete<T>(path, options?.headers ? { headers: options.headers } : undefined)
    );
  },
};

// ===========================================
// SPECIALIZED API CLIENTS
// ===========================================

/**
 * Get the Executive API client for executive-specific operations
 */
export function getExecutiveClient(): ExecutiveApiClient {
  return new ExecutiveApiClient(getClient());
}

/**
 * Get the Integrations API client for integration-specific operations
 */
export function getIntegrationsClient(): IntegrationsApiClient {
  return createIntegrationsClient(getClient());
}

// ===========================================
// RE-EXPORTS
// ===========================================

export type {
  ApiClientConfig,
} from '@skillancer/api-client';

export {
  ExecutiveApiClient,
  IntegrationsApiClient,
} from '@skillancer/api-client';

// Re-export types from executive client
export type {
  ExecutiveEngagement,
  ExecutiveWorkspace,
  ExecutiveTimeEntry,
  ExecutiveCapacity,
  TimeSummary,
  WeeklyTimesheet,
  WidgetPosition,
  PinnedDocument,
  PinnedLink,
  ExecutiveRole,
  EngagementStatus,
  BillingModel,
  TimeCategory,
  TimeEntryStatus,
  CreateEngagementInput,
  UpdateEngagementInput,
  CreateTimeEntryInput,
  UpdateTimeEntryInput,
} from '@skillancer/api-client';

// Re-export types from integrations client
export type {
  IntegrationCategory,
  IntegrationTier,
  IntegrationStatus,
  SyncStatus,
  IntegrationType,
  WorkspaceIntegration,
  WidgetData,
  ConnectResponse,
  TestResult,
  SyncResult,
  WidgetDefinition,
} from '@skillancer/api-client';
