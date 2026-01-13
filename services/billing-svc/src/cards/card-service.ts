// @ts-nocheck
/**
 * Card Service - Stripe Issuing Integration
 * Issue virtual and physical Skillancer debit cards
 * Sprint M5: Freelancer Financial Services
 */

import Stripe from 'stripe';
import { prisma } from '@skillancer/database';
import { logger } from '../lib/logger.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// ============================================================================
// TYPES
// ============================================================================

export interface SkillancerCard {
  id: string;
  stripeCardId: string;
  userId: string;
  type: CardType;
  status: CardStatus;
  last4: string;
  expMonth: number;
  expYear: number;
  brand: string;
  cardholderName: string;
  spendingLimits: SpendingLimits;
  billingAddress: Address;
  shippingAddress?: Address;
  createdAt: Date;
  activatedAt?: Date;
  canceledAt?: Date;
  replacementFor?: string;
  walletEnabled: boolean;
}

export type CardType = 'virtual' | 'physical';
export type CardStatus = 'inactive' | 'active' | 'frozen' | 'canceled' | 'lost' | 'stolen';

export interface SpendingLimits {
  perTransaction: number;
  daily: number;
  weekly: number;
  monthly: number;
  merchantCategories?: MerchantCategoryRestriction[];
}

export interface MerchantCategoryRestriction {
  category: string;
  allowed: boolean;
  limit?: number;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface CardDetails {
  number: string;
  cvc: string;
  expMonth: number;
  expYear: number;
}

export interface CardShipment {
  id: string;
  carrier: string;
  trackingNumber?: string;
  estimatedDelivery?: Date;
  status: ShipmentStatus;
}

export type ShipmentStatus = 'pending' | 'shipped' | 'delivered' | 'returned' | 'failure';

// ============================================================================
// DEFAULT SPENDING LIMITS
// ============================================================================

const DEFAULT_SPENDING_LIMITS: SpendingLimits = {
  perTransaction: 5000,
  daily: 10000,
  weekly: 25000,
  monthly: 50000,
};

const INITIAL_SPENDING_LIMITS: SpendingLimits = {
  perTransaction: 1000,
  daily: 2500,
  weekly: 5000,
  monthly: 10000,
};

// ============================================================================
// CARD SERVICE
// ============================================================================

export class CardService {
  // ==========================================================================
  // CARDHOLDER MANAGEMENT
  // ==========================================================================

  /**
   * Create or get cardholder for issuing cards
   */
  async ensureCardholder(userId: string): Promise<string> {
    const existing = await prisma.cardholder.findUnique({ where: { userId } });
    if (existing) {
      return existing.stripeCardholderId;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Create cardholder in Stripe
    const cardholder = await stripe.issuing.cardholders.create({
      type: 'individual',
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      email: user.email,
      phone_number: user.profile?.phone,
      billing: {
        address: {
          line1: user.profile?.address || '123 Main St',
          city: user.profile?.city || 'San Francisco',
          state: user.profile?.state || 'CA',
          postal_code: user.profile?.postalCode || '94102',
          country: 'US',
        },
      },
      individual: {
        first_name: user.firstName || 'Unknown',
        last_name: user.lastName || 'User',
        dob: user.profile?.dateOfBirth
          ? {
              day: user.profile.dateOfBirth.getDate(),
              month: user.profile.dateOfBirth.getMonth() + 1,
              year: user.profile.dateOfBirth.getFullYear(),
            }
          : undefined,
      },
      status: 'active',
    });

    await prisma.cardholder.create({
      data: {
        userId,
        stripeCardholderId: cardholder.id,
        status: cardholder.status,
      },
    });

    logger.info('Cardholder created', { userId, cardholderId: cardholder.id });
    return cardholder.id;
  }

  // ==========================================================================
  // VIRTUAL CARD ISSUANCE
  // ==========================================================================

  /**
   * Issue a virtual card (instant)
   */
  async issueVirtualCard(
    userId: string,
    options: {
      nickname?: string;
      spendingLimits?: Partial<SpendingLimits>;
    } = {}
  ): Promise<SkillancerCard> {
    const cardholderId = await this.ensureCardholder(userId);

    // Check existing card count
    const existingCards = await prisma.issuedCard.count({
      where: { userId, status: { in: ['active', 'inactive'] } },
    });

    if (existingCards >= 5) {
      throw new Error('Maximum card limit reached (5 cards)');
    }

    const limits = { ...INITIAL_SPENDING_LIMITS, ...options.spendingLimits };

    // Create card in Stripe
    const card = await stripe.issuing.cards.create({
      cardholder: cardholderId,
      currency: 'usd',
      type: 'virtual',
      spending_controls: {
        spending_limits: [
          { amount: limits.perTransaction * 100, interval: 'per_authorization' },
          { amount: limits.daily * 100, interval: 'daily' },
          { amount: limits.weekly * 100, interval: 'weekly' },
          { amount: limits.monthly * 100, interval: 'monthly' },
        ],
      },
      metadata: {
        userId,
        nickname: options.nickname || 'Skillancer Card',
        platform: 'skillancer',
      },
    });

    // Store in database
    const savedCard = await prisma.issuedCard.create({
      data: {
        userId,
        stripeCardId: card.id,
        type: 'virtual',
        status: card.status,
        last4: card.last4,
        expMonth: card.exp_month,
        expYear: card.exp_year,
        brand: card.brand,
        nickname: options.nickname || 'Skillancer Card',
        spendingLimits: limits,
      },
    });

    logger.info('Virtual card issued', { userId, cardId: savedCard.id, last4: card.last4 });

    return this.mapToSkillancerCard(savedCard, card);
  }

  // ==========================================================================
  // PHYSICAL CARD ISSUANCE
  // ==========================================================================

  /**
   * Issue a physical card (7-10 business days shipping)
   */
  async issuePhysicalCard(
    userId: string,
    shippingAddress: Address,
    options: {
      nickname?: string;
      spendingLimits?: Partial<SpendingLimits>;
      expeditedShipping?: boolean;
    } = {}
  ): Promise<SkillancerCard> {
    const cardholderId = await this.ensureCardholder(userId);

    // Check if user already has an active physical card
    const existingPhysical = await prisma.issuedCard.findFirst({
      where: { userId, type: 'physical', status: { in: ['active', 'inactive'] } },
    });

    if (existingPhysical) {
      throw new Error('You already have an active physical card. Request a replacement instead.');
    }

    const limits = { ...INITIAL_SPENDING_LIMITS, ...options.spendingLimits };

    // Create physical card in Stripe
    const card = await stripe.issuing.cards.create({
      cardholder: cardholderId,
      currency: 'usd',
      type: 'physical',
      shipping: {
        name: await this.getCardholderName(userId),
        address: {
          line1: shippingAddress.line1,
          line2: shippingAddress.line2,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postal_code: shippingAddress.postalCode,
          country: shippingAddress.country,
        },
        service: options.expeditedShipping ? 'express' : 'standard',
      },
      spending_controls: {
        spending_limits: [
          { amount: limits.perTransaction * 100, interval: 'per_authorization' },
          { amount: limits.daily * 100, interval: 'daily' },
          { amount: limits.weekly * 100, interval: 'weekly' },
          { amount: limits.monthly * 100, interval: 'monthly' },
        ],
      },
      metadata: {
        userId,
        nickname: options.nickname || 'Skillancer Physical Card',
        platform: 'skillancer',
      },
    });

    // Store in database
    const savedCard = await prisma.issuedCard.create({
      data: {
        userId,
        stripeCardId: card.id,
        type: 'physical',
        status: 'inactive', // Physical cards start inactive
        last4: card.last4,
        expMonth: card.exp_month,
        expYear: card.exp_year,
        brand: card.brand,
        nickname: options.nickname || 'Skillancer Physical Card',
        spendingLimits: limits,
        shippingAddress: shippingAddress,
        shippingStatus: 'pending',
      },
    });

    logger.info('Physical card ordered', {
      userId,
      cardId: savedCard.id,
      expedited: options.expeditedShipping,
    });

    return this.mapToSkillancerCard(savedCard, card);
  }

  // ==========================================================================
  // CARD ACTIVATION
  // ==========================================================================

  /**
   * Activate a physical card (requires last 4 digits from physical card)
   */
  async activateCard(userId: string, cardId: string, last4: string): Promise<SkillancerCard> {
    const card = await prisma.issuedCard.findFirst({
      where: { id: cardId, userId, type: 'physical', status: 'inactive' },
    });

    if (!card) {
      throw new Error('Card not found or already active');
    }

    if (card.last4 !== last4) {
      logger.warn('Card activation failed - wrong last4', { userId, cardId, providedLast4: last4 });
      throw new Error('Card verification failed. Please check the last 4 digits.');
    }

    // Activate in Stripe
    const stripeCard = await stripe.issuing.cards.update(card.stripeCardId, {
      status: 'active',
    });

    // Update database
    const updatedCard = await prisma.issuedCard.update({
      where: { id: cardId },
      data: {
        status: 'active',
        activatedAt: new Date(),
      },
    });

    logger.info('Physical card activated', { userId, cardId });

    return this.mapToSkillancerCard(updatedCard, stripeCard);
  }

  // ==========================================================================
  // CARD MANAGEMENT
  // ==========================================================================

  /**
   * Get all cards for user
   */
  async getCards(userId: string): Promise<SkillancerCard[]> {
    const cards = await prisma.issuedCard.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return cards.map((c) => this.mapFromDbCard(c));
  }

  /**
   * Get single card
   */
  async getCard(userId: string, cardId: string): Promise<SkillancerCard | null> {
    const card = await prisma.issuedCard.findFirst({
      where: { id: cardId, userId },
    });

    return card ? this.mapFromDbCard(card) : null;
  }

  /**
   * Get card details (sensitive - number, cvc)
   */
  async getCardDetails(userId: string, cardId: string): Promise<CardDetails> {
    const card = await prisma.issuedCard.findFirst({
      where: { id: cardId, userId, status: 'active' },
    });

    if (!card) {
      throw new Error('Card not found or not active');
    }

    // Retrieve sensitive details from Stripe (requires special permission)
    const stripeCard = await stripe.issuing.cards.retrieve(card.stripeCardId, {
      expand: ['number', 'cvc'],
    });

    // Log access for security audit
    logger.info('Card details accessed', { userId, cardId });

    return {
      number: (stripeCard as any).number,
      cvc: (stripeCard as any).cvc,
      expMonth: stripeCard.exp_month,
      expYear: stripeCard.exp_year,
    };
  }

  /**
   * Freeze card (temporary block)
   */
  async freezeCard(userId: string, cardId: string): Promise<SkillancerCard> {
    const card = await prisma.issuedCard.findFirst({
      where: { id: cardId, userId, status: 'active' },
    });

    if (!card) {
      throw new Error('Card not found or not active');
    }

    await stripe.issuing.cards.update(card.stripeCardId, {
      status: 'inactive',
    });

    const updatedCard = await prisma.issuedCard.update({
      where: { id: cardId },
      data: { status: 'frozen' },
    });

    logger.info('Card frozen', { userId, cardId });

    return this.mapFromDbCard(updatedCard);
  }

  /**
   * Unfreeze card
   */
  async unfreezeCard(userId: string, cardId: string): Promise<SkillancerCard> {
    const card = await prisma.issuedCard.findFirst({
      where: { id: cardId, userId, status: 'frozen' },
    });

    if (!card) {
      throw new Error('Card not found or not frozen');
    }

    await stripe.issuing.cards.update(card.stripeCardId, {
      status: 'active',
    });

    const updatedCard = await prisma.issuedCard.update({
      where: { id: cardId },
      data: { status: 'active' },
    });

    logger.info('Card unfrozen', { userId, cardId });

    return this.mapFromDbCard(updatedCard);
  }

  /**
   * Cancel card permanently
   */
  async cancelCard(
    userId: string,
    cardId: string,
    reason: 'lost' | 'stolen' | 'user_request'
  ): Promise<SkillancerCard> {
    const card = await prisma.issuedCard.findFirst({
      where: { id: cardId, userId, status: { notIn: ['canceled'] } },
    });

    if (!card) {
      throw new Error('Card not found');
    }

    await stripe.issuing.cards.update(card.stripeCardId, {
      status: 'canceled',
      cancellation_reason: reason === 'user_request' ? undefined : reason,
    });

    const status = reason === 'lost' ? 'lost' : reason === 'stolen' ? 'stolen' : 'canceled';

    const updatedCard = await prisma.issuedCard.update({
      where: { id: cardId },
      data: { status, canceledAt: new Date() },
    });

    logger.info('Card canceled', { userId, cardId, reason });

    return this.mapFromDbCard(updatedCard);
  }

  /**
   * Request replacement card
   */
  async requestReplacement(
    userId: string,
    cardId: string,
    shippingAddress: Address,
    reason: 'lost' | 'stolen' | 'damaged' | 'expired'
  ): Promise<SkillancerCard> {
    const oldCard = await prisma.issuedCard.findFirst({
      where: { id: cardId, userId, type: 'physical' },
    });

    if (!oldCard) {
      throw new Error('Original card not found');
    }

    // Cancel old card if not already
    if (!['canceled', 'lost', 'stolen'].includes(oldCard.status)) {
      await this.cancelCard(
        userId,
        cardId,
        reason === 'damaged' ? 'user_request' : (reason as any)
      );
    }

    // Issue new card with same limits
    const newCard = await this.issuePhysicalCard(userId, shippingAddress, {
      nickname: oldCard.nickname || 'Skillancer Card',
      spendingLimits: oldCard.spendingLimits as SpendingLimits,
    });

    // Mark as replacement
    await prisma.issuedCard.update({
      where: { id: newCard.id },
      data: { replacementFor: cardId },
    });

    logger.info('Replacement card requested', { userId, oldCardId: cardId, newCardId: newCard.id });

    return newCard;
  }

  // ==========================================================================
  // SPENDING LIMITS
  // ==========================================================================

  /**
   * Update spending limits
   */
  async updateSpendingLimits(
    userId: string,
    cardId: string,
    limits: Partial<SpendingLimits>
  ): Promise<SkillancerCard> {
    const card = await prisma.issuedCard.findFirst({
      where: { id: cardId, userId },
    });

    if (!card) {
      throw new Error('Card not found');
    }

    const currentLimits = card.spendingLimits as SpendingLimits;
    const newLimits = { ...currentLimits, ...limits };

    // Validate limits don't exceed maximum
    Object.entries(newLimits).forEach(([key, value]) => {
      if (typeof value === 'number' && value > (DEFAULT_SPENDING_LIMITS as any)[key]) {
        throw new Error(`${key} limit cannot exceed $${(DEFAULT_SPENDING_LIMITS as any)[key]}`);
      }
    });

    // Update in Stripe
    await stripe.issuing.cards.update(card.stripeCardId, {
      spending_controls: {
        spending_limits: [
          { amount: newLimits.perTransaction * 100, interval: 'per_authorization' },
          { amount: newLimits.daily * 100, interval: 'daily' },
          { amount: newLimits.weekly * 100, interval: 'weekly' },
          { amount: newLimits.monthly * 100, interval: 'monthly' },
        ],
      },
    });

    // Update database
    const updatedCard = await prisma.issuedCard.update({
      where: { id: cardId },
      data: { spendingLimits: newLimits },
    });

    logger.info('Spending limits updated', { userId, cardId, newLimits });

    return this.mapFromDbCard(updatedCard);
  }

  // ==========================================================================
  // DIGITAL WALLET (APPLE PAY / GOOGLE PAY)
  // ==========================================================================

  /**
   * Enable digital wallet for card
   */
  async enableDigitalWallet(userId: string, cardId: string): Promise<{ provisioning_data: any }> {
    const card = await prisma.issuedCard.findFirst({
      where: { id: cardId, userId, status: 'active' },
    });

    if (!card) {
      throw new Error('Card not found or not active');
    }

    // Get provisioning data for Apple Pay / Google Pay
    // This would be implemented based on Stripe's wallet provisioning API
    const provisioningData = {
      card_id: card.stripeCardId,
      wallet_type: 'apple_pay',
      // Additional provisioning details would come from Stripe
    };

    await prisma.issuedCard.update({
      where: { id: cardId },
      data: { walletEnabled: true },
    });

    logger.info('Digital wallet enabled', { userId, cardId });

    return { provisioning_data: provisioningData };
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private async getCardholderName(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    return (
      `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'Skillancer User'
    );
  }

  private mapToSkillancerCard(dbCard: any, stripeCard?: Stripe.Issuing.Card): SkillancerCard {
    return {
      id: dbCard.id,
      stripeCardId: dbCard.stripeCardId,
      userId: dbCard.userId,
      type: dbCard.type,
      status: dbCard.status,
      last4: dbCard.last4,
      expMonth: dbCard.expMonth,
      expYear: dbCard.expYear,
      brand: dbCard.brand || 'Visa',
      cardholderName: dbCard.nickname || 'Skillancer Card',
      spendingLimits: dbCard.spendingLimits as SpendingLimits,
      billingAddress: dbCard.billingAddress || {},
      shippingAddress: dbCard.shippingAddress,
      createdAt: dbCard.createdAt,
      activatedAt: dbCard.activatedAt,
      canceledAt: dbCard.canceledAt,
      replacementFor: dbCard.replacementFor,
      walletEnabled: dbCard.walletEnabled || false,
    };
  }

  private mapFromDbCard(dbCard: any): SkillancerCard {
    return this.mapToSkillancerCard(dbCard);
  }
}

// Singleton instance
let cardServiceInstance: CardService | null = null;

export function getCardService(): CardService {
  if (!cardServiceInstance) {
    cardServiceInstance = new CardService();
  }
  return cardServiceInstance;
}

