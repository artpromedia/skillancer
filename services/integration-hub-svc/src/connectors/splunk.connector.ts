// @ts-nocheck
import { BaseConnector, ConnectorConfig, OAuthConfig } from './base.connector';

// Splunk Enterprise Security Connector
// Provides security events, alerts, and notable events from Splunk SIEM

export interface SplunkCredentials {
  host: string;
  port: number;
  username?: string;
  password?: string;
  token?: string; // Bearer token auth
}

export interface SplunkSearchResult {
  sid: string;
  status: 'running' | 'done' | 'failed' | 'paused';
  results: Record<string, unknown>[];
  resultCount: number;
  doneProgress: number;
}

export interface NotableEvent {
  eventId: string;
  ruleName: string;
  ruleDescription: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  urgency: 'critical' | 'high' | 'medium' | 'low';
  status: 'new' | 'in progress' | 'pending' | 'resolved' | 'closed';
  owner: string;
  src: string;
  dest: string;
  time: Date;
  count: number;
}

export interface SplunkAlert {
  alertId: string;
  name: string;
  description: string;
  severity: string;
  triggeredTime: Date;
  expireTime: Date;
  triggerCount: number;
  actions: string[];
}

export interface DataModel {
  name: string;
  displayName: string;
  description: string;
  acceleration: {
    enabled: boolean;
    earliestTime: string;
    latestTime: string;
  };
}

export class SplunkConnector extends BaseConnector {
  private credentials: SplunkCredentials | null = null;
  private sessionKey: string | null = null;

  constructor(config: ConnectorConfig) {
    super(config);
  }

  get providerId(): string {
    return 'splunk';
  }

  get providerName(): string {
    return 'Splunk Enterprise Security';
  }

  get requiredScopes(): string[] {
    return ['search', 'list_notable_events', 'alerts'];
  }

  getOAuthConfig(): OAuthConfig {
    // Splunk uses token or basic auth
    return {
      authorizationUrl: '',
      tokenUrl: '',
      scopes: [],
    };
  }

  async connect(credentials: SplunkCredentials): Promise<void> {
    this.credentials = credentials;

    if (credentials.token) {
      this.sessionKey = credentials.token;
    } else {
      await this.authenticate();
    }

    // Validate connection
    await this.getServerInfo();
  }

  async disconnect(): Promise<void> {
    this.credentials = null;
    this.sessionKey = null;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getServerInfo();
      return true;
    } catch {
      return false;
    }
  }

  // Server Info
  async getServerInfo(): Promise<{ version: string; serverName: string }> {
    const response = await this.makeRequest('GET', '/services/server/info');
    const entry = response.entry?.[0];

    return {
      version: entry?.content?.version || 'unknown',
      serverName: entry?.content?.serverName || 'unknown',
    };
  }

  // Search
  async search(
    query: string,
    timeRange: { earliest: string; latest: string }
  ): Promise<SplunkSearchResult> {
    // Create search job
    const jobResponse = await this.makeRequest('POST', '/services/search/jobs', {
      search: query.startsWith('search') ? query : `search ${query}`,
      earliest_time: timeRange.earliest,
      latest_time: timeRange.latest,
      output_mode: 'json',
    });

    const sid = jobResponse.sid as string;

    // Poll for completion
    let status = 'running';
    while (status === 'running') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const statusResponse = await this.makeRequest('GET', `/services/search/jobs/${sid}`);
      status = statusResponse.entry?.[0]?.content?.dispatchState || 'done';
    }

    // Get results
    const resultsResponse = await this.makeRequest('GET', `/services/search/jobs/${sid}/results`);

    return {
      sid,
      status: 'done',
      results: resultsResponse.results || [],
      resultCount: resultsResponse.results?.length || 0,
      doneProgress: 100,
    };
  }

  // Notable Events (ES)
  async getNotableEvents(filters?: {
    severity?: string[];
    status?: string;
    timeRange?: { earliest: string; latest: string };
  }): Promise<NotableEvent[]> {
    const query = '| `notable` | head 100';
    const timeRange = filters?.timeRange || { earliest: '-24h', latest: 'now' };

    const result = await this.search(query, timeRange);

    return result.results
      .filter((event) => {
        if (filters?.severity && !filters.severity.includes(event.severity as string)) {
          return false;
        }
        if (filters?.status && event.status !== filters.status) {
          return false;
        }
        return true;
      })
      .map(this.mapNotableEvent);
  }

  async getNotableEventsSummary(): Promise<{
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    byStatus: Record<string, number>;
    trend: { date: string; count: number }[];
  }> {
    const events = await this.getNotableEvents({
      timeRange: { earliest: '-7d', latest: 'now' },
    });

    const summary = {
      total: events.length,
      critical: events.filter((e) => e.severity === 'critical').length,
      high: events.filter((e) => e.severity === 'high').length,
      medium: events.filter((e) => e.severity === 'medium').length,
      low: events.filter((e) => e.severity === 'low' || e.severity === 'informational').length,
      byStatus: {} as Record<string, number>,
      trend: [] as { date: string; count: number }[],
    };

    for (const event of events) {
      summary.byStatus[event.status] = (summary.byStatus[event.status] || 0) + 1;
    }

    // Build trend
    const trendMap = new Map<string, number>();
    for (const event of events) {
      const date = event.time.toISOString().split('T')[0];
      trendMap.set(date, (trendMap.get(date) || 0) + 1);
    }

    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      summary.trend.push({
        date: dateStr,
        count: trendMap.get(dateStr) || 0,
      });
    }

    return summary;
  }

  // Alerts
  async getAlerts(): Promise<SplunkAlert[]> {
    const response = await this.makeRequest('GET', '/services/alerts/fired_alerts');

    return (response.entry || []).map((entry: Record<string, unknown>) => ({
      alertId: entry.name as string,
      name: (entry.content as Record<string, unknown>)?.savedsearch_name as string,
      description: ((entry.content as Record<string, unknown>)?.description as string) || '',
      severity: ((entry.content as Record<string, unknown>)?.severity as string) || 'medium',
      triggeredTime: new Date((entry.content as Record<string, unknown>)?.trigger_time as string),
      expireTime: new Date((entry.content as Record<string, unknown>)?.expiration_time as string),
      triggerCount:
        ((entry.content as Record<string, unknown>)?.triggered_alert_count as number) || 1,
      actions: ((entry.content as Record<string, unknown>)?.actions as string)?.split(',') || [],
    }));
  }

  async getAlertsSummary(): Promise<{
    total: number;
    activeAlerts: number;
    byType: Record<string, number>;
    recentTriggers: Array<{ name: string; time: Date; count: number }>;
  }> {
    const alerts = await this.getAlerts();
    const now = new Date();

    const byType: Record<string, number> = {};
    const activeAlerts = alerts.filter((a) => a.expireTime > now);

    for (const alert of alerts) {
      byType[alert.name] = (byType[alert.name] || 0) + 1;
    }

    return {
      total: alerts.length,
      activeAlerts: activeAlerts.length,
      byType,
      recentTriggers: alerts
        .sort((a, b) => b.triggeredTime.getTime() - a.triggeredTime.getTime())
        .slice(0, 10)
        .map((a) => ({
          name: a.name,
          time: a.triggeredTime,
          count: a.triggerCount,
        })),
    };
  }

  // Log Volume
  async getLogVolume(timeRange: { earliest: string; latest: string }): Promise<{
    totalEvents: number;
    eventsPerSecond: number;
    bySource: Record<string, number>;
    bySourcetype: Record<string, number>;
    trend: { time: string; count: number }[];
  }> {
    const query = '| tstats count where index=* by _time, source, sourcetype span=1h';
    const result = await this.search(query, timeRange);

    const bySource: Record<string, number> = {};
    const bySourcetype: Record<string, number> = {};
    let totalEvents = 0;

    for (const row of result.results) {
      const count = Number.parseInt(row.count as string, 10) || 0;
      totalEvents += count;

      const source = (row.source as string) || 'unknown';
      const sourcetype = (row.sourcetype as string) || 'unknown';

      bySource[source] = (bySource[source] || 0) + count;
      bySourcetype[sourcetype] = (bySourcetype[sourcetype] || 0) + count;
    }

    // Calculate EPS (simplified)
    const timeSpanHours = 24; // Assuming 24h range
    const eventsPerSecond = totalEvents / (timeSpanHours * 3600);

    return {
      totalEvents,
      eventsPerSecond,
      bySource,
      bySourcetype,
      trend: result.results.map((row) => ({
        time: row._time as string,
        count: Number.parseInt(row.count as string, 10) || 0,
      })),
    };
  }

  // Data Models
  async getDataModels(): Promise<DataModel[]> {
    const response = await this.makeRequest('GET', '/services/datamodel/model');

    return (response.entry || []).map((entry: Record<string, unknown>) => ({
      name: entry.name as string,
      displayName:
        ((entry.content as Record<string, unknown>)?.displayName as string) ||
        (entry.name as string),
      description: ((entry.content as Record<string, unknown>)?.description as string) || '',
      acceleration: {
        enabled: ((entry.content as Record<string, unknown>)?.acceleration as boolean) || false,
        earliestTime:
          ((entry.content as Record<string, unknown>)?.['acceleration.earliest_time'] as string) ||
          '',
        latestTime:
          ((entry.content as Record<string, unknown>)?.['acceleration.latest_time'] as string) ||
          '',
      },
    }));
  }

  // Widget Data Methods
  async getWidgetData(widgetType: string): Promise<unknown> {
    switch (widgetType) {
      case 'security-events':
        return this.getNotableEventsSummary();

      case 'alert-summary':
        return this.getAlertsSummary();

      case 'log-volume':
        return this.getLogVolume({ earliest: '-24h', latest: 'now' });

      case 'notable-events':
        return {
          events: await this.getNotableEvents({ timeRange: { earliest: '-24h', latest: 'now' } }),
        };

      default:
        throw new Error(`Unknown widget type: ${widgetType}`);
    }
  }

  // Private helper methods
  private async authenticate(): Promise<void> {
    if (!this.credentials?.username || !this.credentials?.password) {
      throw new Error('Username and password required for authentication');
    }

    const response = await fetch(
      `https://${this.credentials.host}:${this.credentials.port}/services/auth/login`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username: this.credentials.username,
          password: this.credentials.password,
          output_mode: 'json',
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }

    const data = await response.json();
    this.sessionKey = data.sessionKey;
  }

  private async makeRequest(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!this.credentials || !this.sessionKey) {
      throw new Error('Not connected to Splunk');
    }

    const url = `https://${this.credentials.host}:${this.credentials.port}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Splunk ${this.sessionKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const response = await fetch(url + '?output_mode=json', {
      method,
      headers,
      body: body ? new URLSearchParams(body as Record<string, string>) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Splunk API error: ${response.status}`);
    }

    return response.json();
  }

  private mapNotableEvent = (event: Record<string, unknown>): NotableEvent => ({
    eventId: (event.event_id as string) || (event._cd as string) || '',
    ruleName: (event.rule_name as string) || (event.search_name as string) || '',
    ruleDescription: (event.rule_description as string) || '',
    severity: this.normalizeSeverity(event.severity as string),
    urgency: this.normalizeSeverity(event.urgency as string),
    status: (event.status as NotableEvent['status']) || 'new',
    owner: (event.owner as string) || 'unassigned',
    src: (event.src as string) || '',
    dest: (event.dest as string) || '',
    time: new Date((event._time as number) * 1000),
    count: Number.parseInt(event.count as string, 10) || 1,
  });

  private normalizeSeverity(severity: string): NotableEvent['severity'] {
    const normalized = severity?.toLowerCase() || 'informational';
    if (normalized === 'critical') return 'critical';
    if (normalized === 'high') return 'high';
    if (normalized === 'medium') return 'medium';
    if (normalized === 'low') return 'low';
    return 'informational';
  }
}

export const createSplunkConnector = (config: ConnectorConfig) => new SplunkConnector(config);

