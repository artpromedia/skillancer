// @ts-nocheck
/**
 * @module @skillancer/market-svc/services/conversation
 * Service for conversation lifecycle management
 */

import type {
  ConversationRepository,
  ConversationWithDetails,
} from '../repositories/conversation.repository.js';
import type { MessageRepository } from '../repositories/message.repository.js';
import type {
  CreateConversationParams,
  ConversationListOptions,
} from '../types/messaging.types.js';
import type {
  PrismaClient,
  ConversationType,
  ParticipantRole,
  SystemMessageEventType,
  ConversationContentType,
  ConversationMessageType,
} from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

export interface ConversationServiceDependencies {
  prisma: PrismaClient;
  logger: Logger;
  conversationRepository: ConversationRepository;
  messageRepository: MessageRepository;
}

export interface ConversationForClient {
  id: string;
  type: ConversationType;
  title: string | null;
  description: string | null;
  participants: ParticipantForClient[];
  lastMessage?: LastMessageForClient | null;
  unreadCount: number;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParticipantForClient {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: ParticipantRole;
  canSendMessages: boolean;
  joinedAt: Date;
}

export interface LastMessageForClient {
  id: string;
  content: string | null;
  senderUserId: string;
  senderName: string;
  createdAt: Date;
}

export interface ConversationService {
  createConversation(
    userId: string,
    params: CreateConversationParams
  ): Promise<ConversationForClient>;
  getOrCreateDirectConversation(
    userId: string,
    otherUserId: string
  ): Promise<ConversationForClient>;
  getConversation(userId: string, conversationId: string): Promise<ConversationForClient>;
  getConversations(
    userId: string,
    options: ConversationListOptions
  ): Promise<{ conversations: ConversationForClient[]; hasMore: boolean }>;
  updateConversation(
    userId: string,
    conversationId: string,
    data: { title?: string; description?: string }
  ): Promise<ConversationForClient>;
  archiveConversation(userId: string, conversationId: string): Promise<void>;
  unarchiveConversation(userId: string, conversationId: string): Promise<void>;
  pinConversation(userId: string, conversationId: string): Promise<void>;
  unpinConversation(userId: string, conversationId: string): Promise<void>;
  muteConversation(userId: string, conversationId: string, muted: boolean): Promise<void>;
  addParticipant(
    userId: string,
    conversationId: string,
    targetUserId: string,
    role?: ParticipantRole
  ): Promise<ParticipantForClient>;
  removeParticipant(userId: string, conversationId: string, targetUserId: string): Promise<void>;
  leaveConversation(userId: string, conversationId: string): Promise<void>;
  getUnreadCount(userId: string, conversationId: string): Promise<number>;
  getTotalUnreadCount(userId: string): Promise<number>;
}

function formatConversationForClient(
  conversation: ConversationWithDetails,
  userId: string,
  unreadCount: number = 0
): ConversationForClient {
  const userParticipant = conversation.participants.find((p) => p.userId === userId);

  return {
    id: conversation.id,
    type: conversation.type,
    title: conversation.title,
    description: conversation.description,
    participants: conversation.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      firstName: p.user.firstName,
      lastName: p.user.lastName,
      displayName: p.user.displayName,
      avatarUrl: p.user.avatarUrl,
      role: p.role,
      canSendMessages: p.canSendMessages,
      joinedAt: p.joinedAt,
    })),
    lastMessage: conversation.lastMessage
      ? {
          id: conversation.lastMessage.id,
          content: conversation.lastMessage.content,
          senderUserId: conversation.lastMessage.senderUserId,
          senderName:
            conversation.lastMessage.sender.displayName ??
            `${conversation.lastMessage.sender.firstName} ${conversation.lastMessage.sender.lastName}`,
          createdAt: conversation.lastMessage.createdAt,
        }
      : null,
    unreadCount,
    isPinned: userParticipant?.isPinned ?? false,
    isArchived: userParticipant?.isArchivedByUser ?? false,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

export function createConversationService(
  deps: ConversationServiceDependencies
): ConversationService {
  const { logger, conversationRepository, messageRepository } = deps;

  async function createSystemMessage(
    conversationId: string,
    eventType: SystemMessageEventType,
    eventData: Record<string, unknown>,
    actorUserId: string
  ): Promise<void> {
    await messageRepository.create({
      conversationId,
      senderUserId: actorUserId,
      content: null,
      contentType: 'TEXT' as ConversationContentType,
      messageType: 'SYSTEM' as ConversationMessageType,
      systemEventType: eventType,
      systemEventData: eventData,
      mentions: [],
    });
  }

  return {
    async createConversation(
      userId: string,
      params: CreateConversationParams
    ): Promise<ConversationForClient> {
      // Validate participant count
      if (params.type === 'DIRECT' && params.participantUserIds.length !== 2) {
        throw Object.assign(new Error('Direct conversations must have exactly 2 participants'), {
          statusCode: 400,
          code: 'INVALID_PARTICIPANT_COUNT',
        });
      }

      if (params.type === 'DIRECT' && !params.participantUserIds.includes(userId)) {
        throw Object.assign(new Error('You must be a participant in direct conversations'), {
          statusCode: 400,
          code: 'MUST_BE_PARTICIPANT',
        });
      }

      // Check for existing direct conversation
      if (params.type === 'DIRECT') {
        const otherUserId = params.participantUserIds.find((id) => id !== userId);
        if (otherUserId) {
          const existing = await conversationRepository.findDirectBetweenUsers(userId, otherUserId);
          if (existing) {
            const fullConversation = await conversationRepository.findById(existing.id);
            if (fullConversation) {
              return formatConversationForClient(fullConversation, userId);
            }
          }
        }
      }

      // Create conversation
      const conversation = await conversationRepository.create({
        ...params,
        createdByUserId: userId,
      });

      // Create system message for group creation
      if (params.type === 'GROUP') {
        await createSystemMessage(
          conversation.id,
          'CONVERSATION_CREATED',
          { createdBy: userId, title: params.title },
          userId
        );
      }

      logger.info({
        msg: 'Conversation created',
        conversationId: conversation.id,
        type: params.type,
        userId,
      });

      return formatConversationForClient(conversation, userId);
    },

    async getOrCreateDirectConversation(
      userId: string,
      otherUserId: string
    ): Promise<ConversationForClient> {
      // Check for existing
      const existing = await conversationRepository.findDirectBetweenUsers(userId, otherUserId);

      if (existing) {
        const fullConversation = await conversationRepository.findById(existing.id);
        if (fullConversation) {
          const unreadCount = await conversationRepository.getUnreadCount(existing.id, userId);
          return formatConversationForClient(fullConversation, userId, unreadCount);
        }
      }

      // Create new direct conversation
      const conversation = await conversationRepository.create({
        type: 'DIRECT' as ConversationType,
        participantUserIds: [userId, otherUserId],
        createdByUserId: userId,
      });

      return formatConversationForClient(conversation, userId);
    },

    async getConversation(userId: string, conversationId: string): Promise<ConversationForClient> {
      const conversation = await conversationRepository.findById(conversationId);

      if (!conversation) {
        throw Object.assign(new Error('Conversation not found'), {
          statusCode: 404,
          code: 'CONVERSATION_NOT_FOUND',
        });
      }

      // Verify user is participant
      const isParticipant = await conversationRepository.isParticipant(conversationId, userId);

      if (!isParticipant) {
        throw Object.assign(new Error('Not a participant in this conversation'), {
          statusCode: 403,
          code: 'NOT_PARTICIPANT',
        });
      }

      const unreadCount = await conversationRepository.getUnreadCount(conversationId, userId);

      return formatConversationForClient(conversation, userId, unreadCount);
    },

    async getConversations(
      userId: string,
      options: ConversationListOptions
    ): Promise<{ conversations: ConversationForClient[]; hasMore: boolean }> {
      const limit = options.limit ?? 50;
      const conversations = await conversationRepository.findByUser(userId, {
        ...options,
        limit: limit + 1,
      });

      const hasMore = conversations.length > limit;
      const resultConversations = hasMore ? conversations.slice(0, limit) : conversations;

      // Get unread counts for all conversations
      const conversationsWithUnread = await Promise.all(
        resultConversations.map(async (conv) => {
          const unreadCount = await conversationRepository.getUnreadCount(conv.id, userId);
          return formatConversationForClient(conv, userId, unreadCount);
        })
      );

      return {
        conversations: conversationsWithUnread,
        hasMore,
      };
    },

    async updateConversation(
      userId: string,
      conversationId: string,
      data: { title?: string; description?: string }
    ): Promise<ConversationForClient> {
      const conversation = await conversationRepository.findById(conversationId);

      if (!conversation) {
        throw Object.assign(new Error('Conversation not found'), {
          statusCode: 404,
          code: 'CONVERSATION_NOT_FOUND',
        });
      }

      // Check permission
      const participant = await conversationRepository.getParticipant(conversationId, userId);

      if (!participant?.canEditSettings) {
        throw Object.assign(new Error('Cannot edit this conversation'), {
          statusCode: 403,
          code: 'CANNOT_EDIT_CONVERSATION',
        });
      }

      const updateData: Record<string, unknown> = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;

      await conversationRepository.update(conversationId, updateData);

      // Create system message
      if (data.title !== undefined) {
        await createSystemMessage(
          conversationId,
          'CONVERSATION_UPDATED' as SystemMessageEventType,
          { oldTitle: conversation.title, newTitle: data.title, changedBy: userId },
          userId
        );
      }

      const updated = await conversationRepository.findById(conversationId);
      if (!updated) {
        throw new Error('Failed to retrieve updated conversation');
      }

      logger.info({ msg: 'Conversation updated', conversationId, userId });

      return formatConversationForClient(updated, userId);
    },

    async archiveConversation(userId: string, conversationId: string): Promise<void> {
      const isParticipant = await conversationRepository.isParticipant(conversationId, userId);

      if (!isParticipant) {
        throw Object.assign(new Error('Not a participant in this conversation'), {
          statusCode: 403,
          code: 'NOT_PARTICIPANT',
        });
      }

      await conversationRepository.updateParticipant(conversationId, userId, {
        isArchivedByUser: true,
      });

      logger.debug({ msg: 'Conversation archived', conversationId, userId });
    },

    async unarchiveConversation(userId: string, conversationId: string): Promise<void> {
      const isParticipant = await conversationRepository.isParticipant(conversationId, userId);

      if (!isParticipant) {
        throw Object.assign(new Error('Not a participant in this conversation'), {
          statusCode: 403,
          code: 'NOT_PARTICIPANT',
        });
      }

      await conversationRepository.updateParticipant(conversationId, userId, {
        isArchivedByUser: false,
      });

      logger.debug({ msg: 'Conversation unarchived', conversationId, userId });
    },

    async pinConversation(userId: string, conversationId: string): Promise<void> {
      const isParticipant = await conversationRepository.isParticipant(conversationId, userId);

      if (!isParticipant) {
        throw Object.assign(new Error('Not a participant in this conversation'), {
          statusCode: 403,
          code: 'NOT_PARTICIPANT',
        });
      }

      await conversationRepository.updateParticipant(conversationId, userId, {
        isPinned: true,
        pinnedAt: new Date(),
      });

      logger.debug({ msg: 'Conversation pinned', conversationId, userId });
    },

    async unpinConversation(userId: string, conversationId: string): Promise<void> {
      const isParticipant = await conversationRepository.isParticipant(conversationId, userId);

      if (!isParticipant) {
        throw Object.assign(new Error('Not a participant in this conversation'), {
          statusCode: 403,
          code: 'NOT_PARTICIPANT',
        });
      }

      await conversationRepository.updateParticipant(conversationId, userId, {
        isPinned: false,
        pinnedAt: null,
      });

      logger.debug({ msg: 'Conversation unpinned', conversationId, userId });
    },

    async muteConversation(userId: string, conversationId: string, muted: boolean): Promise<void> {
      const isParticipant = await conversationRepository.isParticipant(conversationId, userId);

      if (!isParticipant) {
        throw Object.assign(new Error('Not a participant in this conversation'), {
          statusCode: 403,
          code: 'NOT_PARTICIPANT',
        });
      }

      await conversationRepository.updateParticipant(conversationId, userId, {
        notificationsEnabled: !muted,
      });

      logger.debug({
        msg: 'Conversation mute status updated',
        conversationId,
        userId,
        muted,
      });
    },

    async addParticipant(
      userId: string,
      conversationId: string,
      targetUserId: string,
      role: ParticipantRole = 'MEMBER'
    ): Promise<ParticipantForClient> {
      const conversation = await conversationRepository.findById(conversationId);

      if (!conversation) {
        throw Object.assign(new Error('Conversation not found'), {
          statusCode: 404,
          code: 'CONVERSATION_NOT_FOUND',
        });
      }

      // Check permission
      const participant = await conversationRepository.getParticipant(conversationId, userId);

      if (!participant?.canAddParticipants) {
        throw Object.assign(new Error('Cannot add participants'), {
          statusCode: 403,
          code: 'CANNOT_ADD_PARTICIPANTS',
        });
      }

      // Cannot add to direct conversations
      if (conversation.type === 'DIRECT') {
        throw Object.assign(new Error('Cannot add participants to direct conversations'), {
          statusCode: 400,
          code: 'CANNOT_ADD_TO_DIRECT',
        });
      }

      // Check if already participant
      const existingParticipant = await conversationRepository.getParticipant(
        conversationId,
        targetUserId
      );

      if (existingParticipant) {
        throw Object.assign(new Error('User is already a participant'), {
          statusCode: 400,
          code: 'ALREADY_PARTICIPANT',
        });
      }

      const newParticipant = await conversationRepository.addParticipant({
        conversationId,
        userId: targetUserId,
        role,
        canSendMessages: true,
      });

      logger.debug({ msg: 'Added participant to conversation', participantId: newParticipant.id });

      // Fetch participant with user details
      const participantWithUser = await conversationRepository.getParticipant(
        conversationId,
        targetUserId
      );

      if (!participantWithUser) {
        throw new Error('Failed to retrieve added participant');
      }

      // Create system message
      await createSystemMessage(
        conversationId,
        'PARTICIPANT_JOINED',
        { addedUserId: targetUserId, addedBy: userId },
        userId
      );

      logger.info({
        msg: 'Participant added',
        conversationId,
        targetUserId,
        addedBy: userId,
      });

      return {
        id: participantWithUser.id,
        userId: participantWithUser.userId,
        firstName: participantWithUser.user.firstName,
        lastName: participantWithUser.user.lastName,
        displayName: participantWithUser.user.displayName,
        avatarUrl: participantWithUser.user.avatarUrl,
        role: participantWithUser.role,
        canSendMessages: participantWithUser.canSendMessages,
        joinedAt: participantWithUser.joinedAt,
      };
    },

    async removeParticipant(
      userId: string,
      conversationId: string,
      targetUserId: string
    ): Promise<void> {
      const conversation = await conversationRepository.findById(conversationId);

      if (!conversation) {
        throw Object.assign(new Error('Conversation not found'), {
          statusCode: 404,
          code: 'CONVERSATION_NOT_FOUND',
        });
      }

      // Check permission
      const participant = await conversationRepository.getParticipant(conversationId, userId);

      if (!participant?.canRemoveParticipants) {
        throw Object.assign(new Error('Cannot remove participants'), {
          statusCode: 403,
          code: 'CANNOT_REMOVE_PARTICIPANTS',
        });
      }

      // Cannot remove from direct conversations
      if (conversation.type === 'DIRECT') {
        throw Object.assign(new Error('Cannot remove participants from direct conversations'), {
          statusCode: 400,
          code: 'CANNOT_REMOVE_FROM_DIRECT',
        });
      }

      await conversationRepository.removeParticipant(conversationId, targetUserId);

      // Create system message
      await createSystemMessage(
        conversationId,
        'PARTICIPANT_REMOVED',
        { removedUserId: targetUserId, removedBy: userId },
        userId
      );

      logger.info({
        msg: 'Participant removed',
        conversationId,
        targetUserId,
        removedBy: userId,
      });
    },

    async leaveConversation(userId: string, conversationId: string): Promise<void> {
      const conversation = await conversationRepository.findById(conversationId);

      if (!conversation) {
        throw Object.assign(new Error('Conversation not found'), {
          statusCode: 404,
          code: 'CONVERSATION_NOT_FOUND',
        });
      }

      // Cannot leave direct conversations
      if (conversation.type === 'DIRECT') {
        throw Object.assign(new Error('Cannot leave direct conversations'), {
          statusCode: 400,
          code: 'CANNOT_LEAVE_DIRECT',
        });
      }

      await conversationRepository.removeParticipant(conversationId, userId);

      // Create system message
      await createSystemMessage(conversationId, 'PARTICIPANT_LEFT', { userId }, userId);

      logger.info({ msg: 'User left conversation', conversationId, userId });
    },

    async getUnreadCount(userId: string, conversationId: string): Promise<number> {
      return conversationRepository.getUnreadCount(conversationId, userId);
    },

    async getTotalUnreadCount(userId: string): Promise<number> {
      const conversationIds = await conversationRepository.getUserConversationIds(userId);

      let total = 0;
      for (const conversationId of conversationIds) {
        const count = await conversationRepository.getUnreadCount(conversationId, userId);
        total += count;
      }

      return total;
    },
  };
}
