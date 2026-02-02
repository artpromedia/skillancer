/**
 * @module @skillancer/web-market/lib/api/__tests__/escrow
 * Unit tests for the escrow API client
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window and localStorage for browser environment
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock globalThis.window
Object.defineProperty(globalThis, 'window', {
  value: {
    localStorage: localStorageMock,
  },
  writable: true,
  configurable: true,
});

// Import after mocks are set up
import {
  fundEscrow,
  completeFunding,
  releaseEscrow,
  refundEscrow,
  getEscrowFeePreview,
  getEscrowSummary,
  getEscrowBalance,
  getEscrowTransactions,
  isMilestoneFunded,
  formatEscrowAmount,
  getTransactionTypeLabel,
  getTransactionStatusColor,
  calculateTotalEscrowNeeded,
  type FundEscrowRequest,
  type FundEscrowResponse,
  type ReleaseEscrowRequest,
  type RefundEscrowRequest,
  type EscrowFeePreviewRequest,
  type EscrowSummary,
} from '../escrow';

describe('Escrow API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('test-auth-token');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('fundEscrow', () => {
    it('should fund escrow successfully', async () => {
      const mockResponse: FundEscrowResponse = {
        transaction: {
          id: 'tx_123',
          contractId: 'contract_123',
          milestoneId: 'milestone_123',
          type: 'FUND',
          status: 'COMPLETED',
          grossAmount: 100000,
          platformFee: 10000,
          processingFee: 3219,
          netAmount: 100000,
          stripePaymentIntentId: 'pi_test123',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        escrowBalance: {
          id: 'eb_123',
          contractId: 'contract_123',
          totalFunded: 100000,
          totalReleased: 0,
          totalRefunded: 0,
          availableBalance: 100000,
          frozenBalance: 0,
          isFrozen: false,
          updatedAt: new Date().toISOString(),
        },
        clientSecret: 'pi_test123_secret_xxx',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const request: FundEscrowRequest = {
        contractId: 'contract_123',
        milestoneId: 'milestone_123',
        amount: 100000,
        paymentMethodId: 'pm_test123',
      };

      const result = await fundEscrow(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/escrow/fund'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(request),
          credentials: 'include',
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Invalid payment method' }),
      });

      const request: FundEscrowRequest = {
        contractId: 'contract_123',
        amount: 100000,
        paymentMethodId: 'pm_invalid',
      };

      await expect(fundEscrow(request)).rejects.toThrow('Invalid payment method');
    });
  });

  describe('completeFunding', () => {
    it('should complete funding after Stripe confirmation', async () => {
      const mockResponse = {
        transaction: {
          id: 'tx_123',
          contractId: 'contract_123',
          type: 'FUND',
          status: 'COMPLETED',
          grossAmount: 100000,
          platformFee: 10000,
          processingFee: 3219,
          netAmount: 100000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        escrowBalance: {
          id: 'eb_123',
          contractId: 'contract_123',
          totalFunded: 100000,
          totalReleased: 0,
          totalRefunded: 0,
          availableBalance: 100000,
          frozenBalance: 0,
          isFrozen: false,
          updatedAt: new Date().toISOString(),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await completeFunding({ paymentIntentId: 'pi_test123' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/escrow/complete'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ paymentIntentId: 'pi_test123' }),
        })
      );
      expect(result.transaction.status).toBe('COMPLETED');
    });
  });

  describe('releaseEscrow', () => {
    it('should release escrow funds to freelancer', async () => {
      const mockResponse = {
        transaction: {
          id: 'tx_124',
          contractId: 'contract_123',
          milestoneId: 'milestone_123',
          type: 'RELEASE',
          status: 'COMPLETED',
          grossAmount: 100000,
          platformFee: 10000,
          processingFee: 0,
          netAmount: 90000,
          stripeTransferId: 'tr_test123',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        escrowBalance: {
          id: 'eb_123',
          contractId: 'contract_123',
          totalFunded: 100000,
          totalReleased: 100000,
          totalRefunded: 0,
          availableBalance: 0,
          frozenBalance: 0,
          isFrozen: false,
          updatedAt: new Date().toISOString(),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const request: ReleaseEscrowRequest = {
        contractId: 'contract_123',
        milestoneId: 'milestone_123',
      };

      const result = await releaseEscrow(request);

      expect(result.transaction.type).toBe('RELEASE');
      expect(result.escrowBalance.totalReleased).toBe(100000);
    });
  });

  describe('refundEscrow', () => {
    it('should refund escrow funds to client', async () => {
      const mockResponse = {
        transaction: {
          id: 'tx_125',
          contractId: 'contract_123',
          type: 'REFUND',
          status: 'COMPLETED',
          grossAmount: 50000,
          platformFee: 0,
          processingFee: 0,
          netAmount: 50000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        escrowBalance: {
          id: 'eb_123',
          contractId: 'contract_123',
          totalFunded: 100000,
          totalReleased: 50000,
          totalRefunded: 50000,
          availableBalance: 0,
          frozenBalance: 0,
          isFrozen: false,
          updatedAt: new Date().toISOString(),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const request: RefundEscrowRequest = {
        contractId: 'contract_123',
        amount: 50000,
        reason: 'Contract cancelled',
      };

      const result = await refundEscrow(request);

      expect(result.transaction.type).toBe('REFUND');
      expect(result.escrowBalance.totalRefunded).toBe(50000);
    });
  });

  describe('getEscrowFeePreview', () => {
    it('should get fee preview for escrow amount', async () => {
      const mockResponse = {
        grossAmount: 100000,
        platformFee: 10000,
        platformFeePercent: 10,
        processingFee: 3219,
        processingFeePercent: 2.9,
        secureModeEscrowFee: 0,
        secureModeEscrowFeePercent: 0,
        totalFees: 13219,
        netToFreelancer: 90000,
        totalClientCharge: 113219,
        breakdown: [
          { label: 'Milestone Amount', amount: 100000, description: 'Base amount' },
          { label: 'Platform Fee (10%)', amount: 10000, description: 'Service fee' },
          {
            label: 'Processing Fee (2.9% + $0.30)',
            amount: 3219,
            description: 'Payment processing',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const request: EscrowFeePreviewRequest = {
        amount: 100000,
        contractId: 'contract_123',
      };

      const result = await getEscrowFeePreview(request);

      expect(result.totalClientCharge).toBe(113219);
      expect(result.netToFreelancer).toBe(90000);
      expect(result.breakdown).toHaveLength(3);
    });
  });

  describe('getEscrowSummary', () => {
    it('should get escrow summary for contract', async () => {
      const mockResponse: EscrowSummary = {
        balance: {
          id: 'eb_123',
          contractId: 'contract_123',
          totalFunded: 100000,
          totalReleased: 50000,
          totalRefunded: 0,
          availableBalance: 50000,
          frozenBalance: 0,
          isFrozen: false,
          updatedAt: new Date().toISOString(),
        },
        transactions: [
          {
            id: 'tx_123',
            contractId: 'contract_123',
            milestoneId: 'milestone_1',
            type: 'FUND',
            status: 'COMPLETED',
            grossAmount: 100000,
            platformFee: 10000,
            processingFee: 3219,
            netAmount: 100000,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'tx_124',
            contractId: 'contract_123',
            milestoneId: 'milestone_1',
            type: 'RELEASE',
            status: 'COMPLETED',
            grossAmount: 50000,
            platformFee: 5000,
            processingFee: 0,
            netAmount: 45000,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        milestoneEscrowStatus: [
          {
            milestoneId: 'milestone_1',
            funded: 50000,
            released: 50000,
            available: 0,
            status: 'RELEASED',
          },
          {
            milestoneId: 'milestone_2',
            funded: 50000,
            released: 0,
            available: 50000,
            status: 'FUNDED',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getEscrowSummary('contract_123');

      expect(result.balance.availableBalance).toBe(50000);
      expect(result.transactions).toHaveLength(2);
      expect(result.milestoneEscrowStatus).toHaveLength(2);
    });
  });

  describe('getEscrowBalance', () => {
    it('should get escrow balance from summary', async () => {
      const mockSummary: EscrowSummary = {
        balance: {
          id: 'eb_123',
          contractId: 'contract_123',
          totalFunded: 100000,
          totalReleased: 0,
          totalRefunded: 0,
          availableBalance: 100000,
          frozenBalance: 0,
          isFrozen: false,
          updatedAt: new Date().toISOString(),
        },
        transactions: [],
        milestoneEscrowStatus: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSummary),
      });

      const result = await getEscrowBalance('contract_123');

      expect(result.availableBalance).toBe(100000);
    });
  });

  describe('getEscrowTransactions', () => {
    it('should get escrow transactions from summary', async () => {
      const mockSummary: EscrowSummary = {
        balance: {
          id: 'eb_123',
          contractId: 'contract_123',
          totalFunded: 100000,
          totalReleased: 0,
          totalRefunded: 0,
          availableBalance: 100000,
          frozenBalance: 0,
          isFrozen: false,
          updatedAt: new Date().toISOString(),
        },
        transactions: [
          {
            id: 'tx_123',
            contractId: 'contract_123',
            type: 'FUND',
            status: 'COMPLETED',
            grossAmount: 100000,
            platformFee: 10000,
            processingFee: 3219,
            netAmount: 100000,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        milestoneEscrowStatus: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSummary),
      });

      const result = await getEscrowTransactions('contract_123');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('FUND');
    });
  });

  describe('isMilestoneFunded', () => {
    it('should return true for funded milestone', async () => {
      const mockSummary: EscrowSummary = {
        balance: {
          id: 'eb_123',
          contractId: 'contract_123',
          totalFunded: 100000,
          totalReleased: 0,
          totalRefunded: 0,
          availableBalance: 100000,
          frozenBalance: 0,
          isFrozen: false,
          updatedAt: new Date().toISOString(),
        },
        transactions: [],
        milestoneEscrowStatus: [
          {
            milestoneId: 'milestone_123',
            funded: 50000,
            released: 0,
            available: 50000,
            status: 'FUNDED',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSummary),
      });

      const result = await isMilestoneFunded('contract_123', 'milestone_123');

      expect(result).toBe(true);
    });

    it('should return false for unfunded milestone', async () => {
      const mockSummary: EscrowSummary = {
        balance: {
          id: 'eb_123',
          contractId: 'contract_123',
          totalFunded: 0,
          totalReleased: 0,
          totalRefunded: 0,
          availableBalance: 0,
          frozenBalance: 0,
          isFrozen: false,
          updatedAt: new Date().toISOString(),
        },
        transactions: [],
        milestoneEscrowStatus: [
          {
            milestoneId: 'milestone_123',
            funded: 0,
            released: 0,
            available: 0,
            status: 'UNFUNDED',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSummary),
      });

      const result = await isMilestoneFunded('contract_123', 'milestone_123');

      expect(result).toBe(false);
    });
  });

  describe('Helper Functions', () => {
    describe('formatEscrowAmount', () => {
      it('should format amount in cents to currency', () => {
        expect(formatEscrowAmount(100000)).toBe('$1,000.00');
        expect(formatEscrowAmount(50)).toBe('$0.50');
        expect(formatEscrowAmount(1234567)).toBe('$12,345.67');
      });
    });

    describe('getTransactionTypeLabel', () => {
      it('should return correct labels for transaction types', () => {
        expect(getTransactionTypeLabel('FUND')).toBe('Escrow Funded');
        expect(getTransactionTypeLabel('RELEASE')).toBe('Payment Released');
        expect(getTransactionTypeLabel('REFUND')).toBe('Refund');
        expect(getTransactionTypeLabel('DISPUTE_HOLD')).toBe('Dispute Hold');
        expect(getTransactionTypeLabel('DISPUTE_RELEASE')).toBe('Dispute Released');
      });
    });

    describe('getTransactionStatusColor', () => {
      it('should return correct colors for transaction statuses', () => {
        expect(getTransactionStatusColor('PENDING')).toBe('yellow');
        expect(getTransactionStatusColor('PROCESSING')).toBe('blue');
        expect(getTransactionStatusColor('COMPLETED')).toBe('green');
        expect(getTransactionStatusColor('FAILED')).toBe('red');
        expect(getTransactionStatusColor('CANCELLED')).toBe('gray');
      });
    });

    describe('calculateTotalEscrowNeeded', () => {
      it('should calculate total for unfunded milestones', () => {
        const milestones = [
          { amount: 50000, status: 'PENDING' },
          { amount: 30000, status: 'FUNDED' },
          { amount: 20000, status: 'RELEASED' },
          { amount: 40000, status: 'IN_PROGRESS' },
        ];

        const total = calculateTotalEscrowNeeded(milestones);

        // Should include PENDING, FUNDED, IN_PROGRESS but not RELEASED
        expect(total).toBe(120000); // 50000 + 30000 + 40000
      });

      it('should exclude cancelled milestones', () => {
        const milestones = [
          { amount: 50000, status: 'PENDING' },
          { amount: 30000, status: 'CANCELLED' },
        ];

        const total = calculateTotalEscrowNeeded(milestones);

        expect(total).toBe(50000);
      });
    });
  });
});
