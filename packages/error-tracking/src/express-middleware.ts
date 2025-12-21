/* eslint-disable import/order, @typescript-eslint/no-namespace, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
/**
 * Express middleware for Sentry error tracking
 *
 * Automatically captures errors and adds request context
 */

import * as Sentry from '@sentry/node';
import type { Request, Response, NextFunction, ErrorRequestHandler, RequestHandler } from 'express';

export interface SentryMiddlewareOptions {
  /** Extract user ID from request */
  extractUserFromRequest?: (request: Request) => { id: string; email?: string } | undefined;
  /** Extract tenant ID from request */
  extractTenantFromRequest?: (request: Request) => string | undefined;
  /** Additional tags to add to all events */
  additionalTags?: (request: Request) => Record<string, string>;
  /** Routes to ignore for error tracking */
  ignoreRoutes?: (string | RegExp)[];
}

declare global {
  namespace Express {
    interface Request {
      sentryTransaction?: ReturnType<typeof Sentry.startInactiveSpan>;
    }
  }
}

/**
 * Create request handler middleware for Sentry
 */
export function createSentryRequestHandler(options: SentryMiddlewareOptions = {}): RequestHandler {
  const ignoreRoutes = options.ignoreRoutes || ['/health', '/ready', '/metrics'];

  const shouldIgnoreRoute = (url: string): boolean => {
    for (const route of ignoreRoutes) {
      if (typeof route === 'string' && url.includes(route)) {
        return true;
      }
      if (route instanceof RegExp && route.test(url)) {
        return true;
      }
    }
    return false;
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    if (shouldIgnoreRoute(req.originalUrl || req.url)) {
      next();
      return;
    }

    // Configure scope for this request
    Sentry.withScope((scope) => {
      // Set request context
      const requestId =
        (req.headers['x-request-id'] as string) ||
        (req.headers['x-correlation-id'] as string) ||
        '';
      if (requestId) {
        scope.setTag('request_id', requestId);
      }
      scope.setTag('http.method', req.method);
      scope.setTag('http.url', req.originalUrl || req.url);

      // Extract and set user context
      if (options.extractUserFromRequest) {
        try {
          const user = options.extractUserFromRequest(req);
          if (user) {
            scope.setUser(user);
          }
        } catch {
          // Ignore errors in user extraction
        }
      }

      // Extract and set tenant context
      if (options.extractTenantFromRequest) {
        try {
          const tenantId = options.extractTenantFromRequest(req);
          if (tenantId) {
            scope.setTag('tenant_id', tenantId);
          }
        } catch {
          // Ignore errors in tenant extraction
        }
      }

      // Add additional tags
      if (options.additionalTags) {
        try {
          const tags = options.additionalTags(req);
          scope.setTags(tags);
        } catch {
          // Ignore errors in tag extraction
        }
      }
    });

    // Start a transaction for this request
    const transaction = Sentry.startInactiveSpan({
      name: `${req.method} ${req.route?.path || req.originalUrl || req.url}`,
      op: 'http.server',
      attributes: {
        'http.method': req.method,
        'http.url': req.originalUrl || req.url,
        'http.route': req.route?.path || req.originalUrl || req.url,
      },
    });

    req.sentryTransaction = transaction;

    // Capture response data
    const originalEnd = res.end.bind(res);
    res.end = function endOverride(
      chunk?: unknown,
      encodingOrCallback?: BufferEncoding | (() => void),
      callback?: () => void
    ): Response {
      if (req.sentryTransaction) {
        req.sentryTransaction.setAttribute('http.status_code', res.statusCode);

        if (res.statusCode >= 400) {
          req.sentryTransaction.setStatus({ code: 2, message: `HTTP ${res.statusCode}` });
        } else {
          req.sentryTransaction.setStatus({ code: 1 });
        }

        req.sentryTransaction.end();
      }

      if (typeof encodingOrCallback === 'function') {
        return originalEnd(chunk, encodingOrCallback);
      }
      if (encodingOrCallback) {
        return originalEnd(chunk, encodingOrCallback, callback);
      }
      return originalEnd(chunk);
    } as typeof res.end;

    next();
  };
}

/**
 * Create error handler middleware for Sentry
 */
export function createSentryErrorHandler(
  options: SentryMiddlewareOptions = {}
): ErrorRequestHandler {
  const ignoreRoutes = options.ignoreRoutes || ['/health', '/ready', '/metrics'];

  const shouldIgnoreRoute = (url: string): boolean => {
    for (const route of ignoreRoutes) {
      if (typeof route === 'string' && url.includes(route)) {
        return true;
      }
      if (route instanceof RegExp && route.test(url)) {
        return true;
      }
    }
    return false;
  };

  return (error: Error, req: Request, res: Response, next: NextFunction): void => {
    if (shouldIgnoreRoute(req.originalUrl || req.url)) {
      next(error);
      return;
    }

    Sentry.withScope((scope) => {
      // Add request details
      scope.setExtra('request', {
        method: req.method,
        url: req.originalUrl || req.url,
        query: req.query,
        params: req.params,
        headers: {
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type'],
          host: req.headers.host,
        },
      });

      // Set error level based on status code
      const statusCode =
        (error as { statusCode?: number; status?: number }).statusCode ||
        (error as { status?: number }).status ||
        500;
      scope.setLevel(statusCode >= 500 ? 'error' : 'warning');
      scope.setTag('http.status_code', String(statusCode));

      // Set error type
      scope.setTag('error.type', error.name);

      // Capture the exception
      Sentry.captureException(error);
    });

    next(error);
  };
}

/**
 * Convenience function to create both middlewares
 */
export function createSentryMiddleware(options: SentryMiddlewareOptions = {}): {
  requestHandler: RequestHandler;
  errorHandler: ErrorRequestHandler;
} {
  return {
    requestHandler: createSentryRequestHandler(options),
    errorHandler: createSentryErrorHandler(options),
  };
}

export default createSentryMiddleware;
