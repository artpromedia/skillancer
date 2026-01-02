// @ts-nocheck
/**
 * Advance Manager
 * Track and manage active invoice advances
 * Sprint M6: Invoice Financing & Advanced Tax Tools
 */

import { createLogger } from '@skillancer/logger';

const logger = createLogger({ serviceName: 'advance-manager' });

// ============================================================================
// TYPES
// ============================================================================

export interface Advance {
  id: string;
  invoiceId: string;
  freelancerId: string;
  clientId: string;
  originalInvoiceAmount: number;
  advanceAmount: number;
  feeAmount: number;
  totalOwed: number;
  advancePercent: number;
  feeRate: number;
  status: AdvanceStatus;
  amountRepaid: number;
  fundedAt?: Date;
  repaidAt?: Date;
  expectedRepaymentDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type AdvanceStatus =
  | 'pending'
  | 'funded'
  | 'partially_repaid'
  | 'repaid'
  | 'overdue'
  | 'defaulted'
  | 'canceled';

export interface CreateAdvanceParams {
  invoiceId: string;
  freelancerId: string;
  clientId: string;
  originalInvoiceAmount: number;
  advanceAmount: number;
  feeAmount: number;
  totalOwed: number;
  advancePercent: number;
  feeRate: number;
  expectedRepaymentDate: Date;
}

export interface Repayment {
  id: string;
  advanceId: string;
  amount: number;
  source: 'client_payment' | 'manual' | 'collection';
  paymentId?: string;
  createdAt: Date;
}

export interface CollectionAction {
  id: string;
  advanceId: string;
  type: 'reminder' | 'warning' | 'recourse' | 'payment_plan';
  status: 'pending' | 'sent' | 'acknowledged';
  scheduledAt: Date;
  sentAt?: Date;
  content: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const GRACE_PERIOD_DAYS = 7;
const REMINDER_SCHEDULE_DAYS = [1, 3, 7, 14];
const DEFAULT_THRESHOLD_DAYS = 30;

// ============================================================================
// ADVANCE MANAGER SERVICE
// ============================================================================

class AdvanceManager {
  // --------------------------------------------------------------------------
  // ADVANCE LIFECYCLE
  // --------------------------------------------------------------------------

  async createAdvance(params: CreateAdvanceParams): Promise<Advance> {
    logger.info('Creating advance', {
      invoiceId: params.invoiceId,
      freelancerId: params.freelancerId,
      amount: params.advanceAmount,
    });

    const advance: Advance = {
      id: `ADV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...params,
      status: 'pending',
      amountRepaid: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // In production, save to database
    await this.saveAdvance(advance);

    metrics.increment('advance.created');

    return advance;
  }

  async markAsFunded(advanceId: string): Promise<Advance> {
    logger.info('Marking advance as funded', { advanceId });

    const advance = await this.getAdvance(advanceId);
    if (!advance) throw new Error('Advance not found');

    advance.status = 'funded';
    advance.fundedAt = new Date();
    advance.updatedAt = new Date();

    await this.saveAdvance(advance);
    await this.scheduleRepaymentReminders(advance);

    metrics.increment('advance.funded');

    return advance;
  }

  async markAsRepaid(advanceId: string): Promise<Advance> {
    logger.info('Marking advance as repaid', { advanceId });

    const advance = await this.getAdvance(advanceId);
    if (!advance) throw new Error('Advance not found');

    advance.status = 'repaid';
    advance.repaidAt = new Date();
    advance.updatedAt = new Date();

    await this.saveAdvance(advance);
    await this.cancelPendingReminders(advanceId);

    metrics.increment('advance.repaid');

    return advance;
  }

  async cancelAdvance(advanceId: string, reason: string): Promise<Advance> {
    logger.info('Canceling advance', { advanceId, reason });

    const advance = await this.getAdvance(advanceId);
    if (!advance) throw new Error('Advance not found');

    if (advance.status !== 'pending') {
      throw new Error('Can only cancel pending advances');
    }

    advance.status = 'canceled';
    advance.updatedAt = new Date();

    await this.saveAdvance(advance);

    metrics.increment('advance.canceled');

    return advance;
  }

  // --------------------------------------------------------------------------
  // REPAYMENT
  // --------------------------------------------------------------------------

  async recordRepayment(
    advanceId: string,
    amount: number,
    source = 'client_payment'
  ): Promise<Repayment> {
    logger.info('Recording repayment', { advanceId, amount, source });

    const advance = await this.getAdvance(advanceId);
    if (!advance) throw new Error('Advance not found');

    const repayment: Repayment = {
      id: `REP-${Date.now()}`,
      advanceId,
      amount,
      source: source as Repayment['source'],
      createdAt: new Date(),
    };

    // Update advance
    advance.amountRepaid += amount;
    advance.updatedAt = new Date();

    if (advance.amountRepaid >= advance.totalOwed) {
      advance.status = 'repaid';
      advance.repaidAt = new Date();
    } else if (advance.amountRepaid > 0) {
      advance.status = 'partially_repaid';
    }

    await this.saveAdvance(advance);
    await this.saveRepayment(repayment);

    metrics.histogram('advance.repayment', amount);

    return repayment;
  }

  async getRepayments(advanceId: string): Promise<Repayment[]> {
    // In production, query database
    return [];
  }

  // --------------------------------------------------------------------------
  // QUERIES
  // --------------------------------------------------------------------------

  async getAdvance(advanceId: string): Promise<Advance | null> {
    // In production, query database
    return null;
  }

  async getAdvanceByInvoice(invoiceId: string): Promise<Advance | null> {
    // In production, query database
    return null;
  }

  async getActiveAdvances(freelancerId: string): Promise<Advance[]> {
    // In production, query database for non-terminal statuses
    return [];
  }

  async getHistory(
    freelancerId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ advances: Advance[]; total: number }> {
    // In production, query database with pagination
    return { advances: [], total: 0 };
  }

  async getOverdueAdvances(): Promise<Advance[]> {
    // In production, query database
    // WHERE status IN ('funded', 'partially_repaid')
    // AND expected_repayment_date < NOW() - INTERVAL '7 days'
    return [];
  }

  // --------------------------------------------------------------------------
  // COLLECTIONS
  // --------------------------------------------------------------------------

  async checkOverdue(): Promise<void> {
    logger.info('Checking for overdue advances');

    const overdueAdvances = await this.getOverdueAdvances();

    for (const advance of overdueAdvances) {
      const daysOverdue = this.getDaysOverdue(advance);

      if (daysOverdue > DEFAULT_THRESHOLD_DAYS && advance.status !== 'defaulted') {
        await this.markAsDefaulted(advance.id);
      } else if (advance.status !== 'overdue') {
        await this.markAsOverdue(advance.id);
      }
    }

    metrics.gauge('advance.overdue.count', overdueAdvances.length);
  }

  private async markAsOverdue(advanceId: string): Promise<void> {
    const advance = await this.getAdvance(advanceId);
    if (!advance) return;

    advance.status = 'overdue';
    advance.updatedAt = new Date();

    await this.saveAdvance(advance);
    await this.sendOverdueNotification(advance);

    metrics.increment('advance.overdue');
  }

  private async markAsDefaulted(advanceId: string): Promise<void> {
    logger.warn('Marking advance as defaulted', { advanceId });

    const advance = await this.getAdvance(advanceId);
    if (!advance) return;

    advance.status = 'defaulted';
    advance.updatedAt = new Date();

    await this.saveAdvance(advance);
    await this.initiateRecourse(advance);

    metrics.increment('advance.defaulted');
  }

  private async initiateRecourse(advance: Advance): Promise<void> {
    logger.info('Initiating recourse', { advanceId: advance.id });

    // Options:
    // 1. Deduct from future earnings
    // 2. Set up payment plan
    // 3. External collections
  }

  async createPaymentPlan(
    advanceId: string,
    installments: number
  ): Promise<{ planId: string; installmentAmount: number; schedule: Date[] }> {
    const advance = await this.getAdvance(advanceId);
    if (!advance) throw new Error('Advance not found');

    const remainingOwed = advance.totalOwed - advance.amountRepaid;
    const installmentAmount = Math.ceil(remainingOwed / installments);

    const schedule: Date[] = [];
    const today = new Date();
    for (let i = 1; i <= installments; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i * 14); // Bi-weekly
      schedule.push(date);
    }

    logger.info('Created payment plan', { advanceId, installments, installmentAmount });

    return {
      planId: `PP-${Date.now()}`,
      installmentAmount,
      schedule,
    };
  }

  // --------------------------------------------------------------------------
  // NOTIFICATIONS
  // --------------------------------------------------------------------------

  private async scheduleRepaymentReminders(advance: Advance): Promise<void> {
    // Schedule reminders at 7 days, 3 days, 1 day before due
    const dueDate = new Date(advance.expectedRepaymentDate);

    for (const daysBefore of [7, 3, 1]) {
      const reminderDate = new Date(dueDate);
      reminderDate.setDate(reminderDate.getDate() - daysBefore);

      if (reminderDate > new Date()) {
        await this.scheduleReminder(advance.id, reminderDate, 'upcoming');
      }
    }
  }

  private async scheduleReminder(advanceId: string, date: Date, type: string): Promise<void> {
    // In production, schedule via job queue
    logger.info('Scheduled reminder', { advanceId, date, type });
  }

  private async cancelPendingReminders(advanceId: string): Promise<void> {
    // In production, cancel scheduled jobs
    logger.info('Canceled pending reminders', { advanceId });
  }

  private async sendOverdueNotification(advance: Advance): Promise<void> {
    logger.info('Sending overdue notification', { advanceId: advance.id });
    // In production, send email/push notification
  }

  // --------------------------------------------------------------------------
  // ANALYTICS
  // --------------------------------------------------------------------------

  async getStats(freelancerId: string): Promise<{
    totalAdvances: number;
    totalAdvanceAmount: number;
    totalFeesPaid: number;
    averageRepaymentDays: number;
    onTimeRepaymentRate: number;
  }> {
    // In production, aggregate from database
    return {
      totalAdvances: 5,
      totalAdvanceAmount: 12500,
      totalFeesPaid: 375,
      averageRepaymentDays: 18,
      onTimeRepaymentRate: 100,
    };
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

  private getDaysOverdue(advance: Advance): number {
    const now = new Date();
    const dueDate = new Date(advance.expectedRepaymentDate);
    const gracePeriodEnd = new Date(dueDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + GRACE_PERIOD_DAYS);

    if (now <= gracePeriodEnd) return 0;

    return Math.floor((now.getTime() - gracePeriodEnd.getTime()) / (1000 * 60 * 60 * 24));
  }

  private async saveAdvance(advance: Advance): Promise<void> {
    // In production, save to database
  }

  private async saveRepayment(repayment: Repayment): Promise<void> {
    // In production, save to database
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let advanceManager: AdvanceManager | null = null;

export function getAdvanceManager(): AdvanceManager {
  if (!advanceManager) {
    advanceManager = new AdvanceManager();
  }
  return advanceManager;
}

