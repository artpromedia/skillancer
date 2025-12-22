/**
 * @module @skillancer/cockpit-svc/repositories/integration
 * Integration Repository - Database operations for integrations
 */

import type {
  CreateIntegrationParams,
  UpdateIntegrationParams,
} from '../types/integration.types.js';
import type { Integration, IntegrationProvider, IntegrationStatus, Prisma } from '@prisma/client';
import type { PrismaClient } from '@skillancer/database';

export class IntegrationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(params: CreateIntegrationParams): Promise<Integration> {
    return this.prisma.integration.create({
      data: {
        userId: params.userId,
        provider: params.provider,
        providerAccountId: params.providerAccountId,
        name: params.name,
        description: params.description,
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
        tokenExpiresAt: params.tokenExpiresAt,
        tokenType: params.tokenType,
        scope: params.scope,
        apiKey: params.apiKey,
        apiSecret: params.apiSecret,
        webhookSecret: params.webhookSecret,
        webhookUrl: params.webhookUrl,
        accountEmail: params.accountEmail,
        accountName: params.accountName,
        accountAvatar: params.accountAvatar,
        metadata: (params.metadata as Prisma.InputJsonValue) ?? undefined,
        status: params.status ?? 'PENDING',
        syncEnabled: params.syncEnabled ?? true,
        syncFrequency: params.syncFrequency ?? 'HOURLY',
        syncOptions: (params.syncOptions as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }

  async findById(id: string): Promise<Integration | null> {
    return this.prisma.integration.findUnique({
      where: { id },
    });
  }

  async findByUser(userId: string): Promise<Integration[]> {
    return this.prisma.integration.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByProvider(userId: string, provider: IntegrationProvider): Promise<Integration | null> {
    return this.prisma.integration.findFirst({
      where: {
        userId,
        provider,
        isActive: true,
      },
    });
  }

  async findByProviderAccount(
    userId: string,
    provider: IntegrationProvider,
    providerAccountId: string
  ): Promise<Integration | null> {
    return this.prisma.integration.findFirst({
      where: {
        userId,
        provider,
        providerAccountId,
      },
    });
  }

  async findByStatus(status: IntegrationStatus): Promise<Integration[]> {
    return this.prisma.integration.findMany({
      where: { status },
    });
  }

  async findDueForSync(now: Date): Promise<Integration[]> {
    return this.prisma.integration.findMany({
      where: {
        syncEnabled: true,
        isActive: true,
        isPaused: false,
        status: 'CONNECTED',
        nextSyncAt: { lte: now },
      },
      orderBy: { nextSyncAt: 'asc' },
      take: 100, // Process in batches
    });
  }

  async findExpiredTokens(bufferMinutes: number = 5): Promise<Integration[]> {
    const threshold = new Date(Date.now() + bufferMinutes * 60 * 1000);
    return this.prisma.integration.findMany({
      where: {
        status: 'CONNECTED',
        isActive: true,
        refreshToken: { not: null },
        tokenExpiresAt: { lte: threshold },
      },
    });
  }

  async update(id: string, params: UpdateIntegrationParams): Promise<Integration> {
    return this.prisma.integration.update({
      where: { id },
      data: {
        name: params.name,
        description: params.description,
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
        tokenExpiresAt: params.tokenExpiresAt,
        tokenType: params.tokenType,
        scope: params.scope,
        apiKey: params.apiKey,
        apiSecret: params.apiSecret,
        webhookSecret: params.webhookSecret,
        webhookUrl: params.webhookUrl,
        accountEmail: params.accountEmail,
        accountName: params.accountName,
        accountAvatar: params.accountAvatar,
        metadata: (params.metadata as Prisma.InputJsonValue) ?? undefined,
        status: params.status,
        isActive: params.isActive,
        syncEnabled: params.syncEnabled,
        syncFrequency: params.syncFrequency,
        lastSyncAt: params.lastSyncAt,
        lastSyncStatus: params.lastSyncStatus,
        lastSyncError: params.lastSyncError,
        nextSyncAt: params.nextSyncAt,
        syncOptions: (params.syncOptions as Prisma.InputJsonValue) ?? undefined,
        rateLimitRemaining: params.rateLimitRemaining,
        rateLimitResetAt: params.rateLimitResetAt,
        consecutiveErrors: params.consecutiveErrors,
        lastErrorAt: params.lastErrorAt,
        isPaused: params.isPaused,
        pausedReason: params.pausedReason,
      },
    });
  }

  async updateRateLimits(
    id: string,
    limits: { remaining?: number; resetAt?: Date }
  ): Promise<void> {
    await this.prisma.integration.update({
      where: { id },
      data: {
        rateLimitRemaining: limits.remaining,
        rateLimitResetAt: limits.resetAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.integration.delete({
      where: { id },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.integration.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async countByUser(userId: string): Promise<number> {
    return this.prisma.integration.count({
      where: {
        userId,
        isActive: true,
      },
    });
  }

  async countByProvider(provider: IntegrationProvider): Promise<number> {
    return this.prisma.integration.count({
      where: {
        provider,
        isActive: true,
        status: 'CONNECTED',
      },
    });
  }
}
