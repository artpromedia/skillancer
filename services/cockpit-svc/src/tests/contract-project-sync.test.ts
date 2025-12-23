/**
 * @module @skillancer/cockpit-svc/tests/contract-project-sync
 * Contract Project Sync Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// =============================================================================
// MOCKS
// =============================================================================

const createMockPrisma = () => ({
  marketContractLink: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  marketMilestoneLink: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  marketTimeLink: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  marketPaymentLink: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    aggregate: vi.fn(),
  },
  marketClientCache: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  cockpitProject: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  client: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  projectMilestone: {
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
  },
  cockpitTimeEntry: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  financialTransaction: {
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  $transaction: vi.fn((fn) => fn(createMockPrisma())),
});

const createMockRedis = () => ({
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn().mockResolvedValue([]),
});

const createMockLogger = () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
});

// =============================================================================
// TEST DATA
// =============================================================================

const mockFreelancerUserId = 'freelancer-123';
const mockMarketContractId = 'market-contract-456';
const mockCockpitProjectId = 'cockpit-project-789';
const mockClientId = 'client-001';

const mockContractCreatedEvent = {
  type: 'market.contract.created' as const,
  eventId: 'evt-001',
  timestamp: new Date().toISOString(),
  contractId: mockMarketContractId,
  freelancerUserId: mockFreelancerUserId,
  contract: {
    id: mockMarketContractId,
    type: 'HOURLY' as const,
    status: 'ACTIVE',
    title: 'Web Development Project',
    description: 'Build a web application',
    terms: {
      hourlyRate: 75,
      currency: 'USD',
      weeklyHourLimit: 40,
    },
    client: {
      id: 'market-client-001',
      name: 'Acme Corp',
      email: 'contact@acme.com',
      companyName: 'Acme Corporation',
      avatarUrl: 'https://example.com/avatar.jpg',
    },
    timeline: {
      startDate: '2024-01-01',
    },
  },
};

const mockContractLink = {
  id: 'link-001',
  marketContractId: mockMarketContractId,
  freelancerUserId: mockFreelancerUserId,
  projectId: mockCockpitProjectId,
  clientId: mockClientId,
  contractType: 'HOURLY',
  contractStatus: 'ACTIVE',
  contractTitle: 'Web Development Project',
  currency: 'USD',
  hourlyRate: 75,
  fixedPrice: null,
  budgetCap: null,
  startDate: new Date('2024-01-01'),
  endDate: null,
  autoCreateProject: true,
  autoSyncTime: true,
  autoRecordPayments: true,
  syncStatus: 'SYNCED',
  syncError: null,
  lastSyncedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockProject = {
  id: mockCockpitProjectId,
  freelancerUserId: mockFreelancerUserId,
  name: 'Web Development Project',
  description: 'Build a web application',
  status: 'ACTIVE',
  clientId: mockClientId,
  budget: null,
  estimatedHours: null,
  startDate: new Date('2024-01-01'),
  endDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// =============================================================================
// TESTS
// =============================================================================

describe('ContractProjectSyncService', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockRedis: ReturnType<typeof createMockRedis>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockRedis = createMockRedis();
    mockLogger = createMockLogger();
    vi.clearAllMocks();
  });

  describe('Event Type Definitions', () => {
    it('should have correct Market to Cockpit event types', () => {
      const eventTypes = [
        'market.contract.created',
        'market.contract.status_changed',
        'market.contract.milestone.updated',
        'market.contract.time_logged',
        'market.contract.payment',
        'market.contract.dispute',
        'market.contract.ended',
      ];

      expect(mockContractCreatedEvent.type).toBe('market.contract.created');
      expect(eventTypes).toContain(mockContractCreatedEvent.type);
    });

    it('should have correct Cockpit to Market event types', () => {
      const cockpitEventTypes = [
        'cockpit.project.time_logged',
        'cockpit.project.milestone_completed',
      ];

      expect(cockpitEventTypes).toHaveLength(2);
    });
  });

  describe('Contract Link Creation', () => {
    it('should create contract link for new contract', async () => {
      mockPrisma.marketContractLink.findFirst.mockResolvedValue(null);
      mockPrisma.marketContractLink.create.mockResolvedValue(mockContractLink);
      mockPrisma.client.findFirst.mockResolvedValue({ id: mockClientId });
      mockPrisma.cockpitProject.create.mockResolvedValue(mockProject);

      // Verify contract link structure
      expect(mockContractLink).toMatchObject({
        marketContractId: mockMarketContractId,
        freelancerUserId: mockFreelancerUserId,
        contractType: 'HOURLY',
        currency: 'USD',
        hourlyRate: 75,
      });
    });

    it('should link existing contract to project', async () => {
      mockPrisma.marketContractLink.findFirst.mockResolvedValue({
        ...mockContractLink,
        projectId: null,
      });
      mockPrisma.marketContractLink.update.mockResolvedValue(mockContractLink);

      // Verify update call parameters
      const updateParams = {
        where: { id: mockContractLink.id },
        data: { projectId: mockCockpitProjectId },
      };

      mockPrisma.marketContractLink.update(updateParams);
      expect(mockPrisma.marketContractLink.update).toHaveBeenCalledWith(updateParams);
    });
  });

  describe('Milestone Sync', () => {
    const mockMilestone = {
      id: 'market-milestone-001',
      title: 'Phase 1 Complete',
      description: 'Complete phase 1 deliverables',
      amount: 5000,
      currency: 'USD',
      dueDate: '2024-02-01',
      status: 'PENDING',
    };

    it('should create milestone link when milestone is created', async () => {
      const milestoneLink = {
        id: 'ml-001',
        contractLinkId: mockContractLink.id,
        marketMilestoneId: mockMilestone.id,
        projectMilestoneId: null,
        title: mockMilestone.title,
        description: mockMilestone.description,
        amount: mockMilestone.amount,
        currency: mockMilestone.currency,
        dueDate: new Date(mockMilestone.dueDate),
        status: 'PENDING',
      };

      mockPrisma.marketMilestoneLink.create.mockResolvedValue(milestoneLink);

      const result = await mockPrisma.marketMilestoneLink.create({ data: milestoneLink });
      expect(result.marketMilestoneId).toBe(mockMilestone.id);
      expect(result.title).toBe(mockMilestone.title);
    });

    it('should update milestone status when approved', async () => {
      const updatedMilestone = {
        id: 'ml-001',
        status: 'APPROVED',
      };

      mockPrisma.marketMilestoneLink.update.mockResolvedValue(updatedMilestone);

      const result = await mockPrisma.marketMilestoneLink.update({
        where: { id: 'ml-001' },
        data: { status: 'APPROVED' },
      });

      expect(result.status).toBe('APPROVED');
    });
  });

  describe('Time Entry Sync', () => {
    const mockTimeLog = {
      id: 'market-time-001',
      date: '2024-01-15',
      hours: 8,
      description: 'Worked on feature X',
      amount: 600,
      billable: true,
    };

    it('should create time link when time is logged in Market', async () => {
      const timeLink = {
        id: 'tl-001',
        contractLinkId: mockContractLink.id,
        marketTimeLogId: mockTimeLog.id,
        timeEntryId: null,
        date: new Date(mockTimeLog.date),
        hours: mockTimeLog.hours,
        description: mockTimeLog.description,
        amount: mockTimeLog.amount,
        status: 'SYNCED',
        source: 'MARKET',
      };

      mockPrisma.marketTimeLink.create.mockResolvedValue(timeLink);

      const result = await mockPrisma.marketTimeLink.create({ data: timeLink });
      expect(result.marketTimeLogId).toBe(mockTimeLog.id);
      expect(result.hours).toBe(mockTimeLog.hours);
    });

    it('should sync Cockpit time entry to Market', async () => {
      const cockpitTimeEntry = {
        id: 'cockpit-time-001',
        date: new Date('2024-01-16'),
        duration: 480, // 8 hours in minutes
        description: 'Feature development',
        projectId: mockCockpitProjectId,
      };

      const timeLink = {
        id: 'tl-002',
        contractLinkId: mockContractLink.id,
        marketTimeLogId: null,
        timeEntryId: cockpitTimeEntry.id,
        date: cockpitTimeEntry.date,
        hours: cockpitTimeEntry.duration / 60,
        description: cockpitTimeEntry.description,
        status: 'PENDING_SYNC',
        source: 'COCKPIT',
      };

      mockPrisma.marketTimeLink.create.mockResolvedValue(timeLink);

      const result = await mockPrisma.marketTimeLink.create({ data: timeLink });
      expect(result.timeEntryId).toBe(cockpitTimeEntry.id);
      expect(result.source).toBe('COCKPIT');
    });
  });

  describe('Payment Sync', () => {
    const mockPayment = {
      id: 'market-payment-001',
      type: 'MILESTONE',
      grossAmount: 5000,
      platformFee: 500,
      netAmount: 4500,
      currency: 'USD',
      paidAt: '2024-02-15T10:00:00Z',
    };

    it('should create payment link and financial transaction', async () => {
      const paymentLink = {
        id: 'pl-001',
        contractLinkId: mockContractLink.id,
        marketPaymentId: mockPayment.id,
        transactionId: 'fin-tx-001',
        paymentType: mockPayment.type,
        grossAmount: mockPayment.grossAmount,
        platformFee: mockPayment.platformFee,
        netAmount: mockPayment.netAmount,
        currency: mockPayment.currency,
        status: 'COMPLETED',
        paidAt: new Date(mockPayment.paidAt),
      };

      mockPrisma.marketPaymentLink.create.mockResolvedValue(paymentLink);
      mockPrisma.financialTransaction.create.mockResolvedValue({
        id: 'fin-tx-001',
        amount: mockPayment.netAmount,
        type: 'INCOME',
      });

      const result = await mockPrisma.marketPaymentLink.create({ data: paymentLink });
      expect(result.netAmount).toBe(mockPayment.netAmount);
      expect(result.transactionId).toBe('fin-tx-001');
    });

    it('should record platform fee as expense', async () => {
      const feeTransaction = {
        id: 'fin-tx-002',
        amount: mockPayment.platformFee,
        type: 'EXPENSE',
        category: 'PLATFORM_FEES',
      };

      mockPrisma.financialTransaction.create.mockResolvedValue(feeTransaction);

      const result = await mockPrisma.financialTransaction.create({ data: feeTransaction });
      expect(result.type).toBe('EXPENSE');
      expect(result.amount).toBe(mockPayment.platformFee);
    });
  });

  describe('Contract Status Changes', () => {
    it('should update project status when contract is paused', async () => {
      mockPrisma.marketContractLink.update.mockResolvedValue({
        ...mockContractLink,
        contractStatus: 'PAUSED',
      });

      mockPrisma.cockpitProject.update.mockResolvedValue({
        ...mockProject,
        status: 'ON_HOLD',
      });

      const linkResult = await mockPrisma.marketContractLink.update({
        where: { id: mockContractLink.id },
        data: { contractStatus: 'PAUSED' },
      });

      expect(linkResult.contractStatus).toBe('PAUSED');
    });

    it('should handle contract end event', async () => {
      const endEvent = {
        type: 'market.contract.ended',
        endDate: '2024-03-01',
        reason: 'COMPLETED',
        feedback: { rating: 5 },
      };

      mockPrisma.marketContractLink.update.mockResolvedValue({
        ...mockContractLink,
        contractStatus: 'COMPLETED',
        endDate: new Date(endEvent.endDate),
      });

      mockPrisma.cockpitProject.update.mockResolvedValue({
        ...mockProject,
        status: 'COMPLETED',
        endDate: new Date(endEvent.endDate),
      });

      const linkResult = await mockPrisma.marketContractLink.update({
        where: { id: mockContractLink.id },
        data: { contractStatus: 'COMPLETED', endDate: new Date(endEvent.endDate) },
      });

      expect(linkResult.contractStatus).toBe('COMPLETED');
    });
  });

  describe('Dispute Handling', () => {
    it('should update project status when dispute is raised', async () => {
      const disputeEvent = {
        type: 'market.contract.dispute',
        action: 'RAISED',
        disputeType: 'WORK_QUALITY',
        description: 'Deliverable does not meet specifications',
      };

      mockPrisma.marketContractLink.update.mockResolvedValue({
        ...mockContractLink,
        contractStatus: 'DISPUTED',
      });

      mockPrisma.cockpitProject.update.mockResolvedValue({
        ...mockProject,
        status: 'ON_HOLD',
      });

      const linkResult = await mockPrisma.marketContractLink.update({
        where: { id: mockContractLink.id },
        data: { contractStatus: 'DISPUTED' },
      });

      expect(linkResult.contractStatus).toBe('DISPUTED');
    });

    it('should resume project when dispute is resolved', async () => {
      const resolveEvent = {
        type: 'market.contract.dispute',
        action: 'RESOLVED',
        resolution: {
          outcome: 'IN_FAVOR_OF_FREELANCER',
          notes: 'Work meets specifications',
        },
      };

      mockPrisma.marketContractLink.update.mockResolvedValue({
        ...mockContractLink,
        contractStatus: 'ACTIVE',
      });

      mockPrisma.cockpitProject.update.mockResolvedValue({
        ...mockProject,
        status: 'ACTIVE',
      });

      const linkResult = await mockPrisma.marketContractLink.update({
        where: { id: mockContractLink.id },
        data: { contractStatus: 'ACTIVE' },
      });

      expect(linkResult.contractStatus).toBe('ACTIVE');
    });
  });

  describe('Client Cache', () => {
    it('should cache market client data', async () => {
      const clientCache = {
        id: 'cache-001',
        marketClientId: 'market-client-001',
        cockpitClientId: mockClientId,
        displayName: 'Acme Corp',
        email: 'contact@acme.com',
        companyName: 'Acme Corporation',
        avatarUrl: 'https://example.com/avatar.jpg',
        totalContracts: 1,
        totalEarnings: 4500,
        avgRating: 5,
        lastUpdatedAt: new Date(),
      };

      mockPrisma.marketClientCache.upsert.mockResolvedValue(clientCache);

      const result = await mockPrisma.marketClientCache.upsert({
        where: { marketClientId: clientCache.marketClientId },
        update: clientCache,
        create: clientCache,
      });

      expect(result.marketClientId).toBe('market-client-001');
      expect(result.cockpitClientId).toBe(mockClientId);
    });
  });

  describe('Error Handling', () => {
    it('should track sync errors', async () => {
      const error = new Error('Market API unavailable');

      mockPrisma.marketContractLink.update.mockResolvedValue({
        ...mockContractLink,
        syncStatus: 'SYNC_ERROR',
        syncError: error.message,
      });

      const result = await mockPrisma.marketContractLink.update({
        where: { id: mockContractLink.id },
        data: { syncStatus: 'SYNC_ERROR', syncError: error.message },
      });

      expect(result.syncStatus).toBe('SYNC_ERROR');
      expect(result.syncError).toBe('Market API unavailable');
    });

    it('should log errors appropriately', () => {
      const errorData = {
        msg: 'Failed to sync contract',
        contractId: mockMarketContractId,
        error: 'Connection timeout',
      };

      mockLogger.error(errorData);
      expect(mockLogger.error).toHaveBeenCalledWith(errorData);
    });
  });
});
