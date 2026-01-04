/**
 * Vetting Routes
 *
 * API endpoints for executive vetting workflow.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as vettingService from '../services/vetting-pipeline.service.js';
import * as referenceService from '../services/reference-check.service.js';
import * as profileService from '../services/executive-profile.service.js';

// Validation schemas
const addReferenceSchema = z.object({
  name: z.string().min(2).max(100),
  title: z.string().min(2).max(100),
  company: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  linkedinUrl: z.string().url().optional(),
  relationship: z.enum([
    'REPORTED_TO',
    'PEER',
    'DIRECT_REPORT',
    'CLIENT',
    'BOARD_MEMBER',
    'INVESTOR',
  ]),
  yearsKnown: z.number().min(1).max(40),
  workedTogetherAt: z.string().optional(),
});

export async function vettingRoutes(app: FastifyInstance): Promise<void> {
  // Get vetting status for current user
  app.get(
    '/status',
    {
      onRequest: [app.requireAuth],
      schema: {
        tags: ['Vetting'],
        summary: 'Get my vetting status',
      } as any,
    },
    async (request, reply) => {
      const userId = request.user!.id;

      const profile = await profileService.getExecutiveByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: 'Executive profile not found' });
      }

      const details = await vettingService.getVettingDetails(profile.id);

      return details;
    }
  );

  // Get vetting timeline/events
  app.get(
    '/timeline',
    {
      onRequest: [app.requireAuth],
      schema: {
        tags: ['Vetting'],
        summary: 'Get my vetting timeline',
      } as any,
    },
    async (request, reply) => {
      const userId = request.user!.id;

      const profile = await profileService.getExecutiveByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: 'Executive profile not found' });
      }

      const details = await vettingService.getVettingDetails(profile.id);

      return details.vettingEvents || [];
    }
  );

  // Add reference
  app.post(
    '/references',
    {
      onRequest: [app.requireAuth],
      schema: {
        tags: ['Vetting'],
        summary: 'Add a reference',
        body: { type: 'object' },
      } as any,
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const data = addReferenceSchema.parse(request.body);

      const profile = await profileService.getExecutiveByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: 'Executive profile not found' });
      }

      const reference = await referenceService.addReference({
        executiveId: profile.id,
        name: data.name,
        title: data.title,
        company: data.company,
        email: data.email,
        phone: data.phone,
        linkedinUrl: data.linkedinUrl,
        relationship: data.relationship as any,
        yearsKnown: data.yearsKnown,
        workedTogetherAt: data.workedTogetherAt,
      });

      return reply.status(201).send(reference);
    }
  );

  // Get my references
  app.get(
    '/references',
    {
      onRequest: [app.requireAuth],
      schema: {
        tags: ['Vetting'],
        summary: 'Get my references',
      } as any,
    },
    async (request, reply) => {
      const userId = request.user!.id;

      const profile = await profileService.getExecutiveByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: 'Executive profile not found' });
      }

      const references = await referenceService.getExecutiveReferences(profile.id);

      return references;
    }
  );

  // Request a reference (send email)
  app.post(
    '/references/:referenceId/request',
    {
      onRequest: [app.requireAuth],
      schema: {
        tags: ['Vetting'],
        summary: 'Request reference (send email)',
        params: { type: 'object' },
      },
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const { referenceId } = request.params as { referenceId: string };

      const profile = await profileService.getExecutiveByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: 'Executive profile not found' });
      }

      const reference = await referenceService.requestReference(referenceId);

      return reference;
    }
  );

  // Delete a reference (only if not yet requested)
  app.delete(
    '/references/:referenceId',
    {
      onRequest: [app.requireAuth],
      schema: {
        tags: ['Vetting'],
        summary: 'Delete a reference',
        params: { type: 'object' },
      },
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const { referenceId } = request.params as { referenceId: string };

      const profile = await profileService.getExecutiveByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: 'Executive profile not found' });
      }

      await referenceService.deleteReference(referenceId, profile.id);

      return reply.status(204).send();
    }
  );

  // Get interview details
  app.get(
    '/interview',
    {
      onRequest: [app.requireAuth],
      schema: {
        tags: ['Vetting'],
        summary: 'Get scheduled interview details',
      } as any,
    },
    async (request, reply) => {
      const userId = request.user!.id;

      const profile = await profileService.getExecutiveByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: 'Executive profile not found' });
      }

      const details = await vettingService.getVettingDetails(profile.id);

      // Find upcoming interview
      const upcomingInterview = details.interviews?.find(
        (i: any) => i.status === 'SCHEDULED' && new Date(i.scheduledAt) > new Date()
      );

      if (!upcomingInterview) {
        return reply.status(404).send({ error: 'No upcoming interview found' });
      }

      return upcomingInterview;
    }
  );

  // Withdraw application
  app.post(
    '/withdraw',
    {
      onRequest: [app.requireAuth],
      schema: {
        tags: ['Vetting'],
        summary: 'Withdraw my application',
      } as any,
    },
    async (request, reply) => {
      const userId = request.user!.id;

      const profile = await profileService.getExecutiveByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: 'Executive profile not found' });
      }

      if (profile.vettingStatus === 'APPROVED') {
        return reply.status(400).send({ error: 'Cannot withdraw an approved profile' });
      }

      await vettingService.rejectExecutive(
        profile.id,
        profile.vettingStage,
        'Application withdrawn by executive'
      );

      return { message: 'Application withdrawn successfully' };
    }
  );
}
