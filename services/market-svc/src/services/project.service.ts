/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * Project Service
 *
 * Core service for managing projects (jobs):
 * - Create and update projects
 * - Publish and close projects
 * - Search projects
 * - Manage project skills
 */

import { BiddingError, BiddingErrorCode } from '../errors/bidding.errors.js';
import { ProjectRepository } from '../repositories/project.repository.js';

import type {
  CreateProjectInput,
  UpdateProjectInput,
  ProjectSearchParams,
  ProjectSearchResult,
  PaginatedResult,
  JobStatus,
} from '../types/bidding.types.js';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Cache TTLs
const PROJECT_CACHE_TTL = 300; // 5 minutes

export class ProjectService {
  private readonly repository: ProjectRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {
    this.repository = new ProjectRepository(prisma);
  }

  /**
   * Create a new project
   */
  async createProject(clientId: string, input: CreateProjectInput) {
    // Generate unique slug
    const slug = await this.generateUniqueSlug(input.title);

    const project = await this.repository.create({
      clientId,
      title: input.title,
      description: input.description,
      slug,
      budgetType: input.budgetType,
      ...(input.budgetMin !== undefined && { budgetMin: input.budgetMin }),
      ...(input.budgetMax !== undefined && { budgetMax: input.budgetMax }),
      ...(input.currency !== undefined && { currency: input.currency }),
      ...(input.duration !== undefined && { duration: input.duration }),
      ...(input.experienceLevel !== undefined && { experienceLevel: input.experienceLevel }),
      ...(input.location !== undefined && { location: input.location }),
      ...(input.isRemote !== undefined && { isRemote: input.isRemote }),
      ...(input.visibility !== undefined && { visibility: input.visibility }),
      ...(input.attachments !== undefined && { attachments: input.attachments }),
      ...(input.tags !== undefined && { tags: input.tags }),
    });

    // Add skills if provided
    if (input.skills && input.skills.length > 0) {
      await this.addSkillsToProject(project.id, input.skills);
    }

    this.logger.info({
      msg: 'Project created',
      projectId: project.id,
      clientId,
    });

    return this.getProject(project.id);
  }

  /**
   * Get a project by ID
   */
  async getProject(projectId: string) {
    // Try cache first
    const cacheKey = `project:${projectId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const project = await this.repository.findById(projectId);

    if (!project) {
      throw new BiddingError(BiddingErrorCode.PROJECT_NOT_FOUND);
    }

    // Cache the result
    await this.redis.setex(cacheKey, PROJECT_CACHE_TTL, JSON.stringify(project));

    return project;
  }

  /**
   * Get a project by slug
   */
  async getProjectBySlug(slug: string) {
    const project = await this.repository.findBySlug(slug);

    if (!project) {
      throw new BiddingError(BiddingErrorCode.PROJECT_NOT_FOUND);
    }

    return project;
  }

  /**
   * Update a project
   */
  async updateProject(projectId: string, userId: string, input: UpdateProjectInput) {
    const project = await this.repository.findById(projectId);

    if (!project) {
      throw new BiddingError(BiddingErrorCode.PROJECT_NOT_FOUND);
    }

    if (project.clientId !== userId) {
      throw new BiddingError(BiddingErrorCode.NOT_PROJECT_OWNER);
    }

    // Can only update draft or pending review projects
    if (!['DRAFT', 'PENDING_REVIEW'].includes(project.status)) {
      throw new BiddingError(
        BiddingErrorCode.INVALID_PROJECT_STATUS,
        'Cannot update a published project'
      );
    }

    const updateData: Record<string, unknown> = {};

    if (input.title) updateData.title = input.title;
    if (input.description) updateData.description = input.description;
    if (input.budgetType) updateData.budgetType = input.budgetType;
    if (input.budgetMin !== undefined) updateData.budgetMin = input.budgetMin;
    if (input.budgetMax !== undefined) updateData.budgetMax = input.budgetMax;
    if (input.currency) updateData.currency = input.currency;
    if (input.duration) updateData.duration = input.duration;
    if (input.experienceLevel) updateData.experienceLevel = input.experienceLevel;
    if (input.location !== undefined) updateData.location = input.location;
    if (input.isRemote !== undefined) updateData.isRemote = input.isRemote;
    if (input.visibility) updateData.visibility = input.visibility;
    if (input.attachments) updateData.attachments = input.attachments;
    if (input.tags) updateData.tags = input.tags;

    const updatedProject = await this.repository.update(projectId, updateData);

    // Update skills if provided
    if (input.skills) {
      await this.repository.removeAllSkills(projectId);
      if (input.skills.length > 0) {
        await this.addSkillsToProject(projectId, input.skills);
      }
    }

    // Invalidate cache
    await this.redis.del(`project:${projectId}`);

    this.logger.info({
      msg: 'Project updated',
      projectId,
      userId,
    });

    return this.getProject(updatedProject.id);
  }

  /**
   * Publish a project
   */
  async publishProject(projectId: string, userId: string) {
    const project = await this.repository.findById(projectId);

    if (!project) {
      throw new BiddingError(BiddingErrorCode.PROJECT_NOT_FOUND);
    }

    if (project.clientId !== userId) {
      throw new BiddingError(BiddingErrorCode.NOT_PROJECT_OWNER);
    }

    if (project.status === 'PUBLISHED') {
      throw new BiddingError(BiddingErrorCode.PROJECT_ALREADY_PUBLISHED);
    }

    if (project.status !== 'DRAFT' && project.status !== 'PENDING_REVIEW') {
      throw new BiddingError(
        BiddingErrorCode.INVALID_PROJECT_STATUS,
        'Project must be in draft status to publish'
      );
    }

    // Validate project has required fields
    this.validateProjectForPublishing(project);

    const publishedProject = await this.repository.publish(projectId);

    // Invalidate cache
    await this.redis.del(`project:${projectId}`);

    this.logger.info({
      msg: 'Project published',
      projectId,
      userId,
    });

    return publishedProject;
  }

  /**
   * Close a project
   */
  async closeProject(
    projectId: string,
    userId: string,
    reason: 'completed' | 'cancelled' = 'completed'
  ) {
    const project = await this.repository.findById(projectId);

    if (!project) {
      throw new BiddingError(BiddingErrorCode.PROJECT_NOT_FOUND);
    }

    if (project.clientId !== userId) {
      throw new BiddingError(BiddingErrorCode.NOT_PROJECT_OWNER);
    }

    // Check if project is already closed
    if (['CLOSED', 'COMPLETED', 'CANCELLED'].includes(project.status)) {
      throw new BiddingError(BiddingErrorCode.PROJECT_ALREADY_CLOSED);
    }

    const status = reason === 'completed' ? 'COMPLETED' : 'CANCELLED';
    const closedProject = await this.repository.close(projectId, status);

    // Invalidate cache
    await this.redis.del(`project:${projectId}`);

    this.logger.info({
      msg: 'Project closed',
      projectId,
      userId,
      status,
    });

    return closedProject;
  }

  /**
   * Delete a project (soft delete)
   */
  async deleteProject(projectId: string, userId: string) {
    const project = await this.repository.findById(projectId);

    if (!project) {
      throw new BiddingError(BiddingErrorCode.PROJECT_NOT_FOUND);
    }

    if (project.clientId !== userId) {
      throw new BiddingError(BiddingErrorCode.NOT_PROJECT_OWNER);
    }

    // Can only delete draft or cancelled projects
    if (!['DRAFT', 'CANCELLED'].includes(project.status)) {
      throw new BiddingError(
        BiddingErrorCode.INVALID_PROJECT_STATUS,
        'Cannot delete an active project'
      );
    }

    await this.repository.softDelete(projectId);

    // Invalidate cache
    await this.redis.del(`project:${projectId}`);

    this.logger.info({
      msg: 'Project deleted',
      projectId,
      userId,
    });
  }

  /**
   * Search projects
   */
  async searchProjects(params: ProjectSearchParams): Promise<PaginatedResult<ProjectSearchResult>> {
    const result = await this.repository.search(params);

    const projects: ProjectSearchResult[] = result.projects.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      description: p.description,
      budgetType: p.budgetType as ProjectSearchResult['budgetType'],
      budgetMin: p.budgetMin ? Number(p.budgetMin) : undefined,
      budgetMax: p.budgetMax ? Number(p.budgetMax) : undefined,
      currency: p.currency,
      duration: p.duration as ProjectSearchResult['duration'],
      experienceLevel: p.experienceLevel as ProjectSearchResult['experienceLevel'],
      isRemote: p.isRemote,
      location: p.location || undefined,
      skills: p.skills.map((s) => ({
        id: s.skill.id,
        name: s.skill.name,
        slug: s.skill.slug,
        category: s.skill.category,
      })),
      tags: p.tags,
      bidCount: p._count.bids,
      publishedAt: p.publishedAt || undefined,
      client: {
        id: p.client.id,
        displayName: p.client.displayName || '',
        avatarUrl: p.client.avatarUrl || undefined,
        rating: p.client.ratingAggregation?.clientAverageRating
          ? Number(p.client.ratingAggregation.clientAverageRating)
          : undefined,
        reviewCount: p.client.ratingAggregation?.clientTotalReviews,
        location: p.client.profile?.country || undefined,
      },
    }));

    return {
      data: projects,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      hasMore: result.page < result.totalPages,
    };
  }

  /**
   * Get projects by client
   */
  async getClientProjects(
    clientId: string,
    options: {
      status?: string | string[];
      page?: number;
      limit?: number;
    } = {}
  ) {
    const { status, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const result = await this.repository.findByClientId(clientId, {
      status: status as JobStatus | JobStatus[],
      limit,
      offset,
    });

    return {
      data: result.projects,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
      hasMore: page * limit < result.total,
    };
  }

  /**
   * Get project statistics
   */
  async getProjectStats(projectId: string, userId: string) {
    const project = await this.repository.findById(projectId);

    if (!project) {
      throw new BiddingError(BiddingErrorCode.PROJECT_NOT_FOUND);
    }

    if (project.clientId !== userId) {
      throw new BiddingError(BiddingErrorCode.NOT_PROJECT_OWNER);
    }

    return this.repository.getStats(projectId);
  }

  /**
   * Validate project is open for bidding
   */
  async validateProjectForBidding(projectId: string, freelancerId: string) {
    const project = await this.repository.findById(projectId);

    if (!project) {
      throw new BiddingError(BiddingErrorCode.PROJECT_NOT_FOUND);
    }

    if (project.status !== 'PUBLISHED') {
      throw new BiddingError(BiddingErrorCode.PROJECT_NOT_PUBLISHED);
    }

    if (project.clientId === freelancerId) {
      throw new BiddingError(BiddingErrorCode.CANNOT_BID_OWN_PROJECT);
    }

    if (project.expiresAt && new Date(project.expiresAt) < new Date()) {
      throw new BiddingError(BiddingErrorCode.PROJECT_EXPIRED);
    }

    return project;
  }

  /**
   * Add skills to a project
   */
  private async addSkillsToProject(projectId: string, skillSlugs: string[]) {
    // Find skill IDs by slugs
    const skills = await this.prisma.skill.findMany({
      where: {
        slug: { in: skillSlugs },
      },
      select: { id: true },
    });

    if (skills.length > 0) {
      await this.repository.addSkills(
        projectId,
        skills.map((s) => s.id)
      );
    }
  }

  /**
   * Generate a unique slug
   */
  private async generateUniqueSlug(title: string): Promise<string> {
    const baseSlug = title
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/(?:^-|-$)/g, '')
      .substring(0, 200);

    let slug = baseSlug;
    let counter = 1;

    while (await this.repository.findBySlug(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Validate project has required fields for publishing
   */
  private validateProjectForPublishing(project: Record<string, unknown>) {
    const errors: string[] = [];

    if (!project.title) errors.push('Title is required');
    if (!project.description) errors.push('Description is required');
    if (!project.budgetType) errors.push('Budget type is required');

    if (errors.length > 0) {
      throw new BiddingError(
        BiddingErrorCode.VALIDATION_ERROR,
        `Project cannot be published: ${errors.join(', ')}`
      );
    }
  }
}
