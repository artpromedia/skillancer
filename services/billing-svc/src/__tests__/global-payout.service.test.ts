// @ts-nocheck - Test file with type issues pending refactor
/**
 * @module @skillancer/billing-svc/tests/global-payout
 * Unit Tests for Global Payout Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

// Mock Stripe
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      transfers: {
        create: vi.fn().mockResolvedValue({
          id: 'tr_test123',
          amount: 10000,
          currency: 'usd',
        }),
        createReversal: vi.fn().mockResolvedValue({
          id: 'trr_test123',
        }),
      },
    })),
  };
});

// Mock Logger
vi.mock('@skillancer/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Mock repositories
const mockPayoutRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  findByStripeId: vi.fn(),
  findByUserId: vi.fn(),
  update: vi.fn(),
  findAccountByUserId: vi.fn(),
  findAccountById: vi.fn(),
};

const mockBalanceRepo = {
  findByUserId: vi.fn(),
  findByUserAndCurrency: vi.fn(),
  getOrCreate: vi.fn(),
  incrementAvailable: vi.fn(),
  decrementAvailable: vi.fn(),
  incrementTotalPaidOut: vi.fn(),
  moveToPending: vi.fn(),
  moveFromPending: vi.fn(),
};

const mockScheduleRepo = {
  findByUserId: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  findDueSchedules: vi.fn(),
};

const mockExchangeRateRepo = {
  findCurrent: vi.fn(),
  create: vi.fn(),
};

vi.mock('../repositories/payout.repository.js', () => ({
  getPayoutRepository: vi.fn(() => mockPayoutRepo),
  getPayoutBalanceRepository: vi.fn(() => mockBalanceRepo),
  getPayoutScheduleRepository: vi.fn(() => mockScheduleRepo),
  getExchangeRateRepository: vi.fn(() => mockExchangeRateRepo),
  PayoutRepository: vi.fn(),
  PayoutBalanceRepository: vi.fn(),
  PayoutScheduleRepository: vi.fn(),
  ExchangeRateRepository: vi.fn(),
}));

// Import after mocks
import { ExchangeRateService } from '../services/exchange-rate.service.js';
import { GlobalPayoutService } from '../services/global-payout.service.js';

// =============================================================================
// TEST FIXTURES
// =============================================================================

const TEST_USER_ID = 'user-123';
const TEST_PAYOUT_ACCOUNT_ID = 'payout-account-456';
const TEST_STRIPE_ACCOUNT_ID = 'acct_stripe123';

const mockPayoutAccount = {
  id: TEST_PAYOUT_ACCOUNT_ID,
  userId: TEST_USER_ID,
  stripeConnectAccountId: TEST_STRIPE_ACCOUNT_ID,
  status: 'ACTIVE',
  chargesEnabled: true,
  payoutsEnabled: true,
};

const mockBalance = {
  userId: TEST_USER_ID,
  currency: 'USD',
  availableBalance: 1000,
  pendingBalance: 0,
  totalEarned: 5000,
  totalPaidOut: 4000,
};

// =============================================================================
// GLOBAL PAYOUT SERVICE TESTS
// =============================================================================

describe('GlobalPayoutService', () => {
  let service: GlobalPayoutService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset repository mocks
    mockPayoutRepo.findAccountByUserId.mockResolvedValue(mockPayoutAccount);
    mockBalanceRepo.findByUserAndCurrency.mockResolvedValue(mockBalance);
    mockBalanceRepo.findByUserId.mockResolvedValue([mockBalance]);

    // Create service
    service = new GlobalPayoutService({
      stripeSecretKey: 'sk_test_123',
    });
  });

  // ===========================================================================
  // BALANCE TESTS
  // ===========================================================================

  describe('getBalance', () => {
    it('should return balance summary for user', async () => {
      const balance = await service.getBalance(TEST_USER_ID);

      expect(balance.userId).toBe(TEST_USER_ID);
      expect(balance.balances).toBeDefined();
      expect(Array.isArray(balance.balances)).toBe(true);
      expect(mockBalanceRepo.findByUserId).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it('should include lifetime stats', async () => {
      const balance = await service.getBalance(TEST_USER_ID);

      expect(balance.lifetimeStats).toBeDefined();
      expect(balance.lifetimeStats.totalEarned).toBeGreaterThanOrEqual(0);
      expect(balance.lifetimeStats.totalPaidOut).toBeGreaterThanOrEqual(0);
    });
  });

  describe('addToBalance', () => {
    it('should increment available balance', async () => {
      await service.addToBalance(TEST_USER_ID, 100, 'USD', 'Test deposit');

      expect(mockBalanceRepo.incrementAvailable).toHaveBeenCalledWith(TEST_USER_ID, 'USD', 100);
    });
  });

  // ===========================================================================
  // PAYOUT REQUEST TESTS
  // ===========================================================================

  describe('requestPayout', () => {
    beforeEach(() => {
      mockPayoutRepo.create.mockResolvedValue({
        id: 'payout-123',
        payoutAccountId: TEST_PAYOUT_ACCOUNT_ID,
        amount: 95,
        currency: 'USD',
        status: 'PENDING',
        createdAt: new Date(),
        description: JSON.stringify({
          method: 'BANK_TRANSFER',
          type: 'STANDARD',
          payoutFee: 5,
          conversionFee: 0,
        }),
      });
    });

    it('should create payout for valid request', async () => {
      const result = await service.requestPayout({
        userId: TEST_USER_ID,
        amount: 100,
        currency: 'USD',
      });

      expect(result.id).toBe('payout-123');
      expect(result.status).toBe('PENDING');
      expect(mockPayoutRepo.findAccountByUserId).toHaveBeenCalledWith(TEST_USER_ID);
      expect(mockBalanceRepo.moveToPending).toHaveBeenCalled();
    });

    it('should reject if no payout account exists', async () => {
      mockPayoutRepo.findAccountByUserId.mockResolvedValue(null);

      await expect(
        service.requestPayout({
          userId: TEST_USER_ID,
          amount: 100,
          currency: 'USD',
        })
      ).rejects.toThrow('No payout account found');
    });

    it('should reject if account is not active', async () => {
      mockPayoutRepo.findAccountByUserId.mockResolvedValue({
        ...mockPayoutAccount,
        status: 'PENDING_VERIFICATION',
      });

      await expect(
        service.requestPayout({
          userId: TEST_USER_ID,
          amount: 100,
          currency: 'USD',
        })
      ).rejects.toThrow('Payout account is not active');
    });

    it('should reject if balance is insufficient', async () => {
      mockBalanceRepo.findByUserAndCurrency.mockResolvedValue({
        ...mockBalance,
        availableBalance: 10,
      });

      await expect(
        service.requestPayout({
          userId: TEST_USER_ID,
          amount: 100,
          currency: 'USD',
        })
      ).rejects.toThrow('Insufficient balance');
    });

    it('should reject if amount is below minimum', async () => {
      await expect(
        service.requestPayout({
          userId: TEST_USER_ID,
          amount: 10, // Below $50 minimum
          currency: 'USD',
        })
      ).rejects.toThrow('Minimum payout amount');
    });
  });

  // ===========================================================================
  // INSTANT PAYOUT TESTS
  // ===========================================================================

  describe('requestInstantPayout', () => {
    beforeEach(() => {
      mockPayoutRepo.create.mockResolvedValue({
        id: 'payout-instant-123',
        payoutAccountId: TEST_PAYOUT_ACCOUNT_ID,
        amount: 93,
        currency: 'USD',
        status: 'PROCESSING',
        createdAt: new Date(),
        description: JSON.stringify({
          method: 'DEBIT_CARD',
          type: 'INSTANT',
          payoutFee: 7,
          conversionFee: 0,
        }),
      });
    });

    it('should create instant payout', async () => {
      const result = await service.requestInstantPayout({
        userId: TEST_USER_ID,
        amount: 100,
        currency: 'USD',
      });

      expect(result.id).toBe('payout-instant-123');
      expect(result.type).toBe('INSTANT');
      expect(result.method).toBe('DEBIT_CARD');
    });

    it('should reject instant payout for unsupported currency', async () => {
      await expect(
        service.requestInstantPayout({
          userId: TEST_USER_ID,
          amount: 100,
          currency: 'NGN', // Not in INSTANT_PAYOUT_CURRENCIES
        })
      ).rejects.toThrow('Instant payouts not available');
    });
  });

  // ===========================================================================
  // PAYOUT PREVIEW TESTS
  // ===========================================================================

  describe('previewPayout', () => {
    it('should return fee breakdown', async () => {
      const preview = await service.previewPayout({
        userId: TEST_USER_ID,
        amount: 100,
        currency: 'USD',
      });

      expect(preview.grossAmount).toBe(100);
      expect(preview.fees).toBeDefined();
      expect(preview.fees.totalFee).toBeGreaterThan(0);
      expect(preview.netAmount).toBeLessThan(100);
      expect(preview.availableBalance).toBe(1000);
      expect(preview.canProcess).toBe(true);
    });

    it('should indicate cannot process when balance insufficient', async () => {
      mockBalanceRepo.findByUserAndCurrency.mockResolvedValue({
        ...mockBalance,
        availableBalance: 50,
      });

      const preview = await service.previewPayout({
        userId: TEST_USER_ID,
        amount: 100,
        currency: 'USD',
      });

      expect(preview.canProcess).toBe(false);
    });

    it('should include conversion details when targeting different currency', async () => {
      const preview = await service.previewPayout({
        userId: TEST_USER_ID,
        amount: 100,
        currency: 'USD',
        targetCurrency: 'EUR',
      });

      expect(preview.conversion).toBeDefined();
      expect(preview.conversion?.fromCurrency).toBe('USD');
      expect(preview.conversion?.toCurrency).toBe('EUR');
      expect(preview.conversion?.exchangeRate).toBeDefined();
    });
  });

  // ===========================================================================
  // PAYOUT CANCELLATION TESTS
  // ===========================================================================

  describe('cancelPayout', () => {
    const mockPendingPayout = {
      id: 'payout-to-cancel',
      payoutAccountId: TEST_PAYOUT_ACCOUNT_ID,
      stripeTransferId: 'tr_cancel123',
      amount: 95,
      currency: 'USD',
      status: 'PENDING',
      createdAt: new Date(),
      description: JSON.stringify({
        method: 'BANK_TRANSFER',
        type: 'STANDARD',
        originalAmount: 100,
        originalCurrency: 'USD',
      }),
      payoutAccount: mockPayoutAccount,
    };

    beforeEach(() => {
      mockPayoutRepo.findById.mockResolvedValue(mockPendingPayout);
      mockPayoutRepo.update.mockResolvedValue({
        ...mockPendingPayout,
        status: 'CANCELED',
      });
    });

    it('should cancel pending payout', async () => {
      const result = await service.cancelPayout('payout-to-cancel', TEST_USER_ID);

      expect(result.status).toBe('CANCELLED');
      expect(mockPayoutRepo.update).toHaveBeenCalledWith('payout-to-cancel', {
        status: 'CANCELLED',
      });
      expect(mockBalanceRepo.moveFromPending).toHaveBeenCalled();
    });

    it('should reject if payout not found', async () => {
      mockPayoutRepo.findById.mockResolvedValue(null);

      await expect(service.cancelPayout('nonexistent', TEST_USER_ID)).rejects.toThrow(
        'Payout not found'
      );
    });

    it('should reject if not pending status', async () => {
      mockPayoutRepo.findById.mockResolvedValue({
        ...mockPendingPayout,
        status: 'IN_TRANSIT',
      });

      await expect(service.cancelPayout('payout-to-cancel', TEST_USER_ID)).rejects.toThrow(
        'Only pending payouts can be cancelled'
      );
    });
  });

  // ===========================================================================
  // SCHEDULE TESTS
  // ===========================================================================

  describe('getSchedule', () => {
    it('should return null if no schedule exists', async () => {
      mockScheduleRepo.findByUserId.mockResolvedValue(null);

      const schedule = await service.getSchedule(TEST_USER_ID);

      expect(schedule).toBeNull();
    });

    it('should return schedule if exists', async () => {
      mockScheduleRepo.findByUserId.mockResolvedValue({
        id: 'schedule-123',
        userId: TEST_USER_ID,
        frequency: 'WEEKLY',
        dayOfWeek: 5,
        minimumAmount: 100,
        currency: 'USD',
        autoPayoutEnabled: true,
        nextScheduledAt: new Date(),
      });

      const schedule = await service.getSchedule(TEST_USER_ID);

      expect(schedule).toBeDefined();
      expect(schedule?.frequency).toBe('WEEKLY');
      expect(schedule?.dayOfWeek).toBe(5);
    });
  });

  describe('updateSchedule', () => {
    it('should create new schedule', async () => {
      mockScheduleRepo.findByUserId.mockResolvedValue(null);
      mockScheduleRepo.create.mockResolvedValue({
        id: 'new-schedule',
        userId: TEST_USER_ID,
        frequency: 'MONTHLY',
        dayOfMonth: 1,
        minimumAmount: 500,
        currency: 'USD',
        autoPayoutEnabled: true,
        nextScheduledAt: new Date(),
      });

      const schedule = await service.updateSchedule(TEST_USER_ID, {
        frequency: 'MONTHLY',
        dayOfMonth: 1,
        minimumAmount: 500,
        currency: 'USD',
        autoPayoutEnabled: true,
      });

      expect(schedule.id).toBe('new-schedule');
      expect(schedule.frequency).toBe('MONTHLY');
      expect(mockScheduleRepo.create).toHaveBeenCalled();
    });

    it('should update existing schedule', async () => {
      mockScheduleRepo.findByUserId.mockResolvedValue({
        id: 'existing-schedule',
        userId: TEST_USER_ID,
        frequency: 'WEEKLY',
        minimumAmount: 100,
        currency: 'USD',
        autoPayoutEnabled: true,
      });
      mockScheduleRepo.update.mockResolvedValue({
        id: 'existing-schedule',
        userId: TEST_USER_ID,
        frequency: 'BIWEEKLY',
        minimumAmount: 200,
        currency: 'USD',
        autoPayoutEnabled: true,
        nextScheduledAt: new Date(),
      });

      const schedule = await service.updateSchedule(TEST_USER_ID, {
        frequency: 'BIWEEKLY',
        minimumAmount: 200,
        currency: 'USD',
        autoPayoutEnabled: true,
      });

      expect(schedule.frequency).toBe('BIWEEKLY');
      expect(mockScheduleRepo.update).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // PAYOUT HISTORY TESTS
  // ===========================================================================

  describe('getPayoutHistory', () => {
    it('should return paginated payout list', async () => {
      mockPayoutRepo.findByUserId.mockResolvedValue({
        payouts: [
          {
            id: 'payout-1',
            amount: 100,
            currency: 'USD',
            status: 'PAID',
            createdAt: new Date(),
            description: '{}',
          },
          {
            id: 'payout-2',
            amount: 200,
            currency: 'USD',
            status: 'PENDING',
            createdAt: new Date(),
            description: '{}',
          },
        ],
        total: 5,
      });

      const result = await service.getPayoutHistory(TEST_USER_ID, {
        limit: 2,
        offset: 0,
      });

      expect(result.payouts.length).toBe(2);
      expect(result.total).toBe(5);
      expect(result.hasMore).toBe(true);
    });
  });
});

// =============================================================================
// EXCHANGE RATE SERVICE TESTS
// =============================================================================

describe('ExchangeRateService', () => {
  let service: ExchangeRateService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExchangeRateRepo.findCurrent.mockResolvedValue(null);
    mockExchangeRateRepo.create.mockImplementation(async (data) => data);

    service = new ExchangeRateService();
  });

  describe('getRate', () => {
    it('should return 1:1 for same currency', async () => {
      const rate = await service.getRate('USD', 'USD');

      expect(rate.rate).toBe(1);
      expect(rate.source).toBe('identity');
    });

    it('should calculate rate for different currencies', async () => {
      const rate = await service.getRate('USD', 'EUR');

      expect(rate.rate).toBeGreaterThan(0);
      expect(rate.rate).toBeLessThan(1); // EUR is stronger than USD
      expect(rate.timestamp).toBeDefined();
      expect(rate.validUntil).toBeDefined();
    });

    it('should throw for unsupported currency', async () => {
      await expect(service.getRate('USD', 'XYZ')).rejects.toThrow('Unsupported currency');
    });
  });

  describe('convert', () => {
    it('should convert amount between currencies', async () => {
      const result = await service.convert({
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        amount: 100,
      });

      expect(result.originalAmount).toBe(100);
      expect(result.originalCurrency).toBe('USD');
      expect(result.convertedAmount).toBeGreaterThan(0);
      expect(result.convertedCurrency).toBe('EUR');
      expect(result.exchangeRate).toBeGreaterThan(0);
    });

    it('should return same amount for same currency conversion', async () => {
      const result = await service.convert({
        fromCurrency: 'USD',
        toCurrency: 'USD',
        amount: 100,
      });

      expect(result.convertedAmount).toBe(100);
      expect(result.exchangeRate).toBe(1);
    });
  });

  describe('previewConversion', () => {
    it('should include markup information', async () => {
      const preview = await service.previewConversion('USD', 'EUR', 1000);

      expect(preview.fromCurrency).toBe('USD');
      expect(preview.toCurrency).toBe('EUR');
      expect(preview.fromAmount).toBe(1000);
      expect(preview.toAmount).toBeGreaterThan(0);
      expect(preview.baseRate).toBeGreaterThan(0);
      expect(preview.markupPercent).toBeGreaterThanOrEqual(0);
      expect(preview.validUntil).toBeDefined();
    });
  });

  describe('getSupportedCurrencies', () => {
    it('should return list of supported currencies', () => {
      const result = service.getSupportedCurrencies();

      expect(result.currencies).toBeDefined();
      expect(Array.isArray(result.currencies)).toBe(true);
      expect(result.currencies.length).toBeGreaterThan(0);
      expect(result.baseCurrency).toBe('USD');

      const usd = result.currencies.find((c) => c.code === 'USD');
      expect(usd).toBeDefined();
      expect(usd?.name).toBe('US Dollar');
      expect(usd?.symbol).toBe('$');
    });
  });

  describe('getAllRates', () => {
    it('should return rates for all currencies', async () => {
      const rates = await service.getAllRates('USD');

      expect(rates).toBeDefined();
      expect(typeof rates).toBe('object');
      expect(rates['EUR']).toBeGreaterThan(0);
      expect(rates['GBP']).toBeGreaterThan(0);
    });
  });
});
