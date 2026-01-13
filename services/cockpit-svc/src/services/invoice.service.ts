/**
 * @module @skillancer/cockpit-svc/services/invoice
 * Invoice Service - Professional invoicing operations
 */

import { randomBytes } from 'crypto';

import {
  InvoiceError,
  InvoiceErrorCode,
  invoiceErrors,
  paymentErrors,
} from '../errors/invoice.errors.js';
import {
  InvoiceRepository,
  InvoicePaymentRepository,
  InvoiceTemplateRepository,
  InvoiceActivityRepository,
  InvoiceSettingsRepository,
} from '../repositories/index.js';

import type {
  CreateInvoiceParams,
  UpdateInvoiceParams,
  InvoiceFilters,
  InvoiceWithDetails,
  RecordPaymentParams,
  SendInvoiceOptions,
  PublicInvoiceView,
  InvoiceDashboard,
  InvoiceSummary,
  PaymentOption,
  CreateLineItemParams,
} from '../types/invoice.types.js';
import type {
  Invoice,
  InvoiceStatus,
  Client,
  InvoiceLineItem,
  InvoicePayment,
  InvoiceTemplate,
} from '../types/prisma-shim.js';
import type { PrismaClient } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';

/**
 * Helper to get client display name from Client object
 */
function getClientDisplayName(client: Client | null | undefined): string {
  if (!client) return '';
  if (client.companyName) return client.companyName;
  const parts = [client.firstName, client.lastName].filter(Boolean);
  return parts.join(' ') || '';
}

// Type for invoice with included relations
type InvoiceWithRelations = Invoice & {
  client?: Client | null;
  lineItems?: InvoiceLineItem[];
  payments?: InvoicePayment[];
  template?: InvoiceTemplate | null;
};

export class InvoiceService {
  private readonly invoiceRepository: InvoiceRepository;
  private readonly paymentRepository: InvoicePaymentRepository;
  private readonly templateRepository: InvoiceTemplateRepository;
  private readonly activityRepository: InvoiceActivityRepository;
  private readonly settingsRepository: InvoiceSettingsRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger
  ) {
    this.invoiceRepository = new InvoiceRepository(prisma);
    this.paymentRepository = new InvoicePaymentRepository(prisma);
    this.templateRepository = new InvoiceTemplateRepository(prisma);
    this.activityRepository = new InvoiceActivityRepository(prisma);
    this.settingsRepository = new InvoiceSettingsRepository(prisma);
  }

  /**
   * Create a new invoice
   */
  async createInvoice(params: CreateInvoiceParams): Promise<Invoice> {
    // Validate line items
    if (!params.lineItems || params.lineItems.length === 0) {
      throw invoiceErrors.noLineItems();
    }

    // Validate dates
    const issueDate = params.issueDate ?? new Date();
    const dueDate = params.dueDate ?? this.getDefaultDueDate(issueDate, 30);

    if (dueDate < issueDate) {
      throw invoiceErrors.invalidDates(issueDate, dueDate);
    }

    // Generate invoice number
    const invoiceNumber = await this.settingsRepository.generateNextNumber(params.freelancerUserId);

    // Calculate amounts
    const { subtotal, discountAmount, taxAmount, total } = this.calculateAmounts(params);

    if (total <= 0) {
      throw new InvoiceError(InvoiceErrorCode.INVALID_INVOICE_AMOUNT);
    }

    // Generate view token for client portal
    const viewToken = this.generateViewToken();

    // Get template defaults if template specified
    let templateDefaults = {};
    if (params.templateId) {
      const template = await this.templateRepository.findById(params.templateId);
      if (template) {
        templateDefaults = {
          notes: params.notes ?? template.defaultNotes,
          terms: params.terms ?? template.defaultTerms,
          taxRate: params.taxRate ?? template.defaultTaxRate ?? undefined,
          taxLabel: params.taxLabel ?? template.defaultTaxLabel,
        };
      }
    }

    const invoice = await this.invoiceRepository.create({
      ...params,
      ...templateDefaults,
      issueDate,
      dueDate,
      invoiceNumber,
      subtotal,
      discountAmount,
      taxAmount,
      total,
      viewToken,
    });

    // Log activity
    await this.activityRepository.logCreated(invoice.id, params.freelancerUserId);

    this.logger.info(
      {
        invoiceId: invoice.id,
        invoiceNumber,
        userId: params.freelancerUserId,
        total,
      },
      'Invoice created'
    );

    return invoice;
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId: string, userId: string): Promise<InvoiceWithDetails> {
    const invoice = await this.invoiceRepository.findByIdWithDetails(invoiceId);

    if (!invoice || invoice.freelancerUserId !== userId) {
      throw invoiceErrors.notFound(invoiceId);
    }

    return invoice;
  }

  /**
   * List invoices with filters
   */
  async listInvoices(filters: InvoiceFilters): Promise<{
    invoices: Invoice[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { invoices, total } = await this.invoiceRepository.findByFilters(filters);

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const totalPages = Math.ceil(total / limit);

    return {
      invoices,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Update a draft invoice
   */
  async updateInvoice(
    invoiceId: string,
    userId: string,
    params: UpdateInvoiceParams
  ): Promise<Invoice> {
    const existing = await this.invoiceRepository.findById(invoiceId);

    if (!existing || existing.freelancerUserId !== userId) {
      throw invoiceErrors.notFound(invoiceId);
    }

    if (existing.status !== 'DRAFT') {
      throw invoiceErrors.cannotEdit(invoiceId, existing.status);
    }

    // If line items are being updated, recalculate amounts
    let amountUpdates = {};
    if (params.lineItems) {
      const { subtotal, discountAmount, taxAmount, total } = this.calculateAmounts({
        ...existing,
        ...params,
        lineItems: params.lineItems,
      } as CreateInvoiceParams);
      amountUpdates = { subtotal, discountAmount, taxAmount, total, amountDue: total };
    }

    // Extract lineItems as they need special handling
    const { lineItems, ...updateData } = params;

    const invoice = await this.invoiceRepository.update(invoiceId, {
      ...updateData,
      ...amountUpdates,
    });

    // TODO: Handle lineItems update separately if needed

    await this.activityRepository.logUpdated(invoiceId, userId, Object.keys(params));

    this.logger.info({ invoiceId, userId }, 'Invoice updated');

    return invoice;
  }

  /**
   * Send invoice to client
   */
  async sendInvoice(
    invoiceId: string,
    userId: string,
    options?: SendInvoiceOptions
  ): Promise<Invoice> {
    const invoiceRaw = await this.invoiceRepository.findByIdWithDetails(invoiceId);

    if (!invoiceRaw || invoiceRaw.freelancerUserId !== userId) {
      throw invoiceErrors.notFound(invoiceId);
    }

    // Cast to include relations
    const invoice = invoiceRaw as InvoiceWithRelations;

    if (invoice.status === 'VOIDED') {
      throw invoiceErrors.voided(invoiceId);
    }

    if (invoice.status === 'PAID') {
      throw invoiceErrors.alreadyPaid(invoiceId);
    }

    // Get recipients
    const recipients = options?.to ?? (invoice.client?.email ? [invoice.client.email] : []);

    if (recipients.length === 0) {
      throw new InvoiceError(InvoiceErrorCode.INVALID_EMAIL_RECIPIENT);
    }

    // Update status to SENT
    const updatedInvoice = await this.invoiceRepository.updateStatus(invoiceId, 'SENT');

    // Set up reminder schedule
    await this.scheduleReminders(invoiceId, userId);

    // Log activity
    await this.activityRepository.logSent(invoiceId, userId, recipients);

    // TODO: Actually send the email via notification service

    this.logger.info({ invoiceId, recipients, userId }, 'Invoice sent');

    return updatedInvoice;
  }

  /**
   * Mark invoice as viewed (from client portal)
   */
  async markAsViewed(viewToken: string, ipAddress?: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findByViewToken(viewToken);

    if (!invoice) {
      throw new InvoiceError(InvoiceErrorCode.INVALID_VIEW_TOKEN);
    }

    // Only update if not already viewed
    if (invoice.status === 'SENT') {
      const updated = await this.invoiceRepository.updateStatus(invoice.id, 'VIEWED');
      await this.activityRepository.logViewed(invoice.id, ipAddress);
      return updated;
    }

    return invoice;
  }

  /**
   * Record a manual payment
   */
  async recordPayment(params: RecordPaymentParams): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findById(params.invoiceId);

    if (!invoice || invoice.freelancerUserId !== params.freelancerUserId) {
      throw invoiceErrors.notFound(params.invoiceId);
    }

    if (invoice.status === 'VOIDED') {
      throw invoiceErrors.voided(params.invoiceId);
    }

    if (invoice.status === 'PAID') {
      throw invoiceErrors.alreadyPaid(params.invoiceId);
    }

    if (params.amount <= 0) {
      throw new InvoiceError(InvoiceErrorCode.INVALID_PAYMENT_AMOUNT);
    }

    if (params.amount > Number(invoice.amountDue)) {
      throw paymentErrors.exceedsAmountDue(Number(invoice.amountDue), params.amount);
    }

    // Create payment record
    await this.paymentRepository.create(params);

    // Update invoice amounts
    const totalPaid = await this.paymentRepository.getTotalPaid(params.invoiceId);
    const amountDue = Number(invoice.total) - totalPaid;

    const updatedInvoice = await this.invoiceRepository.updatePaymentAmounts(
      params.invoiceId,
      totalPaid,
      amountDue
    );

    // Log activity
    await this.activityRepository.logPaymentReceived(
      params.invoiceId,
      params.amount,
      params.paymentMethod
    );

    // Clear reminders if fully paid
    if (amountDue <= 0) {
      await this.invoiceRepository.setNextReminder(params.invoiceId, null);
    }

    this.logger.info(
      {
        invoiceId: params.invoiceId,
        amount: params.amount,
        method: params.paymentMethod,
        newAmountDue: amountDue,
      },
      'Payment recorded'
    );

    return updatedInvoice;
  }

  /**
   * Void an invoice
   */
  async voidInvoice(invoiceId: string, userId: string, reason?: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findById(invoiceId);

    if (!invoice || invoice.freelancerUserId !== userId) {
      throw invoiceErrors.notFound(invoiceId);
    }

    if (invoice.status === 'DRAFT') {
      throw invoiceErrors.cannotVoid(invoiceId, invoice.status);
    }

    if (invoice.status === 'VOIDED') {
      throw invoiceErrors.voided(invoiceId);
    }

    const updatedInvoice = await this.invoiceRepository.updateStatus(invoiceId, 'VOIDED');

    // Clear any scheduled reminders
    await this.invoiceRepository.setNextReminder(invoiceId, null);

    await this.activityRepository.logVoided(invoiceId, userId, reason);

    this.logger.info({ invoiceId, userId, reason }, 'Invoice voided');

    return updatedInvoice;
  }

  /**
   * Delete a draft invoice
   */
  async deleteInvoice(invoiceId: string, userId: string): Promise<void> {
    const invoice = await this.invoiceRepository.findById(invoiceId);

    if (!invoice || invoice.freelancerUserId !== userId) {
      throw invoiceErrors.notFound(invoiceId);
    }

    if (invoice.status !== 'DRAFT') {
      throw invoiceErrors.cannotDelete(invoiceId, invoice.status);
    }

    await this.invoiceRepository.delete(invoiceId);

    this.logger.info({ invoiceId, userId }, 'Invoice deleted');
  }

  /**
   * Get public invoice view for client portal
   */
  async getPublicView(viewToken: string): Promise<PublicInvoiceView> {
    const invoiceResult = await this.invoiceRepository.findByViewToken(viewToken);

    if (!invoiceResult) {
      throw new InvoiceError(InvoiceErrorCode.INVALID_VIEW_TOKEN);
    }

    // Cast to include relations that are included in the query
    const invoice = invoiceResult as InvoiceWithRelations;
    const template = invoice.template;
    const client = invoice.client;

    // Build payment options
    const paymentOptions: PaymentOption[] = [];

    if (invoice.acceptedPaymentMethods.includes('BANK_TRANSFER')) {
      paymentOptions.push({
        method: 'BANK_TRANSFER',
        label: 'Bank Transfer',
        instructions: invoice.paymentInstructions,
      });
    }

    if (invoice.acceptedPaymentMethods.includes('STRIPE') && template?.stripeEnabled) {
      paymentOptions.push({
        method: 'STRIPE',
        label: 'Pay with Card',
        enabled: true,
      });
    }

    if (invoice.acceptedPaymentMethods.includes('PAYPAL') && template?.paypalEnabled) {
      paymentOptions.push({
        method: 'PAYPAL',
        label: 'Pay with PayPal',
        enabled: true,
      });
    }

    return {
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        status: invoice.status,
        currency: invoice.currency,
        subtotal: Number(invoice.subtotal),
        discountAmount: Number(invoice.discountAmount),
        taxAmount: Number(invoice.taxAmount),
        taxLabel: invoice.taxLabel,
        total: Number(invoice.total),
        amountPaid: Number(invoice.amountPaid),
        amountDue: Number(invoice.amountDue),
        lateFeeAmount: Number(invoice.lateFeeAmount),
        title: invoice.title,
        summary: invoice.summary,
        notes: invoice.notes,
        terms: invoice.terms,
        paymentInstructions: invoice.paymentInstructions,
        pdfUrl: invoice.pdfUrl,
      },
      lineItems:
        invoice.lineItems?.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitType: item.unitType,
          unitPrice: Number(item.unitPrice),
          amount: Number(item.amount),
        })) ?? [],
      payments:
        invoice.payments?.map((p) => ({
          amount: Number(p.amount),
          date: p.paymentDate,
          method: p.paymentMethod,
        })) ?? [],
      business: {
        name: template?.businessName ?? '',
        address: template?.businessAddress as PublicInvoiceView['business']['address'],
        email: template?.businessEmail,
        phone: template?.businessPhone,
        website: template?.businessWebsite,
        logoUrl: template?.logoUrl,
      },
      client: {
        name: getClientDisplayName(client),
        email: client?.email,
        address: client?.address as PublicInvoiceView['client']['address'],
      },
      branding: {
        accentColor: template?.accentColor ?? '#3B82F6',
        logoUrl: template?.logoUrl,
      },
      paymentOptions,
    };
  }

  /**
   * Get invoice dashboard
   */
  async getDashboard(userId: string): Promise<InvoiceDashboard> {
    const stats = await this.invoiceRepository.getStats(userId);
    const monthlyTrend = await this.invoiceRepository.getMonthlyTotals(userId, 6);

    // Get recent invoices
    const { invoices: recentInvoices } = await this.invoiceRepository.findByFilters({
      freelancerUserId: userId,
      limit: 5,
      sortBy: 'issueDate',
      sortOrder: 'desc',
    });

    // Get overdue invoices
    const { invoices: overdueInvoices } = await this.invoiceRepository.findByFilters({
      freelancerUserId: userId,
      isOverdue: true,
      limit: 10,
    });

    const now = new Date();

    return {
      summary: {
        totalOutstanding: stats.totalOutstanding,
        totalOverdue: stats.totalOverdue,
        overdueCount: stats.overdueCount,
        pendingCount: stats.pendingCount,
        totalPaidThisMonth: 0, // TODO: Calculate
        totalPaidThisYear: 0, // TODO: Calculate
        avgDaysToPayment: 0, // TODO: Calculate
      },
      recentInvoices: recentInvoices.map((inv) => {
        const invoiceWithClient = inv as InvoiceWithRelations;
        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          clientName: getClientDisplayName(invoiceWithClient.client),
          total: Number(inv.total),
          amountDue: Number(inv.amountDue),
          status: inv.status,
          dueDate: inv.dueDate,
          isOverdue: inv.dueDate < now && !['PAID', 'VOIDED', 'DRAFT'].includes(inv.status),
        };
      }),
      overdueInvoices: overdueInvoices.map((inv) => {
        const invoiceWithClient = inv as InvoiceWithRelations;
        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          clientName: getClientDisplayName(invoiceWithClient.client),
          amountDue: Number(inv.amountDue),
          dueDate: inv.dueDate,
          daysOverdue: Math.floor((now.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
        };
      }),
      monthlyTrend,
    };
  }

  /**
   * Apply late fee to overdue invoice
   */
  async applyLateFee(invoiceId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findById(invoiceId);

    if (!invoice) {
      throw invoiceErrors.notFound(invoiceId);
    }

    if (!invoice.lateFeeEnabled || !invoice.lateFeeType || !invoice.lateFeeValue) {
      throw new InvoiceError(InvoiceErrorCode.LATE_FEE_NOT_ENABLED);
    }

    // Calculate late fee
    let lateFeeAmount: number;

    if (invoice.lateFeeType === 'PERCENTAGE') {
      lateFeeAmount = Number(invoice.amountDue) * (Number(invoice.lateFeeValue) / 100);
    } else {
      lateFeeAmount = Number(invoice.lateFeeValue);
    }

    const updatedInvoice = await this.invoiceRepository.applyLateFee(invoiceId, lateFeeAmount);

    await this.activityRepository.logLateFeeApplied(invoiceId, lateFeeAmount);

    this.logger.info({ invoiceId, lateFeeAmount }, 'Late fee applied');

    return updatedInvoice;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Calculate invoice amounts from line items and settings
   */
  private calculateAmounts(params: CreateInvoiceParams): {
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    total: number;
  } {
    // Calculate subtotal from line items
    const subtotal = params.lineItems.reduce((sum, item) => {
      return sum + item.quantity * item.unitPrice;
    }, 0);

    // Calculate discount
    let discountAmount = 0;
    if (params.discountType && params.discountValue) {
      if (params.discountType === 'PERCENTAGE') {
        discountAmount = subtotal * (params.discountValue / 100);
      } else {
        discountAmount = params.discountValue;
      }
    }

    const afterDiscount = subtotal - discountAmount;

    // Calculate tax
    let taxAmount = 0;
    if (params.taxEnabled && params.taxRate) {
      // Only calculate tax on taxable items
      const taxableSubtotal = params.lineItems.reduce((sum, item) => {
        if (item.isTaxable !== false) {
          return sum + item.quantity * item.unitPrice;
        }
        return sum;
      }, 0);

      const taxableAfterDiscount = taxableSubtotal * (1 - discountAmount / subtotal);
      taxAmount = taxableAfterDiscount * (params.taxRate / 100);
    }

    const total = afterDiscount + taxAmount;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }

  /**
   * Generate a secure view token
   */
  private generateViewToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Calculate default due date
   */
  private getDefaultDueDate(issueDate: Date, dueDays: number): Date {
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + dueDays);
    return dueDate;
  }

  /**
   * Schedule reminder emails
   */
  private async scheduleReminders(invoiceId: string, userId: string): Promise<void> {
    const settings = await this.settingsRepository.getReminderSettings(userId);

    if (!settings.autoReminders || settings.reminderDays.length === 0) {
      return;
    }

    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) return;

    // Find the next reminder date
    const now = new Date();
    const dueDate = invoice.dueDate;

    for (const daysBeforeDue of settings.reminderDays.sort((a, b) => b - a)) {
      const reminderDate = new Date(dueDate);
      reminderDate.setDate(reminderDate.getDate() - daysBeforeDue);

      if (reminderDate > now) {
        await this.invoiceRepository.setNextReminder(invoiceId, reminderDate);
        return;
      }
    }

    // If all pre-due reminders have passed, set for day after due (overdue reminder)
    const overdueReminder = new Date(dueDate);
    overdueReminder.setDate(overdueReminder.getDate() + 1);

    if (overdueReminder > now) {
      await this.invoiceRepository.setNextReminder(invoiceId, overdueReminder);
    }
  }
}
