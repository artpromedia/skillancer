import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ExecutiveProfileService } from '../services/executive-profile.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const executiveProfileService = new ExecutiveProfileService(prisma);

export async function executiveProfileRoutes(fastify: FastifyInstance) {
  // Create executive profile
  fastify.post('/profile', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const input = request.body as any;
      const profile = await executiveProfileService.createProfile({
        userId,
        ...input,
      });

      return reply.status(201).send(profile);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Get current user's executive profile
  fastify.get('/profile/me', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const profile = await executiveProfileService.getProfileByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: 'Executive profile not found' });
      }

      return reply.send(profile);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get executive profile by ID
  fastify.get('/profile/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const profile = await executiveProfileService.getProfileById(id);

      if (!profile) {
        return reply.status(404).send({ error: 'Executive profile not found' });
      }

      // Increment view count
      await executiveProfileService.incrementProfileViews(id);

      return reply.send(profile);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update executive profile
  fastify.patch('/profile', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const input = request.body as any;
      const profile = await executiveProfileService.updateProfile(userId, input);

      return reply.send(profile);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Search executives
  fastify.get('/search', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const filters = {
        executiveType: query.executiveType,
        industries: query.industries ? query.industries.split(',') : undefined,
        specializations: query.specializations ? query.specializations.split(',') : undefined,
        companyStages: query.companyStages ? query.companyStages.split(',') : undefined,
        minExperience: query.minExperience ? parseInt(query.minExperience) : undefined,
        maxHourlyRate: query.maxHourlyRate ? parseFloat(query.maxHourlyRate) : undefined,
        maxMonthlyRetainer: query.maxMonthlyRetainer ? parseFloat(query.maxMonthlyRetainer) : undefined,
        availableNow: query.availableNow === 'true',
        hasBackgroundCheck: query.hasBackgroundCheck === 'true',
        boardExperience: query.boardExperience === 'true',
        publicCompanyExp: query.publicCompanyExp === 'true',
      };

      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 20;

      const result = await executiveProfileService.searchExecutives(filters, page, limit);

      return reply.send(result);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get featured executives
  fastify.get('/featured', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { limit } = request.query as { limit?: string };
      const executives = await executiveProfileService.getFeaturedExecutives(
        limit ? parseInt(limit) : 10
      );

      return reply.send(executives);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Add reference
  fastify.post('/profile/references', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const profile = await executiveProfileService.getProfileByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: 'Executive profile not found' });
      }

      const input = request.body as any;
      const reference = await executiveProfileService.addReference(profile.id, input);

      return reply.status(201).send(reference);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Get executive statistics (admin)
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await executiveProfileService.getExecutiveStats();
      return reply.send(stats);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Admin: Get pending vetting
  fastify.get('/admin/pending-vetting', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { page, limit } = request.query as { page?: string; limit?: string };
      const result = await executiveProfileService.getPendingVetting(
        page ? parseInt(page) : 1,
        limit ? parseInt(limit) : 20
      );

      return reply.send(result);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Admin: Update vetting status
  fastify.patch('/admin/vetting/:profileId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { profileId } = request.params as { profileId: string };
      const decision = request.body as any;

      const profile = await executiveProfileService.updateVettingStatus(profileId, decision);

      return reply.send(profile);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Admin: Verify reference
  fastify.patch('/admin/references/:referenceId/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { referenceId } = request.params as { referenceId: string };
      const { verified, notes, rating } = request.body as any;

      const reference = await executiveProfileService.verifyReference(
        referenceId,
        verified,
        notes,
        rating
      );

      return reply.send(reference);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Admin: Start background check
  fastify.post('/admin/background-check/:profileId/start', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { profileId } = request.params as { profileId: string };
      const profile = await executiveProfileService.startBackgroundCheck(profileId);

      return reply.send(profile);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Admin: Complete background check
  fastify.post('/admin/background-check/:profileId/complete', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { profileId } = request.params as { profileId: string };
      const { passed } = request.body as { passed: boolean };

      const profile = await executiveProfileService.completeBackgroundCheck(profileId, passed);

      return reply.send(profile);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Admin: Set featured status
  fastify.patch('/admin/featured/:profileId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { profileId } = request.params as { profileId: string };
      const { featured } = request.body as { featured: boolean };

      const profile = await executiveProfileService.setFeaturedStatus(profileId, featured);

      return reply.send(profile);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });
}
