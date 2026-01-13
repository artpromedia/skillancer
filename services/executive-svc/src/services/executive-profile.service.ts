/**
 * Executive Profile Service
 *
 * Handles executive profile management including:
 * - Profile creation and updates
 * - Profile completeness calculation
 * - Executive history management
 * - Search and discovery
 */

import { prisma } from '@skillancer/database';
import type {
  ExecutiveProfile,
  ExecutiveHistory,
  ExecutiveType,
  CompanyStage,
  VettingStatus,
  Prisma,
} from '../types/prisma-shim.js';

// Types
export interface CreateExecutiveProfileInput {
  userId: string;
  executiveType: ExecutiveType;
  headline: string;
  bio?: string;
  yearsExecutiveExp: number;
  totalYearsExp: number;
  industries?: string[];
  specializations?: string[];
  companyStages?: CompanyStage[];
  companySizes?: string[];
  linkedinUrl?: string;
  hoursPerWeekMin?: number;
  hoursPerWeekMax?: number;
  maxClients?: number;
  monthlyRetainerMin?: number;
  monthlyRetainerMax?: number;
  hourlyRateMin?: number;
  hourlyRateMax?: number;
  currency?: string;
  timezone?: string;
  availableFrom?: Date;
  profilePhotoUrl?: string;
  resumeUrl?: string;
}

export interface UpdateExecutiveProfileInput {
  headline?: string;
  bio?: string;
  yearsExecutiveExp?: number;
  totalYearsExp?: number;
  industries?: string[];
  specializations?: string[];
  companyStages?: CompanyStage[];
  companySizes?: string[];
  linkedinUrl?: string;
  hoursPerWeekMin?: number;
  hoursPerWeekMax?: number;
  maxClients?: number;
  monthlyRetainerMin?: number;
  monthlyRetainerMax?: number;
  hourlyRateMin?: number;
  hourlyRateMax?: number;
  currency?: string;
  timezone?: string;
  availableFrom?: Date;
  profilePhotoUrl?: string;
  resumeUrl?: string;
}

export interface AddExecutiveHistoryInput {
  executiveId: string;
  title: string;
  company: string;
  companyLinkedinUrl?: string;
  companyWebsite?: string;
  startDate: Date;
  endDate?: Date;
  isCurrent?: boolean;
  companyStage?: CompanyStage;
  companySize?: string;
  industry?: string;
  description?: string;
  achievements?: string[];
  teamSize?: number;
  budgetManaged?: number;
}

export interface ExecutiveSearchFilters {
  executiveType?: ExecutiveType;
  industries?: string[];
  specializations?: string[];
  companyStages?: CompanyStage[];
  minHoursPerWeek?: number;
  maxHoursPerWeek?: number;
  minHourlyRate?: number;
  maxHourlyRate?: number;
  availableNow?: boolean;
  timezone?: string;
  featured?: boolean;
}

export interface ExecutiveSearchResult {
  executives: ExecutiveProfile[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Profile Completeness Weights
const COMPLETENESS_WEIGHTS = {
  basicInfo: 20, // name, headline, bio
  executiveHistory: 20, // 2+ positions
  expertise: 15, // specializations & industries
  pricing: 15, // pricing & availability
  linkedin: 15, // LinkedIn verification
  presentation: 15, // photo & professional presentation
};

/**
 * Create a new executive profile
 */
export async function createExecutiveProfile(
  input: CreateExecutiveProfileInput
): Promise<ExecutiveProfile> {
  // Check if user already has an executive profile
  const existing = await prisma.executiveProfile.findUnique({
    where: { userId: input.userId },
  });

  if (existing) {
    throw new Error('User already has an executive profile');
  }

  // Create the profile
  const profile = await prisma.executiveProfile.create({
    data: {
      userId: input.userId,
      executiveType: input.executiveType,
      headline: input.headline,
      bio: input.bio,
      yearsExecutiveExp: input.yearsExecutiveExp,
      totalYearsExp: input.totalYearsExp,
      industries: input.industries || [],
      specializations: input.specializations || [],
      companyStages: input.companyStages || [],
      companySizes: input.companySizes || [],
      linkedinUrl: input.linkedinUrl,
      hoursPerWeekMin: input.hoursPerWeekMin ?? 5,
      hoursPerWeekMax: input.hoursPerWeekMax ?? 20,
      maxClients: input.maxClients ?? 5,
      monthlyRetainerMin: input.monthlyRetainerMin,
      monthlyRetainerMax: input.monthlyRetainerMax,
      hourlyRateMin: input.hourlyRateMin,
      hourlyRateMax: input.hourlyRateMax,
      currency: input.currency || 'USD',
      timezone: input.timezone,
      availableFrom: input.availableFrom,
      profilePhotoUrl: input.profilePhotoUrl,
      resumeUrl: input.resumeUrl,
      vettingStartedAt: new Date(),
    },
  });

  // Calculate and update profile completeness
  const completeness = await calculateProfileCompleteness(profile.id);
  await prisma.executiveProfile.update({
    where: { id: profile.id },
    data: { profileCompleteness: completeness },
  });

  // Create vetting event
  await prisma.vettingEvent.create({
    data: {
      executiveId: profile.id,
      eventType: 'APPLICATION_SUBMITTED',
      toStage: 'APPLICATION',
      toStatus: 'PENDING',
      actorId: input.userId,
      actorType: 'executive',
      description: 'Executive application submitted',
    },
  });

  return prisma.executiveProfile.findUnique({
    where: { id: profile.id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    },
  }) as Promise<ExecutiveProfile>;
}

/**
 * Update an executive profile
 */
export async function updateExecutiveProfile(
  executiveId: string,
  input: UpdateExecutiveProfileInput
): Promise<ExecutiveProfile> {
  const profile = await prisma.executiveProfile.update({
    where: { id: executiveId },
    data: {
      ...input,
      lastActivityAt: new Date(),
    },
  });

  // Recalculate completeness
  const completeness = await calculateProfileCompleteness(executiveId);
  await prisma.executiveProfile.update({
    where: { id: executiveId },
    data: { profileCompleteness: completeness },
  });

  return prisma.executiveProfile.findUnique({
    where: { id: executiveId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
      executiveHistory: {
        orderBy: { startDate: 'desc' },
      },
    },
  }) as Promise<ExecutiveProfile>;
}

/**
 * Get executive profile by ID
 */
export async function getExecutiveProfile(
  executiveId: string
): Promise<ExecutiveProfile | null> {
  return prisma.executiveProfile.findUnique({
    where: { id: executiveId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
      executiveHistory: {
        orderBy: { startDate: 'desc' },
      },
      references: {
        select: {
          id: true,
          name: true,
          title: true,
          company: true,
          relationship: true,
          status: true,
          completedAt: true,
        },
      },
      interviews: {
        orderBy: { scheduledAt: 'desc' },
      },
    },
  });
}

/**
 * Get executive profile by user ID
 */
export async function getExecutiveByUserId(
  userId: string
): Promise<ExecutiveProfile | null> {
  return prisma.executiveProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
      executiveHistory: {
        orderBy: { startDate: 'desc' },
      },
      references: {
        select: {
          id: true,
          name: true,
          title: true,
          company: true,
          relationship: true,
          status: true,
          completedAt: true,
        },
      },
    },
  });
}

/**
 * Add executive history entry
 */
export async function addExecutiveHistory(
  input: AddExecutiveHistoryInput
): Promise<ExecutiveHistory> {
  const history = await prisma.executiveHistory.create({
    data: {
      executiveId: input.executiveId,
      title: input.title,
      company: input.company,
      companyLinkedinUrl: input.companyLinkedinUrl,
      companyWebsite: input.companyWebsite,
      startDate: input.startDate,
      endDate: input.endDate,
      isCurrent: input.isCurrent ?? !input.endDate,
      companyStage: input.companyStage,
      companySize: input.companySize,
      industry: input.industry,
      description: input.description,
      achievements: input.achievements || [],
      teamSize: input.teamSize,
      budgetManaged: input.budgetManaged,
    },
  });

  // Recalculate profile completeness
  const completeness = await calculateProfileCompleteness(input.executiveId);
  await prisma.executiveProfile.update({
    where: { id: input.executiveId },
    data: {
      profileCompleteness: completeness,
      lastActivityAt: new Date(),
    },
  });

  return history;
}

/**
 * Update executive history entry
 */
export async function updateExecutiveHistory(
  historyId: string,
  executiveId: string,
  input: Partial<AddExecutiveHistoryInput>
): Promise<ExecutiveHistory> {
  // Verify ownership
  const existing = await prisma.executiveHistory.findFirst({
    where: { id: historyId, executiveId },
  });

  if (!existing) {
    throw new Error('Executive history not found');
  }

  return prisma.executiveHistory.update({
    where: { id: historyId },
    data: {
      title: input.title,
      company: input.company,
      companyLinkedinUrl: input.companyLinkedinUrl,
      companyWebsite: input.companyWebsite,
      startDate: input.startDate,
      endDate: input.endDate,
      isCurrent: input.isCurrent,
      companyStage: input.companyStage,
      companySize: input.companySize,
      industry: input.industry,
      description: input.description,
      achievements: input.achievements,
      teamSize: input.teamSize,
      budgetManaged: input.budgetManaged,
    },
  });
}

/**
 * Delete executive history entry
 */
export async function deleteExecutiveHistory(
  historyId: string,
  executiveId: string
): Promise<void> {
  // Verify ownership
  const existing = await prisma.executiveHistory.findFirst({
    where: { id: historyId, executiveId },
  });

  if (!existing) {
    throw new Error('Executive history not found');
  }

  await prisma.executiveHistory.delete({
    where: { id: historyId },
  });

  // Recalculate profile completeness
  const completeness = await calculateProfileCompleteness(executiveId);
  await prisma.executiveProfile.update({
    where: { id: executiveId },
    data: { profileCompleteness: completeness },
  });
}

/**
 * Calculate profile completeness score (0-100)
 */
export async function calculateProfileCompleteness(
  executiveId: string
): Promise<number> {
  const profile = await prisma.executiveProfile.findUnique({
    where: { id: executiveId },
    include: {
      user: true,
      executiveHistory: true,
    },
  });

  if (!profile) {
    return 0;
  }

  let score = 0;

  // Basic info (20%)
  const hasBasicInfo = !!(
    profile.headline &&
    profile.bio &&
    profile.user.firstName &&
    profile.user.lastName
  );
  if (hasBasicInfo) {
    score += COMPLETENESS_WEIGHTS.basicInfo;
  } else if (profile.headline) {
    score += COMPLETENESS_WEIGHTS.basicInfo * 0.5;
  }

  // Executive history (20%) - need 2+ positions
  const historyCount = profile.executiveHistory.length;
  if (historyCount >= 2) {
    score += COMPLETENESS_WEIGHTS.executiveHistory;
  } else if (historyCount === 1) {
    score += COMPLETENESS_WEIGHTS.executiveHistory * 0.5;
  }

  // Expertise (15%) - specializations & industries
  const hasExpertise = profile.specializations.length > 0 && profile.industries.length > 0;
  if (hasExpertise) {
    score += COMPLETENESS_WEIGHTS.expertise;
  } else if (profile.specializations.length > 0 || profile.industries.length > 0) {
    score += COMPLETENESS_WEIGHTS.expertise * 0.5;
  }

  // Pricing & availability (15%)
  const hasPricing = !!(
    (profile.hourlyRateMin || profile.monthlyRetainerMin) &&
    profile.hoursPerWeekMin &&
    profile.hoursPerWeekMax
  );
  if (hasPricing) {
    score += COMPLETENESS_WEIGHTS.pricing;
  }

  // LinkedIn verification (15%)
  if (profile.linkedinVerified) {
    score += COMPLETENESS_WEIGHTS.linkedin;
  } else if (profile.linkedinUrl) {
    score += COMPLETENESS_WEIGHTS.linkedin * 0.3;
  }

  // Presentation (15%) - photo
  if (profile.profilePhotoUrl || profile.user.avatarUrl) {
    score += COMPLETENESS_WEIGHTS.presentation;
  }

  return Math.round(score);
}

/**
 * Search executives (only approved, searchable profiles)
 */
export async function searchExecutives(
  filters: ExecutiveSearchFilters,
  page: number = 1,
  pageSize: number = 20
): Promise<ExecutiveSearchResult> {
  const where: Prisma.ExecutiveProfileWhereInput = {
    searchable: true,
    vettingStatus: 'APPROVED',
  };

  if (filters.executiveType) {
    where.executiveType = filters.executiveType;
  }

  if (filters.industries && filters.industries.length > 0) {
    where.industries = { hasSome: filters.industries };
  }

  if (filters.specializations && filters.specializations.length > 0) {
    where.specializations = { hasSome: filters.specializations };
  }

  if (filters.companyStages && filters.companyStages.length > 0) {
    where.companyStages = { hasSome: filters.companyStages };
  }

  if (filters.minHoursPerWeek) {
    where.hoursPerWeekMax = { gte: filters.minHoursPerWeek };
  }

  if (filters.maxHoursPerWeek) {
    where.hoursPerWeekMin = { lte: filters.maxHoursPerWeek };
  }

  if (filters.availableNow) {
    where.OR = [
      { availableFrom: null },
      { availableFrom: { lte: new Date() } },
    ];
  }

  if (filters.timezone) {
    where.timezone = filters.timezone;
  }

  if (filters.featured) {
    where.featuredExecutive = true;
  }

  const [executives, total] = await Promise.all([
    prisma.executiveProfile.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [
        { featuredExecutive: 'desc' },
        { profileCompleteness: 'desc' },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.executiveProfile.count({ where }),
  ]);

  return {
    executives,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Get featured executives
 */
export async function getFeaturedExecutives(
  executiveType?: ExecutiveType,
  limit: number = 6
): Promise<ExecutiveProfile[]> {
  const where: Prisma.ExecutiveProfileWhereInput = {
    searchable: true,
    vettingStatus: 'APPROVED',
    featuredExecutive: true,
  };

  if (executiveType) {
    where.executiveType = executiveType;
  }

  return prisma.executiveProfile.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { featuredOrder: 'asc' },
    take: limit,
  });
}
