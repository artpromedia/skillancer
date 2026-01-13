// @ts-nocheck
/**
 * @module @skillancer/billing-svc/webhooks/handlers/subscription-handlers
 * Subscription webhook handlers for Stripe
 *
 * Handles:
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.paid
 * - invoice.payment_failed
 */

import { prisma } from '@skillancer/database';
import { logger } from '../../lib/logger.js';

import type Stripe from 'stripe';

// =============================================================================
// TYPES
// =============================================================================

type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID' | 'TRIALING' | 'PAUSED';

interface SubscriptionMetadata {
  userId?: string;
  planId?: string;
  tier?: 'free' | 'pro' | 'enterprise';
}

// =============================================================================
// SUBSCRIPTION CREATED
// =============================================================================

/**
 * Handle new subscription creation
 * - Activate premium features
 * - Update user tier
 * - Send welcome email
 * - Provision resources (Cockpit Pro, etc.)
 */
export async function handleSubscriptionCreated(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const metadata = subscription.metadata as SubscriptionMetadata;

  logger.info(
    {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status,
      tier: metadata.tier,
    },
    'Processing customer.subscription.created'
  );

  await prisma.$transaction(async (tx) => {
    // 1. Create/update subscription record
    await tx.subscription.upsert({
      where: { stripeSubscriptionId: subscription.id },
      create: {
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
        userId: metadata.userId!,
        status: mapStripeStatus(subscription.status),
        tier: metadata.tier || 'pro',
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      },
      update: {
        status: mapStripeStatus(subscription.status),
        tier: metadata.tier || 'pro',
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });

    // 2. Update user tier
    if (metadata.userId) {
      await tx.user.update({
        where: { id: metadata.userId },
        data: {
          subscriptionTier: metadata.tier || 'pro',
          subscriptionStatus: 'active',
        },
      });

      // 3. Provision premium features
      await provisionPremiumFeatures(tx, metadata.userId, metadata.tier || 'pro');
    }

    // 4. Audit log
    await tx.auditLog.create({
      data: {
        action: 'SUBSCRIPTION_CREATED',
        resourceType: 'subscription',
        resourceId: subscription.id,
        userId: metadata.userId || null,
        details: {
          subscriptionId: subscription.id,
          tier: metadata.tier,
          status: subscription.status,
        },
        ipAddress: 'webhook',
      },
    });
  });

  // 5. Send welcome email
  await sendSubscriptionWelcomeEmail(subscription, metadata);

  logger.info({ subscriptionId: subscription.id }, 'Subscription created handler completed');
}

/**
 * Provision premium features for user tier
 */
async function provisionPremiumFeatures(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string,
  tier: string
): Promise<void> {
  const features = getTierFeatures(tier);

  await tx.userFeature.upsert({
    where: { userId },
    create: {
      userId,
      ...features,
    },
    update: features,
  });

  logger.info({ userId, tier, features }, 'Premium features provisioned');
}

function getTierFeatures(tier: string): Record<string, boolean | number> {
  switch (tier) {
    case 'enterprise':
      return {
        maxProjects: 999,
        maxTeamMembers: 999,
        advancedAnalytics: true,
        prioritySupport: true,
        customBranding: true,
        apiAccess: true,
        ssoEnabled: true,
        auditLogs: true,
      };
    case 'pro':
      return {
        maxProjects: 50,
        maxTeamMembers: 20,
        advancedAnalytics: true,
        prioritySupport: true,
        customBranding: false,
        apiAccess: true,
        ssoEnabled: false,
        auditLogs: true,
      };
    default:
      return {
        maxProjects: 5,
        maxTeamMembers: 3,
        advancedAnalytics: false,
        prioritySupport: false,
        customBranding: false,
        apiAccess: false,
        ssoEnabled: false,
        auditLogs: false,
      };
  }
}

async function sendSubscriptionWelcomeEmail(
  subscription: Stripe.Subscription,
  metadata: SubscriptionMetadata
): Promise<void> {
  try {
    // TODO: Integrate with notification service
    logger.info(
      {
        userId: metadata.userId,
        tier: metadata.tier,
        subscriptionId: subscription.id,
      },
      'Subscription welcome email queued'
    );
  } catch (error) {
    logger.error(
      { error, subscriptionId: subscription.id },
      'Failed to send subscription welcome email'
    );
  }
}

// =============================================================================
// SUBSCRIPTION UPDATED
// =============================================================================

/**
 * Handle subscription update
 * - Handle plan changes
 * - Proration handling
 * - Feature access updates
 */
export async function handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const previousAttributes = event.data.previous_attributes as
    | Partial<Stripe.Subscription>
    | undefined;
  const metadata = subscription.metadata as SubscriptionMetadata;

  logger.info(
    {
      subscriptionId: subscription.id,
      status: subscription.status,
      previousStatus: previousAttributes?.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    'Processing customer.subscription.updated'
  );

  await prisma.$transaction(async (tx) => {
    // 1. Update subscription record
    const existingSub = await tx.subscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });

    await tx.subscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: mapStripeStatus(subscription.status),
        tier: metadata.tier || existingSub?.tier || 'pro',
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      },
    });

    // 2. Handle status changes
    const statusChanged =
      previousAttributes?.status && previousAttributes.status !== subscription.status;

    if (statusChanged) {
      await handleStatusChange(tx, subscription, previousAttributes?.status as string, metadata);
    }

    // 3. Handle tier changes
    if (metadata.userId && metadata.tier && existingSub?.tier !== metadata.tier) {
      await tx.user.update({
        where: { id: metadata.userId },
        data: { subscriptionTier: metadata.tier },
      });
      await provisionPremiumFeatures(tx, metadata.userId, metadata.tier);
    }

    // 4. Audit log
    await tx.auditLog.create({
      data: {
        action: 'SUBSCRIPTION_UPDATED',
        resourceType: 'subscription',
        resourceId: subscription.id,
        userId: metadata.userId || null,
        details: {
          subscriptionId: subscription.id,
          previousStatus: previousAttributes?.status,
          newStatus: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
        ipAddress: 'webhook',
      },
    });
  });

  logger.info({ subscriptionId: subscription.id }, 'Subscription updated handler completed');
}

async function handleStatusChange(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  subscription: Stripe.Subscription,
  previousStatus: string,
  metadata: SubscriptionMetadata
): Promise<void> {
  // Handle past_due -> active (payment recovered)
  if (previousStatus === 'past_due' && subscription.status === 'active') {
    logger.info({ subscriptionId: subscription.id }, 'Subscription recovered from past_due');
    // Re-enable features if they were degraded
    if (metadata.userId) {
      await provisionPremiumFeatures(tx, metadata.userId, metadata.tier || 'pro');
    }
  }

  // Handle active -> past_due (payment failed)
  if (previousStatus === 'active' && subscription.status === 'past_due') {
    logger.warn({ subscriptionId: subscription.id }, 'Subscription entered past_due status');
    // Start dunning process - handled by invoice.payment_failed
  }

  // Handle any -> canceled
  if (subscription.status === 'canceled') {
    logger.info({ subscriptionId: subscription.id }, 'Subscription canceled');
    if (metadata.userId) {
      await tx.user.update({
        where: { id: metadata.userId },
        data: {
          subscriptionTier: 'free',
          subscriptionStatus: 'canceled',
        },
      });
      await provisionPremiumFeatures(tx, metadata.userId, 'free');
    }
  }
}

// =============================================================================
// SUBSCRIPTION DELETED
// =============================================================================

/**
 * Handle subscription deletion
 * - Downgrade features
 * - Grace period handling
 * - Retention outreach trigger
 * - Data export reminder
 */
export async function handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const metadata = subscription.metadata as SubscriptionMetadata;

  logger.info(
    {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
    },
    'Processing customer.subscription.deleted'
  );

  await prisma.$transaction(async (tx) => {
    // 1. Update subscription record
    await tx.subscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
        endedAt: new Date(),
      },
    });

    // 2. Downgrade user to free tier
    if (metadata.userId) {
      await tx.user.update({
        where: { id: metadata.userId },
        data: {
          subscriptionTier: 'free',
          subscriptionStatus: 'canceled',
        },
      });

      // 3. Downgrade features with grace period
      await provisionPremiumFeatures(tx, metadata.userId, 'free');

      // 4. Schedule data export reminder
      await tx.scheduledJob.create({
        data: {
          type: 'DATA_EXPORT_REMINDER',
          scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          payload: {
            userId: metadata.userId,
            previousTier: metadata.tier,
          },
        },
      });
    }

    // 5. Audit log
    await tx.auditLog.create({
      data: {
        action: 'SUBSCRIPTION_DELETED',
        resourceType: 'subscription',
        resourceId: subscription.id,
        userId: metadata.userId || null,
        details: {
          subscriptionId: subscription.id,
          previousTier: metadata.tier,
        },
        ipAddress: 'webhook',
      },
    });
  });

  // 6. Trigger retention outreach
  await triggerRetentionOutreach(subscription, metadata);

  logger.info({ subscriptionId: subscription.id }, 'Subscription deleted handler completed');
}

async function triggerRetentionOutreach(
  subscription: Stripe.Subscription,
  metadata: SubscriptionMetadata
): Promise<void> {
  try {
    // TODO: Integrate with notification service
    logger.info(
      {
        userId: metadata.userId,
        subscriptionId: subscription.id,
      },
      'Retention outreach triggered'
    );
  } catch (error) {
    logger.error(
      { error, subscriptionId: subscription.id },
      'Failed to trigger retention outreach'
    );
  }
}

// =============================================================================
// INVOICE PAID
// =============================================================================

/**
 * Handle successful invoice payment
 */
export async function handleInvoicePaid(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;

  logger.info(
    {
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      amountPaid: invoice.amount_paid,
    },
    'Processing invoice.paid'
  );

  await prisma.$transaction(async (tx) => {
    // 1. Record invoice payment
    await tx.invoiceRecord.upsert({
      where: { stripeInvoiceId: invoice.id },
      create: {
        stripeInvoiceId: invoice.id,
        stripeCustomerId: invoice.customer as string,
        stripeSubscriptionId: invoice.subscription as string | null,
        amountDue: invoice.amount_due,
        amountPaid: invoice.amount_paid,
        currency: invoice.currency.toUpperCase(),
        status: 'PAID',
        paidAt: invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : new Date(),
        hostedInvoiceUrl: invoice.hosted_invoice_url || null,
        pdfUrl: invoice.invoice_pdf || null,
      },
      update: {
        status: 'PAID',
        amountPaid: invoice.amount_paid,
        paidAt: invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : new Date(),
      },
    });

    // 2. Clear any dunning state if exists
    if (invoice.subscription) {
      await tx.dunningState.deleteMany({
        where: { stripeSubscriptionId: invoice.subscription as string },
      });
    }
  });

  logger.info({ invoiceId: invoice.id }, 'Invoice paid handler completed');
}

// =============================================================================
// INVOICE PAYMENT FAILED
// =============================================================================

/**
 * Handle failed invoice payment (subscription dunning)
 * - Dunning email sequence
 * - Grace period start
 * - Feature degradation warning
 */
export async function handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;

  logger.warn(
    {
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      attemptCount: invoice.attempt_count,
      nextAttempt: invoice.next_payment_attempt,
    },
    'Processing invoice.payment_failed'
  );

  await prisma.$transaction(async (tx) => {
    // 1. Record failed invoice
    await tx.invoiceRecord.upsert({
      where: { stripeInvoiceId: invoice.id },
      create: {
        stripeInvoiceId: invoice.id,
        stripeCustomerId: invoice.customer as string,
        stripeSubscriptionId: invoice.subscription as string | null,
        amountDue: invoice.amount_due,
        amountPaid: invoice.amount_paid,
        currency: invoice.currency.toUpperCase(),
        status: 'PAYMENT_FAILED',
        attemptCount: invoice.attempt_count || 1,
      },
      update: {
        status: 'PAYMENT_FAILED',
        attemptCount: invoice.attempt_count || 1,
      },
    });

    // 2. Update/create dunning state
    if (invoice.subscription) {
      await tx.dunningState.upsert({
        where: { stripeSubscriptionId: invoice.subscription as string },
        create: {
          stripeSubscriptionId: invoice.subscription as string,
          stripeCustomerId: invoice.customer as string,
          stripeInvoiceId: invoice.id,
          attemptCount: invoice.attempt_count || 1,
          firstFailedAt: new Date(),
          lastAttemptAt: new Date(),
          nextAttemptAt: invoice.next_payment_attempt
            ? new Date(invoice.next_payment_attempt * 1000)
            : null,
          gracePeriodEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days grace
        },
        update: {
          attemptCount: invoice.attempt_count || 1,
          lastAttemptAt: new Date(),
          nextAttemptAt: invoice.next_payment_attempt
            ? new Date(invoice.next_payment_attempt * 1000)
            : null,
        },
      });

      // 3. Get subscription for user info
      const subscription = await tx.subscription.findUnique({
        where: { stripeSubscriptionId: invoice.subscription as string },
      });

      if (subscription) {
        // Schedule dunning email based on attempt count
        await scheduleDunningEmail(tx, invoice, subscription.userId);
      }
    }
  });

  logger.info({ invoiceId: invoice.id }, 'Invoice payment failed handler completed');
}

async function scheduleDunningEmail(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  invoice: Stripe.Invoice,
  userId: string
): Promise<void> {
  const attemptCount = invoice.attempt_count || 1;
  let emailType: string;
  let delayMs: number;

  switch (attemptCount) {
    case 1:
      emailType = 'DUNNING_FIRST_NOTICE';
      delayMs = 0; // Immediate
      break;
    case 2:
      emailType = 'DUNNING_SECOND_NOTICE';
      delayMs = 0;
      break;
    case 3:
      emailType = 'DUNNING_FINAL_WARNING';
      delayMs = 0;
      break;
    default:
      emailType = 'DUNNING_CANCELLATION_WARNING';
      delayMs = 0;
      break;
  }

  await tx.scheduledJob.create({
    data: {
      type: emailType,
      scheduledAt: new Date(Date.now() + delayMs),
      payload: {
        userId,
        invoiceId: invoice.id,
        amountDue: invoice.amount_due,
        currency: invoice.currency,
        attemptCount,
      },
    },
  });

  logger.info({ userId, emailType, attemptCount }, 'Dunning email scheduled');
}

// =============================================================================
// HELPERS
// =============================================================================

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  const statusMap: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    unpaid: 'UNPAID',
    trialing: 'TRIALING',
    incomplete: 'UNPAID',
    incomplete_expired: 'CANCELED',
    paused: 'PAUSED',
  };

  return statusMap[status] || 'ACTIVE';
}

