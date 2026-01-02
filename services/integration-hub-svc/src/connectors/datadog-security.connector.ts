// @ts-nocheck
import { BaseConnector, ConnectorConfig, OAuthConfig } from './base.connector';

// Datadog Security Monitoring Connector
// Provides security signals, cloud posture management, and compliance findings

export interface DatadogSecurityCredentials {
  apiKey: string;
  appKey: string;
  site?: string; // datadoghq.com, datadoghq.eu, etc.
}

export interface SecuritySignal {
  id: string;
  type: string;
  attributes: {
    title: string;
    message: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    status: 'open' | 'under_review' | 'archived';
    source: string;
    timestamp: Date;
    tags: string[];
    host: string;
    service: string;
    rule: {
      id: string;
      name: string;
      version: number;
    };
  };
}

export interface CloudPostureFinding {
  id: string;
  resourceId: string;
  resourceType: string;
  region: string;
  account: string;
  ruleId: string;
  ruleName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'pass' | 'fail' | 'skip';
  framework: string;
  control: string;
  firstSeen: Date;
  lastSeen: Date;
}

export interface ComplianceRule {
  id: string;
  name: string;
  framework: string;
  control: string;
  severity: string;
  resourceType: string;
  passCount: number;
  failCount: number;
  skipCount: number;
}

const DATADOG_API_BASE = 'https://api.datadoghq.com/api';

export class DatadogSecurityConnector extends BaseConnector {
  private credentials: DatadogSecurityCredentials | null = null;
  private apiBase: string = DATADOG_API_BASE;

  constructor(config: ConnectorConfig) {
    super(config);
  }

  get providerId(): string {
    return 'datadog-security';
  }

  get providerName(): string {
    return 'Datadog Security Monitoring';
  }

  get requiredScopes(): string[] {
    return ['security_monitoring_signals_read', 'security_monitoring_rules_read'];
  }

  getOAuthConfig(): OAuthConfig {
    // Datadog uses API keys
    return {
      authorizationUrl: '',
      tokenUrl: '',
      scopes: [],
    };
  }

  async connect(credentials: DatadogSecurityCredentials): Promise<void> {
    this.credentials = credentials;

    if (credentials.site) {
      this.apiBase = `https://api.${credentials.site}/api`;
    }

    // Validate credentials
    await this.validateConnection();
  }

  async disconnect(): Promise<void> {
    this.credentials = null;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.validateConnection();
      return true;
    } catch {
      return false;
    }
  }

  private async validateConnection(): Promise<void> {
    await this.makeRequest('GET', '/v1/validate');
  }

  // Security Signals
  async getSecuritySignals(filters?: {
    severity?: string[];
    status?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }): Promise<SecuritySignal[]> {
    const query: string[] = [];

    if (filters?.severity) {
      query.push(`status:(${filters.severity.join(' OR ')})`);
    }
    if (filters?.status) {
      query.push(`@workflow.state:${filters.status}`);
    }

    const from = filters?.from || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = filters?.to || new Date();

    const body = {
      filter: {
        query: query.join(' '),
        from: from.toISOString(),
        to: to.toISOString(),
      },
      page: {
        limit: filters?.limit || 100,
      },
      sort: 'timestamp',
    };

    const response = await this.makeRequest('POST', '/v2/security_monitoring/signals/search', body);

    return (response.data || []).map(this.mapSecuritySignal);
  }

  async getSecuritySignalsSummary(): Promise<{
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    bySource: Record<string, number>;
    byStatus: Record<string, number>;
    trend: { date: string; count: number }[];
  }> {
    const signals = await this.getSecuritySignals({
      from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    });

    const summary = {
      total: signals.length,
      critical: signals.filter((s) => s.attributes.severity === 'critical').length,
      high: signals.filter((s) => s.attributes.severity === 'high').length,
      medium: signals.filter((s) => s.attributes.severity === 'medium').length,
      low: signals.filter(
        (s) => s.attributes.severity === 'low' || s.attributes.severity === 'info'
      ).length,
      bySource: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      trend: [] as { date: string; count: number }[],
    };

    for (const signal of signals) {
      summary.bySource[signal.attributes.source] =
        (summary.bySource[signal.attributes.source] || 0) + 1;
      summary.byStatus[signal.attributes.status] =
        (summary.byStatus[signal.attributes.status] || 0) + 1;
    }

    // Build trend
    const trendMap = new Map<string, number>();
    for (const signal of signals) {
      const date = signal.attributes.timestamp.toISOString().split('T')[0];
      trendMap.set(date, (trendMap.get(date) || 0) + 1);
    }

    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      summary.trend.push({
        date: dateStr,
        count: trendMap.get(dateStr) || 0,
      });
    }

    return summary;
  }

  // Cloud Security Posture Management
  async getComplianceFindings(filters?: {
    framework?: string;
    severity?: string[];
    status?: 'pass' | 'fail' | 'skip';
  }): Promise<CloudPostureFinding[]> {
    const params: Record<string, string> = {};

    if (filters?.framework) {
      params.framework = filters.framework;
    }
    if (filters?.status) {
      params.status = filters.status;
    }

    const response = await this.makeRequest(
      'GET',
      '/v2/security_monitoring/findings',
      undefined,
      params
    );

    return (response.data || [])
      .filter((finding: Record<string, unknown>) => {
        if (filters?.severity) {
          return filters.severity.includes(
            (finding.attributes as Record<string, unknown>).severity as string
          );
        }
        return true;
      })
      .map(this.mapComplianceFinding);
  }

  async getCloudPosture(): Promise<{
    totalResources: number;
    compliant: number;
    nonCompliant: number;
    byFramework: Record<string, { passed: number; failed: number }>;
    bySeverity: Record<string, number>;
    topFailingRules: Array<{ rule: string; count: number; severity: string }>;
  }> {
    const findings = await this.getComplianceFindings();

    const byFramework: Record<string, { passed: number; failed: number }> = {};
    const bySeverity: Record<string, number> = {};
    const ruleFailCounts: Record<string, { count: number; severity: string }> = {};

    let compliant = 0;
    let nonCompliant = 0;

    for (const finding of findings) {
      // By framework
      if (!byFramework[finding.framework]) {
        byFramework[finding.framework] = { passed: 0, failed: 0 };
      }
      if (finding.status === 'pass') {
        byFramework[finding.framework].passed++;
        compliant++;
      } else if (finding.status === 'fail') {
        byFramework[finding.framework].failed++;
        nonCompliant++;

        // Track failing rules
        if (!ruleFailCounts[finding.ruleName]) {
          ruleFailCounts[finding.ruleName] = { count: 0, severity: finding.severity };
        }
        ruleFailCounts[finding.ruleName].count++;
      }

      // By severity
      bySeverity[finding.severity] = (bySeverity[finding.severity] || 0) + 1;
    }

    const topFailingRules = Object.entries(ruleFailCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([rule, data]) => ({
        rule,
        count: data.count,
        severity: data.severity,
      }));

    return {
      totalResources: findings.length,
      compliant,
      nonCompliant,
      byFramework,
      bySeverity,
      topFailingRules,
    };
  }

  // Security Rules
  async getSecurityRules(): Promise<ComplianceRule[]> {
    const response = await this.makeRequest('GET', '/v2/security_monitoring/rules');

    return (response.data || []).map((rule: Record<string, unknown>) => {
      const attrs = rule.attributes as Record<string, unknown>;
      return {
        id: rule.id as string,
        name: attrs.name as string,
        framework:
          (attrs.tags as string[])
            ?.find((t: string) => t.startsWith('framework:'))
            ?.split(':')[1] || 'custom',
        control:
          (attrs.tags as string[])?.find((t: string) => t.startsWith('control:'))?.split(':')[1] ||
          '',
        severity: (attrs.severity as string) || 'medium',
        resourceType: ((attrs.filters as Record<string, unknown>)?.resource_type as string) || '',
        passCount: 0,
        failCount: 0,
        skipCount: 0,
      };
    });
  }

  // Widget Data Methods
  async getWidgetData(widgetType: string): Promise<unknown> {
    switch (widgetType) {
      case 'security-signals':
        return this.getSecuritySignalsSummary();

      case 'cloud-security':
        return this.getCloudPosture();

      case 'recent-signals':
        return {
          signals: await this.getSecuritySignals({ limit: 20 }),
        };

      case 'compliance-rules':
        return {
          rules: await this.getSecurityRules(),
        };

      default:
        throw new Error(`Unknown widget type: ${widgetType}`);
    }
  }

  // Private helper methods
  private async makeRequest(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>,
    params?: Record<string, string>
  ): Promise<Record<string, unknown>> {
    if (!this.credentials) {
      throw new Error('Not connected to Datadog');
    }

    let url = `${this.apiBase}${endpoint}`;

    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const response = await fetch(url, {
      method,
      headers: {
        'DD-API-KEY': this.credentials.apiKey,
        'DD-APPLICATION-KEY': this.credentials.appKey,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Datadog API error: ${response.status}`);
    }

    return response.json();
  }

  private mapSecuritySignal = (signal: Record<string, unknown>): SecuritySignal => {
    const attrs = signal.attributes as Record<string, unknown>;
    return {
      id: signal.id as string,
      type: signal.type as string,
      attributes: {
        title: (attrs.title as string) || '',
        message: (attrs.message as string) || '',
        severity: this.normalizeSeverity(attrs.severity as string),
        status: ((attrs.status as string) || 'open') as SecuritySignal['attributes']['status'],
        source: (attrs.source as string) || '',
        timestamp: new Date(attrs.timestamp as string),
        tags: (attrs.tags as string[]) || [],
        host: (attrs.host as string) || '',
        service: (attrs.service as string) || '',
        rule: {
          id: ((attrs.rule as Record<string, unknown>)?.id as string) || '',
          name: ((attrs.rule as Record<string, unknown>)?.name as string) || '',
          version: ((attrs.rule as Record<string, unknown>)?.version as number) || 0,
        },
      },
    };
  };

  private mapComplianceFinding = (finding: Record<string, unknown>): CloudPostureFinding => {
    const attrs = finding.attributes as Record<string, unknown>;
    return {
      id: finding.id as string,
      resourceId: (attrs.resource_id as string) || '',
      resourceType: (attrs.resource_type as string) || '',
      region: (attrs.region as string) || '',
      account: (attrs.account_id as string) || '',
      ruleId: (attrs.rule_id as string) || '',
      ruleName: (attrs.rule_name as string) || '',
      severity: this.normalizeSeverity(attrs.severity as string),
      status: (attrs.status as CloudPostureFinding['status']) || 'fail',
      framework: (attrs.framework as string) || '',
      control: (attrs.control as string) || '',
      firstSeen: new Date(attrs.first_seen as string),
      lastSeen: new Date(attrs.last_seen as string),
    };
  };

  private normalizeSeverity(severity: string): SecuritySignal['attributes']['severity'] {
    const s = severity?.toLowerCase() || 'info';
    if (s === 'critical') return 'critical';
    if (s === 'high') return 'high';
    if (s === 'medium') return 'medium';
    if (s === 'low') return 'low';
    return 'info';
  }
}

export const createDatadogSecurityConnector = (config: ConnectorConfig) =>
  new DatadogSecurityConnector(config);

