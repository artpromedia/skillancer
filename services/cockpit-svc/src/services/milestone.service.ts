/**
 * @module @skillancer/cockpit-svc/services/milestone
 * Milestone Service - Milestone management functionality
 */

import { ProjectError, ProjectErrorCode } from '../errors/project.errors.js';
import {
  ProjectRepository,
  MilestoneRepository,
  ActivityRepository,
} from '../repositories/index.js';

import type {
  CreateMilestoneParams,
  UpdateMilestoneParams,
  MilestoneWithProgress,
  Deliverable,
} from '../types/project.types.js';
import type { PrismaClient, ProjectMilestone } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

export class MilestoneService {
  private readonly projectRepository: ProjectRepository;
  private readonly milestoneRepository: MilestoneRepository;
  private readonly activityRepository: ActivityRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger
  ) {
    this.projectRepository = new ProjectRepository(prisma);
    this.milestoneRepository = new MilestoneRepository(prisma);
    this.activityRepository = new ActivityRepository(prisma);
  }

  /**
   * Create a new milestone
   */
  async createMilestone(params: CreateMilestoneParams): Promise<ProjectMilestone> {
    // Verify project ownership
    const project = await this.projectRepository.findById(params.projectId);
    if (!project || project.freelancerUserId !== params.freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.PROJECT_NOT_FOUND);
    }

    const orderIndex = await this.milestoneRepository.getNextOrderIndex(params.projectId);

    const deliverables = params.deliverables?.map((d, i) => ({
      title: d.title,
      description: d.description,
      completed: false,
      orderIndex: i,
    }));

    const milestone = await this.milestoneRepository.create({
      projectId: params.projectId,
      title: params.title,
      description: params.description,
      orderIndex,
      dueDate: params.dueDate,
      amount: params.amount,
      deliverables,
      status: 'PENDING',
    });

    // Log activity
    await this.activityRepository.create({
      projectId: params.projectId,
      activityType: 'MILESTONE_CREATED',
      description: `Milestone "${params.title}" created`,
      milestoneId: milestone.id,
    });

    this.logger.info(
      { milestoneId: milestone.id, projectId: params.projectId },
      'Milestone created'
    );

    return milestone;
  }

  /**
   * Get milestone by ID
   */
  async getMilestoneById(milestoneId: string, freelancerUserId: string) {
    const milestone = await this.milestoneRepository.findByIdWithProject(milestoneId);
    if (!milestone) {
      throw new ProjectError(ProjectErrorCode.MILESTONE_NOT_FOUND);
    }

    if (milestone.project.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.ACCESS_DENIED);
    }

    return milestone;
  }

  /**
   * Get milestones by project
   */
  async getMilestonesByProject(
    projectId: string,
    freelancerUserId: string
  ): Promise<MilestoneWithProgress[]> {
    const project = await this.projectRepository.findById(projectId);
    if (project?.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.PROJECT_NOT_FOUND);
    }

    return this.milestoneRepository.findByProjectWithProgress(projectId);
  }

  /**
   * Update a milestone
   */
  async updateMilestone(
    milestoneId: string,
    freelancerUserId: string,
    updates: UpdateMilestoneParams
  ): Promise<ProjectMilestone> {
    const milestone = await this.milestoneRepository.findByIdWithProject(milestoneId);
    if (!milestone) {
      throw new ProjectError(ProjectErrorCode.MILESTONE_NOT_FOUND);
    }

    if (milestone.project.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.ACCESS_DENIED);
    }

    const oldStatus = milestone.status;
    const updateData: UpdateMilestoneParams & { completedAt?: Date | null } = { ...updates };

    // Handle completion
    if (updates.status === 'COMPLETED' && oldStatus !== 'COMPLETED') {
      updateData.completedAt = new Date();
    } else if (updates.status && updates.status !== 'COMPLETED' && milestone.completedAt) {
      updateData.completedAt = null;
    }

    const updatedMilestone = await this.milestoneRepository.update(milestoneId, updateData);

    // Log activity
    if (updates.status === 'COMPLETED' && oldStatus !== 'COMPLETED') {
      await this.activityRepository.create({
        projectId: milestone.projectId,
        activityType: 'MILESTONE_COMPLETED',
        description: `Milestone "${milestone.title}" completed`,
        milestoneId: milestone.id,
      });
    } else if (Object.keys(updates).length > 0) {
      await this.activityRepository.create({
        projectId: milestone.projectId,
        activityType: 'MILESTONE_UPDATED',
        description: `Milestone "${milestone.title}" updated`,
        milestoneId: milestone.id,
      });
    }

    this.logger.info({ milestoneId, updates: Object.keys(updates) }, 'Milestone updated');

    return updatedMilestone;
  }

  /**
   * Complete a milestone
   */
  async completeMilestone(
    milestoneId: string,
    freelancerUserId: string
  ): Promise<ProjectMilestone> {
    const milestone = await this.milestoneRepository.findByIdWithProject(milestoneId);
    if (!milestone) {
      throw new ProjectError(ProjectErrorCode.MILESTONE_NOT_FOUND);
    }

    if (milestone.project.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.ACCESS_DENIED);
    }

    if (milestone.status === 'COMPLETED') {
      throw new ProjectError(ProjectErrorCode.MILESTONE_ALREADY_COMPLETED);
    }

    const updated = await this.milestoneRepository.update(milestoneId, {
      status: 'COMPLETED',
      completedAt: new Date(),
    });

    await this.activityRepository.create({
      projectId: milestone.projectId,
      activityType: 'MILESTONE_COMPLETED',
      description: `Milestone "${milestone.title}" completed`,
      milestoneId: milestone.id,
    });

    this.logger.info({ milestoneId }, 'Milestone completed');

    return updated;
  }

  /**
   * Toggle deliverable completion
   */
  async toggleDeliverable(
    milestoneId: string,
    freelancerUserId: string,
    deliverableIndex: number
  ): Promise<ProjectMilestone> {
    const milestone = await this.milestoneRepository.findByIdWithProject(milestoneId);
    if (!milestone) {
      throw new ProjectError(ProjectErrorCode.MILESTONE_NOT_FOUND);
    }

    if (milestone.project.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.ACCESS_DENIED);
    }

    const deliverables = (milestone.deliverables as unknown as Deliverable[]) || [];
    if (deliverableIndex < 0 || deliverableIndex >= deliverables.length) {
      throw new ProjectError(ProjectErrorCode.VALIDATION_ERROR, {
        message: 'Invalid deliverable index',
      });
    }

    const deliverable = deliverables[deliverableIndex];
    if (deliverable) {
      deliverable.completed = !deliverable.completed;
    }

    return this.milestoneRepository.update(milestoneId, { deliverables });
  }

  /**
   * Delete a milestone
   */
  async deleteMilestone(milestoneId: string, freelancerUserId: string): Promise<void> {
    const milestone = await this.milestoneRepository.findByIdWithProject(milestoneId);
    if (!milestone) {
      throw new ProjectError(ProjectErrorCode.MILESTONE_NOT_FOUND);
    }

    if (milestone.project.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.ACCESS_DENIED);
    }

    await this.milestoneRepository.delete(milestoneId);

    this.logger.info({ milestoneId, projectId: milestone.projectId }, 'Milestone deleted');
  }

  /**
   * Reorder milestones
   */
  async reorderMilestones(
    projectId: string,
    freelancerUserId: string,
    orders: Array<{ milestoneId: string; orderIndex: number }>
  ): Promise<void> {
    const project = await this.projectRepository.findById(projectId);
    if (project?.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.PROJECT_NOT_FOUND);
    }

    // Validate all milestones belong to this project
    for (const order of orders) {
      const milestone = await this.milestoneRepository.findById(order.milestoneId);
      if (milestone?.projectId !== projectId) {
        throw new ProjectError(ProjectErrorCode.MILESTONE_NOT_FOUND);
      }
    }

    await this.milestoneRepository.updateOrders(orders);

    this.logger.info({ projectId, milestoneCount: orders.length }, 'Milestones reordered');
  }
}
