/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * Async context management for request tracking
 *
 * Uses Node.js AsyncLocalStorage to propagate request context
 * across async boundaries without explicit parameter passing.
 */

import { AsyncLocalStorage } from 'async_hooks';

import type { LogContext } from './types.js';

// Re-export LogContext for convenience
export type { LogContext } from './types.js';

/**
 * AsyncLocalStorage instance for request context
 */
export const asyncLocalStorage = new AsyncLocalStorage<LogContext>();

/**
 * Gets the current request context from async local storage
 *
 * @returns Current context or undefined if not in a request context
 *
 * @example
 * ```typescript
 * const context = getContext();
 * if (context?.requestId) {
 *   // Do something with request ID
 * }
 * ```
 */
export function getContext(): LogContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Sets the request context in async local storage
 *
 * Note: This only works within an existing storage context.
 * Use runWithContext to create a new context.
 *
 * @param context - The context to set
 */
export function setContext(context: LogContext): void {
  const store = asyncLocalStorage.getStore();
  if (store) {
    Object.assign(store, context);
  }
}

/**
 * Runs a function within a new async local storage context
 *
 * @param context - The context to use for the execution
 * @param fn - The function to run within the context
 * @returns The return value of the function
 *
 * @example
 * ```typescript
 * runWithContext({ requestId: 'req-123' }, async () => {
 *   // All async operations within this block can access the context
 *   const ctx = getContext();
 *   console.log(ctx?.requestId); // 'req-123'
 * });
 * ```
 */
export function runWithContext<T>(context: LogContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}

/**
 * Updates specific fields in the current context
 *
 * @param updates - Partial context with fields to update
 *
 * @example
 * ```typescript
 * updateContext({ userId: 'user-456' });
 * ```
 */
export function updateContext(updates: Partial<LogContext>): void {
  const store = asyncLocalStorage.getStore();
  if (store) {
    Object.assign(store, updates);
  }
}

/**
 * Gets a specific field from the current context
 *
 * @param key - The key to retrieve
 * @returns The value or undefined if not set
 *
 * @example
 * ```typescript
 * const requestId = getContextField('requestId');
 * ```
 */
export function getContextField<K extends keyof LogContext>(key: K): LogContext[K] | undefined {
  const store = asyncLocalStorage.getStore();
  return store?.[key];
}

/**
 * Creates a new context object with default values
 *
 * @param overrides - Optional overrides for the default context
 * @returns A new context object
 */
export function createContext(overrides?: Partial<LogContext>): LogContext {
  return {
    requestId: generateRequestId(),
    ...overrides,
  };
}

/**
 * Generates a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Decorator to run a method within a request context
 *
 * @param context - Context or function returning context
 * @returns Method decorator
 */
export function withContext(context: LogContext | (() => LogContext)): MethodDecorator {
  return function (_target: object, _propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: unknown[]) {
      const ctx = typeof context === 'function' ? context() : context;
      return runWithContext(ctx, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
