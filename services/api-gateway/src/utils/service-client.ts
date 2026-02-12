/**
 * @module @skillancer/api-gateway/utils/service-client
 * HTTP client for making requests to downstream services
 */

import { getCircuitBreaker, TimeoutError, type CircuitBreakerOptions } from './circuit-breaker.js';
import { getConfig } from '../config/index.js';
import { getServiceUrl } from '../config/routes.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ServiceRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  retries?: number;
  /** Skip circuit breaker (use with caution) */
  skipCircuitBreaker?: boolean;
}

export interface ServiceResponse<T = unknown> {
  status: number;
  headers: Headers;
  data: T;
}

export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly serviceName: string,
    public readonly statusCode?: number,
    public readonly responseBody?: unknown
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

// ============================================================================
// SERVICE CLIENT
// ============================================================================

/**
 * Make a request to a downstream service with circuit breaker protection
 */
export async function fetchFromService<T = unknown>(
  serviceName: string,
  path: string,
  options: ServiceRequestOptions = {}
): Promise<T> {
  const baseUrl = getServiceUrl(serviceName);
  if (!baseUrl) {
    throw new ServiceError(`Unknown service: ${serviceName}`, serviceName);
  }

  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const config = getConfig();

  const circuitBreakerOptions: Partial<CircuitBreakerOptions> = {
    timeout: options.timeout ?? config.circuitBreaker.timeout,
    errorThresholdPercentage: config.circuitBreaker.errorThresholdPercentage,
    resetTimeout: config.circuitBreaker.resetTimeout,
    volumeThreshold: config.circuitBreaker.volumeThreshold,
  };

  const makeRequest = async (): Promise<T> => {
    const controller = new AbortController();
    const timeout = options.timeout ?? 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const fetchOptions: RequestInit = {
        method: options.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      };

      if (options.body) {
        fetchOptions.body = JSON.stringify(options.body);
      }

      const response = await fetch(url, fetchOptions);

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => null);
        let parsedError: unknown;
        try {
          parsedError = errorBody ? JSON.parse(errorBody) : null;
        } catch {
          parsedError = errorBody;
        }

        throw new ServiceError(
          `Service ${serviceName} returned ${response.status}`,
          serviceName,
          response.status,
          parsedError
        );
      }

      const data = (await response.json()) as T;
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ServiceError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new TimeoutError(`Request to ${serviceName} timed out after ${timeout}ms`);
        }
        throw new ServiceError(error.message, serviceName);
      }

      throw new ServiceError('Unknown error occurred', serviceName);
    }
  };

  // Execute with circuit breaker
  if (options.skipCircuitBreaker) {
    return makeRequest();
  }

  const breaker = getCircuitBreaker(serviceName, circuitBreakerOptions);
  return breaker.execute(makeRequest);
}

/**
 * Make parallel requests to multiple services
 */
export async function fetchFromServices<T extends Record<string, unknown>>(
  requests: Array<{
    key: keyof T;
    serviceName: string;
    path: string;
    options?: ServiceRequestOptions;
    /** Default value if request fails */
    defaultValue?: unknown;
  }>
): Promise<T> {
  const results = await Promise.allSettled(
    requests.map(async (req) => {
      try {
        const data = await fetchFromService(req.serviceName, req.path, req.options);
        return { key: req.key, data };
      } catch (error) {
        if (req.defaultValue !== undefined) {
          return { key: req.key, data: req.defaultValue };
        }
        throw error;
      }
    })
  );

  const response = {} as T;
  const errors: Error[] = [];

  results.forEach((result, _index) => {
    if (result.status === 'fulfilled') {
      const { key, data } = result.value;
      response[key] = data as T[keyof T];
    } else {
      errors.push(result.reason as Error);
    }
  });

  if (errors.length > 0 && Object.keys(response).length === 0) {
    throw new AggregateServiceError('All service requests failed', errors);
  }

  return response;
}

/**
 * Check if a service is available (circuit is not open)
 */
export function isServiceAvailable(serviceName: string): boolean {
  const breaker = getCircuitBreaker(serviceName);
  return breaker.isAvailable();
}

// ============================================================================
// ERRORS
// ============================================================================

export class AggregateServiceError extends Error {
  constructor(
    message: string,
    public readonly errors: Error[]
  ) {
    super(message);
    this.name = 'AggregateServiceError';
  }
}
