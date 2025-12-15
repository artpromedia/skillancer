/**
 * @module @skillancer/audit-svc/services/audit-compliance.service
 * Compliance reporting and GDPR operations
 */

import { searchAuditLogs, getComplianceReport } from './audit-query.service.js';
import * as auditLogRepository from '../repositories/audit-log.repository.js';
import {
  OutcomeStatus,
  AuditCategory,
  type AuditSearchFilters,
  type RetentionPolicy,
} from '../types/index.js';

export interface ComplianceReportOptions {
  startDate: Date;
  endDate: Date;
  includeBreakdowns?: boolean;
  includeViolations?: boolean;
}

export interface PolicyViolation {
  id: string;
  timestamp: Date;
  eventType: string;
  resource: { type: string; id: string };
  actor: { id: string; type: string };
  violation: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ComplianceBreakdown {
  eventTypes: Record<string, number>;
  actors: Array<{ id: string; count: number }>;
  resources: Record<string, number>;
  outcomes: Record<string, number>;
  hourlyDistribution: Record<number, number>;
}

export interface FullComplianceReport {
  tag: string;
  period: { start: Date; end: Date };
  summary: {
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    uniqueActors: number;
    uniqueResources: number;
    complianceScore: number;
  };
  eventsByCategory: Record<string, number>;
  eventsByOutcome: Record<string, number>;
  breakdowns?: ComplianceBreakdown;
  violations?: PolicyViolation[];
  recommendations: string[];
  generatedAt: Date;
}

/**
 * Generate a full compliance report for a specific tag (GDPR, HIPAA, SOC2, etc.)
 */
export async function generateFullComplianceReport(
  complianceTag: string,
  options: ComplianceReportOptions
): Promise<FullComplianceReport> {
  const { startDate, endDate, includeBreakdowns = true, includeViolations = true } = options;

  // Get basic compliance data
  const basicReport = await getComplianceReport(complianceTag, { startDate, endDate });

  // Get detailed statistics
  const filters: AuditSearchFilters = {
    complianceTags: [complianceTag],
    startDate,
    endDate,
  };

  const [successCount, failedCount, uniqueActorCount, uniqueResourceCount, categoryBreakdown] =
    await Promise.all([
      auditLogRepository.countAuditLogs({
        ...filters,
        outcomeStatus: OutcomeStatus.SUCCESS,
      }),
      auditLogRepository.countAuditLogs({
        ...filters,
        outcomeStatus: OutcomeStatus.FAILURE,
      }),
      auditLogRepository.countUniqueActors(filters),
      auditLogRepository.countUniqueResources(filters),
      auditLogRepository.aggregateByCategory(filters),
    ]);

  const eventsByCategory: Record<string, number> = {};
  for (const cat of categoryBreakdown) {
    eventsByCategory[cat._id] = cat.count;
  }

  // Calculate compliance score (simplified formula)
  const totalEvents = basicReport.totalEvents;
  const complianceScore = totalEvents > 0 ? Math.round((successCount / totalEvents) * 100) : 100;

  const report: FullComplianceReport = {
    tag: complianceTag,
    period: { start: startDate, end: endDate },
    summary: {
      totalEvents,
      successfulEvents: successCount,
      failedEvents: failedCount,
      uniqueActors: uniqueActorCount,
      uniqueResources: uniqueResourceCount,
      complianceScore,
    },
    eventsByCategory,
    eventsByOutcome: {
      SUCCESS: successCount,
      FAILURE: failedCount,
    },
    recommendations: generateRecommendations(complianceTag, complianceScore, failedCount),
    generatedAt: new Date(),
  };

  if (includeBreakdowns) {
    report.breakdowns = await generateComplianceBreakdowns(filters);
  }

  if (includeViolations && failedCount > 0) {
    report.violations = await detectPolicyViolations(complianceTag, startDate, endDate);
  }

  return report;
}

/**
 * Generate detailed breakdowns for compliance analysis
 */
async function generateComplianceBreakdowns(
  filters: AuditSearchFilters
): Promise<ComplianceBreakdown> {
  const [eventTypeCounts, topActors, resourceCounts, hourlyTrends] = await Promise.all([
    auditLogRepository.aggregateEventCountsByType(filters),
    auditLogRepository.aggregateTopActors(filters, 10),
    auditLogRepository.aggregateResourceCounts(filters),
    auditLogRepository.aggregateHourlyTrends(filters),
  ]);

  const eventTypes: Record<string, number> = {};
  for (const et of eventTypeCounts) {
    eventTypes[et._id] = et.count;
  }

  const resources: Record<string, number> = {};
  for (const r of resourceCounts) {
    resources[r._id] = r.count;
  }

  const hourlyDistribution: Record<number, number> = {};
  for (const h of hourlyTrends) {
    hourlyDistribution[h._id] = h.count;
  }

  return {
    eventTypes,
    actors: topActors,
    resources,
    outcomes: {},
    hourlyDistribution,
  };
}

/**
 * Detect policy violations based on compliance tag
 */
async function detectPolicyViolations(
  complianceTag: string,
  startDate: Date,
  endDate: Date
): Promise<PolicyViolation[]> {
  const violations: PolicyViolation[] = [];

  // Search for failed events
  const failedEvents = await searchAuditLogs({
    complianceTags: [complianceTag],
    startDate,
    endDate,
    outcomeStatus: OutcomeStatus.FAILURE,
    pageSize: 100,
    sortField: 'timestamp',
    sortOrder: 'desc',
  });

  for (const log of failedEvents.data) {
    const violation = classifyViolation(log, complianceTag);
    if (violation) {
      violations.push(violation);
    }
  }

  // Check for specific compliance rules based on tag
  if (complianceTag === 'GDPR') {
    const gdprViolations = await checkGdprViolations(startDate, endDate);
    violations.push(...gdprViolations);
  } else if (complianceTag === 'HIPAA') {
    const hipaaViolations = await checkHipaaViolations(startDate, endDate);
    violations.push(...hipaaViolations);
  } else if (complianceTag === 'SOC2') {
    const soc2Violations = await checkSoc2Violations(startDate, endDate);
    violations.push(...soc2Violations);
  }

  return violations;
}

/**
 * Classify a failed log as a policy violation
 */
function classifyViolation(
  log: {
    id: string;
    timestamp: Date;
    eventType: string;
    resource: { type: string; id: string };
    actor: { id: string; type: string };
    outcome: { errorCode?: string; errorMessage?: string };
  },
  complianceTag: string
): PolicyViolation | null {
  const errorCode = log.outcome.errorCode ?? '';
  const errorMessage = log.outcome.errorMessage ?? '';

  // Determine severity based on error type
  let severity: PolicyViolation['severity'] = 'low';
  let violation = 'Unknown violation';

  if (
    errorCode.includes('UNAUTHORIZED') ||
    errorCode.includes('FORBIDDEN') ||
    errorMessage.toLowerCase().includes('unauthorized')
  ) {
    severity = 'high';
    violation = `Unauthorized access attempt to ${complianceTag} protected resource`;
  } else if (errorCode.includes('INVALID') || errorMessage.toLowerCase().includes('validation')) {
    severity = 'medium';
    violation = `Invalid data format for ${complianceTag} compliance`;
  } else if (errorCode.includes('TIMEOUT') || errorCode.includes('RATE_LIMIT')) {
    severity = 'low';
    violation = 'Rate limiting or timeout issue';
  } else {
    return null; // Not a policy violation
  }

  return {
    id: log.id,
    timestamp: log.timestamp,
    eventType: log.eventType,
    resource: log.resource,
    actor: log.actor,
    violation,
    severity,
  };
}

/**
 * Check for GDPR-specific violations
 */
async function checkGdprViolations(startDate: Date, endDate: Date): Promise<PolicyViolation[]> {
  const violations: PolicyViolation[] = [];

  // Check for data access without consent events
  const accessLogs = await searchAuditLogs({
    eventType: 'DATA_SENSITIVE_ACCESSED',
    startDate,
    endDate,
    pageSize: 100,
  });

  // Check for sensitive data access without proper consent
  for (const log of accessLogs.data) {
    if (!log.metadata?.consentObtained) {
      violations.push({
        id: log.id,
        timestamp: log.timestamp,
        eventType: log.eventType,
        resource: log.resource,
        actor: log.actor,
        violation: 'Sensitive data accessed without documented consent',
        severity: 'medium',
      });
    }
  }

  // Check for data export events without proper authorization
  const exportLogs = await searchAuditLogs({
    eventType: 'DATA_EXPORTED',
    complianceTags: ['GDPR'],
    startDate,
    endDate,
    pageSize: 50,
  });

  for (const log of exportLogs.data) {
    if (!log.metadata?.consentVerified) {
      violations.push({
        id: log.id,
        timestamp: log.timestamp,
        eventType: log.eventType,
        resource: log.resource,
        actor: log.actor,
        violation: 'Data export without verified consent',
        severity: 'high',
      });
    }
  }

  return violations;
}

/**
 * Check for HIPAA-specific violations
 */
async function checkHipaaViolations(startDate: Date, endDate: Date): Promise<PolicyViolation[]> {
  const violations: PolicyViolation[] = [];

  // Check for PHI access from unauthorized sources
  const phiAccess = await searchAuditLogs({
    complianceTags: ['HIPAA'],
    startDate,
    endDate,
    pageSize: 100,
  });

  for (const log of phiAccess.data) {
    // Check for access outside normal hours (simplified)
    const hour = log.timestamp.getHours();
    if (hour < 6 || hour > 22) {
      violations.push({
        id: log.id,
        timestamp: log.timestamp,
        eventType: log.eventType,
        resource: log.resource,
        actor: log.actor,
        violation: 'PHI access outside normal business hours',
        severity: 'medium',
      });
    }
  }

  return violations;
}

/**
 * Check for SOC2-specific violations
 */
async function checkSoc2Violations(startDate: Date, endDate: Date): Promise<PolicyViolation[]> {
  const violations: PolicyViolation[] = [];

  // Check for security events
  const securityEvents = await searchAuditLogs({
    eventCategories: [AuditCategory.SECURITY],
    startDate,
    endDate,
    pageSize: 100,
  });

  for (const log of securityEvents.data) {
    if (
      log.eventType.includes('BRUTE_FORCE') ||
      log.eventType.includes('UNAUTHORIZED') ||
      log.eventType.includes('SUSPICIOUS')
    ) {
      violations.push({
        id: log.id,
        timestamp: log.timestamp,
        eventType: log.eventType,
        resource: log.resource,
        actor: log.actor,
        violation: 'Security incident detected',
        severity: 'critical',
      });
    }
  }

  return violations;
}

/**
 * Generate compliance recommendations based on analysis
 */
function generateRecommendations(
  complianceTag: string,
  score: number,
  failedCount: number
): string[] {
  const recommendations: string[] = [];

  if (score < 95) {
    recommendations.push(
      `Your ${complianceTag} compliance score is ${score}%. Consider reviewing failed operations.`
    );
  }

  if (failedCount > 100) {
    recommendations.push(
      `High number of failed operations (${failedCount}) detected. Review error patterns.`
    );
  }

  if (complianceTag === 'GDPR') {
    recommendations.push('Ensure all data exports have verified user consent.');
    recommendations.push('Review data retention policies for PII data.');
  } else if (complianceTag === 'HIPAA') {
    recommendations.push('Verify access controls for PHI data.');
    recommendations.push('Review audit logs for unusual access patterns.');
  } else if (complianceTag === 'SOC2') {
    recommendations.push('Monitor for security incidents and unauthorized access.');
    recommendations.push('Ensure change management processes are followed.');
  } else if (complianceTag === 'PCI') {
    recommendations.push('Verify encryption for all payment data.');
    recommendations.push('Review access controls for cardholder data.');
  }

  if (recommendations.length === 0) {
    recommendations.push('All compliance metrics are within acceptable ranges.');
  }

  return recommendations;
}

/**
 * Generate a GDPR data subject access request (DSAR) report
 */
export async function generateDsarReport(
  userId: string,
  options: { includeMetadata?: boolean } = {}
): Promise<{
  userId: string;
  totalLogs: number;
  dataCategories: string[];
  logs: Array<{
    timestamp: Date;
    eventType: string;
    action: string;
    resource: { type: string; id: string };
    ipAddress?: string;
  }>;
  generatedAt: Date;
}> {
  const logs = await searchAuditLogs({
    actorId: userId,
    pageSize: 10000,
    sortField: 'timestamp',
    sortOrder: 'asc',
  });

  const dataCategories = new Set<string>();
  const simplifiedLogs = logs.data.map((log) => {
    dataCategories.add(log.eventCategory);
    return {
      timestamp: log.timestamp,
      eventType: log.eventType,
      action: log.action,
      resource: log.resource,
      ipAddress: options.includeMetadata ? log.request?.ipAddress : undefined,
    };
  });

  return {
    userId,
    totalLogs: logs.data.length,
    dataCategories: Array.from(dataCategories),
    logs: simplifiedLogs,
    generatedAt: new Date(),
  };
}

/**
 * Delete user's audit data (GDPR right to erasure)
 * Note: This is a soft delete that anonymizes data
 */
export async function anonymizeUserAuditData(userId: string): Promise<{ anonymizedCount: number }> {
  const anonymizedCount = await auditLogRepository.anonymizeActorData(userId);

  return { anonymizedCount };
}

/**
 * Get retention policy summary for compliance
 */
export async function getRetentionPolicySummary(): Promise<{
  policies: Array<{
    policy: RetentionPolicy;
    count: number;
    oldestLog: Date | null;
    newestLog: Date | null;
  }>;
  totalLogs: number;
}> {
  const policies = await Promise.all([
    getRetentionPolicyStats('SHORT' as RetentionPolicy),
    getRetentionPolicyStats('STANDARD' as RetentionPolicy),
    getRetentionPolicyStats('EXTENDED' as RetentionPolicy),
    getRetentionPolicyStats('PERMANENT' as RetentionPolicy),
  ]);

  const totalLogs = policies.reduce((sum, p) => sum + p.count, 0);

  return {
    policies,
    totalLogs,
  };
}

async function getRetentionPolicyStats(policy: RetentionPolicy): Promise<{
  policy: RetentionPolicy;
  count: number;
  oldestLog: Date | null;
  newestLog: Date | null;
}> {
  const [count, oldest, newest] = await Promise.all([
    auditLogRepository.countByRetentionPolicy(policy),
    auditLogRepository.getOldestLogByPolicy(policy),
    auditLogRepository.getNewestLogByPolicy(policy),
  ]);

  return {
    policy,
    count,
    oldestLog: oldest,
    newestLog: newest,
  };
}
