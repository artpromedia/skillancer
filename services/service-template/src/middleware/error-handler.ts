/**
 * @module @skillancer/service-template/middleware/error-handler
 * Global error handling middleware
 */

import { AppError } from '../utils/errors.js';

import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

type LogFn = (obj: object, msg: string) => void;

/**
 * Global error handler for Fastify
 */
export function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const requestId = request.id;
  const log = request.log as { warn?: LogFn; error?: LogFn };

  // Handle AppError (our custom errors)
  if (error instanceof AppError) {
    log.warn?.(
      {
        err: error,
        requestId,
        statusCode: error.statusCode,
        errorCode: error.code,
      },
      error.message
    );

    const response: ErrorResponse = {
      statusCode: error.statusCode,
      error: error.name,
      message: error.message,
      requestId,
    };

    if (error.details) {
      response.details = error.details;
    }

    void reply.status(error.statusCode).send(response);
    return;
  }

  // Handle Fastify validation errors
  if ('validation' in error && error.validation) {
    log.warn?.(
      {
        err: error,
        requestId,
        validation: error.validation,
      },
      'Validation error'
    );

    void reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: error.validation,
      requestId,
    } satisfies ErrorResponse);
    return;
  }

  // Handle Fastify errors with status code
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    const statusCode = error.statusCode;

    if (statusCode >= 500) {
      log.error?.({ err: error, requestId }, error.message);
    } else {
      log.warn?.({ err: error, requestId }, error.message);
    }

    void reply.status(statusCode).send({
      statusCode,
      error: getErrorName(statusCode),
      message: error.message,
      requestId,
    } satisfies ErrorResponse);
    return;
  }

  // Handle unknown errors
  log.error?.({ err: error, requestId }, 'Unhandled error');

  void reply.status(500).send({
    statusCode: 500,
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    requestId,
  } satisfies ErrorResponse);
}

/**
 * Get error name from HTTP status code
 */
function getErrorName(statusCode: number): string {
  const names: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };

  return names[statusCode] || 'Error';
}
