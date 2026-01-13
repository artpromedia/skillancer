/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/**
 * @module @skillancer/market-svc/services/invoice
 * Invoice management service for ContractV2 marketplace transactions
 */

import { Prisma } from '../types/prisma-shim.js';
import { createLogger } from '@skillancer/logger';

import { getStripeService } from './stripe.service.js';
import { ContractActivityRepository } from '../repositories/contract-activity.repository.js';
import { ContractInvoiceRepository } from '../repositories/contract-invoice.repository.js';
import { ContractMilestoneRepository } from '../repositories/contract-milestone.repository.js';
import { ContractRepository } from '../repositories/contract.repository.js';
import { TimeEntryRepository } from '../repositories/time-entry.repository.js';

import type {
  InvoiceWithDetails,
  InvoiceListOptions,
  CreateLineItemInput,
} from '../types/contract.types.js';
import type { PrismaClient, ContractInvoiceStatus } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';

const logger = createLogger({ serviceName: 'invoice-service' });

// =============================================================================
// CONSTANTS
// =============================================================================

const PLATFORM_FEE_PERCENT = 10;
const DEFAULT_PAYMENT_TERMS_DAYS = 7;
const INVOICE_DUE_REMINDER_DAYS = [3, 1, 0]; // Days before due to send reminders

// =============================================================================
// ERROR CLASSES
// =============================================================================

export class InvoiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'InvoiceError';
  }
}

export const InvoiceErrorCodes = {
  CONTRACT_NOT_FOUND: 'CONTRACT_NOT_FOUND',
  INVOICE_NOT_FOUND: 'INVOICE_NOT_FOUND',
  INVOICE_ALREADY_PAID: 'INVOICE_ALREADY_PAID',
  INVOICE_CANCELLED: 'INVOICE_CANCELLED',
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
  INVALID_STATE: 'INVALID_STATE',
  NO_BILLABLE_ITEMS: 'NO_BILLABLE_ITEMS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
} as const;

// =============================================================================
// TYPES
// =============================================================================

export interface GenerateInvoiceInput {
  contractId: string;
  periodStart: Date;
  periodEnd: Date;
  includeApprovedTimeEntries?: boolean;
  includeCompletedMilestones?: boolean;
  notes?: string;
  dueDate?: Date;
}

export interface AutoGenerateInvoiceOptions {
  contractId: string;
  weekEnding: Date;
}

export interface PayInvoiceInput {
  invoiceId: string;
  paymentMethodId: string;
  clientUserId: string;
}

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  contractId: string;
  contractTitle: string;
  clientName: string;
  freelancerName: string;
  subtotal: number;
  platformFee: number;
  taxes: number;
  total: number;
  freelancerAmount: number;
  currency: string;
  status: ContractInvoiceStatus;
  periodStart: Date | null;
  periodEnd: Date | null;
  issuedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  hoursLogged: number | null;
  milestonesCount: number | null;
}

// =============================================================================
// INVOICE SERVICE CLASS
// =============================================================================

export class InvoiceService {
  private readonly invoiceRepository: ContractInvoiceRepository;
  private readonly contractRepository: ContractRepository;
  private readonly timeEntryRepository: TimeEntryRepository;
  private readonly milestoneRepository: ContractMilestoneRepository;
  private readonly activityRepository: ContractActivityRepository;
  private readonly logger: Logger;

  constructor(private readonly prisma: PrismaClient) {
    this.invoiceRepository = new ContractInvoiceRepository(prisma);
    this.contractRepository = new ContractRepository(prisma);
    this.timeEntryRepository = new TimeEntryRepository(prisma);
    this.milestoneRepository = new ContractMilestoneRepository(prisma);
    this.activityRepository = new ContractActivityRepository(prisma);
    this.logger = logger;
  }

  private get stripeService() {
    return getStripeService();
  }

  // ===========================================================================
  // INVOICE GENERATION
  // ===========================================================================

  /**
   * Generate an invoice for a contract
   */
  async generateInvoice(input: GenerateInvoiceInput): Promise<InvoiceWithDetails> {
    this.logger.info({ input }, '[InvoiceService] Generating invoice');

    // Validate contract
    const contract = await this.contractRepository.findById(input.contractId);
    if (!contract) {
      throw new InvoiceError('Contract not found', InvoiceErrorCodes.CONTRACT_NOT_FOUND, 404);
    }

    // Collect billable items
    const lineItems: CreateLineItemInput[] = [];
    let subtotal = 0;
    let totalHours = 0;
    let milestonesCount = 0;

    // Get approved time entries for the period
    if (input.includeApprovedTimeEntries !== false) {
      const { data: timeEntries } = await this.timeEntryRepository.list({
        contractId: input.contractId,
        status: 'APPROVED',
        dateFrom: input.periodStart,
        dateTo: input.periodEnd,
        invoiced: false,
      });

      for (const entry of timeEntries) {
        const hours = entry.durationMinutes / 60;
        const amount = Number(entry.amount);
        totalHours += hours;
        subtotal += amount;

        lineItems.push({
          type: 'TIME_ENTRY',
          description: `${entry.description} (${hours.toFixed(2)} hrs @ $${entry.hourlyRate}/hr)`,
          quantity: hours,
          unitPrice: Number(entry.hourlyRate),
          timeEntryId: entry.id,
        });
      }
    }

    // Get completed milestones for the period
    if (input.includeCompletedMilestones !== false) {
      // Get approved milestones that haven't been invoiced yet
      const allMilestones = await this.milestoneRepository.listByContract(input.contractId, {
        status: 'APPROVED',
      });

      // Filter to those that were approved in the period and not yet invoiced
      const milestones = allMilestones.filter((m) => {
        // Check if not already invoiced (no invoiceId on milestone)
        if ((m as { invoiceId?: string }).invoiceId) return false;
        // If we have approval date info, check the period
        const approvedAt = (m as { approvedAt?: Date }).approvedAt;
        if (approvedAt) {
          if (input.periodStart && approvedAt < input.periodStart) return false;
          if (input.periodEnd && approvedAt > input.periodEnd) return false;
        }
        return true;
      });

      for (const milestone of milestones) {
        const amount = Number(milestone.amount);
        subtotal += amount;
        milestonesCount++;

        lineItems.push({
          type: 'MILESTONE',
          description: `Milestone: ${milestone.title}`,
          quantity: 1,
          unitPrice: amount,
          milestoneId: milestone.id,
        });
      }
    }

    if (lineItems.length === 0) {
      throw new InvoiceError(
        'No billable items found for this period',
        InvoiceErrorCodes.NO_BILLABLE_ITEMS,
        400
      );
    }

    // Calculate fees
    // platformFee = subtotal * (PLATFORM_FEE_PERCENT / 100) - calculated at payout time
    const total = subtotal; // Client pays subtotal, platform fee comes from it

    // Calculate due date
    const dueDate =
      input.dueDate ??
      new Date(
        Date.now() + (contract.paymentTermsDays ?? DEFAULT_PAYMENT_TERMS_DAYS) * 24 * 60 * 60 * 1000
      );

    // Create invoice with line items
    const invoice = await this.invoiceRepository.create({
      contractId: input.contractId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      lineItems: lineItems.map((item, index) => ({
        ...item,
        amount: item.quantity * item.unitPrice,
        orderIndex: index,
      })),
      ...(input.notes && { notes: input.notes }),
      dueDate,
    });

    // Update time entries and milestones as invoiced
    for (const item of lineItems) {
      if (item.timeEntryId) {
        await this.timeEntryRepository.updateStatus(item.timeEntryId, 'INVOICED', {
          invoiceId: invoice.id,
          invoicedAt: new Date(),
        });
      }
    }

    // Log activity
    await this.activityRepository.log({
      contractId: input.contractId,
      actorUserId: contract.freelancerUserId,
      activityType: 'INVOICE_CREATED',
      description: `Invoice ${invoice.invoiceNumber} created for $${total.toFixed(2)}`,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        total,
        lineItemsCount: lineItems.length,
      },
    });

    this.logger.info(
      { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, total },
      '[InvoiceService] Invoice generated'
    );

    return invoice as InvoiceWithDetails;
  }

  /**
   * Auto-generate weekly invoice for hourly contracts
   */
  async autoGenerateWeeklyInvoice(contractId: string): Promise<InvoiceWithDetails | null> {
    this.logger.info({ contractId }, '[InvoiceService] Auto-generating weekly invoice');

    const contract = await this.contractRepository.findById(contractId);
    if (!contract) {
      throw new InvoiceError('Contract not found', InvoiceErrorCodes.CONTRACT_NOT_FOUND, 404);
    }

    // Only auto-generate for hourly contracts
    if (contract.rateType !== 'HOURLY') {
      this.logger.info(
        { contractId, rateType: contract.rateType },
        'Skipping auto-invoice for non-hourly contract'
      );
      return null;
    }

    // Only for active contracts
    if (contract.status !== 'ACTIVE') {
      this.logger.info(
        { contractId, status: contract.status },
        'Skipping auto-invoice for non-active contract'
      );
      return null;
    }

    // Calculate period (Sunday to Saturday of the current week)
    const now = new Date();
    const periodEnd = new Date(now);
    // Set to end of today
    periodEnd.setHours(23, 59, 59, 999);
    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - 6);
    periodStart.setHours(0, 0, 0, 0);

    try {
      const invoice = await this.generateInvoice({
        contractId,
        periodStart,
        periodEnd,
        includeApprovedTimeEntries: true,
        includeCompletedMilestones: false,
        notes: `Auto-generated weekly invoice for ${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()}`,
      });

      // Auto-send the invoice
      await this.sendInvoice(invoice.id);

      return invoice;
    } catch (error) {
      if (error instanceof InvoiceError && error.code === InvoiceErrorCodes.NO_BILLABLE_ITEMS) {
        this.logger.info({ contractId }, 'No billable items for weekly invoice');
        return null;
      }
      throw error;
    }
  }

  // ===========================================================================
  // INVOICE LIFECYCLE
  // ===========================================================================

  /**
   * Send an invoice to the client
   */
  async sendInvoice(invoiceId: string): Promise<InvoiceWithDetails> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) {
      throw new InvoiceError('Invoice not found', InvoiceErrorCodes.INVOICE_NOT_FOUND, 404);
    }

    if (invoice.status !== 'DRAFT') {
      throw new InvoiceError(
        'Only draft invoices can be sent',
        InvoiceErrorCodes.INVALID_STATE,
        400
      );
    }

    // Update invoice status
    const updated = await this.invoiceRepository.updateStatus(invoiceId, 'SENT', {
      issuedAt: new Date(),
    });

    // Log activity
    await this.activityRepository.log({
      contractId: invoice.contractId,
      actorUserId: invoice.freelancerUserId,
      activityType: 'INVOICE_SENT',
      description: `Invoice ${invoice.invoiceNumber} sent to client`,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      },
    });

    // FUTURE: Send notification to client

    this.logger.info({ invoiceId, invoiceNumber: invoice.invoiceNumber }, 'Invoice sent');

    return updated as InvoiceWithDetails;
  }

  /**
   * Mark invoice as viewed
   */
  async markAsViewed(invoiceId: string): Promise<InvoiceWithDetails> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) {
      throw new InvoiceError('Invoice not found', InvoiceErrorCodes.INVOICE_NOT_FOUND, 404);
    }

    if (invoice.viewedAt) {
      return invoice;
    }

    const updated = await this.invoiceRepository.updateStatus(invoiceId, 'VIEWED', {
      viewedAt: new Date(),
    });

    return updated as InvoiceWithDetails;
  }

  /**
   * Pay an invoice
   */
  async payInvoice(
    invoiceId: string,
    clientUserId: string,
    paymentMethodId: string
  ): Promise<{
    invoice: InvoiceWithDetails;
    paymentIntentId: string;
    paymentIntent?: { id: string };
    clientSecret?: string;
  }> {
    this.logger.info({ invoiceId, clientUserId }, '[InvoiceService] Paying invoice');

    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) {
      throw new InvoiceError('Invoice not found', InvoiceErrorCodes.INVOICE_NOT_FOUND, 404);
    }

    // Verify caller is the client
    if (invoice.clientUserId !== clientUserId) {
      throw new InvoiceError(
        'Only the client can pay this invoice',
        InvoiceErrorCodes.NOT_AUTHORIZED,
        403
      );
    }

    if (invoice.status === 'PAID') {
      throw new InvoiceError(
        'Invoice is already paid',
        InvoiceErrorCodes.INVOICE_ALREADY_PAID,
        400
      );
    }

    if (invoice.status === 'CANCELLED') {
      throw new InvoiceError('Invoice is cancelled', InvoiceErrorCodes.INVOICE_CANCELLED, 400);
    }

    // Get or create Stripe customer
    const { stripeCustomerId } = await this.stripeService.getOrCreateCustomer(clientUserId);

    // Create payment intent
    const paymentIntent = await this.stripeService.createPaymentIntent({
      amount: Number(invoice.total),
      currency: invoice.currency,
      customerId: stripeCustomerId,
      paymentMethodId: paymentMethodId,
      captureMethod: 'automatic', // Auto-capture for invoice payments
      description: `Invoice ${invoice.invoiceNumber} payment`,
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoiceNumber,
        contract_id: invoice.contractId,
        type: 'invoice_payment',
      },
    });

    // Update invoice with payment intent
    await this.prisma.contractInvoice.update({
      where: { id: invoice.id },
      data: {
        stripePaymentIntentId: paymentIntent.id,
        paymentMethod: 'card',
        updatedAt: new Date(),
      },
    });

    this.logger.info(
      { invoiceId: invoice.id, paymentIntentId: paymentIntent.id },
      'Payment intent created for invoice'
    );

    const needsAction = paymentIntent.status === 'requires_action';

    // If payment succeeded immediately, mark as paid
    if (paymentIntent.status === 'succeeded') {
      await this.handleInvoicePaid(invoice.id);
    }

    const updated = await this.invoiceRepository.findById(invoice.id);
    const clientSecret = needsAction ? (paymentIntent.client_secret ?? undefined) : undefined;

    return {
      invoice: updated as InvoiceWithDetails,
      paymentIntentId: paymentIntent.id,
      ...(clientSecret && { clientSecret }),
    };
  }

  /**
   * Handle invoice payment completion
   */
  async handleInvoicePaid(invoiceId: string): Promise<void> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice || invoice.status === 'PAID') {
      return;
    }

    // Update invoice status
    await this.invoiceRepository.updateStatus(invoiceId, 'PAID', {
      paidAt: new Date(),
    });

    // Update time entries as paid
    const timeEntries = await this.prisma.timeEntryV2.findMany({
      where: { invoiceId },
    });

    for (const entry of timeEntries) {
      await this.timeEntryRepository.updateStatus(entry.id, 'PAID');
    }

    // Update contract totals
    await this.prisma.contractV2.update({
      where: { id: invoice.contractId },
      data: {
        totalPaid: { increment: new Prisma.Decimal(Number(invoice.freelancerAmount)) },
        updatedAt: new Date(),
      },
    });

    // Log activity
    await this.activityRepository.log({
      contractId: invoice.contractId,
      actorUserId: invoice.clientUserId,
      activityType: 'INVOICE_PAID',
      description: `Invoice ${invoice.invoiceNumber} paid - $${invoice.total}`,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        total: Number(invoice.total),
      },
    });

    // FUTURE: Schedule payout to freelancer

    this.logger.info({ invoiceId }, 'Invoice marked as paid');
  }

  /**
   * Cancel an invoice
   */
  async cancelInvoice(
    invoiceId: string,
    cancelledBy: string,
    reason: string
  ): Promise<InvoiceWithDetails> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) {
      throw new InvoiceError('Invoice not found', InvoiceErrorCodes.INVOICE_NOT_FOUND, 404);
    }

    if (invoice.status === 'PAID') {
      throw new InvoiceError('Cannot cancel a paid invoice', InvoiceErrorCodes.INVALID_STATE, 400);
    }

    if (invoice.status === 'CANCELLED') {
      throw new InvoiceError('Invoice is already cancelled', InvoiceErrorCodes.INVALID_STATE, 400);
    }

    // Update invoice status
    const updated = await this.invoiceRepository.updateStatus(invoiceId, 'CANCELLED', {
      notes: `Cancelled: ${reason}`,
    });

    // Revert time entries to approved status
    await this.prisma.timeEntryV2.updateMany({
      where: { invoiceId },
      data: {
        status: 'APPROVED',
        invoiceId: null,
        invoicedAt: null,
      },
    });

    // Log activity
    await this.activityRepository.log({
      contractId: invoice.contractId,
      actorUserId: cancelledBy,
      activityType: 'INVOICE_CREATED', // Using existing type
      description: `Invoice ${invoice.invoiceNumber} cancelled: ${reason}`,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        reason,
        action: 'cancelled',
      },
    });

    this.logger.info({ invoiceId, reason }, 'Invoice cancelled');

    return updated as InvoiceWithDetails;
  }

  // ===========================================================================
  // INVOICE REMINDERS
  // ===========================================================================

  /**
   * Send reminder for overdue or due soon invoices
   */
  async sendReminder(invoiceId: string): Promise<void> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) {
      throw new InvoiceError('Invoice not found', InvoiceErrorCodes.INVOICE_NOT_FOUND, 404);
    }

    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
      return;
    }

    // Increment reminder count
    await this.prisma.contractInvoice.update({
      where: { id: invoiceId },
      data: {
        reminderCount: { increment: 1 },
        lastReminderSentAt: new Date(),
      },
    });

    // FUTURE: Send notification to client

    this.logger.info(
      { invoiceId, reminderCount: invoice.reminderCount + 1 },
      'Invoice reminder sent'
    );
  }

  /**
   * Get invoices that need reminders
   */
  async getInvoicesNeedingReminders(): Promise<InvoiceSummary[]> {
    const now = new Date();
    const invoices = await this.prisma.contractInvoice.findMany({
      where: {
        status: { in: ['SENT', 'VIEWED'] },
        dueAt: { not: null },
        OR: [
          // Due today or overdue
          { dueAt: { lte: now } },
          // Due within reminder window
          ...INVOICE_DUE_REMINDER_DAYS.map((days) => ({
            dueAt: {
              gte: new Date(now.getTime() + (days - 1) * 24 * 60 * 60 * 1000),
              lte: new Date(now.getTime() + days * 24 * 60 * 60 * 1000),
            },
          })),
        ],
      },
      include: {
        contract: {
          include: {
            client: { select: { displayName: true } },
            freelancer: { select: { displayName: true } },
          },
        },
      },
    });

    return invoices.map((inv) => this.mapToSummary(inv));
  }

  /**
   * Mark overdue invoices
   */
  async markOverdueInvoices(): Promise<number> {
    const result = await this.prisma.contractInvoice.updateMany({
      where: {
        status: { in: ['SENT', 'VIEWED'] },
        dueAt: { lt: new Date() },
      },
      data: {
        status: 'OVERDUE',
        updatedAt: new Date(),
      },
    });

    if (result.count > 0) {
      this.logger.info({ count: result.count }, 'Marked invoices as overdue');
    }

    return result.count;
  }

  // ===========================================================================
  // QUERY METHODS
  // ===========================================================================

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId: string): Promise<InvoiceWithDetails | null> {
    return this.invoiceRepository.findById(invoiceId);
  }

  /**
   * Get invoice by number
   */
  async getInvoiceByNumber(invoiceNumber: string): Promise<InvoiceWithDetails | null> {
    return this.invoiceRepository.findByInvoiceNumber(invoiceNumber);
  }

  /**
   * List invoices for a contract
   */
  async listContractInvoices(
    contractId: string,
    options?: InvoiceListOptions
  ): Promise<{
    data: InvoiceSummary[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const result = await this.invoiceRepository.listByContract(contractId, options);
    return {
      data: result.data.map((inv) => this.mapToSummary(inv)),
      total: result.total,
      page: options?.page ?? 1,
      limit: options?.limit ?? 20,
      totalPages: Math.ceil(result.total / (options?.limit ?? 20)),
    };
  }

  /**
   * List invoices for a client
   */
  async listClientInvoices(
    clientUserId: string,
    options?: InvoiceListOptions
  ): Promise<{
    data: InvoiceSummary[];
    total: number;
  }> {
    const result = await this.invoiceRepository.listByClient(clientUserId, options);
    return {
      data: result.data.map((inv) => this.mapToSummary(inv)),
      total: result.total,
    };
  }

  /**
   * List invoices for a freelancer
   */
  async listFreelancerInvoices(
    freelancerUserId: string,
    options?: InvoiceListOptions
  ): Promise<{
    data: InvoiceSummary[];
    total: number;
  }> {
    const result = await this.invoiceRepository.listByFreelancer(freelancerUserId, options);
    return {
      data: result.data.map((inv) => this.mapToSummary(inv)),
      total: result.total,
    };
  }

  /**
   * Get invoice statistics for a contract
   */
  async getInvoiceStats(contractId: string) {
    const [totalInvoiced, totalPaid, pendingPayment, overdueCount] = await Promise.all([
      this.prisma.contractInvoice.aggregate({
        where: { contractId },
        _sum: { total: true },
      }),
      this.prisma.contractInvoice.aggregate({
        where: { contractId, status: 'PAID' },
        _sum: { total: true },
      }),
      this.prisma.contractInvoice.aggregate({
        where: { contractId, status: { in: ['SENT', 'VIEWED'] } },
        _sum: { total: true },
      }),
      this.prisma.contractInvoice.count({
        where: { contractId, status: 'OVERDUE' },
      }),
    ]);

    return {
      totalInvoiced: Number(totalInvoiced._sum.total ?? 0),
      totalPaid: Number(totalPaid._sum.total ?? 0),
      pendingPayment: Number(pendingPayment._sum.total ?? 0),
      overdueCount,
    };
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapToSummary(invoice: any): InvoiceSummary {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      contractId: invoice.contractId,
      contractTitle: invoice.contract?.title ?? '',
      clientName: invoice.contract?.client?.displayName ?? '',
      freelancerName: invoice.contract?.freelancer?.displayName ?? '',
      subtotal: Number(invoice.subtotal),
      platformFee: Number(invoice.platformFee),
      taxes: Number(invoice.taxes),
      total: Number(invoice.total),
      freelancerAmount: Number(invoice.freelancerAmount ?? 0),
      currency: invoice.currency,
      status: invoice.status,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      issuedAt: invoice.issuedAt,
      dueAt: invoice.dueAt,
      paidAt: invoice.paidAt,
      hoursLogged: invoice.hoursLogged ? Number(invoice.hoursLogged) : null,
      milestonesCount: invoice.milestonesCount,
    };
  }
}
