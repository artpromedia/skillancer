/**
 * @module @skillancer/service-client/base-client
 * Base HTTP client with retry, circuit breaker, and distributed tracing
 */

import gotClient, { type Got, type Response, type RequestError, type OptionsInit } from 'got';

import { type CircuitBreaker, CircuitOpenError, getCircuitBreaker } from './circuit-breaker.js';
import { logger } from './logger.js';
import { getContextHeaders, getRequestId, getServiceName } from './request-context.js';

// ============================================================================
// Types
// ============================================================================

export interface ServiceClientConfig {
  /** Base URL of the service */
  baseUrl: string;
  /** Service name for logging and circuit breaker */
  serviceName: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Number of retries */
  retries?: number;
  /** Retry delay in ms */
  retryDelay?: number;
  /** Circuit breaker configuration */
  circuitBreaker?: {
    enabled: boolean;
    threshold?: number;
    resetTimeout?: number;
    errorThresholdPercentage?: number;
    volumeThreshold?: number;
  };
  /** Default headers for all requests */
  defaultHeaders?: Record<string, string>;
  /** Bearer token for authentication */
  bearerToken?: string;
}

export interface RequestOptions {
  /** Skip circuit breaker for this request */
  skipCircuitBreaker?: boolean;
  /** Custom timeout for this request */
  timeout?: number;
  /** Custom retries for this request */
  retries?: number;
  /** Query parameters */
  searchParams?: Record<string, string | number | boolean> | URLSearchParams;
  /** Request body as JSON */
  json?: unknown;
  /** Request headers */
  headers?: Record<string, string>;
}

export interface ServiceResponse<T> {
  data: T;
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  duration: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Pagination {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// Custom Errors
// ============================================================================

export class ServiceClientError extends Error {
  readonly code: string;
  readonly statusCode: number | undefined;
  readonly serviceName: string;
  readonly requestId: string;
  readonly responseBody?: unknown;

  constructor(options: {
    message: string;
    code: string;
    statusCode?: number | undefined;
    serviceName: string;
    requestId: string;
    responseBody?: unknown;
    cause?: Error | undefined;
  }) {
    super(options.message);
    this.name = 'ServiceClientError';
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.serviceName = options.serviceName;
    this.requestId = options.requestId;
    this.responseBody = options.responseBody;
    if (options.cause) {
      this.cause = options.cause;
    }
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ServiceUnavailableError extends ServiceClientError {
  constructor(serviceName: string, requestId: string, cause?: Error) {
    super({
      message: `Service ${serviceName} is unavailable`,
      code: 'SERVICE_UNAVAILABLE',
      statusCode: 503,
      serviceName,
      requestId,
      cause,
    });
    this.name = 'ServiceUnavailableError';
  }
}

export class ServiceTimeoutError extends ServiceClientError {
  constructor(serviceName: string, requestId: string, cause?: Error) {
    super({
      message: `Request to ${serviceName} timed out`,
      code: 'SERVICE_TIMEOUT',
      statusCode: 504,
      serviceName,
      requestId,
      cause,
    });
    this.name = 'ServiceTimeoutError';
  }
}

// ============================================================================
// Base Service Client
// ============================================================================

export abstract class BaseServiceClient {
  protected readonly client: Got;
  protected readonly circuitBreaker?: CircuitBreaker;
  protected readonly serviceName: string;

  constructor(protected readonly config: ServiceClientConfig) {
    this.serviceName = config.serviceName;

    // Configure got client
    this.client = gotClient.extend({
      prefixUrl: config.baseUrl,
      timeout: { request: config.timeout ?? 30000 },
      retry: {
        limit: config.retries ?? 3,
        methods: ['GET', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
        statusCodes: [408, 429, 500, 502, 503, 504],
        calculateDelay: ({ attemptCount }: { attemptCount: number }) => {
          const delay = config.retryDelay ?? 1000;
          return attemptCount * delay;
        },
      },
      headers: {
        'user-agent': `skillancer-service-client/${getServiceName()}`,
        ...config.defaultHeaders,
      },
      hooks: {
        beforeRequest: [
          (options) => {
            // Add trace headers
            const contextHeaders = getContextHeaders();
            for (const [key, value] of Object.entries(contextHeaders)) {
              options.headers[key] = value;
            }

            // Add service name header
            options.headers['x-calling-service'] = getServiceName();

            // Add bearer token if configured
            if (config.bearerToken) {
              options.headers['authorization'] = `Bearer ${config.bearerToken}`;
            }
          },
        ],
        afterResponse: [
          (response) => {
            logger.debug(
              {
                service: this.serviceName,
                url: response.url,
                method: response.request.options.method,
                statusCode: response.statusCode,
                duration: response.timings.phases.total,
                requestId: response.request.options.headers['x-request-id'],
              },
              'Service call completed'
            );
            return response;
          },
        ],
        beforeError: [
          (error) => {
            logger.error(
              {
                service: this.serviceName,
                url: error.options?.url?.toString(),
                method: error.options?.method,
                message: error.message,
                code: error.code,
                requestId: error.options?.headers?.['x-request-id'],
              },
              'Service call failed'
            );
            return error;
          },
        ],
      },
    });

    // Set up circuit breaker
    if (config.circuitBreaker?.enabled) {
      const cbConfig: {
        threshold: number;
        resetTimeout: number;
        errorThresholdPercentage?: number;
        volumeThreshold?: number;
      } = {
        threshold: config.circuitBreaker.threshold ?? 5,
        resetTimeout: config.circuitBreaker.resetTimeout ?? 30000,
      };
      if (config.circuitBreaker.errorThresholdPercentage !== undefined) {
        cbConfig.errorThresholdPercentage = config.circuitBreaker.errorThresholdPercentage;
      }
      if (config.circuitBreaker.volumeThreshold !== undefined) {
        cbConfig.volumeThreshold = config.circuitBreaker.volumeThreshold;
      }
      this.circuitBreaker = getCircuitBreaker(config.serviceName, cbConfig);
    }
  }

  /**
   * Make a GET request
   */
  protected async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('get', path, options);
  }

  /**
   * Make a POST request
   */
  protected async post<T>(path: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('post', path, { ...options, json: data });
  }

  /**
   * Make a PUT request
   */
  protected async put<T>(path: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('put', path, { ...options, json: data });
  }

  /**
   * Make a PATCH request
   */
  protected async patch<T>(path: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('patch', path, { ...options, json: data });
  }

  /**
   * Make a DELETE request
   */
  protected async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('delete', path, options);
  }

  /**
   * Make a request with full response info
   */
  protected async requestWithResponse<T>(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    options?: RequestOptions
  ): Promise<ServiceResponse<T>> {
    const execute = async (): Promise<ServiceResponse<T>> => {
      const gotOptions: OptionsInit = {
        responseType: 'json',
      };
      if (options?.searchParams) {
        gotOptions.searchParams = options.searchParams as Record<string, string | number | boolean>;
      }
      if (options?.json) {
        gotOptions.json = options.json;
      }
      if (options?.headers) {
        gotOptions.headers = options.headers;
      }

      const response = (await this.client[method](path, gotOptions)) as Response<T>;

      return {
        data: response.body,
        statusCode: response.statusCode,
        headers: response.headers,
        duration: response.timings.phases.total ?? 0,
      };
    };

    return this.executeWithCircuitBreaker(execute, options?.skipCircuitBreaker);
  }

  /**
   * Core request method
   */
  protected async request<T>(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    options?: RequestOptions
  ): Promise<T> {
    const execute = async (): Promise<T> => {
      const gotOptions: OptionsInit = {
        responseType: 'json',
      };
      if (options?.searchParams) {
        gotOptions.searchParams = options.searchParams as Record<string, string | number | boolean>;
      }
      if (options?.json) {
        gotOptions.json = options.json;
      }
      if (options?.headers) {
        gotOptions.headers = options.headers;
      }

      const response = (await this.client[method](path, gotOptions)) as Response<T>;

      return response.body;
    };

    return this.executeWithCircuitBreaker(execute, options?.skipCircuitBreaker);
  }

  /**
   * Execute request with circuit breaker protection
   */
  private async executeWithCircuitBreaker<T>(
    fn: () => Promise<T>,
    skipCircuitBreaker?: boolean
  ): Promise<T> {
    const requestId = getRequestId();

    if (this.circuitBreaker && !skipCircuitBreaker) {
      try {
        return await this.circuitBreaker.execute(fn);
      } catch (error) {
        if (error instanceof CircuitOpenError) {
          throw new ServiceUnavailableError(this.serviceName, requestId, error);
        }
        this.handleError(error, requestId);
        throw error;
      }
    }

    try {
      return await fn();
    } catch (error) {
      this.handleError(error, requestId);
      throw error;
    }
  }

  /**
   * Handle and transform errors
   */
  private handleError(error: unknown, requestId: string): never {
    if (error instanceof ServiceClientError) {
      throw error;
    }

    const gotError = error as RequestError;

    // Timeout error
    if (gotError.code === 'ETIMEDOUT' || gotError.code === 'TIMEOUT') {
      throw new ServiceTimeoutError(this.serviceName, requestId, gotError);
    }

    // Connection errors
    if (
      gotError.code === 'ECONNREFUSED' ||
      gotError.code === 'ECONNRESET' ||
      gotError.code === 'ENOTFOUND'
    ) {
      throw new ServiceUnavailableError(this.serviceName, requestId, gotError);
    }

    // HTTP error responses
    if (gotError.response) {
      throw new ServiceClientError({
        message: `Service ${this.serviceName} returned ${gotError.response.statusCode}: ${gotError.message}`,
        code: `HTTP_${gotError.response.statusCode}`,
        statusCode: gotError.response.statusCode,
        serviceName: this.serviceName,
        requestId,
        responseBody: gotError.response.body,
        cause: gotError,
      });
    }

    // Unknown error
    throw new ServiceClientError({
      message: `Unknown error from ${this.serviceName}: ${gotError.message}`,
      code: 'UNKNOWN_ERROR',
      serviceName: this.serviceName,
      requestId,
      cause: gotError,
    });
  }

  /**
   * Get circuit breaker stats
   */
  getCircuitBreakerStats() {
    return this.circuitBreaker?.getStats();
  }

  /**
   * Check if circuit breaker is open
   */
  isCircuitOpen(): boolean {
    return this.circuitBreaker?.isOpen() ?? false;
  }

  /**
   * Build search params from pagination
   */
  protected buildPaginationParams(pagination?: Pagination): Record<string, string> {
    const params: Record<string, string> = {};

    if (pagination?.page) {
      params['page'] = String(pagination.page);
    }
    if (pagination?.pageSize) {
      params['pageSize'] = String(pagination.pageSize);
    }
    if (pagination?.sortBy) {
      params['sortBy'] = pagination.sortBy;
    }
    if (pagination?.sortOrder) {
      params['sortOrder'] = pagination.sortOrder;
    }

    return params;
  }
}
