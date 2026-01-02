import type { ApiClient } from './client';

// ============================================
// TYPES
// ============================================

export enum IntegrationCategory {
  ACCOUNTING = 'ACCOUNTING',
  ANALYTICS = 'ANALYTICS',
  DEVTOOLS = 'DEVTOOLS',
  SECURITY = 'SECURITY',
  HR = 'HR',
  MARKETING = 'MARKETING',
  PRODUCTIVITY = 'PRODUCTIVITY',
  COMMUNICATION = 'COMMUNICATION',
  CLOUD = 'CLOUD',
  CRM = 'CRM',
}

export enum IntegrationTier {
  BASIC = 'BASIC',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
  ADDON = 'ADDON',
}

export enum IntegrationStatus {
  PENDING = 'PENDING',
  CONNECTED = 'CONNECTED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
  ERROR = 'ERROR',
  DISCONNECTED = 'DISCONNECTED',
}

export enum SyncStatus {
  NEVER = 'NEVER',
  SYNCING = 'SYNCING',
  SYNCED = 'SYNCED',
  FAILED = 'FAILED',
}

export interface WidgetDefinition {
  id: string;
  name: string;
  description: string;
  refreshInterval: number;
  requiredScopes: string[];
  configSchema?: Record<string, unknown>;
}

export interface IntegrationType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  category: IntegrationCategory;
  applicableRoles: string[];
  requiredScopes: string[];
  optionalScopes: string[];
  tier: IntegrationTier;
  addonPrice: number | null;
  isActive: boolean;
  isBeta: boolean;
  widgets: WidgetDefinition[];
  setupGuideUrl: string | null;
  apiDocsUrl: string | null;
}

export interface WorkspaceIntegration {
  id: string;
  workspaceId: string;
  integrationTypeId: string;
  integrationType: IntegrationType;
  status: IntegrationStatus;
  connectedAt: string | null;
  disconnectedAt: string | null;
  tokenScopes: string[];
  providerAccountId: string | null;
  providerMetadata: Record<string, unknown> | null;
  config: Record<string, unknown> | null;
  enabledWidgets: string[];
  lastSyncAt: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
}

export interface WidgetData {
  widgetId: string;
  data: unknown;
  fetchedAt: string;
}

export interface ConnectResponse {
  authorizationUrl: string;
}

export interface TestResult {
  healthy: boolean;
  error?: string;
  latency?: number;
}

export interface SyncResult {
  success: boolean;
  syncedAt: string;
  error?: string;
}

// ============================================
// API CLIENT
// ============================================

export class IntegrationsApiClient {
  private client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  // ============================================
  // DISCOVERY
  // ============================================

  /**
   * Get available integrations
   */
  async getAvailableIntegrations(options?: {
    category?: IntegrationCategory;
    executiveType?: string;
  }): Promise<IntegrationType[]> {
    const params = new URLSearchParams();
    if (options?.category) params.append('category', options.category);
    if (options?.executiveType) params.append('executiveType', options.executiveType);

    const response = await this.client.get<{ integrations: IntegrationType[] }>(
      `/integrations?${params}`
    );
    return response.integrations;
  }

  /**
   * Get integration details by slug
   */
  async getIntegrationDetails(slug: string): Promise<IntegrationType | null> {
    try {
      const response = await this.client.get<{ integration: IntegrationType }>(
        `/integrations/${slug}`
      );
      return response.integration;
    } catch {
      return null;
    }
  }

  // ============================================
  // CONNECTION
  // ============================================

  /**
   * Initiate OAuth connection for an integration
   */
  async connectIntegration(
    workspaceId: string,
    slug: string,
    options?: {
      redirectUri?: string;
      scopes?: string[];
    }
  ): Promise<ConnectResponse> {
    return this.client.post<ConnectResponse>(
      `/workspaces/${workspaceId}/integrations/${slug}/connect`,
      options || {}
    );
  }

  /**
   * Disconnect an integration
   */
  async disconnectIntegration(workspaceId: string, integrationId: string): Promise<void> {
    await this.client.post(
      `/workspaces/${workspaceId}/integrations/${integrationId}/disconnect`,
      {}
    );
  }

  /**
   * Reconnect an expired integration
   */
  async reconnectIntegration(
    workspaceId: string,
    integrationId: string,
    options?: {
      redirectUri?: string;
    }
  ): Promise<ConnectResponse> {
    return this.client.post<ConnectResponse>(
      `/workspaces/${workspaceId}/integrations/${integrationId}/reconnect`,
      options || {}
    );
  }

  // ============================================
  // STATUS
  // ============================================

  /**
   * Get all integrations for a workspace
   */
  async getWorkspaceIntegrations(workspaceId: string): Promise<WorkspaceIntegration[]> {
    const response = await this.client.get<{ integrations: WorkspaceIntegration[] }>(
      `/workspaces/${workspaceId}/integrations`
    );
    return response.integrations;
  }

  /**
   * Get a specific integration's status
   */
  async getIntegrationStatus(
    workspaceId: string,
    integrationId: string
  ): Promise<WorkspaceIntegration | null> {
    try {
      const response = await this.client.get<{ integration: WorkspaceIntegration }>(
        `/workspaces/${workspaceId}/integrations/${integrationId}`
      );
      return response.integration;
    } catch {
      return null;
    }
  }

  /**
   * Test an integration's connection
   */
  async testIntegration(workspaceId: string, integrationId: string): Promise<TestResult> {
    return this.client.post<TestResult>(
      `/workspaces/${workspaceId}/integrations/${integrationId}/test`,
      {}
    );
  }

  // ============================================
  // DATA
  // ============================================

  /**
   * Get widget data from an integration
   */
  async getWidgetData(
    workspaceId: string,
    integrationId: string,
    widgetId: string,
    params?: Record<string, unknown>
  ): Promise<WidgetData> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
    }

    const response = await this.client.get<{ data: WidgetData }>(
      `/workspaces/${workspaceId}/integrations/${integrationId}/widgets/${widgetId}/data?${searchParams}`
    );
    return response.data;
  }

  /**
   * Trigger a manual sync for an integration
   */
  async syncIntegration(workspaceId: string, integrationId: string): Promise<SyncResult> {
    return this.client.post<SyncResult>(
      `/workspaces/${workspaceId}/integrations/${integrationId}/sync`,
      {}
    );
  }

  // ============================================
  // CONFIGURATION
  // ============================================

  /**
   * Update integration configuration
   */
  async updateConfig(
    workspaceId: string,
    integrationId: string,
    config: Record<string, unknown>
  ): Promise<WorkspaceIntegration> {
    const response = await this.client.put<{ integration: WorkspaceIntegration }>(
      `/workspaces/${workspaceId}/integrations/${integrationId}/config`,
      { config }
    );
    return response.integration;
  }

  /**
   * Update enabled widgets for an integration
   */
  async updateEnabledWidgets(
    workspaceId: string,
    integrationId: string,
    enabledWidgets: string[]
  ): Promise<WorkspaceIntegration> {
    const response = await this.client.put<{ integration: WorkspaceIntegration }>(
      `/workspaces/${workspaceId}/integrations/${integrationId}/widgets`,
      { enabledWidgets }
    );
    return response.integration;
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

export function createIntegrationsClient(client: ApiClient): IntegrationsApiClient {
  return new IntegrationsApiClient(client);
}

export default IntegrationsApiClient;
