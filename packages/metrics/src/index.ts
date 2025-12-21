/**
 * @fileoverview MetricsService for CloudWatch metrics collection
 *
 * Provides a buffered, batched approach to publishing metrics to AWS CloudWatch.
 * Features:
 * - Automatic batching and flushing
 * - Configurable buffer size and flush intervals
 * - Retry logic with exponential backoff
 * - Support for multiple metric types (counters, timers, gauges, histograms)
 * - Default dimensions for service identification
 */

import {
  CloudWatchClient,
  PutMetricDataCommand,
  StandardUnit,
} from '@aws-sdk/client-cloudwatch';

import type {
  MetricConfig,
  MetricData,
  MetricDimension,
  BufferedMetric,
} from './types.js';

/**
 * Maximum number of metrics per CloudWatch PutMetricData call
 */
const MAX_METRICS_PER_REQUEST = 20;

/**
 * Maximum retry attempts for failed CloudWatch calls
 */
const MAX_RETRIES = 3;

/**
 * Base delay for exponential backoff (ms)
 */
const BASE_RETRY_DELAY = 100;

/**
 * MetricsService - Centralized metrics collection and publishing
 */
export class MetricsService {
  private client: CloudWatchClient;
  private namespace: string;
  private defaultDimensions: MetricDimension[];
  private buffer: BufferedMetric[] = [];
  private flushIntervalMs: number;
  private maxBufferSize: number;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private debug: boolean;
  private dryRun: boolean;
  private isShuttingDown = false;

  constructor(config: MetricConfig) {
    this.namespace = config.namespace;
    this.flushIntervalMs = config.flushIntervalMs ?? 60000;
    this.maxBufferSize = config.maxBufferSize ?? 20;
    this.debug = config.debug ?? false;
    this.dryRun = config.dryRun ?? false;

    // Initialize CloudWatch client
    this.client = config.region
      ? new CloudWatchClient({ region: config.region })
      : new CloudWatchClient({});

    // Set up default dimensions
    this.defaultDimensions = [
      { Name: 'Service', Value: config.serviceName },
      { Name: 'Environment', Value: config.environment },
    ];

    // Start automatic flushing
    this.startAutoFlush();

    this.log('MetricsService initialized', {
      namespace: this.namespace,
      flushIntervalMs: this.flushIntervalMs,
      maxBufferSize: this.maxBufferSize,
    });
  }

  /**
   * Record a metric with custom value and unit
   */
  record(data: MetricData): void {
    const metric: BufferedMetric = {
      MetricName: data.name,
      Value: data.value,
      Unit: data.unit ?? StandardUnit.Count,
      Dimensions: this.buildDimensions(data.dimensions),
      Timestamp: data.timestamp ?? new Date(),
    };

    this.addToBuffer(metric);
  }

  /**
   * Increment a counter metric
   */
  increment(name: string, value = 1, dimensions?: Record<string, string>): void {
    this.record({
      name,
      value,
      unit: StandardUnit.Count,
      dimensions,
    });
  }

  /**
   * Record a timing metric in milliseconds
   */
  timing(name: string, value: number, dimensions?: Record<string, string>): void {
    this.record({
      name,
      value,
      unit: StandardUnit.Milliseconds,
      dimensions,
    });
  }

  /**
   * Record a gauge (point-in-time) value
   */
  gauge(name: string, value: number, dimensions?: Record<string, string>): void {
    this.record({
      name,
      value,
      unit: StandardUnit.None,
      dimensions,
    });
  }

  /**
   * Record a histogram value
   */
  histogram(name: string, value: number, dimensions?: Record<string, string>): void {
    this.record({
      name,
      value,
      unit: StandardUnit.None,
      dimensions,
    });
  }

  /**
   * Record a percentage value
   */
  percentage(name: string, value: number, dimensions?: Record<string, string>): void {
    this.record({
      name,
      value,
      unit: StandardUnit.Percent,
      dimensions,
    });
  }

  /**
   * Record bytes
   */
  bytes(name: string, value: number, dimensions?: Record<string, string>): void {
    this.record({
      name,
      value,
      unit: StandardUnit.Bytes,
      dimensions,
    });
  }

  /**
   * Start a timer and return a function to stop it
   */
  startTimer(name: string, dimensions?: Record<string, string>): () => number {
    const startTime = process.hrtime.bigint();

    return () => {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;
      this.timing(name, durationMs, dimensions);
      return durationMs;
    };
  }

  /**
   * Manually flush buffered metrics to CloudWatch
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const metricsToSend = [...this.buffer];
    this.buffer = [];

    this.log(`Flushing ${metricsToSend.length} metrics`);

    // Split into batches of MAX_METRICS_PER_REQUEST
    const batches: BufferedMetric[][] = [];
    for (let i = 0; i < metricsToSend.length; i += MAX_METRICS_PER_REQUEST) {
      batches.push(metricsToSend.slice(i, i + MAX_METRICS_PER_REQUEST));
    }

    // Send batches in parallel with retry logic
    const results = await Promise.allSettled(
      batches.map((batch) => this.sendBatch(batch))
    );

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to send metric batch ${index}:`, result.reason);
        // Re-buffer failed metrics if not shutting down
        const batch = batches[index];
        if (!this.isShuttingDown && batch) {
          this.buffer.push(...batch);
        }
      }
    });
  }

  /**
   * Gracefully shutdown the metrics service
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    this.stopAutoFlush();
    await this.flush();
    this.log('MetricsService shutdown complete');
  }

  /**
   * Build dimensions array from default + custom dimensions
   */
  private buildDimensions(custom?: Record<string, string>): MetricDimension[] {
    const dimensions = [...this.defaultDimensions];

    if (custom) {
      for (const [key, value] of Object.entries(custom)) {
        dimensions.push({ Name: key, Value: value });
      }
    }

    return dimensions;
  }

  /**
   * Add a metric to the buffer, triggering flush if buffer is full
   */
  private addToBuffer(metric: BufferedMetric): void {
    this.buffer.push(metric);

    if (this.buffer.length >= this.maxBufferSize) {
      // Fire and forget - don't block the caller
      this.flush().catch((err) => {
        console.error('Failed to flush metrics:', err);
      });
    }
  }

  /**
   * Send a batch of metrics to CloudWatch with retry logic
   */
  private async sendBatch(batch: BufferedMetric[], attempt = 1): Promise<void> {
    if (this.dryRun) {
      this.log('DRY RUN - Would send metrics:', batch);
      return;
    }

    try {
      const command = new PutMetricDataCommand({
        Namespace: this.namespace,
        MetricData: batch.map((m) => ({
          MetricName: m.MetricName,
          Value: m.Value,
          Unit: m.Unit,
          Dimensions: m.Dimensions,
          Timestamp: m.Timestamp,
        })),
      });

      await this.client.send(command);
      this.log(`Successfully sent ${batch.length} metrics`);
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        const delay = BASE_RETRY_DELAY * Math.pow(2, attempt - 1);
        this.log(`Retry ${attempt}/${MAX_RETRIES} after ${delay}ms`);
        await this.sleep(delay);
        return this.sendBatch(batch, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Start automatic flush interval
   */
  private startAutoFlush(): void {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        console.error('Auto-flush failed:', err);
      });
    }, this.flushIntervalMs);

    // Don't block process exit
    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }
  }

  /**
   * Stop automatic flush interval
   */
  private stopAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Debug logging
   */
  private log(message: string, data?: unknown): void {
    if (this.debug) {
      console.log(`[MetricsService] ${message}`, data ?? '');
    }
  }
}

/**
 * Create a new MetricsService instance
 */
export function createMetricsService(config: MetricConfig): MetricsService {
  return new MetricsService(config);
}

// Re-export types
export type { MetricConfig, MetricData, MetricDimension, BufferedMetric } from './types.js';
export { StandardUnit } from '@aws-sdk/client-cloudwatch';
