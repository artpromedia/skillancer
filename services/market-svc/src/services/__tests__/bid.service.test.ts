/**
 * @module @skillancer/market-svc/services/__tests__/bid
 * Unit tests for the bid service
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

// Mock BidQualityService
vi.mock('../bid-quality.service.js', () => ({
  BidQualityService: vi.fn().mockImplementation(() => ({
    calculateQualityScore: vi.fn().mockResolvedValue({
      score: 75,
      factors: { coverLetterLength: 300, rateWithinBudget: true },
      isSpam: false,
    }),
  })),
}));

// Mock ProjectService
vi.mock('../project.service.js', () => ({
  ProjectService: vi.fn().mockImplementation(() => ({
    validateProjectForBidding: vi.fn().mockResolvedValue({
      id: 'project-123',
      clientId: 'client-123',
      title: 'Test Project',
      status: 'PUBLISHED',
      budgetMin: 1000,
      budgetMax: 5000,
    }),
    getProject: vi.fn().mockResolvedValue({
      id: 'project-123',
      clientId: 'client-123',
      title: 'Test Project',
      status: 'PUBLISHED',
      budgetMin: 1000,
      budgetMax: 5000,
    }),
  })),
}));

// Mock BidRepository
const mockBidRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByJobAndFreelancer: vi.fn(),
  findByProjectId: vi.fn(),
  findByFreelancerId: vi.fn(),
  update: vi.fn(),
  updateStatus: vi.fn(),
  markAsViewed: vi.fn(),
  shortlist: vi.fn(),
  reject: vi.fn(),
  accept: vi.fn(),
  withdraw: vi.fn(),
  exists: vi.fn(),
  countActiveByFreelancer: vi.fn(),
  getProjectBidStats: vi.fn(),
  getComparisonData: vi.fn(),
};

vi.mock('../../repositories/bid.repository.js', () => ({
  BidRepository: vi.fn().mockImplementation(() => mockBidRepository),
}));

// Create mock instances
const mockPrisma = {
  bid: {
    findMany: vi.fn(),
  },
  bidMessage: {
    create: vi.fn(),
  },
} as any;

const mockRedis = {
  lpush: vi.fn(),
  get: vi.fn(),
  setex: vi.fn(),
} as any;

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as any;

import { BidService } from '../bid.service.js';
import { BiddingError, BiddingErrorCode } from '../../errors/bidding.errors.js';

describe('BidService', () => {
  let service: BidService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.lpush.mockResolvedValue(1);
    service = new BidService(mockPrisma, mockRedis, mockLogger);
  });

  describe('submitBid', () => {
    const validInput = {
      jobId: 'project-123',
      coverLetter:
        'I am very interested in this project and have relevant experience to deliver high-quality results.',
      proposedRate: 2000,
      rateType: 'FIXED' as const,
      deliveryDays: 14,
    };

    it('should submit a bid successfully', async () => {
      mockBidRepository.exists.mockResolvedValue(false);
      mockBidRepository.countActiveByFreelancer.mockResolvedValue(5);
      mockBidRepository.create.mockResolvedValue({
        id: 'bid-123',
        freelancerId: 'freelancer-123',
        status: 'PENDING',
        jobId: validInput.jobId,
        coverLetter: validInput.coverLetter,
        proposedRate: validInput.proposedRate,
        rateType: validInput.rateType,
        deliveryDays: validInput.deliveryDays,
        freelancer: {
          displayName: 'John Doe',
        },
      });

      const result = await service.submitBid('freelancer-123', validInput);

      expect(result.id).toBe('bid-123');
      expect(mockBidRepository.create).toHaveBeenCalled();
      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'bid:notifications',
        expect.stringContaining('BID_RECEIVED')
      );
    });

    it('should reject duplicate bids', async () => {
      mockBidRepository.exists.mockResolvedValue(true);

      await expect(service.submitBid('freelancer-123', validInput)).rejects.toThrow(BiddingError);
      await expect(service.submitBid('freelancer-123', validInput)).rejects.toMatchObject({
        code: BiddingErrorCode.BID_ALREADY_EXISTS,
      });
    });

    it('should enforce bid limit', async () => {
      mockBidRepository.exists.mockResolvedValue(false);
      mockBidRepository.countActiveByFreelancer.mockResolvedValue(50);

      await expect(service.submitBid('freelancer-123', validInput)).rejects.toThrow(BiddingError);
      await expect(service.submitBid('freelancer-123', validInput)).rejects.toMatchObject({
        code: BiddingErrorCode.BID_LIMIT_REACHED,
      });
    });
  });

  describe('getBid', () => {
    it('should return bid for authorized user', async () => {
      mockBidRepository.findById.mockResolvedValue({
        id: 'bid-123',
        jobId: 'project-123',
        freelancerId: 'freelancer-123',
        status: 'PENDING',
        job: {
          clientId: 'client-123',
        },
      });

      const result = await service.getBid('bid-123', 'freelancer-123');

      expect(result.id).toBe('bid-123');
    });

    it('should throw error for unauthorized user', async () => {
      mockBidRepository.findById.mockResolvedValue({
        id: 'bid-123',
        jobId: 'project-123',
        freelancerId: 'freelancer-123',
        job: {
          clientId: 'client-123',
        },
      });

      await expect(service.getBid('bid-123', 'other-user')).rejects.toThrow(BiddingError);
    });

    it('should throw error for non-existent bid', async () => {
      mockBidRepository.findById.mockResolvedValue(null);

      await expect(service.getBid('bid-123', 'freelancer-123')).rejects.toMatchObject({
        code: BiddingErrorCode.BID_NOT_FOUND,
      });
    });

    it('should mark bid as viewed when client views it', async () => {
      mockBidRepository.findById.mockResolvedValue({
        id: 'bid-123',
        jobId: 'project-123',
        freelancerId: 'freelancer-123',
        viewedByClientAt: null,
        job: {
          clientId: 'client-123',
        },
      });

      await service.getBid('bid-123', 'client-123');

      expect(mockBidRepository.markAsViewed).toHaveBeenCalledWith('bid-123');
    });
  });

  describe('updateBid', () => {
    it('should update pending bid', async () => {
      mockBidRepository.findById.mockResolvedValue({
        id: 'bid-123',
        jobId: 'project-123',
        freelancerId: 'freelancer-123',
        status: 'PENDING',
        coverLetter: 'Old cover letter',
        proposedRate: { toNumber: () => 1000 },
      });
      mockBidRepository.update.mockResolvedValue({
        id: 'bid-123',
        coverLetter: 'Updated cover letter',
      });

      await service.updateBid('bid-123', 'freelancer-123', {
        coverLetter: 'Updated cover letter that shows my continued interest in this project.',
      });

      expect(mockBidRepository.update).toHaveBeenCalled();
    });

    it('should reject update from non-owner', async () => {
      mockBidRepository.findById.mockResolvedValue({
        id: 'bid-123',
        freelancerId: 'freelancer-123',
        status: 'PENDING',
      });

      await expect(
        service.updateBid('bid-123', 'other-user', { coverLetter: 'New letter' })
      ).rejects.toMatchObject({
        code: BiddingErrorCode.NOT_BID_OWNER,
      });
    });

    it('should reject update of non-pending bid', async () => {
      mockBidRepository.findById.mockResolvedValue({
        id: 'bid-123',
        freelancerId: 'freelancer-123',
        status: 'SHORTLISTED',
      });

      await expect(
        service.updateBid('bid-123', 'freelancer-123', { coverLetter: 'New letter' })
      ).rejects.toMatchObject({
        code: BiddingErrorCode.INVALID_BID_STATUS,
      });
    });
  });

  describe('withdrawBid', () => {
    it('should withdraw pending bid', async () => {
      mockBidRepository.findById.mockResolvedValue({
        id: 'bid-123',
        freelancerId: 'freelancer-123',
        status: 'PENDING',
      });

      await service.withdrawBid('bid-123', 'freelancer-123');

      expect(mockBidRepository.withdraw).toHaveBeenCalledWith('bid-123');
    });

    it('should reject withdrawal of accepted bid', async () => {
      mockBidRepository.findById.mockResolvedValue({
        id: 'bid-123',
        freelancerId: 'freelancer-123',
        status: 'ACCEPTED',
      });

      await expect(service.withdrawBid('bid-123', 'freelancer-123')).rejects.toMatchObject({
        code: BiddingErrorCode.INVALID_BID_STATUS,
      });
    });
  });

  describe('shortlistBid', () => {
    it('should shortlist pending bid', async () => {
      mockBidRepository.findById.mockResolvedValue({
        id: 'bid-123',
        jobId: 'project-123',
        freelancerId: 'freelancer-123',
        status: 'PENDING',
        job: {
          clientId: 'client-123',
          title: 'Test Project',
        },
      });

      await service.shortlistBid({ bidId: 'bid-123' }, 'client-123');

      expect(mockBidRepository.shortlist).toHaveBeenCalledWith('bid-123');
      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'bid:notifications',
        expect.stringContaining('BID_SHORTLISTED')
      );
    });

    it('should reject shortlisting by non-owner', async () => {
      mockBidRepository.findById.mockResolvedValue({
        id: 'bid-123',
        status: 'PENDING',
        job: {
          clientId: 'client-123',
        },
      });

      await expect(service.shortlistBid({ bidId: 'bid-123' }, 'other-user')).rejects.toMatchObject({
        code: BiddingErrorCode.NOT_PROJECT_OWNER,
      });
    });
  });

  describe('acceptBid', () => {
    it('should accept bid and reject others', async () => {
      mockBidRepository.findById.mockResolvedValue({
        id: 'bid-123',
        jobId: 'project-123',
        freelancerId: 'freelancer-123',
        status: 'SHORTLISTED',
        job: {
          clientId: 'client-123',
          title: 'Test Project',
        },
      });

      mockPrisma.bid.findMany.mockResolvedValue([
        { id: 'bid-456', freelancerId: 'freelancer-456' },
        { id: 'bid-789', freelancerId: 'freelancer-789' },
      ]);

      await service.acceptBid({ bidId: 'bid-123' }, 'client-123');

      expect(mockBidRepository.accept).toHaveBeenCalledWith('bid-123');
      expect(mockBidRepository.reject).toHaveBeenCalledTimes(2);
    });
  });

  describe('getProjectBidStats', () => {
    it('should return bid statistics', async () => {
      mockBidRepository.getProjectBidStats.mockResolvedValue({
        totalBids: 10,
        pendingBids: 5,
        shortlistedBids: 3,
        acceptedBids: 1,
        rejectedBids: 1,
        averageRate: 2500,
        medianRate: 2300,
        averageDeliveryDays: 14,
      });

      const result = await service.getProjectBidStats('project-123', 'client-123');

      expect(result.totalBids).toBe(10);
      expect(mockBidRepository.getProjectBidStats).toHaveBeenCalledWith('project-123');
    });
  });
});
