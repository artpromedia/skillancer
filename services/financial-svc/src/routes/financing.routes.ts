import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { InvoiceFinancingService } from '../services/invoice-financing.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const financingService = new InvoiceFinancingService(prisma);

export async function financingRoutes(fastify: FastifyInstance) {
  // Check eligibility
  fastify.post('/financing/eligibility', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { invoiceAmount } = request.body as { invoiceAmount: number };
      const eligibility = await financingService.checkEligibility(userId, invoiceAmount);

      return reply.send(eligibility);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Request financing
  fastify.post('/financing', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const input = request.body as any;
      const financing = await financingService.requestFinancing({ userId, ...input });

      return reply.status(201).send(financing);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Get financing request by ID
  fastify.get('/financing/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const financing = await financingService.getFinancingById(id);

      if (!financing) {
        return reply.status(404).send({ error: 'Financing request not found' });
      }

      return reply.send(financing);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get user's financing requests
  fastify.get('/financing', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { status, page, limit } = request.query as {
        status?: string;
        page?: string;
        limit?: string;
      };

      const result = await financingService.getUserFinancings(
        userId,
        status as any,
        page ? Number.parseInt(page) : 1,
        limit ? Number.parseInt(limit) : 20
      );

      return reply.send(result);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get user's financing statistics
  fastify.get('/financing/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const stats = await financingService.getUserFinancingStats(userId);

      return reply.send(stats);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Admin: Approve financing
  fastify.post(
    '/admin/financing/:id/approve',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as any).user;
        if (!user?.roles?.includes('ADMIN')) {
          return reply.status(403).send({ error: 'Admin access required' });
        }

        const { id } = request.params as { id: string };
        const { approvedAmount, feePercentage } = request.body as {
          approvedAmount: number;
          feePercentage?: number;
        };

        const financing = await financingService.approveFinancing(
          id,
          approvedAmount,
          feePercentage
        );

        return reply.send(financing);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Admin: Reject financing
  fastify.post(
    '/admin/financing/:id/reject',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as any).user;
        if (!user?.roles?.includes('ADMIN')) {
          return reply.status(403).send({ error: 'Admin access required' });
        }

        const { id } = request.params as { id: string };
        const { reason } = request.body as { reason: string };

        const financing = await financingService.rejectFinancing(id, reason);

        return reply.send(financing);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Admin: Mark as funded
  fastify.post(
    '/admin/financing/:id/fund',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as any).user;
        if (!user?.roles?.includes('ADMIN')) {
          return reply.status(403).send({ error: 'Admin access required' });
        }

        const { id } = request.params as { id: string };
        const financing = await financingService.markFunded(id);

        return reply.send(financing);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Record repayment (webhook/internal)
  fastify.post('/financing/:id/repayment', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { amount } = request.body as { amount: number };

      const financing = await financingService.recordRepayment(id, amount);

      return reply.send(financing);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Admin: Get pending requests
  fastify.get('/admin/financing/pending', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      if (!user?.roles?.includes('ADMIN')) {
        return reply.status(403).send({ error: 'Admin access required' });
      }

      const { page, limit } = request.query as { page?: string; limit?: string };

      const result = await financingService.getPendingRequests(
        page ? Number.parseInt(page) : 1,
        limit ? Number.parseInt(limit) : 20
      );

      return reply.send(result);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Admin: Mark as defaulted
  fastify.post(
    '/admin/financing/:id/default',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as any).user;
        if (!user?.roles?.includes('ADMIN')) {
          return reply.status(403).send({ error: 'Admin access required' });
        }

        const { id } = request.params as { id: string };
        const { reason } = request.body as { reason: string };

        const financing = await financingService.markDefaulted(id, reason);

        return reply.send(financing);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );
}
