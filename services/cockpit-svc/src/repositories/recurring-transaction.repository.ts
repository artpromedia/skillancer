/**
 * @module @skillancer/cockpit-svc/repositories/recurring-transaction
 * Recurring Transaction data access layer
 */

import type {
  CreateRecurringTransactionParams,
  UpdateRecurringTransactionParams,
  RecurringTransactionWithDetails,
} from '../types/finance.types.js';
import type {
  Prisma,
  PrismaClient,
  RecurringTransaction,
  RecurrenceFrequency,
} from '@skillancer/database';

export class RecurringTransactionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new recurring transaction
   */
  async create(data: CreateRecurringTransactionParams): Promise<RecurringTransaction> {
    return this.prisma.recurringTransaction.create({
      data: {
        userId: data.userId,
        categoryId: data.categoryId ?? null,
        accountId: data.accountId ?? null,
        transactionType: data.transactionType,
        amount: data.amount,
        currency: data.currency ?? 'USD',
        description: data.description,
        vendor: data.vendor ?? null,
        frequency: data.frequency,
        startDate: data.startDate,
        endDate: data.endDate ?? null,
        dayOfMonth: data.dayOfMonth ?? null,
        dayOfWeek: data.dayOfWeek ?? null,
        isTaxDeductible: data.isTaxDeductible ?? false,
        taxDeductiblePercentage: data.taxDeductiblePercentage ?? 100,
        autoCreate: data.autoCreate ?? false,
        reminderDays: data.reminderDays ?? null,
        nextOccurrence: this.calculateNextOccurrence(
          data.startDate,
          data.frequency,
          data.dayOfMonth,
          data.dayOfWeek
        ),
      },
    });
  }

  /**
   * Find recurring transaction by ID
   */
  async findById(id: string): Promise<RecurringTransaction | null> {
    return this.prisma.recurringTransaction.findUnique({
      where: { id },
    });
  }

  /**
   * Find recurring transaction by ID with details
   */
  async findByIdWithDetails(id: string): Promise<RecurringTransactionWithDetails | null> {
    const recurring = await this.prisma.recurringTransaction.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, type: true, icon: true } },
        account: { select: { id: true, name: true } },
        _count: { select: { generatedTransactions: true } },
      },
    });

    if (!recurring) return null;

    return {
      ...recurring,
      generatedTransactionCount: recurring._count.generatedTransactions,
    } as RecurringTransactionWithDetails;
  }

  /**
   * Find all recurring transactions for a user
   */
  async findByUserId(
    userId: string,
    isActive?: boolean
  ): Promise<RecurringTransactionWithDetails[]> {
    const where: Prisma.RecurringTransactionWhereInput = { userId };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const recurrings = await this.prisma.recurringTransaction.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, type: true, icon: true } },
        account: { select: { id: true, name: true } },
        _count: { select: { generatedTransactions: true } },
      },
      orderBy: { nextOccurrence: 'asc' },
    });

    return recurrings.map((r) => ({
      ...r,
      generatedTransactionCount: r._count.generatedTransactions,
    })) as RecurringTransactionWithDetails[];
  }

  /**
   * Find upcoming recurring transactions
   */
  async findUpcoming(userId: string, days = 30): Promise<RecurringTransactionWithDetails[]> {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const recurrings = await this.prisma.recurringTransaction.findMany({
      where: {
        userId,
        isActive: true,
        nextOccurrence: { lte: endDate },
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      },
      include: {
        category: { select: { id: true, name: true, type: true, icon: true } },
        account: { select: { id: true, name: true } },
        _count: { select: { generatedTransactions: true } },
      },
      orderBy: { nextOccurrence: 'asc' },
    });

    return recurrings.map((r) => ({
      ...r,
      generatedTransactionCount: r._count.generatedTransactions,
    })) as RecurringTransactionWithDetails[];
  }

  /**
   * Find recurring transactions due for processing
   */
  async findDueForProcessing(): Promise<RecurringTransaction[]> {
    const now = new Date();

    return this.prisma.recurringTransaction.findMany({
      where: {
        isActive: true,
        autoCreate: true,
        nextOccurrence: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      include: {
        category: true,
        account: true,
      },
    });
  }

  /**
   * Find recurring transactions needing reminder
   */
  async findNeedingReminder(): Promise<RecurringTransaction[]> {
    const now = new Date();

    // Get all active recurring with reminderDays set
    const recurrings = await this.prisma.recurringTransaction.findMany({
      where: {
        isActive: true,
        reminderDays: { not: null },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
    });

    // Filter to those where reminder is due
    return recurrings.filter((r) => {
      if (!r.nextOccurrence || !r.reminderDays) return false;

      const reminderDate = new Date(r.nextOccurrence);
      reminderDate.setDate(reminderDate.getDate() - r.reminderDays);

      return reminderDate <= now && r.nextOccurrence > now;
    });
  }

  /**
   * Update a recurring transaction
   */
  async update(id: string, data: UpdateRecurringTransactionParams): Promise<RecurringTransaction> {
    const existing = await this.findById(id);

    // Recalculate next occurrence if frequency changed
    let nextOccurrence = undefined;
    if (data.frequency && existing) {
      nextOccurrence = this.calculateNextOccurrence(
        existing.startDate,
        data.frequency,
        data.dayOfMonth ?? existing.dayOfMonth ?? undefined,
        data.dayOfWeek ?? existing.dayOfWeek ?? undefined
      );
    }

    return this.prisma.recurringTransaction.update({
      where: { id },
      data: {
        categoryId: data.categoryId,
        accountId: data.accountId,
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        vendor: data.vendor,
        frequency: data.frequency,
        endDate: data.endDate,
        dayOfMonth: data.dayOfMonth,
        dayOfWeek: data.dayOfWeek,
        isTaxDeductible: data.isTaxDeductible,
        taxDeductiblePercentage: data.taxDeductiblePercentage,
        isActive: data.isActive,
        autoCreate: data.autoCreate,
        reminderDays: data.reminderDays,
        ...(nextOccurrence ? { nextOccurrence } : {}),
      },
    });
  }

  /**
   * Update last processed date and calculate next occurrence
   */
  async markProcessed(id: string): Promise<RecurringTransaction> {
    const recurring = await this.findById(id);
    if (!recurring) throw new Error('Recurring transaction not found');

    const nextOccurrence = this.calculateNextOccurrenceFromDate(
      recurring.nextOccurrence ?? new Date(),
      recurring.frequency,
      recurring.dayOfMonth ?? undefined,
      recurring.dayOfWeek ?? undefined
    );

    // Check if end date is reached
    const isActive = !recurring.endDate || nextOccurrence <= recurring.endDate;

    return this.prisma.recurringTransaction.update({
      where: { id },
      data: {
        lastProcessedAt: new Date(),
        nextOccurrence,
        isActive,
      },
    });
  }

  /**
   * Deactivate a recurring transaction
   */
  async deactivate(id: string): Promise<RecurringTransaction> {
    return this.prisma.recurringTransaction.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Delete a recurring transaction
   */
  async delete(id: string): Promise<void> {
    await this.prisma.recurringTransaction.delete({
      where: { id },
    });
  }

  /**
   * Calculate next occurrence from start date
   */
  private calculateNextOccurrence(
    startDate: Date,
    frequency: RecurrenceFrequency,
    dayOfMonth?: number,
    dayOfWeek?: number
  ): Date {
    const now = new Date();
    const next = new Date(startDate);

    // If start date is in the future, use it
    if (next > now) return next;

    // Calculate next occurrence from now
    return this.calculateNextOccurrenceFromDate(next, frequency, dayOfMonth, dayOfWeek);
  }

  /**
   * Calculate next occurrence from a given date
   */
  private calculateNextOccurrenceFromDate(
    fromDate: Date,
    frequency: RecurrenceFrequency,
    dayOfMonth?: number,
    dayOfWeek?: number
  ): Date {
    const next = new Date(fromDate);
    const now = new Date();

    // Advance until we're past now
    while (next <= now) {
      switch (frequency) {
        case 'DAILY':
          next.setDate(next.getDate() + 1);
          break;

        case 'WEEKLY':
          if (dayOfWeek !== undefined) {
            next.setDate(next.getDate() + 7);
            // Adjust to specific day of week
            const currentDay = next.getDay();
            const diff = dayOfWeek - currentDay;
            next.setDate(next.getDate() + diff);
          } else {
            next.setDate(next.getDate() + 7);
          }
          break;

        case 'BIWEEKLY':
          next.setDate(next.getDate() + 14);
          break;

        case 'MONTHLY':
          next.setMonth(next.getMonth() + 1);
          if (dayOfMonth !== undefined) {
            next.setDate(Math.min(dayOfMonth, this.getDaysInMonth(next)));
          }
          break;

        case 'QUARTERLY':
          next.setMonth(next.getMonth() + 3);
          if (dayOfMonth !== undefined) {
            next.setDate(Math.min(dayOfMonth, this.getDaysInMonth(next)));
          }
          break;

        case 'YEARLY':
          next.setFullYear(next.getFullYear() + 1);
          break;

        default:
          next.setMonth(next.getMonth() + 1);
      }
    }

    return next;
  }

  /**
   * Get number of days in a month
   */
  private getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }
}
