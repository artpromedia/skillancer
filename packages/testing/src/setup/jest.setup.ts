/**
 * Jest Setup File
 *
 * Global setup for all Jest tests across the Skillancer platform.
 */

import { beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import 'jest-extended';

// ==================== Global Configuration ====================

// Set default timeout
jest.setTimeout(30000);

// ==================== Custom Matchers ====================

expect.extend({
  /**
   * Check if a number is within a range
   */
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return {
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be within range ${floor} - ${ceiling}`,
      pass,
    };
  },

  /**
   * Check if an API response matches expected shape
   */
  toMatchAPIResponse(
    received: { status: number; body?: unknown },
    expected: { status: number; body?: unknown }
  ) {
    const statusMatch = received.status === expected.status;
    const bodyMatch = expected.body
      ? JSON.stringify(received.body) === JSON.stringify(expected.body)
      : true;

    return {
      message: () =>
        `expected API response to match:\n` +
        `Status: ${expected.status} (got ${received.status})\n` +
        (expected.body
          ? `Body: ${JSON.stringify(expected.body)} (got ${JSON.stringify(received.body)})`
          : ''),
      pass: statusMatch && bodyMatch,
    };
  },

  /**
   * Check if a value is a valid UUID
   */
  toBeUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid UUID`,
      pass,
    };
  },

  /**
   * Check if a date string is valid ISO format
   */
  toBeISODate(received: string) {
    const date = new Date(received);
    const pass = !isNaN(date.getTime()) && received === date.toISOString();
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid ISO date string`,
      pass,
    };
  },

  /**
   * Check if response time is within acceptable range
   */
  toRespondWithin(received: number, maxMs: number) {
    const pass = received <= maxMs;
    return {
      message: () =>
        `expected response time ${received}ms ${pass ? 'not ' : ''}to be within ${maxMs}ms`,
      pass,
    };
  },
});

// ==================== Type Declarations ====================

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toMatchAPIResponse(expected: { status: number; body?: unknown }): R;
      toBeUUID(): R;
      toBeISODate(): R;
      toRespondWithin(maxMs: number): R;
    }
  }
}

// ==================== Console Handling ====================

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Fail tests on React warnings in development
if (process.env.NODE_ENV !== 'production') {
  console.error = (...args: unknown[]) => {
    const message = args[0];
    if (
      typeof message === 'string' &&
      (message.includes('Warning: ') || message.includes('Error: '))
    ) {
      // Don't throw on expected warnings in tests
      if (
        message.includes('act(') ||
        message.includes('Not wrapped in act') ||
        message.includes('validateDOMNesting')
      ) {
        originalConsoleError.apply(console, args);
        return;
      }
      throw new Error(args.join(' '));
    }
    originalConsoleError.apply(console, args);
  };
}

// Suppress specific warnings
console.warn = (...args: unknown[]) => {
  const message = args[0];
  if (typeof message === 'string') {
    // Filter out known warnings that are safe to ignore
    if (message.includes('deprecated') || message.includes('Warning: componentWillReceiveProps')) {
      return;
    }
  }
  originalConsoleWarn.apply(console, args);
};

// ==================== Environment Setup ====================

beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests
});

afterEach(() => {
  // Clear all mocks after each test
  jest.clearAllMocks();
});

afterAll(async () => {
  // Restore console
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;

  // Allow time for cleanup
  await new Promise((resolve) => setTimeout(resolve, 100));
});

// ==================== Global Test Utilities ====================

/**
 * Wait for a specified number of milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await wait(interval);
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Retry a function until it succeeds or max retries reached
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; delay?: number } = {}
): Promise<T> {
  const { maxRetries = 3, delay = 1000 } = options;
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await wait(delay);
      }
    }
  }

  throw lastError;
}
