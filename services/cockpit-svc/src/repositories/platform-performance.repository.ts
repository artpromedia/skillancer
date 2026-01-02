// @ts-nocheck
/**
 * Platform Performance Repository
 *
 * Repository for managing platform performance comparison reports.
 */

import {
  type PrismaClient,
  Prisma,
  type PlatformPerformanceReport,
  type UnifiedTransactionSource,
  FinancialReportStatus,
} from '@skillancer/database';
import { logger } from '@skillancer/logger';

import type { PaginationOptions, PaginatedResult } from '../types/unified-financial.types';

export interface CreatePlatformPerformanceInput {
  userId: string;
  source: UnifiedTransactionSource;
  periodStart: Date;
  periodEnd: Date;
  baseCurrency: string;
  grossRevenue: number;
  platformFees: number;
  processingFees: number;
  netRevenue: number;
  feePercentage: number;
  transactionCount: number;
  contractCount: number;
  clientCount: number;
  averageContractValue: number;
  averageTransactionValue: number;
  revenueRank?: number;
  feeEfficiencyRank?: number;
}

export interface PlatformPerformanceFilters {
  userId: string;
  sources?: UnifiedTransactionSource[];
  periodStart?: Date;
  periodEnd?: Date;
  status?: FinancialReportStatus;
}

export class PlatformPerformanceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new platform performance report
   */
  async create(input: CreatePlatformPerformanceInput): Promise<PlatformPerformanceReport> {
    try {
      return await this.prisma.platformPerformanceReport.create({
        data: {
          userId: input.userId,
          source: input.source,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          baseCurrency: input.baseCurrency,
          grossRevenue: new Prisma.Decimal(input.grossRevenue),
          platformFees: new Prisma.Decimal(input.platformFees),
          processingFees: new Prisma.Decimal(input.processingFees),
          netRevenue: new Prisma.Decimal(input.netRevenue),
          feePercentage: new Prisma.Decimal(input.feePercentage),
          transactionCount: input.transactionCount,
          contractCount: input.contractCount,
          clientCount: input.clientCount,
          averageContractValue: new Prisma.Decimal(input.averageContractValue),
          averageTransactionValue: new Prisma.Decimal(input.averageTransactionValue),
          revenueRank: input.revenueRank,
          feeEfficiencyRank: input.feeEfficiencyRank,
          status: FinancialReportStatus.COMPLETED,
          generatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to create platform performance report', { error, input });
      throw error;
    }
  }

  /**
   * Bulk create platform performance reports
   */
  async bulkCreate(inputs: CreatePlatformPerformanceInput[]): Promise<number> {
    const result = await this.prisma.platformPerformanceReport.createMany({
      data: inputs.map((input) => ({
        userId: input.userId,
        source: input.source,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        baseCurrency: input.baseCurrency,
        grossRevenue: new Prisma.Decimal(input.grossRevenue),
        platformFees: new Prisma.Decimal(input.platformFees),
        processingFees: new Prisma.Decimal(input.processingFees),
        netRevenue: new Prisma.Decimal(input.netRevenue),
        feePercentage: new Prisma.Decimal(input.feePercentage),
        transactionCount: input.transactionCount,
        contractCount: input.contractCount,
        clientCount: input.clientCount,
        averageContractValue: new Prisma.Decimal(input.averageContractValue),
        averageTransactionValue: new Prisma.Decimal(input.averageTransactionValue),
        revenueRank: input.revenueRank,
        feeEfficiencyRank: input.feeEfficiencyRank,
        status: FinancialReportStatus.COMPLETED,
        generatedAt: new Date(),
      })),
    });
    return result.count;
  }

  /**
   * Find report by ID
   */
  async findById(id: string): Promise<PlatformPerformanceReport | null> {
    return this.prisma.platformPerformanceReport.findUnique({
      where: { id },
    });
  }

  /**
   * Find latest report for a source
   */
  async findLatestForSource(
    userId: string,
    source: UnifiedTransactionSource
  ): Promise<PlatformPerformanceReport | null> {
    return this.prisma.platformPerformanceReport.findFirst({
      where: {
        userId,
        source,
        status: FinancialReportStatus.COMPLETED,
      },
      orderBy: { periodEnd: 'desc' },
    });
  }

  /**
   * Get all platforms for a period
   */
  async getPlatformsForPeriod(
    userId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<PlatformPerformanceReport[]> {
    return this.prisma.platformPerformanceReport.findMany({
      where: {
        userId,
        periodStart: { equals: periodStart },
        periodEnd: { equals: periodEnd },
        status: FinancialReportStatus.COMPLETED,
      },
      orderBy: { netRevenue: 'desc' },
    });
  }

  /**
   * Find reports with filters and pagination
   */
  async findMany(
    filters: PlatformPerformanceFilters,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<PlatformPerformanceReport>> {
    const where = this.buildWhereClause(filters);

    const [data, total] = await Promise.all([
      this.prisma.platformPerformanceReport.findMany({
        where,
        orderBy: {
          [pagination.sortBy ?? 'netRevenue']: pagination.sortOrder ?? 'desc',
        },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      this.prisma.platformPerformanceReport.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pagination.pageSize);

    return {
      data,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrevious: pagination.page > 1,
    };
  }

  /**
   * Get platform comparison summary
   */
  async getPlatformComparison(
    userId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<{
    platforms: PlatformPerformanceReport[];
    totals: {
      grossRevenue: number;
      platformFees: number;
      netRevenue: number;
      transactionCount: number;
      clientCount: number;
    };
    bestPerformer: {
      byRevenue?: PlatformPerformanceReport;
      byFeeEfficiency?: PlatformPerformanceReport;
      byClientCount?: PlatformPerformanceReport;
    };
  }> {
    const platforms = await this.getPlatformsForPeriod(userId, periodStart, periodEnd);

    const totals = platforms.reduce(
      (acc, p) => ({
        grossRevenue: acc.grossRevenue + p.grossRevenue.toNumber(),
        platformFees: acc.platformFees + p.platformFees.toNumber(),
        netRevenue: acc.netRevenue + p.netRevenue.toNumber(),
        transactionCount: acc.transactionCount + p.transactionCount,
        clientCount: acc.clientCount + p.clientCount,
      }),
      { grossRevenue: 0, platformFees: 0, netRevenue: 0, transactionCount: 0, clientCount: 0 }
    );

    // Sort by different metrics
    const byRevenue = [...platforms].sort(
      (a, b) => b.netRevenue.toNumber() - a.netRevenue.toNumber()
    );
    const byFeeEfficiency = [...platforms].sort(
      (a, b) => a.feePercentage.toNumber() - b.feePercentage.toNumber()
    );
    const byClientCount = [...platforms].sort((a, b) => b.clientCount - a.clientCount);

    return {
      platforms,
      totals,
      bestPerformer: {
        byRevenue: byRevenue[0],
        byFeeEfficiency: byFeeEfficiency[0],
        byClientCount: byClientCount[0],
      },
    };
  }

  /**
   * Get historical performance for a platform
   */
  async getPlatformHistory(
    userId: string,
    source: UnifiedTransactionSource,
    limit: number = 12
  ): Promise<PlatformPerformanceReport[]> {
    return this.prisma.platformPerformanceReport.findMany({
      where: {
        userId,
        source,
        status: FinancialReportStatus.COMPLETED,
      },
      orderBy: { periodEnd: 'desc' },
      take: limit,
    });
  }

  /**
   * Calculate and assign ranks within a period
   */
  async calculateRanks(userId: string, periodStart: Date, periodEnd: Date): Promise<void> {
    const platforms = await this.getPlatformsForPeriod(userId, periodStart, periodEnd);

    // Rank by revenue
    const byRevenue = [...platforms].sort(
      (a, b) => b.netRevenue.toNumber() - a.netRevenue.toNumber()
    );
    const byFeeEfficiency = [...platforms].sort(
      (a, b) => a.feePercentage.toNumber() - b.feePercentage.toNumber()
    );

    for (let i = 0; i < platforms.length; i++) {
      const platform = platforms[i]!;
      const revenueRank = byRevenue.findIndex((p) => p.id === platform.id) + 1;
      const feeEfficiencyRank = byFeeEfficiency.findIndex((p) => p.id === platform.id) + 1;

      await this.prisma.platformPerformanceReport.update({
        where: { id: platform.id },
        data: {
          revenueRank,
          feeEfficiencyRank,
        },
      });
    }
  }

  /**
   * Build where clause from filters
   */
  private buildWhereClause(
    filters: PlatformPerformanceFilters
  ): Prisma.PlatformPerformanceReportWhereInput {
    const where: Prisma.PlatformPerformanceReportWhereInput = {
      userId: filters.userId,
    };

    if (filters.sources?.length) {
      where.source = { in: filters.sources };
    }

    if (filters.periodStart) {
      where.periodStart = { gte: filters.periodStart };
    }

    if (filters.periodEnd) {
      where.periodEnd = { lte: filters.periodEnd };
    }

    if (filters.status) {
      where.status = filters.status;
    }

    return where;
  }
}

