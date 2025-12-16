/**
 * @module @skillancer/billing-svc/services/__tests__/escrow
 * Unit tests for the escrow service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before imports
vi.mock('@skillancer/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@skillancer/database', () => ({
  prisma: {
    escrowTransaction: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    escrowBalance: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    marketplaceContract: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    milestone: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({})),
  },
}));

vi.mock('../stripe.service.js', () => ({
  getStripeService: vi.fn(() => ({
    getOrCreateCustomer: vi.fn().mockResolvedValue({ stripeCustomerId: 'cus_test123' }),
    createPaymentIntent: vi.fn().mockResolvedValue({
      id: 'pi_test123',
      status: 'requires_capture',
      client_secret: 'pi_test123_secret',
    }),
    capturePaymentIntent: vi.fn().mockResolvedValue({ id: 'pi_test123', status: 'succeeded' }),
    cancelPaymentIntent: vi.fn().mockResolvedValue({ id: 'pi_test123', status: 'canceled' }),
    createTransfer: vi.fn().mockResolvedValue({ id: 'tr_test123' }),
    refundPaymentIntent: vi.fn().mockResolvedValue({ id: 're_test123' }),
  })),
}));

vi.mock('../fee-calculator.service.js', () => ({
  getFeeCalculatorService: vi.fn(() => ({
    calculateEscrowFees: vi.fn().mockReturnValue({
      grossAmount: 1000,
      platformFee: 100,
      platformFeePercent: 10,
      secureModeAmount: 0,
      processingFee: 32.19,
      netAmount: 1000,
      totalCharge: 1132.19,
    }),
    calculateReleaseFees: vi.fn().mockReturnValue({
      grossAmount: 1000,
      platformFee: 100,
      platformFeePercent: 10,
      secureModeAmount: 0,
      processingFee: 0,
      netAmount: 900,
      totalCharge: 1000,
    }),
    getFeesPreview: vi.fn().mockReturnValue({
      grossAmount: 1000,
      platformFee: 100,
      platformFeePercent: 10,
      secureModeAmount: 0,
      processingFee: 32.19,
      netAmount: 1000,
      totalCharge: 1132.19,
      breakdown: [],
    }),
  })),
}));

vi.mock('../repositories/escrow.repository.js', () => ({
  getEscrowRepository: vi.fn(() => ({
    getOrCreateBalance: vi.fn().mockResolvedValue({
      id: 'eb_test123',
      contractId: 'contract-123',
      currentBalance: 1000,
      frozenAmount: 0,
      totalFunded: 1000,
      totalReleased: 0,
      totalRefunded: 0,
      status: 'ACTIVE',
    }),
    getBalance: vi.fn().mockResolvedValue({
      id: 'eb_test123',
      contractId: 'contract-123',
      currentBalance: 1000,
      frozenAmount: 0,
      totalFunded: 1000,
      totalReleased: 0,
      totalRefunded: 0,
      status: 'ACTIVE',
    }),
    createTransaction: vi.fn().mockResolvedValue({
      id: 'et_test123',
      type: 'FUND',
      status: 'REQUIRES_CAPTURE',
      grossAmount: 1000,
      platformFee: 100,
      processingFee: 32.19,
      netAmount: 1000,
      currency: 'USD',
      createdAt: new Date(),
    }),
    updateBalance: vi.fn().mockResolvedValue({}),
    updateTransaction: vi.fn().mockResolvedValue({}),
    freezeBalance: vi.fn().mockResolvedValue({}),
    unfreezeBalance: vi.fn().mockResolvedValue({}),
  })),
  getMilestoneRepository: vi.fn(() => ({
    findById: vi.fn().mockResolvedValue({
      id: 'm_test123',
      contractId: 'contract-123',
      amount: 1000,
      status: 'APPROVED',
      escrowFunded: true,
    }),
    update: vi.fn().mockResolvedValue({}),
  })),
  getContractRepository: vi.fn(() => ({
    findById: vi.fn().mockResolvedValue({
      id: 'contract-123',
      clientId: 'client-123',
      freelancerId: 'freelancer-123',
      title: 'Test Contract',
      status: 'ACTIVE',
      totalAmount: 1000,
      platformFeePercent: { toNumber: () => 10 },
      secureMode: false,
      secureModeFeePercent: null,
      currency: 'USD',
    }),
    update: vi.fn().mockResolvedValue({}),
  })),
}));

import { type EscrowService, getEscrowService } from '../escrow.service.js';

describe('EscrowService', () => {
  let service: EscrowService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Get a fresh service instance
    service = getEscrowService();
  });

  // ===========================================================================
  // getFeesPreview
  // ===========================================================================

  describe('getFeesPreview', () => {
    it('should return fee preview for a contract', async () => {
      const result = await service.getFeesPreview({
        amount: 1000,
        contractId: 'contract-123',
      });

      expect(result).toBeDefined();
      expect(result.grossAmount).toBe(1000);
      expect(result.platformFee).toBe(100);
    });
  });

  // ===========================================================================
  // fundEscrow
  // ===========================================================================

  describe('fundEscrow', () => {
    it('should fund escrow successfully', async () => {
      const result = await service.fundEscrow({
        contractId: 'contract-123',
        amount: 1000,
        paymentMethodId: 'pm_test123',
        clientUserId: 'client-123',
      });

      expect(result).toBeDefined();
      expect(result.transaction).toBeDefined();
      expect(result.clientSecret).toBeDefined();
    });

    it('should fund escrow for a specific milestone', async () => {
      const result = await service.fundEscrow({
        contractId: 'contract-123',
        milestoneId: 'm_test123',
        amount: 1000,
        paymentMethodId: 'pm_test123',
        clientUserId: 'client-123',
      });

      expect(result).toBeDefined();
      expect(result.transaction).toBeDefined();
    });
  });

  // ===========================================================================
  // releaseEscrow
  // ===========================================================================

  describe('releaseEscrow', () => {
    it('should release escrow for a milestone', async () => {
      const result = await service.releaseEscrow({
        contractId: 'contract-123',
        milestoneId: 'm_test123',
        clientUserId: 'client-123',
      });

      expect(result).toBeDefined();
      expect(result.transaction).toBeDefined();
    });

    it('should release a specific amount', async () => {
      const result = await service.releaseEscrow({
        contractId: 'contract-123',
        amount: 500,
        clientUserId: 'client-123',
      });

      expect(result).toBeDefined();
      expect(result.transaction).toBeDefined();
    });
  });

  // ===========================================================================
  // refundEscrow
  // ===========================================================================

  describe('refundEscrow', () => {
    it('should refund escrow', async () => {
      const result = await service.refundEscrow({
        contractId: 'contract-123',
        amount: 500,
        reason: 'Client requested refund',
        initiatedBy: 'client-123',
      });

      expect(result).toBeDefined();
      expect(result.transaction).toBeDefined();
    });

    it('should handle full refund', async () => {
      const result = await service.refundEscrow({
        contractId: 'contract-123',
        reason: 'Project cancelled',
        initiatedBy: 'client-123',
      });

      expect(result).toBeDefined();
    });
  });

  // ===========================================================================
  // freezeEscrow
  // ===========================================================================

  describe('freezeEscrow', () => {
    it('should freeze escrow for dispute', async () => {
      const result = await service.freezeEscrow({
        contractId: 'contract-123',
        disputeId: 'd_test123',
      });

      expect(result).toBeDefined();
    });

    it('should freeze a specific amount', async () => {
      const result = await service.freezeEscrow({
        contractId: 'contract-123',
        disputeId: 'd_test123',
        amount: 500,
      });

      expect(result).toBeDefined();
    });
  });

  // ===========================================================================
  // unfreezeEscrow
  // ===========================================================================

  describe('unfreezeEscrow', () => {
    it('should unfreeze escrow', async () => {
      const result = await service.unfreezeEscrow({
        contractId: 'contract-123',
      });

      expect(result).toBeDefined();
    });

    it('should unfreeze a specific amount', async () => {
      const result = await service.unfreezeEscrow({
        contractId: 'contract-123',
        amount: 500,
      });

      expect(result).toBeDefined();
    });
  });

  // ===========================================================================
  // getEscrowSummary
  // ===========================================================================

  describe('getEscrowSummary', () => {
    it('should return escrow summary for a contract', async () => {
      const result = await service.getEscrowSummary('contract-123', 'client-123');

      expect(result).toBeDefined();
      expect(result.contract).toBeDefined();
      expect(result.balance).toBeDefined();
    });
  });
});
