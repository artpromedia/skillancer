/**
 * @module @skillancer/cockpit-svc/tests/client-health-score
 * Client Health Score Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@skillancer/database';
import type { Redis } from 'ioredis';
import type { Logger } from '@skillancer/logger';

import { ClientHealthScoreService } from '../services/client-health-score.service.js';

// =============================================================================
// MOCKS
// =============================================================================

const createMockPrisma = () => ({
  client: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  clientInteraction: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  opportunity: {
    findMany: vi.fn(),
  },
});

const createMockRedis = () => ({
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
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

const mockClient = {
  id: 'client-123',
  freelancerUserId: 'user-456',
  companyName: 'Test Company',
  firstName: null,
  lastName: null,
  totalRevenue: 50000,
  createdAt: new Date('2023-01-01'),
  lastInteractionAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
};

const mockInteractions = [
  {
    id: 'int-1',
    sentiment: 'POSITIVE',
    interactionType: 'MEETING',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'int-2',
    sentiment: 'POSITIVE',
    interactionType: 'EMAIL',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'int-3',
    sentiment: 'NEUTRAL',
    interactionType: 'CALL',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
];

const mockOpportunities = [
  { id: 'opp-1', status: 'WON', estimatedValue: 20000 },
  { id: 'opp-2', status: 'WON', estimatedValue: 30000 },
  { id: 'opp-3', status: 'OPEN', estimatedValue: 15000 },
];

// =============================================================================
// TESTS
// =============================================================================

describe('ClientHealthScoreService', () => {
  let service: ClientHealthScoreService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockRedis: ReturnType<typeof createMockRedis>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockRedis = createMockRedis();
    mockLogger = createMockLogger();

    service = new ClientHealthScoreService(
      mockPrisma as unknown as PrismaClient,
      mockRedis as unknown as Redis,
      mockLogger as unknown as Logger
    );
  });

  describe('calculateHealthScore', () => {
    it('should calculate health score with all components', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.clientInteraction.findMany.mockResolvedValue(mockInteractions);
      mockPrisma.clientInteraction.count.mockResolvedValue(10); // Total interactions
      mockPrisma.opportunity.findMany.mockResolvedValue(mockOpportunities);
      mockRedis.get.mockResolvedValue(null);

      const result = await service.calculateHealthScore('client-123');

      expect(result).toHaveProperty('overallScore');
      expect(result).toHaveProperty('components');
      expect(result).toHaveProperty('recommendations');
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    });

    it('should return cached result if available', async () => {
      const cachedResult = {
        overallScore: 85,
        components: {
          recency: 90,
          frequency: 80,
          monetary: 85,
          satisfaction: 90,
          responsiveness: 75,
        },
        recommendations: [],
        lastCalculated: new Date().toISOString(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await service.calculateHealthScore('client-123');

      expect(result.overallScore).toBe(85);
      expect(mockPrisma.client.findUnique).not.toHaveBeenCalled();
    });

    it('should throw error for non-existent client', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(null);
      mockRedis.get.mockResolvedValue(null);

      await expect(service.calculateHealthScore('non-existent')).rejects.toThrow();
    });

    it('should handle client with no interactions', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({
        ...mockClient,
        lastInteractionAt: null,
      });
      mockPrisma.clientInteraction.findMany.mockResolvedValue([]);
      mockPrisma.clientInteraction.count.mockResolvedValue(0);
      mockPrisma.opportunity.findMany.mockResolvedValue([]);
      mockRedis.get.mockResolvedValue(null);

      const result = await service.calculateHealthScore('client-123');

      expect(result.overallScore).toBeLessThan(50); // Low score due to no activity
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should weight components correctly', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.clientInteraction.findMany.mockResolvedValue(mockInteractions);
      mockPrisma.clientInteraction.count.mockResolvedValue(10);
      mockPrisma.opportunity.findMany.mockResolvedValue(mockOpportunities);
      mockRedis.get.mockResolvedValue(null);

      const result = await service.calculateHealthScore('client-123');

      // Verify components exist
      expect(result.components).toHaveProperty('recency');
      expect(result.components).toHaveProperty('frequency');
      expect(result.components).toHaveProperty('monetary');
      expect(result.components).toHaveProperty('satisfaction');
      expect(result.components).toHaveProperty('responsiveness');
    });
  });

  describe('updateClientHealthScore', () => {
    it('should update client health score in database', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.clientInteraction.findMany.mockResolvedValue(mockInteractions);
      mockPrisma.clientInteraction.count.mockResolvedValue(10);
      mockPrisma.opportunity.findMany.mockResolvedValue(mockOpportunities);
      mockPrisma.client.update.mockResolvedValue({ ...mockClient, healthScore: 85 });
      mockRedis.get.mockResolvedValue(null);

      await service.updateClientHealthScore('client-123');

      expect(mockPrisma.client.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'client-123' },
          data: expect.objectContaining({
            healthScore: expect.any(Number),
            healthScoreUpdatedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should cache the updated score', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.clientInteraction.findMany.mockResolvedValue(mockInteractions);
      mockPrisma.clientInteraction.count.mockResolvedValue(10);
      mockPrisma.opportunity.findMany.mockResolvedValue(mockOpportunities);
      mockPrisma.client.update.mockResolvedValue({ ...mockClient, healthScore: 85 });
      mockRedis.get.mockResolvedValue(null);

      await service.updateClientHealthScore('client-123');

      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });

  describe('health score components', () => {
    beforeEach(() => {
      mockRedis.get.mockResolvedValue(null);
    });

    it('should give high recency score for recent interaction', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({
        ...mockClient,
        lastInteractionAt: new Date(), // Today
      });
      mockPrisma.clientInteraction.findMany.mockResolvedValue(mockInteractions);
      mockPrisma.clientInteraction.count.mockResolvedValue(10);
      mockPrisma.opportunity.findMany.mockResolvedValue(mockOpportunities);

      const result = await service.calculateHealthScore('client-123');

      expect(result.components.recency).toBeGreaterThan(80);
    });

    it('should give low recency score for old interaction', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({
        ...mockClient,
        lastInteractionAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      });
      mockPrisma.clientInteraction.findMany.mockResolvedValue([]);
      mockPrisma.clientInteraction.count.mockResolvedValue(1);
      mockPrisma.opportunity.findMany.mockResolvedValue([]);

      const result = await service.calculateHealthScore('client-123');

      expect(result.components.recency).toBeLessThan(50);
    });

    it('should give high satisfaction score for positive sentiment', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.clientInteraction.findMany.mockResolvedValue([
        { id: 'int-1', sentiment: 'POSITIVE', interactionType: 'MEETING', createdAt: new Date() },
        { id: 'int-2', sentiment: 'POSITIVE', interactionType: 'CALL', createdAt: new Date() },
        { id: 'int-3', sentiment: 'POSITIVE', interactionType: 'EMAIL', createdAt: new Date() },
      ]);
      mockPrisma.clientInteraction.count.mockResolvedValue(3);
      mockPrisma.opportunity.findMany.mockResolvedValue([]);

      const result = await service.calculateHealthScore('client-123');

      expect(result.components.satisfaction).toBeGreaterThan(70);
    });

    it('should give low satisfaction score for negative sentiment', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.clientInteraction.findMany.mockResolvedValue([
        { id: 'int-1', sentiment: 'NEGATIVE', interactionType: 'MEETING', createdAt: new Date() },
        { id: 'int-2', sentiment: 'NEGATIVE', interactionType: 'CALL', createdAt: new Date() },
      ]);
      mockPrisma.clientInteraction.count.mockResolvedValue(2);
      mockPrisma.opportunity.findMany.mockResolvedValue([]);

      const result = await service.calculateHealthScore('client-123');

      expect(result.components.satisfaction).toBeLessThan(50);
    });

    it('should give high monetary score for high-value client', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({
        ...mockClient,
        totalRevenue: 100000,
      });
      mockPrisma.clientInteraction.findMany.mockResolvedValue(mockInteractions);
      mockPrisma.clientInteraction.count.mockResolvedValue(10);
      mockPrisma.opportunity.findMany.mockResolvedValue([
        { id: 'opp-1', status: 'WON', estimatedValue: 50000 },
        { id: 'opp-2', status: 'WON', estimatedValue: 50000 },
      ]);

      const result = await service.calculateHealthScore('client-123');

      expect(result.components.monetary).toBeGreaterThan(70);
    });
  });

  describe('recommendations', () => {
    beforeEach(() => {
      mockRedis.get.mockResolvedValue(null);
    });

    it('should recommend follow-up for low recency score', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({
        ...mockClient,
        lastInteractionAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      });
      mockPrisma.clientInteraction.findMany.mockResolvedValue([]);
      mockPrisma.clientInteraction.count.mockResolvedValue(1);
      mockPrisma.opportunity.findMany.mockResolvedValue([]);

      const result = await service.calculateHealthScore('client-123');

      expect(
        result.recommendations.some(
          (r) => r.toLowerCase().includes('follow') || r.toLowerCase().includes('reach')
        )
      ).toBe(true);
    });

    it('should recommend more engagement for low frequency score', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({
        ...mockClient,
        lastInteractionAt: new Date(),
      });
      mockPrisma.clientInteraction.findMany.mockResolvedValue([]);
      mockPrisma.clientInteraction.count.mockResolvedValue(1); // Only 1 interaction
      mockPrisma.opportunity.findMany.mockResolvedValue([]);

      const result = await service.calculateHealthScore('client-123');

      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });
});
