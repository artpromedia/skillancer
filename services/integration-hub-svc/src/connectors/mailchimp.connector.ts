// @ts-nocheck
import { BaseConnector, ConnectorConfig, OAuthCredentials } from './base.connector';

interface MailchimpList {
  id: string;
  name: string;
  memberCount: number;
  unsubscribeCount: number;
  openRate: number;
  clickRate: number;
  dateCreated: string;
}

interface MailchimpCampaign {
  id: string;
  title: string;
  type: string;
  status: 'save' | 'paused' | 'schedule' | 'sending' | 'sent';
  sendTime?: string;
  recipientCount: number;
  opens: number;
  clicks: number;
  openRate: number;
  clickRate: number;
}

interface MailchimpGrowthHistory {
  month: string;
  existing: number;
  imports: number;
  optins: number;
  subscribed: number;
  unsubscribed: number;
  reconfirm: number;
  cleaned: number;
}

interface EngagementSegment {
  name: string;
  count: number;
  percentage: number;
}

export class MailchimpConnector extends BaseConnector {
  readonly providerId = 'mailchimp';
  readonly displayName = 'Mailchimp';
  readonly description = 'Email marketing and automation platform';
  readonly icon = 'mailchimp';

  readonly oauthConfig = {
    authorizationUrl: 'https://login.mailchimp.com/oauth2/authorize',
    tokenUrl: 'https://login.mailchimp.com/oauth2/token',
    scopes: [],
  };

  readonly supportedWidgets = ['list-growth', 'campaign-performance', 'audience-engagement'];

  private dataCenter: string = 'us1';

  constructor(config: ConnectorConfig) {
    super(config);
    if (config.metadata?.dataCenter) {
      this.dataCenter = config.metadata.dataCenter;
    }
  }

  private get baseUrl(): string {
    return `https://${this.dataCenter}.api.mailchimp.com/3.0`;
  }

  async testConnection(credentials: OAuthCredentials): Promise<boolean> {
    try {
      const response = await this.makeRequest(
        `${this.baseUrl}/ping`,
        { method: 'GET' },
        credentials
      );
      return response.health_status === "Everything's Chimpy!";
    } catch {
      return false;
    }
  }

  async getLists(credentials: OAuthCredentials): Promise<MailchimpList[]> {
    const response = await this.makeRequest(
      `${this.baseUrl}/lists?count=50&include_total_contacts=true`,
      { method: 'GET' },
      credentials
    );

    return (response.lists || []).map((list: any) => ({
      id: list.id,
      name: list.name,
      memberCount: list.stats?.member_count || 0,
      unsubscribeCount: list.stats?.unsubscribe_count || 0,
      openRate: list.stats?.open_rate * 100 || 0,
      clickRate: list.stats?.click_rate * 100 || 0,
      dateCreated: list.date_created,
    }));
  }

  async getCampaigns(
    credentials: OAuthCredentials,
    listId?: string,
    limit = 20
  ): Promise<MailchimpCampaign[]> {
    let url = `${this.baseUrl}/campaigns?count=${limit}&sort_field=send_time&sort_dir=DESC`;
    if (listId) {
      url += `&list_id=${listId}`;
    }

    const response = await this.makeRequest(url, { method: 'GET' }, credentials);

    return (response.campaigns || []).map((campaign: any) => ({
      id: campaign.id,
      title: campaign.settings?.title || campaign.id,
      type: campaign.type,
      status: campaign.status,
      sendTime: campaign.send_time,
      recipientCount: campaign.recipients?.recipient_count || 0,
      opens: campaign.report_summary?.opens || 0,
      clicks: campaign.report_summary?.clicks || 0,
      openRate: campaign.report_summary?.open_rate * 100 || 0,
      clickRate: campaign.report_summary?.click_rate * 100 || 0,
    }));
  }

  async getCampaignReport(credentials: OAuthCredentials, campaignId: string): Promise<any> {
    const response = await this.makeRequest(
      `${this.baseUrl}/reports/${campaignId}`,
      { method: 'GET' },
      credentials
    );

    return {
      id: response.id,
      campaignTitle: response.campaign_title,
      subject: response.subject_line,
      sentAt: response.send_time,
      emailsSent: response.emails_sent,

      opens: {
        total: response.opens?.opens_total || 0,
        unique: response.opens?.unique_opens || 0,
        rate: response.opens?.open_rate * 100 || 0,
      },

      clicks: {
        total: response.clicks?.clicks_total || 0,
        unique: response.clicks?.unique_clicks || 0,
        rate: response.clicks?.click_rate * 100 || 0,
        subscriberClicks: response.clicks?.unique_subscriber_clicks || 0,
      },

      bounces: {
        hardBounces: response.bounces?.hard_bounces || 0,
        softBounces: response.bounces?.soft_bounces || 0,
        syntaxErrors: response.bounces?.syntax_errors || 0,
      },

      unsubscribes: response.unsubscribed || 0,

      industryStats: response.industry_stats
        ? {
            openRate: response.industry_stats.open_rate * 100,
            clickRate: response.industry_stats.click_rate * 100,
            bounceRate: response.industry_stats.bounce_rate * 100,
            unsubRate: response.industry_stats.unopen_rate * 100,
          }
        : null,
    };
  }

  async getListGrowthHistory(
    credentials: OAuthCredentials,
    listId: string
  ): Promise<MailchimpGrowthHistory[]> {
    const response = await this.makeRequest(
      `${this.baseUrl}/lists/${listId}/growth-history?count=12`,
      { method: 'GET' },
      credentials
    );

    return (response.history || []).map((item: any) => ({
      month: item.month,
      existing: item.existing,
      imports: item.imports,
      optins: item.optins,
      subscribed: item.subscribed,
      unsubscribed: item.unsubscribed,
      reconfirm: item.reconfirm,
      cleaned: item.cleaned,
    }));
  }

  async getAudienceEngagement(
    credentials: OAuthCredentials,
    listId: string
  ): Promise<EngagementSegment[]> {
    const response = await this.makeRequest(
      `${this.baseUrl}/lists/${listId}/members?count=0`,
      { method: 'GET' },
      credentials
    );

    const total = response.total_items || 0;

    // Get segments by status
    const segments: EngagementSegment[] = [];

    const statuses = ['subscribed', 'unsubscribed', 'cleaned', 'pending'];

    for (const status of statuses) {
      const statusResponse = await this.makeRequest(
        `${this.baseUrl}/lists/${listId}/members?status=${status}&count=0`,
        { method: 'GET' },
        credentials
      );

      const count = statusResponse.total_items || 0;
      segments.push({
        name: status.charAt(0).toUpperCase() + status.slice(1),
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      });
    }

    return segments;
  }

  async getWidgetData(
    widgetType: string,
    credentials: OAuthCredentials,
    options?: { listId?: string }
  ): Promise<any> {
    switch (widgetType) {
      case 'list-growth':
        return this.getListGrowthData(credentials, options?.listId);

      case 'campaign-performance':
        return this.getCampaignPerformanceData(credentials, options?.listId);

      case 'audience-engagement':
        return this.getAudienceEngagementData(credentials, options?.listId);

      default:
        throw new Error(`Unknown widget type: ${widgetType}`);
    }
  }

  private async getListGrowthData(credentials: OAuthCredentials, listId?: string) {
    const lists = await this.getLists(credentials);

    if (lists.length === 0) {
      return { lists: [], growth: [], totals: { subscribers: 0, unsubscribes: 0 } };
    }

    const targetListId = listId || lists[0].id;
    const growth = await this.getListGrowthHistory(credentials, targetListId);

    const totals = {
      subscribers: lists.reduce((sum, l) => sum + l.memberCount, 0),
      unsubscribes: lists.reduce((sum, l) => sum + l.unsubscribeCount, 0),
    };

    return {
      lists: lists.map((l) => ({ id: l.id, name: l.name, count: l.memberCount })),
      growth,
      totals,
      netGrowth: growth.length > 1 ? growth[0].subscribed - growth[0].unsubscribed : 0,
    };
  }

  private async getCampaignPerformanceData(credentials: OAuthCredentials, listId?: string) {
    const campaigns = await this.getCampaigns(credentials, listId);

    const sentCampaigns = campaigns.filter((c) => c.status === 'sent');

    const avgOpenRate =
      sentCampaigns.length > 0
        ? sentCampaigns.reduce((sum, c) => sum + c.openRate, 0) / sentCampaigns.length
        : 0;

    const avgClickRate =
      sentCampaigns.length > 0
        ? sentCampaigns.reduce((sum, c) => sum + c.clickRate, 0) / sentCampaigns.length
        : 0;

    return {
      campaigns: campaigns.slice(0, 10),
      stats: {
        total: campaigns.length,
        sent: sentCampaigns.length,
        avgOpenRate,
        avgClickRate,
      },
      // Industry benchmarks for comparison
      industryBenchmarks: {
        openRate: 21.33, // Average across industries
        clickRate: 2.62,
      },
    };
  }

  private async getAudienceEngagementData(credentials: OAuthCredentials, listId?: string) {
    const lists = await this.getLists(credentials);

    if (lists.length === 0) {
      return { segments: [], trends: [] };
    }

    const targetListId = listId || lists[0].id;
    const segments = await this.getAudienceEngagement(credentials, targetListId);

    return {
      listName: lists.find((l) => l.id === targetListId)?.name || 'Unknown',
      segments,
      summary: {
        activeSubscribers: segments.find((s) => s.name === 'Subscribed')?.count || 0,
        unsubscribed: segments.find((s) => s.name === 'Unsubscribed')?.count || 0,
        cleaned: segments.find((s) => s.name === 'Cleaned')?.count || 0,
      },
    };
  }
}

export const mailchimpConnector = new MailchimpConnector({});
