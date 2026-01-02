// @ts-nocheck
import { BaseConnector, ConnectorConfig, OAuthConfig } from './base.connector';

// Google Cloud Security Command Center Connector
// Provides security findings, asset inventory, and security marks

export interface GCPSecurityCredentials {
  projectId: string;
  organizationId: string;
  serviceAccountKey: string; // JSON key file content
}

export interface GCPSecurityFinding {
  name: string;
  parent: string;
  resourceName: string;
  state: 'ACTIVE' | 'INACTIVE';
  category: string;
  externalUri: string;
  sourceProperties: Record<string, unknown>;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  findingClass: 'THREAT' | 'VULNERABILITY' | 'MISCONFIGURATION' | 'OBSERVATION';
  createTime: Date;
  eventTime: Date;
  description: string;
  recommendation: string;
}

export interface GCPAsset {
  name: string;
  securityCenterProperties: {
    resourceName: string;
    resourceType: string;
    resourceParent: string;
    resourceProject: string;
  };
  resourceProperties: Record<string, unknown>;
  securityMarks: Record<string, string>;
  createTime: Date;
  updateTime: Date;
}

export interface GCPSecurityMark {
  name: string;
  marks: Record<string, string>;
}

const GCP_SCC_API_BASE = 'https://securitycenter.googleapis.com/v1';

export class GCPSecurityConnector extends BaseConnector {
  private credentials: GCPSecurityCredentials | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config: ConnectorConfig) {
    super(config);
  }

  get providerId(): string {
    return 'gcp-security';
  }

  get providerName(): string {
    return 'Google Cloud Security Command Center';
  }

  get requiredScopes(): string[] {
    return ['https://www.googleapis.com/auth/cloud-platform'];
  }

  getOAuthConfig(): OAuthConfig {
    return {
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: this.requiredScopes,
    };
  }

  async connect(credentials: GCPSecurityCredentials): Promise<void> {
    this.credentials = credentials;
    await this.authenticate();
    // Validate by listing sources
    await this.getSources();
  }

  async disconnect(): Promise<void> {
    this.credentials = null;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.ensureAuthenticated();
      await this.getSources();
      return true;
    } catch {
      return false;
    }
  }

  // Sources
  async getSources(): Promise<Array<{ name: string; displayName: string; description: string }>> {
    const response = await this.makeRequest(
      'GET',
      `/organizations/${this.credentials?.organizationId}/sources`
    );

    return (response.sources || []).map((source: Record<string, unknown>) => ({
      name: source.name,
      displayName: source.displayName,
      description: source.description || '',
    }));
  }

  // Findings
  async getFindings(filters?: {
    state?: 'ACTIVE' | 'INACTIVE';
    severity?: string[];
    category?: string;
    findingClass?: string;
  }): Promise<GCPSecurityFinding[]> {
    const filterParts: string[] = [];

    if (filters?.state) {
      filterParts.push(`state="${filters.state}"`);
    }
    if (filters?.severity) {
      filterParts.push(`severity="${filters.severity.join('" OR severity="')}"`);
    }
    if (filters?.category) {
      filterParts.push(`category="${filters.category}"`);
    }
    if (filters?.findingClass) {
      filterParts.push(`findingClass="${filters.findingClass}"`);
    }

    const filter =
      filterParts.length > 0 ? `?filter=${encodeURIComponent(filterParts.join(' AND '))}` : '';

    const response = await this.makeRequest(
      'GET',
      `/organizations/${this.credentials?.organizationId}/sources/-/findings${filter}`
    );

    return (response.listFindingsResults || []).map(
      (result: { finding: Record<string, unknown> }) => this.mapFinding(result.finding)
    );
  }

  async getFindingsSummary(): Promise<{
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    byCategory: Record<string, number>;
    byClass: Record<string, number>;
    trend: { date: string; count: number }[];
  }> {
    const findings = await this.getFindings({ state: 'ACTIVE' });

    const summary = {
      total: findings.length,
      critical: findings.filter((f) => f.severity === 'CRITICAL').length,
      high: findings.filter((f) => f.severity === 'HIGH').length,
      medium: findings.filter((f) => f.severity === 'MEDIUM').length,
      low: findings.filter((f) => f.severity === 'LOW').length,
      byCategory: {} as Record<string, number>,
      byClass: {} as Record<string, number>,
      trend: [] as { date: string; count: number }[],
    };

    for (const finding of findings) {
      summary.byCategory[finding.category] = (summary.byCategory[finding.category] || 0) + 1;
      summary.byClass[finding.findingClass] = (summary.byClass[finding.findingClass] || 0) + 1;
    }

    // Build trend
    const trendMap = new Map<string, number>();
    for (const finding of findings) {
      const date = finding.createTime.toISOString().split('T')[0];
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

  // Assets
  async getAssets(filters?: { resourceType?: string; projectId?: string }): Promise<GCPAsset[]> {
    const filterParts: string[] = [];

    if (filters?.resourceType) {
      filterParts.push(`securityCenterProperties.resourceType="${filters.resourceType}"`);
    }
    if (filters?.projectId) {
      filterParts.push(`securityCenterProperties.resourceProject="${filters.projectId}"`);
    }

    const filter =
      filterParts.length > 0 ? `?filter=${encodeURIComponent(filterParts.join(' AND '))}` : '';

    const response = await this.makeRequest(
      'GET',
      `/organizations/${this.credentials?.organizationId}/assets${filter}`
    );

    return (response.listAssetsResults || []).map((result: { asset: Record<string, unknown> }) =>
      this.mapAsset(result.asset)
    );
  }

  async getAssetsSummary(): Promise<{
    total: number;
    byType: Record<string, number>;
    byProject: Record<string, number>;
    withFindings: number;
  }> {
    const assets = await this.getAssets();
    const findings = await this.getFindings({ state: 'ACTIVE' });

    const resourcesWithFindings = new Set(findings.map((f) => f.resourceName));

    const summary = {
      total: assets.length,
      byType: {} as Record<string, number>,
      byProject: {} as Record<string, number>,
      withFindings: 0,
    };

    for (const asset of assets) {
      const type = asset.securityCenterProperties.resourceType;
      const project = asset.securityCenterProperties.resourceProject;

      summary.byType[type] = (summary.byType[type] || 0) + 1;
      summary.byProject[project] = (summary.byProject[project] || 0) + 1;

      if (resourcesWithFindings.has(asset.name)) {
        summary.withFindings++;
      }
    }

    return summary;
  }

  // Security Marks
  async getSecurityMarks(resourceName: string): Promise<GCPSecurityMark> {
    const response = await this.makeRequest('GET', `${resourceName}/securityMarks`);

    return {
      name: response.name as string,
      marks: (response.marks as Record<string, string>) || {},
    };
  }

  async updateSecurityMarks(
    resourceName: string,
    marks: Record<string, string>
  ): Promise<GCPSecurityMark> {
    const response = await this.makeRequest('PATCH', `${resourceName}/securityMarks`, { marks });

    return {
      name: response.name as string,
      marks: (response.marks as Record<string, string>) || {},
    };
  }

  // Widget Data Methods
  async getWidgetData(widgetType: string): Promise<unknown> {
    switch (widgetType) {
      case 'findings-summary':
        return this.getFindingsSummary();

      case 'assets-summary':
        return this.getAssetsSummary();

      case 'threats':
        return this.getFindings({ findingClass: 'THREAT', state: 'ACTIVE' });

      case 'vulnerabilities':
        return this.getFindings({ findingClass: 'VULNERABILITY', state: 'ACTIVE' });

      case 'misconfigurations':
        return this.getFindings({ findingClass: 'MISCONFIGURATION', state: 'ACTIVE' });

      default:
        throw new Error(`Unknown widget type: ${widgetType}`);
    }
  }

  // Private helper methods
  private async authenticate(): Promise<void> {
    if (!this.credentials) {
      throw new Error('No credentials provided');
    }

    // Parse service account key
    const serviceAccount = JSON.parse(this.credentials.serviceAccountKey);

    // Create JWT for service account authentication
    const now = Math.floor(Date.now() / 1000);
    const jwt = await this.createServiceAccountJWT(serviceAccount, now);

    // Exchange JWT for access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);
  }

  private async createServiceAccountJWT(
    serviceAccount: { client_email: string; private_key: string },
    now: number
  ): Promise<string> {
    // In production, use proper JWT library with RS256 signing
    // This is a simplified placeholder
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const payload = {
      iss: serviceAccount.client_email,
      scope: this.requiredScopes.join(' '),
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };

    // Would need crypto library for actual signing
    return `${btoa(JSON.stringify(header))}.${btoa(JSON.stringify(payload))}.signature`;
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiry || this.tokenExpiry < new Date()) {
      await this.authenticate();
    }
  }

  private async makeRequest(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    await this.ensureAuthenticated();

    const url = endpoint.startsWith('http') ? endpoint : `${GCP_SCC_API_BASE}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`GCP Security Command Center API error: ${response.status}`);
    }

    return response.json();
  }

  private mapFinding = (finding: Record<string, unknown>): GCPSecurityFinding => ({
    name: finding.name as string,
    parent: finding.parent as string,
    resourceName: finding.resourceName as string,
    state: finding.state as GCPSecurityFinding['state'],
    category: finding.category as string,
    externalUri: (finding.externalUri as string) || '',
    sourceProperties: (finding.sourceProperties as Record<string, unknown>) || {},
    severity: (finding.severity as GCPSecurityFinding['severity']) || 'LOW',
    findingClass: (finding.findingClass as GCPSecurityFinding['findingClass']) || 'OBSERVATION',
    createTime: new Date(finding.createTime as string),
    eventTime: new Date(finding.eventTime as string),
    description: (finding.description as string) || '',
    recommendation: (finding.nextSteps as string) || '',
  });

  private mapAsset = (asset: Record<string, unknown>): GCPAsset => ({
    name: asset.name as string,
    securityCenterProperties: {
      resourceName: (asset.securityCenterProperties as Record<string, string>)?.resourceName || '',
      resourceType: (asset.securityCenterProperties as Record<string, string>)?.resourceType || '',
      resourceParent:
        (asset.securityCenterProperties as Record<string, string>)?.resourceParent || '',
      resourceProject:
        (asset.securityCenterProperties as Record<string, string>)?.resourceProject || '',
    },
    resourceProperties: (asset.resourceProperties as Record<string, unknown>) || {},
    securityMarks: (asset.securityMarks as { marks: Record<string, string> })?.marks || {},
    createTime: new Date(asset.createTime as string),
    updateTime: new Date(asset.updateTime as string),
  });
}

export const createGCPSecurityConnector = (config: ConnectorConfig) =>
  new GCPSecurityConnector(config);

