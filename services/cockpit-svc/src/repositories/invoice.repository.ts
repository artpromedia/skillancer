/**
 * @module @skillancer/cockpit-svc/repositories/invoice
 * Invoice data access layer
 */

import type {
  CreateInvoiceParams,
  UpdateInvoiceParams,
  InvoiceFilters,
  CreateLineItemParams,
} from '../types/invoice.types.js';
import type { Invoice, InvoiceStatus, InvoiceLineItem } from '@prisma/client';
import type { Prisma, PrismaClient } from '@skillancer/database';

export class InvoiceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new invoice with line items
   */
  async create(
    data: CreateInvoiceParams & {
      invoiceNumber: string;
      subtotal: number;
      discountAmount: number;
      taxAmount: number;
      total: number;
      viewToken: string;
    }
  ): Promise<Invoice> {
    return this.prisma.invoice.create({
      data: {
        freelancerUserId: data.freelancerUserId,
        clientId: data.clientId,
        projectId: data.projectId ?? null,
        invoiceNumber: data.invoiceNumber,
        issueDate: data.issueDate ?? new Date(),
        dueDate: data.dueDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        currency: data.currency ?? 'USD',
        title: data.title ?? null,
        summary: data.summary ?? null,
        notes: data.notes ?? null,
        terms: data.terms ?? null,
        templateId: data.templateId ?? null,
        subtotal: data.subtotal,
        discountType: data.discountType ?? null,
        discountValue: data.discountValue ?? null,
        discountAmount: data.discountAmount,
        taxEnabled: data.taxEnabled ?? false,
        taxRate: data.taxRate ?? null,
        taxLabel: data.taxLabel ?? null,
        taxAmount: data.taxAmount,
        total: data.total,
        amountPaid: 0,
        amountDue: data.total,
        lateFeeEnabled: data.lateFeeEnabled ?? false,
        lateFeeType: data.lateFeeType ?? null,
        lateFeeValue: data.lateFeeValue ?? null,
        lateFeeAmount: 0,
        paymentInstructions: data.paymentInstructions ?? null,
        acceptedPaymentMethods: data.acceptedPaymentMethods ?? [],
        viewToken: data.viewToken,
        lineItems: {
          createMany: {
            data: data.lineItems.map((item, index) => ({
              itemType: item.itemType ?? 'SERVICE',
              description: item.description,
              quantity: item.quantity,
              unitType: item.unitType ?? null,
              unitPrice: item.unitPrice,
              amount: item.quantity * item.unitPrice,
              isTaxable: item.isTaxable ?? true,
              periodStart: item.periodStart ?? null,
              periodEnd: item.periodEnd ?? null,
              sortOrder: index,
            })),
          },
        },
      },
      include: {
        lineItems: true,
        client: true,
      },
    });
  }

  /**
   * Find invoice by ID
   */
  async findById(id: string): Promise<Invoice | null> {
    return this.prisma.invoice.findUnique({
      where: { id },
    });
  }

  /**
   * Find invoice by ID with all relations
   */
  async findByIdWithDetails(id: string): Promise<Invoice | null> {
    return this.prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        project: true,
        lineItems: {
          orderBy: { createdAt: 'asc' },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
        template: true,
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        recurringSchedule: true,
      },
    });
  }

  /**
   * Find invoice by view token (for client portal)
   */
  async findByViewToken(viewToken: string): Promise<Invoice | null> {
    return this.prisma.invoice.findFirst({
      where: { viewToken },
      include: {
        client: true,
        lineItems: {
          orderBy: { createdAt: 'asc' },
        },
        payments: {
          where: { status: 'COMPLETED' },
          orderBy: { paymentDate: 'desc' },
        },
        template: true,
      },
    });
  }

  /**
   * Find invoice by number (for duplicate check)
   */
  async findByNumber(freelancerUserId: string, invoiceNumber: string): Promise<Invoice | null> {
    return this.prisma.invoice.findFirst({
      where: {
        freelancerUserId,
        invoiceNumber,
      },
    });
  }

  /**
   * Find invoices with filters and pagination
   */
  async findByFilters(filters: InvoiceFilters): Promise<{
    invoices: Invoice[];
    total: number;
  }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {
      freelancerUserId: filters.freelancerUserId,
    };

    if (filters.clientId) {
      where.clientId = filters.clientId;
    }

    if (filters.projectId) {
      where.projectId = filters.projectId;
    }

    if (filters.status && filters.status.length > 0) {
      where.status = { in: filters.status };
    }

    if (filters.startDate || filters.endDate) {
      where.issueDate = {};
      if (filters.startDate) {
        where.issueDate.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.issueDate.lte = filters.endDate;
      }
    }

    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      where.total = {};
      if (filters.minAmount !== undefined) {
        where.total.gte = filters.minAmount;
      }
      if (filters.maxAmount !== undefined) {
        where.total.lte = filters.maxAmount;
      }
    }

    if (filters.isOverdue) {
      where.status = { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID'] };
      where.dueDate = { lt: new Date() };
    }

    if (filters.search) {
      where.OR = [
        { invoiceNumber: { contains: filters.search, mode: 'insensitive' } },
        { title: { contains: filters.search, mode: 'insensitive' } },
        { client: { firstName: { contains: filters.search, mode: 'insensitive' } } },
        { client: { lastName: { contains: filters.search, mode: 'insensitive' } } },
        { client: { companyName: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const sortBy = filters.sortBy ?? 'issueDate';
    const sortOrder = filters.sortOrder ?? 'desc';

    const orderBy: Prisma.InvoiceOrderByWithRelationInput = {};
    if (sortBy === 'invoiceNumber') {
      orderBy.invoiceNumber = sortOrder;
    } else if (sortBy === 'dueDate') {
      orderBy.dueDate = sortOrder;
    } else if (sortBy === 'total') {
      orderBy.total = sortOrder;
    } else if (sortBy === 'status') {
      orderBy.status = sortOrder;
    } else {
      orderBy.issueDate = sortOrder;
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          client: {
            select: { id: true, firstName: true, lastName: true, companyName: true, email: true },
          },
          project: {
            select: { id: true, name: true },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { invoices, total };
  }

  /**
   * Update invoice
   */
  async update(id: string, data: Prisma.InvoiceUpdateInput): Promise<Invoice> {
    return this.prisma.invoice.update({
      where: { id },
      data,
      include: {
        lineItems: true,
        client: true,
      },
    });
  }

  /**
   * Update invoice status
   */
  async updateStatus(id: string, status: InvoiceStatus): Promise<Invoice> {
    const updateData: Prisma.InvoiceUpdateInput = { status };

    if (status === 'SENT') {
      updateData.sentAt = new Date();
    } else if (status === 'VIEWED') {
      updateData.lastViewedAt = new Date();
    } else if (status === 'PAID') {
      updateData.paidDate = new Date();
    }

    return this.prisma.invoice.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Update payment amounts on invoice
   */
  async updatePaymentAmounts(id: string, amountPaid: number, amountDue: number): Promise<Invoice> {
    let status: InvoiceStatus | undefined;

    if (amountDue <= 0) {
      status = 'PAID';
    } else if (amountPaid > 0) {
      status = 'PARTIALLY_PAID';
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        amountPaid,
        amountDue,
        ...(status && { status, paidDate: status === 'PAID' ? new Date() : undefined }),
      },
    });
  }

  /**
   * Apply late fee to invoice
   */
  async applyLateFee(id: string, lateFeeAmount: number): Promise<Invoice> {
    const invoice = await this.findById(id);
    if (!invoice) throw new Error('Invoice not found');

    const newTotal = Number(invoice.total) + lateFeeAmount;
    const newAmountDue = Number(invoice.amountDue) + lateFeeAmount;

    return this.prisma.invoice.update({
      where: { id },
      data: {
        lateFeeAmount: { increment: lateFeeAmount },
        lateFeeAppliedAt: new Date(),
        total: newTotal,
        amountDue: newAmountDue,
      },
    });
  }

  /**
   * Set next reminder date
   */
  async setNextReminder(id: string, nextReminderAt: Date | null): Promise<Invoice> {
    return this.prisma.invoice.update({
      where: { id },
      data: { nextReminderAt },
    });
  }

  /**
   * Record reminder sent
   */
  async recordReminderSent(id: string): Promise<Invoice> {
    return this.prisma.invoice.update({
      where: { id },
      data: {
        lastReminderAt: new Date(),
      },
    });
  }

  /**
   * Update PDF URL
   */
  async updatePdfUrl(id: string, pdfUrl: string): Promise<Invoice> {
    return this.prisma.invoice.update({
      where: { id },
      data: {
        pdfUrl,
        pdfGeneratedAt: new Date(),
      },
    });
  }

  /**
   * Set Stripe payment intent
   */
  async setStripePaymentIntent(id: string, paymentIntentId: string): Promise<Invoice> {
    return this.prisma.invoice.update({
      where: { id },
      data: { stripePaymentIntentId: paymentIntentId },
    });
  }

  /**
   * Set PayPal order
   */
  async setPayPalOrder(id: string, orderId: string): Promise<Invoice> {
    return this.prisma.invoice.update({
      where: { id },
      data: { paypalOrderId: orderId },
    });
  }

  /**
   * Delete invoice (only draft)
   */
  async delete(id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.invoiceLineItem.deleteMany({ where: { invoiceId: id } }),
      this.prisma.invoiceActivity.deleteMany({ where: { invoiceId: id } }),
      this.prisma.invoice.delete({ where: { id } }),
    ]);
  }

  /**
   * Find overdue invoices for late fee processing
   */
  async findOverdueForLateFees(graceDays = 0): Promise<Invoice[]> {
    const gracePeriodDate = new Date();
    gracePeriodDate.setDate(gracePeriodDate.getDate() - graceDays);

    return this.prisma.invoice.findMany({
      where: {
        status: { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID'] },
        lateFeeEnabled: true,
        dueDate: { lt: gracePeriodDate },
        OR: [
          { lateFeeAppliedAt: null },
          // For recurring late fees, add more conditions here
        ],
      },
    });
  }

  /**
   * Find invoices due for reminders
   */
  async findForReminders(): Promise<Invoice[]> {
    const now = new Date();

    return this.prisma.invoice.findMany({
      where: {
        status: { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID'] },
        nextReminderAt: { lte: now },
      },
      include: {
        client: true,
        template: true,
      },
    });
  }

  /**
   * Get invoice statistics for dashboard
   */
  async getStats(freelancerUserId: string): Promise<{
    totalOutstanding: number;
    totalOverdue: number;
    overdueCount: number;
    pendingCount: number;
  }> {
    const now = new Date();

    const [outstanding, overdue] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: {
          freelancerUserId,
          status: { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID'] },
        },
        _sum: { amountDue: true },
        _count: true,
      }),
      this.prisma.invoice.aggregate({
        where: {
          freelancerUserId,
          status: { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID'] },
          dueDate: { lt: now },
        },
        _sum: { amountDue: true },
        _count: true,
      }),
    ]);

    return {
      totalOutstanding: Number(outstanding._sum.amountDue ?? 0),
      totalOverdue: Number(overdue._sum.amountDue ?? 0),
      overdueCount: overdue._count,
      pendingCount: outstanding._count,
    };
  }

  /**
   * Get monthly invoice totals
   */
  async getMonthlyTotals(
    freelancerUserId: string,
    months: number
  ): Promise<{ month: string; invoiced: number; collected: number }[]> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months + 1);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        freelancerUserId,
        issueDate: { gte: startDate },
        status: { not: 'DRAFT' },
      },
      select: {
        issueDate: true,
        total: true,
        amountPaid: true,
      },
    });

    const monthlyData: Map<string, { invoiced: number; collected: number }> = new Map();

    for (let i = 0; i < months; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData.set(key, { invoiced: 0, collected: 0 });
    }

    for (const invoice of invoices) {
      const key = `${invoice.issueDate.getFullYear()}-${String(invoice.issueDate.getMonth() + 1).padStart(2, '0')}`;
      const data = monthlyData.get(key);
      if (data) {
        data.invoiced += Number(invoice.total);
        data.collected += Number(invoice.amountPaid);
      }
    }

    return Array.from(monthlyData.entries())
      .map(([month, data]) => ({ month, ...data }))
      .reverse();
  }
}
