// @ts-nocheck
/**
 * @module @skillancer/auth-svc/services/education
 * Education history management service
 */

import { CacheService } from '@skillancer/cache';
import { prisma } from '@skillancer/database';

import { getConfig } from '../config/index.js';
import { NotFoundError } from '../errors/index.js';

import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

// Define Education type locally
interface Education {
  id: string;
  userId: string;
  institution: string;
  degree: string | null;
  fieldOfStudy: string | null;
  startDate: Date | null;
  endDate: Date | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEducationDto {
  institution: string;
  degree?: string | null | undefined;
  fieldOfStudy?: string | null | undefined;
  startDate?: Date | null | undefined;
  endDate?: Date | null | undefined;
  description?: string | null | undefined;
}

export interface UpdateEducationDto {
  institution?: string | undefined;
  degree?: string | null | undefined;
  fieldOfStudy?: string | null | undefined;
  startDate?: Date | null | undefined;
  endDate?: Date | null | undefined;
  description?: string | null | undefined;
}

export interface PaginatedEducation {
  data: Education[];
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
  education: (id: string) => `education:item:${id}`,
  userEducation: (userId: string) => `education:user:${userId}`,
};

// =============================================================================
// EDUCATION SERVICE
// =============================================================================

let educationServiceInstance: EducationService | null = null;

/**
 * Education history management service
 *
 * Features:
 * - CRUD operations for education entries
 * - Support for various degree types
 * - Validation for date ranges
 * - Verification status
 * - Caching for performance
 */
export class EducationService {
  private readonly config = getConfig();
  private readonly cache: CacheService;

  constructor(redis: Redis) {
    this.cache = new CacheService(redis, 'education');
  }

  // ===========================================================================
  // EDUCATION CRUD
  // ===========================================================================

  /**
   * Create a new education entry
   */
  async create(userId: string, data: CreateEducationDto): Promise<Education> {
    // Validate dates if both provided
    if (data.startDate && data.endDate) {
      this.validateDates(data.startDate, data.endDate);
    }

    const entry = await prisma.education.create({
      data: {
        userId,
        institution: data.institution,
        degree: data.degree ?? null,
        fieldOfStudy: data.fieldOfStudy ?? null,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        description: data.description ?? null,
      },
    });

    // Invalidate user's education cache
    await this.cache.delete(CacheKeys.userEducation(userId));

    return entry;
  }

  /**
   * Get education entry by ID
   */
  async getById(entryId: string, userId?: string): Promise<Education> {
    const cacheKey = CacheKeys.education(entryId);
    const cached = await this.cache.get<Education>(cacheKey);

    if (cached) {
      if (userId && cached.userId !== userId) {
        throw new NotFoundError('Education entry not found');
      }
      return cached;
    }

    const entry = await prisma.education.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      throw new NotFoundError('Education entry not found');
    }

    if (userId && entry.userId !== userId) {
      throw new NotFoundError('Education entry not found');
    }

    await this.cache.set(cacheKey, entry, { ttl: CACHE_TTL });
    return entry;
  }

  /**
   * Get all education for a user
   */
  async getUserEducation(
    userId: string,
    options?: { page?: number; limit?: number }
  ): Promise<PaginatedEducation> {
    const page = options?.page ?? 1;
    const limit = Math.min(options?.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      prisma.education.findMany({
        where: { userId },
        orderBy: [{ startDate: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.education.count({ where: { userId } }),
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
   * Get public education for a user
   */
  async getPublicEducation(
    username: string,
    options?: { page?: number; limit?: number }
  ): Promise<PaginatedEducation> {
    const profile = await prisma.userProfile.findUnique({
      where: { username: username.toLowerCase() },
      select: { userId: true },
    });

    if (!profile) {
      throw new NotFoundError('User not found');
    }

    return this.getUserEducation(profile.userId, options);
  }

  /**
   * Update education entry
   */
  async update(entryId: string, userId: string, data: UpdateEducationDto): Promise<Education> {
    // Verify ownership
    const existing = await this.getById(entryId, userId);

    // Validate dates if both provided
    const startDate = data.startDate !== undefined ? data.startDate : existing.startDate;
    const endDate = data.endDate !== undefined ? data.endDate : existing.endDate;
    if (startDate && endDate) {
      this.validateDates(startDate, endDate);
    }

    // Build update data, only including defined fields
    const updateData: Record<string, unknown> = {};
    if (data.institution !== undefined) updateData.institution = data.institution;
    if (data.degree !== undefined) updateData.degree = data.degree;
    if (data.fieldOfStudy !== undefined) updateData.fieldOfStudy = data.fieldOfStudy;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.endDate !== undefined) updateData.endDate = data.endDate;
    if (data.description !== undefined) updateData.description = data.description;

    const updated = await prisma.education.update({
      where: { id: entryId },
      data: updateData,
    });

    // Invalidate caches
    await Promise.all([
      this.cache.delete(CacheKeys.education(entryId)),
      this.cache.delete(CacheKeys.userEducation(userId)),
    ]);

    return updated;
  }

  /**
   * Delete education entry
   */
  async delete(entryId: string, userId: string): Promise<void> {
    // Verify ownership
    await this.getById(entryId, userId);

    await prisma.education.delete({
      where: { id: entryId },
    });

    // Invalidate caches
    await Promise.all([
      this.cache.delete(CacheKeys.education(entryId)),
      this.cache.delete(CacheKeys.userEducation(userId)),
    ]);
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Validate date ranges
   */
  private validateDates(startDate: Date, endDate: Date): void {
    if (endDate < startDate) {
      throw new Error('End date must be after start date');
    }
  }
}

// =============================================================================
// SINGLETON MANAGEMENT
// =============================================================================

export function initializeEducationService(redis: Redis): void {
  if (!educationServiceInstance) {
    educationServiceInstance = new EducationService(redis);
  }
}

export function getEducationService(): EducationService {
  if (!educationServiceInstance) {
    throw new Error('EducationService not initialized. Call initializeEducationService first.');
  }
  return educationServiceInstance;
}

export function resetEducationService(): void {
  educationServiceInstance = null;
}
