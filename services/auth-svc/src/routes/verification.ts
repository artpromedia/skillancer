/**
 * @module @skillancer/auth-svc/routes/verification
 * Identity Verification Routes
 *
 * Endpoints for:
 * - Starting verification inquiries
 * - Checking verification status
 * - Getting verification history
 * - Webhook handling
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { prisma } from '@skillancer/database';
import { z } from 'zod';

import { authMiddleware, requireRole } from '../middleware/auth.js';
import { getPersonaService } from '../services/persona.service.js';
import { createVerificationService, VerificationError } from '../services/verification.service.js';

import type { FastifyPluginAsync } from 'fastify';

// =============================================================================
// SCHEMAS
// =============================================================================

const startVerificationSchema = z.object({
  verificationType: z.enum(['BASIC', 'ENHANCED', 'PREMIUM']),
  redirectUri: z.string().url().optional(),
});

const inquiryIdParamsSchema = z.object({
  inquiryId: z.string().uuid(),
});

const approveInquirySchema = z.object({
  notes: z.string().max(1000).optional(),
});

const declineInquirySchema = z.object({
  reasons: z.array(z.string()).min(1),
  notes: z.string().max(1000).optional(),
});

const revokeBadgeSchema = z.object({
  reason: z.string().min(1).max(500),
});

// =============================================================================
// ROUTES
// =============================================================================

const verificationRoutes: FastifyPluginAsync = async (fastify) => {
  await Promise.resolve();
  const verificationService = createVerificationService(prisma);

  // ===========================================================================
  // CHECK CONFIGURATION
  // ===========================================================================

  /**
   * GET /verification/status
   * Check if identity verification is available
   */
  fastify.get('/status', async (_request, reply) => {
    const personaService = getPersonaService();
    const isConfigured = personaService.isConfigured();

    return reply.send({
      available: isConfigured,
      types: isConfigured ? ['BASIC', 'ENHANCED', 'PREMIUM'] : [],
    });
  });

  // ===========================================================================
  // USER VERIFICATION ENDPOINTS
  // ===========================================================================

  /**
   * POST /verification/start
   * Start a new verification inquiry
   * Requires authentication
   */
  fastify.post(
    '/start',
    {
      preHandler: [authMiddleware],
    },
    async (request, reply) => {
      const body = startVerificationSchema.parse(request.body);
      const userId = request.user!.id;

      // Check if user can start verification
      const canStart = await verificationService.canStartVerification(
        userId,
        body.verificationType
      );

      if (!canStart.canStart) {
        return reply.status(400).send({
          error: 'VERIFICATION_NOT_ALLOWED',
          message: canStart.reason,
          cooldownUntil: canStart.cooldownUntil,
        });
      }

      try {
        const startOptions: {
          userId: string;
          verificationType: 'BASIC' | 'ENHANCED' | 'PREMIUM';
          redirectUri?: string;
        } = {
          userId,
          verificationType: body.verificationType,
        };

        if (body.redirectUri) {
          startOptions.redirectUri = body.redirectUri;
        }

        const result = await verificationService.startVerification(startOptions);

        return await reply.status(201).send({
          inquiryId: result.inquiryId,
          personaInquiryId: result.personaInquiryId,
          sessionToken: result.sessionToken,
          verificationType: result.verificationType,
          expiresAt: result.expiresAt.toISOString(),
          message:
            'Verification inquiry created. Use the session token to launch the Persona flow.',
        });
      } catch (error) {
        if (error instanceof VerificationError) {
          return reply.status(400).send({
            error: error.code,
            message: error.message,
          });
        }
        throw error;
      }
    }
  );

  /**
   * GET /verification/inquiry/:inquiryId
   * Get verification status for a specific inquiry
   * Requires authentication
   */
  fastify.get<{
    Params: { inquiryId: string };
  }>(
    '/inquiry/:inquiryId',
    {
      preHandler: [authMiddleware],
    },
    async (request, reply) => {
      const { inquiryId } = inquiryIdParamsSchema.parse(request.params);
      const userId = request.user!.id;

      const status = await verificationService.getVerificationStatus(inquiryId, userId);

      if (!status) {
        return reply.status(404).send({
          error: 'INQUIRY_NOT_FOUND',
          message: 'Verification inquiry not found',
        });
      }

      return reply.send(status);
    }
  );

  /**
   * GET /verification/history
   * Get user's verification history and badges
   * Requires authentication
   */
  fastify.get(
    '/history',
    {
      preHandler: [authMiddleware],
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const history = await verificationService.getVerificationHistory(userId);
      return reply.send(history);
    }
  );

  /**
   * POST /verification/inquiry/:inquiryId/resume
   * Resume an existing verification inquiry
   * Requires authentication
   */
  fastify.post<{
    Params: { inquiryId: string };
  }>(
    '/inquiry/:inquiryId/resume',
    {
      preHandler: [authMiddleware],
    },
    async (request, reply) => {
      const { inquiryId } = inquiryIdParamsSchema.parse(request.params);
      const userId = request.user!.id;
      const personaService = getPersonaService();

      // Get the inquiry
      const inquiry = await prisma.verificationInquiry.findFirst({
        where: {
          id: inquiryId,
          userId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      });

      if (!inquiry) {
        return reply.status(404).send({
          error: 'INQUIRY_NOT_FOUND',
          message: 'Active verification inquiry not found',
        });
      }

      // Check if expired
      if (inquiry.expiresAt && inquiry.expiresAt < new Date()) {
        await prisma.verificationInquiry.update({
          where: { id: inquiry.id },
          data: { status: 'EXPIRED' },
        });

        return reply.status(400).send({
          error: 'INQUIRY_EXPIRED',
          message: 'Verification inquiry has expired. Please start a new one.',
        });
      }

      // Resume in Persona
      const resumeResult = await personaService.resumeInquiry(inquiry.personaInquiryId);

      return reply.send({
        inquiryId: inquiry.id,
        personaInquiryId: inquiry.personaInquiryId,
        sessionToken: resumeResult.meta?.['session-token'],
        expiresAt: inquiry.expiresAt?.toISOString(),
      });
    }
  );

  /**
   * DELETE /verification/inquiry/:inquiryId
   * Cancel a pending verification inquiry
   * Requires authentication
   */
  fastify.delete<{
    Params: { inquiryId: string };
  }>(
    '/inquiry/:inquiryId',
    {
      preHandler: [authMiddleware],
    },
    async (request, reply) => {
      const { inquiryId } = inquiryIdParamsSchema.parse(request.params);
      const userId = request.user!.id;
      const personaService = getPersonaService();

      const inquiry = await prisma.verificationInquiry.findFirst({
        where: {
          id: inquiryId,
          userId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      });

      if (!inquiry) {
        return reply.status(404).send({
          error: 'INQUIRY_NOT_FOUND',
          message: 'Active verification inquiry not found',
        });
      }

      // Expire in Persona
      await personaService.expireInquiry(inquiry.personaInquiryId);

      // Update local status
      await prisma.verificationInquiry.update({
        where: { id: inquiry.id },
        data: {
          status: 'CANCELLED',
          completedAt: new Date(),
        },
      });

      return reply.status(204).send();
    }
  );

  // ===========================================================================
  // ADMIN REVIEW ENDPOINTS
  // ===========================================================================

  /**
   * GET /verification/admin/pending-review
   * Get all inquiries pending review
   * Requires admin role
   */
  fastify.get(
    '/admin/pending-review',
    {
      preHandler: [authMiddleware, requireRole(['admin', 'compliance'])],
    },
    async (_request, reply) => {
      const inquiries = await prisma.verificationInquiry.findMany({
        where: { status: 'NEEDS_REVIEW' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          documents: true,
        },
        orderBy: { initiatedAt: 'asc' },
      });

      return reply.send({ inquiries });
    }
  );

  /**
   * POST /verification/admin/inquiry/:inquiryId/approve
   * Approve an inquiry pending review
   * Requires admin role
   */
  fastify.post<{
    Params: { inquiryId: string };
  }>(
    '/admin/inquiry/:inquiryId/approve',
    {
      preHandler: [authMiddleware, requireRole(['admin', 'compliance'])],
    },
    async (request, reply) => {
      const { inquiryId } = inquiryIdParamsSchema.parse(request.params);
      const body = approveInquirySchema.parse(request.body ?? {});
      const reviewerId = request.user!.id;

      try {
        await verificationService.approveInquiry(inquiryId, reviewerId, body.notes);
        return await reply.send({ success: true, message: 'Inquiry approved' });
      } catch (error) {
        if (error instanceof VerificationError) {
          return reply.status(400).send({
            error: error.code,
            message: error.message,
          });
        }
        throw error;
      }
    }
  );

  /**
   * POST /verification/admin/inquiry/:inquiryId/decline
   * Decline an inquiry pending review
   * Requires admin role
   */
  fastify.post<{
    Params: { inquiryId: string };
  }>(
    '/admin/inquiry/:inquiryId/decline',
    {
      preHandler: [authMiddleware, requireRole(['admin', 'compliance'])],
    },
    async (request, reply) => {
      const { inquiryId } = inquiryIdParamsSchema.parse(request.params);
      const body = declineInquirySchema.parse(request.body);
      const reviewerId = request.user!.id;

      try {
        await verificationService.declineInquiry(inquiryId, reviewerId, body.reasons, body.notes);
        return await reply.send({ success: true, message: 'Inquiry declined' });
      } catch (error) {
        if (error instanceof VerificationError) {
          return reply.status(400).send({
            error: error.code,
            message: error.message,
          });
        }
        throw error;
      }
    }
  );

  /**
   * POST /verification/admin/badge/:badgeId/revoke
   * Revoke a user's verification badge
   * Requires admin role
   */
  fastify.post<{
    Params: { badgeId: string };
  }>(
    '/admin/badge/:badgeId/revoke',
    {
      preHandler: [authMiddleware, requireRole(['admin', 'compliance'])],
    },
    async (request, reply) => {
      const { badgeId } = z.object({ badgeId: z.string().uuid() }).parse(request.params);
      const body = revokeBadgeSchema.parse(request.body);
      const revokedBy = request.user!.id;

      try {
        await verificationService.revokeBadge(badgeId, body.reason, revokedBy);
        return await reply.send({ success: true, message: 'Badge revoked' });
      } catch (error) {
        if (error instanceof VerificationError) {
          return reply.status(400).send({
            error: error.code,
            message: error.message,
          });
        }
        throw error;
      }
    }
  );

  /**
   * GET /verification/admin/user/:userId
   * Get verification history for a specific user (admin view)
   * Requires admin role
   */
  fastify.get<{
    Params: { userId: string };
  }>(
    '/admin/user/:userId',
    {
      preHandler: [authMiddleware, requireRole(['admin', 'compliance', 'support'])],
    },
    async (request, reply) => {
      const { userId } = z.object({ userId: z.string().uuid() }).parse(request.params);
      const history = await verificationService.getVerificationHistory(userId);
      return reply.send(history);
    }
  );
};

export { verificationRoutes };
export default verificationRoutes;
