/**
 * @module @skillancer/market-svc/services/presence
 * Service for managing user presence, typing indicators, and push notifications
 */

import type {
  PresenceInfo,
  UpdatePresenceParams,
  PushTokenData,
} from '../types/messaging.types.js';
import type { PrismaClient, Prisma } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

export interface PresenceService {
  getPresence(userId: string): Promise<PresenceInfo | null>;
  getMultiplePresence(userIds: string[]): Promise<Map<string, PresenceInfo>>;
  updatePresence(userId: string, params: UpdatePresenceParams): Promise<void>;
  setOnline(userId: string): Promise<void>;
  setOffline(userId: string): Promise<void>;
  setTyping(userId: string, conversationId: string, isTyping: boolean): Promise<void>;
  setCurrentConversation(userId: string, conversationId: string | null): Promise<void>;
  registerPushToken(userId: string, tokenData: PushTokenData): Promise<void>;
  removePushToken(userId: string, token: string): Promise<void>;
  getPushTokens(userId: string): Promise<PushTokenData[]>;
  cleanupStalePresence(staleThresholdMs: number): Promise<number>;
}

export interface PresenceServiceDependencies {
  prisma: PrismaClient;
  logger: Logger;
}

export function createPresenceService(deps: PresenceServiceDependencies): PresenceService {
  const { prisma, logger } = deps;

  const TYPING_TIMEOUT_MS = 5000; // 5 seconds

  return {
    async getPresence(userId: string): Promise<PresenceInfo | null> {
      const presence = await prisma.userPresence.findUnique({
        where: { userId },
      });

      if (!presence) return null;

      // Check if typing is stale
      const isTypingStale =
        presence.isTypingIn &&
        presence.typingStartedAt &&
        Date.now() - presence.typingStartedAt.getTime() > TYPING_TIMEOUT_MS;

      return {
        userId: presence.userId,
        status: presence.status,
        lastSeenAt: presence.lastSeenAt,
        currentConversationId: presence.currentConversationId,
        isTyping: isTypingStale ? false : !!presence.isTypingIn,
        typingInConversationId: isTypingStale ? null : presence.isTypingIn,
      };
    },

    async getMultiplePresence(userIds: string[]): Promise<Map<string, PresenceInfo>> {
      const presences = await prisma.userPresence.findMany({
        where: { userId: { in: userIds } },
      });

      const result = new Map<string, PresenceInfo>();

      for (const presence of presences) {
        const isTypingStale =
          presence.isTypingIn &&
          presence.typingStartedAt &&
          Date.now() - presence.typingStartedAt.getTime() > TYPING_TIMEOUT_MS;

        result.set(presence.userId, {
          userId: presence.userId,
          status: presence.status,
          lastSeenAt: presence.lastSeenAt,
          currentConversationId: presence.currentConversationId,
          isTyping: isTypingStale ? false : !!presence.isTypingIn,
          typingInConversationId: isTypingStale ? null : presence.isTypingIn,
        });
      }

      // Add offline entries for users not found
      for (const userId of userIds) {
        if (!result.has(userId)) {
          result.set(userId, {
            userId,
            status: 'OFFLINE',
            lastSeenAt: null,
            currentConversationId: null,
            isTyping: false,
            typingInConversationId: null,
          });
        }
      }

      return result;
    },

    async updatePresence(userId: string, params: UpdatePresenceParams): Promise<void> {
      const data: Record<string, unknown> = {
        lastSeenAt: new Date(),
      };

      if (params.status !== undefined) {
        data.status = params.status;
      }

      if (params.currentConversationId !== undefined) {
        data.currentConversationId = params.currentConversationId;
      }

      if (params.isTyping !== undefined) {
        data.isTypingIn = params.isTyping ? params.typingInConversationId : null;
        if (params.isTyping) {
          data.typingStartedAt = new Date();
        } else {
          data.typingStartedAt = null;
        }
      }

      await prisma.userPresence.upsert({
        where: { userId },
        create: {
          userId,
          status: params.status ?? 'ONLINE',
          lastSeenAt: new Date(),
          currentConversationId: params.currentConversationId ?? null,
          isTypingIn: params.isTyping ? (params.typingInConversationId ?? null) : null,
          typingStartedAt: params.isTyping ? new Date() : null,
        },
        update: data,
      });

      logger.debug({ msg: 'Presence updated', userId, params });
    },

    async setOnline(userId: string): Promise<void> {
      await prisma.userPresence.upsert({
        where: { userId },
        create: {
          userId,
          status: 'ONLINE',
          lastSeenAt: new Date(),
        },
        update: {
          status: 'ONLINE',
          lastSeenAt: new Date(),
        },
      });

      logger.debug({ msg: 'User set online', userId });
    },

    async setOffline(userId: string): Promise<void> {
      await prisma.userPresence.upsert({
        where: { userId },
        create: {
          userId,
          status: 'OFFLINE',
          lastSeenAt: new Date(),
        },
        update: {
          status: 'OFFLINE',
          lastSeenAt: new Date(),
          isTypingIn: null,
          typingStartedAt: null,
          currentConversationId: null,
        },
      });

      logger.debug({ msg: 'User set offline', userId });
    },

    async setTyping(userId: string, conversationId: string, isTyping: boolean): Promise<void> {
      await prisma.userPresence.upsert({
        where: { userId },
        create: {
          userId,
          status: 'ONLINE',
          lastSeenAt: new Date(),
          isTypingIn: isTyping ? conversationId : null,
          typingStartedAt: isTyping ? new Date() : null,
        },
        update: {
          isTypingIn: isTyping ? conversationId : null,
          typingStartedAt: isTyping ? new Date() : null,
          lastSeenAt: new Date(),
        },
      });

      logger.debug({ msg: 'Typing indicator updated', userId, conversationId, isTyping });
    },

    async setCurrentConversation(userId: string, conversationId: string | null): Promise<void> {
      await prisma.userPresence.upsert({
        where: { userId },
        create: {
          userId,
          status: 'ONLINE',
          lastSeenAt: new Date(),
          currentConversationId: conversationId,
        },
        update: {
          currentConversationId: conversationId,
          lastSeenAt: new Date(),
        },
      });

      logger.debug({ msg: 'Current conversation updated', userId, conversationId });
    },

    async registerPushToken(userId: string, tokenData: PushTokenData): Promise<void> {
      const presence = await prisma.userPresence.findUnique({
        where: { userId },
      });

      const existingTokens = (presence?.pushTokens as unknown as PushTokenData[]) ?? [];

      // Remove existing token with same token value (to update device info)
      const filteredTokens = existingTokens.filter((t) => t.token !== tokenData.token);

      // Add new token
      const updatedTokens = [...filteredTokens, tokenData];

      await prisma.userPresence.upsert({
        where: { userId },
        create: {
          userId,
          status: 'OFFLINE',
          lastSeenAt: new Date(),
          pushTokens: updatedTokens as unknown as Prisma.InputJsonValue,
        },
        update: {
          pushTokens: updatedTokens as unknown as Prisma.InputJsonValue,
        },
      });

      logger.debug({
        msg: 'Push token registered',
        userId,
        platform: tokenData.platform,
        deviceId: tokenData.deviceId,
      });
    },

    async removePushToken(userId: string, token: string): Promise<void> {
      const presence = await prisma.userPresence.findUnique({
        where: { userId },
      });

      if (!presence) return;

      const existingTokens = (presence.pushTokens as unknown as PushTokenData[]) ?? [];
      const filteredTokens = existingTokens.filter((t) => t.token !== token);

      await prisma.userPresence.update({
        where: { userId },
        data: {
          pushTokens: filteredTokens as unknown as Prisma.InputJsonValue,
        },
      });

      logger.debug({ msg: 'Push token removed', userId });
    },

    async getPushTokens(userId: string): Promise<PushTokenData[]> {
      const presence = await prisma.userPresence.findUnique({
        where: { userId },
        select: { pushTokens: true },
      });

      if (!presence) return [];

      return (presence.pushTokens as unknown as PushTokenData[]) ?? [];
    },

    async cleanupStalePresence(staleThresholdMs: number): Promise<number> {
      const staleThreshold = new Date(Date.now() - staleThresholdMs);

      // Set stale online users to offline
      const result = await prisma.userPresence.updateMany({
        where: {
          status: 'ONLINE',
          lastSeenAt: { lt: staleThreshold },
        },
        data: {
          status: 'OFFLINE',
          isTypingIn: null,
          typingStartedAt: null,
          currentConversationId: null,
        },
      });

      if (result.count > 0) {
        logger.info({
          msg: 'Cleaned up stale presence entries',
          count: result.count,
          staleThresholdMs,
        });
      }

      return result.count;
    },
  };
}
