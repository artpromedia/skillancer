import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SkillancerCardService } from '../services/skillancer-card.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const cardService = new SkillancerCardService(prisma);

export async function cardRoutes(fastify: FastifyInstance) {
  // Create a new card
  fastify.post('/cards', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const input = request.body as any;
      const card = await cardService.createCard({ userId, ...input });

      return reply.status(201).send(card);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Get user's cards
  fastify.get('/cards', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { includeInactive } = request.query as { includeInactive?: string };
      const cards = await cardService.getUserCards(userId, includeInactive === 'true');

      return reply.send(cards);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get card by ID
  fastify.get('/cards/:cardId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { cardId } = request.params as { cardId: string };
      const card = await cardService.getCardById(cardId);

      if (!card) {
        return reply.status(404).send({ error: 'Card not found' });
      }

      return reply.send(card);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update card
  fastify.patch('/cards/:cardId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { cardId } = request.params as { cardId: string };
      const input = request.body as any;

      const card = await cardService.updateCard(cardId, input);

      return reply.send(card);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Freeze card
  fastify.post('/cards/:cardId/freeze', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { cardId } = request.params as { cardId: string };
      const card = await cardService.freezeCard(cardId);

      return reply.send(card);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Unfreeze card
  fastify.post('/cards/:cardId/unfreeze', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { cardId } = request.params as { cardId: string };
      const card = await cardService.unfreezeCard(cardId);

      return reply.send(card);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Cancel card
  fastify.post('/cards/:cardId/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { cardId } = request.params as { cardId: string };
      const { reason } = request.body as { reason?: string };

      const card = await cardService.cancelCard(cardId, reason);

      return reply.send(card);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Get card balance
  fastify.get('/cards/:cardId/balance', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { cardId } = request.params as { cardId: string };
      const balance = await cardService.getCardBalance(cardId);

      return reply.send(balance);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get transactions
  fastify.get(
    '/cards/:cardId/transactions',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { cardId } = request.params as { cardId: string };
        const { startDate, endDate, type, page, limit } = request.query as {
          startDate?: string;
          endDate?: string;
          type?: string;
          page?: string;
          limit?: string;
        };

        const result = await cardService.getTransactions(
          cardId,
          startDate ? new Date(startDate) : undefined,
          endDate ? new Date(endDate) : undefined,
          type,
          page ? Number.parseInt(page) : 1,
          limit ? Number.parseInt(limit) : 50
        );

        return reply.send(result);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Record transaction (webhook/internal)
  fastify.post(
    '/cards/:cardId/transactions',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { cardId } = request.params as { cardId: string };
        const input = request.body as any;

        const transaction = await cardService.recordTransaction({
          cardId,
          ...input,
        });

        return reply.status(201).send(transaction);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Get transaction summary
  fastify.get('/cards/:cardId/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { cardId } = request.params as { cardId: string };
      const { startDate, endDate } = request.query as {
        startDate?: string;
        endDate?: string;
      };

      const now = new Date();
      const start = startDate
        ? new Date(startDate)
        : new Date(now.getFullYear(), now.getMonth(), 1);
      const end = endDate ? new Date(endDate) : now;

      const summary = await cardService.getTransactionSummary(cardId, start, end);

      return reply.send(summary);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Redeem cashback
  fastify.post(
    '/cards/:cardId/redeem-cashback',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { cardId } = request.params as { cardId: string };
        const { amount } = request.body as { amount: number };

        const transaction = await cardService.redeemCashback(cardId, amount);

        return reply.send(transaction);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );
}
