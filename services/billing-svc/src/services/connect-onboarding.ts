// @ts-nocheck
/**
 * @module @skillancer/billing-svc/services/connect-onboarding
 * Stripe Connect Onboarding Service
 *
 * Features:
 * - Express account creation
 * - Hosted onboarding flow
 * - Account status tracking
 * - Requirements monitoring
 * - Identity verification handling
 * - Payout capability checking
 * - Account dashboard access
 */

import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';

import { getStripe } from './stripe.service.js';

import type Stripe from 'stripe';

// =============================================================================
// TYPES
// =============================================================================

export type OnboardingStatus =
  | 'NOT_STARTED'
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'RESTRICTED'
  | 'COMPLETE'
  | 'DISABLED';

export interface OnboardingResult {
  success: boolean;
  accountId?: string;
  onboardingUrl?: string;
  status: OnboardingStatus;
  error?: string;
}

export interface AccountStatus {
  accountId: string;
  status: OnboardingStatus;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  requirements: {
    currentlyDue: string[];
    eventuallyDue: string[];
    pastDue: string[];
    pendingVerification: string[];
  };
  capabilities: Record<string, string>;
  payoutSchedule?: {
    delayDays: number;
    interval: string;
  };
}

export interface OnboardingRequirement {
  field: string;
  description: string;
  deadline?: Date;
  critical: boolean;
}

// =============================================================================
// CONNECT ONBOARDING SERVICE CLASS
// =============================================================================

export class ConnectOnboardingService {
  private stripe: Stripe;

  constructor() {
    this.stripe = getStripe();
  }

  /**
   * Start onboarding for a new freelancer
   */
  async startOnboarding(
    userId: string,
    email: string,
    options: {
      country?: string;
      businessType?: 'individual' | 'company';
      refreshUrl: string;
      returnUrl: string;
    }
  ): Promise<OnboardingResult> {
    logger.info({ userId, email, country: options.country }, 'Starting Connect onboarding');

    try {
      // Check for existing account
      const existingAccount = await prisma.stripeConnectedAccount.findFirst({
        where: { userId },
      });

      if (existingAccount && existingAccount.status === 'ACTIVE') {
        return {
          success: true,
          accountId: existingAccount.stripeAccountId,
          status: 'COMPLETE',
        };
      }

      let stripeAccountId: string;

      if (existingAccount) {
        // Resume existing onboarding
        stripeAccountId = existingAccount.stripeAccountId;
      } else {
        // Create new Express account
        const account = await this.stripe.accounts.create({
          type: 'express',
          country: options.country || 'US',
          email,
          business_type: options.businessType || 'individual',
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          metadata: {
            userId,
            platform: 'skillancer',
          },
          settings: {
            payouts: {
              schedule: {
                interval: 'daily',
                delay_days: 2,
              },
            },
          },
        });

        stripeAccountId = account.id;

        // Save account to database
        await prisma.stripeConnectedAccount.create({
          data: {
            userId,
            stripeAccountId: account.id,
            status: 'PENDING',
            country: options.country || 'US',
            businessType: options.businessType || 'individual',
            email,
          },
        });
      }

      // Create account link for hosted onboarding
      const accountLink = await this.stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: options.refreshUrl,
        return_url: options.returnUrl,
        type: 'account_onboarding',
        collect: 'eventually_due',
      });

      logger.info(
        {
          userId,
          stripeAccountId,
          expiresAt: accountLink.expires_at,
        },
        'Onboarding link created'
      );

      return {
        success: true,
        accountId: stripeAccountId,
        onboardingUrl: accountLink.url,
        status: 'IN_PROGRESS',
      };
    } catch (error) {
      const stripeError = error as Stripe.StripeError;
      const errorMessage = stripeError?.message || 'Unknown error';

      logger.error({ userId, error: errorMessage }, 'Failed to start onboarding');

      return {
        success: false,
        status: 'NOT_STARTED',
        error: errorMessage,
      };
    }
  }

  /**
   * Get current account status
   */
  async getAccountStatus(userId: string): Promise<AccountStatus | null> {
    const connectedAccount = await prisma.stripeConnectedAccount.findFirst({
      where: { userId },
    });

    if (!connectedAccount) {
      return null;
    }

    try {
      const account = await this.stripe.accounts.retrieve(connectedAccount.stripeAccountId);

      const status = this.determineOnboardingStatus(account);
      const requirements = {
        currentlyDue: account.requirements?.currently_due || [],
        eventuallyDue: account.requirements?.eventually_due || [],
        pastDue: account.requirements?.past_due || [],
        pendingVerification: account.requirements?.pending_verification || [],
      };

      // Update database if status changed
      if (status !== connectedAccount.status) {
        await prisma.stripeConnectedAccount.update({
          where: { id: connectedAccount.id },
          data: {
            status,
            payoutsEnabled: account.payouts_enabled,
            chargesEnabled: account.charges_enabled,
            detailsSubmitted: account.details_submitted,
            requirementsCurrentlyDue: requirements.currentlyDue,
            requirementsPastDue: requirements.pastDue,
            updatedAt: new Date(),
          },
        });
      }

      return {
        accountId: connectedAccount.stripeAccountId,
        status,
        payoutsEnabled: account.payouts_enabled || false,
        chargesEnabled: account.charges_enabled || false,
        detailsSubmitted: account.details_submitted || false,
        requirements,
        capabilities: account.capabilities as Record<string, string>,
        payoutSchedule: account.settings?.payouts?.schedule
          ? {
              delayDays: account.settings.payouts.schedule.delay_days || 2,
              interval: account.settings.payouts.schedule.interval || 'daily',
            }
          : undefined,
      };
    } catch (error) {
      logger.error({ userId, error }, 'Failed to get account status');
      throw error;
    }
  }

  /**
   * Generate dashboard login link for freelancer
   */
  async getDashboardLink(userId: string): Promise<string | null> {
    const connectedAccount = await prisma.stripeConnectedAccount.findFirst({
      where: { userId, status: { in: ['ACTIVE', 'RESTRICTED'] } },
    });

    if (!connectedAccount) {
      return null;
    }

    try {
      const loginLink = await this.stripe.accounts.createLoginLink(
        connectedAccount.stripeAccountId
      );

      return loginLink.url;
    } catch (error) {
      logger.error({ userId, error }, 'Failed to create dashboard link');
      return null;
    }
  }

  /**
   * Get required actions for account
   */
  async getRequiredActions(userId: string): Promise<OnboardingRequirement[]> {
    const status = await this.getAccountStatus(userId);
    if (!status) {
      return [];
    }

    const requirements: OnboardingRequirement[] = [];

    // Past due requirements are critical
    for (const field of status.requirements.pastDue) {
      requirements.push({
        field,
        description: this.getRequirementDescription(field),
        critical: true,
      });
    }

    // Currently due requirements
    for (const field of status.requirements.currentlyDue) {
      requirements.push({
        field,
        description: this.getRequirementDescription(field),
        critical: false,
      });
    }

    return requirements;
  }

  /**
   * Resume onboarding for incomplete account
   */
  async resumeOnboarding(
    userId: string,
    options: { refreshUrl: string; returnUrl: string }
  ): Promise<OnboardingResult> {
    const connectedAccount = await prisma.stripeConnectedAccount.findFirst({
      where: { userId },
    });

    if (!connectedAccount) {
      return {
        success: false,
        status: 'NOT_STARTED',
        error: 'No connected account found',
      };
    }

    if (connectedAccount.status === 'ACTIVE') {
      return {
        success: true,
        accountId: connectedAccount.stripeAccountId,
        status: 'COMPLETE',
      };
    }

    try {
      const accountLink = await this.stripe.accountLinks.create({
        account: connectedAccount.stripeAccountId,
        refresh_url: options.refreshUrl,
        return_url: options.returnUrl,
        type: 'account_onboarding',
        collect: 'eventually_due',
      });

      return {
        success: true,
        accountId: connectedAccount.stripeAccountId,
        onboardingUrl: accountLink.url,
        status: 'IN_PROGRESS',
      };
    } catch (error) {
      const stripeError = error as Stripe.StripeError;
      return {
        success: false,
        status: 'PENDING',
        error: stripeError?.message || 'Failed to resume onboarding',
      };
    }
  }

  /**
   * Handle account updated webhook
   */
  async handleAccountUpdated(stripeAccountId: string): Promise<void> {
    const connectedAccount = await prisma.stripeConnectedAccount.findFirst({
      where: { stripeAccountId },
    });

    if (!connectedAccount) {
      logger.warn({ stripeAccountId }, 'Account updated for unknown account');
      return;
    }

    // Get fresh status
    await this.getAccountStatus(connectedAccount.userId);
  }

  /**
   * Check if user can receive payouts
   */
  async canReceivePayouts(userId: string): Promise<{ eligible: boolean; reason?: string }> {
    const status = await this.getAccountStatus(userId);

    if (!status) {
      return { eligible: false, reason: 'No connected account' };
    }

    if (!status.payoutsEnabled) {
      if (status.requirements.pastDue.length > 0) {
        return {
          eligible: false,
          reason: `Past due requirements: ${status.requirements.pastDue.join(', ')}`,
        };
      }
      if (status.requirements.currentlyDue.length > 0) {
        return {
          eligible: false,
          reason: `Pending requirements: ${status.requirements.currentlyDue.join(', ')}`,
        };
      }
      return { eligible: false, reason: 'Payouts not enabled - verification pending' };
    }

    return { eligible: true };
  }

  /**
   * Update account payout settings
   */
  async updatePayoutSettings(
    userId: string,
    settings: {
      interval?: 'daily' | 'weekly' | 'monthly';
      weeklyAnchor?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
      monthlyAnchor?: number;
    }
  ): Promise<void> {
    const connectedAccount = await prisma.stripeConnectedAccount.findFirst({
      where: { userId, status: 'ACTIVE' },
    });

    if (!connectedAccount) {
      throw new Error('No active connected account');
    }

    const scheduleSettings: Stripe.AccountUpdateParams.Settings.Payouts.Schedule = {
      interval: settings.interval,
      weekly_anchor: settings.weeklyAnchor,
      monthly_anchor: settings.monthlyAnchor,
    };

    await this.stripe.accounts.update(connectedAccount.stripeAccountId, {
      settings: {
        payouts: {
          schedule: scheduleSettings,
        },
      },
    });

    logger.info({ userId, settings }, 'Payout settings updated');
  }

  /**
   * Get all accounts needing attention
   */
  async getAccountsNeedingAttention(): Promise<
    Array<{ userId: string; stripeAccountId: string; issues: string[] }>
  > {
    const problemAccounts = await prisma.stripeConnectedAccount.findMany({
      where: {
        OR: [{ status: 'RESTRICTED' }, { requirementsPastDue: { isEmpty: false } }],
      },
      select: {
        userId: true,
        stripeAccountId: true,
        requirementsPastDue: true,
        requirementsCurrentlyDue: true,
      },
    });

    return problemAccounts.map((account) => ({
      userId: account.userId,
      stripeAccountId: account.stripeAccountId,
      issues: [...(account.requirementsPastDue || []), ...(account.requirementsCurrentlyDue || [])],
    }));
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private determineOnboardingStatus(account: Stripe.Account): OnboardingStatus {
    if (account.requirements?.disabled_reason) {
      return 'DISABLED';
    }

    if (account.payouts_enabled && account.charges_enabled) {
      return 'COMPLETE';
    }

    if (account.requirements?.past_due && account.requirements.past_due.length > 0) {
      return 'RESTRICTED';
    }

    if (account.details_submitted) {
      if (account.requirements?.pending_verification?.length) {
        return 'PENDING';
      }
      return 'RESTRICTED';
    }

    if (account.requirements?.currently_due && account.requirements.currently_due.length > 0) {
      return 'IN_PROGRESS';
    }

    return 'NOT_STARTED';
  }

  private getRequirementDescription(field: string): string {
    const descriptions: Record<string, string> = {
      'business_profile.url': 'Add your business website URL',
      'business_profile.mcc': 'Select your business category',
      external_account: 'Add a bank account for payouts',
      'individual.address.city': 'Provide your city',
      'individual.address.line1': 'Provide your street address',
      'individual.address.postal_code': 'Provide your postal/ZIP code',
      'individual.address.state': 'Provide your state/province',
      'individual.dob.day': 'Provide your date of birth',
      'individual.dob.month': 'Provide your date of birth',
      'individual.dob.year': 'Provide your date of birth',
      'individual.email': 'Verify your email address',
      'individual.first_name': 'Provide your first name',
      'individual.last_name': 'Provide your last name',
      'individual.phone': 'Provide your phone number',
      'individual.ssn_last_4': 'Provide the last 4 digits of your SSN',
      'individual.id_number': 'Provide your tax ID number',
      'individual.verification.document': 'Upload an identity document',
      'individual.verification.additional_document': 'Upload an additional document',
      tos_acceptance: 'Accept the Stripe Terms of Service',
    };

    return descriptions[field] || `Complete: ${field.replace(/[._]/g, ' ')}`;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let connectService: ConnectOnboardingService | null = null;

export function getConnectOnboardingService(): ConnectOnboardingService {
  if (!connectService) {
    connectService = new ConnectOnboardingService();
  }
  return connectService;
}

