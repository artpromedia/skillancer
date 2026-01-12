import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { OutcomeService } from '../services/outcome.service';
import { PredictionService } from '../services/prediction.service';
import { RiskAlertService } from '../services/risk-alert.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const outcomeService = new OutcomeService(prisma);
const predictionService = new PredictionService(prisma);
const riskAlertService = new RiskAlertService(prisma);

export async function intelligenceRoutes(fastify: FastifyInstance) {
  // === Outcome Routes ===

  // Record outcome (PROTECTED - requires authentication)
  fastify.post('/outcomes', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = request.body as any;
      const outcome = await outcomeService.recordOutcome(input);
      return reply.status(201).send(outcome);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Get outcome by ID
  fastify.get('/outcomes/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const outcome = await outcomeService.getOutcomeById(id);
      if (!outcome) {
        return reply.status(404).send({ error: 'Outcome not found' });
      }
      return reply.send(outcome);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get contract outcomes
  fastify.get(
    '/contracts/:contractId/outcomes',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { contractId } = request.params as { contractId: string };
        const outcomes = await outcomeService.getContractOutcomes(contractId);
        return reply.send(outcomes);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Get freelancer outcomes
  fastify.get(
    '/freelancers/:freelancerId/outcomes',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { freelancerId } = request.params as { freelancerId: string };
        const { outcomeType, rating, page, limit } = request.query as any;
        const result = await outcomeService.getFreelancerOutcomes(freelancerId, {
          outcomeType,
          rating,
          page: page ? Number.parseInt(page) : 1,
          limit: limit ? Number.parseInt(limit) : 20,
        });
        return reply.send(result);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Get client outcomes
  fastify.get(
    '/clients/:clientId/outcomes',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { clientId } = request.params as { clientId: string };
        const { outcomeType, rating, page, limit } = request.query as any;
        const result = await outcomeService.getClientOutcomes(clientId, {
          outcomeType,
          rating,
          page: page ? Number.parseInt(page) : 1,
          limit: limit ? Number.parseInt(limit) : 20,
        });
        return reply.send(result);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Get freelancer analytics
  fastify.get(
    '/freelancers/:freelancerId/analytics',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { freelancerId } = request.params as { freelancerId: string };
        const analytics = await outcomeService.getFreelancerAnalytics(freelancerId);
        return reply.send(analytics);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Get client analytics
  fastify.get(
    '/clients/:clientId/analytics',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { clientId } = request.params as { clientId: string };
        const analytics = await outcomeService.getClientAnalytics(clientId);
        return reply.send(analytics);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Get outcome statistics
  fastify.get('/outcomes/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { category, timeRange } = request.query as any;
      const stats = await outcomeService.getOutcomeStats({ category, timeRange });
      return reply.send(stats);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // === Prediction Routes ===

  // Generate prediction (PROTECTED - requires authentication)
  fastify.post('/predictions', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = request.body as any;
      const prediction = await predictionService.predictSuccess(input);
      return reply.status(201).send(prediction);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Get prediction for contract
  fastify.get(
    '/contracts/:contractId/prediction',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { contractId } = request.params as { contractId: string };
        const prediction = await predictionService.getPrediction(contractId);
        if (!prediction) {
          return reply.status(404).send({ error: 'Prediction not found' });
        }
        return reply.send(prediction);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Update prediction (PROTECTED - requires authentication)
  fastify.post(
    '/contracts/:contractId/prediction/refresh',
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { contractId } = request.params as { contractId: string };
        const prediction = await predictionService.updatePrediction(contractId);
        return reply.send(prediction);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Get freelancer predictions
  fastify.get(
    '/freelancers/:freelancerId/predictions',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { freelancerId } = request.params as { freelancerId: string };
        const { page, limit } = request.query as any;
        const result = await predictionService.getFreelancerPredictions(
          freelancerId,
          page ? Number.parseInt(page) : 1,
          limit ? Number.parseInt(limit) : 20
        );
        return reply.send(result);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Get client predictions
  fastify.get(
    '/clients/:clientId/predictions',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { clientId } = request.params as { clientId: string };
        const { page, limit } = request.query as any;
        const result = await predictionService.getClientPredictions(
          clientId,
          page ? Number.parseInt(page) : 1,
          limit ? Number.parseInt(limit) : 20
        );
        return reply.send(result);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // === Risk Alert Routes ===

  // Create alert (PROTECTED - requires authentication)
  fastify.post('/alerts', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = request.body as any;
      const alert = await riskAlertService.createAlert(input);
      return reply.status(201).send(alert);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Get alert by ID
  fastify.get('/alerts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const alert = await riskAlertService.getAlertById(id);
      if (!alert) {
        return reply.status(404).send({ error: 'Alert not found' });
      }
      return reply.send(alert);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get contract alerts
  fastify.get(
    '/contracts/:contractId/alerts',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { contractId } = request.params as { contractId: string };
        const { resolved, acknowledged, riskLevel } = request.query as any;
        const alerts = await riskAlertService.getContractAlerts(contractId, {
          resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
          acknowledged:
            acknowledged === 'true' ? true : acknowledged === 'false' ? false : undefined,
          riskLevel,
        });
        return reply.send(alerts);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Acknowledge alert (PROTECTED - requires authentication)
  fastify.post('/alerts/:id/acknowledge', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id: string };
      const alert = await riskAlertService.acknowledgeAlert(id, userId);
      return reply.send(alert);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Resolve alert (PROTECTED - requires authentication)
  fastify.post('/alerts/:id/resolve', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id: string };
      const { resolution } = request.body as { resolution: string };
      const alert = await riskAlertService.resolveAlert(id, userId, resolution);
      return reply.send(alert);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Analyze and generate alerts (PROTECTED - requires authentication)
  fastify.post(
    '/contracts/:contractId/analyze',
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { contractId } = request.params as { contractId: string };
        const metrics = request.body as any;
        const alerts = await riskAlertService.analyzeAndGenerateAlerts(contractId, metrics);
        return reply.send({ alerts });
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Get alert statistics
  fastify.get('/alerts/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { contractId } = request.query as { contractId?: string };
      const stats = await riskAlertService.getAlertStats(contractId);
      return reply.send(stats);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
