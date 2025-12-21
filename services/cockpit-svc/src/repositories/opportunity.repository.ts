/**
 * @module @skillancer/cockpit-svc/repositories/opportunity
 * Opportunity data access layer
 */

import type { OpportunitySearchParams } from '../types/crm.types.js';
import type {
  PrismaClient,
  Prisma,
  OpportunitySource,
  OpportunityStage,
  OpportunityStatus,
  CrmPriority,
} from '@skillancer/database';

export class OpportunityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new opportunity
   */
  async create(data: {
    freelancerUserId: string;
    clientId?: string | null;
    title: string;
    description?: string | null;
    source: OpportunitySource;
    sourceDetails?: string | null;
    externalUrl?: string | null;
    estimatedValue?: number | null;
    currency: string;
    expectedCloseDate?: Date | null;
    stage: OpportunityStage;
    probability: number;
    priority: CrmPriority;
    tags: string[];
    serviceType?: string | null;
    notes?: string | null;
    status: OpportunityStatus;
  }) {
    return this.prisma.opportunity.create({
      data: {
        freelancerUserId: data.freelancerUserId,
        clientId: data.clientId ?? null,
        title: data.title,
        description: data.description ?? null,
        source: data.source,
        sourceDetails: data.sourceDetails ?? null,
        externalUrl: data.externalUrl ?? null,
        estimatedValue: data.estimatedValue ?? null,
        currency: data.currency,
        expectedCloseDate: data.expectedCloseDate ?? null,
        stage: data.stage,
        probability: data.probability,
        priority: data.priority,
        tags: data.tags,
        serviceType: data.serviceType ?? null,
        notes: data.notes ?? null,
        status: data.status,
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
          },
        },
      },
    });
  }

  /**
   * Find an opportunity by ID
   */
  async findById(id: string) {
    return this.prisma.opportunity.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Find an opportunity by ID with full details
   */
  async findByIdWithDetails(id: string) {
    return this.prisma.opportunity.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
            email: true,
            avatarUrl: true,
          },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        interactions: {
          orderBy: { occurredAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  /**
   * Update an opportunity
   */
  async update(
    id: string,
    data: Partial<{
      clientId: string | null;
      title: string;
      description: string | null;
      source: OpportunitySource;
      sourceDetails: string | null;
      externalUrl: string | null;
      estimatedValue: number | null;
      currency: string;
      expectedCloseDate: Date | null;
      actualCloseDate: Date | null;
      stage: OpportunityStage;
      probability: number;
      priority: CrmPriority;
      tags: string[];
      serviceType: string | null;
      notes: string | null;
      status: OpportunityStatus;
      lostReason: string | null;
      wonContractId: string | null;
    }>
  ) {
    return this.prisma.opportunity.update({
      where: { id },
      data,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
          },
        },
      },
    });
  }

  /**
   * Find opportunities by freelancer
   */
  async findByFreelancer(
    freelancerUserId: string,
    options?: {
      status?: OpportunityStatus[];
      stage?: OpportunityStage[];
    }
  ) {
    return this.prisma.opportunity.findMany({
      where: {
        freelancerUserId,
        ...(options?.status && { status: { in: options.status } }),
        ...(options?.stage && { stage: { in: options.stage } }),
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Search opportunities with filters
   */
  async search(params: OpportunitySearchParams) {
    const {
      freelancerUserId,
      clientId,
      status,
      stage,
      priority,
      source,
      createdAfter,
      createdBefore,
      expectedCloseBefore,
      expectedCloseAfter,
      minValue,
      maxValue,
      tags,
      sortBy = 'created',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = params;

    const where: Prisma.OpportunityWhereInput = {
      freelancerUserId,
      ...(clientId && { clientId }),
      ...(status && status.length > 0 && { status: { in: status } }),
      ...(stage && stage.length > 0 && { stage: { in: stage } }),
      ...(priority && priority.length > 0 && { priority: { in: priority } }),
      ...(source && source.length > 0 && { source: { in: source } }),
      ...(createdAfter && { createdAt: { gte: createdAfter } }),
      ...(createdBefore && { createdAt: { lte: createdBefore } }),
      ...(expectedCloseBefore && { expectedCloseDate: { lte: expectedCloseBefore } }),
      ...(expectedCloseAfter && { expectedCloseDate: { gte: expectedCloseAfter } }),
      ...(minValue !== undefined && { estimatedValue: { gte: minValue } }),
      ...(maxValue !== undefined && { estimatedValue: { lte: maxValue } }),
      ...(tags && tags.length > 0 && { tags: { hasSome: tags } }),
    };

    const orderBy = this.getOrderBy(sortBy, sortOrder);

    const [opportunities, total] = await Promise.all([
      this.prisma.opportunity.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              companyName: true,
            },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.opportunity.count({ where }),
    ]);

    return { opportunities, total };
  }

  /**
   * Find opportunities by client
   */
  async findByClient(clientId: string) {
    return this.prisma.opportunity.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete an opportunity
   */
  async delete(id: string) {
    return this.prisma.opportunity.delete({
      where: { id },
    });
  }

  /**
   * Get order by clause
   */
  private getOrderBy(
    sortBy: string,
    sortOrder: 'asc' | 'desc'
  ): Prisma.OpportunityOrderByWithRelationInput {
    switch (sortBy) {
      case 'expectedClose':
        return { expectedCloseDate: sortOrder };
      case 'value':
        return { estimatedValue: sortOrder };
      case 'probability':
        return { probability: sortOrder };
      case 'created':
      default:
        return { createdAt: sortOrder };
    }
  }
}
