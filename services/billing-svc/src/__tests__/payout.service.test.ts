// @ts-nocheck - Test file with mocked dependencies
/**
 * @module @skillancer/billing-svc/tests/payout-service
 * Unit Tests for Payout Service
 *
 * Tests critical payout flows:
 * - Payout account creation (Stripe Connect)
 * - Payout processing
 * - Balance management
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

// Mock Stripe
const mockStripeAccounts = {
  create: vi.fn(),
  retrieve: vi.fn(),
  update: vi.fn(),
  del: vi.fn(),
};

const mockStripeAccountLinks = {
  create: vi.fn(),
};

const mockStripeLoginLinks = {
  create: vi.fn(),
};

const mockStripeTransfers = {
  create: vi.fn(),
  retrieve: vi.fn(),
  list: vi.fn(),
};

const mockStripePayouts = {
  create: vi.fn(),
  retrieve: vi.fn(),
  list: vi.fn(),
};

const mockStripeBalance = {
  retrieve: vi.fn(),
};

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      accounts: mockStripeAccounts,
      accountLinks: mockStripeAccountLinks,
      accounts: { ...mockStripeAccounts, createLoginLink: vi.fn() },
      transfers: mockStripeTransfers,
      payouts: mockStripePayouts,
      balance: mockStripeBalance,
    })),
  };
});

// Mock Prisma
const mockPrismaPayoutAccount = {
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockPrismaPayout = {
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
};

const mockPrismaPayoutRequest = {
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
};

const mockPrisma = {
  payoutAccount: mockPrismaPayoutAccount,
  payout: mockPrismaPayout,
  payoutRequest: mockPrismaPayoutRequest,
  $transaction: vi.fn((fn) => fn(mockPrisma)),
};

vi.mock('@skillancer/database', () => ({
  prisma: mockPrisma,
}));

// Mock Config
vi.mock('../config/index.js', () => ({
  getConfig: vi.fn(() => ({
    appUrl: 'https://skillancer.com',
    stripe: {
      secretKey: 'sk_test_xxx',
    },
    payout: {
      minAmount: 50,
      maxAmount: 50000,
    },
  })),
}));

// Mock Stripe Service
const mockStripeService = {
  createConnectAccount: vi.fn(),
  createAccountLink: vi.fn(),
  createLoginLink: vi.fn(),
  getAccountBalance: vi.fn(),
  createPayout: vi.fn(),
  transferToConnectedAccount: vi.fn(),
};

vi.mock('./stripe.service.js', () => ({
  getStripeService: vi.fn(() => mockStripeService),
}));

// Import after mocks
import { PayoutAccountService } from '../services/payout.service.js';

// =============================================================================
// TEST FIXTURES
// =============================================================================

const TEST_USER_ID = 'user-123';
const TEST_EMAIL = 'freelancer@example.com';
const TEST_STRIPE_ACCOUNT_ID = 'acct_test123';
const TEST_PAYOUT_ACCOUNT_ID = 'payout-456';

const mockPayoutAccount = {
  id: TEST_PAYOUT_ACCOUNT_ID,
  userId: TEST_USER_ID,
  stripeConnectAccountId: TEST_STRIPE_ACCOUNT_ID,
  accountType: 'EXPRESS',
  status: 'ACTIVE',
  country: 'US',
  businessType: 'individual',
  detailsSubmitted: true,
  chargesEnabled: true,
  payoutsEnabled: true,
  defaultCurrency: 'usd',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// =============================================================================
// TESTS
// =============================================================================

describe('PayoutAccountService', () => {
  let payoutService: PayoutAccountService;

  beforeEach(() => {
    vi.clearAllMocks();
    payoutService = new PayoutAccountService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // ACCOUNT CREATION TESTS
  // ===========================================================================

  describe('createPayoutAccount', () => {
    it('should create a new Stripe Connect account', async () => {
      mockPrismaPayoutAccount.findUnique.mockResolvedValue(null);

      mockStripeService.createConnectAccount.mockResolvedValue({
        id: TEST_STRIPE_ACCOUNT_ID,
        type: 'express',
        country: 'US',
      });

      mockPrismaPayoutAccount.create.mockResolvedValue({
        ...mockPayoutAccount,
        status: 'PENDING',
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
      });

      mockStripeService.createAccountLink.mockResolvedValue({
        url: 'https://connect.stripe.com/setup/xxx',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      });

      const result = await payoutService.createPayoutAccount(TEST_USER_ID, TEST_EMAIL, {
        country: 'US',
        businessType: 'individual',
        accountType: 'EXPRESS',
      });

      expect(result.account).toBeDefined();
      expect(result.onboardingUrl).toContain('stripe.com');
      expect(mockStripeService.createConnectAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          email: TEST_EMAIL,
          country: 'US',
        })
      );
    });

    it('should reject if user already has a payout account', async () => {
      mockPrismaPayoutAccount.findUnique.mockResolvedValue(mockPayoutAccount);

      await expect(
        payoutService.createPayoutAccount(TEST_USER_ID, TEST_EMAIL, {
          country: 'US',
        })
      ).rejects.toThrow(/already.*exists|already has/i);
    });

    it('should handle different account types', async () => {
      mockPrismaPayoutAccount.findUnique.mockResolvedValue(null);

      mockStripeService.createConnectAccount.mockResolvedValue({
        id: TEST_STRIPE_ACCOUNT_ID,
        type: 'standard',
      });

      mockPrismaPayoutAccount.create.mockResolvedValue({
        ...mockPayoutAccount,
        accountType: 'STANDARD',
      });

      mockStripeService.createAccountLink.mockResolvedValue({
        url: 'https://connect.stripe.com/setup/xxx',
      });

      const result = await payoutService.createPayoutAccount(TEST_USER_ID, TEST_EMAIL, {
        country: 'US',
        accountType: 'STANDARD',
      });

      expect(result.account.accountType).toBe('STANDARD');
    });
  });

  // ===========================================================================
  // ACCOUNT RETRIEVAL TESTS
  // ===========================================================================

  describe('getPayoutAccount', () => {
    it('should return payout account details', async () => {
      mockPrismaPayoutAccount.findUnique.mockResolvedValue(mockPayoutAccount);

      const result = await payoutService.getPayoutAccount(TEST_USER_ID);

      expect(result).toBeDefined();
      expect(result?.userId).toBe(TEST_USER_ID);
      expect(result?.status).toBe('ACTIVE');
    });

    it('should return null if no account exists', async () => {
      mockPrismaPayoutAccount.findUnique.mockResolvedValue(null);

      const result = await payoutService.getPayoutAccount('nonexistent-user');

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // ONBOARDING TESTS
  // ===========================================================================

  describe('getOnboardingLink', () => {
    it('should return onboarding link for incomplete account', async () => {
      mockPrismaPayoutAccount.findUnique.mockResolvedValue({
        ...mockPayoutAccount,
        status: 'PENDING',
        detailsSubmitted: false,
      });

      mockStripeService.createAccountLink.mockResolvedValue({
        url: 'https://connect.stripe.com/setup/xxx',
        expires_at: Math.floor(Date.now() / 1000) + 86400,
      });

      const result = await payoutService.getOnboardingLink(TEST_USER_ID);

      expect(result.onboardingUrl).toContain('stripe.com');
      expect(result.expiresAt).toBeDefined();
    });

    it('should throw if no account exists', async () => {
      mockPrismaPayoutAccount.findUnique.mockResolvedValue(null);

      await expect(payoutService.getOnboardingLink('nonexistent-user')).rejects.toThrow();
    });
  });

  // ===========================================================================
  // DASHBOARD LINK TESTS
  // ===========================================================================

  describe('getDashboardLink', () => {
    it('should return Stripe Express dashboard link', async () => {
      mockPrismaPayoutAccount.findUnique.mockResolvedValue(mockPayoutAccount);

      mockStripeService.createLoginLink.mockResolvedValue({
        url: 'https://connect.stripe.com/express/xxx',
      });

      const result = await payoutService.getDashboardLink(TEST_USER_ID);

      expect(result.dashboardUrl).toContain('stripe.com');
    });

    it('should throw for inactive account', async () => {
      mockPrismaPayoutAccount.findUnique.mockResolvedValue({
        ...mockPayoutAccount,
        status: 'PENDING',
        payoutsEnabled: false,
      });

      await expect(payoutService.getDashboardLink(TEST_USER_ID)).rejects.toThrow(/not active/i);
    });
  });

  // ===========================================================================
  // PAYOUT PROCESSING TESTS
  // ===========================================================================

  describe('requestPayout', () => {
    it('should create payout request for valid amount', async () => {
      mockPrismaPayoutAccount.findUnique.mockResolvedValue(mockPayoutAccount);

      mockStripeService.getAccountBalance.mockResolvedValue({
        available: [{ amount: 50000, currency: 'usd' }],
        pending: [{ amount: 0, currency: 'usd' }],
      });

      mockPrismaPayoutRequest.create.mockResolvedValue({
        id: 'payout-req-123',
        userId: TEST_USER_ID,
        amount: 100,
        currency: 'USD',
        status: 'PENDING',
        createdAt: new Date(),
      });

      const result = await payoutService.requestPayout(TEST_USER_ID, 100, 'USD');

      expect(result.success).toBe(true);
      expect(result.payoutRequestId).toBeDefined();
    });

    it('should reject payout below minimum amount', async () => {
      mockPrismaPayoutAccount.findUnique.mockResolvedValue(mockPayoutAccount);

      await expect(payoutService.requestPayout(TEST_USER_ID, 10, 'USD')).rejects.toThrow(
        /minimum|too low/i
      );
    });

    it('should reject payout above maximum amount', async () => {
      mockPrismaPayoutAccount.findUnique.mockResolvedValue(mockPayoutAccount);

      await expect(payoutService.requestPayout(TEST_USER_ID, 100000, 'USD')).rejects.toThrow(
        /maximum|too high|exceeds/i
      );
    });

    it('should reject payout exceeding available balance', async () => {
      mockPrismaPayoutAccount.findUnique.mockResolvedValue(mockPayoutAccount);

      mockStripeService.getAccountBalance.mockResolvedValue({
        available: [{ amount: 5000, currency: 'usd' }], // $50 available
        pending: [{ amount: 0, currency: 'usd' }],
      });

      await expect(payoutService.requestPayout(TEST_USER_ID, 100, 'USD')).rejects.toThrow(
        /insufficient|balance/i
      );
    });

    it('should reject payout for inactive account', async () => {
      mockPrismaPayoutAccount.findUnique.mockResolvedValue({
        ...mockPayoutAccount,
        status: 'PENDING',
        payoutsEnabled: false,
      });

      await expect(payoutService.requestPayout(TEST_USER_ID, 100, 'USD')).rejects.toThrow(
        /not active|not enabled/i
      );
    });
  });

  describe('processPayout', () => {
    it('should process approved payout request', async () => {
      mockPrismaPayoutRequest.findUnique.mockResolvedValue({
        id: 'payout-req-123',
        userId: TEST_USER_ID,
        amount: 100,
        currency: 'USD',
        status: 'APPROVED',
      });

      mockPrismaPayoutAccount.findUnique.mockResolvedValue(mockPayoutAccount);

      mockStripeService.createPayout.mockResolvedValue({
        id: 'po_test123',
        amount: 10000,
        currency: 'usd',
        status: 'pending',
      });

      mockPrismaPayoutRequest.update.mockResolvedValue({
        id: 'payout-req-123',
        status: 'PROCESSING',
        stripePayoutId: 'po_test123',
      });

      const result = await payoutService.processPayout('payout-req-123');

      expect(result.success).toBe(true);
      expect(result.stripePayoutId).toBe('po_test123');
    });

    it('should reject processing of non-approved request', async () => {
      mockPrismaPayoutRequest.findUnique.mockResolvedValue({
        id: 'payout-req-123',
        userId: TEST_USER_ID,
        amount: 100,
        currency: 'USD',
        status: 'PENDING', // Not approved yet
      });

      await expect(payoutService.processPayout('payout-req-123')).rejects.toThrow(
        /not approved|invalid status/i
      );
    });
  });

  // ===========================================================================
  // BALANCE TESTS
  // ===========================================================================

  describe('getBalance', () => {
    it('should return available and pending balance', async () => {
      mockPrismaPayoutAccount.findUnique.mockResolvedValue(mockPayoutAccount);

      mockStripeService.getAccountBalance.mockResolvedValue({
        available: [
          { amount: 50000, currency: 'usd' },
          { amount: 10000, currency: 'eur' },
        ],
        pending: [
          { amount: 20000, currency: 'usd' },
          { amount: 5000, currency: 'eur' },
        ],
      });

      const result = await payoutService.getBalance(TEST_USER_ID);

      expect(result.available).toEqual(
        expect.arrayContaining([expect.objectContaining({ amount: 500, currency: 'USD' })])
      );
      expect(result.pending).toBeDefined();
    });

    it('should handle account with no balance', async () => {
      mockPrismaPayoutAccount.findUnique.mockResolvedValue(mockPayoutAccount);

      mockStripeService.getAccountBalance.mockResolvedValue({
        available: [],
        pending: [],
      });

      const result = await payoutService.getBalance(TEST_USER_ID);

      expect(result.available).toEqual([]);
      expect(result.pending).toEqual([]);
    });
  });

  // ===========================================================================
  // ACCOUNT STATUS SYNC TESTS
  // ===========================================================================

  describe('syncAccountStatus', () => {
    it('should update local status from Stripe', async () => {
      mockPrismaPayoutAccount.findUnique.mockResolvedValue({
        ...mockPayoutAccount,
        status: 'PENDING',
        chargesEnabled: false,
        payoutsEnabled: false,
      });

      mockStripeAccounts.retrieve.mockResolvedValue({
        id: TEST_STRIPE_ACCOUNT_ID,
        details_submitted: true,
        charges_enabled: true,
        payouts_enabled: true,
        requirements: {
          currently_due: [],
          eventually_due: [],
          past_due: [],
        },
      });

      mockPrismaPayoutAccount.update.mockResolvedValue({
        ...mockPayoutAccount,
        status: 'ACTIVE',
        detailsSubmitted: true,
        chargesEnabled: true,
        payoutsEnabled: true,
      });

      const result = await payoutService.syncAccountStatus(TEST_USER_ID);

      expect(result.status).toBe('ACTIVE');
      expect(result.chargesEnabled).toBe(true);
      expect(result.payoutsEnabled).toBe(true);
    });

    it('should handle restricted accounts', async () => {
      mockPrismaPayoutAccount.findUnique.mockResolvedValue(mockPayoutAccount);

      mockStripeAccounts.retrieve.mockResolvedValue({
        id: TEST_STRIPE_ACCOUNT_ID,
        details_submitted: true,
        charges_enabled: false,
        payouts_enabled: false,
        requirements: {
          currently_due: ['verification.document'],
          eventually_due: [],
          past_due: ['verification.document'],
          disabled_reason: 'requirements.past_due',
        },
      });

      mockPrismaPayoutAccount.update.mockResolvedValue({
        ...mockPayoutAccount,
        status: 'RESTRICTED',
        chargesEnabled: false,
        payoutsEnabled: false,
      });

      const result = await payoutService.syncAccountStatus(TEST_USER_ID);

      expect(result.status).toBe('RESTRICTED');
      expect(result.requirements).toBeDefined();
    });
  });

  // ===========================================================================
  // PAYOUT HISTORY TESTS
  // ===========================================================================

  describe('getPayoutHistory', () => {
    it('should return paginated payout history', async () => {
      mockPrismaPayoutRequest.findMany.mockResolvedValue([
        {
          id: 'payout-1',
          amount: 100,
          currency: 'USD',
          status: 'COMPLETED',
          createdAt: new Date(),
        },
        {
          id: 'payout-2',
          amount: 200,
          currency: 'USD',
          status: 'COMPLETED',
          createdAt: new Date(),
        },
      ]);

      mockPrismaPayoutRequest.count.mockResolvedValue(10);

      const result = await payoutService.getPayoutHistory(TEST_USER_ID, {
        limit: 10,
        offset: 0,
      });

      expect(result.payouts).toHaveLength(2);
      expect(result.total).toBe(10);
    });

    it('should filter by status', async () => {
      mockPrismaPayoutRequest.findMany.mockResolvedValue([
        {
          id: 'payout-1',
          amount: 100,
          currency: 'USD',
          status: 'PENDING',
          createdAt: new Date(),
        },
      ]);

      mockPrismaPayoutRequest.count.mockResolvedValue(1);

      const result = await payoutService.getPayoutHistory(TEST_USER_ID, {
        status: 'PENDING',
      });

      expect(result.payouts).toHaveLength(1);
      expect(result.payouts[0].status).toBe('PENDING');
    });
  });

  // ===========================================================================
  // ERROR HANDLING TESTS
  // ===========================================================================

  describe('error handling', () => {
    it('should handle Stripe API errors gracefully', async () => {
      mockPrismaPayoutAccount.findUnique.mockResolvedValue(mockPayoutAccount);

      mockStripeService.createPayout.mockRejectedValue(
        new Error('Stripe API error: insufficient_funds')
      );

      mockPrismaPayoutRequest.findUnique.mockResolvedValue({
        id: 'payout-req-123',
        userId: TEST_USER_ID,
        amount: 100,
        currency: 'USD',
        status: 'APPROVED',
      });

      await expect(payoutService.processPayout('payout-req-123')).rejects.toThrow();
    });

    it('should handle network timeouts', async () => {
      mockPrismaPayoutAccount.findUnique.mockResolvedValue(mockPayoutAccount);

      mockStripeService.getAccountBalance.mockRejectedValue(new Error('Network timeout'));

      await expect(payoutService.getBalance(TEST_USER_ID)).rejects.toThrow(/timeout|network/i);
    });
  });
});
