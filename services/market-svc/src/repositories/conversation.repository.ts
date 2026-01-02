// @ts-nocheck
/**
 * @module @skillancer/market-svc/repositories/conversation
 * Repository for conversation and participant CRUD operations
 */

import type {
  CreateConversationParams,
  ConversationListOptions,
} from '../types/messaging.types.js';
import type {
  Conversation,
  ConversationParticipant,
  ParticipantRole,
  PrismaClient,
  Prisma,
} from '@skillancer/database';

export interface ConversationWithDetails extends Conversation {
  participants: ParticipantWithUser[];
  lastMessage?: MessagePreview | null;
  _count: {
    messages: number;
  };
}

export interface ParticipantWithUser extends ConversationParticipant {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
    avatarUrl: string | null;
    email: string;
  };
}

export interface MessagePreview {
  id: string;
  content: string | null;
  senderUserId: string;
  createdAt: Date;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
  };
}

export interface ConversationRepository {
  create(data: CreateConversationParams): Promise<ConversationWithDetails>;
  findById(id: string): Promise<ConversationWithDetails | null>;
  findByUser(userId: string, options: ConversationListOptions): Promise<ConversationWithDetails[]>;
  findByContract(contractId: string): Promise<Conversation | null>;
  findByJob(jobId: string): Promise<Conversation[]>;
  findByBid(bidId: string): Promise<Conversation | null>;
  findByServiceOrder(serviceOrderId: string): Promise<Conversation | null>;
  findByDispute(disputeId: string): Promise<Conversation | null>;
  findDirectBetweenUsers(userIdA: string, userIdB: string): Promise<Conversation | null>;
  update(id: string, data: Partial<Conversation>): Promise<Conversation>;
  updateLastMessage(conversationId: string, messageId: string, messageAt: Date): Promise<void>;
  getUserConversationIds(userId: string): Promise<string[]>;
  isParticipant(conversationId: string, userId: string): Promise<boolean>;
  getParticipant(conversationId: string, userId: string): Promise<ParticipantWithUser | null>;
  getParticipants(conversationId: string): Promise<ParticipantWithUser[]>;
  addParticipant(data: {
    conversationId: string;
    userId: string;
    role: ParticipantRole;
    canSendMessages?: boolean;
    canAddParticipants?: boolean;
    canRemoveParticipants?: boolean;
    canEditSettings?: boolean;
  }): Promise<ConversationParticipant>;
  removeParticipant(conversationId: string, userId: string): Promise<void>;
  updateParticipant(
    conversationId: string,
    userId: string,
    data: Partial<ConversationParticipant>
  ): Promise<ConversationParticipant>;
  updateParticipantReadPosition(
    conversationId: string,
    userId: string,
    messageId: string,
    readAt: Date
  ): Promise<void>;
  getUnreadCount(conversationId: string, userId: string): Promise<number>;
}

export function createConversationRepository(prisma: PrismaClient): ConversationRepository {
  const participantSelect = {
    id: true,
    conversationId: true,
    userId: true,
    role: true,
    canSendMessages: true,
    canAddParticipants: true,
    canRemoveParticipants: true,
    canEditSettings: true,
    lastReadMessageId: true,
    lastReadAt: true,
    joinedAt: true,
    leftAt: true,
    notificationsEnabled: true,
    isPinned: true,
    pinnedAt: true,
    isArchivedByUser: true,
    isActive: true,
    removedAt: true,
    removedBy: true,
    unreadCount: true,
    mutedUntil: true,
    createdAt: true,
    updatedAt: true,
    user: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatarUrl: true,
        email: true,
      },
    },
  };

  const conversationWithDetailsInclude = {
    participants: {
      where: { leftAt: null },
      select: participantSelect,
    },
    messages: {
      take: 1,
      orderBy: { createdAt: 'desc' as const },
      select: {
        id: true,
        content: true,
        senderUserId: true,
        createdAt: true,
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
      },
    },
    _count: {
      select: { messages: true },
    },
  };

  return {
    async create(data: CreateConversationParams): Promise<ConversationWithDetails> {
      const participantsData = data.participantUserIds.map((userId, index) => ({
        userId,
        role: index === 0 ? ('OWNER' as ParticipantRole) : ('MEMBER' as ParticipantRole),
        canSendMessages: true,
        canAddParticipants: data.type === 'GROUP' && index === 0,
        canRemoveParticipants: data.type === 'GROUP' && index === 0,
        canEditSettings: index === 0,
      }));

      // Build the data object conditionally to avoid exactOptionalPropertyTypes issues
      const createData: Prisma.ConversationCreateInput = {
        type: data.type,
        participants: {
          create: participantsData,
        },
      };
      if (data.title) createData.title = data.title;
      if (data.description) createData.description = data.description;
      if (data.metadata) createData.metadata = data.metadata as Prisma.InputJsonValue;
      if (data.createdByUserId) createData.createdBy = data.createdByUserId;
      if (data.contractId) createData.contractId = data.contractId;
      if (data.jobId) createData.job = { connect: { id: data.jobId } };
      if (data.bidId) createData.bid = { connect: { id: data.bidId } };
      if (data.serviceOrderId) createData.serviceOrder = { connect: { id: data.serviceOrderId } };
      if (data.disputeId) createData.dispute = { connect: { id: data.disputeId } };

      const conversation = await prisma.conversation.create({
        data: createData,
        include: conversationWithDetailsInclude,
      });

      // Cast is needed because TypeScript can't infer include results with const includes
      const result = conversation;

      return {
        ...result,
        participants: result.participants as unknown as ParticipantWithUser[],
        lastMessage: result.messages[0] ?? null,
        _count: result._count,
      };
    },

    async findById(id: string): Promise<ConversationWithDetails | null> {
      const conversation = await prisma.conversation.findUnique({
        where: { id },
        include: conversationWithDetailsInclude,
      });

      if (!conversation) return null;

      // Cast is needed because TypeScript can't infer include results with const includes
      const result = conversation;

      return {
        ...result,
        participants: result.participants as unknown as ParticipantWithUser[],
        lastMessage: result.messages[0] ?? null,
        _count: result._count,
      };
    },

    async findByUser(
      userId: string,
      options: ConversationListOptions
    ): Promise<ConversationWithDetails[]> {
      const limit = options.limit ?? 50;

      const participantWhere: Record<string, unknown> = {
        userId,
        leftAt: null,
      };

      if (options.archived !== undefined) {
        participantWhere.isArchived = options.archived;
      }

      if (options.pinned !== undefined) {
        participantWhere.isPinned = options.pinned;
      }

      const participantIds = await prisma.conversationParticipant.findMany({
        where: participantWhere,
        select: { conversationId: true },
      });

      const conversationIds = participantIds.map((p) => p.conversationId);

      const where: Record<string, unknown> = {
        id: { in: conversationIds },
      };

      if (options.type) {
        where.type = options.type;
      }

      if (options.unreadOnly) {
        // Find conversations with unread messages
        const participantData = await prisma.conversationParticipant.findMany({
          where: {
            userId,
            conversationId: { in: conversationIds },
            leftAt: null,
          },
          select: {
            conversationId: true,
            lastReadAt: true,
          },
        });

        const participantMap = new Map(
          participantData.map((p) => [p.conversationId, p.lastReadAt])
        );

        // Filter to only conversations with messages after lastReadAt
        const unreadConversationIds: string[] = [];
        for (const convId of conversationIds) {
          const lastReadAt = participantMap.get(convId);
          const lastMessage = await prisma.conversationMessage.findFirst({
            where: { conversationId: convId },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          });

          if (lastMessage && (!lastReadAt || lastMessage.createdAt > lastReadAt)) {
            unreadConversationIds.push(convId);
          }
        }

        where.id = { in: unreadConversationIds };
      }

      const conversations = await prisma.conversation.findMany({
        where,
        include: conversationWithDetailsInclude,
        orderBy: { lastMessageAt: 'desc' },
        take: limit,
        ...(options.cursor
          ? {
              cursor: { id: options.cursor },
              skip: 1,
            }
          : {}),
      });

      return conversations.map((conv) => ({
        ...conv,
        participants: conv.participants as ParticipantWithUser[],
        lastMessage: conv.messages[0] ?? null,
      }));
    },

    async findByContract(contractId: string): Promise<Conversation | null> {
      return prisma.conversation.findFirst({
        where: { contractId },
      });
    },

    async findByJob(jobId: string): Promise<Conversation[]> {
      return prisma.conversation.findMany({
        where: { jobId },
      });
    },

    async findByBid(bidId: string): Promise<Conversation | null> {
      return prisma.conversation.findFirst({
        where: { bidId },
      });
    },

    async findByServiceOrder(serviceOrderId: string): Promise<Conversation | null> {
      return prisma.conversation.findFirst({
        where: { serviceOrderId },
      });
    },

    async findByDispute(disputeId: string): Promise<Conversation | null> {
      return prisma.conversation.findFirst({
        where: { disputeId },
      });
    },

    async findDirectBetweenUsers(userIdA: string, userIdB: string): Promise<Conversation | null> {
      // Find DIRECT conversation where both users are participants
      const conversations = await prisma.conversation.findMany({
        where: {
          type: 'DIRECT',
          participants: {
            every: {
              leftAt: null,
            },
          },
        },
        include: {
          participants: {
            where: { leftAt: null },
            select: { userId: true },
          },
        },
      });

      // Find the one with exactly these two users
      return (
        conversations.find((conv) => {
          const userIds = conv.participants.map((p) => p.userId);
          return userIds.length === 2 && userIds.includes(userIdA) && userIds.includes(userIdB);
        }) ?? null
      );
    },

    async update(id: string, data: Partial<Conversation>): Promise<Conversation> {
      return prisma.conversation.update({
        where: { id },
        data: data as Record<string, unknown>,
      });
    },

    async updateLastMessage(
      conversationId: string,
      messageId: string,
      messageAt: Date
    ): Promise<void> {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageId: messageId,
          lastMessageAt: messageAt,
        },
      });
    },

    async getUserConversationIds(userId: string): Promise<string[]> {
      const participants = await prisma.conversationParticipant.findMany({
        where: {
          userId,
          leftAt: null,
        },
        select: { conversationId: true },
      });

      return participants.map((p) => p.conversationId);
    },

    async isParticipant(conversationId: string, userId: string): Promise<boolean> {
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId,
          userId,
          leftAt: null,
        },
      });

      return participant !== null;
    },

    async getParticipant(
      conversationId: string,
      userId: string
    ): Promise<ParticipantWithUser | null> {
      return prisma.conversationParticipant.findFirst({
        where: {
          conversationId,
          userId,
          leftAt: null,
        },
        select: participantSelect,
      }) as Promise<ParticipantWithUser | null>;
    },

    async getParticipants(conversationId: string): Promise<ParticipantWithUser[]> {
      return prisma.conversationParticipant.findMany({
        where: {
          conversationId,
          leftAt: null,
        },
        select: participantSelect,
      }) as Promise<ParticipantWithUser[]>;
    },

    async addParticipant(data: {
      conversationId: string;
      userId: string;
      role: ParticipantRole;
      canSendMessages?: boolean;
      canAddParticipants?: boolean;
      canRemoveParticipants?: boolean;
      canEditSettings?: boolean;
    }): Promise<ConversationParticipant> {
      // Check if participant exists but left
      const existing = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId: data.conversationId,
          userId: data.userId,
        },
      });

      if (existing) {
        // Re-add participant
        return prisma.conversationParticipant.update({
          where: { id: existing.id },
          data: {
            leftAt: null,
            role: data.role,
            joinedAt: new Date(),
            canSendMessages: data.canSendMessages ?? true,
            canAddParticipants: data.canAddParticipants ?? false,
            canRemoveParticipants: data.canRemoveParticipants ?? false,
            canEditSettings: data.canEditSettings ?? false,
          },
        });
      }

      return prisma.conversationParticipant.create({
        data: {
          conversationId: data.conversationId,
          userId: data.userId,
          role: data.role,
          canSendMessages: data.canSendMessages ?? true,
          canAddParticipants: data.canAddParticipants ?? false,
          canRemoveParticipants: data.canRemoveParticipants ?? false,
          canEditSettings: data.canEditSettings ?? false,
        },
      });
    },

    async removeParticipant(conversationId: string, userId: string): Promise<void> {
      await prisma.conversationParticipant.updateMany({
        where: {
          conversationId,
          userId,
          leftAt: null,
        },
        data: {
          leftAt: new Date(),
        },
      });
    },

    async updateParticipant(
      conversationId: string,
      userId: string,
      data: Partial<ConversationParticipant>
    ): Promise<ConversationParticipant> {
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId,
          userId,
          leftAt: null,
        },
      });

      if (!participant) {
        throw new Error('Participant not found');
      }

      return prisma.conversationParticipant.update({
        where: { id: participant.id },
        data: data as Record<string, unknown>,
      });
    },

    async updateParticipantReadPosition(
      conversationId: string,
      userId: string,
      messageId: string,
      readAt: Date
    ): Promise<void> {
      await prisma.conversationParticipant.updateMany({
        where: {
          conversationId,
          userId,
          leftAt: null,
        },
        data: {
          lastReadMessageId: messageId,
          lastReadAt: readAt,
        },
      });
    },

    async getUnreadCount(conversationId: string, userId: string): Promise<number> {
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId,
          userId,
          leftAt: null,
        },
        select: { lastReadAt: true },
      });

      if (!participant) return 0;

      const count = await prisma.conversationMessage.count({
        where: {
          conversationId,
          isDeleted: false,
          senderUserId: { not: userId },
          ...(participant.lastReadAt ? { createdAt: { gt: participant.lastReadAt } } : {}),
        },
      });

      return count;
    },
  };
}

