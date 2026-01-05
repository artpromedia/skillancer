import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TaxVaultService } from '../services/tax-vault.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const taxVaultService = new TaxVaultService(prisma);

export async function taxVaultRoutes(fastify: FastifyInstance) {
  // Get or create vault
  fastify.get('/tax-vault', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const vault = await taxVaultService.getOrCreateVault({ userId });

      return reply.send(vault);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get vault with details
  fastify.get('/tax-vault/details', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const vault = await taxVaultService.getVaultByUserId(userId);

      if (!vault) {
        return reply.status(404).send({ error: 'Tax vault not found' });
      }

      return reply.send(vault);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get vault summary
  fastify.get('/tax-vault/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const summary = await taxVaultService.getVaultSummary(userId);

      return reply.send(summary);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update vault settings
  fastify.patch('/tax-vault', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const input = request.body as any;
      const vault = await taxVaultService.updateVaultSettings(userId, input);

      return reply.send(vault);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Make deposit
  fastify.post('/tax-vault/deposit', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const vault = await taxVaultService.getVaultByUserId(userId);
      if (!vault) {
        return reply.status(404).send({ error: 'Tax vault not found' });
      }

      const input = request.body as any;
      const deposit = await taxVaultService.deposit({
        taxVaultId: vault.id,
        source: 'MANUAL',
        ...input,
      });

      return reply.status(201).send(deposit);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Make withdrawal
  fastify.post('/tax-vault/withdraw', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const vault = await taxVaultService.getVaultByUserId(userId);
      if (!vault) {
        return reply.status(404).send({ error: 'Tax vault not found' });
      }

      const input = request.body as any;
      const withdrawal = await taxVaultService.withdraw({
        taxVaultId: vault.id,
        ...input,
      });

      return reply.status(201).send(withdrawal);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Get deposit history
  fastify.get('/tax-vault/deposits', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const vault = await taxVaultService.getVaultByUserId(userId);
      if (!vault) {
        return reply.status(404).send({ error: 'Tax vault not found' });
      }

      const { page, limit } = request.query as { page?: string; limit?: string };

      const result = await taxVaultService.getDeposits(
        vault.id,
        page ? Number.parseInt(page) : 1,
        limit ? Number.parseInt(limit) : 20
      );

      return reply.send(result);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get withdrawal history
  fastify.get('/tax-vault/withdrawals', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const vault = await taxVaultService.getVaultByUserId(userId);
      if (!vault) {
        return reply.status(404).send({ error: 'Tax vault not found' });
      }

      const { page, limit } = request.query as { page?: string; limit?: string };

      const result = await taxVaultService.getWithdrawals(
        vault.id,
        page ? Number.parseInt(page) : 1,
        limit ? Number.parseInt(limit) : 20
      );

      return reply.send(result);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get annual tax report
  fastify.get('/tax-vault/report/:year', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { year } = request.params as { year: string };
      const report = await taxVaultService.getAnnualTaxReport(userId, Number.parseInt(year));

      return reply.send(report);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Internal: Auto-save from payment (called by payment service)
  fastify.post(
    '/internal/tax-vault/auto-save',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // This endpoint should be protected by internal API key
        const { userId, paymentAmount, paymentId } = request.body as {
          userId: string;
          paymentAmount: number;
          paymentId: string;
        };

        const deposit = await taxVaultService.autoSaveFromPayment(userId, paymentAmount, paymentId);

        return reply.send({ success: true, deposit });
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );
}
