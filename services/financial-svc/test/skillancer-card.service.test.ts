import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SkillancerCardService } from '../src/services/skillancer-card.service';
import type { PrismaClient } from '@prisma/client';

// Create a mock Prisma client
function createMockPrisma() {
  return {
    skillancerCard: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    cardTransaction: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
  } as unknown as PrismaClient;
}

describe('SkillancerCardService', () => {
  let service: SkillancerCardService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new SkillancerCardService(mockPrisma);
  });

  describe('createCard', () => {
    it('should create a virtual card successfully', async () => {
      const input = {
        userId: 'user-123',
        cardType: 'VIRTUAL' as const,
        nickname: 'My Virtual Card',
        spendingLimit: 5000,
        allowedCategories: ['TECHNOLOGY', 'SOFTWARE'],
      };

      (mockPrisma.skillancerCard.count as any).mockResolvedValue(0);
      (mockPrisma.skillancerCard.create as any).mockResolvedValue({
        id: 'card-123',
        userId: 'user-123',
        cardNumber: '****-****-****-1234',
        cardType: 'VIRTUAL',
        nickname: 'My Virtual Card',
        spendingLimit: 5000,
        currentBalance: 0,
        cashbackEarned: 0,
        status: 'ACTIVE',
      });

      const result = await service.createCard(input);

      expect(result).toBeDefined();
      expect(result.id).toBe('card-123');
      expect(result.status).toBe('ACTIVE'); // Virtual cards are active immediately
      expect(mockPrisma.skillancerCard.create).toHaveBeenCalled();
    });

    it('should create a physical card as pending', async () => {
      const input = {
        userId: 'user-123',
        cardType: 'PHYSICAL' as const,
        nickname: 'My Physical Card',
      };

      (mockPrisma.skillancerCard.count as any).mockResolvedValue(0);
      (mockPrisma.skillancerCard.create as any).mockResolvedValue({
        id: 'card-456',
        status: 'PENDING',
        cardType: 'PHYSICAL',
      });

      const result = await service.createCard(input);

      expect(result.status).toBe('PENDING');
    });

    it('should throw error when max card limit reached', async () => {
      (mockPrisma.skillancerCard.count as any).mockResolvedValue(3);

      await expect(
        service.createCard({
          userId: 'user-123',
          cardType: 'VIRTUAL',
        })
      ).rejects.toThrow('Maximum card limit reached (3 cards)');
    });
  });

  describe('getCardById', () => {
    it('should return card with recent transactions', async () => {
      const mockCard = {
        id: 'card-123',
        userId: 'user-123',
        cardNumber: '****-****-****-1234',
        status: 'ACTIVE',
        transactions: [
          { id: 'txn-1', amount: 50 },
          { id: 'txn-2', amount: 100 },
        ],
      };

      (mockPrisma.skillancerCard.findUnique as any).mockResolvedValue(mockCard);

      const result = await service.getCardById('card-123');

      expect(result).toEqual(mockCard);
      expect(result?.transactions).toHaveLength(2);
    });

    it('should return null for non-existent card', async () => {
      (mockPrisma.skillancerCard.findUnique as any).mockResolvedValue(null);

      const result = await service.getCardById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getUserCards', () => {
    it('should return active cards by default', async () => {
      const mockCards = [
        { id: 'card-1', status: 'ACTIVE' },
        { id: 'card-2', status: 'FROZEN' },
      ];

      (mockPrisma.skillancerCard.findMany as any).mockResolvedValue(mockCards);

      const result = await service.getUserCards('user-123');

      expect(result).toHaveLength(2);
      expect(mockPrisma.skillancerCard.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          status: { in: ['ACTIVE', 'PENDING', 'FROZEN'] },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should include inactive cards when requested', async () => {
      (mockPrisma.skillancerCard.findMany as any).mockResolvedValue([]);

      await service.getUserCards('user-123', true);

      expect(mockPrisma.skillancerCard.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('freezeCard', () => {
    it('should freeze an active card', async () => {
      (mockPrisma.skillancerCard.update as any).mockResolvedValue({
        id: 'card-123',
        status: 'FROZEN',
      });

      const result = await service.freezeCard('card-123');

      expect(result.status).toBe('FROZEN');
      expect(mockPrisma.skillancerCard.update).toHaveBeenCalledWith({
        where: { id: 'card-123' },
        data: { status: 'FROZEN' },
      });
    });
  });

  describe('unfreezeCard', () => {
    it('should unfreeze a frozen card', async () => {
      (mockPrisma.skillancerCard.findUnique as any).mockResolvedValue({
        id: 'card-123',
        status: 'FROZEN',
      });
      (mockPrisma.skillancerCard.update as any).mockResolvedValue({
        id: 'card-123',
        status: 'ACTIVE',
      });

      const result = await service.unfreezeCard('card-123');

      expect(result.status).toBe('ACTIVE');
    });

    it('should throw error for non-existent card', async () => {
      (mockPrisma.skillancerCard.findUnique as any).mockResolvedValue(null);

      await expect(service.unfreezeCard('non-existent')).rejects.toThrow('Card not found');
    });

    it('should throw error if card is not frozen', async () => {
      (mockPrisma.skillancerCard.findUnique as any).mockResolvedValue({
        id: 'card-123',
        status: 'ACTIVE',
      });

      await expect(service.unfreezeCard('card-123')).rejects.toThrow('Card is not frozen');
    });
  });

  describe('cancelCard', () => {
    it('should cancel a card', async () => {
      (mockPrisma.skillancerCard.update as any).mockResolvedValue({
        id: 'card-123',
        status: 'CANCELLED',
      });

      const result = await service.cancelCard('card-123', 'User requested');

      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('recordTransaction', () => {
    it('should record a purchase transaction', async () => {
      const mockCard = {
        id: 'card-123',
        status: 'ACTIVE',
        spendingLimit: 1000,
        allowedCategories: [],
      };

      (mockPrisma.skillancerCard.findUnique as any).mockResolvedValue(mockCard);
      (mockPrisma.cardTransaction.aggregate as any).mockResolvedValue({ _sum: { amount: 100 } });
      (mockPrisma.cardTransaction.create as any).mockResolvedValue({
        id: 'txn-123',
        amount: 50,
        transactionType: 'PURCHASE',
        status: 'COMPLETED',
        cashbackAmount: 0.5,
      });
      (mockPrisma.skillancerCard.update as any).mockResolvedValue({});

      const result = await service.recordTransaction({
        cardId: 'card-123',
        amount: 50,
        currency: 'USD',
        merchantName: 'Test Store',
        merchantCategory: 'TECHNOLOGY',
        transactionType: 'PURCHASE',
      });

      expect(result).toBeDefined();
      expect(result.transactionType).toBe('PURCHASE');
      expect(result.cashbackAmount).toBe(0.5); // 1% cashback
    });

    it('should throw error for inactive card', async () => {
      (mockPrisma.skillancerCard.findUnique as any).mockResolvedValue({
        id: 'card-123',
        status: 'FROZEN',
      });

      await expect(
        service.recordTransaction({
          cardId: 'card-123',
          amount: 50,
          currency: 'USD',
          merchantName: 'Test',
          merchantCategory: 'TECHNOLOGY',
          transactionType: 'PURCHASE',
        })
      ).rejects.toThrow('Card is not active');
    });

    it('should throw error when spending limit exceeded', async () => {
      (mockPrisma.skillancerCard.findUnique as any).mockResolvedValue({
        id: 'card-123',
        status: 'ACTIVE',
        spendingLimit: 100,
        allowedCategories: [],
      });
      (mockPrisma.cardTransaction.aggregate as any).mockResolvedValue({ _sum: { amount: 90 } });

      await expect(
        service.recordTransaction({
          cardId: 'card-123',
          amount: 50,
          currency: 'USD',
          merchantName: 'Test',
          merchantCategory: 'TECHNOLOGY',
          transactionType: 'PURCHASE',
        })
      ).rejects.toThrow('Transaction would exceed monthly spending limit');
    });

    it('should throw error for disallowed category', async () => {
      (mockPrisma.skillancerCard.findUnique as any).mockResolvedValue({
        id: 'card-123',
        status: 'ACTIVE',
        spendingLimit: 1000,
        allowedCategories: ['SOFTWARE'],
      });
      (mockPrisma.cardTransaction.aggregate as any).mockResolvedValue({ _sum: { amount: 0 } });

      await expect(
        service.recordTransaction({
          cardId: 'card-123',
          amount: 50,
          currency: 'USD',
          merchantName: 'Test',
          merchantCategory: 'FOOD',
          transactionType: 'PURCHASE',
        })
      ).rejects.toThrow('Merchant category not allowed for this card');
    });
  });

  describe('getCardBalance', () => {
    it('should return card balance with available and pending', async () => {
      (mockPrisma.skillancerCard.findUnique as any).mockResolvedValue({
        id: 'card-123',
        spendingLimit: 1000,
        currentBalance: 250,
      });
      (mockPrisma.cardTransaction.aggregate as any).mockResolvedValue({ _sum: { amount: 50 } });

      const result = await service.getCardBalance('card-123');

      expect(result.available).toBe(750); // 1000 - 250
      expect(result.pending).toBe(50);
      expect(result.currency).toBe('USD');
    });

    it('should throw error for non-existent card', async () => {
      (mockPrisma.skillancerCard.findUnique as any).mockResolvedValue(null);

      await expect(service.getCardBalance('non-existent')).rejects.toThrow('Card not found');
    });
  });

  describe('getTransactions', () => {
    it('should return paginated transactions', async () => {
      const mockTransactions = [
        { id: 'txn-1', amount: 100 },
        { id: 'txn-2', amount: 50 },
      ];

      (mockPrisma.cardTransaction.findMany as any).mockResolvedValue(mockTransactions);
      (mockPrisma.cardTransaction.count as any).mockResolvedValue(10);

      const result = await service.getTransactions('card-123');

      expect(result.transactions).toHaveLength(2);
      expect(result.pagination.total).toBe(10);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      (mockPrisma.cardTransaction.findMany as any).mockResolvedValue([]);
      (mockPrisma.cardTransaction.count as any).mockResolvedValue(0);

      await service.getTransactions('card-123', startDate, endDate);

      expect(mockPrisma.cardTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            transactionDate: { gte: startDate, lte: endDate },
          }),
        })
      );
    });
  });

  describe('getTransactionSummary', () => {
    it('should return transaction summary with category breakdown', async () => {
      const mockTransactions = [
        { transactionType: 'PURCHASE', amount: 100, merchantCategory: 'SOFTWARE', cashbackAmount: 1 },
        { transactionType: 'PURCHASE', amount: 50, merchantCategory: 'SOFTWARE', cashbackAmount: 0.5 },
        { transactionType: 'PURCHASE', amount: 30, merchantCategory: 'FOOD', cashbackAmount: 0.3 },
        { transactionType: 'REFUND', amount: 20, merchantCategory: 'SOFTWARE', cashbackAmount: 0 },
      ];

      (mockPrisma.cardTransaction.findMany as any).mockResolvedValue(mockTransactions);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const result = await service.getTransactionSummary('card-123', startDate, endDate);

      expect(result.totalSpent).toBe(180); // 100 + 50 + 30 (refunds not counted)
      expect(result.totalCashback).toBe(1.8);
      expect(result.topCategories).toHaveLength(2);
      expect(result.topCategories[0].category).toBe('SOFTWARE');
      expect(result.topCategories[0].amount).toBe(150);
    });
  });

  describe('redeemCashback', () => {
    it('should redeem cashback successfully', async () => {
      (mockPrisma.skillancerCard.findUnique as any).mockResolvedValue({
        id: 'card-123',
        cashbackEarned: 50,
      });
      (mockPrisma.cardTransaction.create as any).mockResolvedValue({
        id: 'txn-123',
        transactionType: 'CASHBACK',
        amount: 25,
      });
      (mockPrisma.skillancerCard.update as any).mockResolvedValue({});

      const result = await service.redeemCashback('card-123', 25);

      expect(result.transactionType).toBe('CASHBACK');
      expect(result.amount).toBe(25);
    });

    it('should throw error for insufficient cashback', async () => {
      (mockPrisma.skillancerCard.findUnique as any).mockResolvedValue({
        id: 'card-123',
        cashbackEarned: 10,
      });

      await expect(service.redeemCashback('card-123', 25)).rejects.toThrow(
        'Insufficient cashback balance'
      );
    });
  });
});
