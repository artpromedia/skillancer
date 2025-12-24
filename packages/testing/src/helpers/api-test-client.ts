/**
 * API Test Client
 *
 * Provides a structured way to make authenticated API requests in tests.
 */

import type { Express } from 'express';
import type { Response } from 'supertest';

// ==================== Types ====================

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface APITestClientOptions {
  baseUrl?: string;
  timeout?: number;
  defaultHeaders?: Record<string, string>;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean>;
  timeout?: number;
}

export interface APIResponse<T = unknown> {
  status: number;
  body: T;
  headers: Record<string, string | string[]>;
  responseTime: number;
}

// ==================== API Test Client ====================

/**
 * API test client for making authenticated requests
 *
 * @example
 * ```typescript
 * const client = new APITestClient(app);
 * await client.login({ email: 'test@example.com', password: 'password' });
 *
 * const response = await client.get('/api/users/me');
 * expect(response.status).toBe(200);
 * ```
 */
export class APITestClient {
  private app: Express;
  private tokens: AuthTokens | null = null;
  private options: Required<APITestClientOptions>;
  private supertestModule: typeof import('supertest') | null = null;

  constructor(app: Express, options: APITestClientOptions = {}) {
    this.app = app;
    this.options = {
      baseUrl: options.baseUrl || '',
      timeout: options.timeout || 30000,
      defaultHeaders: options.defaultHeaders || {},
    };
  }

  /**
   * Get supertest module (lazy load)
   */
  private async getSupertest() {
    if (!this.supertestModule) {
      this.supertestModule = await import('supertest');
    }
    return this.supertestModule.default;
  }

  /**
   * Log in and store tokens
   */
  async login(credentials: { email: string; password: string }): Promise<AuthTokens> {
    const response = await this.post('/api/auth/login', credentials);

    if (response.status !== 200) {
      throw new Error(`Login failed: ${JSON.stringify(response.body)}`);
    }

    const data = response.body as { data?: AuthTokens };
    if (!data.data?.accessToken) {
      throw new Error('Login response missing access token');
    }

    this.tokens = data.data;
    return this.tokens;
  }

  /**
   * Log out and clear tokens
   */
  async logout(): Promise<void> {
    if (this.tokens) {
      await this.post('/api/auth/logout');
    }
    this.tokens = null;
  }

  /**
   * Set tokens manually (for testing with pre-created tokens)
   */
  setTokens(tokens: AuthTokens): void {
    this.tokens = tokens;
  }

  /**
   * Clear tokens
   */
  clearTokens(): void {
    this.tokens = null;
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    return this.tokens?.accessToken ?? null;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.tokens !== null && !!this.tokens.accessToken;
  }

  /**
   * Make a GET request
   */
  async get<T = unknown>(path: string, options: RequestOptions = {}): Promise<APIResponse<T>> {
    return this.request<T>('get', path, undefined, options);
  }

  /**
   * Make a POST request
   */
  async post<T = unknown>(
    path: string,
    body?: unknown,
    options: RequestOptions = {}
  ): Promise<APIResponse<T>> {
    return this.request<T>('post', path, body, options);
  }

  /**
   * Make a PUT request
   */
  async put<T = unknown>(
    path: string,
    body?: unknown,
    options: RequestOptions = {}
  ): Promise<APIResponse<T>> {
    return this.request<T>('put', path, body, options);
  }

  /**
   * Make a PATCH request
   */
  async patch<T = unknown>(
    path: string,
    body?: unknown,
    options: RequestOptions = {}
  ): Promise<APIResponse<T>> {
    return this.request<T>('patch', path, body, options);
  }

  /**
   * Make a DELETE request
   */
  async delete<T = unknown>(path: string, options: RequestOptions = {}): Promise<APIResponse<T>> {
    return this.request<T>('delete', path, undefined, options);
  }

  /**
   * Make a file upload request
   */
  async upload<T = unknown>(
    path: string,
    file: {
      fieldName: string;
      buffer: Buffer;
      filename: string;
      contentType?: string;
    },
    additionalFields?: Record<string, string>,
    options: RequestOptions = {}
  ): Promise<APIResponse<T>> {
    const request = await this.getSupertest();
    const startTime = Date.now();

    let req = request(this.app)
      .post(`${this.options.baseUrl}${path}`)
      .attach(file.fieldName, file.buffer, {
        filename: file.filename,
        contentType: file.contentType || 'application/octet-stream',
      });

    // Add additional fields
    if (additionalFields) {
      for (const [key, value] of Object.entries(additionalFields)) {
        req = req.field(key, value);
      }
    }

    // Add headers
    req = this.applyHeaders(req, options.headers);

    const response = await req;
    const responseTime = Date.now() - startTime;

    return this.formatResponse<T>(response, responseTime);
  }

  /**
   * Make a request with custom method
   */
  private async request<T>(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    body?: unknown,
    options: RequestOptions = {}
  ): Promise<APIResponse<T>> {
    const request = await this.getSupertest();
    const startTime = Date.now();

    let req = request(this.app)[method](`${this.options.baseUrl}${path}`);

    // Add query parameters
    if (options.query) {
      req = req.query(options.query);
    }

    // Add headers
    req = this.applyHeaders(req, options.headers);

    // Add body
    if (body && method !== 'get') {
      req = req.send(body);
    }

    // Set timeout
    req = req.timeout(options.timeout || this.options.timeout);

    const response = await req;
    const responseTime = Date.now() - startTime;

    return this.formatResponse<T>(response, responseTime);
  }

  /**
   * Apply headers to a request
   */
  private applyHeaders(req: any, customHeaders?: Record<string, string>): any {
    // Apply default headers
    for (const [key, value] of Object.entries(this.options.defaultHeaders)) {
      req = req.set(key, value);
    }

    // Apply auth header
    if (this.tokens?.accessToken) {
      req = req.set('Authorization', `Bearer ${this.tokens.accessToken}`);
    }

    // Apply custom headers
    if (customHeaders) {
      for (const [key, value] of Object.entries(customHeaders)) {
        req = req.set(key, value);
      }
    }

    // Set content type for JSON
    req = req.set('Content-Type', 'application/json');

    return req;
  }

  /**
   * Format response
   */
  private formatResponse<T>(response: Response, responseTime: number): APIResponse<T> {
    return {
      status: response.status,
      body: response.body as T,
      headers: response.headers as Record<string, string | string[]>,
      responseTime,
    };
  }
}

// ==================== Factory Function ====================

/**
 * Create an API test client for an Express app
 */
export function createAPITestClient(app: Express, options?: APITestClientOptions): APITestClient {
  return new APITestClient(app, options);
}

// ==================== Request Builders ====================

/**
 * Build query string from object
 */
export function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParams.append(key, String(v)));
      } else {
        searchParams.set(key, String(value));
      }
    }
  }

  return searchParams.toString();
}

/**
 * Build pagination query params
 */
export function paginationParams(page: number, limit: number): Record<string, number> {
  return { page, limit };
}

/**
 * Build sort query params
 */
export function sortParams(
  field: string,
  direction: 'asc' | 'desc' = 'asc'
): Record<string, string> {
  return { sortBy: field, sortOrder: direction };
}

// ==================== Response Assertions ====================

/**
 * Assert successful response
 */
export function assertSuccess<T>(response: APIResponse<T>): void {
  expect(response.status).toBeGreaterThanOrEqual(200);
  expect(response.status).toBeLessThan(300);
}

/**
 * Assert error response
 */
export function assertError(response: APIResponse, expectedStatus: number): void {
  expect(response.status).toBe(expectedStatus);
  expect((response.body as any).success).toBe(false);
  expect((response.body as any).error).toBeDefined();
}

/**
 * Assert validation error
 */
export function assertValidationError(response: APIResponse, fields?: string[]): void {
  expect(response.status).toBe(400);
  const body = response.body as {
    success: boolean;
    error: { code: string; details?: Array<{ field: string }> };
  };
  expect(body.success).toBe(false);
  expect(body.error.code).toBe('VALIDATION_ERROR');

  if (fields && body.error.details) {
    const errorFields = body.error.details.map((d) => d.field);
    for (const field of fields) {
      expect(errorFields).toContain(field);
    }
  }
}

/**
 * Assert unauthorized error
 */
export function assertUnauthorized(response: APIResponse): void {
  expect(response.status).toBe(401);
}

/**
 * Assert forbidden error
 */
export function assertForbidden(response: APIResponse): void {
  expect(response.status).toBe(403);
}

/**
 * Assert not found error
 */
export function assertNotFound(response: APIResponse): void {
  expect(response.status).toBe(404);
}
