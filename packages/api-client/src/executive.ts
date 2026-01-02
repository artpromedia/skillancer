/**
 * Executive API Client
 *
 * Type-safe API client for executive engagement and workspace operations.
 */

import type { ApiClient } from './client';

// ===========================================
// TYPES
// ===========================================

export interface ExecutiveEngagement {
  id: string;
  executiveId: string;
  clientTenantId: string;
  title: string;
  description?: string;
  role: ExecutiveRole;
  status: EngagementStatus;
  hoursPerWeek: number;
  startDate: string;
  endDate?: string;
  billingModel: BillingModel;
  hourlyRate?: number;
  retainerAmount?: number;
  retainerHoursIncluded?: number;
  overageRate?: number;
  totalHoursLogged: number;
  objectives?: string[];
  successMetrics?: { name: string; target: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface ExecutiveWorkspace {
  id: string;
  engagementId: string;
  dashboardLayout: WidgetPosition[];
  enabledWidgets: string[];
  widgetConfigs: Record<string, any>;
  pinnedDocuments: PinnedDocument[];
  pinnedLinks: PinnedLink[];
  recentFiles: any[];
  executiveNotes?: string;
  clientContext?: string;
  skillpodEnabled: boolean;
}

export interface ExecutiveTimeEntry {
  id: string;
  engagementId: string;
  executiveId: string;
  date: string;
  hours: number;
  description: string;
  category: TimeCategory;
  billable: boolean;
  status: TimeEntryStatus;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  skillpodSessionId?: string;
  createdAt: string;
}

export interface ExecutiveCapacity {
  activeEngagements: number;
  maxEngagements: number;
  weeklyCommittedHours: number;
  maxWeeklyHours: number;
  availableSlots: number;
  availableHours: number;
}

export interface TimeSummary {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  pendingHours: number;
  approvedHours: number;
  byCategory: { category: string; hours: number }[];
  byWeek: { weekStart: string; hours: number }[];
  comparedToCommitment: {
    committed: number;
    actual: number;
    variance: number;
    variancePercent: number;
  };
}

export interface WeeklyTimesheet {
  weekStart: string;
  weekEnd: string;
  engagements: {
    engagementId: string;
    title: string;
    clientName: string;
    entries: { date: string; hours: number; description: string; id: string }[];
    totalHours: number;
  }[];
  grandTotal: number;
}

export interface WidgetPosition {
  widgetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PinnedDocument {
  id: string;
  name: string;
  url: string;
  type: 'pdf' | 'doc' | 'spreadsheet' | 'presentation' | 'image' | 'other';
  pinnedAt: string;
}

export interface PinnedLink {
  id: string;
  name: string;
  url: string;
  pinnedAt: string;
}

// Enums
export type ExecutiveRole =
  | 'FRACTIONAL_CTO'
  | 'FRACTIONAL_CFO'
  | 'FRACTIONAL_CMO'
  | 'FRACTIONAL_COO'
  | 'FRACTIONAL_CHRO'
  | 'FRACTIONAL_CPO'
  | 'FRACTIONAL_CRO'
  | 'FRACTIONAL_CISO'
  | 'FRACTIONAL_CLO'
  | 'FRACTIONAL_CDO'
  | 'BOARD_ADVISOR'
  | 'INTERIM_EXECUTIVE';

export type EngagementStatus =
  | 'PROPOSAL'
  | 'NEGOTIATING'
  | 'CONTRACT_SENT'
  | 'CONTRACT_SIGNED'
  | 'ONBOARDING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'RENEWAL'
  | 'COMPLETED'
  | 'TERMINATED';

export type BillingModel = 'RETAINER' | 'HOURLY' | 'HYBRID' | 'PROJECT';

export type TimeCategory =
  | 'ADVISORY'
  | 'STRATEGY'
  | 'EXECUTION'
  | 'MEETINGS'
  | 'DOCUMENTATION'
  | 'REVIEW'
  | 'TRAINING'
  | 'ADMIN';

export type TimeEntryStatus = 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'INVOICED';

// Input types
export interface CreateEngagementInput {
  clientTenantId: string;
  title: string;
  description?: string;
  role: ExecutiveRole;
  hoursPerWeek: number;
  startDate: string;
  endDate?: string;
  billingModel?: BillingModel;
  hourlyRate?: number;
  retainerAmount?: number;
  retainerHoursIncluded?: number;
  overageRate?: number;
}

export interface UpdateEngagementInput {
  title?: string;
  description?: string;
  hoursPerWeek?: number;
  endDate?: string;
  objectives?: string[];
  successMetrics?: { name: string; target: string }[];
}

export interface CreateTimeEntryInput {
  date: string;
  hours: number;
  description: string;
  category?: TimeCategory;
  billable?: boolean;
}

export interface UpdateTimeEntryInput {
  date?: string;
  hours?: number;
  description?: string;
  category?: TimeCategory;
  billable?: boolean;
}

// ===========================================
// EXECUTIVE API CLIENT
// ===========================================

export class ExecutiveApiClient {
  constructor(private client: ApiClient) {}

  // -------------------------------------------
  // ENGAGEMENTS
  // -------------------------------------------

  /**
   * Create a new engagement
   */
  async createEngagement(input: CreateEngagementInput): Promise<ExecutiveEngagement> {
    return this.client.post('/api/executive/engagements', input);
  }

  /**
   * Get my engagements
   */
  async getMyEngagements(filters?: {
    status?: EngagementStatus | EngagementStatus[];
  }): Promise<ExecutiveEngagement[]> {
    const params = new URLSearchParams();
    if (filters?.status) {
      params.set(
        'status',
        Array.isArray(filters.status) ? filters.status.join(',') : filters.status
      );
    }
    return this.client.get(`/api/executive/engagements?${params.toString()}`);
  }

  /**
   * Get engagement details
   */
  async getEngagement(engagementId: string): Promise<ExecutiveEngagement> {
    return this.client.get(`/api/executive/engagements/${engagementId}`);
  }

  /**
   * Update engagement
   */
  async updateEngagement(
    engagementId: string,
    updates: UpdateEngagementInput
  ): Promise<ExecutiveEngagement> {
    return this.client.patch(`/api/executive/engagements/${engagementId}`, updates);
  }

  /**
   * Update engagement status
   */
  async updateEngagementStatus(
    engagementId: string,
    status: EngagementStatus,
    reason?: string
  ): Promise<ExecutiveEngagement> {
    return this.client.patch(`/api/executive/engagements/${engagementId}/status`, {
      status,
      reason,
    });
  }

  /**
   * Get executive capacity
   */
  async getCapacity(): Promise<ExecutiveCapacity> {
    return this.client.get('/api/executive/capacity');
  }

  /**
   * Get utilization report
   */
  async getUtilization(startDate?: string, endDate?: string): Promise<any> {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return this.client.get(`/api/executive/utilization?${params.toString()}`);
  }

  // -------------------------------------------
  // WORKSPACE
  // -------------------------------------------

  /**
   * Get engagement workspace
   */
  async getWorkspace(engagementId: string): Promise<ExecutiveWorkspace> {
    return this.client.get(`/api/executive/engagements/${engagementId}/workspace`);
  }

  /**
   * Update workspace layout
   */
  async updateWorkspaceLayout(
    workspaceId: string,
    layout: WidgetPosition[]
  ): Promise<ExecutiveWorkspace> {
    return this.client.put(`/api/executive/workspaces/${workspaceId}/layout`, {
      layout,
    });
  }

  /**
   * Update widget config
   */
  async updateWidgetConfig(
    workspaceId: string,
    widgetId: string,
    config: Record<string, any>
  ): Promise<ExecutiveWorkspace> {
    return this.client.put(
      `/api/executive/workspaces/${workspaceId}/widgets/${widgetId}/config`,
      config
    );
  }

  /**
   * Enable widget
   */
  async enableWidget(workspaceId: string, widgetId: string): Promise<ExecutiveWorkspace> {
    return this.client.post(`/api/executive/workspaces/${workspaceId}/widgets/${widgetId}/enable`);
  }

  /**
   * Disable widget
   */
  async disableWidget(workspaceId: string, widgetId: string): Promise<ExecutiveWorkspace> {
    return this.client.post(`/api/executive/workspaces/${workspaceId}/widgets/${widgetId}/disable`);
  }

  /**
   * Pin document
   */
  async pinDocument(
    workspaceId: string,
    document: Omit<PinnedDocument, 'id' | 'pinnedAt'>
  ): Promise<ExecutiveWorkspace> {
    return this.client.post(`/api/executive/workspaces/${workspaceId}/pins/documents`, document);
  }

  /**
   * Unpin document
   */
  async unpinDocument(workspaceId: string, documentId: string): Promise<ExecutiveWorkspace> {
    return this.client.delete(
      `/api/executive/workspaces/${workspaceId}/pins/documents/${documentId}`
    );
  }

  /**
   * Update executive notes
   */
  async updateNotes(workspaceId: string, notes: string): Promise<ExecutiveWorkspace> {
    return this.client.put(`/api/executive/workspaces/${workspaceId}/notes`, {
      notes,
    });
  }

  /**
   * Launch SkillPod session
   */
  async launchSkillPod(workspaceId: string): Promise<{ sessionUrl: string; sessionId: string }> {
    return this.client.post(`/api/executive/workspaces/${workspaceId}/skillpod/launch`);
  }

  // -------------------------------------------
  // TIME TRACKING
  // -------------------------------------------

  /**
   * Create time entry
   */
  async createTimeEntry(
    engagementId: string,
    input: CreateTimeEntryInput
  ): Promise<ExecutiveTimeEntry> {
    return this.client.post(`/api/executive/engagements/${engagementId}/time`, input);
  }

  /**
   * Get time entries
   */
  async getTimeEntries(
    engagementId: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      status?: TimeEntryStatus;
    }
  ): Promise<ExecutiveTimeEntry[]> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.set('startDate', filters.startDate);
    if (filters?.endDate) params.set('endDate', filters.endDate);
    if (filters?.status) params.set('status', filters.status);
    return this.client.get(`/api/executive/engagements/${engagementId}/time?${params.toString()}`);
  }

  /**
   * Update time entry
   */
  async updateTimeEntry(
    entryId: string,
    updates: UpdateTimeEntryInput
  ): Promise<ExecutiveTimeEntry> {
    return this.client.patch(`/api/executive/time/${entryId}`, updates);
  }

  /**
   * Delete time entry
   */
  async deleteTimeEntry(entryId: string): Promise<void> {
    return this.client.delete(`/api/executive/time/${entryId}`);
  }

  /**
   * Submit timesheet
   */
  async submitTimesheet(engagementId: string, entryIds: string[]): Promise<ExecutiveTimeEntry[]> {
    return this.client.post(`/api/executive/engagements/${engagementId}/time/submit`, {
      entryIds,
    });
  }

  /**
   * Get time summary
   */
  async getTimeSummary(
    engagementId: string,
    startDate?: string,
    endDate?: string
  ): Promise<TimeSummary> {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return this.client.get(
      `/api/executive/engagements/${engagementId}/time/summary?${params.toString()}`
    );
  }

  /**
   * Get weekly timesheet
   */
  async getWeeklyTimesheet(weekOf?: string): Promise<WeeklyTimesheet> {
    const params = weekOf ? `?weekOf=${weekOf}` : '';
    return this.client.get(`/api/executive/timesheet${params}`);
  }
}

// ===========================================
// CLIENT-SIDE EXECUTIVE API (for Cockpit)
// ===========================================

export class ClientExecutiveApiClient {
  constructor(private client: ApiClient) {}

  /**
   * Get executives engaged by client
   */
  async getMyExecutives(filters?: {
    status?: EngagementStatus | EngagementStatus[];
  }): Promise<ExecutiveEngagement[]> {
    const params = new URLSearchParams();
    if (filters?.status) {
      params.set(
        'status',
        Array.isArray(filters.status) ? filters.status.join(',') : filters.status
      );
    }
    return this.client.get(`/api/client/executives?${params.toString()}`);
  }

  /**
   * Get engagement details
   */
  async getEngagement(engagementId: string): Promise<ExecutiveEngagement> {
    return this.client.get(`/api/client/executives/${engagementId}`);
  }

  /**
   * Get pending time entries for approval
   */
  async getPendingTimeEntries(engagementId: string): Promise<ExecutiveTimeEntry[]> {
    return this.client.get(`/api/client/executives/${engagementId}/time/pending`);
  }

  /**
   * Approve time entries
   */
  async approveTimeEntries(
    engagementId: string,
    entryIds: string[]
  ): Promise<ExecutiveTimeEntry[]> {
    return this.client.post(`/api/client/executives/${engagementId}/time/approve`, {
      entryIds,
    });
  }

  /**
   * Reject time entries
   */
  async rejectTimeEntries(
    engagementId: string,
    entryIds: string[],
    reason: string
  ): Promise<ExecutiveTimeEntry[]> {
    return this.client.post(`/api/client/executives/${engagementId}/time/reject`, {
      entryIds,
      reason,
    });
  }

  /**
   * Get engagement summary
   */
  async getEngagementSummary(): Promise<{
    activeExecutives: number;
    totalHoursThisMonth: number;
    totalHoursApproved: number;
    totalHoursPending: number;
    totalSpendThisMonth: number;
  }> {
    return this.client.get('/api/client/executives/summary');
  }
}
