/**
 * @fileoverview Fastify plugin for structured logging
 *
 * Provides request/response logging, error handling, and context propagation
 * for Fastify applications.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { createLogger, type LoggerConfig } from './index.js';
import { runWithContext, setContext, getContext } from './context.js';
import type { LogContext } from './context.js';
import {
  serializeFastifyRequest,
  serializeFastifyReply,
  serializeError,
  calculateResponseTime,
  formatDuration,
} from './serializers.js';
import type { Logger } from 'pino';

/**
 * Configuration options for the Fastify logger plugin
 */
export interface FastifyLoggerPluginOptions extends Partial<LoggerConfig> {
  /**
   * Whether to log all requests (default: true)
   */
  logRequests?: boolean;

  /**
   * Whether to log response body on error (default: false)
   */
  logResponseBodyOnError?: boolean;

  /**
   * Custom function to extract request ID from request
   */
  requestIdExtractor?: (req: FastifyRequest) => string;

  /**
   * Custom function to extract user ID from request
   */
  userIdExtractor?: (req: FastifyRequest) => string | undefined;

  /**
   * Custom function to extract tenant ID from request
   */
  tenantIdExtractor?: (req: FastifyRequest) => string | undefined;

  /**
   * Paths to ignore for request logging
   */
  ignorePaths?: string[];

  /**
   * Whether to include query parameters in logs (default: true)
   */
  logQuery?: boolean;

  /**
   * Whether to include request headers in logs (default: true)
   */
  logHeaders?: boolean;
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Check if a path should be ignored for logging
 */
function shouldIgnorePath(path: string, ignorePaths: string[]): boolean {
  return ignorePaths.some((ignorePath) => {
    // Support glob-like patterns with *
    if (ignorePath.includes('*')) {
      const pattern = new RegExp(`^${ignorePath.replace(/\*/g, '.*')}$`);
      return pattern.test(path);
    }
    return path === ignorePath || path.startsWith(ignorePath);
  });
}

/**
 * Fastify plugin implementation
 */
const fastifyLoggerPlugin: FastifyPluginAsync<FastifyLoggerPluginOptions> = async (
  fastify: FastifyInstance,
  options: FastifyLoggerPluginOptions
) => {
  const {
    logRequests = true,
    logResponseBodyOnError = false,
    requestIdExtractor,
    userIdExtractor,
    tenantIdExtractor,
    ignorePaths = ['/health', '/ready', '/metrics', '/favicon.ico'],
    logQuery = true,
    logHeaders = true,
    ...loggerConfig
  } = options;

  // Create the logger instance
  const logger = createLogger({
    name: 'fastify',
    ...loggerConfig,
  });

  // Store logger on fastify instance
  fastify.decorate('logger', logger);

  // Add request ID generation
  fastify.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    // Generate or extract request ID
    const requestId =
      requestIdExtractor?.(request) ??
      (request.headers['x-request-id'] as string) ??
      (request.headers['x-correlation-id'] as string) ??
      generateRequestId();

    // Store request ID on request object
    (request as FastifyRequest & { requestId: string }).requestId = requestId;

    // Store start time for response time calculation
    (request as FastifyRequest & { startTime: [number, number] }).startTime = process.hrtime();
  });

  // Wrap request handler in async local storage context
  fastify.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
    const requestId = (request as FastifyRequest & { requestId: string }).requestId;

    // Extract context information
    const userId = userIdExtractor?.(request);
    const tenantId = tenantIdExtractor?.(request);

    // Set up logging context - only include defined values
    const context: LogContext = {
      requestId,
      path: request.routerPath ?? request.url.split('?')[0],
      method: request.method,
    };
    if (userId !== undefined) context.userId = userId;
    if (tenantId !== undefined) context.tenantId = tenantId;

    setContext(context);

    // Create child logger with request context
    const childContext: Record<string, unknown> = { requestId };
    if (userId !== undefined) childContext.userId = userId;
    if (tenantId !== undefined) childContext.tenantId = tenantId;

    const requestLogger = logger.child(childContext);

    // Attach logger to request
    (request as FastifyRequest & { log: Logger }).log = requestLogger;
  });

  // Log incoming requests
  if (logRequests) {
    fastify.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
      const path = request.routerPath ?? request.url.split('?')[0];

      // Skip ignored paths
      if (shouldIgnorePath(path, ignorePaths)) {
        return;
      }

      const requestLog = serializeFastifyRequest(request);

      // Optionally remove query and headers
      if (!logQuery) {
        delete requestLog.query;
      }
      if (!logHeaders) {
        delete requestLog.headers;
      }

      const requestId = (request as FastifyRequest & { requestId: string }).requestId;

      logger.info({
        msg: 'incoming request',
        requestId,
        request: requestLog,
      });
    });
  }

  // Log responses
  if (logRequests) {
    fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
      const path = request.routerPath ?? request.url.split('?')[0];

      // Skip ignored paths
      if (shouldIgnorePath(path, ignorePaths)) {
        return;
      }

      const startTime = (request as FastifyRequest & { startTime: [number, number] }).startTime;
      const responseTime = calculateResponseTime(startTime);
      const requestId = (request as FastifyRequest & { requestId: string }).requestId;

      const responseLog = serializeFastifyReply(reply);

      const logData = {
        msg: 'request completed',
        requestId,
        method: request.method,
        path,
        statusCode: reply.statusCode,
        responseTime,
        responseTimeFormatted: formatDuration(responseTime),
        response: responseLog,
      };

      // Use appropriate log level based on status code
      if (reply.statusCode >= 500) {
        logger.error(logData);
      } else if (reply.statusCode >= 400) {
        logger.warn(logData);
      } else {
        logger.info(logData);
      }
    });
  }

  // Log errors
  fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    const startTime = (request as FastifyRequest & { startTime: [number, number] }).startTime;
    const responseTime = startTime ? calculateResponseTime(startTime) : undefined;
    const requestId = (request as FastifyRequest & { requestId: string }).requestId;

    const errorLog = serializeError(error);

    const logData: Record<string, unknown> = {
      msg: 'request error',
      requestId,
      method: request.method,
      path: request.routerPath ?? request.url.split('?')[0],
      statusCode: reply.statusCode,
      responseTime,
      responseTimeFormatted: responseTime ? formatDuration(responseTime) : undefined,
      error: errorLog,
    };

    if (logResponseBodyOnError) {
      logData.requestBody = request.body;
    }

    logger.error(logData);
  });

  // Add send hook to set response headers
  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, _payload) => {
    const requestId = (request as FastifyRequest & { requestId: string }).requestId;
    const startTime = (request as FastifyRequest & { startTime: [number, number] }).startTime;

    // Set response headers
    reply.header('x-request-id', requestId);

    if (startTime) {
      const responseTime = calculateResponseTime(startTime);
      reply.header('x-response-time', `${responseTime.toFixed(2)}ms`);
    }

    return _payload;
  });
};

/**
 * Fastify logger plugin with proper plugin encapsulation
 */
export const fastifyLogger = fp(fastifyLoggerPlugin, {
  name: '@skillancer/logger-fastify',
  fastify: '4.x',
});

/**
 * Helper to run code within a request context
 */
export { runWithContext, getContext, setContext };

/**
 * Export types
 */
export type { Logger } from 'pino';
export type { LogContext } from './context.js';

export default fastifyLogger;
