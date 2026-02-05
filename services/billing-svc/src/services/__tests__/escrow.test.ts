/**
 * @module @skillancer/billing-svc/services/__tests__/escrow
 * Comprehensive unit tests for the EscrowManager class
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const mockPrisma = {
  escrow: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  escrowMilestone: {
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  escrowRelease: {
    create: vi.fn(),
  },
  escrowApproval: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  stripeConnectedAccount: {
    findFirst: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn((args: unknown[]) => Promise.all(args)),
};

vi.mock('@skillancer/database', () => ({
  prisma: mockPrisma,
}));

const mockStripeTransfersCreate = vi.fn();
const mockStripeRefundsCreate = vi.fn();

vi.mock('../stripe.service.js', () => ({
  getStripe: vi.fn(() => ({
    transfers: { create: mockStripeTransfersCreate },
    refunds: { create: mockStripeRefundsCreate },
    paymentIntents: { create: vi.fn(), retrieve: vi.fn() },
  })),
}));

const mockCreatePayment = vi.fn();

vi.mock('../payment-orchestrator.js', () => ({
  getPaymentOrchestrator: vi.fn(() => ({
    createPayment: mockCreatePayment,
  })),
}));

vi.mock('../billing-notifications.js', () => ({
  billingNotifications: {
    notifyEscrowFunded: vi.fn().mockResolvedValue(undefined),
    notifyPaymentReceived: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { EscrowManager } from '../escrow-manager.js';
import type { CreateEscrowRequest, ReleaseRequest } from '../escrow-manager.js';

// =============================================================================
// TEST SUITE
// =============================================================================

describe('EscrowManager', () => {
  let manager: EscrowManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new EscrowManager();
  });

  // ===========================================================================
  // createEscrow
  // ===========================================================================

  describe('createEscrow()', () => {
    const validRequest: CreateEscrowRequest = {
      contractId: 'contract-001',
      clientId: 'client-001',
      freelancerId: 'freelancer-001',
      totalAmount: 5000,
      currency: 'usd',
      milestones: [
        { name: 'Design Phase', amount: 2000, order: 1 },
        { name: 'Development Phase', amount: 3000, order: 2 },
      ],
      releaseType: 'APPROVAL_REQUIRED',
    };

    it('should create escrow successfully with valid data', async () => {
      const mockEscrow = {
        id: 'escrow-001',
        ...validRequest,
        fundedAmount: 0,
        releasedAmount: 0,
        platformFee: 500,
        netAmount: 4500,
        status: 'PENDING_DEPOSIT',
        milestones: [
          { id: 'ms-1', name: 'Design Phase', amount: 2000, order: 1, status: 'PENDING' },
          { id: 'ms-2', name: 'Development Phase', amount: 3000, order: 2, status: 'PENDING' },
        ],
      };

      mockPrisma.escrow.create.mockResolvedValue(mockEscrow);
      mockPrisma.escrow.update.mockResolvedValue(mockEscrow);
      mockCreatePayment.mockResolvedValue({
        paymentId: 'pay-001',
        stripePaymentIntentId: 'pi_test123',
        clientSecret: 'pi_test123_secret',
        status: 'PENDING',
        success: false,
        requiresAction: false,
      });

      const result = await manager.createEscrow(validRequest);

      expect(result.success).toBe(true);
      expect(result.escrowId).toBe('escrow-001');
      expect(result.paymentUrl).toContain('pi_test123_secret');
      expect(mockPrisma.escrow.create).toHaveBeenCalledOnce();
    });

    it('should fail when milestone amounts do not equal total amount', async () => {
      const invalidRequest: CreateEscrowRequest = {
        ...validRequest,
        milestones: [
          { name: 'Design Phase', amount: 1000, order: 1 },
          { name: 'Development Phase', amount: 2000, order: 2 },
        ],
      };

      const result = await manager.createEscrow(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Milestone amounts');
      expect(result.error).toContain('must equal total amount');
      expect(result.escrowId).toBe('');
    });

    it('should use default 10% platform fee when not specified', async () => {
      const mockEscrow = {
        id: 'escrow-002',
        milestones: [],
      };

      mockPrisma.escrow.create.mockResolvedValue(mockEscrow);
      mockPrisma.escrow.update.mockResolvedValue(mockEscrow);
      mockCreatePayment.mockResolvedValue({
        paymentId: 'pay-002',
        stripePaymentIntentId: 'pi_test456',
        clientSecret: null,
        status: 'PENDING',
        success: false,
        requiresAction: false,
      });

      await manager.createEscrow(validRequest);

      expect(mockPrisma.escrow.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            platformFee: 500,
            netAmount: 4500,
          }),
        })
      );
    });

    it('should apply custom platform fee percent', async () => {
      const mockEscrow = { id: 'escrow-003', milestones: [] };
      mockPrisma.escrow.create.mockResolvedValue(mockEscrow);
      mockPrisma.escrow.update.mockResolvedValue(mockEscrow);
      mockCreatePayment.mockResolvedValue({
        paymentId: 'pay-003',
        stripePaymentIntentId: 'pi_test789',
        clientSecret: null,
        status: 'PENDING',
        success: false,
        requiresAction: false,
      });

      await manager.createEscrow({ ...validRequest, platformFeePercent: 15 });

      expect(mockPrisma.escrow.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            platformFee: 750,
            netAmount: 4250,
          }),
        })
      );
    });

    it('should uppercase the currency', async () => {
      const mockEscrow = { id: 'escrow-004', milestones: [] };
      mockPrisma.escrow.create.mockResolvedValue(mockEscrow);
      mockPrisma.escrow.update.mockResolvedValue(mockEscrow);
      mockCreatePayment.mockResolvedValue({
        paymentId: 'pay-004',
        stripePaymentIntentId: 'pi_test000',
        status: 'PENDING',
        success: false,
        requiresAction: false,
      });

      await manager.createEscrow(validRequest);

      expect(mockPrisma.escrow.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currency: 'USD',
          }),
        })
      );
    });

    it('should handle payment orchestrator failure gracefully', async () => {
      const mockEscrow = { id: 'escrow-005', milestones: [] };
      mockPrisma.escrow.create.mockResolvedValue(mockEscrow);
      mockCreatePayment.mockRejectedValue(new Error('Stripe connection error'));

      const result = await manager.createEscrow(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Stripe connection error');
    });

    it('should handle database creation failure gracefully', async () => {
      mockPrisma.escrow.create.mockRejectedValue(new Error('Database connection failed'));

      const result = await manager.createEscrow(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });
  });

  // ===========================================================================
  // markFunded
  // ===========================================================================

  describe('markFunded()', () => {
    it('should mark escrow as funded and activate first milestone', async () => {
      const mockEscrow = {
        id: 'escrow-001',
        status: 'PENDING_DEPOSIT',
        totalAmount: 5000,
        currency: 'USD',
        freelancerId: 'freelancer-001',
        contractId: 'contract-001',
        contract: { title: 'Test Contract' },
      };

      mockPrisma.escrow.findUnique.mockResolvedValue(mockEscrow);
      mockPrisma.escrow.update.mockResolvedValue({ ...mockEscrow, status: 'FUNDED' });
      mockPrisma.escrowMilestone.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.auditLog.create.mockResolvedValue({});

      await manager.markFunded('escrow-001', 'pi_test123');

      expect(mockPrisma.escrow.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'escrow-001' },
          data: expect.objectContaining({
            status: 'FUNDED',
            fundedAmount: 5000,
            stripePaymentIntentId: 'pi_test123',
          }),
        })
      );

      expect(mockPrisma.escrowMilestone.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { escrowId: 'escrow-001', order: 1 },
          data: expect.objectContaining({ status: 'ACTIVE' }),
        })
      );

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ESCROW_FUNDED',
            resourceType: 'escrow',
            resourceId: 'escrow-001',
          }),
        })
      );
    });

    it('should throw when escrow not found', async () => {
      mockPrisma.escrow.findUnique.mockResolvedValue(null);

      await expect(manager.markFunded('nonexistent', 'pi_test123')).rejects.toThrow(
        'Escrow nonexistent not found'
      );
    });

    it('should do nothing when escrow is already funded', async () => {
      mockPrisma.escrow.findUnique.mockResolvedValue({
        id: 'escrow-001',
        status: 'FUNDED',
        totalAmount: 5000,
      });

      await manager.markFunded('escrow-001', 'pi_test123');

      expect(mockPrisma.escrow.update).not.toHaveBeenCalled();
    });

    it('should skip funding if escrow is in RELEASED state', async () => {
      mockPrisma.escrow.findUnique.mockResolvedValue({
        id: 'escrow-001',
        status: 'RELEASED',
        totalAmount: 5000,
      });

      await manager.markFunded('escrow-001', 'pi_test123');

      expect(mockPrisma.escrow.update).not.toHaveBeenCalled();
    });

    it('should skip funding if escrow is in DISPUTED state', async () => {
      mockPrisma.escrow.findUnique.mockResolvedValue({
        id: 'escrow-001',
        status: 'DISPUTED',
        totalAmount: 5000,
      });

      await manager.markFunded('escrow-001', 'pi_test123');

      expect(mockPrisma.escrow.update).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // releaseFunds
  // ===========================================================================

  describe('releaseFunds()', () => {
    const baseMilestone = {
      id: 'ms-1',
      name: 'Design Phase',
      amount: 2000,
      order: 1,
      status: 'ACTIVE',
      escrowId: 'escrow-001',
    };

    const baseEscrow = {
      id: 'escrow-001',
      status: 'FUNDED',
      totalAmount: 5000,
      fundedAmount: 5000,
      releasedAmount: 0,
      platformFee: 500,
      currency: 'USD',
      contractId: 'contract-001',
      freelancerId: 'freelancer-001',
      releaseType: 'APPROVAL_REQUIRED',
      milestones: [baseMilestone],
      freelancer: { email: 'freelancer@example.com' },
      contract: { title: 'Test Contract' },
    };

    it('should release funds for a specific milestone', async () => {
      mockPrisma.escrow.findUnique.mockResolvedValue(baseEscrow);
      mockPrisma.stripeConnectedAccount.findFirst.mockResolvedValue({
        stripeAccountId: 'acct_test123',
        status: 'ACTIVE',
      });
      mockStripeTransfersCreate.mockResolvedValue({ id: 'tr_test123' });
      mockPrisma.escrowApproval.findFirst.mockResolvedValue(null);

      const request: ReleaseRequest = {
        escrowId: 'escrow-001',
        milestoneId: 'ms-1',
        approvedBy: 'client-001',
        approvalType: 'CLIENT',
      };

      const result = await manager.releaseFunds(request);

      expect(result.success).toBe(true);
      expect(result.transferId).toBe('tr_test123');
      expect(result.amountReleased).toBe(2000);
      expect(result.remainingBalance).toBe(3000);
    });

    it('should release funds by amount when no milestone specified', async () => {
      const escrowForAmount = {
        ...baseEscrow,
        milestones: [],
      };
      mockPrisma.escrow.findUnique.mockResolvedValue(escrowForAmount);
      mockPrisma.stripeConnectedAccount.findFirst.mockResolvedValue({
        stripeAccountId: 'acct_test123',
        status: 'ACTIVE',
      });
      mockStripeTransfersCreate.mockResolvedValue({ id: 'tr_test456' });

      const request: ReleaseRequest = {
        escrowId: 'escrow-001',
        amount: 1500,
        approvedBy: 'client-001',
        approvalType: 'CLIENT',
      };

      const result = await manager.releaseFunds(request);

      expect(result.success).toBe(true);
      expect(result.amountReleased).toBe(1500);
    });

    it('should fail with insufficient balance', async () => {
      const lowBalanceEscrow = {
        ...baseEscrow,
        fundedAmount: 5000,
        releasedAmount: 4500,
        milestones: [],
      };
      mockPrisma.escrow.findUnique.mockResolvedValue(lowBalanceEscrow);

      const request: ReleaseRequest = {
        escrowId: 'escrow-001',
        amount: 1000,
        approvedBy: 'client-001',
        approvalType: 'CLIENT',
      };

      const result = await manager.releaseFunds(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient balance');
      expect(result.remainingBalance).toBe(500);
    });

    it('should fail when escrow not found', async () => {
      mockPrisma.escrow.findUnique.mockResolvedValue(null);

      const request: ReleaseRequest = {
        escrowId: 'nonexistent',
        milestoneId: 'ms-1',
        approvedBy: 'client-001',
        approvalType: 'CLIENT',
      };

      const result = await manager.releaseFunds(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Escrow not found');
    });

    it('should fail when escrow is in invalid status for release', async () => {
      mockPrisma.escrow.findUnique.mockResolvedValue({
        ...baseEscrow,
        status: 'PENDING_DEPOSIT',
      });

      const request: ReleaseRequest = {
        escrowId: 'escrow-001',
        milestoneId: 'ms-1',
        approvedBy: 'client-001',
        approvalType: 'CLIENT',
      };

      const result = await manager.releaseFunds(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot release from escrow');
    });

    it('should fail when milestone not found in escrow', async () => {
      mockPrisma.escrow.findUnique.mockResolvedValue(baseEscrow);

      const request: ReleaseRequest = {
        escrowId: 'escrow-001',
        milestoneId: 'nonexistent-ms',
        approvedBy: 'client-001',
        approvalType: 'CLIENT',
      };

      const result = await manager.releaseFunds(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Milestone not found');
    });

    it('should fail when milestone already released', async () => {
      const releasedMilestone = { ...baseMilestone, status: 'RELEASED' };
      mockPrisma.escrow.findUnique.mockResolvedValue({
        ...baseEscrow,
        milestones: [releasedMilestone],
      });

      const request: ReleaseRequest = {
        escrowId: 'escrow-001',
        milestoneId: 'ms-1',
        approvedBy: 'client-001',
        approvalType: 'CLIENT',
      };

      const result = await manager.releaseFunds(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Milestone already released');
    });

    it('should fail when no milestone or amount specified', async () => {
      mockPrisma.escrow.findUnique.mockResolvedValue({ ...baseEscrow, milestones: [] });

      const request: ReleaseRequest = {
        escrowId: 'escrow-001',
        approvedBy: 'client-001',
        approvalType: 'CLIENT',
      };

      const result = await manager.releaseFunds(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Must specify milestone or amount');
    });

    it('should fail when freelancer has no active connected account', async () => {
      mockPrisma.escrow.findUnique.mockResolvedValue({ ...baseEscrow, milestones: [] });
      mockPrisma.stripeConnectedAccount.findFirst.mockResolvedValue(null);

      const request: ReleaseRequest = {
        escrowId: 'escrow-001',
        amount: 1000,
        approvedBy: 'client-001',
        approvalType: 'CLIENT',
      };

      const result = await manager.releaseFunds(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Stripe connected account');
    });

    it('should mark escrow as RELEASED when all funds released', async () => {
      const fullReleaseEscrow = {
        ...baseEscrow,
        fundedAmount: 2000,
        releasedAmount: 0,
        milestones: [{ ...baseMilestone, amount: 2000 }],
      };
      mockPrisma.escrow.findUnique.mockResolvedValue(fullReleaseEscrow);
      mockPrisma.stripeConnectedAccount.findFirst.mockResolvedValue({
        stripeAccountId: 'acct_test123',
        status: 'ACTIVE',
      });
      mockStripeTransfersCreate.mockResolvedValue({ id: 'tr_final' });

      const request: ReleaseRequest = {
        escrowId: 'escrow-001',
        milestoneId: 'ms-1',
        approvedBy: 'client-001',
        approvalType: 'CLIENT',
      };

      const result = await manager.releaseFunds(request);

      expect(result.success).toBe(true);
      expect(result.remainingBalance).toBe(0);
    });

    it('should allow release from PARTIALLY_RELEASED state', async () => {
      const partialEscrow = {
        ...baseEscrow,
        status: 'PARTIALLY_RELEASED',
        fundedAmount: 5000,
        releasedAmount: 2000,
        milestones: [],
      };
      mockPrisma.escrow.findUnique.mockResolvedValue(partialEscrow);
      mockPrisma.stripeConnectedAccount.findFirst.mockResolvedValue({
        stripeAccountId: 'acct_test123',
        status: 'ACTIVE',
      });
      mockStripeTransfersCreate.mockResolvedValue({ id: 'tr_partial' });

      const request: ReleaseRequest = {
        escrowId: 'escrow-001',
        amount: 1000,
        approvedBy: 'client-001',
        approvalType: 'CLIENT',
      };

      const result = await manager.releaseFunds(request);

      expect(result.success).toBe(true);
      expect(result.amountReleased).toBe(1000);
    });
  });

  // ===========================================================================
  // refundToClient
  // ===========================================================================

  describe('refundToClient()', () => {
    it('should refund remaining escrow balance to client', async () => {
      const mockEscrow = {
        id: 'escrow-001',
        status: 'FUNDED',
        fundedAmount: 5000,
        releasedAmount: 0,
        stripePaymentIntentId: 'pi_test123',
        contractId: 'contract-001',
      };

      mockPrisma.escrow.findUnique.mockResolvedValue(mockEscrow);
      mockStripeRefundsCreate.mockResolvedValue({ id: 're_test123' });

      const result = await manager.refundToClient('escrow-001', 'Project cancelled', 'admin-001');

      expect(result.success).toBe(true);
      expect(mockStripeRefundsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_intent: 'pi_test123',
          amount: 5000,
        })
      );
    });

    it('should refund only unreleased amount in partially released escrow', async () => {
      const mockEscrow = {
        id: 'escrow-002',
        status: 'PARTIALLY_RELEASED',
        fundedAmount: 5000,
        releasedAmount: 2000,
        stripePaymentIntentId: 'pi_test456',
      };

      mockPrisma.escrow.findUnique.mockResolvedValue(mockEscrow);
      mockStripeRefundsCreate.mockResolvedValue({ id: 're_test456' });

      const result = await manager.refundToClient('escrow-002', 'Client request', 'admin-001');

      expect(result.success).toBe(true);
      expect(mockStripeRefundsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 3000,
        })
      );
    });

    it('should fail when escrow not found', async () => {
      mockPrisma.escrow.findUnique.mockResolvedValue(null);

      const result = await manager.refundToClient('nonexistent', 'reason', 'admin-001');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Escrow not found');
    });

    it('should fail when escrow is in invalid status for refund', async () => {
      mockPrisma.escrow.findUnique.mockResolvedValue({
        id: 'escrow-003',
        status: 'PENDING_DEPOSIT',
        fundedAmount: 0,
        releasedAmount: 0,
      });

      const result = await manager.refundToClient('escrow-003', 'reason', 'admin-001');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot refund escrow');
    });

    it('should fail when no funds available to refund', async () => {
      mockPrisma.escrow.findUnique.mockResolvedValue({
        id: 'escrow-004',
        status: 'FUNDED',
        fundedAmount: 5000,
        releasedAmount: 5000,
      });

      const result = await manager.refundToClient('escrow-004', 'reason', 'admin-001');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No funds available to refund');
    });

    it('should handle Stripe refund failure', async () => {
      mockPrisma.escrow.findUnique.mockResolvedValue({
        id: 'escrow-005',
        status: 'FUNDED',
        fundedAmount: 5000,
        releasedAmount: 0,
        stripePaymentIntentId: 'pi_test_fail',
      });
      mockStripeRefundsCreate.mockRejectedValue(new Error('Stripe API error'));

      const result = await manager.refundToClient('escrow-005', 'reason', 'admin-001');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Stripe API error');
    });

    it('should cancel pending milestones on refund', async () => {
      const mockEscrow = {
        id: 'escrow-006',
        status: 'FUNDED',
        fundedAmount: 3000,
        releasedAmount: 0,
        stripePaymentIntentId: 'pi_test_cancel',
      };

      mockPrisma.escrow.findUnique.mockResolvedValue(mockEscrow);
      mockStripeRefundsCreate.mockResolvedValue({ id: 're_cancel' });

      await manager.refundToClient('escrow-006', 'Cancelled', 'admin-001');

      // The transaction should include milestone cancellation
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // markDisputed
  // ===========================================================================

  describe('markDisputed()', () => {
    it('should mark escrow as disputed', async () => {
      mockPrisma.escrow.update.mockResolvedValue({
        id: 'escrow-001',
        status: 'DISPUTED',
        disputeId: 'dispute-001',
      });

      await manager.markDisputed('escrow-001', 'dispute-001');

      expect(mockPrisma.escrow.update).toHaveBeenCalledWith({
        where: { id: 'escrow-001' },
        data: expect.objectContaining({
          status: 'DISPUTED',
          disputeId: 'dispute-001',
        }),
      });
    });

    it('should set disputedAt timestamp', async () => {
      mockPrisma.escrow.update.mockResolvedValue({});

      await manager.markDisputed('escrow-002', 'dispute-002');

      expect(mockPrisma.escrow.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            disputedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should propagate database errors', async () => {
      mockPrisma.escrow.update.mockRejectedValue(new Error('DB write failed'));

      await expect(manager.markDisputed('escrow-003', 'dispute-003')).rejects.toThrow(
        'DB write failed'
      );
    });
  });

  // ===========================================================================
  // getEscrowStatus
  // ===========================================================================

  describe('getEscrowStatus()', () => {
    it('should return escrow status with milestones and releases', async () => {
      const mockEscrow = {
        id: 'escrow-001',
        status: 'FUNDED',
        totalAmount: 5000,
        fundedAmount: 5000,
        releasedAmount: 0,
        platformFee: 500,
        currency: 'USD',
        fundedAt: new Date('2025-01-01'),
        lastReleaseAt: null,
        milestones: [
          { id: 'ms-1', name: 'Phase 1', amount: 2000, status: 'ACTIVE', order: 1, dueDate: null },
          {
            id: 'ms-2',
            name: 'Phase 2',
            amount: 3000,
            status: 'PENDING',
            order: 2,
            dueDate: null,
          },
        ],
        releases: [],
      };

      mockPrisma.escrow.findUnique.mockResolvedValue(mockEscrow);

      const status = await manager.getEscrowStatus('escrow-001');

      expect(status).not.toBeNull();
      expect(status!.id).toBe('escrow-001');
      expect(status!.status).toBe('FUNDED');
      expect(status!.availableBalance).toBe(5000);
      expect(status!.milestones).toHaveLength(2);
      expect(status!.milestones[0].name).toBe('Phase 1');
    });

    it('should return null for non-existent escrow', async () => {
      mockPrisma.escrow.findUnique.mockResolvedValue(null);

      const status = await manager.getEscrowStatus('nonexistent');

      expect(status).toBeNull();
    });

    it('should calculate available balance correctly', async () => {
      mockPrisma.escrow.findUnique.mockResolvedValue({
        id: 'escrow-002',
        status: 'PARTIALLY_RELEASED',
        totalAmount: 10000,
        fundedAmount: 10000,
        releasedAmount: 3000,
        platformFee: 1000,
        currency: 'USD',
        fundedAt: new Date(),
        lastReleaseAt: new Date(),
        milestones: [],
        releases: [],
      });

      const status = await manager.getEscrowStatus('escrow-002');

      expect(status!.availableBalance).toBe(7000);
    });

    it('should include release history', async () => {
      const releaseRecord = {
        id: 'rel-1',
        escrowId: 'escrow-003',
        grossAmount: 2000,
        netAmount: 1800,
        platformFee: 200,
        createdAt: new Date(),
      };

      mockPrisma.escrow.findUnique.mockResolvedValue({
        id: 'escrow-003',
        status: 'PARTIALLY_RELEASED',
        totalAmount: 5000,
        fundedAmount: 5000,
        releasedAmount: 2000,
        platformFee: 500,
        currency: 'USD',
        fundedAt: new Date(),
        lastReleaseAt: new Date(),
        milestones: [],
        releases: [releaseRecord],
      });

      const status = await manager.getEscrowStatus('escrow-003');

      expect(status!.releases).toHaveLength(1);
      expect(status!.releases[0]).toEqual(releaseRecord);
    });
  });
});
