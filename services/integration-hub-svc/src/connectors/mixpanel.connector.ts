// @ts-nocheck
/**
 * Mixpanel Connector
 *
 * Authentication:
 * - Service Account or Project Secret
 */

import { BaseConnector, ConnectorConfig, ApiKeyCredentials } from './base.connector';

// ============================================================================
// Types
// ============================================================================

export interface MixpanelProject {
  id: string;
  name: string;
  token: string;
  timezone: string;
}

export interface EventData {
  event: string;
  count: number;
  users: number;
  trend: number;
}

export interface ActiveUsers {
  dau: number;
  wau: number;
  mau: number;
  dauTrend: number;
  wauTrend: number;
  mauTrend: number;
  dailyData: Array<{ date: string; users: number }>;
}

export interface RetentionData {
  cohort: string;
  size: number;
  retention: number[];
  avgRetention: number;
}

export interface FunnelStep {
  name: string;
  count: number;
  conversionRate: number;
  dropoff: number;
}

export interface FunnelData {
  id: string;
  name: string;
  steps: FunnelStep[];
  overallConversion: number;
  trend: number;
}

export interface Segment {
  id: string;
  name: string;
  count: number;
  growth: number;
  criteria: string;
}

export interface ProductAnalytics {
  activeUsers: ActiveUsers;
  topEvents: EventData[];
  featureAdoption: Array<{
    feature: string;
    users: number;
    percentOfMAU: number;
    trend: number;
  }>;
}

export interface DateRange {
  from: string;
  to: string;
}

// ============================================================================
// Mixpanel Connector
// ============================================================================

export class MixpanelConnector extends BaseConnector {
  readonly providerId = 'mixpanel';
  readonly displayName = 'Mixpanel';
  readonly category = 'analytics';

  private baseUrl = 'https://mixpanel.com/api/2.0';
  private dataUrl = 'https://data.mixpanel.com/api/2.0';

  // --------------------------------------------------------------------------
  // Supported Widgets
  // --------------------------------------------------------------------------

  readonly supportedWidgets = ['product-analytics', 'funnel-analysis', 'user-segments'];

  // --------------------------------------------------------------------------
  // Auth Configuration
  // --------------------------------------------------------------------------

  getOAuthConfig(): ConnectorConfig['oauth'] {
    // Mixpanel uses service accounts/API keys, not OAuth
    return undefined;
  }

  getApiKeyConfig(): { headerName: string; prefix?: string } {
    return {
      headerName: 'Authorization',
      prefix: 'Basic',
    };
  }

  // --------------------------------------------------------------------------
  // Connection Management
  // --------------------------------------------------------------------------

  async testConnection(credentials: ApiKeyCredentials): Promise<boolean> {
    try {
      await this.makeRequest('/engage', credentials, {
        method: 'POST',
        body: JSON.stringify({ limit: 1 }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async getAccountInfo(credentials: ApiKeyCredentials): Promise<{
    id: string;
    name: string;
  }> {
    return {
      id: credentials.projectId || 'mixpanel',
      name: 'Mixpanel Project',
    };
  }

  // --------------------------------------------------------------------------
  // API Methods
  // --------------------------------------------------------------------------

  /**
   * Query events data
   */
  async queryEvents(
    credentials: ApiKeyCredentials,
    event: string | string[],
    dateRange: DateRange,
    options?: {
      unit?: 'hour' | 'day' | 'week' | 'month';
      type?: 'general' | 'unique' | 'average';
    }
  ): Promise<EventData[]> {
    const events = Array.isArray(event) ? event : [event];
    const params = new URLSearchParams({
      event: JSON.stringify(events),
      from_date: dateRange.from,
      to_date: dateRange.to,
      unit: options?.unit || 'day',
      type: options?.type || 'general',
    });

    const response = await this.makeRequest<{
      data: { values: Record<string, Record<string, number>> };
    }>(`/events?${params}`, credentials);

    return Object.entries(response.data.values).map(([eventName, values]) => {
      const counts = Object.values(values);
      const total = counts.reduce((sum, c) => sum + c, 0);
      const previousTotal = counts
        .slice(0, Math.floor(counts.length / 2))
        .reduce((sum, c) => sum + c, 0);
      const currentTotal = counts
        .slice(Math.floor(counts.length / 2))
        .reduce((sum, c) => sum + c, 0);

      return {
        event: eventName,
        count: total,
        users: 0, // Would need separate query for unique users
        trend: previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0,
      };
    });
  }

  /**
   * Get funnel data
   */
  async getFunnel(
    credentials: ApiKeyCredentials,
    funnelId: string,
    dateRange: DateRange
  ): Promise<FunnelData> {
    const params = new URLSearchParams({
      funnel_id: funnelId,
      from_date: dateRange.from,
      to_date: dateRange.to,
    });

    const response = await this.makeRequest<{
      data: {
        name: string;
        steps: Array<{
          step_label: string;
          count: number;
          step_conv_ratio: number;
          overall_conv_ratio: number;
        }>;
      };
    }>(`/funnels?${params}`, credentials);

    const steps = response.data.steps.map((step, index) => {
      const prevCount = index > 0 ? response.data.steps[index - 1].count : step.count;
      return {
        name: step.step_label,
        count: step.count,
        conversionRate: step.step_conv_ratio * 100,
        dropoff: prevCount - step.count,
      };
    });

    return {
      id: funnelId,
      name: response.data.name,
      steps,
      overallConversion:
        steps.length > 0 ? (steps[steps.length - 1].count / steps[0].count) * 100 : 0,
      trend: 0, // Would need historical comparison
    };
  }

  /**
   * Get retention data
   */
  async getRetention(
    credentials: ApiKeyCredentials,
    event: string,
    dateRange: DateRange,
    options?: {
      retentionType?: 'birth' | 'compounded';
      unit?: 'day' | 'week' | 'month';
    }
  ): Promise<RetentionData[]> {
    const params = new URLSearchParams({
      born_event: event,
      event,
      from_date: dateRange.from,
      to_date: dateRange.to,
      retention_type: options?.retentionType || 'birth',
      unit: options?.unit || 'day',
    });

    const response = await this.makeRequest<{
      data: Record<string, { counts: number[]; first: number }>;
    }>(`/retention?${params}`, credentials);

    return Object.entries(response.data).map(([cohort, data]) => {
      const retention = data.counts.map((count, i) => (i === 0 ? 100 : (count / data.first) * 100));

      return {
        cohort,
        size: data.first,
        retention,
        avgRetention:
          retention.slice(1).reduce((sum, r) => sum + r, 0) / (retention.length - 1) || 0,
      };
    });
  }

  /**
   * Get segments/cohorts
   */
  async getSegments(credentials: ApiKeyCredentials): Promise<Segment[]> {
    const response = await this.makeRequest<{
      results: Array<{
        id: string;
        name: string;
        count: number;
        created: string;
      }>;
    }>('/cohorts/list', credentials);

    return response.results.map((segment) => ({
      id: segment.id,
      name: segment.name,
      count: segment.count,
      growth: 0, // Would need historical comparison
      criteria: '', // Would need separate query
    }));
  }

  /**
   * Get active users (DAU, WAU, MAU)
   */
  async getActiveUsers(credentials: ApiKeyCredentials, dateRange: DateRange): Promise<ActiveUsers> {
    const [daily, weekly, monthly] = await Promise.all([
      this.queryEvents(credentials, '$session_start', dateRange, { type: 'unique', unit: 'day' }),
      this.queryEvents(credentials, '$session_start', dateRange, { type: 'unique', unit: 'week' }),
      this.queryEvents(credentials, '$session_start', dateRange, { type: 'unique', unit: 'month' }),
    ]);

    // Get detailed daily data for chart
    const params = new URLSearchParams({
      event: JSON.stringify(['$session_start']),
      from_date: dateRange.from,
      to_date: dateRange.to,
      type: 'unique',
      unit: 'day',
    });

    const dailyResponse = await this.makeRequest<{
      data: { values: Record<string, Record<string, number>> };
    }>(`/events?${params}`, credentials);

    const dailyValues = Object.values(dailyResponse.data.values)[0] || {};
    const dailyData = Object.entries(dailyValues).map(([date, users]) => ({
      date,
      users,
    }));

    // Calculate current values (last day, week, month)
    const sortedDaily = dailyData.sort((a, b) => b.date.localeCompare(a.date));
    const dau = sortedDaily[0]?.users || 0;
    const prevDau = sortedDaily[1]?.users || 0;

    return {
      dau,
      wau: weekly[0]?.count || 0,
      mau: monthly[0]?.count || 0,
      dauTrend: prevDau > 0 ? ((dau - prevDau) / prevDau) * 100 : 0,
      wauTrend: weekly[0]?.trend || 0,
      mauTrend: monthly[0]?.trend || 0,
      dailyData,
    };
  }

  // --------------------------------------------------------------------------
  // Widget Data Methods
  // --------------------------------------------------------------------------

  /**
   * Fetch data for any supported widget
   */
  async getWidgetData(
    widgetType: string,
    credentials: ApiKeyCredentials,
    config: { dateRange?: DateRange; funnelId?: string }
  ): Promise<unknown> {
    const dateRange = config.dateRange || {
      from: this.getDateString(-30),
      to: this.getDateString(0),
    };

    switch (widgetType) {
      case 'product-analytics':
        return this.getProductAnalytics(credentials, dateRange);
      case 'funnel-analysis':
        if (!config.funnelId) throw new Error('funnelId required for funnel-analysis');
        return this.getFunnel(credentials, config.funnelId, dateRange);
      case 'user-segments':
        return this.getSegments(credentials);
      default:
        throw new Error(`Unsupported widget type: ${widgetType}`);
    }
  }

  /**
   * Get comprehensive product analytics
   */
  async getProductAnalytics(
    credentials: ApiKeyCredentials,
    dateRange: DateRange
  ): Promise<ProductAnalytics> {
    const [activeUsers, topEvents] = await Promise.all([
      this.getActiveUsers(credentials, dateRange),
      this.queryEvents(credentials, [], dateRange), // Empty array gets all events
    ]);

    // Calculate feature adoption based on top events
    const featureEvents = topEvents.filter((e) => !e.event.startsWith('$')).slice(0, 10);

    const featureAdoption = featureEvents.map((event) => ({
      feature: event.event,
      users: event.users || event.count,
      percentOfMAU:
        activeUsers.mau > 0 ? ((event.users || event.count) / activeUsers.mau) * 100 : 0,
      trend: event.trend,
    }));

    return {
      activeUsers,
      topEvents: topEvents.slice(0, 20),
      featureAdoption,
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

  private async makeRequest<T>(
    endpoint: string,
    credentials: ApiKeyCredentials,
    options: RequestInit = {}
  ): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

    // Mixpanel uses Basic auth with service account
    const authString = Buffer.from(`${credentials.apiKey}:`).toString('base64');

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Basic ${authString}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Mixpanel API error: ${response.status} - ${error.error || response.statusText}`
      );
    }

    return response.json();
  }
}

// Export singleton instance
export const mixpanelConnector = new MixpanelConnector();

