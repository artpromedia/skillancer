/**
 * @module @skillancer/error-tracking/node
 * Node.js-specific error tracking with Sentry integration
 */

import * as Sentry from '@sentry/node';
import type { Request, Response, NextFunction } from 'express';

import {
  type ErrorTrackingConfig,
  type UserContext,
  type ErrorContext,
  defaultConfig,
  shouldEnableTracking,
  extractErrorInfo,
  getErrorLevel,
  createErrorBreadcrumb,
  sanitizeContext,
} from './index.js';

// =============================================================================
// INITIALIZATION
// =============================================================================

let isInitialized = false;

/**
 * Initialize error tracking for Node.js applications
 *
 * @example
 * ```typescript
 * initErrorTracking({
 *   dsn: process.env.SENTRY_DSN,
 *   environment: process.env.NODE_ENV,
 *   release: process.env.VERSION,
 *   appName: 'auth-svc',
 * });
 * ```
 */
export function initErrorTracking(config: ErrorTrackingConfig): void {
  if (isInitialized) {
    console.warn('[ErrorTracking] Already initialized');
    return;
  }

  const mergedConfig = { ...defaultConfig, ...config };

  if (!shouldEnableTracking(mergedConfig)) {
    return;
  }

  Sentry.init({
    dsn: mergedConfig.dsn,
    environment: mergedConfig.environment,
    release: mergedConfig.release,
    debug: mergedConfig.debug,
    sampleRate: mergedConfig.sampleRate,
    tracesSampleRate: mergedConfig.tracesSampleRate,

    // Filter events
    beforeSend(event, hint) {
      // Apply custom filter if provided
      if (mergedConfig.beforeSend) {
        return mergedConfig.beforeSend(event, hint) as Sentry.Event | null;
      }

      // Don't send in development
      if (mergedConfig.environment === 'development') {
        return null;
      }

      return event;
    },
  });

  // Set initial tags
  if (mergedConfig.tags) {
    Sentry.setTags(mergedConfig.tags);
  }

  // Set app name tag
  if (mergedConfig.appName) {
    Sentry.setTag('app', mergedConfig.appName);
    Sentry.setTag('service', mergedConfig.appName);
  }

  // Set initial user context
  if (mergedConfig.user) {
    setUser(mergedConfig.user);
  }

  isInitialized = true;
  console.log('[ErrorTracking] Initialized successfully');
}

// =============================================================================
// USER CONTEXT
// =============================================================================

/**
 * Set the current user context
 */
export function setUser(user: UserContext | null): void {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.name,
      ...user,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Clear user context
 */
export function clearUser(): void {
  setUser(null);
}

// =============================================================================
// ERROR CAPTURE
// =============================================================================

/**
 * Capture an error with context
 */
export function captureError(error: unknown, context?: ErrorContext): string {
  const info = extractErrorInfo(error);

  return Sentry.captureException(error, {
    level: context?.level || getErrorLevel(error),
    tags: {
      errorCode: info.code,
      component: context?.component,
      action: context?.action,
      ...context?.tags,
    },
    extra: sanitizeContext({
      ...info.extra,
      ...context?.extra,
    }),
    user: context?.user,
  });
}

/**
 * Capture a message with context
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: Omit<ErrorContext, 'level'>
): string {
  return Sentry.captureMessage(message, {
    level,
    tags: context?.tags,
    extra: context?.extra ? sanitizeContext(context.extra) : undefined,
  });
}

/**
 * Add a breadcrumb for context
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'
): void {
  Sentry.addBreadcrumb({
    category,
    message,
    level,
    data: data ? sanitizeContext(data) : undefined,
  });
}

/**
 * Add error breadcrumb
 */
export function addErrorBreadcrumb(error: unknown, context?: ErrorContext): void {
  const breadcrumb = createErrorBreadcrumb(error, context);
  Sentry.addBreadcrumb(breadcrumb);
}

// =============================================================================
// SCOPE MANAGEMENT
// =============================================================================

/**
 * Set a tag on the current scope
 */
export function setTag(key: string, value: string): void {
  Sentry.setTag(key, value);
}

/**
 * Set multiple tags
 */
export function setTags(tags: Record<string, string>): void {
  Sentry.setTags(tags);
}

/**
 * Set extra context data
 */
export function setExtra(key: string, value: unknown): void {
  Sentry.setExtra(key, value);
}

/**
 * Set context for a specific category
 */
export function setContext(name: string, context: Record<string, unknown>): void {
  Sentry.setContext(name, sanitizeContext(context));
}

/**
 * Run function with isolated scope
 */
export function withScope<T>(callback: (scope: Sentry.Scope) => T): T {
  return Sentry.withScope(callback);
}

// =============================================================================
// EXPRESS MIDDLEWARE
// =============================================================================

/**
 * Express middleware to track request context
 *
 * @example
 * ```typescript
 * import { requestHandler, errorHandler } from '@skillancer/error-tracking/node';
 *
 * app.use(requestHandler());
 * // ... routes
 * app.use(errorHandler());
 * ```
 */
export function requestHandler(): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    // Set request context
    Sentry.setContext('request', {
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
        host: req.headers.host,
      },
    });

    // Add breadcrumb for request
    addBreadcrumb('http', `${req.method} ${req.path}`, {
      method: req.method,
      url: req.url,
    });

    // Extract user from request if available
    if ((req as Request & { user?: UserContext }).user) {
      setUser((req as Request & { user?: UserContext }).user || null);
    }

    next();
  };
}

/**
 * Express error handler middleware
 */
export function errorHandler(): (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void {
  return (error: Error, req: Request, res: Response, next: NextFunction) => {
    const eventId = captureError(error, {
      component: 'express',
      action: `${req.method} ${req.path}`,
      extra: {
        method: req.method,
        path: req.path,
        query: req.query,
      },
    });

    // Attach event ID to response for debugging
    res.setHeader('X-Sentry-Event-Id', eventId);

    next(error);
  };
}

// =============================================================================
// ASYNC CONTEXT
// =============================================================================

/**
 * Run async function with isolated scope
 */
export async function runWithAsyncContext<T>(
  callback: () => Promise<T>,
  options?: {
    user?: UserContext;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): Promise<T> {
  return Sentry.withScope(async (scope) => {
    if (options?.user) {
      scope.setUser(options.user);
    }
    if (options?.tags) {
      scope.setTags(options.tags);
    }
    if (options?.extra) {
      Object.entries(options.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    return callback();
  });
}

// =============================================================================
// PERFORMANCE
// =============================================================================

/**
 * Start a transaction for performance monitoring
 */
export function startTransaction(
  name: string,
  op: string,
  data?: Record<string, unknown>
): Sentry.Span | undefined {
  return Sentry.startInactiveSpan({
    name,
    op,
    attributes: data,
  });
}

/**
 * Wrap an async function with performance tracing
 */
export function withTracing<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  name: string,
  op: string
): T {
  return (async (...args: Parameters<T>) => {
    return Sentry.startSpan({ name, op }, async () => fn(...args));
  }) as T;
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Flush pending events before process exit
 */
export async function flush(timeout = 2000): Promise<boolean> {
  return Sentry.flush(timeout);
}

/**
 * Close Sentry client
 */
export async function close(timeout = 2000): Promise<boolean> {
  return Sentry.close(timeout);
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

// eslint-disable-next-line no-barrel-files -- Intentional re-export for module consumers
export * as Sentry from '@sentry/node';
// eslint-disable-next-line no-barrel-files -- Intentional re-export for module consumers
export type { ErrorTrackingConfig, UserContext, ErrorContext } from './index.js';
