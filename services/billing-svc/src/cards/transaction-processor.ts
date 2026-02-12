// @ts-nocheck
/**
 * Card Transaction Processor
 * Real-time authorization, categorization, and receipt handling
 * Sprint M5: Freelancer Financial Services
 */

import Stripe from 'stripe';
import { prisma } from '@skillancer/database';
import { logger } from '../lib/logger.js';
import { getBalanceManager } from '../treasury/balance-manager.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// ============================================================================
// TYPES
// ============================================================================

export interface CardTransaction {
  id: string;
  stripeAuthorizationId?: string;
  stripeTransactionId?: string;
  cardId: string;
  userId: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  type: TransactionType;
  merchantName: string;
  merchantCategory: string;
  merchantCategoryCode: string;
  merchantCity?: string;
  merchantCountry?: string;
  description: string;
  receiptUrl?: string;
  category: ExpenseCategory;
  isBusinessExpense: boolean;
  notes?: string;
  createdAt: Date;
  settledAt?: Date;
}

export type TransactionStatus =
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'declined'
  | 'refunded'
  | 'reversed';
export type TransactionType = 'purchase' | 'refund' | 'atm_withdrawal' | 'transfer';

export type ExpenseCategory =
  | 'software_subscriptions'
  | 'office_supplies'
  | 'travel'
  | 'meals_entertainment'
  | 'professional_services'
  | 'advertising'
  | 'utilities'
  | 'equipment'
  | 'education'
  | 'health'
  | 'personal'
  | 'other';

export interface AuthorizationRequest {
  stripeAuthorizationId: string;
  cardId: string;
  amount: number;
  currency: string;
  merchant: {
    name: string;
    category: string;
    categoryCode: string;
    city?: string;
    country?: string;
  };
  metadata?: Record<string, any>;
}

export interface AuthorizationDecision {
  approved: boolean;
  reason?: string;
}

export interface TransactionReceipt {
  id: string;
  transactionId: string;
  imageUrl?: string;
  merchantReceipt?: string;
  parsedData?: {
    items?: Array<{ name: string; quantity: number; price: number }>;
    subtotal?: number;
    tax?: number;
    total?: number;
  };
  uploadedAt: Date;
}

// ============================================================================
// MERCHANT CATEGORY MAPPING
// ============================================================================

const MCC_TO_CATEGORY: Record<string, ExpenseCategory> = {
  // Software & SaaS
  '5734': 'software_subscriptions',
  '5817': 'software_subscriptions',
  '5818': 'software_subscriptions',

  // Office supplies
  '5111': 'office_supplies',
  '5943': 'office_supplies',
  '5044': 'office_supplies',

  // Travel
  '3000': 'travel', // Airlines range
  '4111': 'travel', // Transit
  '4121': 'travel', // Taxi
  '7011': 'travel', // Hotels
  '7512': 'travel', // Car rental

  // Meals & Entertainment
  '5812': 'meals_entertainment', // Restaurants
  '5813': 'meals_entertainment', // Bars
  '5814': 'meals_entertainment', // Fast food
  '7832': 'meals_entertainment', // Movies
  '7922': 'meals_entertainment', // Events

  // Professional services
  '8111': 'professional_services', // Legal
  '8931': 'professional_services', // Accounting
  '7392': 'professional_services', // Consulting

  // Advertising
  '7311': 'advertising',
  '7312': 'advertising',

  // Education
  '8220': 'education',
  '8241': 'education',
  '8244': 'education',
  '8299': 'education',

  // Equipment
  '5732': 'equipment', // Electronics
  '5045': 'equipment', // Computers
  '5946': 'equipment', // Camera
};

// ============================================================================
// TRANSACTION PROCESSOR SERVICE
// ============================================================================

export class TransactionProcessor {
  private balanceManager = getBalanceManager();

  // ==========================================================================
  // REAL-TIME AUTHORIZATION
  // ==========================================================================

  /**
   * Process authorization request (called by webhook)
   */
  async processAuthorization(request: AuthorizationRequest): Promise<AuthorizationDecision> {
    const card = await prisma.issuedCard.findFirst({
      where: { stripeCardId: request.cardId },
      include: { user: true },
    });

    if (!card) {
      logger.warn('Authorization for unknown card', { cardId: request.cardId });
      return { approved: false, reason: 'Card not found' };
    }

    // Check card status
    if (card.status !== 'active') {
      return { approved: false, reason: `Card is ${card.status}` };
    }

    // Check spending limits
    const limitCheck = await this.checkSpendingLimits(
      card.id,
      request.amount,
      card.spendingLimits as any
    );
    if (!limitCheck.allowed) {
      return { approved: false, reason: limitCheck.reason };
    }

    // Check merchant restrictions
    const merchantCheck = await this.checkMerchantRestrictions(
      card.userId,
      request.merchant.categoryCode
    );
    if (!merchantCheck.allowed) {
      return { approved: false, reason: merchantCheck.reason };
    }

    // Check balance
    const balance = await this.balanceManager.getAvailableForPayout(card.userId);
    if (balance < request.amount / 100) {
      return { approved: false, reason: 'Insufficient funds' };
    }

    // Create pending transaction
    await prisma.cardTransaction.create({
      data: {
        userId: card.userId,
        cardId: card.id,
        stripeAuthorizationId: request.stripeAuthorizationId,
        amount: request.amount,
        currency: request.currency,
        status: 'authorized',
        type: 'purchase',
        merchantName: request.merchant.name,
        merchantCategory: request.merchant.category,
        merchantCategoryCode: request.merchant.categoryCode,
        merchantCity: request.merchant.city,
        merchantCountry: request.merchant.country,
        description: `Purchase at ${request.merchant.name}`,
        category: this.categorizeTransaction(request.merchant.categoryCode),
        isBusinessExpense: this.isLikelyBusinessExpense(request.merchant.categoryCode),
      },
    });

    logger.info('Authorization approved', {
      cardId: card.id,
      amount: request.amount,
      merchant: request.merchant.name,
    });

    return { approved: true };
  }

  /**
   * Check spending limits
   */
  private async checkSpendingLimits(
    cardId: string,
    amount: number,
    limits: { perTransaction: number; daily: number; weekly: number; monthly: number }
  ): Promise<{ allowed: boolean; reason?: string }> {
    const amountDollars = amount / 100;

    // Per-transaction limit
    if (amountDollars > limits.perTransaction) {
      return { allowed: false, reason: 'Exceeds per-transaction limit' };
    }

    // Daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailySpent = await this.getSpentAmount(cardId, today);
    if (dailySpent + amountDollars > limits.daily) {
      return { allowed: false, reason: 'Exceeds daily spending limit' };
    }

    // Weekly limit
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklySpent = await this.getSpentAmount(cardId, weekAgo);
    if (weeklySpent + amountDollars > limits.weekly) {
      return { allowed: false, reason: 'Exceeds weekly spending limit' };
    }

    // Monthly limit
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const monthlySpent = await this.getSpentAmount(cardId, monthAgo);
    if (monthlySpent + amountDollars > limits.monthly) {
      return { allowed: false, reason: 'Exceeds monthly spending limit' };
    }

    return { allowed: true };
  }

  private async getSpentAmount(cardId: string, since: Date): Promise<number> {
    const result = await prisma.cardTransaction.aggregate({
      where: {
        cardId,
        status: { in: ['authorized', 'captured'] },
        type: 'purchase',
        createdAt: { gte: since },
      },
      _sum: { amount: true },
    });

    return (result._sum.amount || 0) / 100;
  }

  /**
   * Check merchant restrictions
   */
  private async checkMerchantRestrictions(
    userId: string,
    mcc: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const restrictions = await prisma.merchantRestriction.findFirst({
      where: { userId, merchantCategoryCode: mcc },
    });

    if (restrictions && !restrictions.allowed) {
      return { allowed: false, reason: `Merchant category blocked: ${restrictions.reason}` };
    }

    return { allowed: true };
  }

  // ==========================================================================
  // TRANSACTION LIFECYCLE
  // ==========================================================================

  /**
   * Handle transaction captured (settled)
   */
  async handleTransactionCaptured(stripeTransactionId: string): Promise<void> {
    const stripeTransaction = await stripe.issuing.transactions.retrieve(stripeTransactionId);

    const transaction = await prisma.cardTransaction.findFirst({
      where: { stripeAuthorizationId: stripeTransaction.authorization as string },
    });

    if (!transaction) {
      // Create new transaction record
      const card = await prisma.issuedCard.findFirst({
        where: { stripeCardId: stripeTransaction.card as string },
      });

      if (card) {
        await prisma.cardTransaction.create({
          data: {
            userId: card.userId,
            cardId: card.id,
            stripeTransactionId,
            amount: Math.abs(stripeTransaction.amount),
            currency: stripeTransaction.currency,
            status: 'captured',
            type: stripeTransaction.type === 'refund' ? 'refund' : 'purchase',
            merchantName: stripeTransaction.merchant_data.name || 'Unknown',
            merchantCategory: stripeTransaction.merchant_data.category || 'Unknown',
            merchantCategoryCode: stripeTransaction.merchant_data.category_code || '0000',
            merchantCity: stripeTransaction.merchant_data.city,
            merchantCountry: stripeTransaction.merchant_data.country,
            description: `Purchase at ${stripeTransaction.merchant_data.name}`,
            category: this.categorizeTransaction(
              stripeTransaction.merchant_data.category_code || '0000'
            ),
            isBusinessExpense: this.isLikelyBusinessExpense(
              stripeTransaction.merchant_data.category_code || '0000'
            ),
            settledAt: new Date(),
          },
        });
      }
    } else {
      // Update existing authorization
      await prisma.cardTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'captured',
          stripeTransactionId,
          settledAt: new Date(),
        },
      });
    }

    logger.info('Transaction captured', { stripeTransactionId });
  }

  /**
   * Handle authorization declined
   */
  async handleAuthorizationDeclined(stripeAuthorizationId: string, reason: string): Promise<void> {
    await prisma.cardTransaction.updateMany({
      where: { stripeAuthorizationId },
      data: { status: 'declined', description: reason },
    });

    logger.info('Authorization declined', { stripeAuthorizationId, reason });
  }

  /**
   * Handle refund
   */
  async handleRefund(stripeTransactionId: string, originalTransactionId: string): Promise<void> {
    const original = await prisma.cardTransaction.findFirst({
      where: { stripeTransactionId: originalTransactionId },
    });

    if (!original) {
      logger.warn('Refund for unknown transaction', { originalTransactionId });
      return;
    }

    await prisma.cardTransaction.create({
      data: {
        userId: original.userId,
        cardId: original.cardId,
        stripeTransactionId,
        amount: original.amount,
        currency: original.currency,
        status: 'refunded',
        type: 'refund',
        merchantName: original.merchantName,
        merchantCategory: original.merchantCategory,
        merchantCategoryCode: original.merchantCategoryCode,
        description: `Refund from ${original.merchantName}`,
        category: original.category,
        isBusinessExpense: original.isBusinessExpense,
        settledAt: new Date(),
      },
    });

    // Update original transaction
    await prisma.cardTransaction.update({
      where: { id: original.id },
      data: { status: 'refunded' },
    });

    logger.info('Refund processed', { stripeTransactionId, originalTransactionId });
  }

  // ==========================================================================
  // TRANSACTION QUERIES
  // ==========================================================================

  /**
   * Get user transactions
   */
  async getTransactions(
    userId: string,
    options: {
      cardId?: string;
      startDate?: Date;
      endDate?: Date;
      category?: ExpenseCategory;
      status?: TransactionStatus;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ transactions: CardTransaction[]; total: number }> {
    const where: any = { userId };

    if (options.cardId) where.cardId = options.cardId;
    if (options.category) where.category = options.category;
    if (options.status) where.status = options.status;
    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    const [transactions, total] = await Promise.all([
      prisma.cardTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options.limit || 50,
        skip: options.offset || 0,
      }),
      prisma.cardTransaction.count({ where }),
    ]);

    return {
      transactions: transactions.map((t) => this.mapTransaction(t)),
      total,
    };
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(userId: string, transactionId: string): Promise<CardTransaction | null> {
    const transaction = await prisma.cardTransaction.findFirst({
      where: { id: transactionId, userId },
    });

    return transaction ? this.mapTransaction(transaction) : null;
  }

  /**
   * Get spending summary by category
   */
  async getSpendingSummary(
    userId: string,
    options: { startDate?: Date; endDate?: Date } = {}
  ): Promise<Record<ExpenseCategory, number>> {
    const startDate =
      options.startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = options.endDate || new Date();

    const result = await prisma.cardTransaction.groupBy({
      by: ['category'],
      where: {
        userId,
        status: 'captured',
        type: 'purchase',
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    });

    const summary: Partial<Record<ExpenseCategory, number>> = {};
    for (const r of result) {
      summary[r.category as ExpenseCategory] = (r._sum.amount || 0) / 100;
    }

    return summary as Record<ExpenseCategory, number>;
  }

  // ==========================================================================
  // CATEGORIZATION
  // ==========================================================================

  /**
   * Categorize transaction based on MCC
   */
  private categorizeTransaction(mcc: string): ExpenseCategory {
    return MCC_TO_CATEGORY[mcc] || 'other';
  }

  /**
   * Determine if likely a business expense
   */
  private isLikelyBusinessExpense(mcc: string): boolean {
    const businessCategories: ExpenseCategory[] = [
      'software_subscriptions',
      'office_supplies',
      'professional_services',
      'advertising',
      'equipment',
      'education',
    ];

    const category = this.categorizeTransaction(mcc);
    return businessCategories.includes(category);
  }

  /**
   * Update transaction category
   */
  async updateCategory(
    userId: string,
    transactionId: string,
    category: ExpenseCategory,
    isBusinessExpense?: boolean
  ): Promise<CardTransaction> {
    const transaction = await prisma.cardTransaction.update({
      where: { id: transactionId },
      data: {
        category,
        isBusinessExpense:
          isBusinessExpense ??
          (await this.getTransaction(userId, transactionId))?.isBusinessExpense,
      },
    });

    return this.mapTransaction(transaction);
  }

  // ==========================================================================
  // RECEIPTS
  // ==========================================================================

  /**
   * Attach receipt to transaction
   */
  async attachReceipt(
    userId: string,
    transactionId: string,
    receiptUrl: string
  ): Promise<TransactionReceipt> {
    const transaction = await prisma.cardTransaction.findFirst({
      where: { id: transactionId, userId },
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    const receipt = await prisma.transactionReceipt.create({
      data: {
        transactionId,
        imageUrl: receiptUrl,
        uploadedAt: new Date(),
      },
    });

    await prisma.cardTransaction.update({
      where: { id: transactionId },
      data: { receiptUrl },
    });

    logger.info('Receipt attached', { transactionId, userId });

    return {
      id: receipt.id,
      transactionId,
      imageUrl: receiptUrl,
      uploadedAt: receipt.uploadedAt,
    };
  }

  /**
   * Add notes to transaction
   */
  async addNotes(userId: string, transactionId: string, notes: string): Promise<CardTransaction> {
    const transaction = await prisma.cardTransaction.update({
      where: { id: transactionId },
      data: { notes },
    });

    return this.mapTransaction(transaction);
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private mapTransaction(t: any): CardTransaction {
    return {
      id: t.id,
      stripeAuthorizationId: t.stripeAuthorizationId,
      stripeTransactionId: t.stripeTransactionId,
      cardId: t.cardId,
      userId: t.userId,
      amount: t.amount / 100,
      currency: t.currency,
      status: t.status,
      type: t.type,
      merchantName: t.merchantName,
      merchantCategory: t.merchantCategory,
      merchantCategoryCode: t.merchantCategoryCode,
      merchantCity: t.merchantCity,
      merchantCountry: t.merchantCountry,
      description: t.description,
      receiptUrl: t.receiptUrl,
      category: t.category,
      isBusinessExpense: t.isBusinessExpense,
      notes: t.notes,
      createdAt: t.createdAt,
      settledAt: t.settledAt,
    };
  }
}

// Singleton instance
let transactionProcessorInstance: TransactionProcessor | null = null;

export function getTransactionProcessor(): TransactionProcessor {
  if (!transactionProcessorInstance) {
    transactionProcessorInstance = new TransactionProcessor();
  }
  return transactionProcessorInstance;
}
