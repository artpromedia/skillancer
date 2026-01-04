import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { roadmapService } from '../services/roadmap.service';
import { InitiativeStatus } from '@prisma/client';
import { z } from 'zod';

// ==================== Validation Schemas ====================

const createRoadmapSchema = z.object({
  engagementId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  timeframe: z.string().optional(),
});

const updateRoadmapSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  timeframe: z.string().optional(),
});

const createInitiativeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  quarter: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.nativeEnum(InitiativeStatus).optional(),
  progress: z.number().min(0).max(100).optional(),
  category: z.string().optional(),
  priority: z.number().optional(),
  ownerId: z.string().uuid().optional(),
  ownerName: z.string().optional(),
  jiraEpicKey: z.string().optional(),
  jiraEpicUrl: z.string().url().optional(),
  githubIssueUrl: z.string().url().optional(),
  dependsOn: z.array(z.string().uuid()).optional(),
});

const updateInitiativeSchema = createInitiativeSchema.partial();

const updateStatusSchema = z.object({
  status: z.nativeEnum(InitiativeStatus),
  progress: z.number().min(0).max(100).optional(),
});

const reorderSchema = z.object({
  initiativeIds: z.array(z.string().uuid()),
});

const createMilestoneSchema = z.object({
  title: z.string().min(1).max(200),
  dueDate: z.string().datetime().optional(),
});

const updateMilestoneSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  dueDate: z.string().datetime().optional(),
  completed: z.boolean().optional(),
});

// ==================== Route Handlers ====================

export async function roadmapRoutes(app: FastifyInstance): Promise<void> {
  // -------------------- Roadmap Routes --------------------

  app.post('/roadmaps', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createRoadmapSchema.parse(request.body);
    const roadmap = await roadmapService.createRoadmap(
      body as unknown as Parameters<typeof roadmapService.createRoadmap>[0]
    );
    return reply.status(201).send({ success: true, data: roadmap });
  });

  app.get(
    '/roadmaps/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const roadmap = await roadmapService.getRoadmap(request.params.id);
      if (!roadmap) return reply.status(404).send({ success: false, error: 'Roadmap not found' });
      return { success: true, data: roadmap };
    }
  );

  app.get(
    '/engagements/:engagementId/roadmap',
    async (request: FastifyRequest<{ Params: { engagementId: string } }>, reply: FastifyReply) => {
      const roadmap = await roadmapService.getRoadmapByEngagement(request.params.engagementId);
      if (!roadmap) return reply.status(404).send({ success: false, error: 'Roadmap not found' });
      return { success: true, data: roadmap };
    }
  );

  app.patch(
    '/roadmaps/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const body = updateRoadmapSchema.parse(request.body);
      const roadmap = await roadmapService.updateRoadmap(request.params.id, body);
      return { success: true, data: roadmap };
    }
  );

  app.delete(
    '/roadmaps/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      await roadmapService.deleteRoadmap(request.params.id);
      return reply.status(204).send();
    }
  );

  // -------------------- Initiative Routes --------------------

  app.post(
    '/roadmaps/:roadmapId/initiatives',
    async (request: FastifyRequest<{ Params: { roadmapId: string } }>, reply: FastifyReply) => {
      const body = createInitiativeSchema.parse(request.body);
      const initiative = await roadmapService.createInitiative({
        ...body,
        roadmapId: request.params.roadmapId,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
      } as unknown as Parameters<typeof roadmapService.createInitiative>[0]);
      return reply.status(201).send({ success: true, data: initiative });
    }
  );

  app.get(
    '/initiatives/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const initiative = await roadmapService.getInitiative(request.params.id);
      if (!initiative)
        return reply.status(404).send({ success: false, error: 'Initiative not found' });
      return { success: true, data: initiative };
    }
  );

  app.patch(
    '/initiatives/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const body = updateInitiativeSchema.parse(request.body);
      const initiative = await roadmapService.updateInitiative(request.params.id, {
        ...body,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
      });
      return { success: true, data: initiative };
    }
  );

  app.patch(
    '/initiatives/:id/status',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const body = updateStatusSchema.parse(request.body);
      const initiative = await roadmapService.updateInitiativeStatus(
        request.params.id,
        body.status,
        body.progress
      );
      return { success: true, data: initiative };
    }
  );

  app.delete(
    '/initiatives/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      await roadmapService.deleteInitiative(request.params.id);
      return reply.status(204).send();
    }
  );

  app.post(
    '/roadmaps/:roadmapId/initiatives/reorder',
    async (request: FastifyRequest<{ Params: { roadmapId: string } }>, reply: FastifyReply) => {
      const body = reorderSchema.parse(request.body);
      await roadmapService.reorderInitiatives(request.params.roadmapId, body.initiativeIds);
      return { success: true };
    }
  );

  // -------------------- Milestone Routes --------------------

  app.post(
    '/initiatives/:initiativeId/milestones',
    async (request: FastifyRequest<{ Params: { initiativeId: string } }>, reply: FastifyReply) => {
      const body = createMilestoneSchema.parse(request.body);
      const milestone = await roadmapService.createMilestone({
        initiativeId: request.params.initiativeId,
        title: body.title,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      });
      return reply.status(201).send({ success: true, data: milestone });
    }
  );

  app.patch(
    '/milestones/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const body = updateMilestoneSchema.parse(request.body);
      const milestone = await roadmapService.updateMilestone(request.params.id, {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      });
      return { success: true, data: milestone };
    }
  );

  app.post(
    '/milestones/:id/toggle',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const milestone = await roadmapService.toggleMilestoneComplete(request.params.id);
      return { success: true, data: milestone };
    }
  );

  app.delete(
    '/milestones/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      await roadmapService.deleteMilestone(request.params.id);
      return reply.status(204).send();
    }
  );

  // -------------------- Analytics Routes --------------------

  app.get(
    '/roadmaps/:id/stats',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const stats = await roadmapService.getRoadmapStats(request.params.id);
      return { success: true, data: stats };
    }
  );

  app.get(
    '/roadmaps/:id/by-quarter',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const byQuarter = await roadmapService.getInitiativesByQuarter(request.params.id);
      return { success: true, data: byQuarter };
    }
  );

  app.get(
    '/roadmaps/:id/blocked',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const blocked = await roadmapService.getBlockedInitiatives(request.params.id);
      return { success: true, data: blocked };
    }
  );

  app.get(
    '/roadmaps/:id/upcoming-milestones',
    async (
      request: FastifyRequest<{ Params: { id: string }; Querystring: { days?: string } }>,
      reply: FastifyReply
    ) => {
      const days = request.query.days ? parseInt(request.query.days, 10) : 14;
      const upcoming = await roadmapService.getUpcomingMilestones(request.params.id, days);
      return { success: true, data: upcoming };
    }
  );
}

export default roadmapRoutes;
