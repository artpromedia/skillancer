/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars */
/**
 * Emergency Controls API Client
 *
 * Client library for emergency response operations including
 * kill switches, lockdown modes, and incident response.
 *
 * @module lib/api/emergency
 */

// ============================================================================
// Types
// ============================================================================

export type LockdownLevel = 'normal' | 'elevated' | 'high' | 'critical' | 'lockdown';

export interface KillSwitch {
  id: string;
  name: string;
  description: string;
  scope: 'global' | 'organization' | 'team' | 'user';
  type: 'session' | 'access' | 'data' | 'network';
  status: 'active' | 'inactive' | 'triggered' | 'cooldown';
  triggeredAt?: Date;
  triggeredBy?: string;
  cooldownMinutes: number;
  requiresConfirmation: boolean;
  requiresApproval: boolean;
  approvers?: string[];
  autoRevert: boolean;
  autoRevertMinutes?: number;
  affectedCount?: number;
  lastTriggered?: Date;
  metadata?: Record<string, unknown>;
}

export interface LockdownState {
  level: LockdownLevel;
  activatedAt?: Date;
  activatedBy?: string;
  reason?: string;
  autoEscalate: boolean;
  scheduledEnd?: Date;
  restrictions: LockdownRestriction[];
  organizationId?: string;
}

export interface LockdownRestriction {
  id: string;
  name: string;
  description: string;
  enabledAtLevel: LockdownLevel;
  currentlyActive: boolean;
  canOverride: boolean;
  overriddenBy?: string;
  overriddenAt?: Date;
}

export interface IncidentContact {
  id: string;
  name: string;
  role: string;
  email: string;
  phone?: string;
  available: boolean;
  responseTime?: string;
  onCall?: boolean;
  onCallUntil?: Date;
}

export interface EmergencyEvent {
  id: string;
  type:
    | 'kill_switch_triggered'
    | 'kill_switch_reverted'
    | 'lockdown_changed'
    | 'incident_declared'
    | 'incident_resolved';
  timestamp: Date;
  actor: {
    id: string;
    name: string;
    email: string;
  };
  target?: {
    type: string;
    id: string;
    name: string;
  };
  reason?: string;
  affectedCount?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'declared' | 'investigating' | 'mitigating' | 'resolved' | 'post_mortem';
  declaredAt: Date;
  declaredBy: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  commander?: string;
  responders: string[];
  affectedSystems: string[];
  timeline: IncidentTimelineEntry[];
  communications: IncidentCommunication[];
  lockdownLevel?: LockdownLevel;
  relatedAlerts?: string[];
}

export interface IncidentTimelineEntry {
  id: string;
  timestamp: Date;
  type: 'status_change' | 'action' | 'note' | 'escalation';
  content: string;
  author: string;
}

export interface IncidentCommunication {
  id: string;
  timestamp: Date;
  type: 'internal' | 'customer' | 'stakeholder';
  channel: string;
  content: string;
  sentBy: string;
  recipients: string[];
}

export interface ApprovalRequest {
  id: string;
  type: 'kill_switch' | 'lockdown_change' | 'override';
  targetId: string;
  targetName: string;
  requestedBy: string;
  requestedAt: Date;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  approvers: {
    userId: string;
    email: string;
    status: 'pending' | 'approved' | 'rejected';
    respondedAt?: Date;
  }[];
  expiresAt: Date;
}

export interface EmergencyStats {
  currentLevel: LockdownLevel;
  activeKillSwitches: number;
  openIncidents: number;
  pendingApprovals: number;
  recentEvents: EmergencyEvent[];
  affectedSessions: number;
  affectedUsers: number;
}

// ============================================================================
// API Client Class
// ============================================================================

class EmergencyAPIClient {
  private baseUrl: string;
  private headers: HeadersInit;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || '/api/emergency';
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
  // Kill Switch Operations
  // =========================================================================

  async getKillSwitches(organizationId?: string): Promise<KillSwitch[]> {
    const params = organizationId ? `?organizationId=${organizationId}` : '';
    return this.request<KillSwitch[]>(`/kill-switches${params}`);
  }

  async getKillSwitch(id: string): Promise<KillSwitch> {
    return this.request<KillSwitch>(`/kill-switches/${id}`);
  }

  async triggerKillSwitch(
    id: string,
    data: { reason: string; duration?: number }
  ): Promise<KillSwitch> {
    return this.request<KillSwitch>(`/kill-switches/${id}/trigger`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async revertKillSwitch(id: string, note?: string): Promise<KillSwitch> {
    return this.request<KillSwitch>(`/kill-switches/${id}/revert`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  }

  async createKillSwitch(
    data: Omit<KillSwitch, 'id' | 'status' | 'lastTriggered' | 'affectedCount'>
  ): Promise<KillSwitch> {
    return this.request<KillSwitch>('/kill-switches', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateKillSwitch(id: string, data: Partial<KillSwitch>): Promise<KillSwitch> {
    return this.request<KillSwitch>(`/kill-switches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteKillSwitch(id: string): Promise<void> {
    return this.request<void>(`/kill-switches/${id}`, {
      method: 'DELETE',
    });
  }

  async getKillSwitchHistory(id: string): Promise<EmergencyEvent[]> {
    return this.request<EmergencyEvent[]>(`/kill-switches/${id}/history`);
  }

  // =========================================================================
  // Lockdown Operations
  // =========================================================================

  async getLockdownState(organizationId?: string): Promise<LockdownState> {
    const params = organizationId ? `?organizationId=${organizationId}` : '';
    return this.request<LockdownState>(`/lockdown${params}`);
  }

  async setLockdownLevel(
    level: LockdownLevel,
    data: {
      reason: string;
      duration?: number;
      organizationId?: string;
    }
  ): Promise<LockdownState> {
    return this.request<LockdownState>('/lockdown', {
      method: 'POST',
      body: JSON.stringify({ level, ...data }),
    });
  }

  async overrideRestriction(
    restrictionId: string,
    enabled: boolean,
    reason: string
  ): Promise<LockdownRestriction> {
    return this.request<LockdownRestriction>(`/lockdown/restrictions/${restrictionId}/override`, {
      method: 'POST',
      body: JSON.stringify({ enabled, reason }),
    });
  }

  async getLockdownHistory(organizationId?: string): Promise<EmergencyEvent[]> {
    const params = organizationId ? `?organizationId=${organizationId}` : '';
    return this.request<EmergencyEvent[]>(`/lockdown/history${params}`);
  }

  // =========================================================================
  // Incident Operations
  // =========================================================================

  async getIncidents(filters?: { status?: string[]; severity?: string[] }): Promise<Incident[]> {
    const params = new URLSearchParams();
    if (filters?.status?.length) {
      params.set('status', filters.status.join(','));
    }
    if (filters?.severity?.length) {
      params.set('severity', filters.severity.join(','));
    }
    return this.request<Incident[]>(`/incidents?${params.toString()}`);
  }

  async getIncident(id: string): Promise<Incident> {
    return this.request<Incident>(`/incidents/${id}`);
  }

  async declareIncident(
    data: Pick<Incident, 'title' | 'description' | 'severity' | 'affectedSystems'> & {
      lockdownLevel?: LockdownLevel;
      notifyContacts?: string[];
    }
  ): Promise<Incident> {
    return this.request<Incident>('/incidents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateIncidentStatus(
    id: string,
    status: Incident['status'],
    note?: string
  ): Promise<Incident> {
    return this.request<Incident>(`/incidents/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, note }),
    });
  }

  async addIncidentTimelineEntry(
    id: string,
    data: Pick<IncidentTimelineEntry, 'type' | 'content'>
  ): Promise<IncidentTimelineEntry> {
    return this.request<IncidentTimelineEntry>(`/incidents/${id}/timeline`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async addIncidentCommunication(
    id: string,
    data: Pick<IncidentCommunication, 'type' | 'channel' | 'content' | 'recipients'>
  ): Promise<IncidentCommunication> {
    return this.request<IncidentCommunication>(`/incidents/${id}/communications`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async assignIncidentCommander(id: string, userId: string): Promise<Incident> {
    return this.request<Incident>(`/incidents/${id}/commander`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async addIncidentResponder(id: string, userId: string): Promise<Incident> {
    return this.request<Incident>(`/incidents/${id}/responders`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async resolveIncident(id: string, summary: string): Promise<Incident> {
    return this.request<Incident>(`/incidents/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ summary }),
    });
  }

  // =========================================================================
  // Contact Operations
  // =========================================================================

  async getIncidentContacts(): Promise<IncidentContact[]> {
    return this.request<IncidentContact[]>('/contacts');
  }

  async notifyContacts(
    contactIds: string[],
    message: string,
    channels?: ('email' | 'sms' | 'phone')[]
  ): Promise<{ sent: number; failed: number }> {
    return this.request(`/contacts/notify`, {
      method: 'POST',
      body: JSON.stringify({ contactIds, message, channels }),
    });
  }

  async getOnCallSchedule(): Promise<{
    current: IncidentContact[];
    upcoming: { contact: IncidentContact; startsAt: Date }[];
  }> {
    return this.request('/contacts/on-call');
  }

  // =========================================================================
  // Approval Operations
  // =========================================================================

  async getPendingApprovals(): Promise<ApprovalRequest[]> {
    return this.request<ApprovalRequest[]>('/approvals/pending');
  }

  async getApprovalRequest(id: string): Promise<ApprovalRequest> {
    return this.request<ApprovalRequest>(`/approvals/${id}`);
  }

  async respondToApproval(
    id: string,
    response: 'approved' | 'rejected',
    note?: string
  ): Promise<ApprovalRequest> {
    return this.request<ApprovalRequest>(`/approvals/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify({ response, note }),
    });
  }

  // =========================================================================
  // Statistics & Dashboard
  // =========================================================================

  async getStats(organizationId?: string): Promise<EmergencyStats> {
    const params = organizationId ? `?organizationId=${organizationId}` : '';
    return this.request<EmergencyStats>(`/stats${params}`);
  }

  async getEventHistory(filters?: {
    types?: string[];
    dateRange?: { start: Date; end: Date };
  }): Promise<EmergencyEvent[]> {
    const params = new URLSearchParams();
    if (filters?.types?.length) {
      params.set('types', filters.types.join(','));
    }
    if (filters?.dateRange) {
      params.set('startDate', filters.dateRange.start.toISOString());
      params.set('endDate', filters.dateRange.end.toISOString());
    }
    return this.request<EmergencyEvent[]>(`/events?${params.toString()}`);
  }

  // =========================================================================
  // Health Check
  // =========================================================================

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, boolean>;
    lastUpdated: Date;
  }> {
    return this.request('/health');
  }

  // =========================================================================
  // Playbooks
  // =========================================================================

  async getPlaybooks(): Promise<
    {
      id: string;
      name: string;
      description: string;
      steps: { order: number; action: string; automated: boolean }[];
    }[]
  > {
    return this.request('/playbooks');
  }

  async executePlaybook(
    id: string,
    options?: { dryRun?: boolean }
  ): Promise<{
    executed: boolean;
    results: { step: number; success: boolean; output?: string }[];
  }> {
    return this.request(`/playbooks/${id}/execute`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  }
}

// ============================================================================
// Singleton Instance & Hooks
// ============================================================================

export const emergencyApi = new EmergencyAPIClient();

export function useEmergencyApi() {
  return emergencyApi;
}

export default emergencyApi;
