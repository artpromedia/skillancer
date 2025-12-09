/**
 * @module @skillancer/auth-svc/middleware/error-handler
 * Centralized error handling middleware
 */

import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';

import { AppError } from '@skillancer/utils';

import type { ErrorResponse } from '../schemas/index.js';

/**
 * Format Zod validation errors into a readable format
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  }

  return formatted;
}

/**
 * Global error handler for auth service
 *
 * Handles:
 * - AppError instances (custom errors)
 * - ZodError instances (validation errors)
 * - Fastify errors
 * - Unknown errors
 */
export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  // Log error with request context
  request.log.error(
    {
      err: error,
      requestId: request.id,
      url: request.url,
      method: request.method,
    },
    'Request error'
  );

  // Handle AppError (our custom errors)
  if (error instanceof AppError) {
    const response: ErrorResponse = {
      statusCode: error.statusCode,
      error: error.name,
      message: error.message,
      code: error.code,
      details: error.details,
    };

    void reply.status(error.statusCode).send(response);
    return;
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const response: ErrorResponse = {
      statusCode: 400,
      error: 'ValidationError',
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: {
        errors: formatZodErrors(error),
      },
    };

    void reply.status(400).send(response);
    return;
  }

  // Handle Fastify errors (validation, etc.)
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    const response: ErrorResponse = {
      statusCode: error.statusCode,
      error: error.name || 'Error',
      message: error.message,
      code: (error as { code?: string }).code,
    };

    void reply.status(error.statusCode).send(response);
    return;
  }

  // Handle unknown errors
  const isProduction = process.env['NODE_ENV'] === 'production';

  const response: ErrorResponse = {
    statusCode: 500,
    error: 'InternalServerError',
    message: isProduction ? 'An unexpected error occurred' : error.message,
    code: 'INTERNAL_ERROR',
    details: isProduction
      ? undefined
      : {
          stack: error.stack,
        },
  };

  void reply.status(500).send(response);
}
