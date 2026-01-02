// @ts-nocheck
/**
 * @module @skillancer/skillpod-svc/repositories/recommendation/learning-profile
 * User Learning Profile repository for database operations
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import type { PrismaClient, UserLearningProfile, Prisma } from '@prisma/client';
import type {
  ContentType,
  LearningStyle,
  DifficultyPreference,
  ProficiencyLevel,
} from '@skillancer/types';

// =============================================================================
// TYPES
// =============================================================================

export interface UserLearningProfileWithRelations extends UserLearningProfile {
  skillGaps?: Array<{
    id: string;
    skillId: string;
    gapType: string;
    priority: string;
    gapScore: number;
    status: string;
  }>;
  learningPaths?: Array<{
    id: string;
    title: string;
    pathType: string;
    status: string;
    progressPercentage: number;
  }>;
  _count?: {
    skillGaps: number;
    learningRecommendations: number;
    marketActivitySignals: number;
    learningPaths: number;
  };
}

export interface CreateLearningProfileInput {
  userId: string;
  currentRole?: string;
  targetRole?: string;
  experienceLevel?: ProficiencyLevel;
  yearsOfExperience?: number;
  primaryIndustry?: string;
  targetIndustries?: string[];
  preferredContentTypes?: ContentType[];
  preferredLearningStyle?: LearningStyle;
  weeklyLearningHours?: number;
  preferredSessionLength?: number;
  preferredDifficulty?: DifficultyPreference;
  careerGoals?: string[];
  focusSkillIds?: string[];
  excludedSkillIds?: string[];
  priorityCategories?: string[];
}

export interface UpdateLearningProfileInput {
  currentRole?: string;
  targetRole?: string;
  experienceLevel?: ProficiencyLevel;
  yearsOfExperience?: number;
  primaryIndustry?: string;
  targetIndustries?: string[];
  preferredContentTypes?: ContentType[];
  preferredLearningStyle?: LearningStyle;
  weeklyLearningHours?: number;
  preferredSessionLength?: number;
  preferredDifficulty?: DifficultyPreference;
  careerGoals?: string[];
  focusSkillIds?: string[];
  excludedSkillIds?: string[];
  priorityCategories?: string[];
  learningVelocity?: number;
  engagementScore?: number;
  completionRate?: number;
  lastActiveAt?: Date;
  skillVector?: Record<string, number>;
  interestVector?: Record<string, number>;
  learningPatternVector?: Record<string, number>;
}

export interface LearningProfileListFilter {
  experienceLevel?: ProficiencyLevel;
  primaryIndustry?: string;
  hasActiveGaps?: boolean;
  hasActivePaths?: boolean;
  lastActiveAfter?: Date;
  lastActiveBefore?: Date;
}

export interface LearningProfileListOptions {
  page?: number;
  limit?: number;
  orderBy?: 'createdAt' | 'lastActiveAt' | 'engagementScore' | 'completionRate';
  orderDirection?: 'asc' | 'desc';
  includeRelations?: boolean;
}

// =============================================================================
// REPOSITORY INTERFACE
// =============================================================================

export interface LearningProfileRepository {
  create(input: CreateLearningProfileInput): Promise<UserLearningProfile>;
  findById(id: string): Promise<UserLearningProfileWithRelations | null>;
  findByUserId(userId: string): Promise<UserLearningProfileWithRelations | null>;
  findMany(
    filter: LearningProfileListFilter,
    options?: LearningProfileListOptions
  ): Promise<{
    profiles: UserLearningProfileWithRelations[];
    total: number;
  }>;
  update(id: string, input: UpdateLearningProfileInput): Promise<UserLearningProfile>;
  delete(id: string): Promise<void>;
  updateLastActive(id: string): Promise<void>;
  updateVectors(
    id: string,
    vectors: {
      skillVector?: Record<string, number>;
      interestVector?: Record<string, number>;
      learningPatternVector?: Record<string, number>;
    }
  ): Promise<void>;
  updateEngagementMetrics(
    id: string,
    metrics: {
      learningVelocity?: number;
      engagementScore?: number;
      completionRate?: number;
    }
  ): Promise<void>;
  getOrCreate(userId: string): Promise<UserLearningProfile>;
}

// =============================================================================
// REPOSITORY IMPLEMENTATION
// =============================================================================

export function createLearningProfileRepository(prisma: PrismaClient): LearningProfileRepository {
  async function create(input: CreateLearningProfileInput): Promise<UserLearningProfile> {
    return prisma.userLearningProfile.create({
      data: {
        userId: input.userId,
        currentRole: input.currentRole,
        targetRole: input.targetRole,
        experienceLevel: input.experienceLevel ?? 'INTERMEDIATE',
        yearsOfExperience: input.yearsOfExperience ?? 0,
        primaryIndustry: input.primaryIndustry,
        targetIndustries: input.targetIndustries ?? [],
        preferredContentTypes: input.preferredContentTypes ?? [],
        preferredLearningStyle: input.preferredLearningStyle ?? 'SELF_PACED',
        weeklyLearningHours: input.weeklyLearningHours ?? 5,
        preferredSessionLength: input.preferredSessionLength ?? 30,
        preferredDifficulty: input.preferredDifficulty ?? 'PROGRESSIVE',
        careerGoals: input.careerGoals ?? [],
        focusSkillIds: input.focusSkillIds ?? [],
        excludedSkillIds: input.excludedSkillIds ?? [],
        priorityCategories: input.priorityCategories ?? [],
      },
    });
  }

  async function findById(id: string): Promise<UserLearningProfileWithRelations | null> {
    return prisma.userLearningProfile.findUnique({
      where: { id },
      include: {
        skillGaps: {
          select: {
            id: true,
            skillId: true,
            gapType: true,
            priority: true,
            gapScore: true,
            status: true,
          },
          where: { status: { in: ['ACTIVE', 'IN_PROGRESS'] } },
          orderBy: { priorityScore: 'desc' },
          take: 10,
        },
        learningPaths: {
          select: {
            id: true,
            title: true,
            pathType: true,
            status: true,
            progressPercentage: true,
          },
          where: { status: { in: ['ACTIVE', 'PAUSED'] } },
          orderBy: { updatedAt: 'desc' },
          take: 5,
        },
        _count: {
          select: {
            skillGaps: true,
            learningRecommendations: true,
            marketActivitySignals: true,
            learningPaths: true,
          },
        },
      },
    });
  }

  async function findByUserId(userId: string): Promise<UserLearningProfileWithRelations | null> {
    return prisma.userLearningProfile.findUnique({
      where: { userId },
      include: {
        skillGaps: {
          select: {
            id: true,
            skillId: true,
            gapType: true,
            priority: true,
            gapScore: true,
            status: true,
          },
          where: { status: { in: ['ACTIVE', 'IN_PROGRESS'] } },
          orderBy: { priorityScore: 'desc' },
          take: 10,
        },
        learningPaths: {
          select: {
            id: true,
            title: true,
            pathType: true,
            status: true,
            progressPercentage: true,
          },
          where: { status: { in: ['ACTIVE', 'PAUSED'] } },
          orderBy: { updatedAt: 'desc' },
          take: 5,
        },
        _count: {
          select: {
            skillGaps: true,
            learningRecommendations: true,
            marketActivitySignals: true,
            learningPaths: true,
          },
        },
      },
    });
  }

  async function findMany(
    filter: LearningProfileListFilter,
    options: LearningProfileListOptions = {}
  ): Promise<{
    profiles: UserLearningProfileWithRelations[];
    total: number;
  }> {
    const { page = 1, limit = 20, orderBy = 'createdAt', orderDirection = 'desc' } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.UserLearningProfileWhereInput = {};

    if (filter.experienceLevel) {
      where.experienceLevel = filter.experienceLevel;
    }

    if (filter.primaryIndustry) {
      where.primaryIndustry = filter.primaryIndustry;
    }

    if (filter.hasActiveGaps) {
      where.skillGaps = {
        some: { status: { in: ['ACTIVE', 'IN_PROGRESS'] } },
      };
    }

    if (filter.hasActivePaths) {
      where.learningPaths = {
        some: { status: { in: ['ACTIVE', 'PAUSED'] } },
      };
    }

    if (filter.lastActiveAfter || filter.lastActiveBefore) {
      where.lastActiveAt = {};
      if (filter.lastActiveAfter) {
        where.lastActiveAt.gte = filter.lastActiveAfter;
      }
      if (filter.lastActiveBefore) {
        where.lastActiveAt.lte = filter.lastActiveBefore;
      }
    }

    const [profiles, total] = await Promise.all([
      prisma.userLearningProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderBy]: orderDirection },
        include: options.includeRelations
          ? {
              skillGaps: {
                select: {
                  id: true,
                  skillId: true,
                  gapType: true,
                  priority: true,
                  gapScore: true,
                  status: true,
                },
                where: { status: { in: ['ACTIVE', 'IN_PROGRESS'] } },
                take: 5,
              },
              learningPaths: {
                select: {
                  id: true,
                  title: true,
                  pathType: true,
                  status: true,
                  progressPercentage: true,
                },
                where: { status: { in: ['ACTIVE', 'PAUSED'] } },
                take: 3,
              },
              _count: {
                select: {
                  skillGaps: true,
                  learningRecommendations: true,
                  marketActivitySignals: true,
                  learningPaths: true,
                },
              },
            }
          : undefined,
      }),
      prisma.userLearningProfile.count({ where }),
    ]);

    return { profiles, total };
  }

  async function update(
    id: string,
    input: UpdateLearningProfileInput
  ): Promise<UserLearningProfile> {
    const data: Prisma.UserLearningProfileUpdateInput = {};

    if (input.currentRole !== undefined) data.currentRole = input.currentRole;
    if (input.targetRole !== undefined) data.targetRole = input.targetRole;
    if (input.experienceLevel !== undefined) data.experienceLevel = input.experienceLevel;
    if (input.yearsOfExperience !== undefined) data.yearsOfExperience = input.yearsOfExperience;
    if (input.primaryIndustry !== undefined) data.primaryIndustry = input.primaryIndustry;
    if (input.targetIndustries !== undefined) data.targetIndustries = input.targetIndustries;
    if (input.preferredContentTypes !== undefined) {
      data.preferredContentTypes = input.preferredContentTypes;
    }
    if (input.preferredLearningStyle !== undefined) {
      data.preferredLearningStyle = input.preferredLearningStyle;
    }
    if (input.weeklyLearningHours !== undefined) {
      data.weeklyLearningHours = input.weeklyLearningHours;
    }
    if (input.preferredSessionLength !== undefined) {
      data.preferredSessionLength = input.preferredSessionLength;
    }
    if (input.preferredDifficulty !== undefined) {
      data.preferredDifficulty = input.preferredDifficulty;
    }
    if (input.careerGoals !== undefined) data.careerGoals = input.careerGoals;
    if (input.focusSkillIds !== undefined) data.focusSkillIds = input.focusSkillIds;
    if (input.excludedSkillIds !== undefined) data.excludedSkillIds = input.excludedSkillIds;
    if (input.priorityCategories !== undefined) data.priorityCategories = input.priorityCategories;
    if (input.learningVelocity !== undefined) data.learningVelocity = input.learningVelocity;
    if (input.engagementScore !== undefined) data.engagementScore = input.engagementScore;
    if (input.completionRate !== undefined) data.completionRate = input.completionRate;
    if (input.lastActiveAt !== undefined) data.lastActiveAt = input.lastActiveAt;
    if (input.skillVector !== undefined) data.skillVector = input.skillVector;
    if (input.interestVector !== undefined) data.interestVector = input.interestVector;
    if (input.learningPatternVector !== undefined) {
      data.learningPatternVector = input.learningPatternVector;
    }

    return prisma.userLearningProfile.update({
      where: { id },
      data,
    });
  }

  async function deleteProfile(id: string): Promise<void> {
    await prisma.userLearningProfile.delete({
      where: { id },
    });
  }

  async function updateLastActive(id: string): Promise<void> {
    await prisma.userLearningProfile.update({
      where: { id },
      data: { lastActiveAt: new Date() },
    });
  }

  async function updateVectors(
    id: string,
    vectors: {
      skillVector?: Record<string, number>;
      interestVector?: Record<string, number>;
      learningPatternVector?: Record<string, number>;
    }
  ): Promise<void> {
    const data: Prisma.UserLearningProfileUpdateInput = {};

    if (vectors.skillVector) data.skillVector = vectors.skillVector;
    if (vectors.interestVector) data.interestVector = vectors.interestVector;
    if (vectors.learningPatternVector) data.learningPatternVector = vectors.learningPatternVector;

    await prisma.userLearningProfile.update({
      where: { id },
      data,
    });
  }

  async function updateEngagementMetrics(
    id: string,
    metrics: {
      learningVelocity?: number;
      engagementScore?: number;
      completionRate?: number;
    }
  ): Promise<void> {
    await prisma.userLearningProfile.update({
      where: { id },
      data: metrics,
    });
  }

  async function getOrCreate(userId: string): Promise<UserLearningProfile> {
    const existing = await prisma.userLearningProfile.findUnique({
      where: { userId },
    });

    if (existing) {
      return existing;
    }

    return prisma.userLearningProfile.create({
      data: {
        userId,
      },
    });
  }

  return {
    create,
    findById,
    findByUserId,
    findMany,
    update,
    delete: deleteProfile,
    updateLastActive,
    updateVectors,
    updateEngagementMetrics,
    getOrCreate,
  };
}

