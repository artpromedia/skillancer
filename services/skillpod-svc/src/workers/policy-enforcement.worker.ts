/**
 * @module @skillancer/skillpod-svc/workers/policy-enforcement
 * BullMQ worker for asynchronous policy enforcement tasks
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { Worker, Queue, type Job } from 'bullmq';

import type { DLPService } from '../services/dlp.service.js';
import type {
  KasmWorkspacesService,
  KasmSecurityConfig,
} from '../services/kasm-workspaces.service.js';
import type { WebSocketEnforcementService } from '../services/websocket-enforcement.service.js';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export type PolicyEnforcementJobType =
  | 'apply_policy_to_pod'
  | 'bulk_policy_update'
  | 'scan_file_content'
  | 'process_transfer_request'
  | 'security_alert'
  | 'session_timeout_check'
  | 'idle_session_check'
  | 'cleanup_expired_requests';

export interface ApplyPolicyToPodData {
  podId: string;
  policyId: string;
  kasmId: string;
  updatedBy: string;
}

export interface BulkPolicyUpdateData {
  tenantId: string;
  policyId: string;
  updatedBy: string;
}

export interface ScanFileContentData {
  transferId: string;
  sessionId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
}

export interface ProcessTransferRequestData {
  requestId: string;
  action: 'approve' | 'reject';
  processedBy: string;
  notes?: string;
}

export interface SecurityAlertData {
  tenantId: string;
  alertType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  sessionId?: string;
  userId?: string;
  details: Record<string, unknown>;
}

export interface SessionTimeoutData {
  sessionId: string;
  reason: 'idle' | 'max_duration' | 'policy';
}

export type PolicyEnforcementJobData =
  | { type: 'apply_policy_to_pod'; data: ApplyPolicyToPodData }
  | { type: 'bulk_policy_update'; data: BulkPolicyUpdateData }
  | { type: 'scan_file_content'; data: ScanFileContentData }
  | { type: 'process_transfer_request'; data: ProcessTransferRequestData }
  | { type: 'security_alert'; data: SecurityAlertData }
  | { type: 'session_timeout_check'; data: SessionTimeoutData }
  | { type: 'idle_session_check'; data: { tenantId: string } }
  | { type: 'cleanup_expired_requests'; data: { tenantId: string } };

// =============================================================================
// QUEUE NAME
// =============================================================================

export const POLICY_ENFORCEMENT_QUEUE = 'skillpod:policy-enforcement';

// =============================================================================
// QUEUE FACTORY
// =============================================================================

export function createPolicyEnforcementQueue(redis: Redis): Queue<PolicyEnforcementJobData> {
  return new Queue<PolicyEnforcementJobData>(POLICY_ENFORCEMENT_QUEUE, {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        age: 24 * 3600, // 24 hours
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // 7 days
      },
    },
  });
}

// =============================================================================
// WORKER FACTORY
// =============================================================================

export interface PolicyEnforcementWorkerDeps {
  prisma: PrismaClient;
  redis: Redis;
  kasmService: KasmWorkspacesService;
  dlpService: DLPService;
  wsService: WebSocketEnforcementService;
}

export function createPolicyEnforcementWorker(
  deps: PolicyEnforcementWorkerDeps
): Worker<PolicyEnforcementJobData> {
  const { prisma, redis, kasmService, dlpService, wsService } = deps;

  const worker = new Worker<PolicyEnforcementJobData>(
    POLICY_ENFORCEMENT_QUEUE,
    async (job: Job<PolicyEnforcementJobData>) => {
      const { type, data } = job.data;

      switch (type) {
        case 'apply_policy_to_pod':
          return handleApplyPolicyToPod(data);
        case 'bulk_policy_update':
          return handleBulkPolicyUpdate(data);
        case 'scan_file_content':
          return handleScanFileContent(data);
        case 'process_transfer_request':
          return handleProcessTransferRequest(data);
        case 'security_alert':
          return handleSecurityAlert(data);
        case 'session_timeout_check':
          return handleSessionTimeout(data);
        case 'idle_session_check':
          return handleIdleSessionCheck(data as { tenantId: string });
        case 'cleanup_expired_requests':
          return handleCleanupExpiredRequests(data as { tenantId: string });
        default: {
          const _exhaustiveCheck: never = type;
          throw new Error(`Unknown job type: ${String(_exhaustiveCheck)}`);
        }
      }
    },
    {
      connection: redis,
      concurrency: 10,
      limiter: {
        max: 100,
        duration: 1000,
      },
    }
  );

  // ===========================================================================
  // JOB HANDLERS
  // ===========================================================================

  async function handleApplyPolicyToPod(data: ApplyPolicyToPodData): Promise<void> {
    const { podId, policyId, kasmId, updatedBy } = data;

    // Get the policy
    const policy = await prisma.podSecurityPolicy.findUnique({
      where: { id: policyId },
    });

    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    // Apply to Kasm workspace
    const config: KasmSecurityConfig = {
      allow_clipboard_down: policy.clipboardOutbound ?? false,
      allow_clipboard_up: policy.clipboardInbound ?? false,
      allow_clipboard_seamless: policy.clipboardPolicy === 'BIDIRECTIONAL',
      allow_file_download: policy.fileDownloadPolicy !== 'BLOCKED',
      allow_file_upload: policy.fileUploadPolicy !== 'BLOCKED',
      allow_audio: true,
      allow_video: true,
      idle_disconnect: policy.idleTimeout ?? 0,
      allow_printing: policy.printingPolicy !== 'BLOCKED',
      enable_watermark: policy.watermarkEnabled ?? false,
      ...(policy.maxSessionDuration !== null && { session_time_limit: policy.maxSessionDuration }),
    };
    await kasmService.updateWorkspaceConfig(kasmId, config);

    // Update watermark if enabled
    if (policy.watermarkEnabled && policy.watermarkConfig) {
      const wmConfig = policy.watermarkConfig as Record<string, unknown>;
      const positionMap: Record<string, string> = {
        corner: 'bottom-right',
        center: 'center',
        tiled: 'tiled',
      };
      const rawPosition = (wmConfig.position as string) ?? 'corner';
      await kasmService.applyWatermark(kasmId, {
        text: (wmConfig.text as string) ?? '',
        position: (positionMap[rawPosition] ?? 'bottom-right') as
          | 'center'
          | 'tiled'
          | 'top-left'
          | 'top-right'
          | 'bottom-left'
          | 'bottom-right',
        opacity: (wmConfig.opacity as number) ?? 0.2,
        color: (wmConfig.color as string) ?? '#888888',
        fontSize: (wmConfig.fontSize as number) ?? 12,
        pattern: 'tiled',
      });
    }

    // Notify connected clients via WebSocket
    await wsService.sendToPod(podId, {
      type: 'POLICY_UPDATE',
      data: {
        policyId,
        clipboardPolicy: policy.clipboardPolicy,
        fileDownloadPolicy: policy.fileDownloadPolicy,
        fileUploadPolicy: policy.fileUploadPolicy,
        screenCaptureBlocking: policy.screenCaptureBlocking,
        watermarkEnabled: policy.watermarkEnabled,
      },
    });

    // Log the change
    const session = await prisma.session.findUnique({ where: { id: podId } });
    if (session?.tenantId) {
      await prisma.containmentAuditLog.create({
        data: {
          sessionId: podId,
          tenantId: session.tenantId,
          userId: updatedBy,
          eventType: 'POLICY_CHANGE',
          eventCategory: 'CONFIGURATION',
          description: `Policy applied: ${policy.name}`,
          details: { policyId, previousPolicyId: session.securityPolicyId } as object,
          allowed: true,
          policyId,
        },
      });
    }
  }

  async function handleBulkPolicyUpdate(data: BulkPolicyUpdateData): Promise<void> {
    const { tenantId, policyId, updatedBy } = data;

    // Get all active sessions for tenant using this policy or no policy
    const sessions = await prisma.session.findMany({
      where: {
        tenantId,
        status: { in: ['RUNNING', 'PAUSED'] },
        OR: [{ securityPolicyId: policyId }, { securityPolicyId: null }],
      },
    });

    const queue = createPolicyEnforcementQueue(redis);

    // Queue individual policy applications
    for (const session of sessions) {
      const config = session.config as Record<string, unknown>;
      const kasmId = config?.kasmId as string | undefined;

      if (kasmId) {
        await queue.add(
          'apply_policy_to_pod',
          {
            type: 'apply_policy_to_pod',
            data: {
              podId: session.id,
              policyId,
              kasmId,
              updatedBy,
            },
          },
          { priority: 2 }
        );
      }
    }
  }

  async function handleScanFileContent(data: ScanFileContentData): Promise<void> {
    const {
      transferId,
      sessionId: _sessionId,
      fileName: _fileName,
      fileType: _fileType,
      fileSize: _fileSize,
      storagePath: _storagePath,
    } = data;

    // In production, this would fetch the file from storage and scan it
    // For now, we'll update the transfer record with scan results

    // Get transfer attempt
    const transfer = await prisma.dataTransferAttempt.findUnique({
      where: { id: transferId },
    });

    if (!transfer) {
      throw new Error(`Transfer not found: ${transferId}`);
    }

    // Perform DLP scan (placeholder - actual implementation would read file)
    const scanResult = await dlpService.scanForSensitiveData(Buffer.from('placeholder'));

    // Update transfer record with scan results
    await prisma.dataTransferAttempt.update({
      where: { id: transferId },
      data: {
        reason: scanResult.found
          ? `Sensitive data detected: ${scanResult.patterns.map((p) => p.name).join(', ')}`
          : transfer.reason,
      },
    });
  }

  async function handleProcessTransferRequest(data: ProcessTransferRequestData): Promise<void> {
    const { requestId, action, processedBy, notes } = data;

    const request = await prisma.transferOverrideRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error(`Transfer request not found: ${requestId}`);
    }

    if (request.status !== 'PENDING') {
      throw new Error(`Request already processed: ${request.status}`);
    }

    // Update request status
    const requestUpdateData: {
      status: 'APPROVED' | 'REJECTED';
      processedAt: Date;
      approvedBy?: string | null;
      approvalNotes?: string | null;
    } = {
      status: action === 'approve' ? 'APPROVED' : 'REJECTED',
      processedAt: new Date(),
    };
    if (action === 'approve') requestUpdateData.approvedBy = processedBy;
    if (notes) requestUpdateData.approvalNotes = notes;
    await prisma.transferOverrideRequest.update({
      where: { id: requestId },
      data: requestUpdateData,
    });

    // If approved, update related transfer attempts
    if (action === 'approve') {
      const attemptUpdateData: {
        action: 'OVERRIDE_APPROVED';
        overrideApproved: true;
        overrideBy: string;
        overrideReason?: string | null;
      } = {
        action: 'OVERRIDE_APPROVED',
        overrideApproved: true,
        overrideBy: processedBy,
      };
      if (notes) attemptUpdateData.overrideReason = notes;
      await prisma.dataTransferAttempt.updateMany({
        where: { overrideRequestId: requestId },
        data: attemptUpdateData,
      });
    }

    // Notify user via WebSocket
    // Find session for this request
    const transfer = await prisma.dataTransferAttempt.findFirst({
      where: { overrideRequestId: requestId },
    });

    if (transfer) {
      await wsService.sendToSession(transfer.sessionId, {
        type: 'TRANSFER_REQUEST_PROCESSED',
        data: {
          requestId,
          action,
          notes,
        },
      });
    }
  }

  async function handleSecurityAlert(data: SecurityAlertData): Promise<void> {
    const { tenantId, alertType, severity, sessionId, userId, details } = data;

    // Log to security violations if session-related
    if (sessionId) {
      await prisma.securityViolation.create({
        data: {
          sessionId,
          tenantId,
          violationType: alertType as 'CLIPBOARD_COPY_ATTEMPT',
          severity: severity as 'MEDIUM',
          description: `Security alert: ${alertType}`,
          details: details as object,
          action: severity === 'CRITICAL' ? 'SESSION_TERMINATED' : 'LOGGED',
        },
      });

      // Terminate session for critical alerts
      if (severity === 'CRITICAL') {
        const session = await prisma.session.findUnique({ where: { id: sessionId } });
        if (session) {
          const config = session.config as Record<string, unknown>;
          const kasmId = config?.kasmId as string | undefined;
          if (kasmId) {
            await kasmService.terminateWorkspace(kasmId);
          }
          await prisma.session.update({
            where: { id: sessionId },
            data: { status: 'TERMINATED', endedAt: new Date() },
          });
        }
      }
    }

    // Publish alert for notification service
    await redis.publish(
      'security:alerts',
      JSON.stringify({
        type: alertType,
        tenantId,
        severity,
        sessionId,
        userId,
        details,
        timestamp: new Date().toISOString(),
      })
    );
  }

  async function handleSessionTimeout(data: SessionTimeoutData): Promise<void> {
    const { sessionId, reason } = data;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (session?.status !== 'RUNNING') {
      return;
    }

    // Terminate Kasm workspace
    const config = session.config as Record<string, unknown>;
    const kasmId = config?.kasmId as string | undefined;

    if (kasmId) {
      await kasmService.terminateWorkspace(kasmId);
    }

    // Update session
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: 'TERMINATED', endedAt: new Date() },
    });

    // Log event
    if (session.tenantId) {
      await prisma.containmentAuditLog.create({
        data: {
          sessionId,
          tenantId: session.tenantId,
          userId: session.userId,
          eventType: 'SESSION_END',
          eventCategory: 'SESSION',
          description: `Session terminated: ${reason}`,
          details: { reason },
          allowed: true,
        },
      });

      // Log violation
      await prisma.securityViolation.create({
        data: {
          sessionId,
          tenantId: session.tenantId,
          violationType: reason === 'idle' ? 'IDLE_TIMEOUT' : 'SESSION_TIMEOUT',
          severity: 'LOW',
          description: `Session terminated due to ${reason}`,
          details: { reason },
          action: 'SESSION_TERMINATED',
        },
      });
    }

    // Notify user
    await wsService.sendToSession(sessionId, {
      type: 'SESSION_TERMINATED',
      data: { reason },
    });
  }

  async function handleIdleSessionCheck(data: { tenantId: string }): Promise<void> {
    const { tenantId } = data;

    // Get all active sessions for tenant
    const sessions = await prisma.session.findMany({
      where: {
        tenantId,
        status: 'RUNNING',
      },
      include: { securityPolicy: true },
    });

    const now = new Date();
    const queue = createPolicyEnforcementQueue(redis);

    for (const session of sessions) {
      const idleTimeout = session.securityPolicy?.idleTimeout ?? 15;
      const maxDuration = session.securityPolicy?.maxSessionDuration;

      // Check last activity from Redis
      const lastActivity = await redis.get(`session:activity:${session.id}`);
      const lastActivityTime = lastActivity ? new Date(lastActivity) : session.startedAt;

      // Check idle timeout
      const idleMinutes = (now.getTime() - (lastActivityTime?.getTime() ?? 0)) / 60000;
      if (idleMinutes >= idleTimeout) {
        await queue.add('session_timeout_check', {
          type: 'session_timeout_check',
          data: { sessionId: session.id, reason: 'idle' },
        });
        continue;
      }

      // Check max duration
      if (maxDuration && session.startedAt) {
        const durationMinutes = (now.getTime() - session.startedAt.getTime()) / 60000;
        if (durationMinutes >= maxDuration) {
          await queue.add('session_timeout_check', {
            type: 'session_timeout_check',
            data: { sessionId: session.id, reason: 'max_duration' },
          });
        }
      }
    }
  }

  async function handleCleanupExpiredRequests(data: { tenantId: string }): Promise<void> {
    const { tenantId } = data;

    // Mark expired transfer requests
    await prisma.transferOverrideRequest.updateMany({
      where: {
        tenantId,
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });

    // Clean up old file transfer requests
    await prisma.fileTransferRequest.updateMany({
      where: {
        tenantId,
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });
  }

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });

  return worker;
}
