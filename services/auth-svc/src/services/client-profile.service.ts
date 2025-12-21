// @ts-nocheck
/**
 * @module @skillancer/auth-svc/services/client-profile
 * Client profile management service
 */

import { CacheService } from '@skillancer/cache';
import {
  prisma,
  type CompanySize,
  type HiringFrequency,
  type JobType,
  type ClientProfile,
  type UserProfile,
  type User,
  type Prisma,
} from '@skillancer/database';

import { getConfig } from '../config/index.js';
import { NotFoundError } from '../errors/index.js';

import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateClientProfileDto {
  companyName: string | null;
  companySize: CompanySize | null;
  companyWebsite: string | null;
  companyLogoUrl: string | null;
  industry: string | null;
  companyBio: string | null;
  typicalBudgetMin: number | null;
  typicalBudgetMax: number | null;
  preferredCurrency: string; // Required field, defaults to 'USD'
  typicalProjectTypes: JobType[];
  hiringFrequency: HiringFrequency | null;
  teamSize: number | null;
  hasHrDepartment: boolean;
}

export interface UpdateClientProfileDto {
  companyName?: string | null;
  companySize?: CompanySize | null;
  companyWebsite?: string | null;
  companyLogoUrl?: string | null;
  industry?: string | null;
  companyBio?: string | null;
  typicalBudgetMin?: number | null;
  typicalBudgetMax?: number | null;
  preferredCurrency?: string; // Required field, cannot be set to null
  typicalProjectTypes?: JobType[];
  hiringFrequency?: HiringFrequency | null;
  teamSize?: number | null;
  hasHrDepartment?: boolean;
}

export interface ClientProfileWithUser extends ClientProfile {
  userProfile: UserProfile & {
    user: Pick<
      User,
      'id' | 'email' | 'firstName' | 'lastName' | 'displayName' | 'verificationLevel' | 'status'
    >;
  };
}

export interface PublicClientProfile {
  // Basic info
  username: string;
  displayName: string | null;
  firstName: string;
  lastName: string;

  // Avatar
  avatarThumbnail: string | null;
  avatarSmall: string | null;
  avatarMedium: string | null;
  avatarLarge: string | null;

  // Company info
  companyName: string | null;
  companySize: CompanySize | null;
  companyWebsite: string | null;
  companyLogoUrl: string | null;
  industry: string | null;
  companyBio: string | null;

  // Location
  country: string | null;
  city: string | null;

  // Hiring info
  typicalBudgetMin: number | null;
  typicalBudgetMax: number | null;
  preferredCurrency: string;
  typicalProjectTypes: JobType[];
  hiringFrequency: HiringFrequency | null;

  // Stats
  totalJobsPosted: number;
  totalHires: number;
  totalSpent: number;
  avgRatingGiven: number;
  avgProjectDuration: number;
  rehireRate: number;

  // Verification
  verificationLevel: string;
  isVerified: boolean;
  paymentVerified: boolean;

  // Social
  linkedinUrl: string | null;
  companyUrl: string | null;

  // Meta
  memberSince: string;
  lastActiveAt: string;
}

export interface ClientSearchFilters {
  companySize?: CompanySize[];
  industry?: string;
  hiringFrequency?: HiringFrequency[];
  minBudget?: number;
  maxBudget?: number;
  country?: string;
  isVerified?: boolean;
  paymentVerified?: boolean;
  query?: string;
  page?: number;
  limit?: number;
  sortBy?: 'relevance' | 'jobs_posted' | 'total_spent' | 'recent';
}

export interface PaginatedClients {
  data: PublicClientProfile[];
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
  clientProfile: (userId: string) => `client:profile:${userId}`,
  publicClient: (username: string) => `client:public:${username.toLowerCase()}`,
};

// =============================================================================
// CLIENT PROFILE SERVICE
// =============================================================================

export class ClientProfileService {
  private readonly config = getConfig();
  private readonly cache: CacheService;

  constructor(redis: Redis) {
    this.cache = new CacheService(redis, 'client');
  }

  // ===========================================================================
  // PROFILE CRUD
  // ===========================================================================

  /**
   * Create client profile for user
   */
  async createProfile(userId: string, data: CreateClientProfileDto): Promise<ClientProfile> {
    // First ensure user has a UserProfile
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!userProfile) {
      throw new NotFoundError('User profile not found. Create a user profile first.');
    }

    // Check if client profile already exists
    const existing = await prisma.clientProfile.findUnique({
      where: { userProfileId: userProfile.id },
    });

    if (existing) {
      throw new Error('Client profile already exists');
    }

    const profile = await prisma.clientProfile.create({
      data: {
        userProfileId: userProfile.id,
        companyName: data.companyName,
        companySize: data.companySize,
        companyWebsite: data.companyWebsite,
        companyLogoUrl: data.companyLogoUrl,
        industry: data.industry,
        companyBio: data.companyBio,
        typicalBudgetMin: data.typicalBudgetMin,
        typicalBudgetMax: data.typicalBudgetMax,
        preferredCurrency: data.preferredCurrency ?? 'USD',
        typicalProjectTypes: data.typicalProjectTypes ?? [],
        hiringFrequency: data.hiringFrequency,
        teamSize: data.teamSize,
        hasHrDepartment: data.hasHrDepartment ?? false,
      },
    });

    await this.invalidateCache(userId, userProfile.username ?? undefined);

    return profile;
  }

  /**
   * Get client profile by user ID
   */
  async getProfile(userId: string): Promise<ClientProfileWithUser | null> {
    const profile = await prisma.clientProfile.findFirst({
      where: {
        userProfile: {
          userId,
        },
      },
      include: {
        userProfile: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                displayName: true,
                verificationLevel: true,
                status: true,
              },
            },
          },
        },
      },
    });

    return profile;
  }

  /**
   * Get client profile by username (public)
   */
  async getPublicProfile(username: string): Promise<PublicClientProfile> {
    const normalizedUsername = username.toLowerCase();
    const cacheKey = CacheKeys.publicClient(normalizedUsername);

    // Try cache first
    const cached = await this.cache.get<PublicClientProfile>(cacheKey);
    if (cached) {
      return cached;
    }

    const profile = await prisma.clientProfile.findFirst({
      where: {
        userProfile: {
          username: normalizedUsername,
          isPublic: true,
        },
      },
      include: {
        userProfile: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                verificationLevel: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundError(`Client profile not found: ${username}`);
    }

    const publicProfile = this.mapToPublicProfile(profile);

    // Cache result
    await this.cache.set(cacheKey, publicProfile, { ttl: CACHE_TTL });

    return publicProfile;
  }

  /**
   * Update client profile
   */
  async updateProfile(userId: string, data: UpdateClientProfileDto): Promise<ClientProfile> {
    const existing = await this.getProfile(userId);

    if (!existing) {
      throw new NotFoundError('Client profile not found');
    }

    const updateData: Prisma.ClientProfileUpdateInput = {};

    if (data.companyName !== undefined) updateData.companyName = data.companyName;
    if (data.companySize !== undefined) updateData.companySize = data.companySize;
    if (data.companyWebsite !== undefined) updateData.companyWebsite = data.companyWebsite;
    if (data.companyLogoUrl !== undefined) updateData.companyLogoUrl = data.companyLogoUrl;
    if (data.industry !== undefined) updateData.industry = data.industry;
    if (data.companyBio !== undefined) updateData.companyBio = data.companyBio;
    if (data.typicalBudgetMin !== undefined) updateData.typicalBudgetMin = data.typicalBudgetMin;
    if (data.typicalBudgetMax !== undefined) updateData.typicalBudgetMax = data.typicalBudgetMax;
    if (data.preferredCurrency !== undefined) updateData.preferredCurrency = data.preferredCurrency;
    if (data.typicalProjectTypes !== undefined)
      updateData.typicalProjectTypes = data.typicalProjectTypes;
    if (data.hiringFrequency !== undefined) updateData.hiringFrequency = data.hiringFrequency;
    if (data.teamSize !== undefined) updateData.teamSize = data.teamSize;
    if (data.hasHrDepartment !== undefined) updateData.hasHrDepartment = data.hasHrDepartment;

    const profile = await prisma.clientProfile.update({
      where: { id: existing.id },
      data: updateData,
    });

    await this.invalidateCache(userId, existing.userProfile.username ?? undefined);

    return profile;
  }

  /**
   * Update last active timestamp
   */
  async updateLastActive(userId: string): Promise<void> {
    const existing = await this.getProfile(userId);

    if (existing) {
      await prisma.clientProfile.update({
        where: { id: existing.id },
        data: { lastActiveAt: new Date() },
      });
    }
  }

  // ===========================================================================
  // SEARCH
  // ===========================================================================

  /**
   * Search client profiles
   */
  async search(filters: ClientSearchFilters): Promise<PaginatedClients> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.ClientProfileWhereInput = {
      userProfile: {
        isPublic: true,
        username: { not: null },
      },
      ...(filters.companySize?.length && {
        companySize: { in: filters.companySize },
      }),
      ...(filters.industry && {
        industry: { contains: filters.industry, mode: 'insensitive' },
      }),
      ...(filters.hiringFrequency?.length && {
        hiringFrequency: { in: filters.hiringFrequency },
      }),
      ...(filters.minBudget !== undefined && {
        typicalBudgetMin: { gte: filters.minBudget },
      }),
      ...(filters.maxBudget !== undefined && {
        typicalBudgetMax: { lte: filters.maxBudget },
      }),
      ...(filters.isVerified !== undefined && {
        isVerified: filters.isVerified,
      }),
      ...(filters.paymentVerified !== undefined && {
        paymentVerified: filters.paymentVerified,
      }),
      ...(filters.country && {
        userProfile: {
          isPublic: true,
          username: { not: null },
          country: filters.country,
        },
      }),
      ...(filters.query && {
        OR: [
          { companyName: { contains: filters.query, mode: 'insensitive' } },
          { companyBio: { contains: filters.query, mode: 'insensitive' } },
          { industry: { contains: filters.query, mode: 'insensitive' } },
          {
            userProfile: {
              OR: [
                { title: { contains: filters.query, mode: 'insensitive' } },
                { bio: { contains: filters.query, mode: 'insensitive' } },
              ],
            },
          },
        ],
      }),
    };

    const orderBy = this.getSearchOrderBy(filters.sortBy);

    const [profiles, total] = await Promise.all([
      prisma.clientProfile.findMany({
        where,
        include: {
          userProfile: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  displayName: true,
                  verificationLevel: true,
                  createdAt: true,
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy,
      }),
      prisma.clientProfile.count({ where }),
    ]);

    return {
      data: profiles.map((p) => this.mapToPublicProfile(p)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ===========================================================================
  // STATS
  // ===========================================================================

  /**
   * Increment profile views
   */
  async incrementProfileViews(userId: string): Promise<void> {
    const existing = await this.getProfile(userId);

    if (existing) {
      await prisma.clientProfile.update({
        where: { id: existing.id },
        data: {
          profileViewsCount: { increment: 1 },
        },
      });
    }
  }

  /**
   * Update stats (called by other services)
   */
  async updateStats(
    userId: string,
    stats: Partial<{
      totalJobsPosted: number;
      totalHires: number;
      totalSpent: number;
      avgRatingGiven: number;
      avgProjectDuration: number;
      rehireRate: number;
      lastJobPostedAt: Date;
      lastHireAt: Date;
    }>
  ): Promise<void> {
    const existing = await this.getProfile(userId);

    if (!existing) {
      return;
    }

    const updateData: Prisma.ClientProfileUpdateInput = {};

    if (stats.totalJobsPosted !== undefined) updateData.totalJobsPosted = stats.totalJobsPosted;
    if (stats.totalHires !== undefined) updateData.totalHires = stats.totalHires;
    if (stats.totalSpent !== undefined) updateData.totalSpent = stats.totalSpent;
    if (stats.avgRatingGiven !== undefined) updateData.avgRatingGiven = stats.avgRatingGiven;
    if (stats.avgProjectDuration !== undefined)
      updateData.avgProjectDuration = stats.avgProjectDuration;
    if (stats.rehireRate !== undefined) updateData.rehireRate = stats.rehireRate;
    if (stats.lastJobPostedAt !== undefined) updateData.lastJobPostedAt = stats.lastJobPostedAt;
    if (stats.lastHireAt !== undefined) updateData.lastHireAt = stats.lastHireAt;

    await prisma.clientProfile.update({
      where: { id: existing.id },
      data: updateData,
    });

    await this.invalidateCache(userId, existing.userProfile.username ?? undefined);
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private mapToPublicProfile(
    profile: ClientProfile & {
      userProfile: UserProfile & {
        user: {
          firstName: string;
          lastName: string;
          displayName: string | null;
          verificationLevel: string;
          createdAt: Date;
        };
      };
    }
  ): PublicClientProfile {
    const up = profile.userProfile;
    return {
      username: up.username ?? '',
      displayName: up.user.displayName,
      firstName: up.user.firstName,
      lastName: up.user.lastName,
      avatarThumbnail: up.avatarThumbnail,
      avatarSmall: up.avatarSmall,
      avatarMedium: up.avatarMedium,
      avatarLarge: up.avatarLarge,
      companyName: profile.companyName,
      companySize: profile.companySize,
      companyWebsite: profile.companyWebsite,
      companyLogoUrl: profile.companyLogoUrl,
      industry: profile.industry,
      companyBio: profile.companyBio,
      country: up.showLocation ? up.country : null,
      city: up.showLocation ? up.city : null,
      typicalBudgetMin: profile.typicalBudgetMin ? Number(profile.typicalBudgetMin) : null,
      typicalBudgetMax: profile.typicalBudgetMax ? Number(profile.typicalBudgetMax) : null,
      preferredCurrency: profile.preferredCurrency,
      typicalProjectTypes: profile.typicalProjectTypes,
      hiringFrequency: profile.hiringFrequency,
      totalJobsPosted: profile.totalJobsPosted,
      totalHires: profile.totalHires,
      totalSpent: Number(profile.totalSpent),
      avgRatingGiven: Number(profile.avgRatingGiven),
      avgProjectDuration: profile.avgProjectDuration,
      rehireRate: Number(profile.rehireRate),
      verificationLevel: up.user.verificationLevel,
      isVerified: profile.isVerified,
      paymentVerified: profile.paymentVerified,
      linkedinUrl: up.linkedinUrl,
      companyUrl: profile.companyWebsite,
      memberSince: up.user.createdAt.toISOString(),
      lastActiveAt: profile.lastActiveAt.toISOString(),
    };
  }

  private getSearchOrderBy(
    sortBy?: string
  ): Prisma.ClientProfileOrderByWithRelationInput | Prisma.ClientProfileOrderByWithRelationInput[] {
    switch (sortBy) {
      case 'jobs_posted':
        return { totalJobsPosted: 'desc' };
      case 'total_spent':
        return { totalSpent: 'desc' };
      case 'recent':
        return { lastActiveAt: 'desc' };
      case 'relevance':
      default:
        return [{ isVerified: 'desc' }, { totalJobsPosted: 'desc' }, { lastActiveAt: 'desc' }];
    }
  }

  private async invalidateCache(userId: string, username?: string): Promise<void> {
    const keysToDelete = [CacheKeys.clientProfile(userId)];

    if (username) {
      keysToDelete.push(CacheKeys.publicClient(username));
    }

    await Promise.all(keysToDelete.map(async (key) => this.cache.delete(key)));
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let clientProfileServiceInstance: ClientProfileService | null = null;

export function initializeClientProfileService(redis: Redis): ClientProfileService {
  clientProfileServiceInstance = new ClientProfileService(redis);
  return clientProfileServiceInstance;
}

export function getClientProfileService(): ClientProfileService {
  if (!clientProfileServiceInstance) {
    throw new Error(
      'ClientProfileService not initialized. Call initializeClientProfileService first.'
    );
  }
  return clientProfileServiceInstance;
}
