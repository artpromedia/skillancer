/**
 * @module @skillancer/skillpod-svc/tests/recommendation
 * Unit tests for recommendation engine and signal processor services
 */

// @ts-nocheck - FUTURE: Fix TypeScript errors in test mocks
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/consistent-type-imports */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  createSignalProcessorService,
  createRecommendationEngineService,
  createLearningPathGeneratorService,
} from '../services/recommendation/index.js';

import type {
  LearningProfileRepository,
  SkillGapRepository,
  MarketActivitySignalRepository,
  LearningRecommendationRepository,
  LearningPathRepository,
  MarketTrendRepository,
} from '../repositories/recommendation/index.js';
import type {
  JobViewedEventPayload,
  JobApplicationEventPayload,
  JobApplicationOutcomeEventPayload,
  ProfileSkillGapEventPayload,
  MarketTrendEventPayload,
  SkillDemandChangeEventPayload,
} from '@skillancer/types';

// =============================================================================
// MOCKS
// =============================================================================

const mockLearningProfileRepo = {
  findById: vi.fn(),
  findByUserId: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  updateLearningStats: vi.fn(),
} as unknown as LearningProfileRepository;

const mockSkillGapRepo = {
  findById: vi.fn(),
  findByUserId: vi.fn(),
  findByProfileId: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  countByPriority: vi.fn(),
  findCritical: vi.fn(),
} as unknown as SkillGapRepository;

const mockMarketActivitySignalRepo = {
  findById: vi.fn(),
  findByUserId: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findUnprocessed: vi.fn(),
  markProcessed: vi.fn(),
  findByType: vi.fn(),
} as unknown as MarketActivitySignalRepository;

const mockRecommendationRepo = {
  findById: vi.fn(),
  findByUserId: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findActive: vi.fn(),
  findPending: vi.fn(),
  countByStatus: vi.fn(),
} as unknown as LearningRecommendationRepository;

const mockLearningPathRepo = {
  findById: vi.fn(),
  findByUserId: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findActive: vi.fn(),
  updateProgress: vi.fn(),
} as unknown as LearningPathRepository;

const mockMarketTrendRepo = {
  findById: vi.fn(),
  findBySkillId: vi.fn(),
  findAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
  findTopTrending: vi.fn(),
  findByTenantId: vi.fn(),
} as unknown as MarketTrendRepository;

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  mget: vi.fn(),
  setex: vi.fn(),
} as unknown as import('ioredis').Redis;

const mockMLClient = {
  getRecommendations: vi.fn(),
  getSkillGapAnalysis: vi.fn(),
  getTrendPredictions: vi.fn(),
};

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

// =============================================================================
// TEST DATA
// =============================================================================

const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
const mockTenantId = 'tenant-123';
const mockJobId = 'job-456';
const mockSkillId = 'skill-789';
const mockProfileId = 'profile-abc';

const mockLearningProfile = {
  id: mockProfileId,
  userId: mockUserId,
  tenantId: mockTenantId,
  careerGoals: ['Senior Developer', 'Tech Lead'],
  currentSkillLevels: {
    typescript: 80,
    react: 70,
    nodejs: 75,
  },
  preferredLearningStyle: 'hands-on',
  weeklyLearningHours: 10,
  preferredContentTypes: ['video', 'project'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSkillGap = {
  id: 'gap-123',
  profileId: mockProfileId,
  skillId: mockSkillId,
  skillName: 'Kubernetes',
  type: 'MISSING',
  priority: 'HIGH',
  status: 'IDENTIFIED',
  currentLevel: 0,
  requiredLevel: 70,
  gapScore: 70,
  marketDemandScore: 85,
  detectedFrom: 'job_application',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockJobViewedEvent: JobViewedEventPayload = {
  userId: mockUserId,
  tenantId: mockTenantId,
  jobId: mockJobId,
  jobTitle: 'Senior DevOps Engineer',
  requiredSkills: ['kubernetes', 'docker', 'terraform'],
  preferredSkills: ['aws', 'gcp'],
  viewDuration: 120,
  timestamp: new Date().toISOString(),
};

const mockJobApplicationEvent: JobApplicationEventPayload = {
  userId: mockUserId,
  tenantId: mockTenantId,
  jobId: mockJobId,
  applicationId: 'app-123',
  jobTitle: 'Senior DevOps Engineer',
  requiredSkills: ['kubernetes', 'docker', 'terraform'],
  userMatchedSkills: ['docker'],
  userMissingSkills: ['kubernetes', 'terraform'],
  matchScore: 0.45,
  timestamp: new Date().toISOString(),
};

const mockJobOutcomeEvent: JobApplicationOutcomeEventPayload = {
  userId: mockUserId,
  tenantId: mockTenantId,
  applicationId: 'app-123',
  jobId: mockJobId,
  outcome: 'rejected',
  rejectionStage: 'technical_screen',
  feedbackSkills: ['kubernetes', 'system-design'],
  timestamp: new Date().toISOString(),
};

const mockProfileSkillGapEvent: ProfileSkillGapEventPayload = {
  userId: mockUserId,
  tenantId: mockTenantId,
  profileId: mockProfileId,
  skillGaps: [
    {
      skillId: mockSkillId,
      skillName: 'Kubernetes',
      currentLevel: 20,
      requiredLevel: 70,
      gapType: 'INSUFFICIENT_LEVEL',
      priority: 'HIGH',
    },
  ],
  detectedFrom: 'profile_analysis',
  timestamp: new Date().toISOString(),
};

const mockMarketTrendEvent: MarketTrendEventPayload = {
  tenantId: mockTenantId,
  skillId: mockSkillId,
  skillName: 'Kubernetes',
  trendDirection: 'RISING',
  demandScore: 92,
  growthRate: 15.5,
  period: 'MONTHLY',
  jobCount: 1500,
  avgSalary: 150000,
  timestamp: new Date().toISOString(),
};

const mockSkillDemandChangeEvent: SkillDemandChangeEventPayload = {
  tenantId: mockTenantId,
  skillId: mockSkillId,
  skillName: 'Kubernetes',
  previousDemandScore: 75,
  newDemandScore: 92,
  changePercent: 22.7,
  affectedJobCategories: ['DevOps', 'Backend', 'Platform'],
  timestamp: new Date().toISOString(),
};

// =============================================================================
// SIGNAL PROCESSOR SERVICE TESTS
// =============================================================================

describe('SignalProcessorService', () => {
  let signalProcessor;

  beforeEach(() => {
    vi.clearAllMocks();

    signalProcessor = createSignalProcessorService({
      learningProfileRepo: mockLearningProfileRepo,
      skillGapRepo: mockSkillGapRepo,
      signalRepo: mockMarketActivitySignalRepo,
      marketTrendRepo: mockMarketTrendRepo,
      redis: mockRedis,
      logger: mockLogger,
    });
  });

  describe('processJobViewedEvent', () => {
    it('should create a signal for job view', async () => {
      mockMarketActivitySignalRepo.create.mockResolvedValue({
        id: 'signal-1',
        type: 'JOB_VIEW',
        userId: mockUserId,
        processed: false,
      });

      const result = await signalProcessor.processJobViewedEvent(mockJobViewedEvent);

      expect(mockMarketActivitySignalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'JOB_VIEW',
          userId: mockUserId,
          tenantId: mockTenantId,
        })
      );
      expect(result).toBeDefined();
    });

    it('should not create duplicate signals within cooldown period', async () => {
      mockRedis.get.mockResolvedValue('1');

      const result = await signalProcessor.processJobViewedEvent(mockJobViewedEvent);

      expect(mockMarketActivitySignalRepo.create).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should extract skills from job view for gap analysis', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockMarketActivitySignalRepo.create.mockResolvedValue({ id: 'signal-1' });
      mockLearningProfileRepo.findByUserId.mockResolvedValue(mockLearningProfile);

      await signalProcessor.processJobViewedEvent(mockJobViewedEvent);

      expect(mockLearningProfileRepo.findByUserId).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('processJobApplicationEvent', () => {
    it('should create signals for application with skill gaps', async () => {
      mockMarketActivitySignalRepo.create.mockResolvedValue({
        id: 'signal-2',
        type: 'JOB_APPLICATION',
      });
      mockLearningProfileRepo.findByUserId.mockResolvedValue(mockLearningProfile);
      mockSkillGapRepo.createMany.mockResolvedValue({ count: 2 });

      const result = await signalProcessor.processJobApplicationEvent(mockJobApplicationEvent);

      expect(mockMarketActivitySignalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'JOB_APPLICATION',
          userId: mockUserId,
        })
      );
      expect(result).toBeDefined();
    });

    it('should identify missing skills as skill gaps', async () => {
      mockMarketActivitySignalRepo.create.mockResolvedValue({ id: 'signal-2' });
      mockLearningProfileRepo.findByUserId.mockResolvedValue(mockLearningProfile);
      mockSkillGapRepo.createMany.mockResolvedValue({ count: 2 });

      await signalProcessor.processJobApplicationEvent(mockJobApplicationEvent);

      // Should identify kubernetes and terraform as gaps
      expect(mockSkillGapRepo.createMany).toHaveBeenCalled();
    });
  });

  describe('processApplicationOutcomeEvent', () => {
    it('should create high-priority skill gaps for rejection', async () => {
      mockMarketActivitySignalRepo.create.mockResolvedValue({
        id: 'signal-3',
        type: 'JOB_OUTCOME',
      });
      mockLearningProfileRepo.findByUserId.mockResolvedValue(mockLearningProfile);
      mockSkillGapRepo.createMany.mockResolvedValue({ count: 2 });

      const result = await signalProcessor.processApplicationOutcomeEvent(mockJobOutcomeEvent);

      expect(mockMarketActivitySignalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'JOB_OUTCOME',
        })
      );
      expect(result).toBeDefined();
    });

    it('should assign critical priority for technical rejection', async () => {
      mockMarketActivitySignalRepo.create.mockResolvedValue({ id: 'signal-3' });
      mockLearningProfileRepo.findByUserId.mockResolvedValue(mockLearningProfile);

      await signalProcessor.processApplicationOutcomeEvent(mockJobOutcomeEvent);

      // Technical screen rejections should create critical priority gaps
      expect(mockSkillGapRepo.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            priority: 'CRITICAL',
          }),
        ])
      );
    });
  });

  describe('processProfileSkillGaps', () => {
    it('should process multiple skill gaps from profile analysis', async () => {
      mockSkillGapRepo.createMany.mockResolvedValue({ count: 1 });
      mockLearningProfileRepo.findByUserId.mockResolvedValue(mockLearningProfile);

      const result = await signalProcessor.processProfileSkillGaps(mockProfileSkillGapEvent);

      expect(mockSkillGapRepo.createMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('processMarketTrendEvent', () => {
    it('should update market trend data', async () => {
      mockMarketTrendRepo.upsert.mockResolvedValue({
        id: 'trend-1',
        skillId: mockSkillId,
        direction: 'RISING',
      });

      const result = await signalProcessor.processMarketTrendEvent(mockMarketTrendEvent);

      expect(mockMarketTrendRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          skillId: mockSkillId,
          direction: 'RISING',
          demandScore: 92,
        })
      );
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('processSkillDemandChange', () => {
    it('should notify users with related skill gaps', async () => {
      mockSkillGapRepo.findBySkillId = vi.fn().mockResolvedValue([
        { ...mockSkillGap, profileId: 'profile-1', profile: { userId: 'user-1' } },
        { ...mockSkillGap, profileId: 'profile-2', profile: { userId: 'user-2' } },
      ]);

      const result = await signalProcessor.processSkillDemandChange(mockSkillDemandChangeEvent);

      expect(result).toEqual(expect.arrayContaining(['user-1', 'user-2']));
    });
  });

  describe('batchProcessSignals', () => {
    it('should process unprocessed signals in batch', async () => {
      mockMarketActivitySignalRepo.findUnprocessed.mockResolvedValue([
        { id: 'signal-1', type: 'JOB_VIEW', data: mockJobViewedEvent },
        { id: 'signal-2', type: 'JOB_APPLICATION', data: mockJobApplicationEvent },
      ]);
      mockMarketActivitySignalRepo.markProcessed.mockResolvedValue(true);

      const result = await signalProcessor.batchProcessSignals({
        tenantId: mockTenantId,
      });

      expect(result.processedCount).toBe(2);
    });
  });
});

// =============================================================================
// RECOMMENDATION ENGINE SERVICE TESTS
// =============================================================================

describe('RecommendationEngineService', () => {
  let recommendationEngine;

  beforeEach(() => {
    vi.clearAllMocks();

    recommendationEngine = createRecommendationEngineService({
      learningProfileRepo: mockLearningProfileRepo,
      skillGapRepo: mockSkillGapRepo,
      recommendationRepo: mockRecommendationRepo,
      marketTrendRepo: mockMarketTrendRepo,
      redis: mockRedis,
      mlClient: mockMLClient,
      logger: mockLogger,
    });
  });

  describe('generateRecommendations', () => {
    it('should generate recommendations based on skill gaps', async () => {
      mockLearningProfileRepo.findByUserId.mockResolvedValue(mockLearningProfile);
      mockSkillGapRepo.findByUserId.mockResolvedValue({
        items: [mockSkillGap],
        total: 1,
      });
      mockMarketTrendRepo.findBySkillId.mockResolvedValue({
        skillId: mockSkillId,
        direction: 'RISING',
        demandScore: 85,
      });
      mockMLClient.getRecommendations.mockResolvedValue([
        {
          contentId: 'content-1',
          contentType: 'COURSE',
          title: 'Kubernetes Fundamentals',
          score: 0.92,
          reason: 'High skill gap match',
        },
      ]);
      mockRecommendationRepo.createMany.mockResolvedValue({ count: 1 });
      mockRecommendationRepo.findByUserId.mockResolvedValue({
        items: [
          {
            id: 'rec-1',
            userId: mockUserId,
            type: 'COURSE',
            title: 'Kubernetes Fundamentals',
            score: 0.92,
          },
        ],
        total: 1,
      });

      const result = await recommendationEngine.generateRecommendations({
        userId: mockUserId,
        tenantId: mockTenantId,
        forceRefresh: false,
        includeMLScores: true,
        maxRecommendations: 10,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('title', 'Kubernetes Fundamentals');
    });

    it('should return cached recommendations if not force refresh', async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify([
          {
            id: 'rec-1',
            title: 'Cached Recommendation',
            score: 0.85,
          },
        ])
      );

      const result = await recommendationEngine.generateRecommendations({
        userId: mockUserId,
        tenantId: mockTenantId,
        forceRefresh: false,
        includeMLScores: true,
        maxRecommendations: 10,
      });

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Cached Recommendation');
      expect(mockLearningProfileRepo.findByUserId).not.toHaveBeenCalled();
    });

    it('should use rule-based scoring when ML is unavailable', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockLearningProfileRepo.findByUserId.mockResolvedValue(mockLearningProfile);
      mockSkillGapRepo.findByUserId.mockResolvedValue({
        items: [mockSkillGap],
        total: 1,
      });
      mockMarketTrendRepo.findBySkillId.mockResolvedValue(null);
      mockMLClient.getRecommendations.mockRejectedValue(new Error('ML service unavailable'));
      mockRecommendationRepo.createMany.mockResolvedValue({ count: 1 });
      mockRecommendationRepo.findByUserId.mockResolvedValue({
        items: [
          {
            id: 'rec-1',
            type: 'SKILL_PATH',
            title: 'Learn Kubernetes',
            score: 0.75,
            sourceType: 'RULE_BASED',
          },
        ],
        total: 1,
      });

      const result = await recommendationEngine.generateRecommendations({
        userId: mockUserId,
        tenantId: mockTenantId,
        forceRefresh: true,
        includeMLScores: false,
        maxRecommendations: 10,
      });

      expect(result).toHaveLength(1);
      expect(result[0].sourceType).toBe('RULE_BASED');
    });

    it('should combine ML and rule-based scores', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockLearningProfileRepo.findByUserId.mockResolvedValue(mockLearningProfile);
      mockSkillGapRepo.findByUserId.mockResolvedValue({
        items: [mockSkillGap],
        total: 1,
      });
      mockMarketTrendRepo.findBySkillId.mockResolvedValue({
        skillId: mockSkillId,
        direction: 'RISING',
        demandScore: 90,
      });
      mockMLClient.getRecommendations.mockResolvedValue([
        {
          contentId: 'content-1',
          contentType: 'COURSE',
          mlScore: 0.85,
        },
      ]);
      mockRecommendationRepo.createMany.mockResolvedValue({ count: 1 });
      mockRecommendationRepo.findByUserId.mockResolvedValue({
        items: [
          {
            id: 'rec-1',
            mlScore: 0.85,
            ruleBasedScore: 0.8,
            compositeScore: 0.825,
            sourceType: 'HYBRID',
          },
        ],
        total: 1,
      });

      const result = await recommendationEngine.generateRecommendations({
        userId: mockUserId,
        tenantId: mockTenantId,
        forceRefresh: true,
        includeMLScores: true,
        maxRecommendations: 10,
      });

      expect(result[0]).toHaveProperty('sourceType', 'HYBRID');
      expect(result[0].compositeScore).toBeDefined();
    });

    it('should respect maxRecommendations limit', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockLearningProfileRepo.findByUserId.mockResolvedValue(mockLearningProfile);
      mockSkillGapRepo.findByUserId.mockResolvedValue({
        items: Array(10).fill(mockSkillGap),
        total: 10,
      });
      mockRecommendationRepo.createMany.mockResolvedValue({ count: 5 });
      mockRecommendationRepo.findByUserId.mockResolvedValue({
        items: Array(5).fill({ id: 'rec', score: 0.8 }),
        total: 5,
      });

      const result = await recommendationEngine.generateRecommendations({
        userId: mockUserId,
        tenantId: mockTenantId,
        forceRefresh: true,
        maxRecommendations: 5,
      });

      expect(result).toHaveLength(5);
    });
  });

  describe('calculateCompositeScore', () => {
    it('should weight ML score higher than rule-based', () => {
      const score = recommendationEngine.calculateCompositeScore(0.9, 0.7);

      // ML weight (0.6) * 0.9 + Rule weight (0.4) * 0.7 = 0.82
      expect(score).toBeGreaterThan(0.8);
    });

    it('should handle missing ML score', () => {
      const score = recommendationEngine.calculateCompositeScore(null, 0.8);

      expect(score).toBe(0.8);
    });
  });
});

// =============================================================================
// LEARNING PATH GENERATOR SERVICE TESTS
// =============================================================================

describe('LearningPathGeneratorService', () => {
  let pathGenerator;

  beforeEach(() => {
    vi.clearAllMocks();

    pathGenerator = createLearningPathGeneratorService({
      learningProfileRepo: mockLearningProfileRepo,
      skillGapRepo: mockSkillGapRepo,
      learningPathRepo: mockLearningPathRepo,
      recommendationRepo: mockRecommendationRepo,
      marketTrendRepo: mockMarketTrendRepo,
      redis: mockRedis,
      logger: mockLogger,
    });
  });

  describe('generatePath', () => {
    it('should generate a skill-based learning path', async () => {
      mockLearningProfileRepo.findByUserId.mockResolvedValue(mockLearningProfile);
      mockSkillGapRepo.findByUserId.mockResolvedValue({
        items: [mockSkillGap],
        total: 1,
      });
      mockRecommendationRepo.findByUserId.mockResolvedValue({
        items: [
          { id: 'rec-1', skillId: mockSkillId, type: 'COURSE', estimatedDuration: 20 },
          { id: 'rec-2', skillId: mockSkillId, type: 'PROJECT', estimatedDuration: 10 },
        ],
        total: 2,
      });
      mockLearningPathRepo.create.mockResolvedValue({
        id: 'path-1',
        userId: mockUserId,
        type: 'SKILL_BASED',
        status: 'ACTIVE',
        milestones: [],
      });

      const result = await pathGenerator.generatePath({
        userId: mockUserId,
        tenantId: mockTenantId,
        type: 'SKILL_BASED',
        targetSkillIds: [mockSkillId],
      });

      expect(result).toHaveProperty('id');
      expect(result.type).toBe('SKILL_BASED');
      expect(mockLearningPathRepo.create).toHaveBeenCalled();
    });

    it('should generate a career goal path', async () => {
      mockLearningProfileRepo.findByUserId.mockResolvedValue(mockLearningProfile);
      mockSkillGapRepo.findByUserId.mockResolvedValue({
        items: [mockSkillGap],
        total: 1,
      });
      mockMarketTrendRepo.findAll.mockResolvedValue({
        items: [
          { skillId: 'skill-1', skillName: 'Kubernetes', demandScore: 95 },
          { skillId: 'skill-2', skillName: 'Terraform', demandScore: 88 },
        ],
        total: 2,
      });
      mockLearningPathRepo.create.mockResolvedValue({
        id: 'path-2',
        userId: mockUserId,
        type: 'CAREER_GOAL',
        careerGoal: 'DevOps Engineer',
        status: 'ACTIVE',
      });

      const result = await pathGenerator.generatePath({
        userId: mockUserId,
        tenantId: mockTenantId,
        type: 'CAREER_GOAL',
        careerGoal: 'DevOps Engineer',
      });

      expect(result.type).toBe('CAREER_GOAL');
      expect(result.careerGoal).toBe('DevOps Engineer');
    });

    it('should include practice projects when requested', async () => {
      mockLearningProfileRepo.findByUserId.mockResolvedValue(mockLearningProfile);
      mockSkillGapRepo.findByUserId.mockResolvedValue({ items: [mockSkillGap], total: 1 });
      mockRecommendationRepo.findByUserId.mockResolvedValue({
        items: [
          { id: 'rec-1', type: 'COURSE' },
          { id: 'rec-2', type: 'PRACTICE_PROJECT' },
        ],
        total: 2,
      });
      mockLearningPathRepo.create.mockResolvedValue({
        id: 'path-3',
        items: [{ type: 'COURSE' }, { type: 'PRACTICE_PROJECT' }],
      });

      const result = await pathGenerator.generatePath({
        userId: mockUserId,
        tenantId: mockTenantId,
        type: 'SKILL_BASED',
        options: { includePracticeProjects: true },
      });

      expect(mockRecommendationRepo.findByUserId).toHaveBeenCalled();
    });

    it('should estimate total duration based on weekly hours', async () => {
      mockLearningProfileRepo.findByUserId.mockResolvedValue({
        ...mockLearningProfile,
        weeklyLearningHours: 5,
      });
      mockSkillGapRepo.findByUserId.mockResolvedValue({ items: [mockSkillGap], total: 1 });
      mockLearningPathRepo.create.mockResolvedValue({
        id: 'path-4',
        estimatedDurationHours: 30,
        estimatedCompletionWeeks: 6,
      });

      const result = await pathGenerator.generatePath({
        userId: mockUserId,
        tenantId: mockTenantId,
        type: 'SKILL_BASED',
      });

      // 30 hours / 5 hours per week = 6 weeks
      expect(mockLearningPathRepo.create).toHaveBeenCalled();
    });
  });

  describe('refreshPath', () => {
    it('should update path based on skill gap changes', async () => {
      mockLearningPathRepo.findById.mockResolvedValue({
        id: 'path-1',
        userId: mockUserId,
        type: 'SKILL_BASED',
        status: 'ACTIVE',
        targetSkillIds: [mockSkillId],
      });
      mockSkillGapRepo.findByUserId.mockResolvedValue({
        items: [{ ...mockSkillGap, status: 'IN_PROGRESS', currentLevel: 40 }],
        total: 1,
      });
      mockLearningPathRepo.update.mockResolvedValue({
        id: 'path-1',
        updatedAt: new Date(),
      });

      await pathGenerator.refreshPath({
        pathId: 'path-1',
        userId: mockUserId,
        tenantId: mockTenantId,
        reason: 'skill_gap_update',
      });

      expect(mockLearningPathRepo.update).toHaveBeenCalled();
    });
  });

  describe('refreshUserPaths', () => {
    it('should refresh all active paths for user', async () => {
      mockLearningPathRepo.findActive.mockResolvedValue([
        { id: 'path-1', status: 'ACTIVE' },
        { id: 'path-2', status: 'ACTIVE' },
      ]);
      mockLearningPathRepo.update.mockResolvedValue({});

      const result = await pathGenerator.refreshUserPaths({
        userId: mockUserId,
        tenantId: mockTenantId,
        reason: 'market_shift',
      });

      expect(result).toHaveLength(2);
      expect(mockLearningPathRepo.update).toHaveBeenCalledTimes(2);
    });
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('Recommendation System Integration', () => {
  let signalProcessor;
  let recommendationEngine;
  let pathGenerator;

  beforeEach(() => {
    vi.clearAllMocks();

    signalProcessor = createSignalProcessorService({
      learningProfileRepo: mockLearningProfileRepo,
      skillGapRepo: mockSkillGapRepo,
      signalRepo: mockMarketActivitySignalRepo,
      marketTrendRepo: mockMarketTrendRepo,
      redis: mockRedis,
      logger: mockLogger,
    });

    recommendationEngine = createRecommendationEngineService({
      learningProfileRepo: mockLearningProfileRepo,
      skillGapRepo: mockSkillGapRepo,
      recommendationRepo: mockRecommendationRepo,
      marketTrendRepo: mockMarketTrendRepo,
      redis: mockRedis,
      mlClient: mockMLClient,
      logger: mockLogger,
    });

    pathGenerator = createLearningPathGeneratorService({
      learningProfileRepo: mockLearningProfileRepo,
      skillGapRepo: mockSkillGapRepo,
      learningPathRepo: mockLearningPathRepo,
      recommendationRepo: mockRecommendationRepo,
      marketTrendRepo: mockMarketTrendRepo,
      redis: mockRedis,
      logger: mockLogger,
    });
  });

  it('should flow from job application to recommendation generation', async () => {
    // Step 1: Process job application
    mockMarketActivitySignalRepo.create.mockResolvedValue({ id: 'signal-1' });
    mockLearningProfileRepo.findByUserId.mockResolvedValue(mockLearningProfile);
    mockSkillGapRepo.createMany.mockResolvedValue({ count: 2 });

    await signalProcessor.processJobApplicationEvent(mockJobApplicationEvent);

    // Step 2: Generate recommendations
    mockRedis.get.mockResolvedValue(null);
    mockSkillGapRepo.findByUserId.mockResolvedValue({
      items: [
        { ...mockSkillGap, skillName: 'kubernetes' },
        { ...mockSkillGap, id: 'gap-2', skillName: 'terraform' },
      ],
      total: 2,
    });
    mockMLClient.getRecommendations.mockResolvedValue([
      { contentId: 'c1', title: 'K8s Course', score: 0.9 },
    ]);
    mockRecommendationRepo.createMany.mockResolvedValue({ count: 1 });
    mockRecommendationRepo.findByUserId.mockResolvedValue({
      items: [{ id: 'rec-1', title: 'K8s Course', score: 0.9 }],
      total: 1,
    });

    const recommendations = await recommendationEngine.generateRecommendations({
      userId: mockUserId,
      tenantId: mockTenantId,
      forceRefresh: true,
    });

    expect(recommendations).toHaveLength(1);

    // Step 3: Generate learning path
    mockLearningPathRepo.create.mockResolvedValue({
      id: 'path-1',
      userId: mockUserId,
      type: 'SKILL_BASED',
      status: 'ACTIVE',
    });

    const path = await pathGenerator.generatePath({
      userId: mockUserId,
      tenantId: mockTenantId,
      type: 'SKILL_BASED',
    });

    expect(path).toHaveProperty('id');
    expect(path.status).toBe('ACTIVE');
  });
});
