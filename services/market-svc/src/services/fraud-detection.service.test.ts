/**
 * @module @skillancer/market-svc/services/fraud-detection.service.test
 * Unit tests for Fraud Detection Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { FraudDetectionService } from './fraud-detection.service.js';

import type { FraudCheckParams, FraudCheckResult } from './fraud-detection.service.js';

// =============================================================================
// MOCKS
// =============================================================================

const createMockPrisma = () => ({
  review: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    groupBy: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  contract: {
    count: vi.fn(),
  },
});

const createMockRedis = () => ({
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  smembers: vi.fn(),
  sadd: vi.fn(),
});

const createMockLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

// =============================================================================
// TESTS
// =============================================================================

describe('FraudDetectionService', () => {
  let service: FraudDetectionService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockRedis: ReturnType<typeof createMockRedis>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockRedis = createMockRedis();
    mockLogger = createMockLogger();

    service = new FraudDetectionService(mockPrisma as any, mockRedis as any, mockLogger as any);
  });

  describe('checkReview', () => {
    const baseParams: FraudCheckParams = {
      reviewerId: 'reviewer-1',
      revieweeId: 'reviewee-1',
      contractId: 'contract-1',
      rating: 5,
      feedback: 'This was an excellent experience working with this professional.',
    };

    // Helper to setup "clean" mocks for a normal review
    const setupNormalReviewMocks = () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.smembers.mockResolvedValue([]);
      mockPrisma.review.count.mockResolvedValue(2); // Low velocity
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'reviewer-1',
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days old
        email: 'reviewer@example.com',
      });
      mockPrisma.review.findMany.mockResolvedValue([]);
      mockPrisma.review.findFirst.mockResolvedValue(null);
      mockPrisma.review.groupBy.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(0);
    };

    it('should detect self-review (same reviewer and reviewee)', async () => {
      setupNormalReviewMocks();

      const selfReviewParams: FraudCheckParams = {
        ...baseParams,
        revieweeId: baseParams.reviewerId, // Same as reviewer
      };

      const result = await service.checkReview(selfReviewParams);

      expect(result.blocked).toBe(true);
      expect(result.checks).toContainEqual(
        expect.objectContaining({
          type: 'SELF_REVIEW',
          severity: 'CRITICAL',
        })
      );
    });

    it('should detect high velocity submissions', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.smembers.mockResolvedValue([]);
      // Return high count for velocity check
      mockPrisma.review.count.mockResolvedValue(20); // Above threshold
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'reviewer-1',
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        email: 'reviewer@example.com',
      });
      mockPrisma.review.findMany.mockResolvedValue([]);
      mockPrisma.review.findFirst.mockResolvedValue(null);
      mockPrisma.review.groupBy.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(0);

      const result = await service.checkReview(baseParams);

      expect(result.checks).toContainEqual(
        expect.objectContaining({
          type: 'HIGH_VELOCITY',
        })
      );
    });

    it('should flag self-review indicators with shared IPs', async () => {
      mockRedis.get.mockResolvedValue(null);
      // Shared IP between reviewer and reviewee
      mockRedis.smembers.mockImplementation((key: string) => {
        if (key.includes('reviewer-1')) {
          return Promise.resolve(['192.168.1.1', '10.0.0.1']);
        }
        if (key.includes('reviewee-1')) {
          return Promise.resolve(['192.168.1.1', '10.0.0.2']); // Shared 192.168.1.1
        }
        return Promise.resolve([]);
      });
      mockPrisma.review.count.mockResolvedValue(2);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'reviewer-1',
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        email: 'reviewer@example.com',
      });
      mockPrisma.review.findMany.mockResolvedValue([]);
      mockPrisma.review.findFirst.mockResolvedValue(null);
      mockPrisma.review.groupBy.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(0);

      const result = await service.checkReview(baseParams);

      expect(result.checks).toContainEqual(
        expect.objectContaining({
          type: 'SELF_REVIEW',
          severity: 'HIGH',
        })
      );
    });

    it('should handle reviews without feedback gracefully', async () => {
      setupNormalReviewMocks();

      const noFeedbackParams: FraudCheckParams = {
        reviewerId: 'reviewer-1',
        revieweeId: 'reviewee-1',
        contractId: 'contract-1',
        rating: 5,
        // No feedback
      };

      const result = await service.checkReview(noFeedbackParams);

      // Should not throw and should not check text-based patterns
      expect(result.blocked).toBeDefined();
      expect(result.checks).toBeDefined();
    });

    it('should flag new account bombing (new account leaving negative reviews)', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.smembers.mockResolvedValue([]);
      mockPrisma.review.count.mockResolvedValue(5); // Multiple negative reviews
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'reviewer-1',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // Only 3 days old
        email: 'reviewer@gmail.com',
      });
      mockPrisma.review.findMany.mockResolvedValue([]);
      mockPrisma.review.findFirst.mockResolvedValue(null);
      mockPrisma.review.groupBy.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(0);

      // Use negative rating to trigger the check
      const negativeReviewParams: FraudCheckParams = {
        ...baseParams,
        rating: 1, // Negative rating
      };

      const result = await service.checkReview(negativeReviewParams);

      expect(result.checks).toContainEqual(
        expect.objectContaining({
          type: 'NEW_ACCOUNT_BOMBING',
        })
      );
    });

    it('should detect reciprocal review patterns (both parties reviewed each other)', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.smembers.mockResolvedValue([]);
      mockPrisma.review.count.mockResolvedValue(10); // Higher count to trigger pattern
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'reviewer-1',
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        email: 'reviewer@gmail.com',
      });
      // Mock reviewer has done 8 reviews with 5 reciprocal
      mockPrisma.review.findMany.mockResolvedValue([
        { revieweeId: 'user-a', reviewerId: 'reviewer-1' },
        { revieweeId: 'user-b', reviewerId: 'reviewer-1' },
        { revieweeId: 'user-c', reviewerId: 'reviewer-1' },
        { revieweeId: 'user-d', reviewerId: 'reviewer-1' },
        { revieweeId: 'user-e', reviewerId: 'reviewer-1' },
        { revieweeId: 'user-f', reviewerId: 'reviewer-1' },
        { revieweeId: 'user-g', reviewerId: 'reviewer-1' },
        { revieweeId: 'user-h', reviewerId: 'reviewer-1' },
      ]);
      // Mock shows that reviewee has reviewed reviewer
      mockPrisma.review.findFirst.mockResolvedValue({
        id: 'reciprocal-review',
        reviewerId: 'reviewee-1',
        revieweeId: 'reviewer-1',
        overallRating: 5,
      });
      // Mock groupBy to return users who also reviewed each other (ring pattern)
      mockPrisma.review.groupBy.mockResolvedValue([
        { reviewerId: 'user-a', _count: { id: 3 } },
        { reviewerId: 'user-b', _count: { id: 3 } },
        { reviewerId: 'user-c', _count: { id: 3 } },
      ]);
      mockPrisma.contract.count.mockResolvedValue(0);

      const result = await service.checkReview(baseParams);

      expect(result.checks).toContainEqual(
        expect.objectContaining({
          type: 'REVIEW_RING',
        })
      );
    });

    it('should detect duplicate content across reviews', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.smembers.mockResolvedValue([]);
      mockPrisma.review.count.mockResolvedValue(2);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'reviewer-1',
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        email: 'reviewer@gmail.com', // Different domain
      });
      // Previous reviews with similar content
      mockPrisma.review.findMany.mockResolvedValue([
        {
          id: 'prev-review-1',
          content: 'This was an excellent experience working with this professional.',
          reviewerId: 'reviewer-1',
        },
      ]);
      mockPrisma.review.findFirst.mockResolvedValue(null);
      mockPrisma.review.groupBy.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(0);

      const result = await service.checkReview(baseParams);

      expect(result.checks).toContainEqual(
        expect.objectContaining({
          type: 'DUPLICATE_CONTENT',
        })
      );
    });
  });

  describe('result aggregation', () => {
    it('should correctly determine if result blocks the review', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.smembers.mockResolvedValue([]);
      mockPrisma.review.count.mockResolvedValue(2);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'reviewer-1',
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        email: 'reviewer@example.com',
      });
      mockPrisma.review.findMany.mockResolvedValue([]);
      mockPrisma.review.findFirst.mockResolvedValue(null);
      mockPrisma.review.groupBy.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(0);

      // Self-review should block
      const selfReviewParams: FraudCheckParams = {
        reviewerId: 'user-1',
        revieweeId: 'user-1',
        contractId: 'contract-1',
        rating: 5,
      };

      const result = await service.checkReview(selfReviewParams);

      expect(result.blocked).toBe(true);
      expect(result.reason).toBeDefined();
    });
  });

  describe('sentiment analysis', () => {
    const setupMocksForSentimentTest = () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.smembers.mockResolvedValue([]);
      mockPrisma.review.count.mockResolvedValue(2);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'reviewer-1',
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        email: 'reviewer@example.com',
      });
      mockPrisma.review.findMany.mockResolvedValue([]);
      mockPrisma.review.findFirst.mockResolvedValue(null);
      mockPrisma.review.groupBy.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(0);
    };

    it('should detect mismatch between low rating and positive words', async () => {
      setupMocksForSentimentTest();

      const mismatchParams: FraudCheckParams = {
        reviewerId: 'reviewer-1',
        revieweeId: 'reviewee-1',
        contractId: 'contract-1',
        rating: 1, // Low rating
        feedback:
          'Excellent amazing wonderful fantastic great outstanding superb brilliant perfect incredible!', // Very positive words
      };

      const result = await service.checkReview(mismatchParams);

      expect(result.checks).toContainEqual(
        expect.objectContaining({
          type: 'SENTIMENT_MISMATCH',
        })
      );
    });

    it('should detect mismatch between high rating and negative words', async () => {
      setupMocksForSentimentTest();

      const mismatchParams: FraudCheckParams = {
        reviewerId: 'reviewer-1',
        revieweeId: 'reviewee-1',
        contractId: 'contract-1',
        rating: 5, // High rating
        feedback: 'Terrible horrible awful bad disappointed waste scam fraud never again!', // Very negative words
      };

      const result = await service.checkReview(mismatchParams);

      expect(result.checks).toContainEqual(
        expect.objectContaining({
          type: 'SENTIMENT_MISMATCH',
        })
      );
    });
  });
});
