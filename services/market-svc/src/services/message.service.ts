// @ts-nocheck
/**
 * @module @skillancer/market-svc/services/message
 * Service for message business logic
 */

import type { PresenceService } from './presence.service.js';
import type { ConversationRepository } from '../repositories/conversation.repository.js';
import type {
  MessageRepository,
  MessageWithSenderData,
} from '../repositories/message.repository.js';
import type {
  CreateMessageParams,
  MessageListOptions,
  MessageSearchParams,
  MessageSearchResult,
  MessageForClient,
} from '../types/messaging.types.js';
import type {
  PrismaClient,
  ConversationContentType,
  ConversationMessageType,
} from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

export interface MessageServiceDependencies {
  prisma: PrismaClient;
  logger: Logger;
  messageRepository: MessageRepository;
  conversationRepository: ConversationRepository;
  presenceService: PresenceService;
}

export interface MessageService {
  sendMessage(userId: string, params: CreateMessageParams): Promise<MessageForClient>;
  getMessages(
    userId: string,
    conversationId: string,
    options: MessageListOptions
  ): Promise<{ messages: MessageForClient[]; hasMore: boolean }>;
  getThreadMessages(
    userId: string,
    parentMessageId: string,
    options: { before?: string; limit?: number }
  ): Promise<{ messages: MessageForClient[]; hasMore: boolean }>;
  getMessage(userId: string, messageId: string): Promise<MessageForClient>;
  editMessage(userId: string, messageId: string, content: string): Promise<MessageForClient>;
  deleteMessage(userId: string, messageId: string, deleteForAll: boolean): Promise<void>;
  addReaction(
    userId: string,
    messageId: string,
    emoji: string
  ): Promise<{ messageId: string; emoji: string; userId: string }>;
  removeReaction(userId: string, messageId: string, emoji: string): Promise<void>;
  markAsRead(userId: string, conversationId: string, messageId: string): Promise<void>;
  pinMessage(userId: string, messageId: string): Promise<MessageForClient>;
  unpinMessage(userId: string, messageId: string): Promise<void>;
  getPinnedMessages(userId: string, conversationId: string): Promise<MessageForClient[]>;
  searchMessages(userId: string, params: MessageSearchParams): Promise<MessageSearchResult>;
}

function formatMessageForClient(message: MessageWithSenderData): MessageForClient {
  return {
    id: message.id,
    conversationId: message.conversationId,
    sender: {
      id: message.sender.id,
      firstName: message.sender.firstName,
      lastName: message.sender.lastName,
      displayName: message.sender.displayName,
      avatarUrl: message.sender.avatarUrl,
    },
    content: message.content,
    contentType: message.contentType,
    richContent: message.richContent as Record<string, unknown> | null,
    attachments: message.attachments as Record<string, unknown>[] | null,
    parentMessageId: message.parentMessageId,
    threadCount: message.threadCount,
    mentions: message.mentions,
    messageType: message.messageType,
    systemEventType: message.systemEventType,
    systemEventData: message.systemEventData as Record<string, unknown> | null,
    isEdited: message.isEdited,
    editedAt: message.editedAt,
    isDeleted: message.isDeleted,
    isPinned: message.isPinned,
    pinnedAt: message.pinnedAt,
    createdAt: message.createdAt,
    deliveredAt: message.deliveredAt,
  };
}

export function createMessageService(deps: MessageServiceDependencies): MessageService {
  const { prisma, logger, messageRepository, conversationRepository, presenceService } = deps;

  return {
    async sendMessage(userId: string, params: CreateMessageParams): Promise<MessageForClient> {
      // Verify user is participant
      const isParticipant = await conversationRepository.isParticipant(
        params.conversationId,
        userId
      );

      if (!isParticipant) {
        throw Object.assign(new Error('Not a participant in this conversation'), {
          statusCode: 403,
          code: 'NOT_PARTICIPANT',
        });
      }

      // Check participant permissions
      const participant = await conversationRepository.getParticipant(
        params.conversationId,
        userId
      );

      if (!participant?.canSendMessages) {
        throw Object.assign(new Error('You cannot send messages in this conversation'), {
          statusCode: 403,
          code: 'CANNOT_SEND_MESSAGES',
        });
      }

      // If replying to a message, verify parent exists
      if (params.parentMessageId) {
        const parentMessage = await messageRepository.findById(params.parentMessageId);
        if (!parentMessage || parentMessage.conversationId !== params.conversationId) {
          throw Object.assign(new Error('Parent message not found'), {
            statusCode: 404,
            code: 'PARENT_MESSAGE_NOT_FOUND',
          });
        }
      }

      // Create the message
      const message = await messageRepository.create({
        conversationId: params.conversationId,
        senderUserId: userId,
        content: params.content ?? null,
        contentType: params.contentType ?? ('TEXT' as ConversationContentType),
        richContent: params.richContent
          ? (params.richContent as unknown as Record<string, unknown>)
          : null,
        attachments: params.attachments
          ? (params.attachments as unknown as Record<string, unknown>[])
          : null,
        parentMessageId: params.parentMessageId ?? null,
        mentions: params.mentions ?? [],
        messageType: 'USER' as ConversationMessageType,
        deliveredAt: new Date(),
      });

      // Update conversation last message
      await conversationRepository.updateLastMessage(
        params.conversationId,
        message.id,
        message.createdAt
      );

      // Update parent thread count if reply
      if (params.parentMessageId) {
        await messageRepository.incrementThreadCount(params.parentMessageId);
      }

      // Stop typing indicator
      await presenceService.setTyping(userId, params.conversationId, false);

      // Fetch full message with sender
      const fullMessage = await messageRepository.findByIdWithSender(message.id);
      if (!fullMessage) {
        throw new Error('Failed to retrieve created message');
      }

      logger.info({
        msg: 'Message sent',
        messageId: message.id,
        conversationId: params.conversationId,
        userId,
      });

      return formatMessageForClient(fullMessage);
    },

    async getMessages(
      userId: string,
      conversationId: string,
      options: MessageListOptions
    ): Promise<{ messages: MessageForClient[]; hasMore: boolean }> {
      // Verify user is participant
      const isParticipant = await conversationRepository.isParticipant(conversationId, userId);

      if (!isParticipant) {
        throw Object.assign(new Error('Not a participant in this conversation'), {
          statusCode: 403,
          code: 'NOT_PARTICIPANT',
        });
      }

      const limit = options.limit ?? 50;
      const messages = await messageRepository.findByConversation(conversationId, {
        ...options,
        limit: limit + 1, // Fetch one extra to check if there are more
      });

      const hasMore = messages.length > limit;
      const resultMessages = hasMore ? messages.slice(0, limit) : messages;

      return {
        messages: resultMessages.map(formatMessageForClient),
        hasMore,
      };
    },

    async getThreadMessages(
      userId: string,
      parentMessageId: string,
      options: { before?: string; limit?: number }
    ): Promise<{ messages: MessageForClient[]; hasMore: boolean }> {
      // Get parent message to verify conversation access
      const parentMessage = await messageRepository.findById(parentMessageId);
      if (!parentMessage) {
        throw Object.assign(new Error('Parent message not found'), {
          statusCode: 404,
          code: 'MESSAGE_NOT_FOUND',
        });
      }

      // Verify user is participant
      const isParticipant = await conversationRepository.isParticipant(
        parentMessage.conversationId,
        userId
      );

      if (!isParticipant) {
        throw Object.assign(new Error('Not a participant in this conversation'), {
          statusCode: 403,
          code: 'NOT_PARTICIPANT',
        });
      }

      const limit = options.limit ?? 50;
      const messages = await messageRepository.findThreadMessages(parentMessageId, {
        ...options,
        limit: limit + 1,
      });

      const hasMore = messages.length > limit;
      const resultMessages = hasMore ? messages.slice(0, limit) : messages;

      return {
        messages: resultMessages.map(formatMessageForClient),
        hasMore,
      };
    },

    async getMessage(userId: string, messageId: string): Promise<MessageForClient> {
      const message = await messageRepository.findByIdWithSender(messageId);

      if (!message) {
        throw Object.assign(new Error('Message not found'), {
          statusCode: 404,
          code: 'MESSAGE_NOT_FOUND',
        });
      }

      // Verify user is participant
      const isParticipant = await conversationRepository.isParticipant(
        message.conversationId,
        userId
      );

      if (!isParticipant) {
        throw Object.assign(new Error('Not a participant in this conversation'), {
          statusCode: 403,
          code: 'NOT_PARTICIPANT',
        });
      }

      return formatMessageForClient(message);
    },

    async editMessage(
      userId: string,
      messageId: string,
      content: string
    ): Promise<MessageForClient> {
      const message = await messageRepository.findById(messageId);

      if (!message) {
        throw Object.assign(new Error('Message not found'), {
          statusCode: 404,
          code: 'MESSAGE_NOT_FOUND',
        });
      }

      // Only sender can edit
      if (message.senderUserId !== userId) {
        throw Object.assign(new Error('Cannot edit message you did not send'), {
          statusCode: 403,
          code: 'NOT_MESSAGE_SENDER',
        });
      }

      // Cannot edit system messages
      if (message.messageType !== 'USER') {
        throw Object.assign(new Error('Cannot edit system messages'), {
          statusCode: 400,
          code: 'CANNOT_EDIT_SYSTEM_MESSAGE',
        });
      }

      // Store edit history
      const editHistory = (message.editHistory as Record<string, unknown>[]) ?? [];
      editHistory.push({
        content: message.content,
        editedAt: new Date().toISOString(),
      });

      await messageRepository.update(messageId, {
        content,
        isEdited: true,
        editedAt: new Date(),
        editHistory: editHistory as unknown as typeof message.editHistory,
      });

      const updatedMessage = await messageRepository.findByIdWithSender(messageId);
      if (!updatedMessage) {
        throw new Error('Failed to retrieve updated message');
      }

      logger.info({ msg: 'Message edited', messageId, userId });

      return formatMessageForClient(updatedMessage);
    },

    async deleteMessage(userId: string, messageId: string, deleteForAll: boolean): Promise<void> {
      const message = await messageRepository.findById(messageId);

      if (!message) {
        throw Object.assign(new Error('Message not found'), {
          statusCode: 404,
          code: 'MESSAGE_NOT_FOUND',
        });
      }

      // Only sender can delete for all
      if (deleteForAll && message.senderUserId !== userId) {
        // Check if participant has delete permission (OWNER, ADMIN, or MODERATOR)
        const participant = await conversationRepository.getParticipant(
          message.conversationId,
          userId
        );

        const canDeleteMessages =
          participant?.role === 'OWNER' ||
          participant?.role === 'ADMIN' ||
          participant?.role === 'MODERATOR';

        if (!canDeleteMessages) {
          throw Object.assign(new Error('Cannot delete messages'), {
            statusCode: 403,
            code: 'CANNOT_DELETE_MESSAGE',
          });
        }
      }

      if (deleteForAll) {
        await messageRepository.update(messageId, {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userId,
          content: null,
          richContent: null,
          attachments: null,
        });
      } else {
        // Delete for self only - we cannot track this without a metadata field
        // For now, just mark as deleted for the current user using the isDeleted flag
        // A proper implementation would require a separate table or the richContent field
        await messageRepository.update(messageId, {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userId,
        });
      }

      logger.info({ msg: 'Message deleted', messageId, userId, deleteForAll });
    },

    async addReaction(
      userId: string,
      messageId: string,
      emoji: string
    ): Promise<{ messageId: string; emoji: string; userId: string }> {
      const message = await messageRepository.findById(messageId);

      if (!message) {
        throw Object.assign(new Error('Message not found'), {
          statusCode: 404,
          code: 'MESSAGE_NOT_FOUND',
        });
      }

      // Verify user is participant
      const isParticipant = await conversationRepository.isParticipant(
        message.conversationId,
        userId
      );

      if (!isParticipant) {
        throw Object.assign(new Error('Not a participant in this conversation'), {
          statusCode: 403,
          code: 'NOT_PARTICIPANT',
        });
      }

      await messageRepository.createReaction({ messageId, userId, emoji });

      logger.debug({ msg: 'Reaction added', messageId, userId, emoji });

      return { messageId, emoji, userId };
    },

    async removeReaction(userId: string, messageId: string, emoji: string): Promise<void> {
      await messageRepository.deleteReaction({ messageId, userId, emoji });

      logger.debug({ msg: 'Reaction removed', messageId, userId, emoji });
    },

    async markAsRead(userId: string, conversationId: string, messageId: string): Promise<void> {
      // Verify user is participant
      const isParticipant = await conversationRepository.isParticipant(conversationId, userId);

      if (!isParticipant) {
        throw Object.assign(new Error('Not a participant in this conversation'), {
          statusCode: 403,
          code: 'NOT_PARTICIPANT',
        });
      }

      const now = new Date();

      // Update participant read position
      await conversationRepository.updateParticipantReadPosition(
        conversationId,
        userId,
        messageId,
        now
      );

      // Create read receipt
      await messageRepository.createReadReceipt({
        messageId,
        userId,
        readAt: now,
      });

      logger.debug({ msg: 'Message marked as read', conversationId, messageId, userId });
    },

    async pinMessage(userId: string, messageId: string): Promise<MessageForClient> {
      const message = await messageRepository.findById(messageId);

      if (!message) {
        throw Object.assign(new Error('Message not found'), {
          statusCode: 404,
          code: 'MESSAGE_NOT_FOUND',
        });
      }

      // Check permission (OWNER, ADMIN, or MODERATOR can pin)
      const participant = await conversationRepository.getParticipant(
        message.conversationId,
        userId
      );

      const canPinMessages =
        participant?.role === 'OWNER' ||
        participant?.role === 'ADMIN' ||
        participant?.role === 'MODERATOR';

      if (!canPinMessages) {
        throw Object.assign(new Error('Cannot pin messages'), {
          statusCode: 403,
          code: 'CANNOT_PIN_MESSAGE',
        });
      }

      await messageRepository.update(messageId, {
        isPinned: true,
        pinnedAt: new Date(),
        pinnedBy: userId,
      });

      const updatedMessage = await messageRepository.findByIdWithSender(messageId);
      if (!updatedMessage) {
        throw new Error('Failed to retrieve pinned message');
      }

      logger.info({ msg: 'Message pinned', messageId, userId });

      return formatMessageForClient(updatedMessage);
    },

    async unpinMessage(userId: string, messageId: string): Promise<void> {
      const message = await messageRepository.findById(messageId);

      if (!message) {
        throw Object.assign(new Error('Message not found'), {
          statusCode: 404,
          code: 'MESSAGE_NOT_FOUND',
        });
      }

      // Check permission (OWNER, ADMIN, or MODERATOR can unpin)
      const participant = await conversationRepository.getParticipant(
        message.conversationId,
        userId
      );

      const canPinMessages =
        participant?.role === 'OWNER' ||
        participant?.role === 'ADMIN' ||
        participant?.role === 'MODERATOR';

      if (!canPinMessages) {
        throw Object.assign(new Error('Cannot unpin messages'), {
          statusCode: 403,
          code: 'CANNOT_PIN_MESSAGE',
        });
      }

      await messageRepository.update(messageId, {
        isPinned: false,
        pinnedAt: null,
        pinnedBy: null,
      });

      logger.info({ msg: 'Message unpinned', messageId, userId });
    },

    async getPinnedMessages(userId: string, conversationId: string): Promise<MessageForClient[]> {
      // Verify user is participant
      const isParticipant = await conversationRepository.isParticipant(conversationId, userId);

      if (!isParticipant) {
        throw Object.assign(new Error('Not a participant in this conversation'), {
          statusCode: 403,
          code: 'NOT_PARTICIPANT',
        });
      }

      const messages = await messageRepository.findPinned(conversationId);
      return messages.map(formatMessageForClient);
    },

    async searchMessages(
      userId: string,
      params: MessageSearchParams
    ): Promise<MessageSearchResult> {
      // Get user's conversation IDs
      const conversationIds = params.conversationId
        ? [params.conversationId]
        : await conversationRepository.getUserConversationIds(userId);

      // If specific conversation, verify access
      if (params.conversationId) {
        const isParticipant = await conversationRepository.isParticipant(
          params.conversationId,
          userId
        );

        if (!isParticipant) {
          throw Object.assign(new Error('Not a participant in this conversation'), {
            statusCode: 403,
            code: 'NOT_PARTICIPANT',
          });
        }
      }

      const limit = params.limit ?? 50;
      const offset = params.offset ?? 0;

      // Build where clause
      const where: Record<string, unknown> = {
        conversationId: { in: conversationIds },
        isDeleted: false,
      };

      if (params.query) {
        where.content = {
          contains: params.query,
          mode: 'insensitive',
        };
      }

      if (params.fromUserId) {
        where.senderUserId = params.fromUserId;
      }

      if (params.after) {
        where.createdAt = { gte: params.after };
      }

      if (params.before) {
        const existingCreatedAt = where.createdAt as Record<string, unknown> | undefined;
        where.createdAt = {
          ...existingCreatedAt,
          lte: params.before,
        };
      }

      if (params.hasAttachments) {
        where.NOT = { attachments: { equals: null } };
      }

      // Get total count
      const total = await prisma.conversationMessage.count({ where });

      // Get messages
      const messages = await prisma.conversationMessage.findMany({
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
        skip: offset,
      });

      return {
        messages: (messages as MessageWithSenderData[]).map(formatMessageForClient),
        total,
        hasMore: offset + messages.length < total,
      };
    },
  };
}
