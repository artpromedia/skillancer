import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TeamReunionService } from '../services/team-reunion.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const teamReunionService = new TeamReunionService(prisma);

export async function teamReunionRoutes(fastify: FastifyInstance) {
  // Create team reunion
  fastify.post('/team-reunions', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const input = request.body as any;
      const reunion = await teamReunionService.createTeamReunion({
        creatorId: userId,
        ...input,
      });

      return reply.status(201).send(reunion);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Get team reunion by ID
  fastify.get('/team-reunions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const reunion = await teamReunionService.getTeamReunionById(id);

      if (!reunion) {
        return reply.status(404).send({ error: 'Team reunion not found' });
      }

      return reply.send(reunion);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Invite member
  fastify.post(
    '/team-reunions/:id/invite',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params as { id: string };
        const input = request.body as any;

        const membership = await teamReunionService.inviteMember(
          { teamReunionId: id, ...input },
          userId
        );

        return reply.status(201).send(membership);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Respond to invitation
  fastify.post(
    '/team-reunions/:id/respond',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params as { id: string };
        const { accept, message } = request.body as { accept: boolean; message?: string };

        const membership = await teamReunionService.respondToInvitation(
          id,
          userId,
          accept,
          message
        );

        return reply.send(membership);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Confirm participation
  fastify.post(
    '/team-reunions/:id/confirm',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params as { id: string };
        const { role } = request.body as { role?: string };

        const membership = await teamReunionService.confirmParticipation(id, userId, role);

        return reply.send(membership);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Activate reunion
  fastify.post(
    '/team-reunions/:id/activate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params as { id: string };
        const reunion = await teamReunionService.activateReunion(id, userId);

        return reply.send(reunion);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Complete reunion
  fastify.post(
    '/team-reunions/:id/complete',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params as { id: string };
        const reunion = await teamReunionService.completeReunion(id, userId);

        return reply.send(reunion);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Get user's team reunions
  fastify.get('/team-reunions', async (request: FastifyRequest, reply: FastifyReply) => {
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

      const result = await teamReunionService.getUserTeamReunions(
        userId,
        status as any,
        page ? parseInt(page) : 1,
        limit ? parseInt(limit) : 20
      );

      return reply.send(result);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get pending invitations
  fastify.get(
    '/team-reunions/invitations/pending',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const invitations = await teamReunionService.getPendingInvitations(userId);

        return reply.send(invitations);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Suggest colleagues for reunion
  fastify.get(
    '/team-reunions/suggest-colleagues',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { company, limit } = request.query as { company: string; limit?: string };

        if (!company) {
          return reply.status(400).send({ error: 'Company is required' });
        }

        const suggestions = await teamReunionService.suggestColleagues(
          userId,
          company,
          limit ? parseInt(limit) : 10
        );

        return reply.send(suggestions);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Cancel reunion
  fastify.post(
    '/team-reunions/:id/cancel',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params as { id: string };
        const { reason } = request.body as { reason?: string };

        const reunion = await teamReunionService.cancelReunion(id, userId, reason);

        return reply.send(reunion);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Leave reunion
  fastify.post('/team-reunions/:id/leave', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id: string };
      await teamReunionService.leaveReunion(id, userId);

      return reply.status(204).send();
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });
}
