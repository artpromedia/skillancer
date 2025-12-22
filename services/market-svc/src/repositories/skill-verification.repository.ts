/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/**
 * @module @skillancer/market-svc/repositories/skill-verification
 * Skill Verification Repository
 *
 * NOTE: ESLint disabled for Prisma type errors - will be resolved after database migration
 */

import type { PrismaClient, Prisma, SkillVerification } from '@skillancer/database';

export interface UpsertSkillVerificationData {
  userId: string;
  skillId: string;
  verificationType:
    | 'ASSESSMENT'
    | 'COURSE_COMPLETION'
    | 'CERTIFICATION'
    | 'PEER_ENDORSEMENT'
    | 'CLIENT_REVIEW'
    | 'PROJECT_COMPLETION';
  credentialId?: string;
  score: number;
  maxScore?: number;
  percentile?: number;
  proficiencyLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  confidenceScore: number;
  confidenceFactors: Record<string, unknown>;
  proctored?: boolean;
  assessmentDuration?: number;
  questionBreakdown?: Record<string, unknown>;
  verifiedAt: Date;
  validUntil?: Date;
  isActive?: boolean;
  showOnProfile?: boolean;
  showScore?: boolean;
  showPercentile?: boolean;
}

export class SkillVerificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsert(data: UpsertSkillVerificationData): Promise<SkillVerification> {
    const existing = await this.prisma.skillVerification.findUnique({
      where: {
        userId_skillId_verificationType: {
          userId: data.userId,
          skillId: data.skillId,
          verificationType: data.verificationType,
        },
      },
    });

    if (existing) {
      return this.prisma.skillVerification.update({
        where: { id: existing.id },
        data: {
          credentialId: data.credentialId,
          score: data.score,
          maxScore: data.maxScore ?? 100,
          percentile: data.percentile,
          proficiencyLevel: data.proficiencyLevel,
          confidenceScore: data.confidenceScore,
          confidenceFactors: data.confidenceFactors as Prisma.JsonObject,
          proctored: data.proctored ?? false,
          assessmentDuration: data.assessmentDuration,
          questionBreakdown: data.questionBreakdown as Prisma.JsonObject,
          verifiedAt: data.verifiedAt,
          validUntil: data.validUntil,
          isActive: data.isActive ?? true,
          showOnProfile: data.showOnProfile ?? true,
          showScore: data.showScore ?? true,
          showPercentile: data.showPercentile ?? true,
        },
      });
    }

    return this.prisma.skillVerification.create({
      data: {
        userId: data.userId,
        skillId: data.skillId,
        verificationType: data.verificationType,
        credentialId: data.credentialId,
        score: data.score,
        maxScore: data.maxScore ?? 100,
        percentile: data.percentile,
        proficiencyLevel: data.proficiencyLevel,
        confidenceScore: data.confidenceScore,
        confidenceFactors: data.confidenceFactors as Prisma.JsonObject,
        proctored: data.proctored ?? false,
        assessmentDuration: data.assessmentDuration,
        questionBreakdown: data.questionBreakdown as Prisma.JsonObject,
        verifiedAt: data.verifiedAt,
        validUntil: data.validUntil,
        isActive: data.isActive ?? true,
        showOnProfile: data.showOnProfile ?? true,
        showScore: data.showScore ?? true,
        showPercentile: data.showPercentile ?? true,
      },
    });
  }

  async findById(id: string): Promise<SkillVerification | null> {
    return this.prisma.skillVerification.findUnique({
      where: { id },
    });
  }

  async findByUserAndSkill(userId: string, skillId: string): Promise<SkillVerification[]> {
    return this.prisma.skillVerification.findMany({
      where: { userId, skillId },
      orderBy: { verifiedAt: 'desc' },
    });
  }

  async findActiveByUserAndSkill(userId: string, skillId: string): Promise<SkillVerification[]> {
    return this.prisma.skillVerification.findMany({
      where: { userId, skillId, isActive: true },
      orderBy: { verifiedAt: 'desc' },
    });
  }

  async findByUser(userId: string): Promise<SkillVerification[]> {
    return this.prisma.skillVerification.findMany({
      where: { userId, isActive: true },
      orderBy: { verifiedAt: 'desc' },
    });
  }

  async findByCredential(credentialId: string): Promise<SkillVerification[]> {
    return this.prisma.skillVerification.findMany({
      where: { credentialId },
    });
  }

  async deactivateByCredential(
    userId: string,
    skillId: string,
    credentialId: string
  ): Promise<void> {
    await this.prisma.skillVerification.updateMany({
      where: { userId, skillId, credentialId },
      data: { isActive: false },
    });
  }

  async updateVisibility(
    id: string,
    options: { showOnProfile?: boolean; showScore?: boolean; showPercentile?: boolean }
  ): Promise<SkillVerification> {
    return this.prisma.skillVerification.update({
      where: { id },
      data: options,
    });
  }

  async countVerifiedSkills(userId: string): Promise<number> {
    const result = await this.prisma.skillVerification.groupBy({
      by: ['skillId'],
      where: {
        userId,
        isActive: true,
        verificationType: 'ASSESSMENT',
      },
    });
    return result.length;
  }

  async findExpired(): Promise<SkillVerification[]> {
    return this.prisma.skillVerification.findMany({
      where: {
        isActive: true,
        validUntil: { lt: new Date() },
      },
    });
  }

  async deactivate(id: string): Promise<void> {
    await this.prisma.skillVerification.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
