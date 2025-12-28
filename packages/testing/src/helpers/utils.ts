/**
 * Test Utilities
 *
 * Common utility functions for testing.
 */

import { faker } from '@faker-js/faker';

// ==================== Time Utilities ====================

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
  options: { timeout?: number; interval?: number; message?: string } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100, message = 'Condition not met' } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await wait(interval);
  }

  throw new Error(`${message} within ${timeout}ms`);
}

/**
 * Wait for all promises to settle and return results
 */
export async function waitForAll<T>(
  promises: Promise<T>[],
  options: { timeout?: number } = {}
): Promise<PromiseSettledResult<T>[]> {
  const { timeout = 30000 } = options;

  return Promise.race([
    Promise.allSettled(promises),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`waitForAll timed out after ${timeout}ms`)), timeout)
    ),
  ]);
}

// ==================== Retry Utilities ====================

export interface RetryOptions {
  maxRetries?: number;
  delay?: number;
  backoff?: 'linear' | 'exponential';
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Retry a function until it succeeds or max retries reached
 */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxRetries = 3, delay = 1000, backoff = 'linear', onRetry } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        onRetry?.(attempt, lastError);
        const waitTime = backoff === 'exponential' ? delay * Math.pow(2, attempt - 1) : delay;
        await wait(waitTime);
      }
    }
  }

  throw lastError;
}

// ==================== Mock Utilities ====================

/**
 * Create a mock function that returns sequential values
 */
export function mockSequence<T>(...values: T[]): jest.Mock<T, []> {
  let index = 0;
  return jest.fn(() => {
    if (index < values.length) {
      return values[index++];
    }
    return values[values.length - 1];
  });
}

/**
 * Create a mock function that throws on first N calls then succeeds
 */
export function mockFailThenSucceed<T>(
  failures: number,
  error: Error,
  successValue: T
): jest.Mock<T, []> {
  let callCount = 0;
  return jest.fn(() => {
    callCount++;
    if (callCount <= failures) {
      throw error;
    }
    return successValue;
  });
}

/**
 * Create a mock async function with configurable delay
 */
export function mockAsync<T>(value: T, delay: number = 0): jest.Mock<Promise<T>, []> {
  return jest.fn(async () => {
    if (delay > 0) {
      await wait(delay);
    }
    return value;
  });
}

// ==================== Data Utilities ====================

/**
 * Generate a random email
 */
export function randomEmail(domain: string = 'test.com'): string {
  return `${faker.internet.username().toLowerCase()}@${domain}`;
}

/**
 * Generate a random UUID
 */
export function randomUUID(): string {
  return faker.string.uuid();
}

/**
 * Generate random bytes as hex string
 */
export function randomHex(length: number = 32): string {
  return faker.string.hexadecimal({ length, casing: 'lower', prefix: '' });
}

/**
 * Generate a random token
 */
export function randomToken(length: number = 64): string {
  return faker.string.alphanumeric(length);
}

/**
 * Create a deep clone of an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Omit keys from an object
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/**
 * Pick keys from an object
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

// ==================== Comparison Utilities ====================

/**
 * Compare two objects deeply, ignoring specified keys
 */
export function deepEqual(a: unknown, b: unknown, ignoreKeys: string[] = []): boolean {
  if (a === b) return true;

  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;

  const aKeys = Object.keys(aObj).filter((k) => !ignoreKeys.includes(k));
  const bKeys = Object.keys(bObj).filter((k) => !ignoreKeys.includes(k));

  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (!bKeys.includes(key)) return false;
    if (!deepEqual(aObj[key], bObj[key], ignoreKeys)) return false;
  }

  return true;
}

/**
 * Get differences between two objects
 */
export function getDiff(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};

  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of allKeys) {
    if (!deepEqual(a[key], b[key])) {
      diff[key] = { from: a[key], to: b[key] };
    }
  }

  return diff;
}

// ==================== Snapshot Utilities ====================

/**
 * Prepare object for snapshot testing by normalizing dynamic values
 */
export function prepareForSnapshot<T extends Record<string, unknown>>(
  obj: T,
  options: {
    uuidFields?: string[];
    dateFields?: string[];
    ignoreFields?: string[];
  } = {}
): T {
  const { uuidFields = [], dateFields = [], ignoreFields = [] } = options;
  const result = deepClone(obj);

  function normalize(o: Record<string, unknown>, path: string = ''): void {
    for (const [key, value] of Object.entries(o)) {
      const fullPath = path ? `${path}.${key}` : key;

      if (ignoreFields.includes(key) || ignoreFields.includes(fullPath)) {
        delete o[key];
      } else if (uuidFields.includes(key) || uuidFields.includes(fullPath)) {
        if (typeof value === 'string' && value.match(/^[0-9a-f-]{36}$/i)) {
          o[key] = '[UUID]';
        }
      } else if (dateFields.includes(key) || dateFields.includes(fullPath)) {
        if (value instanceof Date || typeof value === 'string') {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            o[key] = '[DATE]';
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        normalize(value as Record<string, unknown>, fullPath);
      }
    }
  }

  normalize(result);
  return result;
}

// ==================== Event Utilities ====================

/**
 * Create an event spy that tracks all calls
 */
export function createEventSpy<T = unknown>(): {
  handler: (event: T) => void;
  calls: T[];
  reset: () => void;
  waitForCall: (timeout?: number) => Promise<T>;
} {
  const calls: T[] = [];
  let resolvers: Array<(value: T) => void> = [];

  return {
    handler: (event: T) => {
      calls.push(event);
      const resolver = resolvers.shift();
      if (resolver) {
        resolver(event);
      }
    },
    calls,
    reset: () => {
      calls.length = 0;
      resolvers = [];
    },
    waitForCall: (timeout = 5000) =>
      new Promise<T>((resolve, reject) => {
        if (calls.length > 0) {
          resolve(calls[calls.length - 1]);
          return;
        }

        const timer = setTimeout(() => {
          reject(new Error(`Event not received within ${timeout}ms`));
        }, timeout);

        resolvers.push((value) => {
          clearTimeout(timer);
          resolve(value);
        });
      }),
  };
}

// ==================== Performance Utilities ====================

/**
 * Measure execution time of a function
 */
export async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;
  return { result, durationMs };
}

/**
 * Assert that a function executes within a time limit
 */
export async function assertTimeLimit<T>(fn: () => Promise<T>, maxMs: number): Promise<T> {
  const { result, durationMs } = await measureTime(fn);
  expect(durationMs).toBeLessThanOrEqual(maxMs);
  return result;
}

/**
 * Run a function multiple times and get timing statistics
 */
export async function benchmark<T>(
  fn: () => Promise<T>,
  iterations: number = 10
): Promise<{
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
}> {
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const { durationMs } = await measureTime(fn);
    times.push(durationMs);
  }

  times.sort((a, b) => a - b);

  const sum = times.reduce((a, b) => a + b, 0);
  const mean = sum / times.length;
  const median = times[Math.floor(times.length / 2)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];

  return {
    min: times[0],
    max: times[times.length - 1],
    mean,
    median,
    p95,
    p99,
  };
}
