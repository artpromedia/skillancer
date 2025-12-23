/**
 * Skill Rate Repository
 *
 * Repository for managing skill-based rate calculations and storage.
 */

import {
  type PrismaClient,
  Prisma,
  type SkillRate,
  type MarketPosition,
  type MarketDemand,
  type CompetitionLevel,
} from '@skillancer/database';
import { logger } from '@skillancer/logger';

import type { SkillRateCreateInput, SkillRateUpdateInput } from '@skillancer/types/cockpit';

export class SkillRateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create or update a skill rate
   */
  async upsert(data: SkillRateCreateInput): Promise<SkillRate> {
    try {
      return await this.prisma.skillRate.upsert({
        where: {
          userId_skillId: {
            userId: data.userId,
            skillId: data.skillId,
          },
        },
        create: {
          userId: data.userId,
          skillId: data.skillId,
          skillName: data.skillName,
          currentHourlyRate: data.currentHourlyRate
            ? new Prisma.Decimal(data.currentHourlyRate)
            : null,
          currentProjectRate: data.currentProjectRate
            ? new Prisma.Decimal(data.currentProjectRate)
            : null,
          currency: data.currency || 'USD',
          recommendedMinRate: data.recommendedMinRate
            ? new Prisma.Decimal(data.recommendedMinRate)
            : null,
          recommendedOptimalRate: data.recommendedOptimalRate
            ? new Prisma.Decimal(data.recommendedOptimalRate)
            : null,
          recommendedMaxRate: data.recommendedMaxRate
            ? new Prisma.Decimal(data.recommendedMaxRate)
            : null,
          confidenceScore: new Prisma.Decimal(data.confidenceScore),
          skillLevel: data.skillLevel,
          verificationScore: data.verificationScore
            ? new Prisma.Decimal(data.verificationScore)
            : null,
          experienceYears: data.experienceYears ? new Prisma.Decimal(data.experienceYears) : null,
          projectsCompleted: data.projectsCompleted,
          avgClientRating: data.avgClientRating ? new Prisma.Decimal(data.avgClientRating) : null,
          marketPosition: data.marketPosition || 'AVERAGE',
          marketDemand: data.marketDemand || 'MODERATE',
          competitionLevel: data.competitionLevel || 'MEDIUM',
          calculatedAt: data.calculatedAt,
          validUntil: data.validUntil,
        },
        update: {
          skillName: data.skillName,
          currentHourlyRate: data.currentHourlyRate
            ? new Prisma.Decimal(data.currentHourlyRate)
            : null,
          currentProjectRate: data.currentProjectRate
            ? new Prisma.Decimal(data.currentProjectRate)
            : null,
          currency: data.currency || 'USD',
          recommendedMinRate: data.recommendedMinRate
            ? new Prisma.Decimal(data.recommendedMinRate)
            : null,
          recommendedOptimalRate: data.recommendedOptimalRate
            ? new Prisma.Decimal(data.recommendedOptimalRate)
            : null,
          recommendedMaxRate: data.recommendedMaxRate
            ? new Prisma.Decimal(data.recommendedMaxRate)
            : null,
          confidenceScore: new Prisma.Decimal(data.confidenceScore),
          skillLevel: data.skillLevel,
          verificationScore: data.verificationScore
            ? new Prisma.Decimal(data.verificationScore)
            : null,
          experienceYears: data.experienceYears ? new Prisma.Decimal(data.experienceYears) : null,
          projectsCompleted: data.projectsCompleted,
          avgClientRating: data.avgClientRating ? new Prisma.Decimal(data.avgClientRating) : null,
          marketPosition: data.marketPosition || 'AVERAGE',
          marketDemand: data.marketDemand || 'MODERATE',
          competitionLevel: data.competitionLevel || 'MEDIUM',
          calculatedAt: data.calculatedAt,
          validUntil: data.validUntil,
        },
      });
    } catch (error) {
      logger.error('Failed to upsert skill rate', { error, data });
      throw error;
    }
  }

  /**
   * Update a skill rate
   */
  async update(skillId: string, userId: string, data: SkillRateUpdateInput): Promise<SkillRate> {
    try {
      const updateData: Prisma.SkillRateUpdateInput = {};

      if (data.currentHourlyRate !== undefined) {
        updateData.currentHourlyRate = data.currentHourlyRate
          ? new Prisma.Decimal(data.currentHourlyRate)
          : null;
      }
      if (data.currentProjectRate !== undefined) {
        updateData.currentProjectRate = data.currentProjectRate
          ? new Prisma.Decimal(data.currentProjectRate)
          : null;
      }
      if (data.currency !== undefined) {
        updateData.currency = data.currency;
      }
      if (data.recommendedMinRate !== undefined) {
        updateData.recommendedMinRate = data.recommendedMinRate
          ? new Prisma.Decimal(data.recommendedMinRate)
          : null;
      }
      if (data.recommendedOptimalRate !== undefined) {
        updateData.recommendedOptimalRate = data.recommendedOptimalRate
          ? new Prisma.Decimal(data.recommendedOptimalRate)
          : null;
      }
      if (data.recommendedMaxRate !== undefined) {
        updateData.recommendedMaxRate = data.recommendedMaxRate
          ? new Prisma.Decimal(data.recommendedMaxRate)
          : null;
      }
      if (data.confidenceScore !== undefined) {
        updateData.confidenceScore = new Prisma.Decimal(data.confidenceScore);
      }
      if (data.skillLevel !== undefined) {
        updateData.skillLevel = data.skillLevel;
      }
      if (data.verificationScore !== undefined) {
        updateData.verificationScore = data.verificationScore
          ? new Prisma.Decimal(data.verificationScore)
          : null;
      }
      if (data.experienceYears !== undefined) {
        updateData.experienceYears = data.experienceYears
          ? new Prisma.Decimal(data.experienceYears)
          : null;
      }
      if (data.projectsCompleted !== undefined) {
        updateData.projectsCompleted = data.projectsCompleted;
      }
      if (data.avgClientRating !== undefined) {
        updateData.avgClientRating = data.avgClientRating
          ? new Prisma.Decimal(data.avgClientRating)
          : null;
      }
      if (data.marketPosition !== undefined) {
        updateData.marketPosition = data.marketPosition;
      }
      if (data.marketDemand !== undefined) {
        updateData.marketDemand = data.marketDemand;
      }
      if (data.competitionLevel !== undefined) {
        updateData.competitionLevel = data.competitionLevel;
      }
      if (data.calculatedAt !== undefined) {
        updateData.calculatedAt = data.calculatedAt;
      }
      if (data.validUntil !== undefined) {
        updateData.validUntil = data.validUntil;
      }

      return await this.prisma.skillRate.update({
        where: {
          userId_skillId: {
            userId,
            skillId,
          },
        },
        data: updateData,
      });
    } catch (error) {
      logger.error('Failed to update skill rate', { error, skillId, userId, data });
      throw error;
    }
  }

  /**
   * Find skill rate by user and skill
   */
  async findByUserAndSkill(userId: string, skillId: string): Promise<SkillRate | null> {
    try {
      return await this.prisma.skillRate.findUnique({
        where: {
          userId_skillId: {
            userId,
            skillId,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to find skill rate', { error, userId, skillId });
      throw error;
    }
  }

  /**
   * Find all skill rates for a user
   */
  async findByUser(userId: string): Promise<SkillRate[]> {
    try {
      return await this.prisma.skillRate.findMany({
        where: { userId },
        orderBy: { recommendedOptimalRate: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to find skill rates for user', { error, userId });
      throw error;
    }
  }

  /**
   * Find valid (not expired) skill rates for a user
   */
  async findValidByUser(userId: string): Promise<SkillRate[]> {
    try {
      return await this.prisma.skillRate.findMany({
        where: {
          userId,
          validUntil: { gte: new Date() },
        },
        orderBy: { recommendedOptimalRate: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to find valid skill rates', { error, userId });
      throw error;
    }
  }

  /**
   * Find expired skill rates that need recalculation
   */
  async findExpired(limit: number = 100): Promise<SkillRate[]> {
    try {
      return await this.prisma.skillRate.findMany({
        where: {
          validUntil: { lt: new Date() },
        },
        take: limit,
        orderBy: { validUntil: 'asc' },
      });
    } catch (error) {
      logger.error('Failed to find expired skill rates', { error });
      throw error;
    }
  }

  /**
   * Get skill rates by market position
   */
  async findByMarketPosition(userId: string, position: MarketPosition): Promise<SkillRate[]> {
    try {
      return await this.prisma.skillRate.findMany({
        where: {
          userId,
          marketPosition: position,
        },
        orderBy: { recommendedOptimalRate: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to find skill rates by market position', { error, userId, position });
      throw error;
    }
  }

  /**
   * Get skill rates with high confidence (>= threshold)
   */
  async findHighConfidence(userId: string, threshold: number = 70): Promise<SkillRate[]> {
    try {
      return await this.prisma.skillRate.findMany({
        where: {
          userId,
          confidenceScore: { gte: threshold },
        },
        orderBy: { confidenceScore: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to find high confidence skill rates', { error, userId, threshold });
      throw error;
    }
  }

  /**
   * Get average recommended rate for a user
   */
  async getAverageRecommendedRate(userId: string): Promise<number | null> {
    try {
      const result = await this.prisma.skillRate.aggregate({
        where: { userId },
        _avg: {
          recommendedOptimalRate: true,
        },
      });
      return result._avg.recommendedOptimalRate?.toNumber() ?? null;
    } catch (error) {
      logger.error('Failed to get average recommended rate', { error, userId });
      throw error;
    }
  }

  /**
   * Delete a skill rate
   */
  async delete(userId: string, skillId: string): Promise<void> {
    try {
      await this.prisma.skillRate.delete({
        where: {
          userId_skillId: {
            userId,
            skillId,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to delete skill rate', { error, userId, skillId });
      throw error;
    }
  }

  /**
   * Delete all skill rates for a user
   */
  async deleteByUser(userId: string): Promise<number> {
    try {
      const result = await this.prisma.skillRate.deleteMany({
        where: { userId },
      });
      return result.count;
    } catch (error) {
      logger.error('Failed to delete skill rates for user', { error, userId });
      throw error;
    }
  }
}
