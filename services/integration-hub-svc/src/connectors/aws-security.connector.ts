// @ts-nocheck
import { BaseConnector, ConnectorConfig, OAuthConfig } from './base.connector';

// AWS Security Hub Connector
// Provides security findings, compliance status, and security score

export interface AWSSecurityCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  roleArn?: string;
}

export interface SecurityFinding {
  id: string;
  productArn: string;
  generatorId: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
  normalizedSeverity: number;
  resourceType: string;
  resourceId: string;
  resourceRegion: string;
  complianceStatus?: 'PASSED' | 'FAILED' | 'WARNING' | 'NOT_AVAILABLE';
  workflowState: 'NEW' | 'NOTIFIED' | 'RESOLVED' | 'SUPPRESSED';
  recordState: 'ACTIVE' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
  remediation?: {
    recommendation: string;
    url?: string;
  };
}

export interface ComplianceStandard {
  standardArn: string;
  name: string;
  description: string;
  enabledDate: Date;
  status: 'PENDING' | 'READY' | 'FAILED' | 'DELETING' | 'INCOMPLETE';
  securityScore: number;
  controlsPassed: number;
  controlsFailed: number;
  controlsTotal: number;
}

export interface SecurityScore {
  overallScore: number;
  standardScores: {
    standardName: string;
    score: number;
    criticalFindings: number;
  }[];
  trend: { date: string; score: number }[];
}

const SECURITY_HUB_STANDARDS = {
  CIS: 'arn:aws:securityhub:::ruleset/cis-aws-foundations-benchmark/v/1.2.0',
  PCI_DSS: 'arn:aws:securityhub:::ruleset/pci-dss/v/3.2.1',
  AWS_BEST_PRACTICES:
    'arn:aws:securityhub:::ruleset/aws-foundational-security-best-practices/v/1.0.0',
};

export class AWSSecurityConnector extends BaseConnector {
  private credentials: AWSSecurityCredentials | null = null;

  constructor(config: ConnectorConfig) {
    super(config);
  }

  get providerId(): string {
    return 'aws-security';
  }

  get providerName(): string {
    return 'AWS Security Hub';
  }

  get requiredScopes(): string[] {
    return [
      'securityhub:GetFindings',
      'securityhub:GetSecurityScore',
      'securityhub:GetEnabledStandards',
    ];
  }

  getOAuthConfig(): OAuthConfig {
    // AWS uses IAM credentials, not OAuth
    return {
      authorizationUrl: '',
      tokenUrl: '',
      scopes: [],
    };
  }

  async connect(credentials: AWSSecurityCredentials): Promise<void> {
    this.credentials = credentials;
    // Validate credentials with a simple API call
    await this.makeRequest('GetEnabledStandards', {});
  }

  async disconnect(): Promise<void> {
    this.credentials = null;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('GetEnabledStandards', {});
      return true;
    } catch {
      return false;
    }
  }

  // Findings Management
  async getFindings(filters?: {
    severity?: string[];
    complianceStatus?: string;
    resourceType?: string;
    workflowState?: string;
    maxResults?: number;
  }): Promise<SecurityFinding[]> {
    const apiFilters: Record<string, { Value: string; Comparison: string }[]> = {};

    if (filters?.severity) {
      apiFilters.SeverityLabel = filters.severity.map((s) => ({
        Value: s,
        Comparison: 'EQUALS',
      }));
    }

    if (filters?.complianceStatus) {
      apiFilters['Compliance.Status'] = [
        {
          Value: filters.complianceStatus,
          Comparison: 'EQUALS',
        },
      ];
    }

    if (filters?.resourceType) {
      apiFilters.ResourceType = [
        {
          Value: filters.resourceType,
          Comparison: 'EQUALS',
        },
      ];
    }

    if (filters?.workflowState) {
      apiFilters.WorkflowState = [
        {
          Value: filters.workflowState,
          Comparison: 'EQUALS',
        },
      ];
    }

    // Only get active findings by default
    apiFilters.RecordState = [{ Value: 'ACTIVE', Comparison: 'EQUALS' }];

    const response = await this.makeRequest('GetFindings', {
      Filters: apiFilters,
      MaxResults: filters?.maxResults || 100,
    });

    return (response.Findings || []).map(this.mapFinding);
  }

  async getFindingsSummary(): Promise<{
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    byResourceType: Record<string, number>;
    byProduct: Record<string, number>;
    trend: { date: string; count: number }[];
  }> {
    const findings = await this.getFindings({ maxResults: 500 });

    const summary = {
      total: findings.length,
      critical: findings.filter((f) => f.severity === 'CRITICAL').length,
      high: findings.filter((f) => f.severity === 'HIGH').length,
      medium: findings.filter((f) => f.severity === 'MEDIUM').length,
      low: findings.filter((f) => f.severity === 'LOW' || f.severity === 'INFORMATIONAL').length,
      byResourceType: {} as Record<string, number>,
      byProduct: {} as Record<string, number>,
      trend: [] as { date: string; count: number }[],
    };

    for (const finding of findings) {
      summary.byResourceType[finding.resourceType] =
        (summary.byResourceType[finding.resourceType] || 0) + 1;

      const product = finding.productArn.split('/').pop() || 'Unknown';
      summary.byProduct[product] = (summary.byProduct[product] || 0) + 1;
    }

    // Build trend from finding creation dates
    const trendMap = new Map<string, number>();
    for (const finding of findings) {
      const date = finding.createdAt.toISOString().split('T')[0];
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

  // Security Score
  async getSecurityScore(): Promise<SecurityScore> {
    const standards = await this.getEnabledStandards();

    const standardScores = standards.map((standard) => ({
      standardName: standard.name,
      score: standard.securityScore,
      criticalFindings: 0, // Would need additional API call
    }));

    const overallScore =
      standardScores.length > 0
        ? standardScores.reduce((sum, s) => sum + s.score, 0) / standardScores.length
        : 0;

    // Generate trend data (would need historical data in production)
    const trend: { date: string; score: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      trend.push({
        date: date.toISOString().split('T')[0],
        score: Math.max(0, Math.min(100, overallScore + Math.random() * 10 - 5)),
      });
    }

    return {
      overallScore,
      standardScores,
      trend,
    };
  }

  // Compliance Standards
  async getEnabledStandards(): Promise<ComplianceStandard[]> {
    const response = await this.makeRequest('GetEnabledStandards', {});

    const standards: ComplianceStandard[] = [];

    for (const standard of response.StandardsSubscriptions || []) {
      // Get control status for each standard
      const controlsResponse = await this.makeRequest('DescribeStandardsControls', {
        StandardsSubscriptionArn: standard.StandardsSubscriptionArn,
      });

      const controls = controlsResponse.Controls || [];
      const passed = controls.filter(
        (c: { ControlStatus: string }) => c.ControlStatus === 'PASSED'
      ).length;
      const failed = controls.filter(
        (c: { ControlStatus: string }) => c.ControlStatus === 'FAILED'
      ).length;

      standards.push({
        standardArn: standard.StandardsArn,
        name: this.getStandardName(standard.StandardsArn),
        description: standard.StandardsInput?.Description || '',
        enabledDate: new Date(standard.StandardsStatus?.StatusChangeDate || Date.now()),
        status: standard.StandardsStatus?.Status || 'READY',
        securityScore: controls.length > 0 ? (passed / controls.length) * 100 : 0,
        controlsPassed: passed,
        controlsFailed: failed,
        controlsTotal: controls.length,
      });
    }

    return standards;
  }

  async getComplianceStatus(standardArn?: string): Promise<
    {
      standard: string;
      status: string;
      score: number;
      passed: number;
      failed: number;
      total: number;
      failedControls: Array<{ id: string; title: string; severity: string }>;
    }[]
  > {
    const standards = await this.getEnabledStandards();
    const filteredStandards = standardArn
      ? standards.filter((s) => s.standardArn === standardArn)
      : standards;

    const results = [];

    for (const standard of filteredStandards) {
      const controlsResponse = await this.makeRequest('DescribeStandardsControls', {
        StandardsSubscriptionArn: standard.standardArn,
      });

      const failedControls = (controlsResponse.Controls || [])
        .filter((c: { ControlStatus: string }) => c.ControlStatus === 'FAILED')
        .map((c: { ControlId: string; Title: string; SeverityRating: string }) => ({
          id: c.ControlId,
          title: c.Title,
          severity: c.SeverityRating,
        }));

      results.push({
        standard: standard.name,
        status: standard.status,
        score: standard.securityScore,
        passed: standard.controlsPassed,
        failed: standard.controlsFailed,
        total: standard.controlsTotal,
        failedControls,
      });
    }

    return results;
  }

  // Resource Compliance
  async getResourceCompliance(): Promise<{
    compliant: number;
    nonCompliant: number;
    byResourceType: Record<string, { compliant: number; nonCompliant: number }>;
  }> {
    const findings = await this.getFindings({ complianceStatus: 'FAILED' });

    const byResourceType: Record<string, { compliant: number; nonCompliant: number }> = {};

    for (const finding of findings) {
      if (!byResourceType[finding.resourceType]) {
        byResourceType[finding.resourceType] = { compliant: 0, nonCompliant: 0 };
      }
      byResourceType[finding.resourceType].nonCompliant++;
    }

    return {
      compliant: 0, // Would need separate query
      nonCompliant: findings.length,
      byResourceType,
    };
  }

  // Widget Data Methods
  async getWidgetData(widgetType: string): Promise<unknown> {
    switch (widgetType) {
      case 'security-score':
        return this.getSecurityScore();

      case 'findings-summary':
        return this.getFindingsSummary();

      case 'compliance-status':
        return this.getComplianceStatus();

      case 'guardrails-status':
        return this.getResourceCompliance();

      default:
        throw new Error(`Unknown widget type: ${widgetType}`);
    }
  }

  // Private helper methods
  private async makeRequest(
    action: string,
    params: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!this.credentials) {
      throw new Error('Not connected to AWS Security Hub');
    }

    // In production, use AWS SDK
    // This is a simplified implementation
    const endpoint = `https://securityhub.${this.credentials.region}.amazonaws.com`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': `SecurityHubService.${action}`,
        // Would need proper AWS Signature V4 signing
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`AWS Security Hub API error: ${response.status}`);
    }

    return response.json();
  }

  private mapFinding = (finding: Record<string, unknown>): SecurityFinding => ({
    id: finding.Id as string,
    productArn: finding.ProductArn as string,
    generatorId: finding.GeneratorId as string,
    title: finding.Title as string,
    description: finding.Description as string,
    severity: (finding.Severity as { Label: string })?.Label as SecurityFinding['severity'],
    normalizedSeverity: (finding.Severity as { Normalized: number })?.Normalized || 0,
    resourceType: (finding.Resources as { Type: string }[])?.[0]?.Type || 'Unknown',
    resourceId: (finding.Resources as { Id: string }[])?.[0]?.Id || 'Unknown',
    resourceRegion: (finding.Resources as { Region: string }[])?.[0]?.Region || 'Unknown',
    complianceStatus: (finding.Compliance as { Status: string })
      ?.Status as SecurityFinding['complianceStatus'],
    workflowState: (finding.Workflow as { Status: string })
      ?.Status as SecurityFinding['workflowState'],
    recordState: finding.RecordState as SecurityFinding['recordState'],
    createdAt: new Date(finding.CreatedAt as string),
    updatedAt: new Date(finding.UpdatedAt as string),
    remediation: finding.Remediation
      ? {
          recommendation:
            (finding.Remediation as { Recommendation: { Text: string } }).Recommendation?.Text ||
            '',
          url: (finding.Remediation as { Recommendation: { Url: string } }).Recommendation?.Url,
        }
      : undefined,
  });

  private getStandardName(arn: string): string {
    if (arn.includes('cis')) return 'CIS AWS Foundations';
    if (arn.includes('pci-dss')) return 'PCI DSS';
    if (arn.includes('foundational-security')) return 'AWS Foundational Security';
    return 'Custom Standard';
  }
}

export const createAWSSecurityConnector = (config: ConnectorConfig) =>
  new AWSSecurityConnector(config);

