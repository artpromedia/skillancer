/**
 * @module @skillancer/skillpod-svc/workers/session-monitor
 * BullMQ worker for session monitoring and activity tracking
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { Worker, Queue, type Job } from 'bullmq';

import type { KasmWorkspacesService } from '../services/kasm-workspaces.service.js';
import type {
  ScreenshotDetectionService,
  CaptureType,
  ScreenCaptureEvent,
} from '../services/screenshot-detection.service.js';
import type { PrismaClient, SessionStatus } from '@prisma/client';
import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export type SessionMonitorJobType =
  | 'check_session_health'
  | 'collect_session_metrics'
  | 'process_screen_capture_event'
  | 'sync_session_status'
  | 'record_session_activity'
  | 'generate_session_report';

export interface CheckSessionHealthData {
  sessionId: string;
  kasmId: string;
}

export interface CollectSessionMetricsData {
  sessionId: string;
  kasmId: string;
}

export interface ProcessScreenCaptureData {
  sessionId: string;
  userId: string;
  captureType: CaptureType;
  detectionMethod: string;
  processInfo?: {
    name: string;
    pid: number;
  };
  activeApplication?: string;
  activeWindow?: string;
}

export interface SyncSessionStatusData {
  tenantId: string;
}

export interface RecordSessionActivityData {
  sessionId: string;
  activityType: 'keyboard' | 'mouse' | 'clipboard' | 'file_access' | 'network';
  details?: Record<string, unknown>;
}

export interface GenerateSessionReportData {
  sessionId: string;
  reportType: 'security' | 'activity' | 'compliance';
}

export type SessionMonitorJobData =
  | { type: 'check_session_health'; data: CheckSessionHealthData }
  | { type: 'collect_session_metrics'; data: CollectSessionMetricsData }
  | { type: 'process_screen_capture_event'; data: ProcessScreenCaptureData }
  | { type: 'sync_session_status'; data: SyncSessionStatusData }
  | { type: 'record_session_activity'; data: RecordSessionActivityData }
  | { type: 'generate_session_report'; data: GenerateSessionReportData };

// =============================================================================
// QUEUE NAME
// =============================================================================

export const SESSION_MONITOR_QUEUE = 'skillpod:session-monitor';

// =============================================================================
// QUEUE FACTORY
// =============================================================================

export function createSessionMonitorQueue(redis: Redis): Queue<SessionMonitorJobData> {
  return new Queue<SessionMonitorJobData>(SESSION_MONITOR_QUEUE, {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 500,
      },
      removeOnComplete: {
        age: 3600, // 1 hour
        count: 500,
      },
      removeOnFail: {
        age: 24 * 3600, // 24 hours
      },
    },
  });
}

// =============================================================================
// WORKER FACTORY
// =============================================================================

export interface SessionMonitorWorkerDeps {
  prisma: PrismaClient;
  redis: Redis;
  kasmService: KasmWorkspacesService;
  screenshotService: ScreenshotDetectionService;
}

export function createSessionMonitorWorker(
  deps: SessionMonitorWorkerDeps
): Worker<SessionMonitorJobData> {
  const { prisma, redis, kasmService, screenshotService } = deps;

  const worker = new Worker<SessionMonitorJobData>(
    SESSION_MONITOR_QUEUE,
    async (job: Job<SessionMonitorJobData>) => {
      const { type, data } = job.data;

      switch (type) {
        case 'check_session_health':
          return handleCheckSessionHealth(data);
        case 'collect_session_metrics':
          return handleCollectSessionMetrics(data);
        case 'process_screen_capture_event':
          return handleProcessScreenCapture(data);
        case 'sync_session_status':
          return handleSyncSessionStatus(data);
        case 'record_session_activity':
          return handleRecordSessionActivity(data);
        case 'generate_session_report':
          return handleGenerateSessionReport(data);
        default: {
          const _exhaustiveCheck: never = type;
          throw new Error(`Unknown job type: ${String(_exhaustiveCheck)}`);
        }
      }
    },
    {
      connection: redis,
      concurrency: 20,
      limiter: {
        max: 200,
        duration: 1000,
      },
    }
  );

  // ===========================================================================
  // JOB HANDLERS
  // ===========================================================================

  async function handleCheckSessionHealth(data: CheckSessionHealthData): Promise<void> {
    const { sessionId, kasmId } = data;

    try {
      const status = await kasmService.getWorkspaceStatus(kasmId);

      // Map Kasm status to our status
      let sessionStatus: string;
      switch (status.status) {
        case 'running':
          sessionStatus = 'RUNNING';
          break;
        case 'paused':
        case 'stopped':
          sessionStatus = 'PAUSED';
          break;
        case 'creating':
        case 'starting':
          sessionStatus = 'PROVISIONING';
          break;
        case 'stopping':
          sessionStatus = 'STOPPING';
          break;
        case 'terminated':
        case 'failed':
          sessionStatus = 'TERMINATED';
          break;
        default:
          sessionStatus = 'RUNNING';
      }

      // Update session status if changed
      const session = await prisma.session.findUnique({ where: { id: sessionId } });
      if (session && session.status !== sessionStatus) {
        const statusValue = sessionStatus as SessionStatus;
        const updateData: { status: SessionStatus; endedAt?: Date | null } = {
          status: statusValue,
        };
        if (sessionStatus === 'TERMINATED') updateData.endedAt = new Date();
        await prisma.session.update({
          where: { id: sessionId },
          data: updateData,
        });
      }

      // Store health check result in Redis
      await redis.setex(
        `session:health:${sessionId}`,
        300,
        JSON.stringify({
          status: sessionStatus,
          kasmStatus: status.status,
          checkedAt: new Date().toISOString(),
        })
      );
    } catch (error) {
      // Workspace might be terminated
      console.error(`Health check failed for session ${sessionId}:`, error);

      // Mark session as failed if Kasm returns error
      await prisma.session.update({
        where: { id: sessionId },
        data: { status: 'FAILED' },
      });
    }
  }

  async function handleCollectSessionMetrics(data: CollectSessionMetricsData): Promise<void> {
    const { sessionId, kasmId } = data;

    try {
      const metrics = await kasmService.getSessionMetrics(kasmId);

      // Store metrics in Redis (time-series style)
      const timestamp = Date.now();
      const metricsKey = `session:metrics:${sessionId}`;

      await redis.zadd(
        metricsKey,
        timestamp,
        JSON.stringify({
          timestamp,
          cpu: metrics.cpuUsage,
          memory: metrics.memoryUsage,
          networkRx: metrics.networkRx,
          networkTx: metrics.networkTx,
          clipboardEvents: metrics.clipboardEvents,
          fileTransferEvents: metrics.fileTransferEvents,
        })
      );

      // Trim old metrics (keep last hour)
      const oneHourAgo = timestamp - 3600000;
      await redis.zremrangebyscore(metricsKey, 0, oneHourAgo);

      // Set expiry on the key
      await redis.expire(metricsKey, 3600);

      // Check for anomalies
      if (metrics.cpuUsage > 90 || metrics.memoryUsage > 90) {
        await redis.publish(
          'session:alerts',
          JSON.stringify({
            type: 'RESOURCE_ALERT',
            sessionId,
            cpu: metrics.cpuUsage,
            memory: metrics.memoryUsage,
            timestamp: new Date().toISOString(),
          })
        );
      }
    } catch (error) {
      console.error(`Metrics collection failed for session ${sessionId}:`, error);
    }
  }

  async function handleProcessScreenCapture(data: ProcessScreenCaptureData): Promise<void> {
    const {
      sessionId,
      userId,
      captureType,
      detectionMethod,
      processInfo,
      activeApplication,
      activeWindow,
    } = data;

    // Get session
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Use screenshot detection service
    const captureEvent: ScreenCaptureEvent = {
      podId: sessionId,
      sessionId,
      userId,
      captureType,
      detectionMethod,
    };
    if (processInfo) captureEvent.processInfo = processInfo;
    if (activeApplication) captureEvent.activeApplication = activeApplication;
    if (activeWindow) captureEvent.activeWindow = activeWindow;
    await screenshotService.detectCaptureAttempt(captureEvent);
  }

  async function handleSyncSessionStatus(data: SyncSessionStatusData): Promise<void> {
    const { tenantId } = data;

    // Get all active sessions
    const sessions = await prisma.session.findMany({
      where: {
        tenantId,
        status: { in: ['PROVISIONING', 'RUNNING', 'PAUSED'] },
      },
    });

    const queue = createSessionMonitorQueue(redis);

    // Queue health checks for each session
    for (const session of sessions) {
      const config = session.config as Record<string, unknown>;
      const kasmId = config?.kasmId as string | undefined;

      if (kasmId) {
        await queue.add(
          'check_session_health',
          {
            type: 'check_session_health',
            data: { sessionId: session.id, kasmId },
          },
          { priority: 3 }
        );
      }
    }
  }

  async function handleRecordSessionActivity(data: RecordSessionActivityData): Promise<void> {
    const { sessionId, activityType, details } = data;

    // Update last activity timestamp
    await redis.set(`session:activity:${sessionId}`, new Date().toISOString());

    // Get session
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return;
    }

    // Log activity based on policy settings
    const policy = await prisma.podSecurityPolicy.findUnique({
      where: { id: session.securityPolicyId ?? '' },
    });

    if (!policy) {
      return;
    }

    // Check if this activity type should be logged
    const shouldLog =
      (activityType === 'keyboard' && policy.logKeystrokes) ||
      (activityType === 'clipboard' && policy.logClipboard) ||
      (activityType === 'file_access' && policy.logFileAccess) ||
      activityType === 'network' ||
      activityType === 'mouse';

    if (shouldLog && session.tenantId) {
      // Map activity type to event type
      const eventType = getEventTypeFromActivity(activityType);
      await prisma.containmentAuditLog.create({
        data: {
          sessionId,
          tenantId: session.tenantId,
          userId: session.userId,
          eventType,
          eventCategory: activityType === 'network' ? 'NETWORK' : 'DATA_TRANSFER',
          description: `Activity recorded: ${activityType}`,
          details: (details ?? {}) as object,
          allowed: true,
          policyId: policy.id,
        },
      });
    }
  }

  async function handleGenerateSessionReport(data: GenerateSessionReportData): Promise<void> {
    const { sessionId, reportType } = data;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        securityPolicy: true,
      },
    });

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    let report: Record<string, unknown>;

    switch (reportType) {
      case 'security':
        report = await generateSecurityReport(sessionId, session.tenantId ?? '');
        break;
      case 'activity':
        report = await generateActivityReport(sessionId, session.tenantId ?? '');
        break;
      case 'compliance':
        report = await generateComplianceReport(sessionId, session);
        break;
      default:
        throw new Error(`Unknown report type: ${reportType as string}`);
    }

    // Store report in Redis for retrieval
    await redis.setex(`session:report:${sessionId}:${reportType}`, 3600, JSON.stringify(report));
  }

  async function generateSecurityReport(
    sessionId: string,
    _tenantId: string
  ): Promise<Record<string, unknown>> {
    const [violations, transfers, captures] = await Promise.all([
      prisma.securityViolation.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.dataTransferAttempt.groupBy({
        by: ['action'],
        where: { sessionId },
        _count: { id: true },
      }),
      prisma.screenCaptureAttempt.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      sessionId,
      generatedAt: new Date().toISOString(),
      type: 'security',
      summary: {
        totalViolations: violations.length,
        criticalViolations: violations.filter((v) => v.severity === 'CRITICAL').length,
        highViolations: violations.filter((v) => v.severity === 'HIGH').length,
        blockedTransfers: transfers.find((t) => t.action === 'BLOCKED')?._count.id ?? 0,
        screenCaptureAttempts: captures.length,
      },
      violations: violations.map((v) => ({
        id: v.id,
        type: v.violationType,
        severity: v.severity,
        description: v.description,
        action: v.action,
        createdAt: v.createdAt.toISOString(),
      })),
      screenCaptures: captures.map((c) => ({
        id: c.id,
        type: c.captureType,
        method: c.detectionMethod,
        blocked: c.blocked,
        application: c.activeApplication,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  }

  async function generateActivityReport(
    sessionId: string,
    _tenantId: string
  ): Promise<Record<string, unknown>> {
    const [auditLogs, transfers] = await Promise.all([
      prisma.containmentAuditLog.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.dataTransferAttempt.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    // Get activity timeline from Redis
    const activityKey = `session:activity:${sessionId}`;
    const lastActivity = await redis.get(activityKey);

    return {
      sessionId,
      generatedAt: new Date().toISOString(),
      type: 'activity',
      lastActivity,
      summary: {
        totalEvents: auditLogs.length,
        transferAttempts: transfers.length,
        eventsByCategory: auditLogs.reduce(
          (acc, log) => {
            acc[log.eventCategory] = (acc[log.eventCategory] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
      },
      events: auditLogs.map((log) => ({
        id: log.id,
        type: log.eventType,
        category: log.eventCategory,
        description: log.description,
        allowed: log.allowed,
        createdAt: log.createdAt.toISOString(),
      })),
      transfers: transfers.map((t) => ({
        id: t.id,
        type: t.transferType,
        direction: t.direction,
        action: t.action,
        fileName: t.fileName,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  async function generateComplianceReport(
    sessionId: string,
    session: {
      tenantId: string | null;
      securityPolicy: { name: string; id: string } | null;
      user: { firstName: string; lastName: string; email: string } | null;
      startedAt: Date | null;
      endedAt: Date | null;
    }
  ): Promise<Record<string, unknown>> {
    const [violations, transfers] = await Promise.all([
      prisma.securityViolation.count({ where: { sessionId } }),
      prisma.dataTransferAttempt.count({ where: { sessionId, action: 'BLOCKED' } }),
    ]);

    return {
      sessionId,
      generatedAt: new Date().toISOString(),
      type: 'compliance',
      user: session.user
        ? {
            name: `${session.user.firstName} ${session.user.lastName}`,
            email: session.user.email,
          }
        : null,
      policy: session.securityPolicy?.name,
      duration:
        session.startedAt && session.endedAt
          ? (session.endedAt.getTime() - session.startedAt.getTime()) / 60000
          : null,
      compliance: {
        policyEnforced: true,
        violationCount: violations,
        blockedTransferCount: transfers,
        compliant: violations === 0 && transfers === 0,
      },
    };
  }

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  worker.on('failed', (job, err) => {
    console.error(`Session monitor job ${job?.id} failed:`, err.message);
  });

  worker.on('completed', (job) => {
    console.log(`Session monitor job ${job.id} completed`);
  });

  return worker;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getEventTypeFromActivity(
  activityType: RecordSessionActivityData['activityType']
): 'CLIPBOARD_COPY' | 'FILE_DOWNLOAD' | 'NETWORK_REQUEST' | 'PERIPHERAL_ACCESS' {
  switch (activityType) {
    case 'clipboard':
      return 'CLIPBOARD_COPY';
    case 'file_access':
      return 'FILE_DOWNLOAD';
    case 'network':
      return 'NETWORK_REQUEST';
    default:
      return 'PERIPHERAL_ACCESS';
  }
}

// =============================================================================
// INDEX EXPORT
// =============================================================================

export { createSessionMonitorQueue as createQueue };
export { createSessionMonitorWorker as createWorker };
