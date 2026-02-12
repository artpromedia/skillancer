/**
 * Error Handler Middleware
 */

import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  request.log.error({
    err: error,
    request: {
      method: request.method,
      url: request.url,
      params: request.params,
      query: request.query,
    },
  });

  // Don't expose internal errors in production
  const isProduction = process.env.NODE_ENV === 'production';
  const responseMessage = statusCode >= 500 && isProduction ? 'Internal Server Error' : message;

  reply.status(statusCode).send({
    error: true,
    statusCode,
    message: responseMessage,
    ...(error.code && { code: error.code }),
    ...(!isProduction && error.stack && { stack: error.stack }),
  });
}
