// @ts-nocheck
/**
 * Meta (Facebook/Instagram) Ads Connector
 *
 * OAuth Configuration:
 * - Facebook OAuth
 * - permissions: ads_read, ads_management
 */

import { BaseConnector, ConnectorConfig, OAuthCredentials } from './base.connector';

// ============================================================================
// Types
// ============================================================================

export interface AdAccount {
  id: string;
  name: string;
  accountId: string;
  currency: string;
  timezone: string;
  status: number;
  amountSpent: number;
}

export interface Campaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  objective: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
  startTime: string;
  stopTime?: string;
}

export interface AdSet {
  id: string;
  name: string;
  campaignId: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  dailyBudget?: number;
  lifetimeBudget?: number;
  targeting?: Record<string, unknown>;
}

export interface Ad {
  id: string;
  name: string;
  adsetId: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  creative?: {
    id: string;
    title: string;
    body: string;
    imageUrl?: string;
  };
}

export interface AdInsights {
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  cpm: number;
  cpc: number;
  ctr: number;
  conversions: number;
  costPerConversion: number;
  frequency: number;
}

export interface AdPerformance extends AdInsights {
  dateStart: string;
  dateStop: string;
  campaignId?: string;
  campaignName?: string;
  adsetId?: string;
  adsetName?: string;
  adId?: string;
  adName?: string;
}

export interface AudienceInsight {
  demographic: string;
  value: string;
  reach: number;
  impressions: number;
  clicks: number;
  spend: number;
}

export interface Audience {
  id: string;
  name: string;
  type: 'custom' | 'lookalike' | 'saved';
  approximateCount: number;
  status: string;
}

export interface DateRange {
  since: string;
  until: string;
}

export interface SpendTracking {
  daily: Array<{ date: string; spend: number; conversions: number }>;
  totalSpend: number;
  budgetRemaining: number;
  budgetUtilization: number;
  spendTrend: number;
}

// ============================================================================
// Meta Ads Connector
// ============================================================================

export class MetaAdsConnector extends BaseConnector {
  readonly providerId = 'meta-ads';
  readonly displayName = 'Meta Ads';
  readonly category = 'advertising';

  private baseUrl = 'https://graph.facebook.com/v18.0';

  // --------------------------------------------------------------------------
  // Supported Widgets
  // --------------------------------------------------------------------------

  readonly supportedWidgets = [
    'ad-performance',
    'campaign-breakdown',
    'audience-insights',
    'spend-tracking',
  ];

  // --------------------------------------------------------------------------
  // OAuth Configuration
  // --------------------------------------------------------------------------

  getOAuthConfig(): ConnectorConfig['oauth'] {
    return {
      authorizationUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
      tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
      scopes: ['ads_read', 'ads_management', 'business_management'],
    };
  }

  // --------------------------------------------------------------------------
  // Connection Management
  // --------------------------------------------------------------------------

  async testConnection(credentials: OAuthCredentials): Promise<boolean> {
    try {
      const accounts = await this.getAdAccounts(credentials);
      return accounts.length > 0;
    } catch {
      return false;
    }
  }

  async getAccountInfo(credentials: OAuthCredentials): Promise<{
    id: string;
    name: string;
  }> {
    const accounts = await this.getAdAccounts(credentials);
    const primary = accounts[0];

    return {
      id: primary?.id || 'unknown',
      name: primary?.name || 'Meta Ads',
    };
  }

  // --------------------------------------------------------------------------
  // API Methods
  // --------------------------------------------------------------------------

  /**
   * Get all ad accounts accessible to the user
   */
  async getAdAccounts(credentials: OAuthCredentials): Promise<AdAccount[]> {
    const response = await this.makeRequest<{
      data: Array<{
        id: string;
        name: string;
        account_id: string;
        currency: string;
        timezone_name: string;
        account_status: number;
        amount_spent: string;
      }>;
    }>('/me/adaccounts', credentials, {
      fields: 'id,name,account_id,currency,timezone_name,account_status,amount_spent',
    });

    return response.data.map((account) => ({
      id: account.id,
      name: account.name,
      accountId: account.account_id,
      currency: account.currency,
      timezone: account.timezone_name,
      status: account.account_status,
      amountSpent: parseFloat(account.amount_spent) / 100, // Convert from cents
    }));
  }

  /**
   * Get campaigns for an ad account
   */
  async getCampaigns(credentials: OAuthCredentials, accountId: string): Promise<Campaign[]> {
    const response = await this.makeRequest<{
      data: Array<{
        id: string;
        name: string;
        status: Campaign['status'];
        objective: string;
        daily_budget?: string;
        lifetime_budget?: string;
        start_time: string;
        stop_time?: string;
      }>;
    }>(`/${accountId}/campaigns`, credentials, {
      fields: 'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time',
    });

    return response.data.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      objective: campaign.objective,
      dailyBudget: campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : undefined,
      lifetimeBudget: campaign.lifetime_budget
        ? parseFloat(campaign.lifetime_budget) / 100
        : undefined,
      startTime: campaign.start_time,
      stopTime: campaign.stop_time,
    }));
  }

  /**
   * Get insights for an ad object (account, campaign, adset, or ad)
   */
  async getInsights(
    credentials: OAuthCredentials,
    objectId: string,
    dateRange: DateRange,
    options?: {
      breakdown?: 'age' | 'gender' | 'country' | 'region' | 'publisher_platform';
      level?: 'account' | 'campaign' | 'adset' | 'ad';
      timeIncrement?: number | 'monthly' | 'all_days';
    }
  ): Promise<AdPerformance[]> {
    const params: Record<string, string> = {
      fields: [
        'impressions',
        'clicks',
        'spend',
        'reach',
        'cpm',
        'cpc',
        'ctr',
        'conversions',
        'cost_per_conversion',
        'frequency',
        'date_start',
        'date_stop',
        'campaign_id',
        'campaign_name',
        'adset_id',
        'adset_name',
        'ad_id',
        'ad_name',
      ].join(','),
      time_range: JSON.stringify({
        since: dateRange.since,
        until: dateRange.until,
      }),
    };

    if (options?.breakdown) {
      params.breakdowns = options.breakdown;
    }

    if (options?.level) {
      params.level = options.level;
    }

    if (options?.timeIncrement) {
      params.time_increment = String(options.timeIncrement);
    }

    const response = await this.makeRequest<{
      data: Array<{
        impressions: string;
        clicks: string;
        spend: string;
        reach: string;
        cpm: string;
        cpc: string;
        ctr: string;
        conversions?: string;
        cost_per_conversion?: string;
        frequency: string;
        date_start: string;
        date_stop: string;
        campaign_id?: string;
        campaign_name?: string;
        adset_id?: string;
        adset_name?: string;
        ad_id?: string;
        ad_name?: string;
      }>;
    }>(`/${objectId}/insights`, credentials, params);

    return response.data.map((insight) => ({
      impressions: Number.parseInt(insight.impressions, 10),
      clicks: Number.parseInt(insight.clicks, 10),
      spend: parseFloat(insight.spend),
      reach: Number.parseInt(insight.reach, 10),
      cpm: parseFloat(insight.cpm),
      cpc: parseFloat(insight.cpc),
      ctr: parseFloat(insight.ctr),
      conversions: Number.parseInt(insight.conversions || '0', 10),
      costPerConversion: parseFloat(insight.cost_per_conversion || '0'),
      frequency: parseFloat(insight.frequency),
      dateStart: insight.date_start,
      dateStop: insight.date_stop,
      campaignId: insight.campaign_id,
      campaignName: insight.campaign_name,
      adsetId: insight.adset_id,
      adsetName: insight.adset_name,
      adId: insight.ad_id,
      adName: insight.ad_name,
    }));
  }

  /**
   * Get custom audiences for an ad account
   */
  async getAudiences(credentials: OAuthCredentials, accountId: string): Promise<Audience[]> {
    const response = await this.makeRequest<{
      data: Array<{
        id: string;
        name: string;
        subtype: string;
        approximate_count: number;
        operation_status: { code: number; description: string };
      }>;
    }>(`/${accountId}/customaudiences`, credentials, {
      fields: 'id,name,subtype,approximate_count,operation_status',
    });

    return response.data.map((audience) => ({
      id: audience.id,
      name: audience.name,
      type: audience.subtype === 'LOOKALIKE' ? 'lookalike' : 'custom',
      approximateCount: audience.approximate_count,
      status: audience.operation_status.description,
    }));
  }

  // --------------------------------------------------------------------------
  // Widget Data Methods
  // --------------------------------------------------------------------------

  /**
   * Fetch data for any supported widget
   */
  async getWidgetData(
    widgetType: string,
    credentials: OAuthCredentials,
    config: { accountId: string; dateRange?: DateRange }
  ): Promise<unknown> {
    const dateRange = config.dateRange || {
      since: this.getDateString(-30),
      until: this.getDateString(0),
    };

    switch (widgetType) {
      case 'ad-performance':
        return this.getAdPerformanceWidget(credentials, config.accountId, dateRange);
      case 'campaign-breakdown':
        return this.getCampaignBreakdown(credentials, config.accountId, dateRange);
      case 'audience-insights':
        return this.getAudienceInsights(credentials, config.accountId, dateRange);
      case 'spend-tracking':
        return this.getSpendTracking(credentials, config.accountId, dateRange);
      default:
        throw new Error(`Unsupported widget type: ${widgetType}`);
    }
  }

  /**
   * Get overall ad performance metrics
   */
  async getAdPerformanceWidget(
    credentials: OAuthCredentials,
    accountId: string,
    dateRange: DateRange
  ): Promise<{
    current: AdInsights;
    previous: AdInsights;
    trends: Record<string, number>;
  }> {
    const previousRange = this.getPreviousPeriod(dateRange);

    const [current, previous] = await Promise.all([
      this.getInsights(credentials, accountId, dateRange),
      this.getInsights(credentials, accountId, previousRange),
    ]);

    const currentMetrics = this.aggregateInsights(current);
    const previousMetrics = this.aggregateInsights(previous);

    return {
      current: currentMetrics,
      previous: previousMetrics,
      trends: {
        spend: this.calculateTrend(currentMetrics.spend, previousMetrics.spend),
        impressions: this.calculateTrend(currentMetrics.impressions, previousMetrics.impressions),
        clicks: this.calculateTrend(currentMetrics.clicks, previousMetrics.clicks),
        conversions: this.calculateTrend(currentMetrics.conversions, previousMetrics.conversions),
        ctr: this.calculateTrend(currentMetrics.ctr, previousMetrics.ctr),
        cpc: this.calculateTrend(currentMetrics.cpc, previousMetrics.cpc),
      },
    };
  }

  /**
   * Get performance breakdown by campaign
   */
  async getCampaignBreakdown(
    credentials: OAuthCredentials,
    accountId: string,
    dateRange: DateRange
  ): Promise<{
    campaigns: Array<Campaign & AdInsights & { trend: number }>;
    topAds: Array<{ id: string; name: string } & AdInsights>;
  }> {
    const [campaigns, campaignInsights, adInsights] = await Promise.all([
      this.getCampaigns(credentials, accountId),
      this.getInsights(credentials, accountId, dateRange, { level: 'campaign' }),
      this.getInsights(credentials, accountId, dateRange, { level: 'ad' }),
    ]);

    const insightsMap = new Map(campaignInsights.map((insight) => [insight.campaignId, insight]));

    const previousRange = this.getPreviousPeriod(dateRange);
    const previousInsights = await this.getInsights(credentials, accountId, previousRange, {
      level: 'campaign',
    });
    const previousMap = new Map(previousInsights.map((insight) => [insight.campaignId, insight]));

    const campaignsWithInsights = campaigns.map((campaign) => {
      const insights = insightsMap.get(campaign.id) || this.getEmptyInsights();
      const prevInsights = previousMap.get(campaign.id) || this.getEmptyInsights();

      return {
        ...campaign,
        ...insights,
        trend: this.calculateTrend(insights.conversions, prevInsights.conversions),
      };
    });

    // Sort by spend and get top 10 ads
    const topAds = adInsights
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10)
      .map((ad) => ({
        id: ad.adId || '',
        name: ad.adName || '',
        ...this.pickInsightFields(ad),
      }));

    return {
      campaigns: campaignsWithInsights,
      topAds,
    };
  }

  /**
   * Get audience demographic insights
   */
  async getAudienceInsights(
    credentials: OAuthCredentials,
    accountId: string,
    dateRange: DateRange
  ): Promise<{
    byAge: AudienceInsight[];
    byGender: AudienceInsight[];
    byCountry: AudienceInsight[];
    audiences: Audience[];
  }> {
    const [byAge, byGender, byCountry, audiences] = await Promise.all([
      this.getInsights(credentials, accountId, dateRange, { breakdown: 'age' }),
      this.getInsights(credentials, accountId, dateRange, { breakdown: 'gender' }),
      this.getInsights(credentials, accountId, dateRange, { breakdown: 'country' }),
      this.getAudiences(credentials, accountId),
    ]);

    const mapToAudienceInsight = (data: AdPerformance[], demographic: string): AudienceInsight[] =>
      data.map((item) => ({
        demographic,
        value: (item as unknown as Record<string, string>)[demographic] || 'unknown',
        reach: item.reach,
        impressions: item.impressions,
        clicks: item.clicks,
        spend: item.spend,
      }));

    return {
      byAge: mapToAudienceInsight(byAge, 'age'),
      byGender: mapToAudienceInsight(byGender, 'gender'),
      byCountry: mapToAudienceInsight(byCountry, 'country'),
      audiences,
    };
  }

  /**
   * Get spend tracking data
   */
  async getSpendTracking(
    credentials: OAuthCredentials,
    accountId: string,
    dateRange: DateRange
  ): Promise<SpendTracking> {
    const [dailyInsights, accounts] = await Promise.all([
      this.getInsights(credentials, accountId, dateRange, { timeIncrement: 1 }),
      this.getAdAccounts(credentials),
    ]);

    const account = accounts.find((a) => a.id === accountId);
    const totalBudget = account?.amountSpent || 0;

    const daily = dailyInsights.map((insight) => ({
      date: insight.dateStart,
      spend: insight.spend,
      conversions: insight.conversions,
    }));

    const totalSpend = daily.reduce((sum, d) => sum + d.spend, 0);
    const midpoint = Math.floor(daily.length / 2);
    const firstHalf = daily.slice(0, midpoint).reduce((sum, d) => sum + d.spend, 0);
    const secondHalf = daily.slice(midpoint).reduce((sum, d) => sum + d.spend, 0);

    return {
      daily,
      totalSpend,
      budgetRemaining: Math.max(0, totalBudget - totalSpend),
      budgetUtilization: totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0,
      spendTrend: firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0,
    };
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  private getDateString(daysOffset: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date.toISOString().split('T')[0];
  }

  private getPreviousPeriod(dateRange: DateRange): DateRange {
    const start = new Date(dateRange.since);
    const end = new Date(dateRange.until);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);

    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - days);

    return {
      since: prevStart.toISOString().split('T')[0],
      until: prevEnd.toISOString().split('T')[0],
    };
  }

  private calculateTrend(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  private aggregateInsights(insights: AdPerformance[]): AdInsights {
    if (insights.length === 0) return this.getEmptyInsights();

    const totals = insights.reduce(
      (acc, insight) => ({
        impressions: acc.impressions + insight.impressions,
        clicks: acc.clicks + insight.clicks,
        spend: acc.spend + insight.spend,
        reach: acc.reach + insight.reach,
        conversions: acc.conversions + insight.conversions,
      }),
      { impressions: 0, clicks: 0, spend: 0, reach: 0, conversions: 0 }
    );

    return {
      ...totals,
      cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      costPerConversion: totals.conversions > 0 ? totals.spend / totals.conversions : 0,
      frequency: totals.reach > 0 ? totals.impressions / totals.reach : 0,
    };
  }

  private getEmptyInsights(): AdInsights {
    return {
      impressions: 0,
      clicks: 0,
      spend: 0,
      reach: 0,
      cpm: 0,
      cpc: 0,
      ctr: 0,
      conversions: 0,
      costPerConversion: 0,
      frequency: 0,
    };
  }

  private pickInsightFields(insight: AdPerformance): AdInsights {
    return {
      impressions: insight.impressions,
      clicks: insight.clicks,
      spend: insight.spend,
      reach: insight.reach,
      cpm: insight.cpm,
      cpc: insight.cpc,
      ctr: insight.ctr,
      conversions: insight.conversions,
      costPerConversion: insight.costPerConversion,
      frequency: insight.frequency,
    };
  }

  private async makeRequest<T>(
    endpoint: string,
    credentials: OAuthCredentials,
    params?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.set('access_token', credentials.accessToken);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Meta Ads API error: ${response.status} - ${error.error?.message || response.statusText}`
      );
    }

    return response.json();
  }
}

// Export singleton instance
export const metaAdsConnector = new MetaAdsConnector();
