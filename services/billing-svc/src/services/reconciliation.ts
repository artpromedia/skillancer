// @ts-nocheck
/**
 * @module @skillancer/billing-svc/services/reconciliation
 * Payment Reconciliation Service
 *
 * Features:
 * - Daily reconciliation between Stripe and database
 * - Discrepancy detection and auto-resolution
 * - Balance verification
 * - Missing webhook detection
 * - Comprehensive reporting
 * - Alert generation for anomalies
 */

import Stripe from 'stripe';
import { prisma } from '@skillancer/database';
import { logger } from '../lib/logger.js';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';

import { getStripe } from './stripe.service.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ReconciliationReport {
  date: string;
  status: 'COMPLETED' | 'COMPLETED_WITH_DISCREPANCIES' | 'FAILED';
  summary: {
    totalTransactions: number;
    matchedTransactions: number;
    discrepancies: number;
    autoResolved: number;
    requiresReview: number;
  };
  stripeBalance: StripeBalance;
  databaseBalance: DatabaseBalance;
  discrepancies: Discrepancy[];
  missingWebhooks: MissingWebhook[];
  executionTimeMs: number;
}

export interface StripeBalance {
  available: BalanceAmount[];
  pending: BalanceAmount[];
  reserved: BalanceAmount[];
}

export interface BalanceAmount {
  amount: number;
  currency: string;
}

export interface DatabaseBalance {
  confirmedRevenue: number;
  pendingPayments: number;
  escrowBalance: number;
  pendingPayouts: number;
  currency: string;
}

export interface Discrepancy {
  id: string;
  type: DiscrepancyType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  stripeData: Record<string, unknown>;
  databaseData: Record<string, unknown>;
  difference: number;
  currency: string;
  autoResolved: boolean;
  resolution?: string;
  requiresReview: boolean;
}

export type DiscrepancyType =
  | 'AMOUNT_MISMATCH'
  | 'STATUS_MISMATCH'
  | 'MISSING_IN_DATABASE'
  | 'MISSING_IN_STRIPE'
  | 'DUPLICATE_PAYMENT'
  | 'ORPHANED_REFUND'
  | 'BALANCE_MISMATCH'
  | 'PAYOUT_MISMATCH';

export interface MissingWebhook {
  eventId: string;
  eventType: string;
  resourceId: string;
  created: Date;
  severity: 'LOW' | 'HIGH';
}

// =============================================================================
// RECONCILIATION SERVICE CLASS
// =============================================================================

export class ReconciliationService {
  private stripe: Stripe;

  constructor() {
    this.stripe = getStripe();
  }

  /**
   * Run daily reconciliation for a specific date
   */
  async runDailyReconciliation(date: Date = subDays(new Date(), 1)): Promise<ReconciliationReport> {
    const startTime = Date.now();
    const dateStr = format(date, 'yyyy-MM-dd');

    logger.info({ date: dateStr }, 'Starting daily reconciliation');

    const report: ReconciliationReport = {
      date: dateStr,
      status: 'COMPLETED',
      summary: {
        totalTransactions: 0,
        matchedTransactions: 0,
        discrepancies: 0,
        autoResolved: 0,
        requiresReview: 0,
      },
      stripeBalance: { available: [], pending: [], reserved: [] },
      databaseBalance: {
        confirmedRevenue: 0,
        pendingPayments: 0,
        escrowBalance: 0,
        pendingPayouts: 0,
        currency: 'USD',
      },
      discrepancies: [],
      missingWebhooks: [],
      executionTimeMs: 0,
    };

    try {
      // 1. Reconcile payments
      const paymentDiscrepancies = await this.reconcilePayments(date);
      report.discrepancies.push(...paymentDiscrepancies);

      // 2. Reconcile refunds
      const refundDiscrepancies = await this.reconcileRefunds(date);
      report.discrepancies.push(...refundDiscrepancies);

      // 3. Reconcile payouts
      const payoutDiscrepancies = await this.reconcilePayouts(date);
      report.discrepancies.push(...payoutDiscrepancies);

      // 4. Check for missing webhooks
      const missingWebhooks = await this.detectMissingWebhooks(date);
      report.missingWebhooks = missingWebhooks;

      // 5. Verify balances
      report.stripeBalance = await this.getStripeBalance();
      report.databaseBalance = await this.getDatabaseBalance();

      // 6. Calculate summary
      const allTransactions = await this.getTransactionCount(date);
      report.summary.totalTransactions = allTransactions;
      report.summary.discrepancies = report.discrepancies.length;
      report.summary.matchedTransactions = allTransactions - report.summary.discrepancies;
      report.summary.autoResolved = report.discrepancies.filter((d) => d.autoResolved).length;
      report.summary.requiresReview = report.discrepancies.filter((d) => d.requiresReview).length;

      // Set status based on results
      if (report.discrepancies.length > 0 || report.missingWebhooks.length > 0) {
        report.status = 'COMPLETED_WITH_DISCREPANCIES';
      }

      // 7. Store reconciliation report
      await this.storeReconciliationReport(report);

      // 8. Alert on critical issues
      await this.alertOnCriticalIssues(report);

      report.executionTimeMs = Date.now() - startTime;

      logger.info(
        {
          date: dateStr,
          status: report.status,
          transactions: report.summary.totalTransactions,
          discrepancies: report.summary.discrepancies,
          executionTimeMs: report.executionTimeMs,
        },
        'Daily reconciliation completed'
      );

      return report;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error({ date: dateStr, error: errorMessage }, 'Reconciliation failed');

      report.status = 'FAILED';
      report.executionTimeMs = Date.now() - startTime;

      await this.alertOnReconciliationFailure(dateStr, errorMessage);

      return report;
    }
  }

  /**
   * Reconcile payments between Stripe and database
   */
  private async reconcilePayments(date: Date): Promise<Discrepancy[]> {
    const discrepancies: Discrepancy[] = [];

    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    // Get Stripe PaymentIntents for the day
    const stripePayments = await this.fetchStripePaymentIntents(dayStart, dayEnd);

    // Get database payments for the day
    const dbPayments = await prisma.payment.findMany({
      where: {
        createdAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });

    // Create lookup maps
    const stripeMap = new Map(stripePayments.map((pi) => [pi.id, pi]));
    const dbMap = new Map(
      dbPayments.filter((p) => p.stripePaymentIntentId).map((p) => [p.stripePaymentIntentId, p])
    );

    // Check for payments in Stripe but missing/mismatched in database
    for (const [stripeId, stripePi] of stripeMap) {
      const dbPayment = dbMap.get(stripeId);

      if (!dbPayment) {
        // Missing in database
        const discrepancy = await this.handleMissingInDatabase(stripePi);
        discrepancies.push(discrepancy);
        continue;
      }

      // Check for amount mismatch
      if (dbPayment.amount !== stripePi.amount) {
        discrepancies.push({
          id: `amt_${stripeId}`,
          type: 'AMOUNT_MISMATCH',
          severity: 'HIGH',
          stripeData: {
            paymentIntentId: stripeId,
            amount: stripePi.amount,
            currency: stripePi.currency,
          },
          databaseData: {
            paymentId: dbPayment.id,
            amount: dbPayment.amount,
            currency: dbPayment.currency,
          },
          difference: Math.abs(stripePi.amount - dbPayment.amount),
          currency: stripePi.currency,
          autoResolved: false,
          requiresReview: true,
        });
      }

      // Check for status mismatch
      const expectedDbStatus = this.mapStripeToDbStatus(stripePi.status);
      if (dbPayment.status !== expectedDbStatus) {
        const resolved = await this.tryAutoResolveStatusMismatch(dbPayment, stripePi);
        discrepancies.push({
          id: `status_${stripeId}`,
          type: 'STATUS_MISMATCH',
          severity: 'MEDIUM',
          stripeData: {
            paymentIntentId: stripeId,
            status: stripePi.status,
          },
          databaseData: {
            paymentId: dbPayment.id,
            status: dbPayment.status,
          },
          difference: 0,
          currency: stripePi.currency,
          autoResolved: resolved,
          resolution: resolved ? 'Status synchronized from Stripe' : undefined,
          requiresReview: !resolved,
        });
      }
    }

    // Check for payments in database but not in Stripe
    for (const [stripeId, dbPayment] of dbMap) {
      if (!stripeMap.has(stripeId)) {
        discrepancies.push({
          id: `missing_stripe_${dbPayment.id}`,
          type: 'MISSING_IN_STRIPE',
          severity: 'CRITICAL',
          stripeData: {},
          databaseData: {
            paymentId: dbPayment.id,
            stripePaymentIntentId: stripeId,
            amount: dbPayment.amount,
          },
          difference: dbPayment.amount,
          currency: dbPayment.currency,
          autoResolved: false,
          requiresReview: true,
        });
      }
    }

    return discrepancies;
  }

  /**
   * Reconcile refunds between Stripe and database
   */
  private async reconcileRefunds(date: Date): Promise<Discrepancy[]> {
    const discrepancies: Discrepancy[] = [];

    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    // Get Stripe refunds for the day
    const stripeRefunds = await this.fetchStripeRefunds(dayStart, dayEnd);

    // Get database refunds for the day
    const dbRefunds = await prisma.refund.findMany({
      where: {
        createdAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });

    const stripeMap = new Map(stripeRefunds.map((r) => [r.id, r]));
    const dbMap = new Map(dbRefunds.map((r) => [r.stripeRefundId, r]));

    // Check for refunds in Stripe but missing in database
    for (const [stripeId, stripeRefund] of stripeMap) {
      if (!dbMap.has(stripeId)) {
        // Orphaned refund - create record
        const resolved = await this.tryCreateMissingRefund(stripeRefund);
        discrepancies.push({
          id: `orphan_refund_${stripeId}`,
          type: 'ORPHANED_REFUND',
          severity: 'HIGH',
          stripeData: {
            refundId: stripeId,
            amount: stripeRefund.amount,
            paymentIntentId: stripeRefund.payment_intent,
          },
          databaseData: {},
          difference: stripeRefund.amount || 0,
          currency: stripeRefund.currency,
          autoResolved: resolved,
          resolution: resolved ? 'Refund record created' : undefined,
          requiresReview: !resolved,
        });
      }
    }

    return discrepancies;
  }

  /**
   * Reconcile payouts between Stripe and database
   */
  private async reconcilePayouts(date: Date): Promise<Discrepancy[]> {
    const discrepancies: Discrepancy[] = [];

    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    // Get Stripe payouts for the day
    const stripePayouts = await this.fetchStripePayouts(dayStart, dayEnd);

    // Get database payouts for the day
    const dbPayouts = await prisma.payout.findMany({
      where: {
        createdAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });

    const stripeMap = new Map(stripePayouts.map((p) => [p.id, p]));
    const dbMap = new Map(dbPayouts.map((p) => [p.stripePayoutId, p]));

    for (const [stripeId, stripePayout] of stripeMap) {
      const dbPayout = dbMap.get(stripeId);

      if (!dbPayout) {
        discrepancies.push({
          id: `missing_payout_${stripeId}`,
          type: 'PAYOUT_MISMATCH',
          severity: 'HIGH',
          stripeData: {
            payoutId: stripeId,
            amount: stripePayout.amount,
            status: stripePayout.status,
          },
          databaseData: {},
          difference: stripePayout.amount,
          currency: stripePayout.currency,
          autoResolved: false,
          requiresReview: true,
        });
        continue;
      }

      // Check status mismatch
      const stripeStatus = stripePayout.status;
      const dbStatus = dbPayout.status.toLowerCase();

      if (stripeStatus !== dbStatus && stripeStatus !== 'in_transit') {
        discrepancies.push({
          id: `payout_status_${stripeId}`,
          type: 'PAYOUT_MISMATCH',
          severity: 'MEDIUM',
          stripeData: { payoutId: stripeId, status: stripeStatus },
          databaseData: { payoutId: dbPayout.id, status: dbStatus },
          difference: 0,
          currency: stripePayout.currency,
          autoResolved: false,
          requiresReview: true,
        });
      }
    }

    return discrepancies;
  }

  /**
   * Detect webhooks that may have been missed
   */
  private async detectMissingWebhooks(date: Date): Promise<MissingWebhook[]> {
    const missing: MissingWebhook[] = [];

    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    // Get Stripe events for the day
    const events = await this.fetchStripeEvents(dayStart, dayEnd);

    // Get processed webhook event IDs
    const processedEvents = await prisma.webhookEvent.findMany({
      where: {
        createdAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      select: { stripeEventId: true },
    });

    const processedIds = new Set(processedEvents.map((e) => e.stripeEventId));

    // Find events that weren't processed
    for (const event of events) {
      if (!processedIds.has(event.id)) {
        // Check if this is a critical event type
        const criticalTypes = [
          'payment_intent.succeeded',
          'payment_intent.payment_failed',
          'charge.dispute.created',
          'charge.refunded',
          'account.updated',
          'payout.paid',
        ];

        missing.push({
          eventId: event.id,
          eventType: event.type,
          resourceId: (event.data.object as Record<string, string>).id || '',
          created: new Date(event.created * 1000),
          severity: criticalTypes.includes(event.type) ? 'HIGH' : 'LOW',
        });
      }
    }

    if (missing.length > 0) {
      logger.warn(
        { count: missing.length, date: format(date, 'yyyy-MM-dd') },
        'Missing webhooks detected'
      );
    }

    return missing;
  }

  // ==========================================================================
  // STRIPE DATA FETCHING
  // ==========================================================================

  private async fetchStripePaymentIntents(start: Date, end: Date): Promise<Stripe.PaymentIntent[]> {
    const paymentIntents: Stripe.PaymentIntent[] = [];
    let startingAfter: string | undefined;

    do {
      const response = await this.stripe.paymentIntents.list({
        created: {
          gte: Math.floor(start.getTime() / 1000),
          lte: Math.floor(end.getTime() / 1000),
        },
        limit: 100,
        starting_after: startingAfter,
      });

      paymentIntents.push(...response.data);
      startingAfter = response.has_more ? response.data[response.data.length - 1].id : undefined;
    } while (startingAfter);

    return paymentIntents;
  }

  private async fetchStripeRefunds(start: Date, end: Date): Promise<Stripe.Refund[]> {
    const refunds: Stripe.Refund[] = [];
    let startingAfter: string | undefined;

    do {
      const response = await this.stripe.refunds.list({
        created: {
          gte: Math.floor(start.getTime() / 1000),
          lte: Math.floor(end.getTime() / 1000),
        },
        limit: 100,
        starting_after: startingAfter,
      });

      refunds.push(...response.data);
      startingAfter = response.has_more ? response.data[response.data.length - 1].id : undefined;
    } while (startingAfter);

    return refunds;
  }

  private async fetchStripePayouts(start: Date, end: Date): Promise<Stripe.Payout[]> {
    const payouts: Stripe.Payout[] = [];
    let startingAfter: string | undefined;

    do {
      const response = await this.stripe.payouts.list({
        created: {
          gte: Math.floor(start.getTime() / 1000),
          lte: Math.floor(end.getTime() / 1000),
        },
        limit: 100,
        starting_after: startingAfter,
      });

      payouts.push(...response.data);
      startingAfter = response.has_more ? response.data[response.data.length - 1].id : undefined;
    } while (startingAfter);

    return payouts;
  }

  private async fetchStripeEvents(start: Date, end: Date): Promise<Stripe.Event[]> {
    const events: Stripe.Event[] = [];
    let startingAfter: string | undefined;

    do {
      const response = await this.stripe.events.list({
        created: {
          gte: Math.floor(start.getTime() / 1000),
          lte: Math.floor(end.getTime() / 1000),
        },
        limit: 100,
        starting_after: startingAfter,
      });

      events.push(...response.data);
      startingAfter = response.has_more ? response.data[response.data.length - 1].id : undefined;
    } while (startingAfter);

    return events;
  }

  // ==========================================================================
  // BALANCE VERIFICATION
  // ==========================================================================

  private async getStripeBalance(): Promise<StripeBalance> {
    const balance = await this.stripe.balance.retrieve();

    return {
      available: balance.available.map((b) => ({ amount: b.amount, currency: b.currency })),
      pending: balance.pending.map((b) => ({ amount: b.amount, currency: b.currency })),
      reserved: (balance.connect_reserved || []).map((b) => ({
        amount: b.amount,
        currency: b.currency,
      })),
    };
  }

  private async getDatabaseBalance(): Promise<DatabaseBalance> {
    // Get confirmed revenue (successful payments minus refunds)
    const confirmedPayments = await prisma.payment.aggregate({
      where: { status: 'SUCCEEDED' },
      _sum: { amount: true },
    });

    const totalRefunds = await prisma.refund.aggregate({
      where: { status: 'SUCCEEDED' },
      _sum: { amount: true },
    });

    // Get pending payments
    const pendingPayments = await prisma.payment.aggregate({
      where: { status: { in: ['PENDING', 'PROCESSING', 'REQUIRES_ACTION'] } },
      _sum: { amount: true },
    });

    // Get escrow balance
    const escrowBalance = await prisma.escrow.aggregate({
      where: { status: 'HELD' },
      _sum: { amount: true },
    });

    // Get pending payouts
    const pendingPayouts = await prisma.payout.aggregate({
      where: { status: 'PENDING' },
      _sum: { amount: true },
    });

    return {
      confirmedRevenue: (confirmedPayments._sum.amount || 0) - (totalRefunds._sum.amount || 0),
      pendingPayments: pendingPayments._sum.amount || 0,
      escrowBalance: escrowBalance._sum.amount || 0,
      pendingPayouts: pendingPayouts._sum.amount || 0,
      currency: 'USD',
    };
  }

  // ==========================================================================
  // AUTO-RESOLUTION
  // ==========================================================================

  private async handleMissingInDatabase(stripePi: Stripe.PaymentIntent): Promise<Discrepancy> {
    // Try to create the missing payment record
    const metadata = stripePi.metadata || {};
    const idempotencyKey = metadata.idempotencyKey || `recovered_${stripePi.id}`;

    try {
      await prisma.payment.create({
        data: {
          stripePaymentIntentId: stripePi.id,
          stripeCustomerId:
            typeof stripePi.customer === 'string'
              ? stripePi.customer
              : stripePi.customer?.id || 'unknown',
          amount: stripePi.amount,
          currency: stripePi.currency.toUpperCase(),
          status: this.mapStripeToDbStatus(stripePi.status),
          idempotencyKey,
          paidAt: stripePi.status === 'succeeded' ? new Date(stripePi.created * 1000) : null,
          metadata: stripePi.metadata as Record<string, unknown>,
        },
      });

      logger.info({ stripePaymentIntentId: stripePi.id }, 'Auto-created missing payment record');

      return {
        id: `missing_db_${stripePi.id}`,
        type: 'MISSING_IN_DATABASE',
        severity: 'HIGH',
        stripeData: {
          paymentIntentId: stripePi.id,
          amount: stripePi.amount,
          status: stripePi.status,
        },
        databaseData: {},
        difference: stripePi.amount,
        currency: stripePi.currency,
        autoResolved: true,
        resolution: 'Payment record created from Stripe data',
        requiresReview: false,
      };
    } catch (error) {
      return {
        id: `missing_db_${stripePi.id}`,
        type: 'MISSING_IN_DATABASE',
        severity: 'CRITICAL',
        stripeData: {
          paymentIntentId: stripePi.id,
          amount: stripePi.amount,
          status: stripePi.status,
        },
        databaseData: {},
        difference: stripePi.amount,
        currency: stripePi.currency,
        autoResolved: false,
        requiresReview: true,
      };
    }
  }

  private async tryAutoResolveStatusMismatch(
    dbPayment: { id: string; status: string },
    stripePi: Stripe.PaymentIntent
  ): Promise<boolean> {
    try {
      const expectedStatus = this.mapStripeToDbStatus(stripePi.status);

      await prisma.payment.update({
        where: { id: dbPayment.id },
        data: {
          status: expectedStatus,
          ...(expectedStatus === 'SUCCEEDED' ? { paidAt: new Date() } : {}),
        },
      });

      logger.info(
        {
          paymentId: dbPayment.id,
          oldStatus: dbPayment.status,
          newStatus: expectedStatus,
        },
        'Auto-resolved status mismatch'
      );

      return true;
    } catch {
      return false;
    }
  }

  private async tryCreateMissingRefund(stripeRefund: Stripe.Refund): Promise<boolean> {
    try {
      // Find the associated payment
      const paymentIntentId =
        typeof stripeRefund.payment_intent === 'string'
          ? stripeRefund.payment_intent
          : stripeRefund.payment_intent?.id;

      if (!paymentIntentId) {
        return false;
      }

      const payment = await prisma.payment.findFirst({
        where: { stripePaymentIntentId: paymentIntentId },
      });

      if (!payment) {
        return false;
      }

      await prisma.refund.create({
        data: {
          stripeRefundId: stripeRefund.id,
          paymentId: payment.id,
          amount: stripeRefund.amount || 0,
          currency: stripeRefund.currency.toUpperCase(),
          status: stripeRefund.status === 'succeeded' ? 'SUCCEEDED' : 'PENDING',
          reason: stripeRefund.reason as string | null,
        },
      });

      logger.info({ stripeRefundId: stripeRefund.id }, 'Auto-created missing refund record');
      return true;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private mapStripeToDbStatus(stripeStatus: Stripe.PaymentIntent.Status): string {
    const statusMap: Record<string, string> = {
      requires_payment_method: 'PENDING',
      requires_confirmation: 'PENDING',
      requires_action: 'REQUIRES_ACTION',
      processing: 'PROCESSING',
      requires_capture: 'PROCESSING',
      canceled: 'CANCELED',
      succeeded: 'SUCCEEDED',
    };

    return statusMap[stripeStatus] || 'PENDING';
  }

  private async getTransactionCount(date: Date): Promise<number> {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    const count = await prisma.payment.count({
      where: {
        createdAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });

    return count;
  }

  private async storeReconciliationReport(report: ReconciliationReport): Promise<void> {
    await prisma.reconciliationReport.create({
      data: {
        date: new Date(report.date),
        status: report.status,
        totalTransactions: report.summary.totalTransactions,
        matchedTransactions: report.summary.matchedTransactions,
        discrepancyCount: report.summary.discrepancies,
        autoResolvedCount: report.summary.autoResolved,
        requiresReviewCount: report.summary.requiresReview,
        stripeBalanceData: report.stripeBalance as unknown as Record<string, unknown>,
        databaseBalanceData: report.databaseBalance as unknown as Record<string, unknown>,
        discrepancies: report.discrepancies as unknown as Record<string, unknown>[],
        missingWebhooks: report.missingWebhooks as unknown as Record<string, unknown>[],
        executionTimeMs: report.executionTimeMs,
      },
    });
  }

  private async alertOnCriticalIssues(report: ReconciliationReport): Promise<void> {
    const criticalDiscrepancies = report.discrepancies.filter((d) => d.severity === 'CRITICAL');
    const highSeverityMissingWebhooks = report.missingWebhooks.filter((w) => w.severity === 'HIGH');

    if (criticalDiscrepancies.length > 0 || highSeverityMissingWebhooks.length > 0) {
      logger.error(
        {
          criticalDiscrepancies: criticalDiscrepancies.length,
          highSeverityMissingWebhooks: highSeverityMissingWebhooks.length,
          date: report.date,
        },
        'CRITICAL: Reconciliation issues detected'
      );

      // TODO: Integrate with alerting service
      // await alertingService.sendAlert({
      //   severity: 'CRITICAL',
      //   title: 'Payment Reconciliation Issues Detected',
      //   details: {
      //     date: report.date,
      //     criticalDiscrepancies,
      //     missingWebhooks: highSeverityMissingWebhooks,
      //   },
      // });
    }
  }

  private async alertOnReconciliationFailure(date: string, error: string): Promise<void> {
    logger.error({ date, error }, 'CRITICAL: Reconciliation job failed');

    // TODO: Integrate with alerting service
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let reconciliationService: ReconciliationService | null = null;

export function getReconciliationService(): ReconciliationService {
  if (!reconciliationService) {
    reconciliationService = new ReconciliationService();
  }
  return reconciliationService;
}

// =============================================================================
// CRON JOB: Daily Reconciliation (4 AM UTC)
// =============================================================================

export async function runScheduledReconciliation(): Promise<void> {
  const service = getReconciliationService();

  // Reconcile yesterday's transactions
  const yesterday = subDays(new Date(), 1);
  await service.runDailyReconciliation(yesterday);
}
