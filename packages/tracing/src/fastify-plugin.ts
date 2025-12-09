/**
 * Fastify tracing plugin
 *
 * Provides request tracing with OpenTelemetry and AWS X-Ray
 */

import type { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
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

export interface TracingPluginOptions {
  serviceName?: string;
  ignoreRoutes?: (string | RegExp)[];
  extractUserFromRequest?: (request: FastifyRequest) => string | undefined;
  additionalAttributes?: (request: FastifyRequest) => Attributes;
}

declare module 'fastify' {
  interface FastifyRequest {
    span?: Span;
    traceId?: string;
  }
}

const tracingPluginCallback: FastifyPluginCallback<TracingPluginOptions> = (
  fastify,
  options,
  done
) => {
  const tracer = trace.getTracer(options.serviceName || 'fastify-app');
  const ignoreRoutes = options.ignoreRoutes || ['/health', '/ready', '/metrics'];

  // Add onRequest hook to start span
  fastify.addHook('onRequest', (request, reply, hookDone) => {
    const url = request.url;

    // Skip ignored routes
    for (const route of ignoreRoutes) {
      if (typeof route === 'string' && url.includes(route)) {
        hookDone();
        return;
      }
      if (route instanceof RegExp && route.test(url)) {
        hookDone();
        return;
      }
    }

    // Extract context from incoming request headers
    const parentContext = propagation.extract(context.active(), request.headers);

    const spanName = `${request.method} ${request.routeOptions?.url || url}`;

    const span = tracer.startSpan(
      spanName,
      {
        kind: SpanKind.SERVER,
        attributes: {
          [SEMATTRS_HTTP_METHOD]: request.method,
          [SEMATTRS_HTTP_URL]: url,
          [SEMATTRS_NET_PEER_IP]: request.ip,
          [SEMATTRS_HTTP_USER_AGENT]: request.headers['user-agent'] || 'unknown',
          'http.route': request.routeOptions?.url || url,
        },
      },
      parentContext
    );

    // Add custom attributes if provided
    if (options.additionalAttributes) {
      try {
        const additionalAttrs = options.additionalAttributes(request);
        span.setAttributes(additionalAttrs);
      } catch {
        // Ignore errors in custom attribute extraction
      }
    }

    // Extract user ID if provided
    if (options.extractUserFromRequest) {
      try {
        const userId = options.extractUserFromRequest(request);
        if (userId) {
          span.setAttribute('user.id', userId);
        }
      } catch {
        // Ignore errors in user extraction
      }
    }

    // Attach span to request for later use
    request.span = span;
    request.traceId = span.spanContext().traceId;

    hookDone();
  });

  // Add onResponse hook to end span
  fastify.addHook('onResponse', (request, reply, hookDone) => {
    if (request.span) {
      request.span.setAttribute(SEMATTRS_HTTP_STATUS_CODE, reply.statusCode);

      // Set status based on HTTP status code
      if (reply.statusCode >= 400) {
        request.span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${reply.statusCode}`,
        });
      } else {
        request.span.setStatus({ code: SpanStatusCode.OK });
      }

      // Record response time
      request.span.setAttribute('http.response_time_ms', reply.elapsedTime);

      request.span.end();
    }
    hookDone();
  });

  // Add onError hook to record exceptions
  fastify.addHook('onError', (request, reply, error, hookDone) => {
    if (request.span) {
      request.span.recordException(error);
      request.span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      request.span.setAttribute('error.type', error.name);
    }
    hookDone();
  });

  // Decorate reply with traceId helper
  fastify.decorateReply('getTraceId', function (this: FastifyReply) {
    return (this.request as FastifyRequest).traceId;
  });

  done();
};

export const tracingPlugin = fp(tracingPluginCallback, {
  name: '@skillancer/tracing',
  fastify: '4.x',
});

/**
 * Create a child span within the current request context
 */
export async function createSpan<T>(
  request: FastifyRequest,
  name: string,
  fn: (span: Span) => T | Promise<T>,
  attributes?: Attributes
): Promise<T> {
  const tracer = trace.getTracer('fastify-app');

  return tracer.startActiveSpan(
    name,
    {
      kind: SpanKind.INTERNAL,
      ...(attributes && { attributes }),
    },
    async (span) => {
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
 * Decorator for tracing methods
 *
 * @example
 * class UserService {
 *   @Traced('user.get')
 *   async getUser(id: string) {
 *     // ...
 *   }
 * }
 */
export function Traced(spanName?: string, attributes?: Attributes) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const name =
      spanName ||
      `${(target as Record<string, unknown>).constructor?.name || 'Unknown'}.${propertyKey}`;

    descriptor.value = async function (...args: unknown[]) {
      const tracer = trace.getTracer('skillancer');

      return tracer.startActiveSpan(
        name,
        {
          kind: SpanKind.INTERNAL,
          attributes: {
            ...attributes,
            'code.function': propertyKey,
            'code.namespace': (target as Record<string, unknown>).constructor?.name || 'Unknown',
          },
        },
        async (span) => {
          try {
            const result = await originalMethod.apply(this, args);
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
    };

    return descriptor;
  };
}

export default tracingPlugin;
