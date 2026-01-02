// @ts-nocheck
/**
 * @module @skillancer/billing-svc/services/fraud-prevention
 * Fraud Prevention Service
 *
 * Features:
 * - Stripe Radar integration
 * - Custom fraud rules
 * - Risk scoring
 * - Velocity checks
 * - Geographic anomaly detection
 * - New account risk assessment
 * - Blocklist management
 */

import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';
import { subHours, subDays } from 'date-fns';

import { getStripe } from './stripe.service.js';

import type Stripe from 'stripe';

// =============================================================================
// TYPES
// =============================================================================

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface FraudCheckResult {
  approved: boolean;
  riskLevel: RiskLevel;
  riskScore: number; // 0-100
  requiresManualReview: boolean;
  reasons: string[];
  radarOutcome?: string;
  blockReason?: string;
}

export interface FraudSignal {
  type: string;
  weight: number;
  description: string;
}

export interface PaymentContext {
  customerId: string;
  userId?: string;
  amount: number;
  currency: string;
  ipAddress?: string;
  userAgent?: string;
  paymentMethodId?: string;
  email?: string;
  country?: string;
  isNewAccount?: boolean;
  accountAgeHours?: number;
}

export interface VelocityCheck {
  type: 'payment_count' | 'amount_total' | 'card_changes' | 'failed_attempts';
  window: 'hour' | 'day' | 'week';
  current: number;
  threshold: number;
  exceeded: boolean;
}

// =============================================================================
// FRAUD RULES
// =============================================================================

interface FraudRule {
  id: string;
  name: string;
  check: (context: PaymentContext, history: PaymentHistory) => Promise<FraudSignal | null>;
  enabled: boolean;
}

interface PaymentHistory {
  recentPayments: Array<{
    amount: number;
    status: string;
    createdAt: Date;
    ipAddress?: string;
    country?: string;
  }>;
  failedAttempts24h: number;
  chargebacks30d: number;
  cardChanges7d: number;
}

const FRAUD_RULES: FraudRule[] = [
  {
    id: 'velocity_payment_count',
    name: 'High Payment Velocity',
    enabled: true,
    check: async (context, history) => {
      const recentCount = history.recentPayments.filter(
        (p) => p.createdAt > subHours(new Date(), 1)
      ).length;

      if (recentCount >= 5) {
        return {
          type: 'velocity_payment_count',
          weight: 30,
          description: `${recentCount} payments in the last hour (threshold: 5)`,
        };
      }
      return null;
    },
  },
  {
    id: 'velocity_amount',
    name: 'High Amount Velocity',
    enabled: true,
    check: async (context, history) => {
      const recent24h = history.recentPayments.filter(
        (p) => p.createdAt > subHours(new Date(), 24)
      );
      const totalAmount = recent24h.reduce((sum, p) => sum + p.amount, 0);

      // $10,000 threshold in 24 hours
      if (totalAmount + context.amount > 1000000) {
        return {
          type: 'velocity_amount',
          weight: 25,
          description: `Total amount $${(totalAmount + context.amount) / 100} in 24h exceeds $10,000`,
        };
      }
      return null;
    },
  },
  {
    id: 'new_account_large_payment',
    name: 'New Account Large Payment',
    enabled: true,
    check: async (context) => {
      // Account less than 24 hours old + payment over $500
      if (context.isNewAccount && context.amount > 50000) {
        return {
          type: 'new_account_large_payment',
          weight: 35,
          description: `Large payment ($${context.amount / 100}) from account created ${context.accountAgeHours || 0}h ago`,
        };
      }
      return null;
    },
  },
  {
    id: 'failed_attempts_spike',
    name: 'Multiple Failed Attempts',
    enabled: true,
    check: async (_context, history) => {
      if (history.failedAttempts24h >= 3) {
        return {
          type: 'failed_attempts_spike',
          weight: 20,
          description: `${history.failedAttempts24h} failed payment attempts in 24h`,
        };
      }
      return null;
    },
  },
  {
    id: 'chargeback_history',
    name: 'Recent Chargeback History',
    enabled: true,
    check: async (_context, history) => {
      if (history.chargebacks30d >= 1) {
        return {
          type: 'chargeback_history',
          weight: 50,
          description: `${history.chargebacks30d} chargebacks in the last 30 days`,
        };
      }
      return null;
    },
  },
  {
    id: 'card_churning',
    name: 'Frequent Card Changes',
    enabled: true,
    check: async (_context, history) => {
      if (history.cardChanges7d >= 3) {
        return {
          type: 'card_churning',
          weight: 25,
          description: `${history.cardChanges7d} payment method changes in 7 days`,
        };
      }
      return null;
    },
  },
  {
    id: 'geographic_anomaly',
    name: 'Geographic Anomaly',
    enabled: true,
    check: async (context, history) => {
      if (!context.country || history.recentPayments.length === 0) {
        return null;
      }

      const previousCountries = new Set(
        history.recentPayments.filter((p) => p.country).map((p) => p.country)
      );

      if (previousCountries.size > 0 && !previousCountries.has(context.country)) {
        return {
          type: 'geographic_anomaly',
          weight: 15,
          description: `Payment from ${context.country}, previous payments from ${[...previousCountries].join(', ')}`,
        };
      }
      return null;
    },
  },
  {
    id: 'high_risk_country',
    name: 'High Risk Country',
    enabled: true,
    check: async (context) => {
      const highRiskCountries = ['RU', 'NG', 'PH', 'IN', 'ID', 'BR', 'EG', 'PK'];

      if (context.country && highRiskCountries.includes(context.country)) {
        return {
          type: 'high_risk_country',
          weight: 20,
          description: `Payment from high-risk country: ${context.country}`,
        };
      }
      return null;
    },
  },
  {
    id: 'suspicious_amount_pattern',
    name: 'Suspicious Amount Pattern',
    enabled: true,
    check: async (context) => {
      // Check for common fraud patterns like $1 test charges
      if (context.amount < 100) {
        return {
          type: 'suspicious_amount_pattern',
          weight: 10,
          description: 'Very small payment amount (possible test charge)',
        };
      }

      // Round amounts that are common in fraud
      if (context.amount % 10000 === 0 && context.amount >= 100000) {
        return {
          type: 'suspicious_amount_pattern',
          weight: 5,
          description: 'Exactly round amount',
        };
      }

      return null;
    },
  },
];

// =============================================================================
// FRAUD PREVENTION SERVICE CLASS
// =============================================================================

export class FraudPreventionService {
  private stripe: Stripe;
  private blockedEmails: Set<string> = new Set();
  private blockedIPs: Set<string> = new Set();
  private blockedCards: Set<string> = new Set();

  constructor() {
    this.stripe = getStripe();
    this.loadBlocklists();
  }

  /**
   * Run fraud check on a payment
   */
  async checkPayment(context: PaymentContext): Promise<FraudCheckResult> {
    logger.info(
      {
        customerId: context.customerId,
        amount: context.amount,
      },
      'Running fraud check'
    );

    const signals: FraudSignal[] = [];

    // 1. Check blocklists first (immediate block)
    const blockReason = await this.checkBlocklists(context);
    if (blockReason) {
      logger.warn(
        {
          customerId: context.customerId,
          blockReason,
        },
        'Payment blocked by blocklist'
      );

      return {
        approved: false,
        riskLevel: 'CRITICAL',
        riskScore: 100,
        requiresManualReview: false,
        reasons: [blockReason],
        blockReason,
      };
    }

    // 2. Get Stripe Radar score if available
    const radarResult = await this.getRadarScore(context.paymentMethodId);
    if (radarResult) {
      signals.push({
        type: 'stripe_radar',
        weight: radarResult.weight,
        description: `Stripe Radar: ${radarResult.outcome} (score: ${radarResult.score})`,
      });
    }

    // 3. Get payment history
    const history = await this.getPaymentHistory(context.customerId);

    // 4. Run custom fraud rules
    for (const rule of FRAUD_RULES.filter((r) => r.enabled)) {
      try {
        const signal = await rule.check(context, history);
        if (signal) {
          signals.push(signal);
        }
      } catch (error) {
        logger.error({ ruleId: rule.id, error }, 'Fraud rule check failed');
      }
    }

    // 5. Calculate final risk score
    const riskScore = Math.min(
      100,
      signals.reduce((sum, s) => sum + s.weight, 0)
    );
    const riskLevel = this.getRiskLevel(riskScore);

    // 6. Determine approval
    const approved = riskScore < 70;
    const requiresManualReview = riskScore >= 50 && riskScore < 70;

    const result: FraudCheckResult = {
      approved,
      riskLevel,
      riskScore,
      requiresManualReview,
      reasons: signals.map((s) => s.description),
      radarOutcome: radarResult?.outcome,
    };

    // 7. Log fraud check result
    await this.logFraudCheck(context, result, signals);

    logger.info(
      {
        customerId: context.customerId,
        riskScore,
        riskLevel,
        approved,
        signalCount: signals.length,
      },
      'Fraud check completed'
    );

    return result;
  }

  /**
   * Submit fraud report to Stripe
   */
  async reportFraud(paymentIntentId: string, fraudType: string): Promise<void> {
    logger.warn({ paymentIntentId, fraudType }, 'Reporting fraud to Stripe');

    try {
      // Get the charge ID from the payment intent
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      const chargeId = paymentIntent.latest_charge as string;

      if (chargeId) {
        // Report as fraudulent to Stripe Radar
        await this.stripe.radar.earlyFraudWarnings.list({
          charge: chargeId,
        });

        // Create refund with fraud reason if payment succeeded
        if (paymentIntent.status === 'succeeded') {
          await this.stripe.refunds.create({
            payment_intent: paymentIntentId,
            reason: 'fraudulent',
          });
        }
      }

      // Block the customer
      const customerId =
        typeof paymentIntent.customer === 'string'
          ? paymentIntent.customer
          : paymentIntent.customer?.id;

      if (customerId) {
        await this.blockCustomer(customerId, `Fraud report: ${fraudType}`);
      }

      // Update payment record
      await prisma.payment.updateMany({
        where: { stripePaymentIntentId: paymentIntentId },
        data: {
          fraudReported: true,
          fraudType,
          fraudReportedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error({ paymentIntentId, error }, 'Failed to report fraud');
      throw error;
    }
  }

  /**
   * Block a customer
   */
  async blockCustomer(customerId: string, reason: string): Promise<void> {
    logger.warn({ customerId, reason }, 'Blocking customer');

    await prisma.blockedCustomer.upsert({
      where: { stripeCustomerId: customerId },
      update: {
        reason,
        updatedAt: new Date(),
      },
      create: {
        stripeCustomerId: customerId,
        reason,
        blockedAt: new Date(),
      },
    });

    // Add to in-memory blocklist
    // (In production, use Redis for distributed cache)
  }

  /**
   * Block an email address
   */
  async blockEmail(email: string, reason: string): Promise<void> {
    logger.warn({ email, reason }, 'Blocking email');

    await prisma.blockedEmail.upsert({
      where: { email },
      update: {
        reason,
        updatedAt: new Date(),
      },
      create: {
        email,
        reason,
        blockedAt: new Date(),
      },
    });

    this.blockedEmails.add(email.toLowerCase());
  }

  /**
   * Block an IP address
   */
  async blockIP(ipAddress: string, reason: string): Promise<void> {
    logger.warn({ ipAddress, reason }, 'Blocking IP address');

    await prisma.blockedIP.upsert({
      where: { ipAddress },
      update: {
        reason,
        updatedAt: new Date(),
      },
      create: {
        ipAddress,
        reason,
        blockedAt: new Date(),
      },
    });

    this.blockedIPs.add(ipAddress);
  }

  /**
   * Get velocity checks for a customer
   */
  async getVelocityChecks(customerId: string): Promise<VelocityCheck[]> {
    const now = new Date();
    const checks: VelocityCheck[] = [];

    // Payment count - hourly
    const paymentsLastHour = await prisma.payment.count({
      where: {
        stripeCustomerId: customerId,
        createdAt: { gte: subHours(now, 1) },
      },
    });
    checks.push({
      type: 'payment_count',
      window: 'hour',
      current: paymentsLastHour,
      threshold: 5,
      exceeded: paymentsLastHour >= 5,
    });

    // Payment count - daily
    const paymentsLastDay = await prisma.payment.count({
      where: {
        stripeCustomerId: customerId,
        createdAt: { gte: subDays(now, 1) },
      },
    });
    checks.push({
      type: 'payment_count',
      window: 'day',
      current: paymentsLastDay,
      threshold: 20,
      exceeded: paymentsLastDay >= 20,
    });

    // Amount total - daily
    const amountLastDay = await prisma.payment.aggregate({
      where: {
        stripeCustomerId: customerId,
        createdAt: { gte: subDays(now, 1) },
        status: { in: ['SUCCEEDED', 'PROCESSING'] },
      },
      _sum: { amount: true },
    });
    const totalAmount = amountLastDay._sum.amount || 0;
    checks.push({
      type: 'amount_total',
      window: 'day',
      current: totalAmount,
      threshold: 1000000, // $10,000
      exceeded: totalAmount >= 1000000,
    });

    // Failed attempts - daily
    const failedLastDay = await prisma.payment.count({
      where: {
        stripeCustomerId: customerId,
        status: 'FAILED',
        createdAt: { gte: subDays(now, 1) },
      },
    });
    checks.push({
      type: 'failed_attempts',
      window: 'day',
      current: failedLastDay,
      threshold: 5,
      exceeded: failedLastDay >= 5,
    });

    return checks;
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private async loadBlocklists(): Promise<void> {
    try {
      const [emails, ips] = await Promise.all([
        prisma.blockedEmail.findMany({ select: { email: true } }),
        prisma.blockedIP.findMany({ select: { ipAddress: true } }),
      ]);

      this.blockedEmails = new Set(emails.map((e) => e.email.toLowerCase()));
      this.blockedIPs = new Set(ips.map((i) => i.ipAddress));

      logger.info(
        {
          blockedEmails: this.blockedEmails.size,
          blockedIPs: this.blockedIPs.size,
        },
        'Loaded fraud blocklists'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to load blocklists');
    }
  }

  private async checkBlocklists(context: PaymentContext): Promise<string | null> {
    // Check email
    if (context.email && this.blockedEmails.has(context.email.toLowerCase())) {
      return 'Email is on blocklist';
    }

    // Check IP
    if (context.ipAddress && this.blockedIPs.has(context.ipAddress)) {
      return 'IP address is on blocklist';
    }

    // Check customer
    const blockedCustomer = await prisma.blockedCustomer.findUnique({
      where: { stripeCustomerId: context.customerId },
    });

    if (blockedCustomer) {
      return `Customer is blocked: ${blockedCustomer.reason}`;
    }

    return null;
  }

  private async getRadarScore(
    paymentMethodId?: string
  ): Promise<{ score: number; outcome: string; weight: number } | null> {
    if (!paymentMethodId) {
      return null;
    }

    try {
      // In production, Radar scores come from the PaymentIntent or Charge
      // Here we simulate the integration
      const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId);

      // Check if card checks passed
      const cardChecks = paymentMethod.card?.checks;
      let score = 0;

      if (cardChecks?.address_line1_check === 'fail') score += 10;
      if (cardChecks?.address_postal_code_check === 'fail') score += 10;
      if (cardChecks?.cvc_check === 'fail') score += 20;

      const outcome = score > 20 ? 'elevated_risk' : 'normal';
      const weight = Math.min(30, score);

      return { score, outcome, weight };
    } catch {
      return null;
    }
  }

  private async getPaymentHistory(customerId: string): Promise<PaymentHistory> {
    const now = new Date();

    const [recentPayments, failedAttempts, chargebacks, cardChanges] = await Promise.all([
      prisma.payment.findMany({
        where: {
          stripeCustomerId: customerId,
          createdAt: { gte: subDays(now, 7) },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          amount: true,
          status: true,
          createdAt: true,
          ipAddress: true,
          country: true,
        },
      }),
      prisma.payment.count({
        where: {
          stripeCustomerId: customerId,
          status: 'FAILED',
          createdAt: { gte: subDays(now, 1) },
        },
      }),
      prisma.dispute.count({
        where: {
          payment: { stripeCustomerId: customerId },
          createdAt: { gte: subDays(now, 30) },
        },
      }),
      prisma.paymentMethodChange.count({
        where: {
          customerId,
          createdAt: { gte: subDays(now, 7) },
        },
      }),
    ]);

    return {
      recentPayments,
      failedAttempts24h: failedAttempts,
      chargebacks30d: chargebacks,
      cardChanges7d: cardChanges,
    };
  }

  private getRiskLevel(score: number): RiskLevel {
    if (score >= 70) return 'CRITICAL';
    if (score >= 50) return 'HIGH';
    if (score >= 25) return 'MEDIUM';
    return 'LOW';
  }

  private async logFraudCheck(
    context: PaymentContext,
    result: FraudCheckResult,
    signals: FraudSignal[]
  ): Promise<void> {
    await prisma.fraudCheck.create({
      data: {
        customerId: context.customerId,
        userId: context.userId || null,
        amount: context.amount,
        currency: context.currency,
        ipAddress: context.ipAddress || null,
        country: context.country || null,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        approved: result.approved,
        requiresManualReview: result.requiresManualReview,
        signals: signals as unknown as Record<string, unknown>[],
        radarOutcome: result.radarOutcome || null,
        blockReason: result.blockReason || null,
      },
    });
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let fraudService: FraudPreventionService | null = null;

export function getFraudPreventionService(): FraudPreventionService {
  if (!fraudService) {
    fraudService = new FraudPreventionService();
  }
  return fraudService;
}

// =============================================================================
// MIDDLEWARE: Fraud Check Before Payment
// =============================================================================

export async function fraudCheckMiddleware(
  context: PaymentContext
): Promise<{ allowed: boolean; reason?: string }> {
  const service = getFraudPreventionService();
  const result = await service.checkPayment(context);

  if (!result.approved) {
    return {
      allowed: false,
      reason: result.blockReason || 'Payment declined due to risk assessment',
    };
  }

  if (result.requiresManualReview) {
    // Flag for manual review but allow the payment
    logger.info(
      {
        customerId: context.customerId,
        riskScore: result.riskScore,
      },
      'Payment flagged for manual review'
    );
  }

  return { allowed: true };
}

