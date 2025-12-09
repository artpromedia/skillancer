/**
 * @fileoverview Express middleware for automatic HTTP request metrics
 *
 * Integrates with MetricsService to automatically record:
 * - Request counts
 * - Response latencies
 * - Error rates
 * - Status code distribution
 */

import type { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express';
import { MetricsService } from './index.js';
import type { MetricConfig } from './types.js';

/**
 * Configuration options for the Express metrics middleware
 */
export interface ExpressMetricsOptions extends Partial<MetricConfig> {
  /**
   * MetricsService instance to use (optional - will create one if not provided)
   */
  metrics?: MetricsService | undefined;

  /**
   * Paths to ignore for metrics collection
   */
  ignorePaths?: string[] | undefined;

  /**
   * Whether to normalize path parameters (e.g., /users/123 -> /users/:id)
   */
  normalizePaths?: boolean | undefined;

  /**
   * Path normalization patterns (regex -> replacement)
   */
  pathNormalizationPatterns?: Array<[RegExp, string]> | undefined;

  /**
   * Custom dimension extractor from request
   */
  dimensionExtractor?: ((req: Request) => Record<string, string>) | undefined;

  /**
   * Whether to record detailed latency histograms (default: false)
   */
  recordHistograms?: boolean | undefined;
}

/**
 * Extended Express request with metrics properties
 */
interface MetricsRequest extends Request {
  metricsStartTime?: [number, number] | undefined;
  metricsService?: MetricsService | undefined;
}

/**
 * Default path normalization patterns
 */
const DEFAULT_PATH_PATTERNS: Array<[RegExp, string]> = [
  // UUIDs
  [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':uuid'],
  // MongoDB ObjectIds
  [/[0-9a-f]{24}/gi, ':id'],
  // Numeric IDs
  [/\/\d+(?=\/|$)/g, '/:id'],
  // Email addresses in paths
  [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, ':email'],
];

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
 * Normalize a path by replacing dynamic segments
 */
function normalizePath(path: string, patterns: Array<[RegExp, string]>): string {
  let normalized = path;
  for (const [pattern, replacement] of patterns) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized;
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
 * Create Express metrics middleware
 */
export function createExpressMetrics(options: ExpressMetricsOptions = {}): RequestHandler {
  const {
    metrics: providedMetrics,
    ignorePaths = ['/health', '/ready', '/metrics', '/favicon.ico'],
    normalizePaths = true,
    pathNormalizationPatterns = DEFAULT_PATH_PATTERNS,
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

  return (req: Request, res: Response, next: NextFunction): void => {
    const metricsReq = req as MetricsRequest;

    // Record start time
    metricsReq.metricsStartTime = process.hrtime();
    metricsReq.metricsService = metrics;

    // Get the path (without query string)
    const rawPath: string = req.path ?? (req.url?.split('?')[0] ?? '/');

    // Skip ignored paths
    if (shouldIgnorePath(rawPath, ignorePaths)) {
      next();
      return;
    }

    // Normalize path if enabled
    const path: string = normalizePaths ? normalizePath(rawPath, pathNormalizationPatterns) : rawPath;
    const method: string = req.method ?? 'UNKNOWN';

    // Record metrics on response finish
    res.on('finish', () => {
      const startTime = metricsReq.metricsStartTime;
      if (!startTime) return;

      const responseTime = calculateResponseTime(startTime);
      const statusCode = res.statusCode;

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
          const customDimensions = dimensionExtractor(req);
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
        // +Inf bucket
        metrics.increment('RequestLatencyBucket', 1, {
          Method: method,
          Path: path,
          Bucket: 'le_inf',
        });
      }
    });

    next();
  };
}

/**
 * Create Express error metrics middleware
 */
export function createExpressErrorMetrics(
  options: ExpressMetricsOptions = {}
): ErrorRequestHandler {
  const {
    metrics: providedMetrics,
    ignorePaths = ['/health', '/ready', '/metrics', '/favicon.ico'],
    normalizePaths = true,
    pathNormalizationPatterns = DEFAULT_PATH_PATTERNS,
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

  return (err: Error, req: Request, _res: Response, next: NextFunction): void => {
    const rawPath: string = req.path ?? (req.url?.split('?')[0] ?? '/');

    if (!shouldIgnorePath(rawPath, ignorePaths)) {
      const path: string = normalizePaths ? normalizePath(rawPath, pathNormalizationPatterns) : rawPath;
      const method: string = req.method ?? 'UNKNOWN';

      metrics.increment('UnhandledErrorCount', 1, {
        Method: method,
        Path: path,
        ErrorName: err.name || 'Error',
      });
    }

    next(err);
  };
}

/**
 * Get metrics service from request (if attached by middleware)
 */
export function getRequestMetrics(req: Request): MetricsService | undefined {
  return (req as MetricsRequest).metricsService;
}

export { MetricsService };
