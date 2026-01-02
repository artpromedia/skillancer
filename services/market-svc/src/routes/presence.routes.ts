// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * @module @skillancer/market-svc/routes/presence
 * REST API routes for user presence and push notifications
 */

import { createPresenceService } from '../services/presence.service.js';

import type { PrismaClient, PresenceStatus } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance, FastifyRequest, FastifyReply, FastifySchema } from 'fastify';

type OpenAPISchema = FastifySchema & {
  tags?: string[];
  summary?: string;
  description?: string;
};

interface AuthenticatedRequest extends FastifyRequest {
  user?: { id: string; email: string };
}

// Helper to get authenticated user ID with proper null check
function getUserId(request: FastifyRequest): string {
  const user = (request as AuthenticatedRequest).user;
  if (!user) {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
  }
  return user.id;
}

export interface PresenceRoutesDeps {
  prisma: PrismaClient;
  logger: Logger;
}

interface UserParams {
  userId: string;
}

interface UpdatePresenceBody {
  status?: PresenceStatus;
  currentConversationId?: string | null;
}

interface RegisterPushTokenBody {
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceId: string;
  deviceName?: string;
}

interface RemovePushTokenBody {
  token: string;
}

interface GetMultiplePresenceBody {
  userIds: string[];
}

export function registerPresenceRoutes(fastify: FastifyInstance, deps: PresenceRoutesDeps): void {
  const { prisma, logger } = deps;

  // Initialize services
  const presenceService = createPresenceService({ prisma, logger });

  // Get current user's presence
  fastify.get(
    '/me',
    {
      schema: {
        description: "Get current user's presence",
        tags: ['Presence'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  status: { type: 'string' },
                  lastSeenAt: { type: 'string', format: 'date-time' },
                  currentConversationId: { type: 'string', nullable: true },
                  isTyping: { type: 'boolean' },
                  typingInConversationId: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserId(request);
      const presence = await presenceService.getPresence(userId);

      if (!presence) {
        return reply.send({
          success: true,
          data: {
            userId,
            status: 'OFFLINE',
            lastSeenAt: null,
            currentConversationId: null,
            isTyping: false,
            typingInConversationId: null,
          },
        });
      }

      return reply.send({
        success: true,
        data: presence,
      });
    }
  );

  // Update current user's presence
  fastify.patch<{ Body: UpdatePresenceBody }>(
    '/me',
    {
      schema: {
        description: "Update current user's presence",
        tags: ['Presence'],
        body: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['ONLINE', 'AWAY', 'BUSY', 'OFFLINE'],
            },
            currentConversationId: { type: 'string', nullable: true },
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
      } as OpenAPISchema,
    },
    async (request: FastifyRequest<{ Body: UpdatePresenceBody }>, reply: FastifyReply) => {
      const userId = getUserId(request);
      await presenceService.updatePresence(userId, request.body);

      return reply.send({
        success: true,
        message: 'Presence updated',
      });
    }
  );

  // Get another user's presence
  fastify.get<{ Params: UserParams }>(
    '/:userId',
    {
      schema: {
        description: "Get a user's presence",
        tags: ['Presence'],
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  status: { type: 'string' },
                  lastSeenAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request: FastifyRequest<{ Params: UserParams }>, reply: FastifyReply) => {
      const presence = await presenceService.getPresence(request.params.userId);

      if (!presence) {
        return reply.send({
          success: true,
          data: {
            userId: request.params.userId,
            status: 'OFFLINE',
            lastSeenAt: null,
          },
        });
      }

      // Only return public presence info (not typing details)
      return reply.send({
        success: true,
        data: {
          userId: presence.userId,
          status: presence.status,
          lastSeenAt: presence.lastSeenAt,
        },
      });
    }
  );

  // Get multiple users' presence
  fastify.post<{ Body: GetMultiplePresenceBody }>(
    '/batch',
    {
      schema: {
        description: 'Get presence for multiple users',
        tags: ['Presence'],
        body: {
          type: 'object',
          required: ['userIds'],
          properties: {
            userIds: {
              type: 'array',
              items: { type: 'string' },
              maxItems: 100,
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                additionalProperties: {
                  type: 'object',
                  properties: {
                    userId: { type: 'string' },
                    status: { type: 'string' },
                    lastSeenAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request: FastifyRequest<{ Body: GetMultiplePresenceBody }>, reply: FastifyReply) => {
      const presenceMap = await presenceService.getMultiplePresence(request.body.userIds);

      // Convert to plain object with only public info
      const result: Record<string, { userId: string; status: string; lastSeenAt: Date | null }> =
        {};

      for (const [userId, presence] of presenceMap) {
        result[userId] = {
          userId: presence.userId,
          status: presence.status,
          lastSeenAt: presence.lastSeenAt,
        };
      }

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // Register push token
  fastify.post<{ Body: RegisterPushTokenBody }>(
    '/push-tokens',
    {
      schema: {
        description: 'Register a push notification token',
        tags: ['Presence', 'Push Notifications'],
        body: {
          type: 'object',
          required: ['token', 'platform', 'deviceId'],
          properties: {
            token: { type: 'string' },
            platform: { type: 'string', enum: ['ios', 'android', 'web'] },
            deviceId: { type: 'string' },
            deviceName: { type: 'string' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request: FastifyRequest<{ Body: RegisterPushTokenBody }>, reply: FastifyReply) => {
      const userId = getUserId(request);
      // The schema expects lowercase but the type expects uppercase
      const platform = request.body.platform.toUpperCase() as 'IOS' | 'ANDROID' | 'WEB';
      await presenceService.registerPushToken(userId, {
        token: request.body.token,
        platform,
        deviceId: request.body.deviceId,
      });

      return reply.status(201).send({
        success: true,
        message: 'Push token registered',
      });
    }
  );

  // Remove push token
  fastify.delete<{ Body: RemovePushTokenBody }>(
    '/push-tokens',
    {
      schema: {
        description: 'Remove a push notification token',
        tags: ['Presence', 'Push Notifications'],
        body: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string' },
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
      } as OpenAPISchema,
    },
    async (request: FastifyRequest<{ Body: RemovePushTokenBody }>, reply: FastifyReply) => {
      const userId = getUserId(request);
      await presenceService.removePushToken(userId, request.body.token);

      return reply.send({
        success: true,
        message: 'Push token removed',
      });
    }
  );

  // Get user's push tokens (for debugging/management)
  fastify.get(
    '/push-tokens',
    {
      schema: {
        description: "Get current user's registered push tokens",
        tags: ['Presence', 'Push Notifications'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    platform: { type: 'string' },
                    deviceId: { type: 'string' },
                    deviceName: { type: 'string' },
                    registeredAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserId(request);
      const tokens = await presenceService.getPushTokens(userId);

      // Mask tokens for security (only show last 8 chars)
      const maskedTokens = tokens.map((t) => ({
        ...t,
        token: `****${t.token.slice(-8)}`,
      }));

      return reply.send({
        success: true,
        data: maskedTokens,
      });
    }
  );
}

