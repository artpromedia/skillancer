/**
 * @module @skillancer/cockpit-svc/repositories/financial-transaction
 * Financial Transaction data access layer
 */

import type {
  CreateTransactionParams,
  UpdateTransactionParams,
  TransactionFilters,
  TransactionWithDetails,
} from '../types/finance.types.js';
import type {
  FinancialTransaction,
  FinancialTransactionType,
  FinancialTransactionSource,
  FinancialTransactionStatus,
} from '@prisma/client';
import type { Prisma, PrismaClient } from '@skillancer/database';

export interface TransactionAggregate {
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
  transactionCount: number;
}

export class FinancialTransactionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new transaction
   */
  async create(data: CreateTransactionParams): Promise<FinancialTransaction> {
    return this.prisma.financialTransaction.create({
      data: {
        userId: data.userId,
        accountId: data.accountId ?? null,
        category: data.categoryId ?? 'Uncategorized',
        clientId: data.clientId ?? null,
        projectId: data.projectId ?? null,
        type: data.transactionType,
        amount: data.amount,
        currency: data.currency ?? 'USD',
        date: data.transactionDate,
        description: data.description,
        vendor: data.vendor ?? null,
        notes: data.notes ?? null,
        receiptUrl: data.receiptUrl ?? null,
        isRecurring: data.isRecurring ?? false,
        recurringRuleId: data.recurringTransactionId ?? null,
        isDeductible: data.isTaxDeductible ?? false,
        tags: data.tags ?? [],
        source: 'MANUAL',
        status: 'CONFIRMED',
      },
    });
  }

  /**
   * Create transaction from Plaid sync
   */
  async createFromPlaid(data: {
    userId: string;
    accountId: string;
    transactionType: FinancialTransactionType;
    amount: number;
    currency?: string;
    transactionDate: Date;
    description: string;
    vendor?: string;
    plaidTransactionId: string;
    isPending: boolean;
  }): Promise<FinancialTransaction> {
    return this.prisma.financialTransaction.create({
      data: {
        userId: data.userId,
        accountId: data.accountId,
        type: data.transactionType,
        amount: data.amount,
        currency: data.currency ?? 'USD',
        date: data.transactionDate,
        description: data.description,
        vendor: data.vendor ?? null,
        category: 'Uncategorized',
        plaidTransactionId: data.plaidTransactionId,
        source: 'BANK_IMPORT',
        status: data.isPending ? 'PENDING' : 'CONFIRMED',
      },
    });
  }

  /**
   * Find transaction by ID
   */
  async findById(id: string): Promise<FinancialTransaction | null> {
    return this.prisma.financialTransaction.findUnique({
      where: { id },
    });
  }

  /**
   * Find transaction by ID with details
   */
  async findByIdWithDetails(id: string): Promise<TransactionWithDetails | null> {
    return this.prisma.financialTransaction.findUnique({
      where: { id },
      include: {
        account: { select: { id: true, name: true, accountType: true } },
        client: { select: { id: true, firstName: true, lastName: true, companyName: true } },
        project: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Find transaction by Plaid transaction ID
   */
  async findByPlaidTransactionId(plaidTransactionId: string): Promise<FinancialTransaction | null> {
    return this.prisma.financialTransaction.findFirst({
      where: { plaidTransactionId },
    });
  }

  /**
   * Find transactions with filters and pagination
   */
  async findByFilters(filters: TransactionFilters): Promise<{
    transactions: TransactionWithDetails[];
    total: number;
  }> {
    const where = this.buildWhereClause(filters);
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const skip = (page - 1) * limit;

    const sortBy = filters.sortBy ?? 'date';
    const sortOrder = filters.sortOrder ?? 'desc';

    // Build orderBy with proper typing
    const orderByField = sortBy === 'transactionDate' ? 'date' : sortBy;
    const orderBy = {
      [orderByField]: sortOrder,
    } as Prisma.FinancialTransactionOrderByWithRelationInput;

    const [transactions, total] = await Promise.all([
      this.prisma.financialTransaction.findMany({
        where,
        include: {
          account: { select: { id: true, name: true, accountType: true } },
          client: { select: { id: true, firstName: true, lastName: true, companyName: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.financialTransaction.count({ where }),
    ]);

    return { transactions, total };
  }

  /**
   * Find uncategorized transactions
   */
  async findUncategorized(userId: string, limit = 100): Promise<FinancialTransaction[]> {
    return this.prisma.financialTransaction.findMany({
      where: {
        userId,
        category: 'Uncategorized',
        status: 'CONFIRMED',
      },
      orderBy: { date: 'desc' },
      take: limit,
    });
  }

  /**
   * Find recent transactions
   */
  async findRecent(userId: string, limit = 10): Promise<TransactionWithDetails[]> {
    return this.prisma.financialTransaction.findMany({
      where: { userId },
      include: {
        account: { select: { id: true, name: true, accountType: true } },
        client: { select: { id: true, firstName: true, lastName: true, companyName: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
      take: limit,
    });
  }

  /**
   * Update a transaction
   */
  async update(id: string, data: UpdateTransactionParams): Promise<FinancialTransaction> {
    return this.prisma.financialTransaction.update({
      where: { id },
      data: {
        accountId: data.accountId,
        category: data.categoryId,
        clientId: data.clientId,
        projectId: data.projectId,
        amount: data.amount,
        currency: data.currency,
        date: data.transactionDate,
        description: data.description,
        vendor: data.vendor,
        notes: data.notes,
        receiptUrl: data.receiptUrl,
        isDeductible: data.isTaxDeductible,
        tags: data.tags,
        status: data.status,
        isReconciled: data.isReconciled,
      },
    });
  }

  /**
   * Update transaction status from Plaid (pending -> confirmed)
   */
  async updateFromPlaid(
    plaidTransactionId: string,
    data: {
      amount?: number;
      transactionDate?: Date;
      description?: string;
      vendor?: string;
      isPending?: boolean;
    }
  ): Promise<FinancialTransaction | null> {
    const existing = await this.findByPlaidTransactionId(plaidTransactionId);
    if (!existing) return null;

    return this.prisma.financialTransaction.update({
      where: { id: existing.id },
      data: {
        amount: data.amount,
        date: data.transactionDate,
        description: data.description,
        vendor: data.vendor,
        status: data.isPending ? 'PENDING' : 'CONFIRMED',
      },
    });
  }

  /**
   * Bulk categorize transactions
   */
  async bulkUpdateCategory(transactionIds: string[], categoryId: string): Promise<number> {
    const result = await this.prisma.financialTransaction.updateMany({
      where: { id: { in: transactionIds } },
      data: { category: categoryId },
    });
    return result.count;
  }

  /**
   * Bulk update transactions
   */
  async bulkUpdate(
    transactionIds: string[],
    data: {
      categoryId?: string;
      isTaxDeductible?: boolean;
      isReconciled?: boolean;
      tags?: string[];
    }
  ): Promise<number> {
    const result = await this.prisma.financialTransaction.updateMany({
      where: { id: { in: transactionIds } },
      data: {
        category: data.categoryId,
        isDeductible: data.isTaxDeductible,
        isReconciled: data.isReconciled,
        tags: data.tags,
      },
    });
    return result.count;
  }

  /**
   * Mark transactions as reconciled
   */
  async markReconciled(transactionIds: string[], isReconciled = true): Promise<number> {
    const result = await this.prisma.financialTransaction.updateMany({
      where: { id: { in: transactionIds } },
      data: { isReconciled, reconciledAt: isReconciled ? new Date() : null },
    });
    return result.count;
  }

  /**
   * Delete a transaction
   */
  async delete(id: string): Promise<void> {
    await this.prisma.financialTransaction.delete({
      where: { id },
    });
  }

  /**
   * Delete transactions by Plaid transaction IDs
   */
  async deleteByPlaidIds(plaidTransactionIds: string[]): Promise<number> {
    const result = await this.prisma.financialTransaction.deleteMany({
      where: { plaidTransactionId: { in: plaidTransactionIds } },
    });
    return result.count;
  }

  /**
   * Get aggregates for a period
   */
  async getAggregates(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TransactionAggregate> {
    const results = await this.prisma.financialTransaction.groupBy({
      by: ['type'],
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
        status: 'CONFIRMED',
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    let totalIncome = 0;
    let totalExpenses = 0;
    let transactionCount = 0;

    for (const result of results) {
      const amount = Number(result._sum?.amount) || 0;
      const count = result._count?.id ?? 0;

      if (result.type === 'INCOME') {
        totalIncome = amount;
      } else if (result.type === 'EXPENSE') {
        totalExpenses = amount;
      }
      transactionCount += count;
    }

    return {
      totalIncome,
      totalExpenses,
      netAmount: totalIncome - totalExpenses,
      transactionCount,
    };
  }

  /**
   * Get aggregates by category
   */
  async getAggregatesByCategory(
    userId: string,
    startDate: Date,
    endDate: Date,
    transactionType?: FinancialTransactionType
  ): Promise<
    Array<{
      categoryId: string | null;
      categoryName: string | null;
      total: number;
      count: number;
    }>
  > {
    const where: Prisma.FinancialTransactionWhereInput = {
      userId,
      date: { gte: startDate, lte: endDate },
      status: 'CONFIRMED',
    };

    if (transactionType) {
      where.type = transactionType;
    }

    const results = await this.prisma.financialTransaction.groupBy({
      by: ['category'],
      where,
      _sum: { amount: true },
      _count: { id: true },
    });

    // Get category names - since category is a string field, we use it directly
    return results.map((r) => ({
      categoryId: r.category,
      categoryName: r.category,
      total: Number(r._sum?.amount) || 0,
      count: r._count?.id ?? 0,
    }));
  }

  /**
   * Get aggregates by client
   */
  async getAggregatesByClient(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      clientId: string | null;
      clientName: string | null;
      total: number;
      count: number;
    }>
  > {
    const results = await this.prisma.financialTransaction.groupBy({
      by: ['clientId'],
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
        type: 'INCOME',
        status: 'CONFIRMED',
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    // Get client names
    const clientIds = results.map((r) => r.clientId).filter((id): id is string => id !== null);

    const clients = await this.prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, firstName: true, lastName: true, companyName: true },
    });

    const clientMap = new Map(
      clients.map((c) => [c.id, c.companyName || `${c.firstName} ${c.lastName}`.trim()])
    );

    return results.map((r) => ({
      clientId: r.clientId,
      clientName: r.clientId ? (clientMap.get(r.clientId) ?? null) : null,
      total: Number(r._sum?.amount) || 0,
      count: r._count?.id ?? 0,
    }));
  }

  /**
   * Get tax deductible expenses
   */
  async getTaxDeductibleExpenses(
    userId: string,
    taxYear: number
  ): Promise<{
    total: number;
    byCategory: Array<{
      categoryId: string | null;
      categoryName: string | null;
      irsCategory: string | null;
      scheduleC: string | null;
      total: number;
    }>;
  }> {
    const startDate = new Date(taxYear, 0, 1);
    const endDate = new Date(taxYear, 11, 31, 23, 59, 59);

    const transactions = await this.prisma.financialTransaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        isDeductible: true,
        date: { gte: startDate, lte: endDate },
        status: 'CONFIRMED',
      },
    });

    let total = 0;
    const categoryTotals = new Map<
      string | null,
      {
        categoryId: string | null;
        categoryName: string | null;
        irsCategory: string | null;
        scheduleC: string | null;
        total: number;
      }
    >();

    for (const t of transactions) {
      // category is a string field, deductionCategory maps to IRS category
      const deductibleAmount = Number(t.amount);
      total += deductibleAmount;

      const key = t.category ?? 'uncategorized';
      const existing = categoryTotals.get(key);

      if (existing) {
        existing.total += deductibleAmount;
      } else {
        categoryTotals.set(key, {
          categoryId: t.category,
          categoryName: t.category,
          irsCategory: t.deductionCategory ?? null,
          scheduleC: null,
          total: deductibleAmount,
        });
      }
    }

    return {
      total,
      byCategory: Array.from(categoryTotals.values()).sort((a, b) => b.total - a.total),
    };
  }

  /**
   * Build where clause from filters
   */
  private buildWhereClause(filters: TransactionFilters): Prisma.FinancialTransactionWhereInput {
    const where: Prisma.FinancialTransactionWhereInput = {
      userId: filters.userId,
    };

    if (filters.accountId) {
      where.accountId = filters.accountId;
    }

    if (filters.categoryId) {
      where.category = filters.categoryId;
    }

    if (filters.clientId) {
      where.clientId = filters.clientId;
    }

    if (filters.projectId) {
      where.projectId = filters.projectId;
    }

    if (filters.transactionType) {
      where.type = filters.transactionType;
    }

    if (filters.source) {
      where.source = filters.source;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) {
        where.date.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.date.lte = filters.endDate;
      }
    }

    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      where.amount = {};
      if (filters.minAmount !== undefined) {
        where.amount.gte = filters.minAmount;
      }
      if (filters.maxAmount !== undefined) {
        where.amount.lte = filters.maxAmount;
      }
    }

    if (filters.isTaxDeductible !== undefined) {
      where.isDeductible = filters.isTaxDeductible;
    }

    if (filters.isReconciled !== undefined) {
      where.isReconciled = filters.isReconciled;
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    if (filters.search) {
      where.OR = [
        { description: { contains: filters.search, mode: 'insensitive' } },
        { vendor: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
