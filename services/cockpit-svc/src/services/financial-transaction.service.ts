/**
 * @module @skillancer/cockpit-svc/services/financial-transaction
 * Financial Transaction Service - Income & expense tracking
 */

import { FinanceError, FinanceErrorCode } from '../errors/finance.errors.js';
import {
  FinancialAccountRepository,
  FinancialTransactionRepository,
  TransactionCategoryRepository,
} from '../repositories/index.js';

import type {
  CreateTransactionParams,
  UpdateTransactionParams,
  TransactionFilters,
  TransactionWithDetails,
  SplitTransactionParams,
  BulkCategorizeParams,
  BulkUpdateTransactionsParams,
} from '../types/finance.types.js';
import type { FinancialTransaction } from '@prisma/client';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

export class FinancialTransactionService {
  private readonly transactionRepository: FinancialTransactionRepository;
  private readonly accountRepository: FinancialAccountRepository;
  private readonly categoryRepository: TransactionCategoryRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger
  ) {
    this.transactionRepository = new FinancialTransactionRepository(prisma);
    this.accountRepository = new FinancialAccountRepository(prisma);
    this.categoryRepository = new TransactionCategoryRepository(prisma);
  }

  /**
   * Create a new transaction
   */
  async createTransaction(params: CreateTransactionParams): Promise<FinancialTransaction> {
    // Validate account if provided
    if (params.accountId) {
      const account = await this.accountRepository.findById(params.accountId);
      if (!account || account.userId !== params.userId) {
        throw new FinanceError(FinanceErrorCode.ACCOUNT_NOT_FOUND);
      }
      if (!account.isActive) {
        throw new FinanceError(FinanceErrorCode.ACCOUNT_INACTIVE);
      }
    }

    // Validate category if provided
    if (params.categoryId) {
      const category = await this.categoryRepository.findById(params.categoryId);
      if (!category || category.userId !== params.userId) {
        throw new FinanceError(FinanceErrorCode.CATEGORY_NOT_FOUND);
      }

      // Auto-set tax deductible based on category default
      if (params.isTaxDeductible === undefined && category.isDeductible) {
        params.isTaxDeductible = true;
      }
    }

    // Validate amount
    if (params.amount <= 0) {
      throw new FinanceError(FinanceErrorCode.INVALID_TRANSACTION_AMOUNT);
    }

    const transaction = await this.transactionRepository.create(params);

    // Update account balance if account linked
    if (params.accountId) {
      await this.updateAccountBalance(params.accountId);
    }

    this.logger.info(
      { transactionId: transaction.id, userId: params.userId, amount: params.amount },
      'Transaction created'
    );

    return transaction;
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(transactionId: string, userId: string): Promise<TransactionWithDetails> {
    const transaction = await this.transactionRepository.findByIdWithDetails(transactionId);

    if (!transaction || transaction.userId !== userId) {
      throw new FinanceError(FinanceErrorCode.TRANSACTION_NOT_FOUND);
    }

    return transaction;
  }

  /**
   * List transactions with filters
   */
  async listTransactions(filters: TransactionFilters): Promise<{
    transactions: TransactionWithDetails[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { transactions, total } = await this.transactionRepository.findByFilters(filters);

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const totalPages = Math.ceil(total / limit);

    return {
      transactions,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get recent transactions
   */
  async getRecentTransactions(userId: string, limit = 10): Promise<TransactionWithDetails[]> {
    return this.transactionRepository.findRecent(userId, limit);
  }

  /**
   * Get uncategorized transactions
   */
  async getUncategorizedTransactions(userId: string, limit = 100): Promise<FinancialTransaction[]> {
    return this.transactionRepository.findUncategorized(userId, limit);
  }

  /**
   * Update a transaction
   */
  async updateTransaction(
    transactionId: string,
    userId: string,
    params: UpdateTransactionParams
  ): Promise<FinancialTransaction> {
    const existing = await this.transactionRepository.findById(transactionId);

    if (!existing || existing.userId !== userId) {
      throw new FinanceError(FinanceErrorCode.TRANSACTION_NOT_FOUND);
    }

    // Check if transaction is locked
    if (existing.isReconciled) {
      throw new FinanceError(FinanceErrorCode.TRANSACTION_ALREADY_RECONCILED);
    }

    // Validate new account if changed
    if (params.accountId && params.accountId !== existing.accountId) {
      const account = await this.accountRepository.findById(params.accountId);
      if (!account || account.userId !== userId) {
        throw new FinanceError(FinanceErrorCode.ACCOUNT_NOT_FOUND);
      }
    }

    // Validate new category if changed
    if (params.categoryId && params.categoryId !== existing.category) {
      const category = await this.categoryRepository.findById(params.categoryId);
      if (!category || category.userId !== userId) {
        throw new FinanceError(FinanceErrorCode.CATEGORY_NOT_FOUND);
      }
    }

    const transaction = await this.transactionRepository.update(transactionId, params);

    // Update account balances if account changed
    const oldAccountId = existing.accountId;
    const newAccountId = transaction.accountId;

    if (oldAccountId && oldAccountId !== newAccountId) {
      await this.updateAccountBalance(oldAccountId);
    }
    if (newAccountId) {
      await this.updateAccountBalance(newAccountId);
    }

    this.logger.info({ transactionId, userId }, 'Transaction updated');

    return transaction;
  }

  /**
   * Delete a transaction
   */
  async deleteTransaction(transactionId: string, userId: string): Promise<void> {
    const transaction = await this.transactionRepository.findById(transactionId);

    if (!transaction || transaction.userId !== userId) {
      throw new FinanceError(FinanceErrorCode.TRANSACTION_NOT_FOUND);
    }

    if (transaction.isReconciled) {
      throw new FinanceError(FinanceErrorCode.TRANSACTION_ALREADY_RECONCILED);
    }

    const accountId = transaction.accountId;

    await this.transactionRepository.delete(transactionId);

    // Update account balance
    if (accountId) {
      await this.updateAccountBalance(accountId);
    }

    this.logger.info({ transactionId, userId }, 'Transaction deleted');
  }

  /**
   * Categorize a transaction
   */
  async categorizeTransaction(
    transactionId: string,
    userId: string,
    categoryId: string
  ): Promise<FinancialTransaction> {
    const transaction = await this.transactionRepository.findById(transactionId);

    if (!transaction || transaction.userId !== userId) {
      throw new FinanceError(FinanceErrorCode.TRANSACTION_NOT_FOUND);
    }

    const category = await this.categoryRepository.findById(categoryId);
    if (!category || category.userId !== userId) {
      throw new FinanceError(FinanceErrorCode.CATEGORY_NOT_FOUND);
    }

    return this.transactionRepository.update(transactionId, {
      categoryId,
      isTaxDeductible: category.isDeductible ?? undefined,
    });
  }

  /**
   * Bulk categorize transactions
   */
  async bulkCategorize(params: BulkCategorizeParams): Promise<number> {
    const category = await this.categoryRepository.findById(params.categoryId);
    if (!category || category.userId !== params.userId) {
      throw new FinanceError(FinanceErrorCode.CATEGORY_NOT_FOUND);
    }

    const count = await this.transactionRepository.bulkUpdateCategory(
      params.transactionIds,
      params.categoryId
    );

    this.logger.info(
      { userId: params.userId, categoryId: params.categoryId, count },
      'Bulk categorization completed'
    );

    return count;
  }

  /**
   * Bulk update transactions
   */
  async bulkUpdate(params: BulkUpdateTransactionsParams): Promise<number> {
    // Validate category if provided
    if (params.updates.categoryId) {
      const category = await this.categoryRepository.findById(params.updates.categoryId);
      if (!category || category.userId !== params.userId) {
        throw new FinanceError(FinanceErrorCode.CATEGORY_NOT_FOUND);
      }
    }

    const count = await this.transactionRepository.bulkUpdate(
      params.transactionIds,
      params.updates
    );

    this.logger.info(
      { userId: params.userId, count, updates: Object.keys(params.updates) },
      'Bulk update completed'
    );

    return count;
  }

  /**
   * Split a transaction into multiple categories
   */
  async splitTransaction(params: SplitTransactionParams): Promise<FinancialTransaction[]> {
    const original = await this.transactionRepository.findById(params.originalTransactionId);

    if (!original || original.userId !== params.userId) {
      throw new FinanceError(FinanceErrorCode.TRANSACTION_NOT_FOUND);
    }

    if (original.isReconciled) {
      throw new FinanceError(FinanceErrorCode.TRANSACTION_ALREADY_RECONCILED);
    }

    // Verify split amounts equal original
    const totalSplitAmount = params.splits.reduce((sum, s) => sum + s.amount, 0);
    if (Math.abs(totalSplitAmount - Number(original.amount)) > 0.01) {
      throw new FinanceError(FinanceErrorCode.SPLIT_AMOUNTS_MISMATCH);
    }

    // Create split transactions
    const splitTransactions: FinancialTransaction[] = [];

    for (const split of params.splits) {
      const transaction = await this.transactionRepository.create({
        userId: params.userId,
        accountId: original.accountId ?? undefined,
        categoryId: split.categoryId,
        clientId: original.clientId ?? undefined,
        projectId: original.projectId ?? undefined,
        transactionType: original.type,
        amount: split.amount,
        currency: original.currency,
        transactionDate: original.date,
        description: split.description ?? original.description,
        vendor: original.vendor ?? undefined,
        isTaxDeductible: split.isTaxDeductible,
        taxDeductiblePercentage: split.taxDeductiblePercentage,
        tags: original.tags,
      });

      splitTransactions.push(transaction);
    }

    // Delete original transaction
    await this.transactionRepository.delete(params.originalTransactionId);

    this.logger.info(
      { originalId: params.originalTransactionId, splitCount: params.splits.length },
      'Transaction split completed'
    );

    return splitTransactions;
  }

  /**
   * Mark transactions as reconciled
   */
  async reconcileTransactions(transactionIds: string[], userId: string): Promise<number> {
    // Verify all transactions belong to user
    const transactions = await Promise.all(
      transactionIds.map((id) => this.transactionRepository.findById(id))
    );

    for (const t of transactions) {
      if (!t || t.userId !== userId) {
        throw new FinanceError(FinanceErrorCode.TRANSACTION_NOT_FOUND);
      }
    }

    const count = await this.transactionRepository.markReconciled(transactionIds);

    this.logger.info({ userId, count }, 'Transactions reconciled');

    return count;
  }

  /**
   * Get transaction aggregates for a period
   */
  async getAggregates(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalIncome: number;
    totalExpenses: number;
    netAmount: number;
    transactionCount: number;
  }> {
    return this.transactionRepository.getAggregates(userId, startDate, endDate);
  }

  /**
   * Get category suggestion for a vendor
   */
  async getCategorySuggestion(
    userId: string,
    vendor: string
  ): Promise<{ categoryId: string; categoryName: string } | null> {
    const category = await this.categoryRepository.getCategorySuggestion(userId, vendor);

    if (!category) return null;

    return {
      categoryId: category.id,
      categoryName: category.name,
    };
  }

  /**
   * Upload receipt for a transaction
   */
  async attachReceipt(
    transactionId: string,
    userId: string,
    receiptUrl: string
  ): Promise<FinancialTransaction> {
    const transaction = await this.transactionRepository.findById(transactionId);

    if (!transaction || transaction.userId !== userId) {
      throw new FinanceError(FinanceErrorCode.TRANSACTION_NOT_FOUND);
    }

    return this.transactionRepository.update(transactionId, { receiptUrl });
  }

  /**
   * Update account balance based on transactions
   */
  private async updateAccountBalance(accountId: string): Promise<void> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) return;

    // Calculate balance from transactions
    const result = await this.prisma.financialTransaction.groupBy({
      by: ['type'],
      where: {
        accountId,
        status: 'CONFIRMED',
      },
      _sum: { amount: true },
    });

    let balance = 0;
    for (const r of result) {
      const amount = Number(r._sum?.amount) || 0;
      if (r.type === 'INCOME') {
        balance += amount;
      } else if (r.type === 'EXPENSE') {
        balance -= amount;
      }
    }

    await this.accountRepository.updateBalance(accountId, balance);
  }
}
