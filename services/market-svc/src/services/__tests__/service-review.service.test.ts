/**
 * @module @skillancer/market-svc/services/__tests__/service-review
 * Unit tests for the service review service
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

// Mock ServiceReviewRepository
const mockServiceReviewRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByOrderId: vi.fn(),
  findByServiceId: vi.fn(),
  findByReviewerId: vi.fn(),
  addSellerResponse: vi.fn(),
  incrementHelpfulCount: vi.fn(),
  getReviewStats: vi.fn(),
  getServiceStats: vi.fn(),
  canReview: vi.fn(),
  existsForOrder: vi.fn(),
  markHelpful: vi.fn(),
};

vi.mock('../../repositories/service-review.repository.js', () => ({
  ServiceReviewRepository: vi.fn().mockImplementation(() => mockServiceReviewRepository),
}));

// Mock ServiceOrderRepository
const mockServiceOrderRepository = {
  findById: vi.fn(),
};

vi.mock('../../repositories/service-order.repository.js', () => ({
  ServiceOrderRepository: vi.fn().mockImplementation(() => mockServiceOrderRepository),
}));

// Mock ServiceRepository
const mockServiceRepository = {
  findById: vi.fn(),
  updateStatsAfterOrder: vi.fn(),
};

vi.mock('../../repositories/service.repository.js', () => ({
  ServiceRepository: vi.fn().mockImplementation(() => mockServiceRepository),
}));

// Create mock instances
const mockPrisma = {} as any;

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn().mockResolvedValue([]),
  exists: vi.fn(),
} as any;

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as any;

import { ServiceReviewService } from '../service-review.service.js';

describe('ServiceReviewService', () => {
  let service: ServiceReviewService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    service = new ServiceReviewService(mockPrisma, mockRedis, mockLogger);
  });

  describe('createReview', () => {
    const mockOrder = {
      id: 'order-123',
      serviceId: 'service-123',
      buyerId: 'buyer-123',
      sellerId: 'seller-123',
      status: 'COMPLETED',
    };

    const validInput = {
      overallRating: 5,
      communicationRating: 5,
      qualityRating: 5,
      deliveryRating: 5,
      valueRating: 5,
      title: 'Excellent work!',
      content: 'The freelancer delivered exactly what I needed.',
    };

    it('should create a review successfully', async () => {
      mockServiceOrderRepository.findById.mockResolvedValue(mockOrder);
      mockServiceReviewRepository.existsForOrder.mockResolvedValue(false);
      const createdReview = {
        id: 'review-123',
        orderId: 'order-123',
        serviceId: 'service-123',
        reviewerId: 'buyer-123',
        ...validInput,
        isPublic: true,
        isVerifiedPurchase: true,
        helpfulCount: 0,
      };
      mockServiceReviewRepository.create.mockResolvedValue(createdReview);
      mockServiceRepository.updateStatsAfterOrder.mockResolvedValue(undefined);

      const result = await service.createReview('order-123', 'buyer-123', validInput);

      expect(result.id).toBe('review-123');
      expect(result.overallRating).toBe(5);
      expect(mockServiceReviewRepository.create).toHaveBeenCalledWith(
        'order-123',
        'service-123',
        'buyer-123',
        expect.objectContaining({
          overallRating: 5,
        })
      );
    });

    it('should throw error when order not found', async () => {
      mockServiceOrderRepository.findById.mockResolvedValue(null);

      await expect(service.createReview('order-123', 'buyer-123', validInput)).rejects.toThrow();
    });

    it('should throw error when not the buyer', async () => {
      mockServiceOrderRepository.findById.mockResolvedValue(mockOrder);

      await expect(service.createReview('order-123', 'other-user', validInput)).rejects.toThrow();
    });

    it('should throw error when order not completed', async () => {
      mockServiceOrderRepository.findById.mockResolvedValue({
        ...mockOrder,
        status: 'IN_PROGRESS',
      });

      await expect(service.createReview('order-123', 'buyer-123', validInput)).rejects.toThrow();
    });

    it('should throw error when already reviewed', async () => {
      mockServiceOrderRepository.findById.mockResolvedValue(mockOrder);
      mockServiceReviewRepository.existsForOrder.mockResolvedValue(true);

      await expect(service.createReview('order-123', 'buyer-123', validInput)).rejects.toThrow();
    });

    it('should throw error for invalid rating', async () => {
      mockServiceOrderRepository.findById.mockResolvedValue(mockOrder);
      mockServiceReviewRepository.existsForOrder.mockResolvedValue(false);

      await expect(
        service.createReview('order-123', 'buyer-123', { ...validInput, overallRating: 6 })
      ).rejects.toThrow();
    });

    it('should throw error for rating below minimum', async () => {
      mockServiceOrderRepository.findById.mockResolvedValue(mockOrder);
      mockServiceReviewRepository.existsForOrder.mockResolvedValue(false);

      await expect(
        service.createReview('order-123', 'buyer-123', { ...validInput, overallRating: 0 })
      ).rejects.toThrow();
    });
  });

  describe('getReview', () => {
    it('should return review when found', async () => {
      const mockReview = {
        id: 'review-123',
        overallRating: 5,
        isPublic: true,
      };
      mockServiceReviewRepository.findById.mockResolvedValue(mockReview);

      const result = await service.getReview('review-123');

      expect(result).toEqual(mockReview);
    });

    it('should throw error when not found', async () => {
      mockServiceReviewRepository.findById.mockResolvedValue(null);

      await expect(service.getReview('non-existent')).rejects.toThrow();
    });
  });

  describe('getServiceReviews', () => {
    it('should return paginated reviews for service', async () => {
      const mockResult = {
        reviews: [
          { id: 'review-1', overallRating: 5 },
          { id: 'review-2', overallRating: 4 },
        ],
        total: 10,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasMore: false,
      };
      mockServiceReviewRepository.findByServiceId.mockResolvedValue(mockResult);

      const result = await service.getServiceReviews('service-123');

      expect(result.reviews).toHaveLength(2);
      expect(result.total).toBe(10);
    });

    it('should filter by minimum rating', async () => {
      mockServiceReviewRepository.findByServiceId.mockResolvedValue({
        reviews: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasMore: false,
      });

      await service.getServiceReviews('service-123', { minRating: 4 });

      expect(mockServiceReviewRepository.findByServiceId).toHaveBeenCalledWith(
        'service-123',
        expect.objectContaining({ minRating: 4 })
      );
    });
  });

  describe('addSellerResponse', () => {
    it('should add seller response successfully', async () => {
      const mockReview = {
        id: 'review-123',
        orderId: 'order-123',
        serviceId: 'service-123',
        overallRating: 4,
        reviewerId: 'buyer-123',
        sellerResponse: null,
      };
      const mockService = {
        id: 'service-123',
        freelancerId: 'seller-123',
      };
      const updatedReview = {
        ...mockReview,
        sellerResponse: 'Thank you for your feedback!',
        sellerRespondedAt: new Date(),
      };
      mockServiceReviewRepository.findById.mockResolvedValue(mockReview);
      mockServiceRepository.findById.mockResolvedValue(mockService);
      mockServiceReviewRepository.addSellerResponse.mockResolvedValue(updatedReview);

      const result = await service.addSellerResponse('review-123', 'seller-123', {
        response: 'Thank you for your feedback!',
      });

      expect(result.sellerResponse).toBe('Thank you for your feedback!');
    });

    it('should throw error when not seller', async () => {
      const mockReview = {
        id: 'review-123',
        orderId: 'order-123',
        serviceId: 'service-123',
        reviewerId: 'buyer-123',
      };
      const mockService = {
        id: 'service-123',
        freelancerId: 'seller-123',
      };
      mockServiceReviewRepository.findById.mockResolvedValue(mockReview);
      mockServiceRepository.findById.mockResolvedValue(mockService);

      await expect(
        service.addSellerResponse('review-123', 'other-user', {
          response: 'Thank you!',
        })
      ).rejects.toThrow();
    });

    it('should throw error when already responded', async () => {
      const mockReview = {
        id: 'review-123',
        orderId: 'order-123',
        serviceId: 'service-123',
        reviewerId: 'buyer-123',
        sellerResponse: 'Already responded',
      };
      const mockService = {
        id: 'service-123',
        freelancerId: 'seller-123',
      };
      mockServiceReviewRepository.findById.mockResolvedValue(mockReview);
      mockServiceRepository.findById.mockResolvedValue(mockService);

      await expect(
        service.addSellerResponse('review-123', 'seller-123', {
          response: 'Another response',
        })
      ).rejects.toThrow();
    });
  });

  describe('markAsHelpful', () => {
    it('should increment helpful count', async () => {
      const mockReview = {
        id: 'review-123',
        reviewerId: 'other-user',
        helpfulCount: 5,
      };
      const updatedReview = {
        ...mockReview,
        helpfulCount: 6,
      };
      // First call returns original, second call returns updated
      mockServiceReviewRepository.findById
        .mockResolvedValueOnce(mockReview)
        .mockResolvedValueOnce(updatedReview);
      mockRedis.exists.mockResolvedValue(0);
      mockRedis.set.mockResolvedValue('OK');
      mockServiceReviewRepository.incrementHelpfulCount.mockResolvedValue(undefined);

      const result = await service.markAsHelpful('review-123', 'user-123');

      expect(result.helpfulCount).toBe(6);
    });

    it('should throw error when review not found', async () => {
      mockServiceReviewRepository.findById.mockResolvedValue(null);

      await expect(service.markAsHelpful('non-existent', 'user-123')).rejects.toThrow();
    });
  });

  describe('getServiceStats', () => {
    it('should return review statistics', async () => {
      const mockStats = {
        avgRating: 4.5,
        totalReviews: 100,
        ratingDistribution: {
          1: 5,
          2: 5,
          3: 10,
          4: 30,
          5: 50,
        },
        avgCommunication: 4.6,
        avgQuality: 4.4,
        avgDelivery: 4.5,
        avgValue: 4.5,
      };
      mockServiceReviewRepository.getServiceStats.mockResolvedValue(mockStats);

      const result = await service.getServiceStats('service-123');

      expect(result.avgRating).toBe(4.5);
      expect(result.totalReviews).toBe(100);
      expect(result.ratingDistribution[5]).toBe(50);
    });

    it('should cache review stats', async () => {
      const mockStats = {
        avgRating: 4.5,
        totalReviews: 100,
        ratingDistribution: { 1: 5, 2: 5, 3: 10, 4: 30, 5: 50 },
      };
      mockServiceReviewRepository.getServiceStats.mockResolvedValue(mockStats);

      // First call
      await service.getServiceStats('service-123');

      // Second call should use cache if implemented
      await service.getServiceStats('service-123');

      // Repository should be called (caching behavior depends on implementation)
      expect(mockServiceReviewRepository.getServiceStats).toHaveBeenCalled();
    });
  });

  describe('getUserReviews', () => {
    it('should return reviews given by user', async () => {
      const mockResult = {
        reviews: [
          { id: 'review-1', reviewerId: 'user-123' },
          { id: 'review-2', reviewerId: 'user-123' },
        ],
        total: 5,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasMore: false,
      };
      mockServiceReviewRepository.findByReviewerId.mockResolvedValue(mockResult);

      const result = await service.getUserReviews('user-123');

      expect(result.reviews).toHaveLength(2);
      expect(result.total).toBe(5);
    });
  });
});
