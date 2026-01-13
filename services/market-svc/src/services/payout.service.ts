/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/**
 * @module @skillancer/market-svc/services/payout
 * Payout management service for Stripe Connect freelancer payouts
 */

import { Prisma } from '../types/prisma-shim.js';
import { createLogger } from '@skillancer/logger';

import { getStripeService } from './stripe.service.js';

import type { PayoutAccountSummary, PayoutResult } from '../types/contract.types.js';
import type { PrismaClient, PayoutAccountStatus, PayoutStatus } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';

const logger = createLogger({ serviceName: 'payout-service' });

// =============================================================================
// CONSTANTS
// =============================================================================

const BASE_URL = process.env.APP_BASE_URL ?? 'https://skillancer.com';
const CONNECT_ONBOARDING_RETURN_URL = `${BASE_URL}/settings/payments/complete`;
const CONNECT_ONBOARDING_REFRESH_URL = `${BASE_URL}/settings/payments/refresh`;

// =============================================================================
// ERROR CLASSES
// =============================================================================

export class PayoutError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'PayoutError';
  }
}

export const PayoutErrorCodes = {
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  ACCOUNT_NOT_READY: 'ACCOUNT_NOT_READY',
  ACCOUNT_ALREADY_EXISTS: 'ACCOUNT_ALREADY_EXISTS',
  PAYOUT_FAILED: 'PAYOUT_FAILED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  TRANSFER_FAILED: 'TRANSFER_FAILED',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
} as const;

// =============================================================================
// TYPES
// =============================================================================

export interface CreateConnectAccountInput {
  userId: string;
  email: string;
  accountType?: 'express' | 'standard';
  country?: string;
  businessType?: 'individual' | 'company';
}

export interface OnboardingLinkResult {
  url: string;
  expiresAt: Date;
}

export interface PayoutAccountWithBalance extends PayoutAccountSummary {
  availableBalance: number;
  pendingBalance: number;
  totalPaidOut: number;
}

export interface PayoutListOptions {
  status?: PayoutStatus | PayoutStatus[];
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
  offset?: number;
}

// =============================================================================
// PAYOUT SERVICE CLASS
// =============================================================================

export class PayoutService {
  private readonly logger: Logger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = logger;
  }

  private get stripeService() {
    return getStripeService();
  }

  // ===========================================================================
  // CONNECT ACCOUNT MANAGEMENT
  // ===========================================================================

  /**
   * Create a Stripe Connect account for a freelancer
   */
  async createConnectAccount(
    userId: string,
    email: string,
    options?: {
      accountType?: 'express' | 'standard';
      country?: string;
      businessType?: 'individual' | 'company';
      refreshUrl?: string;
      returnUrl?: string;
    }
  ): Promise<{ payoutAccount: PayoutAccountSummary; onboardingLink: OnboardingLinkResult }> {
    this.logger.info({ userId }, '[PayoutService] Creating Connect account');

    // Check if user already has a payout account
    const existing = await this.prisma.payoutAccount.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new PayoutError(
        'User already has a payout account',
        PayoutErrorCodes.ACCOUNT_ALREADY_EXISTS,
        400
      );
    }

    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new PayoutError('User not found', PayoutErrorCodes.USER_NOT_FOUND, 404);
    }

    // Create Stripe Connect account
    const stripeAccount = await this.stripeService.createConnectAccount({
      userId,
      email,
      type: options?.accountType ?? 'express',
      ...(options?.country && { country: options.country }),
      ...(options?.businessType && { businessType: options.businessType }),
    });

    // Create payout account record
    const payoutAccount = await this.prisma.payoutAccount.create({
      data: {
        userId,
        stripeConnectAccountId: stripeAccount.id,
        accountType: (options?.accountType ?? 'express').toUpperCase() as
          | 'EXPRESS'
          | 'STANDARD'
          | 'CUSTOM',
        status: 'ONBOARDING',
        chargesEnabled: stripeAccount.charges_enabled,
        payoutsEnabled: stripeAccount.payouts_enabled,
        defaultCurrency: stripeAccount.default_currency?.toUpperCase() ?? 'USD',
        country: options?.country ?? 'US',
      },
    });

    this.logger.info({ userId, accountId: stripeAccount.id }, 'Connect account created');

    // Create onboarding link
    const accountLink = await this.stripeService.createAccountLink({
      accountId: stripeAccount.id,
      refreshUrl: options?.refreshUrl ?? CONNECT_ONBOARDING_REFRESH_URL,
      returnUrl: options?.returnUrl ?? CONNECT_ONBOARDING_RETURN_URL,
      type: 'account_onboarding',
    });

    return {
      payoutAccount: this.mapToAccountSummary(payoutAccount),
      onboardingLink: {
        url: accountLink.url,
        expiresAt: new Date(accountLink.expires_at * 1000),
      },
    };
  }

  /**
   * Get onboarding link for Connect account setup
   */
  async getOnboardingLink(
    userId: string,
    options?: { refreshUrl?: string; returnUrl?: string }
  ): Promise<OnboardingLinkResult> {
    const account = await this.prisma.payoutAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      throw new PayoutError('Payout account not found', PayoutErrorCodes.ACCOUNT_NOT_FOUND, 404);
    }

    if (!account.stripeConnectAccountId) {
      throw new PayoutError(
        'Stripe account not initialized',
        PayoutErrorCodes.ACCOUNT_NOT_FOUND,
        400
      );
    }

    const accountLink = await this.stripeService.createAccountLink({
      accountId: account.stripeConnectAccountId,
      refreshUrl: options?.refreshUrl ?? CONNECT_ONBOARDING_REFRESH_URL,
      returnUrl: options?.returnUrl ?? CONNECT_ONBOARDING_RETURN_URL,
      type: 'account_onboarding',
    });

    return {
      url: accountLink.url,
      expiresAt: new Date(accountLink.expires_at * 1000),
    };
  }

  /**
   * Get login link for Express dashboard
   */
  async getExpressDashboardLink(userId: string): Promise<string> {
    const account = await this.prisma.payoutAccount.findUnique({
      where: { userId },
    });

    if (!account?.stripeConnectAccountId) {
      throw new PayoutError('Payout account not found', PayoutErrorCodes.ACCOUNT_NOT_FOUND, 404);
    }

    if (account.accountType !== 'EXPRESS') {
      throw new PayoutError(
        'Dashboard link only available for Express accounts',
        PayoutErrorCodes.ACCOUNT_NOT_READY,
        400
      );
    }

    const loginLink = await this.stripeService.createLoginLink(account.stripeConnectAccountId);
    return loginLink.url;
  }

  /**
   * Sync Connect account status from Stripe
   */
  async syncAccountStatus(userId: string): Promise<PayoutAccountSummary> {
    const account = await this.prisma.payoutAccount.findUnique({
      where: { userId },
    });

    if (!account?.stripeConnectAccountId) {
      throw new PayoutError('Payout account not found', PayoutErrorCodes.ACCOUNT_NOT_FOUND, 404);
    }

    // Fetch latest status from Stripe
    const stripeAccount = await this.stripeService.getConnectAccount(
      account.stripeConnectAccountId
    );

    // Determine status
    let status: PayoutAccountStatus = account.status;
    const verificationFields: string[] = [];

    if (stripeAccount.requirements?.currently_due) {
      verificationFields.push(...stripeAccount.requirements.currently_due);
    }
    if (stripeAccount.requirements?.eventually_due) {
      verificationFields.push(...stripeAccount.requirements.eventually_due);
    }

    if (stripeAccount.charges_enabled && stripeAccount.payouts_enabled) {
      status = 'ACTIVE';
    } else if (stripeAccount.requirements?.disabled_reason) {
      status = 'RESTRICTED';
    } else if (verificationFields.length > 0) {
      status = 'ONBOARDING';
    }

    // Update local record
    const updated = await this.prisma.payoutAccount.update({
      where: { userId },
      data: {
        status,
        chargesEnabled: stripeAccount.charges_enabled,
        payoutsEnabled: stripeAccount.payouts_enabled,
        detailsSubmitted: stripeAccount.details_submitted ?? false,
        currentlyDue: verificationFields,
        updatedAt: new Date(),
      },
    });

    this.logger.info({ userId, status }, 'Connect account status synced');

    return this.mapToAccountSummary(updated);
  }

  /**
   * Get payout account for a user
   */
  async getPayoutAccount(userId: string): Promise<PayoutAccountWithBalance | null> {
    const account = await this.prisma.payoutAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      return null;
    }

    // Get balance from Stripe if account is active
    let availableBalance = 0;
    let pendingBalance = 0;

    if (account.stripeConnectAccountId && account.payoutsEnabled) {
      try {
        const balance = await this.stripeService.getConnectAccountBalance(
          account.stripeConnectAccountId
        );

        const availableEntry = balance.available.find(
          (b) => b.currency === account.defaultCurrency?.toLowerCase()
        );
        const pendingEntry = balance.pending.find(
          (b) => b.currency === account.defaultCurrency?.toLowerCase()
        );

        availableBalance = (availableEntry?.amount ?? 0) / 100;
        pendingBalance = (pendingEntry?.amount ?? 0) / 100;
      } catch (error) {
        this.logger.warn({ error, userId }, 'Failed to fetch Stripe balance');
      }
    }

    // Get total paid out
    const totalPaidOut = await this.prisma.payout.aggregate({
      where: {
        payoutAccountId: account.id,
        status: 'PAID',
      },
      _sum: { amount: true },
    });

    return {
      ...this.mapToAccountSummary(account),
      availableBalance,
      pendingBalance,
      totalPaidOut: Number(totalPaidOut._sum.amount ?? 0),
    };
  }

  // ===========================================================================
  // PAYOUT OPERATIONS
  // ===========================================================================

  /**
   * Create a transfer to a freelancer's Connect account
   */
  async createTransfer(
    freelancerUserId: string,
    options: {
      amount: number;
      currency?: string;
      invoiceId?: string;
      contractId?: string;
      description?: string;
      metadata?: Record<string, string>;
    }
  ): Promise<PayoutResult> {
    this.logger.info({ freelancerUserId, options }, '[PayoutService] Creating transfer');

    // Get payout account
    const account = await this.prisma.payoutAccount.findUnique({
      where: { userId: freelancerUserId },
    });

    if (!account) {
      throw new PayoutError('Payout account not found', PayoutErrorCodes.ACCOUNT_NOT_FOUND, 404);
    }

    if (!account.stripeConnectAccountId) {
      throw new PayoutError(
        'Stripe account not configured',
        PayoutErrorCodes.ACCOUNT_NOT_READY,
        400
      );
    }

    if (!account.payoutsEnabled) {
      throw new PayoutError(
        'Payouts are not enabled for this account',
        PayoutErrorCodes.ACCOUNT_NOT_READY,
        400
      );
    }

    if (options.amount <= 0) {
      throw new PayoutError('Invalid payout amount', PayoutErrorCodes.INVALID_AMOUNT, 400);
    }

    // Determine reference type
    let referenceType: 'INVOICE' | 'CONTRACT' | null = null;
    if (options.invoiceId) {
      referenceType = 'INVOICE';
    } else if (options.contractId) {
      referenceType = 'CONTRACT';
    }

    // Create payout record
    const payout = await this.prisma.payout.create({
      data: {
        payoutAccountId: account.id,
        amount: new Prisma.Decimal(options.amount),
        currency: options.currency ?? 'USD',
        status: 'PENDING',
        referenceType,
        referenceId: options.invoiceId ?? options.contractId ?? null,
        description: options.description ?? null,
      },
    });

    try {
      // Create Stripe transfer
      const transfer = await this.stripeService.createTransfer({
        amount: options.amount,
        currency: options.currency ?? 'USD',
        destinationAccountId: account.stripeConnectAccountId,
        ...(options.contractId && { transferGroup: options.contractId }),
        ...(options.description && { description: options.description }),
        metadata: {
          payout_id: payout.id,
          user_id: freelancerUserId,
          invoice_id: options.invoiceId ?? '',
          contract_id: options.contractId ?? '',
          ...options.metadata,
        },
      });

      // Update payout with transfer ID
      const updated = await this.prisma.payout.update({
        where: { id: payout.id },
        data: {
          stripeTransferId: transfer.id,
          status: 'IN_TRANSIT',
          processedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      this.logger.info(
        { payoutId: payout.id, transferId: transfer.id, amount: options.amount },
        'Transfer created successfully'
      );

      return this.mapToPayoutResult(updated);
    } catch (error) {
      this.logger.error({ error, payoutId: payout.id }, 'Transfer failed');

      // Update payout as failed
      await this.prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: 'FAILED',
          failureCode: (error as Error).name,
          failureMessage: (error as Error).message,
          updatedAt: new Date(),
        },
      });

      throw new PayoutError('Transfer failed', PayoutErrorCodes.TRANSFER_FAILED, 502);
    }
  }

  /**
   * Create instant payout from Connect account to bank
   */
  async createInstantPayout(
    userId: string,
    amount: number,
    currency = 'USD'
  ): Promise<PayoutResult> {
    this.logger.info({ userId, amount }, '[PayoutService] Creating instant payout');

    const account = await this.prisma.payoutAccount.findUnique({
      where: { userId },
    });

    if (!account?.stripeConnectAccountId) {
      throw new PayoutError('Payout account not found', PayoutErrorCodes.ACCOUNT_NOT_FOUND, 404);
    }

    if (!account.payoutsEnabled) {
      throw new PayoutError('Payouts not enabled', PayoutErrorCodes.ACCOUNT_NOT_READY, 400);
    }

    // Check available balance
    const balance = await this.stripeService.getConnectAccountBalance(
      account.stripeConnectAccountId
    );
    const availableEntry = balance.available.find((b) => b.currency === currency.toLowerCase());
    const availableAmount = (availableEntry?.amount ?? 0) / 100;

    if (amount > availableAmount) {
      throw new PayoutError(
        `Insufficient balance. Available: $${availableAmount.toFixed(2)}`,
        PayoutErrorCodes.INSUFFICIENT_BALANCE,
        400
      );
    }

    // Create payout record
    const payoutRecord = await this.prisma.payout.create({
      data: {
        payoutAccountId: account.id,
        amount: new Prisma.Decimal(amount),
        currency,
        status: 'PENDING',
        description: 'Instant payout to bank account',
      },
    });

    try {
      // Create Stripe payout
      const stripePayout = await this.stripeService.createPayout(
        account.stripeConnectAccountId,
        amount,
        currency,
        {
          payout_id: payoutRecord.id,
          user_id: userId,
        }
      );

      // Update record
      const updated = await this.prisma.payout.update({
        where: { id: payoutRecord.id },
        data: {
          stripePayoutId: stripePayout.id,
          status: 'IN_TRANSIT',
          processedAt: new Date(),
          // Note: arrivedAt will be set when payout completes
          updatedAt: new Date(),
        },
      });

      this.logger.info(
        { payoutId: payoutRecord.id, stripePayoutId: stripePayout.id },
        'Instant payout initiated'
      );

      return this.mapToPayoutResult(updated);
    } catch (error) {
      this.logger.error({ error, payoutId: payoutRecord.id }, 'Instant payout failed');

      await this.prisma.payout.update({
        where: { id: payoutRecord.id },
        data: {
          status: 'FAILED',
          failureCode: (error as Error).name,
          failureMessage: (error as Error).message,
          updatedAt: new Date(),
        },
      });

      throw new PayoutError('Payout failed', PayoutErrorCodes.PAYOUT_FAILED, 502);
    }
  }

  // ===========================================================================
  // WEBHOOK HANDLERS
  // ===========================================================================

  /**
   * Handle Stripe account updated webhook
   */
  async handleAccountUpdated(stripeAccountId: string): Promise<void> {
    const account = await this.prisma.payoutAccount.findFirst({
      where: { stripeConnectAccountId: stripeAccountId },
    });

    if (!account) {
      this.logger.warn({ stripeAccountId }, 'Account not found for webhook');
      return;
    }

    await this.syncAccountStatus(account.userId);
  }

  /**
   * Handle Stripe payout paid webhook
   */
  async handlePayoutPaid(stripePayoutId: string): Promise<void> {
    const payout = await this.prisma.payout.findFirst({
      where: { stripePayoutId },
    });

    if (!payout) {
      this.logger.warn({ stripePayoutId }, 'Payout not found for webhook');
      return;
    }

    await this.prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: 'PAID',
        arrivedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    this.logger.info({ payoutId: payout.id }, 'Payout marked as paid');
  }

  /**
   * Handle Stripe payout failed webhook
   */
  async handlePayoutFailed(
    stripePayoutId: string,
    failureCode?: string,
    failureMessage?: string
  ): Promise<void> {
    const payout = await this.prisma.payout.findFirst({
      where: { stripePayoutId },
    });

    if (!payout) {
      this.logger.warn({ stripePayoutId }, 'Payout not found for webhook');
      return;
    }

    await this.prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: 'FAILED',
        ...(failureCode && { failureCode }),
        ...(failureMessage && { failureMessage }),
        updatedAt: new Date(),
      },
    });

    this.logger.info({ payoutId: payout.id, failureCode }, 'Payout marked as failed');
  }

  /**
   * Handle Stripe transfer paid webhook
   */
  async handleTransferPaid(stripeTransferId: string): Promise<void> {
    const payout = await this.prisma.payout.findFirst({
      where: { stripeTransferId },
    });

    if (!payout) {
      this.logger.warn({ stripeTransferId }, 'Payout not found for transfer webhook');
      return;
    }

    // Transfer paid means funds are in Connect account
    // Actual payout to bank happens separately
    await this.prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: 'PAID',
        arrivedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    this.logger.info({ payoutId: payout.id }, 'Transfer completed');
  }

  // ===========================================================================
  // QUERY METHODS
  // ===========================================================================

  /**
   * Get payout by ID
   */
  async getPayout(payoutId: string): Promise<PayoutResult | null> {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
    });

    return payout ? this.mapToPayoutResult(payout) : null;
  }

  /**
   * List payouts for a user
   */
  async listPayouts(
    userId: string,
    options?: PayoutListOptions
  ): Promise<{ data: PayoutResult[]; total: number }> {
    const account = await this.prisma.payoutAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      return { data: [], total: 0 };
    }

    const where: Prisma.PayoutWhereInput = {
      payoutAccountId: account.id,
    };

    if (options?.status) {
      where.status = Array.isArray(options.status) ? { in: options.status } : options.status;
    }

    if (options?.dateFrom || options?.dateTo) {
      where.createdAt = {};
      if (options.dateFrom) where.createdAt.gte = options.dateFrom;
      if (options.dateTo) where.createdAt.lte = options.dateTo;
    }

    const [payouts, total] = await Promise.all([
      this.prisma.payout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit ?? 20,
        skip: ((options?.page ?? 1) - 1) * (options?.limit ?? 20),
      }),
      this.prisma.payout.count({ where }),
    ]);

    return {
      data: payouts.map((p) => this.mapToPayoutResult(p)),
      total,
    };
  }

  /**
   * Get payout statistics for a user
   */
  async getPayoutStats(userId: string) {
    const account = await this.prisma.payoutAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      return {
        totalPaidOut: 0,
        pendingPayouts: 0,
        lastPayoutDate: null,
        payoutCount: 0,
      };
    }

    const [totalPaid, pendingPayouts, lastPayout, payoutCount] = await Promise.all([
      this.prisma.payout.aggregate({
        where: { payoutAccountId: account.id, status: 'PAID' },
        _sum: { amount: true },
      }),
      this.prisma.payout.aggregate({
        where: { payoutAccountId: account.id, status: { in: ['PENDING', 'IN_TRANSIT'] } },
        _sum: { amount: true },
      }),
      this.prisma.payout.findFirst({
        where: { payoutAccountId: account.id, status: 'PAID' },
        orderBy: { arrivedAt: 'desc' },
        select: { arrivedAt: true },
      }),
      this.prisma.payout.count({
        where: { payoutAccountId: account.id },
      }),
    ]);

    return {
      totalPaidOut: Number(totalPaid._sum.amount ?? 0),
      pendingPayouts: Number(pendingPayouts._sum.amount ?? 0),
      lastPayoutDate: lastPayout?.arrivedAt ?? null,
      payoutCount,
    };
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapToAccountSummary(account: any): PayoutAccountSummary {
    return {
      id: account.id,
      userId: account.userId,
      stripeConnectAccountId: account.stripeConnectAccountId,
      accountType: account.accountType,
      status: account.status,
      chargesEnabled: account.chargesEnabled,
      payoutsEnabled: account.payoutsEnabled,
      defaultCurrency: account.defaultCurrency ?? 'USD',
      requiresVerification: account.requiresVerification ?? false,
      verificationFields: account.verificationFields ?? [],
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapToPayoutResult(payout: any): PayoutResult {
    return {
      id: payout.id,
      amount: Number(payout.amount),
      currency: payout.currency,
      status: payout.status,
      stripeTransferId: payout.stripeTransferId,
      stripePayoutId: payout.stripePayoutId,
      estimatedArrival: payout.estimatedArrival,
      failureCode: payout.failureCode,
      failureMessage: payout.failureMessage,
    };
  }
}
