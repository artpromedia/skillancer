/**
 * @skillancer/error-tracking
 *
 * Error tracking with Sentry for Skillancer
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  serviceName: string;
  sampleRate?: number;
  tracesSampleRate?: number;
  profilesSampleRate?: number;
  enabled?: boolean;
  debug?: boolean;
}

let isInitialized = false;

/**
 * Initialize Sentry error tracking
 */
export function initSentry(config: SentryConfig): void {
  if (isInitialized) {
    console.warn('Sentry already initialized');
    return;
  }

  if (config.enabled === false || !config.dsn) {
    console.log('Sentry disabled');
    return;
  }

  const releaseVersion = config.release ?? process.env['npm_package_version'];

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    ...(releaseVersion ? { release: releaseVersion } : {}),
    serverName: config.serviceName,
    debug: config.debug ?? false,

    // Error sampling (1.0 = 100% of errors)
    sampleRate: config.sampleRate ?? 1.0,

    // Performance Monitoring (0.1 = 10% of transactions)
    tracesSampleRate: config.tracesSampleRate ?? 0.1,

    // Profiling (0.1 = 10% of profiled transactions)
    profilesSampleRate: config.profilesSampleRate ?? 0.1,

    integrations: [
      // HTTP instrumentation for tracing
      Sentry.httpIntegration(),
      // Profiling integration
      nodeProfilingIntegration(),
      // Capture unhandled promise rejections
      Sentry.onUnhandledRejectionIntegration({ mode: 'warn' }),
      // Capture uncaught exceptions
      Sentry.onUncaughtExceptionIntegration({ exitEvenIfOtherHandlersAreRegistered: false }),
      // Local variables in stack traces
      Sentry.localVariablesIntegration({ captureAllExceptions: true }),
      // Console integration for breadcrumbs
      Sentry.consoleIntegration(),
    ],

    // Filter sensitive data before sending
    beforeSend(event, hint) {
      // Remove sensitive headers
      if (event.request?.headers) {
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
        for (const header of sensitiveHeaders) {
          delete event.request.headers[header];
        }
      }

      // Remove sensitive data from request body
      if (event.request?.data && typeof event.request.data === 'object') {
        const sensitiveFields = [
          'password',
          'token',
          'secret',
          'creditCard',
          'cardNumber',
          'cvv',
          'ssn',
          'apiKey',
          'accessToken',
          'refreshToken',
        ];
        const data = event.request.data as Record<string, unknown>;
        for (const field of sensitiveFields) {
          if (field in data) {
            data[field] = '[REDACTED]';
          }
        }
      }

      // Remove sensitive extras
      if (event.extra) {
        const sensitiveExtras = ['password', 'token', 'secret', 'apiKey'];
        for (const key of sensitiveExtras) {
          if (key in event.extra) {
            event.extra[key] = '[REDACTED]';
          }
        }
      }

      return event;
    },

    // Filter breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Remove sensitive data from breadcrumbs
      if (breadcrumb.category === 'http' && breadcrumb.data) {
        delete breadcrumb.data['authorization'];
        delete breadcrumb.data['cookie'];
      }
      return breadcrumb;
    },

    // Ignore certain errors
    ignoreErrors: [
      // Network errors
      'AbortError',
      'NetworkError',
      'FetchError',
      /^Request aborted/,
      /^Network request failed/,
      // User-initiated errors
      'User cancelled',
      /^User denied/,
      // Common non-actionable errors
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
    ],

    // Ignore transactions for health checks
    ignoreTransactions: ['/health', '/ready', '/metrics', '/favicon.ico'],
  });

  isInitialized = true;
  console.log(`Sentry initialized for ${config.serviceName} (env: ${config.environment})`);
}

/**
 * Check if Sentry is initialized
 */
export function isSentryInitialized(): boolean {
  return isInitialized;
}

/**
 * Capture an exception with optional context
 */
export function captureError(error: Error, context?: Record<string, unknown>): string {
  return Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    return Sentry.captureException(error);
  });
}

/**
 * Capture a message with severity level
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'info'
): string {
  return Sentry.captureMessage(message, level);
}

/**
 * Add a breadcrumb for debugging context
 */
export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string; email?: string; username?: string } | null): void {
  Sentry.setUser(user);
}

/**
 * Set a tag for filtering errors
 */
export function setTag(key: string, value: string): void {
  Sentry.setTag(key, value);
}

/**
 * Set extra context data
 */
export function setExtra(key: string, value: unknown): void {
  Sentry.setExtra(key, value);
}

/**
 * Set multiple tags at once
 */
export function setTags(tags: Record<string, string>): void {
  Sentry.setTags(tags);
}

/**
 * Set the current transaction name
 */
export function setTransactionName(name: string): void {
  const scope = Sentry.getCurrentScope();
  scope.setTransactionName(name);
}

/**
 * Start a new span for performance monitoring
 */
export function startSpan<T>(
  options: { name: string; op?: string; attributes?: Record<string, string | number | boolean> },
  callback: (span: Sentry.Span | undefined) => T
): T {
  return Sentry.startSpan(
    {
      name: options.name,
      ...(options.op ? { op: options.op } : {}),
      ...(options.attributes ? { attributes: options.attributes } : {}),
    },
    callback
  );
}

/**
 * Create a manual transaction for performance monitoring
 */
export function startTransaction(options: {
  name: string;
  op?: string;
  data?: Record<string, string | number | boolean>;
}): Sentry.Span | undefined {
  return Sentry.startInactiveSpan({
    name: options.name,
    ...(options.op ? { op: options.op } : {}),
    ...(options.data ? { attributes: options.data } : {}),
  });
}

/**
 * Configure scope for a specific operation
 */
export function withScope<T>(callback: (scope: Sentry.Scope) => T): T {
  return Sentry.withScope(callback);
}

/**
 * Get the current scope
 */
export function getCurrentScope(): Sentry.Scope {
  return Sentry.getCurrentScope();
}

/**
 * Flush pending events before shutdown
 */
export async function flushSentry(timeout: number = 2000): Promise<boolean> {
  return Sentry.flush(timeout);
}

/**
 * Close Sentry client
 */
export async function closeSentry(timeout: number = 2000): Promise<boolean> {
  isInitialized = false;
  return Sentry.close(timeout);
}

// Re-export Sentry for advanced usage
export { Sentry };
