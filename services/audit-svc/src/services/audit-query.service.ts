/**
 * @module @skillancer/audit-svc/services/audit-query.service
 * Audit log query and search service
 */

import * as auditLogRepository from '../repositories/audit-log.repository.js';

import type {
  AuditLogEntry,
  AuditSearchFilters,
  AuditSearchResult,
  UserActivityTimeline,
  ResourceAuditTrail,
  AuditTimelineEvent,
} from '../types/index.js';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;

export async function searchAuditLogs(filters: AuditSearchFilters): Promise<AuditSearchResult> {
  const page = filters.page ?? 1;
  const pageSize = Math.min(filters.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const skip = (page - 1) * pageSize;

  const [data, total] = await Promise.all([
    auditLogRepository.findAuditLogs(filters, skip, pageSize),
    auditLogRepository.countAuditLogs(filters),
  ]);

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
    filters,
  };
}

export async function getAuditLogById(id: string): Promise<AuditLogEntry | null> {
  return auditLogRepository.findAuditLogById(id);
}

export async function getUserActivityTimeline(
  userId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}
): Promise<UserActivityTimeline> {
  const { startDate, endDate, limit = 100 } = options;

  const filters: AuditSearchFilters = {
    actorId: userId,
    startDate,
    endDate,
    sortField: 'timestamp',
    sortOrder: 'desc',
    pageSize: limit,
  };

  const logs = await auditLogRepository.findAuditLogs(filters, 0, limit);

  const events: AuditTimelineEvent[] = logs.map((log) => ({
    id: log.id,
    timestamp: log.timestamp,
    eventType: log.eventType,
    category: log.eventCategory,
    action: log.action,
    resourceType: log.resource.type,
    resourceId: log.resource.id,
    outcome: log.outcome.status,
    ipAddress: log.request?.ipAddress,
    userAgent: log.request?.userAgent,
  }));

  const summary = await generateUserActivitySummary(userId, startDate, endDate);

  return {
    userId,
    events,
    summary,
    generatedAt: new Date(),
  };
}

async function generateUserActivitySummary(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<UserActivityTimeline['summary']> {
  const filters: AuditSearchFilters = {
    actorId: userId,
    startDate,
    endDate,
  };

  const total = await auditLogRepository.countAuditLogs(filters);
  const categoryBreakdown = await auditLogRepository.aggregateByCategory(filters);
  const hourlyTrends = await auditLogRepository.aggregateHourlyTrends(filters);

  const eventsByCategory: Record<string, number> = {};
  for (const cat of categoryBreakdown) {
    eventsByCategory[cat._id] = cat.count;
  }

  const mostActiveHours = hourlyTrends
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((h) => h._id);

  return {
    totalEvents: total,
    eventsByCategory,
    mostActiveHours,
    firstActivity: startDate,
    lastActivity: endDate,
  };
}

export async function getResourceAuditTrail(
  resourceType: string,
  resourceId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}
): Promise<ResourceAuditTrail> {
  const { startDate, endDate, limit = 100 } = options;

  const filters: AuditSearchFilters = {
    resourceType,
    resourceId,
    startDate,
    endDate,
    sortField: 'timestamp',
    sortOrder: 'asc',
    pageSize: limit,
  };

  const logs = await auditLogRepository.findAuditLogs(filters, 0, limit);

  const changes = logs.map((log) => ({
    timestamp: log.timestamp,
    action: log.action,
    actor: log.actor,
    changes: log.changes,
    outcome: log.outcome.status,
  }));

  return {
    resourceType,
    resourceId,
    changes,
    generatedAt: new Date(),
  };
}

export async function getComplianceReport(
  complianceTag: string,
  options: {
    startDate: Date;
    endDate: Date;
  }
): Promise<{
  tag: string;
  period: { start: Date; end: Date };
  totalEvents: number;
  eventsByCategory: Record<string, number>;
  eventsByOutcome: Record<string, number>;
  generatedAt: Date;
}> {
  const filters: AuditSearchFilters = {
    complianceTags: [complianceTag],
    startDate: options.startDate,
    endDate: options.endDate,
  };

  const [totalEvents, categoryBreakdown] = await Promise.all([
    auditLogRepository.countAuditLogs(filters),
    auditLogRepository.aggregateByCategory(filters),
  ]);

  const eventsByCategory: Record<string, number> = {};
  for (const cat of categoryBreakdown) {
    eventsByCategory[cat._id] = cat.count;
  }

  return {
    tag: complianceTag,
    period: { start: options.startDate, end: options.endDate },
    totalEvents,
    eventsByCategory,
    eventsByOutcome: {},
    generatedAt: new Date(),
  };
}
