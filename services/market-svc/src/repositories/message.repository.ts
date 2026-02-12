// @ts-nocheck
/**
 * @module @skillancer/market-svc/repositories/message
 * Repository for message CRUD operations
 */

import type { MessageListOptions } from '../types/messaging.types.js';
import type {
  ConversationMessage,
  ConversationMessageReaction,
  ConversationMessageReadReceipt,
  ConversationContentType,
  ConversationMessageType,
  Prisma,
  PrismaClient,
  SystemMessageEventType,
} from '../types/prisma-shim.js';

export interface CreateMessageData {
  conversationId: string;
  senderUserId: string;
  content?: string | null;
  contentType: ConversationContentType;
  richContent?: Record<string, unknown> | null;
  attachments?: Record<string, unknown>[] | null;
  parentMessageId?: string | null;
  mentions?: string[];
  messageType: ConversationMessageType;
  systemEventType?: SystemMessageEventType | null;
  systemEventData?: Record<string, unknown> | null;
  deliveredAt?: Date | null;
}

export interface MessageRepository {
  create(data: CreateMessageData): Promise<ConversationMessage>;
  findById(id: string): Promise<ConversationMessage | null>;
  findByIdWithSender(id: string): Promise<MessageWithSenderData | null>;
  findByConversation(
    conversationId: string,
    options: MessageListOptions
  ): Promise<MessageWithSenderData[]>;
  findThreadMessages(
    parentMessageId: string,
    options: { before?: string; limit?: number }
  ): Promise<MessageWithSenderData[]>;
  findPinned(conversationId: string): Promise<MessageWithSenderData[]>;
  update(id: string, data: Partial<ConversationMessage>): Promise<ConversationMessage>;
  incrementThreadCount(parentMessageId: string): Promise<void>;
  createReaction(data: {
    messageId: string;
    userId: string;
    emoji: string;
  }): Promise<ConversationMessageReaction>;
  deleteReaction(data: { messageId: string; userId: string; emoji: string }): Promise<void>;
  getReactions(messageId: string): Promise<ConversationMessageReaction[]>;
  createReadReceipt(data: {
    messageId: string;
    userId: string;
    readAt: Date;
  }): Promise<ConversationMessageReadReceipt>;
  getReadReceipts(messageId: string): Promise<ConversationMessageReadReceipt[]>;
}

export interface MessageWithSenderData extends ConversationMessage {
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export function createMessageRepository(prisma: PrismaClient): MessageRepository {
  return {
    async create(data: CreateMessageData): Promise<ConversationMessage> {
      const createData: Parameters<typeof prisma.conversationMessage.create>[0]['data'] = {
        conversationId: data.conversationId,
        senderUserId: data.senderUserId,
        content: data.content ?? null,
        contentType: data.contentType,
        parentMessageId: data.parentMessageId ?? null,
        mentions: data.mentions ?? [],
        messageType: data.messageType,
        systemEventType: data.systemEventType ?? null,
        deliveredAt: data.deliveredAt ?? null,
      };

      if (data.richContent !== undefined && data.richContent !== null) {
        createData.richContent = data.richContent as Prisma.InputJsonValue;
      }
      if (data.attachments !== undefined && data.attachments !== null) {
        createData.attachments = data.attachments as Prisma.InputJsonValue;
      }
      if (data.systemEventData !== undefined && data.systemEventData !== null) {
        createData.systemEventData = data.systemEventData as Prisma.InputJsonValue;
      }

      return prisma.conversationMessage.create({
        data: createData,
      });
    },

    async findById(id: string): Promise<ConversationMessage | null> {
      return prisma.conversationMessage.findUnique({
        where: { id },
      });
    },

    async findByIdWithSender(id: string): Promise<MessageWithSenderData | null> {
      return prisma.conversationMessage.findUnique({
        where: { id },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      }) as Promise<MessageWithSenderData | null>;
    },

    async findByConversation(
      conversationId: string,
      options: MessageListOptions
    ): Promise<MessageWithSenderData[]> {
      const limit = options.limit ?? 50;

      const where: Record<string, unknown> = {
        conversationId,
        parentMessageId: null, // Only top-level messages
      };

      if (!options.includeDeleted) {
        where.isDeleted = false;
      }

      if (options.before) {
        const beforeMessage = await prisma.conversationMessage.findUnique({
          where: { id: options.before },
          select: { createdAt: true },
        });
        if (beforeMessage) {
          where.createdAt = { lt: beforeMessage.createdAt };
        }
      }

      if (options.after) {
        const afterMessage = await prisma.conversationMessage.findUnique({
          where: { id: options.after },
          select: { createdAt: true },
        });
        if (afterMessage) {
          where.createdAt = { gt: afterMessage.createdAt };
        }
      }

      return prisma.conversationMessage.findMany({
        where,
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }) as Promise<MessageWithSenderData[]>;
    },

    async findThreadMessages(
      parentMessageId: string,
      options: { before?: string; limit?: number }
    ): Promise<MessageWithSenderData[]> {
      const limit = options.limit ?? 50;

      const where: Record<string, unknown> = {
        parentMessageId,
        isDeleted: false,
      };

      if (options.before) {
        const beforeMessage = await prisma.conversationMessage.findUnique({
          where: { id: options.before },
          select: { createdAt: true },
        });
        if (beforeMessage) {
          where.createdAt = { lt: beforeMessage.createdAt };
        }
      }

      return prisma.conversationMessage.findMany({
        where,
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
      }) as Promise<MessageWithSenderData[]>;
    },

    async findPinned(conversationId: string): Promise<MessageWithSenderData[]> {
      return prisma.conversationMessage.findMany({
        where: {
          conversationId,
          isPinned: true,
          isDeleted: false,
        },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { pinnedAt: 'desc' },
      }) as Promise<MessageWithSenderData[]>;
    },

    async update(id: string, data: Partial<ConversationMessage>): Promise<ConversationMessage> {
      return prisma.conversationMessage.update({
        where: { id },
        data: data as Record<string, unknown>,
      });
    },

    async incrementThreadCount(parentMessageId: string): Promise<void> {
      await prisma.conversationMessage.update({
        where: { id: parentMessageId },
        data: { threadCount: { increment: 1 } },
      });
    },

    async createReaction(data: {
      messageId: string;
      userId: string;
      emoji: string;
    }): Promise<ConversationMessageReaction> {
      return prisma.conversationMessageReaction.upsert({
        where: {
          messageId_userId_emoji: {
            messageId: data.messageId,
            userId: data.userId,
            emoji: data.emoji,
          },
        },
        create: {
          messageId: data.messageId,
          userId: data.userId,
          emoji: data.emoji,
        },
        update: {},
      });
    },

    async deleteReaction(data: {
      messageId: string;
      userId: string;
      emoji: string;
    }): Promise<void> {
      await prisma.conversationMessageReaction.deleteMany({
        where: {
          messageId: data.messageId,
          userId: data.userId,
          emoji: data.emoji,
        },
      });
    },

    async getReactions(messageId: string): Promise<ConversationMessageReaction[]> {
      return prisma.conversationMessageReaction.findMany({
        where: { messageId },
      });
    },

    async createReadReceipt(data: {
      messageId: string;
      userId: string;
      readAt: Date;
    }): Promise<ConversationMessageReadReceipt> {
      return prisma.conversationMessageReadReceipt.upsert({
        where: {
          messageId_userId: {
            messageId: data.messageId,
            userId: data.userId,
          },
        },
        create: {
          messageId: data.messageId,
          userId: data.userId,
          readAt: data.readAt,
        },
        update: {
          readAt: data.readAt,
        },
      });
    },

    async getReadReceipts(messageId: string): Promise<ConversationMessageReadReceipt[]> {
      return prisma.conversationMessageReadReceipt.findMany({
        where: { messageId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });
    },
  };
}
