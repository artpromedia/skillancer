// @ts-nocheck
/**
 * @module @skillancer/auth-svc/routes/contact-verification
 * Email and Phone Code-based Verification Routes
 *
 * Endpoints for:
 * - Sending verification codes (email/phone)
 * - Verifying codes
 * - Getting verification status
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import crypto from 'node:crypto';

import { prisma } from '@skillancer/database';
import { createLogger } from '@skillancer/logger';
import { NotificationServiceClient } from '@skillancer/service-client';
import { z } from 'zod';

import { authMiddleware } from '../middleware/auth.js';
import { getSmsService } from '../services/sms.service.js';

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

const logger = createLogger({ serviceName: 'contact-verification' });

// =============================================================================
// SCHEMAS
// =============================================================================

const sendEmailCodeSchema = z.object({
  email: z.string().email().optional(), // Optional - uses account email by default
});

const sendPhoneCodeSchema = z.object({
  phone: z.string().min(10).max(20),
});

const verifyCodeSchema = z.object({
  code: z.string().length(6),
});

// =============================================================================
// CONSTANTS
// =============================================================================

const CODE_LENGTH = 6;
const CODE_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const COOLDOWN_SECONDS = 60;

// =============================================================================
// HELPERS
// =============================================================================

function generateVerificationCode(): string {
  // Generate cryptographically secure 6-digit code
  const buffer = crypto.randomBytes(4);
  const num = buffer.readUInt32BE(0);
  return String(num % 1000000).padStart(CODE_LENGTH, '0');
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

// Notification client singleton
let notificationClient: NotificationServiceClient | null = null;

function getNotificationClient(): NotificationServiceClient {
  notificationClient ??= new NotificationServiceClient();
  return notificationClient;
}

// =============================================================================
// ROUTES
// =============================================================================

const contactVerificationRoutes: FastifyPluginAsync = async (fastify) => {
  // ===========================================================================
  // GET VERIFICATION STATUS
  // ===========================================================================

  /**
   * GET /verification/contact-status
   * Get current user's contact verification status (email/phone)
   */
  fastify.get(
    '/contact-status',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          emailVerified: true,
          emailVerifiedAt: true,
          phone: true,
          phoneVerified: true,
          phoneVerifiedAt: true,
          verificationLevel: true,
          paymentVerified: true,
          paymentVerifiedAt: true,
        },
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // Check for pending identity verification
      const pendingVerification = await prisma.verificationInquiry.findFirst({
        where: {
          userId,
          status: { in: ['PENDING', 'IN_PROGRESS', 'NEEDS_REVIEW'] },
        },
        select: {
          id: true,
          verificationType: true,
          status: true,
          initiatedAt: true,
        },
        orderBy: { initiatedAt: 'desc' },
      });

      // Determine identity verified status
      const identityVerified =
        user.verificationLevel !== 'NONE' && user.verificationLevel !== 'EMAIL';

      return reply.send({
        level: user.verificationLevel,
        emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt?.toISOString(),
        phoneVerified: user.phoneVerified,
        phoneVerifiedAt: user.phoneVerifiedAt?.toISOString(),
        paymentVerified: user.paymentVerified ?? false,
        paymentVerifiedAt: user.paymentVerifiedAt?.toISOString() ?? null,
        identityVerified,
        identityVerifiedAt: identityVerified ? user.emailVerifiedAt?.toISOString() : null,
        pendingVerification: pendingVerification
          ? {
              inquiryId: pendingVerification.id,
              tier: pendingVerification.verificationType,
              status: pendingVerification.status.toLowerCase(),
              startedAt: pendingVerification.initiatedAt.toISOString(),
            }
          : null,
      });
    }
  );

  // ===========================================================================
  // EMAIL VERIFICATION
  // ===========================================================================

  /**
   * POST /verification/email/send
   * Send email verification code
   */
  fastify.post(
    '/email/send',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      const body = sendEmailCodeSchema.parse(request.body ?? {});

      // Get user's email
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, emailVerified: true },
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const targetEmail = body.email || user.email;

      // Check if already verified
      if (user.emailVerified && targetEmail === user.email) {
        return reply.status(400).send({
          error: 'ALREADY_VERIFIED',
          message: 'Email is already verified',
        });
      }

      // Check for recent verification code (cooldown)
      const recentCode = await prisma.verificationCode.findFirst({
        where: {
          userId,
          type: 'EMAIL',
          createdAt: {
            gte: new Date(Date.now() - COOLDOWN_SECONDS * 1000),
          },
        },
      });

      if (recentCode) {
        const waitSeconds = Math.ceil(
          (recentCode.createdAt.getTime() + COOLDOWN_SECONDS * 1000 - Date.now()) / 1000
        );
        return reply.status(429).send({
          error: 'COOLDOWN',
          message: `Please wait ${waitSeconds} seconds before requesting a new code`,
          retryAfter: waitSeconds,
        });
      }

      // Generate and store code
      const code = generateVerificationCode();
      const codeHash = hashCode(code);
      const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

      // Delete any existing codes for this user/type
      await prisma.verificationCode.deleteMany({
        where: { userId, type: 'EMAIL' },
      });

      // Create new code
      await prisma.verificationCode.create({
        data: {
          userId,
          type: 'EMAIL',
          codeHash,
          destination: targetEmail,
          expiresAt,
          attempts: 0,
        },
      });

      // Send email with code
      try {
        await getNotificationClient().sendEmail({
          to: targetEmail,
          templateId: 'verification-code',
          data: {
            code,
            expiresInMinutes: CODE_EXPIRY_MINUTES,
          },
        });

        logger.info({ userId, email: targetEmail }, 'Verification code sent');
      } catch (error) {
        logger.error({ userId, error }, 'Failed to send verification email');
        // Still return success - don't reveal email sending failures
      }

      return reply.send({
        success: true,
        expiresAt: expiresAt.toISOString(),
        message: 'Verification code sent to your email',
      });
    }
  );

  /**
   * POST /verification/email/verify
   * Verify email with code
   */
  fastify.post(
    '/email/verify',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      const { code } = verifyCodeSchema.parse(request.body);

      // Find valid verification code
      const verificationCode = await prisma.verificationCode.findFirst({
        where: {
          userId,
          type: 'EMAIL',
          expiresAt: { gte: new Date() },
        },
      });

      if (!verificationCode) {
        return reply.status(400).send({
          error: 'CODE_EXPIRED',
          message: 'Verification code has expired. Please request a new one.',
        });
      }

      // Check attempts
      if (verificationCode.attempts >= MAX_ATTEMPTS) {
        await prisma.verificationCode.delete({
          where: { id: verificationCode.id },
        });
        return reply.status(400).send({
          error: 'MAX_ATTEMPTS',
          message: 'Too many failed attempts. Please request a new code.',
        });
      }

      // Verify code
      const inputHash = hashCode(code);
      if (inputHash !== verificationCode.codeHash) {
        await prisma.verificationCode.update({
          where: { id: verificationCode.id },
          data: { attempts: { increment: 1 } },
        });

        const remainingAttempts = MAX_ATTEMPTS - verificationCode.attempts - 1;
        return reply.status(400).send({
          error: 'INVALID_CODE',
          message: `Invalid verification code. ${remainingAttempts} attempts remaining.`,
          remainingAttempts,
        });
      }

      // Code is valid - update user
      const now = new Date();
      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: {
            emailVerified: true,
            emailVerifiedAt: now,
            // Upgrade verification level if not already set
            verificationLevel: {
              set: 'EMAIL',
            },
          },
        }),
        prisma.verificationCode.delete({
          where: { id: verificationCode.id },
        }),
      ]);

      logger.info({ userId }, 'Email verified successfully');

      return reply.send({
        success: true,
        verifiedAt: now.toISOString(),
        message: 'Email verified successfully',
      });
    }
  );

  // ===========================================================================
  // PHONE VERIFICATION
  // ===========================================================================

  /**
   * POST /verification/phone/send
   * Send phone verification code via SMS
   */
  fastify.post(
    '/phone/send',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      const { phone } = sendPhoneCodeSchema.parse(request.body);
      const smsService = getSmsService();

      // Check if SMS service is configured
      if (!smsService.isConfigured()) {
        return reply.status(503).send({
          error: 'SERVICE_UNAVAILABLE',
          message: 'SMS service is not available',
        });
      }

      // Check for recent verification code (cooldown)
      const recentCode = await prisma.verificationCode.findFirst({
        where: {
          userId,
          type: 'PHONE',
          createdAt: {
            gte: new Date(Date.now() - COOLDOWN_SECONDS * 1000),
          },
        },
      });

      if (recentCode) {
        const waitSeconds = Math.ceil(
          (recentCode.createdAt.getTime() + COOLDOWN_SECONDS * 1000 - Date.now()) / 1000
        );
        return reply.status(429).send({
          error: 'COOLDOWN',
          message: `Please wait ${waitSeconds} seconds before requesting a new code`,
          retryAfter: waitSeconds,
        });
      }

      // Generate and store code
      const code = generateVerificationCode();
      const codeHash = hashCode(code);
      const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

      // Delete any existing codes for this user/type
      await prisma.verificationCode.deleteMany({
        where: { userId, type: 'PHONE' },
      });

      // Create new code
      await prisma.verificationCode.create({
        data: {
          userId,
          type: 'PHONE',
          codeHash,
          destination: phone,
          expiresAt,
          attempts: 0,
        },
      });

      // Send SMS with code
      try {
        const result = await smsService.sendVerificationCode(phone, code);
        if (!result.success) {
          throw new Error(result.error ?? 'Failed to send SMS');
        }
        logger.info({ userId, phone: phone.slice(-4) }, 'Phone verification code sent');
      } catch (error) {
        logger.error({ userId, error }, 'Failed to send verification SMS');
        // Delete the code since we couldn't send it
        await prisma.verificationCode.deleteMany({
          where: { userId, type: 'PHONE' },
        });
        return reply.status(500).send({
          error: 'SMS_FAILED',
          message: 'Failed to send verification code. Please try again.',
        });
      }

      return reply.send({
        success: true,
        expiresAt: expiresAt.toISOString(),
        message: 'Verification code sent to your phone',
      });
    }
  );

  /**
   * POST /verification/phone/verify
   * Verify phone with code
   */
  fastify.post(
    '/phone/verify',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      const { code } = verifyCodeSchema.parse(request.body);

      // Find valid verification code
      const verificationCode = await prisma.verificationCode.findFirst({
        where: {
          userId,
          type: 'PHONE',
          expiresAt: { gte: new Date() },
        },
      });

      if (!verificationCode) {
        return reply.status(400).send({
          error: 'CODE_EXPIRED',
          message: 'Verification code has expired. Please request a new one.',
        });
      }

      // Check attempts
      if (verificationCode.attempts >= MAX_ATTEMPTS) {
        await prisma.verificationCode.delete({
          where: { id: verificationCode.id },
        });
        return reply.status(400).send({
          error: 'MAX_ATTEMPTS',
          message: 'Too many failed attempts. Please request a new code.',
        });
      }

      // Verify code
      const inputHash = hashCode(code);
      if (inputHash !== verificationCode.codeHash) {
        await prisma.verificationCode.update({
          where: { id: verificationCode.id },
          data: { attempts: { increment: 1 } },
        });

        const remainingAttempts = MAX_ATTEMPTS - verificationCode.attempts - 1;
        return reply.status(400).send({
          error: 'INVALID_CODE',
          message: `Invalid verification code. ${remainingAttempts} attempts remaining.`,
          remainingAttempts,
        });
      }

      // Code is valid - update user
      const now = new Date();
      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: {
            phone: verificationCode.destination,
            phoneVerified: true,
            phoneVerifiedAt: now,
          },
        }),
        prisma.verificationCode.delete({
          where: { id: verificationCode.id },
        }),
      ]);

      logger.info({ userId }, 'Phone verified successfully');

      return reply.send({
        success: true,
        verifiedAt: now.toISOString(),
        message: 'Phone number verified successfully',
      });
    }
  );
};

export { contactVerificationRoutes };
export default contactVerificationRoutes;
