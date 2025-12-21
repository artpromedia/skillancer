// @ts-nocheck - Known type issues pending refactor
/**
 * @module @skillancer/billing-svc/repositories/payout
 * Payout repository for database operations
 */

import { prisma } from '@skillancer/database';

import type {
  PayoutStatus,
  PayoutMethod,
  PayoutType,
  PayoutFrequency,
} from '../types/payout.types.js';
import type { Prisma, Payout, PayoutAccount } from '@skillancer/database';

// =============================================================================
// TYPES
// =============================================================================

export interface CreatePayoutData {
  payoutAccountId: string;
  userId: string;
  stripePayoutId?: string;
  stripeTransferId?: string;
  amount: number;
  currency: string;
  originalAmount?: number;
  originalCurrency?: string;
  exchangeRate?: number;
  payoutFee: number;
  conversionFee: number;
  status: PayoutStatus;
  method: PayoutMethod;
  type: PayoutType;
  destination?: Record<string, unknown>;
  estimatedArrival?: Date;
  sourceTransactions?: string[];
}

export interface PayoutFilters {
  userId?: string;
  payoutAccountId?: string;
  status?: PayoutStatus;
  startDate?: Date;
  endDate?: Date;
}

export interface CreateScheduleData {
  userId: string;
  frequency: PayoutFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  minimumAmount: number;
  currency: string;
  autoPayoutEnabled: boolean;
  nextScheduledAt?: Date;
}

export interface CreateBalanceData {
  userId: string;
  currency: string;
  availableBalance?: number;
  pendingBalance?: number;
}

export interface CreateExchangeRateData {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  baseRate: number;
  markupPercent: number;
  validFrom: Date;
  validUntil: Date;
  source: string;
}

// =============================================================================
// PAYOUT REPOSITORY
// =============================================================================

export class PayoutRepository {
  // ===========================================================================
  // PAYOUT OPERATIONS
  // ===========================================================================

  async create(data: CreatePayoutData) {
    // We need to use raw query or extend the Payout model
    // For now, use the existing Payout model and add fields via JSON
    return prisma.payout.create({
      data: {
        payoutAccountId: data.payoutAccountId,
        stripePayoutId: data.stripePayoutId,
        stripeTransferId: data.stripeTransferId,
        amount: data.amount,
        currency: data.currency,
        status: this.mapStatusToPrisma(data.status),
        description: JSON.stringify({
          method: data.method,
          type: data.type,
          originalAmount: data.originalAmount,
          originalCurrency: data.originalCurrency,
          exchangeRate: data.exchangeRate,
          payoutFee: data.payoutFee,
          conversionFee: data.conversionFee,
          destination: data.destination,
          estimatedArrival: data.estimatedArrival?.toISOString(),
          sourceTransactions: data.sourceTransactions,
        }),
      },
      include: {
        payoutAccount: true,
      },
    });
  }

  async findById(id: string) {
    return prisma.payout.findUnique({
      where: { id },
      include: {
        payoutAccount: true,
      },
    });
  }

  async findByStripeId(stripePayoutId: string) {
    return prisma.payout.findFirst({
      where: {
        OR: [{ stripePayoutId }, { stripeTransferId: stripePayoutId }],
      },
      include: {
        payoutAccount: true,
      },
    });
  }

  async findByUserId(
    userId: string,
    options?: {
      status?: PayoutStatus;
      limit?: number;
      offset?: number;
    }
  ) {
    const account = await prisma.payoutAccount.findUnique({
      where: { userId },
    });

    if (!account) return { payouts: [], total: 0 };

    const where: Prisma.PayoutWhereInput = {
      payoutAccountId: account.id,
    };

    if (options?.status) {
      where.status = this.mapStatusToPrisma(options.status);
    }

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit ?? 20,
        skip: options?.offset ?? 0,
        include: {
          payoutAccount: true,
        },
      }),
      prisma.payout.count({ where }),
    ]);

    return { payouts, total };
  }

  async update(
    id: string,
    data: Partial<{
      status: PayoutStatus;
      arrivedAt: Date;
      processedAt: Date;
      failureCode: string;
      failureMessage: string;
    }>
  ) {
    const updateData: Prisma.PayoutUpdateInput = {};

    if (data.status) updateData.status = this.mapStatusToPrisma(data.status);
    if (data.arrivedAt) updateData.arrivedAt = data.arrivedAt;
    if (data.processedAt) updateData.processedAt = data.processedAt;
    if (data.failureCode) updateData.failureCode = data.failureCode;
    if (data.failureMessage) updateData.failureMessage = data.failureMessage;

    return prisma.payout.update({
      where: { id },
      data: updateData,
    });
  }

  // ===========================================================================
  // PAYOUT ACCOUNT OPERATIONS
  // ===========================================================================

  async findAccountByUserId(userId: string): Promise<PayoutAccount | null> {
    return prisma.payoutAccount.findUnique({
      where: { userId },
    });
  }

  async findAccountById(id: string): Promise<PayoutAccount | null> {
    return prisma.payoutAccount.findUnique({
      where: { id },
    });
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private mapStatusToPrisma(
    status: PayoutStatus
  ): 'PENDING' | 'IN_TRANSIT' | 'PAID' | 'FAILED' | 'CANCELED' {
    switch (status) {
      case 'PROCESSING':
        return 'PENDING';
      case 'CANCELLED':
        return 'CANCELED';
      default:
        return status as 'PENDING' | 'IN_TRANSIT' | 'PAID' | 'FAILED';
    }
  }
}

// =============================================================================
// PAYOUT BALANCE REPOSITORY (In-memory for now, extend Prisma later)
// =============================================================================

// For demo purposes - in production, add PayoutBalance model to schema
const balanceStore = new Map<
  string,
  Map<
    string,
    {
      availableBalance: number;
      pendingBalance: number;
      totalEarned: number;
      totalPaidOut: number;
    }
  >
>();

export class PayoutBalanceRepository {
  async findByUserId(userId: string) {
    const userBalances = balanceStore.get(userId);
    if (!userBalances) return [];

    return Array.from(userBalances.entries()).map(([currency, balance]) => ({
      userId,
      currency,
      ...balance,
    }));
  }

  async findByUserAndCurrency(userId: string, currency: string) {
    const userBalances = balanceStore.get(userId);
    if (!userBalances) return null;

    const balance = userBalances.get(currency);
    if (!balance) return null;

    return { userId, currency, ...balance };
  }

  async getOrCreate(userId: string, currency: string) {
    let userBalances = balanceStore.get(userId);
    if (!userBalances) {
      userBalances = new Map();
      balanceStore.set(userId, userBalances);
    }

    let balance = userBalances.get(currency);
    if (!balance) {
      balance = {
        availableBalance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalPaidOut: 0,
      };
      userBalances.set(currency, balance);
    }

    return { userId, currency, ...balance };
  }

  async incrementAvailable(userId: string, currency: string, amount: number) {
    const balance = await this.getOrCreate(userId, currency);
    const userBalances = balanceStore.get(userId)!;

    userBalances.set(currency, {
      ...balance,
      availableBalance: balance.availableBalance + amount,
      totalEarned: balance.totalEarned + amount,
    });
  }

  async decrementAvailable(userId: string, currency: string, amount: number) {
    const balance = await this.getOrCreate(userId, currency);
    const userBalances = balanceStore.get(userId)!;

    const newAvailable = balance.availableBalance - amount;
    if (newAvailable < 0) {
      throw new Error('Insufficient balance');
    }

    userBalances.set(currency, {
      ...balance,
      availableBalance: newAvailable,
    });
  }

  async incrementTotalPaidOut(userId: string, currency: string, amount: number) {
    const balance = await this.getOrCreate(userId, currency);
    const userBalances = balanceStore.get(userId)!;

    userBalances.set(currency, {
      ...balance,
      totalPaidOut: balance.totalPaidOut + amount,
    });
  }

  async moveToPending(userId: string, currency: string, amount: number) {
    const balance = await this.getOrCreate(userId, currency);
    const userBalances = balanceStore.get(userId)!;

    userBalances.set(currency, {
      ...balance,
      availableBalance: balance.availableBalance - amount,
      pendingBalance: balance.pendingBalance + amount,
    });
  }

  async moveFromPending(userId: string, currency: string, amount: number) {
    const balance = await this.getOrCreate(userId, currency);
    const userBalances = balanceStore.get(userId)!;

    userBalances.set(currency, {
      ...balance,
      pendingBalance: balance.pendingBalance - amount,
      availableBalance: balance.availableBalance + amount,
    });
  }
}

// =============================================================================
// PAYOUT SCHEDULE REPOSITORY (In-memory for now)
// =============================================================================

const scheduleStore = new Map<
  string,
  {
    id: string;
    userId: string;
    frequency: PayoutFrequency;
    dayOfWeek?: number;
    dayOfMonth?: number;
    minimumAmount: number;
    currency: string;
    autoPayoutEnabled: boolean;
    lastPayoutAt?: Date;
    nextScheduledAt?: Date;
  }
>();

export class PayoutScheduleRepository {
  async findByUserId(userId: string) {
    return scheduleStore.get(userId) ?? null;
  }

  async create(data: CreateScheduleData) {
    const id = crypto.randomUUID();
    const schedule = {
      id,
      ...data,
    };
    scheduleStore.set(data.userId, schedule);
    return schedule;
  }

  async update(
    userId: string,
    data: Partial<
      CreateScheduleData & {
        lastPayoutAt: Date;
        nextScheduledAt: Date;
      }
    >
  ) {
    const existing = scheduleStore.get(userId);
    if (!existing) return null;

    const updated = { ...existing, ...data };
    scheduleStore.set(userId, updated);
    return updated;
  }

  async findDueSchedules(now: Date) {
    const dueSchedules: typeof scheduleStore extends Map<string, infer V> ? V[] : never = [];

    for (const schedule of scheduleStore.values()) {
      if (
        schedule.autoPayoutEnabled &&
        schedule.nextScheduledAt &&
        schedule.nextScheduledAt <= now
      ) {
        dueSchedules.push(schedule);
      }
    }

    return dueSchedules;
  }
}

// =============================================================================
// EXCHANGE RATE REPOSITORY (In-memory cache)
// =============================================================================

const exchangeRateCache = new Map<
  string,
  {
    rate: number;
    baseRate: number;
    markupPercent: number;
    validUntil: Date;
    source: string;
  }
>();

export class ExchangeRateRepository {
  async findCurrent(fromCurrency: string, toCurrency: string) {
    const key = `${fromCurrency}:${toCurrency}`;
    const cached = exchangeRateCache.get(key);

    if (cached && cached.validUntil > new Date()) {
      return {
        fromCurrency,
        toCurrency,
        ...cached,
        validFrom: new Date(cached.validUntil.getTime() - 3600000), // 1 hour ago
      };
    }

    return null;
  }

  async create(data: CreateExchangeRateData) {
    const key = `${data.fromCurrency}:${data.toCurrency}`;
    exchangeRateCache.set(key, {
      rate: data.rate,
      baseRate: data.baseRate,
      markupPercent: data.markupPercent,
      validUntil: data.validUntil,
      source: data.source,
    });

    return data;
  }
}

// =============================================================================
// SINGLETON INSTANCES
// =============================================================================

let payoutRepoInstance: PayoutRepository | null = null;
let balanceRepoInstance: PayoutBalanceRepository | null = null;
let scheduleRepoInstance: PayoutScheduleRepository | null = null;
let exchangeRateRepoInstance: ExchangeRateRepository | null = null;

export function getPayoutRepository(): PayoutRepository {
  if (!payoutRepoInstance) {
    payoutRepoInstance = new PayoutRepository();
  }
  return payoutRepoInstance;
}

export function getPayoutBalanceRepository(): PayoutBalanceRepository {
  if (!balanceRepoInstance) {
    balanceRepoInstance = new PayoutBalanceRepository();
  }
  return balanceRepoInstance;
}

export function getPayoutScheduleRepository(): PayoutScheduleRepository {
  if (!scheduleRepoInstance) {
    scheduleRepoInstance = new PayoutScheduleRepository();
  }
  return scheduleRepoInstance;
}

export function getExchangeRateRepository(): ExchangeRateRepository {
  if (!exchangeRateRepoInstance) {
    exchangeRateRepoInstance = new ExchangeRateRepository();
  }
  return exchangeRateRepoInstance;
}
