/**
 * @module @skillancer/api-gateway/middleware/error-handler
 * Global error handling middleware
 */

import { CircuitOpenError, TimeoutError } from '../utils/circuit-breaker.js';
import { AppError } from '../utils/errors.js';

import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  code?: string;
  details?: unknown;
  requestId?: string;
}

/**
 * Global error handler for Fastify
 */
export function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const requestId = request.id;

  // Handle our custom AppError
  if (error instanceof AppError) {
    request.log.warn(
      {
        err: error,
        requestId,
        statusCode: error.statusCode,
        code: error.code,
      },
      error.message
    );

    const response: ErrorResponse = {
      statusCode: error.statusCode,
      error: error.name,
      message: error.message,
      code: error.code,
      requestId,
    };

    if (error.details) {
      response.details = error.details;
    }

    void reply.status(error.statusCode).send(response);
    return;
  }

  // Handle Circuit Breaker errors
  if (error instanceof CircuitOpenError) {
    request.log.warn({ err: error, requestId }, 'Circuit breaker open');

    void reply.status(503).send({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'Service is temporarily unavailable',
      code: 'CIRCUIT_OPEN',
      requestId,
    } satisfies ErrorResponse);
    return;
  }

  // Handle Timeout errors
  if (error instanceof TimeoutError) {
    request.log.warn({ err: error, requestId }, 'Request timeout');

    void reply.status(504).send({
      statusCode: 504,
      error: 'Gateway Timeout',
      message: 'Upstream service timed out',
      code: 'GATEWAY_TIMEOUT',
      requestId,
    } satisfies ErrorResponse);
    return;
  }

  // Handle Fastify validation errors
  if ('validation' in error && error.validation) {
    request.log.warn(
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
      code: 'VALIDATION_ERROR',
      details: error.validation,
      requestId,
    } satisfies ErrorResponse);
    return;
  }

  // Handle Fastify errors with status code
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    const statusCode = error.statusCode;

    if (statusCode >= 500) {
      request.log.error({ err: error, requestId }, error.message);
    } else {
      request.log.warn({ err: error, requestId }, error.message);
    }

    const errorCode = (error as { code?: string }).code;
    const response: ErrorResponse = {
      statusCode,
      error: getErrorName(statusCode),
      message: error.message,
      requestId,
    };
    if (errorCode) {
      response.code = errorCode;
    }
    void reply.status(statusCode).send(response);
    return;
  }

  // Handle unknown errors
  request.log.error({ err: error, requestId }, 'Unhandled error');

  void reply.status(500).send({
    statusCode: 500,
    error: 'Internal Server Error',
    message:
      process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
    code: 'INTERNAL_ERROR',
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

  return names[statusCode] ?? 'Error';
}
