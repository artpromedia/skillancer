/**
 * @module @skillancer/auth-svc/services/breach-management
 * HIPAA Breach Incident Management Service
 */

import {
  prisma,
  type BreachIncident,
  type BreachTimeline,
  BreachStatus,
  type BreachSeverity,
  type Prisma,
} from '@skillancer/database';
import { createLogger } from '@skillancer/logger';

import type {
  ReportBreachParams,
  UpdateBreachStatusParams,
  BreachTimelineEntry,
  BreachIncidentDetails,
} from '../types/hipaa.types.js';

const logger = createLogger({ serviceName: 'breach-management' });

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * HIPAA Breach Notification Rule:
 * - Breaches affecting 500+ individuals must be reported to HHS within 60 days
 * - Breaches affecting fewer than 500 can be reported annually
 * - All affected individuals must be notified within 60 days
 */
const HHS_NOTIFICATION_THRESHOLD = 500;
const HHS_NOTIFICATION_DEADLINE_DAYS = 60;
// Individual notification deadline is same as HHS: 60 days

// =============================================================================
// BREACH REPORTING SERVICE
// =============================================================================

/**
 * Report a potential breach incident
 */
export async function reportBreach(params: ReportBreachParams): Promise<BreachIncidentDetails> {
  const {
    tenantId,
    reportedBy,
    incidentType,
    severity,
    description,
    discoveredAt,
    phiInvolved,
    phiCategories,
    affectedRecords,
    affectedUsers,
  } = params;

  logger.warn(
    {
      tenantId,
      reportedBy,
      incidentType,
      severity,
      phiInvolved,
      affectedRecords,
    },
    'Breach incident reported'
  );

  // Create the incident
  const incident = await prisma.breachIncident.create({
    data: {
      tenantId,
      incidentType,
      severity,
      description,
      discoveredAt,
      discoveredBy: reportedBy,
      phiInvolved,
      phiCategories: phiCategories ?? [],
      affectedRecords: affectedRecords ?? null,
      affectedUsers: affectedUsers ?? null,
      status: BreachStatus.INVESTIGATING,
    },
  });

  // Add initial timeline entry
  await addBreachTimelineEntry(incident.id, {
    action: 'INCIDENT_REPORTED',
    description: 'Breach incident reported and investigation initiated',
    performedBy: reportedBy,
  });

  // Calculate notification deadline if PHI involved
  let notificationDeadline: Date | undefined;
  if (phiInvolved) {
    notificationDeadline = new Date(discoveredAt);
    notificationDeadline.setDate(notificationDeadline.getDate() + HHS_NOTIFICATION_DEADLINE_DAYS);
  }

  // Determine next steps based on severity and scope
  const nextSteps = generateNextSteps(incident, affectedRecords);

  // If PHI involved and significant, schedule HHS notification reminder
  if (phiInvolved && (affectedRecords ?? 0) >= HHS_NOTIFICATION_THRESHOLD && notificationDeadline) {
    scheduleHhsNotificationReminder(incident.id, notificationDeadline);
  }

  return {
    id: incident.id,
    tenantId: incident.tenantId,
    incidentType: incident.incidentType,
    severity: incident.severity,
    description: incident.description,
    discoveredAt: incident.discoveredAt,
    discoveredBy: incident.discoveredBy,
    affectedRecords: incident.affectedRecords,
    affectedUsers: incident.affectedUsers,
    phiInvolved: incident.phiInvolved,
    phiCategories: incident.phiCategories,
    status: incident.status,
    containedAt: incident.containedAt,
    resolvedAt: incident.resolvedAt,
    hhsNotified: incident.hhsNotified,
    hhsNotifiedAt: incident.hhsNotifiedAt,
    affectedNotified: incident.affectedNotified,
    affectedNotifiedAt: incident.affectedNotifiedAt,
    rootCause: incident.rootCause,
    remediation: incident.remediation,
    preventiveMeasures: incident.preventiveMeasures,
    reportUrl: incident.reportUrl,
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
    notificationDeadline,
    nextSteps,
  };
}

/**
 * Get breach incident details
 */
export async function getBreachIncident(incidentId: string): Promise<BreachIncidentDetails | null> {
  const incident = await prisma.breachIncident.findUnique({
    where: { id: incidentId },
    include: {
      timeline: {
        orderBy: { timestamp: 'desc' },
      },
    },
  });

  if (!incident) {
    return null;
  }

  // Calculate notification deadline
  let notificationDeadline: Date | undefined;
  if (incident.phiInvolved && !incident.hhsNotified) {
    notificationDeadline = new Date(incident.discoveredAt);
    notificationDeadline.setDate(notificationDeadline.getDate() + HHS_NOTIFICATION_DEADLINE_DAYS);
  }

  return {
    id: incident.id,
    tenantId: incident.tenantId,
    incidentType: incident.incidentType,
    severity: incident.severity,
    description: incident.description,
    discoveredAt: incident.discoveredAt,
    discoveredBy: incident.discoveredBy,
    affectedRecords: incident.affectedRecords,
    affectedUsers: incident.affectedUsers,
    phiInvolved: incident.phiInvolved,
    phiCategories: incident.phiCategories,
    status: incident.status,
    containedAt: incident.containedAt,
    resolvedAt: incident.resolvedAt,
    hhsNotified: incident.hhsNotified,
    hhsNotifiedAt: incident.hhsNotifiedAt,
    affectedNotified: incident.affectedNotified,
    affectedNotifiedAt: incident.affectedNotifiedAt,
    rootCause: incident.rootCause,
    remediation: incident.remediation,
    preventiveMeasures: incident.preventiveMeasures,
    reportUrl: incident.reportUrl,
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
    notificationDeadline,
    nextSteps: generateNextSteps(incident, incident.affectedRecords),
  };
}

/**
 * List breach incidents for a tenant
 */
export async function listBreachIncidents(params: {
  tenantId: string;
  status?: BreachStatus | undefined;
  severity?: BreachSeverity | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}): Promise<{
  incidents: BreachIncident[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const { tenantId, status, severity, startDate, endDate, page = 1, limit = 20 } = params;

  const where: Prisma.BreachIncidentWhereInput = {
    tenantId,
  };

  if (status) {
    where.status = status;
  }

  if (severity) {
    where.severity = severity;
  }

  if (startDate || endDate) {
    where.discoveredAt = {};
    if (startDate) where.discoveredAt.gte = startDate;
    if (endDate) where.discoveredAt.lte = endDate;
  }

  const [incidents, total] = await Promise.all([
    prisma.breachIncident.findMany({
      where,
      orderBy: { discoveredAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.breachIncident.count({ where }),
  ]);

  return {
    incidents,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Update breach incident status
 */
export async function updateBreachStatus(
  params: UpdateBreachStatusParams
): Promise<BreachIncident> {
  const { incidentId, status, updatedBy, notes, rootCause, remediation, preventiveMeasures } =
    params;

  const updateData: Parameters<typeof prisma.breachIncident.update>[0]['data'] = {
    status,
  };

  // Set timestamps based on status
  if (status === BreachStatus.CONTAINED) {
    updateData.containedAt = new Date();
  } else if (status === BreachStatus.RESOLVED || status === BreachStatus.CLOSED) {
    updateData.resolvedAt = new Date();
  }

  // Add investigation details
  if (rootCause) updateData.rootCause = rootCause;
  if (remediation) updateData.remediation = remediation;
  if (preventiveMeasures) updateData.preventiveMeasures = preventiveMeasures;

  const updated = await prisma.breachIncident.update({
    where: { id: incidentId },
    data: updateData,
  });

  // Add timeline entry
  await addBreachTimelineEntry(incidentId, {
    action: `STATUS_CHANGED_TO_${status}`,
    description: notes ?? `Status updated to ${status}`,
    performedBy: updatedBy,
  });

  logger.info({ incidentId, status, updatedBy }, 'Breach incident status updated');

  return updated;
}

/**
 * Add timeline entry to breach incident
 */
export async function addBreachTimelineEntry(
  breachIncidentId: string,
  entry: BreachTimelineEntry
): Promise<BreachTimeline> {
  const timeline = await prisma.breachTimeline.create({
    data: {
      breachIncidentId,
      action: entry.action,
      description: entry.description ?? null,
      performedBy: entry.performedBy,
      timestamp: entry.timestamp ?? new Date(),
    },
  });

  return timeline;
}

/**
 * Get breach timeline
 */
export async function getBreachTimeline(breachIncidentId: string): Promise<BreachTimeline[]> {
  return prisma.breachTimeline.findMany({
    where: { breachIncidentId },
    orderBy: { timestamp: 'desc' },
  });
}

// =============================================================================
// HHS NOTIFICATION
// =============================================================================

/**
 * Notify HHS of breach (required within 60 days for breaches affecting 500+ individuals)
 */
export async function notifyHhs(incidentId: string, notifiedBy: string): Promise<void> {
  const incident = await prisma.breachIncident.findUnique({
    where: { id: incidentId },
  });

  if (!incident) {
    throw new Error('Breach incident not found');
  }

  if (incident.hhsNotified) {
    throw new Error('HHS has already been notified for this incident');
  }

  // In production, this would submit to HHS breach portal
  // https://ocrportal.hhs.gov/ocr/breach/wizard_breach.jsf

  await prisma.breachIncident.update({
    where: { id: incidentId },
    data: {
      hhsNotified: true,
      hhsNotifiedAt: new Date(),
    },
  });

  await addBreachTimelineEntry(incidentId, {
    action: 'HHS_NOTIFIED',
    description: 'Department of Health and Human Services notified of breach',
    performedBy: notifiedBy,
  });

  logger.info({ incidentId, notifiedBy }, 'HHS notified of breach incident');
}

/**
 * Notify affected individuals
 */
export async function notifyAffectedIndividuals(
  incidentId: string,
  notifiedBy: string,
  notificationMethod: 'email' | 'mail' | 'both'
): Promise<void> {
  const incident = await prisma.breachIncident.findUnique({
    where: { id: incidentId },
  });

  if (!incident) {
    throw new Error('Breach incident not found');
  }

  // In production, this would:
  // 1. Generate notification letters/emails
  // 2. Send notifications to affected individuals
  // 3. Track delivery status

  await prisma.breachIncident.update({
    where: { id: incidentId },
    data: {
      affectedNotified: true,
      affectedNotifiedAt: new Date(),
    },
  });

  await addBreachTimelineEntry(incidentId, {
    action: 'AFFECTED_NOTIFIED',
    description: `Affected individuals notified via ${notificationMethod}`,
    performedBy: notifiedBy,
  });

  logger.info(
    { incidentId, notifiedBy, notificationMethod },
    'Affected individuals notified of breach'
  );
}

// =============================================================================
// DOCUMENTATION
// =============================================================================

/**
 * Add investigation findings
 */
export async function addInvestigationFindings(
  incidentId: string,
  findings: {
    rootCause?: string | undefined;
    remediation?: string | undefined;
    preventiveMeasures?: string | undefined;
  },
  updatedBy: string
): Promise<BreachIncident> {
  // Build update data without undefined values for exactOptionalPropertyTypes
  const updateData: Prisma.BreachIncidentUpdateInput = {};
  if (findings.rootCause !== undefined) updateData.rootCause = findings.rootCause;
  if (findings.remediation !== undefined) updateData.remediation = findings.remediation;
  if (findings.preventiveMeasures !== undefined)
    updateData.preventiveMeasures = findings.preventiveMeasures;

  const updated = await prisma.breachIncident.update({
    where: { id: incidentId },
    data: updateData,
  });

  await addBreachTimelineEntry(incidentId, {
    action: 'INVESTIGATION_UPDATED',
    description: 'Investigation findings added/updated',
    performedBy: updatedBy,
  });

  return updated;
}

/**
 * Upload breach report document
 */
export async function uploadBreachReport(
  incidentId: string,
  reportUrl: string,
  uploadedBy: string
): Promise<void> {
  await prisma.breachIncident.update({
    where: { id: incidentId },
    data: { reportUrl },
  });

  await addBreachTimelineEntry(incidentId, {
    action: 'REPORT_UPLOADED',
    description: 'Breach investigation report uploaded',
    performedBy: uploadedBy,
  });
}

// =============================================================================
// ANALYTICS
// =============================================================================

/**
 * Get breach statistics for a tenant
 */
export async function getBreachStatistics(
  tenantId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  total: number;
  bySeverity: Record<BreachSeverity, number>;
  byStatus: Record<BreachStatus, number>;
  phiInvolved: number;
  hhsReported: number;
  avgResolutionDays: number | null;
}> {
  const where: Prisma.BreachIncidentWhereInput = {
    tenantId,
  };

  if (startDate || endDate) {
    where.discoveredAt = {};
    if (startDate) where.discoveredAt.gte = startDate;
    if (endDate) where.discoveredAt.lte = endDate;
  }

  const incidents = await prisma.breachIncident.findMany({ where });

  const bySeverity: Record<BreachSeverity, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  };

  const byStatus: Record<BreachStatus, number> = {
    INVESTIGATING: 0,
    CONTAINED: 0,
    NOTIFYING: 0,
    RESOLVED: 0,
    CLOSED: 0,
  };

  let phiInvolved = 0;
  let hhsReported = 0;
  let totalResolutionDays = 0;
  let resolvedCount = 0;

  for (const incident of incidents) {
    bySeverity[incident.severity]++;
    byStatus[incident.status]++;

    if (incident.phiInvolved) phiInvolved++;
    if (incident.hhsNotified) hhsReported++;

    if (incident.resolvedAt) {
      const days = Math.ceil(
        (incident.resolvedAt.getTime() - incident.discoveredAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      totalResolutionDays += days;
      resolvedCount++;
    }
  }

  return {
    total: incidents.length,
    bySeverity,
    byStatus,
    phiInvolved,
    hhsReported,
    avgResolutionDays: resolvedCount > 0 ? Math.round(totalResolutionDays / resolvedCount) : null,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function generateNextSteps(incident: BreachIncident, affectedRecords?: number | null): string[] {
  const steps: string[] = [];

  switch (incident.status) {
    case BreachStatus.INVESTIGATING:
      steps.push('Contain the breach immediately');
      steps.push('Document all affected records');
      steps.push('Identify root cause');
      if (incident.phiInvolved) {
        steps.push('Prepare notification plan');
      }
      break;

    case BreachStatus.CONTAINED:
      steps.push('Complete root cause analysis');
      steps.push('Document remediation steps');
      if (incident.phiInvolved) {
        if ((affectedRecords ?? 0) >= HHS_NOTIFICATION_THRESHOLD) {
          steps.push('Notify HHS within 60 days of discovery');
        }
        steps.push('Notify affected individuals');
      }
      break;

    case BreachStatus.NOTIFYING:
      if (!incident.hhsNotified && incident.phiInvolved) {
        steps.push('Complete HHS notification');
      }
      if (!incident.affectedNotified) {
        steps.push('Complete individual notifications');
      }
      steps.push('Document preventive measures');
      break;

    case BreachStatus.RESOLVED:
      steps.push('Implement preventive measures');
      steps.push('Schedule follow-up review');
      steps.push('Update security policies if needed');
      break;

    case BreachStatus.CLOSED:
      // No next steps for closed incidents
      break;
  }

  return steps;
}

function scheduleHhsNotificationReminder(incidentId: string, deadline: Date): void {
  // In production, this would schedule reminders via notification service
  // Remind at 30 days, 14 days, 7 days, and 3 days before deadline
  logger.info({ incidentId, deadline }, 'HHS notification reminder scheduled');
}

/**
 * Check for overdue HHS notifications
 */
export async function checkOverdueNotifications(tenantId?: string): Promise<BreachIncident[]> {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() - HHS_NOTIFICATION_DEADLINE_DAYS);

  const where: Prisma.BreachIncidentWhereInput = {
    phiInvolved: true,
    hhsNotified: false,
    affectedRecords: { gte: HHS_NOTIFICATION_THRESHOLD },
    discoveredAt: { lte: deadline },
    status: {
      notIn: [BreachStatus.CLOSED],
    },
  };

  if (tenantId) {
    where.tenantId = tenantId;
  }

  return prisma.breachIncident.findMany({ where });
}
