// @ts-nocheck - Known type issues pending refactor
/**
 * @module @skillancer/billing-svc/services/payout
 * Payout account management service (Stripe Connect)
 */

import { prisma } from '@skillancer/database';

import { getStripeService } from './stripe.service.js';
import { getConfig } from '../config/index.js';
import {
  PayoutAccountNotFoundError,
  PayoutAccountNotActiveError,
  PayoutAccountExistsError,
} from '../errors/index.js';

import type {
  PayoutAccountResponse,
  PayoutAccountStatus,
  PayoutAccountType,
  PayoutAccountRequirements,
  OnboardingLinkResponse,
  DashboardLinkResponse,
  PayoutResponse,
  CreatePayoutParams,
  ExternalAccountInfo,
} from '../types/index.js';
import type { PayoutAccount, Payout as PrismaPayout } from '@skillancer/database';
import type Stripe from 'stripe';

// =============================================================================
// TYPES
// =============================================================================

interface CreatePayoutAccountParams {
  country: string;
  businessType?: 'individual' | 'company';
  accountType?: 'EXPRESS' | 'STANDARD' | 'CUSTOM';
}

// =============================================================================
// PAYOUT ACCOUNT SERVICE
// =============================================================================

export class PayoutAccountService {
  private readonly stripeService = getStripeService();
  private readonly config = getConfig();

  // ===========================================================================
  // ACCOUNT MANAGEMENT
  // ===========================================================================

  /**
   * Get the payout account for a user
   */
  async getPayoutAccount(userId: string): Promise<PayoutAccountResponse | null> {
    const account = await prisma.payoutAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      return null;
    }

    return this.formatPayoutAccount(account);
  }

  /**
   * Create a payout account for a user
   */
  async createPayoutAccount(
    userId: string,
    email: string,
    params: CreatePayoutAccountParams
  ): Promise<{ account: PayoutAccountResponse; onboardingUrl: string }> {
    // Check if user already has a payout account
    const existing = await prisma.payoutAccount.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new PayoutAccountExistsError(userId);
    }

    // Map account type to Stripe type
    const stripeAccountType = this.mapAccountType(params.accountType);

    // Create Stripe Connect account
    const stripeAccount = await this.stripeService.createConnectAccount({
      email,
      country: params.country,
      type: stripeAccountType,
      businessType: params.businessType,
      metadata: {
        skillancer_user_id: userId,
      },
    });

    // Create local record
    const account = await prisma.payoutAccount.create({
      data: {
        userId,
        stripeConnectAccountId: stripeAccount.id,
        accountType: params.accountType ?? 'EXPRESS',
        status: 'PENDING',
        country: params.country,
        businessType: params.businessType ?? 'individual',
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
      },
    });

    // Create onboarding link
    const accountLink = await this.stripeService.createAccountLink({
      accountId: stripeAccount.id,
      refreshUrl: `${this.config.appUrl}/settings/payouts/refresh`,
      returnUrl: `${this.config.appUrl}/settings/payouts/complete`,
      type: 'account_onboarding',
    });

    return {
      account: this.formatPayoutAccount(account),
      onboardingUrl: accountLink.url,
    };
  }

  /**
   * Get onboarding link for incomplete account
   */
  async getOnboardingLink(userId: string): Promise<OnboardingLinkResponse> {
    const account = await prisma.payoutAccount.findUnique({
      where: { userId },
    });

    if (!account?.stripeConnectAccountId) {
      throw new PayoutAccountNotFoundError(userId);
    }

    const accountLink = await this.stripeService.createAccountLink({
      accountId: account.stripeConnectAccountId,
      refreshUrl: `${this.config.appUrl}/settings/payouts/refresh`,
      returnUrl: `${this.config.appUrl}/settings/payouts/complete`,
      type: 'account_onboarding',
    });

    return {
      onboardingUrl: accountLink.url,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };
  }

  /**
   * Get dashboard link for active Express account
   */
  async getDashboardLink(userId: string): Promise<DashboardLinkResponse> {
    const account = await prisma.payoutAccount.findUnique({
      where: { userId },
    });

    if (!account?.stripeConnectAccountId) {
      throw new PayoutAccountNotFoundError(userId);
    }

    if (account.accountType !== 'EXPRESS') {
      throw new Error('Dashboard link is only available for Express accounts');
    }

    if (account.status !== 'ACTIVE') {
      throw new PayoutAccountNotActiveError(userId);
    }

    const loginLink = await this.stripeService.createLoginLink(account.stripeConnectAccountId);

    return {
      dashboardUrl: loginLink.url,
    };
  }

  /**
   * Sync payout account status from Stripe
   */
  async syncPayoutAccountStatus(userId: string): Promise<PayoutAccountResponse> {
    const account = await prisma.payoutAccount.findUnique({
      where: { userId },
    });

    if (!account?.stripeConnectAccountId) {
      throw new PayoutAccountNotFoundError(userId);
    }

    const stripeAccount = await this.stripeService.getConnectAccount(
      account.stripeConnectAccountId
    );

    const updatedAccount = await this.updateFromStripeAccount(account.id, stripeAccount);
    return this.formatPayoutAccount(updatedAccount);
  }

  /**
   * Update local account from Stripe webhook data
   */
  async updateFromStripeAccount(
    accountId: string,
    stripeAccount: Stripe.Account
  ): Promise<PayoutAccount> {
    const status = this.determineAccountStatus(stripeAccount);

    // Extract external account info if available
    let externalAccountType: string | undefined;
    let externalAccountLast4: string | undefined;
    let externalAccountBank: string | undefined;

    if (stripeAccount.external_accounts?.data?.[0]) {
      const extAccount = stripeAccount.external_accounts.data[0];
      if (extAccount.object === 'bank_account') {
        externalAccountType = 'bank_account';
        externalAccountLast4 = extAccount.last4;
        externalAccountBank = extAccount.bank_name ?? undefined;
      } else if (extAccount.object === 'card') {
        externalAccountType = 'card';
        externalAccountLast4 = extAccount.last4;
      }
    }

    const data: Record<string, unknown> = {
      status,
      detailsSubmitted: stripeAccount.details_submitted,
      chargesEnabled: stripeAccount.charges_enabled,
      payoutsEnabled: stripeAccount.payouts_enabled,
      currentlyDue: stripeAccount.requirements?.currently_due ?? [],
      eventuallyDue: stripeAccount.requirements?.eventually_due ?? [],
      pastDue: stripeAccount.requirements?.past_due ?? [],
      country: stripeAccount.country,
      businessType: stripeAccount.business_type,
    };

    if (externalAccountType) data.externalAccountType = externalAccountType;
    if (externalAccountLast4) data.externalAccountLast4 = externalAccountLast4;
    if (externalAccountBank) data.externalAccountBank = externalAccountBank;

    if (stripeAccount.settings?.payouts?.schedule) {
      data.payoutSchedule = stripeAccount.settings.payouts.schedule;
    }

    return prisma.payoutAccount.update({
      where: { id: accountId },
      data,
    });
  }

  /**
   * Delete payout account (deactivate)
   */
  async deletePayoutAccount(userId: string): Promise<void> {
    const account = await prisma.payoutAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      throw new PayoutAccountNotFoundError(userId);
    }

    // Mark as disabled locally
    await prisma.payoutAccount.update({
      where: { id: account.id },
      data: { status: 'DISABLED' },
    });

    // Note: We don't delete the Stripe account as it may have historical data
    // The account can be reactivated if needed
  }

  // ===========================================================================
  // PAYOUTS (Transfers)
  // ===========================================================================

  /**
   * Create a payout to user's Connect account
   */
  async createPayout(userId: string, params: CreatePayoutParams): Promise<PayoutResponse> {
    const account = await prisma.payoutAccount.findUnique({
      where: { userId },
    });

    if (!account?.stripeConnectAccountId) {
      throw new PayoutAccountNotFoundError(userId);
    }

    if (account.status !== 'ACTIVE' || !account.payoutsEnabled) {
      throw new PayoutAccountNotActiveError(userId);
    }

    const currency = params.currency ?? account.defaultCurrency;

    // Create the transfer in Stripe
    const transfer = await this.stripeService.createTransfer({
      amount: params.amount,
      currency,
      destinationAccountId: account.stripeConnectAccountId,
      description: params.description,
      metadata: {
        skillancer_user_id: userId,
        reference_type: params.referenceType ?? '',
        reference_id: params.referenceId ?? '',
      },
    });

    // Create local record
    const payout = await prisma.payout.create({
      data: {
        payoutAccountId: account.id,
        stripeTransferId: transfer.id,
        amount: params.amount,
        currency,
        status: 'PENDING',
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        description: params.description,
      },
    });

    return this.formatPayout(payout);
  }

  /**
   * Get payouts for a user
   */
  async getPayouts(
    userId: string,
    options?: {
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ payouts: PayoutResponse[]; total: number }> {
    const account = await prisma.payoutAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      return { payouts: [], total: 0 };
    }

    const where: Record<string, unknown> = { payoutAccountId: account.id };
    if (options?.status) {
      where.status = options.status;
    }

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit ?? 20,
        skip: options?.offset ?? 0,
      }),
      prisma.payout.count({ where }),
    ]);

    return {
      payouts: payouts.map((p) => this.formatPayout(p)),
      total,
    };
  }

  /**
   * Get a specific payout
   */
  async getPayout(userId: string, payoutId: string): Promise<PayoutResponse> {
    const account = await prisma.payoutAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      throw new PayoutAccountNotFoundError(userId);
    }

    const payout = await prisma.payout.findFirst({
      where: {
        id: payoutId,
        payoutAccountId: account.id,
      },
    });

    if (!payout) {
      throw new Error('Payout not found');
    }

    return this.formatPayout(payout);
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private mapAccountType(type?: string): 'express' | 'standard' | 'custom' {
    switch (type) {
      case 'STANDARD':
        return 'standard';
      case 'CUSTOM':
        return 'custom';
      default:
        return 'express';
    }
  }

  private determineAccountStatus(account: Stripe.Account): PayoutAccountStatus {
    if (account.requirements?.disabled_reason) {
      return 'DISABLED';
    }
    if (account.requirements?.past_due?.length) {
      return 'RESTRICTED';
    }
    if (account.payouts_enabled && account.charges_enabled) {
      return 'ACTIVE';
    }
    if (account.details_submitted) {
      return 'ONBOARDING';
    }
    return 'PENDING';
  }

  private formatPayoutAccount(account: PayoutAccount): PayoutAccountResponse {
    const requirements: PayoutAccountRequirements = {
      currentlyDue: account.currentlyDue ?? [],
      eventuallyDue: account.eventuallyDue ?? [],
      pastDue: account.pastDue ?? [],
    };

    let externalAccount: ExternalAccountInfo | undefined;
    if (account.externalAccountType && account.externalAccountLast4) {
      externalAccount = {
        type: account.externalAccountType as 'bank_account' | 'card',
        last4: account.externalAccountLast4,
        bankName: account.externalAccountBank ?? undefined,
        currency: account.defaultCurrency ?? undefined,
        country: account.country ?? '',
      };
    }

    return {
      id: account.id,
      status: account.status as PayoutAccountStatus,
      accountType: account.accountType as PayoutAccountType,
      detailsSubmitted: account.detailsSubmitted,
      chargesEnabled: account.chargesEnabled,
      payoutsEnabled: account.payoutsEnabled,
      requirements,
      defaultCurrency: account.defaultCurrency ?? undefined,
      country: account.country ?? undefined,
      businessType: account.businessType ?? undefined,
      externalAccount,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }

  private formatPayout(payout: PrismaPayout): PayoutResponse {
    return {
      id: payout.id,
      amount: Number(payout.amount),
      currency: payout.currency,
      status: payout.status,
      referenceType: payout.referenceType ?? undefined,
      referenceId: payout.referenceId ?? undefined,
      description: payout.description ?? undefined,
      failureCode: payout.failureCode ?? undefined,
      failureMessage: payout.failureMessage ?? undefined,
      processedAt: payout.processedAt?.toISOString(),
      arrivedAt: payout.arrivedAt?.toISOString(),
      createdAt: payout.createdAt.toISOString(),
    };
  }
}

// =============================================================================
// SERVICE SINGLETON
// =============================================================================

let payoutServiceInstance: PayoutAccountService | null = null;

export function getPayoutAccountService(): PayoutAccountService {
  if (!payoutServiceInstance) {
    payoutServiceInstance = new PayoutAccountService();
  }
  return payoutServiceInstance;
}

export function resetPayoutAccountService(): void {
  payoutServiceInstance = null;
}

export function initializePayoutAccountService(): PayoutAccountService {
  return getPayoutAccountService();
}
