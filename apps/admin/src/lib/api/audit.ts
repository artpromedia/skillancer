/**
 * Audit API Client
 * Handles audit log, activity timeline, and compliance operations
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

// =============================================================================
// TYPES
// =============================================================================

export type ActivityType =
  | 'login'
  | 'logout'
  | 'profile_update'
  | 'bid_submitted'
  | 'contract_created'
  | 'contract_completed'
  | 'payment_received'
  | 'payment_sent'
  | 'message_sent'
  | 'verification_submitted'
  | 'verification_approved'
  | 'verification_rejected'
  | 'support_ticket'
  | 'password_change'
  | 'settings_update'
  | 'api_key_created'
  | 'api_key_revoked'
  | 'session_terminated'
  | 'mfa_enabled'
  | 'mfa_disabled';

export type AuditCategory =
  | 'authentication'
  | 'authorization'
  | 'data_access'
  | 'data_modification'
  | 'financial'
  | 'compliance'
  | 'security'
  | 'system';

export type ActorType = 'user' | 'admin' | 'system' | 'api';

export type OutcomeStatus = 'success' | 'failure' | 'partial';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
}

export interface AuditLogEntry {
  id: string;
  eventType: string;
  eventCategory: AuditCategory;
  actorId: string;
  actorType: ActorType;
  actorName?: string;
  actorEmail?: string;
  resourceType?: string;
  resourceId?: string;
  description: string;
  outcomeStatus: OutcomeStatus;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  integrityHash?: string;
  previousHash?: string;
  complianceTags?: string[];
  createdAt: string;
}

export interface ActivityFilters {
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
  eventType?: ActivityType;
  eventCategories?: AuditCategory[];
  actorId?: string;
  actorType?: ActorType;
  outcomeStatus?: OutcomeStatus;
  searchText?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UserActivityFilters {
  startDate?: string;
  endDate?: string;
  limit?: number;
  page?: number;
  pageSize?: number;
  eventType?: ActivityType;
}

export interface PaginatedActivityResponse {
  data: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UserActivityTimeline {
  userId: string;
  activities: ActivityItem[];
  total: number;
  hasMore: boolean;
}

export interface ExportRequest {
  filters: ActivityFilters;
  format: 'csv' | 'json' | 'pdf';
  includeFields?: string[];
}

export interface ExportRecord {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: 'csv' | 'json' | 'pdf';
  downloadUrl?: string;
  expiresAt?: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface IntegrityCheckResult {
  id: string;
  integrityValid: boolean;
  integrityHash: string;
  previousHash?: string;
}

// =============================================================================
// API HELPERS
// =============================================================================

interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorBody = (await response.json()) as { error?: string };
      if (errorBody.error) {
        errorMessage = errorBody.error;
      }
    } catch {
      // Use default error message if JSON parsing fails
    }
    return {
      data: null as unknown as T,
      success: false,
      error: errorMessage,
    };
  }

  const data = (await response.json()) as T;
  return { data, success: true };
}

type QueryParamValue = string | number | boolean | string[] | undefined | null;

function buildQueryString(params: { [key: string]: QueryParamValue }): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        searchParams.set(key, value.join(','));
      } else {
        searchParams.set(key, String(value));
      }
    }
  }

  return searchParams.toString();
}

// =============================================================================
// AUDIT API
// =============================================================================

export const auditApi = {
  // ===========================================================================
  // USER ACTIVITY
  // ===========================================================================

  /**
   * Get activity log for a specific user
   */
  getUserActivityLog: async (
    userId: string,
    filters: UserActivityFilters = {}
  ): Promise<ApiResponse<UserActivityTimeline>> => {
    const queryString = buildQueryString(filters as { [key: string]: QueryParamValue });
    return fetchApi<UserActivityTimeline>(
      `/audit/users/${userId}/timeline${queryString ? `?${queryString}` : ''}`
    );
  },

  /**
   * Get system-wide activity log (all users)
   */
  getSystemActivityLog: async (
    filters: ActivityFilters = {}
  ): Promise<ApiResponse<PaginatedActivityResponse>> => {
    const queryString = buildQueryString(filters as { [key: string]: QueryParamValue });
    return fetchApi<PaginatedActivityResponse>(
      `/audit/logs${queryString ? `?${queryString}` : ''}`
    );
  },

  /**
   * Get details for a specific activity/audit entry
   */
  getActivityDetails: async (activityId: string): Promise<ApiResponse<AuditLogEntry>> => {
    return fetchApi<AuditLogEntry>(`/audit/logs/${activityId}`);
  },

  /**
   * Verify integrity of an audit log entry
   */
  verifyIntegrity: async (activityId: string): Promise<ApiResponse<IntegrityCheckResult>> => {
    return fetchApi<IntegrityCheckResult>(`/audit/logs/${activityId}/verify`);
  },

  // ===========================================================================
  // RESOURCE AUDIT TRAIL
  // ===========================================================================

  /**
   * Get audit trail for a specific resource
   */
  getResourceAuditTrail: async (
    resourceType: string,
    resourceId: string,
    filters: { startDate?: string; endDate?: string; limit?: number } = {}
  ): Promise<ApiResponse<AuditLogEntry[]>> => {
    const queryString = buildQueryString(filters);
    return fetchApi<AuditLogEntry[]>(
      `/audit/resources/${resourceType}/${resourceId}/trail${queryString ? `?${queryString}` : ''}`
    );
  },

  // ===========================================================================
  // EXPORT
  // ===========================================================================

  /**
   * Request an export of activity logs
   */
  exportActivityLog: async (request: ExportRequest): Promise<ApiResponse<ExportRecord>> => {
    return fetchApi<ExportRecord>('/audit/exports', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Get status of an export request
   */
  getExportStatus: async (exportId: string): Promise<ApiResponse<ExportRecord>> => {
    return fetchApi<ExportRecord>(`/audit/exports/${exportId}`);
  },

  /**
   * List all export requests for current user
   */
  listExports: async (
    page = 1,
    pageSize = 10
  ): Promise<ApiResponse<{ exports: ExportRecord[]; total: number }>> => {
    return fetchApi<{ exports: ExportRecord[]; total: number }>(
      `/audit/exports?page=${page}&pageSize=${pageSize}`
    );
  },

  /**
   * Download an exported file
   */
  downloadExport: async (exportId: string): Promise<Blob> => {
    const response = await fetch(`${API_BASE}/audit/exports/${exportId}/download`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to download export: ${response.status}`);
    }

    return response.blob();
  },

  // ===========================================================================
  // COMPLIANCE
  // ===========================================================================

  /**
   * Get compliance report for a specific tag
   */
  getComplianceReport: async (
    tag: string,
    startDate: string,
    endDate: string
  ): Promise<
    ApiResponse<{
      tag: string;
      period: { start: string; end: string };
      totalEvents: number;
      eventsByCategory: Record<string, number>;
      eventsByOutcome: Record<string, number>;
      summary: string;
    }>
  > => {
    return fetchApi(`/audit/compliance/${tag}/report?startDate=${startDate}&endDate=${endDate}`);
  },

  // ===========================================================================
  // WRITE OPERATIONS (for system use)
  // ===========================================================================

  /**
   * Create a new audit log entry
   */
  createAuditLog: async (params: {
    eventType: string;
    eventCategory: AuditCategory;
    actorId: string;
    actorType: ActorType;
    description: string;
    outcomeStatus: OutcomeStatus;
    resourceType?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    complianceTags?: string[];
  }): Promise<ApiResponse<{ jobId: string; message: string }>> => {
    return fetchApi<{ jobId: string; message: string }>('/audit/logs', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
};

export default auditApi;
