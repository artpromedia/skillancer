/**
 * @module @skillancer/auth-svc/services/certification
 * Certification management service
 */

import { CacheService } from '@skillancer/cache';
import { prisma, type Prisma } from '@skillancer/database';

import { getConfig } from '../config/index.js';
import { NotFoundError } from '../errors/index.js';

import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

// Define Certification type locally
interface Certification {
  id: string;
  userId: string;
  name: string;
  issuingOrganization: string;
  credentialId: string | null;
  credentialUrl: string | null;
  issueDate: Date | null;
  expirationDate: Date | null;
  isVerified: boolean;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCertificationDto {
  name: string;
  issuingOrganization: string;
  issueDate?: Date | null | undefined;
  expirationDate?: Date | null | undefined;
  credentialId?: string | null | undefined;
  credentialUrl?: string | null | undefined;
}

export interface UpdateCertificationDto {
  name?: string | undefined;
  issuingOrganization?: string | undefined;
  issueDate?: Date | null | undefined;
  expirationDate?: Date | null | undefined;
  credentialId?: string | null | undefined;
  credentialUrl?: string | null | undefined;
}

export interface PaginatedCertifications {
  data: Certification[];
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
  certification: (id: string) => `certification:item:${id}`,
  userCertifications: (userId: string) => `certification:user:${userId}`,
};

// =============================================================================
// CERTIFICATION SERVICE
// =============================================================================

let certificationServiceInstance: CertificationService | null = null;

/**
 * Certification management service
 *
 * Features:
 * - CRUD operations for certifications
 * - Verification status management
 * - Expiration tracking
 * - Caching for performance
 */
export class CertificationService {
  private readonly config = getConfig();
  private readonly cache: CacheService;

  constructor(redis: Redis) {
    this.cache = new CacheService(redis, 'certification');
  }

  // ===========================================================================
  // CERTIFICATION CRUD
  // ===========================================================================

  /**
   * Create a new certification
   */
  async create(userId: string, data: CreateCertificationDto): Promise<Certification> {
    // Validate dates if both provided
    if (data.issueDate && data.expirationDate) {
      this.validateDates(data.issueDate, data.expirationDate);
    }

    const certification = await prisma.certification.create({
      data: {
        userId,
        name: data.name,
        issuingOrganization: data.issuingOrganization,
        issueDate: data.issueDate ?? null,
        expirationDate: data.expirationDate ?? null,
        credentialId: data.credentialId ?? null,
        credentialUrl: data.credentialUrl ?? null,
        isVerified: false,
      },
    });

    // Invalidate user's certifications cache
    await this.cache.delete(CacheKeys.userCertifications(userId));

    return certification;
  }

  /**
   * Get certification by ID
   */
  async getById(certId: string, userId?: string): Promise<Certification> {
    const cacheKey = CacheKeys.certification(certId);
    const cached = await this.cache.get<Certification>(cacheKey);

    if (cached) {
      if (userId && cached.userId !== userId) {
        throw new NotFoundError('Certification not found');
      }
      return cached;
    }

    const certification = await prisma.certification.findUnique({
      where: { id: certId },
    });

    if (!certification) {
      throw new NotFoundError('Certification not found');
    }

    if (userId && certification.userId !== userId) {
      throw new NotFoundError('Certification not found');
    }

    await this.cache.set(cacheKey, certification, { ttl: CACHE_TTL });
    return certification;
  }

  /**
   * Get all certifications for a user
   */
  async getUserCertifications(
    userId: string,
    options?: {
      page?: number | undefined;
      limit?: number | undefined;
      verifiedOnly?: boolean | undefined;
    }
  ): Promise<PaginatedCertifications> {
    const page = options?.page ?? 1;
    const limit = Math.min(options?.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const where: Prisma.CertificationWhereInput = { userId };
    if (options?.verifiedOnly) {
      where.isVerified = true;
    }

    const [certifications, total] = await Promise.all([
      prisma.certification.findMany({
        where,
        orderBy: { issueDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.certification.count({ where }),
    ]);

    return {
      data: certifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get public certifications for a user (only verified)
   */
  async getPublicCertifications(
    username: string,
    options?: { page?: number; limit?: number }
  ): Promise<PaginatedCertifications> {
    const profile = await prisma.userProfile.findUnique({
      where: { username: username.toLowerCase() },
      select: { userId: true },
    });

    if (!profile) {
      throw new NotFoundError('User not found');
    }

    const page = options?.page ?? 1;
    const limit = Math.min(options?.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const where: Prisma.CertificationWhereInput = {
      userId: profile.userId,
      isVerified: true,
    };

    const [certifications, total] = await Promise.all([
      prisma.certification.findMany({
        where,
        orderBy: { issueDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.certification.count({ where }),
    ]);

    return {
      data: certifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update certification
   */
  async update(
    certId: string,
    userId: string,
    data: UpdateCertificationDto
  ): Promise<Certification> {
    // Verify ownership
    const existing = await this.getById(certId, userId);

    // Validate dates if both provided
    const issueDate = data.issueDate !== undefined ? data.issueDate : existing.issueDate;
    const expirationDate =
      data.expirationDate !== undefined ? data.expirationDate : existing.expirationDate;
    if (issueDate && expirationDate) {
      this.validateDates(issueDate, expirationDate);
    }

    // Build update data, only including defined fields
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.issuingOrganization !== undefined)
      updateData.issuingOrganization = data.issuingOrganization;
    if (data.issueDate !== undefined) updateData.issueDate = data.issueDate;
    if (data.expirationDate !== undefined) updateData.expirationDate = data.expirationDate;
    if (data.credentialId !== undefined) updateData.credentialId = data.credentialId;
    if (data.credentialUrl !== undefined) updateData.credentialUrl = data.credentialUrl;

    // If key fields changed, reset verification status
    if (data.name !== undefined || data.issuingOrganization !== undefined) {
      updateData.isVerified = false;
      updateData.verifiedAt = null;
    }

    const updated = await prisma.certification.update({
      where: { id: certId },
      data: updateData,
    });

    // Invalidate caches
    await Promise.all([
      this.cache.delete(CacheKeys.certification(certId)),
      this.cache.delete(CacheKeys.userCertifications(userId)),
    ]);

    return updated;
  }

  /**
   * Delete certification
   */
  async delete(certId: string, userId: string): Promise<void> {
    // Verify ownership
    await this.getById(certId, userId);

    await prisma.certification.delete({
      where: { id: certId },
    });

    // Invalidate caches
    await Promise.all([
      this.cache.delete(CacheKeys.certification(certId)),
      this.cache.delete(CacheKeys.userCertifications(userId)),
    ]);
  }

  // ===========================================================================
  // VERIFICATION
  // ===========================================================================

  /**
   * Verify certification (admin only)
   */
  async verify(certId: string): Promise<Certification> {
    const certification = await prisma.certification.findUnique({
      where: { id: certId },
    });

    if (!certification) {
      throw new NotFoundError('Certification not found');
    }

    const updated = await prisma.certification.update({
      where: { id: certId },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
      },
    });

    // Invalidate caches
    await Promise.all([
      this.cache.delete(CacheKeys.certification(certId)),
      this.cache.delete(CacheKeys.userCertifications(certification.userId)),
    ]);

    return updated;
  }

  /**
   * Unverify certification (admin only)
   */
  async unverify(certId: string): Promise<Certification> {
    const certification = await prisma.certification.findUnique({
      where: { id: certId },
    });

    if (!certification) {
      throw new NotFoundError('Certification not found');
    }

    const updated = await prisma.certification.update({
      where: { id: certId },
      data: {
        isVerified: false,
        verifiedAt: null,
      },
    });

    // Invalidate caches
    await Promise.all([
      this.cache.delete(CacheKeys.certification(certId)),
      this.cache.delete(CacheKeys.userCertifications(certification.userId)),
    ]);

    return updated;
  }

  // ===========================================================================
  // EXPIRATION
  // ===========================================================================

  /**
   * Get expiring certifications for a user
   */
  async getExpiringCertifications(
    userId: string,
    daysAhead: number = 30
  ): Promise<Certification[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return prisma.certification.findMany({
      where: {
        userId,
        expirationDate: {
          lte: futureDate,
          gte: new Date(),
        },
        isVerified: true,
      },
      orderBy: { expirationDate: 'asc' },
    });
  }

  /**
   * Get expired certifications for a user
   */
  async getExpiredCertifications(userId: string): Promise<Certification[]> {
    return prisma.certification.findMany({
      where: {
        userId,
        expirationDate: {
          lt: new Date(),
        },
      },
      orderBy: { expirationDate: 'desc' },
    });
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Validate date ranges
   */
  private validateDates(issueDate: Date, expirationDate: Date): void {
    if (expirationDate < issueDate) {
      throw new Error('Expiration date must be after issue date');
    }
  }
}

// =============================================================================
// SINGLETON MANAGEMENT
// =============================================================================

export function initializeCertificationService(redis: Redis): void {
  if (!certificationServiceInstance) {
    certificationServiceInstance = new CertificationService(redis);
  }
}

export function getCertificationService(): CertificationService {
  if (!certificationServiceInstance) {
    throw new Error(
      'CertificationService not initialized. Call initializeCertificationService first.'
    );
  }
  return certificationServiceInstance;
}

export function resetCertificationService(): void {
  certificationServiceInstance = null;
}
