import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PredictionService } from '../src/services/prediction.service';
import type { PrismaClient } from '@prisma/client';

// Create a mock Prisma client
function createMockPrisma() {
  return {
    successPrediction: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    engagementOutcome: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  } as unknown as PrismaClient;
}

describe('PredictionService', () => {
  let service: PredictionService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new PredictionService(mockPrisma);
  });

  describe('predictSuccess', () => {
    it('should generate a success prediction', async () => {
      const input = {
        contractId: 'contract-123',
        clientId: 'client-123',
        freelancerId: 'freelancer-123',
        projectType: 'DEVELOPMENT' as const,
        budget: 10000,
        duration: 30,
        complexity: 'MEDIUM' as const,
      };

      // Mock historical data
      (mockPrisma.engagementOutcome.findMany as any).mockResolvedValue([
        { rating: 'SUCCESSFUL', score: 4.5, freelancerId: 'freelancer-123' },
        { rating: 'SUCCESSFUL', score: 4.0, freelancerId: 'freelancer-123' },
      ]);

      // Mock prediction creation
      (mockPrisma.successPrediction.create as any).mockResolvedValue({
        id: 'prediction-123',
        successProbability: 0.75,
        confidence: 'MEDIUM',
      });

      const result = await service.predictSuccess(input);

      expect(result).toBeDefined();
      expect(result.successProbability).toBeGreaterThan(0);
      expect(result.successProbability).toBeLessThanOrEqual(1);
      expect(result.confidence).toBeDefined();
      expect(result.riskFactors).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(mockPrisma.successPrediction.create).toHaveBeenCalled();
    });

    it('should identify risk factors for inexperienced freelancer', async () => {
      const input = {
        contractId: 'contract-123',
        clientId: 'client-123',
        freelancerId: 'freelancer-new',
        projectType: 'DEVELOPMENT' as const,
        budget: 5000,
        duration: 15,
        complexity: 'LOW' as const,
      };

      // Mock no prior outcomes
      (mockPrisma.engagementOutcome.findMany as any).mockResolvedValue([]);
      (mockPrisma.successPrediction.create as any).mockResolvedValue({});

      const result = await service.predictSuccess(input);

      // Should include risk factor about limited track record
      const resourceRisk = result.riskFactors.find(
        (rf) => rf.category === 'RESOURCE' && rf.description.includes('Limited')
      );
      expect(resourceRisk).toBeDefined();
    });

    it('should increase risk for high complexity projects', async () => {
      const input = {
        contractId: 'contract-123',
        clientId: 'client-123',
        freelancerId: 'freelancer-123',
        projectType: 'DEVELOPMENT' as const,
        budget: 50000,
        duration: 90,
        complexity: 'HIGH' as const,
      };

      (mockPrisma.engagementOutcome.findMany as any).mockResolvedValue([
        { rating: 'SUCCESSFUL', score: 4.5 },
      ]);
      (mockPrisma.successPrediction.create as any).mockResolvedValue({});

      const result = await service.predictSuccess(input);

      const complexityRisk = result.riskFactors.find(
        (rf) => rf.description.includes('complexity')
      );
      expect(complexityRisk).toBeDefined();
    });

    it('should generate recommendations based on risk factors', async () => {
      const input = {
        contractId: 'contract-123',
        clientId: 'client-123',
        freelancerId: 'freelancer-123',
        projectType: 'DEVELOPMENT' as const,
        budget: 20000,
        duration: 60,
        complexity: 'HIGH' as const,
      };

      (mockPrisma.engagementOutcome.findMany as any).mockResolvedValue([]);
      (mockPrisma.successPrediction.create as any).mockResolvedValue({});

      const result = await service.predictSuccess(input);

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations).toContain('Consider a small paid trial before full project commitment');
    });
  });

  describe('getPrediction', () => {
    it('should return prediction by contract ID', async () => {
      const mockPrediction = {
        id: 'prediction-123',
        contractId: 'contract-123',
        successProbability: 0.8,
        confidence: 'HIGH',
      };

      (mockPrisma.successPrediction.findFirst as any).mockResolvedValue(mockPrediction);

      const result = await service.getPrediction('contract-123');

      expect(result).toEqual(mockPrediction);
    });

    it('should return null for non-existent contract', async () => {
      (mockPrisma.successPrediction.findFirst as any).mockResolvedValue(null);

      const result = await service.getPrediction('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getFreelancerPredictions', () => {
    it('should return paginated predictions for a freelancer', async () => {
      const mockPredictions = [
        { id: 'pred-1', successProbability: 0.8 },
        { id: 'pred-2', successProbability: 0.7 },
      ];

      (mockPrisma.successPrediction.findMany as any).mockResolvedValue(mockPredictions);
      (mockPrisma.successPrediction.count as any).mockResolvedValue(10);

      const result = await service.getFreelancerPredictions('freelancer-123', 1, 20);

      expect(result.predictions).toHaveLength(2);
      expect(result.pagination.total).toBe(10);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });
  });

  describe('getClientPredictions', () => {
    it('should return paginated predictions for a client', async () => {
      const mockPredictions = [
        { id: 'pred-1', successProbability: 0.9 },
      ];

      (mockPrisma.successPrediction.findMany as any).mockResolvedValue(mockPredictions);
      (mockPrisma.successPrediction.count as any).mockResolvedValue(5);

      const result = await service.getClientPredictions('client-123');

      expect(result.predictions).toHaveLength(1);
      expect(result.pagination.total).toBe(5);
    });
  });

  describe('updatePrediction', () => {
    it('should throw error if no existing prediction', async () => {
      (mockPrisma.successPrediction.findFirst as any).mockResolvedValue(null);

      await expect(service.updatePrediction('contract-123')).rejects.toThrow(
        'No existing prediction found'
      );
    });
  });
});
