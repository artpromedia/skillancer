// @ts-nocheck - Fastify type compatibility issues
/**
 * @module @skillancer/api-gateway/plugins/request-logger
 * Request/response logging plugin
 */

import fp from 'fastify-plugin';

import type { FastifyInstance } from 'fastify';

async function requestLoggerPluginImpl(app: FastifyInstance): Promise<void> {
  await Promise.resolve();
  // Log incoming requests
  app.addHook('onRequest', (request, _reply, done) => {
    request.log.info(
      {
        method: request.method,
        url: request.url,
        userAgent: request.headers['user-agent'],
        contentLength: request.headers['content-length'],
        userId: request.user?.userId,
        tenantId: request.user?.tenantId,
      },
      'Incoming request'
    );
    done();
  });

  // Log completed requests
  app.addHook('onResponse', (request, reply, done) => {
    const responseTime = reply.elapsedTime;

    // Determine log level based on status code
    const statusCode = reply.statusCode;
    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    request.log[logLevel](
      {
        method: request.method,
        url: request.url,
        statusCode,
        responseTime: Math.round(responseTime * 100) / 100,
        contentLength: reply.getHeader('content-length'),
        userId: request.user?.userId,
      },
      'Request completed'
    );
    done();
  });

  // Log errors
  app.addHook('onError', (request, _reply, error, done) => {
    request.log.error(
      {
        method: request.method,
        url: request.url,
        error: {
          name: error.name,
          message: error.message,
          code: (error as { code?: string }).code,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        userId: request.user?.userId,
      },
      'Request error'
    );
    done();
  });
}

export const requestLoggerPlugin = fp(requestLoggerPluginImpl, {
  name: 'request-logger-plugin',
});
