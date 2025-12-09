/**
 * @module @skillancer/service-template/utils/http
 * HTTP utilities for service communication
 */

import type { Logger } from 'pino';

// ============================================================================
// TYPES
// ============================================================================

export interface HttpClientOptions {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
  logger?: Logger;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  signal?: AbortSignal;
}

export interface HttpResponse<T = unknown> {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Headers;
  data: T;
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

/**
 * Create an HTTP client for service-to-service communication
 */
export function createHttpClient(options: HttpClientOptions) {
  const { baseUrl, timeout = 30000, headers: defaultHeaders = {}, logger } = options;

  async function request<T>(
    path: string,
    requestOptions: RequestOptions = {}
  ): Promise<HttpResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout: requestTimeout = timeout,
      signal,
    } = requestOptions;

    const url = `${baseUrl}${path}`;
    const start = Date.now();

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

    const combinedSignal = signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...defaultHeaders,
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: combinedSignal,
      });

      const duration = Date.now() - start;

      logger?.debug({ method, url, status: response.status, duration }, 'HTTP request completed');

      const data = await parseResponse<T>(response);

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data,
      };
    } catch (error) {
      const duration = Date.now() - start;

      logger?.error({ method, url, duration, err: error }, 'HTTP request failed');

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    request,
    get: async <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...options, method: 'GET' }),
    post: async <T>(
      path: string,
      body?: unknown,
      options?: Omit<RequestOptions, 'method' | 'body'>
    ) => request<T>(path, { ...options, method: 'POST', body }),
    put: async <T>(
      path: string,
      body?: unknown,
      options?: Omit<RequestOptions, 'method' | 'body'>
    ) => request<T>(path, { ...options, method: 'PUT', body }),
    patch: async <T>(
      path: string,
      body?: unknown,
      options?: Omit<RequestOptions, 'method' | 'body'>
    ) => request<T>(path, { ...options, method: 'PATCH', body }),
    delete: async <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...options, method: 'DELETE' }),
  };
}

/**
 * Parse response body based on content type
 */
async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }

  if (contentType.includes('text/')) {
    return response.text() as unknown as T;
  }

  // For other content types, return as blob
  return response.blob() as unknown as T;
}

// ============================================================================
// RETRY UTILITIES
// ============================================================================

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryOn?: (error: Error, attempt: number) => boolean;
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    retryOn = () => true,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries || !retryOn(lastError, attempt)) {
        throw lastError;
      }

      await sleep(delay);
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError;
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  halfOpenRequests?: number;
}

type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Create a circuit breaker for external service calls
 */
export function createCircuitBreaker(options: CircuitBreakerOptions = {}) {
  const { failureThreshold = 5, resetTimeout = 30000, halfOpenRequests = 1 } = options;

  let state: CircuitState = 'closed';
  let failures = 0;
  let lastFailureTime = 0;
  let halfOpenSuccesses = 0;

  function reset() {
    state = 'closed';
    failures = 0;
    halfOpenSuccesses = 0;
  }

  function trip() {
    state = 'open';
    lastFailureTime = Date.now();
  }

  async function execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we should transition from open to half-open
    if (state === 'open') {
      const timeSinceLastFailure = Date.now() - lastFailureTime;
      if (timeSinceLastFailure >= resetTimeout) {
        state = 'half-open';
        halfOpenSuccesses = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();

      // Success handling
      if (state === 'half-open') {
        halfOpenSuccesses++;
        if (halfOpenSuccesses >= halfOpenRequests) {
          reset();
        }
      } else {
        failures = 0;
      }

      return result;
    } catch (error) {
      failures++;

      if (state === 'half-open' || failures >= failureThreshold) {
        trip();
      }

      throw error;
    }
  }

  return {
    execute,
    getState: () => state,
    reset,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Sleep for specified milliseconds
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Timeout a promise
 */
export async function timeout<T>(
  promise: Promise<T>,
  ms: number,
  message = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

/**
 * Build query string from object
 */
export function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, String(item));
      }
    } else {
      searchParams.append(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Parse query string to object
 */
export function parseQueryString(queryString: string): Record<string, string | string[]> {
  const params = new URLSearchParams(queryString.replace(/^\?/, ''));
  const result: Record<string, string | string[]> = {};

  params.forEach((value, key) => {
    const existing = result[key];
    if (existing !== undefined) {
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        result[key] = [existing, value];
      }
    } else {
      result[key] = value;
    }
  });

  return result;
}

// ============================================================================
// EXPORTS
// ============================================================================

export type HttpClient = ReturnType<typeof createHttpClient>;
export type CircuitBreaker = ReturnType<typeof createCircuitBreaker>;
