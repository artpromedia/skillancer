/**
 * @module @skillancer/cockpit-svc/repositories/invoice-activity
 * Invoice Activity data access layer
 */

import type { LogActivityParams } from '../types/invoice.types.js';
import type { Prisma, PrismaClient, InvoiceActivity } from '@skillancer/database';

export class InvoiceActivityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Log an activity
   */
  async log(data: LogActivityParams): Promise<InvoiceActivity> {
    return this.prisma.invoiceActivity.create({
      data: {
        invoiceId: data.invoiceId,
        activityType: data.activityType,
        description: data.description,
        actorType: data.actorType,
        actorId: data.actorId ?? null,
        metadata: (data.metadata as Prisma.InputJsonValue) ?? null,
      },
    });
  }

  /**
   * Log invoice created
   */
  async logCreated(invoiceId: string, userId: string): Promise<InvoiceActivity> {
    return this.log({
      invoiceId,
      activityType: 'CREATED',
      description: 'Invoice created',
      actorType: 'freelancer',
      actorId: userId,
    });
  }

  /**
   * Log invoice sent
   */
  async logSent(invoiceId: string, userId: string, recipients: string[]): Promise<InvoiceActivity> {
    return this.log({
      invoiceId,
      activityType: 'SENT',
      description: `Invoice sent to ${recipients.join(', ')}`,
      actorType: 'freelancer',
      actorId: userId,
      metadata: { recipients },
    });
  }

  /**
   * Log invoice viewed
   */
  async logViewed(invoiceId: string, ipAddress?: string): Promise<InvoiceActivity> {
    return this.log({
      invoiceId,
      activityType: 'VIEWED',
      description: 'Invoice viewed by client',
      actorType: 'client',
      metadata: ipAddress ? { ipAddress } : undefined,
    });
  }

  /**
   * Log payment received
   */
  async logPaymentReceived(
    invoiceId: string,
    amount: number,
    method: string,
    isSystem = false
  ): Promise<InvoiceActivity> {
    return this.log({
      invoiceId,
      activityType: 'PAYMENT_RECEIVED',
      description: `Payment of ${amount} received via ${method}`,
      actorType: isSystem ? 'system' : 'client',
      metadata: { amount, method },
    });
  }

  /**
   * Log reminder sent
   */
  async logReminderSent(invoiceId: string, reminderNumber: number): Promise<InvoiceActivity> {
    return this.log({
      invoiceId,
      activityType: 'REMINDER_SENT',
      description: `Reminder #${reminderNumber} sent`,
      actorType: 'system',
      metadata: { reminderNumber },
    });
  }

  /**
   * Log late fee applied
   */
  async logLateFeeApplied(invoiceId: string, amount: number): Promise<InvoiceActivity> {
    return this.log({
      invoiceId,
      activityType: 'LATE_FEE_APPLIED',
      description: `Late fee of ${amount} applied`,
      actorType: 'system',
      metadata: { amount },
    });
  }

  /**
   * Log invoice updated
   */
  async logUpdated(invoiceId: string, userId: string, changes: string[]): Promise<InvoiceActivity> {
    return this.log({
      invoiceId,
      activityType: 'UPDATED',
      description: `Invoice updated: ${changes.join(', ')}`,
      actorType: 'freelancer',
      actorId: userId,
      metadata: { changes },
    });
  }

  /**
   * Log invoice voided
   */
  async logVoided(invoiceId: string, userId: string, reason?: string): Promise<InvoiceActivity> {
    return this.log({
      invoiceId,
      activityType: 'VOIDED',
      description: reason ? `Invoice voided: ${reason}` : 'Invoice voided',
      actorType: 'freelancer',
      actorId: userId,
      metadata: reason ? { reason } : undefined,
    });
  }

  /**
   * Log PDF generated
   */
  async logPdfGenerated(invoiceId: string): Promise<InvoiceActivity> {
    return this.log({
      invoiceId,
      activityType: 'PDF_GENERATED',
      description: 'PDF generated',
      actorType: 'system',
    });
  }

  /**
   * Log status change
   */
  async logStatusChange(
    invoiceId: string,
    fromStatus: string,
    toStatus: string
  ): Promise<InvoiceActivity> {
    return this.log({
      invoiceId,
      activityType: 'STATUS_CHANGED',
      description: `Status changed from ${fromStatus} to ${toStatus}`,
      actorType: 'system',
      metadata: { fromStatus, toStatus },
    });
  }

  /**
   * Find activities for invoice
   */
  async findByInvoiceId(invoiceId: string, limit = 50): Promise<InvoiceActivity[]> {
    return this.prisma.invoiceActivity.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
