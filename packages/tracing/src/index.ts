/* eslint-disable @typescript-eslint/no-unused-vars, no-console, @typescript-eslint/no-unsafe-member-access */
/**
 * @skillancer/tracing
 *
 * Distributed tracing with OpenTelemetry and AWS X-Ray
 */

import {
  trace,
  context,
  SpanStatusCode,
  type Span,
  SpanKind,
  type Attributes,
} from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { AWSXRayIdGenerator } from '@opentelemetry/id-generator-aws-xray';
import { AWSXRayPropagator } from '@opentelemetry/propagator-aws-xray';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';

export interface TracingConfig {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  otlpEndpoint?: string;
  enabled?: boolean;
  sampleRate?: number;
  ignoreUrls?: (string | RegExp)[];
  additionalInstrumentations?: unknown[];
}

let sdk: NodeSDK | null = null;
let isInitialized = false;

/**
 * Initialize OpenTelemetry tracing with AWS X-Ray integration
 */
export function initTracing(config: TracingConfig): void {
  if (isInitialized) {
    console.warn('Tracing already initialized');
    return;
  }

  if (config.enabled === false) {
    console.log('Tracing disabled via configuration');
    return;
  }

  const otlpEndpoint =
    config.otlpEndpoint || process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] || 'http://localhost:4318';

  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
    [SEMRESATTRS_SERVICE_VERSION]: config.serviceVersion || '0.0.0',
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]:
      config.environment || process.env['NODE_ENV'] || 'development',
  });

  const traceExporter = new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
  });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    textMapPropagator: new AWSXRayPropagator(),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (request) => {
            const url = request.url || '';
            // Ignore health checks and metrics endpoints
            if (url.includes('/health') || url.includes('/metrics') || url.includes('/ready')) {
              return true;
            }
            // Check custom ignore patterns
            if (config.ignoreUrls) {
              for (const pattern of config.ignoreUrls) {
                if (typeof pattern === 'string' && url.includes(pattern)) {
                  return true;
                }
                if (pattern instanceof RegExp && pattern.test(url)) {
                  return true;
                }
              }
            }
            return false;
          },
        },
        '@opentelemetry/instrumentation-fs': {
          enabled: false, // Disable FS instrumentation to reduce noise
        },
      }),
    ],
  });

  try {
    sdk.start();
    isInitialized = true;
    console.log(`Tracing initialized for ${config.serviceName} (endpoint: ${otlpEndpoint})`);
  } catch (error) {
    console.error('Failed to initialize tracing:', error);
  }
}

/**
 * Gracefully shutdown tracing
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
      isInitialized = false;
      sdk = null;
      console.log('Tracing shutdown complete');
    } catch (error) {
      console.error('Error during tracing shutdown:', error);
    }
  }
}

/**
 * Check if tracing is currently active
 */
export function isTracingActive(): boolean {
  return isInitialized;
}

/**
 * Get the current active span
 */
export function getCurrentSpan(): Span | undefined {
  return trace.getActiveSpan();
}

/**
 * Get the tracer for manual instrumentation
 */
export function getTracer(name: string, version?: string) {
  return trace.getTracer(name, version);
}

/**
 * Create a new span manually
 */
export async function createSpan<T>(
  name: string,
  fn: (span: Span) => T | Promise<T>,
  options?: {
    kind?: SpanKind;
    attributes?: Attributes;
    tracerName?: string;
  }
): Promise<T> {
  const tracer = getTracer(options?.tracerName || 'skillancer');

  return tracer.startActiveSpan(
    name,
    {
      kind: options?.kind || SpanKind.INTERNAL,
      ...(options?.attributes && { attributes: options.attributes }),
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
 * Add attributes to the current span
 */
export function addSpanAttributes(attributes: Attributes): void {
  const span = getCurrentSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

/**
 * Add an event to the current span
 */
export function addSpanEvent(name: string, attributes?: Attributes): void {
  const span = getCurrentSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Record an exception on the current span
 */
export function recordException(error: Error): void {
  const span = getCurrentSpan();
  if (span) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  }
}

/**
 * Extract trace context for propagation (e.g., to message queues)
 */
export function extractTraceContext(): Record<string, string> {
  const carrier: Record<string, string> = {};
  const propagator = new AWSXRayPropagator();
  propagator.inject(context.active(), carrier, {
    set: (carrier, key, value) => {
      carrier[key] = value;
    },
  });
  return carrier;
}

// Re-export common types and utilities
export { SpanStatusCode, SpanKind } from '@opentelemetry/api';
export type { Span, Attributes } from '@opentelemetry/api';
