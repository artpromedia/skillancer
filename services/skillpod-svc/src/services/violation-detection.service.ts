/**
 * @module @skillancer/skillpod-svc/services/violation-detection.service
 * Security violation detection and response for VDI data containment
 */

import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

import type {
  CreateViolationInput,
  SecurityViolation,
  ViolationAction,
  ViolationSeverity,
  ViolationSummary,
  ViolationType,
} from '../types/containment.types.js';

// =============================================================================
// TYPES
// =============================================================================

interface ViolationThresholds {
  sessionWarningCount: number;
  sessionTerminateCount: number;
  userSuspendCount: number;
  criticalIncidentTypes: ViolationType[];
}

interface AlertConfig {
  webhookUrl?: string;
  emailRecipients?: string[];
  slackChannel?: string;
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface ViolationDetectionService {
  recordViolation(input: CreateViolationInput): Promise<SecurityViolation>;
  getViolation(violationId: string): Promise<SecurityViolation | null>;
  listViolations(options: {
    sessionId?: string;
    tenantId?: string;
    violationType?: ViolationType;
    severity?: ViolationSeverity;
    startDate?: Date;
    endDate?: Date;
    reviewed?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ violations: SecurityViolation[]; total: number }>;
  reviewViolation(
    violationId: string,
    reviewedBy: string,
    notes?: string
  ): Promise<SecurityViolation>;
  getViolationSummary(tenantId: string, days?: number): Promise<ViolationSummary>;
  getSessionViolationCount(sessionId: string): Promise<number>;
  checkThresholds(sessionId: string): Promise<ViolationAction | null>;
  determineAction(violation: CreateViolationInput): ViolationAction;
  determineSeverity(
    violationType: ViolationType,
    details?: Record<string, unknown>
  ): ViolationSeverity;
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export function createViolationDetectionService(
  prisma: PrismaClient,
  redis: Redis,
  thresholds?: Partial<ViolationThresholds>,
  alertConfig?: AlertConfig
): ViolationDetectionService {
  const config: ViolationThresholds = {
    sessionWarningCount: thresholds?.sessionWarningCount ?? 3,
    sessionTerminateCount: thresholds?.sessionTerminateCount ?? 10,
    userSuspendCount: thresholds?.userSuspendCount ?? 25,
    criticalIncidentTypes: thresholds?.criticalIncidentTypes ?? [
      'POLICY_BYPASS_ATTEMPT',
      'SUSPICIOUS_ACTIVITY',
    ],
  };

  /**
   * Record a security violation
   */
  async function recordViolation(input: CreateViolationInput): Promise<SecurityViolation> {
    // Determine severity if not provided
    const severity = input.severity ?? determineSeverity(input.violationType, input.details);

    // Determine action based on violation type and history
    const action = determineAction({ ...input, severity });

    // Create violation record
    const violation = await prisma.securityViolation.create({
      data: {
        sessionId: input.sessionId,
        tenantId: input.tenantId,
        violationType: input.violationType,
        severity,
        description: input.description,
        details: input.details ?? {},
        sourceIp: input.sourceIp,
        userAgent: input.userAgent,
        action,
        actionDetails: await buildActionDetails(input, action),
      },
    });

    // Update Redis counters for real-time threshold checking
    await updateViolationCounters(input.sessionId, input.tenantId, severity);

    // Execute the determined action
    await executeAction(violation.id, input.sessionId, action);

    // Send alerts for high/critical violations
    if (severity === 'HIGH' || severity === 'CRITICAL') {
      await sendAlert(violation as unknown as SecurityViolation, alertConfig);
    }

    return mapViolationFromDb(violation);
  }

  /**
   * Get a specific violation by ID
   */
  async function getViolation(violationId: string): Promise<SecurityViolation | null> {
    const violation = await prisma.securityViolation.findUnique({
      where: { id: violationId },
    });

    return violation ? mapViolationFromDb(violation) : null;
  }

  /**
   * List violations with filtering
   */
  async function listViolations(options: {
    sessionId?: string;
    tenantId?: string;
    violationType?: ViolationType;
    severity?: ViolationSeverity;
    startDate?: Date;
    endDate?: Date;
    reviewed?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ violations: SecurityViolation[]; total: number }> {
    const where = {
      sessionId: options.sessionId,
      tenantId: options.tenantId,
      violationType: options.violationType,
      severity: options.severity,
      reviewed: options.reviewed,
      createdAt: {
        gte: options.startDate,
        lte: options.endDate,
      },
    };

    const [violations, total] = await Promise.all([
      prisma.securityViolation.findMany({
        where,
        take: options.limit ?? 50,
        skip: options.offset ?? 0,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.securityViolation.count({ where }),
    ]);

    return {
      violations: violations.map(mapViolationFromDb),
      total,
    };
  }

  /**
   * Mark a violation as reviewed
   */
  async function reviewViolation(
    violationId: string,
    reviewedBy: string,
    notes?: string
  ): Promise<SecurityViolation> {
    const violation = await prisma.securityViolation.update({
      where: { id: violationId },
      data: {
        reviewed: true,
        reviewedBy,
        reviewedAt: new Date(),
        reviewNotes: notes,
      },
    });

    return mapViolationFromDb(violation);
  }

  /**
   * Get violation summary for a tenant
   */
  async function getViolationSummary(
    tenantId: string,
    days: number = 7
  ): Promise<ViolationSummary> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const violations = await prisma.securityViolation.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'desc' },
    });

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byAction: Record<string, number> = {};

    for (const v of violations) {
      byType[v.violationType] = (byType[v.violationType] || 0) + 1;
      bySeverity[v.severity] = (bySeverity[v.severity] || 0) + 1;
      byAction[v.action] = (byAction[v.action] || 0) + 1;
    }

    return {
      total: violations.length,
      byType: byType as Record<ViolationType, number>,
      bySeverity: bySeverity as Record<ViolationSeverity, number>,
      byAction: byAction as Record<ViolationAction, number>,
      recentViolations: violations.slice(0, 10).map(mapViolationFromDb),
    };
  }

  /**
   * Get violation count for a session
   */
  async function getSessionViolationCount(sessionId: string): Promise<number> {
    // Try Redis first for performance
    const cached = await redis.get(`violations:session:${sessionId}:count`);
    if (cached !== null) {
      return parseInt(cached, 10);
    }

    // Fall back to database
    const count = await prisma.securityViolation.count({
      where: { sessionId },
    });

    // Cache for 5 minutes
    await redis.setex(`violations:session:${sessionId}:count`, 300, count.toString());

    return count;
  }

  /**
   * Check if violation thresholds have been exceeded
   */
  async function checkThresholds(sessionId: string): Promise<ViolationAction | null> {
    const count = await getSessionViolationCount(sessionId);

    if (count >= config.userSuspendCount) {
      return 'USER_SUSPENDED';
    }

    if (count >= config.sessionTerminateCount) {
      return 'SESSION_TERMINATED';
    }

    if (count >= config.sessionWarningCount) {
      return 'WARNED';
    }

    return null;
  }

  /**
   * Determine the action to take for a violation
   */
  function determineAction(violation: CreateViolationInput): ViolationAction {
    // Critical violations create incidents immediately
    if (config.criticalIncidentTypes.includes(violation.violationType)) {
      return 'INCIDENT_CREATED';
    }

    // High severity violations terminate sessions
    if (violation.severity === 'CRITICAL') {
      return 'SESSION_TERMINATED';
    }

    // Determine based on violation type
    switch (violation.violationType) {
      case 'POLICY_BYPASS_ATTEMPT':
      case 'SUSPICIOUS_ACTIVITY':
        return 'SESSION_TERMINATED';

      case 'SCREEN_CAPTURE_ATTEMPT':
      case 'FILE_DOWNLOAD_BLOCKED':
        return 'BLOCKED';

      case 'CLIPBOARD_COPY_ATTEMPT':
      case 'CLIPBOARD_PASTE_BLOCKED':
      case 'PRINT_BLOCKED':
      case 'USB_DEVICE_BLOCKED':
      case 'NETWORK_ACCESS_BLOCKED':
        return 'BLOCKED';

      case 'SESSION_TIMEOUT':
      case 'IDLE_TIMEOUT':
        return 'SESSION_TERMINATED';

      default:
        return 'LOGGED';
    }
  }

  /**
   * Determine severity based on violation type and context
   */
  function determineSeverity(
    violationType: ViolationType,
    _details?: Record<string, unknown>
  ): ViolationSeverity {
    switch (violationType) {
      case 'POLICY_BYPASS_ATTEMPT':
      case 'SUSPICIOUS_ACTIVITY':
        return 'CRITICAL';

      case 'SCREEN_CAPTURE_ATTEMPT':
      case 'FILE_DOWNLOAD_BLOCKED':
        return 'HIGH';

      case 'CLIPBOARD_COPY_ATTEMPT':
      case 'USB_DEVICE_BLOCKED':
      case 'NETWORK_ACCESS_BLOCKED':
        return 'MEDIUM';

      case 'CLIPBOARD_PASTE_BLOCKED':
      case 'PRINT_BLOCKED':
      case 'SESSION_TIMEOUT':
      case 'IDLE_TIMEOUT':
      case 'UNAUTHORIZED_PERIPHERAL':
      case 'FILE_UPLOAD_BLOCKED':
        return 'LOW';

      default:
        return 'MEDIUM';
    }
  }

  // ===========================================================================
  // HELPER FUNCTIONS
  // ===========================================================================

  /**
   * Update Redis counters for violation tracking
   */
  async function updateViolationCounters(
    sessionId: string,
    tenantId: string,
    severity: ViolationSeverity
  ): Promise<void> {
    const now = Date.now();
    const hourKey = Math.floor(now / (1000 * 60 * 60));
    const dayKey = Math.floor(now / (1000 * 60 * 60 * 24));

    const pipeline = redis.pipeline();

    // Session counters
    pipeline.incr(`violations:session:${sessionId}:count`);
    pipeline.expire(`violations:session:${sessionId}:count`, 86400); // 24 hours

    // Tenant hourly counters
    pipeline.hincrby(`violations:tenant:${tenantId}:hourly:${hourKey}`, 'total', 1);
    pipeline.hincrby(`violations:tenant:${tenantId}:hourly:${hourKey}`, severity, 1);
    pipeline.expire(`violations:tenant:${tenantId}:hourly:${hourKey}`, 86400);

    // Tenant daily counters
    pipeline.hincrby(`violations:tenant:${tenantId}:daily:${dayKey}`, 'total', 1);
    pipeline.hincrby(`violations:tenant:${tenantId}:daily:${dayKey}`, severity, 1);
    pipeline.expire(`violations:tenant:${tenantId}:daily:${dayKey}`, 604800); // 7 days

    await pipeline.exec();
  }

  /**
   * Build action details JSON
   */
  async function buildActionDetails(
    input: CreateViolationInput,
    action: ViolationAction
  ): Promise<Record<string, unknown>> {
    const details: Record<string, unknown> = {
      determinedAt: new Date().toISOString(),
      basedOn: {
        violationType: input.violationType,
        severity: input.severity,
      },
    };

    if (action === 'SESSION_TERMINATED' || action === 'USER_SUSPENDED') {
      const sessionCount = await getSessionViolationCount(input.sessionId);
      details['sessionViolationCount'] = sessionCount;
      details['threshold'] =
        action === 'SESSION_TERMINATED' ? config.sessionTerminateCount : config.userSuspendCount;
    }

    return details;
  }

  /**
   * Execute the determined action
   */
  async function executeAction(
    violationId: string,
    sessionId: string,
    action: ViolationAction
  ): Promise<void> {
    switch (action) {
      case 'SESSION_TERMINATED':
        // Update session status
        await prisma.session.update({
          where: { id: sessionId },
          data: {
            status: 'TERMINATED',
            terminatedAt: new Date(),
            terminationReason: `Security violation: ${violationId}`,
          },
        });
        // Publish termination event
        await redis.publish('session:terminate', JSON.stringify({ sessionId, violationId }));
        break;

      case 'USER_SUSPENDED':
        // Get session to find user
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          select: { userId: true },
        });
        if (session) {
          // Publish user suspension event
          await redis.publish(
            'user:suspend',
            JSON.stringify({
              userId: session.userId,
              reason: `Multiple security violations. Last violation: ${violationId}`,
            })
          );
        }
        break;

      case 'INCIDENT_CREATED':
        // Publish incident creation event
        await redis.publish(
          'incident:create',
          JSON.stringify({
            type: 'SECURITY_VIOLATION',
            violationId,
            sessionId,
          })
        );
        break;

      case 'WARNED':
        // Publish warning event
        await redis.publish('session:warn', JSON.stringify({ sessionId, violationId }));
        break;

      default:
        // LOGGED and BLOCKED don't require additional actions
        break;
    }
  }

  /**
   * Send alert for high-severity violations
   */
  async function sendAlert(violation: SecurityViolation, _config?: AlertConfig): Promise<void> {
    // Publish alert event for external handlers
    await redis.publish(
      'violation:alert',
      JSON.stringify({
        violationId: violation.id,
        sessionId: violation.sessionId,
        tenantId: violation.tenantId,
        type: violation.violationType,
        severity: violation.severity,
        description: violation.description,
        timestamp: new Date().toISOString(),
      })
    );

    // TODO: Implement webhook, email, and Slack alerts based on alertConfig
  }

  return {
    recordViolation,
    getViolation,
    listViolations,
    reviewViolation,
    getViolationSummary,
    getSessionViolationCount,
    checkThresholds,
    determineAction,
    determineSeverity,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Map database violation to service type
 */
function mapViolationFromDb(violation: {
  id: string;
  sessionId: string;
  tenantId: string;
  violationType: string;
  severity: string;
  description: string;
  details: unknown;
  sourceIp: string | null;
  userAgent: string | null;
  action: string;
  actionDetails: unknown;
  reviewed: boolean;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  createdAt: Date;
}): SecurityViolation {
  return {
    id: violation.id,
    sessionId: violation.sessionId,
    tenantId: violation.tenantId,
    violationType: violation.violationType as ViolationType,
    severity: violation.severity as ViolationSeverity,
    description: violation.description,
    details: violation.details as Record<string, unknown> | undefined,
    sourceIp: violation.sourceIp ?? undefined,
    userAgent: violation.userAgent ?? undefined,
    action: violation.action as ViolationAction,
    actionDetails: violation.actionDetails as Record<string, unknown> | undefined,
    reviewed: violation.reviewed,
    reviewedBy: violation.reviewedBy ?? undefined,
    reviewedAt: violation.reviewedAt ?? undefined,
    reviewNotes: violation.reviewNotes ?? undefined,
    createdAt: violation.createdAt,
  };
}
