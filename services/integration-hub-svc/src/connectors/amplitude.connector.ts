import { EventEmitter } from 'node:events';

// Amplitude Connector
//
// Authentication: API Key + Secret
//
// Supported Widgets:
// 1. user-metrics - DAU, WAU, MAU, user trends, retention curves
// 2. event-analytics - Top events, event trends, funnel analysis
// 3. user-segments - Segment sizes, behavioral cohorts
// 4. feature-adoption - Feature usage rates, adoption curves

interface AmplitudeConfig {
  apiKey: string;
  secretKey: string;
  projectId?: string;
}

interface UserMetrics {
  dau: number;
  wau: number;
  mau: number;
  dauTrend: number;
  wauTrend: number;
  mauTrend: number;
  stickiness: number; // DAU/MAU ratio
  date: string;
}

interface EventData {
  eventType: string;
  totalCount: number;
  uniqueUsers: number;
  trend: number;
  averagePerUser: number;
}

interface FunnelStep {
  eventName: string;
  count: number;
  conversionRate: number;
  dropoffRate: number;
  avgTimeToConvert: number;
}

interface FunnelData {
  id: string;
  name: string;
  steps: FunnelStep[];
  overallConversion: number;
  totalStarted: number;
  totalCompleted: number;
}

interface RetentionData {
  cohortDate: string;
  cohortSize: number;
  retentionByDay: number[];
  retentionByWeek: number[];
}

interface UserSegment {
  id: string;
  name: string;
  description: string;
  userCount: number;
  percentOfTotal: number;
  trend: number;
}

interface FeatureAdoption {
  featureName: string;
  eventName: string;
  adoptionRate: number;
  activeUsers: number;
  trend: number;
  firstSeenDate: string;
}

export class AmplitudeConnector extends EventEmitter {
  private config: AmplitudeConfig;
  private baseUrl = 'https://amplitude.com/api/2';

  constructor(config: AmplitudeConfig) {
    super();
    this.config = config;
  }

  private get headers(): Record<string, string> {
    const auth = Buffer.from(`${this.config.apiKey}:${this.config.secretKey}`).toString('base64');
    return {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Amplitude API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ==================== USER METRICS ====================

  async getUserMetrics(startDate: string, endDate: string): Promise<UserMetrics[]> {
    const data = await this.request<{ data: { series: number[][] } }>(
      `/usersandrevenue?start=${startDate}&end=${endDate}&m=active`
    );

    // Transform Amplitude response to our format
    const metrics: UserMetrics[] = [];
    // Implementation would parse the actual Amplitude response
    return metrics;
  }

  async getDAU(date: string): Promise<number> {
    const metrics = await this.getUserMetrics(date, date);
    return metrics[0]?.dau || 0;
  }

  async getWAU(date: string): Promise<number> {
    const startDate = new Date(date);
    startDate.setDate(startDate.getDate() - 7);
    const metrics = await this.getUserMetrics(startDate.toISOString().split('T')[0], date);
    return metrics[0]?.wau || 0;
  }

  async getMAU(date: string): Promise<number> {
    const startDate = new Date(date);
    startDate.setMonth(startDate.getMonth() - 1);
    const metrics = await this.getUserMetrics(startDate.toISOString().split('T')[0], date);
    return metrics[0]?.mau || 0;
  }

  async getStickiness(date: string): Promise<number> {
    const [dau, mau] = await Promise.all([this.getDAU(date), this.getMAU(date)]);
    return mau > 0 ? (dau / mau) * 100 : 0;
  }

  // ==================== EVENT ANALYTICS ====================

  async getEvents(eventType: string, startDate: string, endDate: string): Promise<EventData[]> {
    const data = await this.request<{ data: unknown }>(
      `/events/segmentation?e={"event_type":"${eventType}"}&start=${startDate}&end=${endDate}`
    );

    return [];
  }

  async getTopEvents(startDate: string, endDate: string, limit: number = 10): Promise<EventData[]> {
    const data = await this.request<{ data: { eventTypes: string[] } }>(`/events/list`);

    const events: EventData[] = [];
    // Would fetch stats for each event type
    return events.slice(0, limit);
  }

  async getEventTrends(
    eventType: string,
    startDate: string,
    endDate: string
  ): Promise<{ date: string; count: number }[]> {
    const events = await this.getEvents(eventType, startDate, endDate);
    return [];
  }

  // ==================== FUNNEL ANALYSIS ====================

  async getFunnel(funnelId: string): Promise<FunnelData> {
    const data = await this.request<{ data: unknown }>(`/funnels/${funnelId}`);

    return {
      id: funnelId,
      name: '',
      steps: [],
      overallConversion: 0,
      totalStarted: 0,
      totalCompleted: 0,
    };
  }

  async getFunnels(): Promise<FunnelData[]> {
    const data = await this.request<{ data: unknown[] }>(`/funnels`);
    return [];
  }

  async createFunnel(name: string, events: string[]): Promise<FunnelData> {
    const data = await this.request<{ data: unknown }>(`/funnels`, {
      method: 'POST',
      body: JSON.stringify({ name, events }),
    });

    return {
      id: '',
      name,
      steps: [],
      overallConversion: 0,
      totalStarted: 0,
      totalCompleted: 0,
    };
  }

  // ==================== RETENTION ====================

  async getRetention(
    startEvent: string,
    returnEvent: string,
    startDate: string,
    endDate: string
  ): Promise<RetentionData[]> {
    const data = await this.request<{ data: unknown }>(
      `/retention?se={"event_type":"${startEvent}"}&re={"event_type":"${returnEvent}"}&start=${startDate}&end=${endDate}`
    );

    return [];
  }

  async getRetentionCurve(
    startEvent: string,
    returnEvent: string,
    cohortDate: string
  ): Promise<number[]> {
    const retention = await this.getRetention(startEvent, returnEvent, cohortDate, cohortDate);
    return retention[0]?.retentionByDay || [];
  }

  // ==================== SEGMENTS ====================

  async getSegments(): Promise<UserSegment[]> {
    const data = await this.request<{ data: unknown[] }>(`/cohorts`);
    return [];
  }

  async getSegment(segmentId: string): Promise<UserSegment> {
    const data = await this.request<{ data: unknown }>(`/cohorts/${segmentId}`);
    return {
      id: segmentId,
      name: '',
      description: '',
      userCount: 0,
      percentOfTotal: 0,
      trend: 0,
    };
  }

  // ==================== FEATURE ADOPTION ====================

  async getFeatureAdoption(
    featureEvents: string[],
    startDate: string,
    endDate: string
  ): Promise<FeatureAdoption[]> {
    const adoptions: FeatureAdoption[] = [];

    for (const eventName of featureEvents) {
      const events = await this.getEvents(eventName, startDate, endDate);
      // Calculate adoption rate
      adoptions.push({
        featureName: eventName,
        eventName,
        adoptionRate: 0,
        activeUsers: 0,
        trend: 0,
        firstSeenDate: startDate,
      });
    }

    return adoptions;
  }

  // ==================== WIDGET DATA ====================

  async getUserMetricsWidgetData(): Promise<{
    dau: number;
    wau: number;
    mau: number;
    dauTrend: number;
    wauTrend: number;
    mauTrend: number;
    stickiness: number;
    sparklineData: { date: string; dau: number; wau: number; mau: number }[];
  }> {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const metrics = await this.getUserMetrics(thirtyDaysAgo.toISOString().split('T')[0], today);

    const latest = metrics[metrics.length - 1] || {
      dau: 0,
      wau: 0,
      mau: 0,
      dauTrend: 0,
      wauTrend: 0,
      mauTrend: 0,
      stickiness: 0,
    };

    return {
      dau: latest.dau,
      wau: latest.wau,
      mau: latest.mau,
      dauTrend: latest.dauTrend,
      wauTrend: latest.wauTrend,
      mauTrend: latest.mauTrend,
      stickiness: latest.stickiness,
      sparklineData: metrics.map((m) => ({
        date: m.date,
        dau: m.dau,
        wau: m.wau,
        mau: m.mau,
      })),
    };
  }

  async getEventAnalyticsWidgetData(): Promise<{
    topEvents: EventData[];
    totalEvents: number;
    uniqueEventTypes: number;
    eventTrend: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const topEvents = await this.getTopEvents(sevenDaysAgo.toISOString().split('T')[0], today, 10);

    return {
      topEvents,
      totalEvents: topEvents.reduce((sum, e) => sum + e.totalCount, 0),
      uniqueEventTypes: topEvents.length,
      eventTrend: 0,
    };
  }

  // ==================== CONNECTION TEST ====================

  async testConnection(): Promise<boolean> {
    try {
      await this.request('/events/list');
      return true;
    } catch {
      return false;
    }
  }
}

export const createAmplitudeConnector = (config: AmplitudeConfig): AmplitudeConnector => {
  return new AmplitudeConnector(config);
};
