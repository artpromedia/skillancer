// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/repositories/opportunity-activity
 * Opportunity Activity data access layer
 */

import { Prisma } from '../types/prisma-shim.js';

import type { PrismaClient, OpportunityStage } from '../types/prisma-shim.js';

export class OpportunityActivityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new activity
   */
  async create(data: {
    opportunityId: string;
    activityType: string;
    description: string;
    fromStage?: OpportunityStage | null;
    toStage?: OpportunityStage | null;
    metadata?: Record<string, unknown> | null;
  }) {
    return this.prisma.opportunityActivity.create({
      data: {
        opportunityId: data.opportunityId,
        activityType: data.activityType,
        description: data.description,
        fromStage: data.fromStage ?? null,
        toStage: data.toStage ?? null,
        metadata: (data.metadata as Prisma.InputJsonValue) ?? Prisma.DbNull,
      },
    });
  }

  /**
   * Find activities by opportunity
   */
  async findByOpportunity(
    opportunityId: string,
    options?: {
      limit?: number;
      page?: number;
    }
  ) {
    const limit = options?.limit ?? 20;
    const page = options?.page ?? 1;

    return this.prisma.opportunityActivity.findMany({
      where: { opportunityId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  /**
   * Count activities by opportunity
   */
  async countByOpportunity(opportunityId: string) {
    return this.prisma.opportunityActivity.count({
      where: { opportunityId },
    });
  }
}
