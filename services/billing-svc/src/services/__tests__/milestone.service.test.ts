/**
 * @module @skillancer/billing-svc/services/__tests__/milestone
 * Unit tests for the milestone service
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

vi.mock('../escrow.service.js', () => ({
  getEscrowService: vi.fn(() => ({
    releaseEscrow: vi.fn().mockResolvedValue({
      transaction: {
        id: 'et_test123',
        type: 'RELEASE',
        status: 'COMPLETED',
      },
    }),
  })),
}));

const mockMilestone = {
  id: 'm_test123',
  contractId: 'contract-123',
  title: 'Test Milestone',
  description: 'Test description',
  amount: { toNumber: () => 1000, toString: () => '1000' },
  status: 'PENDING',
  sortOrder: 1,
  deliverables: null,
  deliverableUrls: [],
  escrowFunded: false,
  escrowFundedAt: null,
  escrowReleasedAt: null,
  revisionCount: 0,
  maxRevisions: 2,
  dueDate: null,
  startedAt: null,
  submittedAt: null,
  completedAt: null,
  approvedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  contract: {
    id: 'contract-123',
    clientId: 'client-123',
    freelancerId: 'freelancer-123',
    title: 'Test Contract',
    status: 'ACTIVE',
    platformFeePercent: { toNumber: () => 10 },
    secureModeFeePercent: null,
    secureMode: false,
    currency: 'USD',
  },
};

const mockMilestoneRepo = {
  findById: vi.fn(),
  findByContractId: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockResolvedValue({
    id: 'm_test123',
    contractId: 'contract-123',
    title: 'Test Milestone',
    description: 'Test description',
    amount: 1000,
    status: 'PENDING',
    sortOrder: 1,
  }),
  update: vi.fn().mockResolvedValue({}),
  delete: vi.fn().mockResolvedValue({}),
};

vi.mock('../repositories/escrow.repository.js', () => ({
  getMilestoneRepository: vi.fn(() => mockMilestoneRepo),
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
  getEscrowRepository: vi.fn(() => ({})),
}));

import { getMilestoneService } from '../milestone.service.js';

import type { MilestoneService } from '../milestone.service.js';

describe('MilestoneService', () => {
  let service: MilestoneService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock to default PENDING milestone
    mockMilestoneRepo.findById.mockResolvedValue({ ...mockMilestone });
    service = getMilestoneService();
  });

  // ===========================================================================
  // createMilestone
  // ===========================================================================

  describe('createMilestone', () => {
    it('should create a new milestone', async () => {
      const result = await service.createMilestone({
        contractId: 'contract-123',
        title: 'Design Phase',
        description: 'Complete initial designs',
        amount: 1000,
        sortOrder: 1,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('m_test123');
    });

    it('should create milestone with due date', async () => {
      const dueDate = new Date('2025-01-15');

      const result = await service.createMilestone({
        contractId: 'contract-123',
        title: 'Design Phase',
        amount: 1000,
        dueDate,
      });

      expect(result).toBeDefined();
    });

    it('should create milestone with max revisions', async () => {
      const result = await service.createMilestone({
        contractId: 'contract-123',
        title: 'Design Phase',
        amount: 1000,
        maxRevisions: 3,
      });

      expect(result).toBeDefined();
    });
  });

  // ===========================================================================
  // getMilestone
  // ===========================================================================

  describe('getMilestone', () => {
    it('should get a milestone by ID', async () => {
      const result = await service.getMilestone('m_test123', 'client-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('m_test123');
    });

    it('should get milestone for freelancer', async () => {
      const result = await service.getMilestone('m_test123', 'freelancer-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('m_test123');
    });
  });

  // ===========================================================================
  // updateMilestone
  // ===========================================================================

  describe('updateMilestone', () => {
    it('should update milestone details', async () => {
      const result = await service.updateMilestone('m_test123', 'client-123', {
        title: 'Updated Title',
        amount: 1500,
      });

      expect(result).toBeDefined();
    });

    it('should update milestone due date', async () => {
      const dueDate = new Date('2025-02-01');

      const result = await service.updateMilestone('m_test123', 'client-123', {
        dueDate,
      });

      expect(result).toBeDefined();
    });
  });

  // ===========================================================================
  // submitMilestone
  // ===========================================================================

  describe('submitMilestone', () => {
    beforeEach(() => {
      // Set milestone to IN_PROGRESS with escrow funded for submit tests
      mockMilestoneRepo.findById.mockResolvedValue({
        ...mockMilestone,
        status: 'IN_PROGRESS',
        escrowFunded: true,
      });
    });

    it('should submit milestone for review', async () => {
      const result = await service.submitMilestone({
        milestoneId: 'm_test123',
        freelancerUserId: 'freelancer-123',
        deliverables: 'Completed design files',
      });

      expect(result).toBeDefined();
    });

    it('should submit milestone with deliverable URLs', async () => {
      const result = await service.submitMilestone({
        milestoneId: 'm_test123',
        freelancerUserId: 'freelancer-123',
        deliverables: 'Completed design files',
        deliverableUrls: ['https://figma.com/file/123', 'https://drive.google.com/abc'],
      });

      expect(result).toBeDefined();
    });
  });

  // ===========================================================================
  // approveMilestone
  // ===========================================================================

  describe('approveMilestone', () => {
    beforeEach(() => {
      // Set milestone to SUBMITTED for approval tests
      mockMilestoneRepo.findById.mockResolvedValue({
        ...mockMilestone,
        status: 'SUBMITTED',
        escrowFunded: true,
      });
    });

    it('should approve milestone', async () => {
      const result = await service.approveMilestone({
        milestoneId: 'm_test123',
        clientUserId: 'client-123',
      });

      expect(result).toBeDefined();
    });
  });

  // ===========================================================================
  // requestRevision
  // ===========================================================================

  describe('requestRevision', () => {
    beforeEach(() => {
      // Set milestone to SUBMITTED for revision tests
      mockMilestoneRepo.findById.mockResolvedValue({
        ...mockMilestone,
        status: 'SUBMITTED',
        escrowFunded: true,
      });
    });

    it('should request revision', async () => {
      const result = await service.requestRevision({
        milestoneId: 'm_test123',
        clientUserId: 'client-123',
        feedback: 'Please update the colors',
      });

      expect(result).toBeDefined();
    });
  });

  // ===========================================================================
  // autoApprove
  // ===========================================================================

  describe('autoApprove', () => {
    beforeEach(() => {
      // Set milestone to SUBMITTED for auto-approve tests
      mockMilestoneRepo.findById.mockResolvedValue({
        ...mockMilestone,
        status: 'SUBMITTED',
        escrowFunded: true,
        submittedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      });
    });

    it('should auto-approve milestone after 14 days', async () => {
      const result = await service.autoApprove(
        'm_test123',
        'Auto-approved after 14 days without review'
      );

      expect(result).toBeDefined();
    });
  });

  // ===========================================================================
  // approveAndRelease
  // ===========================================================================

  describe('approveAndRelease', () => {
    beforeEach(() => {
      // Set milestone to SUBMITTED for approve and release tests
      mockMilestoneRepo.findById.mockResolvedValue({
        ...mockMilestone,
        status: 'SUBMITTED',
        escrowFunded: true,
      });
    });

    it('should approve and release milestone funds', async () => {
      const result = await service.approveAndRelease({
        milestoneId: 'm_test123',
        clientUserId: 'client-123',
      });

      expect(result).toBeDefined();
      expect(result.milestone).toBeDefined();
      expect(result.transaction).toBeDefined();
    });
  });

  // ===========================================================================
  // getMilestonesByContract
  // ===========================================================================

  describe('getMilestonesByContract', () => {
    it('should get all milestones for a contract', async () => {
      const result = await service.getMilestonesByContract('contract-123', 'client-123');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
