// @ts-nocheck
/**
 * @module @skillancer/auth-svc/services/freelancer-profile
 * Freelancer profile management service
 */

import { CacheService } from '@skillancer/cache';
import {
  prisma,
  type JobType,
  type FreelancerProfile,
  type UserProfile,
  type User,
  type Prisma,
} from '@skillancer/database';

import { getConfig } from '../config/index.js';
import { NotFoundError } from '../errors/index.js';

import type { Redis } from 'ioredis';

// FreelancerAvailability was removed from Prisma schema — define locally
const FreelancerAvailability = {
  AVAILABLE: 'AVAILABLE',
  PARTIALLY: 'PARTIALLY',
  BUSY: 'BUSY',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
  ON_VACATION: 'ON_VACATION',
} as const;
type FreelancerAvailability = (typeof FreelancerAvailability)[keyof typeof FreelancerAvailability];

// =============================================================================
// TYPES
// =============================================================================

export interface CreateFreelancerProfileDto {
  headline: string | null;
  specializations: string[];
  availability: FreelancerAvailability; // Required field, defaults to AVAILABLE
  hoursPerWeek: number | null;
  availableFrom: Date | null;
  hourlyRateMin: number | null;
  hourlyRateMax: number | null;
  preferredCurrency: string; // Required field, defaults to 'USD'
  preferredJobTypes: JobType[];
  preferredDurations: string[];
  preferredProjectMin: number | null;
  preferredProjectMax: number | null;
  remoteOnly: boolean;
  willingToTravel: boolean;
  travelRadius: number | null;
  industries: string[];
  allowDirectContact: boolean;
  responseTime: string | null;
}

export interface UpdateFreelancerProfileDto {
  headline?: string | null;
  specializations?: string[];
  availability?: FreelancerAvailability; // Required field, cannot be null
  hoursPerWeek?: number | null;
  availableFrom?: Date | null;
  hourlyRateMin?: number | null;
  hourlyRateMax?: number | null;
  preferredCurrency?: string; // Required field with default, cannot be null
  preferredJobTypes?: JobType[];
  preferredDurations?: string[];
  preferredProjectMin?: number | null;
  preferredProjectMax?: number | null;
  remoteOnly?: boolean;
  willingToTravel?: boolean;
  travelRadius?: number | null;
  industries?: string[];
  allowDirectContact?: boolean;
  responseTime?: string | null;
}

export interface FreelancerProfileWithUser extends FreelancerProfile {
  userProfile: UserProfile & {
    user: Pick<
      User,
      'id' | 'email' | 'firstName' | 'lastName' | 'displayName' | 'verificationLevel' | 'status'
    >;
  };
}

export interface PublicFreelancerProfile {
  // Basic info
  username: string;
  displayName: string | null;
  firstName: string;
  lastName: string;
  headline: string | null;
  bio: string | null;
  title: string | null;

  // Avatar
  avatarThumbnail: string | null;
  avatarSmall: string | null;
  avatarMedium: string | null;
  avatarLarge: string | null;

  // Location
  country: string | null;
  city: string | null;

  // Professional
  specializations: string[];
  industries: string[];
  yearsExperience: number | null;

  // Availability
  availability: FreelancerAvailability;
  hoursPerWeek: number | null;
  availableFrom: string | null;

  // Rates
  hourlyRateMin: number | null;
  hourlyRateMax: number | null;
  preferredCurrency: string;

  // Preferences
  preferredJobTypes: JobType[];
  preferredDurations: string[];
  remoteOnly: boolean;
  willingToTravel: boolean;

  // Stats
  totalProjects: number;
  completedJobs: number;
  avgRating: number;
  reviewCount: number;
  repeatClientPct: number;

  // Verification
  verificationLevel: string;
  isVerified: boolean;
  isFeatured: boolean;

  // Social
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  twitterUrl: string | null;

  // Meta
  memberSince: string;
  lastActiveAt: string;
  responseTime: string | null;
}

export interface FreelancerSearchFilters {
  skills?: string[];
  specializations?: string[];
  industries?: string[];
  availability?: FreelancerAvailability[];
  minRate?: number;
  maxRate?: number;
  country?: string;
  remoteOnly?: boolean;
  minRating?: number;
  query?: string;
  page?: number;
  limit?: number;
  sortBy?: 'relevance' | 'rate_asc' | 'rate_desc' | 'rating' | 'experience' | 'recent';
}

export interface PaginatedFreelancers {
  data: PublicFreelancerProfile[];
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
  freelancerProfile: (userId: string) => `freelancer:profile:${userId}`,
  publicFreelancer: (username: string) => `freelancer:public:${username.toLowerCase()}`,
};

// =============================================================================
// FREELANCER PROFILE SERVICE
// =============================================================================

export class FreelancerProfileService {
  private readonly config = getConfig();
  private readonly cache: CacheService;

  constructor(redis: Redis) {
    this.cache = new CacheService(redis, 'freelancer');
  }

  // ===========================================================================
  // PROFILE CRUD
  // ===========================================================================

  /**
   * Create freelancer profile for user
   */
  async createProfile(
    userId: string,
    data: CreateFreelancerProfileDto
  ): Promise<FreelancerProfile> {
    // First ensure user has a UserProfile
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!userProfile) {
      throw new NotFoundError('User profile not found. Create a user profile first.');
    }

    // Check if freelancer profile already exists
    const existing = await prisma.freelancerProfile.findUnique({
      where: { userProfileId: userProfile.id },
    });

    if (existing) {
      throw new Error('Freelancer profile already exists');
    }

    const profile = await prisma.freelancerProfile.create({
      data: {
        userProfileId: userProfile.id,
        headline: data.headline,
        specializations: data.specializations ?? [],
        availability: data.availability ?? FreelancerAvailability.AVAILABLE,
        hoursPerWeek: data.hoursPerWeek,
        availableFrom: data.availableFrom,
        hourlyRateMin: data.hourlyRateMin,
        hourlyRateMax: data.hourlyRateMax,
        preferredCurrency: data.preferredCurrency ?? 'USD',
        preferredJobTypes: data.preferredJobTypes ?? [],
        preferredDurations: data.preferredDurations ?? [],
        preferredProjectMin: data.preferredProjectMin,
        preferredProjectMax: data.preferredProjectMax,
        remoteOnly: data.remoteOnly ?? true,
        willingToTravel: data.willingToTravel ?? false,
        travelRadius: data.travelRadius,
        industries: data.industries ?? [],
        allowDirectContact: data.allowDirectContact ?? true,
        responseTime: data.responseTime,
      },
    });

    await this.invalidateCache(userId, userProfile.username ?? undefined);

    return profile;
  }

  /**
   * Get freelancer profile by user ID
   */
  async getProfile(userId: string): Promise<FreelancerProfileWithUser | null> {
    const profile = await prisma.freelancerProfile.findFirst({
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
   * Get freelancer profile by username (public)
   */
  async getPublicProfile(username: string): Promise<PublicFreelancerProfile> {
    const normalizedUsername = username.toLowerCase();
    const cacheKey = CacheKeys.publicFreelancer(normalizedUsername);

    // Try cache first
    const cached = await this.cache.get<PublicFreelancerProfile>(cacheKey);
    if (cached) {
      return cached;
    }

    const profile = await prisma.freelancerProfile.findFirst({
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
      throw new NotFoundError(`Freelancer profile not found: ${username}`);
    }

    const publicProfile = this.mapToPublicProfile(profile);

    // Cache result
    await this.cache.set(cacheKey, publicProfile, { ttl: CACHE_TTL });

    return publicProfile;
  }

  /**
   * Update freelancer profile
   */
  async updateProfile(
    userId: string,
    data: UpdateFreelancerProfileDto
  ): Promise<FreelancerProfile> {
    const existing = await this.getProfile(userId);

    if (!existing) {
      throw new NotFoundError('Freelancer profile not found');
    }

    const updateData: Prisma.FreelancerProfileUpdateInput = {};

    if (data.headline !== undefined) updateData.headline = data.headline;
    if (data.specializations !== undefined) updateData.specializations = data.specializations;
    if (data.availability !== undefined) updateData.availability = data.availability;
    if (data.hoursPerWeek !== undefined) updateData.hoursPerWeek = data.hoursPerWeek;
    if (data.availableFrom !== undefined) updateData.availableFrom = data.availableFrom;
    if (data.hourlyRateMin !== undefined) updateData.hourlyRateMin = data.hourlyRateMin;
    if (data.hourlyRateMax !== undefined) updateData.hourlyRateMax = data.hourlyRateMax;
    if (data.preferredCurrency !== undefined) updateData.preferredCurrency = data.preferredCurrency;
    if (data.preferredJobTypes !== undefined) updateData.preferredJobTypes = data.preferredJobTypes;
    if (data.preferredDurations !== undefined)
      updateData.preferredDurations = data.preferredDurations;
    if (data.preferredProjectMin !== undefined)
      updateData.preferredProjectMin = data.preferredProjectMin;
    if (data.preferredProjectMax !== undefined)
      updateData.preferredProjectMax = data.preferredProjectMax;
    if (data.remoteOnly !== undefined) updateData.remoteOnly = data.remoteOnly;
    if (data.willingToTravel !== undefined) updateData.willingToTravel = data.willingToTravel;
    if (data.travelRadius !== undefined) updateData.travelRadius = data.travelRadius;
    if (data.industries !== undefined) updateData.industries = data.industries;
    if (data.allowDirectContact !== undefined)
      updateData.allowDirectContact = data.allowDirectContact;
    if (data.responseTime !== undefined) updateData.responseTime = data.responseTime;

    const profile = await prisma.freelancerProfile.update({
      where: { id: existing.id },
      data: updateData,
    });

    await this.invalidateCache(userId, existing.userProfile.username ?? undefined);

    return profile;
  }

  /**
   * Update availability status
   */
  async updateAvailability(
    userId: string,
    availability: FreelancerAvailability,
    availableFrom: Date | null
  ): Promise<FreelancerProfile> {
    const existing = await this.getProfile(userId);

    if (!existing) {
      throw new NotFoundError('Freelancer profile not found');
    }

    const profile = await prisma.freelancerProfile.update({
      where: { id: existing.id },
      data: {
        availability,
        availableFrom,
        lastActiveAt: new Date(),
      },
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
      await prisma.freelancerProfile.update({
        where: { id: existing.id },
        data: { lastActiveAt: new Date() },
      });
    }
  }

  // ===========================================================================
  // SEARCH
  // ===========================================================================

  /**
   * Search freelancer profiles
   */
  async search(filters: FreelancerSearchFilters): Promise<PaginatedFreelancers> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.FreelancerProfileWhereInput = {
      userProfile: {
        isPublic: true,
        username: { not: null },
      },
      ...(filters.availability?.length && {
        availability: { in: filters.availability },
      }),
      ...(filters.minRate !== undefined && {
        hourlyRateMin: { gte: filters.minRate },
      }),
      ...(filters.maxRate !== undefined && {
        hourlyRateMax: { lte: filters.maxRate },
      }),
      ...(filters.minRating !== undefined && {
        avgRating: { gte: filters.minRating },
      }),
      ...(filters.remoteOnly !== undefined && {
        remoteOnly: filters.remoteOnly,
      }),
      ...(filters.specializations?.length && {
        specializations: { hasSome: filters.specializations },
      }),
      ...(filters.industries?.length && {
        industries: { hasSome: filters.industries },
      }),
      ...(filters.country && {
        userProfile: {
          isPublic: true,
          username: { not: null },
          country: filters.country,
        },
      }),
      ...(filters.skills?.length && {
        userProfile: {
          isPublic: true,
          username: { not: null },
          user: {
            skills: {
              some: {
                skill: {
                  slug: { in: filters.skills },
                },
              },
            },
          },
        },
      }),
      ...(filters.query && {
        OR: [
          { headline: { contains: filters.query, mode: 'insensitive' } },
          { specializations: { has: filters.query } },
          { industries: { has: filters.query } },
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
      prisma.freelancerProfile.findMany({
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
      prisma.freelancerProfile.count({ where }),
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
      await prisma.freelancerProfile.update({
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
      totalProjects: number;
      completedJobs: number;
      totalEarnings: number;
      avgRating: number;
      reviewCount: number;
      repeatClientPct: number;
      proposalsSent: number;
    }>
  ): Promise<void> {
    const existing = await this.getProfile(userId);

    if (!existing) {
      return;
    }

    const updateData: Prisma.FreelancerProfileUpdateInput = {};

    if (stats.totalProjects !== undefined) updateData.totalProjects = stats.totalProjects;
    if (stats.completedJobs !== undefined) updateData.completedJobs = stats.completedJobs;
    if (stats.totalEarnings !== undefined) updateData.totalEarnings = stats.totalEarnings;
    if (stats.avgRating !== undefined) updateData.avgRating = stats.avgRating;
    if (stats.reviewCount !== undefined) updateData.reviewCount = stats.reviewCount;
    if (stats.repeatClientPct !== undefined) updateData.repeatClientPct = stats.repeatClientPct;
    if (stats.proposalsSent !== undefined) updateData.proposalsSent = stats.proposalsSent;

    await prisma.freelancerProfile.update({
      where: { id: existing.id },
      data: updateData,
    });

    await this.invalidateCache(userId, existing.userProfile.username ?? undefined);
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private mapToPublicProfile(
    profile: FreelancerProfile & {
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
  ): PublicFreelancerProfile {
    const up = profile.userProfile;
    return {
      username: up.username ?? '',
      displayName: up.user.displayName,
      firstName: up.user.firstName,
      lastName: up.user.lastName,
      headline: profile.headline,
      bio: up.bio,
      title: up.title,
      avatarThumbnail: up.avatarThumbnail,
      avatarSmall: up.avatarSmall,
      avatarMedium: up.avatarMedium,
      avatarLarge: up.avatarLarge,
      country: up.showLocation ? up.country : null,
      city: up.showLocation ? up.city : null,
      specializations: profile.specializations,
      industries: profile.industries,
      yearsExperience: up.yearsExperience,
      availability: profile.availability,
      hoursPerWeek: profile.hoursPerWeek,
      availableFrom: profile.availableFrom?.toISOString() ?? null,
      hourlyRateMin: up.showRate && profile.hourlyRateMin ? Number(profile.hourlyRateMin) : null,
      hourlyRateMax: up.showRate && profile.hourlyRateMax ? Number(profile.hourlyRateMax) : null,
      preferredCurrency: profile.preferredCurrency,
      preferredJobTypes: profile.preferredJobTypes,
      preferredDurations: profile.preferredDurations,
      remoteOnly: profile.remoteOnly,
      willingToTravel: profile.willingToTravel,
      totalProjects: profile.totalProjects,
      completedJobs: profile.completedJobs,
      avgRating: Number(profile.avgRating),
      reviewCount: profile.reviewCount,
      repeatClientPct: Number(profile.repeatClientPct),
      verificationLevel: up.user.verificationLevel,
      isVerified: profile.isVerified,
      isFeatured: profile.isFeatured,
      linkedinUrl: up.linkedinUrl,
      githubUrl: up.githubUrl,
      portfolioUrl: up.portfolioUrl,
      twitterUrl: up.twitterUrl,
      memberSince: up.user.createdAt.toISOString(),
      lastActiveAt: profile.lastActiveAt.toISOString(),
      responseTime: profile.responseTime,
    };
  }

  private getSearchOrderBy(
    sortBy?: string
  ):
    | Prisma.FreelancerProfileOrderByWithRelationInput
    | Prisma.FreelancerProfileOrderByWithRelationInput[] {
    switch (sortBy) {
      case 'rate_asc':
        return { hourlyRateMin: { sort: 'asc', nulls: 'last' } };
      case 'rate_desc':
        return { hourlyRateMax: { sort: 'desc', nulls: 'last' } };
      case 'rating':
        return [{ avgRating: 'desc' }, { reviewCount: 'desc' }];
      case 'experience':
        return { userProfile: { yearsExperience: { sort: 'desc', nulls: 'last' } } };
      case 'recent':
        return { lastActiveAt: 'desc' };
      case 'relevance':
      default:
        return [{ searchRank: 'desc' }, { avgRating: 'desc' }, { lastActiveAt: 'desc' }];
    }
  }

  private async invalidateCache(userId: string, username?: string): Promise<void> {
    const keysToDelete = [CacheKeys.freelancerProfile(userId)];

    if (username) {
      keysToDelete.push(CacheKeys.publicFreelancer(username));
    }

    await Promise.all(keysToDelete.map(async (key) => this.cache.delete(key)));
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let freelancerProfileServiceInstance: FreelancerProfileService | null = null;

export function initializeFreelancerProfileService(redis: Redis): FreelancerProfileService {
  freelancerProfileServiceInstance = new FreelancerProfileService(redis);
  return freelancerProfileServiceInstance;
}

export function getFreelancerProfileService(): FreelancerProfileService {
  if (!freelancerProfileServiceInstance) {
    throw new Error(
      'FreelancerProfileService not initialized. Call initializeFreelancerProfileService first.'
    );
  }
  return freelancerProfileServiceInstance;
}
