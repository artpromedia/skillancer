/**
 * @module @skillancer/cockpit-svc/repositories/timer
 * Active Timer data access layer
 */

import type { Prisma, PrismaClient, ActiveTimer } from '@skillancer/database';

export class TimerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Find active timer by user ID
   */
  async findByUser(userId: string): Promise<ActiveTimer | null> {
    return this.prisma.activeTimer.findUnique({
      where: { userId },
    });
  }

  /**
   * Find active timer with project and task details
   */
  async findByUserWithDetails(userId: string) {
    return this.prisma.activeTimer.findUnique({
      where: { userId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            clientId: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  }

  /**
   * Create or update timer (upsert)
   */
  async upsert(data: {
    userId: string;
    projectId?: string | null;
    taskId?: string | null;
    description?: string | null;
    startedAt: Date;
    pausedAt?: Date | null;
    totalPausedMinutes?: number;
    isBillable?: boolean;
    hourlyRate?: number | null;
    status?: 'RUNNING' | 'PAUSED' | 'STOPPED';
    metadata?: Prisma.InputJsonValue;
  }): Promise<ActiveTimer> {
    return this.prisma.activeTimer.upsert({
      where: { userId: data.userId },
      create: {
        userId: data.userId,
        projectId: data.projectId ?? null,
        taskId: data.taskId ?? null,
        description: data.description ?? null,
        startedAt: data.startedAt,
        pausedAt: data.pausedAt ?? null,
        totalPausedMinutes: data.totalPausedMinutes ?? 0,
        isBillable: data.isBillable ?? true,
        hourlyRate: data.hourlyRate ?? null,
        status: data.status ?? 'RUNNING',
        metadata: data.metadata,
      },
      update: {
        projectId: data.projectId ?? null,
        taskId: data.taskId ?? null,
        description: data.description ?? null,
        startedAt: data.startedAt,
        pausedAt: data.pausedAt ?? null,
        totalPausedMinutes: data.totalPausedMinutes ?? 0,
        isBillable: data.isBillable ?? true,
        hourlyRate: data.hourlyRate ?? null,
        status: data.status ?? 'RUNNING',
        metadata: data.metadata,
      },
    });
  }

  /**
   * Update timer
   */
  async update(
    id: string,
    data: Partial<{
      projectId: string | null;
      taskId: string | null;
      description: string | null;
      pausedAt: Date | null;
      totalPausedMinutes: number;
      isBillable: boolean;
      hourlyRate: number | null;
      status: 'RUNNING' | 'PAUSED' | 'STOPPED';
      metadata: Prisma.InputJsonValue;
    }>
  ): Promise<ActiveTimer> {
    const updateData: Prisma.ActiveTimerUpdateInput = {};

    if (data.projectId !== undefined) {
      updateData.project = data.projectId
        ? { connect: { id: data.projectId } }
        : { disconnect: true };
    }
    if (data.taskId !== undefined) {
      updateData.task = data.taskId ? { connect: { id: data.taskId } } : { disconnect: true };
    }
    if (data.description !== undefined) updateData.description = data.description;
    if (data.pausedAt !== undefined) updateData.pausedAt = data.pausedAt;
    if (data.totalPausedMinutes !== undefined)
      updateData.totalPausedMinutes = data.totalPausedMinutes;
    if (data.isBillable !== undefined) updateData.isBillable = data.isBillable;
    if (data.hourlyRate !== undefined) updateData.hourlyRate = data.hourlyRate;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    return this.prisma.activeTimer.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete timer
   */
  async delete(id: string): Promise<void> {
    await this.prisma.activeTimer.delete({
      where: { id },
    });
  }

  /**
   * Delete timer by user
   */
  async deleteByUser(userId: string): Promise<void> {
    await this.prisma.activeTimer.deleteMany({
      where: { userId },
    });
  }

  /**
   * Find all running timers (for idle detection worker)
   */
  async findAllRunning(): Promise<ActiveTimer[]> {
    return this.prisma.activeTimer.findMany({
      where: { status: 'RUNNING' },
    });
  }

  /**
   * Find timers that have been running for too long
   */
  async findLongRunningTimers(maxMinutes: number): Promise<ActiveTimer[]> {
    const cutoff = new Date(Date.now() - maxMinutes * 60 * 1000);
    return this.prisma.activeTimer.findMany({
      where: {
        status: 'RUNNING',
        startedAt: { lt: cutoff },
      },
    });
  }
}
