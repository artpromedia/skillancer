/**
 * @module @skillancer/cockpit-svc/repositories/financial-account
 * Financial Account data access layer
 */

import type {
  CreateFinancialAccountParams,
  UpdateFinancialAccountParams,
  AccountFilters,
} from '../types/finance.types.js';
import type {
  Prisma,
  PrismaClient,
  FinancialAccount,
  FinancialAccountType,
} from '@skillancer/database';

export class FinancialAccountRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new financial account
   */
  async create(data: CreateFinancialAccountParams): Promise<FinancialAccount> {
    return this.prisma.financialAccount.create({
      data: {
        userId: data.userId,
        accountType: data.accountType,
        name: data.name,
        institutionName: data.institutionName ?? null,
        accountNumber: data.accountNumber ?? null,
        currentBalance: data.currentBalance ?? 0,
        currency: data.currency ?? 'USD',
        isDefault: data.isDefault ?? false,
        color: data.color ?? null,
        icon: data.icon ?? null,
      },
    });
  }

  /**
   * Find account by ID
   */
  async findById(id: string): Promise<FinancialAccount | null> {
    return this.prisma.financialAccount.findUnique({
      where: { id },
    });
  }

  /**
   * Find account by ID with transaction count
   */
  async findByIdWithStats(id: string): Promise<
    | (FinancialAccount & {
        _count: { transactions: number };
      })
    | null
  > {
    return this.prisma.financialAccount.findUnique({
      where: { id },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });
  }

  /**
   * Find accounts by user ID with filters
   */
  async findByFilters(filters: AccountFilters): Promise<FinancialAccount[]> {
    const where: Prisma.FinancialAccountWhereInput = {
      userId: filters.userId,
    };

    if (filters.accountType) {
      where.accountType = filters.accountType;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return this.prisma.financialAccount.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Find all accounts for a user
   */
  async findByUserId(userId: string, includeInactive = false): Promise<FinancialAccount[]> {
    return this.prisma.financialAccount.findMany({
      where: {
        userId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Find default account for a user
   */
  async findDefault(userId: string): Promise<FinancialAccount | null> {
    return this.prisma.financialAccount.findFirst({
      where: {
        userId,
        isDefault: true,
        isActive: true,
      },
    });
  }

  /**
   * Find accounts by Plaid item ID
   */
  async findByPlaidItemId(plaidItemId: string): Promise<FinancialAccount[]> {
    return this.prisma.financialAccount.findMany({
      where: { plaidItemId },
    });
  }

  /**
   * Find account by Plaid account ID
   */
  async findByPlaidAccountId(plaidAccountId: string): Promise<FinancialAccount | null> {
    return this.prisma.financialAccount.findFirst({
      where: { plaidAccountId },
    });
  }

  /**
   * Update an account
   */
  async update(id: string, data: UpdateFinancialAccountParams): Promise<FinancialAccount> {
    return this.prisma.financialAccount.update({
      where: { id },
      data: {
        name: data.name,
        institutionName: data.institutionName,
        accountNumber: data.accountNumber,
        currentBalance: data.currentBalance,
        currency: data.currency,
        isDefault: data.isDefault,
        color: data.color,
        icon: data.icon,
        isActive: data.isActive,
      },
    });
  }

  /**
   * Update account balance
   */
  async updateBalance(id: string, balance: number): Promise<FinancialAccount> {
    return this.prisma.financialAccount.update({
      where: { id },
      data: { currentBalance: balance },
    });
  }

  /**
   * Update Plaid sync status
   */
  async updatePlaidSyncStatus(
    id: string,
    data: {
      lastSyncAt?: Date;
      syncCursor?: string;
      syncStatus?: 'PENDING' | 'SYNCING' | 'SYNCED' | 'ERROR';
      syncError?: string | null;
    }
  ): Promise<FinancialAccount> {
    return this.prisma.financialAccount.update({
      where: { id },
      data: {
        lastSyncAt: data.lastSyncAt,
        syncCursor: data.syncCursor,
        syncStatus: data.syncStatus,
        syncError: data.syncError,
      },
    });
  }

  /**
   * Set account as default (and unset others)
   */
  async setAsDefault(userId: string, accountId: string): Promise<void> {
    await this.prisma.$transaction([
      // Unset all other defaults
      this.prisma.financialAccount.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      // Set the new default
      this.prisma.financialAccount.update({
        where: { id: accountId },
        data: { isDefault: true },
      }),
    ]);
  }

  /**
   * Create Plaid-connected account
   */
  async createPlaidAccount(data: {
    userId: string;
    accountType: FinancialAccountType;
    name: string;
    institutionName: string;
    plaidItemId: string;
    plaidAccountId: string;
    plaidAccessToken: string;
    accountNumber?: string;
    currentBalance?: number;
    currency?: string;
  }): Promise<FinancialAccount> {
    return this.prisma.financialAccount.create({
      data: {
        userId: data.userId,
        accountType: data.accountType,
        name: data.name,
        institutionName: data.institutionName,
        accountNumber: data.accountNumber ?? null,
        currentBalance: data.currentBalance ?? 0,
        currency: data.currency ?? 'USD',
        isPlaidConnected: true,
        plaidItemId: data.plaidItemId,
        plaidAccountId: data.plaidAccountId,
        plaidAccessToken: data.plaidAccessToken,
        syncStatus: 'PENDING',
      },
    });
  }

  /**
   * Disconnect Plaid from account
   */
  async disconnectPlaid(id: string): Promise<FinancialAccount> {
    return this.prisma.financialAccount.update({
      where: { id },
      data: {
        isPlaidConnected: false,
        plaidItemId: null,
        plaidAccountId: null,
        plaidAccessToken: null,
        syncCursor: null,
        syncStatus: null,
        syncError: null,
      },
    });
  }

  /**
   * Soft delete an account (deactivate)
   */
  async softDelete(id: string): Promise<FinancialAccount> {
    return this.prisma.financialAccount.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Hard delete an account
   */
  async delete(id: string): Promise<void> {
    await this.prisma.financialAccount.delete({
      where: { id },
    });
  }

  /**
   * Count accounts for a user
   */
  async countByUserId(userId: string, isActive?: boolean): Promise<number> {
    return this.prisma.financialAccount.count({
      where: {
        userId,
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });
  }

  /**
   * Get accounts needing sync (for background worker)
   */
  async findAccountsNeedingSync(syncIntervalMinutes = 60): Promise<FinancialAccount[]> {
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - syncIntervalMinutes);

    return this.prisma.financialAccount.findMany({
      where: {
        isPlaidConnected: true,
        isActive: true,
        OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: cutoffTime } }],
        syncStatus: { not: 'SYNCING' },
      },
    });
  }
}
