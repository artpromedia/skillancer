/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-assignment */
/**
 * @module @skillancer/utils/async
 * Async utilities for handling promises, retries, and concurrency
 */

/**
 * Options for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Custom condition to determine if retry should occur */
  retryCondition?: (error: unknown) => boolean;
  /** Called when a retry occurs */
  onRetry?: (error: unknown, attempt: number) => void;
}

/**
 * Retry a function with exponential backoff
 * @param fn - The async function to retry
 * @param options - Retry options
 * @returns The result of the function
 * @throws The last error if all retries fail
 * @example
 * const result = await retry(async () => {
 *   return await fetchData();
 * }, { maxAttempts: 5, initialDelayMs: 100 });
 */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    retryCondition = () => true,
    onRetry,
  } = options;

  let lastError: unknown;
  let currentDelay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !retryCondition(error)) {
        throw error;
      }

      onRetry?.(error, attempt);

      await sleep(currentDelay);
      currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Sleep for a specified duration
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after the duration
 * @example
 * await sleep(1000); // Wait 1 second
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a debounced version of a function
 * @param fn - The function to debounce
 * @param waitMs - Wait time in milliseconds
 * @returns Debounced function
 * @example
 * const debouncedSearch = debounce((query: string) => {
 *   console.log('Searching:', query);
 * }, 300);
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return function (this: unknown, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn.apply(this, args);
      timeoutId = undefined;
    }, waitMs);
  };
}

/**
 * Create a throttled version of a function
 * @param fn - The function to throttle
 * @param limitMs - Minimum time between calls in milliseconds
 * @returns Throttled function
 * @example
 * const throttledScroll = throttle(() => {
 *   console.log('Scroll event');
 * }, 100);
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return function (this: unknown, ...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= limitMs) {
      lastCall = now;
      fn.apply(this, args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        fn.apply(this, args);
        timeoutId = undefined;
      }, limitMs - timeSinceLastCall);
    }
  };
}

/**
 * Wrap a promise with a timeout
 * @param promise - The promise to wrap
 * @param ms - Timeout in milliseconds
 * @param errorMessage - Custom error message
 * @returns Promise that rejects if timeout is exceeded
 * @throws TimeoutError if the promise doesn't resolve in time
 * @example
 * const result = await timeout(fetchData(), 5000, 'Request timed out');
 */
export async function timeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

/**
 * Execute promises with limited concurrency
 * @param tasks - Array of functions that return promises
 * @param concurrency - Maximum concurrent executions
 * @returns Array of settled results
 * @example
 * const tasks = urls.map(url => () => fetch(url));
 * const results = await promiseAllSettledWithConcurrency(tasks, 5);
 */
export async function promiseAllSettledWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let currentIndex = 0;

  async function runNext(): Promise<void> {
    while (currentIndex < tasks.length) {
      const index = currentIndex++;
      const task = tasks[index];

      if (!task) continue;

      try {
        const value = await task();
        results[index] = { status: 'fulfilled', value };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  // Start concurrent workers
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => runNext());

  await Promise.all(workers);
  return results;
}

/**
 * Execute promises in sequence (one at a time)
 * @param tasks - Array of functions that return promises
 * @returns Array of results
 * @example
 * const tasks = [() => fetchA(), () => fetchB(), () => fetchC()];
 * const results = await sequence(tasks);
 */
export async function sequence<T>(tasks: (() => Promise<T>)[]): Promise<T[]> {
  const results: T[] = [];

  for (const task of tasks) {
    results.push(await task());
  }

  return results;
}

/**
 * Create a deferred promise (externally resolvable)
 * @returns Object with promise, resolve, and reject functions
 * @example
 * const deferred = createDeferred<string>();
 * setTimeout(() => deferred.resolve('done'), 1000);
 * const result = await deferred.promise;
 */
export function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * Memoize an async function with optional TTL
 * @param fn - The async function to memoize
 * @param options - Memoization options
 * @returns Memoized function
 */
export function memoizeAsync<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: { ttlMs?: number; keyFn?: (...args: Parameters<T>) => string } = {}
): T {
  const { ttlMs, keyFn = (...args) => JSON.stringify(args) } = options;
  const cache = new Map<string, { value: unknown; timestamp: number }>();

  return async function (...args: Parameters<T>) {
    const key = keyFn(...args);
    const cached = cache.get(key);

    if (cached) {
      if (!ttlMs || Date.now() - cached.timestamp < ttlMs) {
        return cached.value;
      }
      cache.delete(key);
    }

    const value = await fn(...args);
    cache.set(key, { value, timestamp: Date.now() });
    return value;
  } as T;
}

/**
 * Race multiple promises and return the first to resolve (not reject)
 * @param promises - Array of promises
 * @returns First successful result
 * @throws AggregateError if all promises reject
 */
export async function raceToSuccess<T>(promises: Promise<T>[]): Promise<T> {
  const errors: unknown[] = [];

  return new Promise((resolve, reject) => {
    let remaining = promises.length;

    if (remaining === 0) {
      reject(new AggregateError([], 'No promises provided'));
      return;
    }

    for (const promise of promises) {
      Promise.resolve(promise)
        .then(resolve)
        .catch((error) => {
          errors.push(error);
          remaining--;
          if (remaining === 0) {
            reject(new AggregateError(errors, 'All promises rejected'));
          }
        });
    }
  });
}
