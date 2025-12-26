/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars */
/**
 * Security Alerts API Client
 *
 * Client library for security alert management, rule configuration,
 * notification channels, and escalation policies.
 *
 * @module lib/api/alerts
 */

// ============================================================================
// Types
// ============================================================================

export interface SecurityAlert {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'active' | 'acknowledged' | 'investigating' | 'resolved' | 'false_positive';
  source: string;
  timestamp: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  affectedResource: {
    type: string;
    id: string;
    name: string;
  };
  relatedAlerts?: string[];
  metadata: Record<string, unknown>;
  actions?: AlertAction[];
  tags?: string[];
  assignee?: string;
  notes?: AlertNote[];
}

export interface AlertAction {
  id: string;
  label: string;
  action: string;
  enabled: boolean;
  requiresConfirmation?: boolean;
}

export interface AlertNote {
  id: string;
  content: string;
  author: string;
  createdAt: Date;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  severity: SecurityAlert['severity'];
  conditions: AlertCondition[];
  actions: RuleAction[];
  schedule?: AlertSchedule;
  cooldown: number;
  rateLimit?: {
    maxAlerts: number;
    windowMinutes: number;
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastTriggered?: Date;
  triggerCount: number;
}

export interface AlertCondition {
  id: string;
  type: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'regex';
  value: string | number | boolean;
  timeWindow?: number;
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
}

export interface RuleAction {
  id: string;
  type: 'email' | 'slack' | 'pagerduty' | 'webhook' | 'sms' | 'auto_response';
  config: Record<string, unknown>;
  enabled: boolean;
  delay?: number;
}

export interface AlertSchedule {
  enabled: boolean;
  timezone: string;
  windows: {
    start: string;
    end: string;
    days: string[];
  }[];
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'pagerduty' | 'webhook' | 'sms' | 'teams';
  config: Record<string, unknown>;
  enabled: boolean;
  lastTested?: Date;
  lastTestResult?: 'success' | 'failure';
}

export interface EscalationPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  levels: EscalationLevel[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EscalationLevel {
  id: string;
  order: number;
  delayMinutes: number;
  targets: EscalationTarget[];
}

export interface EscalationTarget {
  type: 'user' | 'team' | 'channel' | 'schedule';
  id: string;
  name: string;
}

export interface AlertFilters {
  severities?: string[];
  statuses?: string[];
  types?: string[];
  sources?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  search?: string;
  assignee?: string;
  tags?: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface AlertStats {
  total: number;
  active: number;
  critical: number;
  acknowledged: number;
  avgResponseTime: number;
  resolvedToday: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  trends: {
    date: Date;
    count: number;
    severity: Record<string, number>;
  }[];
}

export interface AlertSubscription {
  id: string;
  alertId?: string;
  type?: string;
  severity?: string[];
  channels: string[];
  userId: string;
  createdAt: Date;
}

// ============================================================================
// API Client Class
// ============================================================================

class AlertsAPIClient {
  private baseUrl: string;
  private headers: HeadersInit;
  private wsConnection: WebSocket | null = null;
  private wsListeners: Map<string, Set<(alert: SecurityAlert) => void>> = new Map();

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || '/api/alerts';
    this.headers = {
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `API error: ${response.status}`);
    }

    return response.json();
  }

  // =========================================================================
  // Alert Operations
  // =========================================================================

  async getAlerts(
    filters?: AlertFilters,
    page = 1,
    pageSize = 20
  ): Promise<PaginatedResponse<SecurityAlert>> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    if (filters?.severities?.length) {
      params.set('severities', filters.severities.join(','));
    }
    if (filters?.statuses?.length) {
      params.set('statuses', filters.statuses.join(','));
    }
    if (filters?.types?.length) {
      params.set('types', filters.types.join(','));
    }
    if (filters?.search) {
      params.set('search', filters.search);
    }
    if (filters?.dateRange) {
      params.set('startDate', filters.dateRange.start.toISOString());
      params.set('endDate', filters.dateRange.end.toISOString());
    }
    if (filters?.assignee) {
      params.set('assignee', filters.assignee);
    }

    return this.request<PaginatedResponse<SecurityAlert>>(`?${params.toString()}`);
  }

  async getAlert(id: string): Promise<SecurityAlert> {
    return this.request<SecurityAlert>(`/${id}`);
  }

  async acknowledgeAlert(id: string, note?: string): Promise<SecurityAlert> {
    return this.request<SecurityAlert>(`/${id}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  }

  async resolveAlert(
    id: string,
    resolution: {
      type: 'resolved' | 'false_positive';
      note?: string;
      preventSimilar?: boolean;
    }
  ): Promise<SecurityAlert> {
    return this.request<SecurityAlert>(`/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(resolution),
    });
  }

  async assignAlert(id: string, assigneeId: string): Promise<SecurityAlert> {
    return this.request<SecurityAlert>(`/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assigneeId }),
    });
  }

  async addAlertNote(id: string, content: string): Promise<AlertNote> {
    return this.request<AlertNote>(`/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async bulkAcknowledge(ids: string[]): Promise<{ success: number; failed: number }> {
    return this.request(`/bulk/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  }

  async bulkResolve(
    ids: string[],
    resolution: { type: 'resolved' | 'false_positive'; note?: string }
  ): Promise<{ success: number; failed: number }> {
    return this.request(`/bulk/resolve`, {
      method: 'POST',
      body: JSON.stringify({ ids, resolution }),
    });
  }

  async getRelatedAlerts(id: string): Promise<SecurityAlert[]> {
    return this.request<SecurityAlert[]>(`/${id}/related`);
  }

  // =========================================================================
  // Alert Rule Operations
  // =========================================================================

  async getRules(category?: string): Promise<AlertRule[]> {
    const params = category ? `?category=${category}` : '';
    return this.request<AlertRule[]>(`/rules${params}`);
  }

  async getRule(id: string): Promise<AlertRule> {
    return this.request<AlertRule>(`/rules/${id}`);
  }

  async createRule(
    data: Omit<
      AlertRule,
      'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'lastTriggered' | 'triggerCount'
    >
  ): Promise<AlertRule> {
    return this.request<AlertRule>('/rules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRule(id: string, data: Partial<AlertRule>): Promise<AlertRule> {
    return this.request<AlertRule>(`/rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteRule(id: string): Promise<void> {
    return this.request<void>(`/rules/${id}`, {
      method: 'DELETE',
    });
  }

  async toggleRule(id: string, enabled: boolean): Promise<AlertRule> {
    return this.request<AlertRule>(`/rules/${id}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  }

  async testRule(id: string): Promise<{ wouldTrigger: boolean; matchCount: number }> {
    return this.request(`/rules/${id}/test`, {
      method: 'POST',
    });
  }

  async duplicateRule(id: string, name: string): Promise<AlertRule> {
    return this.request<AlertRule>(`/rules/${id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  // =========================================================================
  // Notification Channel Operations
  // =========================================================================

  async getChannels(): Promise<NotificationChannel[]> {
    return this.request<NotificationChannel[]>('/channels');
  }

  async getChannel(id: string): Promise<NotificationChannel> {
    return this.request<NotificationChannel>(`/channels/${id}`);
  }

  async createChannel(
    data: Omit<NotificationChannel, 'id' | 'lastTested' | 'lastTestResult'>
  ): Promise<NotificationChannel> {
    return this.request<NotificationChannel>('/channels', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateChannel(
    id: string,
    data: Partial<NotificationChannel>
  ): Promise<NotificationChannel> {
    return this.request<NotificationChannel>(`/channels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteChannel(id: string): Promise<void> {
    return this.request<void>(`/channels/${id}`, {
      method: 'DELETE',
    });
  }

  async testChannel(id: string): Promise<{ success: boolean; error?: string }> {
    return this.request(`/channels/${id}/test`, {
      method: 'POST',
    });
  }

  // =========================================================================
  // Escalation Policy Operations
  // =========================================================================

  async getEscalationPolicies(): Promise<EscalationPolicy[]> {
    return this.request<EscalationPolicy[]>('/escalation-policies');
  }

  async getEscalationPolicy(id: string): Promise<EscalationPolicy> {
    return this.request<EscalationPolicy>(`/escalation-policies/${id}`);
  }

  async createEscalationPolicy(
    data: Omit<EscalationPolicy, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<EscalationPolicy> {
    return this.request<EscalationPolicy>('/escalation-policies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEscalationPolicy(
    id: string,
    data: Partial<EscalationPolicy>
  ): Promise<EscalationPolicy> {
    return this.request<EscalationPolicy>(`/escalation-policies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteEscalationPolicy(id: string): Promise<void> {
    return this.request<void>(`/escalation-policies/${id}`, {
      method: 'DELETE',
    });
  }

  // =========================================================================
  // Subscriptions
  // =========================================================================

  async getSubscriptions(): Promise<AlertSubscription[]> {
    return this.request<AlertSubscription[]>('/subscriptions');
  }

  async createSubscription(
    data: Omit<AlertSubscription, 'id' | 'userId' | 'createdAt'>
  ): Promise<AlertSubscription> {
    return this.request<AlertSubscription>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteSubscription(id: string): Promise<void> {
    return this.request<void>(`/subscriptions/${id}`, {
      method: 'DELETE',
    });
  }

  // =========================================================================
  // Statistics
  // =========================================================================

  async getStats(period?: 'day' | 'week' | 'month'): Promise<AlertStats> {
    const params = period ? `?period=${period}` : '';
    return this.request<AlertStats>(`/stats${params}`);
  }

  // =========================================================================
  // Real-time Subscriptions (WebSocket)
  // =========================================================================

  connectRealtime(wsUrl?: string): void {
    if (this.wsConnection) {
      return;
    }

    const url = wsUrl || this.baseUrl.replace('http', 'ws') + '/ws';
    this.wsConnection = new WebSocket(url);

    this.wsConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'alert') {
          const alert = data.payload as SecurityAlert;
          const listeners = this.wsListeners.get('alert') || new Set();
          listeners.forEach((listener) => listener(alert));
        }
      } catch {
        console.error('Failed to parse WebSocket message');
      }
    };

    this.wsConnection.onerror = () => {
      console.error('WebSocket error');
    };

    this.wsConnection.onclose = () => {
      this.wsConnection = null;
      // Attempt reconnection after 5 seconds
      setTimeout(() => this.connectRealtime(wsUrl), 5000);
    };
  }

  disconnectRealtime(): void {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }

  onAlert(callback: (alert: SecurityAlert) => void): () => void {
    const listeners = this.wsListeners.get('alert') || new Set();
    listeners.add(callback);
    this.wsListeners.set('alert', listeners);

    // Return unsubscribe function
    return () => {
      listeners.delete(callback);
    };
  }

  // =========================================================================
  // Export
  // =========================================================================

  async exportAlerts(filters?: AlertFilters, format: 'csv' | 'json' = 'csv'): Promise<Blob> {
    const params = new URLSearchParams({ format });

    if (filters?.severities?.length) {
      params.set('severities', filters.severities.join(','));
    }
    if (filters?.statuses?.length) {
      params.set('statuses', filters.statuses.join(','));
    }
    if (filters?.dateRange) {
      params.set('startDate', filters.dateRange.start.toISOString());
      params.set('endDate', filters.dateRange.end.toISOString());
    }

    const response = await fetch(`${this.baseUrl}/export?${params.toString()}`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    return response.blob();
  }
}

// ============================================================================
// Singleton Instance & Hooks
// ============================================================================

export const alertsApi = new AlertsAPIClient();

export function useAlertsApi() {
  return alertsApi;
}

export default alertsApi;
