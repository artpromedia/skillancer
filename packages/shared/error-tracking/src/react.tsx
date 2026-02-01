/**
 * @module @skillancer/error-tracking/react
 * React-specific error tracking with Sentry integration
 */

'use client';

import * as Sentry from '@sentry/react';
import * as React from 'react';

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
 * Initialize error tracking for React applications
 *
 * @example
 * ```typescript
 * initErrorTracking({
 *   dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
 *   environment: process.env.NODE_ENV,
 *   release: process.env.NEXT_PUBLIC_VERSION,
 *   appName: 'web-market',
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

    // Integrations
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Session replay sample rates
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,

    // Filter events
    beforeSend(event, hint) {
      // Apply custom filter if provided
      if (mergedConfig.beforeSend) {
        return mergedConfig.beforeSend(event, hint) as Sentry.Event | null;
      }

      // Filter out non-errors in development
      if (mergedConfig.environment === 'development') {
        return null;
      }

      return event;
    },

    // Allowed URLs for filtering
    allowUrls: mergedConfig.allowedDomains?.map((domain) => new RegExp(domain)),
  });

  // Set initial tags
  if (mergedConfig.tags) {
    Sentry.setTags(mergedConfig.tags);
  }

  // Set app name tag
  if (mergedConfig.appName) {
    Sentry.setTag('app', mergedConfig.appName);
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
 * Clear user context on logout
 */
export function clearUser(): void {
  setUser(null);
}

// =============================================================================
// ERROR CAPTURE
// =============================================================================

/**
 * Capture an error with context
 *
 * @example
 * ```typescript
 * captureError(error, {
 *   component: 'PaymentForm',
 *   action: 'processPayment',
 *   extra: { amount: 100, currency: 'USD' },
 * });
 * ```
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
// REACT COMPONENTS
// =============================================================================

/**
 * Props for ErrorBoundary
 */
export interface ErrorBoundaryProps {
  readonly children: React.ReactNode;
  readonly fallback?: React.ReactNode | ((error: Error, resetError: () => void) => React.ReactNode);
  readonly onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  readonly beforeCapture?: (scope: Sentry.Scope, error: Error, componentStack: string) => void;
  readonly showDialog?: boolean;
}

/**
 * Sentry-integrated Error Boundary
 *
 * @example
 * ```tsx
 * <ErrorBoundary
 *   fallback={(error, resetError) => (
 *     <ErrorPage error={error} onRetry={resetError} />
 *   )}
 *   onError={(error) => console.error(error)}
 * >
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export function ErrorBoundary({
  children,
  fallback,
  onError,
  beforeCapture,
  showDialog = false,
}: ErrorBoundaryProps): React.ReactNode {
  return (
    <Sentry.ErrorBoundary
      fallback={
        typeof fallback === 'function'
          ? (errorProps) => fallback(errorProps.error, errorProps.resetError)
          : fallback || <DefaultErrorFallback />
      }
      onError={(error, componentStack, eventId) => {
        console.error('[ErrorBoundary]', error);
        onError?.(error, { componentStack } as React.ErrorInfo);

        // Show Sentry feedback dialog on error
        if (showDialog) {
          Sentry.showReportDialog({ eventId });
        }
      }}
      beforeCapture={(scope, error, componentStack) => {
        scope.setTag('errorBoundary', 'true');
        beforeCapture?.(scope, error, componentStack || '');
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}

/**
 * Default error fallback component
 */
function DefaultErrorFallback(): React.ReactElement {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="text-muted-foreground mt-2">
          We&apos;ve been notified and are working on a fix.
        </p>
        <button
          onClick={() => globalThis.location.reload()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 rounded-md px-4 py-2"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook to capture errors with context
 */
export function useErrorCapture(baseContext?: ErrorContext) {
  return React.useCallback(
    (error: unknown, context?: ErrorContext) => {
      captureError(error, { ...baseContext, ...context });
    },
    [baseContext]
  );
}

/**
 * Hook for setting user context
 */
export function useSetUser() {
  return React.useCallback((user: UserContext | null) => {
    setUser(user);
  }, []);
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
 * Wrap a function with performance tracing
 */
export function withProfiling<T extends (...args: unknown[]) => unknown>(
  fn: T,
  name: string,
  op: string
): T {
  return ((...args: Parameters<T>) => {
    return Sentry.startSpan({ name, op }, () => fn(...args));
  }) as T;
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

// eslint-disable-next-line no-barrel-files -- Intentional re-export for module consumers
export * as Sentry from '@sentry/react';
// eslint-disable-next-line no-barrel-files -- Intentional re-export for module consumers
export type { ErrorTrackingConfig, UserContext, ErrorContext } from './index.js';
