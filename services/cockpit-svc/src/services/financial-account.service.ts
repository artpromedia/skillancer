/**
 * @module @skillancer/cockpit-svc/services/financial-account
 * Financial Account Service - Bank & payment account management
 */

import { FinanceError, FinanceErrorCode } from '../errors/finance.errors.js';
import {
  FinancialAccountRepository,
  TransactionCategoryRepository,
} from '../repositories/index.js';

import type {
  CreateFinancialAccountParams,
  UpdateFinancialAccountParams,
  AccountFilters,
  FinancialAccountWithBalance,
} from '../types/finance.types.js';
import type { FinancialAccount } from '@prisma/client';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

export class FinancialAccountService {
  private readonly accountRepository: FinancialAccountRepository;
  private readonly categoryRepository: TransactionCategoryRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger
  ) {
    this.accountRepository = new FinancialAccountRepository(prisma);
    this.categoryRepository = new TransactionCategoryRepository(prisma);
  }

  /**
   * Create a new financial account
   */
  async createAccount(params: CreateFinancialAccountParams): Promise<FinancialAccount> {
    // Check for duplicate name
    const existing = await this.prisma.financialAccount.findFirst({
      where: {
        userId: params.userId,
        name: { equals: params.name, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new FinanceError(FinanceErrorCode.ACCOUNT_ALREADY_EXISTS);
    }

    // If this is the first account, make it primary
    const accountCount = await this.accountRepository.countByUserId(params.userId);
    if (accountCount === 0) {
      params.isPrimary = true;
    }

    // Initialize default categories if user doesn't have any
    const hasCategories = await this.categoryRepository.userHasCategories(params.userId);
    if (!hasCategories) {
      await this.categoryRepository.createDefaultCategories(params.userId);
      this.logger.info({ userId: params.userId }, 'Default categories created');
    }

    const account = await this.accountRepository.create(params);

    this.logger.info(
      { accountId: account.id, userId: params.userId, type: params.accountType },
      'Financial account created'
    );

    return account;
  }

  /**
   * Get account by ID
   */
  async getAccount(accountId: string, userId: string): Promise<FinancialAccountWithBalance> {
    const account = await this.accountRepository.findByIdWithStats(accountId);

    if (!account || account.userId !== userId) {
      throw new FinanceError(FinanceErrorCode.ACCOUNT_NOT_FOUND);
    }

    // Get pending transaction count
    const pendingCount = await this.prisma.financialTransaction.count({
      where: {
        accountId,
        status: 'PENDING',
      },
    });

    return {
      ...account,
      pendingTransactionCount: pendingCount,
      lastSyncDate: account.lastSyncAt,
    };
  }

  /**
   * List accounts for a user
   */
  async listAccounts(
    userId: string,
    filters?: Partial<AccountFilters>
  ): Promise<FinancialAccount[]> {
    return this.accountRepository.findByFilters({
      userId,
      ...filters,
    });
  }

  /**
   * Get all active accounts for a user
   */
  async getActiveAccounts(userId: string): Promise<FinancialAccount[]> {
    return this.accountRepository.findByUserId(userId, false);
  }

  /**
   * Get default account for a user
   */
  async getDefaultAccount(userId: string): Promise<FinancialAccount | null> {
    return this.accountRepository.findDefault(userId);
  }

  /**
   * Update an account
   */
  async updateAccount(
    accountId: string,
    userId: string,
    params: UpdateFinancialAccountParams
  ): Promise<FinancialAccount> {
    const existing = await this.accountRepository.findById(accountId);

    if (!existing || existing.userId !== userId) {
      throw new FinanceError(FinanceErrorCode.ACCOUNT_NOT_FOUND);
    }

    // If setting as primary, unset other primaries
    if (params.isPrimary === true) {
      await this.accountRepository.setAsPrimary(userId, accountId);
    }

    // Don't allow unsetting the only primary
    if (params.isPrimary === false && existing.isPrimary) {
      const primaryCount = await this.prisma.financialAccount.count({
        where: { userId, isPrimary: true, isActive: true },
      });

      if (primaryCount <= 1) {
        throw new FinanceError(FinanceErrorCode.DEFAULT_ACCOUNT_REQUIRED);
      }
    }

    const account = await this.accountRepository.update(accountId, params);

    this.logger.info({ accountId, userId }, 'Financial account updated');

    return account;
  }

  /**
   * Set account as primary
   */
  async setAsPrimary(accountId: string, userId: string): Promise<void> {
    const account = await this.accountRepository.findById(accountId);

    if (!account || account.userId !== userId) {
      throw new FinanceError(FinanceErrorCode.ACCOUNT_NOT_FOUND);
    }

    if (!account.isActive) {
      throw new FinanceError(FinanceErrorCode.ACCOUNT_INACTIVE);
    }

    await this.accountRepository.setAsPrimary(userId, accountId);

    this.logger.info({ accountId, userId }, 'Account set as primary');
  }

  /**
   * Deactivate an account (soft delete)
   */
  async deactivateAccount(accountId: string, userId: string): Promise<FinancialAccount> {
    const account = await this.accountRepository.findById(accountId);

    if (!account || account.userId !== userId) {
      throw new FinanceError(FinanceErrorCode.ACCOUNT_NOT_FOUND);
    }

    // Don't allow deactivating the only primary account
    if (account.isPrimary) {
      const activeCount = await this.accountRepository.countByUserId(userId, true);
      if (activeCount <= 1) {
        throw new FinanceError(FinanceErrorCode.CANNOT_DELETE_DEFAULT_ACCOUNT);
      }

      // Set another account as primary
      const otherAccount = await this.prisma.financialAccount.findFirst({
        where: { userId, id: { not: accountId }, isActive: true },
      });

      if (otherAccount) {
        await this.accountRepository.setAsPrimary(userId, otherAccount.id);
      }
    }

    const deactivated = await this.accountRepository.softDelete(accountId);

    this.logger.info({ accountId, userId }, 'Financial account deactivated');

    return deactivated;
  }

  /**
   * Delete an account permanently
   */
  async deleteAccount(accountId: string, userId: string): Promise<void> {
    const account = await this.accountRepository.findByIdWithStats(accountId);

    if (!account || account.userId !== userId) {
      throw new FinanceError(FinanceErrorCode.ACCOUNT_NOT_FOUND);
    }

    // Check for existing transactions
    if (account._count.transactions > 0) {
      throw new FinanceError(FinanceErrorCode.ACCOUNT_HAS_TRANSACTIONS);
    }

    // Don't allow deleting the only primary account
    if (account.isPrimary) {
      throw new FinanceError(FinanceErrorCode.CANNOT_DELETE_DEFAULT_ACCOUNT);
    }

    await this.accountRepository.delete(accountId);

    this.logger.info({ accountId, userId }, 'Financial account deleted');
  }

  /**
   * Get account summary with balances
   */
  async getAccountsSummary(userId: string): Promise<{
    totalBalance: number;
    accounts: Array<{
      id: string;
      name: string;
      type: string;
      balance: number;
      isPrimary: boolean;
      isConnected: boolean;
      lastSyncAt: Date | null;
    }>;
  }> {
    const accounts = await this.accountRepository.findByUserId(userId, false);

    let totalBalance = 0;
    const accountSummaries = accounts.map((account) => {
      const balance = Number(account.currentBalance) || 0;
      totalBalance += balance;

      return {
        id: account.id,
        name: account.name,
        type: account.accountType,
        balance,
        isPrimary: account.isPrimary,
        isConnected: account.isConnected,
        lastSyncAt: account.lastSyncAt,
      };
    });

    return {
      totalBalance,
      accounts: accountSummaries,
    };
  }

  /**
   * Refresh account balance from transactions
   */
  async refreshBalance(accountId: string, userId: string): Promise<FinancialAccount> {
    const account = await this.accountRepository.findById(accountId);

    if (!account || account.userId !== userId) {
      throw new FinanceError(FinanceErrorCode.ACCOUNT_NOT_FOUND);
    }

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

    const updated = await this.accountRepository.updateBalance(accountId, balance);

    this.logger.info({ accountId, balance }, 'Account balance refreshed');

    return updated;
  }
}
