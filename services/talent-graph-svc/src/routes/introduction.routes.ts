import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WarmIntroductionService } from '../services/warm-introduction.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const introductionService = new WarmIntroductionService(prisma);

export async function introductionRoutes(fastify: FastifyInstance) {
  // Request introduction
  fastify.post('/introductions', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const input = request.body as any;
      const introduction = await introductionService.requestIntroduction({
        requesterId: userId,
        ...input,
      });

      return reply.status(201).send(introduction);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Get introduction by ID
  fastify.get('/introductions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const introduction = await introductionService.getIntroductionById(id);

      if (!introduction) {
        return reply.status(404).send({ error: 'Introduction not found' });
      }

      return reply.send(introduction);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Respond as introducer
  fastify.post(
    '/introductions/:id/introducer-response',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params as { id: string };
        const { accepted, message } = request.body as { accepted: boolean; message?: string };

        const introduction = await introductionService.respondAsIntroducer(
          { introductionId: id, accepted, message },
          userId
        );

        return reply.send(introduction);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Respond as target
  fastify.post(
    '/introductions/:id/target-response',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params as { id: string };
        const { accepted, message } = request.body as { accepted: boolean; message?: string };

        const introduction = await introductionService.respondAsTarget(
          { introductionId: id, accepted, message },
          userId
        );

        return reply.send(introduction);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Get pending introductions as introducer
  fastify.get(
    '/introductions/pending/introducer',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const introductions = await introductionService.getPendingAsIntroducer(userId);

        return reply.send(introductions);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Get pending introductions as target
  fastify.get(
    '/introductions/pending/target',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const introductions = await introductionService.getPendingAsTarget(userId);

        return reply.send(introductions);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Get introduction history
  fastify.get('/introductions/history', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { role, page, limit } = request.query as {
        role?: 'requester' | 'target' | 'introducer';
        page?: string;
        limit?: string;
      };

      const result = await introductionService.getIntroductionHistory(
        userId,
        role,
        page ? parseInt(page) : 1,
        limit ? parseInt(limit) : 20
      );

      return reply.send(result);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Find introduction paths to target
  fastify.get(
    '/introductions/paths/:targetUserId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { targetUserId } = request.params as { targetUserId: string };
        const paths = await introductionService.findIntroductionPaths(userId, targetUserId);

        return reply.send(paths);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Cancel introduction
  fastify.delete('/introductions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id: string };
      await introductionService.cancelIntroduction(id, userId);

      return reply.status(204).send();
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });
}
