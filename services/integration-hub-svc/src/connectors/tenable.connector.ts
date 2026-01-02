// @ts-nocheck
import { BaseConnector, ConnectorConfig, OAuthConfig } from './base.connector';

// Tenable.io Vulnerability Management Connector
// Provides vulnerability scanning, asset management, and compliance

export interface TenableCredentials {
  accessKey: string;
  secretKey: string;
}

export interface TenableAsset {
  id: string;
  hostname: string;
  ipv4: string[];
  ipv6: string[];
  fqdn: string[];
  operatingSystem: string[];
  lastSeen: Date;
  lastAuthenticatedScan: Date | null;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

export interface TenableVulnerability {
  pluginId: number;
  pluginName: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  vprScore: number;
  cve: string[];
  affectedAssets: number;
  firstSeen: Date;
  lastSeen: Date;
  state: 'open' | 'reopened' | 'fixed';
  hasExploit: boolean;
}

export interface TenableScan {
  id: string;
  uuid: string;
  name: string;
  status: 'completed' | 'running' | 'paused' | 'canceled' | 'aborted';
  startTime: Date;
  endTime: Date | null;
  targets: string;
  hostCount: number;
}

export interface TenableAgent {
  id: string;
  name: string;
  platform: string;
  distro: string;
  ip: string;
  status: 'online' | 'offline';
  lastConnect: Date;
  lastScanned: Date | null;
  pluginFeedVersion: string;
}

const TENABLE_API_BASE = 'https://cloud.tenable.com';

export class TenableConnector extends BaseConnector {
  private credentials: TenableCredentials | null = null;

  constructor(config: ConnectorConfig) {
    super(config);
  }

  get providerId(): string {
    return 'tenable';
  }

  get providerName(): string {
    return 'Tenable.io';
  }

  get requiredScopes(): string[] {
    return ['vulns-read', 'assets-read', 'scans-read'];
  }

  getOAuthConfig(): OAuthConfig {
    // Tenable uses API keys, not OAuth
    return {
      authorizationUrl: '',
      tokenUrl: '',
      scopes: [],
    };
  }

  async connect(credentials: TenableCredentials): Promise<void> {
    this.credentials = credentials;
    // Validate credentials
    await this.makeRequest('GET', '/server/status');
  }

  async disconnect(): Promise<void> {
    this.credentials = null;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('GET', '/server/status');
      return true;
    } catch {
      return false;
    }
  }

  // Asset Management
  async getAssets(filters?: {
    lastSeen?: number;
    hasPluginResults?: boolean;
  }): Promise<TenableAsset[]> {
    const body: Record<string, unknown> = {};

    if (filters?.lastSeen) {
      body.filters = { last_seen: filters.lastSeen };
    }

    const response = await this.makeRequest('POST', '/assets/export', body);
    return this.pollExport(response.export_uuid, 'assets');
  }

  async getAssetCount(): Promise<{
    total: number;
    hasVulnerabilities: number;
    byOS: Record<string, number>;
  }> {
    const response = await this.makeRequest('GET', '/workbenches/assets');

    const byOS: Record<string, number> = {};
    let hasVulns = 0;

    for (const asset of response.assets || []) {
      const os = asset.operating_system?.[0] || 'Unknown';
      byOS[os] = (byOS[os] || 0) + 1;
      if (asset.severity_count?.total > 0) {
        hasVulns++;
      }
    }

    return {
      total: response.assets?.length || 0,
      hasVulnerabilities: hasVulns,
      byOS,
    };
  }

  // Vulnerability Management
  async getVulnerabilities(filters?: {
    severity?: string[];
    state?: string;
    exploitable?: boolean;
  }): Promise<TenableVulnerability[]> {
    const body: Record<string, unknown> = { num_assets: 500 };

    if (filters?.severity) {
      body.filters = { severity: filters.severity };
    }

    const response = await this.makeRequest('POST', '/vulns/export', body);
    return this.pollExport(response.export_uuid, 'vulns');
  }

  async getVulnerabilitySummary(): Promise<{
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    exploitable: number;
    avgVprScore: number;
  }> {
    const response = await this.makeRequest('GET', '/workbenches/vulnerabilities');

    const vulns = response.vulnerabilities || [];
    const exploitable = vulns.filter((v: { has_exploit: boolean }) => v.has_exploit).length;
    const vprScores = vulns
      .filter((v: { vpr_score: number | null }) => v.vpr_score)
      .map((v: { vpr_score: number }) => v.vpr_score);

    return {
      total: vulns.length,
      critical: vulns.filter((v: { severity: number }) => v.severity === 4).length,
      high: vulns.filter((v: { severity: number }) => v.severity === 3).length,
      medium: vulns.filter((v: { severity: number }) => v.severity === 2).length,
      low: vulns.filter((v: { severity: number }) => v.severity === 1).length,
      exploitable,
      avgVprScore:
        vprScores.length > 0
          ? vprScores.reduce((a: number, b: number) => a + b, 0) / vprScores.length
          : 0,
    };
  }

  // Scan Management
  async getScans(): Promise<TenableScan[]> {
    const response = await this.makeRequest('GET', '/scans');

    return (response.scans || []).map((scan: Record<string, unknown>) => ({
      id: scan.id,
      uuid: scan.uuid,
      name: scan.name,
      status: scan.status,
      startTime: new Date((scan.starttime as number) * 1000),
      endTime: scan.endtime ? new Date((scan.endtime as number) * 1000) : null,
      targets: scan.targets || '',
      hostCount: scan.hostcount || 0,
    }));
  }

  async getScanDetails(scanId: string): Promise<{
    info: TenableScan;
    hosts: Array<{ hostname: string; critical: number; high: number }>;
  }> {
    const response = await this.makeRequest('GET', `/scans/${scanId}`);

    return {
      info: {
        id: response.info.object_id,
        uuid: response.info.uuid,
        name: response.info.name,
        status: response.info.status,
        startTime: new Date(response.info.scanner_start * 1000),
        endTime: response.info.scanner_end ? new Date(response.info.scanner_end * 1000) : null,
        targets: response.info.targets || '',
        hostCount: response.info.hostcount || 0,
      },
      hosts: (response.hosts || []).map((h: Record<string, unknown>) => ({
        hostname: h.hostname,
        critical: h.critical || 0,
        high: h.high || 0,
      })),
    };
  }

  // Agent Management
  async getAgents(): Promise<TenableAgent[]> {
    const response = await this.makeRequest('GET', '/scanners/1/agents');

    return (response.agents || []).map((agent: Record<string, unknown>) => ({
      id: agent.id,
      name: agent.name,
      platform: agent.platform,
      distro: agent.distro || '',
      ip: agent.ip,
      status: agent.status,
      lastConnect: new Date((agent.last_connect as number) * 1000),
      lastScanned: agent.last_scanned ? new Date((agent.last_scanned as number) * 1000) : null,
      pluginFeedVersion: agent.plugin_feed_version || '',
    }));
  }

  // Widget Data Methods
  async getWidgetData(widgetType: string): Promise<unknown> {
    switch (widgetType) {
      case 'vulnerability-dashboard':
        return this.getVulnerabilitySummary();

      case 'asset-inventory':
        return this.getAssetCount();

      case 'scan-status':
        return {
          scans: await this.getScans(),
        };

      case 'agent-health':
        const agents = await this.getAgents();
        return {
          total: agents.length,
          online: agents.filter((a) => a.status === 'online').length,
          offline: agents.filter((a) => a.status === 'offline').length,
        };

      default:
        throw new Error(`Unknown widget type: ${widgetType}`);
    }
  }

  // Private helper methods
  private async makeRequest(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!this.credentials) {
      throw new Error('Not connected to Tenable');
    }

    const response = await fetch(`${TENABLE_API_BASE}${endpoint}`, {
      method,
      headers: {
        'X-ApiKeys': `accessKey=${this.credentials.accessKey}; secretKey=${this.credentials.secretKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Tenable API error: ${response.status}`);
    }

    return response.json();
  }

  private async pollExport(exportUuid: string, type: 'assets' | 'vulns'): Promise<unknown[]> {
    const endpoint = type === 'assets' ? '/assets/export' : '/vulns/export';
    let status = 'PROCESSING';

    while (status === 'PROCESSING') {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const statusResponse = await this.makeRequest('GET', `${endpoint}/${exportUuid}/status`);
      status = statusResponse.status as string;
    }

    if (status !== 'FINISHED') {
      throw new Error(`Export failed with status: ${status}`);
    }

    // Download chunks
    const results: unknown[] = [];
    const statusResponse = await this.makeRequest('GET', `${endpoint}/${exportUuid}/status`);

    for (const chunk of (statusResponse.chunks_available as number[]) || []) {
      const chunkData = await this.makeRequest('GET', `${endpoint}/${exportUuid}/chunks/${chunk}`);
      results.push(...(chunkData as unknown[]));
    }

    return results;
  }
}

export const createTenableConnector = (config: ConnectorConfig) => new TenableConnector(config);

