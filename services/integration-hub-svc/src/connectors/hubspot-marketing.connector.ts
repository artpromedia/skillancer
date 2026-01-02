// @ts-nocheck
import { BaseConnector, ConnectorConfig, OAuthCredentials } from './base.connector';

interface HubSpotContact {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  lifecycleStage: string;
  source?: string;
  createDate: string;
}

interface HubSpotEmailAnalytics {
  campaignId: string;
  campaignName: string;
  sent: number;
  delivered: number;
  opens: number;
  clicks: number;
  bounces: number;
  unsubscribes: number;
  openRate: number;
  clickRate: number;
}

interface HubSpotLandingPage {
  id: string;
  name: string;
  slug: string;
  views: number;
  submissions: number;
  conversionRate: number;
  published: boolean;
}

interface HubSpotForm {
  id: string;
  name: string;
  submissions: number;
  views?: number;
  conversionRate?: number;
}

interface ContactFilters {
  lifecycleStage?: string;
  source?: string;
  dateRange?: { startDate: string; endDate: string };
}

export class HubSpotMarketingConnector extends BaseConnector {
  readonly providerId = 'hubspot-marketing';
  readonly displayName = 'HubSpot Marketing';
  readonly description = 'Inbound marketing and CRM platform';
  readonly icon = 'hubspot';

  readonly oauthConfig = {
    authorizationUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    scopes: ['crm.objects.contacts.read', 'content', 'forms', 'marketing-email'],
  };

  readonly supportedWidgets = [
    'contact-growth',
    'email-performance',
    'landing-pages',
    'forms-performance',
    'marketing-qualified-leads',
  ];

  private baseUrl = 'https://api.hubapi.com';

  constructor(config: ConnectorConfig) {
    super(config);
  }

  async testConnection(credentials: OAuthCredentials): Promise<boolean> {
    try {
      await this.makeRequest(
        `${this.baseUrl}/crm/v3/objects/contacts?limit=1`,
        { method: 'GET' },
        credentials
      );
      return true;
    } catch {
      return false;
    }
  }

  async getContacts(
    credentials: OAuthCredentials,
    filters?: ContactFilters,
    limit = 100
  ): Promise<HubSpotContact[]> {
    const properties = [
      'email',
      'firstname',
      'lastname',
      'lifecyclestage',
      'hs_analytics_source',
      'createdate',
    ];

    let url = `${this.baseUrl}/crm/v3/objects/contacts?limit=${limit}&properties=${properties.join(',')}`;

    const response = await this.makeRequest(url, { method: 'GET' }, credentials);

    let contacts = (response.results || []).map((contact: any) => ({
      id: contact.id,
      email: contact.properties.email,
      firstName: contact.properties.firstname,
      lastName: contact.properties.lastname,
      lifecycleStage: contact.properties.lifecyclestage || 'subscriber',
      source: contact.properties.hs_analytics_source,
      createDate: contact.properties.createdate,
    }));

    if (filters?.lifecycleStage) {
      contacts = contacts.filter(
        (c: HubSpotContact) => c.lifecycleStage === filters.lifecycleStage
      );
    }

    if (filters?.source) {
      contacts = contacts.filter((c: HubSpotContact) => c.source === filters.source);
    }

    return contacts;
  }

  async getContactsByLifecycleStage(
    credentials: OAuthCredentials
  ): Promise<Record<string, number>> {
    const searchBody = {
      filterGroups: [],
      properties: ['lifecyclestage'],
      limit: 0,
    };

    const stages = [
      'subscriber',
      'lead',
      'marketingqualifiedlead',
      'salesqualifiedlead',
      'opportunity',
      'customer',
    ];
    const result: Record<string, number> = {};

    for (const stage of stages) {
      const response = await this.makeRequest(
        `${this.baseUrl}/crm/v3/objects/contacts/search`,
        {
          method: 'POST',
          body: JSON.stringify({
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: 'lifecyclestage',
                    operator: 'EQ',
                    value: stage,
                  },
                ],
              },
            ],
            limit: 0,
          }),
        },
        credentials
      );
      result[stage] = response.total || 0;
    }

    return result;
  }

  async getEmailAnalytics(
    credentials: OAuthCredentials,
    campaignId?: string
  ): Promise<HubSpotEmailAnalytics[]> {
    const url = campaignId
      ? `${this.baseUrl}/marketing-emails/v1/emails/${campaignId}/statistics`
      : `${this.baseUrl}/marketing-emails/v1/emails/with-statistics`;

    const response = await this.makeRequest(url, { method: 'GET' }, credentials);

    if (campaignId) {
      return [
        {
          campaignId,
          campaignName: response.name || '',
          sent: response.counters?.sent || 0,
          delivered: response.counters?.delivered || 0,
          opens: response.counters?.open || 0,
          clicks: response.counters?.click || 0,
          bounces: response.counters?.bounce || 0,
          unsubscribes: response.counters?.unsubscribed || 0,
          openRate:
            response.counters?.delivered > 0
              ? (response.counters?.open / response.counters?.delivered) * 100
              : 0,
          clickRate:
            response.counters?.open > 0
              ? (response.counters?.click / response.counters?.open) * 100
              : 0,
        },
      ];
    }

    return (response.objects || []).slice(0, 20).map((email: any) => ({
      campaignId: email.id,
      campaignName: email.name,
      sent: email.stats?.counters?.sent || 0,
      delivered: email.stats?.counters?.delivered || 0,
      opens: email.stats?.counters?.open || 0,
      clicks: email.stats?.counters?.click || 0,
      bounces: email.stats?.counters?.bounce || 0,
      unsubscribes: email.stats?.counters?.unsubscribed || 0,
      openRate: email.stats?.ratios?.openratio * 100 || 0,
      clickRate: email.stats?.ratios?.clickratio * 100 || 0,
    }));
  }

  async getLandingPages(credentials: OAuthCredentials): Promise<HubSpotLandingPage[]> {
    const response = await this.makeRequest(
      `${this.baseUrl}/cms/v3/pages/landing-pages?limit=50`,
      { method: 'GET' },
      credentials
    );

    return (response.results || []).map((page: any) => ({
      id: page.id,
      name: page.name,
      slug: page.slug,
      views: page.analytics?.pageViews || 0,
      submissions: page.analytics?.formSubmissions || 0,
      conversionRate:
        page.analytics?.pageViews > 0
          ? (page.analytics?.formSubmissions / page.analytics?.pageViews) * 100
          : 0,
      published: page.state === 'PUBLISHED',
    }));
  }

  async getForms(credentials: OAuthCredentials): Promise<HubSpotForm[]> {
    const response = await this.makeRequest(
      `${this.baseUrl}/marketing/v3/forms?limit=50`,
      { method: 'GET' },
      credentials
    );

    return (response.results || []).map((form: any) => ({
      id: form.id,
      name: form.name,
      submissions: form.performanceMetrics?.submissions || 0,
      views: form.performanceMetrics?.views,
      conversionRate:
        form.performanceMetrics?.views > 0
          ? (form.performanceMetrics?.submissions / form.performanceMetrics?.views) * 100
          : undefined,
    }));
  }

  async getListMembership(
    credentials: OAuthCredentials,
    listId: string
  ): Promise<{ listId: string; count: number; contacts: HubSpotContact[] }> {
    const response = await this.makeRequest(
      `${this.baseUrl}/contacts/v1/lists/${listId}/contacts/all?count=100`,
      { method: 'GET' },
      credentials
    );

    return {
      listId,
      count: response['has-more'] ? response.contacts.length + 1 : response.contacts.length,
      contacts: (response.contacts || []).map((contact: any) => ({
        id: contact.vid.toString(),
        email: contact.properties?.email?.value,
        firstName: contact.properties?.firstname?.value,
        lastName: contact.properties?.lastname?.value,
        lifecycleStage: contact.properties?.lifecyclestage?.value || 'subscriber',
        source: contact.properties?.hs_analytics_source?.value,
        createDate: new Date(contact.addedAt).toISOString(),
      })),
    };
  }

  async getMQLs(
    credentials: OAuthCredentials,
    dateRange?: { startDate: string; endDate: string }
  ): Promise<{ count: number; bySource: Record<string, number>; trend: any[] }> {
    const filters: any[] = [
      {
        propertyName: 'lifecyclestage',
        operator: 'EQ',
        value: 'marketingqualifiedlead',
      },
    ];

    if (dateRange) {
      filters.push({
        propertyName: 'hs_lifecyclestage_marketingqualifiedlead_date',
        operator: 'GTE',
        value: new Date(dateRange.startDate).getTime(),
      });
      filters.push({
        propertyName: 'hs_lifecyclestage_marketingqualifiedlead_date',
        operator: 'LTE',
        value: new Date(dateRange.endDate).getTime(),
      });
    }

    const response = await this.makeRequest(
      `${this.baseUrl}/crm/v3/objects/contacts/search`,
      {
        method: 'POST',
        body: JSON.stringify({
          filterGroups: [{ filters }],
          properties: ['hs_analytics_source'],
          limit: 100,
        }),
      },
      credentials
    );

    const contacts = response.results || [];
    const bySource: Record<string, number> = {};

    for (const contact of contacts) {
      const source = contact.properties.hs_analytics_source || 'Unknown';
      bySource[source] = (bySource[source] || 0) + 1;
    }

    return {
      count: response.total || contacts.length,
      bySource,
      trend: [], // Would need time-series aggregation
    };
  }

  async getWidgetData(
    widgetType: string,
    credentials: OAuthCredentials,
    options?: any
  ): Promise<any> {
    switch (widgetType) {
      case 'contact-growth':
        return this.getContactGrowthData(credentials);

      case 'email-performance':
        return this.getEmailPerformanceData(credentials);

      case 'landing-pages':
        return this.getLandingPages(credentials);

      case 'forms-performance':
        return this.getForms(credentials);

      case 'marketing-qualified-leads':
        return this.getMQLs(credentials, options?.dateRange);

      default:
        throw new Error(`Unknown widget type: ${widgetType}`);
    }
  }

  private async getContactGrowthData(credentials: OAuthCredentials) {
    const [byStage, recentContacts] = await Promise.all([
      this.getContactsByLifecycleStage(credentials),
      this.getContacts(credentials, undefined, 50),
    ]);

    const totalContacts = Object.values(byStage).reduce((a, b) => a + b, 0);

    const bySource: Record<string, number> = {};
    for (const contact of recentContacts) {
      const source = contact.source || 'Unknown';
      bySource[source] = (bySource[source] || 0) + 1;
    }

    return {
      total: totalContacts,
      byLifecycleStage: byStage,
      bySource,
      recentCount: recentContacts.length,
    };
  }

  private async getEmailPerformanceData(credentials: OAuthCredentials) {
    const emails = await this.getEmailAnalytics(credentials);

    const totals = emails.reduce(
      (acc, email) => ({
        sent: acc.sent + email.sent,
        delivered: acc.delivered + email.delivered,
        opens: acc.opens + email.opens,
        clicks: acc.clicks + email.clicks,
        bounces: acc.bounces + email.bounces,
        unsubscribes: acc.unsubscribes + email.unsubscribes,
      }),
      { sent: 0, delivered: 0, opens: 0, clicks: 0, bounces: 0, unsubscribes: 0 }
    );

    return {
      summary: {
        ...totals,
        openRate: totals.delivered > 0 ? (totals.opens / totals.delivered) * 100 : 0,
        clickRate: totals.opens > 0 ? (totals.clicks / totals.opens) * 100 : 0,
      },
      campaigns: emails.slice(0, 10),
    };
  }
}

export const hubspotMarketingConnector = new HubSpotMarketingConnector({});

