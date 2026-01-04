import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CopilotService } from '../services/copilot.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const copilotService = new CopilotService(prisma);

export async function copilotRoutes(fastify: FastifyInstance) {
  // Generate proposal draft
  fastify.post('/proposals/draft', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const input = request.body as any;
      const result = await copilotService.generateProposalDraft({ userId, ...input });

      return reply.status(201).send(result);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Get proposal draft
  fastify.get('/proposals/draft/:draftId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = request.params as { draftId: string };
      const draft = await copilotService.getProposalDraft(draftId);

      if (!draft) {
        return reply.status(404).send({ error: 'Draft not found' });
      }

      return reply.send(draft);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update proposal draft
  fastify.patch(
    '/proposals/draft/:draftId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { draftId } = request.params as { draftId: string };
        const { content } = request.body as { content: string };

        const draft = await copilotService.updateProposalDraft(draftId, content);

        return reply.send(draft);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Get user's proposal drafts
  fastify.get('/proposals/drafts', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { status } = request.query as { status?: string };
      const drafts = await copilotService.getUserProposalDrafts(userId, status);

      return reply.send(drafts);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get rate suggestions
  fastify.post('/rates/suggest', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const input = request.body as any;
      const result = await copilotService.suggestRate({ userId, ...input });

      return reply.send(result);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Message assist
  fastify.post('/messages/assist', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const input = request.body as any;
      const result = await copilotService.assistMessage({ userId, ...input });

      return reply.send(result);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Profile optimization
  fastify.post('/profile/optimize', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const input = request.body as any;
      const result = await copilotService.optimizeProfile({ userId, ...input });

      return reply.send(result);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Market insights
  fastify.post('/market/insights', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = request.body as any;
      const result = await copilotService.getMarketInsights(input);

      return reply.send(result);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Get interaction history
  fastify.get('/history', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { type, limit } = request.query as { type?: string; limit?: string };
      const history = await copilotService.getInteractionHistory(
        userId,
        type as any,
        limit ? parseInt(limit) : 50
      );

      return reply.send(history);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
