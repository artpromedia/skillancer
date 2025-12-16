/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * @module @skillancer/market-svc/repositories/project
 * Project (Job) data access layer
 */

import type {
  ProjectSearchParams,
  JobStatus,
  JobVisibility,
  BudgetType,
} from '../types/bidding.types.js';
import type { PrismaClient, Prisma, JobDuration, ExperienceLevel } from '@skillancer/database';

/**
 * Project Repository
 *
 * Handles database operations for projects/jobs.
 * Uses Prisma client for all database interactions.
 */
export class ProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new project
   */
  async create(data: {
    clientId: string;
    tenantId?: string;
    title: string;
    description: string;
    slug: string;
    status?: JobStatus;
    visibility?: JobVisibility;
    budgetType?: BudgetType;
    budgetMin?: number;
    budgetMax?: number;
    currency?: string;
    duration?: string;
    experienceLevel?: string;
    location?: string;
    isRemote?: boolean;
    attachments?: unknown[];
    tags?: string[];
  }) {
    return this.prisma.job.create({
      data: {
        clientId: data.clientId,
        tenantId: data.tenantId ?? null,
        title: data.title,
        description: data.description,
        slug: data.slug,
        status: data.status || 'DRAFT',
        visibility: data.visibility || 'PUBLIC',
        budgetType: data.budgetType || 'FIXED',
        budgetMin: data.budgetMin ?? null,
        budgetMax: data.budgetMax ?? null,
        currency: data.currency || 'USD',
        duration: (data.duration as JobDuration | undefined) ?? null,
        experienceLevel: (data.experienceLevel as ExperienceLevel | undefined) || 'INTERMEDIATE',
        location: data.location ?? null,
        isRemote: data.isRemote ?? true,
        attachments: (data.attachments || []) as unknown as Prisma.InputJsonValue,
        tags: data.tags || [],
      },
      include: {
        client: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        skills: {
          include: {
            skill: true,
          },
        },
      },
    });
  }

  /**
   * Find a project by ID
   */
  async findById(id: string) {
    return this.prisma.job.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            ratingAggregation: {
              select: {
                clientAverageRating: true,
                clientTotalReviews: true,
              },
            },
          },
        },
        skills: {
          include: {
            skill: true,
          },
        },
        _count: {
          select: {
            bids: true,
            invitations: true,
            questions: true,
          },
        },
      },
    });
  }

  /**
   * Find a project by slug
   */
  async findBySlug(slug: string) {
    return this.prisma.job.findUnique({
      where: { slug },
      include: {
        client: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            ratingAggregation: {
              select: {
                clientAverageRating: true,
                clientTotalReviews: true,
              },
            },
          },
        },
        skills: {
          include: {
            skill: true,
          },
        },
        _count: {
          select: {
            bids: true,
            invitations: true,
            questions: true,
          },
        },
      },
    });
  }

  /**
   * Find projects by client ID
   */
  async findByClientId(
    clientId: string,
    options: {
      status?: JobStatus | JobStatus[];
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const { status, limit = 20, offset = 0 } = options;

    const where: Prisma.JobWhereInput = {
      clientId,
      deletedAt: null,
    };

    if (status) {
      where.status = Array.isArray(status) ? { in: status } : status;
    }

    const [projects, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          skills: {
            include: {
              skill: true,
            },
          },
          _count: {
            select: {
              bids: true,
            },
          },
        },
      }),
      this.prisma.job.count({ where }),
    ]);

    return { projects, total };
  }

  /**
   * Search published projects
   */
  async search(params: ProjectSearchParams) {
    const {
      query,
      skills,
      budgetMin,
      budgetMax,
      budgetType,
      experienceLevel,
      duration,
      isRemote,
      location,
      status = 'PUBLISHED',
      page = 1,
      limit = 20,
      sortBy = 'newest',
    } = params;

    const where: Prisma.JobWhereInput = {
      deletedAt: null,
      status: status,
    };

    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (skills && skills.length > 0) {
      where.skills = {
        some: {
          skill: {
            slug: { in: skills },
          },
        },
      };
    }

    if (budgetMin !== undefined) {
      where.budgetMax = { gte: budgetMin };
    }

    if (budgetMax !== undefined) {
      where.budgetMin = { lte: budgetMax };
    }

    if (budgetType) {
      where.budgetType = budgetType;
    }

    if (experienceLevel) {
      where.experienceLevel = experienceLevel;
    }

    if (duration) {
      where.duration = duration;
    }

    if (isRemote !== undefined) {
      where.isRemote = isRemote;
    }

    if (location) {
      where.location = { contains: location, mode: 'insensitive' };
    }

    const orderBy: Prisma.JobOrderByWithRelationInput = this.getSortOrder(sortBy);

    const offset = (page - 1) * limit;

    const [projects, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        include: {
          client: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              profile: {
                select: {
                  country: true,
                },
              },
              ratingAggregation: {
                select: {
                  clientAverageRating: true,
                  clientTotalReviews: true,
                },
              },
            },
          },
          skills: {
            include: {
              skill: true,
            },
          },
          _count: {
            select: {
              bids: true,
            },
          },
        },
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      projects,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update a project
   */
  async update(id: string, data: Partial<Prisma.JobUpdateInput>) {
    return this.prisma.job.update({
      where: { id },
      data,
      include: {
        client: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        skills: {
          include: {
            skill: true,
          },
        },
      },
    });
  }

  /**
   * Publish a project
   */
  async publish(id: string) {
    return this.prisma.job.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
  }

  /**
   * Close a project
   */
  async close(id: string, status: 'COMPLETED' | 'CANCELLED' = 'COMPLETED') {
    return this.prisma.job.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Soft delete a project
   */
  async softDelete(id: string) {
    return this.prisma.job.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Add skills to a project
   */
  async addSkills(projectId: string, skillIds: string[]) {
    const data = skillIds.map((skillId) => ({
      jobId: projectId,
      skillId,
      required: true,
    }));

    await this.prisma.jobSkill.createMany({
      data,
      skipDuplicates: true,
    });
  }

  /**
   * Remove all skills from a project
   */
  async removeAllSkills(projectId: string) {
    await this.prisma.jobSkill.deleteMany({
      where: { jobId: projectId },
    });
  }

  /**
   * Check if project exists and is published
   */
  async isPublished(id: string): Promise<boolean> {
    const project = await this.prisma.job.findUnique({
      where: { id },
      select: { status: true, deletedAt: true },
    });

    return project?.status === 'PUBLISHED' && project.deletedAt === null;
  }

  /**
   * Check if user is the project owner
   */
  async isOwner(projectId: string, userId: string): Promise<boolean> {
    const project = await this.prisma.job.findUnique({
      where: { id: projectId },
      select: { clientId: true },
    });

    return project?.clientId === userId;
  }

  /**
   * Get project statistics
   */
  async getStats(projectId: string) {
    const [bids, invitations, questions] = await Promise.all([
      this.prisma.bid.aggregate({
        where: { jobId: projectId },
        _count: true,
        _avg: {
          proposedRate: true,
          qualityScore: true,
        },
      }),
      this.prisma.projectInvitation.count({
        where: { jobId: projectId },
      }),
      this.prisma.projectQuestion.count({
        where: { jobId: projectId },
      }),
    ]);

    return {
      bidCount: bids._count,
      averageBidAmount: bids._avg.proposedRate,
      averageQualityScore: bids._avg.qualityScore,
      invitationCount: invitations,
      questionCount: questions,
    };
  }

  /**
   * Get sort order based on sortBy parameter
   */
  private getSortOrder(sortBy: string): Prisma.JobOrderByWithRelationInput {
    switch (sortBy) {
      case 'newest':
        return { publishedAt: 'desc' };
      case 'budget_high':
        return { budgetMax: 'desc' };
      case 'budget_low':
        return { budgetMin: 'asc' };
      case 'bids_count':
        return { bids: { _count: 'desc' } };
      default:
        return { publishedAt: 'desc' };
    }
  }
}
