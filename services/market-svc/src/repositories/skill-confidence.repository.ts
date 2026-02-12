// @ts-nocheck
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/**
 * @module @skillancer/market-svc/repositories/skill-confidence
 * Skill Confidence Repository
 *
 * NOTE: ESLint disabled for Prisma type errors - will be resolved after database migration
 */

import type { PrismaClient, SkillConfidence } from '@skillancer/database';

export interface UpsertSkillConfidenceData {
  userId: string;
  skillId: string;
  overallConfidence: number;
  assessmentScore?: number | null;
  learningScore?: number | null;
  experienceScore?: number | null;
  endorsementScore?: number | null;
  projectScore?: number | null;
  assessmentsPassed?: number;
  coursesCompleted?: number;
  hoursLearned?: number;
  projectsCompleted?: number;
  endorsementCount?: number;
  yearsExperience?: number | null;
  calculatedLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  claimedLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT' | null;
  levelMatch: boolean;
  confidenceTrend?: number;
  lastActivityDate?: Date | null;
}

export interface UpdateSkillConfidenceData {
  learningScore?: number;
  hoursLearned?: number;
  coursesCompleted?: number;
  assessmentsPassed?: number;
  lastActivityDate?: Date;
  overallConfidence?: number;
  calculatedLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  confidenceTrend?: number;
}

export class SkillConfidenceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsert(data: UpsertSkillConfidenceData): Promise<SkillConfidence> {
    return this.prisma.skillConfidence.upsert({
      where: {
        userId_skillId: {
          userId: data.userId,
          skillId: data.skillId,
        },
      },
      create: {
        userId: data.userId,
        skillId: data.skillId,
        overallConfidence: data.overallConfidence,
        assessmentScore: data.assessmentScore,
        learningScore: data.learningScore,
        experienceScore: data.experienceScore,
        endorsementScore: data.endorsementScore,
        projectScore: data.projectScore,
        assessmentsPassed: data.assessmentsPassed ?? 0,
        coursesCompleted: data.coursesCompleted ?? 0,
        hoursLearned: data.hoursLearned ?? 0,
        projectsCompleted: data.projectsCompleted ?? 0,
        endorsementCount: data.endorsementCount ?? 0,
        yearsExperience: data.yearsExperience,
        calculatedLevel: data.calculatedLevel,
        claimedLevel: data.claimedLevel,
        levelMatch: data.levelMatch,
        confidenceTrend: data.confidenceTrend ?? 0,
        lastActivityDate: data.lastActivityDate,
      },
      update: {
        overallConfidence: data.overallConfidence,
        assessmentScore: data.assessmentScore,
        learningScore: data.learningScore,
        experienceScore: data.experienceScore,
        endorsementScore: data.endorsementScore,
        projectScore: data.projectScore,
        assessmentsPassed: data.assessmentsPassed,
        coursesCompleted: data.coursesCompleted,
        hoursLearned: data.hoursLearned,
        projectsCompleted: data.projectsCompleted,
        endorsementCount: data.endorsementCount,
        yearsExperience: data.yearsExperience,
        calculatedLevel: data.calculatedLevel,
        claimedLevel: data.claimedLevel,
        levelMatch: data.levelMatch,
        confidenceTrend: data.confidenceTrend,
        lastActivityDate: data.lastActivityDate,
      },
    });
  }

  async findByUserAndSkill(userId: string, skillId: string): Promise<SkillConfidence | null> {
    return this.prisma.skillConfidence.findUnique({
      where: {
        userId_skillId: { userId, skillId },
      },
    });
  }

  async findByUser(userId: string): Promise<SkillConfidence[]> {
    return this.prisma.skillConfidence.findMany({
      where: { userId },
      orderBy: { overallConfidence: 'desc' },
    });
  }

  async findTopSkillsByUser(userId: string, limit: number = 10): Promise<SkillConfidence[]> {
    return this.prisma.skillConfidence.findMany({
      where: { userId },
      orderBy: { overallConfidence: 'desc' },
      take: limit,
    });
  }

  async findVerifiedSkillsByUser(userId: string): Promise<SkillConfidence[]> {
    return this.prisma.skillConfidence.findMany({
      where: {
        userId,
        assessmentScore: { not: null },
      },
      orderBy: { overallConfidence: 'desc' },
    });
  }

  async update(id: string, data: UpdateSkillConfidenceData): Promise<SkillConfidence> {
    return this.prisma.skillConfidence.update({
      where: { id },
      data,
    });
  }

  async countByLevel(
    userId: string
  ): Promise<Record<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT', number>> {
    const results = await this.prisma.skillConfidence.groupBy({
      by: ['calculatedLevel'],
      where: { userId },
      _count: true,
    });

    const counts: Record<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT', number> = {
      BEGINNER: 0,
      INTERMEDIATE: 0,
      ADVANCED: 0,
      EXPERT: 0,
    };

    for (const result of results) {
      counts[result.calculatedLevel] = result._count;
    }

    return counts;
  }

  async getAverageConfidence(userId: string): Promise<number | null> {
    const result = await this.prisma.skillConfidence.aggregate({
      where: { userId },
      _avg: { overallConfidence: true },
    });

    return result._avg.overallConfidence ? Number(result._avg.overallConfidence) : null;
  }

  async delete(userId: string, skillId: string): Promise<void> {
    await this.prisma.skillConfidence.delete({
      where: {
        userId_skillId: { userId, skillId },
      },
    });
  }
}
