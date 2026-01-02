// @ts-nocheck
import { BaseConnector, OAuthTokens, WidgetData, WidgetDefinition } from './base.connector';
import { IntegrationCategory, ExecutiveType } from './base.connector';

export class AWSConnector extends BaseConnector {
  readonly id = 'aws';
  readonly name = 'Amazon Web Services';
  readonly category = IntegrationCategory.CLOUD;
  readonly applicableRoles = [ExecutiveType.CTO, ExecutiveType.CFO];

  readonly oauthConfig = null; // AWS uses IAM credentials, not OAuth

  readonly webhookEnabled = false;

  readonly supportedWidgets: WidgetDefinition[] = [
    {
      id: 'cost-summary',
      name: 'Cost Summary',
      description: 'Monthly cloud spend breakdown',
      refreshInterval: 3600,
      requiredScopes: [],
    },
    {
      id: 'cost-trend',
      name: 'Cost Trend',
      description: 'Spend trends over time',
      refreshInterval: 3600,
      requiredScopes: [],
    },
    {
      id: 'service-breakdown',
      name: 'Service Breakdown',
      description: 'Costs by AWS service',
      refreshInterval: 3600,
      requiredScopes: [],
    },
    {
      id: 'cost-anomalies',
      name: 'Cost Anomalies',
      description: 'Unusual spending alerts',
      refreshInterval: 1800,
      requiredScopes: [],
    },
  ];

  getAuthUrl(_state: string): string {
    throw new Error('AWS uses IAM credentials, not OAuth');
  }

  async exchangeCode(_code: string): Promise<OAuthTokens> {
    throw new Error('AWS uses IAM credentials, not OAuth');
  }

  async refreshToken(_refreshToken: string): Promise<OAuthTokens> {
    throw new Error('AWS uses IAM credentials, not OAuth');
  }

  async revokeToken(_accessToken: string): Promise<void> {
    // No-op for IAM
  }

  async testConnection(tokens: OAuthTokens): Promise<boolean> {
    try {
      const client = this.getCostExplorerClient(tokens);
      await client.getDimensionValues({
        TimePeriod: this.getLastMonthPeriod(),
        Dimension: 'SERVICE',
      });
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
    const client = this.getCostExplorerClient(tokens);

    switch (endpoint) {
      case 'cost-summary':
        return this.fetchCostSummary(client);
      case 'cost-trend':
        return this.fetchCostTrend(client, params?.months as number);
      case 'service-breakdown':
        return this.fetchServiceBreakdown(client);
      case 'cost-anomalies':
        return this.fetchCostAnomalies(client);
      default:
        throw new Error(`Unknown endpoint: ${endpoint}`);
    }
  }

  async getWidgetData(
    tokens: OAuthTokens,
    widgetId: string,
    params?: Record<string, unknown>
  ): Promise<WidgetData> {
    switch (widgetId) {
      case 'cost-summary':
        return this.getCostSummary(tokens);
      case 'cost-trend':
        return this.getCostTrend(tokens, params?.months as number);
      case 'service-breakdown':
        return this.getServiceBreakdown(tokens);
      case 'cost-anomalies':
        return this.getCostAnomalies(tokens);
      default:
        throw new Error(`Unknown widget: ${widgetId}`);
    }
  }

  private async getCostSummary(tokens: OAuthTokens): Promise<WidgetData> {
    const client = this.getCostExplorerClient(tokens);
    const period = this.getLastMonthPeriod();

    const response = await client.getCostAndUsage({
      TimePeriod: period,
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost', 'UsageQuantity'],
      GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
    });

    const services = response.ResultsByTime?.[0]?.Groups || [];
    const totalCost = services.reduce(
      (sum, g) => sum + parseFloat(g.Metrics?.UnblendedCost?.Amount || '0'),
      0
    );
    const topServices = services
      .map((g) => ({
        service: g.Keys?.[0] || 'Unknown',
        cost: parseFloat(g.Metrics?.UnblendedCost?.Amount || '0'),
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);

    return {
      widgetId: 'cost-summary',
      data: {
        totalCost: Math.round(totalCost * 100) / 100,
        currency: 'USD',
        period: { start: period.Start, end: period.End },
        topServices,
        serviceCount: services.length,
      },
      fetchedAt: new Date(),
    };
  }

  private async getCostTrend(tokens: OAuthTokens, months = 6): Promise<WidgetData> {
    const client = this.getCostExplorerClient(tokens);
    const period = this.getMultiMonthPeriod(months);

    const response = await client.getCostAndUsage({
      TimePeriod: period,
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
    });

    const trend = (response.ResultsByTime || []).map((r) => ({
      period: r.TimePeriod?.Start,
      cost: parseFloat(r.Total?.UnblendedCost?.Amount || '0'),
    }));

    const current = trend[trend.length - 1]?.cost || 0;
    const previous = trend[trend.length - 2]?.cost || 0;
    const changePercent = previous ? ((current - previous) / previous) * 100 : 0;

    return {
      widgetId: 'cost-trend',
      data: {
        trend,
        currentMonth: current,
        previousMonth: previous,
        changePercent: Math.round(changePercent * 10) / 10,
        isIncreasing: current > previous,
      },
      fetchedAt: new Date(),
    };
  }

  private async getServiceBreakdown(tokens: OAuthTokens): Promise<WidgetData> {
    const client = this.getCostExplorerClient(tokens);
    const period = this.getLastMonthPeriod();

    const response = await client.getCostAndUsage({
      TimePeriod: period,
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
    });

    const services = (response.ResultsByTime?.[0]?.Groups || [])
      .map((g) => ({
        service: g.Keys?.[0] || 'Unknown',
        cost: parseFloat(g.Metrics?.UnblendedCost?.Amount || '0'),
      }))
      .filter((s) => s.cost > 0)
      .sort((a, b) => b.cost - a.cost);

    const total = services.reduce((sum, s) => sum + s.cost, 0);

    return {
      widgetId: 'service-breakdown',
      data: {
        services: services.map((s) => ({
          ...s,
          percentage: total ? Math.round((s.cost / total) * 1000) / 10 : 0,
        })),
        totalCost: Math.round(total * 100) / 100,
      },
      fetchedAt: new Date(),
    };
  }

  private async getCostAnomalies(tokens: OAuthTokens): Promise<WidgetData> {
    const client = this.getCostExplorerClient(tokens);

    const response = await client.getAnomalies({
      DateInterval: {
        StartDate: this.getLastMonthPeriod().Start,
        EndDate: this.getLastMonthPeriod().End,
      },
      TotalImpact: { NumericOperator: 'GREATER_THAN', StartValue: 10 },
    });

    const anomalies = (response.Anomalies || []).map((a) => ({
      id: a.AnomalyId,
      service: a.RootCauses?.[0]?.Service || 'Unknown',
      impact: parseFloat(a.Impact?.TotalImpact || '0'),
      startDate: a.AnomalyStartDate,
      endDate: a.AnomalyEndDate,
      feedback: a.Feedback,
    }));

    return {
      widgetId: 'cost-anomalies',
      data: {
        anomalies,
        totalAnomalies: anomalies.length,
        totalImpact: anomalies.reduce((sum, a) => sum + a.impact, 0),
      },
      fetchedAt: new Date(),
    };
  }

  private getCostExplorerClient(tokens: OAuthTokens): AWSCostExplorerClient {
    return new AWSCostExplorerClient({
      accessKeyId: tokens.raw?.accessKeyId as string,
      secretAccessKey: tokens.raw?.secretAccessKey as string,
      region: (tokens.raw?.region as string) || 'us-east-1',
    });
  }

  private getLastMonthPeriod(): TimePeriod {
    const end = new Date();
    const start = new Date();
    start.setDate(1);
    return {
      Start: start.toISOString().split('T')[0],
      End: end.toISOString().split('T')[0],
    };
  }

  private getMultiMonthPeriod(months: number): TimePeriod {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    start.setDate(1);
    return {
      Start: start.toISOString().split('T')[0],
      End: end.toISOString().split('T')[0],
    };
  }

  private async fetchCostSummary(client: AWSCostExplorerClient): Promise<unknown> {
    return client.getCostAndUsage({
      TimePeriod: this.getLastMonthPeriod(),
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
    });
  }

  private async fetchCostTrend(client: AWSCostExplorerClient, months = 6): Promise<unknown> {
    return client.getCostAndUsage({
      TimePeriod: this.getMultiMonthPeriod(months),
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
    });
  }

  private async fetchServiceBreakdown(client: AWSCostExplorerClient): Promise<unknown> {
    return client.getCostAndUsage({
      TimePeriod: this.getLastMonthPeriod(),
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
    });
  }

  private async fetchCostAnomalies(client: AWSCostExplorerClient): Promise<unknown> {
    return client.getAnomalies({
      DateInterval: this.getLastMonthPeriod(),
    });
  }
}

// Minimal AWS SDK interface (would be replaced with actual @aws-sdk/client-cost-explorer)
interface TimePeriod {
  Start: string;
  End: string;
}

interface AWSCostExplorerClient {
  getCostAndUsage(params: unknown): Promise<CostAndUsageResponse>;
  getDimensionValues(params: unknown): Promise<unknown>;
  getAnomalies(params: unknown): Promise<AnomalyResponse>;
}

interface CostAndUsageResponse {
  ResultsByTime?: Array<{
    TimePeriod?: TimePeriod;
    Total?: Record<string, { Amount?: string }>;
    Groups?: Array<{
      Keys?: string[];
      Metrics?: Record<string, { Amount?: string }>;
    }>;
  }>;
}

interface AnomalyResponse {
  Anomalies?: Array<{
    AnomalyId?: string;
    RootCauses?: Array<{ Service?: string }>;
    Impact?: { TotalImpact?: string };
    AnomalyStartDate?: string;
    AnomalyEndDate?: string;
    Feedback?: string;
  }>;
}

// Factory to create actual AWS client
class AWSCostExplorerClient {
  constructor(private config: { accessKeyId: string; secretAccessKey: string; region: string }) {}

  async getCostAndUsage(_params: unknown): Promise<CostAndUsageResponse> {
    // In production, use @aws-sdk/client-cost-explorer
    throw new Error('AWS SDK not initialized - install @aws-sdk/client-cost-explorer');
  }

  async getDimensionValues(_params: unknown): Promise<unknown> {
    throw new Error('AWS SDK not initialized');
  }

  async getAnomalies(_params: unknown): Promise<AnomalyResponse> {
    throw new Error('AWS SDK not initialized');
  }
}

export const awsConnector = new AWSConnector();

