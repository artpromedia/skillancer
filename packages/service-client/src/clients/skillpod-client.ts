/**
 * @module @skillancer/service-client/clients/skillpod-client
 * SkillPod service client for cloud development environment management
 */

import { BaseServiceClient, type ServiceClientConfig, type Pagination } from '../base-client.js';

// ============================================================================
// Types
// ============================================================================

export interface SkillPod {
  id: string;
  userId: string;
  contractId?: string;
  name: string;
  description?: string;
  template: PodTemplate;
  status: PodStatus;
  resources: PodResources;
  connection?: PodConnection;
  workspace?: WorkspaceConfig;
  autoStopMinutes?: number;
  createdAt: string;
  updatedAt: string;
  lastActiveAt?: string;
}

export type PodStatus =
  | 'pending'
  | 'provisioning'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error'
  | 'terminated';

export interface PodTemplate {
  id: string;
  name: string;
  description?: string;
  image: string;
  category: string;
  preInstalledTools?: string[];
  defaultResources: PodResources;
}

export interface PodResources {
  cpu: number; // in cores
  memory: number; // in MB
  storage: number; // in GB
  gpu?: {
    type: string;
    count: number;
  };
}

export interface PodConnection {
  type: 'ssh' | 'vscode' | 'web';
  url: string;
  token?: string;
  expiresAt?: string;
}

export interface WorkspaceConfig {
  repositoryUrl?: string;
  branch?: string;
  setupScript?: string;
  envVars?: Record<string, string>;
  ports?: PortMapping[];
}

export interface PortMapping {
  containerPort: number;
  protocol: 'tcp' | 'udp';
  public?: boolean;
  label?: string;
}

export interface CreateSkillPodInput {
  name: string;
  description?: string;
  templateId: string;
  contractId?: string;
  resources?: Partial<PodResources>;
  workspace?: WorkspaceConfig;
  autoStopMinutes?: number;
}

export interface UpdateSkillPodInput {
  name?: string;
  description?: string;
  resources?: Partial<PodResources>;
  workspace?: Partial<WorkspaceConfig>;
  autoStopMinutes?: number;
}

export interface Session {
  id: string;
  podId: string;
  userId: string;
  status: 'active' | 'ended' | 'terminated';
  connectionType: 'ssh' | 'vscode' | 'web';
  startedAt: string;
  endedAt?: string;
  duration?: number; // in seconds
  metadata?: Record<string, unknown>;
}

export interface Snapshot {
  id: string;
  podId: string;
  name: string;
  description?: string;
  sizeBytes: number;
  status: 'creating' | 'available' | 'error' | 'deleting';
  createdAt: string;
}

export interface CreateSnapshotInput {
  name: string;
  description?: string;
}

export interface PodMetrics {
  podId: string;
  timestamp: string;
  cpu: {
    usage: number;
    limit: number;
  };
  memory: {
    usage: number;
    limit: number;
  };
  storage: {
    usage: number;
    limit: number;
  };
  network: {
    rxBytes: number;
    txBytes: number;
  };
}

export interface PodUsage {
  podId: string;
  userId: string;
  period: {
    start: string;
    end: string;
  };
  totalMinutes: number;
  cpuMinutes: number;
  memoryMinutes: number;
  storageGbHours: number;
  estimatedCost: number;
  currency: string;
}

// ============================================================================
// SkillPod Service Client
// ============================================================================

export class SkillPodServiceClient extends BaseServiceClient {
  constructor(config?: Partial<ServiceClientConfig>) {
    super({
      baseUrl: process.env['SKILLPOD_SERVICE_URL'] ?? 'http://skillpod-svc:3003',
      serviceName: 'skillpod-svc',
      timeout: 60000, // Longer timeout for pod operations
      retries: 2,
      circuitBreaker: {
        enabled: true,
        threshold: 5,
        resetTimeout: 30000,
      },
      ...config,
    });
  }

  // ==========================================================================
  // Pod Management
  // ==========================================================================

  /**
   * Get pod by ID
   */
  async getPod(podId: string): Promise<SkillPod> {
    return this.get<SkillPod>(`pods/${podId}`);
  }

  /**
   * List pods
   */
  async listPods(params?: {
    userId?: string;
    contractId?: string;
    status?: PodStatus;
    templateId?: string;
    pagination?: Pagination;
  }): Promise<{ pods: SkillPod[]; total: number }> {
    const searchParams: Record<string, string> = {};

    if (params?.userId) searchParams['userId'] = params.userId;
    if (params?.contractId) searchParams['contractId'] = params.contractId;
    if (params?.status) searchParams['status'] = params.status;
    if (params?.templateId) searchParams['templateId'] = params.templateId;
    if (params?.pagination) {
      Object.assign(searchParams, this.buildPaginationParams(params.pagination));
    }

    return this.get<{ pods: SkillPod[]; total: number }>('pods', { searchParams });
  }

  /**
   * Create a new pod
   */
  async createPod(data: CreateSkillPodInput): Promise<SkillPod> {
    return this.post<SkillPod>('pods', data);
  }

  /**
   * Update pod
   */
  async updatePod(podId: string, data: UpdateSkillPodInput): Promise<SkillPod> {
    return this.patch<SkillPod>(`pods/${podId}`, data);
  }

  /**
   * Delete pod
   */
  async deletePod(podId: string): Promise<void> {
    await this.delete(`pods/${podId}`);
  }

  /**
   * Start pod
   */
  async startPod(podId: string): Promise<SkillPod> {
    return this.post<SkillPod>(`pods/${podId}/start`);
  }

  /**
   * Stop pod
   */
  async stopPod(podId: string): Promise<SkillPod> {
    return this.post<SkillPod>(`pods/${podId}/stop`);
  }

  /**
   * Restart pod
   */
  async restartPod(podId: string): Promise<SkillPod> {
    return this.post<SkillPod>(`pods/${podId}/restart`);
  }

  /**
   * Get pod connection info
   */
  async getPodConnection(
    podId: string,
    connectionType: 'ssh' | 'vscode' | 'web'
  ): Promise<PodConnection> {
    return this.get<PodConnection>(`pods/${podId}/connection/${connectionType}`);
  }

  /**
   * Resize pod resources
   */
  async resizePod(podId: string, resources: Partial<PodResources>): Promise<SkillPod> {
    return this.post<SkillPod>(`pods/${podId}/resize`, resources);
  }

  // ==========================================================================
  // Templates
  // ==========================================================================

  /**
   * List available templates
   */
  async listTemplates(params?: {
    category?: string;
    search?: string;
    pagination?: Pagination;
  }): Promise<{ templates: PodTemplate[]; total: number }> {
    const searchParams: Record<string, string> = {};

    if (params?.category) searchParams['category'] = params.category;
    if (params?.search) searchParams['search'] = params.search;
    if (params?.pagination) {
      Object.assign(searchParams, this.buildPaginationParams(params.pagination));
    }

    return this.get<{ templates: PodTemplate[]; total: number }>('templates', { searchParams });
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<PodTemplate> {
    return this.get<PodTemplate>(`templates/${templateId}`);
  }

  // ==========================================================================
  // Sessions
  // ==========================================================================

  /**
   * Start a session
   */
  async startSession(podId: string, connectionType: 'ssh' | 'vscode' | 'web'): Promise<Session> {
    return this.post<Session>(`pods/${podId}/sessions`, { connectionType });
  }

  /**
   * End a session
   */
  async endSession(podId: string, sessionId: string): Promise<Session> {
    return this.post<Session>(`pods/${podId}/sessions/${sessionId}/end`);
  }

  /**
   * Get session info
   */
  async getSession(podId: string, sessionId: string): Promise<Session> {
    return this.get<Session>(`pods/${podId}/sessions/${sessionId}`);
  }

  /**
   * List sessions for pod
   */
  async listSessions(
    podId: string,
    params?: {
      status?: Session['status'];
      pagination?: Pagination;
    }
  ): Promise<{ sessions: Session[]; total: number }> {
    const searchParams: Record<string, string> = {};

    if (params?.status) searchParams['status'] = params.status;
    if (params?.pagination) {
      Object.assign(searchParams, this.buildPaginationParams(params.pagination));
    }

    return this.get<{ sessions: Session[]; total: number }>(`pods/${podId}/sessions`, {
      searchParams,
    });
  }

  // ==========================================================================
  // Snapshots
  // ==========================================================================

  /**
   * Create snapshot
   */
  async createSnapshot(podId: string, data: CreateSnapshotInput): Promise<Snapshot> {
    return this.post<Snapshot>(`pods/${podId}/snapshots`, data);
  }

  /**
   * List snapshots
   */
  async listSnapshots(
    podId: string,
    pagination?: Pagination
  ): Promise<{ snapshots: Snapshot[]; total: number }> {
    const searchParams = this.buildPaginationParams(pagination);
    return this.get<{ snapshots: Snapshot[]; total: number }>(`pods/${podId}/snapshots`, {
      searchParams,
    });
  }

  /**
   * Get snapshot
   */
  async getSnapshot(podId: string, snapshotId: string): Promise<Snapshot> {
    return this.get<Snapshot>(`pods/${podId}/snapshots/${snapshotId}`);
  }

  /**
   * Restore from snapshot
   */
  async restoreSnapshot(podId: string, snapshotId: string): Promise<SkillPod> {
    return this.post<SkillPod>(`pods/${podId}/snapshots/${snapshotId}/restore`);
  }

  /**
   * Delete snapshot
   */
  async deleteSnapshot(podId: string, snapshotId: string): Promise<void> {
    await this.delete(`pods/${podId}/snapshots/${snapshotId}`);
  }

  // ==========================================================================
  // Metrics & Usage
  // ==========================================================================

  /**
   * Get pod metrics
   */
  async getPodMetrics(podId: string): Promise<PodMetrics> {
    return this.get<PodMetrics>(`pods/${podId}/metrics`);
  }

  /**
   * Get pod metrics history
   */
  async getPodMetricsHistory(
    podId: string,
    params?: {
      start?: string;
      end?: string;
      interval?: '1m' | '5m' | '15m' | '1h';
    }
  ): Promise<PodMetrics[]> {
    const searchParams: Record<string, string> = {};

    if (params?.start) searchParams['start'] = params.start;
    if (params?.end) searchParams['end'] = params.end;
    if (params?.interval) searchParams['interval'] = params.interval;

    return this.get<PodMetrics[]>(`pods/${podId}/metrics/history`, { searchParams });
  }

  /**
   * Get pod usage
   */
  async getPodUsage(
    podId: string,
    params?: {
      start?: string;
      end?: string;
    }
  ): Promise<PodUsage> {
    const searchParams: Record<string, string> = {};

    if (params?.start) searchParams['start'] = params.start;
    if (params?.end) searchParams['end'] = params.end;

    return this.get<PodUsage>(`pods/${podId}/usage`, { searchParams });
  }

  /**
   * Get usage summary for user
   */
  async getUserUsage(
    userId: string,
    params?: {
      start?: string;
      end?: string;
    }
  ): Promise<{ usage: PodUsage[]; total: PodUsage }> {
    const searchParams: Record<string, string> = {};

    if (params?.start) searchParams['start'] = params.start;
    if (params?.end) searchParams['end'] = params.end;

    return this.get<{ usage: PodUsage[]; total: PodUsage }>(`users/${userId}/usage`, {
      searchParams,
    });
  }

  // ==========================================================================
  // File Operations
  // ==========================================================================

  /**
   * Upload file to pod
   */
  async uploadFile(
    podId: string,
    path: string,
    content: Buffer | string
  ): Promise<{ path: string; size: number }> {
    return this.post(`pods/${podId}/files`, {
      path,
      content: typeof content === 'string' ? content : content.toString('base64'),
      encoding: typeof content === 'string' ? 'utf8' : 'base64',
    });
  }

  /**
   * Download file from pod
   */
  async downloadFile(podId: string, path: string): Promise<{ content: string; encoding: string }> {
    return this.get(`pods/${podId}/files`, {
      searchParams: { path },
    });
  }

  /**
   * List files in directory
   */
  async listFiles(
    podId: string,
    path: string
  ): Promise<Array<{ name: string; type: 'file' | 'directory'; size?: number }>> {
    return this.get(`pods/${podId}/files/list`, {
      searchParams: { path },
    });
  }

  /**
   * Execute command in pod
   */
  async executeCommand(
    podId: string,
    command: string,
    options?: {
      workdir?: string;
      timeout?: number;
      env?: Record<string, string>;
    }
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return this.post(`pods/${podId}/exec`, {
      command,
      ...options,
    });
  }
}

// Export singleton instance
export const skillpodClient = new SkillPodServiceClient();
