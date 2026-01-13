/**
 * @module @skillancer/skillpod-svc/routes/websocket
 * WebSocket routes for real-time policy enforcement
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { DLPService } from '../services/dlp.service.js';
import type {
  ScreenshotDetectionService,
  CaptureType,
} from '../services/screenshot-detection.service.js';
import type { SecurityPolicyService } from '../services/security-policy.service.js';
import type { PrismaClient } from '@/types/prisma-shim.js';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';
import type { WebSocket as WS } from 'ws';

// =============================================================================
// TYPES
// =============================================================================

interface WebSocketRoutesDeps {
  securityPolicyService: SecurityPolicyService;
  dlpService: DLPService;
  screenshotService: ScreenshotDetectionService;
  redis: Redis;
  prisma: PrismaClient;
}

interface WSMessage {
  type: string;
  data: unknown;
  requestId?: string;
}

interface PolicyCheckRequest {
  action:
    | 'clipboard_copy'
    | 'clipboard_paste'
    | 'file_download'
    | 'file_upload'
    | 'print'
    | 'usb_access';
  content?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  metadata?: Record<string, unknown>;
}

interface ScreenCaptureReport {
  captureType: CaptureType;
  detectionMethod: string;
  processInfo?: {
    name: string;
    pid: number;
  };
  activeApplication?: string;
  activeWindow?: string;
}

interface HeartbeatData {
  clientTime: number;
  metrics?: {
    cpu?: number;
    memory?: number;
    networkRx?: number;
    networkTx?: number;
  };
}

// Connected clients map
const connectedClients = new Map<string, WS>();

type TransferType = 'CLIPBOARD_TEXT' | 'FILE_DOWNLOAD' | 'FILE_UPLOAD' | 'PRINT' | 'USB_TRANSFER';
type ViolationType =
  | 'CLIPBOARD_COPY_ATTEMPT'
  | 'CLIPBOARD_PASTE_BLOCKED'
  | 'FILE_DOWNLOAD_BLOCKED'
  | 'FILE_UPLOAD_BLOCKED'
  | 'PRINT_BLOCKED'
  | 'USB_DEVICE_BLOCKED';

function getTransferType(action: string): TransferType {
  if (action.includes('clipboard')) return 'CLIPBOARD_TEXT';
  if (action === 'file_download') return 'FILE_DOWNLOAD';
  if (action === 'file_upload') return 'FILE_UPLOAD';
  if (action === 'print') return 'PRINT';
  return 'USB_TRANSFER';
}

function getViolationType(action: string): ViolationType {
  if (action === 'clipboard_copy') return 'CLIPBOARD_COPY_ATTEMPT';
  if (action === 'clipboard_paste') return 'CLIPBOARD_PASTE_BLOCKED';
  if (action === 'file_download') return 'FILE_DOWNLOAD_BLOCKED';
  if (action === 'file_upload') return 'FILE_UPLOAD_BLOCKED';
  if (action === 'print') return 'PRINT_BLOCKED';
  return 'USB_DEVICE_BLOCKED';
}

// =============================================================================
// POLICY CHECK HELPERS
// =============================================================================

interface PolicyCheckContext {
  sessionId: string;
  user: { id?: string; tenantId?: string } | null | undefined;
  securityPolicy: {
    id?: string;
    clipboardPolicy?: string;
    fileDownloadPolicy?: string;
    fileUploadPolicy?: string;
    printingPolicy?: string;
    usbPolicy?: string;
  } | null;
}

interface PolicyCheckResult {
  allowed: boolean;
  reason?: string | undefined;
  dlpResult?: { allowed: boolean; reason?: string; sensitiveData?: unknown[] } | undefined;
}

async function checkClipboardAction(
  action: 'clipboard_copy' | 'clipboard_paste',
  content: string | undefined,
  ctx: PolicyCheckContext,
  dlpService: DLPService
): Promise<PolicyCheckResult> {
  const policy = ctx.securityPolicy?.clipboardPolicy;

  if (policy === 'BLOCKED') {
    return { allowed: false, reason: 'Clipboard operations are blocked by policy' };
  }

  if (
    (policy === 'READ_ONLY' && action === 'clipboard_copy') ||
    (policy === 'WRITE_ONLY' && action === 'clipboard_paste')
  ) {
    return { allowed: false, reason: 'This clipboard operation is blocked by policy' };
  }

  if (content && ctx.securityPolicy) {
    const dlpResult = await dlpService.evaluateTransfer({
      podId: ctx.sessionId,
      sessionId: ctx.sessionId,
      tenantId: ctx.user?.tenantId ?? '',
      userId: ctx.user?.id ?? '',
      transferType: 'CLIPBOARD_TEXT',
      direction: action === 'clipboard_copy' ? 'DOWNLOAD' : 'UPLOAD',
      content: Buffer.from(content, 'utf-8'),
    });
    return { allowed: dlpResult.allowed, reason: dlpResult.reason, dlpResult };
  }

  return { allowed: true };
}

async function checkFileDownloadAction(
  fileName: string | undefined,
  ctx: PolicyCheckContext,
  dlpService: DLPService
): Promise<PolicyCheckResult> {
  if (ctx.securityPolicy?.fileDownloadPolicy === 'BLOCKED') {
    return { allowed: false, reason: 'File downloads are blocked by policy' };
  }

  if (fileName && ctx.securityPolicy) {
    const dlpResult = await dlpService.evaluateTransfer({
      podId: ctx.sessionId,
      sessionId: ctx.sessionId,
      tenantId: ctx.user?.tenantId ?? '',
      userId: ctx.user?.id ?? '',
      transferType: 'FILE_DOWNLOAD',
      direction: 'DOWNLOAD',
      fileName,
    });
    return { allowed: dlpResult.allowed, reason: dlpResult.reason, dlpResult };
  }

  return { allowed: true };
}

async function checkFileUploadAction(
  fileName: string | undefined,
  ctx: PolicyCheckContext,
  dlpService: DLPService
): Promise<PolicyCheckResult> {
  if (ctx.securityPolicy?.fileUploadPolicy === 'BLOCKED') {
    return { allowed: false, reason: 'File uploads are blocked by policy' };
  }

  if (fileName && ctx.securityPolicy) {
    const dlpResult = await dlpService.evaluateTransfer({
      podId: ctx.sessionId,
      sessionId: ctx.sessionId,
      tenantId: ctx.user?.tenantId ?? '',
      userId: ctx.user?.id ?? '',
      transferType: 'FILE_UPLOAD',
      direction: 'UPLOAD',
      fileName,
    });
    return { allowed: dlpResult.allowed, reason: dlpResult.reason, dlpResult };
  }

  return { allowed: true };
}

function checkPrintAction(ctx: PolicyCheckContext): PolicyCheckResult {
  const policy = ctx.securityPolicy?.printingPolicy;

  if (policy === 'BLOCKED') {
    return { allowed: false, reason: 'Printing is blocked by policy' };
  }

  if (policy === 'PDF_ONLY') {
    return { allowed: true, reason: 'Only PDF export is allowed' };
  }

  return { allowed: true };
}

function checkUsbAction(
  metadata: Record<string, unknown> | undefined,
  ctx: PolicyCheckContext
): PolicyCheckResult {
  const policy = ctx.securityPolicy?.usbPolicy;

  if (policy === 'BLOCKED') {
    return { allowed: false, reason: 'USB device access is blocked by policy' };
  }

  if (policy === 'STORAGE_BLOCKED') {
    const deviceType = (metadata?.deviceType as string) ?? '';
    if (deviceType === 'storage') {
      return { allowed: false, reason: 'USB storage devices are blocked' };
    }
  }

  return { allowed: true };
}

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

export async function registerWebSocketRoutes(
  app: FastifyInstance,
  deps: WebSocketRoutesDeps
): Promise<void> {
  const {
    securityPolicyService: _securityPolicyService,
    dlpService,
    screenshotService,
    redis,
    prisma,
  } = deps;

  // Subscribe to policy updates
  const subscriber = redis.duplicate();
  await subscriber.subscribe('policy:updates', 'session:alerts');

  subscriber.on('message', (channel, message) => {
    try {
      const data = JSON.parse(message);

      if (channel === 'policy:updates') {
        // Broadcast policy update to affected sessions
        const sessionIds = (data.sessionIds as string[]) ?? [];
        for (const sessionId of sessionIds) {
          const client = connectedClients.get(sessionId);
          if (client?.readyState === 1) {
            client.send(
              JSON.stringify({
                type: 'policy_update',
                data: {
                  policyId: data.policyId,
                  changes: data.changes,
                },
              })
            );
          }
        }
      } else if (channel === 'session:alerts') {
        // Send alert to specific session
        const sessionId = data.sessionId as string;
        const client = connectedClients.get(sessionId);
        if (client?.readyState === 1) {
          client.send(
            JSON.stringify({
              type: 'alert',
              data: {
                alertType: data.type,
                message: data.message,
                severity: data.severity ?? 'info',
              },
            })
          );
        }
      }
    } catch (error) {
      console.error('WebSocket pub/sub error:', error);
    }
  });

  // ==========================================================================
  // WebSocket endpoint for policy enforcement
  // ==========================================================================

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  (
    app as unknown as {
      get: (
        path: string,
        opts: { websocket: true },
        handler: (
          socket: WS,
          request: FastifyRequest<{ Params: { sessionId: string } }>
        ) => Promise<void>
      ) => void;
    }
  ).get(
    '/ws/policy-enforcement/:sessionId',
    { websocket: true },
    async (socket: WS, request: FastifyRequest<{ Params: { sessionId: string } }>) => {
      const { sessionId } = request.params;
      const user = (request as { user?: { id: string; tenantId: string } }).user;

      if (!user) {
        socket.close(4401, 'Unauthorized');
        return;
      }

      // Get session and verify access
      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          tenantId: user.tenantId,
          status: { in: ['RUNNING', 'PAUSED'] },
        },
        include: {
          securityPolicy: true,
        },
      });

      if (!session) {
        socket.close(4404, 'Session not found');
        return;
      }

      // Register client
      connectedClients.set(sessionId, socket as unknown as WS);

      // Send initial policy
      socket.send(
        JSON.stringify({
          type: 'init',
          data: {
            sessionId,
            policy: session.securityPolicy
              ? {
                  id: session.securityPolicy.id,
                  name: session.securityPolicy.name,
                  clipboardPolicy: session.securityPolicy.clipboardPolicy,
                  fileDownloadPolicy: session.securityPolicy.fileDownloadPolicy,
                  fileUploadPolicy: session.securityPolicy.fileUploadPolicy,
                  screenCaptureBlocking: session.securityPolicy.screenCaptureBlocking,
                  printingPolicy: session.securityPolicy.printingPolicy,
                  usbPolicy: session.securityPolicy.usbPolicy,
                }
              : null,
          },
        })
      );

      // Update session activity
      await redis.set(`session:activity:${sessionId}`, new Date().toISOString());
      await redis.set(`session:ws:${sessionId}`, 'connected');

      // =======================================================================
      // Message handler
      // =======================================================================

      socket.on('message', async (rawMessage: Buffer | string) => {
        try {
          const message: WSMessage = JSON.parse(
            typeof rawMessage === 'string' ? rawMessage : rawMessage.toString()
          );

          const { type, data, requestId } = message;

          switch (type) {
            case 'policy_check':
              await handlePolicyCheck(socket, requestId, data as PolicyCheckRequest);
              break;
            case 'screen_capture':
              await handleScreenCaptureReport(socket, requestId, data as ScreenCaptureReport);
              break;
            case 'heartbeat':
              await handleHeartbeat(socket, requestId, data as HeartbeatData);
              break;
            case 'activity':
              await handleActivity(data as Record<string, unknown>);
              break;
            default:
              sendError(socket, requestId, `Unknown message type: ${type}`);
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
          socket.send(
            JSON.stringify({
              type: 'error',
              data: {
                message: error instanceof Error ? error.message : 'Unknown error',
              },
            })
          );
        }
      });

      // =======================================================================
      // Policy check handler
      // =======================================================================

      async function handlePolicyCheck(
        ws: WS,
        requestId: string | undefined,
        data: PolicyCheckRequest
      ): Promise<void> {
        const { action, content, fileName, fileSize, mimeType, metadata } = data;

        // Build context for policy checks
        const ctx: PolicyCheckContext = {
          sessionId,
          user,
          securityPolicy: session?.securityPolicy ?? null,
        };

        // Evaluate against policy using helpers
        let result: PolicyCheckResult;

        switch (action) {
          case 'clipboard_copy':
          case 'clipboard_paste':
            result = await checkClipboardAction(action, content, ctx, dlpService);
            break;
          case 'file_download':
            result = await checkFileDownloadAction(fileName, ctx, dlpService);
            break;
          case 'file_upload':
            result = await checkFileUploadAction(fileName, ctx, dlpService);
            break;
          case 'print':
            result = checkPrintAction(ctx);
            break;
          case 'usb_access':
            result = checkUsbAction(metadata, ctx);
            break;
          default:
            result = { allowed: true };
        }

        const { allowed, reason, dlpResult } = result;

        // Log the attempt
        const dbTransferType = getTransferType(action);
        const dbDirection =
          action.includes('download') || action.includes('copy') ? 'OUTBOUND' : 'INBOUND';
        await prisma.dataTransferAttempt.create({
          data: {
            sessionId,
            tenantId: user?.tenantId ?? '',
            userId: user?.id ?? '',
            transferType: dbTransferType,
            direction: dbDirection,
            fileName: fileName ?? null,
            contentSize: fileSize ?? null,
            contentType: mimeType ?? null,
            action: allowed ? 'ALLOWED' : 'BLOCKED',
            reason: reason ?? null,
            policyId: session?.securityPolicy?.id ?? null,
          },
        });

        // Send response
        ws.send(
          JSON.stringify({
            type: 'policy_check_result',
            requestId,
            data: {
              action,
              allowed,
              reason,
              sensitiveDataDetected: dlpResult?.sensitiveData && dlpResult.sensitiveData.length > 0,
            },
          })
        );

        // If blocked, also log a security violation
        if (!allowed) {
          const violationType = getViolationType(action);
          await prisma.securityViolation.create({
            data: {
              sessionId,
              tenantId: user?.tenantId ?? '',
              violationType,
              severity:
                dlpResult?.sensitiveData && dlpResult.sensitiveData.length > 0 ? 'HIGH' : 'MEDIUM',
              description: reason ?? 'Policy violation',
              action: 'BLOCKED',
              details: {
                attemptedAction: action,
                ...(fileName && { fileName }),
                ...(fileSize && { fileSize }),
              },
            },
          });
        }
      }

      // =======================================================================
      // Screen capture report handler
      // =======================================================================

      async function handleScreenCaptureReport(
        ws: WS,
        requestId: string | undefined,
        data: ScreenCaptureReport
      ): Promise<void> {
        const { captureType, detectionMethod, processInfo, activeApplication, activeWindow } = data;

        // Use screenshot detection service
        const screenCaptureEvent = {
          podId: sessionId,
          sessionId,
          userId: user?.id ?? '',
          captureType,
          detectionMethod,
          ...(processInfo && { processInfo }),
          ...(activeApplication && { activeApplication }),
          ...(activeWindow && { activeWindow }),
        };
        await screenshotService.detectCaptureAttempt(screenCaptureEvent);

        const blocked = session?.securityPolicy?.screenCaptureBlocking ?? true;

        ws.send(
          JSON.stringify({
            type: 'screen_capture_result',
            requestId,
            data: {
              blocked,
              logged: true,
              captureType,
            },
          })
        );
      }

      // =======================================================================
      // Heartbeat handler
      // =======================================================================

      async function handleHeartbeat(
        ws: WS,
        requestId: string | undefined,
        data: HeartbeatData
      ): Promise<void> {
        const { clientTime, metrics } = data;
        const serverTime = Date.now();

        // Update activity
        await redis.set(`session:activity:${sessionId}`, new Date().toISOString());

        // Store metrics if provided
        if (metrics) {
          await redis.setex(`session:metrics:${sessionId}:current`, 60, JSON.stringify(metrics));
        }

        ws.send(
          JSON.stringify({
            type: 'heartbeat_ack',
            requestId,
            data: {
              serverTime,
              latency: serverTime - clientTime,
            },
          })
        );
      }

      // =======================================================================
      // Activity handler
      // =======================================================================

      async function handleActivity(data: Record<string, unknown>): Promise<void> {
        const activityType = data.activityType as string;

        // Update last activity
        await redis.set(`session:activity:${sessionId}`, new Date().toISOString());

        // Log if needed
        if (session?.securityPolicy?.logKeystrokes && activityType === 'keyboard') {
          await prisma.containmentAuditLog.create({
            data: {
              sessionId,
              tenantId: user?.tenantId ?? '',
              userId: user?.id ?? '',
              eventType: 'PERIPHERAL_ACCESS',
              eventCategory: 'DEVICE_ACCESS',
              description: 'Keyboard activity',
              details: {},
              allowed: true,
              policyId: session.securityPolicy.id,
            },
          });
        }
      }

      // =======================================================================
      // Error helper
      // =======================================================================

      function sendError(ws: WS, requestId: string | undefined, message: string): void {
        ws.send(
          JSON.stringify({
            type: 'error',
            requestId,
            data: { message },
          })
        );
      }

      // =======================================================================
      // Close handler
      // =======================================================================

      socket.on('close', async () => {
        connectedClients.delete(sessionId);
        await redis.del(`session:ws:${sessionId}`);
      });

      // =======================================================================
      // Error handler
      // =======================================================================

      socket.on('error', (error: Error) => {
        console.error(`WebSocket error for session ${sessionId}:`, error);
        connectedClients.delete(sessionId);
      });
    }
  );
}

// =============================================================================
// BROADCAST UTILITY
// =============================================================================

export function broadcastToSessions(
  sessionIds: string[],
  message: { type: string; data: unknown }
): void {
  const payload = JSON.stringify(message);
  for (const sessionId of sessionIds) {
    const client = connectedClients.get(sessionId);
    if (client?.readyState === 1) {
      client.send(payload);
    }
  }
}

export function getConnectedSessions(): string[] {
  return Array.from(connectedClients.keys());
}
