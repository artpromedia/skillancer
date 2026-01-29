/**
 * @module @skillancer/skillpod-svc/routes/pods
 * Pod management routes for VDI workspace lifecycle
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-case-declarations */

import { z } from 'zod';

import { requireAuth, requireAdmin } from '../plugins/auth.js';
import type { DataContainmentService } from '../services/data-containment.service.js';
import type {
  KasmWorkspacesService,
  KasmSecurityConfig,
} from '../services/kasm-workspaces.service.js';
import type { SecurityPolicyService } from '../services/security-policy.service.js';
import type { PrismaClient } from '@/types/prisma-shim.js';
import type { FastifyInstance } from 'fastify';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const CreatePodSchema = z.object({
  name: z.string().min(1).max(100),
  imageId: z.string().uuid(),
  tenantId: z.string().uuid(),
  policyId: z.string().uuid().optional(),
  environment: z.record(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const UpdatePodPolicySchema = z.object({
  policyId: z.string().uuid(),
});

const PodActionSchema = z.object({
  action: z.enum(['pause', 'resume', 'terminate', 'restart']),
  reason: z.string().optional(),
});

// =============================================================================
// ROUTE TYPES
// =============================================================================

interface PodParams {
  podId: string;
}

interface TenantQuery {
  tenantId: string;
}

interface PodStatusQuery extends TenantQuery {
  status?: string;
  page?: number;
  limit?: number;
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

export function podRoutes(
  app: FastifyInstance,
  kasmService: KasmWorkspacesService,
  policyService: SecurityPolicyService,
  containmentService: DataContainmentService,
  prisma: PrismaClient
): void {
  // ===========================================================================
  // CREATE POD
  // ===========================================================================

  app.post<{
    Body: z.infer<typeof CreatePodSchema>;
  }>(
    '/pods',
    {
      preHandler: [requireAuth],
      schema: {
        body: CreatePodSchema,
        response: {
          201: z.object({
            pod: z.object({
              id: z.string().uuid(),
              name: z.string(),
              status: z.string(),
              connectionUrl: z.string().optional(),
              createdAt: z.string(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { name, imageId, tenantId, policyId, environment, metadata } = request.body;

      // Get or create default policy
      let policy;
      if (policyId) {
        policy = await policyService.getPolicy(policyId);
        if (!policy) {
          return reply.status(400).send({ error: 'Security policy not found' });
        }
      } else {
        policy = await policyService.getDefaultPolicy(tenantId);
        if (!policy) {
          return reply.status(400).send({ error: 'No default security policy configured' });
        }
      }

      // Get user from request context
      const userId = (request as unknown as { user?: { id: string } }).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Build Kasm security config from policy
      const securityConfig: KasmSecurityConfig = {
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
      };
      if (policy.maxSessionDuration) securityConfig.session_time_limit = policy.maxSessionDuration;
      if (policy.watermarkConfig) {
        // Map 'corner' to 'bottom-right' for Kasm API compatibility
        const positionMap: Record<
          string,
          'center' | 'tiled' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
        > = {
          corner: 'bottom-right',
          center: 'center',
          tiled: 'tiled',
        };
        securityConfig.watermark_config = {
          text: policy.watermarkConfig.text ?? '',
          position: positionMap[policy.watermarkConfig.position ?? 'corner'] ?? 'bottom-right',
          opacity: policy.watermarkConfig.opacity ?? 0.2,
          color: policy.watermarkConfig.color ?? '#888888',
          fontSize: policy.watermarkConfig.fontSize ?? 12,
          pattern: 'tiled',
        };
      }

      // Create workspace in Kasm
      const createParams = {
        imageId,
        userId,
        name,
        securityConfig,
        ...(environment && { environment }),
      };
      const workspace = await kasmService.createWorkspace(createParams);

      // Create session record in database
      const session = await prisma.session.create({
        data: {
          userId,
          tenantId,
          type: 'DEVELOPMENT',
          status: 'PROVISIONING',
          instanceType: 'standard',
          region: 'us-east-1',
          image: imageId,
          securityPolicyId: policy.id,
          config: {
            kasmId: workspace.kasmId,
            imageId,
            name,
            ...metadata,
          },
          startedAt: new Date(),
        },
      });

      return reply.status(201).send({
        pod: {
          id: session.id,
          name,
          status: 'PROVISIONING',
          connectionUrl: workspace.kasmUrl,
          createdAt: session.createdAt.toISOString(),
        },
      });
    }
  );

  // ===========================================================================
  // LIST PODS
  // ===========================================================================

  app.get<{ Querystring: PodStatusQuery }>(
    '/pods',
    {
      preHandler: [requireAuth],
      schema: {
        querystring: z.object({
          tenantId: z.string().uuid(),
          status: z.string().optional(),
          page: z.coerce.number().min(1).default(1).optional(),
          limit: z.coerce.number().min(1).max(100).default(20).optional(),
        }),
      },
    },
    async (request) => {
      const { tenantId, status, page = 1, limit = 20 } = request.query;
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = { tenantId };
      if (status) where.status = status;

      const [sessions, total] = await Promise.all([
        prisma.session.findMany({
          where,
          include: {
            securityPolicy: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.session.count({ where }),
      ]);

      return {
        pods: sessions.map((session) => ({
          id: session.id,
          name: (session.config as Record<string, unknown>)?.name ?? 'Unnamed Pod',
          status: session.status,
          user: session.user,
          policyId: session.securityPolicyId,
          policyName: session.securityPolicy?.name,
          startedAt: session.startedAt?.toISOString(),
          endedAt: session.endedAt?.toISOString(),
          createdAt: session.createdAt.toISOString(),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
  );

  // ===========================================================================
  // GET POD
  // ===========================================================================

  app.get<{ Params: PodParams }>(
    '/pods/:podId',
    {
      preHandler: [requireAuth],
      schema: {
        params: z.object({
          podId: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const { podId } = request.params;

      const session = await prisma.session.findUnique({
        where: { id: podId },
        include: {
          securityPolicy: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      if (!session) {
        return reply.status(404).send({ error: 'Pod not found' });
      }

      const config = session.config as Record<string, unknown>;
      const kasmId = config?.kasmId as string | undefined;

      // Get workspace status from Kasm
      let kasmStatus;
      if (kasmId) {
        try {
          kasmStatus = await kasmService.getWorkspaceStatus(kasmId);
        } catch {
          // Workspace may have been terminated
          kasmStatus = null;
        }
      }

      return {
        pod: {
          id: session.id,
          name: config?.name ?? 'Unnamed Pod',
          status: session.status,
          kasmStatus: kasmStatus?.status,
          user: session.user,
          policy: session.securityPolicy
            ? {
                id: session.securityPolicy.id,
                name: session.securityPolicy.name,
                clipboardPolicy: session.securityPolicy.clipboardPolicy,
                fileDownloadPolicy: session.securityPolicy.fileDownloadPolicy,
                fileUploadPolicy: session.securityPolicy.fileUploadPolicy,
                screenCaptureBlocking: session.securityPolicy.screenCaptureBlocking,
              }
            : null,
          config: {
            imageId: config?.imageId,
            kasmId,
          },
          startedAt: session.startedAt?.toISOString(),
          endedAt: session.endedAt?.toISOString(),
          createdAt: session.createdAt.toISOString(),
        },
      };
    }
  );

  // ===========================================================================
  // UPDATE POD POLICY
  // ===========================================================================

  app.put<{
    Params: PodParams;
    Body: z.infer<typeof UpdatePodPolicySchema>;
  }>(
    '/pods/:podId/policy',
    {
      preHandler: [requireAuth],
      schema: {
        params: z.object({
          podId: z.string().uuid(),
        }),
        body: UpdatePodPolicySchema,
      },
    },
    async (request, reply) => {
      const { podId } = request.params;
      const { policyId } = request.body;

      // Get session
      const session = await prisma.session.findUnique({
        where: { id: podId },
      });

      if (!session) {
        return reply.status(404).send({ error: 'Pod not found' });
      }

      // Get new policy
      const policy = await policyService.getPolicy(policyId);
      if (!policy) {
        return reply.status(400).send({ error: 'Security policy not found' });
      }

      // Verify policy belongs to same tenant
      if (policy.tenantId !== session.tenantId) {
        return reply.status(403).send({ error: 'Policy does not belong to this tenant' });
      }

      // Update session
      await prisma.session.update({
        where: { id: podId },
        data: { securityPolicyId: policyId },
      });

      // Apply policy to Kasm workspace
      const config = session.config as Record<string, unknown>;
      const kasmId = config?.kasmId as string | undefined;

      if (kasmId) {
        const updateConfig: KasmSecurityConfig = {
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
        };
        if (policy.maxSessionDuration) updateConfig.session_time_limit = policy.maxSessionDuration;
        await kasmService.updateWorkspaceConfig(kasmId, updateConfig);
      }

      // Log policy change
      await prisma.containmentAuditLog.create({
        data: {
          sessionId: podId,
          tenantId: session.tenantId,
          userId: session.userId,
          eventType: 'POLICY_CHANGE',
          eventCategory: 'CONFIGURATION',
          description: `Security policy changed to: ${policy.name}`,
          details: {
            previousPolicyId: session.securityPolicyId,
            newPolicyId: policyId,
          },
          allowed: true,
          policyId,
        },
      });

      return { success: true, policyId };
    }
  );

  // ===========================================================================
  // POD ACTIONS (PAUSE, RESUME, TERMINATE)
  // ===========================================================================

  app.post<{
    Params: PodParams;
    Body: z.infer<typeof PodActionSchema>;
  }>(
    '/pods/:podId/action',
    {
      preHandler: [requireAuth],
      schema: {
        params: z.object({
          podId: z.string().uuid(),
        }),
        body: PodActionSchema,
      },
    },
    async (request, reply) => {
      const { podId } = request.params;
      const { action, reason } = request.body;

      const session = await prisma.session.findUnique({
        where: { id: podId },
      });

      if (!session) {
        return reply.status(404).send({ error: 'Pod not found' });
      }

      const config = session.config as Record<string, unknown>;
      const kasmId = config?.kasmId as string | undefined;

      if (!kasmId) {
        return reply.status(400).send({ error: 'Pod has no associated Kasm workspace' });
      }

      let newStatus: string;

      switch (action) {
        case 'pause':
          await kasmService.pauseWorkspace(kasmId);
          newStatus = 'PAUSED';
          break;
        case 'resume':
          await kasmService.resumeWorkspace(kasmId);
          newStatus = 'RUNNING';
          break;
        case 'terminate':
          await kasmService.terminateWorkspace(kasmId);
          newStatus = 'TERMINATED';
          break;
        case 'restart':
          await kasmService.terminateWorkspace(kasmId);
          // Recreate workspace with same config
          const policy = session.securityPolicyId
            ? await policyService.getPolicy(session.securityPolicyId)
            : await policyService.getDefaultPolicy(session.tenantId!);

          if (policy) {
            const newWorkspace = await kasmService.createWorkspace({
              imageId: config.imageId as string,
              userId: session.userId,
              name: config.name as string,
              securityConfig: {
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
              },
            });

            await prisma.session.update({
              where: { id: podId },
              data: {
                config: {
                  ...config,
                  kasmId: newWorkspace.kasmId,
                },
              },
            });
          }
          newStatus = 'RUNNING';
          break;
      }

      // Update session status
      const updateData: { status: 'PAUSED' | 'RUNNING' | 'TERMINATED'; endedAt?: Date | null } = {
        status: newStatus as 'PAUSED' | 'RUNNING' | 'TERMINATED',
      };
      if (action === 'terminate') {
        updateData.endedAt = new Date();
      }
      await prisma.session.update({
        where: { id: podId },
        data: updateData,
      });

      // Log action
      await prisma.containmentAuditLog.create({
        data: {
          sessionId: podId,
          tenantId: session.tenantId!,
          userId: session.userId,
          eventType: action === 'terminate' ? 'SESSION_END' : 'SESSION_START',
          eventCategory: 'SESSION',
          description: `Pod ${action}: ${reason ?? 'No reason provided'}`,
          details: { action, reason },
          allowed: true,
        },
      });

      return { success: true, status: newStatus };
    }
  );

  // ===========================================================================
  // GET POD METRICS
  // ===========================================================================

  app.get<{ Params: PodParams }>(
    '/pods/:podId/metrics',
    {
      preHandler: [requireAuth],
      schema: {
        params: z.object({
          podId: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const { podId } = request.params;

      const session = await prisma.session.findUnique({
        where: { id: podId },
      });

      if (!session) {
        return reply.status(404).send({ error: 'Pod not found' });
      }

      const config = session.config as Record<string, unknown>;
      const kasmId = config?.kasmId as string | undefined;

      if (!kasmId) {
        return reply.status(400).send({ error: 'Pod has no associated Kasm workspace' });
      }

      const metrics = await kasmService.getSessionMetrics(kasmId);

      return {
        podId,
        metrics: {
          cpu: metrics.cpuUsage,
          memory: metrics.memoryUsage,
          networkRx: metrics.networkRx,
          networkTx: metrics.networkTx,
          clipboardEvents: metrics.clipboardEvents,
          fileTransferEvents: metrics.fileTransferEvents,
        },
      };
    }
  );

  // ===========================================================================
  // GET POD WATERMARK CONFIG
  // ===========================================================================

  app.get<{ Params: PodParams }>(
    '/pods/:podId/watermark',
    {
      preHandler: [requireAuth],
      schema: {
        params: z.object({
          podId: z.string().uuid(),
        }),
      },
    },
    async (request, _reply) => {
      const { podId } = request.params;

      const watermarkConfig = await containmentService.generateWatermarkConfig(podId);

      return watermarkConfig;
    }
  );
}
