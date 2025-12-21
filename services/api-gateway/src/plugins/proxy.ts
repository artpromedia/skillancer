// @ts-nocheck - Fastify type compatibility issues
/**
 * @module @skillancer/api-gateway/plugins/proxy
 * Request proxy plugin for routing to downstream services
 */

import fp from 'fastify-plugin';

import { requireAuth, optionalAuth } from './auth.js';
import { getServiceRoutes, type ServiceRoute } from '../config/routes.js';
import { getCircuitBreaker, CircuitOpenError, TimeoutError } from '../utils/circuit-breaker.js';
import { GatewayTimeoutError, ServiceUnavailableError, BadGatewayError } from '../utils/errors.js';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// Headers that should not be forwarded
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
]);

async function proxyPluginImpl(app: FastifyInstance): Promise<void> {
  await Promise.resolve();
  const routes = getServiceRoutes();

  for (const route of routes) {
    const routeConfig = route.rateLimit ? { rateLimit: route.rateLimit } : {};

    // Register wildcard route for each service prefix
    app.all(
      `${route.prefix}/*`,
      {
        preHandler: getPreHandlers(route),
        config: routeConfig,
      },
      async (request, reply) => {
        return proxyRequest(request, reply, route);
      }
    );

    // Also handle exact prefix match (e.g., /api/auth without trailing path)
    app.all(
      route.prefix,
      {
        preHandler: getPreHandlers(route),
        config: routeConfig,
      },
      async (request, reply) => {
        return proxyRequest(request, reply, route);
      }
    );
  }
}

/**
 * Get pre-handlers based on route auth requirement
 */
function getPreHandlers(route: ServiceRoute) {
  switch (route.auth) {
    case 'required':
      return [requireAuth];
    case 'optional':
      return [optionalAuth];
    case 'none':
    default:
      return [];
  }
}

/**
 * Proxy a request to an upstream service
 */
async function proxyRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  route: ServiceRoute
): Promise<void> {
  const { method, url, headers: requestHeaders, body } = request;

  // Calculate target path
  let targetPath: string;
  if (route.stripPrefix !== false) {
    // Default is to strip prefix
    targetPath = url.replace(route.prefix, '') || '/';
  } else {
    targetPath = url;
  }

  const targetUrl = `${route.upstream}${targetPath}`;

  // Prepare headers
  const headers: Record<string, string> = {};

  for (const [key, value] of Object.entries(requestHeaders)) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase()) && value) {
      const headerValue = Array.isArray(value) ? value[0] : value;
      if (headerValue) {
        headers[key] = headerValue;
      }
    }
  }

  // Add gateway headers
  headers['x-request-id'] = request.id;
  headers['x-forwarded-for'] = getClientIp(request);
  headers['x-forwarded-proto'] = request.protocol;
  headers['x-forwarded-host'] = requestHeaders.host ?? '';

  // Add auth context headers if user is authenticated
  if (request.user) {
    headers['x-user-id'] = request.user.userId;
    if (request.user.tenantId) {
      headers['x-tenant-id'] = request.user.tenantId;
    }
    if (request.user.email) {
      headers['x-user-email'] = request.user.email;
    }
    if (request.user.role) {
      headers['x-user-role'] = request.user.role;
    }
  }

  // Set correct host header for upstream
  headers['host'] = new URL(route.upstream).host;

  const breaker = getCircuitBreaker(route.serviceName, {
    timeout: route.timeout ?? 30000,
  });

  const makeRequest = async () => {
    const controller = new AbortController();
    const timeout = route.timeout ?? 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };

      if (shouldHaveBody(method) && body) {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(targetUrl, fetchOptions);

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  try {
    const response = await breaker.execute(makeRequest);

    // Set response status
    void reply.status(response.status);

    // Forward response headers
    response.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
        void reply.header(key, value);
      }
    });

    // Add gateway headers
    void reply.header('x-served-by', 'skillancer-api-gateway');
    void reply.header('x-upstream-service', route.serviceName);

    // Stream response body
    const responseBody = await response.text();

    // Try to parse as JSON, otherwise return as-is
    try {
      const jsonBody = JSON.parse(responseBody) as unknown;
      return await reply.send(jsonBody);
    } catch {
      return reply.send(responseBody);
    }
  } catch (error) {
    request.log.error(
      {
        error,
        service: route.serviceName,
        targetUrl,
      },
      'Proxy request failed'
    );

    if (error instanceof CircuitOpenError) {
      throw new ServiceUnavailableError(
        `Service ${route.serviceName} is temporarily unavailable`,
        route.serviceName
      );
    }

    if (error instanceof TimeoutError || (error as Error).name === 'AbortError') {
      throw new GatewayTimeoutError(`Request to ${route.serviceName} timed out`, route.serviceName);
    }

    throw new BadGatewayError(`Failed to connect to ${route.serviceName}`, route.serviceName);
  }
}

/**
 * Check if HTTP method should have a body
 */
function shouldHaveBody(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

/**
 * Get client IP from request, handling proxied requests
 */
function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const firstIp = forwarded.split(',')[0]?.trim();
    return firstIp ?? request.ip;
  }
  return request.ip;
}

export const proxyPlugin = fp(proxyPluginImpl, {
  name: 'proxy-plugin',
  dependencies: ['auth-plugin'],
});

// Export the proxyRequest function for use in custom routes
export { proxyRequest };
