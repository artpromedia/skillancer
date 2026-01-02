/**
 * @module @skillancer/api-gateway/plugins/tracing
 * OpenTelemetry distributed tracing integration
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION, ATTR_DEPLOYMENT_ENVIRONMENT } from '@opentelemetry/semantic-conventions';
import { SpanStatusCode, trace, context, propagation } from '@opentelemetry/api';
import fp from 'fastify-plugin';

import { getConfig } from '../config/index.js';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry SDK
 */
function initializeTracing(): NodeSDK | null {
  const config = getConfig();
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  if (!otlpEndpoint) {
    console.log('[Tracing] OTLP endpoint not configured, distributed tracing disabled');
    return null;
  }

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: config.service.name,
    [ATTR_SERVICE_VERSION]: config.service.version,
    [ATTR_DEPLOYMENT_ENVIRONMENT]: config.env,
  });

  const traceExporter = new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
  });

  const nodeSdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable fs instrumentation to reduce noise
        '@opentelemetry/instrumentation-fs': { enabled: false },
        // Configure HTTP instrumentation
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingPaths: ['/health', '/health/live', '/health/ready', '/metrics'],
        },
      }),
    ],
  });

  nodeSdk.start();
  console.log('[Tracing] OpenTelemetry initialized with OTLP exporter');

  return nodeSdk;
}

async function tracingPluginImpl(app: FastifyInstance): Promise<void> {
  const config = getConfig();

  // Initialize SDK if not already done
  if (!sdk) {
    sdk = initializeTracing();
  }

  if (!sdk) {
    return;
  }

  const tracer = trace.getTracer(config.service.name, config.service.version);

  // Add tracing context to requests
  app.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    // Extract trace context from incoming headers
    const extractedContext = propagation.extract(context.active(), request.headers);

    // Create a span for this request
    const span = tracer.startSpan(
      `${request.method} ${request.routeOptions?.url || request.url}`,
      {
        attributes: {
          'http.method': request.method,
          'http.url': request.url,
          'http.route': request.routeOptions?.url,
          'http.user_agent': request.headers['user-agent'],
          'http.request_id': request.id,
        },
      },
      extractedContext
    );

    // Store span in request for later use
    (request as any).span = span;

    // Add trace context to request for downstream services
    const traceContext: Record<string, string> = {};
    propagation.inject(trace.setSpan(context.active(), span), traceContext);
    (request as any).traceContext = traceContext;
  });

  // Add user context when available
  app.addHook('preHandler', async (request: FastifyRequest) => {
    const span = (request as any).span;
    if (!span) return;

    const user = request.user as { userId?: string; email?: string } | undefined;
    if (user?.userId) {
      span.setAttribute('user.id', user.userId);
      if (user.email) {
        span.setAttribute('user.email', user.email);
      }
    }
  });

  // Complete span on response
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const span = (request as any).span;
    if (!span) return;

    span.setAttribute('http.status_code', reply.statusCode);

    if (reply.statusCode >= 400) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `HTTP ${reply.statusCode}`,
      });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    span.end();
  });

  // Handle errors
  app.addHook('onError', async (request: FastifyRequest, _reply: FastifyReply, error: Error) => {
    const span = (request as any).span;
    if (!span) return;

    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  });

  // Shutdown SDK on close
  app.addHook('onClose', async () => {
    if (sdk) {
      await sdk.shutdown();
      console.log('[Tracing] OpenTelemetry SDK shut down');
    }
  });
}

export const tracingPlugin = fp(tracingPluginImpl, {
  name: 'tracing-plugin',
});

/**
 * Get trace context headers for propagating to downstream services
 */
export function getTraceHeaders(request: FastifyRequest): Record<string, string> {
  return (request as any).traceContext || {};
}
