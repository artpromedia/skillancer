// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * @module @skillancer/market-svc/routes/conversations
 * REST API routes for conversation management
 */

import { createConversationRepository } from '../repositories/conversation.repository.js';
import { createMessageRepository } from '../repositories/message.repository.js';
import { createConversationService } from '../services/conversation.service.js';

import type { ConversationListOptions } from '../types/messaging.types.js';
import type { PrismaClient, ConversationType, ParticipantRole } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance, FastifyRequest, FastifySchema } from 'fastify';

// Type alias for OpenAPI-compatible schemas
type OpenAPISchema = FastifySchema & {
  tags?: string[];
  summary?: string;
  description?: string;
};

// Authenticated request type
interface AuthenticatedRequest extends FastifyRequest {
  user?: { id: string; email: string };
}

export interface ConversationRoutesDeps {
  prisma: PrismaClient;
  logger: Logger;
}

interface CreateConversationBody {
  type: ConversationType;
  title?: string;
  description?: string;
  participantUserIds: string[];
  contractId?: string;
  jobId?: string;
  bidId?: string;
  serviceOrderId?: string;
  disputeId?: string;
  metadata?: Record<string, unknown>;
}

interface UpdateConversationBody {
  title?: string;
  description?: string;
}

interface ListConversationsQuery {
  limit?: number;
  cursor?: string;
  type?: ConversationType;
  archived?: boolean;
  pinned?: boolean;
  unreadOnly?: boolean;
}

interface ConversationParams {
  conversationId: string;
}

interface AddParticipantBody {
  userId: string;
  role?: ParticipantRole;
}

interface RemoveParticipantParams extends ConversationParams {
  userId: string;
}

// Helper to get authenticated user ID with proper null check
function getUserId(request: FastifyRequest): string {
  const user = (request as AuthenticatedRequest).user;
  if (!user) {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
  }
  return user.id;
}

export function registerConversationRoutes(
  fastify: FastifyInstance,
  deps: ConversationRoutesDeps
): void {
  const { prisma, logger } = deps;

  // Initialize repositories and services
  const conversationRepository = createConversationRepository(prisma);
  const messageRepository = createMessageRepository(prisma);
  const conversationService = createConversationService({
    prisma,
    logger,
    conversationRepository,
    messageRepository,
  });

  // Create conversation
  fastify.post<{ Body: CreateConversationBody }>(
    '/',
    {
      schema: {
        description: 'Create a new conversation',
        tags: ['Conversations'],
        body: {
          type: 'object',
          required: ['type', 'participantUserIds'],
          properties: {
            type: {
              type: 'string',
              enum: [
                'DIRECT',
                'PROJECT',
                'CONTRACT',
                'BID',
                'SERVICE_ORDER',
                'DISPUTE',
                'SUPPORT',
                'GROUP',
              ],
            },
            title: { type: 'string' },
            description: { type: 'string' },
            participantUserIds: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
            },
            contractId: { type: 'string' },
            jobId: { type: 'string' },
            bidId: { type: 'string' },
            serviceOrderId: { type: 'string' },
            disputeId: { type: 'string' },
            metadata: { type: 'object' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const body = request.body;
      const conversation = await conversationService.createConversation(userId, {
        ...body,
        createdByUserId: userId,
      });

      return reply.status(201).send({
        success: true,
        data: conversation,
      });
    }
  );

  // Get or create direct conversation
  fastify.post<{ Body: { otherUserId: string } }>(
    '/direct',
    {
      schema: {
        description: 'Get or create a direct conversation with another user',
        tags: ['Conversations'],
        body: {
          type: 'object',
          required: ['otherUserId'],
          properties: {
            otherUserId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const body = request.body as { otherUserId: string };
      const conversation = await conversationService.getOrCreateDirectConversation(
        userId,
        body.otherUserId
      );

      return reply.send({
        success: true,
        data: conversation,
      });
    }
  );

  // List user's conversations
  fastify.get<{ Querystring: ListConversationsQuery }>(
    '/',
    {
      schema: {
        description: "Get user's conversations",
        tags: ['Conversations'],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
            cursor: { type: 'string' },
            type: {
              type: 'string',
              enum: [
                'DIRECT',
                'PROJECT',
                'CONTRACT',
                'BID',
                'SERVICE_ORDER',
                'DISPUTE',
                'SUPPORT',
                'GROUP',
              ],
            },
            archived: { type: 'boolean' },
            pinned: { type: 'boolean' },
            unreadOnly: { type: 'boolean' },
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
                  conversations: { type: 'array' },
                  hasMore: { type: 'boolean' },
                },
              },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const query = request.query;

      // Build options conditionally to avoid exactOptionalPropertyTypes issues
      const options: ConversationListOptions = { limit: query.limit ?? 50 };
      if (query.type) options.type = query.type;
      if (query.cursor) options.cursor = query.cursor;
      if (typeof query.archived === 'boolean') options.archived = query.archived;
      if (typeof query.pinned === 'boolean') options.pinned = query.pinned;
      if (typeof query.unreadOnly === 'boolean') options.unreadOnly = query.unreadOnly;

      const result = await conversationService.getConversations(userId, options);

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // Get single conversation
  fastify.get<{ Params: ConversationParams }>(
    '/:conversationId',
    {
      schema: {
        description: 'Get a conversation by ID',
        tags: ['Conversations'],
        params: {
          type: 'object',
          required: ['conversationId'],
          properties: {
            conversationId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const params = request.params;
      const conversation = await conversationService.getConversation(userId, params.conversationId);

      return reply.send({
        success: true,
        data: conversation,
      });
    }
  );

  // Update conversation
  fastify.patch<{ Params: ConversationParams; Body: UpdateConversationBody }>(
    '/:conversationId',
    {
      schema: {
        description: 'Update conversation details',
        tags: ['Conversations'],
        params: {
          type: 'object',
          required: ['conversationId'],
          properties: {
            conversationId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const params = request.params;
      const body = request.body;
      const conversation = await conversationService.updateConversation(
        userId,
        params.conversationId,
        body
      );

      return reply.send({
        success: true,
        data: conversation,
      });
    }
  );

  // Archive conversation
  fastify.post<{ Params: ConversationParams }>(
    '/:conversationId/archive',
    {
      schema: {
        description: 'Archive a conversation',
        tags: ['Conversations'],
        params: {
          type: 'object',
          required: ['conversationId'],
          properties: {
            conversationId: { type: 'string' },
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
    async (request, reply) => {
      const userId = getUserId(request);
      const params = request.params;
      await conversationService.archiveConversation(userId, params.conversationId);

      return reply.send({
        success: true,
        message: 'Conversation archived',
      });
    }
  );

  // Unarchive conversation
  fastify.post<{ Params: ConversationParams }>(
    '/:conversationId/unarchive',
    {
      schema: {
        description: 'Unarchive a conversation',
        tags: ['Conversations'],
        params: {
          type: 'object',
          required: ['conversationId'],
          properties: {
            conversationId: { type: 'string' },
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
    async (request, reply) => {
      const userId = getUserId(request);
      const params = request.params;
      await conversationService.unarchiveConversation(userId, params.conversationId);

      return reply.send({
        success: true,
        message: 'Conversation unarchived',
      });
    }
  );

  // Pin conversation
  fastify.post<{ Params: ConversationParams }>(
    '/:conversationId/pin',
    {
      schema: {
        description: 'Pin a conversation',
        tags: ['Conversations'],
        params: {
          type: 'object',
          required: ['conversationId'],
          properties: {
            conversationId: { type: 'string' },
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
    async (request, reply) => {
      const userId = getUserId(request);
      const params = request.params;
      await conversationService.pinConversation(userId, params.conversationId);

      return reply.send({
        success: true,
        message: 'Conversation pinned',
      });
    }
  );

  // Unpin conversation
  fastify.post<{ Params: ConversationParams }>(
    '/:conversationId/unpin',
    {
      schema: {
        description: 'Unpin a conversation',
        tags: ['Conversations'],
        params: {
          type: 'object',
          required: ['conversationId'],
          properties: {
            conversationId: { type: 'string' },
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
    async (request, reply) => {
      const userId = getUserId(request);
      const params = request.params;
      await conversationService.unpinConversation(userId, params.conversationId);

      return reply.send({
        success: true,
        message: 'Conversation unpinned',
      });
    }
  );

  // Mute conversation
  fastify.post<{ Params: ConversationParams; Body: { muted: boolean } }>(
    '/:conversationId/mute',
    {
      schema: {
        description: 'Mute or unmute a conversation',
        tags: ['Conversations'],
        params: {
          type: 'object',
          required: ['conversationId'],
          properties: {
            conversationId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['muted'],
          properties: {
            muted: { type: 'boolean' },
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
    async (request, reply) => {
      const userId = getUserId(request);
      const params = request.params;
      const body = request.body as { muted: boolean };
      await conversationService.muteConversation(userId, params.conversationId, body.muted);

      return reply.send({
        success: true,
        message: body.muted ? 'Conversation muted' : 'Conversation unmuted',
      });
    }
  );

  // Add participant
  fastify.post<{ Params: ConversationParams; Body: AddParticipantBody }>(
    '/:conversationId/participants',
    {
      schema: {
        description: 'Add a participant to a conversation',
        tags: ['Conversations'],
        params: {
          type: 'object',
          required: ['conversationId'],
          properties: {
            conversationId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string' },
            role: {
              type: 'string',
              enum: ['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER', 'GUEST'],
              default: 'MEMBER',
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const params = request.params;
      const body = request.body;
      // Filter GUEST role since it's not a valid ParticipantRole
      const role: ParticipantRole = body.role ?? 'MEMBER';
      const participant = await conversationService.addParticipant(
        userId,
        params.conversationId,
        body.userId,
        role
      );

      return reply.status(201).send({
        success: true,
        data: participant,
      });
    }
  );

  // Remove participant
  fastify.delete<{ Params: RemoveParticipantParams }>(
    '/:conversationId/participants/:userId',
    {
      schema: {
        description: 'Remove a participant from a conversation',
        tags: ['Conversations'],
        params: {
          type: 'object',
          required: ['conversationId', 'userId'],
          properties: {
            conversationId: { type: 'string' },
            userId: { type: 'string' },
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
    async (request, reply) => {
      const userId = getUserId(request);
      const params = request.params;
      await conversationService.removeParticipant(userId, params.conversationId, params.userId);

      return reply.send({
        success: true,
        message: 'Participant removed',
      });
    }
  );

  // Leave conversation
  fastify.post<{ Params: ConversationParams }>(
    '/:conversationId/leave',
    {
      schema: {
        description: 'Leave a conversation',
        tags: ['Conversations'],
        params: {
          type: 'object',
          required: ['conversationId'],
          properties: {
            conversationId: { type: 'string' },
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
    async (request, reply) => {
      const userId = getUserId(request);
      const params = request.params;
      await conversationService.leaveConversation(userId, params.conversationId);

      return reply.send({
        success: true,
        message: 'Left conversation',
      });
    }
  );

  // Get unread count
  fastify.get<{ Params: ConversationParams }>(
    '/:conversationId/unread',
    {
      schema: {
        description: 'Get unread message count for a conversation',
        tags: ['Conversations'],
        params: {
          type: 'object',
          required: ['conversationId'],
          properties: {
            conversationId: { type: 'string' },
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
                  unreadCount: { type: 'number' },
                },
              },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const params = request.params;
      const unreadCount = await conversationService.getUnreadCount(userId, params.conversationId);

      return reply.send({
        success: true,
        data: { unreadCount },
      });
    }
  );

  // Get total unread count
  fastify.get(
    '/unread/total',
    {
      schema: {
        description: 'Get total unread message count across all conversations',
        tags: ['Conversations'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  totalUnreadCount: { type: 'number' },
                },
              },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const totalUnreadCount = await conversationService.getTotalUnreadCount(userId);

      return reply.send({
        success: true,
        data: { totalUnreadCount },
      });
    }
  );
}
