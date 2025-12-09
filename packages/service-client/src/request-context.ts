/**
 * @module @skillancer/service-client/request-context
 * Request context using AsyncLocalStorage for distributed tracing
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';

// ============================================================================
// Types
// ============================================================================

export interface RequestContext {
  /** Unique request ID for tracing (alias: traceId) */
  requestId: string;
  /** Service that initiated the request */
  sourceService: string;
  /** User ID if authenticated */
  userId?: string | undefined;
  /** Tenant ID for multi-tenant isolation */
  tenantId?: string | undefined;
  /** Correlation ID for tracking related requests (alias: spanId) */
  correlationId?: string | undefined;
  /** Additional metadata */
  metadata?: Record<string, string> | undefined;
  /** Alias for requestId - trace ID for distributed tracing */
  traceId?: string | undefined;
  /** Alias for correlationId - span ID for distributed tracing */
  spanId?: string | undefined;
}

// ============================================================================
// Async Local Storage
// ============================================================================

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Run a function with request context
 */
export function runWithContext<T>(context: Partial<RequestContext>, fn: () => T): T {
  const requestId = context.requestId ?? generateRequestId();
  const correlationId = context.correlationId ?? context.requestId ?? generateRequestId();

  const fullContext: RequestContext = {
    requestId,
    sourceService: context.sourceService ?? getServiceName(),
    correlationId,
    // Set optional properties only if they have values
    ...(context.userId !== undefined && { userId: context.userId }),
    ...(context.tenantId !== undefined && { tenantId: context.tenantId }),
    ...(context.metadata !== undefined && { metadata: context.metadata }),
    // Aliases
    traceId: requestId,
    spanId: correlationId,
  };

  return asyncLocalStorage.run(fullContext, fn);
}

/**
 * Get current request context
 */
export function getContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Get request ID from context or generate new one
 */
export function getRequestId(): string {
  return getContext()?.requestId ?? generateRequestId();
}

/**
 * Get correlation ID from context or generate new one
 */
export function getCorrelationId(): string {
  return getContext()?.correlationId ?? generateRequestId();
}

/**
 * Get user ID from context
 */
export function getUserId(): string | undefined {
  return getContext()?.userId;
}

/**
 * Get tenant ID from context
 */
export function getTenantId(): string | undefined {
  return getContext()?.tenantId;
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Get current service name
 */
export function getServiceName(): string {
  return process.env['SERVICE_NAME'] ?? 'unknown-service';
}

/**
 * Extract context headers for propagation
 */
export function getContextHeaders(): Record<string, string> {
  const context = getContext();
  const headers: Record<string, string> = {
    'x-request-id': context?.requestId ?? generateRequestId(),
    'x-correlation-id': context?.correlationId ?? generateRequestId(),
    'x-source-service': context?.sourceService ?? getServiceName(),
  };

  if (context?.userId) {
    headers['x-user-id'] = context.userId;
  }

  if (context?.tenantId) {
    headers['x-tenant-id'] = context.tenantId;
  }

  return headers;
}

/**
 * Create context from incoming request headers
 */
export function createContextFromHeaders(
  headers: Record<string, string | string[] | undefined>
): Partial<RequestContext> {
  const getHeader = (name: string): string | undefined => {
    const value = headers[name];
    return Array.isArray(value) ? value[0] : value;
  };

  const result: Partial<RequestContext> = {};

  const requestId = getHeader('x-request-id');
  if (requestId !== undefined) result.requestId = requestId;

  const correlationId = getHeader('x-correlation-id');
  if (correlationId !== undefined) result.correlationId = correlationId;

  const sourceService = getHeader('x-source-service');
  if (sourceService !== undefined) result.sourceService = sourceService;

  const userId = getHeader('x-user-id');
  if (userId !== undefined) result.userId = userId;

  const tenantId = getHeader('x-tenant-id');
  if (tenantId !== undefined) result.tenantId = tenantId;

  return result;
}
