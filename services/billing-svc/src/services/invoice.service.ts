// @ts-nocheck - Known type issues pending refactor
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-non-null-assertion */
/**
 * @module @skillancer/billing-svc/services/invoice
 * Invoice management service
 */

import { getStripeService } from './stripe.service.js';
import { BillingError } from '../errors/index.js';
import {
  getInvoiceRepository,
  getSubscriptionRepository,
  type InvoiceStatus,
} from '../repositories/index.js';

import type { Prisma } from '@skillancer/database';
import type Stripe from 'stripe';

// =============================================================================
// TYPES
// =============================================================================

export interface InvoiceResponse {
  id: string;
  subscriptionId: string;
  stripeInvoiceId: string;
  number: string | null;
  status: InvoiceStatus;
  subtotal: number;
  tax: number;
  total: number;
  amountDue: number;
  amountPaid: number;
  amountRemaining: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string | null;
  paidAt: string | null;
  hostedInvoiceUrl: string | null;
  pdfUrl: string | null;
  lineItems: InvoiceLineItem[];
  attemptCount: number;
  nextPaymentAttempt: string | null;
  createdAt: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
}

export interface InvoiceListResponse {
  invoices: InvoiceResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface PayInvoiceResult {
  invoice: InvoiceResponse;
  paymentIntent?: {
    clientSecret: string;
    status: string;
  };
}

// =============================================================================
// INVOICE SERVICE
// =============================================================================

export class InvoiceService {
  private _stripeService: ReturnType<typeof getStripeService> | null = null;
  private readonly invoiceRepository = getInvoiceRepository();
  private readonly subscriptionRepository = getSubscriptionRepository();

  private get stripeService() {
    this._stripeService ??= getStripeService();
    return this._stripeService;
  }

  // ===========================================================================
  // LIST INVOICES
  // ===========================================================================

  /**
   * Get invoices for a user
   */
  async getInvoicesForUser(
    userId: string,
    options?: {
      subscriptionId?: string;
      status?: InvoiceStatus | InvoiceStatus[];
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    }
  ): Promise<InvoiceListResponse> {
    // Build filters object, only including defined values
    const filters: {
      subscriptionId?: string;
      status?: InvoiceStatus | InvoiceStatus[];
      startDate?: Date;
      endDate?: Date;
    } = {};

    if (options?.subscriptionId) filters.subscriptionId = options.subscriptionId;
    if (options?.status) filters.status = options.status;
    if (options?.startDate) filters.startDate = options.startDate;
    if (options?.endDate) filters.endDate = options.endDate;

    const result = await this.invoiceRepository.findByUserId(userId, filters, {
      page: options?.page,
      limit: options?.limit,
    });

    return {
      invoices: result.invoices.map((invoice) => this.mapInvoiceResponse(invoice)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  /**
   * Get invoices for a subscription
   */
  async getInvoicesForSubscription(
    subscriptionId: string,
    userId: string,
    pagination?: { page?: number; limit?: number }
  ): Promise<InvoiceListResponse> {
    // Verify subscription belongs to user
    const subscription = await this.subscriptionRepository.findById(subscriptionId);

    if (!subscription) {
      throw new BillingError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404);
    }

    if (subscription.userId !== userId) {
      throw new BillingError('Unauthorized', 'UNAUTHORIZED', 403);
    }

    const result = await this.invoiceRepository.findBySubscriptionId(subscriptionId, pagination);

    return {
      invoices: result.invoices.map((invoice) => this.mapInvoiceResponse(invoice)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  // ===========================================================================
  // GET INVOICE DETAILS
  // ===========================================================================

  /**
   * Get invoice by ID
   */
  async getInvoiceById(invoiceId: string, userId: string): Promise<InvoiceResponse> {
    const invoice = await this.invoiceRepository.findById(invoiceId);

    if (!invoice) {
      throw new BillingError('Invoice not found', 'INVOICE_NOT_FOUND', 404);
    }

    // Verify invoice belongs to user - need to look up subscription
    const subscription = await this.subscriptionRepository.findById(invoice.subscriptionId);
    if (!subscription?.userId || subscription.userId !== userId) {
      throw new BillingError('Unauthorized', 'UNAUTHORIZED', 403);
    }

    return this.mapInvoiceResponse(invoice);
  }

  /**
   * Get invoice download URL
   */
  async getInvoiceDownloadUrl(invoiceId: string, userId: string): Promise<string> {
    const invoice = await this.invoiceRepository.findById(invoiceId);

    if (!invoice) {
      throw new BillingError('Invoice not found', 'INVOICE_NOT_FOUND', 404);
    }

    // Verify invoice belongs to user - need to look up subscription
    const subscription = await this.subscriptionRepository.findById(invoice.subscriptionId);
    if (!subscription?.userId || subscription.userId !== userId) {
      throw new BillingError('Unauthorized', 'UNAUTHORIZED', 403);
    }

    if (invoice.pdfUrl) {
      return invoice.pdfUrl;
    }

    // Get fresh URL from Stripe
    const stripeInvoice = await this.stripeService.getInvoice(invoice.stripeInvoiceId);

    if (stripeInvoice.invoice_pdf) {
      // Update local record with URL
      await this.invoiceRepository.update(invoice.id, {
        pdfUrl: stripeInvoice.invoice_pdf,
      });

      return stripeInvoice.invoice_pdf;
    }

    throw new BillingError('Invoice PDF not available', 'PDF_NOT_AVAILABLE', 404);
  }

  // ===========================================================================
  // PAY INVOICE
  // ===========================================================================

  /**
   * Pay an outstanding invoice
   */
  async payInvoice(
    invoiceId: string,
    userId: string,
    paymentMethodId?: string
  ): Promise<PayInvoiceResult> {
    const invoice = await this.invoiceRepository.findById(invoiceId);

    if (!invoice) {
      throw new BillingError('Invoice not found', 'INVOICE_NOT_FOUND', 404);
    }

    // Verify invoice belongs to user - need to look up subscription
    const subscription = await this.subscriptionRepository.findById(invoice.subscriptionId);
    if (!subscription?.userId || subscription.userId !== userId) {
      throw new BillingError('Unauthorized', 'UNAUTHORIZED', 403);
    }

    if (invoice.status !== 'OPEN') {
      throw new BillingError(
        `Invoice cannot be paid (status: ${invoice.status})`,
        'INVOICE_NOT_PAYABLE',
        400
      );
    }

    // If payment method provided, update it on the invoice
    if (paymentMethodId) {
      await this.stripeService.updateInvoice(invoice.stripeInvoiceId, {
        default_payment_method: paymentMethodId,
      });
    }

    // Attempt to pay the invoice
    const stripeInvoice = await this.stripeService.payInvoiceWithOptions(invoice.stripeInvoiceId, {
      expand: ['payment_intent'],
    });

    // Update local record
    const updatedInvoice = await this.invoiceRepository.update(invoice.id, {
      status: this.mapStripeInvoiceStatus(stripeInvoice.status),
      amountPaid: stripeInvoice.amount_paid,
      amountRemaining: stripeInvoice.amount_remaining,
      paidAt: stripeInvoice.status === 'paid' ? new Date() : undefined,
      attemptCount: stripeInvoice.attempt_count ?? invoice.attemptCount + 1,
    });

    const result: PayInvoiceResult = {
      invoice: this.mapInvoiceResponse(updatedInvoice),
    };

    // If payment requires confirmation, return client secret
    const paymentIntent = stripeInvoice.payment_intent as Stripe.PaymentIntent | null;
    if (paymentIntent?.status === 'requires_action') {
      result.paymentIntent = {
        clientSecret: paymentIntent.client_secret!,
        status: paymentIntent.status,
      };
    }

    return result;
  }

  // ===========================================================================
  // SYNC FROM STRIPE
  // ===========================================================================

  /**
   * Create or update invoice from Stripe event
   */
  async syncFromStripe(stripeInvoice: Stripe.Invoice): Promise<void> {
    if (!stripeInvoice.subscription) {
      // Skip non-subscription invoices
      return;
    }

    const subscriptionId =
      typeof stripeInvoice.subscription === 'string'
        ? stripeInvoice.subscription
        : stripeInvoice.subscription.id;

    const subscription = await this.subscriptionRepository.findByStripeId(subscriptionId);

    if (!subscription) {
      console.warn(`Subscription not found for invoice: ${stripeInvoice.id}`);
      return;
    }

    const existingInvoice = await this.invoiceRepository.findByStripeId(stripeInvoice.id);

    const invoiceData = {
      status: this.mapStripeInvoiceStatus(stripeInvoice.status),
      number: stripeInvoice.number ?? undefined,
      subtotal: stripeInvoice.subtotal,
      tax: stripeInvoice.tax ?? 0,
      total: stripeInvoice.total,
      amountDue: stripeInvoice.amount_due,
      amountPaid: stripeInvoice.amount_paid,
      amountRemaining: stripeInvoice.amount_remaining,
      currency: stripeInvoice.currency,
      periodStart: new Date(stripeInvoice.period_start * 1000),
      periodEnd: new Date(stripeInvoice.period_end * 1000),
      dueDate: stripeInvoice.due_date ? new Date(stripeInvoice.due_date * 1000) : undefined,
      hostedInvoiceUrl: stripeInvoice.hosted_invoice_url ?? undefined,
      pdfUrl: stripeInvoice.invoice_pdf ?? undefined,
      attemptCount: stripeInvoice.attempt_count ?? 0,
      nextPaymentAttempt: stripeInvoice.next_payment_attempt
        ? new Date(stripeInvoice.next_payment_attempt * 1000)
        : undefined,
      paidAt:
        stripeInvoice.status === 'paid' && stripeInvoice.status_transitions?.paid_at
          ? new Date(stripeInvoice.status_transitions.paid_at * 1000)
          : undefined,
      lineItems: this.extractLineItems(stripeInvoice) as unknown as Prisma.InputJsonValue,
    };

    if (existingInvoice) {
      await this.invoiceRepository.update(existingInvoice.id, invoiceData);
    } else {
      await this.invoiceRepository.create({
        subscriptionId: subscription.id,
        stripeInvoiceId: stripeInvoice.id,
        ...invoiceData,
      });
    }

    // Note: latestInvoiceId tracking would require schema update
    // The subscription already has a relation to invoices via subscriptionInvoices
  }

  // ===========================================================================
  // UPCOMING INVOICE
  // ===========================================================================

  /**
   * Get upcoming invoice preview
   */
  async getUpcomingInvoice(
    subscriptionId: string,
    userId: string
  ): Promise<InvoiceResponse | null> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);

    if (!subscription) {
      throw new BillingError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404);
    }

    if (subscription.userId !== userId) {
      throw new BillingError('Unauthorized', 'UNAUTHORIZED', 403);
    }

    try {
      const upcoming = await this.stripeService.getUpcomingInvoice({
        customer: subscription.stripeCustomerId,
        subscription: subscription.stripeSubscriptionId,
      });

      return {
        id: 'upcoming',
        subscriptionId: subscription.id,
        stripeInvoiceId: 'upcoming',
        number: null,
        status: 'DRAFT',
        subtotal: upcoming.subtotal,
        tax: upcoming.tax ?? 0,
        total: upcoming.total,
        amountDue: upcoming.amount_due,
        amountPaid: 0,
        amountRemaining: upcoming.amount_due,
        currency: upcoming.currency,
        periodStart: new Date(upcoming.period_start * 1000).toISOString(),
        periodEnd: new Date(upcoming.period_end * 1000).toISOString(),
        dueDate: null,
        paidAt: null,
        hostedInvoiceUrl: null,
        pdfUrl: null,
        lineItems: this.extractLineItems(upcoming),
        attemptCount: 0,
        nextPaymentAttempt: null,
        createdAt: new Date().toISOString(),
      };
    } catch {
      // No upcoming invoice (e.g., subscription canceled)
      return null;
    }
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get invoice statistics for a user
   * Note: This is a simplified implementation
   */
  getUserInvoiceStats(_userId: string): {
    totalPaid: number;
    invoiceCount: number;
    pendingAmount: number;
  } {
    // Stub implementation - would need to aggregate from database
    // This requires schema updates or direct SQL queries for proper aggregation
    console.warn('[Invoice Service] getUserInvoiceStats requires implementation');
    return {
      totalPaid: 0,
      invoiceCount: 0,
      pendingAmount: 0,
    };
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Map invoice to response format
   */
  private mapInvoiceResponse(invoice: {
    id: string;
    subscriptionId: string;
    stripeInvoiceId: string;
    number: string | null;
    status: InvoiceStatus;
    subtotal: number;
    tax: number;
    total: number;
    amountDue: number;
    amountPaid: number;
    amountRemaining: number;
    currency: string;
    periodStart: Date;
    periodEnd: Date;
    dueDate: Date | null;
    paidAt: Date | null;
    hostedInvoiceUrl: string | null;
    pdfUrl: string | null;
    lineItems: unknown;
    attemptCount: number;
    nextPaymentAttempt: Date | null;
    createdAt: Date;
  }): InvoiceResponse {
    return {
      id: invoice.id,
      subscriptionId: invoice.subscriptionId,
      stripeInvoiceId: invoice.stripeInvoiceId,
      number: invoice.number,
      status: invoice.status,
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      total: invoice.total,
      amountDue: invoice.amountDue,
      amountPaid: invoice.amountPaid,
      amountRemaining: invoice.amountRemaining,
      currency: invoice.currency,
      periodStart: invoice.periodStart.toISOString(),
      periodEnd: invoice.periodEnd.toISOString(),
      dueDate: invoice.dueDate?.toISOString() ?? null,
      paidAt: invoice.paidAt?.toISOString() ?? null,
      hostedInvoiceUrl: invoice.hostedInvoiceUrl,
      pdfUrl: invoice.pdfUrl,
      lineItems: invoice.lineItems as InvoiceLineItem[],
      attemptCount: invoice.attemptCount,
      nextPaymentAttempt: invoice.nextPaymentAttempt?.toISOString() ?? null,
      createdAt: invoice.createdAt.toISOString(),
    };
  }

  /**
   * Map Stripe invoice status to local status
   */
  private mapStripeInvoiceStatus(status: Stripe.Invoice.Status | null | undefined): InvoiceStatus {
    switch (status) {
      case 'draft':
        return 'DRAFT';
      case 'open':
        return 'OPEN';
      case 'paid':
        return 'PAID';
      case 'void':
        return 'VOID';
      case 'uncollectible':
        return 'UNCOLLECTIBLE';
      default:
        return 'DRAFT';
    }
  }

  /**
   * Extract line items from Stripe invoice
   */
  private extractLineItems(invoice: Stripe.Invoice | Stripe.UpcomingInvoice): InvoiceLineItem[] {
    return invoice.lines.data.map((line) => ({
      id: line.id,
      description: line.description ?? '',
      quantity: line.quantity ?? 1,
      unitAmount: line.unit_amount_excluding_tax
        ? Number.parseInt(line.unit_amount_excluding_tax)
        : line.amount,
      amount: line.amount,
    }));
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let serviceInstance: InvoiceService | null = null;

export function getInvoiceService(): InvoiceService {
  serviceInstance ??= new InvoiceService();
  return serviceInstance;
}

export function initializeInvoiceService(): void {
  serviceInstance = new InvoiceService();
}
