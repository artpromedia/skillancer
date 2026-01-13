// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/repositories/market-client-cache
 * Market Client Cache data access layer
 */

import type { PrismaClient, MarketClientCache } from '../types/prisma-shim.js';

export interface UpsertClientCacheParams {
  marketUserId: string;
  displayName: string;
  companyName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  country?: string | null;
  timezone?: string | null;
  totalContracts?: number;
  totalSpent?: number;
  avgRating?: number | null;
  cockpitClientId?: string | null;
  lastSyncedAt: Date;
}

export class MarketClientCacheRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create or update a client cache entry
   */
  async upsert(data: UpsertClientCacheParams): Promise<MarketClientCache> {
    return this.prisma.marketClientCache.upsert({
      where: { marketUserId: data.marketUserId },
      create: {
        marketUserId: data.marketUserId,
        displayName: data.displayName,
        companyName: data.companyName ?? null,
        email: data.email ?? null,
        avatarUrl: data.avatarUrl ?? null,
        country: data.country ?? null,
        timezone: data.timezone ?? null,
        totalContracts: data.totalContracts ?? 0,
        totalSpent: data.totalSpent ?? 0,
        avgRating: data.avgRating ?? null,
        cockpitClientId: data.cockpitClientId ?? null,
        lastSyncedAt: data.lastSyncedAt,
      },
      update: {
        displayName: data.displayName,
        companyName: data.companyName ?? null,
        email: data.email ?? null,
        avatarUrl: data.avatarUrl ?? null,
        country: data.country ?? null,
        timezone: data.timezone ?? null,
        ...(data.totalContracts !== undefined && { totalContracts: data.totalContracts }),
        ...(data.totalSpent !== undefined && { totalSpent: data.totalSpent }),
        ...(data.avgRating !== undefined && { avgRating: data.avgRating }),
        ...(data.cockpitClientId !== undefined && { cockpitClientId: data.cockpitClientId }),
        lastSyncedAt: data.lastSyncedAt,
      },
    });
  }

  /**
   * Find a client cache entry by ID
   */
  async findById(id: string): Promise<MarketClientCache | null> {
    return this.prisma.marketClientCache.findUnique({
      where: { id },
    });
  }

  /**
   * Find a client cache entry by Market user ID
   */
  async findByMarketId(marketUserId: string): Promise<MarketClientCache | null> {
    return this.prisma.marketClientCache.findUnique({
      where: { marketUserId },
    });
  }

  /**
   * Find a client cache entry by Cockpit client ID
   */
  async findByCockpitClientId(cockpitClientId: string): Promise<MarketClientCache | null> {
    return this.prisma.marketClientCache.findFirst({
      where: { cockpitClientId },
    });
  }

  /**
   * Link a Market client to a Cockpit client
   */
  async linkToCockpitClient(
    marketUserId: string,
    cockpitClientId: string
  ): Promise<MarketClientCache> {
    return this.prisma.marketClientCache.update({
      where: { marketUserId },
      data: {
        cockpitClientId,
        lastSyncedAt: new Date(),
      },
    });
  }

  /**
   * Unlink a Market client from a Cockpit client
   */
  async unlinkFromCockpitClient(marketUserId: string): Promise<MarketClientCache> {
    return this.prisma.marketClientCache.update({
      where: { marketUserId },
      data: {
        cockpitClientId: null,
        lastSyncedAt: new Date(),
      },
    });
  }

  /**
   * Update client stats
   */
  async updateStats(
    marketUserId: string,
    stats: { totalContracts?: number; totalSpent?: number; avgRating?: number | null }
  ): Promise<MarketClientCache> {
    return this.prisma.marketClientCache.update({
      where: { marketUserId },
      data: {
        ...(stats.totalContracts !== undefined && { totalContracts: stats.totalContracts }),
        ...(stats.totalSpent !== undefined && { totalSpent: stats.totalSpent }),
        ...(stats.avgRating !== undefined && { avgRating: stats.avgRating }),
        lastSyncedAt: new Date(),
      },
    });
  }

  /**
   * Delete a client cache entry
   */
  async delete(id: string): Promise<void> {
    await this.prisma.marketClientCache.delete({
      where: { id },
    });
  }

  /**
   * Get all cached clients without Cockpit link
   */
  async findUnlinked(): Promise<MarketClientCache[]> {
    return this.prisma.marketClientCache.findMany({
      where: {
        cockpitClientId: null,
      },
      orderBy: { lastSyncedAt: 'desc' },
    });
  }

  /**
   * Get stale entries (not synced in given hours)
   */
  async findStale(hoursAgo: number): Promise<MarketClientCache[]> {
    const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    return this.prisma.marketClientCache.findMany({
      where: {
        lastSyncedAt: {
          lt: cutoff,
        },
      },
    });
  }
}

