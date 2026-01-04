import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ExecutiveEngagementService } from '../services/executive-engagement.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const engagementService = new ExecutiveEngagementService(prisma);

export async function executiveEngagementRoutes(fastify: FastifyInstance) {
  // Create engagement proposal
  fastify.post('/engagements', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = request.body as any;
      const engagement = await engagementService.createEngagement(input);

      return reply.status(201).send(engagement);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Get engagement by ID
  fastify.get('/engagements/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const engagement = await engagementService.getEngagementById(id);

      if (!engagement) {
        return reply.status(404).send({ error: 'Engagement not found' });
      }

      return reply.send(engagement);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get engagements for executive
  fastify.get(
    '/engagements/executive/:executiveProfileId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { executiveProfileId } = request.params as { executiveProfileId: string };
        const { status } = request.query as { status?: string };

        const engagements = await engagementService.getExecutiveEngagements(
          executiveProfileId,
          status as any
        );

        return reply.send(engagements);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Get engagements for client tenant
  fastify.get(
    '/engagements/client/:clientTenantId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { clientTenantId } = request.params as { clientTenantId: string };
        const { status } = request.query as { status?: string };

        const engagements = await engagementService.getClientEngagements(
          clientTenantId,
          status as any
        );

        return reply.send(engagements);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Update engagement
  fastify.patch('/engagements/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const input = request.body as any;

      const engagement = await engagementService.updateEngagement(id, input);

      return reply.send(engagement);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Approve engagement
  fastify.post('/engagements/:id/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const engagement = await engagementService.approveEngagement(id, userId);

      return reply.send(engagement);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // End engagement
  fastify.post('/engagements/:id/end', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason?: string };

      const engagement = await engagementService.endEngagement(id, reason);

      return reply.send(engagement);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Terminate engagement
  fastify.post(
    '/engagements/:id/terminate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const { reason } = request.body as { reason: string };

        const engagement = await engagementService.terminateEngagement(id, reason);

        return reply.send(engagement);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Log time entry
  fastify.post(
    '/engagements/:id/time-entries',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const input = request.body as any;

        const timeEntry = await engagementService.logTimeEntry({
          engagementId: id,
          ...input,
        });

        return reply.status(201).send(timeEntry);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Get time entries for engagement
  fastify.get(
    '/engagements/:id/time-entries',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const { startDate, endDate } = request.query as { startDate?: string; endDate?: string };

        const result = await engagementService.getTimeEntries(
          id,
          startDate ? new Date(startDate) : undefined,
          endDate ? new Date(endDate) : undefined
        );

        return reply.send(result);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Create milestone
  fastify.post(
    '/engagements/:id/milestones',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const input = request.body as any;

        const milestone = await engagementService.createMilestone({
          engagementId: id,
          ...input,
        });

        return reply.status(201).send(milestone);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Get milestones for engagement
  fastify.get(
    '/engagements/:id/milestones',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const milestones = await engagementService.getMilestones(id);

        return reply.send(milestones);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Update milestone status
  fastify.patch(
    '/milestones/:milestoneId/status',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { milestoneId } = request.params as { milestoneId: string };
        const { status } = request.body as { status: string };

        const milestone = await engagementService.updateMilestoneStatus(milestoneId, status);

        return reply.send(milestone);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Setup workspace
  fastify.post(
    '/engagements/:id/workspace',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const config = request.body as any;

        const workspace = await engagementService.setupWorkspace(id, config);

        return reply.send(workspace);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Get workspace
  fastify.get(
    '/engagements/:id/workspace',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const workspace = await engagementService.getWorkspace(id);

        if (!workspace) {
          return reply.status(404).send({ error: 'Workspace not found' });
        }

        return reply.send(workspace);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Get engagement statistics
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { executiveProfileId, clientTenantId } = request.query as {
        executiveProfileId?: string;
        clientTenantId?: string;
      };

      const stats = await engagementService.getEngagementStats(executiveProfileId, clientTenantId);

      return reply.send(stats);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
