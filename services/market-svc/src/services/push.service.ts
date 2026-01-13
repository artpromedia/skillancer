/**
 * @module @skillancer/market-svc/services/push
 * Push notification service using Firebase Cloud Messaging
 */

import type { SendPushParams, PushServiceConfig } from '../types/notification.types.js';
import type { PrismaClient } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';

export type PushPlatform = 'ios' | 'android' | 'web';

export interface PushService {
  send(params: SendPushParams): Promise<{ messageId: string }>;
  sendToMultiple(
    userIds: string[],
    params: Omit<SendPushParams, 'userId'>
  ): Promise<{ sent: number; failed: number }>;
  registerToken(userId: string, token: string, platform: PushPlatform): Promise<void>;
  removeToken(userId: string, token: string): Promise<void>;
}

export interface PushServiceDependencies {
  prisma: PrismaClient;
  logger: Logger;
  config: PushServiceConfig;
}

interface PushToken {
  token: string;
  platform: PushPlatform;
  createdAt: string;
}

export function createPushService(deps: PushServiceDependencies): PushService {
  const { prisma, logger } = deps;

  async function getUserPushTokens(userId: string): Promise<PushToken[]> {
    const presence = await prisma.userPresence.findUnique({
      where: { userId },
      select: { pushTokens: true },
    });

    if (!presence?.pushTokens) return [];

    return presence.pushTokens as unknown as PushToken[];
  }

  function sendToFCM(
    tokens: string[],
    title: string,
    _body: string,
    _data?: Record<string, unknown>,
    _priority?: 'high' | 'normal'
  ): { success: number; failure: number; messageId: string } {
    // In production, integrate with firebase-admin
    logger.info({
      msg: 'Sending push notification via FCM',
      tokenCount: tokens.length,
      title,
    });

    // FUTURE: Implement with actual Firebase Admin SDK
    // See: https://firebase.google.com/docs/cloud-messaging/send-message

    return {
      success: tokens.length,
      failure: 0,
      messageId: `fcm-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    };
  }

  return {
    async send(params: SendPushParams): Promise<{ messageId: string }> {
      const tokens = await getUserPushTokens(params.userId);

      if (tokens.length === 0) {
        logger.debug({
          msg: 'No push tokens found for user',
          userId: params.userId,
        });
        return { messageId: '' };
      }

      const tokenStrings = tokens.map((t) => t.token);

      try {
        const result = sendToFCM(
          tokenStrings,
          params.title,
          params.body,
          params.data,
          params.priority
        );

        logger.info({
          msg: 'Push notification sent',
          userId: params.userId,
          success: result.success,
          failure: result.failure,
        });

        return { messageId: result.messageId };
      } catch (error) {
        logger.error({
          msg: 'Failed to send push notification',
          userId: params.userId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },

    async sendToMultiple(
      userIds: string[],
      params: Omit<SendPushParams, 'userId'>
    ): Promise<{ sent: number; failed: number }> {
      let sent = 0;
      let failed = 0;

      for (const userId of userIds) {
        try {
          const result = await this.send({ ...params, userId });
          if (result.messageId) sent++;
        } catch {
          failed++;
        }
      }

      return { sent, failed };
    },

    async registerToken(
      userId: string,
      token: string,
      platform: 'ios' | 'android' | 'web'
    ): Promise<void> {
      const presence = await prisma.userPresence.findUnique({
        where: { userId },
        select: { pushTokens: true },
      });

      const existingTokens = (presence?.pushTokens as unknown as PushToken[]) || [];

      // Remove existing token if present (to update platform/timestamp)
      const filteredTokens = existingTokens.filter((t) => t.token !== token);

      // Add new token
      filteredTokens.push({
        token,
        platform,
        createdAt: new Date().toISOString(),
      });

      // Keep only last 10 tokens per user
      const tokensToKeep = filteredTokens.slice(-10);

      await prisma.userPresence.upsert({
        where: { userId },
        update: {
          pushTokens: tokensToKeep as unknown as object[],
        },
        create: {
          userId,
          status: 'OFFLINE',
          pushTokens: tokensToKeep as unknown as object[],
          lastSeenAt: new Date(),
        },
      });

      logger.info({
        msg: 'Push token registered',
        userId,
        platform,
      });
    },

    async removeToken(userId: string, token: string): Promise<void> {
      const presence = await prisma.userPresence.findUnique({
        where: { userId },
        select: { pushTokens: true },
      });

      if (!presence?.pushTokens) return;

      const existingTokens = presence.pushTokens as unknown as PushToken[];
      const filteredTokens = existingTokens.filter((t) => t.token !== token);

      await prisma.userPresence.update({
        where: { userId },
        data: {
          pushTokens: filteredTokens as unknown as object[],
        },
      });

      logger.info({
        msg: 'Push token removed',
        userId,
      });
    },
  };
}
