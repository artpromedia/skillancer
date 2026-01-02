// @ts-nocheck
import { BaseConnector, ConnectorConfig, OAuthCredentials } from './base.connector';

interface LinkedInAdAccount {
  id: string;
  name: string;
  currency: string;
  status: string;
  type: string;
}

interface LinkedInCampaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'DRAFT';
  type: string;
  objectiveType: string;
  dailyBudget?: number;
  totalBudget?: number;
  costType: string;
}

interface LinkedInAnalytics {
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  leadGenFormOpens?: number;
  leadGenFormSubmissions?: number;
  costPerLead?: number;
  oneClickLeads?: number;
}

interface AudienceBreakdown {
  dimension: string;
  values: {
    name: string;
    impressions: number;
    clicks: number;
    spend: number;
  }[];
}

interface DateRange {
  startDate: string;
  endDate: string;
}

export class LinkedInAdsConnector extends BaseConnector {
  readonly providerId = 'linkedin-ads';
  readonly displayName = 'LinkedIn Ads';
  readonly description = 'B2B advertising on LinkedIn';
  readonly icon = 'linkedin';

  readonly oauthConfig = {
    authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: ['r_ads', 'r_ads_reporting', 'r_organization_social'],
  };

  readonly supportedWidgets = ['b2b-campaign-performance', 'audience-targeting'];

  private baseUrl = 'https://api.linkedin.com/v2';

  constructor(config: ConnectorConfig) {
    super(config);
  }

  async testConnection(credentials: OAuthCredentials): Promise<boolean> {
    try {
      const accounts = await this.getAdAccounts(credentials);
      return accounts.length > 0;
    } catch {
      return false;
    }
  }

  async getAdAccounts(credentials: OAuthCredentials): Promise<LinkedInAdAccount[]> {
    const response = await this.makeRequest(
      `${this.baseUrl}/adAccountsV2?q=search`,
      { method: 'GET' },
      credentials
    );

    return (response.elements || []).map((account: any) => ({
      id: account.id,
      name: account.name,
      currency: account.currency,
      status: account.status,
      type: account.type,
    }));
  }

  async getCampaigns(
    credentials: OAuthCredentials,
    accountId: string
  ): Promise<LinkedInCampaign[]> {
    const response = await this.makeRequest(
      `${this.baseUrl}/adCampaignsV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}`,
      { method: 'GET' },
      credentials
    );

    return (response.elements || []).map((campaign: any) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      type: campaign.type,
      objectiveType: campaign.objectiveType,
      dailyBudget: campaign.dailyBudget?.amount
        ? parseFloat(campaign.dailyBudget.amount) / 100
        : undefined,
      totalBudget: campaign.totalBudget?.amount
        ? parseFloat(campaign.totalBudget.amount) / 100
        : undefined,
      costType: campaign.costType,
    }));
  }

  async getAnalytics(
    credentials: OAuthCredentials,
    accountId: string,
    dateRange: DateRange,
    campaignIds?: string[]
  ): Promise<LinkedInAnalytics> {
    const pivots = ['CAMPAIGN'];
    const fields = [
      'impressions',
      'clicks',
      'costInLocalCurrency',
      'leadGenerationMailContactInfoShares',
      'oneClickLeads',
    ];

    let url =
      `${this.baseUrl}/adAnalyticsV2?q=analytics` +
      `&dateRange.start.day=${new Date(dateRange.startDate).getDate()}` +
      `&dateRange.start.month=${new Date(dateRange.startDate).getMonth() + 1}` +
      `&dateRange.start.year=${new Date(dateRange.startDate).getFullYear()}` +
      `&dateRange.end.day=${new Date(dateRange.endDate).getDate()}` +
      `&dateRange.end.month=${new Date(dateRange.endDate).getMonth() + 1}` +
      `&dateRange.end.year=${new Date(dateRange.endDate).getFullYear()}` +
      `&timeGranularity=ALL` +
      `&accounts=urn:li:sponsoredAccount:${accountId}` +
      `&pivot=${pivots.join(',')}` +
      `&fields=${fields.join(',')}`;

    if (campaignIds?.length) {
      campaignIds.forEach((id, idx) => {
        url += `&campaigns[${idx}]=urn:li:sponsoredCampaign:${id}`;
      });
    }

    const response = await this.makeRequest(url, { method: 'GET' }, credentials);

    const totals = {
      impressions: 0,
      clicks: 0,
      spend: 0,
      leadGenFormOpens: 0,
      leadGenFormSubmissions: 0,
      oneClickLeads: 0,
    };

    for (const element of response.elements || []) {
      totals.impressions += element.impressions || 0;
      totals.clicks += element.clicks || 0;
      totals.spend += parseFloat(element.costInLocalCurrency || '0');
      totals.leadGenFormSubmissions += element.leadGenerationMailContactInfoShares || 0;
      totals.oneClickLeads += element.oneClickLeads || 0;
    }

    const totalLeads = totals.leadGenFormSubmissions + totals.oneClickLeads;

    return {
      impressions: totals.impressions,
      clicks: totals.clicks,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      spend: totals.spend,
      leadGenFormOpens: totals.leadGenFormOpens,
      leadGenFormSubmissions: totals.leadGenFormSubmissions,
      oneClickLeads: totals.oneClickLeads,
      costPerLead: totalLeads > 0 ? totals.spend / totalLeads : undefined,
    };
  }

  async getAudienceBreakdown(
    credentials: OAuthCredentials,
    accountId: string,
    dateRange: DateRange,
    dimension: 'JOB_TITLE' | 'COMPANY_SIZE' | 'INDUSTRY'
  ): Promise<AudienceBreakdown> {
    const pivotMap = {
      JOB_TITLE: 'MEMBER_JOB_TITLE',
      COMPANY_SIZE: 'MEMBER_COMPANY_SIZE',
      INDUSTRY: 'MEMBER_INDUSTRY',
    };

    const url =
      `${this.baseUrl}/adAnalyticsV2?q=analytics` +
      `&dateRange.start.day=${new Date(dateRange.startDate).getDate()}` +
      `&dateRange.start.month=${new Date(dateRange.startDate).getMonth() + 1}` +
      `&dateRange.start.year=${new Date(dateRange.startDate).getFullYear()}` +
      `&dateRange.end.day=${new Date(dateRange.endDate).getDate()}` +
      `&dateRange.end.month=${new Date(dateRange.endDate).getMonth() + 1}` +
      `&dateRange.end.year=${new Date(dateRange.endDate).getFullYear()}` +
      `&timeGranularity=ALL` +
      `&accounts=urn:li:sponsoredAccount:${accountId}` +
      `&pivot=${pivotMap[dimension]}` +
      `&fields=impressions,clicks,costInLocalCurrency`;

    const response = await this.makeRequest(url, { method: 'GET' }, credentials);

    return {
      dimension,
      values: (response.elements || [])
        .map((element: any) => ({
          name: element.pivotValue || 'Unknown',
          impressions: element.impressions || 0,
          clicks: element.clicks || 0,
          spend: parseFloat(element.costInLocalCurrency || '0'),
        }))
        .sort((a: any, b: any) => b.impressions - a.impressions)
        .slice(0, 20),
    };
  }

  async getWidgetData(
    widgetType: string,
    credentials: OAuthCredentials,
    options: { accountId: string; dateRange?: DateRange }
  ): Promise<any> {
    const dateRange = options.dateRange || {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
    };

    switch (widgetType) {
      case 'b2b-campaign-performance':
        return this.getB2BCampaignPerformanceData(credentials, options.accountId, dateRange);

      case 'audience-targeting':
        return this.getAudienceTargetingData(credentials, options.accountId, dateRange);

      default:
        throw new Error(`Unknown widget type: ${widgetType}`);
    }
  }

  private async getB2BCampaignPerformanceData(
    credentials: OAuthCredentials,
    accountId: string,
    dateRange: DateRange
  ) {
    const [analytics, campaigns] = await Promise.all([
      this.getAnalytics(credentials, accountId, dateRange),
      this.getCampaigns(credentials, accountId),
    ]);

    const activeCampaigns = campaigns.filter((c) => c.status === 'ACTIVE');

    return {
      summary: analytics,
      campaigns: {
        total: campaigns.length,
        active: activeCampaigns.length,
        paused: campaigns.filter((c) => c.status === 'PAUSED').length,
      },
      topCampaigns: activeCampaigns.slice(0, 5).map((c) => ({
        id: c.id,
        name: c.name,
        objectiveType: c.objectiveType,
        dailyBudget: c.dailyBudget,
      })),
    };
  }

  private async getAudienceTargetingData(
    credentials: OAuthCredentials,
    accountId: string,
    dateRange: DateRange
  ) {
    const [byJobTitle, byCompanySize, byIndustry] = await Promise.all([
      this.getAudienceBreakdown(credentials, accountId, dateRange, 'JOB_TITLE'),
      this.getAudienceBreakdown(credentials, accountId, dateRange, 'COMPANY_SIZE'),
      this.getAudienceBreakdown(credentials, accountId, dateRange, 'INDUSTRY'),
    ]);

    return {
      byJobTitle,
      byCompanySize,
      byIndustry,
    };
  }
}

export const linkedInAdsConnector = new LinkedInAdsConnector({});

