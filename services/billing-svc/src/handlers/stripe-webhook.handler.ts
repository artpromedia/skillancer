/**
 * @module @skillancer/billing-svc/handlers/stripe-webhook
 * Stripe webhook event handlers
 */

import type Stripe from 'stripe';
import { prisma } from '@skillancer/database';

import { getStripeService } from '../services/stripe.service.js';
import { getPaymentMethodService } from '../services/payment-method.service.js';
import { getSubscriptionService } from '../services/subscription.service.js';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Remove undefined values from object (for Prisma exactOptionalPropertyTypes)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripUndefined<T extends Record<string, unknown>>(obj: T): any {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
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
  console.log(`[Stripe Webhook] Processing event: ${event.type}`);

  switch (event.type) {
    // Payment Method Events
    case 'payment_method.attached':
      return handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);

    case 'payment_method.detached':
      return handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod);

    case 'payment_method.updated':
      return handlePaymentMethodUpdated(event.data.object as Stripe.PaymentMethod);

    case 'payment_method.automatically_updated':
      return handlePaymentMethodAutoUpdated(event.data.object as Stripe.PaymentMethod);

    // Customer Events
    case 'customer.updated':
      return handleCustomerUpdated(event.data.object as Stripe.Customer);

    case 'customer.deleted':
      return handleCustomerDeleted(event.data.object as Stripe.Customer);

    // Setup Intent Events
    case 'setup_intent.succeeded':
      return handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent);

    case 'setup_intent.setup_failed':
      return handleSetupIntentFailed(event.data.object as Stripe.SetupIntent);

    // Source/Card Expiring (legacy but still sent)
    case 'customer.source.expiring':
      return handleSourceExpiring(event.data.object);

    // Subscription Events
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      return handleSubscriptionUpdated(event.data.object as Stripe.Subscription);

    case 'customer.subscription.deleted':
      return handleSubscriptionDeleted(event.data.object as Stripe.Subscription);

    case 'customer.subscription.trial_will_end':
      return handleTrialWillEnd(event.data.object as Stripe.Subscription);

    case 'customer.subscription.paused':
    case 'customer.subscription.resumed':
      return handleSubscriptionStatusChange(event.data.object as Stripe.Subscription);

    // Invoice Events
    case 'invoice.created':
    case 'invoice.updated':
    case 'invoice.finalized':
      return handleInvoiceUpdated(event.data.object as Stripe.Invoice);

    case 'invoice.paid':
      return handleInvoicePaid(event.data.object as Stripe.Invoice);

    case 'invoice.payment_failed':
      return handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);

    case 'invoice.voided':
      return handleInvoiceVoided(event.data.object as Stripe.Invoice);

    case 'invoice.upcoming':
      return handleInvoiceUpcoming(event.data.object as Stripe.Invoice);

    default:
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
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
    console.log('[Stripe Webhook] Payment method attached without customer, skipping');
    return { handled: true, message: 'No customer attached' };
  }

  const customerId =
    typeof paymentMethod.customer === 'string' ? paymentMethod.customer : paymentMethod.customer.id;

  // Get user ID from Stripe customer
  const userId = await stripeService.getUserIdByStripeCustomerId(customerId);

  if (!userId) {
    console.log(`[Stripe Webhook] No user found for Stripe customer ${customerId}`);
    return { handled: true, message: 'Customer not linked to user' };
  }

  // Check if we already have this payment method
  const existing = await prisma.paymentMethod.findUnique({
    where: { stripePaymentMethodId: paymentMethod.id },
  });

  if (existing) {
    console.log(`[Stripe Webhook] Payment method ${paymentMethod.id} already exists`);
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

  console.log(`[Stripe Webhook] Payment method ${paymentMethod.id} attached for user ${userId}`);
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
    console.log(`[Stripe Webhook] Payment method ${paymentMethod.id} not found locally`);
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

  console.log(`[Stripe Webhook] Payment method ${paymentMethod.id} detached`);
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
    console.log(`[Stripe Webhook] Payment method ${paymentMethod.id} not found locally`);
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

  console.log(`[Stripe Webhook] Payment method ${paymentMethod.id} updated`);
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
    console.log(`[Stripe Webhook] Payment method ${paymentMethod.id} not found locally`);
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

  console.log(`[Stripe Webhook] Payment method ${paymentMethod.id} auto-updated`);
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
    console.log(`[Stripe Webhook] Stripe customer ${customer.id} not found locally`);
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

  console.log(`[Stripe Webhook] Customer ${customer.id} updated`);
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
    console.log(`[Stripe Webhook] Stripe customer ${customer.id} not found locally`);
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

  console.log(`[Stripe Webhook] Customer ${customer.id} deleted`);
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
    console.log('[Stripe Webhook] Setup intent succeeded without payment method');
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
      console.log(`[Stripe Webhook] Payment method ${stripeMethodId} verified`);
    }
    return { handled: true, message: 'Payment method already exists' };
  }

  // Payment method will be created via payment_method.attached event
  console.log(`[Stripe Webhook] Setup intent ${setupIntent.id} succeeded`);
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

  console.log(`[Stripe Webhook] Setup intent ${setupIntent.id} failed`);
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

  console.log(`[Stripe Webhook] Checked ${count} expiring cards`);
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
 * TODO: Integrate with notification service
 */
function sendPaymentMethodAddedNotification(
  userId: string,
  paymentMethod: Stripe.PaymentMethod
): void {
  console.log(`[NOTIFICATION] Payment method added for user ${userId}:`, {
    type: paymentMethod.type,
    last4: paymentMethod.card?.last4 ?? paymentMethod.us_bank_account?.last4,
  });
}

/**
 * Send card auto-updated notification
 * TODO: Integrate with notification service
 */
function sendCardAutoUpdatedNotification(
  user: { id: string; email: string; firstName: string },
  paymentMethod: Stripe.PaymentMethod
): void {
  console.log(`[NOTIFICATION] Card auto-updated for user ${user.email}:`, {
    brand: paymentMethod.card?.brand,
    last4: paymentMethod.card?.last4,
    expMonth: paymentMethod.card?.exp_month,
    expYear: paymentMethod.card?.exp_year,
  });
}

/**
 * Send setup failed notification
 * TODO: Integrate with notification service
 */
function sendSetupFailedNotification(userId: string, setupIntent: Stripe.SetupIntent): void {
  console.log(`[NOTIFICATION] Setup intent failed for user ${userId}:`, {
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
        console.log(`[Stripe Webhook] Subscription ${subscription.id} renewed`);
        return { handled: true, message: 'Subscription renewed' };
      }
    }

    // Standard sync for status and other changes
    await subscriptionService.syncSubscriptionStatus(subscription);
    console.log(`[Stripe Webhook] Subscription ${subscription.id} updated`);
    return { handled: true, message: 'Subscription updated' };
  } catch (error) {
    console.error(`[Stripe Webhook] Error updating subscription ${subscription.id}:`, error);
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

    console.log(`[Stripe Webhook] Subscription ${subscription.id} deleted`);
    return { handled: true, message: 'Subscription deleted' };
  } catch (error) {
    console.error(`[Stripe Webhook] Error deleting subscription ${subscription.id}:`, error);
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

    console.log(`[Stripe Webhook] Trial will end for subscription ${subscription.id}`);
    return { handled: true, message: 'Trial ending notification sent' };
  } catch (error) {
    console.error(`[Stripe Webhook] Error handling trial end for ${subscription.id}:`, error);
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
    console.log(
      `[Stripe Webhook] Subscription ${subscription.id} status changed to ${subscription.status}`
    );
    return { handled: true, message: `Subscription status changed to ${subscription.status}` };
  } catch (error) {
    console.error(`[Stripe Webhook] Error updating subscription status ${subscription.id}:`, error);
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
    console.log(`[Stripe Webhook] Invoice ${invoice.id} synced`);
    return { handled: true, message: 'Invoice synced' };
  } catch (error) {
    console.error(`[Stripe Webhook] Error syncing invoice ${invoice.id}:`, error);
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

    console.log(`[Stripe Webhook] Invoice ${invoice.id} paid`);
    return { handled: true, message: 'Invoice payment processed' };
  } catch (error) {
    console.error(`[Stripe Webhook] Error processing paid invoice ${invoice.id}:`, error);
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

    console.log(
      `[Stripe Webhook] Invoice ${invoice.id} payment failed (attempt ${invoice.attempt_count})`
    );
    return { handled: true, message: 'Invoice payment failure processed' };
  } catch (error) {
    console.error(`[Stripe Webhook] Error processing failed invoice ${invoice.id}:`, error);
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
    console.log(`[Stripe Webhook] Invoice ${invoice.id} voided`);
    return { handled: true, message: 'Invoice voided' };
  } catch (error) {
    console.error(`[Stripe Webhook] Error voiding invoice ${invoice.id}:`, error);
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

    console.log(`[Stripe Webhook] Upcoming invoice notification for ${invoice.id}`);
    return { handled: true, message: 'Upcoming invoice notification processed' };
  } catch (error) {
    console.error(`[Stripe Webhook] Error processing upcoming invoice:`, error);
    return { handled: false, message: 'Failed to process upcoming invoice' };
  }
}

// =============================================================================
// SUBSCRIPTION & INVOICE NOTIFICATIONS
// =============================================================================

/**
 * Send subscription canceled notification
 * TODO: Integrate with notification service
 */
function sendSubscriptionCanceledNotification(
  userId: string,
  subscription: Stripe.Subscription
): void {
  console.log(`[NOTIFICATION] Subscription canceled for user ${userId}:`, {
    subscriptionId: subscription.id,
    status: subscription.status,
    canceledAt: subscription.canceled_at,
  });
}

/**
 * Send trial ending notification
 * TODO: Integrate with notification service
 */
function sendTrialEndingNotification(userId: string, subscription: Stripe.Subscription): void {
  console.log(`[NOTIFICATION] Trial ending soon for user ${userId}:`, {
    subscriptionId: subscription.id,
    trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
  });
}

/**
 * Send payment success notification
 * TODO: Integrate with notification service
 */
function sendPaymentSuccessNotification(userId: string, invoice: Stripe.Invoice): void {
  console.log(`[NOTIFICATION] Payment successful for user ${userId}:`, {
    invoiceId: invoice.id,
    amount: invoice.amount_paid,
    currency: invoice.currency,
  });
}

/**
 * Send payment failed notification
 * TODO: Integrate with notification service
 */
function sendPaymentFailedNotification(
  userId: string,
  invoice: Stripe.Invoice,
  attemptCount: number
): void {
  console.log(`[NOTIFICATION] Payment failed for user ${userId}:`, {
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
 * TODO: Integrate with notification service
 */
function sendUpcomingChargeNotification(userId: string, invoice: Stripe.Invoice): void {
  console.log(`[NOTIFICATION] Upcoming charge for user ${userId}:`, {
    amount: invoice.amount_due,
    currency: invoice.currency,
    dueDate: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
  });
}
