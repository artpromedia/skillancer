/**
 * @module @skillancer/market-svc/repositories/contract-invoice
 * Contract Invoice data access layer
 */

import { Prisma } from '@skillancer/database';

import type {
  CreateInvoiceInput,
  InvoiceListOptions,
  InvoiceWithDetails,
} from '../types/contract.types.js';
import type { PrismaClient, ContractInvoiceStatus } from '@skillancer/database';

/**
 * Contract Invoice Repository
 *
 * Handles database operations for contract invoices.
 */
export class ContractInvoiceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private readonly defaultInclude = {
    contract: {
      select: {
        id: true,
        title: true,
        contractNumber: true,
        clientUserId: true,
        freelancerUserId: true,
      },
    },
    timeEntries: true,
  };

  /**
   * Generate invoice number
   */
  async generateInvoiceNumber(contractId: string): Promise<string> {
    const contract = await this.prisma.contractV2.findUnique({
      where: { id: contractId },
      select: { contractNumber: true },
    });

    const year = new Date().getFullYear();
    const count = await this.prisma.contractInvoice.count({
      where: { contractId },
    });

    const baseNumber = contract?.contractNumber || 'INV';
    return `${baseNumber}-${year}-${(count + 1).toString().padStart(3, '0')}`;
  }

  /**
   * Create an invoice
   */
  async create(data: CreateInvoiceInput) {
    const invoiceNumber = await this.generateInvoiceNumber(data.contractId);

    // Calculate line items if provided
    let subtotal = new Prisma.Decimal(0);
    const lineItems = data.lineItems ?? [];
    for (const item of lineItems) {
      subtotal = subtotal.add(new Prisma.Decimal(item.quantity * item.unitPrice));
    }

    // If time entries provided, get their amounts
    let hoursLogged: Prisma.Decimal | null = null;
    if (data.timeEntryIds && data.timeEntryIds.length > 0) {
      const timeEntries = await this.prisma.timeEntryV2.findMany({
        where: { id: { in: data.timeEntryIds } },
        select: { durationMinutes: true, amount: true },
      });

      let totalMinutes = 0;
      for (const te of timeEntries) {
        totalMinutes += te.durationMinutes;
        subtotal = subtotal.add(te.amount);
      }
      hoursLogged = new Prisma.Decimal(totalMinutes / 60);
    }

    // Platform fee (e.g., 10%)
    const platformFee = subtotal.mul(new Prisma.Decimal(0.1));
    const total = subtotal.add(platformFee);

    // Build data object conditionally
    const createData: Prisma.ContractInvoiceUncheckedCreateInput = {
      contractId: data.contractId,
      invoiceNumber,
      periodStart: data.periodStart ?? null,
      periodEnd: data.periodEnd ?? null,
      subtotal,
      platformFee,
      taxes: new Prisma.Decimal(0),
      total,
      hoursLogged,
      milestonesCount: data.milestoneIds?.length ?? null,
      notes: data.notes ?? null,
      dueAt: data.dueDate ?? null,
      status: 'DRAFT',
    };

    return this.prisma.contractInvoice.create({
      data: createData,
      include: this.defaultInclude,
    });
  }

  /**
   * Find invoice by ID
   */
  async findById(id: string): Promise<InvoiceWithDetails | null> {
    const invoice = await this.prisma.contractInvoice.findUnique({
      where: { id },
      include: {
        ...this.defaultInclude,
        contract: {
          include: {
            client: {
              select: { id: true, displayName: true, email: true },
            },
            freelancer: {
              select: { id: true, displayName: true, email: true },
            },
          },
        },
      },
    });

    return invoice as InvoiceWithDetails | null;
  }

  /**
   * Find invoice by invoice number
   */
  async findByInvoiceNumber(invoiceNumber: string): Promise<InvoiceWithDetails | null> {
    const invoice = await this.prisma.contractInvoice.findUnique({
      where: { invoiceNumber },
      include: {
        ...this.defaultInclude,
        contract: {
          include: {
            client: {
              select: { id: true, displayName: true, email: true },
            },
            freelancer: {
              select: { id: true, displayName: true, email: true },
            },
          },
        },
      },
    });

    return invoice as InvoiceWithDetails | null;
  }

  /**
   * Update invoice status
   */
  async updateStatus(id: string, status: ContractInvoiceStatus) {
    return this.prisma.contractInvoice.update({
      where: { id },
      data: { status },
      include: this.defaultInclude,
    });
  }

  /**
   * Issue (send) invoice
   */
  async issue(id: string) {
    return this.prisma.contractInvoice.update({
      where: { id },
      data: {
        status: 'SENT',
        issuedAt: new Date(),
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Mark invoice as paid
   */
  async markPaid(id: string, paymentTransactionId?: string, paymentMethod?: string) {
    return this.prisma.contractInvoice.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paymentTransactionId: paymentTransactionId ?? null,
        paymentMethod: paymentMethod ?? null,
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Cancel invoice
   */
  async cancel(id: string) {
    return this.prisma.contractInvoice.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: this.defaultInclude,
    });
  }

  /**
   * Mark invoice as overdue
   */
  async markOverdue(id: string) {
    return this.prisma.contractInvoice.update({
      where: { id },
      data: { status: 'OVERDUE' },
      include: this.defaultInclude,
    });
  }

  /**
   * Update invoice notes
   */
  async updateNotes(id: string, notes: string) {
    return this.prisma.contractInvoice.update({
      where: { id },
      data: { notes },
      include: this.defaultInclude,
    });
  }

  /**
   * Update document URL
   */
  async updateDocumentUrl(id: string, documentUrl: string) {
    return this.prisma.contractInvoice.update({
      where: { id },
      data: { documentUrl },
      include: this.defaultInclude,
    });
  }

  /**
   * List invoices with filters
   */
  async list(options: InvoiceListOptions): Promise<{
    data: InvoiceWithDetails[];
    total: number;
  }> {
    const { contractId, status, dateFrom, dateTo, page = 1, limit = 20 } = options;

    const where: Prisma.ContractInvoiceWhereInput = {};

    if (contractId) where.contractId = contractId;

    if (status) {
      where.status = Array.isArray(status) ? { in: status } : status;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const [data, total] = await Promise.all([
      this.prisma.contractInvoice.findMany({
        where,
        include: {
          ...this.defaultInclude,
          contract: {
            include: {
              client: {
                select: { id: true, displayName: true, email: true },
              },
              freelancer: {
                select: { id: true, displayName: true, email: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.contractInvoice.count({ where }),
    ]);

    return { data: data as InvoiceWithDetails[], total };
  }

  /**
   * Get unpaid invoices for a contract
   */
  async getUnpaid(contractId: string) {
    return this.prisma.contractInvoice.findMany({
      where: {
        contractId,
        status: { in: ['SENT', 'OVERDUE'] },
      },
      include: this.defaultInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get overdue invoices (past due date)
   */
  async getOverdue() {
    const now = new Date();

    return this.prisma.contractInvoice.findMany({
      where: {
        status: 'SENT',
        dueAt: { lt: now },
      },
      include: this.defaultInclude,
      orderBy: { dueAt: 'asc' },
    });
  }

  /**
   * Batch mark invoices as overdue
   */
  async batchMarkOverdue(invoiceIds: string[]) {
    return this.prisma.contractInvoice.updateMany({
      where: {
        id: { in: invoiceIds },
        status: 'SENT',
      },
      data: { status: 'OVERDUE' },
    });
  }

  /**
   * Get invoice summary for a contract
   */
  async getSummary(contractId: string) {
    const invoices = await this.prisma.contractInvoice.findMany({
      where: { contractId },
      select: {
        status: true,
        total: true,
      },
    });

    const summary = {
      totalInvoices: invoices.length,
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0,
      overdueAmount: 0,
      byStatus: {
        draft: 0,
        sent: 0,
        viewed: 0,
        paid: 0,
        overdue: 0,
        cancelled: 0,
        disputed: 0,
      },
    };

    for (const inv of invoices) {
      const total = Number(inv.total);

      switch (inv.status) {
        case 'DRAFT':
          summary.byStatus.draft++;
          break;
        case 'SENT':
          summary.byStatus.sent++;
          summary.pendingAmount += total;
          summary.totalAmount += total;
          break;
        case 'VIEWED':
          summary.byStatus.viewed++;
          summary.pendingAmount += total;
          summary.totalAmount += total;
          break;
        case 'PAID':
          summary.byStatus.paid++;
          summary.paidAmount += total;
          summary.totalAmount += total;
          break;
        case 'OVERDUE':
          summary.byStatus.overdue++;
          summary.overdueAmount += total;
          summary.totalAmount += total;
          break;
        case 'CANCELLED':
          summary.byStatus.cancelled++;
          break;
        case 'DISPUTED':
          summary.byStatus.disputed++;
          summary.pendingAmount += total;
          summary.totalAmount += total;
          break;
      }
    }

    return summary;
  }

  /**
   * Delete a draft invoice
   */
  async delete(id: string) {
    // Only allow deleting draft invoices
    const invoice = await this.prisma.contractInvoice.findUnique({
      where: { id },
      select: { status: true },
    });

    if (invoice?.status !== 'DRAFT') {
      throw new Error('Only draft invoices can be deleted');
    }

    return this.prisma.contractInvoice.delete({
      where: { id },
    });
  }
}
