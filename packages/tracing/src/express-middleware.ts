/* eslint-disable @typescript-eslint/no-namespace, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
/**
 * Express tracing middleware
 *
 * Provides request tracing with OpenTelemetry and AWS X-Ray for Express applications
 */

import {
  trace,
  SpanStatusCode,
  SpanKind,
  context,
  propagation,
  type Attributes,
  type Span,
} from '@opentelemetry/api';
import {
  SEMATTRS_HTTP_METHOD,
  SEMATTRS_HTTP_URL,
  SEMATTRS_HTTP_STATUS_CODE,
  SEMATTRS_NET_PEER_IP,
  SEMATTRS_HTTP_USER_AGENT,
} from '@opentelemetry/semantic-conventions';

import type { Request, Response, NextFunction, RequestHandler } from 'express';

export interface TracingMiddlewareOptions {
  serviceName?: string;
  ignoreRoutes?: (string | RegExp)[];
  extractUserFromRequest?: (request: Request) => string | undefined;
  additionalAttributes?: (request: Request) => Attributes;
}

// Extend Express Request to include tracing info
declare global {
  namespace Express {
    interface Request {
      span?: Span;
      traceId?: string;
    }
  }
}

/**
 * Creates Express tracing middleware
 */
export function createTracingMiddleware(options: TracingMiddlewareOptions = {}): RequestHandler {
  const tracer = trace.getTracer(options.serviceName || 'express-app');
  const ignoreRoutes = options.ignoreRoutes || ['/health', '/ready', '/metrics'];

  return (req: Request, res: Response, next: NextFunction): void => {
    const url = req.originalUrl || req.url;

    // Skip ignored routes
    for (const route of ignoreRoutes) {
      if (typeof route === 'string' && url.includes(route)) {
        next();
        return;
      }
      if (route instanceof RegExp && route.test(url)) {
        next();
        return;
      }
    }

    // Extract context from incoming request headers
    const parentContext = propagation.extract(context.active(), req.headers);

    const spanName = `${req.method} ${req.route?.path || url}`;

    const span = tracer.startSpan(
      spanName,
      {
        kind: SpanKind.SERVER,
        attributes: {
          [SEMATTRS_HTTP_METHOD]: req.method,
          [SEMATTRS_HTTP_URL]: url,
          [SEMATTRS_NET_PEER_IP]: req.ip || req.socket.remoteAddress || 'unknown',
          [SEMATTRS_HTTP_USER_AGENT]: req.headers['user-agent'] || 'unknown',
          'http.route': req.route?.path || url,
          'http.host': req.headers.host || 'unknown',
        },
      },
      parentContext
    );

    // Add custom attributes if provided
    if (options.additionalAttributes) {
      try {
        const additionalAttrs = options.additionalAttributes(req);
        span.setAttributes(additionalAttrs);
      } catch {
        // Ignore errors in custom attribute extraction
      }
    }

    // Extract user ID if provided
    if (options.extractUserFromRequest) {
      try {
        const userId = options.extractUserFromRequest(req);
        if (userId) {
          span.setAttribute('user.id', userId);
        }
      } catch {
        // Ignore errors in user extraction
      }
    }

    // Attach span and traceId to request
    req.span = span;
    req.traceId = span.spanContext().traceId;

    // Record start time
    const startTime = process.hrtime.bigint();

    // Capture original end function
    const originalEnd = res.end.bind(res);

    // Override res.end to capture response
    res.end = function endOverride(
      chunk?: unknown,
      encodingOrCallback?: BufferEncoding | (() => void),
      callback?: () => void
    ): Response {
      // Calculate response time
      const endTime = process.hrtime.bigint();
      const responseTimeMs = Number(endTime - startTime) / 1_000_000;

      span.setAttribute(SEMATTRS_HTTP_STATUS_CODE, res.statusCode);
      span.setAttribute('http.response_time_ms', responseTimeMs);

      // Set status based on HTTP status code
      if (res.statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode}`,
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.end();

      // Call original end with proper argument handling
      if (typeof encodingOrCallback === 'function') {
        return originalEnd(chunk, encodingOrCallback);
      }
      if (encodingOrCallback) {
        return originalEnd(chunk, encodingOrCallback, callback);
      }
      return originalEnd(chunk);
    } as typeof res.end;

    // Run the rest of the middleware chain within the span context
    context.with(trace.setSpan(context.active(), span), () => {
      next();
    });
  };
}

/**
 * Error handling middleware for tracing
 * Should be added after other error handlers
 */
export function createTracingErrorMiddleware(): (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void {
  return (error: Error, req: Request, res: Response, next: NextFunction): void => {
    if (req.span) {
      req.span.recordException(error);
      req.span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      req.span.setAttribute('error.type', error.name);
      req.span.setAttribute('error.message', error.message);
    }
    next(error);
  };
}

/**
 * Create a child span within the current request context
 */
export async function createSpan<T>(
  req: Request,
  name: string,
  fn: (span: Span) => T | Promise<T>,
  attributes?: Attributes
): Promise<T> {
  const tracer = trace.getTracer('express-app');

  return tracer.startActiveSpan(
    name,
    {
      kind: SpanKind.INTERNAL,
      ...(attributes && { attributes }),
    },
    async (span): Promise<T> => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        if (error instanceof Error) {
          span.recordException(error);
        }
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Get trace ID from request for logging correlation
 */
export function getTraceId(req: Request): string | undefined {
  return req.traceId;
}

/**
 * Add attributes to the current request span
 */
export function addRequestAttributes(req: Request, attributes: Attributes): void {
  if (req.span) {
    req.span.setAttributes(attributes);
  }
}

/**
 * Add event to the current request span
 */
export function addRequestEvent(req: Request, name: string, attributes?: Attributes): void {
  if (req.span) {
    req.span.addEvent(name, attributes);
  }
}

export default createTracingMiddleware;
