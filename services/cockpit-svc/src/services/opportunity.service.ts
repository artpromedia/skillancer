// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/services/opportunity
 * Opportunity Service - Sales pipeline and opportunity management
 */

import { CrmError, CrmErrorCode } from '../errors/crm.errors.js';
import {
  OpportunityRepository,
  OpportunityActivityRepository,
  ClientRepository,
} from '../repositories/index.js';

import type {
  CreateOpportunityParams,
  UpdateOpportunityParams,
  OpportunitySearchParams,
  OpportunitySummary,
  PipelineView,
  PipelineStage,
  OpportunityStats,
  OpportunityActivitySummary,
} from '../types/crm.types.js';
import type { PrismaClient, OpportunityStage, OpportunityStatus } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Stage probability defaults
const STAGE_PROBABILITIES: Record<OpportunityStage, number> = {
  LEAD: 10,
  QUALIFIED: 25,
  PROPOSAL: 50,
  NEGOTIATION: 75,
  WON: 100,
  LOST: 0,
};

// Cache TTLs
const PIPELINE_CACHE_TTL = 60; // 1 minute
const STATS_CACHE_TTL = 300; // 5 minutes

export class OpportunityService {
  private readonly opportunityRepository: OpportunityRepository;
  private readonly activityRepository: OpportunityActivityRepository;
  private readonly clientRepository: ClientRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {
    this.opportunityRepository = new OpportunityRepository(prisma);
    this.activityRepository = new OpportunityActivityRepository(prisma);
    this.clientRepository = new ClientRepository(prisma);
  }

  /**
   * Create a new opportunity
   */
  async createOpportunity(params: CreateOpportunityParams) {
    // Validate client if provided
    if (params.clientId) {
      const client = await this.clientRepository.findById(params.clientId);
      if (!client || client.freelancerUserId !== params.freelancerUserId) {
        throw new CrmError(CrmErrorCode.CLIENT_NOT_FOUND);
      }
    }

    const stage = params.stage || 'LEAD';
    const opportunity = await this.opportunityRepository.create({
      freelancerUserId: params.freelancerUserId,
      clientId: params.clientId,
      title: params.title,
      description: params.description,
      source: params.source,
      sourceDetails: params.sourceDetails,
      externalUrl: params.externalUrl,
      estimatedValue: params.estimatedValue,
      currency: params.currency || 'USD',
      expectedCloseDate: params.expectedCloseDate,
      stage,
      probability: STAGE_PROBABILITIES[stage],
      priority: params.priority || 'MEDIUM',
      tags: params.tags || [],
      serviceType: params.serviceType,
      notes: params.notes,
      status: 'OPEN',
    });

    // Log activity
    await this.logActivity(opportunity.id, {
      activityType: 'CREATED',
      description: 'Opportunity created',
      toStage: opportunity.stage,
    });

    // Invalidate pipeline cache
    await this.invalidatePipelineCache(params.freelancerUserId);

    this.logger.info(
      {
        opportunityId: opportunity.id,
        freelancerUserId: params.freelancerUserId,
        stage: opportunity.stage,
      },
      'Opportunity created'
    );

    return opportunity;
  }

  /**
   * Get an opportunity by ID
   */
  async getOpportunity(opportunityId: string, freelancerUserId: string) {
    const opportunity = await this.opportunityRepository.findByIdWithDetails(opportunityId);
    if (!opportunity) {
      throw new CrmError(CrmErrorCode.OPPORTUNITY_NOT_FOUND);
    }

    if (opportunity.freelancerUserId !== freelancerUserId) {
      throw new CrmError(CrmErrorCode.ACCESS_DENIED);
    }

    return opportunity;
  }

  /**
   * Update an opportunity
   */
  async updateOpportunity(
    opportunityId: string,
    freelancerUserId: string,
    updates: UpdateOpportunityParams
  ) {
    const opportunity = await this.opportunityRepository.findById(opportunityId);
    if (!opportunity) {
      throw new CrmError(CrmErrorCode.OPPORTUNITY_NOT_FOUND);
    }

    if (opportunity.freelancerUserId !== freelancerUserId) {
      throw new CrmError(CrmErrorCode.ACCESS_DENIED);
    }

    // Validate client if changing
    if (updates.clientId && updates.clientId !== opportunity.clientId) {
      const client = await this.clientRepository.findById(updates.clientId);
      if (client?.freelancerUserId !== freelancerUserId) {
        throw new CrmError(CrmErrorCode.CLIENT_NOT_FOUND);
      }
    }

    const updatedOpportunity = await this.opportunityRepository.update(opportunityId, updates);

    // Invalidate pipeline cache
    await this.invalidatePipelineCache(freelancerUserId);

    return updatedOpportunity;
  }

  /**
   * Update opportunity stage
   */
  async updateStage(
    opportunityId: string,
    freelancerUserId: string,
    newStage: OpportunityStage,
    notes?: string
  ) {
    const opportunity = await this.opportunityRepository.findById(opportunityId);
    if (!opportunity || opportunity.freelancerUserId !== freelancerUserId) {
      throw new CrmError(CrmErrorCode.OPPORTUNITY_NOT_FOUND);
    }

    // Check if opportunity is already closed
    if (opportunity.status !== 'OPEN' && opportunity.status !== 'ON_HOLD') {
      throw new CrmError(CrmErrorCode.OPPORTUNITY_CLOSED);
    }

    const oldStage = opportunity.stage;
    const newProbability = STAGE_PROBABILITIES[newStage];

    const updates: Partial<{
      stage: OpportunityStage;
      probability: number;
      status: OpportunityStatus;
      actualCloseDate: Date;
      lostReason: string | null;
    }> = {
      stage: newStage,
      probability: newProbability,
    };

    // Handle won/lost
    if (newStage === 'WON') {
      updates.status = 'WON';
      updates.actualCloseDate = new Date();
    } else if (newStage === 'LOST') {
      updates.status = 'LOST';
      updates.actualCloseDate = new Date();
      updates.lostReason = notes || null;
    }

    const updatedOpportunity = await this.opportunityRepository.update(opportunityId, updates);

    // Log activity
    const notesSuffix = notes ? `: ${notes}` : '';
    await this.logActivity(opportunityId, {
      activityType: 'STAGE_CHANGED',
      description: `Stage changed from ${oldStage} to ${newStage}${notesSuffix}`,
      fromStage: oldStage,
      toStage: newStage,
    });

    // Update client status if won
    if (newStage === 'WON' && opportunity.clientId) {
      await this.clientRepository.update(opportunity.clientId, {
        status: 'ACTIVE',
      });
    }

    // Invalidate pipeline cache
    await this.invalidatePipelineCache(freelancerUserId);

    this.logger.info({ opportunityId, oldStage, newStage }, 'Opportunity stage updated');

    return updatedOpportunity;
  }

  /**
   * Search opportunities
   */
  async searchOpportunities(params: OpportunitySearchParams) {
    return this.opportunityRepository.search(params);
  }

  /**
   * Get pipeline view
   */
  async getPipeline(freelancerUserId: string): Promise<PipelineView> {
    // Try cache first
    const cacheKey = `pipeline:${freelancerUserId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as PipelineView;
    }

    const opportunities = await this.opportunityRepository.findByFreelancer(freelancerUserId, {
      status: ['OPEN', 'ON_HOLD'],
    });

    // Initialize pipeline stages (excluding WON and LOST)
    const stageOrder: OpportunityStage[] = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION'];
    const stages: PipelineStage[] = stageOrder.map((stage) => ({
      stage,
      opportunities: [],
      count: 0,
      totalValue: 0,
      weightedValue: 0,
    }));

    // Group opportunities by stage
    for (const opp of opportunities) {
      const stageIndex = stageOrder.indexOf(opp.stage);
      const stage = stages[stageIndex];
      if (stageIndex >= 0 && stage) {
        const summary: OpportunitySummary = {
          id: opp.id,
          title: opp.title,
          description: opp.description,
          source: opp.source,
          stage: opp.stage,
          status: opp.status,
          priority: opp.priority,
          estimatedValue: opp.estimatedValue ? Number(opp.estimatedValue) : null,
          currency: opp.currency,
          probability: opp.probability,
          expectedCloseDate: opp.expectedCloseDate,
          actualCloseDate: opp.actualCloseDate,
          tags: opp.tags,
          serviceType: opp.serviceType,
          clientId: opp.clientId,
          client: opp.client
            ? {
                id: opp.client.id,
                displayName: this.getClientDisplayName(opp.client),
              }
            : null,
          createdAt: opp.createdAt,
          updatedAt: opp.updatedAt,
        };

        stage.opportunities.push(summary);
      }
    }

    // Calculate metrics
    let totalOpportunities = 0;
    let totalValue = 0;
    let weightedValue = 0;

    for (const stage of stages) {
      stage.count = stage.opportunities.length;
      stage.totalValue = stage.opportunities.reduce((sum, o) => sum + (o.estimatedValue || 0), 0);
      stage.weightedValue = stage.opportunities.reduce(
        (sum, o) => sum + (o.estimatedValue || 0) * (o.probability / 100),
        0
      );

      totalOpportunities += stage.count;
      totalValue += stage.totalValue;
      weightedValue += stage.weightedValue;
    }

    const pipeline: PipelineView = {
      stages,
      summary: {
        totalOpportunities,
        totalValue,
        weightedValue,
        avgDealSize: totalOpportunities > 0 ? totalValue / totalOpportunities : 0,
      },
    };

    // Cache the result
    await this.redis.setex(cacheKey, PIPELINE_CACHE_TTL, JSON.stringify(pipeline));

    return pipeline;
  }

  /**
   * Get opportunity statistics
   */
  async getOpportunityStats(
    freelancerUserId: string,
    period?: { start: Date; end: Date }
  ): Promise<OpportunityStats> {
    // Try cache first
    const cacheKey = `opportunity:stats:${freelancerUserId}:${period?.start?.toISOString() || 'all'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as OpportunityStats;
    }

    const { opportunities: allOpportunities } = await this.opportunityRepository.search({
      freelancerUserId,
      createdAfter: period?.start,
      createdBefore: period?.end,
      limit: 1000, // Get all for stats
    });

    const won = allOpportunities.filter((o) => o.status === 'WON');
    const lost = allOpportunities.filter((o) => o.status === 'LOST');
    const open = allOpportunities.filter((o) => o.status === 'OPEN' || o.status === 'ON_HOLD');

    const totalWonValue = won.reduce((sum, o) => sum + Number(o.estimatedValue || 0), 0);
    const totalLostValue = lost.reduce((sum, o) => sum + Number(o.estimatedValue || 0), 0);
    const totalOpenValue = open.reduce((sum, o) => sum + Number(o.estimatedValue || 0), 0);

    const stats: OpportunityStats = {
      total: allOpportunities.length,
      open: open.length,
      won: won.length,
      lost: lost.length,
      winRate:
        won.length + lost.length > 0
          ? Math.round((won.length / (won.length + lost.length)) * 100)
          : 0,
      totalWonValue,
      totalLostValue,
      totalOpenValue,
      avgDealSize: won.length > 0 ? totalWonValue / won.length : 0,
      avgTimeToClose: this.calculateAvgTimeToClose(won),
      bySource: this.groupBySource(allOpportunities),
      byStage: this.groupByStage(open),
    };

    // Cache the result
    await this.redis.setex(cacheKey, STATS_CACHE_TTL, JSON.stringify(stats));

    return stats;
  }

  /**
   * Get opportunity activities
   */
  async getOpportunityActivities(
    opportunityId: string,
    freelancerUserId: string,
    params?: { page?: number; limit?: number }
  ): Promise<{ activities: OpportunityActivitySummary[]; total: number }> {
    const opportunity = await this.opportunityRepository.findById(opportunityId);
    if (!opportunity || opportunity.freelancerUserId !== freelancerUserId) {
      throw new CrmError(CrmErrorCode.OPPORTUNITY_NOT_FOUND);
    }

    const activities = await this.activityRepository.findByOpportunity(opportunityId, params);
    const total = await this.activityRepository.countByOpportunity(opportunityId);

    return {
      activities: activities.map((a) => ({
        id: a.id,
        activityType: a.activityType,
        description: a.description,
        fromStage: a.fromStage,
        toStage: a.toStage,
        metadata: a.metadata as Record<string, unknown> | null,
        createdAt: a.createdAt,
      })),
      total,
    };
  }

  /**
   * Delete an opportunity
   */
  async deleteOpportunity(opportunityId: string, freelancerUserId: string): Promise<void> {
    const opportunity = await this.opportunityRepository.findById(opportunityId);
    if (!opportunity || opportunity.freelancerUserId !== freelancerUserId) {
      throw new CrmError(CrmErrorCode.OPPORTUNITY_NOT_FOUND);
    }

    await this.opportunityRepository.delete(opportunityId);

    // Invalidate pipeline cache
    await this.invalidatePipelineCache(freelancerUserId);

    this.logger.info({ opportunityId }, 'Opportunity deleted');
  }

  /**
   * Log an activity
   */
  private async logActivity(
    opportunityId: string,
    activity: {
      activityType: string;
      description: string;
      fromStage?: OpportunityStage;
      toStage?: OpportunityStage;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    await this.activityRepository.create({
      opportunityId,
      activityType: activity.activityType,
      description: activity.description,
      fromStage: activity.fromStage,
      toStage: activity.toStage,
      metadata: activity.metadata,
    });
  }

  /**
   * Calculate average time to close (in days)
   */
  private calculateAvgTimeToClose(
    wonOpportunities: Array<{
      createdAt: Date;
      actualCloseDate: Date | null;
    }>
  ): number {
    if (wonOpportunities.length === 0) return 0;

    const totalDays = wonOpportunities.reduce((sum, o) => {
      if (!o.actualCloseDate) return sum;
      const days = Math.floor(
        (o.actualCloseDate.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      return sum + days;
    }, 0);

    return Math.round(totalDays / wonOpportunities.length);
  }

  /**
   * Group opportunities by source
   */
  private groupBySource(opportunities: Array<{ source: string }>): Partial<Record<string, number>> {
    return opportunities.reduce(
      (acc, o) => {
        acc[o.source] = (acc[o.source] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  /**
   * Group opportunities by stage
   */
  private groupByStage(
    opportunities: Array<{ stage: OpportunityStage }>
  ): Partial<Record<OpportunityStage, number>> {
    return opportunities.reduce(
      (acc, o) => {
        acc[o.stage] = (acc[o.stage] || 0) + 1;
        return acc;
      },
      {} as Partial<Record<OpportunityStage, number>>
    );
  }

  /**
   * Get client display name
   */
  private getClientDisplayName(client: {
    companyName: string | null;
    firstName: string | null;
    lastName: string | null;
  }): string {
    if (client.companyName) {
      return client.companyName;
    }
    const parts = [client.firstName, client.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'Unknown Client';
  }

  /**
   * Invalidate pipeline cache
   */
  private async invalidatePipelineCache(freelancerUserId: string): Promise<void> {
    await this.redis.del(`pipeline:${freelancerUserId}`);
    // Also invalidate stats cache
    const keys = await this.redis.keys(`opportunity:stats:${freelancerUserId}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

