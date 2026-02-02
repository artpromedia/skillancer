/**
 * Device Registration Routes
 *
 * Handles FCM device token registration and management.
 * Supports multiple devices per user with token refresh.
 */

/* eslint-disable @typescript-eslint/return-await */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/require-await */

import { PrismaClient, type Prisma } from '@prisma/client';
import { logger } from '@skillancer/logger';
import { z } from 'zod';

import { validateTokens } from '../providers/firebase.js';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

const prisma = new PrismaClient();

// ============================================================================
// Schemas
// ============================================================================

const registerDeviceSchema = z.object({
  token: z.string().min(1, 'FCM token is required'),
  platform: z.enum(['web', 'ios', 'android']),
  deviceId: z.string().min(1, 'Device ID is required'),
  deviceName: z.string().optional(),
  deviceModel: z.string().optional(),
  osVersion: z.string().optional(),
  appVersion: z.string().optional(),
});

const unregisterDeviceSchema = z.object({
  token: z.string().optional(),
  deviceId: z.string().optional(),
});

const refreshTokenSchema = z.object({
  oldToken: z.string().min(1, 'Old token is required'),
  newToken: z.string().min(1, 'New token is required'),
});

// ============================================================================
// Route Types
// ============================================================================

type RegisterDeviceBody = z.infer<typeof registerDeviceSchema>;
type UnregisterDeviceBody = z.infer<typeof unregisterDeviceSchema>;
type RefreshTokenBody = z.infer<typeof refreshTokenSchema>;

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
  };
}

// ============================================================================
// Routes
// ============================================================================

export async function deviceRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * Register a device for push notifications
   * POST /api/devices/register
   */
  fastify.post<{ Body: RegisterDeviceBody }>(
    '/register',
    {
      schema: {
        body: {
          type: 'object',
          required: ['token', 'platform', 'deviceId'],
          properties: {
            token: { type: 'string' },
            platform: { type: 'string', enum: ['web', 'ios', 'android'] },
            deviceId: { type: 'string' },
            deviceName: { type: 'string' },
            deviceModel: { type: 'string' },
            osVersion: { type: 'string' },
            appVersion: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              deviceId: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          return reply.status(401).send({ success: false, error: 'Unauthorized' });
        }

        const body = registerDeviceSchema.parse(request.body);
        const { token, platform, deviceId, deviceName, deviceModel, osVersion, appVersion } = body;

        // Check if token already exists for another user
        const existingDevice = await prisma.deviceToken.findFirst({
          where: { token },
        });

        if (existingDevice && existingDevice.userId !== userId) {
          // Token was previously registered to another user, update ownership
          await prisma.deviceToken.update({
            where: { id: existingDevice.id },
            data: {
              userId,
              platform,
              deviceId,
              deviceName,
              deviceModel,
              osVersion,
              appVersion,
              isActive: true,
              lastUsedAt: new Date(),
            },
          });

          logger.info(
            { userId, deviceId, previousUserId: existingDevice.userId },
            'Device token ownership transferred'
          );

          return reply.send({
            success: true,
            deviceId,
            message: 'Device registered successfully',
          });
        }

        if (existingDevice) {
          // Update existing device
          await prisma.deviceToken.update({
            where: { id: existingDevice.id },
            data: {
              platform,
              deviceName,
              deviceModel,
              osVersion,
              appVersion,
              isActive: true,
              lastUsedAt: new Date(),
            },
          });

          logger.info({ userId, deviceId }, 'Device token updated');
        } else {
          // Create new device registration
          await prisma.deviceToken.create({
            data: {
              userId,
              token,
              platform,
              deviceId,
              deviceName,
              deviceModel,
              osVersion,
              appVersion,
              isActive: true,
            },
          });

          logger.info(
            { userId, deviceId, platform },
            'New device registered for push notifications'
          );
        }

        return reply.send({
          success: true,
          deviceId,
          message: 'Device registered successfully',
        });
      } catch (error) {
        logger.error({ error }, 'Failed to register device');

        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid request data',
            details: error.errors,
          });
        }

        return reply.status(500).send({
          success: false,
          error: 'Failed to register device',
        });
      }
    }
  );

  /**
   * Unregister a device
   * DELETE /api/devices/unregister
   */
  fastify.delete<{ Body: UnregisterDeviceBody }>(
    '/unregister',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            deviceId: { type: 'string' },
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
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          return reply.status(401).send({ success: false, error: 'Unauthorized' });
        }

        const body = unregisterDeviceSchema.parse(request.body);
        const { token, deviceId } = body;

        if (!token && !deviceId) {
          return reply.status(400).send({
            success: false,
            error: 'Either token or deviceId is required',
          });
        }

        const where: Prisma.DeviceTokenWhereInput = { userId };
        if (token) where.token = token;
        if (deviceId) where.deviceId = deviceId;

        const result = await prisma.deviceToken.updateMany({
          where,
          data: { isActive: false },
        });

        logger.info(
          { userId, token: token?.slice(0, 20), deviceId, count: result.count },
          'Device(s) unregistered'
        );

        return reply.send({
          success: true,
          message: `${result.count} device(s) unregistered`,
        });
      } catch (error) {
        logger.error({ error }, 'Failed to unregister device');
        return reply.status(500).send({
          success: false,
          error: 'Failed to unregister device',
        });
      }
    }
  );

  /**
   * Refresh FCM token
   * POST /api/devices/refresh-token
   */
  fastify.post<{ Body: RefreshTokenBody }>(
    '/refresh-token',
    {
      schema: {
        body: {
          type: 'object',
          required: ['oldToken', 'newToken'],
          properties: {
            oldToken: { type: 'string' },
            newToken: { type: 'string' },
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
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          return reply.status(401).send({ success: false, error: 'Unauthorized' });
        }

        const body = refreshTokenSchema.parse(request.body);
        const { oldToken, newToken } = body;

        // Find device with old token
        const device = await prisma.deviceToken.findFirst({
          where: { token: oldToken, userId },
        });

        if (!device) {
          // Old token not found, register new token
          return reply.status(404).send({
            success: false,
            error: 'Device not found. Please register the new token.',
          });
        }

        // Update token
        await prisma.deviceToken.update({
          where: { id: device.id },
          data: {
            token: newToken,
            isActive: true,
            lastUsedAt: new Date(),
          },
        });

        logger.info({ userId, deviceId: device.deviceId }, 'FCM token refreshed');

        return reply.send({
          success: true,
          message: 'Token refreshed successfully',
        });
      } catch (error) {
        logger.error({ error }, 'Failed to refresh token');
        return reply.status(500).send({
          success: false,
          error: 'Failed to refresh token',
        });
      }
    }
  );

  /**
   * Get user's registered devices
   * GET /api/devices
   */
  fastify.get(
    '/',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              devices: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    deviceId: { type: 'string' },
                    platform: { type: 'string' },
                    deviceName: { type: 'string' },
                    isActive: { type: 'boolean' },
                    lastUsedAt: { type: 'string' },
                    createdAt: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          return reply.status(401).send({ success: false, error: 'Unauthorized' });
        }

        const devices = await prisma.deviceToken.findMany({
          where: { userId },
          select: {
            id: true,
            deviceId: true,
            platform: true,
            deviceName: true,
            deviceModel: true,
            isActive: true,
            lastUsedAt: true,
            createdAt: true,
          },
          orderBy: { lastUsedAt: 'desc' },
        });

        return reply.send({
          success: true,
          devices,
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get devices');
        return reply.status(500).send({
          success: false,
          error: 'Failed to get devices',
        });
      }
    }
  );

  /**
   * Validate device tokens (internal/admin use)
   * POST /api/devices/validate
   */
  fastify.post(
    '/validate',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              validatedCount: { type: 'number' },
              invalidatedCount: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          return reply.status(401).send({ success: false, error: 'Unauthorized' });
        }

        // Get user's active tokens
        const devices = await prisma.deviceToken.findMany({
          where: { userId, isActive: true },
          select: { id: true, token: true },
        });

        if (devices.length === 0) {
          return reply.send({
            success: true,
            validatedCount: 0,
            invalidatedCount: 0,
          });
        }

        // Validate tokens with Firebase
        const tokens = devices.map((d) => d.token);
        const { valid, invalid } = await validateTokens(tokens);

        // Deactivate invalid tokens
        if (invalid.length > 0) {
          await prisma.deviceToken.updateMany({
            where: {
              token: { in: invalid },
              userId,
            },
            data: { isActive: false },
          });
        }

        logger.info(
          { userId, valid: valid.length, invalid: invalid.length },
          'Device tokens validated'
        );

        return reply.send({
          success: true,
          validatedCount: valid.length,
          invalidatedCount: invalid.length,
        });
      } catch (error) {
        logger.error({ error }, 'Failed to validate tokens');
        return reply.status(500).send({
          success: false,
          error: 'Failed to validate tokens',
        });
      }
    }
  );
}

export default deviceRoutes;
