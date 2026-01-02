// @ts-nocheck
/**
 * Guild Reputation Service
 * Sprint M8: Guild & Agency Accounts
 *
 * Handles combined reputation calculation and weighted scores
 */

import { db } from '@skillancer/database';
import { logger } from '@skillancer/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface MemberReputationScore {
  userId: string;
  displayName: string;
  individualRating: number;
  reviewCount: number;
  projectsCompleted: number;
  weight: number;
  weightedContribution: number;
}

export interface GuildReputationScore {
  guildId: string;
  combinedRating: number;
  totalReviews: number;
  totalProjects: number;
  memberCount: number;
  verificationLevel: number;
  memberScores: MemberReputationScore[];
  breakdown: {
    memberAverage: number;
    guildBonus: number;
    verificationBonus: number;
    longevityBonus: number;
  };
}

export interface ReputationTrend {
  date: Date;
  rating: number;
  reviewCount: number;
  projectsCompleted: number;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const REPUTATION_CONFIG = {
  // Minimum weight for any member
  MIN_MEMBER_WEIGHT: 0.1,

  // Maximum weight for any single member
  MAX_MEMBER_WEIGHT: 0.4,

  // Base weight for projects completed
  PROJECTS_WEIGHT_FACTOR: 0.05,

  // Weight for role
  ROLE_WEIGHTS: {
    LEADER: 1.5,
    ADMIN: 1.2,
    MEMBER: 1.0,
    ASSOCIATE: 0.8,
  },

  // Verification bonus per level
  VERIFICATION_BONUS: 0.02,

  // Longevity bonus per year (max 0.1)
  LONGEVITY_BONUS_PER_YEAR: 0.02,
  MAX_LONGEVITY_BONUS: 0.1,

  // Guild-level completion bonus (projects done as guild)
  GUILD_PROJECT_BONUS_FACTOR: 0.01,
  MAX_GUILD_BONUS: 0.2,
};

// =============================================================================
// SERVICE
// =============================================================================

export class GuildReputationService {
  private log = logger.child({ service: 'GuildReputationService' });

  /**
   * Calculate combined guild reputation
   */
  async calculateGuildReputation(guildId: string): Promise<GuildReputationScore> {
    const guild = await db.guild.findUnique({
      where: { id: guildId },
      include: {
        members: {
          where: { status: 'ACTIVE' },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                firstName: true,
                lastName: true,
                verificationLevel: true,
              },
            },
          },
        },
        projects: {
          where: { status: 'COMPLETED' },
        },
      },
    });

    if (!guild) {
      throw new Error(`Guild not found: ${guildId}`);
    }

    // Get individual ratings for each member
    const memberScores: MemberReputationScore[] = [];
    let totalWeight = 0;

    for (const member of guild.members) {
      // Get user's individual rating from their reviews
      const reviews = await db.review.aggregate({
        where: { freelancerId: member.userId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      const individualRating = reviews._avg.rating ?? 0;
      const reviewCount = reviews._count.rating ?? 0;

      // Calculate member weight
      let weight = REPUTATION_CONFIG.ROLE_WEIGHTS[member.role];
      weight += member.projectsCompleted * REPUTATION_CONFIG.PROJECTS_WEIGHT_FACTOR;
      weight = Math.max(
        REPUTATION_CONFIG.MIN_MEMBER_WEIGHT,
        Math.min(REPUTATION_CONFIG.MAX_MEMBER_WEIGHT, weight)
      );

      totalWeight += weight;

      memberScores.push({
        userId: member.userId,
        displayName: member.user.displayName || `${member.user.firstName} ${member.user.lastName}`,
        individualRating,
        reviewCount,
        projectsCompleted: member.projectsCompleted,
        weight,
        weightedContribution: individualRating * weight,
      });
    }

    // Normalize weights and calculate weighted average
    let memberAverage = 0;
    if (totalWeight > 0) {
      for (const score of memberScores) {
        score.weight = score.weight / totalWeight;
        memberAverage += score.individualRating * score.weight;
      }
    }

    // Calculate bonuses
    const guildProjectCount = guild.projects.length;
    const guildBonus = Math.min(
      REPUTATION_CONFIG.MAX_GUILD_BONUS,
      guildProjectCount * REPUTATION_CONFIG.GUILD_PROJECT_BONUS_FACTOR
    );

    const verificationBonus = guild.verificationLevel * REPUTATION_CONFIG.VERIFICATION_BONUS;

    const yearsActive = (Date.now() - guild.createdAt.getTime()) / (365 * 24 * 60 * 60 * 1000);
    const longevityBonus = Math.min(
      REPUTATION_CONFIG.MAX_LONGEVITY_BONUS,
      yearsActive * REPUTATION_CONFIG.LONGEVITY_BONUS_PER_YEAR
    );

    // Calculate final combined rating (capped at 5.0)
    const combinedRating = Math.min(
      5.0,
      memberAverage + guildBonus + verificationBonus + longevityBonus
    );

    // Count total reviews
    const totalReviews = memberScores.reduce((sum, s) => sum + s.reviewCount, 0);

    const result: GuildReputationScore = {
      guildId,
      combinedRating: Math.round(combinedRating * 100) / 100,
      totalReviews,
      totalProjects: guildProjectCount,
      memberCount: guild.members.length,
      verificationLevel: guild.verificationLevel,
      memberScores,
      breakdown: {
        memberAverage: Math.round(memberAverage * 100) / 100,
        guildBonus: Math.round(guildBonus * 100) / 100,
        verificationBonus: Math.round(verificationBonus * 100) / 100,
        longevityBonus: Math.round(longevityBonus * 100) / 100,
      },
    };

    this.log.debug({ guildId, combinedRating }, 'Guild reputation calculated');

    return result;
  }

  /**
   * Update stored guild reputation score
   */
  async updateStoredReputation(guildId: string): Promise<void> {
    const score = await this.calculateGuildReputation(guildId);

    await db.guild.update({
      where: { id: guildId },
      data: {
        combinedRating: score.combinedRating,
        totalReviews: score.totalReviews,
        totalProjects: score.totalProjects,
      },
    });

    this.log.info({ guildId, combinedRating: score.combinedRating }, 'Guild reputation updated');
  }

  /**
   * Get reputation trend over time
   */
  async getReputationTrend(guildId: string, days: number = 90): Promise<ReputationTrend[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get all guild reviews over period
    const reviews = await db.guildReview.findMany({
      where: {
        guildId,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Get project completions
    const projects = await db.guildProject.findMany({
      where: {
        guildId,
        status: 'COMPLETED',
        completedAt: { gte: startDate },
      },
      orderBy: { completedAt: 'asc' },
    });

    // Build trend by week
    const trends: ReputationTrend[] = [];
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    let currentDate = new Date(startDate);
    let cumulativeRating = 0;
    let cumulativeReviews = 0;
    let cumulativeProjects = 0;
    let reviewIndex = 0;
    let projectIndex = 0;

    while (currentDate <= new Date()) {
      const weekEnd = new Date(currentDate.getTime() + weekMs);

      // Add reviews in this week
      while (reviewIndex < reviews.length && reviews[reviewIndex].createdAt < weekEnd) {
        cumulativeRating += reviews[reviewIndex].rating;
        cumulativeReviews++;
        reviewIndex++;
      }

      // Add projects in this week
      while (projectIndex < projects.length && projects[projectIndex].completedAt! < weekEnd) {
        cumulativeProjects++;
        projectIndex++;
      }

      trends.push({
        date: new Date(currentDate),
        rating: cumulativeReviews > 0 ? cumulativeRating / cumulativeReviews : 0,
        reviewCount: cumulativeReviews,
        projectsCompleted: cumulativeProjects,
      });

      currentDate = weekEnd;
    }

    return trends;
  }

  /**
   * Add a guild review
   */
  async addGuildReview(
    guildId: string,
    projectId: string,
    reviewerId: string,
    data: {
      rating: number;
      comment: string;
      deliveryRating?: number;
      communicationRating?: number;
      qualityRating?: number;
    }
  ): Promise<void> {
    // Validate rating
    if (data.rating < 1 || data.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Create review
    await db.guildReview.create({
      data: {
        guildId,
        projectId,
        reviewerId,
        rating: data.rating,
        comment: data.comment,
        deliveryRating: data.deliveryRating,
        communicationRating: data.communicationRating,
        qualityRating: data.qualityRating,
      },
    });

    // Update member stats for assigned members
    const assignments = await db.guildProjectAssignment.findMany({
      where: { guildProjectId: projectId },
    });

    for (const assignment of assignments) {
      await db.guildMember.update({
        where: { guildId_userId: { guildId, userId: assignment.memberId } },
        data: { projectsCompleted: { increment: 1 } },
      });
    }

    // Recalculate guild reputation
    await this.updateStoredReputation(guildId);

    this.log.info({ guildId, projectId, rating: data.rating }, 'Guild review added');
  }

  /**
   * Get guild reviews
   */
  async getGuildReviews(
    guildId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{
    reviews: {
      id: string;
      rating: number;
      comment: string;
      deliveryRating: number | null;
      communicationRating: number | null;
      qualityRating: number | null;
      createdAt: Date;
      reviewer: { id: string; displayName: string };
    }[];
    total: number;
  }> {
    const [reviews, total] = await Promise.all([
      db.guildReview.findMany({
        where: { guildId },
        include: {
          reviewer: {
            select: { id: true, displayName: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: options.limit ?? 20,
        skip: options.offset ?? 0,
      }),
      db.guildReview.count({ where: { guildId } }),
    ]);

    return {
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        deliveryRating: r.deliveryRating,
        communicationRating: r.communicationRating,
        qualityRating: r.qualityRating,
        createdAt: r.createdAt,
        reviewer: {
          id: r.reviewer.id,
          displayName: r.reviewer.displayName || `${r.reviewer.firstName} ${r.reviewer.lastName}`,
        },
      })),
      total,
    };
  }

  /**
   * Compare guild reputation to market average
   */
  async getMarketComparison(guildId: string): Promise<{
    guildRating: number;
    marketAverage: number;
    percentile: number;
    topGuilds: { id: string; name: string; rating: number }[];
  }> {
    const guild = await db.guild.findUnique({
      where: { id: guildId },
      select: { combinedRating: true },
    });

    if (!guild) {
      throw new Error(`Guild not found: ${guildId}`);
    }

    // Get market average
    const stats = await db.guild.aggregate({
      where: { status: 'ACTIVE' },
      _avg: { combinedRating: true },
      _count: { id: true },
    });

    // Calculate percentile
    const lowerRated = await db.guild.count({
      where: {
        status: 'ACTIVE',
        combinedRating: { lt: Number(guild.combinedRating) },
      },
    });

    const percentile = stats._count.id > 0 ? Math.round((lowerRated / stats._count.id) * 100) : 50;

    // Get top guilds
    const topGuilds = await db.guild.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, combinedRating: true },
      orderBy: { combinedRating: 'desc' },
      take: 10,
    });

    return {
      guildRating: Number(guild.combinedRating),
      marketAverage: Number(stats._avg.combinedRating ?? 0),
      percentile,
      topGuilds: topGuilds.map((g) => ({
        id: g.id,
        name: g.name,
        rating: Number(g.combinedRating),
      })),
    };
  }
}

export const guildReputationService = new GuildReputationService();

