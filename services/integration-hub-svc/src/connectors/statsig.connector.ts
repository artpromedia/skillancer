import { EventEmitter } from 'events';

// Statsig Connector
//
// Authentication: API Key
//
// Supported Widgets:
// - feature-gates - Active gates, gate states, recent changes
// - experiments - Running experiments, experiment results, statistical significance
// - metrics - Custom metrics, metric trends

interface StatsigConfig {
  apiKey: string;
  projectId?: string;
}

interface FeatureGate {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  salt: string;
  defaultValue: boolean;
  rules: GateRule[];
  tags: string[];
  createdTime: number;
  lastModifiedTime: number;
}

interface GateRule {
  id: string;
  name: string;
  passPercentage: number;
  conditions: Array<{
    type: string;
    field: string;
    operator: string;
    targetValue: unknown;
  }>;
}

interface StatsigExperiment {
  id: string;
  name: string;
  description: string;
  idType: string;
  status: 'setup' | 'active' | 'decision_made' | 'abandoned';
  hypothesis: string;
  groups: ExperimentGroup[];
  allocation: number;
  duration: number;
  targetApps: string[];
  tags: string[];
  startTime?: number;
  endTime?: number;
  decisionReason?: string;
  winnerGroupName?: string;
  primaryMetricName?: string;
  createdTime: number;
  lastModifiedTime: number;
}

interface ExperimentGroup {
  name: string;
  id: string;
  size: number;
  parameterValues: Record<string, unknown>;
}

interface ExperimentResults {
  experimentId: string;
  calculatedAt: number;
  primaryMetric: MetricResult;
  secondaryMetrics: MetricResult[];
  guardrailMetrics: MetricResult[];
}

interface MetricResult {
  metricName: string;
  metricType: string;
  groups: Array<{
    groupName: string;
    value: number;
    stdDev: number;
    sampleSize: number;
  }>;
  lift: {
    value: number;
    confidenceInterval: [number, number];
    pValue: number;
    isSignificant: boolean;
  };
  sequentialTestingResult?: {
    canStopExperiment: boolean;
    currentPValue: number;
    adjustedAlpha: number;
  };
}

interface StatsigMetric {
  id: string;
  name: string;
  description: string;
  type: 'event_count' | 'event_user' | 'ratio' | 'mean' | 'sum' | 'custom';
  definition: {
    eventName?: string;
    userDimension?: string;
    numerator?: string;
    denominator?: string;
    customSql?: string;
  };
  tags: string[];
  createdTime: number;
}

interface MetricValues {
  metricId: string;
  metricName: string;
  values: Array<{
    date: string;
    value: number;
    sampleSize: number;
  }>;
  trend: number;
}

export class StatsigConnector extends EventEmitter {
  private config: StatsigConfig;
  private baseUrl = 'https://api.statsig.com/console/v1';

  constructor(config: StatsigConfig) {
    super();
    this.config = config;
  }

  private get headers(): Record<string, string> {
    return {
      'statsig-api-key': this.config.apiKey,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Statsig API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ==================== FEATURE GATES ====================

  async getGates(): Promise<FeatureGate[]> {
    const data = await this.request<{ data: FeatureGate[] }>('/gates');
    return data.data || [];
  }

  async getGate(gateName: string): Promise<FeatureGate | null> {
    try {
      const data = await this.request<{ data: FeatureGate }>(`/gates/${gateName}`);
      return data.data;
    } catch {
      return null;
    }
  }

  async getActiveGates(): Promise<FeatureGate[]> {
    const gates = await this.getGates();
    return gates.filter((g) => g.enabled);
  }

  async getGatesByTag(tag: string): Promise<FeatureGate[]> {
    const gates = await this.getGates();
    return gates.filter((g) => g.tags.includes(tag));
  }

  async getRecentlyModifiedGates(daysAgo: number = 7): Promise<FeatureGate[]> {
    const gates = await this.getGates();
    const threshold = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
    return gates.filter((g) => g.lastModifiedTime > threshold);
  }

  // ==================== EXPERIMENTS ====================

  async getExperiments(): Promise<StatsigExperiment[]> {
    const data = await this.request<{ data: StatsigExperiment[] }>('/experiments');
    return data.data || [];
  }

  async getExperiment(experimentName: string): Promise<StatsigExperiment | null> {
    try {
      const data = await this.request<{ data: StatsigExperiment }>(
        `/experiments/${experimentName}`
      );
      return data.data;
    } catch {
      return null;
    }
  }

  async getActiveExperiments(): Promise<StatsigExperiment[]> {
    const experiments = await this.getExperiments();
    return experiments.filter((e) => e.status === 'active');
  }

  async getCompletedExperiments(): Promise<StatsigExperiment[]> {
    const experiments = await this.getExperiments();
    return experiments.filter((e) => e.status === 'decision_made');
  }

  async getExperimentResults(experimentName: string): Promise<ExperimentResults | null> {
    try {
      const data = await this.request<{ data: ExperimentResults }>(
        `/experiments/${experimentName}/results`
      );
      return data.data;
    } catch {
      return null;
    }
  }

  async getWinningExperiments(): Promise<StatsigExperiment[]> {
    const experiments = await this.getExperiments();
    return experiments.filter((e) => e.status === 'decision_made' && e.winnerGroupName);
  }

  // ==================== METRICS ====================

  async getMetrics(): Promise<StatsigMetric[]> {
    const data = await this.request<{ data: StatsigMetric[] }>('/metrics');
    return data.data || [];
  }

  async getMetric(metricName: string): Promise<StatsigMetric | null> {
    try {
      const data = await this.request<{ data: StatsigMetric }>(`/metrics/${metricName}`);
      return data.data;
    } catch {
      return null;
    }
  }

  async getMetricValues(
    metricName: string,
    startDate: string,
    endDate: string
  ): Promise<MetricValues | null> {
    try {
      const data = await this.request<{ data: MetricValues }>(
        `/metrics/${metricName}/values?start_date=${startDate}&end_date=${endDate}`
      );
      return data.data;
    } catch {
      return null;
    }
  }

  // ==================== WIDGET DATA ====================

  async getFeatureGatesWidgetData(): Promise<{
    totalGates: number;
    activeGates: number;
    recentlyModified: number;
    gatesByStatus: {
      enabled: number;
      disabled: number;
    };
    recentChanges: Array<{
      name: string;
      enabled: boolean;
      modifiedAt: string;
    }>;
  }> {
    const gates = await this.getGates();
    const recentlyModified = await this.getRecentlyModifiedGates(7);

    const enabledCount = gates.filter((g) => g.enabled).length;

    return {
      totalGates: gates.length,
      activeGates: enabledCount,
      recentlyModified: recentlyModified.length,
      gatesByStatus: {
        enabled: enabledCount,
        disabled: gates.length - enabledCount,
      },
      recentChanges: recentlyModified.slice(0, 5).map((g) => ({
        name: g.name,
        enabled: g.enabled,
        modifiedAt: new Date(g.lastModifiedTime).toISOString(),
      })),
    };
  }

  async getExperimentsWidgetData(): Promise<{
    runningCount: number;
    completedCount: number;
    winnersCount: number;
    experiments: Array<{
      name: string;
      status: string;
      daysRunning: number;
      hasWinner: boolean;
      winnerGroup?: string;
      isSignificant?: boolean;
      primaryMetricLift?: number;
    }>;
  }> {
    const experiments = await this.getExperiments();

    const active = experiments.filter((e) => e.status === 'active');
    const completed = experiments.filter((e) => e.status === 'decision_made');
    const winners = completed.filter((e) => e.winnerGroupName);

    const experimentsWithResults = await Promise.all(
      experiments.slice(0, 10).map(async (e) => {
        let result: ExperimentResults | null = null;
        if (e.status === 'active' || e.status === 'decision_made') {
          result = await this.getExperimentResults(e.name);
        }

        const daysRunning = e.startTime
          ? Math.floor((Date.now() - e.startTime) / (1000 * 60 * 60 * 24))
          : 0;

        return {
          name: e.name,
          status: e.status,
          daysRunning,
          hasWinner: !!e.winnerGroupName,
          winnerGroup: e.winnerGroupName,
          isSignificant: result?.primaryMetric?.lift?.isSignificant,
          primaryMetricLift: result?.primaryMetric?.lift?.value,
        };
      })
    );

    return {
      runningCount: active.length,
      completedCount: completed.length,
      winnersCount: winners.length,
      experiments: experimentsWithResults,
    };
  }

  async getMetricsWidgetData(): Promise<{
    totalMetrics: number;
    metricsByType: Record<string, number>;
    topMetrics: Array<{
      name: string;
      type: string;
      trend: number;
      tags: string[];
    }>;
  }> {
    const metrics = await this.getMetrics();

    const metricsByType: Record<string, number> = {};
    metrics.forEach((m) => {
      metricsByType[m.type] = (metricsByType[m.type] || 0) + 1;
    });

    return {
      totalMetrics: metrics.length,
      metricsByType,
      topMetrics: metrics.slice(0, 10).map((m) => ({
        name: m.name,
        type: m.type,
        trend: 0, // Would need historical data
        tags: m.tags,
      })),
    };
  }

  // ==================== CONNECTION TEST ====================

  async testConnection(): Promise<boolean> {
    try {
      await this.getGates();
      return true;
    } catch {
      return false;
    }
  }
}

export const createStatsigConnector = (config: StatsigConfig): StatsigConnector => {
  return new StatsigConnector(config);
};
