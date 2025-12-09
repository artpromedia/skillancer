/**
 * Fastify plugin for Sentry error tracking
 *
 * Automatically captures errors and adds request context
 */

import type { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import * as Sentry from '@sentry/node';

export interface SentryPluginOptions {
  /** Extract user ID from request */
  extractUserFromRequest?: (request: FastifyRequest) => { id: string; email?: string } | undefined;
  /** Extract tenant ID from request */
  extractTenantFromRequest?: (request: FastifyRequest) => string | undefined;
  /** Additional tags to add to all events */
  additionalTags?: (request: FastifyRequest) => Record<string, string>;
  /** Routes to ignore for error tracking */
  ignoreRoutes?: (string | RegExp)[];
}

declare module 'fastify' {
  interface FastifyRequest {
    sentryTransaction?: ReturnType<typeof Sentry.startInactiveSpan>;
  }
}

const sentryPluginCallback: FastifyPluginCallback<SentryPluginOptions> = (fastify, options, done) => {
  const ignoreRoutes = options.ignoreRoutes || ['/health', '/ready', '/metrics'];

  // Check if route should be ignored
  const shouldIgnoreRoute = (url: string): boolean => {
    for (const route of ignoreRoutes) {
      if (typeof route === 'string' && url.includes(route)) {
        return true;
      }
      if (route instanceof RegExp && route.test(url)) {
        return true;
      }
    }
    return false;
  };

  // Request hook - set up Sentry context
  fastify.addHook('onRequest', (request, reply, hookDone) => {
    if (shouldIgnoreRoute(request.url)) {
      hookDone();
      return;
    }

    // Configure scope for this request
    Sentry.withScope((scope) => {
      // Set request context
      scope.setTag('request_id', request.id);
      scope.setTag('http.method', request.method);
      scope.setTag('http.url', request.url);

      // Extract and set user context
      if (options.extractUserFromRequest) {
        try {
          const user = options.extractUserFromRequest(request);
          if (user) {
            scope.setUser(user);
          }
        } catch {
          // Ignore errors in user extraction
        }
      }

      // Extract and set tenant context
      if (options.extractTenantFromRequest) {
        try {
          const tenantId = options.extractTenantFromRequest(request);
          if (tenantId) {
            scope.setTag('tenant_id', tenantId);
          }
        } catch {
          // Ignore errors in tenant extraction
        }
      }

      // Add additional tags
      if (options.additionalTags) {
        try {
          const tags = options.additionalTags(request);
          scope.setTags(tags);
        } catch {
          // Ignore errors in tag extraction
        }
      }
    });

    // Start a transaction for this request
    const transaction = Sentry.startInactiveSpan({
      name: `${request.method} ${request.routeOptions?.url || request.url}`,
      op: 'http.server',
      attributes: {
        'http.method': request.method,
        'http.url': request.url,
        'http.route': request.routeOptions?.url || request.url,
      },
    });

    request.sentryTransaction = transaction;

    hookDone();
  });

  // Error hook - capture exceptions
  fastify.addHook('onError', (request, reply, error, hookDone) => {
    if (shouldIgnoreRoute(request.url)) {
      hookDone();
      return;
    }

    Sentry.withScope((scope) => {
      // Add request details
      scope.setExtra('request', {
        method: request.method,
        url: request.url,
        query: request.query,
        params: request.params,
        headers: {
          'user-agent': request.headers['user-agent'],
          'content-type': request.headers['content-type'],
          host: request.headers.host,
        },
      });

      // Set error level based on status code
      const statusCode = (error as { statusCode?: number }).statusCode || 500;
      scope.setLevel(statusCode >= 500 ? 'error' : 'warning');
      scope.setTag('http.status_code', String(statusCode));

      // Set error type
      scope.setTag('error.type', error.name);

      // Capture the exception
      Sentry.captureException(error);
    });

    hookDone();
  });

  // Response hook - finish transaction
  fastify.addHook('onResponse', (request, reply, hookDone) => {
    if (request.sentryTransaction) {
      // Set HTTP status
      request.sentryTransaction.setAttribute('http.status_code', reply.statusCode);

      // Set status based on response code
      if (reply.statusCode >= 400) {
        request.sentryTransaction.setStatus({ code: 2, message: `HTTP ${reply.statusCode}` });
      } else {
        request.sentryTransaction.setStatus({ code: 1 });
      }

      // End the transaction
      request.sentryTransaction.end();
    }

    hookDone();
  });

  // Decorate fastify with Sentry utilities
  fastify.decorate('captureException', (error: Error, context?: Record<string, unknown>) => {
    Sentry.withScope((scope) => {
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }
      return Sentry.captureException(error);
    });
  });

  fastify.decorate('captureMessage', (message: string, level: Sentry.SeverityLevel = 'info') => {
    return Sentry.captureMessage(message, level);
  });

  done();
};

export const sentryPlugin = fp(sentryPluginCallback, {
  name: '@skillancer/error-tracking',
  fastify: '4.x',
});

export default sentryPlugin;
