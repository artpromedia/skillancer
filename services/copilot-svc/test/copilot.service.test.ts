import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CopilotService } from '../src/services/copilot.service';
import type { PrismaClient } from '@prisma/client';

// Create a mock Prisma client
function createMockPrisma() {
  return {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    proposalDraft: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    copilotInteraction: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  } as unknown as PrismaClient;
}

describe('CopilotService', () => {
  let service: CopilotService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new CopilotService(mockPrisma as PrismaClient);
  });

  describe('generateProposalDraft', () => {
    it('should generate a proposal draft successfully', async () => {
      const input = {
        userId: 'user-123',
        jobId: 'job-456',
        jobTitle: 'Senior Developer',
        jobDescription: 'Looking for a skilled developer to build a web application.',
        requiredSkills: ['JavaScript', 'TypeScript', 'React'],
        userSkills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
        clientIndustry: 'Technology',
      };

      // Mock user profile
      (mockPrisma.user.findUnique as any).mockResolvedValue({
        id: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        profile: { headline: 'Full Stack Developer' },
      });

      // Mock successful proposals
      (mockPrisma.proposalDraft.findMany as any).mockResolvedValue([]);

      // Mock proposal creation
      (mockPrisma.proposalDraft.create as any).mockResolvedValue({
        id: 'draft-789',
        userId: 'user-123',
        jobId: 'job-456',
        jobTitle: 'Senior Developer',
        content: 'Generated proposal content',
        suggestedRate: 75,
        estimatedWinRate: 0.6,
        status: 'DRAFT',
      });

      // Mock interaction logging
      (mockPrisma.copilotInteraction.create as any).mockResolvedValue({
        id: 'interaction-123',
      });

      const result = await service.generateProposalDraft(input);

      expect(result).toBeDefined();
      expect(result.draftId).toBe('draft-789');
      expect(result.coverLetter).toBeDefined();
      expect(result.keyPoints).toBeDefined();
      expect(result.suggestedRate).toBeDefined();
      expect(result.estimatedWinRate).toBeDefined();
      expect(mockPrisma.proposalDraft.create).toHaveBeenCalled();
      expect(mockPrisma.copilotInteraction.create).toHaveBeenCalled();
    });

    it('should calculate skill match correctly', async () => {
      const input = {
        userId: 'user-123',
        jobId: 'job-456',
        jobTitle: 'Developer',
        jobDescription: 'Build an app',
        requiredSkills: ['JavaScript', 'React'],
        userSkills: ['JavaScript', 'React', 'TypeScript'],
        clientIndustry: 'Technology',
      };

      (mockPrisma.user.findUnique as any).mockResolvedValue({
        id: 'user-123',
        firstName: 'Jane',
      });
      (mockPrisma.proposalDraft.findMany as any).mockResolvedValue([]);
      (mockPrisma.proposalDraft.create as any).mockResolvedValue({
        id: 'draft-123',
        content: 'test',
        suggestedRate: 50,
        estimatedWinRate: 0.5,
      });
      (mockPrisma.copilotInteraction.create as any).mockResolvedValue({});

      const result = await service.generateProposalDraft(input);

      // All required skills match
      expect(result.keyPoints).toContain('100% skill match with requirements');
    });
  });

  describe('suggestRate', () => {
    it('should suggest a rate based on input parameters', async () => {
      const input = {
        userId: 'user-123',
        skills: ['JavaScript', 'React'],
        experience: 5,
        projectComplexity: 'MEDIUM' as const,
        industry: 'Technology',
      };

      (mockPrisma.proposalDraft.findMany as any).mockResolvedValue([]);
      (mockPrisma.copilotInteraction.create as any).mockResolvedValue({});

      const result = await service.suggestRate(input);

      expect(result).toBeDefined();
      expect(result.suggestedHourlyRate).toBeDefined();
      expect(result.suggestedHourlyRate.min).toBeLessThan(result.suggestedHourlyRate.max);
      expect(result.suggestedHourlyRate.optimal).toBeGreaterThanOrEqual(result.suggestedHourlyRate.min);
      expect(result.suggestedHourlyRate.optimal).toBeLessThanOrEqual(result.suggestedHourlyRate.max);
      expect(result.marketPosition).toBeDefined();
      expect(result.competitorRange).toBeDefined();
      expect(result.factors).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('should add high-demand skill factor for AI skills', async () => {
      const input = {
        userId: 'user-123',
        skills: ['AI', 'Machine Learning', 'Python'],
        experience: 7,
        projectComplexity: 'HIGH' as const,
        industry: 'Technology',
      };

      (mockPrisma.proposalDraft.findMany as any).mockResolvedValue([]);
      (mockPrisma.copilotInteraction.create as any).mockResolvedValue({});

      const result = await service.suggestRate(input);

      const highDemandFactor = result.factors.find((f: any) => f.factor === 'High-Demand Skills');
      expect(highDemandFactor).toBeDefined();
      expect(highDemandFactor.impact).toBe('POSITIVE');
    });
  });

  describe('getProposalDraft', () => {
    it('should return a draft by ID', async () => {
      const mockDraft = {
        id: 'draft-123',
        userId: 'user-123',
        jobTitle: 'Developer',
        content: 'Proposal content',
        status: 'DRAFT',
      };

      (mockPrisma.proposalDraft.findUnique as any).mockResolvedValue(mockDraft);

      const result = await service.getProposalDraft('draft-123');

      expect(result).toEqual(mockDraft);
      expect(mockPrisma.proposalDraft.findUnique).toHaveBeenCalledWith({
        where: { id: 'draft-123' },
      });
    });

    it('should return null for non-existent draft', async () => {
      (mockPrisma.proposalDraft.findUnique as any).mockResolvedValue(null);

      const result = await service.getProposalDraft('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateProposalDraft', () => {
    it('should update a draft successfully', async () => {
      const mockUpdatedDraft = {
        id: 'draft-123',
        content: 'Updated content',
        updatedAt: new Date(),
      };

      (mockPrisma.proposalDraft.update as any).mockResolvedValue(mockUpdatedDraft);

      const result = await service.updateProposalDraft('draft-123', 'Updated content');

      expect(result.content).toBe('Updated content');
      expect(mockPrisma.proposalDraft.update).toHaveBeenCalled();
    });
  });

  describe('getUserProposalDrafts', () => {
    it('should return drafts for a user', async () => {
      const mockDrafts = [
        { id: 'draft-1', userId: 'user-123', status: 'DRAFT' },
        { id: 'draft-2', userId: 'user-123', status: 'SENT' },
      ];

      (mockPrisma.proposalDraft.findMany as any).mockResolvedValue(mockDrafts);

      const result = await service.getUserProposalDrafts('user-123');

      expect(result).toHaveLength(2);
      expect(mockPrisma.proposalDraft.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter drafts by status', async () => {
      const mockDrafts = [{ id: 'draft-1', userId: 'user-123', status: 'DRAFT' }];

      (mockPrisma.proposalDraft.findMany as any).mockResolvedValue(mockDrafts);

      const result = await service.getUserProposalDrafts('user-123', 'DRAFT');

      expect(result).toHaveLength(1);
      expect(mockPrisma.proposalDraft.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', status: 'DRAFT' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getInteractionHistory', () => {
    it('should return interaction history for a user', async () => {
      const mockInteractions = [
        { id: 'int-1', userId: 'user-123', interactionType: 'PROPOSAL_DRAFT' },
        { id: 'int-2', userId: 'user-123', interactionType: 'RATE_SUGGEST' },
      ];

      (mockPrisma.copilotInteraction.findMany as any).mockResolvedValue(mockInteractions);

      const result = await service.getInteractionHistory('user-123');

      expect(result).toHaveLength(2);
      expect(mockPrisma.copilotInteraction.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  });

  describe('optimizeProfile', () => {
    it('should optimize profile and return suggestions', async () => {
      const input = {
        userId: 'user-123',
        currentHeadline: 'Developer',
        currentSummary: 'Experienced developer',
        skills: ['JavaScript', 'React', 'Node.js', 'TypeScript', 'Python'],
        experience: [{ title: 'Developer', company: 'Tech Corp' }],
        targetRoles: ['Senior Developer', 'Tech Lead'],
      };

      (mockPrisma.copilotInteraction.create as any).mockResolvedValue({});

      const result = await service.optimizeProfile(input);

      expect(result).toBeDefined();
      expect(result.optimizedHeadline).toBeDefined();
      expect(result.optimizedSummary).toBeDefined();
      expect(result.skillsToHighlight).toBeDefined();
      expect(result.skillsToAdd).toBeDefined();
      expect(result.keywordSuggestions).toBeDefined();
      expect(result.completenessScore).toBeGreaterThan(0);
      expect(result.improvements).toBeDefined();
    });

    it('should calculate completeness score correctly', async () => {
      const inputComplete = {
        userId: 'user-123',
        currentHeadline: 'Developer',
        currentSummary: 'Experienced developer with many years',
        skills: ['JavaScript', 'React', 'Node.js', 'TypeScript', 'Python'],
        experience: [{ title: 'Dev1' }, { title: 'Dev2' }],
        targetRoles: [],
      };

      (mockPrisma.copilotInteraction.create as any).mockResolvedValue({});

      const result = await service.optimizeProfile(inputComplete);

      // Should be 100: headline (20) + summary (30) + skills >= 5 (20) + experience >= 2 (30)
      expect(result.completenessScore).toBe(100);
    });
  });

  describe('getMarketInsights', () => {
    it('should return market insights', async () => {
      const input = {
        userId: 'user-123',
        skills: ['JavaScript', 'React'],
        industry: 'Technology',
      };

      const result = await service.getMarketInsights(input);

      expect(result).toBeDefined();
      expect(result.demandLevel).toBeDefined();
      expect(result.demandTrend).toBeDefined();
      expect(result.averageRate).toBeDefined();
      expect(result.competitionLevel).toBeDefined();
      expect(result.skillGaps).toBeDefined();
      expect(result.emergingSkills).toBeDefined();
      expect(result.marketTips).toBeDefined();
    });
  });
});
