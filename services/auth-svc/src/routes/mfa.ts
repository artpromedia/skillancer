/**
 * @module @skillancer/auth-svc/routes/mfa
 * Multi-Factor Authentication API routes
 */

import { z } from 'zod';

import { authMiddleware } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { requireStepUpAuth } from '../middleware/step-up-auth.js';
import { getMfaService, MfaMethod, type MfaSetupInitResult } from '../services/mfa.service.js';

import type { AuthenticatedUser } from '../middleware/auth.js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Safely get user ID from request. Throws if user is not authenticated.
 */
function getUserId(request: FastifyRequest): string {
  const user = request.user as AuthenticatedUser | undefined;
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user.id;
}

// =============================================================================
// SCHEMAS
// =============================================================================

const totpCodeSchema = z.object({
  code: z.string().length(6).regex(/^\d+$/, 'Code must be 6 digits'),
});

const smsSetupSchema = z.object({
  phoneNumber: z.string().min(10).max(20),
});

const _challengeRequestSchema = z.object({
  method: z.nativeEnum(MfaMethod),
});

const challengeVerifySchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().min(6).max(16),
});

const recoveryCodeSchema = z.object({
  code: z.string().regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i, 'Invalid recovery code format'),
});

// =============================================================================
// TYPES
// =============================================================================

interface TotpCodeBody {
  code: string;
}

interface SmsSetupBody {
  phoneNumber: string;
}

interface ChallengeRequestBody {
  method: MfaMethod;
}

interface ChallengeVerifyBody {
  challengeId: string;
  code: string;
}

interface RecoveryCodeBody {
  code: string;
}

// =============================================================================
// PLUGIN
// =============================================================================

export function mfaRoutes(fastify: FastifyInstance): void {
  const mfaService = getMfaService();

  // ==========================================================================
  // MFA STATUS
  // ==========================================================================

  /**
   * GET /mfa/status
   * Get current MFA status for the authenticated user
   */
  fastify.get(
    '/status',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['MFA'],
        summary: 'Get MFA status',
        description: 'Returns the current MFA configuration status for the authenticated user',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              primaryMethod: { type: 'string', nullable: true },
              totpConfigured: { type: 'boolean' },
              smsConfigured: { type: 'boolean' },
              emailConfigured: { type: 'boolean' },
              hasRecoveryCodes: { type: 'boolean' },
              recoveryCodesRemaining: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const status = await mfaService.getMfaStatus(getUserId(request));
      return reply.send(status);
    }
  );

  /**
   * GET /mfa/methods
   * Get available MFA methods for the authenticated user
   */
  fastify.get(
    '/methods',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['MFA'],
        summary: 'Get available MFA methods',
        description: 'Returns which MFA methods are configured and available',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              totp: { type: 'boolean' },
              sms: { type: 'boolean' },
              email: { type: 'boolean' },
              recoveryCode: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const methods = await mfaService.getAvailableMethods(getUserId(request));
      return reply.send(methods);
    }
  );

  // ==========================================================================
  // TOTP SETUP
  // ==========================================================================

  /**
   * POST /mfa/totp/setup
   * Initiate TOTP setup (generates secret and QR code)
   */
  fastify.post(
    '/totp/setup',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['MFA'],
        summary: 'Initiate TOTP setup',
        description: 'Generates a new TOTP secret and returns QR code for authenticator app',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              setupId: { type: 'string' },
              qrCodeUrl: { type: 'string' },
              manualEntryKey: { type: 'string' },
            },
          },
          409: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const setup: MfaSetupInitResult = await mfaService.initiateTotpSetup(getUserId(request));

      return reply.send({
        setupId: setup.setupId,
        qrCodeUrl: setup.qrCodeDataUrl,
        manualEntryKey: setup.manualEntryKey,
      });
    }
  );

  /**
   * POST /mfa/totp/verify
   * Verify TOTP setup with a code
   */
  fastify.post(
    '/totp/verify',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['MFA'],
        summary: 'Verify TOTP setup',
        description: 'Verifies the TOTP code and completes setup. Returns recovery codes.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['code'],
          properties: {
            code: { type: 'string', minLength: 6, maxLength: 6 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              recoveryCodes: { type: 'array', items: { type: 'string' } },
              message: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: TotpCodeBody }>, reply: FastifyReply) => {
      const { code } = totpCodeSchema.parse(request.body);

      // Verify setup returns recovery codes on first setup
      await mfaService.verifyTotpSetup(getUserId(request), code);

      // Generate and return recovery codes
      const recoveryCodes = await mfaService.regenerateRecoveryCodes(getUserId(request));

      return reply.send({
        success: true,
        recoveryCodes,
        message: 'TOTP MFA successfully enabled. Save your recovery codes in a safe place.',
      });
    }
  );

  /**
   * DELETE /mfa/totp
   * Disable TOTP MFA
   */
  fastify.delete(
    '/totp',
    {
      preHandler: [authMiddleware, requireStepUpAuth('disable_mfa')],
      schema: {
        tags: ['MFA'],
        summary: 'Disable TOTP MFA',
        description: 'Disables TOTP authentication. Requires step-up authentication.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
              operation: { type: 'string' },
              challengeId: { type: 'string' },
              availableMethods: { type: 'array', items: { type: 'string' } },
              expiresAt: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      await mfaService.disableMfa(getUserId(request));

      return reply.send({
        success: true,
        message: 'MFA has been disabled',
      });
    }
  );

  // ==========================================================================
  // SMS SETUP
  // ==========================================================================

  /**
   * POST /mfa/sms/setup
   * Initiate SMS MFA setup
   */
  fastify.post(
    '/sms/setup',
    {
      preHandler: [authMiddleware, rateLimitMiddleware('mfa')],
      schema: {
        tags: ['MFA'],
        summary: 'Initiate SMS MFA setup',
        description: 'Sends a verification code to the provided phone number',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['phoneNumber'],
          properties: {
            phoneNumber: { type: 'string', minLength: 10, maxLength: 20 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: SmsSetupBody }>, reply: FastifyReply) => {
      const { phoneNumber } = smsSetupSchema.parse(request.body);

      await mfaService.initiateSmsSetup(getUserId(request), phoneNumber);

      return reply.send({
        success: true,
        message: 'Verification code sent to your phone',
      });
    }
  );

  /**
   * POST /mfa/sms/verify
   * Verify SMS setup code
   */
  fastify.post(
    '/sms/verify',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['MFA'],
        summary: 'Verify SMS setup',
        description: 'Verifies the SMS code and completes phone setup',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['code'],
          properties: {
            code: { type: 'string', minLength: 6, maxLength: 8 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: TotpCodeBody }>, reply: FastifyReply) => {
      const { code } = totpCodeSchema.parse(request.body);

      await mfaService.verifySmsSetup(getUserId(request), code);

      return reply.send({
        success: true,
        message: 'Phone number verified successfully',
      });
    }
  );

  // ==========================================================================
  // MFA CHALLENGE (During Login)
  // ==========================================================================

  /**
   * POST /mfa/challenge
   * Create an MFA challenge during login
   */
  fastify.post(
    '/challenge',
    {
      schema: {
        tags: ['MFA'],
        summary: 'Create MFA challenge',
        description: 'Creates an MFA challenge for login verification',
        body: {
          type: 'object',
          required: ['method', 'pendingSessionId'],
          properties: {
            method: { type: 'string', enum: ['TOTP', 'SMS', 'EMAIL', 'RECOVERY_CODE'] },
            pendingSessionId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              challengeId: { type: 'string' },
              method: { type: 'string' },
              expiresAt: { type: 'string', format: 'date-time' },
              hint: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: ChallengeRequestBody & { pendingSessionId: string } }>,
      reply: FastifyReply
    ) => {
      const { method, pendingSessionId } = request.body;

      // Validate pending session
      const pendingSession = await mfaService.getPendingSession(pendingSessionId);
      if (!pendingSession) {
        return reply.status(401).send({
          error: 'Invalid or expired session',
          code: 'SESSION_EXPIRED',
        });
      }

      const challenge = await mfaService.createChallenge(
        pendingSession.userId,
        pendingSessionId,
        method
      );

      return reply.send({
        challengeId: challenge.challengeId,
        method: challenge.method,
        expiresAt: challenge.expiresAt.toISOString(),
        hint: challenge.hint,
      });
    }
  );

  /**
   * POST /mfa/challenge/verify
   * Verify an MFA challenge
   */
  fastify.post(
    '/challenge/verify',
    {
      preHandler: [rateLimitMiddleware('mfa')],
      schema: {
        tags: ['MFA'],
        summary: 'Verify MFA challenge',
        description: 'Verifies the MFA code for the challenge',
        body: {
          type: 'object',
          required: ['challengeId', 'code'],
          properties: {
            challengeId: { type: 'string' },
            code: { type: 'string', minLength: 6, maxLength: 16 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
              attemptsRemaining: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: ChallengeVerifyBody }>, reply: FastifyReply) => {
      const { challengeId, code } = challengeVerifySchema.parse(request.body);

      const verified = await mfaService.verifyChallenge(challengeId, code);

      return reply.send({
        success: verified,
        message: 'MFA verification successful',
      });
    }
  );

  // ==========================================================================
  // RECOVERY CODES
  // ==========================================================================

  /**
   * POST /mfa/recovery-codes/regenerate
   * Regenerate recovery codes
   */
  fastify.post(
    '/recovery-codes/regenerate',
    {
      preHandler: [authMiddleware, requireStepUpAuth('regenerate_recovery_codes')],
      schema: {
        tags: ['MFA'],
        summary: 'Regenerate recovery codes',
        description:
          'Generates new recovery codes. Old codes will be invalidated. Requires step-up authentication.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              recoveryCodes: { type: 'array', items: { type: 'string' } },
              message: { type: 'string' },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
              operation: { type: 'string' },
              challengeId: { type: 'string' },
              availableMethods: { type: 'array', items: { type: 'string' } },
              expiresAt: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const recoveryCodes = await mfaService.regenerateRecoveryCodes(getUserId(request));

      return reply.send({
        recoveryCodes,
        message: 'New recovery codes generated. Previous codes are now invalid.',
      });
    }
  );

  /**
   * POST /mfa/recovery-codes/verify
   * Verify a recovery code (for login)
   */
  fastify.post(
    '/recovery-codes/verify',
    {
      preHandler: [rateLimitMiddleware('mfa')],
      schema: {
        tags: ['MFA'],
        summary: 'Verify recovery code',
        description: 'Verifies a recovery code during login',
        body: {
          type: 'object',
          required: ['code', 'pendingSessionId'],
          properties: {
            code: { type: 'string' },
            pendingSessionId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              remainingCodes: { type: 'number' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: RecoveryCodeBody & { pendingSessionId: string } }>,
      reply: FastifyReply
    ) => {
      const { code, pendingSessionId } = request.body;

      const validatedCode = recoveryCodeSchema.parse({ code }).code;

      // Validate pending session
      const pendingSession = await mfaService.getPendingSession(pendingSessionId);
      if (!pendingSession) {
        return reply.status(401).send({
          error: 'Invalid or expired session',
          code: 'SESSION_EXPIRED',
        });
      }

      const verified = await mfaService.verifyRecoveryCode(pendingSession.userId, validatedCode);

      if (!verified) {
        return reply.status(401).send({
          error: 'Invalid recovery code',
          code: 'INVALID_RECOVERY_CODE',
        });
      }

      const status = await mfaService.getMfaStatus(pendingSession.userId);

      return reply.send({
        success: true,
        remainingCodes: status.recoveryCodesRemaining,
        message:
          status.recoveryCodesRemaining <= 2
            ? `Warning: Only ${status.recoveryCodesRemaining} recovery codes remaining. Please regenerate.`
            : 'Recovery code verified successfully',
      });
    }
  );

  // ==========================================================================
  // DISABLE MFA
  // ==========================================================================

  /**
   * DELETE /mfa
   * Completely disable MFA
   */
  fastify.delete(
    '/',
    {
      preHandler: [authMiddleware, requireStepUpAuth('disable_mfa')],
      schema: {
        tags: ['MFA'],
        summary: 'Disable all MFA',
        description: 'Completely disables MFA. Requires step-up authentication.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
              operation: { type: 'string' },
              challengeId: { type: 'string' },
              availableMethods: { type: 'array', items: { type: 'string' } },
              expiresAt: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      await mfaService.disableMfa(getUserId(request));

      return reply.send({
        success: true,
        message: 'MFA has been completely disabled',
      });
    }
  );
}

export default mfaRoutes;
