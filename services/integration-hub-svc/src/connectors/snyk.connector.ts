// @ts-nocheck
import { BaseConnector, OAuthTokens, WidgetData, WidgetDefinition } from './base.connector';
import { IntegrationCategory, ExecutiveType } from './base.connector';

export class SnykConnector extends BaseConnector {
  readonly id = 'snyk';
  readonly name = 'Snyk';
  readonly category = IntegrationCategory.SECURITY;
  readonly applicableRoles = [ExecutiveType.CTO, ExecutiveType.CISO];

  readonly oauthConfig = {
    authorizationUrl: 'https://app.snyk.io/oauth2/authorize',
    tokenUrl: 'https://api.snyk.io/oauth2/token',
    clientId: process.env.SNYK_CLIENT_ID || '',
    clientSecret: process.env.SNYK_CLIENT_SECRET || '',
    scopes: ['org.read', 'project.read'],
    scopeSeparator: ' ',
  };

  readonly webhookEnabled = true;

  readonly supportedWidgets: WidgetDefinition[] = [
    {
      id: 'vulnerability-summary',
      name: 'Vulnerability Summary',
      description: 'Security vulnerability counts by severity',
      refreshInterval: 300,
      requiredScopes: ['org.read'],
    },
    {
      id: 'critical-issues',
      name: 'Critical Issues',
      description: 'High/critical vulnerabilities needing attention',
      refreshInterval: 180,
      requiredScopes: ['project.read'],
    },
    {
      id: 'project-health',
      name: 'Project Security Health',
      description: 'Security score by project',
      refreshInterval: 600,
      requiredScopes: ['project.read'],
    },
    {
      id: 'license-issues',
      name: 'License Issues',
      description: 'Open source license compliance',
      refreshInterval: 3600,
      requiredScopes: ['project.read'],
    },
  ];

  getAuthUrl(state: string, scopes?: string[]): string {
    const scopeList = scopes || this.oauthConfig.scopes;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.oauthConfig.clientId,
      redirect_uri: this.getRedirectUri(),
      scope: scopeList.join(this.oauthConfig.scopeSeparator),
      state,
    });
    return `${this.oauthConfig.authorizationUrl}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const response = await this.httpClient.post(this.oauthConfig.tokenUrl, {
      grant_type: 'authorization_code',
      client_id: this.oauthConfig.clientId,
      client_secret: this.oauthConfig.clientSecret,
      code,
      redirect_uri: this.getRedirectUri(),
    });

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + response.data.expires_in);

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt,
      scopes: this.oauthConfig.scopes,
      raw: response.data,
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const response = await this.httpClient.post(this.oauthConfig.tokenUrl, {
      grant_type: 'refresh_token',
      client_id: this.oauthConfig.clientId,
      client_secret: this.oauthConfig.clientSecret,
      refresh_token: refreshToken,
    });

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + response.data.expires_in);

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token || refreshToken,
      expiresAt,
      scopes: this.oauthConfig.scopes,
      raw: response.data,
    };
  }

  async revokeToken(accessToken: string): Promise<void> {
    try {
      await this.httpClient.post('https://api.snyk.io/oauth2/revoke', {
        token: accessToken,
        client_id: this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
      });
    } catch (error) {
      this.logger.warn({ error }, 'Failed to revoke Snyk token');
    }
  }

  async testConnection(tokens: OAuthTokens): Promise<boolean> {
    try {
      await this.fetchData(tokens, '/self');
      return true;
    } catch {
      return false;
    }
  }

  async fetchData(
    tokens: OAuthTokens,
    endpoint: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    return this.makeRequest(tokens, {
      method: 'GET',
      url: `https://api.snyk.io/rest${endpoint}`,
      params: { version: '2024-01-23', ...params },
    });
  }

  async getWidgetData(
    tokens: OAuthTokens,
    widgetId: string,
    params?: Record<string, unknown>
  ): Promise<WidgetData> {
    switch (widgetId) {
      case 'vulnerability-summary':
        return this.getVulnerabilitySummary(tokens, params?.orgId as string);
      case 'critical-issues':
        return this.getCriticalIssues(tokens, params?.orgId as string);
      case 'project-health':
        return this.getProjectHealth(tokens, params?.orgId as string);
      case 'license-issues':
        return this.getLicenseIssues(tokens, params?.orgId as string);
      default:
        throw new Error(`Unknown widget: ${widgetId}`);
    }
  }

  private async getVulnerabilitySummary(tokens: OAuthTokens, orgId?: string): Promise<WidgetData> {
    const org = orgId || (await this.getDefaultOrgId(tokens));
    const issues = (await this.fetchData(tokens, `/orgs/${org}/issues`, {
      limit: 100,
    })) as SnykIssuesResponse;

    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const issue of issues.data || []) {
      const severity = issue.attributes?.effective_severity_level?.toLowerCase() || 'low';
      if (severity in counts) {
        counts[severity as keyof typeof counts]++;
      }
    }

    return {
      widgetId: 'vulnerability-summary',
      data: {
        counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
        trend: 'stable', // Would calculate from historical data
      },
      fetchedAt: new Date(),
    };
  }

  private async getCriticalIssues(tokens: OAuthTokens, orgId?: string): Promise<WidgetData> {
    const org = orgId || (await this.getDefaultOrgId(tokens));
    const issues = (await this.fetchData(tokens, `/orgs/${org}/issues`, {
      severity: 'critical,high',
      limit: 25,
    })) as SnykIssuesResponse;

    const criticalIssues = (issues.data || []).map((issue) => ({
      id: issue.id,
      title: issue.attributes?.title,
      severity: issue.attributes?.effective_severity_level,
      type: issue.attributes?.type,
      project: issue.relationships?.scan_item?.data?.id,
      introducedDate: issue.attributes?.created_at,
      fixAvailable: issue.attributes?.is_fixable,
      cve: issue.attributes?.problems?.[0]?.id,
    }));

    return {
      widgetId: 'critical-issues',
      data: {
        issues: criticalIssues,
        criticalCount: criticalIssues.filter((i) => i.severity === 'critical').length,
        highCount: criticalIssues.filter((i) => i.severity === 'high').length,
      },
      fetchedAt: new Date(),
    };
  }

  private async getProjectHealth(tokens: OAuthTokens, orgId?: string): Promise<WidgetData> {
    const org = orgId || (await this.getDefaultOrgId(tokens));
    const projects = (await this.fetchData(tokens, `/orgs/${org}/projects`, {
      limit: 50,
    })) as SnykProjectsResponse;

    const projectHealth = await Promise.all(
      (projects.data || []).slice(0, 10).map(async (project) => {
        const issues = (await this.fetchData(tokens, `/orgs/${org}/issues`, {
          'scan_item.id': project.id,
          limit: 100,
        })) as SnykIssuesResponse;

        const counts = { critical: 0, high: 0, medium: 0, low: 0 };
        for (const issue of issues.data || []) {
          const severity = issue.attributes?.effective_severity_level?.toLowerCase() || 'low';
          if (severity in counts) counts[severity as keyof typeof counts]++;
        }

        return {
          id: project.id,
          name: project.attributes?.name,
          type: project.attributes?.type,
          lastTest: project.attributes?.settings?.recurring_tests?.frequency,
          vulnerabilities: counts,
          score: this.calculateHealthScore(counts),
        };
      })
    );

    return {
      widgetId: 'project-health',
      data: {
        projects: projectHealth.sort((a, b) => a.score - b.score),
        averageScore: projectHealth.length
          ? Math.round(projectHealth.reduce((sum, p) => sum + p.score, 0) / projectHealth.length)
          : 0,
      },
      fetchedAt: new Date(),
    };
  }

  private async getLicenseIssues(tokens: OAuthTokens, orgId?: string): Promise<WidgetData> {
    const org = orgId || (await this.getDefaultOrgId(tokens));
    const issues = (await this.fetchData(tokens, `/orgs/${org}/issues`, {
      type: 'license',
      limit: 50,
    })) as SnykIssuesResponse;

    const licenseIssues = (issues.data || []).map((issue) => ({
      id: issue.id,
      package: issue.attributes?.title,
      license: issue.attributes?.problems?.[0]?.id,
      severity: issue.attributes?.effective_severity_level,
      project: issue.relationships?.scan_item?.data?.id,
    }));

    const licenseTypes = new Map<string, number>();
    for (const issue of licenseIssues) {
      const current = licenseTypes.get(issue.license || 'Unknown') || 0;
      licenseTypes.set(issue.license || 'Unknown', current + 1);
    }

    return {
      widgetId: 'license-issues',
      data: {
        issues: licenseIssues,
        totalIssues: licenseIssues.length,
        byLicense: Object.fromEntries(licenseTypes),
      },
      fetchedAt: new Date(),
    };
  }

  private async getDefaultOrgId(tokens: OAuthTokens): Promise<string> {
    const self = (await this.fetchData(tokens, '/self')) as SnykSelfResponse;
    return self.data?.attributes?.default_org_context || '';
  }

  private calculateHealthScore(counts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  }): number {
    const weights = { critical: 25, high: 10, medium: 3, low: 1 };
    const penalty =
      counts.critical * weights.critical +
      counts.high * weights.high +
      counts.medium * weights.medium +
      counts.low * weights.low;
    return Math.max(0, 100 - penalty);
  }

  async handleWebhook(
    payload: SnykWebhookPayload,
    signature: string
  ): Promise<{ success: boolean; eventType?: string; data?: unknown; error?: string }> {
    if (!this.verifyWebhookSignature(JSON.stringify(payload), signature)) {
      return { success: false, error: 'Invalid signature' };
    }

    return {
      success: true,
      eventType: payload.type,
      data: { projectId: payload.project?.id, newIssues: payload.newIssues?.length },
    };
  }

  private verifyWebhookSignature(payload: string, signature: string): boolean {
    const crypto = require('crypto');
    const secret = process.env.SNYK_WEBHOOK_SECRET || '';
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return signature === expected;
  }
}

interface SnykIssuesResponse {
  data?: Array<{
    id: string;
    attributes?: {
      title?: string;
      effective_severity_level?: string;
      type?: string;
      created_at?: string;
      is_fixable?: boolean;
      problems?: Array<{ id?: string }>;
    };
    relationships?: {
      scan_item?: { data?: { id?: string } };
    };
  }>;
}

interface SnykProjectsResponse {
  data?: Array<{
    id: string;
    attributes?: {
      name?: string;
      type?: string;
      settings?: {
        recurring_tests?: { frequency?: string };
      };
    };
  }>;
}

interface SnykSelfResponse {
  data?: {
    attributes?: {
      default_org_context?: string;
    };
  };
}

interface SnykWebhookPayload {
  type: string;
  project?: { id?: string };
  newIssues?: unknown[];
}

export const snykConnector = new SnykConnector();

