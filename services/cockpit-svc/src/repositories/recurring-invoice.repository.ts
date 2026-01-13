/**
 * @module @skillancer/cockpit-svc/repositories/recurring-invoice
 * Recurring Invoice data access layer
 */

import type {
  CreateRecurringInvoiceParams,
  UpdateRecurringInvoiceParams,
  CreateLineItemParams,
} from '../types/invoice.types.js';
import type { RecurringInvoice } from '../types/prisma-shim.js';
import type { Prisma, PrismaClient } from '../types/prisma-shim.js';

export class RecurringInvoiceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new recurring invoice
   */
  async create(data: CreateRecurringInvoiceParams): Promise<RecurringInvoice> {
    return this.prisma.recurringInvoice.create({
      data: {
        freelancerUserId: data.freelancerUserId,
        clientId: data.clientId,
        name: data.name,
        lineItems: data.lineItems as unknown as Prisma.InputJsonValue,
        subtotal: data.subtotal,
        taxRate: data.taxRate ?? null,
        taxAmount: data.taxAmount ?? 0,
        total: data.total,
        currency: data.currency ?? 'USD',
        frequency: data.frequency,
        interval: data.interval ?? 1,
        dayOfMonth: data.dayOfMonth ?? null,
        dayOfWeek: data.dayOfWeek ?? null,
        startDate: data.startDate,
        endDate: data.endDate ?? null,
        maxInvoices: data.maxInvoices ?? null,
        nextInvoiceDate: this.calculateNextRun(data),
        dueDays: data.dueDays ?? 30,
        autoSend: data.autoSend ?? true,
        templateId: data.templateId ?? null,
        projectId: data.projectId ?? null,
      },
      include: {
        client: true,
        template: true,
      },
    });
  }

  /**
   * Calculate next run date based on frequency
   */
  private calculateNextRun(data: CreateRecurringInvoiceParams): Date {
    const startDate = new Date(data.startDate);
    const now = new Date();

    // If start date is in the future, use it
    if (startDate > now) {
      return startDate;
    }

    // Otherwise calculate next occurrence
    const next = new Date(now);

    switch (data.frequency) {
      case 'DAILY':
        next.setDate(next.getDate() + (data.interval ?? 1));
        break;
      case 'WEEKLY':
        if (data.dayOfWeek !== undefined) {
          const daysUntil = (data.dayOfWeek - next.getDay() + 7) % 7 || 7;
          next.setDate(next.getDate() + daysUntil);
        } else {
          next.setDate(next.getDate() + 7 * (data.interval ?? 1));
        }
        break;
      case 'MONTHLY':
        next.setMonth(next.getMonth() + (data.interval ?? 1));
        if (data.dayOfMonth) {
          next.setDate(Math.min(data.dayOfMonth, this.getDaysInMonth(next)));
        }
        break;
      case 'QUARTERLY':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'YEARLY':
        next.setFullYear(next.getFullYear() + 1);
        break;
      default:
        next.setMonth(next.getMonth() + 1);
    }

    return next;
  }

  /**
   * Get days in a month
   */
  private getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  /**
   * Find by ID
   */
  async findById(id: string): Promise<RecurringInvoice | null> {
    return this.prisma.recurringInvoice.findUnique({
      where: { id },
      include: {
        client: true,
        template: true,
      },
    });
  }

  /**
   * Find all for a user
   */
  async findByUserId(freelancerUserId: string): Promise<RecurringInvoice[]> {
    return this.prisma.recurringInvoice.findMany({
      where: {
        freelancerUserId,
        isActive: true,
      },
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, companyName: true, email: true },
        },
        template: {
          select: { id: true, name: true },
        },
        _count: {
          select: { invoices: true },
        },
      },
      orderBy: { nextInvoiceDate: 'asc' },
    });
  }

  /**
   * Find recurring invoices due to run
   */
  async findDueToRun(): Promise<RecurringInvoice[]> {
    const now = new Date();

    return this.prisma.recurringInvoice.findMany({
      where: {
        isActive: true,
        isPaused: false,
        nextInvoiceDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      include: {
        client: true,
        template: true,
      },
    });
  }

  /**
   * Update recurring invoice
   */
  async update(id: string, data: UpdateRecurringInvoiceParams): Promise<RecurringInvoice> {
    return this.prisma.recurringInvoice.update({
      where: { id },
      data: {
        name: data.name,
        lineItems: data.lineItems as unknown as Prisma.InputJsonValue,
        frequency: data.frequency,
        interval: data.interval,
        dayOfMonth: data.dayOfMonth,
        dayOfWeek: data.dayOfWeek,
        endDate: data.endDate,
        maxInvoices: data.maxInvoices,
        dueDays: data.dueDays,
        autoSend: data.autoSend,
        templateId: data.templateId,
        projectId: data.projectId,
        taxRate: data.taxRate,
        isActive: data.isActive,
        isPaused: data.isPaused,
      },
      include: {
        client: true,
        template: true,
      },
    });
  }

  /**
   * Record invoice generated and update next run
   */
  async recordInvoiceGenerated(id: string): Promise<RecurringInvoice> {
    const recurring = await this.findById(id);
    if (!recurring) throw new Error('Recurring invoice not found');

    // Calculate next run date
    const nextRun = this.calculateNextRunFromCurrent(recurring);

    // Check if max invoices reached
    const invoiceCount = await this.prisma.invoice.count({
      where: { recurringScheduleId: id },
    });

    const isComplete = recurring.maxInvoices && invoiceCount + 1 >= recurring.maxInvoices;

    return this.prisma.recurringInvoice.update({
      where: { id },
      data: {
        lastInvoiceDate: new Date(),
        nextInvoiceDate: isComplete ? null : nextRun,
        isActive: !isComplete,
      },
    });
  }

  /**
   * Calculate next run from current recurring invoice
   */
  private calculateNextRunFromCurrent(recurring: RecurringInvoice): Date {
    const current = recurring.nextInvoiceDate ?? new Date();
    const next = new Date(current);

    switch (recurring.frequency) {
      case 'DAILY':
        next.setDate(next.getDate() + recurring.interval);
        break;
      case 'WEEKLY':
        next.setDate(next.getDate() + 7 * recurring.interval);
        break;
      case 'MONTHLY':
        next.setMonth(next.getMonth() + recurring.interval);
        if (recurring.dayOfMonth) {
          next.setDate(Math.min(recurring.dayOfMonth, this.getDaysInMonth(next)));
        }
        break;
      case 'QUARTERLY':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'YEARLY':
        next.setFullYear(next.getFullYear() + 1);
        break;
      default:
        next.setMonth(next.getMonth() + 1);
    }

    return next;
  }

  /**
   * Pause recurring invoice
   */
  async pause(id: string): Promise<RecurringInvoice> {
    return this.prisma.recurringInvoice.update({
      where: { id },
      data: { isPaused: true },
    });
  }

  /**
   * Resume recurring invoice
   */
  async resume(id: string): Promise<RecurringInvoice> {
    return this.prisma.recurringInvoice.update({
      where: { id },
      data: { isPaused: false },
    });
  }

  /**
   * Deactivate recurring invoice
   */
  async deactivate(id: string): Promise<RecurringInvoice> {
    return this.prisma.recurringInvoice.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Get generated invoice count
   */
  async getInvoiceCount(id: string): Promise<number> {
    return this.prisma.invoice.count({
      where: { recurringScheduleId: id },
    });
  }
}
