/**
 * Audit Service
 *
 * Type-safe API methods for audit logging and compliance tracking in the admin panel.
 */

import { getApiClient, withAuditContext } from '../api-client';

import type { ApiResponse, PaginatedResponse } from '@skillancer/shared-api-client';

// =============================================================================
// Types
// =============================================================================

export type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'export'
  | 'import'
  | 'approve'
  | 'reject'
  | 'suspend'
  | 'unsuspend'
  | 'ban'
  | 'verify'
  | 'impersonate'
  | 'escalate'
  | 'assign'
  | 'config_change'
  | 'permission_change';

export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AuditCategory =
  | 'authentication'
  | 'authorization'
  | 'user_management'
  | 'content_moderation'
  | 'payment'
  | 'dispute'
  | 'support'
  | 'system'
  | 'data_access'
  | 'configuration';

export interface AuditLog {
  id: string;
  timestamp: string;
  action: AuditAction;
  category: AuditCategory;
  severity: AuditSeverity;
  actorId: string;
  actorType: 'user' | 'admin' | 'system' | 'service';
  actorName?: string;
  actorEmail?: string;
  actorIp?: string;
  actorUserAgent?: string;
  targetType: string;
  targetId?: string;
  targetName?: string;
  description: string;
  metadata?: Record<string, unknown>;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  requestId?: string;
  sessionId?: string;
  success: boolean;
  errorMessage?: string;
}

export interface AuditFilters {
  page?: number;
  limit?: number;
  action?: AuditAction | AuditAction[];
  category?: AuditCategory | AuditCategory[];
  severity?: AuditSeverity | AuditSeverity[];
  actorId?: string;
  actorType?: 'user' | 'admin' | 'system' | 'service';
  targetType?: string;
  targetId?: string;
  success?: boolean;
  search?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'timestamp' | 'severity' | 'action';
  sortOrder?: 'asc' | 'desc';
}

export interface SecurityEvent {
  id: string;
  timestamp: string;
  eventType:
    | 'failed_login'
    | 'suspicious_activity'
    | 'brute_force_attempt'
    | 'unauthorized_access'
    | 'data_breach_attempt'
    | 'anomaly_detected'
    | 'rate_limit_exceeded'
    | 'ip_blocked'
    | 'session_hijack_attempt'
    | 'privilege_escalation';
  severity: AuditSeverity;
  sourceIp: string;
  sourceCountry?: string;
  userId?: string;
  userEmail?: string;
  description: string;
  metadata?: Record<string, unknown>;
  status: 'new' | 'investigating' | 'resolved' | 'dismissed';
  resolvedBy?: string;
  resolvedAt?: string;
  resolution?: string;
}

export interface SystemActivity {
  id: string;
  timestamp: string;
  activityType:
    | 'deployment'
    | 'config_change'
    | 'maintenance'
    | 'backup'
    | 'restore'
    | 'migration'
    | 'service_restart'
    | 'cron_job'
    | 'cache_clear'
    | 'queue_operation';
  service: string;
  initiatedBy: string;
  initiatedByType: 'user' | 'system' | 'scheduled';
  description: string;
  metadata?: Record<string, unknown>;
  status: 'started' | 'completed' | 'failed';
  duration?: number;
  errorMessage?: string;
}

export interface AuditStats {
  totalEvents: number;
  eventsBySeverity: Record<AuditSeverity, number>;
  eventsByCategory: Record<AuditCategory, number>;
  eventsByAction: Record<string, number>;
  failedOperations: number;
  securityIncidents: number;
  topActors: Array<{
    actorId: string;
    actorName: string;
    eventCount: number;
  }>;
  trends: Array<{
    date: string;
    total: number;
    bySeverity: Record<AuditSeverity, number>;
  }>;
  recentCritical: AuditLog[];
}

export interface ComplianceReport {
  reportId: string;
  reportType: 'gdpr' | 'sox' | 'hipaa' | 'pci' | 'custom';
  generatedAt: string;
  generatedBy: string;
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalEvents: number;
    dataAccessEvents: number;
    userManagementEvents: number;
    securityEvents: number;
    complianceScore?: number;
  };
  sections: Array<{
    name: string;
    status: 'compliant' | 'non-compliant' | 'needs-review';
    findings: string[];
    recommendations: string[];
  }>;
  downloadUrl?: string;
}

// =============================================================================
// Audit API Service
// =============================================================================

export const auditService = {
  // =============================================================================
  // Audit Logs
  // =============================================================================

  /**
   * List audit logs
   */
  async listLogs(filters: AuditFilters = {}): Promise<PaginatedResponse<AuditLog>> {
    const client = getApiClient();
    const { page = 1, limit = 50, action, category, severity, ...rest } = filters;

    const params: Record<string, unknown> = { page, limit, ...rest };
    if (action) {
      params.action = Array.isArray(action) ? action.join(',') : action;
    }
    if (category) {
      params.category = Array.isArray(category) ? category.join(',') : category;
    }
    if (severity) {
      params.severity = Array.isArray(severity) ? severity.join(',') : severity;
    }

    return withAuditContext('audit.logs.list')(
      client.get<AuditLog[]>('/admin/audit/logs', { params })
    ) as Promise<PaginatedResponse<AuditLog>>;
  },

  /**
   * Get audit log by ID
   */
  async getLog(id: string): Promise<ApiResponse<AuditLog>> {
    const client = getApiClient();
    return withAuditContext('audit.log.view')(client.get<AuditLog>(`/admin/audit/logs/${id}`));
  },

  /**
   * Get logs for specific entity
   */
  async getEntityLogs(
    targetType: string,
    targetId: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<AuditLog>> {
    const client = getApiClient();
    return withAuditContext('audit.entity.logs.view')(
      client.get<AuditLog[]>(`/admin/audit/logs/entity/${targetType}/${targetId}`, { params })
    ) as Promise<PaginatedResponse<AuditLog>>;
  },

  /**
   * Get logs for specific user
   */
  async getUserLogs(
    userId: string,
    params?: { page?: number; limit?: number; asActor?: boolean; asTarget?: boolean }
  ): Promise<PaginatedResponse<AuditLog>> {
    const client = getApiClient();
    return withAuditContext('audit.user.logs.view')(
      client.get<AuditLog[]>(`/admin/audit/logs/user/${userId}`, { params })
    ) as Promise<PaginatedResponse<AuditLog>>;
  },

  // =============================================================================
  // Security Events
  // =============================================================================

  /**
   * List security events
   */
  async listSecurityEvents(params?: {
    page?: number;
    limit?: number;
    eventType?: string | string[];
    severity?: AuditSeverity | AuditSeverity[];
    status?: string | string[];
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<SecurityEvent>> {
    const client = getApiClient();
    const processedParams: Record<string, unknown> = { ...params };

    if (params?.eventType) {
      processedParams.eventType = Array.isArray(params.eventType)
        ? params.eventType.join(',')
        : params.eventType;
    }
    if (params?.severity) {
      processedParams.severity = Array.isArray(params.severity)
        ? params.severity.join(',')
        : params.severity;
    }
    if (params?.status) {
      processedParams.status = Array.isArray(params.status)
        ? params.status.join(',')
        : params.status;
    }

    return withAuditContext('security.events.list')(
      client.get<SecurityEvent[]>('/admin/audit/security-events', { params: processedParams })
    ) as Promise<PaginatedResponse<SecurityEvent>>;
  },

  /**
   * Get security event by ID
   */
  async getSecurityEvent(id: string): Promise<ApiResponse<SecurityEvent>> {
    const client = getApiClient();
    return withAuditContext('security.event.view')(
      client.get<SecurityEvent>(`/admin/audit/security-events/${id}`)
    );
  },

  /**
   * Update security event status
   */
  async updateSecurityEventStatus(
    id: string,
    status: SecurityEvent['status'],
    resolution?: string
  ): Promise<ApiResponse<SecurityEvent>> {
    const client = getApiClient();
    return withAuditContext('security.event.update')(
      client.patch<SecurityEvent>(`/admin/audit/security-events/${id}`, { status, resolution })
    );
  },

  /**
   * Dismiss security event
   */
  async dismissSecurityEvent(id: string, reason: string): Promise<ApiResponse<SecurityEvent>> {
    const client = getApiClient();
    return withAuditContext('security.event.dismiss')(
      client.post<SecurityEvent>(`/admin/audit/security-events/${id}/dismiss`, { reason })
    );
  },

  /**
   * Investigate security event
   */
  async investigateSecurityEvent(id: string): Promise<ApiResponse<SecurityEvent>> {
    const client = getApiClient();
    return withAuditContext('security.event.investigate')(
      client.post<SecurityEvent>(`/admin/audit/security-events/${id}/investigate`)
    );
  },

  // =============================================================================
  // System Activity
  // =============================================================================

  /**
   * List system activities
   */
  async listSystemActivities(params?: {
    page?: number;
    limit?: number;
    activityType?: string | string[];
    service?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<SystemActivity>> {
    const client = getApiClient();
    const processedParams: Record<string, unknown> = { ...params };

    if (params?.activityType) {
      processedParams.activityType = Array.isArray(params.activityType)
        ? params.activityType.join(',')
        : params.activityType;
    }

    return client.get<SystemActivity[]>('/admin/audit/system-activities', {
      params: processedParams,
    }) as Promise<PaginatedResponse<SystemActivity>>;
  },

  /**
   * Get system activity by ID
   */
  async getSystemActivity(id: string): Promise<ApiResponse<SystemActivity>> {
    const client = getApiClient();
    return client.get<SystemActivity>(`/admin/audit/system-activities/${id}`);
  },

  // =============================================================================
  // Statistics
  // =============================================================================

  /**
   * Get audit statistics
   */
  async getStats(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<AuditStats>> {
    const client = getApiClient();
    return client.get<AuditStats>('/admin/audit/stats', { params });
  },

  /**
   * Get real-time security metrics
   */
  async getSecurityMetrics(): Promise<
    ApiResponse<{
      activeThreats: number;
      blockedIps: number;
      failedLogins24h: number;
      suspiciousActivities24h: number;
      lastSecurityIncident?: SecurityEvent;
      recentFailedLogins: Array<{
        ip: string;
        attempts: number;
        lastAttempt: string;
        country?: string;
      }>;
    }>
  > {
    const client = getApiClient();
    return client.get('/admin/audit/security-metrics');
  },

  // =============================================================================
  // Compliance
  // =============================================================================

  /**
   * Generate compliance report
   */
  async generateComplianceReport(params: {
    reportType: ComplianceReport['reportType'];
    startDate: string;
    endDate: string;
    includeDetails?: boolean;
  }): Promise<ApiResponse<ComplianceReport>> {
    const client = getApiClient();
    return withAuditContext('compliance.report.generate')(
      client.post<ComplianceReport>('/admin/audit/compliance/reports', params)
    );
  },

  /**
   * List compliance reports
   */
  async listComplianceReports(params?: {
    page?: number;
    limit?: number;
    reportType?: ComplianceReport['reportType'];
  }): Promise<PaginatedResponse<ComplianceReport>> {
    const client = getApiClient();
    return client.get<ComplianceReport[]>('/admin/audit/compliance/reports', {
      params,
    }) as Promise<PaginatedResponse<ComplianceReport>>;
  },

  /**
   * Get compliance report
   */
  async getComplianceReport(reportId: string): Promise<ApiResponse<ComplianceReport>> {
    const client = getApiClient();
    return withAuditContext('compliance.report.view')(
      client.get<ComplianceReport>(`/admin/audit/compliance/reports/${reportId}`)
    );
  },

  // =============================================================================
  // Data Access Tracking
  // =============================================================================

  /**
   * Get data access logs (for GDPR/privacy)
   */
  async getDataAccessLogs(params: {
    userId?: string;
    dataType?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<AuditLog>> {
    const client = getApiClient();
    return withAuditContext('data.access.logs.view')(
      client.get<AuditLog[]>('/admin/audit/data-access', { params })
    ) as Promise<PaginatedResponse<AuditLog>>;
  },

  /**
   * Generate data access report for user (GDPR subject access request)
   */
  async generateDataAccessReport(userId: string): Promise<
    ApiResponse<{
      reportId: string;
      userId: string;
      generatedAt: string;
      downloadUrl: string;
      expiresAt: string;
    }>
  > {
    const client = getApiClient();
    return withAuditContext('data.access.report.generate')(
      client.post(`/admin/audit/data-access/report`, { userId })
    );
  },

  // =============================================================================
  // Export
  // =============================================================================

  /**
   * Export audit logs
   */
  async exportLogs(filters: AuditFilters & { format: 'csv' | 'xlsx' | 'json' }): Promise<Blob> {
    const client = getApiClient();
    const axios = client.getAxiosInstance();
    const response = await axios.get('/admin/audit/logs/export', {
      params: filters,
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Export security events
   */
  async exportSecurityEvents(params: {
    format: 'csv' | 'xlsx' | 'json';
    startDate?: string;
    endDate?: string;
    eventType?: string[];
    severity?: AuditSeverity[];
  }): Promise<Blob> {
    const client = getApiClient();
    const axios = client.getAxiosInstance();
    const response = await axios.get('/admin/audit/security-events/export', {
      params: {
        ...params,
        eventType: params.eventType?.join(','),
        severity: params.severity?.join(','),
      },
      responseType: 'blob',
    });
    return response.data;
  },

  // =============================================================================
  // IP Management
  // =============================================================================

  /**
   * Get blocked IPs
   */
  async getBlockedIps(params?: { page?: number; limit?: number }): Promise<
    PaginatedResponse<{
      id: string;
      ip: string;
      reason: string;
      blockedAt: string;
      blockedBy: string;
      expiresAt?: string;
      permanent: boolean;
    }>
  > {
    const client = getApiClient();
    return client.get('/admin/audit/blocked-ips', { params }) as Promise<
      PaginatedResponse<{
        id: string;
        ip: string;
        reason: string;
        blockedAt: string;
        blockedBy: string;
        expiresAt?: string;
        permanent: boolean;
      }>
    >;
  },

  /**
   * Block IP
   */
  async blockIp(data: {
    ip: string;
    reason: string;
    duration?: number; // hours, null for permanent
  }): Promise<ApiResponse<{ id: string }>> {
    const client = getApiClient();
    return withAuditContext('ip.block')(client.post('/admin/audit/blocked-ips', data));
  },

  /**
   * Unblock IP
   */
  async unblockIp(id: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return withAuditContext('ip.unblock')(client.delete<void>(`/admin/audit/blocked-ips/${id}`));
  },
};

export default auditService;
