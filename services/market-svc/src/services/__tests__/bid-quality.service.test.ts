/**
 * @module @skillancer/market-svc/services/__tests__/bid-quality
 * Unit tests for the bid quality service
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

// Create mock instances
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
} as any;

const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
} as any;

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as any;

import { BidQualityService } from '../../services/bid-quality.service.js';

describe('BidQualityService', () => {
  let service: BidQualityService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    service = new BidQualityService(mockPrisma, mockRedis, mockLogger);
  });

  describe('calculateQualityScore', () => {
    it('should calculate quality score for a good bid', async () => {
      // Mock freelancer data
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'freelancer-123',
        profile: {
          bio: 'Experienced developer',
          title: 'Senior Developer',
          hourlyRate: { toNumber: () => 50 },
          country: 'US',
          timezone: 'America/New_York',
          portfolio: [{ url: 'https://example.com' }],
          languages: ['en'],
          availability: 'FULL_TIME',
        },
        ratingAggregation: {
          freelancerAverageRating: { toNumber: () => 4.8 },
          freelancerTotalReviews: 25,
        },
        trustScore: {
          overallScore: 85,
          communicationRating: 90,
          tier: 'VERIFIED',
        },
        _count: {
          contractsAsFreelancer: 30,
        },
      });

      const result = await service.calculateQualityScore({
        jobId: 'job-123',
        freelancerId: 'freelancer-123',
        coverLetter: `
          I am very interested in this project. I have extensive experience 
          in building similar applications and would love to contribute to your team.
          My background includes working with React, Node.js, and TypeScript for 
          over 5 years. I believe I can deliver high-quality results within your 
          timeline and budget. Please let me know if you have any questions about
          my experience or approach to this project.
        `.trim(),
        proposedRate: 1500,
        budgetMin: 1000,
        budgetMax: 2000,
      });

      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.isSpam).toBe(false);
      expect(result.factors).toBeDefined();
      expect(result.factors.coverLetterLength).toBeGreaterThan(0);
      expect(result.factors.rateWithinBudget).toBe(true);
    });

    it('should return cached freelancer metrics', async () => {
      const cachedData = {
        factors: {
          profileCompleteness: 0.9,
          totalContracts: 20,
          averageRating: 4.5,
          successRateScore: 0.85,
          responsivenessScore: 0.9,
          trustScore: 0.8,
          trustTier: 'VERIFIED',
        },
        scores: {
          profileScore: 0.9,
          successScore: 0.85,
          responsivenessScore: 0.9,
          trustScore: 0.8,
        },
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await service.calculateQualityScore({
        jobId: 'job-123',
        freelancerId: 'freelancer-123',
        coverLetter:
          'A well-written cover letter that shows genuine interest in the project and highlights relevant skills.',
        proposedRate: 1500,
        budgetMin: 1000,
        budgetMax: 2000,
      });

      expect(result.score).toBeGreaterThan(0);
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should penalize short cover letters', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'freelancer-123',
        profile: null,
        ratingAggregation: null,
        trustScore: null,
        _count: { contractsAsFreelancer: 0 },
      });

      const result = await service.calculateQualityScore({
        jobId: 'job-123',
        freelancerId: 'freelancer-123',
        coverLetter: 'I can do this project.',
        proposedRate: 100,
      });

      expect(result.factors.coverLetterLengthScore).toBe(0);
    });

    it('should detect template patterns', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'freelancer-123',
        profile: null,
        ratingAggregation: null,
        trustScore: null,
        _count: { contractsAsFreelancer: 0 },
      });

      const result = await service.calculateQualityScore({
        jobId: 'job-123',
        freelancerId: 'freelancer-123',
        coverLetter: `
          Dear Sir/Madam,
          
          I am a highly experienced professional developer with many years of experience.
          I am writing to express my interest in this project. I would love to work on this project.
          Please check my portfolio for examples of my previous work.
          
          Best regards
        `.trim(),
        proposedRate: 100,
      });

      expect(result.factors.templateIndicators).toBeGreaterThan(0);
      expect(result.factors.personalizationScore).toBeLessThan(1);
    });
  });

  describe('detectSpam', () => {
    it('should detect phone numbers', () => {
      const result = service.detectSpam(
        'Contact me at phone 123-456-7890 for discussion',
        'freelancer-123'
      );

      expect(result.isSpam).toBe(true);
      expect(result.reason).toContain('external contact');
    });

    it('should detect email addresses', () => {
      const result = service.detectSpam(
        'You can reach me at myemail@example.com',
        'freelancer-123'
      );

      expect(result.isSpam).toBe(true);
    });

    it('should detect social media contact attempts', () => {
      const result = service.detectSpam(
        'Please contact me on WhatsApp for faster response',
        'freelancer-123'
      );

      expect(result.isSpam).toBe(true);
    });

    it('should detect excessive word repetition', () => {
      const result = service.detectSpam(
        'great great great great great great great great great great great work work work work',
        'freelancer-123'
      );

      expect(result.isSpam).toBe(true);
      expect(result.reason).toContain('repetition');
    });

    it('should detect too short cover letters', () => {
      const result = service.detectSpam('I can do it', 'freelancer-123');

      expect(result.isSpam).toBe(true);
      expect(result.reason).toContain('too short');
    });

    it('should pass valid cover letters', () => {
      const result = service.detectSpam(
        `
        I am very interested in this project and would like to discuss 
        the requirements in more detail. I have relevant experience in 
        this area and believe I can deliver excellent results.
        `.trim(),
        'freelancer-123'
      );

      expect(result.isSpam).toBe(false);
    });
  });

  describe('evaluateRate', () => {
    it('should give high score for rate within budget', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'freelancer-123',
        profile: null,
        ratingAggregation: null,
        trustScore: null,
        _count: { contractsAsFreelancer: 0 },
      });

      const result = await service.calculateQualityScore({
        jobId: 'job-123',
        freelancerId: 'freelancer-123',
        coverLetter:
          'A reasonable cover letter that explains my qualifications and interest in this project.',
        proposedRate: 1500,
        budgetMin: 1000,
        budgetMax: 2000,
      });

      expect(result.factors.rateWithinBudget).toBe(true);
    });

    it('should penalize rate outside budget', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'freelancer-123',
        profile: null,
        ratingAggregation: null,
        trustScore: null,
        _count: { contractsAsFreelancer: 0 },
      });

      const result = await service.calculateQualityScore({
        jobId: 'job-123',
        freelancerId: 'freelancer-123',
        coverLetter:
          'A reasonable cover letter that explains my qualifications and interest in this project.',
        proposedRate: 5000,
        budgetMin: 1000,
        budgetMax: 2000,
      });

      expect(result.factors.rateWithinBudget).toBe(false);
    });
  });

  describe('invalidateFreelancerCache', () => {
    it('should delete cached freelancer quality data', async () => {
      await service.invalidateFreelancerCache('freelancer-123');

      expect(mockRedis.del).toHaveBeenCalledWith('freelancer:quality:freelancer-123');
    });
  });
});
