// @ts-nocheck
/**
 * Unified Profile Service
 * Cross-platform profile aggregation and deduplication
 * Sprint M4: Portable Verified Work History
 */

import { createLogger } from '@skillancer/logger';
import { prisma } from '@skillancer/database';
import { createHash } from 'crypto';
import { Platform, VerificationLevel, PlatformProfile } from '../integrations/platform-connector';

const logger = createLogger('unified-profile');

// =============================================================================
// TYPES
// =============================================================================

export interface UnifiedProfile {
  userId: string;
  displayName: string;
  headline: string;
  bio: string;
  avatarUrl: string | null;
  location: string | null;
  timezone: string | null;
  languages: string[];

  // Connected platforms
  connectedPlatforms: ConnectedPlatformInfo[];

  // Aggregated data
  totalProjects: number;
  completedProjects: number;
  totalEarnings: number;
  currency: string;

  // Skills
  skills: UnifiedSkill[];

  // Reviews
  reviewSummary: ReviewSummary;

  // Reputation
  reputationScore: number;
  verificationLevel: VerificationLevel;

  // Timeline
  careerStartDate: Date | null;
  yearsOfExperience: number;

  // Metadata
  profileCompleteness: number;
  lastSyncedAt: Date | null;
  profileHash: string;
}

export interface ConnectedPlatformInfo {
  platform: Platform;
  username: string;
  profileUrl: string;
  joinedDate: Date | null;
  projectCount: number;
  earnings: number;
  rating: number | null;
  isActive: boolean;
  lastSyncedAt: Date | null;
}

export interface UnifiedSkill {
  name: string;
  normalizedName: string;
  projectCount: number;
  verifiedProjectCount: number;
  platforms: Platform[];
  endorsements: number;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export interface ReviewSummary {
  totalReviews: number;
  verifiedReviews: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  recentRating: number; // Last 6 months
  platforms: Record<Platform, { count: number; rating: number }>;
}

export interface ProfileMergeConflict {
  field: string;
  platforms: { platform: Platform; value: any }[];
  resolvedValue: any;
  resolution: 'most_recent' | 'most_verified' | 'manual' | 'combined';
}

export interface ProfileUpdateRequest {
  displayName?: string;
  headline?: string;
  bio?: string;
  location?: string;
  timezone?: string;
  languages?: string[];
  preferredAvatar?: Platform;
}

// =============================================================================
// SKILL NORMALIZATION
// =============================================================================

const SKILL_SYNONYMS: Record<string, string[]> = {
  javascript: ['js', 'ecmascript', 'es6', 'es2015'],
  typescript: ['ts'],
  react: ['reactjs', 'react.js'],
  'node.js': ['nodejs', 'node'],
  python: ['python3', 'py'],
  css: ['css3', 'cascading style sheets'],
  html: ['html5', 'hypertext markup language'],
  postgresql: ['postgres', 'psql'],
  mongodb: ['mongo'],
  'amazon web services': ['aws'],
  'google cloud platform': ['gcp', 'google cloud'],
  'user experience': ['ux', 'ux design'],
  'user interface': ['ui', 'ui design'],
  'search engine optimization': ['seo'],
  'application programming interface': ['api', 'apis'],
};

const SKILL_LEVELS = {
  beginner: { minProjects: 1, minVerified: 0 },
  intermediate: { minProjects: 3, minVerified: 1 },
  advanced: { minProjects: 7, minVerified: 3 },
  expert: { minProjects: 15, minVerified: 7 },
};

// =============================================================================
// UNIFIED PROFILE SERVICE
// =============================================================================

export class UnifiedProfileService {
  // ---------------------------------------------------------------------------
  // PROFILE GENERATION
  // ---------------------------------------------------------------------------

  /**
   * Generate unified profile from all platform data
   */
  async generateUnifiedProfile(userId: string): Promise<UnifiedProfile> {
    logger.info({ userId }, 'Generating unified profile');

    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        platformConnections: true,
        workHistory: {
          include: { reviews: true },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Aggregate platform data
    const connectedPlatforms = await this.aggregatePlatformInfo(user);

    // Aggregate skills
    const skills = this.aggregateSkills(user.workHistory);

    // Aggregate reviews
    const reviewSummary = this.aggregateReviews(user.workHistory);

    // Calculate totals
    const totalProjects = user.workHistory.length;
    const completedProjects = user.workHistory.filter((wh) => wh.status === 'COMPLETED').length;
    const totalEarnings = user.workHistory.reduce((sum, wh) => sum + (wh.earnings || 0), 0);

    // Calculate experience
    const careerStartDate = this.findCareerStartDate(user.workHistory);
    const yearsOfExperience = careerStartDate
      ? (Date.now() - careerStartDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      : 0;

    // Get highest verification level
    const verificationLevel = this.getHighestVerificationLevel(user.workHistory);

    // Calculate reputation score
    const reputationScore = await this.calculateReputationScore(userId);

    // Merge profile fields with conflict resolution
    const mergedFields = await this.mergeProfileFields(userId, connectedPlatforms);

    // Calculate completeness
    const profileCompleteness = this.calculateProfileCompleteness({
      ...user,
      ...mergedFields,
      connectedPlatforms,
      skills,
      reviewSummary,
    });

    // Generate hash for change detection
    const profileHash = this.generateProfileHash(user.workHistory);

    const profile: UnifiedProfile = {
      userId,
      displayName: mergedFields.displayName || user.name || 'Freelancer',
      headline: mergedFields.headline || this.generateHeadline(skills),
      bio: mergedFields.bio || '',
      avatarUrl: mergedFields.avatarUrl || user.avatarUrl,
      location: mergedFields.location || null,
      timezone: mergedFields.timezone || null,
      languages: mergedFields.languages || [],
      connectedPlatforms,
      totalProjects,
      completedProjects,
      totalEarnings,
      currency: 'USD',
      skills,
      reviewSummary,
      reputationScore,
      verificationLevel,
      careerStartDate,
      yearsOfExperience: Math.floor(yearsOfExperience * 10) / 10,
      profileCompleteness,
      lastSyncedAt: this.getLastSyncDate(user.platformConnections),
      profileHash,
    };

    // Store unified profile
    await this.storeUnifiedProfile(profile);

    logger.info(
      {
        userId,
        platforms: connectedPlatforms.length,
        projects: totalProjects,
        reputationScore,
      },
      'Unified profile generated'
    );

    return profile;
  }

  // ---------------------------------------------------------------------------
  // PLATFORM AGGREGATION
  // ---------------------------------------------------------------------------

  private async aggregatePlatformInfo(user: any): Promise<ConnectedPlatformInfo[]> {
    const platforms: ConnectedPlatformInfo[] = [];

    for (const connection of user.platformConnections) {
      const platformWorkHistory = user.workHistory.filter(
        (wh: any) => wh.platform === connection.platform
      );

      const earnings = platformWorkHistory.reduce(
        (sum: number, wh: any) => sum + (wh.earnings || 0),
        0
      );

      const reviews = platformWorkHistory.flatMap((wh: any) => wh.reviews || []);
      const avgRating =
        reviews.length > 0
          ? (reviews.reduce((sum: number, r: any) => sum + r.rating / (r.maxRating || 5), 0) /
              reviews.length) *
            5
          : null;

      platforms.push({
        platform: connection.platform as Platform,
        username: connection.platformUsername || '',
        profileUrl: connection.profileUrl || '',
        joinedDate: connection.platformJoinedDate,
        projectCount: platformWorkHistory.length,
        earnings,
        rating: avgRating ? Math.round(avgRating * 100) / 100 : null,
        isActive: connection.isActive,
        lastSyncedAt: connection.lastSyncedAt,
      });
    }

    return platforms;
  }

  // ---------------------------------------------------------------------------
  // SKILL AGGREGATION
  // ---------------------------------------------------------------------------

  private aggregateSkills(workHistory: any[]): UnifiedSkill[] {
    const skillMap = new Map<
      string,
      {
        original: string;
        projects: Set<string>;
        verifiedProjects: Set<string>;
        platforms: Set<Platform>;
      }
    >();

    for (const wh of workHistory) {
      const skills = wh.skills || [];
      const isVerified = wh.verificationLevel !== VerificationLevel.SELF_REPORTED;

      for (const skill of skills) {
        const normalized = this.normalizeSkillName(skill);
        const existing = skillMap.get(normalized) || {
          original: skill,
          projects: new Set(),
          verifiedProjects: new Set(),
          platforms: new Set(),
        };

        existing.projects.add(wh.id);
        if (isVerified) {
          existing.verifiedProjects.add(wh.id);
        }
        existing.platforms.add(wh.platform as Platform);

        skillMap.set(normalized, existing);
      }
    }

    // Convert to array and calculate levels
    const skills: UnifiedSkill[] = Array.from(skillMap.entries()).map(([normalized, data]) => ({
      name: data.original,
      normalizedName: normalized,
      projectCount: data.projects.size,
      verifiedProjectCount: data.verifiedProjects.size,
      platforms: Array.from(data.platforms),
      endorsements: 0, // Could be populated from platform data
      level: this.calculateSkillLevel(data.projects.size, data.verifiedProjects.size),
    }));

    // Sort by project count
    return skills.sort((a, b) => b.projectCount - a.projectCount);
  }

  private normalizeSkillName(skill: string): string {
    const lower = skill.toLowerCase().trim();

    // Check for synonyms
    for (const [canonical, synonyms] of Object.entries(SKILL_SYNONYMS)) {
      if (synonyms.includes(lower) || lower === canonical) {
        return canonical;
      }
    }

    return lower;
  }

  private calculateSkillLevel(projectCount: number, verifiedCount: number): UnifiedSkill['level'] {
    if (
      projectCount >= SKILL_LEVELS.expert.minProjects &&
      verifiedCount >= SKILL_LEVELS.expert.minVerified
    ) {
      return 'expert';
    }
    if (
      projectCount >= SKILL_LEVELS.advanced.minProjects &&
      verifiedCount >= SKILL_LEVELS.advanced.minVerified
    ) {
      return 'advanced';
    }
    if (
      projectCount >= SKILL_LEVELS.intermediate.minProjects &&
      verifiedCount >= SKILL_LEVELS.intermediate.minVerified
    ) {
      return 'intermediate';
    }
    return 'beginner';
  }

  // ---------------------------------------------------------------------------
  // REVIEW AGGREGATION
  // ---------------------------------------------------------------------------

  private aggregateReviews(workHistory: any[]): ReviewSummary {
    const allReviews = workHistory.flatMap((wh) => wh.reviews || []);
    const verifiedReviews = allReviews.filter((r) => r.verified);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recentReviews = allReviews.filter(
      (r) => r.reviewDate && new Date(r.reviewDate) > sixMonthsAgo
    );

    // Calculate average ratings
    const avgRating = this.calculateAverageRating(allReviews);
    const recentRating = this.calculateAverageRating(recentReviews);

    // Rating distribution
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const review of allReviews) {
      const normalized = Math.round((review.rating / (review.maxRating || 5)) * 5);
      distribution[normalized] = (distribution[normalized] || 0) + 1;
    }

    // Platform breakdown
    const platformReviews: Record<Platform, { count: number; rating: number }> = {};
    for (const wh of workHistory) {
      const platform = wh.platform as Platform;
      const reviews = wh.reviews || [];

      if (!platformReviews[platform]) {
        platformReviews[platform] = { count: 0, rating: 0 };
      }

      platformReviews[platform].count += reviews.length;
      platformReviews[platform].rating += reviews.reduce(
        (sum: number, r: any) => sum + r.rating / (r.maxRating || 5),
        0
      );
    }

    // Normalize platform ratings
    for (const platform of Object.keys(platformReviews) as Platform[]) {
      if (platformReviews[platform].count > 0) {
        platformReviews[platform].rating =
          (platformReviews[platform].rating / platformReviews[platform].count) * 5;
      }
    }

    return {
      totalReviews: allReviews.length,
      verifiedReviews: verifiedReviews.length,
      averageRating: avgRating,
      ratingDistribution: distribution,
      recentRating,
      platforms: platformReviews,
    };
  }

  private calculateAverageRating(reviews: any[]): number {
    if (reviews.length === 0) return 0;

    const sum = reviews.reduce((acc, r) => acc + r.rating / (r.maxRating || 5), 0);
    return Math.round((sum / reviews.length) * 5 * 100) / 100;
  }

  // ---------------------------------------------------------------------------
  // PROFILE MERGING
  // ---------------------------------------------------------------------------

  private async mergeProfileFields(
    userId: string,
    platforms: ConnectedPlatformInfo[]
  ): Promise<{
    displayName: string | null;
    headline: string | null;
    bio: string | null;
    avatarUrl: string | null;
    location: string | null;
    timezone: string | null;
    languages: string[];
  }> {
    // Get platform profiles from database
    const platformProfiles = await prisma.platformProfile.findMany({
      where: { userId },
      orderBy: { syncedAt: 'desc' },
    });

    // Merge with conflict resolution
    return {
      displayName: this.resolveField(platformProfiles, 'displayName'),
      headline: this.resolveField(platformProfiles, 'headline'),
      bio: this.resolveField(platformProfiles, 'bio'),
      avatarUrl: this.resolveField(platformProfiles, 'avatarUrl'),
      location: this.resolveField(platformProfiles, 'location'),
      timezone: this.resolveField(platformProfiles, 'timezone'),
      languages: this.resolveArrayField(platformProfiles, 'languages'),
    };
  }

  private resolveField(profiles: any[], field: string): string | null {
    // Priority: most recently synced profile with a value
    for (const profile of profiles) {
      if (profile[field]) {
        return profile[field];
      }
    }
    return null;
  }

  private resolveArrayField(profiles: any[], field: string): string[] {
    const allValues = new Set<string>();

    for (const profile of profiles) {
      const values = profile[field] || [];
      for (const v of values) {
        allValues.add(v);
      }
    }

    return Array.from(allValues);
  }

  // ---------------------------------------------------------------------------
  // HELPER METHODS
  // ---------------------------------------------------------------------------

  private findCareerStartDate(workHistory: any[]): Date | null {
    if (workHistory.length === 0) return null;

    const dates = workHistory.map((wh) => new Date(wh.startDate).getTime());
    return new Date(Math.min(...dates));
  }

  private getHighestVerificationLevel(workHistory: any[]): VerificationLevel {
    let highest = VerificationLevel.SELF_REPORTED;

    for (const wh of workHistory) {
      const level = wh.verificationLevel as VerificationLevel;
      if (level > highest) {
        highest = level;
      }
    }

    return highest;
  }

  private async calculateReputationScore(userId: string): Promise<number> {
    // Import from reputation-score module
    const { getReputationScoreService } = await import('./reputation-score');
    const service = getReputationScoreService();
    const score = await service.calculateReputationScore(userId);
    return score.overallScore;
  }

  private generateHeadline(skills: UnifiedSkill[]): string {
    const topSkills = skills.slice(0, 3).map((s) => s.name);

    if (topSkills.length === 0) {
      return 'Freelance Professional';
    }

    return `${topSkills.join(' | ')} Specialist`;
  }

  private calculateProfileCompleteness(data: any): number {
    let score = 0;
    const checks = [
      { field: 'displayName', weight: 10 },
      { field: 'headline', weight: 10 },
      { field: 'bio', weight: 15 },
      { field: 'avatarUrl', weight: 10 },
      { field: 'location', weight: 5 },
    ];

    for (const check of checks) {
      if (data[check.field]) {
        score += check.weight;
      }
    }

    // Connected platforms (up to 20%)
    const platformCount = data.connectedPlatforms?.length || 0;
    score += Math.min(platformCount * 5, 20);

    // Skills (up to 15%)
    const skillCount = data.skills?.length || 0;
    score += Math.min(skillCount * 1.5, 15);

    // Reviews (up to 15%)
    const reviewCount = data.reviewSummary?.totalReviews || 0;
    score += Math.min(reviewCount * 1, 15);

    return Math.min(Math.round(score), 100);
  }

  private getLastSyncDate(connections: any[]): Date | null {
    const syncDates = connections
      .filter((c) => c.lastSyncedAt)
      .map((c) => new Date(c.lastSyncedAt).getTime());

    if (syncDates.length === 0) return null;
    return new Date(Math.max(...syncDates));
  }

  private generateProfileHash(workHistory: any[]): string {
    const data = workHistory.map((wh) => ({
      id: wh.id,
      platform: wh.platform,
      verificationLevel: wh.verificationLevel,
    }));

    return createHash('sha256').update(JSON.stringify(data)).digest('hex').substring(0, 16);
  }

  private async storeUnifiedProfile(profile: UnifiedProfile): Promise<void> {
    await prisma.unifiedProfile.upsert({
      where: { userId: profile.userId },
      update: {
        displayName: profile.displayName,
        headline: profile.headline,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        location: profile.location,
        timezone: profile.timezone,
        languages: profile.languages,
        totalProjects: profile.totalProjects,
        completedProjects: profile.completedProjects,
        totalEarnings: profile.totalEarnings,
        currency: profile.currency,
        skills: profile.skills as any,
        reviewSummary: profile.reviewSummary as any,
        reputationScore: profile.reputationScore,
        verificationLevel: profile.verificationLevel,
        careerStartDate: profile.careerStartDate,
        yearsOfExperience: profile.yearsOfExperience,
        profileCompleteness: profile.profileCompleteness,
        lastSyncedAt: profile.lastSyncedAt,
        profileHash: profile.profileHash,
        updatedAt: new Date(),
      },
      create: {
        userId: profile.userId,
        displayName: profile.displayName,
        headline: profile.headline,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        location: profile.location,
        timezone: profile.timezone,
        languages: profile.languages,
        totalProjects: profile.totalProjects,
        completedProjects: profile.completedProjects,
        totalEarnings: profile.totalEarnings,
        currency: profile.currency,
        skills: profile.skills as any,
        reviewSummary: profile.reviewSummary as any,
        reputationScore: profile.reputationScore,
        verificationLevel: profile.verificationLevel,
        careerStartDate: profile.careerStartDate,
        yearsOfExperience: profile.yearsOfExperience,
        profileCompleteness: profile.profileCompleteness,
        lastSyncedAt: profile.lastSyncedAt,
        profileHash: profile.profileHash,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // PROFILE UPDATES
  // ---------------------------------------------------------------------------

  /**
   * Update unified profile with manual edits
   */
  async updateProfile(userId: string, updates: ProfileUpdateRequest): Promise<UnifiedProfile> {
    logger.info({ userId }, 'Updating unified profile');

    await prisma.unifiedProfile.update({
      where: { userId },
      data: {
        ...(updates.displayName && { displayName: updates.displayName }),
        ...(updates.headline && { headline: updates.headline }),
        ...(updates.bio && { bio: updates.bio }),
        ...(updates.location && { location: updates.location }),
        ...(updates.timezone && { timezone: updates.timezone }),
        ...(updates.languages && { languages: updates.languages }),
        updatedAt: new Date(),
      },
    });

    // Regenerate full profile
    return this.generateUnifiedProfile(userId);
  }

  /**
   * Get unified profile
   */
  async getProfile(userId: string): Promise<UnifiedProfile | null> {
    const stored = await prisma.unifiedProfile.findUnique({
      where: { userId },
    });

    if (!stored) {
      return null;
    }

    return stored as unknown as UnifiedProfile;
  }
}

// Singleton instance
let serviceInstance: UnifiedProfileService | null = null;

export function getUnifiedProfileService(): UnifiedProfileService {
  if (!serviceInstance) {
    serviceInstance = new UnifiedProfileService();
  }
  return serviceInstance;
}
