import { EventEmitter } from 'node:events';

// PostHog Connector
//
// Authentication: Personal API Key
//
// Supported Widgets:
// 1. product-analytics - DAU/WAU/MAU, events, funnels
// 2. feature-flags - Active flags, flag rollout status, experiment results
// 3. session-recordings - Recording count, rage clicks, error sessions

interface PostHogConfig {
  apiKey: string;
  projectId: string;
  host?: string;
}

interface InsightData {
  id: string;
  name: string;
  type: 'TRENDS' | 'FUNNELS' | 'RETENTION' | 'PATHS' | 'STICKINESS' | 'LIFECYCLE';
  result: unknown;
  lastRefresh: string;
}

interface FeatureFlag {
  id: number;
  key: string;
  name: string;
  active: boolean;
  rolloutPercentage: number;
  filters: {
    groups: Array<{
      properties: unknown[];
      rollout_percentage: number;
    }>;
  };
  createdAt: string;
  createdBy: string;
}

interface Experiment {
  id: number;
  name: string;
  description: string;
  featureFlagKey: string;
  status: 'draft' | 'running' | 'complete';
  startDate: string;
  endDate: string | null;
  variants: Array<{
    key: string;
    name: string;
    rolloutPercentage: number;
  }>;
  metrics: Array<{
    name: string;
    type: string;
  }>;
  results?: ExperimentResults;
}

interface ExperimentResults {
  insight: unknown[];
  probability: Record<string, number>;
  significanceCode: string;
  significant: boolean;
  expectedLoss: number;
  variants: Array<{
    key: string;
    count: number;
    exposure: number;
    conversionRate: number;
    credibleInterval: [number, number];
  }>;
}

interface SessionRecording {
  id: string;
  personId: string;
  startTime: string;
  endTime: string;
  duration: number;
  clickCount: number;
  keyPressCount: number;
  mouseActivity: number;
  activeSeconds: number;
  inactiveSeconds: number;
  consoleLogCount: number;
  consoleWarnCount: number;
  consoleErrorCount: number;
  rageClickCount: number;
  errorCount: number;
}

interface SessionRecordingFilters {
  personId?: string;
  dateFrom?: string;
  dateTo?: string;
  hasRageClicks?: boolean;
  hasErrors?: boolean;
  durationMin?: number;
  durationMax?: number;
}

export class PostHogConnector extends EventEmitter {
  private config: PostHogConfig;
  private baseUrl: string;

  constructor(config: PostHogConfig) {
    super();
    this.config = config;
    this.baseUrl = config.host || 'https://app.posthog.com';
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/api/projects/${this.config.projectId}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`PostHog API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ==================== INSIGHTS ====================

  async getInsights(query: {
    type: InsightData['type'];
    events?: Array<{ id: string; name: string }>;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<InsightData[]> {
    const data = await this.request<{ results: unknown[] }>('/insights/', {
      method: 'POST',
      body: JSON.stringify(query),
    });

    return [];
  }

  async getTrends(events: string[], dateFrom: string, dateTo: string): Promise<InsightData> {
    const insights = await this.getInsights({
      type: 'TRENDS',
      events: events.map((e) => ({ id: e, name: e })),
      dateFrom,
      dateTo,
    });

    return (
      insights[0] || {
        id: '',
        name: 'Trends',
        type: 'TRENDS',
        result: [],
        lastRefresh: new Date().toISOString(),
      }
    );
  }

  async getFunnelInsight(events: string[], dateFrom: string, dateTo: string): Promise<InsightData> {
    const insights = await this.getInsights({
      type: 'FUNNELS',
      events: events.map((e) => ({ id: e, name: e })),
      dateFrom,
      dateTo,
    });

    return (
      insights[0] || {
        id: '',
        name: 'Funnel',
        type: 'FUNNELS',
        result: [],
        lastRefresh: new Date().toISOString(),
      }
    );
  }

  async getRetentionInsight(
    startEvent: string,
    returnEvent: string,
    dateFrom: string,
    dateTo: string
  ): Promise<InsightData> {
    const insights = await this.getInsights({
      type: 'RETENTION',
      dateFrom,
      dateTo,
    });

    return (
      insights[0] || {
        id: '',
        name: 'Retention',
        type: 'RETENTION',
        result: [],
        lastRefresh: new Date().toISOString(),
      }
    );
  }

  // ==================== FEATURE FLAGS ====================

  async getFeatureFlags(): Promise<FeatureFlag[]> {
    const data = await this.request<{ results: FeatureFlag[] }>('/feature_flags/');
    return data.results || [];
  }

  async getFeatureFlag(flagKey: string): Promise<FeatureFlag | null> {
    const flags = await this.getFeatureFlags();
    return flags.find((f) => f.key === flagKey) || null;
  }

  async getActiveFlags(): Promise<FeatureFlag[]> {
    const flags = await this.getFeatureFlags();
    return flags.filter((f) => f.active);
  }

  async getFlagRolloutPercentage(flagKey: string): Promise<number> {
    const flag = await this.getFeatureFlag(flagKey);
    return flag?.rolloutPercentage || 0;
  }

  // ==================== EXPERIMENTS ====================

  async getExperiments(): Promise<Experiment[]> {
    const data = await this.request<{ results: Experiment[] }>('/experiments/');
    return data.results || [];
  }

  async getExperiment(experimentId: number): Promise<Experiment | null> {
    try {
      return await this.request<Experiment>(`/experiments/${experimentId}/`);
    } catch {
      return null;
    }
  }

  async getRunningExperiments(): Promise<Experiment[]> {
    const experiments = await this.getExperiments();
    return experiments.filter((e) => e.status === 'running');
  }

  async getExperimentResults(experimentId: number): Promise<ExperimentResults | null> {
    const experiment = await this.getExperiment(experimentId);
    return experiment?.results || null;
  }

  async getSignificantExperiments(): Promise<Experiment[]> {
    const experiments = await this.getExperiments();
    return experiments.filter((e) => e.results?.significant);
  }

  // ==================== SESSION RECORDINGS ====================

  async getSessionRecordings(filters: SessionRecordingFilters): Promise<SessionRecording[]> {
    const params = new URLSearchParams();
    if (filters.dateFrom) params.append('date_from', filters.dateFrom);
    if (filters.dateTo) params.append('date_to', filters.dateTo);
    if (filters.personId) params.append('person_id', filters.personId);

    const data = await this.request<{ results: SessionRecording[] }>(
      `/session_recordings/?${params.toString()}`
    );

    let recordings = data.results || [];

    if (filters.hasRageClicks) {
      recordings = recordings.filter((r) => r.rageClickCount > 0);
    }
    if (filters.hasErrors) {
      recordings = recordings.filter((r) => r.errorCount > 0);
    }

    return recordings;
  }

  async getRageClickSessions(dateFrom: string, dateTo: string): Promise<SessionRecording[]> {
    return this.getSessionRecordings({
      dateFrom,
      dateTo,
      hasRageClicks: true,
    });
  }

  async getErrorSessions(dateFrom: string, dateTo: string): Promise<SessionRecording[]> {
    return this.getSessionRecordings({
      dateFrom,
      dateTo,
      hasErrors: true,
    });
  }

  async getRecordingCount(dateFrom: string, dateTo: string): Promise<number> {
    const recordings = await this.getSessionRecordings({ dateFrom, dateTo });
    return recordings.length;
  }

  // ==================== WIDGET DATA ====================

  async getFeatureFlagsWidgetData(): Promise<{
    totalFlags: number;
    activeFlags: number;
    recentlyChanged: FeatureFlag[];
    flagsByRollout: { full: number; partial: number; off: number };
  }> {
    const flags = await this.getFeatureFlags();
    const activeFlags = flags.filter((f) => f.active);

    const flagsByRollout = {
      full: flags.filter((f) => f.rolloutPercentage === 100).length,
      partial: flags.filter((f) => f.rolloutPercentage > 0 && f.rolloutPercentage < 100).length,
      off: flags.filter((f) => f.rolloutPercentage === 0 || !f.active).length,
    };

    return {
      totalFlags: flags.length,
      activeFlags: activeFlags.length,
      recentlyChanged: flags.slice(0, 5),
      flagsByRollout,
    };
  }

  async getExperimentsWidgetData(): Promise<{
    runningCount: number;
    significantCount: number;
    experiments: Array<{
      id: number;
      name: string;
      status: string;
      daysRunning: number;
      significant: boolean;
      leadingVariant?: string;
    }>;
  }> {
    const experiments = await this.getExperiments();
    const running = experiments.filter((e) => e.status === 'running');
    const significant = experiments.filter((e) => e.results?.significant);

    return {
      runningCount: running.length,
      significantCount: significant.length,
      experiments: experiments.slice(0, 10).map((e) => {
        const daysRunning = Math.floor(
          (Date.now() - new Date(e.startDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        let leadingVariant: string | undefined;
        if (e.results?.variants) {
          const sorted = [...e.results.variants].sort(
            (a, b) => b.conversionRate - a.conversionRate
          );
          leadingVariant = sorted[0]?.key;
        }

        return {
          id: e.id,
          name: e.name,
          status: e.status,
          daysRunning,
          significant: e.results?.significant || false,
          leadingVariant,
        };
      }),
    };
  }

  async getSessionRecordingsWidgetData(): Promise<{
    totalRecordings: number;
    rageClickSessions: number;
    errorSessions: number;
    avgSessionDuration: number;
  }> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const today = new Date().toISOString().split('T')[0];

    const [all, rageClicks, errors] = await Promise.all([
      this.getSessionRecordings({
        dateFrom: sevenDaysAgo.toISOString().split('T')[0],
        dateTo: today,
      }),
      this.getRageClickSessions(sevenDaysAgo.toISOString().split('T')[0], today),
      this.getErrorSessions(sevenDaysAgo.toISOString().split('T')[0], today),
    ]);

    const avgDuration =
      all.length > 0 ? all.reduce((sum, r) => sum + r.duration, 0) / all.length : 0;

    return {
      totalRecordings: all.length,
      rageClickSessions: rageClicks.length,
      errorSessions: errors.length,
      avgSessionDuration: Math.round(avgDuration),
    };
  }

  // ==================== CONNECTION TEST ====================

  async testConnection(): Promise<boolean> {
    try {
      await this.getFeatureFlags();
      return true;
    } catch {
      return false;
    }
  }
}

export const createPostHogConnector = (config: PostHogConfig): PostHogConnector => {
  return new PostHogConnector(config);
};
