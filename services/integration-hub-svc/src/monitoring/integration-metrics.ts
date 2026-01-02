/**
 * @module @skillancer/integration-hub-svc/monitoring/integration-metrics
 * Integration Metrics - Track performance and health metrics
 */

interface MetricValue {
  value: number;
  timestamp: Date;
}

interface MetricSummary {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
}

export class IntegrationMetrics {
  private metrics: Map<string, MetricValue[]> = new Map();
  private readonly maxAge = 3600000; // 1 hour retention

  /**
   * Record API call latency
   */
  recordLatency(provider: string, latencyMs: number): void {
    this.record(`latency:${provider}`, latencyMs);
  }

  /**
   * Record API call success/failure
   */
  recordApiCall(provider: string, success: boolean): void {
    this.record(`api_calls:${provider}:total`, 1);
    if (success) {
      this.record(`api_calls:${provider}:success`, 1);
    } else {
      this.record(`api_calls:${provider}:error`, 1);
    }
  }

  /**
   * Record cache hit/miss
   */
  recordCacheAccess(hit: boolean): void {
    this.record('cache:total', 1);
    this.record(hit ? 'cache:hit' : 'cache:miss', 1);
  }

  /**
   * Record WebSocket connection
   */
  recordConnection(event: 'connect' | 'disconnect'): void {
    this.record(`websocket:${event}`, 1);
  }

  /**
   * Record real-time message
   */
  recordMessage(type: string): void {
    this.record(`realtime:messages:${type}`, 1);
  }

  /**
   * Record a metric value
   */
  private record(key: string, value: number): void {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    this.metrics.get(key)!.push({
      value,
      timestamp: new Date(),
    });

    this.cleanup(key);
  }

  /**
   * Clean up old metrics
   */
  private cleanup(key: string): void {
    const values = this.metrics.get(key);
    if (!values) return;

    const cutoff = Date.now() - this.maxAge;
    const filtered = values.filter((v) => v.timestamp.getTime() > cutoff);
    this.metrics.set(key, filtered);
  }

  /**
   * Get metric summary
   */
  getSummary(key: string): MetricSummary | null {
    const values = this.metrics.get(key);
    if (!values || values.length === 0) return null;

    const nums = values.map((v) => v.value);
    return {
      count: nums.length,
      sum: nums.reduce((a, b) => a + b, 0),
      min: Math.min(...nums),
      max: Math.max(...nums),
      avg: nums.reduce((a, b) => a + b, 0) / nums.length,
    };
  }

  /**
   * Get provider latency stats
   */
  getProviderLatency(provider: string): MetricSummary | null {
    return this.getSummary(`latency:${provider}`);
  }

  /**
   * Get provider success rate
   */
  getProviderSuccessRate(provider: string): number {
    const total = this.getSummary(`api_calls:${provider}:total`);
    const success = this.getSummary(`api_calls:${provider}:success`);

    if (!total || total.sum === 0) return 100;
    return ((success?.sum || 0) / total.sum) * 100;
  }

  /**
   * Get cache hit rate
   */
  getCacheHitRate(): number {
    const total = this.getSummary('cache:total');
    const hits = this.getSummary('cache:hit');

    if (!total || total.sum === 0) return 0;
    return ((hits?.sum || 0) / total.sum) * 100;
  }

  /**
   * Get all metrics for dashboard
   */
  getDashboardMetrics(): Record<string, unknown> {
    const providers = ['github', 'gitlab', 'quickbooks', 'xero', 'stripe', 'plaid', 'aws', 'snyk'];

    return {
      providers: providers.map((p) => ({
        name: p,
        latency: this.getProviderLatency(p),
        successRate: this.getProviderSuccessRate(p),
      })),
      cache: {
        hitRate: this.getCacheHitRate(),
        ...this.getSummary('cache:total'),
      },
      websocket: {
        connections: this.getSummary('websocket:connect'),
        disconnections: this.getSummary('websocket:disconnect'),
      },
      realtime: {
        widgetUpdates: this.getSummary('realtime:messages:WIDGET_DATA_UPDATE'),
        statusChanges: this.getSummary('realtime:messages:INTEGRATION_STATUS'),
      },
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
  }
}

export const integrationMetrics = new IntegrationMetrics();
