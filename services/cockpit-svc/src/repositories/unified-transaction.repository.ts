/**
 * Unified Transaction Repository
 *
 * Repository for managing unified transactions from all sources.
 * Handles CRUD operations, bulk ingestion, and complex queries.
 */

import {
  type PrismaClient,
  Prisma,
  type UnifiedTransaction,
  type UnifiedTransactionSource,
  UnifiedTransactionType,
  UnifiedSyncStatus,
} from '@skillancer/database';
import { logger } from '@skillancer/logger';

import type {
  UnifiedTransactionData,
  UnifiedTransactionFilters,
  PaginationOptions,
  PaginatedResult,
  BulkIngestResult,
  IngestError,
} from '../types/unified-financial.types';

export class UnifiedTransactionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new unified transaction
   */
  async create(data: UnifiedTransactionData): Promise<UnifiedTransaction> {
    try {
      return await this.prisma.unifiedTransaction.create({
        data: {
          userId: data.userId,
          source: data.source,
          transactionType: data.transactionType,
          externalId: data.externalId,
          deduplicationKey: data.deduplicationKey,
          originalAmount: new Prisma.Decimal(data.originalAmount),
          originalCurrency: data.originalCurrency,
          convertedAmount: new Prisma.Decimal(data.convertedAmount),
          baseCurrency: data.baseCurrency,
          exchangeRate: new Prisma.Decimal(data.exchangeRate),
          exchangeRateDate: data.exchangeRateDate,
          platformFee: data.platformFee ? new Prisma.Decimal(data.platformFee) : null,
          processingFee: data.processingFee ? new Prisma.Decimal(data.processingFee) : null,
          netAmount: new Prisma.Decimal(data.netAmount),
          transactionDate: data.transactionDate,
          description: data.description,
          category: data.category,
          clientId: data.clientId,
          cockpitProjectId: data.cockpitProjectId,
          marketContractId: data.marketContractId,
          invoiceId: data.invoiceId,
          timeEntryIds: data.timeEntryIds ?? [],
          taxDeductible: data.taxDeductible,
          irsCategory: data.irsCategory,
          taxYear: data.taxYear,
          externalClientName: data.externalClientName,
          externalProjectName: data.externalProjectName,
          attachments: data.attachments ?? [],
          metadata: data.metadata ?? {},
          rawData: data.rawData ?? {},
          syncStatus: data.syncStatus,
          syncError: data.syncError,
          lastSyncedAt: data.lastSyncedAt,
        },
      });
    } catch (error) {
      logger.error('Failed to create unified transaction', { error, data });
      throw error;
    }
  }

  /**
   * Bulk upsert transactions (for sync operations)
   */
  async bulkUpsert(transactions: UnifiedTransactionData[]): Promise<BulkIngestResult> {
    const startTime = Date.now();
    const result: BulkIngestResult = {
      totalProcessed: transactions.length,
      successCount: 0,
      failedCount: 0,
      duplicateCount: 0,
      createdIds: [],
      updatedIds: [],
      errors: [],
      processingTimeMs: 0,
    };

    for (const tx of transactions) {
      try {
        // Check for existing by deduplication key
        const existing = await this.prisma.unifiedTransaction.findUnique({
          where: {
            userId_deduplicationKey: {
              userId: tx.userId,
              deduplicationKey: tx.deduplicationKey,
            },
          },
        });

        if (existing) {
          // Update existing
          await this.prisma.unifiedTransaction.update({
            where: { id: existing.id },
            data: {
              convertedAmount: new Prisma.Decimal(tx.convertedAmount),
              exchangeRate: new Prisma.Decimal(tx.exchangeRate),
              exchangeRateDate: tx.exchangeRateDate,
              netAmount: new Prisma.Decimal(tx.netAmount),
              description: tx.description,
              category: tx.category,
              metadata: tx.metadata ?? {},
              syncStatus: UnifiedSyncStatus.SYNCED,
              lastSyncedAt: new Date(),
            },
          });
          result.updatedIds.push(existing.id);
          result.duplicateCount++;
        } else {
          // Create new
          const created = await this.create(tx);
          result.createdIds.push(created.id);
        }
        result.successCount++;
      } catch (error) {
        result.failedCount++;
        result.errors.push({
          externalId: tx.externalId,
          source: tx.source,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    result.processingTimeMs = Date.now() - startTime;
    return result;
  }

  /**
   * Find transaction by ID
   */
  async findById(id: string): Promise<UnifiedTransaction | null> {
    return this.prisma.unifiedTransaction.findUnique({
      where: { id },
      include: {
        client: true,
        cockpitProject: true,
      },
    });
  }

  /**
   * Find transaction by deduplication key
   */
  async findByDeduplicationKey(
    userId: string,
    deduplicationKey: string
  ): Promise<UnifiedTransaction | null> {
    return this.prisma.unifiedTransaction.findUnique({
      where: {
        userId_deduplicationKey: {
          userId,
          deduplicationKey,
        },
      },
    });
  }

  /**
   * Find transactions with filters and pagination
   */
  async findMany(
    filters: UnifiedTransactionFilters,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<UnifiedTransaction>> {
    const where = this.buildWhereClause(filters);

    const [data, total] = await Promise.all([
      this.prisma.unifiedTransaction.findMany({
        where,
        orderBy: {
          [pagination.sortBy ?? 'transactionDate']: pagination.sortOrder ?? 'desc',
        },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        include: {
          client: true,
          cockpitProject: true,
        },
      }),
      this.prisma.unifiedTransaction.count({ where }),
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
   * Get aggregated totals by source
   */
  async getAggregatesBySource(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      source: UnifiedTransactionSource;
      totalIncome: number;
      totalExpense: number;
      count: number;
    }>
  > {
    const result = await this.prisma.unifiedTransaction.groupBy({
      by: ['source', 'transactionType'],
      where: {
        userId,
        transactionDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        convertedAmount: true,
      },
      _count: true,
    });

    // Transform to per-source totals
    const sourceMap = new Map<
      UnifiedTransactionSource,
      { totalIncome: number; totalExpense: number; count: number }
    >();

    for (const row of result) {
      const existing = sourceMap.get(row.source) ?? { totalIncome: 0, totalExpense: 0, count: 0 };
      const amount = row._sum.convertedAmount?.toNumber() ?? 0;

      if (row.transactionType === UnifiedTransactionType.INCOME) {
        existing.totalIncome += amount;
      } else if (row.transactionType === UnifiedTransactionType.EXPENSE) {
        existing.totalExpense += Math.abs(amount);
      }
      existing.count += row._count;

      sourceMap.set(row.source, existing);
    }

    return Array.from(sourceMap.entries()).map(([source, totals]) => ({
      source,
      ...totals,
    }));
  }

  /**
   * Get aggregated totals by category
   */
  async getAggregatesByCategory(
    userId: string,
    startDate: Date,
    endDate: Date,
    transactionType?: UnifiedTransactionType
  ): Promise<Array<{ category: string; total: number; count: number }>> {
    const where: Prisma.UnifiedTransactionWhereInput = {
      userId,
      transactionDate: {
        gte: startDate,
        lte: endDate,
      },
      category: { not: null },
    };

    if (transactionType) {
      where.transactionType = transactionType;
    }

    const result = await this.prisma.unifiedTransaction.groupBy({
      by: ['category'],
      where,
      _sum: {
        convertedAmount: true,
      },
      _count: true,
    });

    return result.map((row) => ({
      category: row.category ?? 'Uncategorized',
      total: row._sum.convertedAmount?.toNumber() ?? 0,
      count: row._count,
    }));
  }

  /**
   * Get monthly totals for trend analysis
   */
  async getMonthlyTotals(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ month: string; income: number; expense: number; net: number }>> {
    // Using raw query for date_trunc functionality
    const result = await this.prisma.$queryRaw<
      Array<{ month: Date; transaction_type: UnifiedTransactionType; total: Prisma.Decimal }>
    >`
      SELECT 
        date_trunc('month', transaction_date) as month,
        transaction_type,
        SUM(converted_amount) as total
      FROM unified_transactions
      WHERE user_id = ${userId}::uuid
        AND transaction_date >= ${startDate}
        AND transaction_date <= ${endDate}
      GROUP BY date_trunc('month', transaction_date), transaction_type
      ORDER BY month
    `;

    // Transform to monthly totals
    const monthMap = new Map<string, { income: number; expense: number }>();

    for (const row of result) {
      const monthKey = row.month.toISOString().slice(0, 7); // YYYY-MM
      const existing = monthMap.get(monthKey) ?? { income: 0, expense: 0 };
      const amount = Number(row.total);

      if (row.transaction_type === UnifiedTransactionType.INCOME) {
        existing.income += amount;
      } else if (row.transaction_type === UnifiedTransactionType.EXPENSE) {
        existing.expense += Math.abs(amount);
      }

      monthMap.set(monthKey, existing);
    }

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, totals]) => ({
        month,
        income: totals.income,
        expense: totals.expense,
        net: totals.income - totals.expense,
      }));
  }

  /**
   * Get tax year summary
   */
  async getTaxYearSummary(
    userId: string,
    taxYear: number
  ): Promise<{
    grossIncome: number;
    deductibleExpenses: number;
    nonDeductibleExpenses: number;
    byIrsCategory: Array<{ category: string; amount: number }>;
  }> {
    const startDate = new Date(taxYear, 0, 1);
    const endDate = new Date(taxYear, 11, 31, 23, 59, 59);

    const [incomeResult, expenseResult, irsCategoryResult] = await Promise.all([
      // Gross income
      this.prisma.unifiedTransaction.aggregate({
        where: {
          userId,
          transactionDate: { gte: startDate, lte: endDate },
          transactionType: UnifiedTransactionType.INCOME,
        },
        _sum: { convertedAmount: true },
      }),
      // Expenses by deductibility
      this.prisma.unifiedTransaction.groupBy({
        by: ['taxDeductible'],
        where: {
          userId,
          transactionDate: { gte: startDate, lte: endDate },
          transactionType: UnifiedTransactionType.EXPENSE,
        },
        _sum: { convertedAmount: true },
      }),
      // By IRS category
      this.prisma.unifiedTransaction.groupBy({
        by: ['irsCategory'],
        where: {
          userId,
          transactionDate: { gte: startDate, lte: endDate },
          transactionType: UnifiedTransactionType.EXPENSE,
          taxDeductible: true,
          irsCategory: { not: null },
        },
        _sum: { convertedAmount: true },
      }),
    ]);

    const deductible =
      expenseResult.find((e) => e.taxDeductible)?._sum.convertedAmount?.toNumber() ?? 0;
    const nonDeductible =
      expenseResult.find((e) => !e.taxDeductible)?._sum.convertedAmount?.toNumber() ?? 0;

    return {
      grossIncome: incomeResult._sum.convertedAmount?.toNumber() ?? 0,
      deductibleExpenses: Math.abs(deductible),
      nonDeductibleExpenses: Math.abs(nonDeductible),
      byIrsCategory: irsCategoryResult.map((row) => ({
        category: row.irsCategory ?? 'Other',
        amount: Math.abs(row._sum.convertedAmount?.toNumber() ?? 0),
      })),
    };
  }

  /**
   * Update transaction sync status
   */
  async updateSyncStatus(
    id: string,
    status: UnifiedSyncStatus,
    error?: string
  ): Promise<UnifiedTransaction> {
    return this.prisma.unifiedTransaction.update({
      where: { id },
      data: {
        syncStatus: status,
        syncError: error,
        lastSyncedAt: new Date(),
      },
    });
  }

  /**
   * Mark transactions as duplicates
   */
  async markAsDuplicate(transactionIds: string[]): Promise<number> {
    const result = await this.prisma.unifiedTransaction.updateMany({
      where: { id: { in: transactionIds } },
      data: {
        syncStatus: UnifiedSyncStatus.DUPLICATE,
        updatedAt: new Date(),
      },
    });
    return result.count;
  }

  /**
   * Delete transaction
   */
  async delete(id: string): Promise<void> {
    await this.prisma.unifiedTransaction.delete({
      where: { id },
    });
  }

  /**
   * Build Prisma where clause from filters
   */
  private buildWhereClause(
    filters: UnifiedTransactionFilters
  ): Prisma.UnifiedTransactionWhereInput {
    const where: Prisma.UnifiedTransactionWhereInput = {
      userId: filters.userId,
    };

    if (filters.sources?.length) {
      where.source = { in: filters.sources };
    }

    if (filters.transactionTypes?.length) {
      where.transactionType = { in: filters.transactionTypes };
    }

    if (filters.dateFrom || filters.dateTo) {
      where.transactionDate = {};
      if (filters.dateFrom) {
        where.transactionDate.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.transactionDate.lte = filters.dateTo;
      }
    }

    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      where.convertedAmount = {};
      if (filters.minAmount !== undefined) {
        where.convertedAmount.gte = new Prisma.Decimal(filters.minAmount);
      }
      if (filters.maxAmount !== undefined) {
        where.convertedAmount.lte = new Prisma.Decimal(filters.maxAmount);
      }
    }

    if (filters.currency) {
      where.baseCurrency = filters.currency;
    }

    if (filters.clientId) {
      where.clientId = filters.clientId;
    }

    if (filters.projectId) {
      where.cockpitProjectId = filters.projectId;
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.taxDeductible !== undefined) {
      where.taxDeductible = filters.taxDeductible;
    }

    if (filters.irsCategory) {
      where.irsCategory = filters.irsCategory;
    }

    if (filters.taxYear) {
      where.taxYear = filters.taxYear;
    }

    if (filters.syncStatus?.length) {
      where.syncStatus = { in: filters.syncStatus };
    }

    if (filters.searchTerm) {
      where.OR = [
        { description: { contains: filters.searchTerm, mode: 'insensitive' } },
        { externalClientName: { contains: filters.searchTerm, mode: 'insensitive' } },
        { externalProjectName: { contains: filters.searchTerm, mode: 'insensitive' } },
        { category: { contains: filters.searchTerm, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
