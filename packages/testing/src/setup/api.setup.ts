/**
 * API Testing Setup
 *
 * Setup file for API/integration testing with supertest and MSW.
 */

import { beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import { rest, type RestHandler } from 'msw';
import { setupServer } from 'msw/node';

import type { Express } from 'express';

// ==================== Global Configuration ====================

// Extended timeout for API tests
jest.setTimeout(45000);

// ==================== MSW Server Setup ====================

// Default handlers that can be overridden in tests
const defaultHandlers: RestHandler[] = [];

export const mswServer = setupServer(...defaultHandlers);

// Start MSW server before all tests
beforeAll(() => {
  mswServer.listen({
    onUnhandledRequest: 'warn',
  });
});

// Reset handlers after each test
afterEach(() => {
  mswServer.resetHandlers();
});

// Close MSW server after all tests
afterAll(() => {
  mswServer.close();
});

// ==================== API Test Utilities ====================

/**
 * Add mock API handlers for a test
 */
export function addMockHandlers(...handlers: RestHandler[]) {
  mswServer.use(...handlers);
}

/**
 * Create a mock REST handler
 */
export function createMockHandler(
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
  response: unknown,
  status: number = 200
) {
  return rest[method](path, (_req, res, ctx) => {
    return res(ctx.status(status), ctx.json(response));
  });
}

/**
 * Create a mock error handler
 */
export function createMockErrorHandler(
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
  error: { message: string; code?: string },
  status: number = 500
) {
  return rest[method](path, (_req, res, ctx) => {
    return res(
      ctx.status(status),
      ctx.json({
        success: false,
        error,
      })
    );
  });
}

/**
 * Create a mock handler with delay
 */
export function createDelayedHandler(
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
  response: unknown,
  delayMs: number = 1000
) {
  return rest[method](path, async (_req, res, ctx) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return res(ctx.json(response));
  });
}

// ==================== Request Tracking ====================

interface TrackedRequest {
  method: string;
  url: string;
  body: unknown;
  headers: Record<string, string>;
  timestamp: Date;
}

const trackedRequests: TrackedRequest[] = [];

/**
 * Track all requests made during a test
 */
export function enableRequestTracking() {
  mswServer.use(
    rest.all('*', (req, res, ctx) => {
      trackedRequests.push({
        method: req.method,
        url: req.url.toString(),
        body: req.body,
        headers: Object.fromEntries(req.headers.entries()),
        timestamp: new Date(),
      });
      // Continue with normal handling
      return res(ctx.passthrough());
    })
  );
}

/**
 * Get tracked requests
 */
export function getTrackedRequests() {
  return [...trackedRequests];
}

/**
 * Clear tracked requests
 */
export function clearTrackedRequests() {
  trackedRequests.length = 0;
}

// ==================== Supertest Helpers ====================

/**
 * Create a supertest agent with authentication
 */
export async function createAuthenticatedAgent(
  app: Express,
  credentials: { email: string; password: string }
) {
  const { default: request } = await import('supertest');
  const agent = request.agent(app);

  // Perform login
  const response = await agent.post('/api/auth/login').send(credentials).expect(200);

  // Store token if present
  const token = response.body.data?.accessToken;
  if (token) {
    (agent as any)._authToken = token;
  }

  return {
    agent,
    token,
    user: response.body.data?.user,
    /**
     * Make authenticated GET request
     */
    get: (path: string) => agent.get(path).set('Authorization', `Bearer ${token}`),
    /**
     * Make authenticated POST request
     */
    post: (path: string, body?: unknown) =>
      agent.post(path).set('Authorization', `Bearer ${token}`).send(body),
    /**
     * Make authenticated PUT request
     */
    put: (path: string, body?: unknown) =>
      agent.put(path).set('Authorization', `Bearer ${token}`).send(body),
    /**
     * Make authenticated PATCH request
     */
    patch: (path: string, body?: unknown) =>
      agent.patch(path).set('Authorization', `Bearer ${token}`).send(body),
    /**
     * Make authenticated DELETE request
     */
    delete: (path: string) => agent.delete(path).set('Authorization', `Bearer ${token}`),
  };
}

/**
 * Assert API response matches expected structure
 */
export function assertAPIResponse(
  response: { status: number; body: unknown },
  expected: {
    status: number;
    success?: boolean;
    hasData?: boolean;
    hasError?: boolean;
  }
) {
  expect(response.status).toBe(expected.status);

  const body = response.body as Record<string, unknown>;

  if (expected.success !== undefined) {
    expect(body.success).toBe(expected.success);
  }

  if (expected.hasData) {
    expect(body.data).toBeDefined();
  }

  if (expected.hasError) {
    expect(body.error).toBeDefined();
  }
}

/**
 * Assert paginated response structure
 */
export function assertPaginatedResponse(
  body: unknown,
  expected: { page?: number; limit?: number; minTotal?: number }
) {
  const response = body as {
    data: unknown[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };

  expect(Array.isArray(response.data)).toBe(true);
  expect(response.pagination).toBeDefined();
  expect(typeof response.pagination.page).toBe('number');
  expect(typeof response.pagination.limit).toBe('number');
  expect(typeof response.pagination.total).toBe('number');
  expect(typeof response.pagination.totalPages).toBe('number');

  if (expected.page !== undefined) {
    expect(response.pagination.page).toBe(expected.page);
  }

  if (expected.limit !== undefined) {
    expect(response.pagination.limit).toBe(expected.limit);
  }

  if (expected.minTotal !== undefined) {
    expect(response.pagination.total).toBeGreaterThanOrEqual(expected.minTotal);
  }
}

// ==================== Response Time Tracking ====================

/**
 * Measure API response time
 */
export async function measureResponseTime(
  requestFn: () => Promise<unknown>
): Promise<{ result: unknown; durationMs: number }> {
  const start = Date.now();
  const result = await requestFn();
  const durationMs = Date.now() - start;
  return { result, durationMs };
}

/**
 * Assert response time is within limit
 */
export async function assertResponseTimeWithin(requestFn: () => Promise<unknown>, maxMs: number) {
  const { durationMs } = await measureResponseTime(requestFn);
  expect(durationMs).toBeLessThanOrEqual(maxMs);
}
