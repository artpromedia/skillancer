/**
 * @module @skillancer/api-gateway/plugins/sentry
 * Sentry error tracking integration with enhanced monitoring
 *
 * Features:
 * - Error capturing with context
 * - Performance monitoring (transactions, spans)
 * - Custom breadcrumbs for debugging
 * - User context tracking
 * - Environment-aware sampling
 */

import * as Sentry from '@sentry/node';
import fp from 'fastify-plugin';

import { getConfig } from '../config/index.js';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// =============================================================================
// TYPES
// =============================================================================

interface SentryUser {
  userId?: string;
  email?: string;
  role?: string;
}

interface PerformanceMetrics {
  dbQueryCount: number;
  externalApiCalls: number;
  cacheHits: number;
  cacheMisses: number;
}

// =============================================================================
// SENTRY PLUGIN
// =============================================================================

async function sentryPluginImpl(app: FastifyInstance): Promise<void> {
  const config = getConfig();
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.log('[Sentry] DSN not configured, error tracking disabled');
    return;
  }

  // Determine sample rates based on environment
  const sampleRates = {
    development: { traces: 1.0, profiles: 1.0, errors: 1.0 },
    staging: { traces: 0.5, profiles: 0.5, errors: 1.0 },
    production: { traces: 0.1, profiles: 0.1, errors: 1.0 },
  };

  const rates = sampleRates[config.env as keyof typeof sampleRates] || sampleRates.production;

  // Initialize Sentry
  Sentry.init({
    dsn,
    environment: config.env,
    release: `skillancer-api-gateway@${config.service.version}`,
    serverName: process.env.HOSTNAME || 'api-gateway',

    // Performance monitoring
    tracesSampleRate: rates.traces,
    profilesSampleRate: rates.profiles,

    // Integrations
    integrations: [
      Sentry.httpIntegration({ tracing: true }),
      Sentry.prismaIntegration(),
      Sentry.redisIntegration(),
    ],

    // Sensitive data scrubbing
    beforeSend(event, hint) {
      // Filter out expected errors
      const error = hint.originalException;
      if (error instanceof Error) {
        const ignoredMessages = [
          'Rate limit exceeded',
          'Unauthorized',
          'Not Found',
          'Bad Request',
          'Validation failed',
        ];

        if (ignoredMessages.some((msg) => error.message.includes(msg))) {
          return null;
        }
      }

      // Scrub sensitive data
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-api-key'];
      }

      // Scrub passwords from request body
      if (event.request?.data && typeof event.request.data === 'string') {
        try {
          const body = JSON.parse(event.request.data);
          if (body.password) body.password = '[REDACTED]';
          if (body.currentPassword) body.currentPassword = '[REDACTED]';
          if (body.newPassword) body.newPassword = '[REDACTED]';
          if (body.token) body.token = '[REDACTED]';
          event.request.data = JSON.stringify(body);
        } catch {
          // Not JSON, leave as is
        }
      }

      return event;
    },

    // Breadcrumb filtering
    beforeBreadcrumb(breadcrumb) {
      // Exclude noisy breadcrumbs
      if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
        return null;
      }
      return breadcrumb;
    },
  });

  console.log('[Sentry] Error tracking initialized with enhanced monitoring');

  // =============================================================================
  // REQUEST LIFECYCLE HOOKS
  // =============================================================================

  // Start transaction on request
  app.addHook('onRequest', async (request: FastifyRequest) => {
    // Create transaction for performance monitoring
    const transaction = Sentry.startTransaction({
      op: 'http.server',
      name: `${request.method} ${request.routeOptions?.url || request.url}`,
      data: {
        'http.method': request.method,
        'http.url': request.url,
      },
    });

    // Store transaction on request for later use
    (request as any).sentryTransaction = transaction;
    (request as any).sentryMetrics = {
      dbQueryCount: 0,
      externalApiCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
    } as PerformanceMetrics;

    // Add request breadcrumb
    Sentry.addBreadcrumb({
      category: 'http',
      message: `${request.method} ${request.url}`,
      level: 'info',
      data: {
        requestId: request.id,
        userAgent: request.headers['user-agent'],
      },
    });

    // Set request context
    Sentry.setContext('request', {
      id: request.id,
      method: request.method,
      url: request.url,
      ip: request.ip,
      headers: {
        'user-agent': request.headers['user-agent'],
        'x-request-id': request.headers['x-request-id'],
        'x-forwarded-for': request.headers['x-forwarded-for'],
      },
    });

    // Add user context if authenticated
    const user = (request as any).user as SentryUser | undefined;
    if (user?.userId) {
      Sentry.setUser({
        id: user.userId,
        email: user.email,
        role: user.role,
      });
    }
  });

  // Add response context
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const transaction = (request as any).sentryTransaction;
    const metrics = (request as any).sentryMetrics as PerformanceMetrics;

    if (transaction) {
      // Add response data
      transaction.setHttpStatus(reply.statusCode);
      transaction.setData('http.status_code', reply.statusCode);
      transaction.setData('http.response_content_length', reply.getHeader('content-length'));

      // Add performance metrics
      if (metrics) {
        transaction.setData('db.query_count', metrics.dbQueryCount);
        transaction.setData('external.api_calls', metrics.externalApiCalls);
        transaction.setData('cache.hits', metrics.cacheHits);
        transaction.setData('cache.misses', metrics.cacheMisses);
      }

      // Finish transaction
      transaction.finish();
    }

    // Add response breadcrumb for non-2xx responses
    if (reply.statusCode >= 400) {
      Sentry.addBreadcrumb({
        category: 'http',
        message: `Response ${reply.statusCode} for ${request.method} ${request.url}`,
        level: reply.statusCode >= 500 ? 'error' : 'warning',
        data: {
          requestId: request.id,
          statusCode: reply.statusCode,
        },
      });
    }
  });

  // =============================================================================
  // ERROR HANDLING
  // =============================================================================

  app.setErrorHandler(async (error: Error, request: FastifyRequest, reply: FastifyReply) => {
    const transaction = (request as any).sentryTransaction;

    // Add error breadcrumb
    Sentry.addBreadcrumb({
      category: 'error',
      message: error.message,
      level: 'error',
      data: {
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      },
    });

    // Capture error with full context
    const eventId = Sentry.captureException(error, {
      extra: {
        requestId: request.id,
        method: request.method,
        url: request.url,
        params: request.params,
        query: request.query,
        body: request.body,
        metrics: (request as any).sentryMetrics,
      },
      tags: {
        service: 'api-gateway',
        environment: config.env,
        requestId: request.id,
        route: request.routeOptions?.url || 'unknown',
      },
      fingerprint: [error.name, request.method, request.routeOptions?.url || request.url],
    });

    // Set error on transaction
    if (transaction) {
      transaction.setStatus('internal_error');
    }

    // Determine status code
    const statusCode = 'statusCode' in error ? (error as any).statusCode : 500;

    // Log the error
    request.log.error(
      {
        err: error,
        requestId: request.id,
        sentryEventId: eventId,
      },
      'Request error'
    );

    // Send error response
    return reply.status(statusCode).send({
      statusCode,
      error: statusCode >= 500 ? 'Internal Server Error' : error.name,
      message:
        statusCode >= 500 && config.env === 'production'
          ? 'An unexpected error occurred'
          : error.message,
      requestId: request.id,
      ...(config.env !== 'production' && { sentryEventId: eventId }),
    });
  });

  // =============================================================================
  // HELPER DECORATORS
  // =============================================================================

  // Add helper to track database queries
  app.decorateRequest('trackDbQuery', function (this: FastifyRequest) {
    const metrics = (this as any).sentryMetrics as PerformanceMetrics;
    if (metrics) {
      metrics.dbQueryCount++;
    }

    Sentry.addBreadcrumb({
      category: 'db',
      message: 'Database query',
      level: 'debug',
    });
  });

  // Add helper to track external API calls
  app.decorateRequest('trackApiCall', function (this: FastifyRequest, service: string) {
    const metrics = (this as any).sentryMetrics as PerformanceMetrics;
    if (metrics) {
      metrics.externalApiCalls++;
    }

    Sentry.addBreadcrumb({
      category: 'http',
      message: `External API call to ${service}`,
      level: 'info',
    });
  });

  // Add helper to track cache operations
  app.decorateRequest('trackCache', function (this: FastifyRequest, hit: boolean) {
    const metrics = (this as any).sentryMetrics as PerformanceMetrics;
    if (metrics) {
      if (hit) {
        metrics.cacheHits++;
      } else {
        metrics.cacheMisses++;
      }
    }
  });

  // =============================================================================
  // CLEANUP
  // =============================================================================

  // Flush events on close
  app.addHook('onClose', async () => {
    await Sentry.close(2000);
    console.log('[Sentry] Flushed and closed');
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sentryPlugin = fp(sentryPluginImpl as any, {
  name: 'sentry-plugin',
});
