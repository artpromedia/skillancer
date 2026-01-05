import { EventEmitter } from 'node:events';

// Heap Connector
//
// Authentication: API Key
//
// Supported Widgets:
// - user-metrics - DAU, WAU, MAU, user trends
// - event-analytics - Auto-captured events, funnels
// - retention - User retention curves
// - Heap-specific auto-capture features

interface HeapConfig {
  apiKey: string;
  appId: string;
}

interface UserMetrics {
  date: string;
  dau: number;
  wau: number;
  mau: number;
  newUsers: number;
  returningUsers: number;
}

interface HeapEvent {
  id: string;
  name: string;
  type: 'pageview' | 'click' | 'change' | 'submit' | 'custom';
  count: number;
  uniqueUsers: number;
  properties: Record<string, unknown>;
}

interface HeapFunnel {
  id: string;
  name: string;
  steps: {
    name: string;
    count: number;
    conversionRate: number;
  }[];
  overallConversion: number;
}

interface HeapRetention {
  cohortDate: string;
  cohortSize: number;
  retentionWeeks: number[];
}

interface HeapSegment {
  id: string;
  name: string;
  userCount: number;
  definition: unknown;
}

export class HeapConnector extends EventEmitter {
  private config: HeapConfig;
  private baseUrl = 'https://heapanalytics.com/api';

  constructor(config: HeapConfig) {
    super();
    this.config = config;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
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
      throw new Error(`Heap API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ==================== USER METRICS ====================

  async getUsers(startDate: string, endDate: string): Promise<UserMetrics[]> {
    const data = await this.request<{ results: unknown[] }>(
      `/track/users?app_id=${this.config.appId}&start=${startDate}&end=${endDate}`
    );

    return [];
  }

  async getActiveUsers(date: string): Promise<{
    dau: number;
    wau: number;
    mau: number;
  }> {
    const metrics = await this.getUsers(date, date);
    const latest = metrics[0];

    return {
      dau: latest?.dau || 0,
      wau: latest?.wau || 0,
      mau: latest?.mau || 0,
    };
  }

  async getNewUsers(startDate: string, endDate: string): Promise<number> {
    const users = await this.getUsers(startDate, endDate);
    return users.reduce((sum, u) => sum + u.newUsers, 0);
  }

  // ==================== EVENTS ====================

  async getEvents(startDate: string, endDate: string): Promise<HeapEvent[]> {
    const data = await this.request<{ events: unknown[] }>(
      `/track/events?app_id=${this.config.appId}&start=${startDate}&end=${endDate}`
    );

    return [];
  }

  async getEventsByType(
    type: 'pageview' | 'click' | 'change' | 'submit' | 'custom',
    startDate: string,
    endDate: string
  ): Promise<HeapEvent[]> {
    const events = await this.getEvents(startDate, endDate);
    return events.filter((e) => e.type === type);
  }

  async getTopEvents(startDate: string, endDate: string, limit: number = 10): Promise<HeapEvent[]> {
    const events = await this.getEvents(startDate, endDate);
    return events.sort((a, b) => b.count - a.count).slice(0, limit);
  }

  async getAutoCapuredEvents(startDate: string, endDate: string): Promise<HeapEvent[]> {
    const events = await this.getEvents(startDate, endDate);
    return events.filter((e) => e.type !== 'custom');
  }

  // ==================== FUNNELS ====================

  async getFunnels(): Promise<HeapFunnel[]> {
    const data = await this.request<{ funnels: unknown[] }>(`/funnels?app_id=${this.config.appId}`);

    return [];
  }

  async getFunnel(funnelId: string): Promise<HeapFunnel | null> {
    const funnels = await this.getFunnels();
    return funnels.find((f) => f.id === funnelId) || null;
  }

  async getFunnelConversion(funnelId: string): Promise<number> {
    const funnel = await this.getFunnel(funnelId);
    return funnel?.overallConversion || 0;
  }

  // ==================== RETENTION ====================

  async getRetention(startDate: string, endDate: string): Promise<HeapRetention[]> {
    const data = await this.request<{ retention: unknown[] }>(
      `/retention?app_id=${this.config.appId}&start=${startDate}&end=${endDate}`
    );

    return [];
  }

  async getWeeklyRetention(cohortDate: string): Promise<number[]> {
    const retentionData = await this.getRetention(cohortDate, cohortDate);
    return retentionData[0]?.retentionWeeks || [];
  }

  // ==================== SEGMENTS ====================

  async getSegments(): Promise<HeapSegment[]> {
    const data = await this.request<{ segments: unknown[] }>(
      `/segments?app_id=${this.config.appId}`
    );

    return [];
  }

  async getSegmentUsers(segmentId: string): Promise<number> {
    const segments = await this.getSegments();
    const segment = segments.find((s) => s.id === segmentId);
    return segment?.userCount || 0;
  }

  // ==================== WIDGET DATA ====================

  async getUserMetricsWidgetData(): Promise<{
    dau: number;
    wau: number;
    mau: number;
    newUsersThisWeek: number;
    topEvents: HeapEvent[];
  }> {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [activeUsers, newUsers, topEvents] = await Promise.all([
      this.getActiveUsers(today),
      this.getNewUsers(sevenDaysAgo.toISOString().split('T')[0], today),
      this.getTopEvents(sevenDaysAgo.toISOString().split('T')[0], today, 5),
    ]);

    return {
      dau: activeUsers.dau,
      wau: activeUsers.wau,
      mau: activeUsers.mau,
      newUsersThisWeek: newUsers,
      topEvents,
    };
  }

  async getEventAnalyticsWidgetData(): Promise<{
    totalEvents: number;
    autoCapturedCount: number;
    customEventCount: number;
    topAutoCaptured: HeapEvent[];
  }> {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [allEvents, autoCaptured] = await Promise.all([
      this.getEvents(sevenDaysAgo.toISOString().split('T')[0], today),
      this.getAutoCapuredEvents(sevenDaysAgo.toISOString().split('T')[0], today),
    ]);

    return {
      totalEvents: allEvents.reduce((sum, e) => sum + e.count, 0),
      autoCapturedCount: autoCaptured.length,
      customEventCount: allEvents.length - autoCaptured.length,
      topAutoCaptured: autoCaptured.slice(0, 5),
    };
  }

  // ==================== CONNECTION TEST ====================

  async testConnection(): Promise<boolean> {
    try {
      await this.getSegments();
      return true;
    } catch {
      return false;
    }
  }
}

export const createHeapConnector = (config: HeapConfig): HeapConnector => {
  return new HeapConnector(config);
};
