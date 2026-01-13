/**
 * @module @skillancer/cockpit-svc/workers/project-progress
 * Project Progress Worker - Automatically updates project progress based on tasks
 */

import type { PrismaClient } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';

// Default interval: 15 minutes
const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;

export class ProjectProgressWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
    private readonly intervalMs: number = DEFAULT_INTERVAL_MS
  ) {}

  /**
   * Start the worker
   */
  start(): void {
    if (this.intervalId) {
      this.logger.warn('Project progress worker already running');
      return;
    }

    this.logger.info({ intervalMs: this.intervalMs }, 'Starting project progress worker');

    // Run immediately on start
    void this.run();

    // Schedule periodic runs
    this.intervalId = setInterval(() => {
      void this.run();
    }, this.intervalMs);
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info('Project progress worker stopped');
    }
  }

  /**
   * Run a single processing cycle
   */
  async run(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Project progress worker already processing, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.debug('Project progress worker starting processing cycle');

      // Get all active projects with tasks
      const projects = await this.prisma.cockpitProject.findMany({
        where: {
          status: { in: ['NOT_STARTED', 'IN_PROGRESS', 'ON_HOLD'] },
        },
        include: {
          tasks: {
            where: {
              parentTaskId: null, // Only top-level tasks
            },
            select: {
              id: true,
              status: true,
              estimatedMinutes: true,
            },
          },
          milestones: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      let updatedCount = 0;

      for (const project of projects) {
        const newProgress = this.calculateProgress(project);
        const currentProgress = project.progressPercent || 0;

        // Only update if progress changed
        if (Math.abs(newProgress - currentProgress) >= 1) {
          // Determine status update based on progress
          let statusUpdate: Record<string, unknown> = {};
          if (newProgress >= 100 && project.status !== 'COMPLETED') {
            statusUpdate = { status: 'COMPLETED', actualEndDate: new Date() };
          } else if (newProgress > 0 && project.status === 'NOT_STARTED') {
            statusUpdate = { status: 'IN_PROGRESS' };
          }

          await this.prisma.cockpitProject.update({
            where: { id: project.id },
            data: {
              progressPercent: newProgress,
              ...statusUpdate,
            },
          });

          // Log activity for significant progress changes
          if (Math.abs(newProgress - currentProgress) >= 10 || newProgress === 100) {
            await this.prisma.projectActivity.create({
              data: {
                projectId: project.id,
                activityType: 'PROGRESS_UPDATED',
                description: `Progress updated: ${currentProgress}% → ${newProgress}%`,
              },
            });
          }

          updatedCount++;

          this.logger.debug(
            {
              projectId: project.id,
              oldProgress: currentProgress,
              newProgress,
            },
            'Project progress updated'
          );
        }
      }

      const duration = Date.now() - startTime;
      this.logger.debug(
        { projectsChecked: projects.length, projectsUpdated: updatedCount, durationMs: duration },
        'Project progress worker completed cycle'
      );
    } catch (error) {
      this.logger.error({ error }, 'Project progress worker error');
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Calculate project progress based on tasks and milestones
   */
  private calculateProgress(project: {
    tasks: Array<{ status: string; estimatedMinutes: number | null }>;
    milestones: Array<{ status: string }>;
  }): number {
    const { tasks, milestones } = project;

    // If no tasks or milestones, can't calculate progress
    if (tasks.length === 0 && milestones.length === 0) {
      return 0;
    }

    // Weight: 70% tasks, 30% milestones (if milestones exist)
    const hasMillestones = milestones.length > 0;
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    const taskWeight = hasMillestones ? 0.7 : 1;
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    const milestoneWeight = hasMillestones ? 0.3 : 0;

    // Calculate task progress
    let taskProgress = 0;
    if (tasks.length > 0) {
      // If tasks have estimates, weight by estimated time
      const hasEstimates = tasks.some((t) => t.estimatedMinutes && t.estimatedMinutes > 0);

      if (hasEstimates) {
        const totalEstimated = tasks.reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0);
        const completedEstimated = tasks
          .filter((t) => t.status === 'COMPLETED')
          .reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0);

        taskProgress = totalEstimated > 0 ? (completedEstimated / totalEstimated) * 100 : 0;
      } else {
        // Simple count-based progress
        const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
        taskProgress = (completedTasks / tasks.length) * 100;
      }
    }

    // Calculate milestone progress
    let milestoneProgress = 0;
    if (milestones.length > 0) {
      const completedMilestones = milestones.filter((m) => m.status === 'COMPLETED').length;
      milestoneProgress = (completedMilestones / milestones.length) * 100;
    }

    // Weighted average
    const totalProgress = taskProgress * taskWeight + milestoneProgress * milestoneWeight;

    return Math.round(totalProgress);
  }

  /**
   * Update progress for a specific project (can be called on-demand)
   */
  async updateProjectProgress(projectId: string): Promise<number> {
    const project = await this.prisma.cockpitProject.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          where: { parentTaskId: null },
          select: { id: true, status: true, estimatedMinutes: true },
        },
        milestones: {
          select: { id: true, status: true },
        },
      },
    });

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const newProgress = this.calculateProgress(project);

    await this.prisma.cockpitProject.update({
      where: { id: projectId },
      data: { progressPercent: newProgress },
    });

    return newProgress;
  }
}
