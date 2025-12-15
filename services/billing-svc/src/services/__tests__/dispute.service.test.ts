/**
 * @module @skillancer/billing-svc/services/__tests__/dispute
 * Unit tests for the dispute service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before imports
vi.mock('@skillancer/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../escrow.service.js', () => ({
  getEscrowService: vi.fn(() => ({
    freezeEscrow: vi.fn().mockResolvedValue({
      id: 'eb_test123',
      frozenAmount: 1000,
    }),
    unfreezeEscrow: vi.fn().mockResolvedValue({}),
    releaseEscrow: vi.fn().mockResolvedValue({
      transaction: { id: 'et_release' },
    }),
    refundEscrow: vi.fn().mockResolvedValue({
      transaction: { id: 'et_refund' },
    }),
  })),
}));

vi.mock('../fee-calculator.service.js', () => ({
  getFeeCalculatorService: vi.fn(() => ({
    calculateDisputeSplit: vi.fn().mockReturnValue({
      clientRefund: 500,
      freelancerPayout: 450,
      platformFee: 50,
    }),
    calculateCustomSplit: vi.fn().mockReturnValue({
      clientRefund: 300,
      freelancerPayout: 630,
      platformFee: 70,
    }),
  })),
}));

vi.mock('../repositories/dispute.repository.js', () => ({
  getDisputeRepository: vi.fn(() => ({
    findById: vi.fn().mockResolvedValue({
      id: 'd_test123',
      contractId: 'contract-123',
      milestoneId: 'm_test123',
      raisedBy: 'client-123',
      reason: 'QUALITY_ISSUES',
      description: 'Work quality does not meet expectations',
      status: 'OPEN',
      disputedAmount: { toNumber: () => 1000 },
      evidenceUrls: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
      contract: {
        id: 'contract-123',
        clientId: 'client-123',
        freelancerId: 'freelancer-123',
        title: 'Test Contract',
        status: 'DISPUTED',
        platformFeePercent: { toNumber: () => 10 },
      },
    }),
    create: vi.fn().mockResolvedValue({
      id: 'd_test123',
      contractId: 'contract-123',
      raisedBy: 'client-123',
      reason: 'QUALITY_ISSUES',
      description: 'Work quality does not meet expectations',
      status: 'OPEN',
      disputedAmount: 1000,
      messages: [],
      contract: {
        id: 'contract-123',
        clientId: 'client-123',
        freelancerId: 'freelancer-123',
        title: 'Test Contract',
      },
    }),
    update: vi.fn().mockResolvedValue({}),
    findByContractId: vi.fn().mockResolvedValue([]),
    findActiveByContractId: vi.fn().mockResolvedValue(null),
    addMessage: vi.fn().mockResolvedValue({
      id: 'dm_test123',
      disputeId: 'd_test123',
      senderId: 'freelancer-123',
      message: 'I disagree with this dispute',
      senderRole: 'FREELANCER',
      attachmentUrls: [],
      createdAt: new Date(),
    }),
    getMessages: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../repositories/escrow.repository.js', () => ({
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
      currency: 'USD',
    }),
    update: vi.fn().mockResolvedValue({}),
  })),
  getMilestoneRepository: vi.fn(() => ({
    findById: vi.fn().mockResolvedValue({
      id: 'm_test123',
      contractId: 'contract-123',
      amount: { toNumber: () => 1000 },
      status: 'SUBMITTED',
    }),
    update: vi.fn().mockResolvedValue({}),
  })),
  getEscrowRepository: vi.fn(() => ({
    getBalance: vi.fn().mockResolvedValue({
      currentBalance: 1000,
      frozenAmount: 0,
    }),
  })),
}));

import { getDisputeService } from '../dispute.service.js';

import type { DisputeService } from '../dispute.service.js';

describe('DisputeService', () => {
  let service: DisputeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = getDisputeService();
  });

  // ===========================================================================
  // createDispute
  // ===========================================================================

  describe('createDispute', () => {
    it('should create a new dispute', async () => {
      const result = await service.createDispute({
        contractId: 'contract-123',
        raisedBy: 'client-123',
        reason: 'QUALITY_ISSUES',
        description: 'Work quality does not meet expectations',
        disputedAmount: 1000,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('d_test123');
      expect(result.status).toBe('OPEN');
    });

    it('should create dispute for a specific milestone', async () => {
      const result = await service.createDispute({
        contractId: 'contract-123',
        milestoneId: 'm_test123',
        raisedBy: 'client-123',
        reason: 'QUALITY_ISSUES',
        description: 'Milestone work quality issues',
        disputedAmount: 500,
      });

      expect(result).toBeDefined();
    });

    it('should create dispute with evidence', async () => {
      const result = await service.createDispute({
        contractId: 'contract-123',
        raisedBy: 'client-123',
        reason: 'QUALITY_ISSUES',
        description: 'Work quality does not meet expectations',
        disputedAmount: 1000,
        evidenceUrls: ['https://evidence.com/screenshot1.png'],
      });

      expect(result).toBeDefined();
    });
  });

  // ===========================================================================
  // respondToDispute
  // ===========================================================================

  describe('respondToDispute', () => {
    it('should add a response to dispute', async () => {
      const result = await service.respondToDispute({
        disputeId: 'd_test123',
        responderId: 'freelancer-123',
        message: 'I disagree with this dispute. The work was delivered as specified.',
      });

      expect(result).toBeDefined();
    });

    it('should add response with attachments', async () => {
      const result = await service.respondToDispute({
        disputeId: 'd_test123',
        responderId: 'freelancer-123',
        message: 'Here is evidence of the completed work',
        attachmentUrls: ['https://drive.google.com/file/123'],
      });

      expect(result).toBeDefined();
    });

    it('should add response with proposed resolution', async () => {
      const result = await service.respondToDispute({
        disputeId: 'd_test123',
        responderId: 'freelancer-123',
        message: 'I propose a split resolution',
        proposedResolution: {
          type: 'SPLIT',
          clientAmount: 300,
          freelancerAmount: 700,
        },
      });

      expect(result).toBeDefined();
    });
  });

  // ===========================================================================
  // escalateDispute
  // ===========================================================================

  describe('escalateDispute', () => {
    it('should escalate dispute to mediator', async () => {
      const result = await service.escalateDispute({
        disputeId: 'd_test123',
        userId: 'client-123',
        reason: 'Cannot reach agreement with freelancer',
      });

      expect(result).toBeDefined();
    });
  });

  // ===========================================================================
  // resolveDispute
  // ===========================================================================

  describe('resolveDispute', () => {
    it('should resolve dispute with full refund', async () => {
      const result = await service.resolveDispute({
        disputeId: 'd_test123',
        resolution: 'FULL_REFUND',
        resolvedBy: 'mediator-123',
        resolutionNotes: 'Client is entitled to full refund',
      });

      expect(result).toBeDefined();
    });

    it('should resolve dispute with full release to freelancer', async () => {
      const result = await service.resolveDispute({
        disputeId: 'd_test123',
        resolution: 'FULL_RELEASE',
        resolvedBy: 'mediator-123',
        resolutionNotes: 'Freelancer delivered satisfactory work',
      });

      expect(result).toBeDefined();
    });

    it('should resolve dispute with split', async () => {
      const result = await service.resolveDispute({
        disputeId: 'd_test123',
        resolution: 'SPLIT',
        resolvedBy: 'mediator-123',
        clientRefundAmount: 500,
        resolutionNotes: 'Fair split between parties',
      });

      expect(result).toBeDefined();
    });

    it('should resolve dispute with partial refund', async () => {
      const result = await service.resolveDispute({
        disputeId: 'd_test123',
        resolution: 'PARTIAL_REFUND',
        resolvedBy: 'mediator-123',
        clientRefundAmount: 300,
        resolutionNotes: 'Partial refund for incomplete work',
      });

      expect(result).toBeDefined();
    });
  });

  // ===========================================================================
  // getDispute
  // ===========================================================================

  describe('getDispute', () => {
    it('should get dispute details', async () => {
      const result = await service.getDispute('d_test123', 'client-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('d_test123');
    });
  });

  // ===========================================================================
  // getActiveDisputeByContract
  // ===========================================================================

  describe('getActiveDisputeByContract', () => {
    it('should get active dispute for a contract', async () => {
      const result = await service.getActiveDisputeByContract('contract-123');

      // Can be null if no active dispute
      expect(result === null || typeof result === 'object').toBe(true);
    });
  });
});
