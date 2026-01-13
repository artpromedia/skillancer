/**
 * @module @skillancer/billing-svc/services/payment-metrics
 * Payment Metrics Service
 *
 * Prometheus metrics for payment monitoring:
 * - Transaction volume and value
 * - Success/failure rates
 * - Processing latencies
 * - Stripe API health
 * - Webhook processing stats
 */

import { logger } from '../lib/logger.js';
import { Counter, Histogram, Gauge, Registry } from 'prom-client';

// =============================================================================
// TYPES
// =============================================================================

export type PaymentMethod = 'card' | 'bank_account' | 'wallet' | 'other';
export type PaymentType = 'one_time' | 'subscription' | 'escrow' | 'payout';
export type PaymentStatus = 'succeeded' | 'failed' | 'pending' | 'refunded' | 'disputed';

export interface PaymentMetricLabels {
  method?: PaymentMethod;
  type?: PaymentType;
  status?: PaymentStatus;
  currency?: string;
  country?: string;
  error_code?: string;
}

// =============================================================================
// METRICS REGISTRY
// =============================================================================

const register = new Registry();

// =============================================================================
// TRANSACTION METRICS
// =============================================================================

/**
 * Total number of payment transactions
 */
export const paymentTransactionsTotal = new Counter({
  name: 'payment_transactions_total',
  help: 'Total number of payment transactions',
  labelNames: ['method', 'type', 'status', 'currency'],
  registers: [register],
});

/**
 * Total payment volume in cents
 */
export const paymentVolumeTotal = new Counter({
  name: 'payment_volume_cents_total',
  help: 'Total payment volume in cents',
  labelNames: ['method', 'type', 'currency'],
  registers: [register],
});

/**
 * Payment processing latency
 */
export const paymentProcessingLatency = new Histogram({
  name: 'payment_processing_latency_seconds',
  help: 'Payment processing latency in seconds',
  labelNames: ['method', 'type'],
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [register],
});

/**
 * Payment amount distribution
 */
export const paymentAmountHistogram = new Histogram({
  name: 'payment_amount_cents',
  help: 'Distribution of payment amounts in cents',
  labelNames: ['type', 'currency'],
  buckets: [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000],
  registers: [register],
});

// =============================================================================
// FAILURE METRICS
// =============================================================================

/**
 * Payment failures by error code
 */
export const paymentFailuresTotal = new Counter({
  name: 'payment_failures_total',
  help: 'Total number of payment failures',
  labelNames: ['method', 'type', 'error_code', 'currency'],
  registers: [register],
});

/**
 * Retry attempts
 */
export const paymentRetryAttemptsTotal = new Counter({
  name: 'payment_retry_attempts_total',
  help: 'Total number of payment retry attempts',
  labelNames: ['type', 'attempt_number'],
  registers: [register],
});

/**
 * Chargebacks/disputes
 */
export const disputesTotal = new Counter({
  name: 'payment_disputes_total',
  help: 'Total number of disputes/chargebacks',
  labelNames: ['type', 'reason', 'outcome'],
  registers: [register],
});

/**
 * Refunds
 */
export const refundsTotal = new Counter({
  name: 'payment_refunds_total',
  help: 'Total number of refunds',
  labelNames: ['type', 'reason'],
  registers: [register],
});

export const refundVolumeTotal = new Counter({
  name: 'payment_refund_volume_cents_total',
  help: 'Total refund volume in cents',
  labelNames: ['currency'],
  registers: [register],
});

// =============================================================================
// WEBHOOK METRICS
// =============================================================================

/**
 * Webhook events received
 */
export const webhookEventsTotal = new Counter({
  name: 'stripe_webhook_events_total',
  help: 'Total Stripe webhook events received',
  labelNames: ['event_type', 'status'],
  registers: [register],
});

/**
 * Webhook processing latency
 */
export const webhookProcessingLatency = new Histogram({
  name: 'stripe_webhook_processing_latency_seconds',
  help: 'Webhook processing latency in seconds',
  labelNames: ['event_type'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

/**
 * Webhook queue depth
 */
export const webhookQueueDepth = new Gauge({
  name: 'stripe_webhook_queue_depth',
  help: 'Current depth of webhook processing queue',
  registers: [register],
});

/**
 * Dead letter queue size
 */
export const webhookDlqSize = new Gauge({
  name: 'stripe_webhook_dlq_size',
  help: 'Number of events in dead letter queue',
  registers: [register],
});

// =============================================================================
// STRIPE API METRICS
// =============================================================================

/**
 * Stripe API request latency
 */
export const stripeApiLatency = new Histogram({
  name: 'stripe_api_latency_seconds',
  help: 'Stripe API request latency in seconds',
  labelNames: ['endpoint', 'method'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

/**
 * Stripe API errors
 */
export const stripeApiErrorsTotal = new Counter({
  name: 'stripe_api_errors_total',
  help: 'Total Stripe API errors',
  labelNames: ['endpoint', 'error_type', 'status_code'],
  registers: [register],
});

/**
 * Stripe API rate limit hits
 */
export const stripeRateLimitHits = new Counter({
  name: 'stripe_rate_limit_hits_total',
  help: 'Total Stripe API rate limit hits',
  registers: [register],
});

// =============================================================================
// ESCROW METRICS
// =============================================================================

/**
 * Escrow funds held
 */
export const escrowFundsHeld = new Gauge({
  name: 'escrow_funds_held_cents',
  help: 'Total funds currently held in escrow',
  labelNames: ['currency'],
  registers: [register],
});

/**
 * Escrow releases
 */
export const escrowReleasesTotal = new Counter({
  name: 'escrow_releases_total',
  help: 'Total escrow fund releases',
  labelNames: ['release_type'],
  registers: [register],
});

/**
 * Escrow release latency (time from milestone completion to release)
 */
export const escrowReleaseLatency = new Histogram({
  name: 'escrow_release_latency_hours',
  help: 'Time from milestone completion to fund release in hours',
  buckets: [1, 4, 8, 24, 48, 72, 168],
  registers: [register],
});

// =============================================================================
// PAYOUT METRICS
// =============================================================================

/**
 * Payouts processed
 */
export const payoutsProcessedTotal = new Counter({
  name: 'payouts_processed_total',
  help: 'Total payouts processed',
  labelNames: ['schedule', 'status'],
  registers: [register],
});

/**
 * Payout volume
 */
export const payoutVolumeTotal = new Counter({
  name: 'payout_volume_cents_total',
  help: 'Total payout volume in cents',
  labelNames: ['currency'],
  registers: [register],
});

/**
 * Payout arrival time
 */
export const payoutArrivalTime = new Histogram({
  name: 'payout_arrival_time_hours',
  help: 'Time from payout initiation to arrival in hours',
  labelNames: ['method'],
  buckets: [1, 4, 8, 24, 48, 72, 120, 168],
  registers: [register],
});

/**
 * Pending payout balance
 */
export const pendingPayoutBalance = new Gauge({
  name: 'pending_payout_balance_cents',
  help: 'Total pending payout balance',
  labelNames: ['currency'],
  registers: [register],
});

// =============================================================================
// SUBSCRIPTION METRICS
// =============================================================================

/**
 * Active subscriptions
 */
export const activeSubscriptions = new Gauge({
  name: 'active_subscriptions_total',
  help: 'Total active subscriptions',
  labelNames: ['plan', 'interval'],
  registers: [register],
});

/**
 * Subscription churn
 */
export const subscriptionChurnTotal = new Counter({
  name: 'subscription_churn_total',
  help: 'Total subscription cancellations',
  labelNames: ['plan', 'reason'],
  registers: [register],
});

/**
 * Monthly recurring revenue
 */
export const monthlyRecurringRevenue = new Gauge({
  name: 'monthly_recurring_revenue_cents',
  help: 'Current monthly recurring revenue in cents',
  labelNames: ['currency'],
  registers: [register],
});

// =============================================================================
// FRAUD METRICS
// =============================================================================

/**
 * Fraud checks performed
 */
export const fraudChecksTotal = new Counter({
  name: 'fraud_checks_total',
  help: 'Total fraud checks performed',
  labelNames: ['result'],
  registers: [register],
});

/**
 * Blocked transactions
 */
export const blockedTransactionsTotal = new Counter({
  name: 'blocked_transactions_total',
  help: 'Total transactions blocked by fraud prevention',
  labelNames: ['reason'],
  registers: [register],
});

/**
 * Risk score distribution
 */
export const riskScoreHistogram = new Histogram({
  name: 'fraud_risk_score',
  help: 'Distribution of fraud risk scores',
  buckets: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  registers: [register],
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Record a payment transaction
 */
export function recordPaymentTransaction(
  method: PaymentMethod,
  type: PaymentType,
  status: PaymentStatus,
  amountCents: number,
  currency: string,
  processingTimeSeconds: number,
  errorCode?: string
): void {
  paymentTransactionsTotal.inc({ method, type, status, currency });

  if (status === 'succeeded') {
    paymentVolumeTotal.inc({ method, type, currency }, amountCents);
    paymentAmountHistogram.observe({ type, currency }, amountCents);
  }

  paymentProcessingLatency.observe({ method, type }, processingTimeSeconds);

  if (status === 'failed' && errorCode) {
    paymentFailuresTotal.inc({ method, type, error_code: errorCode, currency });
  }
}

/**
 * Record a webhook event
 */
export function recordWebhookEvent(
  eventType: string,
  status: 'processed' | 'failed' | 'skipped',
  processingTimeSeconds: number
): void {
  webhookEventsTotal.inc({ event_type: eventType, status });
  webhookProcessingLatency.observe({ event_type: eventType }, processingTimeSeconds);
}

/**
 * Record a Stripe API call
 */
export function recordStripeApiCall(
  endpoint: string,
  method: string,
  latencySeconds: number,
  error?: { type: string; statusCode: number }
): void {
  stripeApiLatency.observe({ endpoint, method }, latencySeconds);

  if (error) {
    stripeApiErrorsTotal.inc({
      endpoint,
      error_type: error.type,
      status_code: error.statusCode.toString(),
    });

    if (error.statusCode === 429) {
      stripeRateLimitHits.inc();
    }
  }
}

/**
 * Get the metrics registry
 */
export function getMetricsRegistry(): Registry {
  return register;
}

/**
 * Get all metrics as string
 */
export async function getMetricsString(): Promise<string> {
  return register.metrics();
}

// =============================================================================
// METRICS SERVICE CLASS
// =============================================================================

export class PaymentMetricsService {
  private updateInterval: NodeJS.Timeout | null = null;

  /**
   * Start periodic metric updates
   */
  async startPeriodicUpdates(intervalMs = 60000): Promise<void> {
    logger.info({ intervalMs }, 'Starting periodic metrics updates');

    // Initial update
    await this.updateGaugeMetrics();

    // Schedule periodic updates
    this.updateInterval = setInterval(async () => {
      try {
        await this.updateGaugeMetrics();
      } catch (error) {
        logger.error({ error }, 'Failed to update gauge metrics');
      }
    }, intervalMs);
  }

  /**
   * Stop periodic updates
   */
  stopPeriodicUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Update gauge metrics from database
   */
  private async updateGaugeMetrics(): Promise<void> {
    // These would query the database for current values
    // Placeholder implementation - actual implementation would use Prisma

    // Update escrow funds held
    // const escrowTotals = await prisma.escrow.groupBy({ ... });
    // escrowFundsHeld.set({ currency: 'usd' }, totalAmount);

    // Update pending payout balance
    // const payoutTotals = await prisma.escrowRelease.aggregate({ ... });
    // pendingPayoutBalance.set({ currency: 'usd' }, totalPending);

    // Update active subscriptions
    // const subCounts = await prisma.subscription.groupBy({ ... });
    // activeSubscriptions.set({ plan: 'pro', interval: 'monthly' }, count);

    // Update MRR
    // monthlyRecurringRevenue.set({ currency: 'usd' }, mrrValue);

    logger.debug('Updated gauge metrics');
  }

  /**
   * Record a complete payment lifecycle
   */
  recordPayment(data: {
    method: PaymentMethod;
    type: PaymentType;
    status: PaymentStatus;
    amountCents: number;
    currency: string;
    startTime: number;
    errorCode?: string;
  }): void {
    const processingTime = (Date.now() - data.startTime) / 1000;
    recordPaymentTransaction(
      data.method,
      data.type,
      data.status,
      data.amountCents,
      data.currency,
      processingTime,
      data.errorCode
    );
  }

  /**
   * Record a retry attempt
   */
  recordRetry(type: PaymentType, attemptNumber: number): void {
    paymentRetryAttemptsTotal.inc({ type, attempt_number: attemptNumber.toString() });
  }

  /**
   * Record a dispute
   */
  recordDispute(type: 'chargeback' | 'inquiry', reason: string, outcome?: string): void {
    disputesTotal.inc({ type, reason, outcome: outcome || 'pending' });
  }

  /**
   * Record a refund
   */
  recordRefund(
    type: 'full' | 'partial',
    reason: string,
    amountCents: number,
    currency: string
  ): void {
    refundsTotal.inc({ type, reason });
    refundVolumeTotal.inc({ currency }, amountCents);
  }

  /**
   * Record an escrow release
   */
  recordEscrowRelease(
    releaseType: 'milestone' | 'contract_completion' | 'dispute_resolution',
    hoursToRelease: number
  ): void {
    escrowReleasesTotal.inc({ release_type: releaseType });
    escrowReleaseLatency.observe(hoursToRelease);
  }

  /**
   * Record a payout
   */
  recordPayout(
    schedule: string,
    status: 'succeeded' | 'failed',
    amountCents: number,
    currency: string
  ): void {
    payoutsProcessedTotal.inc({ schedule, status });
    if (status === 'succeeded') {
      payoutVolumeTotal.inc({ currency }, amountCents);
    }
  }

  /**
   * Record a fraud check
   */
  recordFraudCheck(
    result: 'allowed' | 'blocked' | 'review',
    riskScore: number,
    blockReason?: string
  ): void {
    fraudChecksTotal.inc({ result });
    riskScoreHistogram.observe(riskScore);

    if (result === 'blocked' && blockReason) {
      blockedTransactionsTotal.inc({ reason: blockReason });
    }
  }

  /**
   * Update webhook queue metrics
   */
  updateWebhookQueueMetrics(queueDepth: number, dlqSize: number): void {
    webhookQueueDepth.set(queueDepth);
    webhookDlqSize.set(dlqSize);
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let metricsService: PaymentMetricsService | null = null;

export function getPaymentMetricsService(): PaymentMetricsService {
  if (!metricsService) {
    metricsService = new PaymentMetricsService();
  }
  return metricsService;
}
