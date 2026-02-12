// @ts-nocheck
/**
 * @module @skillancer/integration-hub-svc/middleware/error-handler
 * Global error handler
 */

import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const requestId = request.id;

  // Log the error
  request.log.error({ err: error, requestId }, 'Request error');

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.errors,
      },
      requestId,
    } as ErrorResponse);
    return;
  }

  // Handle OAuth errors
  if (error.message?.includes('OAuth')) {
    reply.status(400).send({
      error: {
        code: 'OAUTH_ERROR',
        message: error.message,
      },
      requestId,
    } as ErrorResponse);
    return;
  }

  // Handle integration errors
  if (error.message?.includes('Integration')) {
    reply.status(400).send({
      error: {
        code: 'INTEGRATION_ERROR',
        message: error.message,
      },
      requestId,
    } as ErrorResponse);
    return;
  }

  // Handle known HTTP errors
  if (error.statusCode) {
    reply.status(error.statusCode).send({
      error: {
        code: error.code || 'HTTP_ERROR',
        message: error.message,
      },
      requestId,
    } as ErrorResponse);
    return;
  }

  // Handle unknown errors
  reply.status(500).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'An internal error occurred' : error.message,
    },
    requestId,
  } as ErrorResponse);
}
