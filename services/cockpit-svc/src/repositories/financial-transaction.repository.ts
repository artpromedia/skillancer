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
  Prisma,
  PrismaClient,
  FinancialTransaction,
  FinancialTransactionType,
  FinancialTransactionSource,
  FinancialTransactionStatus,
} from '@skillancer/database';

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
        categoryId: data.categoryId ?? null,
        clientId: data.clientId ?? null,
        projectId: data.projectId ?? null,
        transactionType: data.transactionType,
        amount: data.amount,
        currency: data.currency ?? 'USD',
        transactionDate: data.transactionDate,
        description: data.description,
        vendor: data.vendor ?? null,
        invoiceNumber: data.invoiceNumber ?? null,
        notes: data.notes ?? null,
        receiptUrl: data.receiptUrl ?? null,
        isRecurring: data.isRecurring ?? false,
        recurringTransactionId: data.recurringTransactionId ?? null,
        isTaxDeductible: data.isTaxDeductible ?? false,
        taxDeductiblePercentage: data.taxDeductiblePercentage ?? 100,
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
        transactionType: data.transactionType,
        amount: data.amount,
        currency: data.currency ?? 'USD',
        transactionDate: data.transactionDate,
        description: data.description,
        vendor: data.vendor ?? null,
        plaidTransactionId: data.plaidTransactionId,
        source: 'PLAID',
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
        category: { select: { id: true, name: true, type: true, icon: true, color: true } },
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

    const orderBy: Prisma.FinancialTransactionOrderByWithRelationInput = {};
    const sortBy = filters.sortBy ?? 'transactionDate';
    const sortOrder = filters.sortOrder ?? 'desc';
    orderBy[sortBy] = sortOrder;

    const [transactions, total] = await Promise.all([
      this.prisma.financialTransaction.findMany({
        where,
        include: {
          account: { select: { id: true, name: true, accountType: true } },
          category: { select: { id: true, name: true, type: true, icon: true, color: true } },
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
        categoryId: null,
        status: 'CONFIRMED',
      },
      orderBy: { transactionDate: 'desc' },
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
        category: { select: { id: true, name: true, type: true, icon: true, color: true } },
        client: { select: { id: true, firstName: true, lastName: true, companyName: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { transactionDate: 'desc' },
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
        categoryId: data.categoryId,
        clientId: data.clientId,
        projectId: data.projectId,
        amount: data.amount,
        currency: data.currency,
        transactionDate: data.transactionDate,
        description: data.description,
        vendor: data.vendor,
        invoiceNumber: data.invoiceNumber,
        notes: data.notes,
        receiptUrl: data.receiptUrl,
        isTaxDeductible: data.isTaxDeductible,
        taxDeductiblePercentage: data.taxDeductiblePercentage,
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
        transactionDate: data.transactionDate,
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
      data: { categoryId },
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
      data,
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
      by: ['transactionType'],
      where: {
        userId,
        transactionDate: { gte: startDate, lte: endDate },
        status: 'CONFIRMED',
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    let totalIncome = 0;
    let totalExpenses = 0;
    let transactionCount = 0;

    for (const result of results) {
      const amount = Number(result._sum.amount) || 0;
      const count = result._count.id;

      if (result.transactionType === 'INCOME') {
        totalIncome = amount;
      } else if (result.transactionType === 'EXPENSE') {
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
      transactionDate: { gte: startDate, lte: endDate },
      status: 'CONFIRMED',
    };

    if (transactionType) {
      where.transactionType = transactionType;
    }

    const results = await this.prisma.financialTransaction.groupBy({
      by: ['categoryId'],
      where,
      _sum: { amount: true },
      _count: { id: true },
    });

    // Get category names
    const categoryIds = results.map((r) => r.categoryId).filter((id): id is string => id !== null);

    const categories = await this.prisma.transactionCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    return results.map((r) => ({
      categoryId: r.categoryId,
      categoryName: r.categoryId ? (categoryMap.get(r.categoryId) ?? null) : null,
      total: Number(r._sum.amount) || 0,
      count: r._count.id,
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
        transactionDate: { gte: startDate, lte: endDate },
        transactionType: 'INCOME',
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
      total: Number(r._sum.amount) || 0,
      count: r._count.id,
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
        transactionType: 'EXPENSE',
        isTaxDeductible: true,
        transactionDate: { gte: startDate, lte: endDate },
        status: 'CONFIRMED',
      },
      include: {
        category: {
          select: { id: true, name: true, irsCategory: true, scheduleC: true },
        },
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
      const deductibleAmount = Number(t.amount) * ((t.taxDeductiblePercentage ?? 100) / 100);
      total += deductibleAmount;

      const key = t.categoryId ?? 'uncategorized';
      const existing = categoryTotals.get(key);

      if (existing) {
        existing.total += deductibleAmount;
      } else {
        categoryTotals.set(key, {
          categoryId: t.categoryId,
          categoryName: t.category?.name ?? null,
          irsCategory: t.category?.irsCategory ?? null,
          scheduleC: t.category?.scheduleC ?? null,
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
      where.categoryId = filters.categoryId;
    }

    if (filters.clientId) {
      where.clientId = filters.clientId;
    }

    if (filters.projectId) {
      where.projectId = filters.projectId;
    }

    if (filters.transactionType) {
      where.transactionType = filters.transactionType;
    }

    if (filters.source) {
      where.source = filters.source;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      where.transactionDate = {};
      if (filters.startDate) {
        where.transactionDate.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.transactionDate.lte = filters.endDate;
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
      where.isTaxDeductible = filters.isTaxDeductible;
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
