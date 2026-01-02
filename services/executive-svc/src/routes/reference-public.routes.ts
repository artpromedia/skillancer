/**
 * Reference Public Routes
 *
 * Public endpoints for reference submission (no auth required).
 * These are accessed via unique tokens sent in reference request emails.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as referenceService from '../services/reference-check.service.js';

// Validation schemas
const referenceResponseSchema = z.object({
  rating: z.number().min(1).max(10),
  wouldRecommend: z.boolean(),
  leadershipRating: z.number().min(1).max(10).optional(),
  technicalRating: z.number().min(1).max(10).optional(),
  communicationRating: z.number().min(1).max(10).optional(),
  strategicRating: z.number().min(1).max(10).optional(),
  strengths: z.array(z.string().min(2).max(200)).min(1).max(5),
  areasForGrowth: z.array(z.string().min(2).max(200)).max(3),
  comments: z.string().max(2000).optional(),
  additionalContext: z.string().max(1000).optional(),
});

export async function referencePublicRoutes(app: FastifyInstance): Promise<void> {
  // Get reference request details (for the reference submission form)
  app.get(
    '/:token',
    {
      schema: {
        tags: ['References (Public)'],
        summary: 'Get reference request details',
        description:
          'Get details to display on the reference submission form. No authentication required.',
        params: z.object({
          token: z.string().min(10),
        }),
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };

      const referenceRequest = await referenceService.getReferenceRequest(token);

      if (!referenceRequest) {
        return reply.status(404).send({
          error: 'Reference request not found',
          message: 'This reference link may have expired or already been completed.',
        });
      }

      return {
        executiveName: referenceRequest.executiveName,
        relationship: referenceRequest.relationship,
        context: referenceRequest.context,
        referenceName: referenceRequest.reference.name,
      };
    }
  );

  // Submit reference response
  app.post(
    '/:token',
    {
      schema: {
        tags: ['References (Public)'],
        summary: 'Submit reference response',
        description:
          'Submit a reference for an executive. No authentication required - uses secure token.',
        params: z.object({
          token: z.string().min(10),
        }),
        body: referenceResponseSchema,
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };
      const data = referenceResponseSchema.parse(request.body);

      try {
        await referenceService.submitReferenceResponse(
          token,
          data as unknown as Parameters<typeof referenceService.submitReferenceResponse>[1]
        );

        return {
          success: true,
          message: 'Thank you for submitting your reference! Your feedback is valuable.',
        };
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('expired')) {
            return reply.status(410).send({
              error: 'Link expired',
              message:
                'This reference link has expired. Please contact the executive for a new link.',
            });
          }
          if (error.message.includes('already been submitted')) {
            return reply.status(409).send({
              error: 'Already submitted',
              message: 'A reference has already been submitted for this request.',
            });
          }
        }
        throw error;
      }
    }
  );
}
