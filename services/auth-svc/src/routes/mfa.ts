/**
 * @module @skillancer/auth-svc/routes/mfa
 * Multi-Factor Authentication API routes
 */

import crypto from 'crypto';

import { prisma } from '@skillancer/database';
import { z } from 'zod';

import { authMiddleware } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { requireStepUpAuth } from '../middleware/step-up-auth.js';
import { getMfaService, MfaMethod, type MfaSetupInitResult } from '../services/mfa.service.js';
import {
  getTrustedDevicesService,
  type TrustDeviceInfo,
} from '../services/trusted-devices.service.js';
import { getMfaRecoveryService } from '../services/mfa-recovery.service.js';

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

const deviceNameSchema = z.object({
  name: z.string().min(1).max(100),
});

// =============================================================================
// TYPES
// =============================================================================

interface _TotpCodeBody {
  code: string;
}

interface _SmsSetupBody {
  phoneNumber: string;
}

interface ChallengeRequestBody {
  method: MfaMethod;
}

interface _ChallengeVerifyBody {
  challengeId: string;
  code: string;
}

interface RecoveryCodeBody {
  code: string;
}

// =============================================================================
// PLUGIN
// =============================================================================

export async function mfaRoutes(fastify: FastifyInstance): Promise<void> {
  await Promise.resolve();
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
    async (request: FastifyRequest, reply: FastifyReply) => {
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
    async (request: FastifyRequest, reply: FastifyReply) => {
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
    async (request: FastifyRequest, reply: FastifyReply) => {
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
    async (request: FastifyRequest, reply: FastifyReply) => {
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { code, pendingSessionId } = request.body as RecoveryCodeBody & {
        pendingSessionId: string;
      };

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

  // ==========================================================================
  // TRUSTED DEVICES
  // ==========================================================================

  const trustedDevicesService = getTrustedDevicesService();

  /**
   * GET /mfa/trusted-devices
   * Get all trusted devices for the authenticated user
   */
  fastify.get(
    '/trusted-devices',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['MFA', 'Trusted Devices'],
        summary: 'List trusted devices',
        description: 'Returns all trusted devices that can bypass MFA',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              devices: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    deviceName: { type: 'string' },
                    deviceFingerprint: { type: 'string' },
                    lastUsedAt: { type: 'string', format: 'date-time' },
                    lastIpAddress: { type: 'string' },
                    expiresAt: { type: 'string', format: 'date-time', nullable: true },
                    isCurrent: { type: 'boolean' },
                  },
                },
              },
              rememberDevicesEnabled: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserId(request);
      const deviceToken = request.cookies?.['device_token'];

      const [devices, rememberDevicesEnabled] = await Promise.all([
        trustedDevicesService.getUserDevices(userId, deviceToken),
        trustedDevicesService.userHasTrustedDevicesEnabled(userId),
      ]);

      return reply.send({ devices, rememberDevicesEnabled });
    }
  );

  /**
   * POST /mfa/trusted-devices
   * Trust the current device (after MFA verification)
   */
  fastify.post(
    '/trusted-devices',
    {
      preHandler: [authMiddleware, requireStepUpAuth('trust_device')],
      schema: {
        tags: ['MFA', 'Trusted Devices'],
        summary: 'Trust current device',
        description: 'Trust the current device to skip MFA in the future. Requires step-up auth.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            deviceName: { type: 'string', description: 'Optional custom name for the device' },
            trustDays: { type: 'number', description: 'Days to trust device (default: 30)' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              deviceToken: { type: 'string' },
              expiresAt: { type: 'string', format: 'date-time' },
              device: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  deviceName: { type: 'string' },
                  deviceFingerprint: { type: 'string' },
                  lastUsedAt: { type: 'string', format: 'date-time' },
                  lastIpAddress: { type: 'string' },
                  expiresAt: { type: 'string', format: 'date-time', nullable: true },
                  isCurrent: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserId(request);
      const body = request.body as { deviceName?: string; trustDays?: number } | undefined;

      // Check if user has remember devices enabled
      const enabled = await trustedDevicesService.userHasTrustedDevicesEnabled(userId);
      if (!enabled) {
        return reply.status(400).send({
          error: 'Trusted devices feature is not enabled',
          code: 'TRUSTED_DEVICES_DISABLED',
        });
      }

      const deviceInfo: TrustDeviceInfo = {
        userAgent: request.headers['user-agent'] || 'Unknown',
        ipAddress: request.ip,
        ...(body?.deviceName && { deviceName: body.deviceName }),
        ...((request.headers['x-device-fingerprint'] as string) && {
          clientFingerprint: request.headers['x-device-fingerprint'] as string,
        }),
      };

      const result = await trustedDevicesService.trustDevice(userId, deviceInfo, {
        ...(body?.trustDays && { trustDays: body.trustDays }),
      });

      // Set device token cookie
      void reply.setCookie('device_token', result.deviceToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: result.expiresAt,
      });

      return reply.send({
        success: true,
        deviceToken: result.deviceToken,
        expiresAt: result.expiresAt,
        device: result.device,
      });
    }
  );

  /**
   * PATCH /mfa/trusted-devices/:deviceId
   * Rename a trusted device
   */
  fastify.patch(
    '/trusted-devices/:deviceId',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['MFA', 'Trusted Devices'],
        summary: 'Rename trusted device',
        description: 'Update the display name of a trusted device',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            deviceId: { type: 'string' },
          },
          required: ['deviceId'],
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              device: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  deviceName: { type: 'string' },
                  deviceFingerprint: { type: 'string' },
                  lastUsedAt: { type: 'string', format: 'date-time' },
                  lastIpAddress: { type: 'string' },
                  expiresAt: { type: 'string', format: 'date-time', nullable: true },
                  isCurrent: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserId(request);
      const { deviceId } = request.params as { deviceId: string };
      const { name } = deviceNameSchema.parse(request.body);

      const device = await trustedDevicesService.renameDevice(userId, deviceId, name);

      return reply.send({ success: true, device });
    }
  );

  /**
   * DELETE /mfa/trusted-devices/:deviceId
   * Revoke a specific trusted device
   */
  fastify.delete(
    '/trusted-devices/:deviceId',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['MFA', 'Trusted Devices'],
        summary: 'Revoke trusted device',
        description: 'Revoke trust for a specific device',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            deviceId: { type: 'string' },
          },
          required: ['deviceId'],
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserId(request);
      const { deviceId } = request.params as { deviceId: string };

      await trustedDevicesService.revokeDevice(userId, deviceId);

      return reply.send({
        success: true,
        message: 'Device trust has been revoked',
      });
    }
  );

  /**
   * DELETE /mfa/trusted-devices
   * Revoke all trusted devices
   */
  fastify.delete(
    '/trusted-devices',
    {
      preHandler: [authMiddleware, requireStepUpAuth('revoke_all_devices')],
      schema: {
        tags: ['MFA', 'Trusted Devices'],
        summary: 'Revoke all trusted devices',
        description: 'Revoke trust for all devices. Requires step-up authentication.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            keepCurrent: { type: 'boolean', description: 'Keep the current device trusted' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              revokedCount: { type: 'number' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserId(request);
      const { keepCurrent } = request.query as { keepCurrent?: boolean };

      let currentDeviceId: string | undefined;
      if (keepCurrent) {
        const deviceToken = request.cookies?.['device_token'];
        if (deviceToken) {
          const devices = await trustedDevicesService.getUserDevices(userId, deviceToken);
          const currentDevice = devices.find((d) => d.isCurrent);
          currentDeviceId = currentDevice?.id;
        }
      }

      const revokedCount = await trustedDevicesService.revokeAllDevices(userId, currentDeviceId);

      return reply.send({
        success: true,
        revokedCount,
        message: `${revokedCount} device(s) have been revoked`,
      });
    }
  );

  /**
   * PUT /mfa/trusted-devices/settings
   * Update trusted devices preference
   */
  fastify.put(
    '/trusted-devices/settings',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['MFA', 'Trusted Devices'],
        summary: 'Update trusted devices settings',
        description: 'Enable or disable the trusted devices feature',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
          },
          required: ['enabled'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              enabled: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserId(request);
      const { enabled } = request.body as { enabled: boolean };

      await trustedDevicesService.updateTrustedDevicesPreference(userId, enabled);

      return reply.send({
        success: true,
        enabled,
        message: enabled
          ? 'Trusted devices feature has been enabled'
          : 'Trusted devices feature has been disabled. All trusted devices have been revoked.',
      });
    }
  );

  // ==========================================================================
  // MFA RECOVERY
  // ==========================================================================

  const recoveryService = getMfaRecoveryService();

  /**
   * POST /mfa/recovery/initiate
   * Initiate MFA recovery process
   */
  fastify.post(
    '/recovery/initiate',
    {
      schema: {
        tags: ['MFA', 'Recovery'],
        summary: 'Initiate MFA recovery',
        description:
          'Start the MFA recovery process when user has lost access to their MFA methods',
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            preferAdmin: { type: 'boolean', description: 'Prefer admin-assisted recovery' },
          },
          required: ['email'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              requestId: { type: 'string' },
              method: { type: 'string', enum: ['email', 'admin'] },
              hint: { type: 'string' },
              expiresAt: { type: 'string', format: 'date-time' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { email, preferAdmin } = request.body as { email: string; preferAdmin?: boolean };

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true },
      });

      if (!user) {
        // Don't reveal if user exists
        return reply.send({
          requestId: crypto.randomUUID(),
          method: 'email',
          hint: 'If an account exists, recovery instructions have been sent',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          message: 'Recovery process initiated',
        });
      }

      const result = await recoveryService.initiateRecovery(user.id, {
        ...(preferAdmin && { preferAdmin }),
      });

      return reply.send(result);
    }
  );

  /**
   * POST /mfa/recovery/verify
   * Verify recovery code
   */
  fastify.post(
    '/recovery/verify',
    {
      schema: {
        tags: ['MFA', 'Recovery'],
        summary: 'Verify recovery code',
        description: 'Verify the recovery code sent to recovery email',
        body: {
          type: 'object',
          properties: {
            requestId: { type: 'string' },
            code: { type: 'string' },
          },
          required: ['requestId', 'code'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              requestId: { type: 'string' },
              message: { type: 'string' },
              nextStep: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { requestId, code } = request.body as { requestId: string; code: string };

      const result = await recoveryService.verifyRecoveryCode(requestId, code);

      return reply.send(result);
    }
  );

  /**
   * POST /mfa/recovery/complete
   * Complete MFA recovery and reset MFA
   */
  fastify.post(
    '/recovery/complete',
    {
      schema: {
        tags: ['MFA', 'Recovery'],
        summary: 'Complete MFA recovery',
        description: 'Complete the recovery process and reset MFA settings',
        body: {
          type: 'object',
          properties: {
            requestId: { type: 'string' },
          },
          required: ['requestId'],
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { requestId } = request.body as { requestId: string };

      const result = await recoveryService.completeRecovery(requestId);

      return reply.send(result);
    }
  );

  /**
   * POST /mfa/recovery/resend
   * Resend recovery code
   */
  fastify.post(
    '/recovery/resend',
    {
      schema: {
        tags: ['MFA', 'Recovery'],
        summary: 'Resend recovery code',
        description: 'Resend the recovery verification code',
        body: {
          type: 'object',
          properties: {
            requestId: { type: 'string' },
          },
          required: ['requestId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              expiresAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { requestId } = request.body as { requestId: string };

      const result = await recoveryService.resendRecoveryCode(requestId);

      return reply.send(result);
    }
  );

  /**
   * GET /mfa/recovery-email
   * Get recovery email status
   */
  fastify.get(
    '/recovery-email',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['MFA', 'Recovery'],
        summary: 'Get recovery email status',
        description: 'Check if a recovery email is configured',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              hasRecoveryEmail: { type: 'boolean' },
              recoveryEmailHint: { type: 'string', nullable: true },
              verified: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserId(request);

      const status = await recoveryService.getRecoveryEmailStatus(userId);

      return reply.send(status);
    }
  );

  /**
   * POST /mfa/recovery-email
   * Set up recovery email
   */
  fastify.post(
    '/recovery-email',
    {
      preHandler: [authMiddleware, requireStepUpAuth('setup_recovery_email')],
      schema: {
        tags: ['MFA', 'Recovery'],
        summary: 'Set up recovery email',
        description: 'Configure a recovery email for MFA recovery. Requires step-up auth.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
          },
          required: ['email'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              verificationSent: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserId(request);
      const { email } = request.body as { email: string };

      const result = await recoveryService.setupRecoveryEmail(userId, email);

      return reply.send({
        ...result,
        message: 'Verification code sent to your recovery email',
      });
    }
  );

  /**
   * POST /mfa/recovery-email/verify
   * Verify recovery email
   */
  fastify.post(
    '/recovery-email/verify',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['MFA', 'Recovery'],
        summary: 'Verify recovery email',
        description: 'Verify the recovery email with the code sent',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            code: { type: 'string' },
          },
          required: ['code'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              verified: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserId(request);
      const { code } = request.body as { code: string };

      const result = await recoveryService.verifyRecoveryEmail(userId, code);

      return reply.send({
        ...result,
        message: 'Recovery email verified successfully',
      });
    }
  );

  /**
   * DELETE /mfa/recovery-email
   * Remove recovery email
   */
  fastify.delete(
    '/recovery-email',
    {
      preHandler: [authMiddleware, requireStepUpAuth('remove_recovery_email')],
      schema: {
        tags: ['MFA', 'Recovery'],
        summary: 'Remove recovery email',
        description: 'Remove the configured recovery email. Requires step-up auth.',
        security: [{ bearerAuth: [] }],
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserId(request);

      await recoveryService.removeRecoveryEmail(userId);

      return reply.send({
        success: true,
        message: 'Recovery email has been removed',
      });
    }
  );
}

export default mfaRoutes;
