/**
 * Prometheus Metrics Service
 *
 * Provides Prometheus-compatible metrics collection for monitoring.
 * Supports counters, histograms, gauges, and summaries.
 */

import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  Summary,
  collectDefaultMetrics,
  type CounterConfiguration,
  type HistogramConfiguration,
  type GaugeConfiguration,
  type SummaryConfiguration,
} from 'prom-client';

export interface PrometheusConfig {
  serviceName: string;
  prefix?: string;
  defaultLabels?: Record<string, string>;
  collectDefaultMetrics?: boolean;
  defaultMetricsInterval?: number;
}

/**
 * Prometheus Metrics Service for application monitoring
 */
export class PrometheusMetrics {
  private registry: Registry;
  private prefix: string;
  private counters: Map<string, Counter<string>> = new Map();
  private histograms: Map<string, Histogram<string>> = new Map();
  private gauges: Map<string, Gauge<string>> = new Map();
  private summaries: Map<string, Summary<string>> = new Map();

  constructor(config: PrometheusConfig) {
    this.registry = new Registry();
    this.prefix = config.prefix ?? config.serviceName.replace(/-/g, '_');

    if (config.defaultLabels) {
      this.registry.setDefaultLabels(config.defaultLabels);
    }

    if (config.collectDefaultMetrics !== false) {
      collectDefaultMetrics({
        register: this.registry,
        prefix: `${this.prefix}_`,
        gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
      });
    }

    this.registerStandardMetrics();
  }

  private registerStandardMetrics(): void {
    // HTTP request metrics
    this.createHistogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'path', 'status_code'],
      buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    });

    this.createCounter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status_code'],
    });

    this.createGauge({
      name: 'http_requests_in_flight',
      help: 'Number of HTTP requests currently being processed',
      labelNames: ['method'],
    });

    // Database metrics
    this.createHistogram({
      name: 'db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'table', 'success'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    });

    this.createCounter({
      name: 'db_queries_total',
      help: 'Total number of database queries',
      labelNames: ['operation', 'table', 'success'],
    });

    this.createGauge({
      name: 'db_pool_connections',
      help: 'Number of database pool connections',
      labelNames: ['state'],
    });

    // Cache metrics
    this.createCounter({
      name: 'cache_operations_total',
      help: 'Total number of cache operations',
      labelNames: ['operation', 'result'],
    });

    // Queue metrics
    this.createGauge({
      name: 'queue_size',
      help: 'Number of messages in queue',
      labelNames: ['queue_name'],
    });

    this.createCounter({
      name: 'queue_messages_total',
      help: 'Total number of queue messages processed',
      labelNames: ['queue_name', 'status'],
    });

    this.createHistogram({
      name: 'queue_processing_duration_seconds',
      help: 'Duration of queue message processing',
      labelNames: ['queue_name'],
      buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60],
    });

    // External API metrics
    this.createHistogram({
      name: 'external_api_duration_seconds',
      help: 'Duration of external API calls',
      labelNames: ['service', 'endpoint', 'method', 'status_code'],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    });

    this.createCounter({
      name: 'external_api_requests_total',
      help: 'Total number of external API requests',
      labelNames: ['service', 'endpoint', 'method', 'status_code'],
    });

    // Business metrics
    this.createCounter({
      name: 'business_events_total',
      help: 'Total number of business events',
      labelNames: ['event_type', 'status'],
    });

    // Error metrics
    this.createCounter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'code', 'severity'],
    });
  }

  // Metric creation
  createCounter(config: Omit<CounterConfiguration<string>, 'registers'>): Counter<string> {
    const fullName = `${this.prefix}_${config.name}`;
    if (this.counters.has(fullName)) {
      return this.counters.get(fullName)!;
    }
    const counter = new Counter({ ...config, name: fullName, registers: [this.registry] });
    this.counters.set(fullName, counter);
    return counter;
  }

  createHistogram(config: Omit<HistogramConfiguration<string>, 'registers'>): Histogram<string> {
    const fullName = `${this.prefix}_${config.name}`;
    if (this.histograms.has(fullName)) {
      return this.histograms.get(fullName)!;
    }
    const histogram = new Histogram({ ...config, name: fullName, registers: [this.registry] });
    this.histograms.set(fullName, histogram);
    return histogram;
  }

  createGauge(config: Omit<GaugeConfiguration<string>, 'registers'>): Gauge<string> {
    const fullName = `${this.prefix}_${config.name}`;
    if (this.gauges.has(fullName)) {
      return this.gauges.get(fullName)!;
    }
    const gauge = new Gauge({ ...config, name: fullName, registers: [this.registry] });
    this.gauges.set(fullName, gauge);
    return gauge;
  }

  createSummary(config: Omit<SummaryConfiguration<string>, 'registers'>): Summary<string> {
    const fullName = `${this.prefix}_${config.name}`;
    if (this.summaries.has(fullName)) {
      return this.summaries.get(fullName)!;
    }
    const summary = new Summary({
      ...config,
      name: fullName,
      registers: [this.registry],
      percentiles: config.percentiles ?? [0.5, 0.9, 0.95, 0.99],
    });
    this.summaries.set(fullName, summary);
    return summary;
  }

  // HTTP metrics
  recordHttpRequest(
    method: string,
    path: string,
    statusCode: number,
    durationSeconds: number
  ): void {
    const normalizedPath = this.normalizePath(path);
    const labels = { method, path: normalizedPath, status_code: String(statusCode) };
    this.getHistogram('http_request_duration_seconds').observe(labels, durationSeconds);
    this.getCounter('http_requests_total').inc(labels);
  }

  recordHttpRequestInFlight(method: string, delta: number): void {
    this.getGauge('http_requests_in_flight').inc({ method }, delta);
  }

  // Database metrics
  recordDbQuery(operation: string, table: string, success: boolean, durationSeconds: number): void {
    const labels = { operation, table, success: String(success) };
    this.getHistogram('db_query_duration_seconds').observe(labels, durationSeconds);
    this.getCounter('db_queries_total').inc(labels);
  }

  setDbPoolConnections(active: number, idle: number, waiting: number): void {
    const gauge = this.getGauge('db_pool_connections');
    gauge.set({ state: 'active' }, active);
    gauge.set({ state: 'idle' }, idle);
    gauge.set({ state: 'waiting' }, waiting);
  }

  // Cache metrics
  recordCacheOperation(operation: string, result: 'hit' | 'miss' | 'error'): void {
    this.getCounter('cache_operations_total').inc({ operation, result });
  }

  // Queue metrics
  setQueueSize(queueName: string, size: number): void {
    this.getGauge('queue_size').set({ queue_name: queueName }, size);
  }

  recordQueueMessage(
    queueName: string,
    status: 'processed' | 'failed' | 'retried',
    durationSeconds?: number
  ): void {
    this.getCounter('queue_messages_total').inc({ queue_name: queueName, status });
    if (durationSeconds !== undefined) {
      this.getHistogram('queue_processing_duration_seconds').observe(
        { queue_name: queueName },
        durationSeconds
      );
    }
  }

  // External API metrics
  recordExternalApiCall(
    service: string,
    endpoint: string,
    method: string,
    statusCode: number,
    durationSeconds: number
  ): void {
    const labels = { service, endpoint, method, status_code: String(statusCode) };
    this.getHistogram('external_api_duration_seconds').observe(labels, durationSeconds);
    this.getCounter('external_api_requests_total').inc(labels);
  }

  // Business metrics
  recordBusinessEvent(eventType: string, status: 'success' | 'failure'): void {
    this.getCounter('business_events_total').inc({ event_type: eventType, status });
  }

  // Error metrics
  recordError(type: string, code: string, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    this.getCounter('errors_total').inc({ type, code, severity });
  }

  // Helpers
  private getCounter(name: string): Counter<string> {
    const fullName = `${this.prefix}_${name}`;
    const counter = this.counters.get(fullName);
    if (!counter) throw new Error(`Counter ${fullName} not found`);
    return counter;
  }

  private getHistogram(name: string): Histogram<string> {
    const fullName = `${this.prefix}_${name}`;
    const histogram = this.histograms.get(fullName);
    if (!histogram) throw new Error(`Histogram ${fullName} not found`);
    return histogram;
  }

  private getGauge(name: string): Gauge<string> {
    const fullName = `${this.prefix}_${name}`;
    const gauge = this.gauges.get(fullName);
    if (!gauge) throw new Error(`Gauge ${fullName} not found`);
    return gauge;
  }

  private normalizePath(path: string): string {
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[^/]+@[^/]+/g, '/:email');
  }

  // Metrics endpoint
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  getRegistry(): Registry {
    return this.registry;
  }
}

// Singleton instance
let prometheusInstance: PrometheusMetrics | null = null;

export function createPrometheusMetrics(config: PrometheusConfig): PrometheusMetrics {
  if (!prometheusInstance) {
    prometheusInstance = new PrometheusMetrics(config);
  }
  return prometheusInstance;
}

export function getPrometheusMetrics(): PrometheusMetrics {
  if (!prometheusInstance) {
    throw new Error('Prometheus metrics not initialized. Call createPrometheusMetrics first.');
  }
  return prometheusInstance;
}
