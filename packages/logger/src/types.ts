/**
 * Type definitions for the logger package
 */

import type { Logger } from 'pino';

/**
 * Context stored in async local storage for request tracking
 */
export interface LogContext {
  /** Unique request identifier */
  requestId: string;
  /** User ID if authenticated */
  userId?: string | undefined;
  /** Tenant/organization ID for multi-tenant apps */
  tenantId?: string | undefined;
  /** AWS X-Ray trace ID */
  traceId?: string | undefined;
  /** Span ID for distributed tracing */
  spanId?: string | undefined;
  /** Request path */
  path?: string | undefined;
  /** HTTP method */
  method?: string | undefined;
  /** Additional custom fields */
  [key: string]: unknown;
}

/**
 * HTTP request information for logging
 */
export interface HttpRequestLog {
  method: string;
  url: string;
  path?: string | undefined;
  params?: Record<string, string> | undefined;
  query?: Record<string, string> | undefined;
  headers?: Record<string, string> | undefined;
  remoteAddress?: string | undefined;
  userAgent?: string | undefined;
  contentType?: string | undefined;
  contentLength?: string | number | undefined;
}

/**
 * HTTP response information for logging
 */
export interface HttpResponseLog {
  statusCode: number;
  headers?: Record<string, string> | undefined;
  contentType?: string | undefined;
  contentLength?: string | number | undefined;
}

/**
 * Error information for logging
 */
export interface ErrorLog {
  name?: string | undefined;
  type?: string | undefined;
  message: string;
  code?: string | number | undefined;
  statusCode?: number | undefined;
  stack?: string | undefined;
  details?: unknown;
  cause?: ErrorLog | undefined;
}

/**
 * Request lifecycle event types
 */
export type RequestEvent = 'start' | 'complete' | 'error';

/**
 * Log entry for request lifecycle events
 */
export interface RequestLogEntry {
  event: RequestEvent;
  request?: HttpRequestLog;
  response?: HttpResponseLog;
  error?: ErrorLog;
  responseTime?: number;
  requestId: string;
  userId?: string;
  tenantId?: string;
}

/**
 * Extended Fastify request with logger
 */
export interface RequestWithLogger {
  log: Logger;
  id: string;
}

/**
 * Fastify plugin options
 */
export interface FastifyLoggingOptions {
  /** Logger instance to use */
  logger: Logger;
  /** Log request body (default: false) */
  logRequestBody?: boolean;
  /** Log response body (default: false) */
  logResponseBody?: boolean;
  /** Maximum body size to log in bytes (default: 10KB) */
  maxBodySize?: number;
  /** Paths to exclude from logging */
  excludePaths?: string[];
  /** Custom request ID header name (default: x-request-id) */
  requestIdHeader?: string;
  /** Generate request ID if not present (default: true) */
  generateRequestId?: boolean;
}

/**
 * Express middleware options
 */
export interface ExpressLoggingOptions {
  /** Logger instance to use */
  logger: Logger;
  /** Log request body (default: false) */
  logRequestBody?: boolean;
  /** Log response body (default: false) */
  logResponseBody?: boolean;
  /** Maximum body size to log in bytes (default: 10KB) */
  maxBodySize?: number;
  /** Paths to exclude from logging */
  excludePaths?: string[];
  /** Custom request ID header name (default: x-request-id) */
  requestIdHeader?: string;
  /** Generate request ID if not present (default: true) */
  generateRequestId?: boolean;
}
