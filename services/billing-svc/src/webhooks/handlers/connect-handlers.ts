// @ts-nocheck
/**
 * @module @skillancer/billing-svc/webhooks/handlers/connect-handlers
 * Stripe Connect webhook handlers for freelancer payouts
 *
 * Handles:
 * - account.updated (onboarding status)
 * - payout.paid (successful payout)
 * - payout.failed (failed payout)
 * - transfer.created (platform transfers)
 */

import { prisma } from '@skillancer/database';

import { logger } from '../../lib/logger.js';

import type Stripe from 'stripe';

// =============================================================================
// TYPES
// =============================================================================

interface ConnectAccountMetadata {
  freelancerId?: string;
  userId?: string;
}

type OnboardingStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'REQUIRES_INFORMATION'
  | 'VERIFIED'
  | 'RESTRICTED'
  | 'REJECTED';

// =============================================================================
// ACCOUNT UPDATED
// =============================================================================

/**
 * Handle Connect account updates
 * - Track onboarding status
 * - Verify requirements completion
 * - Update payout eligibility
 * - Compliance status updates
 */
export async function handleAccountUpdated(event: Stripe.Event): Promise<void> {
  const account = event.data.object as Stripe.Account;
  const metadata = account.metadata as ConnectAccountMetadata;

  logger.info(
    {
      accountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirementsCurrentlyDue: account.requirements?.currently_due?.length,
    },
    'Processing account.updated'
  );

  await prisma.$transaction(async (tx) => {
    // 1. Determine onboarding status
    const onboardingStatus = determineOnboardingStatus(account);

    // 2. Update Connect account record
    await tx.connectAccount.upsert({
      where: { stripeAccountId: account.id },
      create: {
        stripeAccountId: account.id,
        userId: metadata.freelancerId || metadata.userId!,
        type: account.type as 'express' | 'standard' | 'custom',
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted || false,
        onboardingStatus,
        currentlyDue: account.requirements?.currently_due || [],
        eventuallyDue: account.requirements?.eventually_due || [],
        pastDue: account.requirements?.past_due || [],
        disabledReason: account.requirements?.disabled_reason || null,
        country: account.country || 'US',
        defaultCurrency: account.default_currency?.toUpperCase() || 'USD',
      },
      update: {
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted || false,
        onboardingStatus,
        currentlyDue: account.requirements?.currently_due || [],
        eventuallyDue: account.requirements?.eventually_due || [],
        pastDue: account.requirements?.past_due || [],
        disabledReason: account.requirements?.disabled_reason || null,
        updatedAt: new Date(),
      },
    });

    // 3. Update user payout eligibility
    if (metadata.freelancerId || metadata.userId) {
      const userId = metadata.freelancerId || metadata.userId!;
      await tx.user.update({
        where: { id: userId },
        data: {
          payoutsEnabled: account.payouts_enabled,
          onboardingComplete: onboardingStatus === 'VERIFIED',
        },
      });
    }

    // 4. Audit log
    await tx.auditLog.create({
      data: {
        action: 'CONNECT_ACCOUNT_UPDATED',
        resourceType: 'connect_account',
        resourceId: account.id,
        userId: metadata.freelancerId || metadata.userId || null,
        details: {
          accountId: account.id,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          onboardingStatus,
          requirementsCurrentlyDue: account.requirements?.currently_due,
        },
        ipAddress: 'webhook',
      },
    });
  });

  // 5. Notify user of status changes
  await notifyAccountStatusChange(account, metadata);

  logger.info({ accountId: account.id }, 'Account updated handler completed');
}

function determineOnboardingStatus(account: Stripe.Account): OnboardingStatus {
  if (
    account.requirements?.disabled_reason === 'rejected.fraud' ||
    account.requirements?.disabled_reason === 'rejected.other'
  ) {
    return 'REJECTED';
  }

  if (account.requirements?.disabled_reason) {
    return 'RESTRICTED';
  }

  if (account.payouts_enabled && account.charges_enabled && account.details_submitted) {
    return 'VERIFIED';
  }

  if ((account.requirements?.past_due?.length || 0) > 0) {
    return 'REQUIRES_INFORMATION';
  }

  if (account.details_submitted) {
    return 'IN_PROGRESS';
  }

  return 'PENDING';
}

async function notifyAccountStatusChange(
  account: Stripe.Account,
  metadata: ConnectAccountMetadata
): Promise<void> {
  try {
    const userId = metadata.freelancerId || metadata.userId;
    if (!userId) return;

    const status = determineOnboardingStatus(account);

    let message: string;
    switch (status) {
      case 'VERIFIED':
        message = 'Your payout account is now verified. You can receive payouts!';
        break;
      case 'REQUIRES_INFORMATION':
        message = 'Action required: Please complete your payout account setup to receive payments.';
        break;
      case 'RESTRICTED':
        message = 'Your payout account has been restricted. Please contact support.';
        break;
      case 'REJECTED':
        message = 'Your payout account application was not approved. Please contact support.';
        break;
      default:
        return; // Don't notify for in-progress statuses
    }

    // TODO: Integrate with notification service
    logger.info({ userId, status, message }, 'Account status notification queued');
  } catch (error) {
    logger.error({ error, accountId: account.id }, 'Failed to send account status notification');
  }
}

// =============================================================================
// PAYOUT PAID
// =============================================================================

/**
 * Handle successful payout to freelancer
 * - Confirm payout to freelancer
 * - Update transaction history
 * - Send payout notification
 * - Update available balance
 */
export async function handlePayoutPaid(event: Stripe.Event): Promise<void> {
  const payout = event.data.object as Stripe.Payout;

  logger.info(
    {
      payoutId: payout.id,
      amount: payout.amount,
      currency: payout.currency,
      arrivalDate: payout.arrival_date,
      destination: payout.destination,
    },
    'Processing payout.paid'
  );

  await prisma.$transaction(async (tx) => {
    // 1. Find the Connect account this payout belongs to
    // The payout is on a connected account, so we need to get the account ID from context
    const stripeAccountId = (event as unknown as { account?: string }).account;

    let connectAccount = null;
    if (stripeAccountId) {
      connectAccount = await tx.connectAccount.findUnique({
        where: { stripeAccountId },
      });
    }

    // 2. Record the payout
    await tx.payout.upsert({
      where: { stripePayoutId: payout.id },
      create: {
        stripePayoutId: payout.id,
        stripeAccountId: stripeAccountId || null,
        userId: connectAccount?.userId || null,
        amount: payout.amount,
        currency: payout.currency.toUpperCase(),
        status: 'PAID',
        arrivalDate: new Date(payout.arrival_date * 1000),
        method: payout.method,
        type: payout.type,
        description: payout.description || null,
        paidAt: new Date(),
      },
      update: {
        status: 'PAID',
        paidAt: new Date(),
        arrivalDate: new Date(payout.arrival_date * 1000),
      },
    });

    // 3. Update freelancer earnings
    if (connectAccount?.userId) {
      await tx.user.update({
        where: { id: connectAccount.userId },
        data: {
          totalEarned: { increment: payout.amount },
          lastPayoutAt: new Date(),
        },
      });

      // Update available balance
      await tx.userBalance.upsert({
        where: { userId: connectAccount.userId },
        create: {
          userId: connectAccount.userId,
          availableBalance: 0,
          pendingBalance: 0,
          currency: payout.currency.toUpperCase(),
        },
        update: {
          pendingBalance: { decrement: payout.amount },
        },
      });
    }

    // 4. Audit log
    await tx.auditLog.create({
      data: {
        action: 'PAYOUT_COMPLETED',
        resourceType: 'payout',
        resourceId: payout.id,
        userId: connectAccount?.userId || null,
        details: {
          payoutId: payout.id,
          amount: payout.amount,
          currency: payout.currency,
          arrivalDate: payout.arrival_date,
        },
        ipAddress: 'webhook',
      },
    });
  });

  // 5. Send payout confirmation notification
  await sendPayoutNotification(payout, event);

  logger.info({ payoutId: payout.id }, 'Payout paid handler completed');
}

async function sendPayoutNotification(payout: Stripe.Payout, event: Stripe.Event): Promise<void> {
  try {
    const stripeAccountId = (event as unknown as { account?: string }).account;
    if (!stripeAccountId) return;

    const connectAccount = await prisma.connectAccount.findUnique({
      where: { stripeAccountId },
      include: { user: true },
    });

    if (!connectAccount?.user) return;

    const formattedAmount = (payout.amount / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: payout.currency.toUpperCase(),
    });

    // TODO: Integrate with notification service
    logger.info(
      {
        userId: connectAccount.userId,
        amount: formattedAmount,
        arrivalDate: new Date(payout.arrival_date * 1000).toLocaleDateString(),
      },
      'Payout notification queued'
    );
  } catch (error) {
    logger.error({ error, payoutId: payout.id }, 'Failed to send payout notification');
  }
}

// =============================================================================
// PAYOUT FAILED
// =============================================================================

/**
 * Handle failed payout
 * - Alert freelancer
 * - Identify failure reason
 * - Provide remediation steps
 * - Track failure patterns
 */
export async function handlePayoutFailed(event: Stripe.Event): Promise<void> {
  const payout = event.data.object as Stripe.Payout;

  logger.error(
    {
      payoutId: payout.id,
      amount: payout.amount,
      currency: payout.currency,
      failureCode: payout.failure_code,
      failureMessage: payout.failure_message,
    },
    'Processing payout.failed'
  );

  const stripeAccountId = (event as unknown as { account?: string }).account;

  await prisma.$transaction(async (tx) => {
    // 1. Find Connect account
    let connectAccount = null;
    if (stripeAccountId) {
      connectAccount = await tx.connectAccount.findUnique({
        where: { stripeAccountId },
      });
    }

    // 2. Record/update payout failure
    await tx.payout.upsert({
      where: { stripePayoutId: payout.id },
      create: {
        stripePayoutId: payout.id,
        stripeAccountId: stripeAccountId || null,
        userId: connectAccount?.userId || null,
        amount: payout.amount,
        currency: payout.currency.toUpperCase(),
        status: 'FAILED',
        failureCode: payout.failure_code || 'unknown',
        failureMessage: payout.failure_message || 'Payout failed',
        method: payout.method,
        type: payout.type,
        failedAt: new Date(),
      },
      update: {
        status: 'FAILED',
        failureCode: payout.failure_code || 'unknown',
        failureMessage: payout.failure_message || 'Payout failed',
        failedAt: new Date(),
      },
    });

    // 3. Return funds to available balance
    if (connectAccount?.userId) {
      await tx.userBalance.upsert({
        where: { userId: connectAccount.userId },
        create: {
          userId: connectAccount.userId,
          availableBalance: payout.amount,
          pendingBalance: 0,
          currency: payout.currency.toUpperCase(),
        },
        update: {
          availableBalance: { increment: payout.amount },
          pendingBalance: { decrement: payout.amount },
        },
      });

      // 4. Track failure pattern
      await tx.payoutFailure.create({
        data: {
          userId: connectAccount.userId,
          stripePayoutId: payout.id,
          failureCode: payout.failure_code || 'unknown',
          failureMessage: payout.failure_message || 'Payout failed',
          amount: payout.amount,
          currency: payout.currency.toUpperCase(),
        },
      });

      // Check for repeated failures
      const recentFailures = await tx.payoutFailure.count({
        where: {
          userId: connectAccount.userId,
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
        },
      });

      if (recentFailures >= 3) {
        logger.warn(
          { userId: connectAccount.userId, failureCount: recentFailures },
          'Multiple payout failures detected'
        );
        // TODO: Trigger investigation
      }
    }

    // 5. Audit log
    await tx.auditLog.create({
      data: {
        action: 'PAYOUT_FAILED',
        resourceType: 'payout',
        resourceId: payout.id,
        userId: connectAccount?.userId || null,
        details: {
          payoutId: payout.id,
          amount: payout.amount,
          currency: payout.currency,
          failureCode: payout.failure_code,
          failureMessage: payout.failure_message,
        },
        ipAddress: 'webhook',
      },
    });
  });

  // 6. Send failure notification with remediation steps
  await sendPayoutFailureNotification(payout, event);

  logger.info({ payoutId: payout.id }, 'Payout failed handler completed');
}

async function sendPayoutFailureNotification(
  payout: Stripe.Payout,
  event: Stripe.Event
): Promise<void> {
  try {
    const stripeAccountId = (event as unknown as { account?: string }).account;
    if (!stripeAccountId) return;

    const connectAccount = await prisma.connectAccount.findUnique({
      where: { stripeAccountId },
    });

    if (!connectAccount) return;

    const remediationSteps = getPayoutFailureRemediation(payout.failure_code);

    // TODO: Integrate with notification service
    logger.info(
      {
        userId: connectAccount.userId,
        failureCode: payout.failure_code,
        remediationSteps,
      },
      'Payout failure notification queued'
    );
  } catch (error) {
    logger.error({ error, payoutId: payout.id }, 'Failed to send payout failure notification');
  }
}

function getPayoutFailureRemediation(failureCode: string | null): string[] {
  switch (failureCode) {
    case 'account_closed':
      return [
        'Your bank account appears to be closed',
        'Please add a new bank account to receive payouts',
      ];
    case 'account_frozen':
      return ['Your bank account is frozen', 'Contact your bank to resolve the issue'];
    case 'bank_account_restricted':
      return ['Your bank account has restrictions', 'Contact your bank for more information'];
    case 'bank_ownership_changed':
      return ['Bank account ownership has changed', 'Please verify your bank account again'];
    case 'could_not_process':
      return [
        'Your bank could not process this payout',
        'This may be temporary - we will retry automatically',
      ];
    case 'debit_not_authorized':
      return [
        'The debit was not authorized',
        'Please verify your bank account supports incoming transfers',
      ];
    case 'incorrect_account_holder_name':
      return [
        'The account holder name does not match',
        'Please update your bank account with the correct name',
      ];
    case 'invalid_account_number':
      return [
        'Invalid bank account number',
        'Please verify and re-enter your bank account details',
      ];
    case 'invalid_currency':
      return [
        'Your bank account does not support this currency',
        'Add a bank account that supports the payout currency',
      ];
    case 'no_account':
      return ['No bank account found', 'Please add a bank account to receive payouts'];
    default:
      return [
        'There was an issue with your payout',
        'Please check your bank account details and try again',
      ];
  }
}

// =============================================================================
// TRANSFER CREATED
// =============================================================================

/**
 * Handle transfer creation (platform transfers)
 * - Track platform transfers
 * - Reconciliation updates
 */
export async function handleTransferCreated(event: Stripe.Event): Promise<void> {
  const transfer = event.data.object as Stripe.Transfer;

  logger.info(
    {
      transferId: transfer.id,
      amount: transfer.amount,
      currency: transfer.currency,
      destination: transfer.destination,
    },
    'Processing transfer.created'
  );

  await prisma.$transaction(async (tx) => {
    // 1. Record the transfer
    await tx.transfer.upsert({
      where: { stripeTransferId: transfer.id },
      create: {
        stripeTransferId: transfer.id,
        destinationAccountId: transfer.destination as string,
        amount: transfer.amount,
        currency: transfer.currency.toUpperCase(),
        status: 'CREATED',
        description: transfer.description || null,
        metadata: (transfer.metadata || {}) as Record<string, unknown>,
      },
      update: {
        status: 'CREATED',
      },
    });

    // 2. Update destination account balance
    const connectAccount = await tx.connectAccount.findUnique({
      where: { stripeAccountId: transfer.destination as string },
    });

    if (connectAccount) {
      await tx.userBalance.upsert({
        where: { userId: connectAccount.userId },
        create: {
          userId: connectAccount.userId,
          availableBalance: transfer.amount,
          pendingBalance: 0,
          currency: transfer.currency.toUpperCase(),
        },
        update: {
          availableBalance: { increment: transfer.amount },
        },
      });
    }

    // 3. Audit log
    await tx.auditLog.create({
      data: {
        action: 'TRANSFER_CREATED',
        resourceType: 'transfer',
        resourceId: transfer.id,
        userId: connectAccount?.userId || null,
        details: {
          transferId: transfer.id,
          amount: transfer.amount,
          currency: transfer.currency,
          destination: transfer.destination,
        },
        ipAddress: 'webhook',
      },
    });
  });

  logger.info({ transferId: transfer.id }, 'Transfer created handler completed');
}

// =============================================================================
// ACCOUNT DEAUTHORIZED
// =============================================================================

/**
 * Handle account.application.deauthorized webhook
 * - Disconnect the Connect account
 * - Disable payouts
 * - Notify the freelancer
 * - Maintain audit trail
 */
export async function handleAccountDeauthorized(event: Stripe.Event): Promise<void> {
  const account = event.data.object as Stripe.Account;

  logger.info(
    {
      accountId: account.id,
    },
    'Processing account.application.deauthorized'
  );

  await prisma.$transaction(async (tx) => {
    // 1. Find the Connect account
    const connectAccount = await tx.connectAccount.findUnique({
      where: { stripeAccountId: account.id },
      include: { user: true },
    });

    if (!connectAccount) {
      logger.warn({ accountId: account.id }, 'Deauthorization for unknown account');
      return;
    }

    // 2. Disable the account
    await tx.connectAccount.update({
      where: { id: connectAccount.id },
      data: {
        onboardingStatus: 'DISABLED',
        chargesEnabled: false,
        payoutsEnabled: false,
        updatedAt: new Date(),
      },
    });

    // 3. Update user payout eligibility
    await tx.user.update({
      where: { id: connectAccount.userId },
      data: {
        payoutsEnabled: false,
        onboardingComplete: false,
      },
    });

    // 4. Audit log
    await tx.auditLog.create({
      data: {
        action: 'CONNECT_ACCOUNT_DEAUTHORIZED',
        resourceType: 'connect_account',
        resourceId: account.id,
        userId: connectAccount.userId,
        details: {
          accountId: account.id,
          reason: 'Application deauthorized by user or Stripe',
        },
        ipAddress: 'webhook',
      },
    });

    // 5. Create a notification for the freelancer
    await tx.notification.create({
      data: {
        userId: connectAccount.userId,
        type: 'SECURITY',
        title: 'Stripe Connect Disconnected',
        body: 'Your Stripe Connect account has been disconnected. Please reconnect if you want to continue receiving payouts.',
        read: false,
        channel: 'IN_APP',
      },
    });

    logger.info(
      { userId: connectAccount.userId, accountId: account.id },
      'Connect account deauthorized'
    );
  });
}
