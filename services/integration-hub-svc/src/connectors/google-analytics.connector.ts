// @ts-nocheck
/**
 * Google Analytics 4 Connector
 *
 * OAuth Configuration:
 * - Google OAuth 2.0
 * - scopes: analytics.readonly
 */

import { BaseConnector, ConnectorConfig, OAuthCredentials } from './base.connector';

// ============================================================================
// Types
// ============================================================================

export interface GA4Property {
  propertyId: string;
  displayName: string;
  industryCategory: string;
  timeZone: string;
  currencyCode: string;
  createTime: string;
}

export interface GA4Dimension {
  name: string;
}

export interface GA4Metric {
  name: string;
}

export interface GA4DateRange {
  startDate: string; // YYYY-MM-DD or 'today', 'yesterday', 'NdaysAgo'
  endDate: string;
}

export interface GA4ReportRow {
  dimensionValues: Array<{ value: string }>;
  metricValues: Array<{ value: string }>;
}

export interface GA4ReportResponse {
  rows: GA4ReportRow[];
  rowCount: number;
  metadata: {
    currencyCode: string;
    timeZone: string;
  };
}

export interface TrafficOverview {
  sessions: number;
  users: number;
  pageviews: number;
  avgSessionDuration: number;
  bounceRate: number;
  trend: {
    sessions: number;
    users: number;
    pageviews: number;
  };
  bySource: Array<{
    source: string;
    medium: string;
    sessions: number;
    users: number;
  }>;
}

export interface AcquisitionChannel {
  channel: string;
  sessions: number;
  users: number;
  newUsers: number;
  conversions: number;
  conversionRate: number;
  trend: number;
}

export interface TopPage {
  pagePath: string;
  pageTitle: string;
  pageviews: number;
  uniquePageviews: number;
  avgTimeOnPage: number;
  bounceRate: number;
  conversionRate: number;
}

export interface UserBehavior {
  avgEngagementTime: number;
  bounceRate: number;
  pagesPerSession: number;
  engagedSessions: number;
  engagementRate: number;
  trends: {
    engagementTime: number;
    bounceRate: number;
    pagesPerSession: number;
  };
}

export interface Conversion {
  eventName: string;
  conversions: number;
  conversionRate: number;
  conversionValue: number;
  trend: number;
}

export interface RealtimeData {
  activeUsers: number;
  pageviews: number;
  topPages: Array<{ path: string; users: number }>;
  topSources: Array<{ source: string; users: number }>;
  topCountries: Array<{ country: string; users: number }>;
}

// ============================================================================
// Google Analytics Connector
// ============================================================================

export class GoogleAnalyticsConnector extends BaseConnector {
  readonly providerId = 'google-analytics';
  readonly displayName = 'Google Analytics 4';
  readonly category = 'analytics';

  private baseUrl = 'https://analyticsdata.googleapis.com/v1beta';
  private adminUrl = 'https://analyticsadmin.googleapis.com/v1beta';

  // --------------------------------------------------------------------------
  // Supported Widgets
  // --------------------------------------------------------------------------

  readonly supportedWidgets = [
    'traffic-overview',
    'acquisition-channels',
    'top-pages',
    'user-behavior',
    'conversions',
  ];

  // --------------------------------------------------------------------------
  // OAuth Configuration
  // --------------------------------------------------------------------------

  getOAuthConfig(): ConnectorConfig['oauth'] {
    return {
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
      additionalParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    };
  }

  // --------------------------------------------------------------------------
  // Connection Management
  // --------------------------------------------------------------------------

  async testConnection(credentials: OAuthCredentials): Promise<boolean> {
    try {
      const properties = await this.getProperties(credentials);
      return properties.length > 0;
    } catch {
      return false;
    }
  }

  async getAccountInfo(credentials: OAuthCredentials): Promise<{
    id: string;
    name: string;
    email?: string;
  }> {
    const properties = await this.getProperties(credentials);
    const primary = properties[0];

    return {
      id: primary?.propertyId || 'unknown',
      name: primary?.displayName || 'Google Analytics',
    };
  }

  // --------------------------------------------------------------------------
  // API Methods
  // --------------------------------------------------------------------------

  /**
   * Get all GA4 properties accessible to the user
   */
  async getProperties(credentials: OAuthCredentials): Promise<GA4Property[]> {
    const response = await this.makeRequest<{ properties: GA4Property[] }>(
      `${this.adminUrl}/properties`,
      credentials,
      { method: 'GET' }
    );

    return response.properties || [];
  }

  /**
   * Run a GA4 report with custom dimensions and metrics
   */
  async runReport(
    credentials: OAuthCredentials,
    propertyId: string,
    dimensions: string[],
    metrics: string[],
    dateRange: GA4DateRange,
    options?: {
      orderBys?: Array<{ dimension?: string; metric?: string; desc?: boolean }>;
      limit?: number;
      offset?: number;
    }
  ): Promise<GA4ReportResponse> {
    const requestBody = {
      dateRanges: [dateRange],
      dimensions: dimensions.map((name) => ({ name })),
      metrics: metrics.map((name) => ({ name })),
      orderBys: options?.orderBys?.map((ob) => ({
        ...(ob.dimension ? { dimension: { dimensionName: ob.dimension } } : {}),
        ...(ob.metric ? { metric: { metricName: ob.metric } } : {}),
        desc: ob.desc ?? true,
      })),
      limit: options?.limit,
      offset: options?.offset,
    };

    return this.makeRequest<GA4ReportResponse>(
      `${this.baseUrl}/properties/${propertyId}:runReport`,
      credentials,
      {
        method: 'POST',
        body: JSON.stringify(requestBody),
      }
    );
  }

  /**
   * Get real-time analytics data
   */
  async getRealtimeData(credentials: OAuthCredentials, propertyId: string): Promise<RealtimeData> {
    const [users, pages, sources, countries] = await Promise.all([
      this.makeRequest<{ rows?: GA4ReportRow[] }>(
        `${this.baseUrl}/properties/${propertyId}:runRealtimeReport`,
        credentials,
        {
          method: 'POST',
          body: JSON.stringify({
            metrics: [{ name: 'activeUsers' }],
          }),
        }
      ),
      this.makeRequest<{ rows?: GA4ReportRow[] }>(
        `${this.baseUrl}/properties/${propertyId}:runRealtimeReport`,
        credentials,
        {
          method: 'POST',
          body: JSON.stringify({
            dimensions: [{ name: 'unifiedScreenName' }],
            metrics: [{ name: 'activeUsers' }],
            limit: 10,
          }),
        }
      ),
      this.makeRequest<{ rows?: GA4ReportRow[] }>(
        `${this.baseUrl}/properties/${propertyId}:runRealtimeReport`,
        credentials,
        {
          method: 'POST',
          body: JSON.stringify({
            dimensions: [{ name: 'source' }],
            metrics: [{ name: 'activeUsers' }],
            limit: 10,
          }),
        }
      ),
      this.makeRequest<{ rows?: GA4ReportRow[] }>(
        `${this.baseUrl}/properties/${propertyId}:runRealtimeReport`,
        credentials,
        {
          method: 'POST',
          body: JSON.stringify({
            dimensions: [{ name: 'country' }],
            metrics: [{ name: 'activeUsers' }],
            limit: 10,
          }),
        }
      ),
    ]);

    return {
      activeUsers: Number.parseInt(users.rows?.[0]?.metricValues[0]?.value || '0', 10),
      pageviews: 0, // GA4 realtime doesn't have pageviews directly
      topPages: (pages.rows || []).map((row) => ({
        path: row.dimensionValues[0].value,
        users: Number.parseInt(row.metricValues[0].value, 10),
      })),
      topSources: (sources.rows || []).map((row) => ({
        source: row.dimensionValues[0].value,
        users: Number.parseInt(row.metricValues[0].value, 10),
      })),
      topCountries: (countries.rows || []).map((row) => ({
        country: row.dimensionValues[0].value,
        users: Number.parseInt(row.metricValues[0].value, 10),
      })),
    };
  }

  /**
   * Get conversion data
   */
  async getConversions(
    credentials: OAuthCredentials,
    propertyId: string,
    dateRange: GA4DateRange
  ): Promise<Conversion[]> {
    const [current, previous] = await Promise.all([
      this.runReport(
        credentials,
        propertyId,
        ['eventName'],
        ['conversions', 'totalRevenue'],
        dateRange
      ),
      this.runReport(
        credentials,
        propertyId,
        ['eventName'],
        ['conversions', 'totalRevenue'],
        this.getPreviousPeriod(dateRange)
      ),
    ]);

    const previousMap = new Map(
      (previous.rows || []).map((row) => [
        row.dimensionValues[0].value,
        Number.parseInt(row.metricValues[0].value, 10),
      ])
    );

    return (current.rows || []).map((row) => {
      const eventName = row.dimensionValues[0].value;
      const conversions = Number.parseInt(row.metricValues[0].value, 10);
      const previousConversions = previousMap.get(eventName) || 0;
      const trend =
        previousConversions > 0
          ? ((conversions - previousConversions) / previousConversions) * 100
          : 0;

      return {
        eventName,
        conversions,
        conversionRate: 0, // Would need session data to calculate
        conversionValue: parseFloat(row.metricValues[1].value),
        trend,
      };
    });
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
    config: { propertyId: string; dateRange?: GA4DateRange }
  ): Promise<unknown> {
    const dateRange = config.dateRange || { startDate: '30daysAgo', endDate: 'today' };

    switch (widgetType) {
      case 'traffic-overview':
        return this.getTrafficOverview(credentials, config.propertyId, dateRange);
      case 'acquisition-channels':
        return this.getAcquisitionChannels(credentials, config.propertyId, dateRange);
      case 'top-pages':
        return this.getTopPages(credentials, config.propertyId, dateRange);
      case 'user-behavior':
        return this.getUserBehavior(credentials, config.propertyId, dateRange);
      case 'conversions':
        return this.getConversions(credentials, config.propertyId, dateRange);
      default:
        throw new Error(`Unsupported widget type: ${widgetType}`);
    }
  }

  /**
   * Get traffic overview data
   */
  async getTrafficOverview(
    credentials: OAuthCredentials,
    propertyId: string,
    dateRange: GA4DateRange
  ): Promise<TrafficOverview> {
    const [current, previous, bySource] = await Promise.all([
      this.runReport(
        credentials,
        propertyId,
        [],
        ['sessions', 'totalUsers', 'screenPageViews', 'averageSessionDuration', 'bounceRate'],
        dateRange
      ),
      this.runReport(
        credentials,
        propertyId,
        [],
        ['sessions', 'totalUsers', 'screenPageViews'],
        this.getPreviousPeriod(dateRange)
      ),
      this.runReport(
        credentials,
        propertyId,
        ['sessionSource', 'sessionMedium'],
        ['sessions', 'totalUsers'],
        dateRange,
        { limit: 10, orderBys: [{ metric: 'sessions', desc: true }] }
      ),
    ]);

    const currentRow = current.rows?.[0];
    const previousRow = previous.rows?.[0];

    const sessions = Number.parseInt(currentRow?.metricValues[0]?.value || '0', 10);
    const users = Number.parseInt(currentRow?.metricValues[1]?.value || '0', 10);
    const pageviews = Number.parseInt(currentRow?.metricValues[2]?.value || '0', 10);

    const prevSessions = Number.parseInt(previousRow?.metricValues[0]?.value || '0', 10);
    const prevUsers = Number.parseInt(previousRow?.metricValues[1]?.value || '0', 10);
    const prevPageviews = Number.parseInt(previousRow?.metricValues[2]?.value || '0', 10);

    return {
      sessions,
      users,
      pageviews,
      avgSessionDuration: parseFloat(currentRow?.metricValues[3]?.value || '0'),
      bounceRate: parseFloat(currentRow?.metricValues[4]?.value || '0'),
      trend: {
        sessions: this.calculateTrend(sessions, prevSessions),
        users: this.calculateTrend(users, prevUsers),
        pageviews: this.calculateTrend(pageviews, prevPageviews),
      },
      bySource: (bySource.rows || []).map((row) => ({
        source: row.dimensionValues[0].value,
        medium: row.dimensionValues[1].value,
        sessions: Number.parseInt(row.metricValues[0].value, 10),
        users: Number.parseInt(row.metricValues[1].value, 10),
      })),
    };
  }

  /**
   * Get acquisition channels data
   */
  async getAcquisitionChannels(
    credentials: OAuthCredentials,
    propertyId: string,
    dateRange: GA4DateRange
  ): Promise<AcquisitionChannel[]> {
    const [current, previous] = await Promise.all([
      this.runReport(
        credentials,
        propertyId,
        ['sessionDefaultChannelGroup'],
        ['sessions', 'totalUsers', 'newUsers', 'conversions'],
        dateRange,
        { orderBys: [{ metric: 'sessions', desc: true }] }
      ),
      this.runReport(
        credentials,
        propertyId,
        ['sessionDefaultChannelGroup'],
        ['sessions'],
        this.getPreviousPeriod(dateRange)
      ),
    ]);

    const previousMap = new Map(
      (previous.rows || []).map((row) => [
        row.dimensionValues[0].value,
        Number.parseInt(row.metricValues[0].value, 10),
      ])
    );

    return (current.rows || []).map((row) => {
      const channel = row.dimensionValues[0].value;
      const sessions = Number.parseInt(row.metricValues[0].value, 10);
      const conversions = Number.parseInt(row.metricValues[3].value, 10);
      const prevSessions = previousMap.get(channel) || 0;

      return {
        channel,
        sessions,
        users: Number.parseInt(row.metricValues[1].value, 10),
        newUsers: Number.parseInt(row.metricValues[2].value, 10),
        conversions,
        conversionRate: sessions > 0 ? (conversions / sessions) * 100 : 0,
        trend: this.calculateTrend(sessions, prevSessions),
      };
    });
  }

  /**
   * Get top pages data
   */
  async getTopPages(
    credentials: OAuthCredentials,
    propertyId: string,
    dateRange: GA4DateRange,
    limit = 20
  ): Promise<TopPage[]> {
    const report = await this.runReport(
      credentials,
      propertyId,
      ['pagePath', 'pageTitle'],
      ['screenPageViews', 'userEngagementDuration', 'bounceRate', 'conversions'],
      dateRange,
      { limit, orderBys: [{ metric: 'screenPageViews', desc: true }] }
    );

    return (report.rows || []).map((row) => {
      const pageviews = Number.parseInt(row.metricValues[0].value, 10);
      const conversions = Number.parseInt(row.metricValues[3].value, 10);

      return {
        pagePath: row.dimensionValues[0].value,
        pageTitle: row.dimensionValues[1].value,
        pageviews,
        uniquePageviews: pageviews, // GA4 doesn't have unique pageviews
        avgTimeOnPage: parseFloat(row.metricValues[1].value),
        bounceRate: parseFloat(row.metricValues[2].value),
        conversionRate: pageviews > 0 ? (conversions / pageviews) * 100 : 0,
      };
    });
  }

  /**
   * Get user behavior data
   */
  async getUserBehavior(
    credentials: OAuthCredentials,
    propertyId: string,
    dateRange: GA4DateRange
  ): Promise<UserBehavior> {
    const [current, previous] = await Promise.all([
      this.runReport(
        credentials,
        propertyId,
        [],
        [
          'userEngagementDuration',
          'bounceRate',
          'screenPageViewsPerSession',
          'engagedSessions',
          'engagementRate',
        ],
        dateRange
      ),
      this.runReport(
        credentials,
        propertyId,
        [],
        ['userEngagementDuration', 'bounceRate', 'screenPageViewsPerSession'],
        this.getPreviousPeriod(dateRange)
      ),
    ]);

    const currentRow = current.rows?.[0];
    const previousRow = previous.rows?.[0];

    const avgEngagementTime = parseFloat(currentRow?.metricValues[0]?.value || '0');
    const bounceRate = parseFloat(currentRow?.metricValues[1]?.value || '0');
    const pagesPerSession = parseFloat(currentRow?.metricValues[2]?.value || '0');

    const prevEngagementTime = parseFloat(previousRow?.metricValues[0]?.value || '0');
    const prevBounceRate = parseFloat(previousRow?.metricValues[1]?.value || '0');
    const prevPagesPerSession = parseFloat(previousRow?.metricValues[2]?.value || '0');

    return {
      avgEngagementTime,
      bounceRate,
      pagesPerSession,
      engagedSessions: Number.parseInt(currentRow?.metricValues[3]?.value || '0', 10),
      engagementRate: parseFloat(currentRow?.metricValues[4]?.value || '0'),
      trends: {
        engagementTime: this.calculateTrend(avgEngagementTime, prevEngagementTime),
        bounceRate: this.calculateTrend(bounceRate, prevBounceRate),
        pagesPerSession: this.calculateTrend(pagesPerSession, prevPagesPerSession),
      },
    };
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  private getPreviousPeriod(dateRange: GA4DateRange): GA4DateRange {
    // Simple implementation - calculate based on 'NdaysAgo' format
    if (dateRange.startDate.includes('daysAgo')) {
      const days = Number.parseInt(dateRange.startDate.replace('daysAgo', ''), 10);
      return {
        startDate: `${days * 2}daysAgo`,
        endDate: `${days + 1}daysAgo`,
      };
    }

    // For specific dates, calculate the period length and shift back
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    const periodLength = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);

    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - periodLength);

    return {
      startDate: prevStart.toISOString().split('T')[0],
      endDate: prevEnd.toISOString().split('T')[0],
    };
  }

  private calculateTrend(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  private async makeRequest<T>(
    url: string,
    credentials: OAuthCredentials,
    options: RequestInit
  ): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `GA4 API error: ${response.status} - ${error.error?.message || response.statusText}`
      );
    }

    return response.json();
  }
}

// Export singleton instance
export const googleAnalyticsConnector = new GoogleAnalyticsConnector();

