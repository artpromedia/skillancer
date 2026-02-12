/**
 * GDPR Compliance Routes
 * Implements data subject rights: data export, data deletion, consent management
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { createLogger } from '@skillancer/logger';

const prisma = new PrismaClient();
const logger = createLogger({ service: 'auth-svc', component: 'gdpr' });

// =============================================================================
// SCHEMAS
// =============================================================================

const DataExportRequestSchema = z.object({
  format: z.enum(['JSON', 'CSV']).default('JSON'),
  includeCategories: z
    .array(
      z.enum([
        'PROFILE',
        'CONTRACTS',
        'MESSAGES',
        'PAYMENTS',
        'REVIEWS',
        'PROPOSALS',
        'ACTIVITY_LOG',
        'SETTINGS',
      ])
    )
    .default(['PROFILE', 'CONTRACTS', 'MESSAGES', 'PAYMENTS', 'REVIEWS', 'PROPOSALS', 'SETTINGS']),
});

const AccountDeletionRequestSchema = z.object({
  reason: z
    .enum(['NO_LONGER_NEEDED', 'PRIVACY_CONCERNS', 'SWITCHING_PLATFORM', 'DISSATISFIED', 'OTHER'])
    .optional(),
  feedback: z.string().max(1000).optional(),
  password: z.string().min(1, 'Password is required to confirm deletion'),
  confirmPhrase: z.string().refine((val) => val === 'DELETE MY ACCOUNT', {
    message: 'Please type "DELETE MY ACCOUNT" to confirm',
  }),
});

const ConsentUpdateSchema = z.object({
  marketing: z.boolean().optional(),
  analytics: z.boolean().optional(),
  thirdPartySharing: z.boolean().optional(),
  profiling: z.boolean().optional(),
});

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Export user data in JSON format
 */
async function exportUserDataJson(
  userId: string,
  categories: string[]
): Promise<Record<string, any>> {
  const data: Record<string, any> = {
    exportedAt: new Date().toISOString(),
    userId,
    dataCategories: categories,
  };

  // Profile data
  if (categories.includes('PROFILE')) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        skills: {
          include: {
            skill: true,
          },
        },
        portfolioItems: true,
      },
    });

    if (user) {
      data.profile = {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        bio: user.bio,
        timezone: user.timezone,
        locale: user.locale,
        createdAt: user.createdAt,
        profile: user.profile
          ? {
              title: user.profile.title,
              bio: user.profile.bio,
              hourlyRate: user.profile.hourlyRate?.toString(),
              availability: user.profile.availability,
              location: user.profile.location,
              languages: user.profile.languages,
            }
          : null,
        skills: user.skills.map((us) => ({
          name: us.skill.name,
          yearsOfExperience: us.yearsOfExperience,
          isPrimary: us.isPrimary,
        })),
        portfolioItems: user.portfolioItems.map((item) => ({
          title: item.title,
          description: item.description,
          url: item.url,
          createdAt: item.createdAt,
        })),
      };
    }
  }

  // Contracts
  if (categories.includes('CONTRACTS')) {
    const [clientContracts, freelancerContracts] = await Promise.all([
      prisma.contract.findMany({
        where: { clientId: userId },
        include: {
          milestones: true,
        },
      }),
      prisma.contract.findMany({
        where: { freelancerId: userId },
        include: {
          milestones: true,
        },
      }),
    ]);

    data.contracts = {
      asClient: clientContracts.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        totalAmount: c.totalAmount?.toString(),
        startDate: c.startDate,
        endDate: c.endDate,
        createdAt: c.createdAt,
        milestones: c.milestones.map((m) => ({
          title: m.title,
          amount: m.amount?.toString(),
          status: m.status,
          dueDate: m.dueDate,
        })),
      })),
      asFreelancer: freelancerContracts.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        totalAmount: c.totalAmount?.toString(),
        startDate: c.startDate,
        endDate: c.endDate,
        createdAt: c.createdAt,
        milestones: c.milestones.map((m) => ({
          title: m.title,
          amount: m.amount?.toString(),
          status: m.status,
          dueDate: m.dueDate,
        })),
      })),
    };
  }

  // Messages
  if (categories.includes('MESSAGES')) {
    const messages = await prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: 10000, // Limit to last 10k messages
    });

    data.messages = messages.map((m) => ({
      id: m.id,
      content: m.content,
      sentAt: m.createdAt,
      isSender: m.senderId === userId,
    }));
  }

  // Payments
  if (categories.includes('PAYMENTS')) {
    const transactions = await prisma.paymentTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    data.payments = transactions.map((t) => ({
      id: t.id,
      amount: t.amount?.toString(),
      currency: t.currency,
      type: t.type,
      status: t.status,
      createdAt: t.createdAt,
    }));
  }

  // Reviews
  if (categories.includes('REVIEWS')) {
    const [reviewsGiven, reviewsReceived] = await Promise.all([
      prisma.review.findMany({
        where: { reviewerId: userId },
      }),
      prisma.review.findMany({
        where: { revieweeId: userId },
      }),
    ]);

    data.reviews = {
      given: reviewsGiven.map((r) => ({
        rating: r.rating,
        content: r.content,
        createdAt: r.createdAt,
      })),
      received: reviewsReceived.map((r) => ({
        rating: r.rating,
        content: r.content,
        createdAt: r.createdAt,
      })),
    };
  }

  // Proposals/Bids
  if (categories.includes('PROPOSALS')) {
    const bids = await prisma.bid.findMany({
      where: { freelancerId: userId },
      include: {
        job: {
          select: {
            title: true,
          },
        },
      },
    });

    data.proposals = bids.map((b) => ({
      id: b.id,
      jobTitle: b.job.title,
      coverLetter: b.coverLetter,
      proposedRate: b.proposedRate?.toString(),
      status: b.status,
      createdAt: b.createdAt,
    }));
  }

  // Settings
  if (categories.includes('SETTINGS')) {
    const [notifPrefs, mfa] = await Promise.all([
      prisma.notificationPreference.findUnique({
        where: { userId },
      }),
      prisma.userMfa.findUnique({
        where: { userId },
        select: {
          enabled: true,
          totpEnabled: true,
          smsEnabled: true,
          emailEnabled: true,
        },
      }),
    ]);

    data.settings = {
      notificationPreferences: notifPrefs
        ? {
            emailEnabled: notifPrefs.emailEnabled,
            pushEnabled: notifPrefs.pushEnabled,
            smsEnabled: notifPrefs.smsEnabled,
            marketingEmails: notifPrefs.marketingEmails,
          }
        : null,
      mfa: mfa
        ? {
            enabled: mfa.enabled,
            methods: {
              totp: mfa.totpEnabled,
              sms: mfa.smsEnabled,
              email: mfa.emailEnabled,
            },
          }
        : null,
    };
  }

  return data;
}

/**
 * Soft delete user account and anonymize data
 */
async function deleteUserAccount(
  userId: string,
  reason?: string,
  feedback?: string
): Promise<void> {
  const anonymizedEmail = `deleted-${userId}@anonymized.skillancer.com`;
  const anonymizedName = 'Deleted User';

  await prisma.$transaction(async (tx) => {
    // 1. Soft delete the user
    await tx.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        email: anonymizedEmail,
        firstName: anonymizedName,
        lastName: '',
        displayName: anonymizedName,
        avatarUrl: null,
        bio: null,
        passwordHash: null,
        oauthProvider: null,
        oauthId: null,
        status: 'DELETED',
      },
    });

    // 2. Delete sensitive profile data
    await tx.userProfile.updateMany({
      where: { userId },
      data: {
        bio: null,
        location: null,
        website: null,
        linkedinUrl: null,
        githubUrl: null,
        twitterUrl: null,
        phoneNumber: null,
      },
    });

    // 3. Delete sessions and tokens
    await tx.session.deleteMany({
      where: { userId },
    });

    await tx.refreshToken.deleteMany({
      where: { userId },
    });

    // 4. Delete MFA data
    await tx.userMfa.deleteMany({
      where: { userId },
    });

    // 5. Delete device tokens
    await tx.deviceToken.deleteMany({
      where: { userId },
    });

    // 6. Anonymize messages (keep structure for other party)
    await tx.message.updateMany({
      where: { senderId: userId },
      data: {
        content: '[Message deleted by user]',
      },
    });

    // 7. Log deletion request
    await tx.auditLog.create({
      data: {
        userId,
        action: 'ACCOUNT_DELETED',
        entityType: 'USER',
        entityId: userId,
        changes: {
          reason,
          feedback,
          deletedAt: new Date().toISOString(),
        },
        ipAddress: null,
      },
    });

    // 8. Create deletion record for compliance
    await tx.accountDeletionRequest.create({
      data: {
        userId,
        reason,
        feedback,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  });

  logger.info({ userId, reason }, 'User account deleted');
}

// =============================================================================
// ROUTES
// =============================================================================

export async function gdprRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', async (request, reply) => {
    const user = (request as any).user;
    if (!user?.id) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  /**
   * GET /gdpr/export - Request data export
   */
  fastify.get('/export', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const query = request.query as { format?: string; categories?: string };

      const format = (query.format?.toUpperCase() || 'JSON') as 'JSON' | 'CSV';
      const categories = query.categories?.split(',') || [
        'PROFILE',
        'CONTRACTS',
        'MESSAGES',
        'PAYMENTS',
        'REVIEWS',
        'PROPOSALS',
        'SETTINGS',
      ];

      logger.info({ userId: user.id, format, categories }, 'Data export requested');

      const data = await exportUserDataJson(user.id, categories);

      // Set appropriate headers
      const filename = `skillancer-data-export-${new Date().toISOString().split('T')[0]}.json`;

      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);

      return reply.send(data);
    } catch (error: any) {
      logger.error(error, 'Data export error');
      return reply.status(500).send({ error: 'Failed to export data' });
    }
  });

  /**
   * POST /gdpr/export/request - Request async data export (for large datasets)
   */
  fastify.post('/export/request', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const validation = DataExportRequestSchema.safeParse(request.body);

      if (!validation.success) {
        return reply.status(400).send({
          error: 'Validation error',
          details: validation.error.errors,
        });
      }

      const { format, includeCategories } = validation.data;

      // Create export request record
      const exportRequest = await prisma.dataExportRequest.create({
        data: {
          userId: user.id,
          format,
          categories: includeCategories,
          status: 'PENDING',
        },
      });

      logger.info({ userId: user.id, requestId: exportRequest.id }, 'Async data export requested');

      // In production, this would trigger a background job
      // For now, we'll return the request ID

      return reply.status(202).send({
        success: true,
        message: 'Data export request received. You will receive an email when your data is ready.',
        requestId: exportRequest.id,
        estimatedTime: '24 hours',
      });
    } catch (error: any) {
      logger.error(error, 'Export request error');
      return reply.status(500).send({ error: 'Failed to create export request' });
    }
  });

  /**
   * DELETE /gdpr/account - Request account deletion
   */
  fastify.delete('/account', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const validation = AccountDeletionRequestSchema.safeParse(request.body);

      if (!validation.success) {
        return reply.status(400).send({
          error: 'Validation error',
          details: validation.error.errors,
        });
      }

      const { reason, feedback, password } = validation.data;

      // Verify password
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { passwordHash: true },
      });

      if (!dbUser?.passwordHash) {
        return reply.status(400).send({
          error: 'Cannot delete account',
          message: 'Please contact support to delete your account.',
        });
      }

      // Import bcrypt dynamically to verify password
      const bcrypt = await import('bcrypt');
      const isValid = await bcrypt.compare(password, dbUser.passwordHash);

      if (!isValid) {
        return reply.status(401).send({
          error: 'Invalid password',
          message: 'Please enter your correct password to confirm deletion.',
        });
      }

      // Check for active contracts
      const activeContracts = await prisma.contract.count({
        where: {
          OR: [{ clientId: user.id }, { freelancerId: user.id }],
          status: {
            in: ['ACTIVE', 'PENDING', 'IN_PROGRESS'],
          },
        },
      });

      if (activeContracts > 0) {
        return reply.status(400).send({
          error: 'Cannot delete account',
          message: `You have ${activeContracts} active contract(s). Please complete or cancel them before deleting your account.`,
          activeContracts,
        });
      }

      // Check for pending payouts
      const pendingPayouts = await prisma.payoutRequest.count({
        where: {
          userId: user.id,
          status: 'PENDING',
        },
      });

      if (pendingPayouts > 0) {
        return reply.status(400).send({
          error: 'Cannot delete account',
          message: `You have ${pendingPayouts} pending payout(s). Please wait for them to complete.`,
          pendingPayouts,
        });
      }

      // Perform deletion
      await deleteUserAccount(user.id, reason, feedback);

      logger.info({ userId: user.id, reason }, 'Account deletion completed');

      return reply.send({
        success: true,
        message: 'Your account has been successfully deleted.',
        note: 'Some data may be retained for legal and compliance purposes for up to 7 years.',
      });
    } catch (error: any) {
      logger.error(error, 'Account deletion error');
      return reply.status(500).send({ error: 'Failed to delete account' });
    }
  });

  /**
   * GET /gdpr/consent - Get current consent settings
   */
  fastify.get('/consent', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;

      const consent = await prisma.userConsent.findUnique({
        where: { userId: user.id },
      });

      return reply.send({
        consent: consent
          ? {
              marketing: consent.marketingConsent,
              analytics: consent.analyticsConsent,
              thirdPartySharing: consent.thirdPartySharingConsent,
              profiling: consent.profilingConsent,
              updatedAt: consent.updatedAt,
            }
          : {
              marketing: false,
              analytics: true,
              thirdPartySharing: false,
              profiling: false,
            },
      });
    } catch (error: any) {
      logger.error(error, 'Get consent error');
      return reply.status(500).send({ error: 'Failed to get consent settings' });
    }
  });

  /**
   * PUT /gdpr/consent - Update consent settings
   */
  fastify.put('/consent', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const validation = ConsentUpdateSchema.safeParse(request.body);

      if (!validation.success) {
        return reply.status(400).send({
          error: 'Validation error',
          details: validation.error.errors,
        });
      }

      const { marketing, analytics, thirdPartySharing, profiling } = validation.data;

      const consent = await prisma.userConsent.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          marketingConsent: marketing ?? false,
          analyticsConsent: analytics ?? true,
          thirdPartySharingConsent: thirdPartySharing ?? false,
          profilingConsent: profiling ?? false,
        },
        update: {
          ...(marketing !== undefined && { marketingConsent: marketing }),
          ...(analytics !== undefined && { analyticsConsent: analytics }),
          ...(thirdPartySharing !== undefined && { thirdPartySharingConsent: thirdPartySharing }),
          ...(profiling !== undefined && { profilingConsent: profiling }),
        },
      });

      // Log consent change for audit
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'CONSENT_UPDATED',
          entityType: 'USER_CONSENT',
          entityId: consent.id,
          changes: validation.data,
          ipAddress: request.ip,
        },
      });

      logger.info({ userId: user.id }, 'Consent settings updated');

      return reply.send({
        success: true,
        consent: {
          marketing: consent.marketingConsent,
          analytics: consent.analyticsConsent,
          thirdPartySharing: consent.thirdPartySharingConsent,
          profiling: consent.profilingConsent,
          updatedAt: consent.updatedAt,
        },
      });
    } catch (error: any) {
      logger.error(error, 'Update consent error');
      return reply.status(500).send({ error: 'Failed to update consent settings' });
    }
  });

  /**
   * GET /gdpr/activity-log - Get user's data access/processing log
   */
  fastify.get('/activity-log', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const query = request.query as { limit?: string; offset?: string };

      const limit = Math.min(parseInt(query.limit || '50', 10), 100);
      const offset = parseInt(query.offset || '0', 10);

      const logs = await prisma.auditLog.findMany({
        where: {
          userId: user.id,
          action: {
            in: [
              'DATA_ACCESS',
              'DATA_EXPORT',
              'LOGIN',
              'PASSWORD_CHANGED',
              'PROFILE_UPDATED',
              'CONSENT_UPDATED',
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          action: true,
          entityType: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
        },
      });

      const total = await prisma.auditLog.count({
        where: {
          userId: user.id,
          action: {
            in: [
              'DATA_ACCESS',
              'DATA_EXPORT',
              'LOGIN',
              'PASSWORD_CHANGED',
              'PROFILE_UPDATED',
              'CONSENT_UPDATED',
            ],
          },
        },
      });

      return reply.send({
        logs,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + logs.length < total,
        },
      });
    } catch (error: any) {
      logger.error(error, 'Activity log error');
      return reply.status(500).send({ error: 'Failed to get activity log' });
    }
  });
}
