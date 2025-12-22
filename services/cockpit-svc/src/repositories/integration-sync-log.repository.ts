/**
 * @module @skillancer/cockpit-svc/repositories/integration-sync-log
 * Integration Sync Log Repository - Database operations for sync logs
 */

import type { CreateSyncLogParams } from '../types/integration.types.js';
import type {
  IntegrationSyncLog,
  IntegrationSyncType,
  IntegrationSyncStatus,
} from '@prisma/client';
import type { PrismaClient } from '@skillancer/database';

export interface SyncLogFilters {
  integrationId?: string;
  syncType?: IntegrationSyncType;
  status?: IntegrationSyncStatus;
  startDate?: Date;
  endDate?: Date;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export class IntegrationSyncLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(params: CreateSyncLogParams): Promise<IntegrationSyncLog> {
    return this.prisma.integrationSyncLog.create({
      data: {
        integrationId: params.integrationId,
        syncType: params.syncType,
        status: (params.status ?? 'IN_PROGRESS') as IntegrationSyncStatus,
        startedAt: params.startedAt ?? new Date(),
        entityType: params.syncedEntities?.join(','),
        metadata: (params.metadata as object) ?? undefined,
      },
    });
  }

  async findById(id: string): Promise<IntegrationSyncLog | null> {
    return this.prisma.integrationSyncLog.findUnique({
      where: { id },
    });
  }

  async findRecent(integrationId: string, limit: number = 10): Promise<IntegrationSyncLog[]> {
    return this.prisma.integrationSyncLog.findMany({
      where: { integrationId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  async findByFilters(
    filters: SyncLogFilters,
    pagination?: PaginationOptions
  ): Promise<{ logs: IntegrationSyncLog[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (filters.integrationId) {
      where.integrationId = filters.integrationId;
    }
    if (filters.syncType) {
      where.syncType = filters.syncType;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.startDate || filters.endDate) {
      where.startedAt = {};
      if (filters.startDate) {
        (where.startedAt as Record<string, Date>).gte = filters.startDate;
      }
      if (filters.endDate) {
        (where.startedAt as Record<string, Date>).lte = filters.endDate;
      }
    }

    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 50;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.integrationSyncLog.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.integrationSyncLog.count({ where }),
    ]);

    return { logs, total };
  }

  async findInProgress(integrationId: string): Promise<IntegrationSyncLog[]> {
    return this.prisma.integrationSyncLog.findMany({
      where: {
        integrationId,
        status: 'IN_PROGRESS',
      },
    });
  }

  async findLastSuccessful(integrationId: string): Promise<IntegrationSyncLog | null> {
    return this.prisma.integrationSyncLog.findFirst({
      where: {
        integrationId,
        status: 'COMPLETED',
      },
      orderBy: { completedAt: 'desc' },
    });
  }

  async updateStatus(
    id: string,
    status: IntegrationSyncStatus,
    completedAt?: Date
  ): Promise<IntegrationSyncLog> {
    return this.prisma.integrationSyncLog.update({
      where: { id },
      data: {
        status,
        completedAt: completedAt ?? (status !== 'IN_PROGRESS' ? new Date() : undefined),
      },
    });
  }

  async updateProgress(
    id: string,
    progress: {
      itemsProcessed?: number;
      itemsCreated?: number;
      itemsUpdated?: number;
      itemsDeleted?: number;
      itemsFailed?: number;
      cursor?: string;
    }
  ): Promise<IntegrationSyncLog> {
    return this.prisma.integrationSyncLog.update({
      where: { id },
      data: {
        itemsProcessed: progress.itemsProcessed,
        itemsCreated: progress.itemsCreated,
        itemsUpdated: progress.itemsUpdated,
        itemsDeleted: progress.itemsDeleted,
        itemsFailed: progress.itemsFailed,
        cursor: progress.cursor,
      },
    });
  }

  async complete(
    id: string,
    result: {
      status: IntegrationSyncStatus;
      itemsProcessed?: number;
      itemsCreated?: number;
      itemsUpdated?: number;
      itemsDeleted?: number;
      itemsFailed?: number;
      errorMessage?: string;
      errorDetails?: Record<string, unknown>;
      cursor?: string;
    }
  ): Promise<IntegrationSyncLog> {
    const startedLog = await this.findById(id);
    const durationMs = startedLog ? Date.now() - startedLog.startedAt.getTime() : undefined;

    return this.prisma.integrationSyncLog.update({
      where: { id },
      data: {
        status: result.status,
        completedAt: new Date(),
        durationMs,
        itemsProcessed: result.itemsProcessed,
        itemsCreated: result.itemsCreated,
        itemsUpdated: result.itemsUpdated,
        itemsDeleted: result.itemsDeleted,
        itemsFailed: result.itemsFailed,
        errorMessage: result.errorMessage,
        errorDetails: (result.errorDetails as object) ?? undefined,
        cursor: result.cursor,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.integrationSyncLog.delete({
      where: { id },
    });
  }

  async deleteByIntegration(integrationId: string): Promise<number> {
    const result = await this.prisma.integrationSyncLog.deleteMany({
      where: { integrationId },
    });
    return result.count;
  }

  async deleteOldLogs(olderThan: Date): Promise<number> {
    const result = await this.prisma.integrationSyncLog.deleteMany({
      where: {
        startedAt: { lt: olderThan },
      },
    });
    return result.count;
  }

  async getSyncStats(
    integrationId: string,
    since: Date
  ): Promise<{
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    totalRecordsProcessed: number;
    averageDurationMs: number;
  }> {
    const logs = await this.prisma.integrationSyncLog.findMany({
      where: {
        integrationId,
        startedAt: { gte: since },
        status: { in: ['COMPLETED', 'PARTIAL', 'FAILED'] },
      },
    });

    const successfulSyncs = logs.filter((l) => l.status === 'COMPLETED').length;
    const failedSyncs = logs.filter((l) => l.status === 'FAILED').length;
    const totalRecordsProcessed = logs.reduce((sum, l) => sum + (l.itemsProcessed ?? 0), 0);

    const completedLogs = logs.filter((l) => l.completedAt);
    const totalDurationMs = completedLogs.reduce((sum, l) => {
      const duration = l.completedAt!.getTime() - l.startedAt.getTime();
      return sum + duration;
    }, 0);

    return {
      totalSyncs: logs.length,
      successfulSyncs,
      failedSyncs,
      totalRecordsProcessed,
      averageDurationMs: completedLogs.length > 0 ? totalDurationMs / completedLogs.length : 0,
    };
  }
}
