/**
 * @module @skillancer/skillpod-svc/repositories/recommendation/learning-recommendation
 * Learning Recommendation repository for database operations
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import type { PrismaClient, LearningRecommendation, Prisma } from '@prisma/client';
import type {
  RecommendationType,
  RecommendationStatus,
  ContentType,
  ProficiencyLevel,
} from '@skillancer/types';

// =============================================================================
// TYPES
// =============================================================================

export interface LearningRecommendationWithRelations extends LearningRecommendation {
  primarySkill?: {
    id: string;
    name: string;
    slug: string;
    category: string;
  } | null;
  skillGap?: {
    id: string;
    gapType: string;
    priority: string;
    gapScore: number;
  } | null;
  learningProfile?: {
    id: string;
    userId: string;
  };
}

export interface CreateLearningRecommendationInput {
  learningProfileId: string;
  recommendationType: RecommendationType;
  contentType: ContentType;
  title: string;
  description?: string;
  contentId?: string;
  contentSource: string;
  contentUrl?: string;
  contentProvider?: string;
  primarySkillId?: string;
  relatedSkillIds?: string[];
  targetLevel?: ProficiencyLevel;
  relevanceScore: number;
  urgencyScore: number;
  impactScore: number;
  confidenceScore: number;
  overallScore: number;
  generationMethod: string;
  generationModel?: string;
  triggerEventId?: string;
  skillGapId?: string;
  reasoningExplanation?: string;
  estimatedDuration?: number;
  estimatedDifficulty?: ProficiencyLevel;
  prerequisites?: string[];
  expiresAt?: Date;
}

export interface UpdateLearningRecommendationInput {
  title?: string;
  description?: string;
  relevanceScore?: number;
  urgencyScore?: number;
  impactScore?: number;
  confidenceScore?: number;
  overallScore?: number;
  status?: RecommendationStatus;
  viewedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  dismissedAt?: Date;
  dismissReason?: string;
  userFeedback?: number;
  userFeedbackText?: string;
  expiresAt?: Date;
}

export interface LearningRecommendationListFilter {
  learningProfileId?: string;
  recommendationType?: RecommendationType | RecommendationType[];
  contentType?: ContentType | ContentType[];
  status?: RecommendationStatus | RecommendationStatus[];
  primarySkillId?: string;
  skillGapId?: string;
  minOverallScore?: number;
  maxOverallScore?: number;
  contentSource?: string;
  generationMethod?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  notExpired?: boolean;
  hasUserFeedback?: boolean;
}

export interface LearningRecommendationListOptions {
  page?: number;
  limit?: number;
  orderBy?:
    | 'overallScore'
    | 'relevanceScore'
    | 'urgencyScore'
    | 'impactScore'
    | 'createdAt'
    | 'viewedAt';
  orderDirection?: 'asc' | 'desc';
  includeSkill?: boolean;
  includeGap?: boolean;
}

export interface RecommendationStats {
  total: number;
  byStatus: Record<RecommendationStatus, number>;
  byType: Record<RecommendationType, number>;
  byContentType: Record<ContentType, number>;
  averageScore: number;
  completionRate: number;
  averageFeedback: number;
}

// =============================================================================
// REPOSITORY INTERFACE
// =============================================================================

export interface LearningRecommendationRepository {
  create(input: CreateLearningRecommendationInput): Promise<LearningRecommendation>;
  createMany(inputs: CreateLearningRecommendationInput[]): Promise<number>;
  findById(id: string): Promise<LearningRecommendationWithRelations | null>;
  findMany(
    filter: LearningRecommendationListFilter,
    options?: LearningRecommendationListOptions
  ): Promise<{
    recommendations: LearningRecommendationWithRelations[];
    total: number;
  }>;
  findTopForProfile(
    learningProfileId: string,
    limit?: number
  ): Promise<LearningRecommendationWithRelations[]>;
  findBySkillGap(skillGapId: string): Promise<LearningRecommendationWithRelations[]>;
  update(id: string, input: UpdateLearningRecommendationInput): Promise<LearningRecommendation>;
  updateStatus(id: string, status: RecommendationStatus): Promise<LearningRecommendation>;
  markViewed(id: string): Promise<void>;
  markStarted(id: string): Promise<void>;
  markCompleted(id: string): Promise<void>;
  dismiss(id: string, reason?: string): Promise<void>;
  provideFeedback(id: string, rating: number, text?: string): Promise<void>;
  delete(id: string): Promise<void>;
  deleteExpired(): Promise<number>;
  getStats(learningProfileId: string): Promise<RecommendationStats>;
  findSimilar(
    recommendationId: string,
    limit?: number
  ): Promise<LearningRecommendationWithRelations[]>;
  refreshScores(learningProfileId: string): Promise<number>;
}

// =============================================================================
// REPOSITORY IMPLEMENTATION
// =============================================================================

export function createLearningRecommendationRepository(
  prisma: PrismaClient
): LearningRecommendationRepository {
  async function create(input: CreateLearningRecommendationInput): Promise<LearningRecommendation> {
    return prisma.learningRecommendation.create({
      data: {
        learningProfileId: input.learningProfileId,
        recommendationType: input.recommendationType,
        contentType: input.contentType,
        title: input.title,
        description: input.description,
        contentId: input.contentId,
        contentSource: input.contentSource,
        contentUrl: input.contentUrl,
        contentProvider: input.contentProvider,
        primarySkillId: input.primarySkillId,
        relatedSkillIds: input.relatedSkillIds ?? [],
        targetLevel: input.targetLevel,
        relevanceScore: input.relevanceScore,
        urgencyScore: input.urgencyScore,
        impactScore: input.impactScore,
        confidenceScore: input.confidenceScore,
        overallScore: input.overallScore,
        generationMethod: input.generationMethod,
        generationModel: input.generationModel,
        triggerEventId: input.triggerEventId,
        skillGapId: input.skillGapId,
        reasoningExplanation: input.reasoningExplanation,
        estimatedDuration: input.estimatedDuration,
        estimatedDifficulty: input.estimatedDifficulty,
        prerequisites: input.prerequisites ?? [],
        expiresAt: input.expiresAt,
      },
    });
  }

  async function createMany(inputs: CreateLearningRecommendationInput[]): Promise<number> {
    const result = await prisma.learningRecommendation.createMany({
      data: inputs.map((input) => ({
        learningProfileId: input.learningProfileId,
        recommendationType: input.recommendationType,
        contentType: input.contentType,
        title: input.title,
        description: input.description,
        contentId: input.contentId,
        contentSource: input.contentSource,
        contentUrl: input.contentUrl,
        contentProvider: input.contentProvider,
        primarySkillId: input.primarySkillId,
        relatedSkillIds: input.relatedSkillIds ?? [],
        targetLevel: input.targetLevel,
        relevanceScore: input.relevanceScore,
        urgencyScore: input.urgencyScore,
        impactScore: input.impactScore,
        confidenceScore: input.confidenceScore,
        overallScore: input.overallScore,
        generationMethod: input.generationMethod,
        generationModel: input.generationModel,
        triggerEventId: input.triggerEventId,
        skillGapId: input.skillGapId,
        reasoningExplanation: input.reasoningExplanation,
        estimatedDuration: input.estimatedDuration,
        estimatedDifficulty: input.estimatedDifficulty,
        prerequisites: input.prerequisites ?? [],
        expiresAt: input.expiresAt,
      })),
    });
    return result.count;
  }

  async function findById(id: string): Promise<LearningRecommendationWithRelations | null> {
    return prisma.learningRecommendation.findUnique({
      where: { id },
      include: {
        primarySkill: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
          },
        },
        skillGap: {
          select: {
            id: true,
            gapType: true,
            priority: true,
            gapScore: true,
          },
        },
        learningProfile: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });
  }

  async function findMany(
    filter: LearningRecommendationListFilter,
    options: LearningRecommendationListOptions = {}
  ): Promise<{
    recommendations: LearningRecommendationWithRelations[];
    total: number;
  }> {
    const { page = 1, limit = 20, orderBy = 'overallScore', orderDirection = 'desc' } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.LearningRecommendationWhereInput = {};

    if (filter.learningProfileId) where.learningProfileId = filter.learningProfileId;
    if (filter.recommendationType) {
      where.recommendationType = Array.isArray(filter.recommendationType)
        ? { in: filter.recommendationType }
        : filter.recommendationType;
    }
    if (filter.contentType) {
      where.contentType = Array.isArray(filter.contentType)
        ? { in: filter.contentType }
        : filter.contentType;
    }
    if (filter.status) {
      where.status = Array.isArray(filter.status) ? { in: filter.status } : filter.status;
    }
    if (filter.primarySkillId) where.primarySkillId = filter.primarySkillId;
    if (filter.skillGapId) where.skillGapId = filter.skillGapId;
    if (filter.minOverallScore !== undefined || filter.maxOverallScore !== undefined) {
      where.overallScore = {};
      if (filter.minOverallScore !== undefined) where.overallScore.gte = filter.minOverallScore;
      if (filter.maxOverallScore !== undefined) where.overallScore.lte = filter.maxOverallScore;
    }
    if (filter.contentSource) where.contentSource = filter.contentSource;
    if (filter.generationMethod) where.generationMethod = filter.generationMethod;
    if (filter.createdAfter || filter.createdBefore) {
      where.createdAt = {};
      if (filter.createdAfter) where.createdAt.gte = filter.createdAfter;
      if (filter.createdBefore) where.createdAt.lte = filter.createdBefore;
    }
    if (filter.notExpired) {
      where.OR = [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];
    }
    if (filter.hasUserFeedback !== undefined) {
      where.userFeedback = filter.hasUserFeedback ? { not: null } : null;
    }

    const include: Prisma.LearningRecommendationInclude = {};
    if (options.includeSkill) {
      include.primarySkill = {
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
        },
      };
    }
    if (options.includeGap) {
      include.skillGap = {
        select: {
          id: true,
          gapType: true,
          priority: true,
          gapScore: true,
        },
      };
    }
    include.learningProfile = {
      select: {
        id: true,
        userId: true,
      },
    };

    const [recommendations, total] = await Promise.all([
      prisma.learningRecommendation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderBy]: orderDirection },
        include,
      }),
      prisma.learningRecommendation.count({ where }),
    ]);

    return { recommendations, total };
  }

  async function findTopForProfile(
    learningProfileId: string,
    limit = 10
  ): Promise<LearningRecommendationWithRelations[]> {
    return prisma.learningRecommendation.findMany({
      where: {
        learningProfileId,
        status: { in: ['PENDING', 'VIEWED', 'STARTED', 'IN_PROGRESS'] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ overallScore: 'desc' }, { urgencyScore: 'desc' }],
      take: limit,
      include: {
        primarySkill: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
          },
        },
        skillGap: {
          select: {
            id: true,
            gapType: true,
            priority: true,
            gapScore: true,
          },
        },
        learningProfile: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });
  }

  async function findBySkillGap(
    skillGapId: string
  ): Promise<LearningRecommendationWithRelations[]> {
    return prisma.learningRecommendation.findMany({
      where: {
        skillGapId,
        status: { in: ['PENDING', 'VIEWED', 'STARTED', 'IN_PROGRESS'] },
      },
      orderBy: { overallScore: 'desc' },
      include: {
        primarySkill: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
          },
        },
        skillGap: {
          select: {
            id: true,
            gapType: true,
            priority: true,
            gapScore: true,
          },
        },
        learningProfile: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });
  }

  async function update(
    id: string,
    input: UpdateLearningRecommendationInput
  ): Promise<LearningRecommendation> {
    return prisma.learningRecommendation.update({
      where: { id },
      data: input,
    });
  }

  async function updateStatus(
    id: string,
    status: RecommendationStatus
  ): Promise<LearningRecommendation> {
    const data: Prisma.LearningRecommendationUpdateInput = { status };

    if (status === 'VIEWED') data.viewedAt = new Date();
    if (status === 'STARTED' || status === 'IN_PROGRESS') data.startedAt = new Date();
    if (status === 'COMPLETED') data.completedAt = new Date();

    return prisma.learningRecommendation.update({
      where: { id },
      data,
    });
  }

  async function markViewed(id: string): Promise<void> {
    await prisma.learningRecommendation.update({
      where: { id },
      data: {
        status: 'VIEWED',
        viewedAt: new Date(),
      },
    });
  }

  async function markStarted(id: string): Promise<void> {
    await prisma.learningRecommendation.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });
  }

  async function markCompleted(id: string): Promise<void> {
    await prisma.learningRecommendation.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  }

  async function dismiss(id: string, reason?: string): Promise<void> {
    await prisma.learningRecommendation.update({
      where: { id },
      data: {
        status: 'DISMISSED',
        dismissedAt: new Date(),
        dismissReason: reason,
      },
    });
  }

  async function provideFeedback(id: string, rating: number, text?: string): Promise<void> {
    await prisma.learningRecommendation.update({
      where: { id },
      data: {
        userFeedback: rating,
        userFeedbackText: text,
      },
    });
  }

  async function deleteRecommendation(id: string): Promise<void> {
    await prisma.learningRecommendation.delete({ where: { id } });
  }

  async function deleteExpired(): Promise<number> {
    const result = await prisma.learningRecommendation.deleteMany({
      where: {
        expiresAt: { lte: new Date() },
        status: { in: ['PENDING', 'VIEWED'] },
      },
    });
    return result.count;
  }

  async function getStats(learningProfileId: string): Promise<RecommendationStats> {
    const recommendations = await prisma.learningRecommendation.findMany({
      where: { learningProfileId },
      select: {
        status: true,
        recommendationType: true,
        contentType: true,
        overallScore: true,
        userFeedback: true,
      },
    });

    const byStatus = {} as Record<RecommendationStatus, number>;
    const byType = {} as Record<RecommendationType, number>;
    const byContentType = {} as Record<ContentType, number>;
    let totalScore = 0;
    let completedCount = 0;
    let feedbackSum = 0;
    let feedbackCount = 0;

    for (const rec of recommendations) {
      byStatus[rec.status as RecommendationStatus] =
        (byStatus[rec.status as RecommendationStatus] ?? 0) + 1;
      byType[rec.recommendationType as RecommendationType] =
        (byType[rec.recommendationType as RecommendationType] ?? 0) + 1;
      byContentType[rec.contentType as ContentType] =
        (byContentType[rec.contentType as ContentType] ?? 0) + 1;
      totalScore += rec.overallScore;

      if (rec.status === 'COMPLETED') completedCount++;
      if (rec.userFeedback !== null) {
        feedbackSum += rec.userFeedback;
        feedbackCount++;
      }
    }

    const actionable = recommendations.filter((r) =>
      ['PENDING', 'VIEWED', 'STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(r.status)
    ).length;

    return {
      total: recommendations.length,
      byStatus,
      byType,
      byContentType,
      averageScore: recommendations.length > 0 ? totalScore / recommendations.length : 0,
      completionRate: actionable > 0 ? completedCount / actionable : 0,
      averageFeedback: feedbackCount > 0 ? feedbackSum / feedbackCount : 0,
    };
  }

  async function findSimilar(
    recommendationId: string,
    limit = 5
  ): Promise<LearningRecommendationWithRelations[]> {
    const recommendation = await prisma.learningRecommendation.findUnique({
      where: { id: recommendationId },
      select: {
        learningProfileId: true,
        primarySkillId: true,
        recommendationType: true,
        contentType: true,
        relatedSkillIds: true,
      },
    });

    if (!recommendation) return [];

    const skillIds = [
      ...(recommendation.primarySkillId ? [recommendation.primarySkillId] : []),
      ...recommendation.relatedSkillIds,
    ];

    return prisma.learningRecommendation.findMany({
      where: {
        learningProfileId: recommendation.learningProfileId,
        id: { not: recommendationId },
        status: { in: ['PENDING', 'VIEWED', 'STARTED', 'IN_PROGRESS'] },
        OR: [
          { primarySkillId: { in: skillIds } },
          { relatedSkillIds: { hasSome: skillIds } },
          { recommendationType: recommendation.recommendationType },
        ],
      },
      orderBy: { overallScore: 'desc' },
      take: limit,
      include: {
        primarySkill: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
          },
        },
        skillGap: {
          select: {
            id: true,
            gapType: true,
            priority: true,
            gapScore: true,
          },
        },
        learningProfile: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });
  }

  async function refreshScores(learningProfileId: string): Promise<number> {
    // This would typically call an ML service to recalculate scores
    // For now, we just update the timestamp
    const result = await prisma.learningRecommendation.updateMany({
      where: {
        learningProfileId,
        status: { in: ['PENDING', 'VIEWED'] },
      },
      data: {
        updatedAt: new Date(),
      },
    });
    return result.count;
  }

  return {
    create,
    createMany,
    findById,
    findMany,
    findTopForProfile,
    findBySkillGap,
    update,
    updateStatus,
    markViewed,
    markStarted,
    markCompleted,
    dismiss,
    provideFeedback,
    delete: deleteRecommendation,
    deleteExpired,
    getStats,
    findSimilar,
    refreshScores,
  };
}
