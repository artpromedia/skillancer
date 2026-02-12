// @ts-nocheck
import { BaseConnector, ConnectorConfig, OAuthConfig } from './base.connector';

// CrowdStrike Falcon Connector
// Provides endpoint protection, threat detection, and incident management

export interface CrowdStrikeCredentials {
  clientId: string;
  clientSecret: string;
  baseUrl?: string;
}

export interface CrowdStrikeHost {
  deviceId: string;
  hostname: string;
  platform: string;
  osVersion: string;
  agentVersion: string;
  status: 'online' | 'offline';
  lastSeen: Date;
  externalIp: string;
  localIp: string;
  groupTags: string[];
  policyType: string;
}

export interface CrowdStrikeDetection {
  detectionId: string;
  hostId: string;
  hostname: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  tactic: string;
  technique: string;
  status: 'new' | 'in_progress' | 'true_positive' | 'false_positive' | 'closed';
  timestamp: Date;
  description: string;
  behaviors: CrowdStrikeBehavior[];
}

export interface CrowdStrikeBehavior {
  behaviorId: string;
  filename: string;
  filepath: string;
  cmdLine: string;
  sha256: string;
  ioc: string;
  patternId: string;
}

export interface CrowdStrikeIncident {
  incidentId: string;
  hostIds: string[];
  state: 'open' | 'reopened' | 'closed';
  severity: number;
  tactics: string[];
  techniques: string[];
  objectives: string[];
  createdTime: Date;
  endTime: Date | null;
  assignedTo: string | null;
}

export interface PreventionStats {
  totalPrevented: number;
  last24Hours: number;
  last7Days: number;
  byType: Record<string, number>;
}

const API_REGIONS: Record<string, string> = {
  us1: 'https://api.crowdstrike.com',
  us2: 'https://api.us-2.crowdstrike.com',
  eu1: 'https://api.eu-1.crowdstrike.com',
  gov: 'https://api.laggar.gcw.crowdstrike.com',
};

export class CrowdStrikeConnector extends BaseConnector {
  private credentials: CrowdStrikeCredentials | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private baseUrl: string = API_REGIONS.us1;

  constructor(config: ConnectorConfig) {
    super(config);
  }

  get providerId(): string {
    return 'crowdstrike';
  }

  get providerName(): string {
    return 'CrowdStrike Falcon';
  }

  get requiredScopes(): string[] {
    return ['detections:read', 'hosts:read', 'incidents:read', 'prevention-policies:read'];
  }

  getOAuthConfig(): OAuthConfig {
    return {
      authorizationUrl: `${this.baseUrl}/oauth2/authorize`,
      tokenUrl: `${this.baseUrl}/oauth2/token`,
      scopes: this.requiredScopes,
    };
  }

  async connect(credentials: CrowdStrikeCredentials): Promise<void> {
    this.credentials = credentials;
    if (credentials.baseUrl) {
      this.baseUrl = credentials.baseUrl;
    }
    await this.authenticate();
  }

  async disconnect(): Promise<void> {
    if (this.accessToken) {
      await this.revokeToken();
    }
    this.credentials = null;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.ensureAuthenticated();
      await this.makeRequest('GET', '/sensors/queries/sensors/v1?limit=1');
      return true;
    } catch {
      return false;
    }
  }

  // Host Management
  async getHosts(filters?: {
    status?: 'online' | 'offline';
    platform?: string;
    lastSeenAfter?: Date;
  }): Promise<CrowdStrikeHost[]> {
    const query: string[] = [];

    if (filters?.status) {
      query.push(`status:'${filters.status}'`);
    }
    if (filters?.platform) {
      query.push(`platform_name:'${filters.platform}'`);
    }
    if (filters?.lastSeenAfter) {
      query.push(`last_seen:>='${filters.lastSeenAfter.toISOString()}'`);
    }

    const filter = query.length > 0 ? `?filter=${encodeURIComponent(query.join('+'))}` : '';
    const idsResponse = await this.makeRequest(
      'GET',
      `/devices/queries/devices/v1${filter}&limit=500`
    );

    if (!idsResponse.resources?.length) {
      return [];
    }

    const detailsResponse = await this.makeRequest('POST', '/devices/entities/devices/v2', {
      ids: idsResponse.resources,
    });

    return (detailsResponse.resources || []).map(this.mapHost);
  }

  async getHostHealth(): Promise<{
    total: number;
    online: number;
    offline: number;
    byPlatform: Record<string, number>;
    sensorVersions: Record<string, number>;
  }> {
    const hosts = await this.getHosts();

    const byPlatform: Record<string, number> = {};
    const sensorVersions: Record<string, number> = {};
    let online = 0;
    let offline = 0;

    for (const host of hosts) {
      if (host.status === 'online') online++;
      else offline++;

      byPlatform[host.platform] = (byPlatform[host.platform] || 0) + 1;
      sensorVersions[host.agentVersion] = (sensorVersions[host.agentVersion] || 0) + 1;
    }

    return {
      total: hosts.length,
      online,
      offline,
      byPlatform,
      sensorVersions,
    };
  }

  // Detection Management
  async getDetections(filters?: {
    severity?: string[];
    status?: string;
    startDate?: Date;
  }): Promise<CrowdStrikeDetection[]> {
    const query: string[] = [];

    if (filters?.severity) {
      query.push(`severity:[${filters.severity.map((s) => `'${s}'`).join(' ')}]`);
    }
    if (filters?.status) {
      query.push(`status:'${filters.status}'`);
    }
    if (filters?.startDate) {
      query.push(`created_timestamp:>='${filters.startDate.toISOString()}'`);
    }

    const filter = query.length > 0 ? `?filter=${encodeURIComponent(query.join('+'))}` : '';
    const idsResponse = await this.makeRequest(
      'GET',
      `/detects/queries/detects/v1${filter}&limit=100`
    );

    if (!idsResponse.resources?.length) {
      return [];
    }

    const detailsResponse = await this.makeRequest('POST', '/detects/entities/summaries/GET/v1', {
      ids: idsResponse.resources,
    });

    return (detailsResponse.resources || []).map(this.mapDetection);
  }

  async getDetectionSummary(): Promise<{
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    newDetections: number;
    inProgress: number;
    trend: { date: string; count: number }[];
  }> {
    const detections = await this.getDetections({
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    });

    const summary = {
      total: detections.length,
      critical: detections.filter((d) => d.severity === 'critical').length,
      high: detections.filter((d) => d.severity === 'high').length,
      medium: detections.filter((d) => d.severity === 'medium').length,
      low: detections.filter((d) => d.severity === 'low' || d.severity === 'informational').length,
      newDetections: detections.filter((d) => d.status === 'new').length,
      inProgress: detections.filter((d) => d.status === 'in_progress').length,
      trend: [] as { date: string; count: number }[],
    };

    // Build trend data
    const trendMap = new Map<string, number>();
    for (const detection of detections) {
      const date = detection.timestamp.toISOString().split('T')[0];
      trendMap.set(date, (trendMap.get(date) || 0) + 1);
    }

    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      summary.trend.push({
        date: dateStr,
        count: trendMap.get(dateStr) || 0,
      });
    }

    return summary;
  }

  // Incident Management
  async getIncidents(filters?: {
    state?: string;
    startDate?: Date;
  }): Promise<CrowdStrikeIncident[]> {
    const query: string[] = [];

    if (filters?.state) {
      query.push(`state:'${filters.state}'`);
    }
    if (filters?.startDate) {
      query.push(`start:>='${filters.startDate.toISOString()}'`);
    }

    const filter = query.length > 0 ? `?filter=${encodeURIComponent(query.join('+'))}` : '';
    const idsResponse = await this.makeRequest(
      'GET',
      `/incidents/queries/incidents/v1${filter}&limit=100`
    );

    if (!idsResponse.resources?.length) {
      return [];
    }

    const detailsResponse = await this.makeRequest('POST', '/incidents/entities/incidents/GET/v1', {
      ids: idsResponse.resources,
    });

    return (detailsResponse.resources || []).map(this.mapIncident);
  }

  // Prevention Statistics
  async getPreventionStats(): Promise<PreventionStats> {
    // Query prevented detections
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const detections = await this.getDetections({ startDate: last7d });
    const prevented = detections.filter(
      (d) => d.status === 'closed' && d.severity !== 'informational'
    );

    const byType: Record<string, number> = {};
    for (const d of prevented) {
      byType[d.tactic] = (byType[d.tactic] || 0) + 1;
    }

    return {
      totalPrevented: prevented.length,
      last24Hours: prevented.filter((d) => d.timestamp > last24h).length,
      last7Days: prevented.length,
      byType,
    };
  }

  // Widget Data Methods
  async getWidgetData(widgetType: string): Promise<unknown> {
    switch (widgetType) {
      case 'endpoint-protection':
        return this.getHostHealth();

      case 'threat-detections':
        return this.getDetectionSummary();

      case 'host-health':
        return this.getHostHealth();

      case 'prevention-stats':
        return this.getPreventionStats();

      case 'active-incidents':
        return {
          incidents: await this.getIncidents({ state: 'open' }),
        };

      default:
        throw new Error(`Unknown widget type: ${widgetType}`);
    }
  }

  // Private helper methods
  private async authenticate(): Promise<void> {
    if (!this.credentials) {
      throw new Error('No credentials provided');
    }

    const response = await fetch(`${this.baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiry || this.tokenExpiry < new Date()) {
      await this.authenticate();
    }
  }

  private async revokeToken(): Promise<void> {
    if (!this.accessToken) return;

    await fetch(`${this.baseUrl}/oauth2/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: new URLSearchParams({ token: this.accessToken }),
    });
  }

  private async makeRequest(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    await this.ensureAuthenticated();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`CrowdStrike API error: ${response.status}`);
    }

    return response.json();
  }

  private mapHost = (host: Record<string, unknown>): CrowdStrikeHost => ({
    deviceId: host.device_id as string,
    hostname: host.hostname as string,
    platform: host.platform_name as string,
    osVersion: host.os_version as string,
    agentVersion: host.agent_version as string,
    status: host.status as 'online' | 'offline',
    lastSeen: new Date(host.last_seen as string),
    externalIp: host.external_ip as string,
    localIp: host.local_ip as string,
    groupTags: (host.groups as string[]) || [],
    policyType: (host.policies?.[0]?.policy_type as string) || '',
  });

  private mapDetection = (detection: Record<string, unknown>): CrowdStrikeDetection => ({
    detectionId: detection.detection_id as string,
    hostId: detection.device?.device_id as string,
    hostname: detection.device?.hostname as string,
    severity: this.mapSeverity(detection.max_severity as number),
    tactic: (detection.behaviors?.[0]?.tactic as string) || '',
    technique: (detection.behaviors?.[0]?.technique as string) || '',
    status: (detection.status as string) || 'new',
    timestamp: new Date(detection.created_timestamp as string),
    description: (detection.behaviors?.[0]?.description as string) || '',
    behaviors: ((detection.behaviors as unknown[]) || []).map((b: Record<string, unknown>) => ({
      behaviorId: b.behavior_id as string,
      filename: b.filename as string,
      filepath: b.filepath as string,
      cmdLine: b.cmdline as string,
      sha256: b.sha256 as string,
      ioc: b.ioc_value as string,
      patternId: b.pattern_id as string,
    })),
  });

  private mapIncident = (incident: Record<string, unknown>): CrowdStrikeIncident => ({
    incidentId: incident.incident_id as string,
    hostIds: (incident.hosts as { device_id: string }[])?.map((h) => h.device_id) || [],
    state: incident.state as 'open' | 'reopened' | 'closed',
    severity: incident.fine_score as number,
    tactics: (incident.tactics as string[]) || [],
    techniques: (incident.techniques as string[]) || [],
    objectives: (incident.objectives as string[]) || [],
    createdTime: new Date(incident.start as string),
    endTime: incident.end ? new Date(incident.end as string) : null,
    assignedTo: (incident.assigned_to_uid as string) || null,
  });

  private mapSeverity(score: number): CrowdStrikeDetection['severity'] {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'informational';
  }
}

export const createCrowdStrikeConnector = (config: ConnectorConfig) =>
  new CrowdStrikeConnector(config);
