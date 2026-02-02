/**
 * @module @skillancer/billing-svc/providers/stripe
 * Stripe SDK Provider
 *
 * Centralized Stripe instance management with Connect support.
 * This provider initializes Stripe with proper API versioning
 * and provides access to the SDK for various billing operations.
 */

import Stripe from 'stripe';

import { getConfig } from '../config/index.js';
import { logger } from '../lib/logger.js';

// =============================================================================
// TYPES
// =============================================================================

export interface StripeProviderConfig {
  secretKey: string;
  webhookSecret: string;
  apiVersion?: Stripe.LatestApiVersion;
  maxNetworkRetries?: number;
}

// =============================================================================
// STRIPE INSTANCE
// =============================================================================

let stripeInstance: Stripe | null = null;

/**
 * Initialize Stripe SDK with configuration
 */
export function initializeStripe(config?: Partial<StripeProviderConfig>): Stripe {
  const appConfig = getConfig();

  const secretKey = config?.secretKey || appConfig.stripe.secretKey;
  const apiVersion = (config?.apiVersion ||
    appConfig.stripe.apiVersion ||
    '2024-11-20.acacia') as Stripe.LatestApiVersion;

  if (!secretKey) {
    throw new Error('Stripe secret key not configured');
  }

  stripeInstance = new Stripe(secretKey, {
    apiVersion,
    typescript: true,
    maxNetworkRetries: config?.maxNetworkRetries ?? 3,
    appInfo: {
      name: 'Skillancer',
      version: '1.0.0',
      url: 'https://skillancer.com',
    },
  });

  logger.info({ apiVersion }, 'Stripe SDK initialized');

  return stripeInstance;
}

/**
 * Get Stripe instance (initializes if needed)
 */
export function getStripe(): Stripe {
  if (!stripeInstance) {
    return initializeStripe();
  }
  return stripeInstance;
}

/**
 * Get webhook secret from config
 */
export function getWebhookSecret(): string {
  const config = getConfig();
  return config.stripe.webhookSecret;
}

/**
 * Verify Stripe webhook signature
 */
export function constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
  const stripe = getStripe();
  const webhookSecret = getWebhookSecret();

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Check if Stripe is properly configured
 */
export function isStripeConfigured(): boolean {
  const config = getConfig();
  return !!(config.stripe.secretKey && config.stripe.webhookSecret);
}

// =============================================================================
// CONNECT HELPERS
// =============================================================================

/**
 * Create a Connect Express account
 */
export async function createConnectAccount(params: {
  email: string;
  country?: string;
  businessType?: 'individual' | 'company';
  metadata?: Record<string, string>;
}): Promise<Stripe.Account> {
  const stripe = getStripe();

  return stripe.accounts.create({
    type: 'express',
    country: params.country || 'US',
    email: params.email,
    business_type: params.businessType || 'individual',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: {
      platform: 'skillancer',
      ...params.metadata,
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
}

/**
 * Create account link for Connect onboarding
 */
export async function createAccountLink(params: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
  type?: 'account_onboarding' | 'account_update';
}): Promise<Stripe.AccountLink> {
  const stripe = getStripe();

  return stripe.accountLinks.create({
    account: params.accountId,
    refresh_url: params.refreshUrl,
    return_url: params.returnUrl,
    type: params.type || 'account_onboarding',
    collect: 'eventually_due',
  });
}

/**
 * Retrieve a Connect account
 */
export async function retrieveConnectAccount(accountId: string): Promise<Stripe.Account> {
  const stripe = getStripe();
  return stripe.accounts.retrieve(accountId);
}

/**
 * Create dashboard login link for Connect account
 */
export async function createDashboardLink(accountId: string): Promise<Stripe.LoginLink> {
  const stripe = getStripe();
  return stripe.accounts.createLoginLink(accountId);
}

/**
 * Delete/deauthorize a Connect account
 */
export async function deleteConnectAccount(accountId: string): Promise<Stripe.Account> {
  const stripe = getStripe();
  return stripe.accounts.del(accountId);
}

// =============================================================================
// EXPORTS
// =============================================================================

export const StripeProvider = {
  initialize: initializeStripe,
  getStripe,
  getWebhookSecret,
  constructWebhookEvent,
  isConfigured: isStripeConfigured,
  connect: {
    createAccount: createConnectAccount,
    createAccountLink,
    retrieveAccount: retrieveConnectAccount,
    createDashboardLink,
    deleteAccount: deleteConnectAccount,
  },
};

export default StripeProvider;
