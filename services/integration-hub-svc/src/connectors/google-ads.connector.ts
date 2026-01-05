// @ts-nocheck
import { BaseConnector, ConnectorConfig, OAuthCredentials } from './base.connector';

interface GoogleAdsCustomer {
  id: string;
  descriptiveName: string;
  currencyCode: string;
  timeZone: string;
  canManageClients: boolean;
}

interface GoogleAdsCampaign {
  id: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  advertisingChannelType: string;
  budget: {
    amountMicros: string;
    deliveryMethod: string;
  };
  startDate: string;
  endDate?: string;
}

interface GoogleAdsKeyword {
  id: string;
  text: string;
  matchType: 'EXACT' | 'PHRASE' | 'BROAD';
  qualityScore?: number;
  status: string;
}

interface GoogleAdsMetrics {
  impressions: number;
  clicks: number;
  ctr: number;
  averageCpc: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  roas?: number;
}

interface SearchTermReport {
  searchTerm: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
}

interface DateRange {
  startDate: string;
  endDate: string;
}

export class GoogleAdsConnector extends BaseConnector {
  readonly providerId = 'google-ads';
  readonly displayName = 'Google Ads';
  readonly description = 'Search and display advertising platform';
  readonly icon = 'google-ads';

  readonly oauthConfig = {
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/adwords'],
    additionalParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  };

  readonly supportedWidgets = ['search-performance', 'keyword-performance', 'campaign-metrics'];

  private developerToken: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.developerToken =
      config.metadata?.developerToken || process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
  }

  async testConnection(credentials: OAuthCredentials): Promise<boolean> {
    try {
      const customers = await this.getCustomers(credentials);
      return customers.length > 0;
    } catch {
      return false;
    }
  }

  async getCustomers(credentials: OAuthCredentials): Promise<GoogleAdsCustomer[]> {
    const response = await this.makeRequest(
      'https://googleads.googleapis.com/v15/customers:listAccessibleCustomers',
      { method: 'GET' },
      credentials
    );

    const customerIds = response.resourceNames?.map((rn: string) => rn.split('/')[1]) || [];
    const customers: GoogleAdsCustomer[] = [];

    for (const customerId of customerIds.slice(0, 10)) {
      try {
        const customer = await this.getCustomerDetails(credentials, customerId);
        if (customer) customers.push(customer);
      } catch {
        // Skip inaccessible customers
      }
    }

    return customers;
  }

  private async getCustomerDetails(
    credentials: OAuthCredentials,
    customerId: string
  ): Promise<GoogleAdsCustomer | null> {
    const query = `
      SELECT 
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone,
        customer.manager
      FROM customer
      LIMIT 1
    `;

    const response = await this.executeQuery(credentials, customerId, query);
    const result = response.results?.[0];

    if (!result) return null;

    return {
      id: result.customer.id,
      descriptiveName: result.customer.descriptiveName,
      currencyCode: result.customer.currencyCode,
      timeZone: result.customer.timeZone,
      canManageClients: result.customer.manager,
    };
  }

  async getCampaigns(
    credentials: OAuthCredentials,
    customerId: string
  ): Promise<GoogleAdsCampaign[]> {
    const query = `
      SELECT 
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.start_date,
        campaign.end_date,
        campaign_budget.amount_micros,
        campaign_budget.delivery_method
      FROM campaign
      WHERE campaign.status != 'REMOVED'
      ORDER BY campaign.name
    `;

    const response = await this.executeQuery(credentials, customerId, query);

    return (response.results || []).map((row: any) => ({
      id: row.campaign.id,
      name: row.campaign.name,
      status: row.campaign.status,
      advertisingChannelType: row.campaign.advertisingChannelType,
      budget: {
        amountMicros: row.campaignBudget?.amountMicros || '0',
        deliveryMethod: row.campaignBudget?.deliveryMethod || 'STANDARD',
      },
      startDate: row.campaign.startDate,
      endDate: row.campaign.endDate,
    }));
  }

  async getKeywords(
    credentials: OAuthCredentials,
    customerId: string,
    campaignId?: string
  ): Promise<GoogleAdsKeyword[]> {
    let query = `
      SELECT 
        ad_group_criterion.criterion_id,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.quality_info.quality_score,
        ad_group_criterion.status
      FROM ad_group_criterion
      WHERE ad_group_criterion.type = 'KEYWORD'
    `;

    if (campaignId) {
      query += ` AND campaign.id = ${campaignId}`;
    }

    query += ' LIMIT 100';

    const response = await this.executeQuery(credentials, customerId, query);

    return (response.results || []).map((row: any) => ({
      id: row.adGroupCriterion.criterionId,
      text: row.adGroupCriterion.keyword.text,
      matchType: row.adGroupCriterion.keyword.matchType,
      qualityScore: row.adGroupCriterion.qualityInfo?.qualityScore,
      status: row.adGroupCriterion.status,
    }));
  }

  async getCampaignMetrics(
    credentials: OAuthCredentials,
    customerId: string,
    dateRange: DateRange
  ): Promise<{ campaignId: string; metrics: GoogleAdsMetrics }[]> {
    const query = `
      SELECT 
        campaign.id,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${dateRange.startDate}' AND '${dateRange.endDate}'
      ORDER BY metrics.cost_micros DESC
    `;

    const response = await this.executeQuery(credentials, customerId, query);

    return (response.results || []).map((row: any) => ({
      campaignId: row.campaign.id,
      metrics: {
        impressions: Number.parseInt(row.metrics.impressions || '0'),
        clicks: Number.parseInt(row.metrics.clicks || '0'),
        ctr: parseFloat(row.metrics.ctr || '0'),
        averageCpc: Number.parseInt(row.metrics.averageCpc || '0') / 1000000,
        cost: Number.parseInt(row.metrics.costMicros || '0') / 1000000,
        conversions: parseFloat(row.metrics.conversions || '0'),
        conversionValue: parseFloat(row.metrics.conversionsValue || '0'),
        roas:
          row.metrics.costMicros > 0
            ? parseFloat(row.metrics.conversionsValue || '0') /
              (Number.parseInt(row.metrics.costMicros) / 1000000)
            : undefined,
      },
    }));
  }

  async getSearchTermReport(
    credentials: OAuthCredentials,
    customerId: string,
    campaignId: string,
    dateRange: DateRange
  ): Promise<SearchTermReport[]> {
    const query = `
      SELECT 
        search_term_view.search_term,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM search_term_view
      WHERE campaign.id = ${campaignId}
        AND segments.date BETWEEN '${dateRange.startDate}' AND '${dateRange.endDate}'
      ORDER BY metrics.impressions DESC
      LIMIT 100
    `;

    const response = await this.executeQuery(credentials, customerId, query);

    return (response.results || []).map((row: any) => ({
      searchTerm: row.searchTermView.searchTerm,
      impressions: Number.parseInt(row.metrics.impressions || '0'),
      clicks: Number.parseInt(row.metrics.clicks || '0'),
      cost: Number.parseInt(row.metrics.costMicros || '0') / 1000000,
      conversions: parseFloat(row.metrics.conversions || '0'),
    }));
  }

  private async executeQuery(
    credentials: OAuthCredentials,
    customerId: string,
    query: string
  ): Promise<any> {
    return this.makeRequest(
      `https://googleads.googleapis.com/v15/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        body: JSON.stringify({ query }),
      },
      credentials,
      {
        'developer-token': this.developerToken,
        'login-customer-id': customerId,
      }
    );
  }

  async getWidgetData(
    widgetType: string,
    credentials: OAuthCredentials,
    options: { customerId: string; campaignId?: string; dateRange?: DateRange }
  ): Promise<any> {
    const dateRange = options.dateRange || {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
    };

    switch (widgetType) {
      case 'search-performance':
        return this.getSearchPerformanceData(credentials, options.customerId, dateRange);

      case 'keyword-performance':
        return this.getKeywordPerformanceData(credentials, options.customerId, options.campaignId);

      case 'campaign-metrics':
        return this.getCampaignMetrics(credentials, options.customerId, dateRange);

      default:
        throw new Error(`Unknown widget type: ${widgetType}`);
    }
  }

  private async getSearchPerformanceData(
    credentials: OAuthCredentials,
    customerId: string,
    dateRange: DateRange
  ) {
    const query = `
      SELECT 
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        segments.date
      FROM customer
      WHERE segments.date BETWEEN '${dateRange.startDate}' AND '${dateRange.endDate}'
    `;

    const response = await this.executeQuery(credentials, customerId, query);

    const totals = {
      impressions: 0,
      clicks: 0,
      cost: 0,
      conversions: 0,
      conversionValue: 0,
    };

    const dailyData: any[] = [];

    for (const row of response.results || []) {
      totals.impressions += Number.parseInt(row.metrics.impressions || '0');
      totals.clicks += Number.parseInt(row.metrics.clicks || '0');
      totals.cost += Number.parseInt(row.metrics.costMicros || '0') / 1000000;
      totals.conversions += parseFloat(row.metrics.conversions || '0');
      totals.conversionValue += parseFloat(row.metrics.conversionsValue || '0');

      dailyData.push({
        date: row.segments.date,
        impressions: Number.parseInt(row.metrics.impressions || '0'),
        clicks: Number.parseInt(row.metrics.clicks || '0'),
        cost: Number.parseInt(row.metrics.costMicros || '0') / 1000000,
      });
    }

    return {
      totals: {
        ...totals,
        ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
        averageCpc: totals.clicks > 0 ? totals.cost / totals.clicks : 0,
        roas: totals.cost > 0 ? totals.conversionValue / totals.cost : 0,
      },
      dailyData,
    };
  }

  private async getKeywordPerformanceData(
    credentials: OAuthCredentials,
    customerId: string,
    campaignId?: string
  ) {
    const keywords = await this.getKeywords(credentials, customerId, campaignId);

    return {
      totalKeywords: keywords.length,
      byMatchType: {
        exact: keywords.filter((k) => k.matchType === 'EXACT').length,
        phrase: keywords.filter((k) => k.matchType === 'PHRASE').length,
        broad: keywords.filter((k) => k.matchType === 'BROAD').length,
      },
      averageQualityScore:
        keywords.reduce((sum, k) => sum + (k.qualityScore || 0), 0) / keywords.length || 0,
      topKeywords: keywords.slice(0, 10),
    };
  }
}

export const googleAdsConnector = new GoogleAdsConnector({});

