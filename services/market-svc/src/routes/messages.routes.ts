// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * @module @skillancer/market-svc/routes/messages
 * REST API routes for message operations
 */

import { createConversationRepository } from '../repositories/conversation.repository.js';
import { createMessageRepository } from '../repositories/message.repository.js';
import { createMessageService } from '../services/message.service.js';
import { createPresenceService } from '../services/presence.service.js';

import type {
  MessageListOptions,
  MessageSearchParams,
  CreateMessageParams,
  RichContent,
  MessageAttachmentData,
} from '../types/messaging.types.js';
import type { PrismaClient, ConversationContentType } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance, FastifyRequest, FastifyReply, FastifySchema } from 'fastify';

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

// Helper to get authenticated user ID with proper null check
function getUserId(request: FastifyRequest): string {
  const user = (request as AuthenticatedRequest).user;
  if (!user) {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
  }
  return user.id;
}

export interface MessageRoutesDeps {
  prisma: PrismaClient;
  logger: Logger;
}

interface ConversationParams {
  conversationId: string;
}

interface MessageParams {
  messageId: string;
}

interface ConversationMessageParams extends ConversationParams, MessageParams {}

interface SendMessageBody {
  content?: string;
  contentType?: ConversationContentType;
  richContent?: Record<string, unknown>;
  attachments?: Array<{
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    storageKey: string;
    thumbnailUrl?: string;
  }>;
  parentMessageId?: string;
  mentions?: string[];
}

interface EditMessageBody {
  content: string;
}

interface DeleteMessageBody {
  deleteForAll?: boolean;
}

interface ListMessagesQuery {
  limit?: number;
  before?: string;
  after?: string;
  includeDeleted?: boolean;
}

interface ThreadMessagesQuery {
  limit?: number;
  before?: string;
}

interface SearchMessagesQuery {
  query?: string;
  conversationId?: string;
  fromUserId?: string;
  hasAttachments?: boolean;
  after?: string;
  before?: string;
  limit?: number;
  offset?: number;
}

export function registerMessageRoutes(fastify: FastifyInstance, deps: MessageRoutesDeps): void {
  const { prisma, logger } = deps;

  // Initialize repositories and services
  const messageRepository = createMessageRepository(prisma);
  const conversationRepository = createConversationRepository(prisma);
  const presenceService = createPresenceService({ prisma, logger });
  const messageService = createMessageService({
    prisma,
    logger,
    messageRepository,
    conversationRepository,
    presenceService,
  });

  // Send message to conversation
  fastify.post<{ Params: ConversationParams; Body: SendMessageBody }>(
    '/:conversationId/messages',
    {
      schema: {
        description: 'Send a message to a conversation',
        tags: ['Messages'],
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
            content: { type: 'string' },
            contentType: {
              type: 'string',
              enum: [
                'TEXT',
                'RICH_TEXT',
                'IMAGE',
                'FILE',
                'AUDIO',
                'VIDEO',
                'CODE',
                'LINK',
                'LOCATION',
                'CONTACT',
                'POLL',
                'SYSTEM',
              ],
              default: 'TEXT',
            },
            richContent: { type: 'object' },
            attachments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  fileName: { type: 'string' },
                  fileType: { type: 'string' },
                  fileSize: { type: 'number' },
                  storageKey: { type: 'string' },
                  thumbnailUrl: { type: 'string' },
                },
              },
            },
            parentMessageId: { type: 'string' },
            mentions: {
              type: 'array',
              items: { type: 'string' },
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
    async (
      request: FastifyRequest<{ Params: ConversationParams; Body: SendMessageBody }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(request);
      const params: CreateMessageParams = {
        senderUserId: userId,
        conversationId: request.params.conversationId,
        contentType: request.body.contentType ?? 'TEXT',
      };
      if (request.body.content) params.content = request.body.content;
      if (request.body.richContent)
        params.richContent = request.body.richContent as unknown as RichContent;
      if (request.body.attachments)
        params.attachments = request.body.attachments as unknown as MessageAttachmentData[];
      if (request.body.parentMessageId) params.parentMessageId = request.body.parentMessageId;
      if (request.body.mentions) params.mentions = request.body.mentions;

      const message = await messageService.sendMessage(userId, params);

      return reply.status(201).send({
        success: true,
        data: message,
      });
    }
  );

  // Get messages in conversation
  fastify.get<{ Params: ConversationParams; Querystring: ListMessagesQuery }>(
    '/:conversationId/messages',
    {
      schema: {
        description: 'Get messages in a conversation',
        tags: ['Messages'],
        params: {
          type: 'object',
          required: ['conversationId'],
          properties: {
            conversationId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
            before: { type: 'string', description: 'Message ID to fetch before' },
            after: { type: 'string', description: 'Message ID to fetch after' },
            includeDeleted: { type: 'boolean', default: false },
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
                  messages: { type: 'array' },
                  hasMore: { type: 'boolean' },
                },
              },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (
      request: FastifyRequest<{
        Params: ConversationParams;
        Querystring: ListMessagesQuery;
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(request);
      const query = request.query;
      const options: MessageListOptions = {
        limit: query.limit ?? 50,
        includeDeleted: query.includeDeleted ?? false,
      };
      if (query.before) options.before = query.before;
      if (query.after) options.after = query.after;
      const result = await messageService.getMessages(
        userId,
        request.params.conversationId,
        options
      );

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // Get single message
  fastify.get<{ Params: ConversationMessageParams }>(
    '/:conversationId/messages/:messageId',
    {
      schema: {
        description: 'Get a specific message',
        tags: ['Messages'],
        params: {
          type: 'object',
          required: ['conversationId', 'messageId'],
          properties: {
            conversationId: { type: 'string' },
            messageId: { type: 'string' },
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
    async (request: FastifyRequest<{ Params: ConversationMessageParams }>, reply: FastifyReply) => {
      const userId = getUserId(request);
      const message = await messageService.getMessage(userId, request.params.messageId);

      return reply.send({
        success: true,
        data: message,
      });
    }
  );

  // Edit message
  fastify.patch<{ Params: ConversationMessageParams; Body: EditMessageBody }>(
    '/:conversationId/messages/:messageId',
    {
      schema: {
        description: 'Edit a message',
        tags: ['Messages'],
        params: {
          type: 'object',
          required: ['conversationId', 'messageId'],
          properties: {
            conversationId: { type: 'string' },
            messageId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['content'],
          properties: {
            content: { type: 'string' },
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
    async (
      request: FastifyRequest<{
        Params: ConversationMessageParams;
        Body: EditMessageBody;
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(request);
      const message = await messageService.editMessage(
        userId,
        request.params.messageId,
        request.body.content
      );

      return reply.send({
        success: true,
        data: message,
      });
    }
  );

  // Delete message
  fastify.delete<{ Params: ConversationMessageParams; Body: DeleteMessageBody }>(
    '/:conversationId/messages/:messageId',
    {
      schema: {
        description: 'Delete a message',
        tags: ['Messages'],
        params: {
          type: 'object',
          required: ['conversationId', 'messageId'],
          properties: {
            conversationId: { type: 'string' },
            messageId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            deleteForAll: { type: 'boolean', default: false },
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
    async (
      request: FastifyRequest<{
        Params: ConversationMessageParams;
        Body: DeleteMessageBody;
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(request);
      await messageService.deleteMessage(
        userId,
        request.params.messageId,
        request.body.deleteForAll ?? false
      );

      return reply.send({
        success: true,
        message: 'Message deleted',
      });
    }
  );

  // Get thread replies
  fastify.get<{ Params: ConversationMessageParams; Querystring: ThreadMessagesQuery }>(
    '/:conversationId/messages/:messageId/thread',
    {
      schema: {
        description: 'Get replies to a message (thread)',
        tags: ['Messages'],
        params: {
          type: 'object',
          required: ['conversationId', 'messageId'],
          properties: {
            conversationId: { type: 'string' },
            messageId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
            before: { type: 'string' },
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
                  messages: { type: 'array' },
                  hasMore: { type: 'boolean' },
                },
              },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (
      request: FastifyRequest<{
        Params: ConversationMessageParams;
        Querystring: ThreadMessagesQuery;
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(request);
      const query = request.query;
      const options: { before?: string; limit?: number } = { limit: query.limit ?? 50 };
      if (query.before) options.before = query.before;
      const result = await messageService.getThreadMessages(
        userId,
        request.params.messageId,
        options
      );

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // Add reaction
  fastify.post<{
    Params: ConversationMessageParams;
    Body: { emoji: string };
  }>(
    '/:conversationId/messages/:messageId/reactions',
    {
      schema: {
        description: 'Add a reaction to a message',
        tags: ['Messages'],
        params: {
          type: 'object',
          required: ['conversationId', 'messageId'],
          properties: {
            conversationId: { type: 'string' },
            messageId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['emoji'],
          properties: {
            emoji: { type: 'string' },
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
    async (
      request: FastifyRequest<{
        Params: ConversationMessageParams;
        Body: { emoji: string };
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(request);
      const result = await messageService.addReaction(
        userId,
        request.params.messageId,
        request.body.emoji
      );

      return reply.status(201).send({
        success: true,
        data: result,
      });
    }
  );

  // Remove reaction
  fastify.delete<{
    Params: ConversationMessageParams & { emoji: string };
  }>(
    '/:conversationId/messages/:messageId/reactions/:emoji',
    {
      schema: {
        description: 'Remove a reaction from a message',
        tags: ['Messages'],
        params: {
          type: 'object',
          required: ['conversationId', 'messageId', 'emoji'],
          properties: {
            conversationId: { type: 'string' },
            messageId: { type: 'string' },
            emoji: { type: 'string' },
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
    async (
      request: FastifyRequest<{
        Params: ConversationMessageParams & { emoji: string };
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(request);
      await messageService.removeReaction(userId, request.params.messageId, request.params.emoji);

      return reply.send({
        success: true,
        message: 'Reaction removed',
      });
    }
  );

  // Mark as read
  fastify.post<{ Params: ConversationMessageParams }>(
    '/:conversationId/messages/:messageId/read',
    {
      schema: {
        description: 'Mark a message as read',
        tags: ['Messages'],
        params: {
          type: 'object',
          required: ['conversationId', 'messageId'],
          properties: {
            conversationId: { type: 'string' },
            messageId: { type: 'string' },
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
    async (request: FastifyRequest<{ Params: ConversationMessageParams }>, reply: FastifyReply) => {
      const userId = getUserId(request);
      await messageService.markAsRead(
        userId,
        request.params.conversationId,
        request.params.messageId
      );

      return reply.send({
        success: true,
        message: 'Message marked as read',
      });
    }
  );

  // Pin message
  fastify.post<{ Params: ConversationMessageParams }>(
    '/:conversationId/messages/:messageId/pin',
    {
      schema: {
        description: 'Pin a message',
        tags: ['Messages'],
        params: {
          type: 'object',
          required: ['conversationId', 'messageId'],
          properties: {
            conversationId: { type: 'string' },
            messageId: { type: 'string' },
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
    async (request: FastifyRequest<{ Params: ConversationMessageParams }>, reply: FastifyReply) => {
      const userId = getUserId(request);
      const message = await messageService.pinMessage(userId, request.params.messageId);

      return reply.send({
        success: true,
        data: message,
      });
    }
  );

  // Unpin message
  fastify.post<{ Params: ConversationMessageParams }>(
    '/:conversationId/messages/:messageId/unpin',
    {
      schema: {
        description: 'Unpin a message',
        tags: ['Messages'],
        params: {
          type: 'object',
          required: ['conversationId', 'messageId'],
          properties: {
            conversationId: { type: 'string' },
            messageId: { type: 'string' },
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
    async (request: FastifyRequest<{ Params: ConversationMessageParams }>, reply: FastifyReply) => {
      const userId = getUserId(request);
      await messageService.unpinMessage(userId, request.params.messageId);

      return reply.send({
        success: true,
        message: 'Message unpinned',
      });
    }
  );

  // Get pinned messages
  fastify.get<{ Params: ConversationParams }>(
    '/:conversationId/messages/pinned',
    {
      schema: {
        description: 'Get pinned messages in a conversation',
        tags: ['Messages'],
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
              data: { type: 'array' },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request: FastifyRequest<{ Params: ConversationParams }>, reply: FastifyReply) => {
      const userId = getUserId(request);
      const messages = await messageService.getPinnedMessages(
        userId,
        request.params.conversationId
      );

      return reply.send({
        success: true,
        data: messages,
      });
    }
  );

  // Search messages
  fastify.get<{ Querystring: SearchMessagesQuery }>(
    '/search',
    {
      schema: {
        description: 'Search messages',
        tags: ['Messages'],
        querystring: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            conversationId: { type: 'string' },
            fromUserId: { type: 'string' },
            hasAttachments: { type: 'boolean' },
            after: { type: 'string', format: 'date-time' },
            before: { type: 'string', format: 'date-time' },
            limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
            offset: { type: 'number', minimum: 0, default: 0 },
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
                  messages: { type: 'array' },
                  total: { type: 'number' },
                  hasMore: { type: 'boolean' },
                },
              },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request: FastifyRequest<{ Querystring: SearchMessagesQuery }>, reply: FastifyReply) => {
      const userId = getUserId(request);
      const query = request.query;
      const searchOptions: MessageSearchParams = {
        userId,
        query: query.query ?? '',
        limit: query.limit ?? 50,
        offset: query.offset ?? 0,
      };
      if (query.conversationId) searchOptions.conversationId = query.conversationId;
      if (query.fromUserId) searchOptions.fromUserId = query.fromUserId;
      if (query.hasAttachments !== undefined) searchOptions.hasAttachments = query.hasAttachments;
      if (query.after) searchOptions.startDate = new Date(query.after);
      if (query.before) searchOptions.endDate = new Date(query.before);
      const result = await messageService.searchMessages(userId, searchOptions);

      return reply.send({
        success: true,
        data: result,
      });
    }
  );
}

