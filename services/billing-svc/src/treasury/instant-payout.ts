// @ts-nocheck
/**
 * Instant Payout Service
 * Enables instant and standard payouts to cards and bank accounts
 * Sprint M5: Freelancer Financial Services
 */

import Stripe from 'stripe';
import { prisma } from '@skillancer/database';
import { logger } from '../lib/logger.js';
import { getTreasuryService } from './treasury-service.js';

// ============================================================================
// TYPES
// ============================================================================

export type PayoutSpeed = 'standard' | 'instant';
export type PayoutDestination = 'skillancer_card' | 'external_debit' | 'bank_account';

export interface PayoutRequest {
  userId: string;
  amount: number;
  currency?: string;
  speed: PayoutSpeed;
  destination: PayoutDestination;
  destinationId?: string; // Card ID or bank account ID
  description?: string;
}

export interface PayoutResult {
  id: string;
  status: PayoutStatus;
  amount: number;
  fee: number;
  netAmount: number;
  destination: PayoutDestination;
  estimatedArrival: Date;
  createdAt: Date;
}

export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface PayoutEligibility {
  eligible: boolean;
  maxAmount: number;
  minAmount: number;
  dailyRemaining: number;
  reasons?: string[];
  instantAvailable: boolean;
}

export interface PayoutFee {
  speed: PayoutSpeed;
  destination: PayoutDestination;
  feePercentage: number;
  feeFixed: number;
  totalFee: number;
  netAmount: number;
}

// ============================================================================
// FEE STRUCTURE
// ============================================================================

const PAYOUT_FEES: Record<string, { percentage: number; fixed: number }> = {
  'standard:bank_account': { percentage: 0, fixed: 0 },
  'standard:skillancer_card': { percentage: 0, fixed: 0 },
  'instant:skillancer_card': { percentage: 1, fixed: 0 }, // 1% for instant to our card
  'instant:external_debit': { percentage: 1.5, fixed: 0 }, // 1.5% for instant to external
};

const PAYOUT_LIMITS = {
  minAmount: 5, // $5 minimum
  maxInstantDaily: 10000, // $10,000 per day instant
  maxStandardDaily: 50000, // $50,000 per day standard
};

// ============================================================================
// INSTANT PAYOUT SERVICE
// ============================================================================

export class InstantPayoutService {
  private stripe: Stripe;
  private treasuryService = getTreasuryService();

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-06-20',
    });
  }

  // ==========================================================================
  // ELIGIBILITY
  // ==========================================================================

  /**
   * Check if user is eligible for payouts
   */
  async checkEligibility(userId: string): Promise<PayoutEligibility> {
    const reasons: string[] = [];

    // Get Treasury account
    const account = await prisma.treasuryAccount.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!account) {
      return {
        eligible: false,
        maxAmount: 0,
        minAmount: PAYOUT_LIMITS.minAmount,
        dailyRemaining: 0,
        reasons: ['No Treasury account found'],
        instantAvailable: false,
      };
    }

    // Check account status
    if (account.status !== 'active') {
      reasons.push('Account is not active');
    }

    // Get current balance
    const balance = await this.treasuryService.getBalance(userId);
    if (!balance || balance.available < PAYOUT_LIMITS.minAmount) {
      reasons.push(`Minimum payout amount is $${PAYOUT_LIMITS.minAmount}`);
    }

    // Check daily limits
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyPayouts = await prisma.payout.aggregate({
      where: {
        userId,
        createdAt: { gte: today },
        status: { in: ['pending', 'processing', 'completed'] },
      },
      _sum: { amount: true },
    });

    const usedToday = dailyPayouts._sum.amount?.toNumber() || 0;
    const dailyRemaining = Math.max(0, PAYOUT_LIMITS.maxInstantDaily - usedToday);

    // Check if user has eligible instant payout destination
    const hasInstantDestination = await this.hasInstantPayoutDestination(userId);

    return {
      eligible: reasons.length === 0 && (balance?.available || 0) >= PAYOUT_LIMITS.minAmount,
      maxAmount: Math.min(balance?.available || 0, dailyRemaining),
      minAmount: PAYOUT_LIMITS.minAmount,
      dailyRemaining,
      reasons: reasons.length > 0 ? reasons : undefined,
      instantAvailable: hasInstantDestination && dailyRemaining > 0,
    };
  }

  /**
   * Check if user has an instant payout destination
   */
  private async hasInstantPayoutDestination(userId: string): Promise<boolean> {
    // Check for Skillancer card
    const card = await prisma.issuedCard.findFirst({
      where: {
        userId,
        status: 'active',
      },
    });

    if (card) return true;

    // Check for external debit card with instant capability
    const externalCard = await prisma.paymentMethod.findFirst({
      where: {
        userId,
        type: 'card',
        metadata: {
          path: ['instantPayoutEligible'],
          equals: true,
        },
      },
    });

    return !!externalCard;
  }

  // ==========================================================================
  // FEE CALCULATION
  // ==========================================================================

  /**
   * Calculate payout fee
   */
  calculateFee(amount: number, speed: PayoutSpeed, destination: PayoutDestination): PayoutFee {
    const key = `${speed}:${destination}`;
    const feeConfig = PAYOUT_FEES[key] || { percentage: 0, fixed: 0 };

    const percentageFee = (amount * feeConfig.percentage) / 100;
    const totalFee = percentageFee + feeConfig.fixed;
    const netAmount = amount - totalFee;

    return {
      speed,
      destination,
      feePercentage: feeConfig.percentage,
      feeFixed: feeConfig.fixed,
      totalFee: Math.round(totalFee * 100) / 100,
      netAmount: Math.round(netAmount * 100) / 100,
    };
  }

  /**
   * Get all payout options with fees
   */
  async getPayoutOptions(
    userId: string,
    amount: number
  ): Promise<{
    options: Array<{
      speed: PayoutSpeed;
      destination: PayoutDestination;
      available: boolean;
      fee: PayoutFee;
      estimatedArrival: string;
    }>;
  }> {
    const eligibility = await this.checkEligibility(userId);
    const hasSkillancerCard = await this.hasSkillancerCard(userId);
    const hasExternalDebit = await this.hasExternalDebitCard(userId);

    const options = [
      {
        speed: 'standard' as PayoutSpeed,
        destination: 'bank_account' as PayoutDestination,
        available: eligibility.eligible && amount <= eligibility.maxAmount,
        fee: this.calculateFee(amount, 'standard', 'bank_account'),
        estimatedArrival: '1-2 business days',
      },
      {
        speed: 'instant' as PayoutSpeed,
        destination: 'skillancer_card' as PayoutDestination,
        available:
          eligibility.instantAvailable && hasSkillancerCard && amount <= eligibility.dailyRemaining,
        fee: this.calculateFee(amount, 'instant', 'skillancer_card'),
        estimatedArrival: 'Seconds',
      },
      {
        speed: 'instant' as PayoutSpeed,
        destination: 'external_debit' as PayoutDestination,
        available:
          eligibility.instantAvailable && hasExternalDebit && amount <= eligibility.dailyRemaining,
        fee: this.calculateFee(amount, 'instant', 'external_debit'),
        estimatedArrival: 'Seconds',
      },
    ];

    return { options };
  }

  private async hasSkillancerCard(userId: string): Promise<boolean> {
    const card = await prisma.issuedCard.findFirst({
      where: { userId, status: 'active' },
    });
    return !!card;
  }

  private async hasExternalDebitCard(userId: string): Promise<boolean> {
    const card = await prisma.paymentMethod.findFirst({
      where: { userId, type: 'card' },
    });
    return !!card;
  }

  // ==========================================================================
  // PAYOUT EXECUTION
  // ==========================================================================

  /**
   * Initiate a payout
   */
  async initiatePayout(request: PayoutRequest): Promise<PayoutResult> {
    const { userId, amount, speed, destination, destinationId, description } = request;

    // Validate eligibility
    const eligibility = await this.checkEligibility(userId);
    if (!eligibility.eligible) {
      throw new Error(`Payout not eligible: ${eligibility.reasons?.join(', ')}`);
    }

    if (amount < PAYOUT_LIMITS.minAmount) {
      throw new Error(`Minimum payout amount is $${PAYOUT_LIMITS.minAmount}`);
    }

    if (amount > eligibility.maxAmount) {
      throw new Error(`Maximum payout amount is $${eligibility.maxAmount}`);
    }

    if (speed === 'instant' && !eligibility.instantAvailable) {
      throw new Error('Instant payout not available');
    }

    // Calculate fee
    const fee = this.calculateFee(amount, speed, destination);

    // Get account details
    const account = await prisma.treasuryAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      throw new Error('Treasury account not found');
    }

    try {
      let stripePayout: any;

      if (speed === 'instant' && destination === 'skillancer_card') {
        // Instant payout to Skillancer issued card
        const card = await prisma.issuedCard.findFirst({
          where: { userId, status: 'active' },
        });

        if (!card) {
          throw new Error('No active Skillancer card found');
        }

        stripePayout = await this.stripe.treasury.outboundPayments.create(
          {
            financial_account: account.stripeFinancialAccountId,
            amount: Math.round(fee.netAmount * 100),
            currency: 'usd',
            statement_descriptor: 'Skillancer Payout',
            destination_payment_method: card.stripeCardId,
          },
          { stripeAccount: account.stripeConnectAccountId }
        );
      } else if (speed === 'instant' && destination === 'external_debit') {
        // Instant payout to external debit card
        if (!destinationId) {
          throw new Error('Destination card ID required');
        }

        stripePayout = await this.stripe.treasury.outboundPayments.create(
          {
            financial_account: account.stripeFinancialAccountId,
            amount: Math.round(fee.netAmount * 100),
            currency: 'usd',
            statement_descriptor: 'Skillancer Payout',
            destination_payment_method: destinationId,
          },
          { stripeAccount: account.stripeConnectAccountId }
        );
      } else {
        // Standard payout to bank account
        stripePayout = await this.stripe.treasury.outboundTransfers.create(
          {
            financial_account: account.stripeFinancialAccountId,
            amount: Math.round(fee.netAmount * 100),
            currency: 'usd',
            statement_descriptor: 'Skillancer Payout',
            destination_payment_method: destinationId || 'default',
          },
          { stripeAccount: account.stripeConnectAccountId }
        );
      }

      // Record payout in database
      const payout = await prisma.payout.create({
        data: {
          userId,
          stripePayoutId: stripePayout.id,
          amount,
          fee: fee.totalFee,
          netAmount: fee.netAmount,
          currency: 'usd',
          speed,
          destination,
          destinationId,
          status: 'pending',
          description: description || `Payout to ${destination}`,
        },
      });

      // Record fee as transaction
      if (fee.totalFee > 0) {
        await prisma.treasuryTransaction.create({
          data: {
            userId,
            type: 'fee',
            amount: fee.totalFee,
            currency: 'usd',
            description: `Payout fee (${fee.feePercentage}%)`,
            payoutId: payout.id,
          },
        });
      }

      logger.info('Payout initiated', {
        userId,
        payoutId: payout.id,
        amount,
        fee: fee.totalFee,
        speed,
        destination,
      });

      return {
        id: payout.id,
        status: 'pending',
        amount,
        fee: fee.totalFee,
        netAmount: fee.netAmount,
        destination,
        estimatedArrival: this.getEstimatedArrival(speed),
        createdAt: payout.createdAt,
      };
    } catch (error) {
      logger.error('Payout failed', { userId, amount, error });
      throw error;
    }
  }

  /**
   * Get estimated arrival time
   */
  private getEstimatedArrival(speed: PayoutSpeed): Date {
    const now = new Date();
    if (speed === 'instant') {
      return new Date(now.getTime() + 30 * 1000); // 30 seconds
    }
    // Standard: 1-2 business days
    const arrival = new Date(now);
    arrival.setDate(arrival.getDate() + 2);
    return arrival;
  }

  // ==========================================================================
  // PAYOUT STATUS
  // ==========================================================================

  /**
   * Get payout by ID
   */
  async getPayout(payoutId: string, userId: string): Promise<PayoutResult | null> {
    const payout = await prisma.payout.findFirst({
      where: { id: payoutId, userId },
    });

    if (!payout) {
      return null;
    }

    return {
      id: payout.id,
      status: payout.status as PayoutStatus,
      amount: payout.amount.toNumber(),
      fee: payout.fee.toNumber(),
      netAmount: payout.netAmount.toNumber(),
      destination: payout.destination as PayoutDestination,
      estimatedArrival: payout.estimatedArrival || new Date(),
      createdAt: payout.createdAt,
    };
  }

  /**
   * List user's payouts
   */
  async listPayouts(
    userId: string,
    options: {
      limit?: number;
      status?: PayoutStatus;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{ payouts: PayoutResult[]; total: number }> {
    const where: any = { userId };

    if (options.status) {
      where.status = options.status;
    }
    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options.limit || 25,
      }),
      prisma.payout.count({ where }),
    ]);

    return {
      payouts: payouts.map((p) => ({
        id: p.id,
        status: p.status as PayoutStatus,
        amount: p.amount.toNumber(),
        fee: p.fee.toNumber(),
        netAmount: p.netAmount.toNumber(),
        destination: p.destination as PayoutDestination,
        estimatedArrival: p.estimatedArrival || new Date(),
        createdAt: p.createdAt,
      })),
      total,
    };
  }

  /**
   * Cancel a pending payout
   */
  async cancelPayout(payoutId: string, userId: string): Promise<void> {
    const payout = await prisma.payout.findFirst({
      where: { id: payoutId, userId, status: 'pending' },
    });

    if (!payout) {
      throw new Error('Payout not found or cannot be cancelled');
    }

    const account = await prisma.treasuryAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      throw new Error('Treasury account not found');
    }

    // Cancel in Stripe
    await this.stripe.treasury.outboundPayments.cancel(payout.stripePayoutId, {
      stripeAccount: account.stripeConnectAccountId,
    });

    // Update database
    await prisma.payout.update({
      where: { id: payoutId },
      data: { status: 'cancelled' },
    });

    logger.info('Payout cancelled', { userId, payoutId });
  }

  // ==========================================================================
  // WEBHOOK HANDLERS
  // ==========================================================================

  /**
   * Handle payout status update from webhook
   */
  async handlePayoutStatusUpdate(
    stripePayoutId: string,
    status: 'processing' | 'posted' | 'failed' | 'canceled'
  ): Promise<void> {
    const statusMap: Record<string, PayoutStatus> = {
      processing: 'processing',
      posted: 'completed',
      failed: 'failed',
      canceled: 'cancelled',
    };

    await prisma.payout.updateMany({
      where: { stripePayoutId },
      data: {
        status: statusMap[status],
        ...(status === 'posted' ? { completedAt: new Date() } : {}),
      },
    });
  }
}

// Singleton instance
let instantPayoutServiceInstance: InstantPayoutService | null = null;

export function getInstantPayoutService(): InstantPayoutService {
  if (!instantPayoutServiceInstance) {
    instantPayoutServiceInstance = new InstantPayoutService();
  }
  return instantPayoutServiceInstance;
}
