// @ts-nocheck - Known type issues pending refactor
/**
 * @module @skillancer/billing-svc/handlers/stripe-webhook
 * Stripe webhook event handlers
 */

import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';

import { getPaymentMethodService } from '../services/payment-method.service.js';
import { getStripeService } from '../services/stripe.service.js';
import { getSubscriptionService } from '../services/subscription.service.js';

import type Stripe from 'stripe';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Remove undefined values from object (for Prisma exactOptionalPropertyTypes)
 */
function stripUndefined<T extends Record<string, unknown>>(
  obj: T
): { [K in keyof T]: Exclude<T[K], undefined> } {
  const result = {} as { [K in keyof T]: Exclude<T[K], undefined> };
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

// =============================================================================
// TYPES
// =============================================================================

export interface WebhookHandlerResult {
  handled: boolean;
  message?: string;
}

// =============================================================================
// WEBHOOK HANDLER
// =============================================================================

/**
 * Main webhook event router
 */
export async function handleStripeWebhook(event: Stripe.Event): Promise<WebhookHandlerResult> {
  logger.info(`[Stripe Webhook] Processing event: ${event.type}`);

  switch (event.type) {
    // Payment Method Events
    case 'payment_method.attached':
      return handlePaymentMethodAttached(event.data.object);

    case 'payment_method.detached':
      return handlePaymentMethodDetached(event.data.object);

    case 'payment_method.updated':
      return handlePaymentMethodUpdated(event.data.object);

    case 'payment_method.automatically_updated':
      return handlePaymentMethodAutoUpdated(event.data.object);

    // Customer Events
    case 'customer.updated':
      return handleCustomerUpdated(event.data.object);

    case 'customer.deleted':
      return handleCustomerDeleted(event.data.object);

    // Setup Intent Events
    case 'setup_intent.succeeded':
      return handleSetupIntentSucceeded(event.data.object);

    case 'setup_intent.setup_failed':
      return handleSetupIntentFailed(event.data.object);

    // Source/Card Expiring (legacy but still sent)
    case 'customer.source.expiring':
      return handleSourceExpiring(event.data.object);

    // Payment Intent Events
    case 'payment_intent.succeeded':
      return handlePaymentIntentSucceeded(event.data.object);

    case 'payment_intent.payment_failed':
      return handlePaymentIntentFailed(event.data.object);

    // Charge Events
    case 'charge.refunded':
      return handleChargeRefunded(event.data.object);

    // Connect Account Events
    case 'account.updated':
      return handleConnectAccountUpdated(event.data.object);

    // Transfer Events (eslint incorrectly flags these due to Stripe's event typing)
    /* eslint-disable @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-member-access */
    case 'transfer.created':
      return handleTransferCreated(event.data.object as Stripe.Transfer);

    case 'transfer.failed':
      return handleTransferFailed(event.data.object as Stripe.Transfer);

    case 'transfer.reversed':
      return handleTransferReversed(event.data.object as Stripe.Transfer);
    /* eslint-enable @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-member-access */

    // Escrow-related Payment Intent Events
    case 'payment_intent.amount_capturable_updated':
      return handlePaymentIntentAmountCapturableUpdated(event.data.object);

    case 'payment_intent.requires_action':
      return handlePaymentIntentRequiresAction(event.data.object);

    // Subscription Events
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      return handleSubscriptionUpdated(event.data.object);

    case 'customer.subscription.deleted':
      return handleSubscriptionDeleted(event.data.object);

    case 'customer.subscription.trial_will_end':
      return handleTrialWillEnd(event.data.object);

    case 'customer.subscription.paused':
    case 'customer.subscription.resumed':
      return handleSubscriptionStatusChange(event.data.object);

    // Invoice Events
    case 'invoice.created':
    case 'invoice.updated':
    case 'invoice.finalized':
      return handleInvoiceUpdated(event.data.object);

    case 'invoice.paid':
      return handleInvoicePaid(event.data.object);

    case 'invoice.payment_failed':
      return handleInvoicePaymentFailed(event.data.object);

    case 'invoice.voided':
      return handleInvoiceVoided(event.data.object);

    case 'invoice.upcoming':
      return handleInvoiceUpcoming(event.data.object);

    default:
      logger.info(`[Stripe Webhook] Unhandled event type: ${event.type}`);
      return { handled: false, message: `Unhandled event type: ${event.type}` };
  }
}

// =============================================================================
// PAYMENT METHOD HANDLERS
// =============================================================================

/**
 * Handle payment method attached to customer
 */
async function handlePaymentMethodAttached(
  paymentMethod: Stripe.PaymentMethod
): Promise<WebhookHandlerResult> {
  const stripeService = getStripeService();

  if (!paymentMethod.customer) {
    logger.info('[Stripe Webhook] Payment method attached without customer, skipping');
    return { handled: true, message: 'No customer attached' };
  }

  const customerId =
    typeof paymentMethod.customer === 'string' ? paymentMethod.customer : paymentMethod.customer.id;

  // Get user ID from Stripe customer
  const userId = await stripeService.getUserIdByStripeCustomerId(customerId);

  if (!userId) {
    logger.info(`[Stripe Webhook] No user found for Stripe customer ${customerId}`);
    return { handled: true, message: 'Customer not linked to user' };
  }

  // Check if we already have this payment method
  const existing = await prisma.paymentMethod.findUnique({
    where: { stripePaymentMethodId: paymentMethod.id },
  });

  if (existing) {
    logger.info(`[Stripe Webhook] Payment method ${paymentMethod.id} already exists`);
    return { handled: true, message: 'Payment method already exists' };
  }

  // Count existing methods for default determination
  const existingCount = await prisma.paymentMethod.count({
    where: { userId, status: { not: 'REMOVED' } },
  });

  // Create local record
  await prisma.paymentMethod.create({
    data: stripUndefined({
      userId,
      stripePaymentMethodId: paymentMethod.id,
      stripeCustomerId: customerId,
      type: mapStripeType(paymentMethod.type),
      isDefault: existingCount === 0,
      status: 'ACTIVE',
      // Card details
      cardBrand: paymentMethod.card?.brand,
      cardLast4: paymentMethod.card?.last4,
      cardExpMonth: paymentMethod.card?.exp_month,
      cardExpYear: paymentMethod.card?.exp_year,
      cardFunding: paymentMethod.card?.funding,
      fingerprint: paymentMethod.card?.fingerprint,
      // Bank details (ACH)
      bankName: paymentMethod.us_bank_account?.bank_name,
      bankLast4: paymentMethod.us_bank_account?.last4,
      bankAccountType: paymentMethod.us_bank_account?.account_type,
      bankRoutingLast4: paymentMethod.us_bank_account?.routing_number?.slice(-4),
      // SEPA details
      sepaCountry: paymentMethod.sepa_debit?.country,
      sepaBankCode: paymentMethod.sepa_debit?.bank_code,
      // Billing details
      billingName: paymentMethod.billing_details?.name,
      billingEmail: paymentMethod.billing_details?.email,
      billingCountry: paymentMethod.billing_details?.address?.country,
      billingPostalCode: paymentMethod.billing_details?.address?.postal_code,
    }),
  });

  // Send notification
  sendPaymentMethodAddedNotification(userId, paymentMethod);

  logger.info(`[Stripe Webhook] Payment method ${paymentMethod.id} attached for user ${userId}`);
  return { handled: true, message: 'Payment method created' };
}

/**
 * Handle payment method detached from customer
 */
async function handlePaymentMethodDetached(
  paymentMethod: Stripe.PaymentMethod
): Promise<WebhookHandlerResult> {
  const existing = await prisma.paymentMethod.findUnique({
    where: { stripePaymentMethodId: paymentMethod.id },
  });

  if (!existing) {
    logger.info(`[Stripe Webhook] Payment method ${paymentMethod.id} not found locally`);
    return { handled: true, message: 'Payment method not found' };
  }

  // Mark as removed
  await prisma.paymentMethod.update({
    where: { id: existing.id },
    data: { status: 'REMOVED' },
  });

  // If this was default, set new default
  if (existing.isDefault) {
    const nextDefault = await prisma.paymentMethod.findFirst({
      where: {
        userId: existing.userId,
        status: 'ACTIVE',
        id: { not: existing.id },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (nextDefault) {
      await prisma.paymentMethod.update({
        where: { id: nextDefault.id },
        data: { isDefault: true },
      });
    }
  }

  logger.info(`[Stripe Webhook] Payment method ${paymentMethod.id} detached`);
  return { handled: true, message: 'Payment method marked as removed' };
}

/**
 * Handle payment method updated
 */
async function handlePaymentMethodUpdated(
  paymentMethod: Stripe.PaymentMethod
): Promise<WebhookHandlerResult> {
  const existing = await prisma.paymentMethod.findUnique({
    where: { stripePaymentMethodId: paymentMethod.id },
  });

  if (!existing) {
    logger.info(`[Stripe Webhook] Payment method ${paymentMethod.id} not found locally`);
    return { handled: true, message: 'Payment method not found' };
  }

  // Update local record with latest data
  await prisma.paymentMethod.update({
    where: { id: existing.id },
    data: {
      cardBrand: paymentMethod.card?.brand ?? existing.cardBrand,
      cardExpMonth: paymentMethod.card?.exp_month ?? existing.cardExpMonth,
      cardExpYear: paymentMethod.card?.exp_year ?? existing.cardExpYear,
      billingName: paymentMethod.billing_details?.name ?? existing.billingName,
      billingEmail: paymentMethod.billing_details?.email ?? existing.billingEmail,
      billingCountry: paymentMethod.billing_details?.address?.country ?? existing.billingCountry,
      billingPostalCode:
        paymentMethod.billing_details?.address?.postal_code ?? existing.billingPostalCode,
    },
  });

  logger.info(`[Stripe Webhook] Payment method ${paymentMethod.id} updated`);
  return { handled: true, message: 'Payment method updated' };
}

/**
 * Handle card automatically updated by card network
 * (e.g., new expiry date after card renewal)
 */
async function handlePaymentMethodAutoUpdated(
  paymentMethod: Stripe.PaymentMethod
): Promise<WebhookHandlerResult> {
  const existing = await prisma.paymentMethod.findUnique({
    where: { stripePaymentMethodId: paymentMethod.id },
    include: { user: { select: { id: true, email: true, firstName: true } } },
  });

  if (!existing) {
    logger.info(`[Stripe Webhook] Payment method ${paymentMethod.id} not found locally`);
    return { handled: true, message: 'Payment method not found' };
  }

  // Update with new card details
  await prisma.paymentMethod.update({
    where: { id: existing.id },
    data: stripUndefined({
      cardBrand: paymentMethod.card?.brand,
      cardLast4: paymentMethod.card?.last4,
      cardExpMonth: paymentMethod.card?.exp_month,
      cardExpYear: paymentMethod.card?.exp_year,
      status: 'ACTIVE', // Reset status since card was renewed
      expirationWarningAt: null,
    }),
  });

  // Send notification about card update
  sendCardAutoUpdatedNotification(existing.user, paymentMethod);

  logger.info(`[Stripe Webhook] Payment method ${paymentMethod.id} auto-updated`);
  return { handled: true, message: 'Payment method auto-updated' };
}

// =============================================================================
// CUSTOMER HANDLERS
// =============================================================================

/**
 * Handle customer updated
 */
async function handleCustomerUpdated(customer: Stripe.Customer): Promise<WebhookHandlerResult> {
  const stripeCustomer = await prisma.stripeCustomer.findUnique({
    where: { stripeCustomerId: customer.id },
  });

  if (!stripeCustomer) {
    logger.info(`[Stripe Webhook] Stripe customer ${customer.id} not found locally`);
    return { handled: true, message: 'Customer not found' };
  }

  // Update currency if changed
  if (customer.currency) {
    await prisma.stripeCustomer.update({
      where: { id: stripeCustomer.id },
      data: { currency: customer.currency.toUpperCase() },
    });
  }

  // Check if default payment method changed
  const defaultMethodId = customer.invoice_settings?.default_payment_method;
  if (defaultMethodId) {
    const stripeMethodId =
      typeof defaultMethodId === 'string' ? defaultMethodId : defaultMethodId.id;

    // Update local default
    await prisma.$transaction([
      prisma.paymentMethod.updateMany({
        where: { userId: stripeCustomer.userId, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.paymentMethod.updateMany({
        where: {
          userId: stripeCustomer.userId,
          stripePaymentMethodId: stripeMethodId,
        },
        data: { isDefault: true },
      }),
    ]);
  }

  logger.info(`[Stripe Webhook] Customer ${customer.id} updated`);
  return { handled: true, message: 'Customer updated' };
}

/**
 * Handle customer deleted
 */
async function handleCustomerDeleted(customer: Stripe.Customer): Promise<WebhookHandlerResult> {
  const stripeCustomer = await prisma.stripeCustomer.findUnique({
    where: { stripeCustomerId: customer.id },
  });

  if (!stripeCustomer) {
    logger.info(`[Stripe Webhook] Stripe customer ${customer.id} not found locally`);
    return { handled: true, message: 'Customer not found' };
  }

  // Mark all payment methods as removed
  await prisma.paymentMethod.updateMany({
    where: { stripeCustomerId: customer.id },
    data: { status: 'REMOVED' },
  });

  // Delete stripe customer record
  await prisma.stripeCustomer.delete({
    where: { id: stripeCustomer.id },
  });

  logger.info(`[Stripe Webhook] Customer ${customer.id} deleted`);
  return { handled: true, message: 'Customer and payment methods removed' };
}

// =============================================================================
// SETUP INTENT HANDLERS
// =============================================================================

/**
 * Handle setup intent succeeded
 */
async function handleSetupIntentSucceeded(
  setupIntent: Stripe.SetupIntent
): Promise<WebhookHandlerResult> {
  const paymentMethodId = setupIntent.payment_method;

  if (!paymentMethodId) {
    logger.info('[Stripe Webhook] Setup intent succeeded without payment method');
    return { handled: true, message: 'No payment method in setup intent' };
  }

  const stripeMethodId = typeof paymentMethodId === 'string' ? paymentMethodId : paymentMethodId.id;

  // Check if payment method already exists
  const existing = await prisma.paymentMethod.findUnique({
    where: { stripePaymentMethodId: stripeMethodId },
  });

  if (existing) {
    // Update status if verification was pending
    if (existing.status === 'VERIFICATION_PENDING') {
      await prisma.paymentMethod.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE' },
      });
      logger.info(`[Stripe Webhook] Payment method ${stripeMethodId} verified`);
    }
    return { handled: true, message: 'Payment method already exists' };
  }

  // Payment method will be created via payment_method.attached event
  logger.info(`[Stripe Webhook] Setup intent ${setupIntent.id} succeeded`);
  return { handled: true, message: 'Setup intent succeeded' };
}

/**
 * Handle setup intent failed
 */
async function handleSetupIntentFailed(
  setupIntent: Stripe.SetupIntent
): Promise<WebhookHandlerResult> {
  const paymentMethodId = setupIntent.payment_method;

  if (paymentMethodId) {
    const stripeMethodId =
      typeof paymentMethodId === 'string' ? paymentMethodId : paymentMethodId.id;

    // Mark payment method as failed if it exists
    await prisma.paymentMethod.updateMany({
      where: { stripePaymentMethodId: stripeMethodId },
      data: { status: 'VERIFICATION_FAILED' },
    });
  }

  // Send notification about failure
  const userId = setupIntent.metadata?.userId;
  if (userId) {
    sendSetupFailedNotification(userId, setupIntent);
  }

  logger.info(`[Stripe Webhook] Setup intent ${setupIntent.id} failed`);
  return { handled: true, message: 'Setup intent failed' };
}

// =============================================================================
// SOURCE EXPIRING HANDLER
// =============================================================================

/**
 * Handle card/source expiring notification
 */
async function handleSourceExpiring(_source: Stripe.CustomerSource): Promise<WebhookHandlerResult> {
  // This event is sent for legacy sources, not PaymentMethods
  // But we handle it for completeness
  const paymentMethodService = getPaymentMethodService();

  // Check expiring cards
  const count = await paymentMethodService.checkExpiringCards();

  logger.info(`[Stripe Webhook] Checked ${count} expiring cards`);
  return { handled: true, message: `Processed ${count} expiring cards` };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Map Stripe payment method type to our enum
 */
function mapStripeType(stripeType: string): 'CARD' | 'ACH_DEBIT' | 'SEPA_DEBIT' | 'WIRE' {
  const typeMap: Record<string, 'CARD' | 'ACH_DEBIT' | 'SEPA_DEBIT' | 'WIRE'> = {
    card: 'CARD',
    us_bank_account: 'ACH_DEBIT',
    sepa_debit: 'SEPA_DEBIT',
  };

  return typeMap[stripeType] ?? 'CARD';
}

// =============================================================================
// NOTIFICATIONS
// =============================================================================

/**
 * Send payment method added notification
 * FUTURE: Integrate with notification service
 */
function sendPaymentMethodAddedNotification(
  userId: string,
  paymentMethod: Stripe.PaymentMethod
): void {
  logger.info(`[NOTIFICATION] Payment method added for user ${userId}:`, {
    type: paymentMethod.type,
    last4: paymentMethod.card?.last4 ?? paymentMethod.us_bank_account?.last4,
  });
}

/**
 * Send card auto-updated notification
 * FUTURE: Integrate with notification service
 */
function sendCardAutoUpdatedNotification(
  user: { id: string; email: string; firstName: string },
  paymentMethod: Stripe.PaymentMethod
): void {
  logger.info(`[NOTIFICATION] Card auto-updated for user ${user.email}:`, {
    brand: paymentMethod.card?.brand,
    last4: paymentMethod.card?.last4,
    expMonth: paymentMethod.card?.exp_month,
    expYear: paymentMethod.card?.exp_year,
  });
}

/**
 * Send setup failed notification
 * FUTURE: Integrate with notification service
 */
function sendSetupFailedNotification(userId: string, setupIntent: Stripe.SetupIntent): void {
  logger.info(`[NOTIFICATION] Setup intent failed for user ${userId}:`, {
    setupIntentId: setupIntent.id,
    error: setupIntent.last_setup_error?.message,
  });
}

// =============================================================================
// SUBSCRIPTION HANDLERS
// =============================================================================

/**
 * Handle subscription created or updated
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<WebhookHandlerResult> {
  const subscriptionService = getSubscriptionService();

  try {
    // Check if this is a period renewal (new billing cycle)
    const localSubscription = await subscriptionService.getSubscriptionByStripeId(subscription.id);

    if (localSubscription) {
      const previousPeriodEnd = localSubscription.currentPeriodEnd.getTime();
      const newPeriodEnd = subscription.current_period_end * 1000;

      // If period end has changed, this is a renewal
      if (newPeriodEnd > previousPeriodEnd) {
        await subscriptionService.handlePeriodRenewal(subscription);
        logger.info(`[Stripe Webhook] Subscription ${subscription.id} renewed`);
        return { handled: true, message: 'Subscription renewed' };
      }
    }

    // Standard sync for status and other changes
    await subscriptionService.syncSubscriptionStatus(subscription);
    logger.info(`[Stripe Webhook] Subscription ${subscription.id} updated`);
    return { handled: true, message: 'Subscription updated' };
  } catch (error) {
    logger.error(`[Stripe Webhook] Error updating subscription ${subscription.id}:`, error);
    return { handled: false, message: 'Failed to update subscription' };
  }
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<WebhookHandlerResult> {
  const subscriptionService = getSubscriptionService();

  try {
    await subscriptionService.syncSubscriptionStatus(subscription);

    // Get user ID for notification
    const localSub = await subscriptionService.getSubscriptionByStripeId(subscription.id);
    if (localSub) {
      sendSubscriptionCanceledNotification(localSub.userId, subscription);
    }

    logger.info(`[Stripe Webhook] Subscription ${subscription.id} deleted`);
    return { handled: true, message: 'Subscription deleted' };
  } catch (error) {
    logger.error(`[Stripe Webhook] Error deleting subscription ${subscription.id}:`, error);
    return { handled: false, message: 'Failed to delete subscription' };
  }
}

/**
 * Handle trial ending soon (3 days before)
 */
async function handleTrialWillEnd(
  subscription: Stripe.Subscription
): Promise<WebhookHandlerResult> {
  const subscriptionService = getSubscriptionService();

  try {
    const localSub = await subscriptionService.getSubscriptionByStripeId(subscription.id);
    if (localSub) {
      sendTrialEndingNotification(localSub.userId, subscription);
    }

    logger.info(`[Stripe Webhook] Trial will end for subscription ${subscription.id}`);
    return { handled: true, message: 'Trial ending notification sent' };
  } catch (error) {
    logger.error(`[Stripe Webhook] Error handling trial end for ${subscription.id}:`, error);
    return { handled: false, message: 'Failed to handle trial end' };
  }
}

/**
 * Handle subscription status changes (paused/resumed)
 */
async function handleSubscriptionStatusChange(
  subscription: Stripe.Subscription
): Promise<WebhookHandlerResult> {
  const subscriptionService = getSubscriptionService();

  try {
    await subscriptionService.syncSubscriptionStatus(subscription);
    logger.info(
      `[Stripe Webhook] Subscription ${subscription.id} status changed to ${subscription.status}`
    );
    return { handled: true, message: `Subscription status changed to ${subscription.status}` };
  } catch (error) {
    logger.error(`[Stripe Webhook] Error updating subscription status ${subscription.id}:`, error);
    return { handled: false, message: 'Failed to update subscription status' };
  }
}

// =============================================================================
// INVOICE HANDLERS
// =============================================================================

/**
 * Handle invoice created/updated/finalized
 */
async function handleInvoiceUpdated(invoice: Stripe.Invoice): Promise<WebhookHandlerResult> {
  const subscriptionService = getSubscriptionService();

  try {
    await subscriptionService.syncInvoice(invoice);
    logger.info(`[Stripe Webhook] Invoice ${invoice.id} synced`);
    return { handled: true, message: 'Invoice synced' };
  } catch (error) {
    logger.error(`[Stripe Webhook] Error syncing invoice ${invoice.id}:`, error);
    return { handled: false, message: 'Failed to sync invoice' };
  }
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<WebhookHandlerResult> {
  const subscriptionService = getSubscriptionService();

  try {
    // Sync invoice status
    await subscriptionService.syncInvoice(invoice);

    // Send confirmation
    if (invoice.subscription && typeof invoice.subscription === 'string') {
      const localSub = await subscriptionService.getSubscriptionByStripeId(invoice.subscription);
      if (localSub) {
        sendPaymentSuccessNotification(localSub.userId, invoice);
      }
    }

    logger.info(`[Stripe Webhook] Invoice ${invoice.id} paid`);
    return { handled: true, message: 'Invoice payment processed' };
  } catch (error) {
    logger.error(`[Stripe Webhook] Error processing paid invoice ${invoice.id}:`, error);
    return { handled: false, message: 'Failed to process paid invoice' };
  }
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<WebhookHandlerResult> {
  const subscriptionService = getSubscriptionService();

  try {
    // Sync invoice status
    await subscriptionService.syncInvoice(invoice);

    // Update subscription status if applicable
    if (invoice.subscription && typeof invoice.subscription === 'string') {
      const stripeService = getStripeService();
      const subscription = await stripeService.getSubscription(invoice.subscription);
      await subscriptionService.syncSubscriptionStatus(subscription);

      // Get local subscription for notification
      const localSub = await subscriptionService.getSubscriptionByStripeId(invoice.subscription);
      if (localSub) {
        sendPaymentFailedNotification(localSub.userId, invoice, invoice.attempt_count);
      }
    }

    logger.info(
      `[Stripe Webhook] Invoice ${invoice.id} payment failed (attempt ${invoice.attempt_count})`
    );
    return { handled: true, message: 'Invoice payment failure processed' };
  } catch (error) {
    logger.error(`[Stripe Webhook] Error processing failed invoice ${invoice.id}:`, error);
    return { handled: false, message: 'Failed to process invoice payment failure' };
  }
}

/**
 * Handle voided invoice
 */
async function handleInvoiceVoided(invoice: Stripe.Invoice): Promise<WebhookHandlerResult> {
  const subscriptionService = getSubscriptionService();

  try {
    await subscriptionService.syncInvoice(invoice);
    logger.info(`[Stripe Webhook] Invoice ${invoice.id} voided`);
    return { handled: true, message: 'Invoice voided' };
  } catch (error) {
    logger.error(`[Stripe Webhook] Error voiding invoice ${invoice.id}:`, error);
    return { handled: false, message: 'Failed to void invoice' };
  }
}

/**
 * Handle upcoming invoice notification
 */
async function handleInvoiceUpcoming(invoice: Stripe.Invoice): Promise<WebhookHandlerResult> {
  // This is sent ~3 days before each billing cycle
  // Useful for sending upcoming charge notifications
  const subscriptionService = getSubscriptionService();

  try {
    if (invoice.subscription && typeof invoice.subscription === 'string') {
      const localSub = await subscriptionService.getSubscriptionByStripeId(invoice.subscription);
      if (localSub) {
        sendUpcomingChargeNotification(localSub.userId, invoice);
      }
    }

    logger.info(`[Stripe Webhook] Upcoming invoice notification for ${invoice.id}`);
    return { handled: true, message: 'Upcoming invoice notification processed' };
  } catch (error) {
    logger.error(`[Stripe Webhook] Error processing upcoming invoice:`, error);
    return { handled: false, message: 'Failed to process upcoming invoice' };
  }
}

// =============================================================================
// SUBSCRIPTION & INVOICE NOTIFICATIONS
// =============================================================================

/**
 * Send subscription canceled notification
 * FUTURE: Integrate with notification service
 */
function sendSubscriptionCanceledNotification(
  userId: string,
  subscription: Stripe.Subscription
): void {
  logger.info(`[NOTIFICATION] Subscription canceled for user ${userId}:`, {
    subscriptionId: subscription.id,
    status: subscription.status,
    canceledAt: subscription.canceled_at,
  });
}

/**
 * Send trial ending notification
 * FUTURE: Integrate with notification service
 */
function sendTrialEndingNotification(userId: string, subscription: Stripe.Subscription): void {
  logger.info(`[NOTIFICATION] Trial ending soon for user ${userId}:`, {
    subscriptionId: subscription.id,
    trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
  });
}

/**
 * Send payment success notification
 * FUTURE: Integrate with notification service
 */
function sendPaymentSuccessNotification(userId: string, invoice: Stripe.Invoice): void {
  logger.info(`[NOTIFICATION] Payment successful for user ${userId}:`, {
    invoiceId: invoice.id,
    amount: invoice.amount_paid,
    currency: invoice.currency,
  });
}

/**
 * Send payment failed notification
 * FUTURE: Integrate with notification service
 */
function sendPaymentFailedNotification(
  userId: string,
  invoice: Stripe.Invoice,
  attemptCount: number
): void {
  logger.info(`[NOTIFICATION] Payment failed for user ${userId}:`, {
    invoiceId: invoice.id,
    amount: invoice.amount_due,
    currency: invoice.currency,
    attemptCount,
    nextAttempt: invoice.next_payment_attempt
      ? new Date(invoice.next_payment_attempt * 1000).toISOString()
      : null,
  });
}

/**
 * Send upcoming charge notification
 * FUTURE: Integrate with notification service
 */
function sendUpcomingChargeNotification(userId: string, invoice: Stripe.Invoice): void {
  logger.info(`[NOTIFICATION] Upcoming charge for user ${userId}:`, {
    amount: invoice.amount_due,
    currency: invoice.currency,
    dueDate: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
  });
}

// =============================================================================
// PAYMENT INTENT HANDLERS
// =============================================================================

/**
 * Handle payment intent succeeded
 */
async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
): Promise<WebhookHandlerResult> {
  try {
    // Check if this is an escrow payment intent
    const escrowContractId = paymentIntent.metadata?.escrowContractId;

    if (escrowContractId) {
      return await handleEscrowPaymentSucceeded(paymentIntent, escrowContractId);
    }

    // Update transaction if we have one (non-escrow)
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (transaction) {
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'SUCCEEDED',
          stripeChargeId:
            typeof paymentIntent.latest_charge === 'string'
              ? paymentIntent.latest_charge
              : paymentIntent.latest_charge?.id,
          processedAt: new Date(),
        },
      });

      logger.info(
        `[Stripe Webhook] Payment intent ${paymentIntent.id} succeeded for transaction ${transaction.id}`
      );
    } else {
      logger.info(
        `[Stripe Webhook] Payment intent ${paymentIntent.id} succeeded (no matching transaction)`
      );
    }

    return { handled: true, message: 'Payment intent succeeded processed' };
  } catch (error) {
    logger.error(`[Stripe Webhook] Error processing payment intent succeeded:`, error);
    return { handled: false, message: 'Failed to process payment intent succeeded' };
  }
}

/**
 * Handle escrow payment succeeded (funds captured)
 */
async function handleEscrowPaymentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  contractId: string
): Promise<WebhookHandlerResult> {
  try {
    const milestoneId = paymentIntent.metadata?.escrowMilestoneId;

    // Find the escrow transaction
    const escrowTransaction = await prisma.escrowTransaction.findFirst({
      where: { stripePaymentIntentId: paymentIntent.id },
      include: { escrowBalance: true },
    });

    if (escrowTransaction) {
      // Update transaction status to completed
      await prisma.escrowTransaction.update({
        where: { id: escrowTransaction.id },
        data: {
          status: 'COMPLETED',
          stripeChargeId:
            typeof paymentIntent.latest_charge === 'string'
              ? paymentIntent.latest_charge
              : paymentIntent.latest_charge?.id,
        },
      });

      // Update escrow balance - move from pending to available
      await prisma.escrowBalance.update({
        where: { id: escrowTransaction.escrowBalanceId },
        data: {
          pendingAmount: { decrement: paymentIntent.amount },
          totalAmount: { increment: paymentIntent.amount },
          availableAmount: { increment: paymentIntent.amount },
        },
      });

      // If milestone-based, update milestone status
      if (milestoneId) {
        await prisma.milestone.update({
          where: { id: milestoneId },
          data: { status: 'FUNDED' },
        });
      }

      // Send notifications
      sendEscrowFundedNotification(
        escrowTransaction.clientId,
        escrowTransaction.freelancerId,
        contractId,
        paymentIntent.amount,
        paymentIntent.currency.toUpperCase()
      );

      logger.info(
        `[Stripe Webhook] Escrow payment ${paymentIntent.id} succeeded for contract ${contractId}`
      );
    } else {
      // Transaction not found - might be direct capture without authorization
      logger.info(
        `[Stripe Webhook] Escrow payment ${paymentIntent.id} succeeded (no prior transaction)`
      );
    }

    return { handled: true, message: 'Escrow payment succeeded' };
  } catch (error) {
    logger.error(`[Stripe Webhook] Error processing escrow payment succeeded:`, error);
    return { handled: false, message: 'Failed to process escrow payment succeeded' };
  }
}

/**
 * Handle payment intent failed
 */
async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent
): Promise<WebhookHandlerResult> {
  try {
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (transaction) {
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'FAILED',
          failureCode: paymentIntent.last_payment_error?.code ?? 'payment_failed',
          failureMessage: paymentIntent.last_payment_error?.message ?? 'Payment failed',
        },
      });

      logger.info(
        `[Stripe Webhook] Payment intent ${paymentIntent.id} failed for transaction ${transaction.id}`
      );
    }

    return { handled: true, message: 'Payment intent failed processed' };
  } catch (error) {
    logger.error(`[Stripe Webhook] Error processing payment intent failed:`, error);
    return { handled: false, message: 'Failed to process payment intent failed' };
  }
}

/**
 * Handle charge refunded
 */
async function handleChargeRefunded(charge: Stripe.Charge): Promise<WebhookHandlerResult> {
  try {
    const paymentIntentId =
      typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;

    const transaction = await prisma.paymentTransaction.findFirst({
      where: {
        OR: [{ stripeChargeId: charge.id }, { stripePaymentIntentId: paymentIntentId }].filter(
          Boolean
        ),
      },
    });

    if (transaction) {
      const isFullRefund = charge.amount_refunded === charge.amount;

      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        },
      });

      logger.info(`[Stripe Webhook] Charge ${charge.id} refunded (full: ${isFullRefund})`);
    }

    return { handled: true, message: 'Charge refunded processed' };
  } catch (error) {
    logger.error(`[Stripe Webhook] Error processing charge refunded:`, error);
    return { handled: false, message: 'Failed to process charge refunded' };
  }
}

// =============================================================================
// CONNECT ACCOUNT HANDLERS
// =============================================================================

/**
 * Handle Connect account updated
 */
async function handleConnectAccountUpdated(account: Stripe.Account): Promise<WebhookHandlerResult> {
  try {
    const payoutAccount = await prisma.payoutAccount.findUnique({
      where: { stripeConnectAccountId: account.id },
    });

    if (!payoutAccount) {
      logger.info(`[Stripe Webhook] No payout account found for Stripe account ${account.id}`);
      return { handled: true, message: 'No matching payout account' };
    }

    // Determine status
    let status: 'PENDING' | 'ONBOARDING' | 'ACTIVE' | 'RESTRICTED' | 'DISABLED' = 'PENDING';
    if (account.requirements?.disabled_reason) {
      status = 'DISABLED';
    } else if (account.requirements?.past_due?.length) {
      status = 'RESTRICTED';
    } else if (account.payouts_enabled && account.charges_enabled) {
      status = 'ACTIVE';
    } else if (account.details_submitted) {
      status = 'ONBOARDING';
    }

    // Extract external account info
    const updateData: Record<string, unknown> = {
      status,
      detailsSubmitted: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      currentlyDue: account.requirements?.currently_due ?? [],
      eventuallyDue: account.requirements?.eventually_due ?? [],
      pastDue: account.requirements?.past_due ?? [],
      country: account.country,
      businessType: account.business_type,
    };

    if (account.external_accounts?.data?.[0]) {
      const extAccount = account.external_accounts.data[0];
      if (extAccount.object === 'bank_account') {
        updateData.externalAccountType = 'bank_account';
        updateData.externalAccountLast4 = extAccount.last4;
        updateData.externalAccountBank = extAccount.bank_name;
      }
    }

    if (account.settings?.payouts?.schedule) {
      updateData.payoutSchedule = account.settings.payouts.schedule;
    }

    await prisma.payoutAccount.update({
      where: { id: payoutAccount.id },
      data: updateData,
    });

    logger.info(`[Stripe Webhook] Connect account ${account.id} updated to status ${status}`);
    return { handled: true, message: 'Connect account updated' };
  } catch (error) {
    logger.error(`[Stripe Webhook] Error processing Connect account update:`, error);
    return { handled: false, message: 'Failed to process Connect account update' };
  }
}

/**
 * Handle transfer created
 */
async function handleTransferCreated(transfer: Stripe.Transfer): Promise<WebhookHandlerResult> {
  try {
    // Check if this is a payout transfer
    const payout = await prisma.payout.findUnique({
      where: { stripeTransferId: transfer.id },
    });

    if (payout) {
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: 'IN_TRANSIT',
          processedAt: new Date(),
        },
      });

      logger.info(`[Stripe Webhook] Transfer ${transfer.id} created for payout`);
      return { handled: true, message: 'Payout transfer created processed' };
    }

    // Check if this is an escrow transfer (release to freelancer)
    const escrowContractId = transfer.metadata?.escrowContractId;

    if (escrowContractId) {
      // Find or update escrow transaction
      let escrowTransaction = await prisma.escrowTransaction.findFirst({
        where: { stripeTransferId: transfer.id },
      });

      if (escrowTransaction) {
        // Update existing transaction
        await prisma.escrowTransaction.update({
          where: { id: escrowTransaction.id },
          data: { status: 'COMPLETED' },
        });
      } else {
        // Find pending release transaction for this contract
        escrowTransaction = await prisma.escrowTransaction.findFirst({
          where: {
            contractId: escrowContractId,
            type: 'RELEASE',
            status: 'PENDING',
          },
          orderBy: { createdAt: 'desc' },
        });

        if (escrowTransaction) {
          await prisma.escrowTransaction.update({
            where: { id: escrowTransaction.id },
            data: {
              stripeTransferId: transfer.id,
              status: 'COMPLETED',
            },
          });
        }
      }

      if (escrowTransaction) {
        // Send notification about escrow release
        sendEscrowReleasedNotification(
          escrowTransaction.freelancerId,
          escrowContractId,
          transfer.amount,
          transfer.currency.toUpperCase()
        );

        logger.info(
          `[Stripe Webhook] Escrow transfer ${transfer.id} created for contract ${escrowContractId}`
        );
        return { handled: true, message: 'Escrow transfer created processed' };
      }
    }

    logger.info(`[Stripe Webhook] Transfer ${transfer.id} created (no matching record)`);
    return { handled: true, message: 'Transfer created processed' };
  } catch (error) {
    logger.error(`[Stripe Webhook] Error processing transfer created:`, error);
    return { handled: false, message: 'Failed to process transfer created' };
  }
}

/**
 * Handle transfer failed
 */
async function handleTransferFailed(transfer: Stripe.Transfer): Promise<WebhookHandlerResult> {
  try {
    const payout = await prisma.payout.findUnique({
      where: { stripeTransferId: transfer.id },
    });

    if (payout) {
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: 'FAILED',
          // Transfer failures are usually due to destination account issues
          failureCode: 'transfer_failed',
          failureMessage: 'Transfer to destination account failed',
        },
      });

      logger.info(`[Stripe Webhook] Transfer ${transfer.id} failed`);
    }

    // Check if this is an escrow transfer
    const escrowTransaction = await prisma.escrowTransaction.findFirst({
      where: { stripeTransferId: transfer.id },
      include: { milestone: true },
    });

    if (escrowTransaction) {
      await prisma.escrowTransaction.update({
        where: { id: escrowTransaction.id },
        data: { status: 'FAILED' },
      });

      // Send notification about failed escrow release
      sendEscrowTransferFailedNotification(
        escrowTransaction.freelancerId,
        escrowTransaction.contractId,
        escrowTransaction.amount
      );

      logger.info(
        `[Stripe Webhook] Escrow transfer ${transfer.id} failed for contract ${escrowTransaction.contractId}`
      );
    }

    return { handled: true, message: 'Transfer failed processed' };
  } catch (error) {
    logger.error(`[Stripe Webhook] Error processing transfer failed:`, error);
    return { handled: false, message: 'Failed to process transfer failed' };
  }
}

// =============================================================================
// ESCROW WEBHOOK HANDLERS
// =============================================================================

/**
 * Handle transfer reversed (for escrow refunds)
 */
async function handleTransferReversed(transfer: Stripe.Transfer): Promise<WebhookHandlerResult> {
  try {
    // Check if this is an escrow transfer reversal
    const escrowTransaction = await prisma.escrowTransaction.findFirst({
      where: { stripeTransferId: transfer.id },
      include: { escrowBalance: true },
    });

    if (escrowTransaction) {
      // Update the original transaction
      await prisma.escrowTransaction.update({
        where: { id: escrowTransaction.id },
        data: { status: 'REFUNDED' },
      });

      // Create a reversal record
      await prisma.escrowTransaction.create({
        data: {
          escrowBalanceId: escrowTransaction.escrowBalanceId,
          contractId: escrowTransaction.contractId,
          milestoneId: escrowTransaction.milestoneId,
          clientId: escrowTransaction.clientId,
          freelancerId: escrowTransaction.freelancerId,
          type: 'REVERSAL',
          status: 'COMPLETED',
          amount: -escrowTransaction.amount,
          platformFee: 0,
          stripeFee: 0,
          netAmount: -escrowTransaction.amount,
          currency: escrowTransaction.currency,
          description: `Reversal of transfer ${transfer.id}`,
        },
      });

      // Update escrow balance
      if (escrowTransaction.escrowBalance) {
        await prisma.escrowBalance.update({
          where: { id: escrowTransaction.escrowBalanceId },
          data: {
            releasedAmount: {
              decrement: escrowTransaction.amount,
            },
            totalAmount: {
              increment: escrowTransaction.amount,
            },
            availableAmount: {
              increment: escrowTransaction.amount,
            },
          },
        });
      }

      logger.info(`[Stripe Webhook] Transfer ${transfer.id} reversed for escrow`);
      return { handled: true, message: 'Escrow transfer reversal processed' };
    }

    logger.info(`[Stripe Webhook] Transfer ${transfer.id} reversed (not escrow-related)`);
    return { handled: true, message: 'Transfer reversal processed' };
  } catch (error) {
    logger.error(`[Stripe Webhook] Error processing transfer reversed:`, error);
    return { handled: false, message: 'Failed to process transfer reversed' };
  }
}

/**
 * Handle payment intent amount capturable updated
 * This is triggered when funds are authorized and ready to be captured (escrow hold)
 */
async function handlePaymentIntentAmountCapturableUpdated(
  paymentIntent: Stripe.PaymentIntent
): Promise<WebhookHandlerResult> {
  try {
    // Check if this is an escrow payment intent
    const escrowContractId = paymentIntent.metadata?.escrowContractId;
    const escrowMilestoneId = paymentIntent.metadata?.escrowMilestoneId;

    if (!escrowContractId) {
      // Not an escrow payment
      return { handled: true, message: 'Not an escrow payment intent' };
    }

    // Find or create escrow transaction
    let escrowTransaction = await prisma.escrowTransaction.findFirst({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (escrowTransaction) {
      // Update existing transaction
      await prisma.escrowTransaction.update({
        where: { id: escrowTransaction.id },
        data: {
          status: 'AUTHORIZED',
          amount: paymentIntent.amount_capturable,
        },
      });
    } else {
      // Get escrow balance for contract
      const escrowBalance = await prisma.escrowBalance.findUnique({
        where: { contractId: escrowContractId },
      });

      if (!escrowBalance) {
        logger.error(`[Stripe Webhook] No escrow balance found for contract ${escrowContractId}`);
        return { handled: false, message: 'Escrow balance not found' };
      }

      // Create transaction for the authorized amount
      escrowTransaction = await prisma.escrowTransaction.create({
        data: {
          escrowBalanceId: escrowBalance.id,
          contractId: escrowContractId,
          milestoneId: escrowMilestoneId,
          clientId: escrowBalance.clientId,
          freelancerId: escrowBalance.freelancerId,
          type: 'DEPOSIT',
          status: 'AUTHORIZED',
          amount: paymentIntent.amount_capturable,
          platformFee: 0, // Will be calculated on capture
          stripeFee: 0, // Will be calculated on capture
          netAmount: paymentIntent.amount_capturable,
          currency: paymentIntent.currency.toUpperCase(),
          stripePaymentIntentId: paymentIntent.id,
          description: escrowMilestoneId
            ? `Escrow deposit for milestone`
            : `Escrow deposit for contract ${escrowContractId}`,
        },
      });

      // Update escrow balance with authorized amount
      await prisma.escrowBalance.update({
        where: { id: escrowBalance.id },
        data: {
          pendingAmount: {
            increment: paymentIntent.amount_capturable,
          },
        },
      });

      logger.info(
        `[Stripe Webhook] Escrow payment ${paymentIntent.id} authorized for ${paymentIntent.amount_capturable}`
      );
    }

    // Send notification to client about successful escrow hold
    sendEscrowAuthorizedNotification(
      escrowTransaction.clientId,
      escrowContractId,
      paymentIntent.amount_capturable,
      paymentIntent.currency.toUpperCase()
    );

    return { handled: true, message: 'Escrow payment authorized' };
  } catch (error) {
    logger.error(`[Stripe Webhook] Error processing escrow amount capturable:`, error);
    return { handled: false, message: 'Failed to process escrow authorization' };
  }
}

/**
 * Handle payment intent requires action
 * This can happen when 3DS authentication is required for escrow funding
 */
async function handlePaymentIntentRequiresAction(
  paymentIntent: Stripe.PaymentIntent
): Promise<WebhookHandlerResult> {
  try {
    const escrowContractId = paymentIntent.metadata?.escrowContractId;

    if (!escrowContractId) {
      // Not an escrow payment
      return { handled: true, message: 'Not an escrow payment intent' };
    }

    // Update transaction status if exists
    const escrowTransaction = await prisma.escrowTransaction.findFirst({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (escrowTransaction) {
      await prisma.escrowTransaction.update({
        where: { id: escrowTransaction.id },
        data: { status: 'PENDING' },
      });
    }

    // Send notification to client about required action
    const escrowBalance = await prisma.escrowBalance.findUnique({
      where: { contractId: escrowContractId },
    });

    if (escrowBalance) {
      sendEscrowActionRequiredNotification(
        escrowBalance.clientId,
        escrowContractId,
        paymentIntent.id
      );
    }

    logger.info(`[Stripe Webhook] Escrow payment ${paymentIntent.id} requires action`);
    return { handled: true, message: 'Escrow payment requires action notification sent' };
  } catch (error) {
    logger.error(`[Stripe Webhook] Error processing escrow requires action:`, error);
    return { handled: false, message: 'Failed to process escrow requires action' };
  }
}

// =============================================================================
// ESCROW NOTIFICATIONS
// =============================================================================

/**
 * Send notification about escrow transfer failure
 * FUTURE: Integrate with notification service
 */
function sendEscrowTransferFailedNotification(
  freelancerId: string,
  contractId: string,
  amount: number
): void {
  logger.info(`[NOTIFICATION] Escrow transfer failed for freelancer ${freelancerId}:`, {
    contractId,
    amount,
  });
}

/**
 * Send notification about escrow authorization
 * FUTURE: Integrate with notification service
 */
function sendEscrowAuthorizedNotification(
  clientId: string,
  contractId: string,
  amount: number,
  currency: string
): void {
  logger.info(`[NOTIFICATION] Escrow funds authorized for client ${clientId}:`, {
    contractId,
    amount,
    currency,
  });
}

/**
 * Send notification about escrow action required (3DS)
 * FUTURE: Integrate with notification service
 */
function sendEscrowActionRequiredNotification(
  clientId: string,
  contractId: string,
  paymentIntentId: string
): void {
  logger.info(`[NOTIFICATION] Escrow payment action required for client ${clientId}:`, {
    contractId,
    paymentIntentId,
  });
}

/**
 * Send notification about escrow funds captured
 * FUTURE: Integrate with notification service
 */
function sendEscrowFundedNotification(
  clientId: string,
  freelancerId: string,
  contractId: string,
  amount: number,
  currency: string
): void {
  logger.info(`[NOTIFICATION] Escrow funded for contract ${contractId}:`, {
    clientId,
    freelancerId,
    amount,
    currency,
  });
}

/**
 * Send notification about escrow release
 * FUTURE: Integrate with notification service
 */
function sendEscrowReleasedNotification(
  freelancerId: string,
  contractId: string,
  amount: number,
  currency: string
): void {
  logger.info(`[NOTIFICATION] Escrow released to freelancer ${freelancerId}:`, {
    contractId,
    amount,
    currency,
  });
}
