/**
 * @module @skillancer/auth-svc/services/work-history
 * Work history management service
 */

import { CacheService } from '@skillancer/cache';
import { prisma } from '@skillancer/database';

import { getConfig } from '../config/index.js';
import { NotFoundError } from '../errors/index.js';

import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

// Define WorkHistory type locally since Prisma types may not be fully available
interface WorkHistory {
  id: string;
  userId: string;
  companyName: string;
  title: string;
  location: string | null;
  description: string | null;
  startDate: Date;
  endDate: Date | null;
  isCurrent: boolean;
  skills: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkHistoryDto {
  companyName: string;
  title: string;
  location?: string | null | undefined;
  startDate: Date;
  endDate?: Date | null | undefined;
  isCurrent: boolean;
  description?: string | null | undefined;
  skills?: string[] | undefined;
}

export interface UpdateWorkHistoryDto {
  companyName?: string | undefined;
  title?: string | undefined;
  location?: string | null | undefined;
  startDate?: Date | undefined;
  endDate?: Date | null | undefined;
  isCurrent?: boolean | undefined;
  description?: string | null | undefined;
  skills?: string[] | undefined;
}

export interface WorkHistoryWithDuration extends WorkHistory {
  durationMonths: number;
}

export interface PaginatedWorkHistory {
  data: WorkHistory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CACHE_TTL = 5 * 60; // 5 minutes

const CacheKeys = {
  workHistory: (id: string) => `work-history:item:${id}`,
  userWorkHistory: (userId: string) => `work-history:user:${userId}`,
};

// =============================================================================
// WORK HISTORY SERVICE
// =============================================================================

let workHistoryServiceInstance: WorkHistoryService | null = null;

/**
 * Work history management service
 *
 * Features:
 * - CRUD operations for work history entries
 * - Validation for date ranges
 * - Skills tagging
 * - Verification status
 * - Caching for performance
 */
export class WorkHistoryService {
  private readonly config = getConfig();
  private readonly cache: CacheService;

  constructor(redis: Redis) {
    this.cache = new CacheService(redis, 'work-history');
  }

  // ===========================================================================
  // WORK HISTORY CRUD
  // ===========================================================================

  /**
   * Create a new work history entry
   */
  async create(userId: string, data: CreateWorkHistoryDto): Promise<WorkHistory> {
    // Validate dates
    this.validateDates(data.startDate, data.endDate, data.isCurrent);

    const entry = await prisma.workHistory.create({
      data: {
        userId,
        companyName: data.companyName,
        title: data.title,
        location: data.location ?? null,
        startDate: data.startDate,
        endDate: data.isCurrent ? null : (data.endDate ?? null),
        isCurrent: data.isCurrent,
        description: data.description ?? null,
        skills: data.skills ?? [],
      },
    });

    // Invalidate user's work history cache
    await this.cache.delete(CacheKeys.userWorkHistory(userId));

    return entry;
  }

  /**
   * Get work history entry by ID
   */
  async getById(entryId: string, userId?: string): Promise<WorkHistory> {
    const cacheKey = CacheKeys.workHistory(entryId);
    const cached = await this.cache.get<WorkHistory>(cacheKey);

    if (cached) {
      if (userId && cached.userId !== userId) {
        throw new NotFoundError('Work history entry not found');
      }
      return cached;
    }

    const entry = await prisma.workHistory.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      throw new NotFoundError('Work history entry not found');
    }

    if (userId && entry.userId !== userId) {
      throw new NotFoundError('Work history entry not found');
    }

    await this.cache.set(cacheKey, entry, { ttl: CACHE_TTL });
    return entry;
  }

  /**
   * Get all work history for a user
   */
  async getUserWorkHistory(
    userId: string,
    options?: { page?: number; limit?: number }
  ): Promise<PaginatedWorkHistory> {
    const page = options?.page ?? 1;
    const limit = Math.min(options?.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      prisma.workHistory.findMany({
        where: { userId },
        orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.workHistory.count({ where: { userId } }),
    ]);

    return {
      data: entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get public work history for a user
   */
  async getPublicWorkHistory(
    username: string,
    options?: { page?: number; limit?: number }
  ): Promise<PaginatedWorkHistory> {
    const profile = await prisma.userProfile.findUnique({
      where: { username: username.toLowerCase() },
      select: { userId: true },
    });

    if (!profile) {
      throw new NotFoundError('User not found');
    }

    return this.getUserWorkHistory(profile.userId, options);
  }

  /**
   * Update work history entry
   */
  async update(entryId: string, userId: string, data: UpdateWorkHistoryDto): Promise<WorkHistory> {
    // Verify ownership
    const existing = await this.getById(entryId, userId);

    // Validate dates if provided
    const startDate = data.startDate ?? existing.startDate;
    const endDate = data.endDate !== undefined ? data.endDate : existing.endDate;
    const isCurrent = data.isCurrent ?? existing.isCurrent;
    this.validateDates(startDate, endDate, isCurrent);

    // Build update data, only including defined fields
    const updateData: Record<string, unknown> = {};
    if (data.companyName !== undefined) updateData.companyName = data.companyName;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.isCurrent !== undefined) {
      updateData.isCurrent = data.isCurrent;
      updateData.endDate = data.isCurrent ? null : (data.endDate ?? existing.endDate);
    } else if (data.endDate !== undefined) {
      updateData.endDate = data.endDate;
    }
    if (data.description !== undefined) updateData.description = data.description;
    if (data.skills !== undefined) updateData.skills = data.skills;

    const updated = await prisma.workHistory.update({
      where: { id: entryId },
      data: updateData,
    });

    // Invalidate caches
    await Promise.all([
      this.cache.delete(CacheKeys.workHistory(entryId)),
      this.cache.delete(CacheKeys.userWorkHistory(userId)),
    ]);

    return updated;
  }

  /**
   * Delete work history entry
   */
  async delete(entryId: string, userId: string): Promise<void> {
    // Verify ownership
    await this.getById(entryId, userId);

    await prisma.workHistory.delete({
      where: { id: entryId },
    });

    // Invalidate caches
    await Promise.all([
      this.cache.delete(CacheKeys.workHistory(entryId)),
      this.cache.delete(CacheKeys.userWorkHistory(userId)),
    ]);
  }

  // ===========================================================================
  // ANALYTICS
  // ===========================================================================

  /**
   * Calculate total experience in months
   */
  async calculateTotalExperience(userId: string): Promise<number> {
    const entries = await prisma.workHistory.findMany({
      where: { userId },
      select: { startDate: true, endDate: true, isCurrent: true },
    });

    let totalMonths = 0;
    const now = new Date();

    for (const entry of entries) {
      const end = entry.isCurrent ? now : (entry.endDate ?? now);
      const months = this.calculateMonthsDifference(entry.startDate, end);
      totalMonths += months;
    }

    return totalMonths;
  }

  /**
   * Get work history with calculated duration
   */
  async getWorkHistoryWithDuration(userId: string): Promise<WorkHistoryWithDuration[]> {
    const entries = await prisma.workHistory.findMany({
      where: { userId },
      orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
    });

    const now = new Date();

    return entries.map((entry) => ({
      ...entry,
      durationMonths: this.calculateMonthsDifference(
        entry.startDate,
        entry.isCurrent ? now : (entry.endDate ?? now)
      ),
    }));
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Validate date ranges
   */
  private validateDates(
    startDate: Date,
    endDate: Date | null | undefined,
    isCurrent: boolean
  ): void {
    const now = new Date();

    if (startDate > now) {
      throw new Error('Start date cannot be in the future');
    }

    if (!isCurrent && endDate) {
      if (endDate < startDate) {
        throw new Error('End date must be after start date');
      }
      if (endDate > now) {
        throw new Error('End date cannot be in the future');
      }
    }
  }

  /**
   * Calculate months between two dates
   */
  private calculateMonthsDifference(start: Date, end: Date): number {
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return Math.max(0, months);
  }
}

// =============================================================================
// SINGLETON MANAGEMENT
// =============================================================================

export function initializeWorkHistoryService(redis: Redis): void {
  if (!workHistoryServiceInstance) {
    workHistoryServiceInstance = new WorkHistoryService(redis);
  }
}

export function getWorkHistoryService(): WorkHistoryService {
  if (!workHistoryServiceInstance) {
    throw new Error('WorkHistoryService not initialized. Call initializeWorkHistoryService first.');
  }
  return workHistoryServiceInstance;
}

export function resetWorkHistoryService(): void {
  workHistoryServiceInstance = null;
}
