/**
 * @module @skillancer/billing-svc/services/payment-method
 * Payment method management service
 */

import { prisma } from '@skillancer/database';

import { getStripeService } from './stripe.service.js';
import { getConfig } from '../config/index.js';
import {
  PaymentMethodNotFoundError,
  PaymentMethodInUseError,
  PaymentMethodLimitExceededError,
  PaymentMethodAlreadyExistsError,
  InvalidPaymentMethodTypeError,
  UnauthorizedPaymentMethodAccessError,
} from '../errors/index.js';

import type { PaymentMethod, PaymentMethodType, PaymentMethodStatus } from '@skillancer/database';
import type Stripe from 'stripe';

// =============================================================================
// TYPES
// =============================================================================

export interface PaymentMethodResponse {
  id: string;
  type: PaymentMethodType;
  isDefault: boolean;
  status: PaymentMethodStatus;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
    funding?: string;
    expiresIn?: string;
  };
  bank?: {
    name: string;
    last4: string;
    accountType?: string;
    routingLast4?: string;
  };
  sepa?: {
    country: string;
    bankCode: string;
    last4: string;
  };
  billingDetails?: {
    name?: string;
    email?: string;
    country?: string;
    postalCode?: string;
  };
  createdAt: string;
}

export interface SetupIntentResponse {
  clientSecret: string;
  setupIntentId: string;
}

export interface AchSetupData {
  accountHolderName: string;
  accountHolderType: 'individual' | 'company';
}

export interface SepaSetupData {
  accountHolderName: string;
  ipAddress: string;
  userAgent: string;
}

export interface PaymentMethodFilters {
  type?: PaymentMethodType;
  status?: PaymentMethodStatus;
  includeRemoved?: boolean;
}

export interface SyncResult {
  synced: number;
  added: number;
  updated: number;
  removed: number;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Remove undefined values from object (for Prisma exactOptionalPropertyTypes)
 * Uses type assertion since we know the result will match the required shape
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
// PAYMENT METHOD SERVICE
// =============================================================================

/**
 * Service for managing user payment methods
 *
 * Handles:
 * - CRUD operations for payment methods
 * - Setup flows for cards, ACH, SEPA
 * - Default payment method management
 * - Expiration tracking
 * - PCI-compliant data handling
 */
export class PaymentMethodService {
  private readonly config = getConfig();
  private readonly stripeService = getStripeService();

  // ===========================================================================
  // CRUD OPERATIONS
  // ===========================================================================

  /**
   * Get all payment methods for a user
   */
  async getPaymentMethods(
    userId: string,
    filters?: PaymentMethodFilters
  ): Promise<PaymentMethodResponse[]> {
    const whereClause: Record<string, unknown> = { userId };

    if (filters?.includeRemoved) {
      // Include all statuses
    } else {
      whereClause.status = { not: 'REMOVED' };
    }

    if (filters?.type) {
      whereClause.type = filters.type;
    }

    if (filters?.status) {
      whereClause.status = filters.status;
    }

    const methods = await prisma.paymentMethod.findMany({
      where: whereClause,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return methods.map((method) => this.mapToResponse(method));
  }

  /**
   * Get the default payment method for a user
   */
  async getDefaultPaymentMethod(userId: string): Promise<PaymentMethodResponse | null> {
    const method = await prisma.paymentMethod.findFirst({
      where: {
        userId,
        isDefault: true,
        status: { not: 'REMOVED' },
      },
    });

    return method ? this.mapToResponse(method) : null;
  }

  /**
   * Get a specific payment method
   */
  async getPaymentMethod(userId: string, paymentMethodId: string): Promise<PaymentMethodResponse> {
    const method = await prisma.paymentMethod.findUnique({
      where: { id: paymentMethodId },
    });

    if (!method || method.status === 'REMOVED') {
      throw new PaymentMethodNotFoundError(paymentMethodId);
    }

    if (method.userId !== userId) {
      throw new UnauthorizedPaymentMethodAccessError(paymentMethodId);
    }

    return this.mapToResponse(method);
  }

  /**
   * Add a payment method from Stripe
   */
  async addPaymentMethod(
    userId: string,
    stripePaymentMethodId: string,
    setAsDefault?: boolean
  ): Promise<PaymentMethodResponse> {
    // Get or verify user's Stripe customer
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const customer = await this.stripeService.getOrCreateCustomer(
      userId,
      user.email,
      `${user.firstName} ${user.lastName}`
    );

    // Check payment method limit
    const existingCount = await prisma.paymentMethod.count({
      where: { userId, status: { not: 'REMOVED' } },
    });

    if (existingCount >= this.config.payment.maxPaymentMethodsPerUser) {
      throw new PaymentMethodLimitExceededError(this.config.payment.maxPaymentMethodsPerUser);
    }

    // Get payment method from Stripe
    const stripeMethod = await this.stripeService.getPaymentMethod(stripePaymentMethodId);

    // Check for duplicates by fingerprint
    if (stripeMethod.card?.fingerprint) {
      const existingMethod = await prisma.paymentMethod.findFirst({
        where: {
          userId,
          fingerprint: stripeMethod.card.fingerprint,
          status: { not: 'REMOVED' },
        },
      });

      if (existingMethod) {
        throw new PaymentMethodAlreadyExistsError(stripeMethod.card.fingerprint);
      }
    }

    // Attach to customer if not already
    if (stripeMethod.customer !== customer.id) {
      await this.stripeService.attachPaymentMethod(stripePaymentMethodId, customer.id);
    }

    // Determine if this should be the default (first payment method or explicitly requested)
    const isDefault = existingCount === 0 || setAsDefault === true;

    // Create local record
    const method = await prisma.paymentMethod.create({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: stripUndefined({
        userId,
        stripePaymentMethodId,
        stripeCustomerId: customer.id,
        type: this.mapStripeType(stripeMethod.type),
        isDefault,
        status: 'ACTIVE',
        // Card details
        cardBrand: stripeMethod.card?.brand,
        cardLast4: stripeMethod.card?.last4,
        cardExpMonth: stripeMethod.card?.exp_month,
        cardExpYear: stripeMethod.card?.exp_year,
        cardFunding: stripeMethod.card?.funding,
        fingerprint: stripeMethod.card?.fingerprint,
        // Bank details (ACH)
        bankName: stripeMethod.us_bank_account?.bank_name,
        bankLast4: stripeMethod.us_bank_account?.last4,
        bankAccountType: stripeMethod.us_bank_account?.account_type,
        bankRoutingLast4: stripeMethod.us_bank_account?.routing_number?.slice(-4),
        // SEPA details
        sepaCountry: stripeMethod.sepa_debit?.country,
        sepaBankCode: stripeMethod.sepa_debit?.bank_code,
        // Billing details
        billingName: stripeMethod.billing_details?.name,
        billingEmail: stripeMethod.billing_details?.email,
        billingCountry: stripeMethod.billing_details?.address?.country,
        billingPostalCode: stripeMethod.billing_details?.address?.postal_code,
      }),
    });

    // Set as default in Stripe if first method
    if (isDefault) {
      await this.stripeService.setDefaultPaymentMethod(customer.id, stripePaymentMethodId);
    }

    return this.mapToResponse(method);
  }

  /**
   * Remove a payment method
   */
  async removePaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    const method = await prisma.paymentMethod.findUnique({
      where: { id: paymentMethodId },
    });

    if (!method || method.status === 'REMOVED') {
      throw new PaymentMethodNotFoundError(paymentMethodId);
    }

    if (method.userId !== userId) {
      throw new UnauthorizedPaymentMethodAccessError(paymentMethodId);
    }

    // Check if method is in active use
    const canRemove = await this.canRemovePaymentMethod(userId, paymentMethodId);
    if (!canRemove.allowed) {
      throw new PaymentMethodInUseError(paymentMethodId, canRemove.reason ?? 'in active use');
    }

    // Detach from Stripe
    await this.stripeService.detachPaymentMethod(method.stripePaymentMethodId);

    // Mark as removed (soft delete)
    await prisma.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { status: 'REMOVED' },
    });

    // If this was the default, set a new default
    if (method.isDefault) {
      const nextDefault = await prisma.paymentMethod.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
          id: { not: paymentMethodId },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (nextDefault) {
        await this.setDefaultPaymentMethod(userId, nextDefault.id);
      }
    }
  }

  /**
   * Set a payment method as the default
   * Returns the updated payment method
   */
  async setDefaultPaymentMethod(
    userId: string,
    paymentMethodId: string
  ): Promise<PaymentMethodResponse> {
    const method = await prisma.paymentMethod.findUnique({
      where: { id: paymentMethodId },
    });

    if (!method || method.status === 'REMOVED') {
      throw new PaymentMethodNotFoundError(paymentMethodId);
    }

    if (method.userId !== userId) {
      throw new UnauthorizedPaymentMethodAccessError(paymentMethodId);
    }

    // Update in Stripe
    await this.stripeService.setDefaultPaymentMethod(
      method.stripeCustomerId,
      method.stripePaymentMethodId
    );

    // Update local records
    await prisma.$transaction([
      // Clear existing default
      prisma.paymentMethod.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      // Set new default
      prisma.paymentMethod.update({
        where: { id: paymentMethodId },
        data: { isDefault: true },
      }),
    ]);

    // Return updated payment method
    return this.getPaymentMethod(userId, paymentMethodId);
  }

  /**
   * Create a setup intent based on payment method type
   */
  async createSetupIntent(
    userId: string,
    paymentMethodType: 'card' | 'us_bank_account' | 'sepa_debit',
    _metadata?: Record<string, string>
  ): Promise<SetupIntentResponse & { customerId: string }> {
    const customer = await this.ensureCustomer(userId);

    let setupIntent;
    switch (paymentMethodType) {
      case 'card':
        setupIntent = await this.stripeService.createSetupIntent(customer.id, {
          paymentMethodTypes: ['card'],
          metadata: { userId },
        });
        break;
      case 'us_bank_account':
        setupIntent = await this.stripeService.createAchSetupIntent(customer.id, { userId });
        break;
      case 'sepa_debit':
        setupIntent = await this.stripeService.createSepaSetupIntent(
          customer.id,
          { ipAddress: '', userAgent: '' },
          { userId }
        );
        break;
    }

    return {
      clientSecret: setupIntent.client_secret ?? '',
      setupIntentId: setupIntent.id,
      customerId: customer.id,
    };
  }

  // ===========================================================================
  // SETUP INTENTS
  // ===========================================================================

  /**
   * Create a setup intent for card collection
   */
  async createCardSetupIntent(userId: string): Promise<SetupIntentResponse> {
    const customer = await this.ensureCustomer(userId);

    const setupIntent = await this.stripeService.createSetupIntent(customer.id, {
      paymentMethodTypes: ['card'],
      metadata: { userId },
    });

    return {
      clientSecret: setupIntent.client_secret ?? '',
      setupIntentId: setupIntent.id,
    };
  }

  /**
   * Create a setup intent for ACH bank account
   */
  async createAchSetupIntent(userId: string, _data: AchSetupData): Promise<SetupIntentResponse> {
    const customer = await this.ensureCustomer(userId);

    const setupIntent = await this.stripeService.createAchSetupIntent(customer.id, {
      userId,
    });

    return {
      clientSecret: setupIntent.client_secret ?? '',
      setupIntentId: setupIntent.id,
    };
  }

  /**
   * Create a setup intent for SEPA debit
   */
  async createSepaSetupIntent(userId: string, data: SepaSetupData): Promise<SetupIntentResponse> {
    const customer = await this.ensureCustomer(userId);

    const setupIntent = await this.stripeService.createSepaSetupIntent(
      customer.id,
      {
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
      { userId }
    );

    return {
      clientSecret: setupIntent.client_secret ?? '',
      setupIntentId: setupIntent.id,
    };
  }

  // ===========================================================================
  // SYNC WITH STRIPE
  // ===========================================================================

  /**
   * Sync payment methods from Stripe
   * Returns counts of added, updated, and removed methods
   */
  async syncPaymentMethods(userId: string): Promise<SyncResult> {
    const result: SyncResult = { synced: 0, added: 0, updated: 0, removed: 0 };

    const stripeCustomerId = await this.stripeService.getStripeCustomerId(userId);
    if (!stripeCustomerId) {
      return result; // No Stripe customer yet
    }

    // Get all payment methods from Stripe
    const stripeMethods = await this.stripeService.listPaymentMethods(stripeCustomerId);
    const stripeMethodIds = new Set(stripeMethods.map((m) => m.id));

    // Get local payment methods
    const localMethods = await prisma.paymentMethod.findMany({
      where: { userId, status: { not: 'REMOVED' } },
    });

    // Remove methods that no longer exist in Stripe
    for (const local of localMethods) {
      if (!stripeMethodIds.has(local.stripePaymentMethodId)) {
        await prisma.paymentMethod.update({
          where: { id: local.id },
          data: { status: 'REMOVED' },
        });
        result.removed++;
      }
    }

    // Add new methods from Stripe
    const localMethodIds = new Set(localMethods.map((m) => m.stripePaymentMethodId));
    for (const stripeMethod of stripeMethods) {
      if (!localMethodIds.has(stripeMethod.id)) {
        await this.createFromStripeMethod(userId, stripeCustomerId, stripeMethod);
        result.added++;
      }
    }

    // Update existing methods with latest data
    for (const stripeMethod of stripeMethods) {
      const local = localMethods.find((m) => m.stripePaymentMethodId === stripeMethod.id);
      if (local) {
        await this.updateFromStripeMethod(local.id, stripeMethod);
        result.updated++;
      }
    }

    result.synced = result.added + result.updated;
    return result;
  }

  // ===========================================================================
  // EXPIRATION HANDLING
  // ===========================================================================

  /**
   * Check for cards expiring soon and send warnings
   */
  async checkExpiringCards(): Promise<number> {
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + this.config.payment.expirationWarningDays);

    const expiringCards = await prisma.paymentMethod.findMany({
      where: {
        type: 'CARD',
        status: 'ACTIVE',
        cardExpYear: warningDate.getFullYear(),
        cardExpMonth: warningDate.getMonth() + 1,
        expirationWarningAt: null,
      },
      include: {
        user: {
          select: { id: true, email: true, firstName: true },
        },
      },
    });

    for (const card of expiringCards) {
      await prisma.paymentMethod.update({
        where: { id: card.id },
        data: {
          status: 'EXPIRING_SOON',
          expirationWarningAt: new Date(),
        },
      });

      // Send notification (via notification service)
      this.sendCardExpirationWarning(card.user, card);
    }

    return expiringCards.length;
  }

  /**
   * Mark expired cards
   */
  async markExpiredCards(): Promise<number> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const result = await prisma.paymentMethod.updateMany({
      where: {
        type: 'CARD',
        status: { in: ['ACTIVE', 'EXPIRING_SOON'] },
        OR: [
          { cardExpYear: { lt: currentYear } },
          {
            AND: [{ cardExpYear: currentYear }, { cardExpMonth: { lt: currentMonth } }],
          },
        ],
      },
      data: { status: 'EXPIRED' },
    });

    return result.count;
  }

  // ===========================================================================
  // VALIDATION
  // ===========================================================================

  /**
   * Check if a payment method can be removed
   */
  async canRemovePaymentMethod(
    userId: string,
    paymentMethodId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const method = await prisma.paymentMethod.findUnique({
      where: { id: paymentMethodId },
      include: {
        payments: {
          where: {
            status: { in: ['PENDING', 'PROCESSING', 'ESCROWED'] },
          },
        },
      },
    });

    if (!method) {
      return { allowed: false, reason: 'Payment method not found' };
    }

    if (method.userId !== userId) {
      return { allowed: false, reason: 'Not authorized' };
    }

    // Check for active payments
    if (method.payments.length > 0) {
      return {
        allowed: false,
        reason: `in use by ${method.payments.length} active payment(s)`,
      };
    }

    // Check for active subscriptions (would need subscription model)
    // FUTURE: Add subscription check when subscription model exists

    return { allowed: true };
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Ensure user has a Stripe customer
   */
  private async ensureCustomer(userId: string): Promise<Stripe.Customer> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return this.stripeService.getOrCreateCustomer(
      userId,
      user.email,
      `${user.firstName} ${user.lastName}`
    );
  }

  /**
   * Create a local payment method record from Stripe data
   */
  private async createFromStripeMethod(
    userId: string,
    stripeCustomerId: string,
    stripeMethod: Stripe.PaymentMethod
  ): Promise<PaymentMethod> {
    return prisma.paymentMethod.create({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: stripUndefined({
        userId,
        stripePaymentMethodId: stripeMethod.id,
        stripeCustomerId,
        type: this.mapStripeType(stripeMethod.type),
        isDefault: false,
        status: 'ACTIVE',
        cardBrand: stripeMethod.card?.brand,
        cardLast4: stripeMethod.card?.last4,
        cardExpMonth: stripeMethod.card?.exp_month,
        cardExpYear: stripeMethod.card?.exp_year,
        cardFunding: stripeMethod.card?.funding,
        fingerprint: stripeMethod.card?.fingerprint,
        bankName: stripeMethod.us_bank_account?.bank_name,
        bankLast4: stripeMethod.us_bank_account?.last4,
        bankAccountType: stripeMethod.us_bank_account?.account_type,
        bankRoutingLast4: stripeMethod.us_bank_account?.routing_number?.slice(-4),
        sepaCountry: stripeMethod.sepa_debit?.country,
        sepaBankCode: stripeMethod.sepa_debit?.bank_code,
        billingName: stripeMethod.billing_details?.name,
        billingEmail: stripeMethod.billing_details?.email,
        billingCountry: stripeMethod.billing_details?.address?.country,
        billingPostalCode: stripeMethod.billing_details?.address?.postal_code,
      }),
    });
  }

  /**
   * Update local payment method from Stripe data
   */
  private async updateFromStripeMethod(
    localId: string,
    stripeMethod: Stripe.PaymentMethod
  ): Promise<void> {
    await prisma.paymentMethod.update({
      where: { id: localId },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: stripUndefined({
        cardBrand: stripeMethod.card?.brand,
        cardExpMonth: stripeMethod.card?.exp_month,
        cardExpYear: stripeMethod.card?.exp_year,
        bankName: stripeMethod.us_bank_account?.bank_name,
        billingName: stripeMethod.billing_details?.name,
        billingEmail: stripeMethod.billing_details?.email,
        billingCountry: stripeMethod.billing_details?.address?.country,
        billingPostalCode: stripeMethod.billing_details?.address?.postal_code,
      }),
    });
  }

  /**
   * Map Stripe payment method type to our enum
   */
  private mapStripeType(stripeType: string): PaymentMethodType {
    const typeMap: Record<string, PaymentMethodType> = {
      card: 'CARD',
      us_bank_account: 'ACH_DEBIT',
      sepa_debit: 'SEPA_DEBIT',
    };

    const mapped = typeMap[stripeType];
    if (!mapped) {
      throw new InvalidPaymentMethodTypeError(stripeType, Object.keys(typeMap));
    }

    return mapped;
  }

  /**
   * Map payment method to response DTO
   */
  private mapToResponse(method: PaymentMethod): PaymentMethodResponse {
    const response: PaymentMethodResponse = {
      id: method.id,
      type: method.type,
      isDefault: method.isDefault,
      status: method.status,
      createdAt: method.createdAt.toISOString(),
    };

    if (method.type === 'CARD' && method.cardLast4) {
      const cardDetails: PaymentMethodResponse['card'] = {
        brand: method.cardBrand ?? 'unknown',
        last4: method.cardLast4,
        expMonth: method.cardExpMonth ?? 0,
        expYear: method.cardExpYear ?? 0,
      };
      if (method.cardFunding) {
        cardDetails.funding = method.cardFunding;
      }
      const expiresIn = this.calculateExpiresIn(method.cardExpMonth, method.cardExpYear);
      if (expiresIn) {
        cardDetails.expiresIn = expiresIn;
      }
      response.card = cardDetails;
    }

    if (method.type === 'ACH_DEBIT' && method.bankLast4) {
      const bankDetails: PaymentMethodResponse['bank'] = {
        name: method.bankName ?? 'Bank Account',
        last4: method.bankLast4,
      };
      if (method.bankAccountType) {
        bankDetails.accountType = method.bankAccountType;
      }
      if (method.bankRoutingLast4) {
        bankDetails.routingLast4 = method.bankRoutingLast4;
      }
      response.bank = bankDetails;
    }

    if (method.type === 'SEPA_DEBIT' && method.bankLast4) {
      response.sepa = {
        country: method.sepaCountry ?? '',
        bankCode: method.sepaBankCode ?? '',
        last4: method.bankLast4,
      };
    }

    if (method.billingName || method.billingEmail || method.billingCountry) {
      const billingDetails: PaymentMethodResponse['billingDetails'] = {};
      if (method.billingName) {
        billingDetails.name = method.billingName;
      }
      if (method.billingEmail) {
        billingDetails.email = method.billingEmail;
      }
      if (method.billingCountry) {
        billingDetails.country = method.billingCountry;
      }
      if (method.billingPostalCode) {
        billingDetails.postalCode = method.billingPostalCode;
      }
      response.billingDetails = billingDetails;
    }

    return response;
  }

  /**
   * Calculate human-readable expiration string
   */
  private calculateExpiresIn(
    expMonth?: number | null,
    expYear?: number | null
  ): string | undefined {
    if (!expMonth || !expYear) {
      return undefined;
    }

    const now = new Date();
    const expDate = new Date(expYear, expMonth - 1);
    const months =
      (expDate.getFullYear() - now.getFullYear()) * 12 + (expDate.getMonth() - now.getMonth());

    if (months <= 0) {
      return 'Expired';
    }
    if (months === 1) {
      return '1 month';
    }
    if (months < 12) {
      return `${months} months`;
    }
    const years = Math.floor(months / 12);
    return years === 1 ? '1 year' : `${years} years`;
  }

  /**
   * Send card expiration warning notification
   * FUTURE: Implement notification service integration
   */
  private sendCardExpirationWarning(
    user: { id: string; email: string; firstName: string },
    card: PaymentMethod
  ): void {
    console.log(`[NOTIFICATION] Card expiring for user ${user.email}:`, {
      userId: user.id,
      cardLast4: card.cardLast4,
      cardBrand: card.cardBrand,
      expMonth: card.cardExpMonth,
      expYear: card.cardExpYear,
    });
  }
}

// =============================================================================
// SERVICE SINGLETON
// =============================================================================

let paymentMethodServiceInstance: PaymentMethodService | null = null;

export function getPaymentMethodService(): PaymentMethodService {
  paymentMethodServiceInstance ??= new PaymentMethodService();
  return paymentMethodServiceInstance;
}

export function resetPaymentMethodService(): void {
  paymentMethodServiceInstance = null;
}

/**
 * Initialize the Payment Method service (for explicit initialization)
 */
export function initializePaymentMethodService(): PaymentMethodService {
  return getPaymentMethodService();
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type AddPaymentMethodResult = PaymentMethodResponse;

export type SetupIntentResult = SetupIntentResponse;
