/**
 * Audit Hooks
 *
 * React Query hooks for audit logging and compliance tracking in the admin panel.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';

import {
  auditService,
  type AuditLog,
  type AuditFilters,
  type AuditSeverity,
  type SecurityEvent,
  type SystemActivity,
  type AuditStats,
  type ComplianceReport,
} from '../../lib/api/services/audit';

import type { ApiResponse, PaginatedResponse } from '@skillancer/shared-api-client';

// =============================================================================
// Query Keys
// =============================================================================

export const auditKeys = {
  all: ['admin', 'audit'] as const,
  logs: () => [...auditKeys.all, 'logs'] as const,
  logList: (filters: AuditFilters) => [...auditKeys.logs(), filters] as const,
  logDetail: (id: string) => [...auditKeys.logs(), id] as const,
  entityLogs: (targetType: string, targetId: string) =>
    [...auditKeys.logs(), 'entity', targetType, targetId] as const,
  userLogs: (userId: string) => [...auditKeys.logs(), 'user', userId] as const,
  stats: () => [...auditKeys.all, 'stats'] as const,
};

export const securityKeys = {
  all: ['admin', 'security'] as const,
  events: () => [...securityKeys.all, 'events'] as const,
  eventList: (params?: Record<string, unknown>) => [...securityKeys.events(), params] as const,
  eventDetail: (id: string) => [...securityKeys.events(), id] as const,
  metrics: () => [...securityKeys.all, 'metrics'] as const,
  blockedIps: () => [...securityKeys.all, 'blocked-ips'] as const,
};

export const systemActivityKeys = {
  all: ['admin', 'system-activity'] as const,
  list: (params?: Record<string, unknown>) => [...systemActivityKeys.all, params] as const,
  detail: (id: string) => [...systemActivityKeys.all, id] as const,
};

export const complianceKeys = {
  all: ['admin', 'compliance'] as const,
  reports: () => [...complianceKeys.all, 'reports'] as const,
  reportList: (params?: Record<string, unknown>) => [...complianceKeys.reports(), params] as const,
  reportDetail: (id: string) => [...complianceKeys.reports(), id] as const,
  dataAccess: () => [...complianceKeys.all, 'data-access'] as const,
};

// =============================================================================
// Audit Log Query Hooks
// =============================================================================

/**
 * List audit logs
 */
export function useAuditLogs(
  filters: AuditFilters = {},
  options?: Omit<UseQueryOptions<PaginatedResponse<AuditLog>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: auditKeys.logList(filters),
    queryFn: () => auditService.listLogs(filters),
    ...options,
  });
}

/**
 * Get audit log by ID
 */
export function useAuditLog(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<AuditLog>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: auditKeys.logDetail(id),
    queryFn: () => auditService.getLog(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Get entity audit logs
 */
export function useEntityAuditLogs(
  targetType: string,
  targetId: string,
  params?: { page?: number; limit?: number },
  options?: Omit<UseQueryOptions<PaginatedResponse<AuditLog>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: auditKeys.entityLogs(targetType, targetId),
    queryFn: () => auditService.getEntityLogs(targetType, targetId, params),
    enabled: !!targetType && !!targetId,
    ...options,
  });
}

/**
 * Get user audit logs
 */
export function useUserAuditLogs(
  userId: string,
  params?: { page?: number; limit?: number; asActor?: boolean; asTarget?: boolean },
  options?: Omit<UseQueryOptions<PaginatedResponse<AuditLog>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: auditKeys.userLogs(userId),
    queryFn: () => auditService.getUserLogs(userId, params),
    enabled: !!userId,
    ...options,
  });
}

/**
 * Get audit stats
 */
export function useAuditStats(
  params?: { startDate?: string; endDate?: string },
  options?: Omit<UseQueryOptions<ApiResponse<AuditStats>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...auditKeys.stats(), params],
    queryFn: () => auditService.getStats(params),
    ...options,
  });
}

// =============================================================================
// Security Event Query Hooks
// =============================================================================

/**
 * List security events
 */
export function useSecurityEvents(
  params?: {
    page?: number;
    limit?: number;
    eventType?: string | string[];
    severity?: AuditSeverity | AuditSeverity[];
    status?: string | string[];
    startDate?: string;
    endDate?: string;
  },
  options?: Omit<UseQueryOptions<PaginatedResponse<SecurityEvent>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: securityKeys.eventList(params),
    queryFn: () => auditService.listSecurityEvents(params),
    ...options,
  });
}

/**
 * Get security event by ID
 */
export function useSecurityEvent(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<SecurityEvent>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: securityKeys.eventDetail(id),
    queryFn: () => auditService.getSecurityEvent(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Get security metrics
 */
export function useSecurityMetrics(options?: Omit<UseQueryOptions, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: securityKeys.metrics(),
    queryFn: () => auditService.getSecurityMetrics(),
    refetchInterval: 30000, // Refresh every 30 seconds
    ...options,
  });
}

// =============================================================================
// Security Event Mutation Hooks
// =============================================================================

/**
 * Update security event status
 */
export function useUpdateSecurityEventStatus(
  options?: UseMutationOptions<
    ApiResponse<SecurityEvent>,
    Error,
    {
      id: string;
      status: SecurityEvent['status'];
      resolution?: string;
    }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, resolution }) =>
      auditService.updateSecurityEventStatus(id, status, resolution),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: securityKeys.eventDetail(id) });
      queryClient.invalidateQueries({ queryKey: securityKeys.events() });
      queryClient.invalidateQueries({ queryKey: securityKeys.metrics() });
    },
    ...options,
  });
}

/**
 * Dismiss security event
 */
export function useDismissSecurityEvent(
  options?: UseMutationOptions<ApiResponse<SecurityEvent>, Error, { id: string; reason: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }) => auditService.dismissSecurityEvent(id, reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: securityKeys.eventDetail(id) });
      queryClient.invalidateQueries({ queryKey: securityKeys.events() });
      queryClient.invalidateQueries({ queryKey: securityKeys.metrics() });
    },
    ...options,
  });
}

/**
 * Investigate security event
 */
export function useInvestigateSecurityEvent(
  options?: UseMutationOptions<ApiResponse<SecurityEvent>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => auditService.investigateSecurityEvent(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: securityKeys.eventDetail(id) });
      queryClient.invalidateQueries({ queryKey: securityKeys.events() });
    },
    ...options,
  });
}

// =============================================================================
// System Activity Query Hooks
// =============================================================================

/**
 * List system activities
 */
export function useSystemActivities(
  params?: {
    page?: number;
    limit?: number;
    activityType?: string | string[];
    service?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  },
  options?: Omit<UseQueryOptions<PaginatedResponse<SystemActivity>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: systemActivityKeys.list(params),
    queryFn: () => auditService.listSystemActivities(params),
    ...options,
  });
}

/**
 * Get system activity by ID
 */
export function useSystemActivity(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<SystemActivity>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: systemActivityKeys.detail(id),
    queryFn: () => auditService.getSystemActivity(id),
    enabled: !!id,
    ...options,
  });
}

// =============================================================================
// Compliance Query Hooks
// =============================================================================

/**
 * List compliance reports
 */
export function useComplianceReports(
  params?: {
    page?: number;
    limit?: number;
    reportType?: ComplianceReport['reportType'];
  },
  options?: Omit<UseQueryOptions<PaginatedResponse<ComplianceReport>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: complianceKeys.reportList(params),
    queryFn: () => auditService.listComplianceReports(params),
    ...options,
  });
}

/**
 * Get compliance report
 */
export function useComplianceReport(
  reportId: string,
  options?: Omit<UseQueryOptions<ApiResponse<ComplianceReport>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: complianceKeys.reportDetail(reportId),
    queryFn: () => auditService.getComplianceReport(reportId),
    enabled: !!reportId,
    ...options,
  });
}

/**
 * Get data access logs
 */
export function useDataAccessLogs(
  params: {
    userId?: string;
    dataType?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  },
  options?: Omit<UseQueryOptions<PaginatedResponse<AuditLog>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...complianceKeys.dataAccess(), params],
    queryFn: () => auditService.getDataAccessLogs(params),
    ...options,
  });
}

// =============================================================================
// Compliance Mutation Hooks
// =============================================================================

/**
 * Generate compliance report
 */
export function useGenerateComplianceReport(
  options?: UseMutationOptions<
    ApiResponse<ComplianceReport>,
    Error,
    {
      reportType: ComplianceReport['reportType'];
      startDate: string;
      endDate: string;
      includeDetails?: boolean;
    }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params) => auditService.generateComplianceReport(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.reports() });
    },
    ...options,
  });
}

/**
 * Generate data access report
 */
export function useGenerateDataAccessReport(
  options?: UseMutationOptions<
    ApiResponse<{
      reportId: string;
      userId: string;
      generatedAt: string;
      downloadUrl: string;
      expiresAt: string;
    }>,
    Error,
    string
  >
) {
  return useMutation({
    mutationFn: (userId: string) => auditService.generateDataAccessReport(userId),
    ...options,
  });
}

// =============================================================================
// IP Management Query Hooks
// =============================================================================

/**
 * Get blocked IPs
 */
export function useBlockedIps(
  params?: { page?: number; limit?: number },
  options?: Omit<UseQueryOptions, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...securityKeys.blockedIps(), params],
    queryFn: () => auditService.getBlockedIps(params),
    ...options,
  });
}

// =============================================================================
// IP Management Mutation Hooks
// =============================================================================

/**
 * Block IP
 */
export function useBlockIp(
  options?: UseMutationOptions<
    ApiResponse<{ id: string }>,
    Error,
    {
      ip: string;
      reason: string;
      duration?: number;
    }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => auditService.blockIp(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: securityKeys.blockedIps() });
      queryClient.invalidateQueries({ queryKey: securityKeys.metrics() });
    },
    ...options,
  });
}

/**
 * Unblock IP
 */
export function useUnblockIp(options?: UseMutationOptions<ApiResponse<void>, Error, string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => auditService.unblockIp(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: securityKeys.blockedIps() });
      queryClient.invalidateQueries({ queryKey: securityKeys.metrics() });
    },
    ...options,
  });
}
