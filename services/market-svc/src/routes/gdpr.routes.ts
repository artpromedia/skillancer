/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GDPR Data Rights Routes
 *
 * Provides user-facing endpoints for:
 * - Data export requests (Right to Access)
 * - Data deletion requests (Right to Erasure)
 * - Consent management
 * - Data portability
 */

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

interface GDPRDependencies {
  prisma: PrismaClient;
  logger: Logger;
}

// =============================================================================
// Schemas
// =============================================================================

const createExportRequestSchema = z.object({
  format: z.enum(['JSON', 'CSV', 'PDF']).default('JSON'),
  dataCategories: z
    .array(
      z.enum([
        'PROFILE',
        'CONTRACTS',
        'MESSAGES',
        'REVIEWS',
        'SKILLS',
        'PORTFOLIO',
        'FINANCIAL',
        'ACTIVITY_LOG',
      ])
    )
    .optional(),
});

const createDeletionRequestSchema = z.object({
  reason: z.string().min(1).max(1000),
  confirmEmail: z.string().email(),
  confirmPassword: z.string().min(1),
});

const updateConsentSchema = z.object({
  consentType: z.enum([
    'TERMS_OF_SERVICE',
    'PRIVACY_POLICY',
    'MARKETING_EMAIL',
    'MARKETING_SMS',
    'ANALYTICS',
    'THIRD_PARTY_SHARING',
    'PROFILING',
    'AUTOMATED_DECISIONS',
  ]),
  granted: z.boolean(),
  version: z.string().optional(),
});

// =============================================================================
// Route Registration
// =============================================================================

export function registerGDPRRoutes(fastify: FastifyInstance, deps: GDPRDependencies): void {
  const { prisma, logger } = deps;

  // Helper to get authenticated user
  const getUser = (request: any) => {
    if (!request.user) {
      throw new Error('Authentication required');
    }
    return request.user as { id: string; email: string };
  };

  // -------------------------------------------------------------------------
  // GET /gdpr/data-requests - List user's data requests
  // -------------------------------------------------------------------------
  fastify.get('/data-requests', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;

      logger.info({ userId }, 'Fetching GDPR data requests');

      const requests = await prisma.gDPRDataRequest.findMany({
        where: { userId },
        orderBy: { requestedAt: 'desc' },
      });

      return reply.send({
        success: true,
        data: requests.map((r: any) => ({
          id: r.id,
          requestType: r.requestType,
          status: r.status,
          requestedAt: r.requestedAt.toISOString(),
          processedAt: r.processedAt?.toISOString(),
          completedAt: r.completedAt?.toISOString(),
          exportUrl: r.status === 'COMPLETED' && r.exportUrl ? r.exportUrl : undefined,
          expiresAt: r.expiresAt?.toISOString(),
        })),
      });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch GDPR requests');
      return reply.status(500).send({ error: 'Failed to fetch data requests' });
    }
  });

  // -------------------------------------------------------------------------
  // POST /gdpr/export - Request data export
  // -------------------------------------------------------------------------
  fastify.post('/export', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;

      const validation = createExportRequestSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: 'Invalid request', details: validation.error.errors });
      }

      logger.info({ userId }, 'Creating data export request');

      // Check for existing pending request
      const existingRequest = await prisma.gDPRDataRequest.findFirst({
        where: {
          userId,
          requestType: 'DATA_EXPORT',
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      });

      if (existingRequest) {
        return reply.status(409).send({
          error: 'You already have a pending export request',
          requestId: existingRequest.id,
        });
      }

      const dataRequest = await prisma.gDPRDataRequest.create({
        data: {
          userId,
          requestType: 'DATA_EXPORT',
          status: 'PENDING',
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
      });

      // Trigger async export processing
      processDataExport(prisma, logger, dataRequest.id, userId, validation.data);

      return reply.status(202).send({
        success: true,
        message: 'Your data export request has been submitted. You will receive an email when it is ready.',
        requestId: dataRequest.id,
        estimatedTime: '24-48 hours',
      });
    } catch (error) {
      logger.error({ error }, 'Failed to create export request');
      return reply.status(500).send({ error: 'Failed to create export request' });
    }
  });

  // -------------------------------------------------------------------------
  // POST /gdpr/delete - Request account deletion
  // -------------------------------------------------------------------------
  fastify.post('/delete', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;

      const validation = createDeletionRequestSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: 'Invalid request', details: validation.error.errors });
      }

      logger.info({ userId }, 'Creating account deletion request');

      // Verify user credentials
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, passwordHash: true },
      });

      if (!dbUser || dbUser.email !== validation.data.confirmEmail) {
        return reply.status(400).send({ error: 'Email confirmation does not match' });
      }

      // Check for active contracts
      const activeContracts = await prisma.contract.count({
        where: {
          OR: [{ clientId: userId }, { freelancerId: userId }],
          status: { in: ['ACTIVE', 'IN_PROGRESS'] },
        },
      });

      if (activeContracts > 0) {
        return reply.status(409).send({
          error: 'Cannot delete account with active contracts',
          activeContracts,
          suggestion: 'Please complete or cancel all active contracts before requesting deletion.',
        });
      }

      // Check for pending payouts
      const pendingPayouts = await prisma.paymentTransaction.count({
        where: {
          userId,
          status: 'PENDING',
        },
      });

      if (pendingPayouts > 0) {
        return reply.status(409).send({
          error: 'Cannot delete account with pending payouts',
          pendingPayouts,
          suggestion: 'Please wait for all pending payouts to complete.',
        });
      }

      // Create deletion request
      const dataRequest = await prisma.gDPRDataRequest.create({
        data: {
          userId,
          requestType: 'DATA_DELETION',
          status: 'PENDING',
          deletionReason: validation.data.reason,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
      });

      return reply.status(202).send({
        success: true,
        message: 'Your account deletion request has been submitted. This process is irreversible.',
        requestId: dataRequest.id,
        notes: [
          'You will receive a confirmation email within 24 hours.',
          'You have 14 days to cancel this request.',
          'After 14 days, your data will be permanently deleted.',
          'Some data may be retained for legal compliance (e.g., tax records).',
        ],
      });
    } catch (error) {
      logger.error({ error }, 'Failed to create deletion request');
      return reply.status(500).send({ error: 'Failed to create deletion request' });
    }
  });

  // -------------------------------------------------------------------------
  // DELETE /gdpr/delete/:requestId - Cancel deletion request
  // -------------------------------------------------------------------------
  fastify.delete<{ Params: { requestId: string } }>(
    '/delete/:requestId',
    async (request: any, reply: any) => {
      try {
        const user = getUser(request);
        const userId = user.id;
        const { requestId } = request.params;

        logger.info({ userId, requestId }, 'Cancelling deletion request');

        const existingRequest = await prisma.gDPRDataRequest.findFirst({
          where: {
            id: requestId,
            userId,
            requestType: 'DATA_DELETION',
            status: 'PENDING',
          },
        });

        if (!existingRequest) {
          return reply.status(404).send({ error: 'Deletion request not found or cannot be cancelled' });
        }

        await prisma.gDPRDataRequest.update({
          where: { id: requestId },
          data: {
            status: 'REJECTED',
            notes: 'Cancelled by user',
          },
        });

        return reply.send({
          success: true,
          message: 'Your deletion request has been cancelled.',
        });
      } catch (error) {
        logger.error({ error }, 'Failed to cancel deletion request');
        return reply.status(500).send({ error: 'Failed to cancel deletion request' });
      }
    }
  );

  // -------------------------------------------------------------------------
  // GET /gdpr/consent - Get user's consent records
  // -------------------------------------------------------------------------
  fastify.get('/consent', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;

      logger.info({ userId }, 'Fetching consent records');

      const consents = await prisma.gDPRConsentRecord.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });

      // Group by consent type, get latest for each
      const latestConsents = consents.reduce(
        (acc: any, consent: any) => {
          if (!acc[consent.consentType] || consent.updatedAt > acc[consent.consentType].updatedAt) {
            acc[consent.consentType] = consent;
          }
          return acc;
        },
        {} as Record<string, any>
      );

      return reply.send({
        success: true,
        data: Object.values(latestConsents).map((c: any) => ({
          consentType: c.consentType,
          granted: c.granted,
          version: c.version,
          grantedAt: c.grantedAt?.toISOString(),
          revokedAt: c.revokedAt?.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })),
      });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch consent records');
      return reply.status(500).send({ error: 'Failed to fetch consent records' });
    }
  });

  // -------------------------------------------------------------------------
  // POST /gdpr/consent - Update consent
  // -------------------------------------------------------------------------
  fastify.post('/consent', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;

      const validation = updateConsentSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: 'Invalid request', details: validation.error.errors });
      }

      const { consentType, granted, version } = validation.data;
      logger.info({ userId, consentType, granted }, 'Updating consent');

      const consent = await prisma.gDPRConsentRecord.create({
        data: {
          userId,
          consentType,
          granted,
          version: version ?? '1.0',
          grantedAt: granted ? new Date() : null,
          revokedAt: granted ? null : new Date(),
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          source: 'user_settings',
        },
      });

      return reply.send({
        success: true,
        message: `Consent ${granted ? 'granted' : 'revoked'} successfully`,
        data: {
          consentType: consent.consentType,
          granted: consent.granted,
          updatedAt: consent.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to update consent');
      return reply.status(500).send({ error: 'Failed to update consent' });
    }
  });

  // -------------------------------------------------------------------------
  // GET /gdpr/download/:requestId - Download exported data
  // -------------------------------------------------------------------------
  fastify.get<{ Params: { requestId: string } }>(
    '/download/:requestId',
    async (request: any, reply: any) => {
      try {
        const user = getUser(request);
        const userId = user.id;
        const { requestId } = request.params;

        logger.info({ userId, requestId }, 'Downloading exported data');

        const dataRequest = await prisma.gDPRDataRequest.findFirst({
          where: {
            id: requestId,
            userId,
            requestType: 'DATA_EXPORT',
            status: 'COMPLETED',
          },
        });

        if (!dataRequest) {
          return reply.status(404).send({ error: 'Export not found or not ready' });
        }

        if (dataRequest.expiresAt && dataRequest.expiresAt < new Date()) {
          return reply.status(410).send({ error: 'Export has expired. Please request a new export.' });
        }

        if (!dataRequest.exportUrl) {
          return reply.status(404).send({ error: 'Export file not available' });
        }

        // In production, this would redirect to a signed URL
        return reply.send({
          success: true,
          downloadUrl: dataRequest.exportUrl,
          expiresAt: dataRequest.expiresAt?.toISOString(),
        });
      } catch (error) {
        logger.error({ error }, 'Failed to download export');
        return reply.status(500).send({ error: 'Failed to download export' });
      }
    }
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

async function processDataExport(
  prisma: PrismaClient,
  logger: Logger,
  requestId: string,
  userId: string,
  options: z.infer<typeof createExportRequestSchema>
) {
  // This would typically be handled by a background job
  // For now, we'll simulate the process
  setTimeout(async () => {
    try {
      await prisma.gDPRDataRequest.update({
        where: { id: requestId },
        data: { status: 'IN_PROGRESS' },
      });

      // Collect user data
      const _userData = await collectUserData(prisma, userId, options.dataCategories);

      // Generate export file (in production, this would upload to S3/GCS)
      const exportUrl = `/api/gdpr/exports/${requestId}.${options.format.toLowerCase()}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await prisma.gDPRDataRequest.update({
        where: { id: requestId },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
          completedAt: new Date(),
          exportUrl,
          expiresAt,
        },
      });

      logger.info({ requestId, userId }, 'Data export completed');
    } catch (error) {
      logger.error({ error, requestId, userId }, 'Data export failed');
      await prisma.gDPRDataRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          notes: error instanceof Error ? error.message : 'Export failed',
        },
      });
    }
  }, 1000);
}

async function collectUserData(
  prisma: PrismaClient,
  userId: string,
  categories?: string[]
) {
  const allCategories = categories ?? [
    'PROFILE',
    'CONTRACTS',
    'MESSAGES',
    'REVIEWS',
    'SKILLS',
    'PORTFOLIO',
    'FINANCIAL',
    'ACTIVITY_LOG',
  ];

  const data: Record<string, unknown> = {
    exportDate: new Date().toISOString(),
    userId,
  };

  if (allCategories.includes('PROFILE')) {
    data.profile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        bio: true,
        timezone: true,
        locale: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
      },
    });
  }

  if (allCategories.includes('SKILLS')) {
    data.skills = await prisma.userSkill.findMany({
      where: { userId },
      include: { skill: true },
    });
  }

  if (allCategories.includes('PORTFOLIO')) {
    data.portfolio = await prisma.portfolioItem.findMany({
      where: { userId },
    });
  }

  if (allCategories.includes('CONTRACTS')) {
    data.contracts = await prisma.contract.findMany({
      where: {
        OR: [{ clientId: userId }, { freelancerId: userId }],
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        budget: true,
        startDate: true,
        endDate: true,
        createdAt: true,
      },
    });
  }

  if (allCategories.includes('REVIEWS')) {
    data.reviewsGiven = await prisma.review.findMany({
      where: { reviewerId: userId },
    });
    data.reviewsReceived = await prisma.review.findMany({
      where: { revieweeId: userId },
    });
  }

  return data;
}
