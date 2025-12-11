/**
 * @module @skillancer/auth-svc/services/profile-completion
 * Profile completion scoring service
 */

import { CacheService } from '@skillancer/cache';
import { prisma } from '@skillancer/database';

import { getConfig } from '../config/index.js';
import { NotFoundError } from '../errors/index.js';

import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface ProfileCompletionSection {
  name: string;
  weight: number;
  score: number;
  maxScore: number;
  percentage: number;
  items: ProfileCompletionItem[];
}

export interface ProfileCompletionItem {
  name: string;
  completed: boolean;
  required: boolean;
  points: number;
}

export interface ProfileCompletionResult {
  overallScore: number;
  overallPercentage: number;
  sections: ProfileCompletionSection[];
  suggestions: ProfileCompletionSuggestion[];
  tier: ProfileCompletionTier;
}

export interface ProfileCompletionSuggestion {
  section: string;
  item: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  impact: number;
}

export type ProfileCompletionTier = 'beginner' | 'basic' | 'intermediate' | 'advanced' | 'expert';

// =============================================================================
// CONSTANTS
// =============================================================================

const CACHE_TTL = 60 * 5; // 5 minutes

const CacheKeys = {
  completion: (userId: string) => `profile:completion:${userId}`,
};

// Section weights (must sum to 100)
const SECTION_WEIGHTS = {
  basicInfo: 25,
  professionalInfo: 20,
  skills: 15,
  workHistory: 15,
  education: 10,
  portfolio: 10,
  certifications: 5,
};

// Tier thresholds
const TIER_THRESHOLDS: { min: number; tier: ProfileCompletionTier }[] = [
  { min: 90, tier: 'expert' },
  { min: 75, tier: 'advanced' },
  { min: 50, tier: 'intermediate' },
  { min: 25, tier: 'basic' },
  { min: 0, tier: 'beginner' },
];

// =============================================================================
// PROFILE COMPLETION SERVICE
// =============================================================================

let profileCompletionServiceInstance: ProfileCompletionService | null = null;

/**
 * Profile completion scoring service
 *
 * Features:
 * - Calculates profile completion percentage
 * - Breaks down by sections (basic info, skills, work history, etc.)
 * - Provides actionable suggestions
 * - Assigns completion tiers
 * - Caching for performance
 */
export class ProfileCompletionService {
  private readonly config = getConfig();
  private readonly cache: CacheService;

  constructor(redis: Redis) {
    this.cache = new CacheService(redis, 'profile-completion');
  }

  // ===========================================================================
  // MAIN CALCULATION
  // ===========================================================================

  /**
   * Calculate profile completion for a user
   */
  async calculateCompletion(userId: string): Promise<ProfileCompletionResult> {
    // Check cache
    const cacheKey = CacheKeys.completion(userId);
    const cached = await this.cache.get<ProfileCompletionResult>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch all relevant data
    const data = await this.fetchProfileData(userId);

    // Calculate each section
    const sections: ProfileCompletionSection[] = [
      this.calculateBasicInfoSection(data),
      this.calculateProfessionalInfoSection(data),
      this.calculateSkillsSection(data),
      this.calculateWorkHistorySection(data),
      this.calculateEducationSection(data),
      this.calculatePortfolioSection(data),
      this.calculateCertificationsSection(data),
    ];

    // Calculate overall score
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const section of sections) {
      totalWeightedScore += section.percentage * section.weight;
      totalWeight += section.weight;
    }

    const overallPercentage = Math.round(totalWeightedScore / totalWeight);
    const overallScore = Math.round(overallPercentage);

    // Generate suggestions
    const suggestions = this.generateSuggestions(sections);

    // Determine tier
    const tier = this.determineTier(overallPercentage);

    const result: ProfileCompletionResult = {
      overallScore,
      overallPercentage,
      sections,
      suggestions,
      tier,
    };

    // Cache result
    await this.cache.set(cacheKey, result, { ttl: CACHE_TTL });

    return result;
  }

  /**
   * Invalidate completion cache for a user
   */
  async invalidateCache(userId: string): Promise<void> {
    await this.cache.delete(CacheKeys.completion(userId));
  }

  // ===========================================================================
  // DATA FETCHING
  // ===========================================================================

  /**
   * Fetch all profile data needed for calculation
   */
  private async fetchProfileData(userId: string) {
    // First get user and profile
    const [user, profile] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          displayName: true,
          emailVerified: true,
        },
      }),
      prisma.userProfile.findUnique({
        where: { userId },
        select: {
          id: true,
          username: true,
          title: true,
          bio: true,
          avatarOriginal: true,
          country: true,
          city: true,
          hourlyRate: true,
          yearsExperience: true,
          linkedinUrl: true,
          githubUrl: true,
          portfolioUrl: true,
          twitterUrl: true,
        },
      }),
    ]);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Get freelancer profile and counts
    const [freelancerProfile, skills, workHistory, education, portfolio, certifications] =
      await Promise.all([
        profile?.id
          ? prisma.freelancerProfile.findUnique({
              where: { userProfileId: profile.id },
              select: {
                headline: true,
                specializations: true,
                industries: true,
                hourlyRateMin: true,
                hourlyRateMax: true,
              },
            })
          : null,
        prisma.userSkill.count({ where: { userId } }),
        prisma.workHistory.count({ where: { userId } }),
        prisma.education.count({ where: { userId } }),
        prisma.portfolioItem.count({ where: { userId } }),
        prisma.certification.count({ where: { userId } }),
      ]);

    return {
      user,
      profile,
      freelancerProfile,
      skillsCount: skills,
      workHistoryCount: workHistory,
      educationCount: education,
      portfolioCount: portfolio,
      certificationsCount: certifications,
    };
  }

  // ===========================================================================
  // SECTION CALCULATIONS
  // ===========================================================================

  /**
   * Calculate basic info section completion
   */
  private calculateBasicInfoSection(
    data: Awaited<ReturnType<typeof this.fetchProfileData>>
  ): ProfileCompletionSection {
    const items: ProfileCompletionItem[] = [
      {
        name: 'First Name',
        completed: !!data.user.firstName,
        required: true,
        points: 15,
      },
      {
        name: 'Last Name',
        completed: !!data.user.lastName,
        required: true,
        points: 15,
      },
      {
        name: 'Email Verified',
        completed: data.user.emailVerified,
        required: true,
        points: 20,
      },
      {
        name: 'Username',
        completed: !!data.profile?.username,
        required: true,
        points: 15,
      },
      {
        name: 'Profile Picture',
        completed: !!data.profile?.avatarOriginal,
        required: false,
        points: 25,
      },
    ];

    return this.calculateSectionScore('Basic Information', SECTION_WEIGHTS.basicInfo, items);
  }

  /**
   * Calculate professional info section completion
   */
  private calculateProfessionalInfoSection(
    data: Awaited<ReturnType<typeof this.fetchProfileData>>
  ): ProfileCompletionSection {
    const items: ProfileCompletionItem[] = [
      {
        name: 'Professional Title',
        completed: !!data.profile?.title,
        required: true,
        points: 25,
      },
      {
        name: 'Bio',
        completed: !!data.profile?.bio && data.profile.bio.length >= 100,
        required: true,
        points: 25,
      },
      {
        name: 'Hourly Rate',
        completed: !!data.profile?.hourlyRate || !!data.freelancerProfile?.hourlyRateMin,
        required: false,
        points: 15,
      },
      {
        name: 'Years of Experience',
        completed:
          data.profile?.yearsExperience !== null && data.profile?.yearsExperience !== undefined,
        required: false,
        points: 15,
      },
      {
        name: 'Location',
        completed: !!data.profile?.country,
        required: false,
        points: 10,
      },
      {
        name: 'Social Links',
        completed: !!(data.profile?.linkedinUrl || data.profile?.githubUrl),
        required: false,
        points: 10,
      },
    ];

    return this.calculateSectionScore(
      'Professional Information',
      SECTION_WEIGHTS.professionalInfo,
      items
    );
  }

  /**
   * Calculate skills section completion
   */
  private calculateSkillsSection(
    data: Awaited<ReturnType<typeof this.fetchProfileData>>
  ): ProfileCompletionSection {
    const skillCount = data.skillsCount;
    const items: ProfileCompletionItem[] = [
      {
        name: 'At least 1 skill',
        completed: skillCount >= 1,
        required: true,
        points: 30,
      },
      {
        name: 'At least 3 skills',
        completed: skillCount >= 3,
        required: true,
        points: 30,
      },
      {
        name: 'At least 5 skills',
        completed: skillCount >= 5,
        required: false,
        points: 20,
      },
      {
        name: 'At least 10 skills',
        completed: skillCount >= 10,
        required: false,
        points: 20,
      },
    ];

    return this.calculateSectionScore('Skills', SECTION_WEIGHTS.skills, items);
  }

  /**
   * Calculate work history section completion
   */
  private calculateWorkHistorySection(
    data: Awaited<ReturnType<typeof this.fetchProfileData>>
  ): ProfileCompletionSection {
    const count = data.workHistoryCount;
    const items: ProfileCompletionItem[] = [
      {
        name: 'At least 1 work experience',
        completed: count >= 1,
        required: false,
        points: 40,
      },
      {
        name: 'At least 2 work experiences',
        completed: count >= 2,
        required: false,
        points: 30,
      },
      {
        name: 'At least 3 work experiences',
        completed: count >= 3,
        required: false,
        points: 30,
      },
    ];

    return this.calculateSectionScore('Work History', SECTION_WEIGHTS.workHistory, items);
  }

  /**
   * Calculate education section completion
   */
  private calculateEducationSection(
    data: Awaited<ReturnType<typeof this.fetchProfileData>>
  ): ProfileCompletionSection {
    const count = data.educationCount;
    const items: ProfileCompletionItem[] = [
      {
        name: 'At least 1 education entry',
        completed: count >= 1,
        required: false,
        points: 60,
      },
      {
        name: 'At least 2 education entries',
        completed: count >= 2,
        required: false,
        points: 40,
      },
    ];

    return this.calculateSectionScore('Education', SECTION_WEIGHTS.education, items);
  }

  /**
   * Calculate portfolio section completion
   */
  private calculatePortfolioSection(
    data: Awaited<ReturnType<typeof this.fetchProfileData>>
  ): ProfileCompletionSection {
    const count = data.portfolioCount;
    const items: ProfileCompletionItem[] = [
      {
        name: 'At least 1 portfolio item',
        completed: count >= 1,
        required: false,
        points: 40,
      },
      {
        name: 'At least 3 portfolio items',
        completed: count >= 3,
        required: false,
        points: 30,
      },
      {
        name: 'At least 5 portfolio items',
        completed: count >= 5,
        required: false,
        points: 30,
      },
    ];

    return this.calculateSectionScore('Portfolio', SECTION_WEIGHTS.portfolio, items);
  }

  /**
   * Calculate certifications section completion
   */
  private calculateCertificationsSection(
    data: Awaited<ReturnType<typeof this.fetchProfileData>>
  ): ProfileCompletionSection {
    const count = data.certificationsCount;
    const items: ProfileCompletionItem[] = [
      {
        name: 'At least 1 certification',
        completed: count >= 1,
        required: false,
        points: 50,
      },
      {
        name: 'At least 3 certifications',
        completed: count >= 3,
        required: false,
        points: 50,
      },
    ];

    return this.calculateSectionScore('Certifications', SECTION_WEIGHTS.certifications, items);
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Calculate section score from items
   */
  private calculateSectionScore(
    name: string,
    weight: number,
    items: ProfileCompletionItem[]
  ): ProfileCompletionSection {
    let score = 0;
    let maxScore = 0;

    for (const item of items) {
      maxScore += item.points;
      if (item.completed) {
        score += item.points;
      }
    }

    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

    return {
      name,
      weight,
      score,
      maxScore,
      percentage,
      items,
    };
  }

  /**
   * Generate suggestions based on incomplete items
   */
  private generateSuggestions(sections: ProfileCompletionSection[]): ProfileCompletionSuggestion[] {
    const suggestions: ProfileCompletionSuggestion[] = [];

    for (const section of sections) {
      for (const item of section.items) {
        if (!item.completed) {
          const priority = item.required ? 'high' : item.points >= 30 ? 'medium' : 'low';
          const impact = Math.round((item.points / section.maxScore) * section.weight);

          suggestions.push({
            section: section.name,
            item: item.name,
            message: this.getSuggestionMessage(section.name, item.name),
            priority,
            impact,
          });
        }
      }
    }

    // Sort by priority and impact
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.impact - a.impact;
    });

    // Return top 10 suggestions
    return suggestions.slice(0, 10);
  }

  /**
   * Get suggestion message for an incomplete item
   */
  private getSuggestionMessage(section: string, item: string): string {
    const messages: Record<string, Record<string, string>> = {
      'Basic Information': {
        'First Name': 'Add your first name to personalize your profile',
        'Last Name': 'Add your last name to complete your identity',
        'Email Verified': 'Verify your email to increase trust with clients',
        Username: 'Create a unique username for your public profile URL',
        'Profile Picture': 'Add a professional photo to increase engagement by 40%',
        'Phone Number': 'Add your phone number for account recovery',
        'Phone Verified': 'Verify your phone for additional security',
      },
      'Professional Information': {
        'Professional Title': 'Add a professional title that describes your expertise',
        Bio: 'Write a compelling bio (at least 100 characters) to stand out',
        'Hourly Rate': 'Set your hourly rate to help clients understand your pricing',
        'Years of Experience': 'Add your years of experience to build credibility',
        Location: 'Add your location to appear in local searches',
        'Social Links': 'Add LinkedIn or GitHub links to showcase your professional presence',
      },
      Skills: {
        'At least 1 skill': 'Add at least one skill to be discoverable',
        'At least 3 skills': 'Add more skills to improve your search visibility',
        'At least 5 skills': 'Adding 5+ skills significantly improves matching',
        'At least 10 skills': 'Comprehensive skill profiles get more opportunities',
      },
      'Work History': {
        'At least 1 work experience': 'Add your work history to showcase your experience',
        'At least 2 work experiences': 'More work history increases your credibility',
        'At least 3 work experiences': 'A complete work history helps clients trust you',
      },
      Education: {
        'At least 1 education entry': 'Add your educational background',
        'At least 2 education entries': 'Include additional certifications or courses',
      },
      Portfolio: {
        'At least 1 portfolio item': 'Showcase your best work to attract clients',
        'At least 3 portfolio items': 'More portfolio items demonstrate versatility',
        'At least 5 portfolio items': 'A robust portfolio significantly increases your chances',
      },
      Certifications: {
        'At least 1 certification': 'Add certifications to validate your expertise',
        'At least 3 certifications': 'Multiple certifications show commitment to your craft',
      },
    };

    return messages[section]?.[item] ?? `Complete ${item} in ${section}`;
  }

  /**
   * Determine profile tier based on completion percentage
   */
  private determineTier(percentage: number): ProfileCompletionTier {
    for (const { min, tier } of TIER_THRESHOLDS) {
      if (percentage >= min) {
        return tier;
      }
    }
    return 'beginner';
  }
}

// =============================================================================
// SINGLETON MANAGEMENT
// =============================================================================

export function initializeProfileCompletionService(redis: Redis): void {
  if (!profileCompletionServiceInstance) {
    profileCompletionServiceInstance = new ProfileCompletionService(redis);
  }
}

export function getProfileCompletionService(): ProfileCompletionService {
  if (!profileCompletionServiceInstance) {
    throw new Error(
      'ProfileCompletionService not initialized. Call initializeProfileCompletionService first.'
    );
  }
  return profileCompletionServiceInstance;
}

export function resetProfileCompletionService(): void {
  profileCompletionServiceInstance = null;
}
