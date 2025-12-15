/**
 * @module @skillancer/audit-svc/middleware/audit.middleware
 * Fastify middleware for automatic request auditing
 */

import { queueAuditLog } from '../services/audit-log.service.js';
import {
  ActorType,
  OutcomeStatus,
  type ComplianceTag,
  type RetentionPolicy,
  type AuditCategory,
  type AuditLogParams,
} from '../types/index.js';

import type { FastifyRequest, FastifyReply, FastifyInstance, RouteOptions } from 'fastify';

/**
 * Route configuration for automatic audit logging
 */
export interface AuditRouteConfig {
  /** Event type to log (e.g., 'USER_LOGIN', 'PROJECT_CREATED') */
  eventType: string;
  /** Audit category */
  category: AuditCategory;
  /** Human-readable action description */
  action: string;
  /** Resource type being accessed */
  resourceType: string;
  /** Function to extract resource ID from request */
  resourceIdExtractor?: (request: FastifyRequest) => string | undefined;
  /** Compliance tags for this route */
  complianceTags?: string[];
  /** Retention policy override */
  retentionPolicy?: 'SHORT' | 'STANDARD' | 'EXTENDED' | 'PERMANENT';
  /** Should capture request body in audit log */
  captureRequestBody?: boolean;
  /** Should capture response body in audit log */
  captureResponseBody?: boolean;
  /** Fields to exclude from request body capture */
  excludeFields?: string[];
  /** Skip audit logging for this route */
  skipAudit?: boolean;
}

/**
 * Map of route paths to audit configurations
 */
type AuditRouteMap = Map<string, AuditRouteConfig>;

const auditRoutes: AuditRouteMap = new Map();

/**
 * Register a route for automatic audit logging
 */
export function registerAuditRoute(method: string, path: string, config: AuditRouteConfig): void {
  const key = `${method.toUpperCase()}:${path}`;
  auditRoutes.set(key, config);
}

/**
 * Register multiple audit routes at once
 */
export function registerAuditRoutes(
  routes: Array<{ method: string; path: string; config: AuditRouteConfig }>
): void {
  for (const route of routes) {
    registerAuditRoute(route.method, route.path, route.config);
  }
}

/**
 * Get audit configuration for a route
 */
function getRouteConfig(method: string, path: string): AuditRouteConfig | undefined {
  const key = `${method.toUpperCase()}:${path}`;

  // Try exact match first
  if (auditRoutes.has(key)) {
    return auditRoutes.get(key);
  }

  // Try pattern matching for parameterized routes
  for (const [pattern, config] of auditRoutes) {
    const [patternMethod, patternPath] = pattern.split(':');
    if (patternMethod !== method.toUpperCase()) continue;
    if (!patternPath) continue;

    const regex = new RegExp(
      '^' + patternPath.replace(/:[^/]+/g, '[^/]+').replace(/\*/g, '.*') + '$'
    );
    if (regex.test(path)) {
      return config;
    }
  }

  return undefined;
}

/**
 * Extract actor information from request
 */
function extractActor(request: FastifyRequest): AuditLogParams['actor'] {
  // Try to get user from JWT payload or session
  const user = (request as FastifyRequest & { user?: { id: string; email?: string } }).user;

  if (user?.id) {
    return {
      id: user.id,
      type: ActorType.USER,
      email: user.email,
    };
  }

  // Check for service-to-service authentication
  const serviceId = request.headers['x-service-id'] as string | undefined;
  if (serviceId) {
    return {
      id: serviceId,
      type: ActorType.SERVICE,
    };
  }

  // Anonymous/unauthenticated request
  return {
    id: 'anonymous',
    type: ActorType.ANONYMOUS,
    ipAddress: request.ip,
  };
}

/**
 * Redact sensitive fields from an object
 */
function redactFields(
  data: unknown,
  excludeFields: string[] = []
): Record<string, unknown> | undefined {
  if (!data || typeof data !== 'object') return undefined;

  const defaultExclude = [
    'password',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'apiKey',
    'creditCard',
    'cardNumber',
    'cvv',
    'ssn',
    'socialSecurityNumber',
  ];

  const fieldsToExclude = [...defaultExclude, ...excludeFields];
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (fieldsToExclude.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = redactFields(value, excludeFields);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Create the audit middleware hook for Fastify
 */
export function createAuditMiddleware() {
  return function auditMiddleware(request: FastifyRequest, _reply: FastifyReply): void {
    const startTime = Date.now();
    const routeConfig = getRouteConfig(request.method, request.routeOptions?.url ?? request.url);

    if (!routeConfig || routeConfig.skipAudit) {
      return;
    }

    // Store start time for duration calculation
    request.auditStartTime = startTime;
    request.auditConfig = routeConfig;
  };
}

/**
 * Create the audit response hook for Fastify
 */
export function createAuditResponseHook() {
  return async function auditResponseHook(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const config = request.auditConfig;
    if (!config) return;

    const startTime = request.auditStartTime ?? Date.now();
    const duration = Date.now() - startTime;
    const statusCode = reply.statusCode;
    const isSuccess = statusCode >= 200 && statusCode < 400;

    // Extract resource ID
    let resourceId = 'unknown';
    if (config.resourceIdExtractor) {
      resourceId = config.resourceIdExtractor(request) ?? 'unknown';
    } else {
      // Try common patterns
      const params = request.params as Record<string, string> | undefined;
      resourceId = params?.id ?? params?.resourceId ?? params?.userId ?? 'unknown';
    }

    const auditParams: AuditLogParams = {
      eventType: config.eventType,
      eventCategory: config.category,
      action: config.action,
      actor: extractActor(request),
      resource: {
        type: config.resourceType,
        id: resourceId,
      },
      outcome: {
        status: isSuccess ? OutcomeStatus.SUCCESS : OutcomeStatus.FAILURE,
        duration,
      },
      request: {
        method: request.method,
        path: request.url,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        correlationId: (request.headers['x-correlation-id'] as string) ?? request.id,
      },
      complianceTags: config.complianceTags as ComplianceTag[] | undefined,
      retentionPolicy: config.retentionPolicy as RetentionPolicy | undefined,
    };

    // Capture request body if configured
    if (config.captureRequestBody && request.body) {
      auditParams.changes = {
        after: redactFields(request.body, config.excludeFields),
      };
    }

    // Queue the audit log asynchronously
    try {
      await queueAuditLog(auditParams);
    } catch (error) {
      // Log but don't fail the request
      console.error('[AUDIT] Failed to queue audit log:', error);
    }
  };
}

/**
 * Register the audit plugin with Fastify
 */
export function registerAuditPlugin(fastify: FastifyInstance): void {
  // Add custom properties to FastifyRequest
  fastify.decorateRequest('auditStartTime', undefined);
  fastify.decorateRequest('auditConfig', undefined);

  // Register hooks
  fastify.addHook('preHandler', createAuditMiddleware());
  fastify.addHook('onResponse', createAuditResponseHook());
}

/**
 * Decorator to add audit configuration to a route
 */
export function withAudit(config: AuditRouteConfig) {
  return function <T extends RouteOptions>(routeOptions: T): T {
    const path = routeOptions.url;
    const method = Array.isArray(routeOptions.method)
      ? routeOptions.method[0]
      : routeOptions.method;

    if (path && method) {
      registerAuditRoute(method, path, config);
    }

    return routeOptions;
  };
}

// Type augmentation for FastifyRequest
declare module 'fastify' {
  interface FastifyRequest {
    auditStartTime?: number;
    auditConfig?: AuditRouteConfig;
  }
}
