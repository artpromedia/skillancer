// @ts-nocheck - Fastify type compatibility issues
/**
 * Request context plugin for correlation IDs
 */

import fp from 'fastify-plugin';

import type { FastifyInstance } from 'fastify';

// Extend FastifyRequest with context
declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
    startTime: number;
  }
}

function requestContextPluginImpl(
  app: FastifyInstance,
  _opts: Record<string, never>,
  done: (err?: Error) => void
): void {
  // Add correlation ID and timing to each request
  app.addHook('onRequest', (request, _reply, hookDone) => {
    request.correlationId =
      (request.headers['x-correlation-id'] as string) ||
      (request.headers['x-request-id'] as string) ||
      request.id;
    request.startTime = Date.now();
    hookDone();
  });

  // Log request completion
  app.addHook('onResponse', (request, reply, hookDone) => {
    const duration = Date.now() - request.startTime;
    const log = request.log as { info?: (obj: object, msg: string) => void };

    log.info?.(
      {
        requestId: request.id,
        correlationId: request.correlationId,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        duration,
      },
      'Request completed'
    );
    hookDone();
  });

  done();
}

export const requestContextPlugin = fp(requestContextPluginImpl, {
  name: 'request-context-plugin',
}) as any;
