import type {
  SkillancerCardCreateInput,
  SkillancerCardUpdateInput,
  CardTransactionInput,
  CardBalance,
  TransactionSummary,
  CardStatus,
} from '../types/financial.types.js';
import type { PrismaClient } from '@prisma/client';


export class SkillancerCardService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new Skillancer Card
   */
  async createCard(input: SkillancerCardCreateInput) {
    // Check if user already has max cards (limit to 3)
    const existingCards = await this.prisma.skillancerCard.count({
      where: { userId: input.userId, status: { not: 'CANCELLED' } },
    });

    if (existingCards >= 3) {
      throw new Error('Maximum card limit reached (3 cards)');
    }

    // Generate card number (in production, this would come from card issuer API)
    const cardNumber = this.generateMaskedCardNumber();

    const card = await this.prisma.skillancerCard.create({
      data: {
        userId: input.userId,
        cardNumber,
        cardType: input.cardType,
        nickname: input.nickname,
        spendingLimit: input.spendingLimit || 10000,
        currentBalance: 0,
        cashbackEarned: 0,
        allowedCategories: input.allowedCategories || [],
        status: input.cardType === 'VIRTUAL' ? 'ACTIVE' : 'PENDING',
        expiryDate: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000), // 3 years
      },
    });

    return card;
  }

  /**
   * Get card by ID
   */
  async getCardById(cardId: string) {
    const card = await this.prisma.skillancerCard.findUnique({
      where: { id: cardId },
      include: {
        transactions: {
          orderBy: { transactionDate: 'desc' },
          take: 20,
        },
      },
    });

    return card;
  }

  /**
   * Get all cards for a user
   */
  async getUserCards(userId: string, includeInactive = false) {
    const where: any = { userId };

    if (!includeInactive) {
      where.status = { in: ['ACTIVE', 'PENDING', 'FROZEN'] };
    }

    const cards = await this.prisma.skillancerCard.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return cards;
  }

  /**
   * Update card settings
   */
  async updateCard(cardId: string, input: SkillancerCardUpdateInput) {
    const card = await this.prisma.skillancerCard.update({
      where: { id: cardId },
      data: {
        nickname: input.nickname,
        spendingLimit: input.spendingLimit,
        allowedCategories: input.allowedCategories,
        status: input.status,
      },
    });

    return card;
  }

  /**
   * Freeze card
   */
  async freezeCard(cardId: string) {
    const card = await this.prisma.skillancerCard.update({
      where: { id: cardId },
      data: { status: 'FROZEN' },
    });

    return card;
  }

  /**
   * Unfreeze card
   */
  async unfreezeCard(cardId: string) {
    const card = await this.prisma.skillancerCard.findUnique({
      where: { id: cardId },
    });

    if (!card) {
      throw new Error('Card not found');
    }

    if (card.status !== 'FROZEN') {
      throw new Error('Card is not frozen');
    }

    const updatedCard = await this.prisma.skillancerCard.update({
      where: { id: cardId },
      data: { status: 'ACTIVE' },
    });

    return updatedCard;
  }

  /**
   * Cancel card
   */
  async cancelCard(cardId: string, reason?: string) {
    const card = await this.prisma.skillancerCard.update({
      where: { id: cardId },
      data: {
        status: 'CANCELLED',
      },
    });

    return card;
  }

  /**
   * Record a transaction
   */
  async recordTransaction(input: CardTransactionInput) {
    const card = await this.prisma.skillancerCard.findUnique({
      where: { id: input.cardId },
    });

    if (!card) {
      throw new Error('Card not found');
    }

    if (card.status !== 'ACTIVE') {
      throw new Error('Card is not active');
    }

    // Check spending limit for purchases
    if (input.transactionType === 'PURCHASE') {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthlySpend = await this.prisma.cardTransaction.aggregate({
        where: {
          cardId: input.cardId,
          transactionType: 'PURCHASE',
          status: 'COMPLETED',
          transactionDate: { gte: monthStart },
        },
        _sum: { amount: true },
      });

      const currentSpend = Number(monthlySpend._sum.amount || 0);
      if (currentSpend + input.amount > Number(card.spendingLimit)) {
        throw new Error('Transaction would exceed monthly spending limit');
      }

      // Check allowed categories if set
      if (card.allowedCategories && card.allowedCategories.length > 0) {
        if (!card.allowedCategories.includes(input.merchantCategory)) {
          throw new Error('Merchant category not allowed for this card');
        }
      }
    }

    // Calculate cashback (1% default rate)
    const cashbackRate = 0.01;
    const cashbackAmount = input.transactionType === 'PURCHASE' ? input.amount * cashbackRate : 0;

    const transaction = await this.prisma.cardTransaction.create({
      data: {
        cardId: input.cardId,
        amount: input.amount,
        currency: input.currency,
        merchantName: input.merchantName,
        merchantCategory: input.merchantCategory,
        description: input.description,
        transactionType: input.transactionType,
        status: 'COMPLETED',
        cashbackAmount,
        metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : null,
        transactionDate: new Date(),
      },
    });

    // Update card balance and cashback
    if (input.transactionType === 'PURCHASE') {
      await this.prisma.skillancerCard.update({
        where: { id: input.cardId },
        data: {
          currentBalance: { increment: input.amount },
          cashbackEarned: { increment: cashbackAmount },
          lastUsedAt: new Date(),
        },
      });
    } else if (input.transactionType === 'REFUND') {
      await this.prisma.skillancerCard.update({
        where: { id: input.cardId },
        data: {
          currentBalance: { decrement: input.amount },
        },
      });
    }

    return transaction;
  }

  /**
   * Get transactions for a card
   */
  async getTransactions(
    cardId: string,
    startDate?: Date,
    endDate?: Date,
    transactionType?: string,
    page = 1,
    limit = 50
  ) {
    const where: any = { cardId };

    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) where.transactionDate.gte = startDate;
      if (endDate) where.transactionDate.lte = endDate;
    }

    if (transactionType) {
      where.transactionType = transactionType;
    }

    const [transactions, total] = await Promise.all([
      this.prisma.cardTransaction.findMany({
        where,
        orderBy: { transactionDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.cardTransaction.count({ where }),
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get card balance
   */
  async getCardBalance(cardId: string): Promise<CardBalance> {
    const card = await this.prisma.skillancerCard.findUnique({
      where: { id: cardId },
    });

    if (!card) {
      throw new Error('Card not found');
    }

    const pendingTransactions = await this.prisma.cardTransaction.aggregate({
      where: {
        cardId,
        status: 'PENDING',
        transactionType: 'PURCHASE',
      },
      _sum: { amount: true },
    });

    return {
      available: Number(card.spendingLimit) - Number(card.currentBalance),
      pending: Number(pendingTransactions._sum.amount || 0),
      currency: 'USD',
    };
  }

  /**
   * Get transaction summary
   */
  async getTransactionSummary(
    cardId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TransactionSummary> {
    const transactions = await this.prisma.cardTransaction.findMany({
      where: {
        cardId,
        transactionDate: { gte: startDate, lte: endDate },
        status: 'COMPLETED',
      },
    });

    const categoryTotals: Record<string, number> = {};
    let totalSpent = 0;
    let totalCashback = 0;

    for (const txn of transactions) {
      if (txn.transactionType === 'PURCHASE') {
        totalSpent += Number(txn.amount);
        totalCashback += Number(txn.cashbackAmount);
        categoryTotals[txn.merchantCategory] =
          (categoryTotals[txn.merchantCategory] || 0) + Number(txn.amount);
      }
    }

    const topCategories = Object.entries(categoryTotals)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return {
      totalSpent,
      totalCashback,
      transactionCount: transactions.length,
      topCategories,
      period: { start: startDate, end: endDate },
    };
  }

  /**
   * Redeem cashback
   */
  async redeemCashback(cardId: string, amount: number) {
    const card = await this.prisma.skillancerCard.findUnique({
      where: { id: cardId },
    });

    if (!card) {
      throw new Error('Card not found');
    }

    if (Number(card.cashbackEarned) < amount) {
      throw new Error('Insufficient cashback balance');
    }

    // Record cashback redemption as a transaction
    const transaction = await this.prisma.cardTransaction.create({
      data: {
        cardId,
        amount,
        currency: 'USD',
        merchantName: 'Skillancer Cashback',
        merchantCategory: 'CASHBACK_REDEMPTION',
        transactionType: 'CASHBACK',
        status: 'COMPLETED',
        transactionDate: new Date(),
      },
    });

    // Update card balance
    await this.prisma.skillancerCard.update({
      where: { id: cardId },
      data: {
        cashbackEarned: { decrement: amount },
        currentBalance: { decrement: amount }, // Apply as statement credit
      },
    });

    return transaction;
  }

  /**
   * Generate masked card number (for display)
   */
  private generateMaskedCardNumber(): string {
    const last4 = Math.floor(1000 + Math.random() * 9000).toString();
    return `****-****-****-${last4}`;
  }
}
