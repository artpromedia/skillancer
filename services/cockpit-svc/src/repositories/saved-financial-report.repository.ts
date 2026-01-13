// @ts-nocheck
/**
 * Saved Financial Report Repository
 *
 * Repository for managing saved/scheduled financial reports.
 */

import {
  type PrismaClient,
  type Prisma,
  type SavedFinancialReport,
  type FinancialReportType,
  FinancialReportStatus,
} from '../types/prisma-shim.js';
import { logger } from '@skillancer/logger';

import type {
  PaginationOptions,
  PaginatedResult,
  ReportParameters,
  ExportOptions,
} from '../types/unified-financial.types';

export interface CreateSavedReportInput {
  userId: string;
  name: string;
  reportType: FinancialReportType;
  parameters: ReportParameters;
  isScheduled: boolean;
  scheduleCron?: string;
  exportFormat?: 'pdf' | 'xlsx' | 'csv';
  recipients?: string[];
}

export interface UpdateSavedReportInput {
  name?: string;
  parameters?: ReportParameters;
  isScheduled?: boolean;
  scheduleCron?: string;
  exportFormat?: 'pdf' | 'xlsx' | 'csv';
  recipients?: string[];
  status?: FinancialReportStatus;
  lastGeneratedAt?: Date;
  nextScheduledAt?: Date;
  exportUrl?: string;
  exportExpiresAt?: Date;
  error?: string;
}

export interface SavedReportFilters {
  userId: string;
  reportType?: FinancialReportType;
  isScheduled?: boolean;
  status?: FinancialReportStatus;
  searchTerm?: string;
}

export class SavedFinancialReportRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new saved report
   */
  async create(input: CreateSavedReportInput): Promise<SavedFinancialReport> {
    try {
      return await this.prisma.savedFinancialReport.create({
        data: {
          userId: input.userId,
          name: input.name,
          reportType: input.reportType,
          parameters: input.parameters as unknown as Prisma.JsonValue,
          isScheduled: input.isScheduled,
          scheduleCron: input.scheduleCron,
          exportFormat: input.exportFormat,
          recipients: input.recipients ?? [],
          status: FinancialReportStatus.PENDING,
        },
      });
    } catch (error) {
      logger.error('Failed to create saved report', { error, input });
      throw error;
    }
  }

  /**
   * Find report by ID
   */
  async findById(id: string): Promise<SavedFinancialReport | null> {
    return this.prisma.savedFinancialReport.findUnique({
      where: { id },
    });
  }

  /**
   * Find report by ID and user (for ownership verification)
   */
  async findByIdAndUser(id: string, userId: string): Promise<SavedFinancialReport | null> {
    return this.prisma.savedFinancialReport.findFirst({
      where: { id, userId },
    });
  }

  /**
   * Update a saved report
   */
  async update(id: string, input: UpdateSavedReportInput): Promise<SavedFinancialReport> {
    return this.prisma.savedFinancialReport.update({
      where: { id },
      data: {
        name: input.name,
        parameters: input.parameters as unknown as Prisma.JsonValue,
        isScheduled: input.isScheduled,
        scheduleCron: input.scheduleCron,
        exportFormat: input.exportFormat,
        recipients: input.recipients,
        status: input.status,
        lastGeneratedAt: input.lastGeneratedAt,
        nextScheduledAt: input.nextScheduledAt,
        exportUrl: input.exportUrl,
        exportExpiresAt: input.exportExpiresAt,
        error: input.error,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Find reports with filters and pagination
   */
  async findMany(
    filters: SavedReportFilters,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<SavedFinancialReport>> {
    const where = this.buildWhereClause(filters);

    const [data, total] = await Promise.all([
      this.prisma.savedFinancialReport.findMany({
        where,
        orderBy: {
          [pagination.sortBy ?? 'createdAt']: pagination.sortOrder ?? 'desc',
        },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      this.prisma.savedFinancialReport.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pagination.pageSize);

    return {
      data,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrevious: pagination.page > 1,
    };
  }

  /**
   * Get all scheduled reports
   */
  async getScheduledReports(): Promise<SavedFinancialReport[]> {
    return this.prisma.savedFinancialReport.findMany({
      where: {
        isScheduled: true,
        status: { not: FinancialReportStatus.FAILED },
      },
      orderBy: { nextScheduledAt: 'asc' },
    });
  }

  /**
   * Get reports due for generation
   */
  async getReportsDueForGeneration(before: Date): Promise<SavedFinancialReport[]> {
    return this.prisma.savedFinancialReport.findMany({
      where: {
        isScheduled: true,
        nextScheduledAt: { lte: before },
        status: { not: FinancialReportStatus.GENERATING },
      },
    });
  }

  /**
   * Mark report as generating
   */
  async markGenerating(id: string): Promise<SavedFinancialReport> {
    return this.prisma.savedFinancialReport.update({
      where: { id },
      data: {
        status: FinancialReportStatus.GENERATING,
        error: null,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Mark report as completed
   */
  async markCompleted(
    id: string,
    exportUrl: string,
    exportExpiresAt: Date,
    nextScheduledAt?: Date
  ): Promise<SavedFinancialReport> {
    return this.prisma.savedFinancialReport.update({
      where: { id },
      data: {
        status: FinancialReportStatus.COMPLETED,
        lastGeneratedAt: new Date(),
        nextScheduledAt,
        exportUrl,
        exportExpiresAt,
        error: null,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Mark report as failed
   */
  async markFailed(id: string, error: string): Promise<SavedFinancialReport> {
    return this.prisma.savedFinancialReport.update({
      where: { id },
      data: {
        status: FinancialReportStatus.FAILED,
        error,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get user's recent reports
   */
  async getRecentReports(userId: string, limit: number = 10): Promise<SavedFinancialReport[]> {
    return this.prisma.savedFinancialReport.findMany({
      where: {
        userId,
        lastGeneratedAt: { not: null },
      },
      orderBy: { lastGeneratedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get reports by type
   */
  async getReportsByType(
    userId: string,
    reportType: FinancialReportType
  ): Promise<SavedFinancialReport[]> {
    return this.prisma.savedFinancialReport.findMany({
      where: {
        userId,
        reportType,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete a saved report
   */
  async delete(id: string): Promise<void> {
    await this.prisma.savedFinancialReport.delete({
      where: { id },
    });
  }

  /**
   * Delete expired exports
   */
  async cleanupExpiredExports(): Promise<number> {
    const result = await this.prisma.savedFinancialReport.updateMany({
      where: {
        exportExpiresAt: { lt: new Date() },
        exportUrl: { not: null },
      },
      data: {
        exportUrl: null,
        exportExpiresAt: null,
        status: FinancialReportStatus.EXPIRED,
      },
    });
    return result.count;
  }

  /**
   * Get report statistics for a user
   */
  async getReportStats(userId: string): Promise<{
    totalReports: number;
    scheduledReports: number;
    byType: Array<{ type: FinancialReportType; count: number }>;
    recentGenerations: number;
  }> {
    const [totalReports, scheduledReports, byType, recentGenerations] = await Promise.all([
      this.prisma.savedFinancialReport.count({ where: { userId } }),
      this.prisma.savedFinancialReport.count({ where: { userId, isScheduled: true } }),
      this.prisma.savedFinancialReport.groupBy({
        by: ['reportType'],
        where: { userId },
        _count: true,
      }),
      this.prisma.savedFinancialReport.count({
        where: {
          userId,
          lastGeneratedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return {
      totalReports,
      scheduledReports,
      byType: byType.map((b) => ({ type: b.reportType, count: b._count })),
      recentGenerations,
    };
  }

  /**
   * Build where clause from filters
   */
  private buildWhereClause(filters: SavedReportFilters): Prisma.SavedFinancialReportWhereInput {
    const where: Prisma.SavedFinancialReportWhereInput = {
      userId: filters.userId,
    };

    if (filters.reportType) {
      where.reportType = filters.reportType;
    }

    if (filters.isScheduled !== undefined) {
      where.isScheduled = filters.isScheduled;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.searchTerm) {
      where.name = { contains: filters.searchTerm, mode: 'insensitive' };
    }

    return where;
  }
}

