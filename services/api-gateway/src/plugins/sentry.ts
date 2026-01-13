/**
 * @module @skillancer/api-gateway/plugins/sentry
 * Sentry error tracking integration
 */

import * as Sentry from '@sentry/node';
import fp from 'fastify-plugin';

import { getConfig } from '../config/index.js';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

async function sentryPluginImpl(app: FastifyInstance): Promise<void> {
  const config = getConfig();
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.log('[Sentry] DSN not configured, error tracking disabled');
    return;
  }

  // Initialize Sentry
  Sentry.init({
    dsn,
    environment: config.env,
    release: `skillancer-api-gateway@${config.service.version}`,
    tracesSampleRate: config.env === 'production' ? 0.1 : 1.0,
    profilesSampleRate: config.env === 'production' ? 0.1 : 1.0,
    integrations: [
      Sentry.httpIntegration(),
    ],
    beforeSend(event, hint) {
      // Filter out expected errors
      const error = hint.originalException;
      if (error instanceof Error) {
        // Don't send rate limit or auth errors to Sentry
        if (error.message.includes('Rate limit exceeded')) {
          return null;
        }
        if (error.message.includes('Unauthorized')) {
          return null;
        }
      }
      return event;
    },
  });

  console.log('[Sentry] Error tracking initialized');

  // Add request context to Sentry
  app.addHook('onRequest', async (request: FastifyRequest) => {
    Sentry.setContext('request', {
      id: request.id,
      method: request.method,
      url: request.url,
      headers: {
        'user-agent': request.headers['user-agent'],
        'x-request-id': request.headers['x-request-id'],
      },
    });

    // Add user context if authenticated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = (request as any).user as { userId?: string; email?: string } | undefined;
    if (user?.userId) {
      Sentry.setUser({
        id: user.userId,
        email: user.email,
      });
    }
  });

  // Capture errors
  app.setErrorHandler(async (error: Error, request: FastifyRequest, reply: FastifyReply) => {
    // Capture error in Sentry
    Sentry.captureException(error, {
      extra: {
        requestId: request.id,
        method: request.method,
        url: request.url,
        params: request.params,
        query: request.query,
      },
      tags: {
        service: 'api-gateway',
        environment: config.env,
      },
    });

    // Determine status code
    const statusCode = 'statusCode' in error ? (error as any).statusCode : 500;

    // Log the error
    request.log.error({ err: error, requestId: request.id }, 'Request error');

    // Send error response
    return reply.status(statusCode).send({
      statusCode,
      error: statusCode >= 500 ? 'Internal Server Error' : error.name,
      message: statusCode >= 500 && config.env === 'production'
        ? 'An unexpected error occurred'
        : error.message,
      requestId: request.id,
    });
  });

  // Flush events on close
  app.addHook('onClose', async () => {
    await Sentry.close(2000);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sentryPlugin = fp(sentryPluginImpl as any, {
  name: 'sentry-plugin',
});
