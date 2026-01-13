/**
 * @module @skillancer/cockpit-svc/repositories/recurring-transaction
 * Recurring Transaction data access layer
 */

import type {
  CreateRecurringTransactionParams,
  UpdateRecurringTransactionParams,
  RecurringTransactionWithDetails,
} from '../types/finance.types.js';
import type { RecurringTransaction, RecurrenceFrequency } from '../types/prisma-shim.js';
import type { Prisma, PrismaClient } from '../types/prisma-shim.js';

export class RecurringTransactionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new recurring transaction
   */
  async create(data: CreateRecurringTransactionParams): Promise<RecurringTransaction> {
    return this.prisma.recurringTransaction.create({
      data: {
        userId: data.userId,
        category: data.category,
        subcategory: data.subcategory ?? null,
        accountId: data.accountId ?? null,
        type: data.type,
        amount: data.amount,
        currency: data.currency ?? 'USD',
        description: data.description,
        vendor: data.vendor ?? null,
        frequency: data.frequency,
        interval: data.interval ?? 1,
        startDate: data.startDate,
        endDate: data.endDate ?? null,
        dayOfMonth: data.dayOfMonth ?? null,
        dayOfWeek: data.dayOfWeek ?? null,
        isDeductible: data.isDeductible ?? true,
        autoCreate: data.autoCreate ?? true,
        requiresConfirmation: data.requiresConfirmation ?? false,
        clientId: data.clientId ?? null,
        projectId: data.projectId ?? null,
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
        transactions: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!recurring) return null;

    return {
      ...recurring,
      generatedTransactionCount: recurring.transactions.length,
    } as unknown as RecurringTransactionWithDetails;
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
      orderBy: { nextOccurrence: 'asc' },
    });

    return recurrings as unknown as RecurringTransactionWithDetails[];
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
      orderBy: { nextOccurrence: 'asc' },
    });

    return recurrings as unknown as RecurringTransactionWithDetails[];
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
        category: data.category,
        subcategory: data.subcategory,
        accountId: data.accountId,
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        vendor: data.vendor,
        frequency: data.frequency,
        interval: data.interval,
        endDate: data.endDate,
        dayOfMonth: data.dayOfMonth,
        dayOfWeek: data.dayOfWeek,
        isDeductible: data.isDeductible,
        isActive: data.isActive,
        isPaused: data.isPaused,
        autoCreate: data.autoCreate,
        requiresConfirmation: data.requiresConfirmation,
        clientId: data.clientId,
        projectId: data.projectId,
        ...(nextOccurrence ? { nextOccurrence } : {}),
      },
    });
  }

  /**
   * Update last occurrence date and calculate next occurrence
   */
  async markProcessed(id: string): Promise<RecurringTransaction> {
    const recurring = await this.findById(id);
    if (!recurring) throw new Error('Recurring transaction not found');

    const nextOccurrence = this.calculateNextOccurrenceFromDate(
      recurring.nextOccurrence ?? new Date(),
      recurring.frequency,
      recurring.interval,
      recurring.dayOfMonth ?? undefined,
      recurring.dayOfWeek ?? undefined
    );

    // Check if end date is reached
    const isActive = !recurring.endDate || nextOccurrence <= recurring.endDate;

    return this.prisma.recurringTransaction.update({
      where: { id },
      data: {
        lastOccurrence: new Date(),
        nextOccurrence,
        occurrenceCount: { increment: 1 },
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
   * Pause a recurring transaction
   */
  async pause(id: string): Promise<RecurringTransaction> {
    return this.prisma.recurringTransaction.update({
      where: { id },
      data: { isPaused: true },
    });
  }

  /**
   * Resume a recurring transaction
   */
  async resume(id: string): Promise<RecurringTransaction> {
    return this.prisma.recurringTransaction.update({
      where: { id },
      data: { isPaused: false },
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
    return this.calculateNextOccurrenceFromDate(next, frequency, 1, dayOfMonth, dayOfWeek);
  }

  /**
   * Calculate next occurrence from a given date
   */
  private calculateNextOccurrenceFromDate(
    fromDate: Date,
    frequency: RecurrenceFrequency,
    interval: number,
    dayOfMonth?: number,
    dayOfWeek?: number
  ): Date {
    const next = new Date(fromDate);
    const now = new Date();

    // Advance until we're past now
    while (next <= now) {
      switch (frequency) {
        case 'DAILY':
          next.setDate(next.getDate() + interval);
          break;

        case 'WEEKLY':
          if (dayOfWeek !== undefined) {
            next.setDate(next.getDate() + 7 * interval);
            // Adjust to specific day of week
            const currentDay = next.getDay();
            const diff = dayOfWeek - currentDay;
            next.setDate(next.getDate() + diff);
          } else {
            next.setDate(next.getDate() + 7 * interval);
          }
          break;

        case 'BIWEEKLY':
          next.setDate(next.getDate() + 14 * interval);
          break;

        case 'MONTHLY':
          next.setMonth(next.getMonth() + interval);
          if (dayOfMonth !== undefined) {
            next.setDate(Math.min(dayOfMonth, this.getDaysInMonth(next)));
          }
          break;

        case 'QUARTERLY':
          next.setMonth(next.getMonth() + 3 * interval);
          if (dayOfMonth !== undefined) {
            next.setDate(Math.min(dayOfMonth, this.getDaysInMonth(next)));
          }
          break;

        case 'YEARLY':
          next.setFullYear(next.getFullYear() + interval);
          break;

        default:
          next.setMonth(next.getMonth() + interval);
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
