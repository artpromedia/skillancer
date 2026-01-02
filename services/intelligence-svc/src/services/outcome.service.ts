import { PrismaClient } from '@prisma/client';
import {
  EngagementOutcomeCreateInput,
  OutcomeType,
  OutcomeRating,
  FreelancerAnalytics,
  ClientAnalytics,
} from '../types/intelligence.types';

export class OutcomeService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Record an engagement outcome
   */
  async recordOutcome(input: EngagementOutcomeCreateInput) {
    const outcome = await this.prisma.engagementOutcome.create({
      data: {
        contractId: input.contractId,
        clientId: input.clientId,
        freelancerId: input.freelancerId,
        outcomeType: input.outcomeType,
        rating: input.rating,
        score: input.score,
        metrics: input.metrics ? JSON.parse(JSON.stringify(input.metrics)) : null,
        clientFeedback: input.clientFeedback,
        freelancerFeedback: input.freelancerFeedback,
        lessonsLearned: input.lessonsLearned || [],
      },
    });

    // Update aggregated analytics
    await this.updateFreelancerAnalytics(input.freelancerId);
    await this.updateClientAnalytics(input.clientId);

    return outcome;
  }

  /**
   * Get outcome by ID
   */
  async getOutcomeById(id: string) {
    const outcome = await this.prisma.engagementOutcome.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        freelancer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return outcome;
  }

  /**
   * Get outcomes for a contract
   */
  async getContractOutcomes(contractId: string) {
    const outcomes = await this.prisma.engagementOutcome.findMany({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
    });

    return outcomes;
  }

  /**
   * Get freelancer outcomes
   */
  async getFreelancerOutcomes(freelancerId: string, options?: {
    outcomeType?: OutcomeType;
    rating?: OutcomeRating;
    page?: number;
    limit?: number;
  }) {
    const { outcomeType, rating, page = 1, limit = 20 } = options || {};

    const where: any = { freelancerId };
    if (outcomeType) where.outcomeType = outcomeType;
    if (rating) where.rating = rating;

    const [outcomes, total] = await Promise.all([
      this.prisma.engagementOutcome.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.engagementOutcome.count({ where }),
    ]);

    return {
      outcomes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get client outcomes
   */
  async getClientOutcomes(clientId: string, options?: {
    outcomeType?: OutcomeType;
    rating?: OutcomeRating;
    page?: number;
    limit?: number;
  }) {
    const { outcomeType, rating, page = 1, limit = 20 } = options || {};

    const where: any = { clientId };
    if (outcomeType) where.outcomeType = outcomeType;
    if (rating) where.rating = rating;

    const [outcomes, total] = await Promise.all([
      this.prisma.engagementOutcome.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          freelancer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.engagementOutcome.count({ where }),
    ]);

    return {
      outcomes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Calculate and update freelancer analytics
   */
  async updateFreelancerAnalytics(freelancerId: string): Promise<FreelancerAnalytics> {
    const outcomes = await this.prisma.engagementOutcome.findMany({
      where: { freelancerId },
    });

    if (outcomes.length === 0) {
      return {
        userId: freelancerId,
        totalProjects: 0,
        successRate: 0,
        averageRating: 0,
        onTimeDeliveryRate: 0,
        budgetAdherenceRate: 0,
        repeatClientRate: 0,
        strengthAreas: [],
        improvementAreas: [],
        recentTrend: 'STABLE',
      };
    }

    const totalProjects = outcomes.length;
    const successfulOutcomes = outcomes.filter(
      (o) => ['EXCEPTIONAL', 'SUCCESSFUL', 'SATISFACTORY'].includes(o.rating)
    );
    const successRate = (successfulOutcomes.length / totalProjects) * 100;

    const totalScore = outcomes.reduce((sum, o) => sum + Number(o.score), 0);
    const averageRating = totalScore / totalProjects;

    // Calculate on-time delivery rate from metrics
    let onTimeCount = 0;
    let budgetAdherenceCount = 0;

    for (const o of outcomes) {
      const metrics = o.metrics as any;
      if (metrics?.timelineVariance !== undefined && metrics.timelineVariance <= 0) {
        onTimeCount++;
      }
      if (metrics?.budgetVariance !== undefined && metrics.budgetVariance <= 0.1) {
        budgetAdherenceCount++;
      }
    }

    const onTimeDeliveryRate = (onTimeCount / totalProjects) * 100;
    const budgetAdherenceRate = (budgetAdherenceCount / totalProjects) * 100;

    // Calculate repeat client rate
    const clientIds = outcomes.map((o) => o.clientId);
    const uniqueClients = new Set(clientIds);
    const repeatClients = clientIds.length - uniqueClients.size;
    const repeatClientRate = uniqueClients.size > 0
      ? (repeatClients / (clientIds.length - repeatClients)) * 100
      : 0;

    // Analyze strengths and improvements
    const strengthAreas: string[] = [];
    const improvementAreas: string[] = [];

    if (successRate >= 90) strengthAreas.push('Project Success');
    else if (successRate < 70) improvementAreas.push('Project Success');

    if (onTimeDeliveryRate >= 90) strengthAreas.push('On-time Delivery');
    else if (onTimeDeliveryRate < 70) improvementAreas.push('On-time Delivery');

    if (budgetAdherenceRate >= 90) strengthAreas.push('Budget Management');
    else if (budgetAdherenceRate < 70) improvementAreas.push('Budget Management');

    if (repeatClientRate >= 30) strengthAreas.push('Client Retention');
    else if (repeatClientRate < 10 && totalProjects >= 5) improvementAreas.push('Client Retention');

    // Calculate recent trend (last 5 vs previous 5)
    const recentOutcomes = outcomes.slice(0, 5);
    const previousOutcomes = outcomes.slice(5, 10);

    let recentTrend: 'IMPROVING' | 'STABLE' | 'DECLINING' = 'STABLE';
    if (previousOutcomes.length >= 3) {
      const recentAvg = recentOutcomes.reduce((s, o) => s + Number(o.score), 0) / recentOutcomes.length;
      const previousAvg = previousOutcomes.reduce((s, o) => s + Number(o.score), 0) / previousOutcomes.length;

      if (recentAvg > previousAvg + 0.5) recentTrend = 'IMPROVING';
      else if (recentAvg < previousAvg - 0.5) recentTrend = 'DECLINING';
    }

    return {
      userId: freelancerId,
      totalProjects,
      successRate,
      averageRating,
      onTimeDeliveryRate,
      budgetAdherenceRate,
      repeatClientRate,
      strengthAreas,
      improvementAreas,
      recentTrend,
    };
  }

  /**
   * Calculate and update client analytics
   */
  async updateClientAnalytics(clientId: string): Promise<ClientAnalytics> {
    const outcomes = await this.prisma.engagementOutcome.findMany({
      where: { clientId },
    });

    if (outcomes.length === 0) {
      return {
        userId: clientId,
        totalProjects: 0,
        averageProjectSize: 0,
        averageProjectDuration: 0,
        freelancerRetentionRate: 0,
        communicationScore: 0,
        paymentReliability: 100,
        scopeStabilityScore: 100,
      };
    }

    const totalProjects = outcomes.length;

    // Calculate freelancer retention
    const freelancerIds = outcomes.map((o) => o.freelancerId);
    const uniqueFreelancers = new Set(freelancerIds);
    const repeatFreelancers = freelancerIds.length - uniqueFreelancers.size;
    const freelancerRetentionRate = uniqueFreelancers.size > 0
      ? (repeatFreelancers / (freelancerIds.length - repeatFreelancers)) * 100
      : 0;

    // Calculate communication and scope scores from metrics
    let communicationTotal = 0;
    let communicationCount = 0;
    let scopeChangesTotal = 0;
    let scopeChangeCount = 0;

    for (const o of outcomes) {
      const metrics = o.metrics as any;
      if (metrics?.communicationScore !== undefined) {
        communicationTotal += metrics.communicationScore;
        communicationCount++;
      }
      if (metrics?.scopeChanges !== undefined) {
        scopeChangesTotal += metrics.scopeChanges;
        scopeChangeCount++;
      }
    }

    const communicationScore = communicationCount > 0
      ? communicationTotal / communicationCount
      : 0;

    // Scope stability is inverse of scope changes (fewer changes = more stable)
    const avgScopeChanges = scopeChangeCount > 0
      ? scopeChangesTotal / scopeChangeCount
      : 0;
    const scopeStabilityScore = Math.max(0, 100 - avgScopeChanges * 20);

    return {
      userId: clientId,
      totalProjects,
      averageProjectSize: 0, // Would need contract data
      averageProjectDuration: 0, // Would need contract data
      freelancerRetentionRate,
      communicationScore,
      paymentReliability: 100, // Would need payment data
      scopeStabilityScore,
    };
  }

  /**
   * Get freelancer analytics
   */
  async getFreelancerAnalytics(freelancerId: string): Promise<FreelancerAnalytics> {
    return this.updateFreelancerAnalytics(freelancerId);
  }

  /**
   * Get client analytics
   */
  async getClientAnalytics(clientId: string): Promise<ClientAnalytics> {
    return this.updateClientAnalytics(clientId);
  }

  /**
   * Get aggregate outcome statistics
   */
  async getOutcomeStats(options?: { category?: string; timeRange?: string }) {
    const where: any = {};

    if (options?.timeRange) {
      const now = new Date();
      const ranges: Record<string, number> = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '365d': 365,
      };
      const days = ranges[options.timeRange] || 30;
      where.createdAt = { gte: new Date(now.getTime() - days * 24 * 60 * 60 * 1000) };
    }

    const [total, byRating, byType, avgScore] = await Promise.all([
      this.prisma.engagementOutcome.count({ where }),
      this.prisma.engagementOutcome.groupBy({
        by: ['rating'],
        where,
        _count: true,
      }),
      this.prisma.engagementOutcome.groupBy({
        by: ['outcomeType'],
        where,
        _count: true,
      }),
      this.prisma.engagementOutcome.aggregate({
        where,
        _avg: { score: true },
      }),
    ]);

    return {
      totalOutcomes: total,
      averageScore: avgScore._avg.score || 0,
      byRating: byRating.map((r) => ({
        rating: r.rating,
        count: r._count,
      })),
      byType: byType.map((t) => ({
        type: t.outcomeType,
        count: t._count,
      })),
    };
  }
}
