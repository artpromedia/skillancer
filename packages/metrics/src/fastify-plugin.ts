/**
 * @fileoverview Fastify plugin for automatic HTTP request metrics
 *
 * Integrates with MetricsService to automatically record:
 * - Request counts
 * - Response latencies
 * - Error rates
 * - Status code distribution
 */

import type { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { MetricsService } from './index.js';
import type { MetricConfig } from './types.js';

/**
 * Configuration options for the Fastify metrics plugin
 */
export interface FastifyMetricsOptions extends Partial<MetricConfig> {
  /**
   * MetricsService instance to use (optional - will create one if not provided)
   */
  metrics?: MetricsService | undefined;

  /**
   * Paths to ignore for metrics collection
   */
  ignorePaths?: string[] | undefined;

  /**
   * Whether to use route pattern instead of actual URL (default: true)
   * e.g., /users/:id instead of /users/123
   */
  useRoutePattern?: boolean | undefined;

  /**
   * Custom dimension extractor from request
   */
  dimensionExtractor?: ((request: FastifyRequest) => Record<string, string>) | undefined;

  /**
   * Whether to record detailed latency histograms (default: false)
   */
  recordHistograms?: boolean | undefined;
}

/**
 * Extended Fastify request with metrics properties
 */
interface MetricsRequest extends FastifyRequest {
  metricsStartTime?: [number, number] | undefined;
}

/**
 * Check if a path should be ignored
 */
function shouldIgnorePath(path: string, ignorePaths: string[]): boolean {
  return ignorePaths.some((ignorePath) => {
    if (ignorePath.includes('*')) {
      const pattern = new RegExp(`^${ignorePath.replace(/\*/g, '.*')}$`);
      return pattern.test(path);
    }
    return path === ignorePath || path.startsWith(ignorePath);
  });
}

/**
 * Calculate response time from hrtime
 */
function calculateResponseTime(startTime: [number, number]): number {
  const [seconds, nanoseconds] = process.hrtime(startTime);
  return seconds * 1000 + nanoseconds / 1_000_000;
}

/**
 * Get status code category (2xx, 3xx, 4xx, 5xx)
 */
function getStatusCategory(statusCode: number): string {
  return `${Math.floor(statusCode / 100)}xx`;
}

/**
 * Fastify metrics plugin
 */
function fastifyMetricsPlugin(
  fastify: FastifyInstance,
  options: FastifyMetricsOptions & FastifyPluginOptions
): void {
  const {
    metrics: providedMetrics,
    ignorePaths = ['/health', '/ready', '/metrics', '/favicon.ico'],
    useRoutePattern = true,
    dimensionExtractor,
    recordHistograms = false,
    ...metricsConfig
  } = options;

  // Use provided metrics or create new instance
  const metrics =
    providedMetrics ??
    new MetricsService({
      namespace: metricsConfig.namespace ?? 'Skillancer/Services',
      serviceName: metricsConfig.serviceName ?? 'unknown',
      environment: metricsConfig.environment ?? process.env.NODE_ENV ?? 'development',
      ...metricsConfig,
    });

  // Decorate fastify with metrics service
  fastify.decorate('metrics', metrics);

  // Record request start time
  fastify.addHook(
    'onRequest',
    (request: FastifyRequest, _reply: FastifyReply, done: () => void) => {
      (request as MetricsRequest).metricsStartTime = process.hrtime();
      done();
    }
  );

  // Record metrics on response
  fastify.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
    const startTime = (request as MetricsRequest).metricsStartTime;
    if (!startTime) {
      done();
      return;
    }

    // Determine path to use
    const path: string = useRoutePattern
      ? (request.routerPath ?? request.url?.split('?')[0] ?? '/')
      : (request.url?.split('?')[0] ?? '/');

    // Skip ignored paths
    if (shouldIgnorePath(path, ignorePaths)) {
      done();
      return;
    }

    const responseTime = calculateResponseTime(startTime);
    const statusCode = reply.statusCode;
    const method: string = request.method ?? 'UNKNOWN';

    // Build dimensions
    const dimensions: Record<string, string> = {
      Method: method,
      Path: path,
      StatusCode: String(statusCode),
      StatusCategory: getStatusCategory(statusCode),
    };

    // Add custom dimensions
    if (dimensionExtractor) {
      try {
        const customDimensions = dimensionExtractor(request);
        Object.assign(dimensions, customDimensions);
      } catch {
        // Ignore dimension extraction errors
      }
    }

    // Record request count
    metrics.increment('RequestCount', 1, dimensions);

    // Record latency
    metrics.timing('RequestLatency', responseTime, dimensions);

    // Record errors
    if (statusCode >= 400) {
      metrics.increment('ErrorCount', 1, {
        Method: method,
        Path: path,
        ErrorType: statusCode >= 500 ? '5xx' : '4xx',
      });
    }

    // Record histogram buckets for detailed latency analysis
    if (recordHistograms) {
      const buckets = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
      for (const bucket of buckets) {
        if (responseTime <= bucket) {
          metrics.increment('RequestLatencyBucket', 1, {
            Method: method,
            Path: path,
            Bucket: `le_${bucket}ms`,
          });
        }
      }
      // +Inf bucket (all requests)
      metrics.increment('RequestLatencyBucket', 1, {
        Method: method,
        Path: path,
        Bucket: 'le_inf',
      });
    }

    done();
  });

  // Record errors
  fastify.addHook(
    'onError',
    (request: FastifyRequest, _reply: FastifyReply, error: Error, done: () => void) => {
      const path: string = useRoutePattern
        ? (request.routerPath ?? request.url?.split('?')[0] ?? '/')
        : (request.url?.split('?')[0] ?? '/');

      if (shouldIgnorePath(path, ignorePaths)) {
        done();
        return;
      }

      const method: string = request.method ?? 'UNKNOWN';

      metrics.increment('UnhandledErrorCount', 1, {
        Method: method,
        Path: path,
        ErrorName: error.name,
      });

      done();
    }
  );

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    if (!providedMetrics) {
      // Only shutdown if we created the metrics instance
      await metrics.shutdown();
    }
  });
}

/**
 * Fastify metrics plugin with type declarations
 */
export const fastifyMetrics = fp(fastifyMetricsPlugin, {
  fastify: '4.x',
  name: '@skillancer/metrics/fastify',
});

export default fastifyMetrics;

// Type augmentation for Fastify
declare module 'fastify' {
  interface FastifyInstance {
    metrics: MetricsService;
  }
}

export { MetricsService };
