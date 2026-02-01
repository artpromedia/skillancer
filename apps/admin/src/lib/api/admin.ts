/**
 * Admin API Client
 * Centralized API client for all admin operations
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

// ============================================================================
// Type Aliases
// ============================================================================

export type ReportFormat = 'pdf' | 'csv' | 'excel';
export type ReportStatus = 'pending' | 'generating' | 'ready' | 'failed';
export type ReportSchedule = 'daily' | 'weekly' | 'monthly';

interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Generic fetch helper
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    return {
      data: null as unknown as T,
      success: false,
      error: `HTTP ${response.status}: ${response.statusText}`,
    };
  }

  const data = (await response.json()) as T;
  return { data, success: true };
}

// ============================================================================
// User Management
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string;
  type: 'freelancer' | 'client';
  status: 'active' | 'suspended' | 'pending' | 'banned';
  verified: boolean;
  createdAt: string;
  lastLogin: string | null;
}

export interface UserFilters {
  status?: string;
  type?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export const usersApi = {
  list: (filters: UserFilters = {}) =>
    fetchApi<PaginatedResponse<User>>(
      `/admin/users?${new URLSearchParams(filters as Record<string, string>).toString()}`
    ),

  getById: (userId: string) => fetchApi<User>(`/admin/users/${userId}`),

  update: (userId: string, data: Partial<User>) =>
    fetchApi<User>(`/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  suspend: (userId: string, reason: string) =>
    fetchApi<void>(`/admin/users/${userId}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  unsuspend: (userId: string) =>
    fetchApi<void>(`/admin/users/${userId}/unsuspend`, { method: 'POST' }),

  ban: (userId: string, reason: string) =>
    fetchApi<void>(`/admin/users/${userId}/ban`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getActivityLog: (userId: string, page = 1) =>
    fetchApi<PaginatedResponse<{ action: string; timestamp: string; details: string }>>(
      `/admin/users/${userId}/activity?page=${page}`
    ),

  impersonate: (userId: string, reason: string, duration: number) =>
    fetchApi<{ sessionId: string; expiresAt: string }>(`/admin/users/${userId}/impersonate`, {
      method: 'POST',
      body: JSON.stringify({ reason, duration }),
    }),

  endImpersonation: (sessionId: string) =>
    fetchApi<void>(`/admin/impersonate/${sessionId}/end`, { method: 'POST' }),
};

// ============================================================================
// Moderation
// ============================================================================

export interface ModerationItem {
  id: string;
  type: 'job' | 'profile' | 'review' | 'message' | 'portfolio';
  status: 'pending' | 'approved' | 'rejected';
  userId: string;
  userName: string;
  content: string;
  flags: string[];
  aiScore: number;
  createdAt: string;
}

export const moderationApi = {
  list: (type?: string, status = 'pending') =>
    fetchApi<PaginatedResponse<ModerationItem>>(
      `/admin/moderation?type=${type || ''}&status=${status}`
    ),

  getById: (itemId: string) => fetchApi<ModerationItem>(`/admin/moderation/${itemId}`),

  approve: (itemId: string, notes?: string) =>
    fetchApi<void>(`/admin/moderation/${itemId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),

  reject: (itemId: string, reason: string, notifyUser = true) =>
    fetchApi<void>(`/admin/moderation/${itemId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason, notifyUser }),
    }),

  requestChanges: (itemId: string, changes: string[]) =>
    fetchApi<void>(`/admin/moderation/${itemId}/request-changes`, {
      method: 'POST',
      body: JSON.stringify({ changes }),
    }),

  bulkApprove: (itemIds: string[]) =>
    fetchApi<{ approved: number; failed: number }>(`/admin/moderation/bulk-approve`, {
      method: 'POST',
      body: JSON.stringify({ itemIds }),
    }),
};

// ============================================================================
// Disputes
// ============================================================================

export interface Dispute {
  id: string;
  type: 'payment' | 'quality' | 'communication' | 'scope' | 'other';
  status: 'open' | 'under_review' | 'resolved' | 'escalated';
  priority: 'low' | 'medium' | 'high' | 'critical';
  freelancerId: string;
  freelancerName: string;
  clientId: string;
  clientName: string;
  contractId: string;
  contractAmount: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Resolution {
  type: 'full_refund' | 'partial_refund' | 'release_payment' | 'split' | 'dismiss';
  freelancerAmount?: number;
  clientAmount?: number;
  reasoning: string;
  evidence?: string[];
}

export const disputesApi = {
  list: (filters: { status?: string; type?: string; priority?: string } = {}) =>
    fetchApi<PaginatedResponse<Dispute>>(
      `/admin/disputes?${new URLSearchParams(filters).toString()}`
    ),

  getById: (disputeId: string) => fetchApi<Dispute>(`/admin/disputes/${disputeId}`),

  getTimeline: (disputeId: string) =>
    fetchApi<{ events: { type: string; description: string; timestamp: string; actor: string }[] }>(
      `/admin/disputes/${disputeId}/timeline`
    ),

  addMessage: (disputeId: string, message: string, attachments?: string[]) =>
    fetchApi<void>(`/admin/disputes/${disputeId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message, attachments }),
    }),

  resolve: (disputeId: string, resolution: Resolution) =>
    fetchApi<void>(`/admin/disputes/${disputeId}/resolve`, {
      method: 'POST',
      body: JSON.stringify(resolution),
    }),

  escalate: (disputeId: string, reason: string) =>
    fetchApi<void>(`/admin/disputes/${disputeId}/escalate`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  assign: (disputeId: string, adminId: string) =>
    fetchApi<void>(`/admin/disputes/${disputeId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ adminId }),
    }),
};

// ============================================================================
// Payments
// ============================================================================

export interface Transaction {
  id: string;
  type: 'payment' | 'payout' | 'refund' | 'fee' | 'bonus';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  amount: number;
  currency: string;
  fromUserId?: string;
  fromUserName?: string;
  toUserId?: string;
  toUserName?: string;
  contractId?: string;
  createdAt: string;
  completedAt?: string;
}

export const paymentsApi = {
  list: (filters: { type?: string; status?: string; dateFrom?: string; dateTo?: string } = {}) =>
    fetchApi<PaginatedResponse<Transaction>>(
      `/admin/payments?${new URLSearchParams(filters).toString()}`
    ),

  getById: (transactionId: string) => fetchApi<Transaction>(`/admin/payments/${transactionId}`),

  refund: (transactionId: string, amount: number, reason: string) =>
    fetchApi<{ refundId: string }>(`/admin/payments/${transactionId}/refund`, {
      method: 'POST',
      body: JSON.stringify({ amount, reason }),
    }),

  manualPayout: (userId: string, amount: number, reason: string) =>
    fetchApi<{ payoutId: string }>(`/admin/payments/manual-payout`, {
      method: 'POST',
      body: JSON.stringify({ userId, amount, reason }),
    }),

  getStats: (period: 'day' | 'week' | 'month' | 'year') =>
    fetchApi<{
      totalVolume: number;
      totalFees: number;
      transactions: number;
      avgTransactionSize: number;
    }>(`/admin/payments/stats?period=${period}`),
};

// ============================================================================
// SkillPod
// ============================================================================

export interface SkillPodSession {
  id: string;
  freelancerId: string;
  freelancerName: string;
  clientId: string;
  clientName: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  startTime: string;
  endTime?: string;
  duration: number;
  hasRecording: boolean;
  hasViolations: boolean;
}

export interface SkillPodViolation {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  type: 'screen_capture' | 'unauthorized_app' | 'idle_detection' | 'network_violation' | 'other';
  severity: 'low' | 'medium' | 'high';
  description: string;
  timestamp: string;
  resolved: boolean;
}

export const skillpodApi = {
  listSessions: (filters: { status?: string; date?: string } = {}) =>
    fetchApi<PaginatedResponse<SkillPodSession>>(
      `/admin/skillpod/sessions?${new URLSearchParams(filters).toString()}`
    ),

  getSession: (sessionId: string) =>
    fetchApi<SkillPodSession>(`/admin/skillpod/sessions/${sessionId}`),

  killSession: (sessionId: string, reason: string) =>
    fetchApi<void>(`/admin/skillpod/sessions/${sessionId}/kill`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getRecording: (sessionId: string) =>
    fetchApi<{ url: string; expiresAt: string }>(`/admin/skillpod/sessions/${sessionId}/recording`),

  listViolations: (filters: { type?: string; severity?: string; resolved?: boolean } = {}) =>
    fetchApi<PaginatedResponse<SkillPodViolation>>(
      `/admin/skillpod/violations?${new URLSearchParams(filters as Record<string, string>).toString()}`
    ),

  resolveViolation: (violationId: string, action: string, notes: string) =>
    fetchApi<void>(`/admin/skillpod/violations/${violationId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ action, notes }),
    }),

  getStats: () =>
    fetchApi<{
      activeSessions: number;
      todaySessions: number;
      avgDuration: number;
      violations24h: number;
    }>(`/admin/skillpod/stats`),
};

// ============================================================================
// Reports
// ============================================================================

export interface Report {
  id: string;
  name: string;
  type: string;
  status: ReportStatus;
  format: ReportFormat;
  createdAt: string;
  downloadUrl?: string;
}

export const reportsApi = {
  list: () => fetchApi<PaginatedResponse<Report>>(`/admin/reports`),

  generate: (config: {
    name: string;
    type: string;
    dateRange: { from: string; to: string };
    filters?: Record<string, unknown>;
    format: ReportFormat;
  }) =>
    fetchApi<{ reportId: string }>(`/admin/reports/generate`, {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  getStatus: (reportId: string) => fetchApi<Report>(`/admin/reports/${reportId}`),

  download: (reportId: string) => fetchApi<{ url: string }>(`/admin/reports/${reportId}/download`),

  schedule: (config: {
    name: string;
    type: string;
    schedule: ReportSchedule;
    recipients: string[];
    format: ReportFormat;
  }) =>
    fetchApi<{ scheduleId: string }>(`/admin/reports/schedule`, {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  getRealtime: () =>
    fetchApi<{
      activeUsers: number;
      activeSessions: number;
      revenue24h: number;
      newUsers24h: number;
    }>(`/admin/reports/realtime`),
};

// ============================================================================
// Settings
// ============================================================================

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  segments: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PlatformSettings {
  commissionRate: number;
  minWithdrawal: number;
  maxWithdrawal: number;
  maintenanceMode: boolean;
  registrationOpen: boolean;
}

export const settingsApi = {
  getFlags: () => fetchApi<FeatureFlag[]>(`/admin/settings/feature-flags`),

  updateFlag: (flagId: string, updates: Partial<FeatureFlag>) =>
    fetchApi<FeatureFlag>(`/admin/settings/feature-flags/${flagId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  createFlag: (flag: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'>) =>
    fetchApi<FeatureFlag>(`/admin/settings/feature-flags`, {
      method: 'POST',
      body: JSON.stringify(flag),
    }),

  deleteFlag: (flagId: string) =>
    fetchApi<void>(`/admin/settings/feature-flags/${flagId}`, { method: 'DELETE' }),

  getPlatformSettings: () => fetchApi<PlatformSettings>(`/admin/settings/platform`),

  updatePlatformSettings: (settings: Partial<PlatformSettings>) =>
    fetchApi<PlatformSettings>(`/admin/settings/platform`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    }),
};

// ============================================================================
// Audit
// ============================================================================

export interface AuditLogEntry {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  resource: string;
  resourceId: string;
  details: Record<string, unknown>;
  ipAddress: string;
  timestamp: string;
}

export const auditApi = {
  list: (
    filters: {
      adminId?: string;
      action?: string;
      resource?: string;
      dateFrom?: string;
      dateTo?: string;
    } = {}
  ) =>
    fetchApi<PaginatedResponse<AuditLogEntry>>(
      `/admin/audit?${new URLSearchParams(filters).toString()}`
    ),

  getById: (entryId: string) => fetchApi<AuditLogEntry>(`/admin/audit/${entryId}`),

  export: (filters: { dateFrom: string; dateTo: string; format: 'csv' | 'json' }) =>
    fetchApi<{ url: string }>(`/admin/audit/export?${new URLSearchParams(filters).toString()}`),
};

// ============================================================================
// Export all APIs
// ============================================================================

export const adminApi = {
  users: usersApi,
  moderation: moderationApi,
  disputes: disputesApi,
  payments: paymentsApi,
  skillpod: skillpodApi,
  reports: reportsApi,
  settings: settingsApi,
  audit: auditApi,
};

export default adminApi;
