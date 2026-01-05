import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WorkRelationshipService } from '../services/work-relationship.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const relationshipService = new WorkRelationshipService(prisma);

export async function relationshipRoutes(fastify: FastifyInstance) {
  // Create relationship
  fastify.post('/relationships', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const input = request.body as any;
      const relationship = await relationshipService.createRelationship({ userId, ...input });

      return reply.status(201).send(relationship);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Get user's relationships
  fastify.get('/relationships', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { company, type, strength, verified, page, limit } = request.query as any;

      const result = await relationshipService.getUserRelationships(userId, {
        company,
        relationshipType: type,
        strength,
        verified: verified === 'true' ? true : verified === 'false' ? false : undefined,
        page: page ? Number.parseInt(page) : 1,
        limit: limit ? Number.parseInt(limit) : 50,
      });

      return reply.send(result);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get relationship by ID
  fastify.get('/relationships/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const relationship = await relationshipService.getRelationshipById(id);

      if (!relationship) {
        return reply.status(404).send({ error: 'Relationship not found' });
      }

      return reply.send(relationship);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update relationship
  fastify.patch('/relationships/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const input = request.body as any;

      const relationship = await relationshipService.updateRelationship(id, input);

      return reply.send(relationship);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Verify relationship
  fastify.post(
    '/relationships/:id/verify',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params as { id: string };
        const relationship = await relationshipService.verifyRelationship(id, userId);

        return reply.send(relationship);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Add endorsement
  fastify.post(
    '/relationships/:id/endorse',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params as { id: string };
        const { endorsement } = request.body as { endorsement: string };

        const relationship = await relationshipService.addEndorsement(id, endorsement, userId);

        return reply.send(relationship);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Delete relationship
  fastify.delete('/relationships/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id: string };
      await relationshipService.deleteRelationship(id, userId);

      return reply.status(204).send();
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Get network stats
  fastify.get('/network/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const stats = await relationshipService.getNetworkStats(userId);

      return reply.send(stats);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get mutual connections
  fastify.get(
    '/network/mutual/:targetUserId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { targetUserId } = request.params as { targetUserId: string };
        const mutualConnections = await relationshipService.getMutualConnections(
          userId,
          targetUserId
        );

        return reply.send(mutualConnections);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Get connection suggestions
  fastify.get('/network/suggestions', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { limit } = request.query as { limit?: string };
      const suggestions = await relationshipService.getConnectionSuggestions(
        userId,
        limit ? Number.parseInt(limit) : 10
      );

      return reply.send(suggestions);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
