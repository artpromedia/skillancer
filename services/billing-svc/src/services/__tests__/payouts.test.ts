/**
 * @module @skillancer/billing-svc/services/__tests__/payouts
 * Comprehensive unit tests for PayoutAccountService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const mockPrisma = {
  payoutAccount: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  payout: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
  },
};

vi.mock('@skillancer/database', () => ({
  prisma: mockPrisma,
}));

const mockStripeService = {
  createConnectAccount: vi.fn(),
  createAccountLink: vi.fn(),
  createLoginLink: vi.fn(),
  getConnectAccount: vi.fn(),
  createTransfer: vi.fn(),
};

vi.mock('../stripe.service.js', () => ({
  getStripeService: vi.fn(() => mockStripeService),
}));

vi.mock('../../config/index.js', () => ({
  getConfig: vi.fn(() => ({
    appUrl: 'https://skillancer.com',
  })),
}));

vi.mock('../../errors/index.js', () => ({
  PayoutAccountNotFoundError: class extends Error {
    constructor(userId: string) {
      super(`Payout account not found for user ${userId}`);
      this.name = 'PayoutAccountNotFoundError';
    }
  },
  PayoutAccountNotActiveError: class extends Error {
    constructor(userId: string) {
      super(`Payout account is not active for user ${userId}`);
      this.name = 'PayoutAccountNotActiveError';
    }
  },
  PayoutAccountExistsError: class extends Error {
    constructor(userId: string) {
      super(`Payout account already exists for user ${userId}`);
      this.name = 'PayoutAccountExistsError';
    }
  },
}));

import { PayoutAccountService } from '../payout.service.js';

// =============================================================================
// TEST SUITE
// =============================================================================

describe('PayoutAccountService', () => {
  let service: PayoutAccountService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PayoutAccountService();
  });

  // ===========================================================================
  // getPayoutAccount
  // ===========================================================================

  describe('getPayoutAccount()', () => {
    it('should return formatted payout account for existing user', async () => {
      const mockAccount = {
        id: 'pa-001',
        userId: 'user-001',
        stripeConnectAccountId: 'acct_test123',
        accountType: 'EXPRESS',
        status: 'ACTIVE',
        country: 'US',
        businessType: 'individual',
        detailsSubmitted: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        currentlyDue: [],
        eventuallyDue: [],
        pastDue: [],
        defaultCurrency: 'usd',
        externalAccountType: 'bank_account',
        externalAccountLast4: '6789',
        externalAccountBank: 'Chase',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
      };

      mockPrisma.payoutAccount.findUnique.mockResolvedValue(mockAccount);

      const result = await service.getPayoutAccount('user-001');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('pa-001');
      expect(result!.status).toBe('ACTIVE');
      expect(result!.accountType).toBe('EXPRESS');
      expect(result!.chargesEnabled).toBe(true);
      expect(result!.payoutsEnabled).toBe(true);
      expect(result!.externalAccount).toBeDefined();
      expect(result!.externalAccount!.last4).toBe('6789');
      expect(result!.externalAccount!.bankName).toBe('Chase');
    });

    it('should return null for non-existent user', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue(null);

      const result = await service.getPayoutAccount('nonexistent');

      expect(result).toBeNull();
    });

    it('should return account without external account info if not set', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue({
        id: 'pa-002',
        userId: 'user-002',
        status: 'PENDING',
        accountType: 'EXPRESS',
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        currentlyDue: ['identity.first_name'],
        eventuallyDue: [],
        pastDue: [],
        externalAccountType: null,
        externalAccountLast4: null,
        externalAccountBank: null,
        defaultCurrency: null,
        country: 'US',
        businessType: 'individual',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getPayoutAccount('user-002');

      expect(result!.externalAccount).toBeUndefined();
      expect(result!.requirements.currentlyDue).toContain('identity.first_name');
    });
  });

  // ===========================================================================
  // createPayoutAccount
  // ===========================================================================

  describe('createPayoutAccount()', () => {
    it('should create a new Express payout account', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue(null);

      mockStripeService.createConnectAccount.mockResolvedValue({
        id: 'acct_new123',
      });

      mockPrisma.payoutAccount.create.mockResolvedValue({
        id: 'pa-new',
        userId: 'user-001',
        stripeConnectAccountId: 'acct_new123',
        accountType: 'EXPRESS',
        status: 'PENDING',
        country: 'US',
        businessType: 'individual',
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        currentlyDue: [],
        eventuallyDue: [],
        pastDue: [],
        externalAccountType: null,
        externalAccountLast4: null,
        externalAccountBank: null,
        defaultCurrency: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockStripeService.createAccountLink.mockResolvedValue({
        url: 'https://connect.stripe.com/onboarding/abc123',
      });

      const result = await service.createPayoutAccount('user-001', 'test@example.com', {
        country: 'US',
        businessType: 'individual',
      });

      expect(result.account).toBeDefined();
      expect(result.account.status).toBe('PENDING');
      expect(result.onboardingUrl).toContain('stripe.com');
      expect(mockStripeService.createConnectAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          country: 'US',
          type: 'express',
          businessType: 'individual',
        })
      );
    });

    it('should throw when user already has a payout account', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue({
        id: 'pa-existing',
        userId: 'user-001',
      });

      await expect(
        service.createPayoutAccount('user-001', 'test@example.com', { country: 'US' })
      ).rejects.toThrow('already exists');
    });

    it('should create a Standard account type', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue(null);
      mockStripeService.createConnectAccount.mockResolvedValue({ id: 'acct_std' });
      mockPrisma.payoutAccount.create.mockResolvedValue({
        id: 'pa-std',
        userId: 'user-002',
        accountType: 'STANDARD',
        status: 'PENDING',
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        currentlyDue: [],
        eventuallyDue: [],
        pastDue: [],
        externalAccountType: null,
        externalAccountLast4: null,
        externalAccountBank: null,
        defaultCurrency: null,
        country: 'GB',
        businessType: 'company',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockStripeService.createAccountLink.mockResolvedValue({
        url: 'https://connect.stripe.com/onboarding/std',
      });

      await service.createPayoutAccount('user-002', 'std@example.com', {
        country: 'GB',
        businessType: 'company',
        accountType: 'STANDARD',
      });

      expect(mockStripeService.createConnectAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'standard',
          businessType: 'company',
          country: 'GB',
        })
      );
    });

    it('should default to EXPRESS account type when not specified', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue(null);
      mockStripeService.createConnectAccount.mockResolvedValue({ id: 'acct_def' });
      mockPrisma.payoutAccount.create.mockResolvedValue({
        id: 'pa-def',
        status: 'PENDING',
        accountType: 'EXPRESS',
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        currentlyDue: [],
        eventuallyDue: [],
        pastDue: [],
        externalAccountType: null,
        externalAccountLast4: null,
        externalAccountBank: null,
        defaultCurrency: null,
        country: 'US',
        businessType: 'individual',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockStripeService.createAccountLink.mockResolvedValue({ url: 'https://onboard.test' });

      await service.createPayoutAccount('user-003', 'def@example.com', { country: 'US' });

      expect(mockPrisma.payoutAccount.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountType: 'EXPRESS',
          }),
        })
      );
    });

    it('should include metadata in Stripe account creation', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue(null);
      mockStripeService.createConnectAccount.mockResolvedValue({ id: 'acct_meta' });
      mockPrisma.payoutAccount.create.mockResolvedValue({
        id: 'pa-meta',
        status: 'PENDING',
        accountType: 'EXPRESS',
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        currentlyDue: [],
        eventuallyDue: [],
        pastDue: [],
        externalAccountType: null,
        externalAccountLast4: null,
        externalAccountBank: null,
        defaultCurrency: null,
        country: 'US',
        businessType: 'individual',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockStripeService.createAccountLink.mockResolvedValue({ url: 'https://onboard.test' });

      await service.createPayoutAccount('user-004', 'meta@example.com', { country: 'US' });

      expect(mockStripeService.createConnectAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { skillancer_user_id: 'user-004' },
        })
      );
    });
  });

  // ===========================================================================
  // getOnboardingLink
  // ===========================================================================

  describe('getOnboardingLink()', () => {
    it('should return onboarding link for incomplete account', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue({
        id: 'pa-001',
        stripeConnectAccountId: 'acct_test123',
        status: 'PENDING',
      });

      mockStripeService.createAccountLink.mockResolvedValue({
        url: 'https://connect.stripe.com/onboarding/resume123',
      });

      const result = await service.getOnboardingLink('user-001');

      expect(result.onboardingUrl).toContain('stripe.com');
      expect(result.expiresAt).toBeDefined();
    });

    it('should throw when user has no payout account', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue(null);

      await expect(service.getOnboardingLink('user-nonexistent')).rejects.toThrow('not found');
    });

    it('should throw when account has no Stripe Connect ID', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue({
        id: 'pa-002',
        stripeConnectAccountId: null,
      });

      await expect(service.getOnboardingLink('user-002')).rejects.toThrow('not found');
    });
  });

  // ===========================================================================
  // getDashboardLink
  // ===========================================================================

  describe('getDashboardLink()', () => {
    it('should return dashboard link for active Express account', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue({
        id: 'pa-001',
        stripeConnectAccountId: 'acct_test123',
        accountType: 'EXPRESS',
        status: 'ACTIVE',
      });

      mockStripeService.createLoginLink.mockResolvedValue({
        url: 'https://connect.stripe.com/dashboard/abc',
      });

      const result = await service.getDashboardLink('user-001');

      expect(result.dashboardUrl).toContain('stripe.com');
    });

    it('should throw when account is not Express type', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue({
        id: 'pa-002',
        stripeConnectAccountId: 'acct_std',
        accountType: 'STANDARD',
        status: 'ACTIVE',
      });

      await expect(service.getDashboardLink('user-002')).rejects.toThrow('Express accounts');
    });

    it('should throw when account is not active', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue({
        id: 'pa-003',
        stripeConnectAccountId: 'acct_pending',
        accountType: 'EXPRESS',
        status: 'PENDING',
      });

      await expect(service.getDashboardLink('user-003')).rejects.toThrow('not active');
    });

    it('should throw when account does not exist', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue(null);

      await expect(service.getDashboardLink('nonexistent')).rejects.toThrow('not found');
    });
  });

  // ===========================================================================
  // createPayout
  // ===========================================================================

  describe('createPayout()', () => {
    it('should create a payout to active account', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue({
        id: 'pa-001',
        stripeConnectAccountId: 'acct_test123',
        status: 'ACTIVE',
        payoutsEnabled: true,
        defaultCurrency: 'usd',
      });

      mockStripeService.createTransfer.mockResolvedValue({
        id: 'tr_test123',
      });

      mockPrisma.payout.create.mockResolvedValue({
        id: 'payout-001',
        payoutAccountId: 'pa-001',
        stripeTransferId: 'tr_test123',
        amount: 5000,
        currency: 'usd',
        status: 'PENDING',
        referenceType: 'milestone',
        referenceId: 'ms-001',
        description: 'Milestone payment',
        failureCode: null,
        failureMessage: null,
        processedAt: null,
        arrivedAt: null,
        createdAt: new Date(),
      });

      const result = await service.createPayout('user-001', {
        amount: 5000,
        description: 'Milestone payment',
        referenceType: 'milestone',
        referenceId: 'ms-001',
      });

      expect(result.id).toBe('payout-001');
      expect(result.amount).toBe(5000);
      expect(result.status).toBe('PENDING');
    });

    it('should throw when user has no payout account', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue(null);

      await expect(service.createPayout('nonexistent', { amount: 5000 })).rejects.toThrow(
        'not found'
      );
    });

    it('should throw when payout account is not active', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue({
        id: 'pa-002',
        stripeConnectAccountId: 'acct_inactive',
        status: 'PENDING',
        payoutsEnabled: false,
      });

      await expect(service.createPayout('user-002', { amount: 5000 })).rejects.toThrow(
        'not active'
      );
    });

    it('should throw when payouts are disabled on account', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue({
        id: 'pa-003',
        stripeConnectAccountId: 'acct_disabled',
        status: 'ACTIVE',
        payoutsEnabled: false,
      });

      await expect(service.createPayout('user-003', { amount: 5000 })).rejects.toThrow(
        'not active'
      );
    });

    it('should use default currency from account when not specified', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue({
        id: 'pa-004',
        stripeConnectAccountId: 'acct_gbp',
        status: 'ACTIVE',
        payoutsEnabled: true,
        defaultCurrency: 'gbp',
      });

      mockStripeService.createTransfer.mockResolvedValue({ id: 'tr_gbp' });
      mockPrisma.payout.create.mockResolvedValue({
        id: 'payout-004',
        amount: 3000,
        currency: 'gbp',
        status: 'PENDING',
        failureCode: null,
        failureMessage: null,
        processedAt: null,
        arrivedAt: null,
        createdAt: new Date(),
      });

      const result = await service.createPayout('user-004', { amount: 3000 });

      expect(result.currency).toBe('gbp');
    });

    it('should include metadata in Stripe transfer', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue({
        id: 'pa-005',
        stripeConnectAccountId: 'acct_meta',
        status: 'ACTIVE',
        payoutsEnabled: true,
        defaultCurrency: 'usd',
      });

      mockStripeService.createTransfer.mockResolvedValue({ id: 'tr_meta' });
      mockPrisma.payout.create.mockResolvedValue({
        id: 'payout-005',
        amount: 2000,
        currency: 'usd',
        status: 'PENDING',
        failureCode: null,
        failureMessage: null,
        processedAt: null,
        arrivedAt: null,
        createdAt: new Date(),
      });

      await service.createPayout('user-005', {
        amount: 2000,
        referenceType: 'escrow_release',
        referenceId: 'rel-001',
      });

      expect(mockStripeService.createTransfer).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            skillancer_user_id: 'user-005',
            reference_type: 'escrow_release',
            reference_id: 'rel-001',
          }),
        })
      );
    });
  });

  // ===========================================================================
  // getPayouts
  // ===========================================================================

  describe('getPayouts()', () => {
    it('should return paginated payouts for user', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue({
        id: 'pa-001',
      });

      const mockPayouts = [
        {
          id: 'payout-1',
          amount: 5000,
          currency: 'usd',
          status: 'PAID',
          createdAt: new Date(),
          failureCode: null,
          failureMessage: null,
          processedAt: new Date(),
          arrivedAt: new Date(),
          referenceType: null,
          referenceId: null,
          description: null,
        },
        {
          id: 'payout-2',
          amount: 3000,
          currency: 'usd',
          status: 'PENDING',
          createdAt: new Date(),
          failureCode: null,
          failureMessage: null,
          processedAt: null,
          arrivedAt: null,
          referenceType: null,
          referenceId: null,
          description: null,
        },
      ];

      mockPrisma.payout.findMany.mockResolvedValue(mockPayouts);
      mockPrisma.payout.count.mockResolvedValue(2);

      const result = await service.getPayouts('user-001');

      expect(result.payouts).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should return empty array when user has no payout account', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue(null);

      const result = await service.getPayouts('nonexistent');

      expect(result.payouts).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should filter by status', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue({ id: 'pa-001' });
      mockPrisma.payout.findMany.mockResolvedValue([]);
      mockPrisma.payout.count.mockResolvedValue(0);

      await service.getPayouts('user-001', { status: 'PAID' });

      expect(mockPrisma.payout.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PAID' }),
        })
      );
    });

    it('should support pagination with limit and offset', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue({ id: 'pa-001' });
      mockPrisma.payout.findMany.mockResolvedValue([]);
      mockPrisma.payout.count.mockResolvedValue(50);

      await service.getPayouts('user-001', { limit: 10, offset: 20 });

      expect(mockPrisma.payout.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });
  });

  // ===========================================================================
  // getPayout
  // ===========================================================================

  describe('getPayout()', () => {
    it('should return a specific payout', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue({ id: 'pa-001' });
      mockPrisma.payout.findFirst.mockResolvedValue({
        id: 'payout-001',
        amount: 5000,
        currency: 'usd',
        status: 'PAID',
        createdAt: new Date(),
        failureCode: null,
        failureMessage: null,
        processedAt: new Date(),
        arrivedAt: new Date(),
        referenceType: null,
        referenceId: null,
        description: null,
      });

      const result = await service.getPayout('user-001', 'payout-001');

      expect(result.id).toBe('payout-001');
      expect(result.amount).toBe(5000);
    });

    it('should throw when user has no payout account', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue(null);

      await expect(service.getPayout('nonexistent', 'payout-001')).rejects.toThrow('not found');
    });

    it('should throw when payout not found', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue({ id: 'pa-001' });
      mockPrisma.payout.findFirst.mockResolvedValue(null);

      await expect(service.getPayout('user-001', 'nonexistent')).rejects.toThrow(
        'Payout not found'
      );
    });
  });

  // ===========================================================================
  // deletePayoutAccount
  // ===========================================================================

  describe('deletePayoutAccount()', () => {
    it('should disable the payout account', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue({
        id: 'pa-001',
        userId: 'user-001',
        status: 'ACTIVE',
      });
      mockPrisma.payoutAccount.update.mockResolvedValue({});

      await service.deletePayoutAccount('user-001');

      expect(mockPrisma.payoutAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'DISABLED' },
        })
      );
    });

    it('should throw when account does not exist', async () => {
      mockPrisma.payoutAccount.findUnique.mockResolvedValue(null);

      await expect(service.deletePayoutAccount('nonexistent')).rejects.toThrow('not found');
    });
  });
});
