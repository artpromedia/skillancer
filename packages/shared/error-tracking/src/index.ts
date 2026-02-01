/**
 * @module @skillancer/error-tracking
 * Shared error tracking configuration and utilities
 */

// =============================================================================
// TYPES
// =============================================================================

export interface ErrorTrackingConfig {
  /** Sentry DSN */
  dsn: string;
  /** Environment (development, staging, production) */
  environment: string;
  /** Release version */
  release?: string;
  /** Sample rate for error events (0-1) */
  sampleRate?: number;
  /** Sample rate for traces (0-1) */
  tracesSampleRate?: number;
  /** Enable debug mode */
  debug?: boolean;
  /** Application name */
  appName?: string;
  /** Allowed domains for breadcrumbs */
  allowedDomains?: string[];
  /** Tags to attach to all events */
  tags?: Record<string, string>;
  /** User information */
  user?: UserContext;
  /** Custom before send hook */
  beforeSend?: (event: unknown, hint: unknown) => unknown;
}

export interface UserContext {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  [key: string]: string | undefined;
}

export interface ErrorContext {
  /** Component or module name */
  component?: string;
  /** Action being performed */
  action?: string;
  /** Additional context data */
  extra?: Record<string, unknown>;
  /** Tags for categorization */
  tags?: Record<string, string>;
  /** User context override */
  user?: UserContext;
  /** Error severity level */
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
}

// =============================================================================
// SHARED UTILITIES
// =============================================================================

/**
 * Default configuration for error tracking
 */
export const defaultConfig: Partial<ErrorTrackingConfig> = {
  environment: process.env.NODE_ENV || 'development',
  sampleRate: 1,
  tracesSampleRate: 0.1,
  debug: process.env.NODE_ENV === 'development',
};

/**
 * Check if error tracking should be enabled
 */
export function shouldEnableTracking(config: Partial<ErrorTrackingConfig>): boolean {
  // Don't enable in development by default
  if (config.environment === 'development' && !config.debug) {
    return false;
  }

  // Require DSN
  if (!config.dsn) {
    console.warn('[ErrorTracking] No DSN provided, error tracking disabled');
    return false;
  }

  return true;
}

/**
 * Extract error info for tracking
 */
export function extractErrorInfo(error: unknown): {
  message: string;
  name: string;
  code?: string;
  statusCode?: number;
  isOperational?: boolean;
  extra?: Record<string, unknown>;
} {
  if (isApiError(error)) {
    return {
      message: error.message,
      name: error.name,
      code: error.code,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      extra: {
        details: error.details,
        requestId: error.requestId,
        timestamp: error.timestamp?.toISOString(),
      },
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
    };
  }

  return {
    message: String(error),
    name: 'Unknown',
  };
}

/**
 * Type guard for ApiError
 */
function isApiError(error: unknown): error is ApiError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    'statusCode' in error &&
    'isOperational' in error
  );
}

/**
 * Determine error severity level
 */
export function getErrorLevel(error: unknown): 'fatal' | 'error' | 'warning' | 'info' {
  if (isApiError(error)) {
    // Operational errors are less severe
    if (error.isOperational) {
      // Validation and auth errors are warnings
      if (error.statusCode === 400 || error.statusCode === 401 || error.statusCode === 403) {
        return 'warning';
      }
      // Not found is info
      if (error.statusCode === 404) {
        return 'info';
      }
    }

    // Server errors are errors
    if (error.statusCode >= 500) {
      return 'error';
    }
  }

  return 'error';
}

/**
 * Create breadcrumb from error
 */
export function createErrorBreadcrumb(error: unknown, context?: ErrorContext) {
  const info = extractErrorInfo(error);
  return {
    type: 'error',
    category: context?.component || 'error',
    message: info.message,
    level: getErrorLevel(error),
    data: {
      errorName: info.name,
      errorCode: info.code,
      action: context?.action,
      ...context?.extra,
    },
  };
}

/**
 * Filter sensitive data from error context
 */
export function sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'apiKey',
    'authorization',
    'cookie',
    'session',
  ];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeContext(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { ApiError } from '@skillancer/error-handling';
