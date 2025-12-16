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
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

interface WebSocketRoutesDeps {
  securityPolicyService: SecurityPolicyService;
  dlpService: DLPService;
  screenshotService: ScreenshotDetectionService;
  redis: Redis;
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
const connectedClients = new Map<string, WebSocket>();

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

export async function registerWebSocketRoutes(
  app: FastifyInstance,
  deps: WebSocketRoutesDeps
): Promise<void> {
  const { securityPolicyService, dlpService, screenshotService, redis } = deps;

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
          if (client && client.readyState === 1) {
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
        if (client && client.readyState === 1) {
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

  app.get(
    '/ws/policy-enforcement/:sessionId',
    { websocket: true },
    async (socket: WebSocket, request: FastifyRequest<{ Params: { sessionId: string } }>) => {
      const { sessionId } = request.params;
      const user = (request as { user?: { id: string; tenantId: string } }).user;

      if (!user) {
        socket.close(4401, 'Unauthorized');
        return;
      }

      // Get session and verify access
      const session = await app.prisma.session.findFirst({
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
      connectedClients.set(sessionId, socket);

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
                  fileDownloadAllowed: session.securityPolicy.fileDownloadAllowed,
                  screenCaptureBlocked: session.securityPolicy.screenCaptureBlocked,
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
        ws: WebSocket,
        requestId: string | undefined,
        data: PolicyCheckRequest
      ): Promise<void> {
        const { action, content, fileName, fileSize, mimeType, metadata } = data;

        // Evaluate against policy
        let allowed = true;
        let reason: string | undefined;
        let dlpResult: { allowed: boolean; reason?: string; sensitiveData?: unknown[] } | undefined;

        switch (action) {
          case 'clipboard_copy':
          case 'clipboard_paste':
            if (session.securityPolicy?.clipboardPolicy === 'BLOCKED') {
              allowed = false;
              reason = 'Clipboard operations are blocked by policy';
            } else if (
              session.securityPolicy?.clipboardPolicy === 'TEXT_ONLY' &&
              mimeType &&
              !mimeType.startsWith('text/')
            ) {
              allowed = false;
              reason = 'Only text clipboard content is allowed';
            } else if (content && session.securityPolicy?.dlpEnabled) {
              // Run DLP scan
              dlpResult = await dlpService.evaluateTransfer({
                sessionId,
                tenantId: user!.tenantId,
                userId: user!.id,
                transferType: 'CLIPBOARD',
                direction: action === 'clipboard_copy' ? 'OUTBOUND' : 'INBOUND',
                content,
              });
              allowed = dlpResult.allowed;
              reason = dlpResult.reason;
            }
            break;

          case 'file_download':
            if (!session.securityPolicy?.fileDownloadAllowed) {
              allowed = false;
              reason = 'File downloads are blocked by policy';
            } else if (fileName && session.securityPolicy?.dlpEnabled) {
              // Run DLP scan
              dlpResult = await dlpService.evaluateTransfer({
                sessionId,
                tenantId: user!.tenantId,
                userId: user!.id,
                transferType: 'FILE',
                direction: 'OUTBOUND',
                fileName,
                fileSize,
                mimeType,
                content: content ?? '',
              });
              allowed = dlpResult.allowed;
              reason = dlpResult.reason;
            }
            break;

          case 'file_upload':
            if (!session.securityPolicy?.fileUploadAllowed) {
              allowed = false;
              reason = 'File uploads are blocked by policy';
            } else if (fileName && session.securityPolicy?.dlpEnabled) {
              // Run DLP scan
              dlpResult = await dlpService.evaluateTransfer({
                sessionId,
                tenantId: user!.tenantId,
                userId: user!.id,
                transferType: 'FILE',
                direction: 'INBOUND',
                fileName,
                fileSize,
                mimeType,
                content: content ?? '',
              });
              allowed = dlpResult.allowed;
              reason = dlpResult.reason;
            }
            break;

          case 'print':
            if (session.securityPolicy?.printingPolicy === 'BLOCKED') {
              allowed = false;
              reason = 'Printing is blocked by policy';
            } else if (session.securityPolicy?.printingPolicy === 'VIRTUAL_ONLY') {
              // Client must ensure print goes to virtual printer
              reason = 'Only virtual printing is allowed';
            }
            break;

          case 'usb_access':
            if (session.securityPolicy?.usbPolicy === 'BLOCKED') {
              allowed = false;
              reason = 'USB device access is blocked by policy';
            } else if (session.securityPolicy?.usbPolicy === 'STORAGE_BLOCKED') {
              const deviceType = (metadata?.deviceType as string) ?? '';
              if (deviceType === 'storage') {
                allowed = false;
                reason = 'USB storage devices are blocked';
              }
            }
            break;
        }

        // Log the attempt
        await app.prisma.dataTransferAttempt.create({
          data: {
            sessionId,
            tenantId: user!.tenantId,
            userId: user!.id,
            transferType: action.includes('clipboard')
              ? 'CLIPBOARD'
              : action.includes('file')
                ? 'FILE'
                : 'OTHER',
            direction:
              action.includes('download') || action.includes('copy') ? 'OUTBOUND' : 'INBOUND',
            fileName: fileName ?? null,
            fileSize: fileSize ?? null,
            mimeType: mimeType ?? null,
            action: allowed ? 'ALLOWED' : 'BLOCKED',
            reason: reason ?? null,
            policyId: session.securityPolicy?.id ?? null,
            dlpScanResult: dlpResult ? { sensitiveData: dlpResult.sensitiveData } : null,
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
          await app.prisma.securityViolation.create({
            data: {
              sessionId,
              tenantId: user!.tenantId,
              userId: user!.id,
              violationType: action.includes('clipboard')
                ? 'CLIPBOARD_VIOLATION'
                : action.includes('file')
                  ? 'FILE_TRANSFER_VIOLATION'
                  : 'POLICY_VIOLATION',
              severity:
                dlpResult?.sensitiveData && dlpResult.sensitiveData.length > 0 ? 'HIGH' : 'MEDIUM',
              description: reason ?? 'Policy violation',
              action: 'BLOCKED',
              details: {
                attemptedAction: action,
                fileName,
                fileSize,
                sensitiveDataTypes: dlpResult?.sensitiveData?.map((s: { type?: string }) => s.type),
              },
            },
          });
        }
      }

      // =======================================================================
      // Screen capture report handler
      // =======================================================================

      async function handleScreenCaptureReport(
        ws: WebSocket,
        requestId: string | undefined,
        data: ScreenCaptureReport
      ): Promise<void> {
        const { captureType, detectionMethod, processInfo, activeApplication, activeWindow } = data;

        // Use screenshot detection service
        await screenshotService.detectCaptureAttempt({
          podId: sessionId,
          sessionId,
          userId: user!.id,
          captureType,
          detectionMethod,
          processInfo,
          activeApplication,
          activeWindow,
        });

        const blocked = session.securityPolicy?.screenCaptureBlocked ?? true;

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
        ws: WebSocket,
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
        if (session.securityPolicy?.logKeystrokes && activityType === 'keyboard') {
          await app.prisma.containmentAuditLog.create({
            data: {
              sessionId,
              tenantId: user!.tenantId,
              userId: user!.id,
              eventType: 'PERIPHERAL_ACCESS',
              eventCategory: 'USER_ACTIVITY',
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

      function sendError(ws: WebSocket, requestId: string | undefined, message: string): void {
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

      socket.on('error', (error) => {
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
    if (client && client.readyState === 1) {
      client.send(payload);
    }
  }
}

export function getConnectedSessions(): string[] {
  return Array.from(connectedClients.keys());
}
