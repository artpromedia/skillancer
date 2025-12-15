/**
 * @module @skillancer/billing-svc/services/__tests__/time-log
 * Unit tests for the time log service
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
    fundEscrow: vi.fn().mockResolvedValue({
      transaction: { id: 'et_fund' },
    }),
    releaseEscrow: vi.fn().mockResolvedValue({
      transaction: { id: 'et_release' },
    }),
  })),
}));

vi.mock('../fee-calculator.service.js', () => ({
  getFeeCalculatorService: vi.fn(() => ({
    calculateTimeLogBilling: vi.fn().mockReturnValue({
      grossAmount: 200,
      platformFee: 20,
      netAmount: 180,
    }),
    calculateHourlyBilling: vi.fn().mockReturnValue({
      grossAmount: 200,
      platformFee: 20,
      netAmount: 180,
    }),
  })),
}));

vi.mock('../repositories/time-log.repository.js', () => ({
  getTimeLogRepository: vi.fn(() => ({
    findById: vi.fn().mockResolvedValue({
      id: 'tl_test123',
      contractId: 'contract-123',
      description: 'Development work',
      startTime: new Date('2025-01-01T09:00:00Z'),
      endTime: new Date('2025-01-01T11:00:00Z'),
      duration: 120,
      hourlyRate: { toNumber: () => 100 },
      amount: { toNumber: () => 200 },
      status: 'PENDING',
      isVerified: false,
      skillpodSessionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      contract: {
        id: 'contract-123',
        clientId: 'client-123',
        freelancerId: 'freelancer-123',
        title: 'Test Contract',
        status: 'ACTIVE',
        platformFeePercent: { toNumber: () => 10 },
      },
    }),
    create: vi.fn().mockResolvedValue({
      id: 'tl_test123',
      contractId: 'contract-123',
      description: 'Development work',
      duration: 120,
      hourlyRate: 100,
      amount: 200,
      status: 'PENDING',
    }),
    update: vi.fn().mockResolvedValue({}),
    findByContractId: vi.fn().mockResolvedValue([]),
    findPendingByContractId: vi.fn().mockResolvedValue([]),
    findApprovedByContractId: vi.fn().mockResolvedValue([
      {
        id: 'tl_approved1',
        duration: 60,
        hourlyRate: { toNumber: () => 100 },
        amount: { toNumber: () => 100 },
        status: 'APPROVED',
      },
    ]),
    bulkUpdate: vi.fn().mockResolvedValue({}),
    getSummary: vi.fn().mockResolvedValue({
      contractId: 'contract-123',
      totalHours: 4,
      totalAmount: 400,
      pendingHours: 2,
      pendingAmount: 200,
      approvedHours: 1,
      approvedAmount: 100,
      billedHours: 1,
      billedAmount: 100,
      logs: [],
    }),
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
      contractType: 'HOURLY',
      hourlyRate: { toNumber: () => 100 },
      totalAmount: 1000,
      platformFeePercent: { toNumber: () => 10 },
      secureMode: false,
      currency: 'USD',
    }),
    update: vi.fn().mockResolvedValue({}),
  })),
  getEscrowRepository: vi.fn(() => ({})),
  getMilestoneRepository: vi.fn(() => ({})),
}));

import { getTimeLogService, type TimeLogService } from '../time-log.service.js';

describe('TimeLogService', () => {
  let service: TimeLogService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = getTimeLogService();
  });

  // ===========================================================================
  // createTimeLog
  // ===========================================================================

  describe('createTimeLog', () => {
    it('should create a time log entry', async () => {
      const result = await service.createTimeLog(
        {
          contractId: 'contract-123',
          description: 'Development work on feature X',
          startTime: new Date('2025-01-01T09:00:00Z'),
          endTime: new Date('2025-01-01T11:00:00Z'),
          hourlyRate: 100,
        },
        'freelancer-123'
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('tl_test123');
    });

    it('should create time log with duration', async () => {
      const result = await service.createTimeLog(
        {
          contractId: 'contract-123',
          description: 'Meeting with client',
          startTime: new Date('2025-01-01T14:00:00Z'),
          duration: 60,
          hourlyRate: 100,
        },
        'freelancer-123'
      );

      expect(result).toBeDefined();
    });

    it('should create verified time log from SkillPod', async () => {
      const result = await service.createTimeLog(
        {
          contractId: 'contract-123',
          description: 'Verified work session',
          startTime: new Date('2025-01-01T09:00:00Z'),
          endTime: new Date('2025-01-01T11:00:00Z'),
          hourlyRate: 100,
          skillpodSessionId: 'sp_session_123',
          isVerified: true,
        },
        'freelancer-123'
      );

      expect(result).toBeDefined();
    });
  });

  // ===========================================================================
  // approveTimeLog
  // ===========================================================================

  describe('approveTimeLog', () => {
    it('should approve a time log', async () => {
      const result = await service.approveTimeLog({
        timeLogId: 'tl_test123',
        clientUserId: 'client-123',
      });

      expect(result).toBeDefined();
    });
  });

  // ===========================================================================
  // rejectTimeLog
  // ===========================================================================

  describe('rejectTimeLog', () => {
    it('should reject a time log', async () => {
      const result = await service.rejectTimeLog({
        timeLogId: 'tl_test123',
        clientUserId: 'client-123',
        reason: 'Hours do not match agreed upon work',
      });

      expect(result).toBeDefined();
    });
  });

  // ===========================================================================
  // getTimeLogSummary
  // ===========================================================================

  describe('getTimeLogSummary', () => {
    it('should get time log summary for a contract', async () => {
      const result = await service.getTimeLogSummary('contract-123', 'client-123');

      expect(result).toBeDefined();
    });
  });

  // ===========================================================================
  // getTimeLogsByContract
  // ===========================================================================

  describe('getTimeLogsByContract', () => {
    it('should get all time logs for a contract', async () => {
      const result = await service.getTimeLogsByContract('contract-123', 'client-123');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ===========================================================================
  // bulkApproveTimeLogs
  // ===========================================================================

  describe('bulkApproveTimeLogs', () => {
    it('should bulk approve multiple time logs', async () => {
      const result = await service.bulkApproveTimeLogs(
        ['tl_test1', 'tl_test2', 'tl_test3'],
        'client-123'
      );

      expect(result).toBeDefined();
    });
  });

  // ===========================================================================
  // billApprovedTime
  // ===========================================================================

  describe('billApprovedTime', () => {
    it('should bill all approved time logs for a contract', async () => {
      const result = await service.billApprovedTime('contract-123', 'client-123');

      expect(result).toBeDefined();
    });
  });
});
