import { EventEmitter } from 'node:events';

// LaunchDarkly Connector
//
// Authentication: API Access Token
//
// Supported Widgets:
// - feature-flags - Flag status, rollout percentages, targeting
// - experiments - A/B tests, experiment results

interface LaunchDarklyConfig {
  apiToken: string;
  projectKey: string;
  environmentKey?: string;
}

interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  kind: 'boolean' | 'multivariate' | 'string' | 'number' | 'json';
  creationDate: number;
  includeInSnippet: boolean;
  temporary: boolean;
  tags: string[];
  maintainerId: string;
  environments: Record<
    string,
    {
      on: boolean;
      archived: boolean;
      salt: string;
      sel: string;
      lastModified: number;
      version: number;
      targets: Array<{
        values: string[];
        variation: number;
      }>;
      rules: Array<{
        id: string;
        clauses: unknown[];
        variation: number;
        rollout?: {
          variations: Array<{
            variation: number;
            weight: number;
          }>;
        };
      }>;
      fallthrough: {
        variation?: number;
        rollout?: {
          variations: Array<{
            variation: number;
            weight: number;
          }>;
        };
      };
      offVariation: number;
      prerequisites: unknown[];
    }
  >;
  variations: Array<{
    value: unknown;
    name?: string;
    description?: string;
  }>;
  defaults: {
    onVariation: number;
    offVariation: number;
  };
}

interface FlagStatus {
  name: string;
  lastRequested: string;
  default: unknown;
}

interface AuditLogEntry {
  id: string;
  date: number;
  accesses: Array<{
    action: string;
    resource: string;
  }>;
  kind: string;
  name: string;
  description: string;
  shortDescription: string;
  member: {
    email: string;
    firstName: string;
    lastName: string;
  };
}

interface ExperimentIteration {
  id: string;
  hypothesis: string;
  status: 'not_started' | 'running' | 'stopped' | 'completed';
  startDate: number;
  endDate?: number;
  winningTreatmentId?: string;
  winningReason?: string;
  primaryMetricKey: string;
  treatments: Array<{
    id: string;
    name: string;
    baseline: boolean;
    allocationPercent: number;
  }>;
  metrics: Array<{
    key: string;
    isGroup: boolean;
  }>;
}

interface Experiment {
  key: string;
  name: string;
  description: string;
  maintainerId: string;
  creationDate: number;
  environmentKey: string;
  archivedDate?: number;
  currentIteration?: ExperimentIteration;
  draftIteration?: ExperimentIteration;
  previousIterations?: ExperimentIteration[];
}

export class LaunchDarklyConnector extends EventEmitter {
  private config: LaunchDarklyConfig;
  private baseUrl = 'https://app.launchdarkly.com/api/v2';

  constructor(config: LaunchDarklyConfig) {
    super();
    this.config = config;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: this.config.apiToken,
      'Content-Type': 'application/json',
    };
  }

  private get envKey(): string {
    return this.config.environmentKey || 'production';
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
      throw new Error(`LaunchDarkly API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ==================== FEATURE FLAGS ====================

  async getFlags(): Promise<FeatureFlag[]> {
    const data = await this.request<{ items: FeatureFlag[] }>(`/flags/${this.config.projectKey}`);
    return data.items || [];
  }

  async getFlag(flagKey: string): Promise<FeatureFlag | null> {
    try {
      return await this.request<FeatureFlag>(`/flags/${this.config.projectKey}/${flagKey}`);
    } catch {
      return null;
    }
  }

  async getActiveFlags(): Promise<FeatureFlag[]> {
    const flags = await this.getFlags();
    return flags.filter((f) => f.environments[this.envKey]?.on);
  }

  async getTemporaryFlags(): Promise<FeatureFlag[]> {
    const flags = await this.getFlags();
    return flags.filter((f) => f.temporary);
  }

  async getStaleFlagsCount(daysThreshold: number = 90): Promise<number> {
    const flags = await this.getFlags();
    const threshold = Date.now() - daysThreshold * 24 * 60 * 60 * 1000;

    return flags.filter((f) => {
      const envData = f.environments[this.envKey];
      return envData && envData.lastModified < threshold;
    }).length;
  }

  async getFlagsByTag(tag: string): Promise<FeatureFlag[]> {
    const flags = await this.getFlags();
    return flags.filter((f) => f.tags.includes(tag));
  }

  // ==================== FLAG STATUS ====================

  async getFlagStatuses(): Promise<Record<string, FlagStatus>> {
    const data = await this.request<{ _links: unknown; items: FlagStatus[] }>(
      `/flag-statuses/${this.config.projectKey}/${this.envKey}`
    );

    const statuses: Record<string, FlagStatus> = {};
    (data.items || []).forEach((item) => {
      statuses[item.name] = item;
    });

    return statuses;
  }

  // ==================== EXPERIMENTS ====================

  async getExperiments(): Promise<Experiment[]> {
    const data = await this.request<{ items: Experiment[] }>(
      `/projects/${this.config.projectKey}/environments/${this.envKey}/experiments`
    );
    return data.items || [];
  }

  async getExperiment(experimentKey: string): Promise<Experiment | null> {
    try {
      return await this.request<Experiment>(
        `/projects/${this.config.projectKey}/environments/${this.envKey}/experiments/${experimentKey}`
      );
    } catch {
      return null;
    }
  }

  async getRunningExperiments(): Promise<Experiment[]> {
    const experiments = await this.getExperiments();
    return experiments.filter((e) => e.currentIteration?.status === 'running');
  }

  async getCompletedExperiments(): Promise<Experiment[]> {
    const experiments = await this.getExperiments();
    return experiments.filter(
      (e) =>
        e.currentIteration?.status === 'completed' ||
        (e.previousIterations && e.previousIterations.length > 0)
    );
  }

  // ==================== AUDIT LOG ====================

  async getAuditLog(limit: number = 20): Promise<AuditLogEntry[]> {
    const data = await this.request<{ items: AuditLogEntry[] }>(`/auditlog?limit=${limit}`);
    return data.items || [];
  }

  async getFlagChanges(limit: number = 20): Promise<AuditLogEntry[]> {
    const entries = await this.getAuditLog(limit);
    return entries.filter((e) => e.kind === 'flag');
  }

  // ==================== WIDGET DATA ====================

  async getFeatureFlagsWidgetData(): Promise<{
    totalFlags: number;
    activeFlags: number;
    temporaryFlags: number;
    staleFlags: number;
    recentChanges: Array<{
      flag: string;
      action: string;
      changedBy: string;
      date: string;
    }>;
    flagsByKind: Record<string, number>;
  }> {
    const [flags, recentChanges] = await Promise.all([this.getFlags(), this.getFlagChanges(10)]);

    const activeCount = flags.filter((f) => f.environments[this.envKey]?.on).length;

    const temporaryCount = flags.filter((f) => f.temporary).length;

    const threshold = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const staleCount = flags.filter((f) => {
      const envData = f.environments[this.envKey];
      return envData && envData.lastModified < threshold;
    }).length;

    const flagsByKind: Record<string, number> = {};
    flags.forEach((f) => {
      flagsByKind[f.kind] = (flagsByKind[f.kind] || 0) + 1;
    });

    return {
      totalFlags: flags.length,
      activeFlags: activeCount,
      temporaryFlags: temporaryCount,
      staleFlags: staleCount,
      recentChanges: recentChanges.slice(0, 5).map((c) => ({
        flag: c.name,
        action: c.shortDescription,
        changedBy: c.member ? `${c.member.firstName} ${c.member.lastName}` : 'Unknown',
        date: new Date(c.date).toISOString(),
      })),
      flagsByKind,
    };
  }

  async getExperimentsWidgetData(): Promise<{
    runningCount: number;
    completedCount: number;
    experiments: Array<{
      key: string;
      name: string;
      status: string;
      daysRunning: number;
      hasWinner: boolean;
      winningTreatment?: string;
    }>;
  }> {
    const experiments = await this.getExperiments();

    const running = experiments.filter((e) => e.currentIteration?.status === 'running');
    const completed = experiments.filter((e) => e.currentIteration?.status === 'completed');

    return {
      runningCount: running.length,
      completedCount: completed.length,
      experiments: experiments.slice(0, 10).map((e) => {
        const iteration = e.currentIteration;
        const daysRunning = iteration?.startDate
          ? Math.floor((Date.now() - iteration.startDate) / (1000 * 60 * 60 * 24))
          : 0;

        let winningTreatment: string | undefined;
        if (iteration?.winningTreatmentId) {
          const winner = iteration.treatments.find((t) => t.id === iteration.winningTreatmentId);
          winningTreatment = winner?.name;
        }

        return {
          key: e.key,
          name: e.name,
          status: iteration?.status || 'not_started',
          daysRunning,
          hasWinner: !!iteration?.winningTreatmentId,
          winningTreatment,
        };
      }),
    };
  }

  // ==================== CONNECTION TEST ====================

  async testConnection(): Promise<boolean> {
    try {
      await this.getFlags();
      return true;
    } catch {
      return false;
    }
  }
}

export const createLaunchDarklyConnector = (config: LaunchDarklyConfig): LaunchDarklyConnector => {
  return new LaunchDarklyConnector(config);
};
