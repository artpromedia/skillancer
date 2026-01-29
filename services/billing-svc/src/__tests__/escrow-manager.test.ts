// @ts-nocheck - Test file with mocked dependencies
/**
 * @module @skillancer/billing-svc/tests/escrow-manager
 * Unit Tests for Escrow Manager Service
 *
 * Tests critical payment flows:
 * - Escrow creation
 * - Fund deposit
 * - Milestone releases
 * - Dispute handling
 * - Refund processing
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

// Mock Stripe
const mockStripeTransfers = {
  create: vi.fn(),
  retrieve: vi.fn(),
};

const mockStripePaymentIntents = {
  create: vi.fn(),
  retrieve: vi.fn(),
  confirm: vi.fn(),
  cancel: vi.fn(),
};

const mockStripeRefunds = {
  create: vi.fn(),
};

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      transfers: mockStripeTransfers,
      paymentIntents: mockStripePaymentIntents,
      refunds: mockStripeRefunds,
    })),
  };
});

// Mock Prisma
const mockPrismaEscrow = {
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockPrismaEscrowMilestone = {
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
};

const mockPrismaContract = {
  findUnique: vi.fn(),
  update: vi.fn(),
};

const mockPrisma = {
  escrow: mockPrismaEscrow,
  escrowMilestone: mockPrismaEscrowMilestone,
  contract: mockPrismaContract,
  $transaction: vi.fn((fn) => fn(mockPrisma)),
};

vi.mock('@skillancer/database', () => ({
  prisma: mockPrisma,
}));

// Mock Logger
vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Billing Notifications
const mockBillingNotifications = {
  notifyEscrowFunded: vi.fn().mockResolvedValue(undefined),
  notifyEscrowReleased: vi.fn().mockResolvedValue(undefined),
  notifyMilestoneApproved: vi.fn().mockResolvedValue(undefined),
  notifyMilestoneRejected: vi.fn().mockResolvedValue(undefined),
  notifyDisputeOpened: vi.fn().mockResolvedValue(undefined),
  notifyDisputeResolved: vi.fn().mockResolvedValue(undefined),
};

vi.mock('./billing-notifications.js', () => ({
  billingNotifications: mockBillingNotifications,
}));

// Mock Payment Orchestrator
const mockPaymentOrchestrator = {
  processPayment: vi.fn(),
  capturePayment: vi.fn(),
  refundPayment: vi.fn(),
};

vi.mock('./payment-orchestrator.js', () => ({
  getPaymentOrchestrator: vi.fn(() => mockPaymentOrchestrator),
}));

// Mock Stripe Service
vi.mock('./stripe.service.js', () => ({
  getStripe: vi.fn(() => ({
    transfers: mockStripeTransfers,
    paymentIntents: mockStripePaymentIntents,
    refunds: mockStripeRefunds,
  })),
}));

// Import after mocks
import { EscrowManager } from '../services/escrow-manager.js';

// =============================================================================
// TEST FIXTURES
// =============================================================================

const TEST_CONTRACT_ID = 'contract-123';
const TEST_CLIENT_ID = 'client-456';
const TEST_FREELANCER_ID = 'freelancer-789';
const TEST_ESCROW_ID = 'escrow-abc';
const TEST_MILESTONE_ID = 'milestone-def';

const createEscrowRequest = {
  contractId: TEST_CONTRACT_ID,
  clientId: TEST_CLIENT_ID,
  freelancerId: TEST_FREELANCER_ID,
  totalAmount: 1000,
  currency: 'USD',
  milestones: [
    { name: 'Initial Design', amount: 300, order: 1 },
    { name: 'Development', amount: 500, order: 2 },
    { name: 'Final Delivery', amount: 200, order: 3 },
  ],
  releaseType: 'APPROVAL_REQUIRED' as const,
};

const mockEscrow = {
  id: TEST_ESCROW_ID,
  contractId: TEST_CONTRACT_ID,
  clientId: TEST_CLIENT_ID,
  freelancerId: TEST_FREELANCER_ID,
  totalAmount: 1000,
  fundedAmount: 1000,
  releasedAmount: 0,
  platformFee: 100,
  netAmount: 900,
  currency: 'USD',
  status: 'FUNDED',
  releaseType: 'APPROVAL_REQUIRED',
  autoReleaseAfterDays: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  milestones: [
    {
      id: TEST_MILESTONE_ID,
      escrowId: TEST_ESCROW_ID,
      name: 'Initial Design',
      amount: 300,
      status: 'PENDING',
      order: 1,
    },
    {
      id: 'milestone-2',
      escrowId: TEST_ESCROW_ID,
      name: 'Development',
      amount: 500,
      status: 'PENDING',
      order: 2,
    },
    {
      id: 'milestone-3',
      escrowId: TEST_ESCROW_ID,
      name: 'Final Delivery',
      amount: 200,
      status: 'PENDING',
      order: 3,
    },
  ],
};

// =============================================================================
// TESTS
// =============================================================================

describe('EscrowManager', () => {
  let escrowManager: EscrowManager;

  beforeEach(() => {
    vi.clearAllMocks();
    escrowManager = new EscrowManager();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // ESCROW CREATION TESTS
  // ===========================================================================

  describe('createEscrow', () => {
    it('should create escrow with correct milestone amounts', async () => {
      mockPrismaEscrow.create.mockResolvedValue({
        ...mockEscrow,
        status: 'PENDING_DEPOSIT',
        fundedAmount: 0,
      });

      mockStripePaymentIntents.create.mockResolvedValue({
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        status: 'requires_payment_method',
      });

      const result = await escrowManager.createEscrow(createEscrowRequest);

      expect(result.success).toBe(true);
      expect(result.escrowId).toBe(TEST_ESCROW_ID);
      expect(mockPrismaEscrow.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contractId: TEST_CONTRACT_ID,
            clientId: TEST_CLIENT_ID,
            freelancerId: TEST_FREELANCER_ID,
            totalAmount: 1000,
            platformFee: 100, // 10% default
            netAmount: 900,
          }),
        })
      );
    });

    it('should reject when milestone amounts do not match total', async () => {
      const invalidRequest = {
        ...createEscrowRequest,
        milestones: [
          { name: 'Milestone 1', amount: 500, order: 1 },
          { name: 'Milestone 2', amount: 300, order: 2 },
          // Missing 200 to reach total of 1000
        ],
      };

      await expect(escrowManager.createEscrow(invalidRequest)).rejects.toThrow(
        /Milestone amounts.*must equal total amount/
      );
    });

    it('should calculate platform fee correctly with custom percentage', async () => {
      mockPrismaEscrow.create.mockResolvedValue({
        ...mockEscrow,
        platformFee: 150,
        netAmount: 850,
      });

      mockStripePaymentIntents.create.mockResolvedValue({
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
      });

      const requestWithCustomFee = {
        ...createEscrowRequest,
        platformFeePercent: 15,
      };

      await escrowManager.createEscrow(requestWithCustomFee);

      expect(mockPrismaEscrow.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            platformFee: 150, // 15% of 1000
            netAmount: 850,
          }),
        })
      );
    });
  });

  // ===========================================================================
  // FUND ESCROW TESTS
  // ===========================================================================

  describe('fundEscrow', () => {
    it('should update escrow status to FUNDED after successful payment', async () => {
      mockPrismaEscrow.findUnique.mockResolvedValue({
        ...mockEscrow,
        status: 'PENDING_DEPOSIT',
        fundedAmount: 0,
      });

      mockPrismaEscrow.update.mockResolvedValue({
        ...mockEscrow,
        status: 'FUNDED',
        fundedAmount: 1000,
      });

      const result = await escrowManager.fundEscrow(TEST_ESCROW_ID, 'pi_test123');

      expect(result.success).toBe(true);
      expect(mockPrismaEscrow.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TEST_ESCROW_ID },
          data: expect.objectContaining({
            status: 'FUNDED',
            fundedAmount: 1000,
          }),
        })
      );
      expect(mockBillingNotifications.notifyEscrowFunded).toHaveBeenCalled();
    });

    it('should reject funding for already funded escrow', async () => {
      mockPrismaEscrow.findUnique.mockResolvedValue({
        ...mockEscrow,
        status: 'FUNDED',
      });

      const result = await escrowManager.fundEscrow(TEST_ESCROW_ID, 'pi_test123');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/already funded|invalid status/i);
    });
  });

  // ===========================================================================
  // RELEASE MILESTONE TESTS
  // ===========================================================================

  describe('releaseMilestone', () => {
    it('should release milestone funds to freelancer', async () => {
      mockPrismaEscrow.findUnique.mockResolvedValue(mockEscrow);
      mockPrismaEscrowMilestone.findUnique.mockResolvedValue(mockEscrow.milestones[0]);

      mockStripeTransfers.create.mockResolvedValue({
        id: 'tr_test123',
        amount: 27000, // 270 after platform fee (300 - 10%)
      });

      mockPrismaEscrowMilestone.update.mockResolvedValue({
        ...mockEscrow.milestones[0],
        status: 'RELEASED',
      });

      mockPrismaEscrow.update.mockResolvedValue({
        ...mockEscrow,
        releasedAmount: 300,
      });

      const result = await escrowManager.releaseMilestone({
        escrowId: TEST_ESCROW_ID,
        milestoneId: TEST_MILESTONE_ID,
        approvedBy: TEST_CLIENT_ID,
        approvalType: 'CLIENT',
      });

      expect(result.success).toBe(true);
      expect(result.amountReleased).toBe(300);
      expect(mockBillingNotifications.notifyMilestoneApproved).toHaveBeenCalled();
    });

    it('should reject release for disputed escrow', async () => {
      mockPrismaEscrow.findUnique.mockResolvedValue({
        ...mockEscrow,
        status: 'DISPUTED',
      });

      const result = await escrowManager.releaseMilestone({
        escrowId: TEST_ESCROW_ID,
        milestoneId: TEST_MILESTONE_ID,
        approvedBy: TEST_CLIENT_ID,
        approvalType: 'CLIENT',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/disputed|cannot release/i);
    });

    it('should reject release for already released milestone', async () => {
      mockPrismaEscrow.findUnique.mockResolvedValue(mockEscrow);
      mockPrismaEscrowMilestone.findUnique.mockResolvedValue({
        ...mockEscrow.milestones[0],
        status: 'RELEASED',
      });

      const result = await escrowManager.releaseMilestone({
        escrowId: TEST_ESCROW_ID,
        milestoneId: TEST_MILESTONE_ID,
        approvedBy: TEST_CLIENT_ID,
        approvalType: 'CLIENT',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/already released/i);
    });
  });

  // ===========================================================================
  // REFUND TESTS
  // ===========================================================================

  describe('refundEscrow', () => {
    it('should refund unreleased funds to client', async () => {
      mockPrismaEscrow.findUnique.mockResolvedValue({
        ...mockEscrow,
        releasedAmount: 300, // First milestone released
      });

      mockStripeRefunds.create.mockResolvedValue({
        id: 'rf_test123',
        amount: 70000, // 700 cents refunded
      });

      mockPrismaEscrow.update.mockResolvedValue({
        ...mockEscrow,
        status: 'REFUNDED',
      });

      const result = await escrowManager.refundEscrow(TEST_ESCROW_ID, 'Contract cancelled');

      expect(result.success).toBe(true);
      expect(result.refundedAmount).toBe(700); // 1000 - 300 released
      expect(mockPrismaEscrow.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'REFUNDED',
          }),
        })
      );
    });

    it('should handle full refund when no funds released', async () => {
      mockPrismaEscrow.findUnique.mockResolvedValue({
        ...mockEscrow,
        releasedAmount: 0,
      });

      mockStripeRefunds.create.mockResolvedValue({
        id: 'rf_test123',
        amount: 100000,
      });

      mockPrismaEscrow.update.mockResolvedValue({
        ...mockEscrow,
        status: 'REFUNDED',
      });

      const result = await escrowManager.refundEscrow(
        TEST_ESCROW_ID,
        'Client requested cancellation'
      );

      expect(result.success).toBe(true);
      expect(result.refundedAmount).toBe(1000);
    });

    it('should reject refund for completely released escrow', async () => {
      mockPrismaEscrow.findUnique.mockResolvedValue({
        ...mockEscrow,
        status: 'RELEASED',
        releasedAmount: 1000,
      });

      const result = await escrowManager.refundEscrow(TEST_ESCROW_ID, 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/no funds|already released/i);
    });
  });

  // ===========================================================================
  // DISPUTE HANDLING TESTS
  // ===========================================================================

  describe('openDispute', () => {
    it('should mark escrow as disputed and freeze funds', async () => {
      mockPrismaEscrow.findUnique.mockResolvedValue(mockEscrow);
      mockPrismaEscrow.update.mockResolvedValue({
        ...mockEscrow,
        status: 'DISPUTED',
      });

      const result = await escrowManager.openDispute(
        TEST_ESCROW_ID,
        TEST_FREELANCER_ID,
        'Work not delivered as agreed'
      );

      expect(result.success).toBe(true);
      expect(mockPrismaEscrow.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DISPUTED',
          }),
        })
      );
      expect(mockBillingNotifications.notifyDisputeOpened).toHaveBeenCalled();
    });

    it('should reject dispute for already disputed escrow', async () => {
      mockPrismaEscrow.findUnique.mockResolvedValue({
        ...mockEscrow,
        status: 'DISPUTED',
      });

      const result = await escrowManager.openDispute(
        TEST_ESCROW_ID,
        TEST_FREELANCER_ID,
        'Test dispute'
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/already.*disputed/i);
    });
  });

  describe('resolveDispute', () => {
    it('should resolve dispute in favor of freelancer and release funds', async () => {
      mockPrismaEscrow.findUnique.mockResolvedValue({
        ...mockEscrow,
        status: 'DISPUTED',
      });

      mockStripeTransfers.create.mockResolvedValue({
        id: 'tr_test123',
        amount: 90000,
      });

      mockPrismaEscrow.update.mockResolvedValue({
        ...mockEscrow,
        status: 'RELEASED',
        releasedAmount: 1000,
      });

      const result = await escrowManager.resolveDispute(
        TEST_ESCROW_ID,
        'FREELANCER',
        'admin-123',
        'Work was delivered as per requirements'
      );

      expect(result.success).toBe(true);
      expect(mockBillingNotifications.notifyDisputeResolved).toHaveBeenCalled();
    });

    it('should resolve dispute in favor of client and refund', async () => {
      mockPrismaEscrow.findUnique.mockResolvedValue({
        ...mockEscrow,
        status: 'DISPUTED',
      });

      mockStripeRefunds.create.mockResolvedValue({
        id: 'rf_test123',
        amount: 100000,
      });

      mockPrismaEscrow.update.mockResolvedValue({
        ...mockEscrow,
        status: 'REFUNDED',
      });

      const result = await escrowManager.resolveDispute(
        TEST_ESCROW_ID,
        'CLIENT',
        'admin-123',
        'Freelancer did not deliver work'
      );

      expect(result.success).toBe(true);
      expect(mockBillingNotifications.notifyDisputeResolved).toHaveBeenCalled();
    });

    it('should handle split resolution', async () => {
      mockPrismaEscrow.findUnique.mockResolvedValue({
        ...mockEscrow,
        status: 'DISPUTED',
      });

      mockStripeTransfers.create.mockResolvedValue({
        id: 'tr_test123',
        amount: 45000, // 50% to freelancer
      });

      mockStripeRefunds.create.mockResolvedValue({
        id: 'rf_test123',
        amount: 50000, // 50% refunded to client
      });

      mockPrismaEscrow.update.mockResolvedValue({
        ...mockEscrow,
        status: 'RELEASED',
      });

      const result = await escrowManager.resolveDispute(
        TEST_ESCROW_ID,
        'SPLIT',
        'admin-123',
        'Partial work completed - 50/50 split',
        { freelancerPercent: 50, clientPercent: 50 }
      );

      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // AUTO-RELEASE TESTS
  // ===========================================================================

  describe('processAutoRelease', () => {
    it('should auto-release milestone after approval period', async () => {
      const autoReleaseEscrow = {
        ...mockEscrow,
        releaseType: 'AUTOMATIC',
        autoReleaseAfterDays: 7,
        milestones: [
          {
            ...mockEscrow.milestones[0],
            status: 'SUBMITTED',
            submittedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
          },
        ],
      };

      mockPrismaEscrow.findMany.mockResolvedValue([autoReleaseEscrow]);

      mockStripeTransfers.create.mockResolvedValue({
        id: 'tr_auto123',
        amount: 27000,
      });

      mockPrismaEscrowMilestone.update.mockResolvedValue({
        ...autoReleaseEscrow.milestones[0],
        status: 'RELEASED',
      });

      const results = await escrowManager.processAutoRelease();

      expect(results.processed).toBeGreaterThan(0);
      expect(mockStripeTransfers.create).toHaveBeenCalled();
    });

    it('should not auto-release milestone before approval period', async () => {
      const recentEscrow = {
        ...mockEscrow,
        releaseType: 'AUTOMATIC',
        autoReleaseAfterDays: 7,
        milestones: [
          {
            ...mockEscrow.milestones[0],
            status: 'SUBMITTED',
            submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          },
        ],
      };

      mockPrismaEscrow.findMany.mockResolvedValue([recentEscrow]);

      const results = await escrowManager.processAutoRelease();

      expect(results.processed).toBe(0);
      expect(mockStripeTransfers.create).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // BALANCE AND STATUS TESTS
  // ===========================================================================

  describe('getEscrowBalance', () => {
    it('should return correct balance breakdown', async () => {
      mockPrismaEscrow.findUnique.mockResolvedValue({
        ...mockEscrow,
        fundedAmount: 1000,
        releasedAmount: 300,
      });

      const balance = await escrowManager.getEscrowBalance(TEST_ESCROW_ID);

      expect(balance.totalAmount).toBe(1000);
      expect(balance.fundedAmount).toBe(1000);
      expect(balance.releasedAmount).toBe(300);
      expect(balance.availableAmount).toBe(700);
      expect(balance.platformFee).toBe(100);
    });
  });

  describe('getEscrowStatus', () => {
    it('should return full escrow status with milestones', async () => {
      mockPrismaEscrow.findUnique.mockResolvedValue(mockEscrow);

      const status = await escrowManager.getEscrowStatus(TEST_ESCROW_ID);

      expect(status.escrowId).toBe(TEST_ESCROW_ID);
      expect(status.status).toBe('FUNDED');
      expect(status.milestones).toHaveLength(3);
      expect(status.milestones[0].name).toBe('Initial Design');
    });
  });
});
