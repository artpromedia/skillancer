/**
 * @fileoverview Express middleware for structured logging
 *
 * Provides request/response logging, error handling, and context propagation
 * for Express applications.
 */

import { runWithContext, setContext, getContext } from './context.js';
import {
  serializeExpressRequest,
  serializeExpressResponse,
  serializeError,
  calculateResponseTime,
  formatDuration,
} from './serializers.js';

import { createLogger, type LoggerConfig } from './index.js';

import type { LogContext } from './context.js';
import type { Request, Response, NextFunction, ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from 'pino';

/**
 * Configuration options for the Express logger middleware
 */
export interface ExpressLoggerOptions extends Partial<LoggerConfig> {
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
  requestIdExtractor?: (req: Request) => string;

  /**
   * Custom function to extract user ID from request
   */
  userIdExtractor?: (req: Request) => string | undefined;

  /**
   * Custom function to extract tenant ID from request
   */
  tenantIdExtractor?: (req: Request) => string | undefined;

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

  /**
   * Custom logger instance (optional, will create one if not provided)
   */
  logger?: Logger;
}

/**
 * Extended Express Request with logger properties
 */
export interface LoggedRequest extends Request {
  requestId: string;
  startTime: [number, number];
  log: Logger;
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
 * Create Express logger middleware
 */
export function createExpressLogger(options: ExpressLoggerOptions = {}): RequestHandler {
  const {
    logRequests = true,
    requestIdExtractor,
    userIdExtractor,
    tenantIdExtractor,
    ignorePaths = ['/health', '/ready', '/metrics', '/favicon.ico'],
    logQuery = true,
    logHeaders = true,
    logger: providedLogger,
    ...loggerConfig
  } = options;

  // Create or use provided logger
  const logger =
    providedLogger ??
    createLogger({
      name: 'express',
      ...loggerConfig,
    });

  return (req: Request, res: Response, next: NextFunction): void => {
    const loggedReq = req as LoggedRequest;

    // Generate or extract request ID
    const requestId =
      requestIdExtractor?.(req) ??
      (req.headers['x-request-id'] as string) ??
      (req.headers['x-correlation-id'] as string) ??
      generateRequestId();

    // Store request metadata
    loggedReq.requestId = requestId;
    loggedReq.startTime = process.hrtime();

    // Extract context information
    const userId = userIdExtractor?.(req);
    const tenantId = tenantIdExtractor?.(req);

    // Set up logging context - only include defined values
    const context: LogContext = {
      requestId,
      path: req.path,
      method: req.method,
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
    loggedReq.log = requestLogger;

    // Set response headers
    res.setHeader('x-request-id', requestId);

    // Run the rest of the request in async local storage context
    runWithContext(context, () => {
      // Check if path should be ignored
      const shouldLog = logRequests && !shouldIgnorePath(req.path, ignorePaths);

      // Log incoming request
      if (shouldLog) {
        const requestLog = serializeExpressRequest(req);

        // Optionally remove query and headers
        if (!logQuery) {
          delete requestLog.query;
        }
        if (!logHeaders) {
          delete requestLog.headers;
        }

        logger.info({
          msg: 'incoming request',
          requestId,
          request: requestLog,
        });
      }

      // Log response on finish
      if (shouldLog) {
        res.on('finish', () => {
          const responseTime = calculateResponseTime(loggedReq.startTime);
          const responseLog = serializeExpressResponse(res);

          const logData = {
            msg: 'request completed',
            requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            responseTime,
            responseTimeFormatted: formatDuration(responseTime),
            response: responseLog,
          };

          // Use appropriate log level based on status code
          if (res.statusCode >= 500) {
            logger.error(logData);
          } else if (res.statusCode >= 400) {
            logger.warn(logData);
          } else {
            logger.info(logData);
          }
        });
      }

      next();
    });
  };
}

/**
 * Create Express error logging middleware
 */
export function createExpressErrorLogger(options: ExpressLoggerOptions = {}): ErrorRequestHandler {
  const { logResponseBodyOnError = false, logger: providedLogger, ...loggerConfig } = options;

  // Create or use provided logger
  const logger =
    providedLogger ??
    createLogger({
      name: 'express-error',
      ...loggerConfig,
    });

  return (err: Error, req: Request, res: Response, next: NextFunction): void => {
    const loggedReq = req as LoggedRequest;

    const requestId = loggedReq.requestId ?? 'unknown';
    const responseTime = loggedReq.startTime
      ? calculateResponseTime(loggedReq.startTime)
      : undefined;

    const errorLog = serializeError(err);

    // Determine status code
    const statusCode =
      (err as Error & { statusCode?: number }).statusCode ??
      (err as Error & { status?: number }).status ??
      res.statusCode ??
      500;

    const logData: Record<string, unknown> = {
      msg: 'request error',
      requestId,
      method: req.method,
      path: req.path,
      statusCode,
      responseTime,
      responseTimeFormatted: responseTime ? formatDuration(responseTime) : undefined,
      error: errorLog,
    };

    if (logResponseBodyOnError && req.body) {
      logData.requestBody = req.body;
    }

    logger.error(logData);

    // Pass error to next handler
    next(err);
  };
}

/**
 * Get logger from request object
 */
export function getRequestLogger(req: Request): Logger | undefined {
  return (req as LoggedRequest).log;
}

/**
 * Get request ID from request object
 */
export function getRequestId(req: Request): string | undefined {
  return (req as LoggedRequest).requestId;
}

/**
 * Helper to run code within a request context
 */
export { runWithContext, getContext, setContext };

/**
 * Export types
 */
export type { Logger } from 'pino';
export type { LogContext } from './context.js';
