/**
 * @module @skillancer/cockpit-svc/repositories/invoice-payment
 * Invoice Payment data access layer
 */

import type { RecordPaymentParams } from '../types/invoice.types.js';
import type { InvoicePayment, InvoicePaymentStatus } from '../types/prisma-shim.js';
import type { Prisma, PrismaClient } from '../types/prisma-shim.js';

export class InvoicePaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a payment record
   */
  async create(data: RecordPaymentParams): Promise<InvoicePayment> {
    return this.prisma.invoicePayment.create({
      data: {
        invoiceId: data.invoiceId,
        amount: data.amount,
        paymentDate: data.paymentDate,
        paymentMethod: data.paymentMethod,
        transactionId: data.transactionId ?? null,
        notes: data.notes ?? null,
        status: 'COMPLETED',
      },
    });
  }

  /**
   * Create a pending payment
   */
  async createPending(
    invoiceId: string,
    amount: number,
    paymentMethod: 'STRIPE' | 'PAYPAL',
    transactionId?: string
  ): Promise<InvoicePayment> {
    return this.prisma.invoicePayment.create({
      data: {
        invoiceId,
        amount,
        paymentDate: new Date(),
        paymentMethod,
        transactionId: transactionId ?? null,
        status: 'PENDING',
      },
    });
  }

  /**
   * Find payment by ID
   */
  async findById(id: string): Promise<InvoicePayment | null> {
    return this.prisma.invoicePayment.findUnique({
      where: { id },
    });
  }

  /**
   * Find payment by transaction ID
   */
  async findByTransactionId(transactionId: string): Promise<InvoicePayment | null> {
    return this.prisma.invoicePayment.findFirst({
      where: { transactionId },
    });
  }

  /**
   * Find payments for invoice
   */
  async findByInvoiceId(invoiceId: string): Promise<InvoicePayment[]> {
    return this.prisma.invoicePayment.findMany({
      where: { invoiceId },
      orderBy: { paymentDate: 'desc' },
    });
  }

  /**
   * Find completed payments for invoice
   */
  async findCompletedByInvoiceId(invoiceId: string): Promise<InvoicePayment[]> {
    return this.prisma.invoicePayment.findMany({
      where: {
        invoiceId,
        status: 'COMPLETED',
      },
      orderBy: { paymentDate: 'desc' },
    });
  }

  /**
   * Update payment status
   */
  async updateStatus(id: string, status: InvoicePaymentStatus): Promise<InvoicePayment> {
    const data: Prisma.InvoicePaymentUpdateInput = { status };

    if (status === 'COMPLETED') {
      data.paymentDate = new Date();
    }

    return this.prisma.invoicePayment.update({
      where: { id },
      data,
    });
  }

  /**
   * Update Stripe payment intent
   */
  async updateStripePaymentIntent(
    id: string,
    stripePaymentId: string,
    status: InvoicePaymentStatus
  ): Promise<InvoicePayment> {
    return this.prisma.invoicePayment.update({
      where: { id },
      data: {
        stripePaymentId,
        status,
        ...(status === 'COMPLETED' ? { paymentDate: new Date() } : {}),
      },
    });
  }

  /**
   * Update PayPal transaction
   */
  async updatePayPalTransaction(
    id: string,
    paypalTransactionId: string,
    status: InvoicePaymentStatus
  ): Promise<InvoicePayment> {
    return this.prisma.invoicePayment.update({
      where: { id },
      data: {
        paypalTransactionId,
        status,
        ...(status === 'COMPLETED' ? { paymentDate: new Date() } : {}),
      },
    });
  }

  /**
   * Get total paid for invoice
   */
  async getTotalPaid(invoiceId: string): Promise<number> {
    const result = await this.prisma.invoicePayment.aggregate({
      where: {
        invoiceId,
        status: 'COMPLETED',
      },
      _sum: { amount: true },
    });

    return Number(result._sum.amount ?? 0);
  }

  /**
   * Find pending payments by Stripe intent
   */
  async findByStripePaymentIntent(paymentIntentId: string): Promise<InvoicePayment | null> {
    return this.prisma.invoicePayment.findFirst({
      where: { stripePaymentId: paymentIntentId },
    });
  }

  /**
   * Find pending payments by PayPal transaction
   */
  async findByPayPalTransaction(transactionId: string): Promise<InvoicePayment | null> {
    return this.prisma.invoicePayment.findFirst({
      where: { paypalTransactionId: transactionId },
    });
  }

  /**
   * Delete payment
   */
  async delete(id: string): Promise<void> {
    await this.prisma.invoicePayment.delete({
      where: { id },
    });
  }
}
