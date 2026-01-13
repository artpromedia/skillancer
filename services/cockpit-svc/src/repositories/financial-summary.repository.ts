// @ts-nocheck
/**
 * Financial Summary Repository
 *
 * Repository for managing financial summary reports including P&L,
 * cash flow, and period-based summaries.
 */

import {
  type PrismaClient,
  Prisma,
  type FinancialSummaryReport,
  FinancialPeriodType,
  FinancialReportStatus,
  type UnifiedTransactionSource,
} from '../types/prisma-shim.js';
import { logger } from '@skillancer/logger';

import type { PaginationOptions, PaginatedResult } from '../types/unified-financial.types';

export interface CreateSummaryReportInput {
  userId: string;
  periodType: FinancialPeriodType;
  periodStart: Date;
  periodEnd: Date;
  baseCurrency: string;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  incomeBySource: Record<UnifiedTransactionSource, number>;
  expensesByCategory: Array<{ category: string; amount: number; taxDeductible: boolean }>;
  incomeByClient: Array<{ clientId?: string; clientName: string; amount: number }>;
  incomeByProject: Array<{ projectId?: string; projectName: string; amount: number }>;
  transactionCount: number;
  previousPeriodComparison?: {
    incomeChange: number;
    expenseChange: number;
    profitChange: number;
    incomeChangePercent: number;
    expenseChangePercent: number;
    profitChangePercent: number;
  };
}

export interface SummaryReportFilters {
  userId: string;
  periodType?: FinancialPeriodType;
  startDate?: Date;
  endDate?: Date;
  status?: FinancialReportStatus;
}

export class FinancialSummaryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new financial summary report
   */
  async create(input: CreateSummaryReportInput): Promise<FinancialSummaryReport> {
    try {
      return await this.prisma.financialSummaryReport.create({
        data: {
          userId: input.userId,
          periodType: input.periodType,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          baseCurrency: input.baseCurrency,
          totalIncome: new Prisma.Decimal(input.totalIncome),
          totalExpenses: new Prisma.Decimal(input.totalExpenses),
          netProfit: new Prisma.Decimal(input.netProfit),
          profitMargin: new Prisma.Decimal(input.profitMargin),
          incomeBySource: input.incomeBySource as unknown as Prisma.JsonValue,
          expensesByCategory: input.expensesByCategory as unknown as Prisma.JsonValue,
          incomeByClient: input.incomeByClient as unknown as Prisma.JsonValue,
          incomeByProject: input.incomeByProject as unknown as Prisma.JsonValue,
          transactionCount: input.transactionCount,
          previousPeriodComparison: input.previousPeriodComparison as unknown as Prisma.JsonValue,
          status: FinancialReportStatus.COMPLETED,
          generatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to create financial summary report', { error, input });
      throw error;
    }
  }

  /**
   * Find report by ID
   */
  async findById(id: string): Promise<FinancialSummaryReport | null> {
    return this.prisma.financialSummaryReport.findUnique({
      where: { id },
    });
  }

  /**
   * Find report for a specific period
   */
  async findByPeriod(
    userId: string,
    periodType: FinancialPeriodType,
    periodStart: Date,
    periodEnd: Date
  ): Promise<FinancialSummaryReport | null> {
    return this.prisma.financialSummaryReport.findFirst({
      where: {
        userId,
        periodType,
        periodStart: { equals: periodStart },
        periodEnd: { equals: periodEnd },
        status: FinancialReportStatus.COMPLETED,
      },
      orderBy: { generatedAt: 'desc' },
    });
  }

  /**
   * Find reports with filters and pagination
   */
  async findMany(
    filters: SummaryReportFilters,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<FinancialSummaryReport>> {
    const where = this.buildWhereClause(filters);

    const [data, total] = await Promise.all([
      this.prisma.financialSummaryReport.findMany({
        where,
        orderBy: {
          [pagination.sortBy ?? 'periodStart']: pagination.sortOrder ?? 'desc',
        },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      this.prisma.financialSummaryReport.count({ where }),
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
   * Get latest report for each period type
   */
  async getLatestReports(userId: string): Promise<FinancialSummaryReport[]> {
    const periodTypes = Object.values(FinancialPeriodType);
    const reports: FinancialSummaryReport[] = [];

    for (const periodType of periodTypes) {
      const report = await this.prisma.financialSummaryReport.findFirst({
        where: {
          userId,
          periodType,
          status: FinancialReportStatus.COMPLETED,
        },
        orderBy: { periodEnd: 'desc' },
      });
      if (report) {
        reports.push(report);
      }
    }

    return reports;
  }

  /**
   * Get year-over-year comparison
   */
  async getYearOverYearComparison(
    userId: string,
    year: number
  ): Promise<{
    currentYear: FinancialSummaryReport | null;
    previousYear: FinancialSummaryReport | null;
  }> {
    const [currentYear, previousYear] = await Promise.all([
      this.prisma.financialSummaryReport.findFirst({
        where: {
          userId,
          periodType: FinancialPeriodType.YEARLY,
          periodStart: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
          status: FinancialReportStatus.COMPLETED,
        },
      }),
      this.prisma.financialSummaryReport.findFirst({
        where: {
          userId,
          periodType: FinancialPeriodType.YEARLY,
          periodStart: { gte: new Date(year - 1, 0, 1), lt: new Date(year, 0, 1) },
          status: FinancialReportStatus.COMPLETED,
        },
      }),
    ]);

    return { currentYear, previousYear };
  }

  /**
   * Mark report as expired
   */
  async markExpired(id: string): Promise<void> {
    await this.prisma.financialSummaryReport.update({
      where: { id },
      data: {
        status: FinancialReportStatus.EXPIRED,
        expiresAt: new Date(),
      },
    });
  }

  /**
   * Delete old reports
   */
  async deleteOldReports(userId: string, olderThan: Date): Promise<number> {
    const result = await this.prisma.financialSummaryReport.deleteMany({
      where: {
        userId,
        generatedAt: { lt: olderThan },
        status: { not: FinancialReportStatus.COMPLETED },
      },
    });
    return result.count;
  }

  /**
   * Build where clause from filters
   */
  private buildWhereClause(filters: SummaryReportFilters): Prisma.FinancialSummaryReportWhereInput {
    const where: Prisma.FinancialSummaryReportWhereInput = {
      userId: filters.userId,
    };

    if (filters.periodType) {
      where.periodType = filters.periodType;
    }

    if (filters.startDate || filters.endDate) {
      where.periodStart = {};
      if (filters.startDate) {
        where.periodStart.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.periodStart.lte = filters.endDate;
      }
    }

    if (filters.status) {
      where.status = filters.status;
    }

    return where;
  }
}

