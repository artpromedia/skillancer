/**
 * @module @skillancer/auth-svc/services/profile
 * User profile management service
 */

import { CacheService } from '@skillancer/cache';
import {
  prisma,
  type UserProfile,
  type User,
  type UserSkill,
  type Skill,
  type Prisma,
} from '@skillancer/database';

import { getConfig } from '../config/index.js';
import {
  ProfileNotFoundError,
  UsernameNotAvailableError,
  InvalidUsernameError,
} from '../errors/index.js';

import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface UpdateProfileDto {
  title?: string | null | undefined;
  bio?: string | null | undefined;
  hourlyRate?: number | null | undefined;
  currency?: string | undefined;
  yearsExperience?: number | null | undefined;
  country?: string | null | undefined;
  city?: string | null | undefined;
  linkedinUrl?: string | null | undefined;
  githubUrl?: string | null | undefined;
  portfolioUrl?: string | null | undefined;
  twitterUrl?: string | null | undefined;
  isPublic?: boolean | undefined;
  showEmail?: boolean | undefined;
  showRate?: boolean | undefined;
  showLocation?: boolean | undefined;
}

export interface ProfileWithUser extends UserProfile {
  user: Pick<
    User,
    'id' | 'email' | 'firstName' | 'lastName' | 'displayName' | 'verificationLevel' | 'status'
  >;
}

export interface ProfileWithSkills extends ProfileWithUser {
  skills: (UserSkill & { skill: Skill })[];
}

export interface PublicProfile {
  username: string;
  displayName: string | null;
  firstName: string;
  lastName: string;
  title: string | null;
  bio: string | null;
  hourlyRate: number | null;
  currency: string;
  yearsExperience: number | null;
  country: string | null;
  city: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  twitterUrl: string | null;
  avatarThumbnail: string | null;
  avatarSmall: string | null;
  avatarMedium: string | null;
  avatarLarge: string | null;
  verificationLevel: string;
  skills: {
    id: string;
    name: string;
    slug: string;
    category: string;
    level: string;
    yearsExp: number | null;
    isPrimary: boolean;
  }[];
  memberSince: string;
}

export interface ProfileSearchFilters {
  skills?: string[] | undefined;
  minRate?: number | undefined;
  maxRate?: number | undefined;
  country?: string | undefined;
  query?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
  sortBy?: 'relevance' | 'rate_asc' | 'rate_desc' | 'experience' | undefined;
}

export interface PaginatedProfiles {
  data: PublicProfile[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProfileCompletenessSection {
  score: number;
  maxScore: number;
  missing: string[];
}

export interface ProfileCompleteness {
  score: number;
  maxScore: number;
  percentage: number;
  sections: {
    basicInfo: ProfileCompletenessSection;
    professional: ProfileCompletenessSection;
    skills: ProfileCompletenessSection;
    social: ProfileCompletenessSection;
    verification: ProfileCompletenessSection;
  };
  nextSteps: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const RESERVED_USERNAMES = [
  'admin',
  'administrator',
  'root',
  'system',
  'support',
  'help',
  'api',
  'www',
  'mail',
  'email',
  'ftp',
  'ssh',
  'login',
  'register',
  'signup',
  'signin',
  'signout',
  'logout',
  'auth',
  'oauth',
  'settings',
  'profile',
  'profiles',
  'user',
  'users',
  'account',
  'accounts',
  'dashboard',
  'home',
  'about',
  'contact',
  'terms',
  'privacy',
  'legal',
  'blog',
  'news',
  'jobs',
  'careers',
  'hire',
  'freelancer',
  'freelancers',
  'client',
  'clients',
  'skillancer',
  'skillpod',
  'cockpit',
  'market',
  'marketplace',
  'billing',
  'payment',
  'payments',
  'invoice',
  'invoices',
  'pricing',
  'plans',
  'enterprise',
  'team',
  'teams',
  'org',
  'organization',
  'company',
  'null',
  'undefined',
  'test',
  'demo',
  'example',
];

const USERNAME_REGEX = /^[a-z][a-z0-9_-]*[a-z0-9]$/;
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 30;

const CACHE_TTL = 5 * 60; // 5 minutes

const CacheKeys = {
  publicProfile: (username: string) => `profile:public:${username.toLowerCase()}`,
  userProfile: (userId: string) => `profile:user:${userId}`,
  profileCompleteness: (userId: string) => `profile:completeness:${userId}`,
};

// =============================================================================
// PROFILE SERVICE
// =============================================================================

/**
 * User profile management service
 *
 * Handles:
 * - Profile CRUD operations
 * - Username management for public URLs
 * - Public profile retrieval with caching
 * - Profile search and filtering
 * - Profile completeness calculation
 */
export class ProfileService {
  private readonly config = getConfig();
  private readonly cache: CacheService;

  constructor(redis: Redis) {
    this.cache = new CacheService(redis, 'profile');
  }

  // ===========================================================================
  // PROFILE CRUD
  // ===========================================================================

  /**
   * Get user's profile, creating one if it doesn't exist
   */
  async getProfile(userId: string): Promise<ProfileWithUser> {
    let profile = await prisma.userProfile.findUnique({
      where: { userId },
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
    });

    if (!profile) {
      // Create profile if it doesn't exist
      profile = await prisma.userProfile.create({
        data: { userId },
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
      });
    }

    return profile;
  }

  /**
   * Get user's profile with skills
   */
  async getProfileWithSkills(userId: string): Promise<ProfileWithSkills> {
    const profile = await this.getProfile(userId);

    const skills = await prisma.userSkill.findMany({
      where: { userId },
      include: { skill: true },
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
    });

    return {
      ...profile,
      skills,
    };
  }

  /**
   * Update user's profile
   */
  async updateProfile(userId: string, data: UpdateProfileDto): Promise<ProfileWithUser> {
    // Ensure profile exists
    await this.getProfile(userId);

    // Build update data object, only including defined properties
    const updateData: Prisma.UserProfileUpdateInput = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.hourlyRate !== undefined) updateData.hourlyRate = data.hourlyRate;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.yearsExperience !== undefined) updateData.yearsExperience = data.yearsExperience;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.linkedinUrl !== undefined) updateData.linkedinUrl = data.linkedinUrl;
    if (data.githubUrl !== undefined) updateData.githubUrl = data.githubUrl;
    if (data.portfolioUrl !== undefined) updateData.portfolioUrl = data.portfolioUrl;
    if (data.twitterUrl !== undefined) updateData.twitterUrl = data.twitterUrl;
    if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;
    if (data.showEmail !== undefined) updateData.showEmail = data.showEmail;
    if (data.showRate !== undefined) updateData.showRate = data.showRate;
    if (data.showLocation !== undefined) updateData.showLocation = data.showLocation;

    const profile = await prisma.userProfile.update({
      where: { userId },
      data: updateData,
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
    });

    // Update completeness score
    await this.updateCompletenessScore(userId);

    // Invalidate caches
    await this.invalidateProfileCache(userId, profile.username ?? undefined);

    return profile;
  }

  // ===========================================================================
  // USERNAME MANAGEMENT
  // ===========================================================================

  /**
   * Check if username is available
   */
  async isUsernameAvailable(username: string): Promise<boolean> {
    const normalizedUsername = username.toLowerCase();

    // Check reserved usernames
    if (RESERVED_USERNAMES.includes(normalizedUsername)) {
      return false;
    }

    // Check format
    if (!this.isValidUsernameFormat(normalizedUsername)) {
      return false;
    }

    // Check database
    const existing = await prisma.userProfile.findUnique({
      where: { username: normalizedUsername },
      select: { id: true },
    });

    return !existing;
  }

  /**
   * Set username for public profile URL
   */
  async setUsername(userId: string, username: string): Promise<void> {
    const normalizedUsername = username.toLowerCase();

    // Validate format
    if (!this.isValidUsernameFormat(normalizedUsername)) {
      throw new InvalidUsernameError(
        `Username must be ${MIN_USERNAME_LENGTH}-${MAX_USERNAME_LENGTH} characters, ` +
          'start with a letter, and contain only lowercase letters, numbers, underscores, and hyphens'
      );
    }

    // Check reserved usernames
    if (RESERVED_USERNAMES.includes(normalizedUsername)) {
      throw new UsernameNotAvailableError(username);
    }

    // Ensure profile exists
    const profile = await this.getProfile(userId);
    const oldUsername = profile.username;

    // Check availability (if changing from existing)
    if (oldUsername?.toLowerCase() !== normalizedUsername) {
      const isAvailable = await this.isUsernameAvailable(normalizedUsername);
      if (!isAvailable) {
        throw new UsernameNotAvailableError(username);
      }
    }

    // Update username
    await prisma.userProfile.update({
      where: { userId },
      data: { username: normalizedUsername },
    });

    // Invalidate old username cache if it existed
    if (oldUsername) {
      await this.cache.delete(CacheKeys.publicProfile(oldUsername));
    }
  }

  /**
   * Validate username format
   */
  private isValidUsernameFormat(username: string): boolean {
    if (username.length < MIN_USERNAME_LENGTH || username.length > MAX_USERNAME_LENGTH) {
      return false;
    }

    // Single character usernames not matching regex
    if (username.length === 1) {
      return false;
    }

    // Two character usernames: both must be alphanumeric
    if (username.length === 2) {
      return /^[a-z][a-z0-9]$/.test(username);
    }

    return USERNAME_REGEX.test(username);
  }

  // ===========================================================================
  // PUBLIC PROFILES
  // ===========================================================================

  /**
   * Get public profile by username
   */
  async getPublicProfile(username: string): Promise<PublicProfile> {
    const normalizedUsername = username.toLowerCase();
    const cacheKey = CacheKeys.publicProfile(normalizedUsername);

    // Try cache first
    const cached = await this.cache.get<PublicProfile>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const profile = await prisma.userProfile.findUnique({
      where: { username: normalizedUsername, isPublic: true },
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
    });

    if (!profile) {
      throw new ProfileNotFoundError(username);
    }

    // Get skills
    const skills = await prisma.userSkill.findMany({
      where: { userId: profile.userId },
      include: { skill: true },
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
    });

    const publicProfile = this.mapToPublicProfile(profile, skills);

    // Cache result
    await this.cache.set(cacheKey, publicProfile, { ttl: CACHE_TTL });

    return publicProfile;
  }

  /**
   * Search public profiles with filters
   */
  async searchProfiles(filters: ProfileSearchFilters): Promise<PaginatedProfiles> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.UserProfileWhereInput = {
      isPublic: true,
      username: { not: null },
      ...(filters.skills?.length && {
        user: {
          skills: {
            some: {
              skill: {
                slug: { in: filters.skills },
              },
            },
          },
        },
      }),
      ...(filters.minRate !== undefined && { hourlyRate: { gte: filters.minRate } }),
      ...(filters.maxRate !== undefined && { hourlyRate: { lte: filters.maxRate } }),
      ...(filters.country && { country: filters.country }),
      ...(filters.query && {
        OR: [
          { title: { contains: filters.query, mode: 'insensitive' } },
          { bio: { contains: filters.query, mode: 'insensitive' } },
          { user: { firstName: { contains: filters.query, mode: 'insensitive' } } },
          { user: { lastName: { contains: filters.query, mode: 'insensitive' } } },
        ],
      }),
    };

    const orderBy = this.getSearchOrderBy(filters.sortBy);

    const [profiles, total] = await Promise.all([
      prisma.userProfile.findMany({
        where,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
              verificationLevel: true,
              createdAt: true,
              skills: {
                include: { skill: true },
                orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
                take: 5,
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy,
      }),
      prisma.userProfile.count({ where }),
    ]);

    return {
      data: profiles.map((profile) => this.mapToPublicProfile(profile, profile.user.skills)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Map database profile to public profile response
   */
  private mapToPublicProfile(
    profile: UserProfile & {
      user: {
        firstName: string;
        lastName: string;
        displayName: string | null;
        verificationLevel: string;
        createdAt: Date;
      };
    },
    skills: (UserSkill & { skill: Skill })[]
  ): PublicProfile {
    // username is guaranteed to exist for public profiles
    const username = profile.username ?? '';
    return {
      username,
      displayName: profile.user.displayName,
      firstName: profile.user.firstName,
      lastName: profile.user.lastName,
      title: profile.title,
      bio: profile.bio,
      hourlyRate: profile.showRate && profile.hourlyRate ? Number(profile.hourlyRate) : null,
      currency: profile.currency,
      yearsExperience: profile.yearsExperience,
      country: profile.showLocation ? profile.country : null,
      city: profile.showLocation ? profile.city : null,
      linkedinUrl: profile.linkedinUrl,
      githubUrl: profile.githubUrl,
      portfolioUrl: profile.portfolioUrl,
      twitterUrl: profile.twitterUrl,
      avatarThumbnail: profile.avatarThumbnail,
      avatarSmall: profile.avatarSmall,
      avatarMedium: profile.avatarMedium,
      avatarLarge: profile.avatarLarge,
      verificationLevel: profile.user.verificationLevel,
      skills: skills.map((us) => ({
        id: us.skill.id,
        name: us.skill.name,
        slug: us.skill.slug,
        category: us.skill.category,
        level: us.level,
        yearsExp: us.yearsExp,
        isPrimary: us.isPrimary,
      })),
      memberSince: profile.user.createdAt.toISOString(),
    };
  }

  /**
   * Get order by clause for search
   */
  private getSearchOrderBy(
    sortBy?: string
  ): Prisma.UserProfileOrderByWithRelationInput | Prisma.UserProfileOrderByWithRelationInput[] {
    switch (sortBy) {
      case 'rate_asc':
        return { hourlyRate: { sort: 'asc', nulls: 'last' } };
      case 'rate_desc':
        return { hourlyRate: { sort: 'desc', nulls: 'last' } };
      case 'experience':
        return { yearsExperience: { sort: 'desc', nulls: 'last' } };
      case 'relevance':
      default:
        return [{ completenessScore: 'desc' }, { createdAt: 'desc' }];
    }
  }

  // ===========================================================================
  // PROFILE COMPLETENESS
  // ===========================================================================

  /**
   * Calculate profile completeness
   */
  async calculateCompleteness(userId: string): Promise<ProfileCompleteness> {
    const profile = await this.getProfileWithSkills(userId);

    const sections = {
      basicInfo: this.calculateBasicInfoScore(profile),
      professional: this.calculateProfessionalScore(profile),
      skills: this.calculateSkillsScore(profile),
      social: this.calculateSocialScore(profile),
      verification: this.calculateVerificationScore(profile),
    };

    const totalScore = Object.values(sections).reduce((sum, s) => sum + s.score, 0);
    const maxScore = Object.values(sections).reduce((sum, s) => sum + s.maxScore, 0);
    const percentage = Math.round((totalScore / maxScore) * 100);

    const nextSteps = this.generateNextSteps(sections);

    return {
      score: totalScore,
      maxScore,
      percentage,
      sections,
      nextSteps,
    };
  }

  /**
   * Update cached completeness score in profile
   */
  async updateCompletenessScore(userId: string): Promise<void> {
    const completeness = await this.calculateCompleteness(userId);

    await prisma.userProfile.update({
      where: { userId },
      data: { completenessScore: completeness.percentage },
    });

    // Invalidate completeness cache
    await this.cache.delete(CacheKeys.profileCompleteness(userId));
  }

  private calculateBasicInfoScore(profile: ProfileWithSkills): ProfileCompletenessSection {
    const maxScore = 25;
    let score = 0;
    const missing: string[] = [];

    if (profile.user.firstName && profile.user.lastName) {
      score += 5;
    } else {
      missing.push('Full name');
    }

    if (profile.avatarMedium) {
      score += 10;
    } else {
      missing.push('Profile photo');
    }

    if (profile.username) {
      score += 5;
    } else {
      missing.push('Username for public profile');
    }

    if (profile.country) {
      score += 5;
    } else {
      missing.push('Location');
    }

    return { score, maxScore, missing };
  }

  private calculateProfessionalScore(profile: ProfileWithSkills): ProfileCompletenessSection {
    const maxScore = 30;
    let score = 0;
    const missing: string[] = [];

    if (profile.title) {
      score += 10;
    } else {
      missing.push('Professional title');
    }

    if (profile.bio && profile.bio.length >= 50) {
      score += 15;
    } else if (profile.bio) {
      score += 5;
      missing.push('Longer bio (at least 50 characters)');
    } else {
      missing.push('Professional bio');
    }

    if (profile.hourlyRate) {
      score += 5;
    } else {
      missing.push('Hourly rate');
    }

    return { score, maxScore, missing };
  }

  private calculateSkillsScore(profile: ProfileWithSkills): ProfileCompletenessSection {
    const maxScore = 20;
    let score = 0;
    const missing: string[] = [];

    const skillCount = profile.skills.length;
    const primarySkills = profile.skills.filter((s) => s.isPrimary).length;

    if (skillCount >= 5) {
      score += 15;
    } else if (skillCount >= 3) {
      score += 10;
    } else if (skillCount >= 1) {
      score += 5;
    } else {
      missing.push('Skills (add at least 3)');
    }

    if (primarySkills >= 1) {
      score += 5;
    } else {
      missing.push('Primary skill designation');
    }

    return { score, maxScore, missing };
  }

  private calculateSocialScore(profile: ProfileWithSkills): ProfileCompletenessSection {
    const maxScore = 15;
    let score = 0;
    const missing: string[] = [];

    const socialLinks = [
      profile.linkedinUrl,
      profile.githubUrl,
      profile.portfolioUrl,
      profile.twitterUrl,
    ].filter(Boolean);

    if (socialLinks.length >= 3) {
      score += 15;
    } else if (socialLinks.length >= 2) {
      score += 10;
    } else if (socialLinks.length >= 1) {
      score += 5;
    } else {
      missing.push('Social links (LinkedIn, GitHub, portfolio)');
    }

    return { score, maxScore, missing };
  }

  private calculateVerificationScore(profile: ProfileWithSkills): ProfileCompletenessSection {
    const maxScore = 10;
    let score = 0;
    const missing: string[] = [];

    switch (profile.user.verificationLevel) {
      case 'PREMIUM':
        score = 10;
        break;
      case 'ENHANCED':
        score = 8;
        break;
      case 'BASIC':
        score = 5;
        break;
      case 'EMAIL':
        score = 3;
        break;
      default:
        missing.push('Email verification');
    }

    if (score < maxScore) {
      missing.push('Complete identity verification');
    }

    return { score, maxScore, missing };
  }

  private generateNextSteps(sections: ProfileCompleteness['sections']): string[] {
    const steps: string[] = [];

    // Priority order: basic > professional > skills > social > verification
    if (sections.basicInfo.missing.length > 0) {
      steps.push(...sections.basicInfo.missing.slice(0, 2));
    }
    if (sections.professional.missing.length > 0) {
      steps.push(...sections.professional.missing.slice(0, 2));
    }
    if (sections.skills.missing.length > 0) {
      steps.push(...sections.skills.missing.slice(0, 1));
    }
    if (sections.social.missing.length > 0) {
      steps.push(...sections.social.missing.slice(0, 1));
    }

    return steps.slice(0, 5);
  }

  // ===========================================================================
  // AVATAR MANAGEMENT
  // ===========================================================================

  /**
   * Update avatar URLs after processing
   */
  async updateAvatarUrls(
    userId: string,
    urls: {
      original: string;
      thumbnail: string;
      small: string;
      medium: string;
      large: string;
    }
  ): Promise<void> {
    await prisma.userProfile.update({
      where: { userId },
      data: {
        avatarOriginal: urls.original,
        avatarThumbnail: urls.thumbnail,
        avatarSmall: urls.small,
        avatarMedium: urls.medium,
        avatarLarge: urls.large,
      },
    });

    // Update completeness score
    await this.updateCompletenessScore(userId);

    // Invalidate caches
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { username: true },
    });
    await this.invalidateProfileCache(userId, profile?.username ?? undefined);
  }

  /**
   * Remove avatar URLs
   */
  async removeAvatarUrls(userId: string): Promise<void> {
    await prisma.userProfile.update({
      where: { userId },
      data: {
        avatarOriginal: null,
        avatarThumbnail: null,
        avatarSmall: null,
        avatarMedium: null,
        avatarLarge: null,
      },
    });

    // Update completeness score
    await this.updateCompletenessScore(userId);

    // Invalidate caches
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { username: true },
    });
    await this.invalidateProfileCache(userId, profile?.username ?? undefined);
  }

  // ===========================================================================
  // CACHE MANAGEMENT
  // ===========================================================================

  /**
   * Invalidate profile caches
   */
  async invalidateProfileCache(userId: string, username?: string): Promise<void> {
    const keysToDelete = [CacheKeys.userProfile(userId), CacheKeys.profileCompleteness(userId)];

    if (username) {
      keysToDelete.push(CacheKeys.publicProfile(username));
    }

    await Promise.all(keysToDelete.map(async (key) => this.cache.delete(key)));
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let profileServiceInstance: ProfileService | null = null;

export function initializeProfileService(redis: Redis): ProfileService {
  profileServiceInstance = new ProfileService(redis);
  return profileServiceInstance;
}

export function getProfileService(): ProfileService {
  if (!profileServiceInstance) {
    throw new Error('ProfileService not initialized. Call initializeProfileService first.');
  }
  return profileServiceInstance;
}
