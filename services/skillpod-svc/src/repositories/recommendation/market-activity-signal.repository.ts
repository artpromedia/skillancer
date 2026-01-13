// @ts-nocheck
/**
 * @module @skillancer/skillpod-svc/repositories/recommendation/market-activity-signal
 * Market Activity Signal repository for database operations
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import type { PrismaClient, MarketActivitySignal, Prisma } from '@/types/prisma-shim.js';
import type { SignalType } from '@skillancer/types';

// =============================================================================
// TYPES
// =============================================================================

export interface MarketActivitySignalWithRelations extends MarketActivitySignal {
  learningProfile?: {
    id: string;
    userId: string;
  };
}

export interface CreateMarketActivitySignalInput {
  learningProfileId: string;
  signalType: SignalType;
  signalSource: string;
  signalStrength?: number;
  sourceId?: string;
  sourceType?: string;
  skillIds?: string[];
  requiredLevels?: Record<string, string>;
  contextData?: Record<string, unknown>;
  skillGapIndicators?: Record<string, unknown>;
  competitorInsights?: Record<string, unknown>;
  marketTrendData?: Record<string, unknown>;
  expiresAt?: Date;
}

export interface UpdateMarketActivitySignalInput {
  signalStrength?: number;
  skillGapIndicators?: Record<string, unknown>;
  competitorInsights?: Record<string, unknown>;
  marketTrendData?: Record<string, unknown>;
  processed?: boolean;
  processedAt?: Date;
  processingResult?: Record<string, unknown>;
  decayFactor?: number;
}

export interface MarketActivitySignalListFilter {
  learningProfileId?: string;
  signalType?: SignalType | SignalType[];
  signalSource?: string;
  sourceId?: string;
  sourceType?: string;
  processed?: boolean;
  minSignalStrength?: number;
  createdAfter?: Date;
  createdBefore?: Date;
  notExpired?: boolean;
}

export interface MarketActivitySignalListOptions {
  page?: number;
  limit?: number;
  orderBy?: 'createdAt' | 'signalStrength' | 'processedAt';
  orderDirection?: 'asc' | 'desc';
}

export interface SignalAggregation {
  signalType: SignalType;
  count: number;
  averageStrength: number;
  skillFrequency: Record<string, number>;
}

// =============================================================================
// REPOSITORY INTERFACE
// =============================================================================

export interface MarketActivitySignalRepository {
  create(input: CreateMarketActivitySignalInput): Promise<MarketActivitySignal>;
  createMany(inputs: CreateMarketActivitySignalInput[]): Promise<number>;
  findById(id: string): Promise<MarketActivitySignalWithRelations | null>;
  findMany(
    filter: MarketActivitySignalListFilter,
    options?: MarketActivitySignalListOptions
  ): Promise<{
    signals: MarketActivitySignalWithRelations[];
    total: number;
  }>;
  findUnprocessed(limit?: number): Promise<MarketActivitySignal[]>;
  findByProfileRecent(learningProfileId: string, hours?: number): Promise<MarketActivitySignal[]>;
  update(id: string, input: UpdateMarketActivitySignalInput): Promise<MarketActivitySignal>;
  markProcessed(id: string, result?: Record<string, unknown>): Promise<void>;
  markManyProcessed(ids: string[]): Promise<number>;
  delete(id: string): Promise<void>;
  deleteExpired(): Promise<number>;
  deleteOlderThan(date: Date): Promise<number>;
  getAggregations(learningProfileId: string, since?: Date): Promise<SignalAggregation[]>;
  countByType(learningProfileId: string): Promise<Record<SignalType, number>>;
  applyDecay(decayRate: number, olderThan: Date): Promise<number>;
}

// =============================================================================
// REPOSITORY IMPLEMENTATION
// =============================================================================

export function createMarketActivitySignalRepository(
  prisma: PrismaClient
): MarketActivitySignalRepository {
  async function create(input: CreateMarketActivitySignalInput): Promise<MarketActivitySignal> {
    return prisma.marketActivitySignal.create({
      data: {
        learningProfileId: input.learningProfileId,
        signalType: input.signalType,
        signalSource: input.signalSource,
        signalStrength: input.signalStrength ?? 1.0,
        sourceId: input.sourceId,
        sourceType: input.sourceType,
        skillIds: input.skillIds ?? [],
        requiredLevels: input.requiredLevels ?? {},
        contextData: input.contextData ?? {},
        skillGapIndicators: input.skillGapIndicators,
        competitorInsights: input.competitorInsights,
        marketTrendData: input.marketTrendData,
        expiresAt: input.expiresAt,
      },
    });
  }

  async function createMany(inputs: CreateMarketActivitySignalInput[]): Promise<number> {
    const result = await prisma.marketActivitySignal.createMany({
      data: inputs.map((input) => ({
        learningProfileId: input.learningProfileId,
        signalType: input.signalType,
        signalSource: input.signalSource,
        signalStrength: input.signalStrength ?? 1.0,
        sourceId: input.sourceId,
        sourceType: input.sourceType,
        skillIds: input.skillIds ?? [],
        requiredLevels: input.requiredLevels ?? {},
        contextData: input.contextData ?? {},
        skillGapIndicators: input.skillGapIndicators,
        competitorInsights: input.competitorInsights,
        marketTrendData: input.marketTrendData,
        expiresAt: input.expiresAt,
      })),
    });
    return result.count;
  }

  async function findById(id: string): Promise<MarketActivitySignalWithRelations | null> {
    return prisma.marketActivitySignal.findUnique({
      where: { id },
      include: {
        learningProfile: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });
  }

  async function findMany(
    filter: MarketActivitySignalListFilter,
    options: MarketActivitySignalListOptions = {}
  ): Promise<{
    signals: MarketActivitySignalWithRelations[];
    total: number;
  }> {
    const { page = 1, limit = 50, orderBy = 'createdAt', orderDirection = 'desc' } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.MarketActivitySignalWhereInput = {};

    if (filter.learningProfileId) where.learningProfileId = filter.learningProfileId;
    if (filter.signalType) {
      where.signalType = Array.isArray(filter.signalType)
        ? { in: filter.signalType }
        : filter.signalType;
    }
    if (filter.signalSource) where.signalSource = filter.signalSource;
    if (filter.sourceId) where.sourceId = filter.sourceId;
    if (filter.sourceType) where.sourceType = filter.sourceType;
    if (filter.processed !== undefined) where.processed = filter.processed;
    if (filter.minSignalStrength !== undefined) {
      where.signalStrength = { gte: filter.minSignalStrength };
    }
    if (filter.createdAfter || filter.createdBefore) {
      where.createdAt = {};
      if (filter.createdAfter) where.createdAt.gte = filter.createdAfter;
      if (filter.createdBefore) where.createdAt.lte = filter.createdBefore;
    }
    if (filter.notExpired) {
      where.OR = [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];
    }

    const [signals, total] = await Promise.all([
      prisma.marketActivitySignal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderBy]: orderDirection },
        include: {
          learningProfile: {
            select: {
              id: true,
              userId: true,
            },
          },
        },
      }),
      prisma.marketActivitySignal.count({ where }),
    ]);

    return { signals, total };
  }

  async function findUnprocessed(limit = 100): Promise<MarketActivitySignal[]> {
    return prisma.marketActivitySignal.findMany({
      where: {
        processed: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ signalStrength: 'desc' }, { createdAt: 'asc' }],
      take: limit,
    });
  }

  async function findByProfileRecent(
    learningProfileId: string,
    hours = 24
  ): Promise<MarketActivitySignal[]> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    return prisma.marketActivitySignal.findMany({
      where: {
        learningProfileId,
        createdAt: { gte: since },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async function update(
    id: string,
    input: UpdateMarketActivitySignalInput
  ): Promise<MarketActivitySignal> {
    return prisma.marketActivitySignal.update({
      where: { id },
      data: input,
    });
  }

  async function markProcessed(id: string, result?: Record<string, unknown>): Promise<void> {
    await prisma.marketActivitySignal.update({
      where: { id },
      data: {
        processed: true,
        processedAt: new Date(),
        processingResult: result ?? {},
      },
    });
  }

  async function markManyProcessed(ids: string[]): Promise<number> {
    const result = await prisma.marketActivitySignal.updateMany({
      where: { id: { in: ids } },
      data: {
        processed: true,
        processedAt: new Date(),
      },
    });
    return result.count;
  }

  async function deleteSignal(id: string): Promise<void> {
    await prisma.marketActivitySignal.delete({ where: { id } });
  }

  async function deleteExpired(): Promise<number> {
    const result = await prisma.marketActivitySignal.deleteMany({
      where: {
        expiresAt: { lte: new Date() },
      },
    });
    return result.count;
  }

  async function deleteOlderThan(date: Date): Promise<number> {
    const result = await prisma.marketActivitySignal.deleteMany({
      where: {
        createdAt: { lt: date },
        processed: true,
      },
    });
    return result.count;
  }

  async function getAggregations(
    learningProfileId: string,
    since?: Date
  ): Promise<SignalAggregation[]> {
    const where: Prisma.MarketActivitySignalWhereInput = {
      learningProfileId,
    };
    if (since) {
      where.createdAt = { gte: since };
    }

    const signals = await prisma.marketActivitySignal.findMany({
      where,
      select: {
        signalType: true,
        signalStrength: true,
        skillIds: true,
      },
    });

    const aggregationMap = new Map<
      SignalType,
      { count: number; totalStrength: number; skillFrequency: Record<string, number> }
    >();

    for (const signal of signals) {
      const existing = aggregationMap.get(signal.signalType as SignalType) ?? {
        count: 0,
        totalStrength: 0,
        skillFrequency: {},
      };

      existing.count += 1;
      existing.totalStrength += signal.signalStrength;

      for (const skillId of signal.skillIds) {
        existing.skillFrequency[skillId] = (existing.skillFrequency[skillId] ?? 0) + 1;
      }

      aggregationMap.set(signal.signalType as SignalType, existing);
    }

    return Array.from(aggregationMap.entries()).map(([signalType, data]) => ({
      signalType,
      count: data.count,
      averageStrength: data.totalStrength / data.count,
      skillFrequency: data.skillFrequency,
    }));
  }

  async function countByType(learningProfileId: string): Promise<Record<SignalType, number>> {
    const counts = await prisma.marketActivitySignal.groupBy({
      by: ['signalType'],
      where: { learningProfileId },
      _count: true,
    });

    const result = {} as Record<SignalType, number>;
    for (const item of counts) {
      result[item.signalType as SignalType] = item._count;
    }
    return result;
  }

  async function applyDecay(decayRate: number, olderThan: Date): Promise<number> {
    // Apply decay factor to old signals
    const result = await prisma.$executeRaw`
      UPDATE market_activity_signals
      SET decay_factor = decay_factor * ${1 - decayRate},
          signal_strength = signal_strength * ${1 - decayRate}
      WHERE created_at < ${olderThan}
        AND decay_factor > 0.1
    `;
    return result;
  }

  return {
    create,
    createMany,
    findById,
    findMany,
    findUnprocessed,
    findByProfileRecent,
    update,
    markProcessed,
    markManyProcessed,
    delete: deleteSignal,
    deleteExpired,
    deleteOlderThan,
    getAggregations,
    countByType,
    applyDecay,
  };
}

