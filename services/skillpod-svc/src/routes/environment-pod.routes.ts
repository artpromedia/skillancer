/**
 * @module @skillancer/skillpod-svc/routes/environment-pod
 * Environment pod management API routes
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */

import { z } from 'zod';

import type { AutoScalingService } from '../services/auto-scaling.service.js';
import type { PodService } from '../services/pod.service.js';
import type { ResourcePoolService } from '../services/resource-pool.service.js';
import type { PodStatus } from '@prisma/client';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

// =============================================================================
// SCHEMAS
// =============================================================================

const ResourceSpecSchema = z.object({
  cpu: z.number().min(1).max(128),
  memory: z.number().min(1024).max(524288),
  storage: z.number().min(10).max(10000),
  gpu: z.boolean().optional(),
  gpuType: z.string().optional(),
});

const AutoScalingConfigSchema = z.object({
  enabled: z.boolean(),
  minResources: ResourceSpecSchema,
  maxResources: ResourceSpecSchema,
  cpuThreshold: z.number().min(1).max(100).optional(),
  memoryThreshold: z.number().min(1).max(100).optional(),
  scaleUpCooldownSeconds: z.number().min(60).max(3600).optional(),
  scaleDownCooldownSeconds: z.number().min(60).max(3600).optional(),
});

const CreatePodSchema = z.object({
  templateId: z.string().uuid(),
  name: z.string().min(1).max(100),
  resources: ResourceSpecSchema.optional(),
  environmentVars: z.record(z.string()).optional(),
  autoScaling: AutoScalingConfigSchema.optional(),
  persistentStorage: z.boolean().optional(),
  sessionDurationMinutes: z.number().min(15).max(1440).optional(), // 15 min to 24 hours
  securityPolicyId: z.string().uuid().optional(),
});

const ResizePodSchema = z.object({
  cpu: z.number().min(1).max(128).optional(),
  memory: z.number().min(1024).max(524288).optional(),
  storage: z.number().min(10).max(10000).optional(),
  gpu: z.boolean().optional(),
  gpuType: z.string().optional(),
  reason: z.string().optional(),
});

const ExtendSessionSchema = z.object({
  additionalMinutes: z.number().min(15).max(1440),
});

const UpdateAutoScalingSchema = z.object({
  enabled: z.boolean(),
  cpuThreshold: z.number().min(1).max(100).optional(),
  memoryThreshold: z.number().min(1).max(100).optional(),
  scaleUpCooldownSeconds: z.number().min(60).max(3600).optional(),
  scaleDownCooldownSeconds: z.number().min(60).max(3600).optional(),
});

const ListPodsQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((v) => v?.split(',') as PodStatus[] | undefined),
  templateId: z.string().uuid().optional(),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20)),
});

// =============================================================================
// ROUTE PLUGIN
// =============================================================================

interface PodRoutesOptions {
  podService: PodService;
  resourcePoolService: ResourcePoolService;
  autoScalingService: AutoScalingService;
}

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    tenantId: string;
    roles: string[];
  };
}

export const environmentPodRoutes: FastifyPluginAsync<PodRoutesOptions> = async (
  fastify,
  options
) => {
  const { podService, resourcePoolService, autoScalingService } = options;

  // ===========================================================================
  // LIST PODS
  // ===========================================================================
  fastify.get(
    '/',
    {
      schema: {
        querystring: ListPodsQuerySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              pods: { type: 'array' },
              total: { type: 'number' },
              page: { type: 'number' },
              limit: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const query = ListPodsQuerySchema.parse(request.query);
      const { tenantId, id: userId } = request.user || {};

      if (!tenantId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const result = await podService.listPods({
        tenantId,
        userId, // Filter to user's own pods unless admin
        status: query.status,
        templateId: query.templateId,
        page: query.page,
        limit: query.limit,
      });

      return reply.send({
        ...result,
        page: query.page || 1,
        limit: query.limit || 20,
      });
    }
  );

  // ===========================================================================
  // GET POD BY ID
  // ===========================================================================
  fastify.get<{
    Params: { podId: string };
  }>(
    '/:podId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            podId: { type: 'string', format: 'uuid' },
          },
          required: ['podId'],
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const { podId } = request.params;
      const userId = request.user?.id;

      const pod = await podService.getPodById(podId);

      if (!pod) {
        return reply.status(404).send({ error: 'Pod not found' });
      }

      // Check access
      if (pod.userId !== userId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      return reply.send({ pod });
    }
  );

  // ===========================================================================
  // CREATE POD
  // ===========================================================================
  fastify.post(
    '/',
    {
      schema: {
        body: CreatePodSchema,
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const body = CreatePodSchema.parse(request.body);
      const { tenantId, id: userId } = request.user || {};

      if (!tenantId || !userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      // Check capacity
      if (body.resources) {
        const capacityCheck = await resourcePoolService.checkCapacity(tenantId, body.resources);
        if (!capacityCheck.hasCapacity) {
          return reply.status(400).send({
            error: 'Insufficient capacity',
            details: capacityCheck.reason,
          });
        }
      }

      try {
        const pod = await podService.createPod({
          tenantId,
          userId,
          ...body,
        });

        return await reply.status(201).send({ pod });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('TEMPLATE_NOT_FOUND')) {
            return reply.status(400).send({ error: 'Template not found' });
          }
          if (error.message.includes('QUOTA_EXCEEDED')) {
            return reply.status(400).send({ error: 'Resource quota exceeded' });
          }
          if (error.message.includes('INVALID_RESOURCES')) {
            return reply.status(400).send({ error: error.message });
          }
        }
        throw error;
      }
    }
  );

  // ===========================================================================
  // START POD
  // ===========================================================================
  fastify.post<{
    Params: { podId: string };
  }>(
    '/:podId/start',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            podId: { type: 'string', format: 'uuid' },
          },
          required: ['podId'],
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const { podId } = request.params;
      const userId = request.user?.id;

      const existingPod = await podService.getPodById(podId);
      if (!existingPod) {
        return reply.status(404).send({ error: 'Pod not found' });
      }
      if (existingPod.userId !== userId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      try {
        const pod = await podService.startPod(podId);
        return await reply.send({ pod });
      } catch (error) {
        if (error instanceof Error && error.message.includes('INVALID_STATUS')) {
          return reply.status(400).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // ===========================================================================
  // STOP POD
  // ===========================================================================
  fastify.post<{
    Params: { podId: string };
  }>(
    '/:podId/stop',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            podId: { type: 'string', format: 'uuid' },
          },
          required: ['podId'],
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const { podId } = request.params;
      const userId = request.user?.id;

      const existingPod = await podService.getPodById(podId);
      if (!existingPod) {
        return reply.status(404).send({ error: 'Pod not found' });
      }
      if (existingPod.userId !== userId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      try {
        const pod = await podService.stopPod(podId);
        return await reply.send({ pod });
      } catch (error) {
        if (error instanceof Error && error.message.includes('INVALID_STATUS')) {
          return reply.status(400).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // ===========================================================================
  // HIBERNATE POD
  // ===========================================================================
  fastify.post<{
    Params: { podId: string };
  }>(
    '/:podId/hibernate',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            podId: { type: 'string', format: 'uuid' },
          },
          required: ['podId'],
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const { podId } = request.params;
      const userId = request.user?.id;

      const existingPod = await podService.getPodById(podId);
      if (!existingPod) {
        return reply.status(404).send({ error: 'Pod not found' });
      }
      if (existingPod.userId !== userId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      try {
        const pod = await podService.hibernatePod(podId);
        return await reply.send({ pod });
      } catch (error) {
        if (error instanceof Error && error.message.includes('INVALID_STATUS')) {
          return reply.status(400).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // ===========================================================================
  // RESUME POD
  // ===========================================================================
  fastify.post<{
    Params: { podId: string };
  }>(
    '/:podId/resume',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            podId: { type: 'string', format: 'uuid' },
          },
          required: ['podId'],
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const { podId } = request.params;
      const userId = request.user?.id;

      const existingPod = await podService.getPodById(podId);
      if (!existingPod) {
        return reply.status(404).send({ error: 'Pod not found' });
      }
      if (existingPod.userId !== userId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      try {
        const pod = await podService.resumePod(podId);
        return await reply.send({ pod });
      } catch (error) {
        if (error instanceof Error && error.message.includes('INVALID_STATUS')) {
          return reply.status(400).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // ===========================================================================
  // TERMINATE POD
  // ===========================================================================
  fastify.delete<{
    Params: { podId: string };
  }>(
    '/:podId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            podId: { type: 'string', format: 'uuid' },
          },
          required: ['podId'],
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const { podId } = request.params;
      const userId = request.user?.id;

      const existingPod = await podService.getPodById(podId);
      if (!existingPod) {
        return reply.status(404).send({ error: 'Pod not found' });
      }
      if (existingPod.userId !== userId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      await podService.terminatePod(podId);

      return reply.status(204).send();
    }
  );

  // ===========================================================================
  // RESIZE POD
  // ===========================================================================
  fastify.post<{
    Params: { podId: string };
  }>(
    '/:podId/resize',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            podId: { type: 'string', format: 'uuid' },
          },
          required: ['podId'],
        },
        body: ResizePodSchema,
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const { podId } = request.params;
      const body = ResizePodSchema.parse(request.body);
      const userId = request.user?.id;

      const existingPod = await podService.getPodById(podId);
      if (!existingPod) {
        return reply.status(404).send({ error: 'Pod not found' });
      }
      if (existingPod.userId !== userId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      try {
        const pod = await podService.resizePod(podId, {
          ...body,
          triggeredBy: 'manual',
        });
        return await reply.send({ pod });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('QUOTA_EXCEEDED')) {
            return reply.status(400).send({ error: 'Resource quota exceeded' });
          }
          if (error.message.includes('INVALID_RESOURCES')) {
            return reply.status(400).send({ error: error.message });
          }
        }
        throw error;
      }
    }
  );

  // ===========================================================================
  // EXTEND SESSION
  // ===========================================================================
  fastify.post<{
    Params: { podId: string };
  }>(
    '/:podId/extend',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            podId: { type: 'string', format: 'uuid' },
          },
          required: ['podId'],
        },
        body: ExtendSessionSchema,
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const { podId } = request.params;
      const body = ExtendSessionSchema.parse(request.body);
      const userId = request.user?.id;

      const existingPod = await podService.getPodById(podId);
      if (!existingPod) {
        return reply.status(404).send({ error: 'Pod not found' });
      }
      if (existingPod.userId !== userId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      try {
        const pod = await podService.extendSession(podId, body.additionalMinutes);
        return await reply.send({ pod });
      } catch (error) {
        if (error instanceof Error && error.message.includes('INVALID_DURATION')) {
          return reply.status(400).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // ===========================================================================
  // GET CONNECTION DETAILS
  // ===========================================================================
  fastify.get<{
    Params: { podId: string };
  }>(
    '/:podId/connect',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            podId: { type: 'string', format: 'uuid' },
          },
          required: ['podId'],
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const { podId } = request.params;
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      try {
        const connectionDetails = await podService.getConnectionDetails(podId, userId);
        return await reply.send(connectionDetails);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('POD_NOT_FOUND')) {
            return reply.status(404).send({ error: 'Pod not found' });
          }
          if (error.message.includes('UNAUTHORIZED')) {
            return reply.status(403).send({ error: 'Access denied' });
          }
          if (error.message.includes('INVALID_STATUS')) {
            return reply.status(400).send({ error: 'Pod is not running' });
          }
        }
        throw error;
      }
    }
  );

  // ===========================================================================
  // REFRESH CONNECTION TOKEN
  // ===========================================================================
  fastify.post<{
    Params: { podId: string };
  }>(
    '/:podId/connect/refresh',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            podId: { type: 'string', format: 'uuid' },
          },
          required: ['podId'],
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const { podId } = request.params;
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      try {
        const connectionDetails = await podService.refreshConnectionToken(podId, userId);
        return await reply.send(connectionDetails);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('POD_NOT_FOUND')) {
            return reply.status(404).send({ error: 'Pod not found' });
          }
          if (error.message.includes('UNAUTHORIZED')) {
            return reply.status(403).send({ error: 'Access denied' });
          }
        }
        throw error;
      }
    }
  );

  // ===========================================================================
  // AUTO-SCALING ENDPOINTS
  // ===========================================================================
  fastify.get<{
    Params: { podId: string };
  }>(
    '/:podId/auto-scaling',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            podId: { type: 'string', format: 'uuid' },
          },
          required: ['podId'],
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const { podId } = request.params;
      const userId = request.user?.id;

      const pod = await podService.getPodById(podId);
      if (!pod) {
        return reply.status(404).send({ error: 'Pod not found' });
      }
      if (pod.userId !== userId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const cooldown = await autoScalingService.getCooldownStatus(podId);
      const history = await autoScalingService.getScalingHistory(podId, 10);

      return reply.send({
        enabled: pod.autoScalingEnabled,
        config: pod.autoScalingConfig,
        cooldown,
        history,
      });
    }
  );

  fastify.patch<{
    Params: { podId: string };
  }>(
    '/:podId/auto-scaling',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            podId: { type: 'string', format: 'uuid' },
          },
          required: ['podId'],
        },
        body: UpdateAutoScalingSchema,
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const { podId } = request.params;
      const body = UpdateAutoScalingSchema.parse(request.body);
      const userId = request.user?.id;

      const pod = await podService.getPodById(podId);
      if (!pod) {
        return reply.status(404).send({ error: 'Pod not found' });
      }
      if (pod.userId !== userId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      // This would update the pod's auto-scaling config
      // For now, return success
      return reply.send({ success: true, config: body });
    }
  );

  // ===========================================================================
  // CAPACITY ENDPOINT
  // ===========================================================================
  fastify.get('/capacity', {}, async (request: AuthenticatedRequest, reply) => {
    const tenantId = request.user?.tenantId;

    if (!tenantId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const capacity = await resourcePoolService.getAvailableCapacity(tenantId);

    return reply.send(capacity);
  });
};

export default environmentPodRoutes;
