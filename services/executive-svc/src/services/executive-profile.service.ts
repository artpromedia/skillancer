import { PrismaClient } from '@prisma/client';
import {
  ExecutiveProfileCreateInput,
  ExecutiveProfileUpdateInput,
  ExecutiveSearchFilters,
  ExecutiveVettingDecision,
  ExecutiveReferenceInput,
  ExecutiveVettingStatus,
  BackgroundCheckStatus,
} from '../types/executive.types';

export class ExecutiveProfileService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new executive profile
   */
  async createProfile(input: ExecutiveProfileCreateInput) {
    const existingProfile = await this.prisma.executiveProfile.findUnique({
      where: { userId: input.userId },
    });

    if (existingProfile) {
      throw new Error('Executive profile already exists for this user');
    }

    const profile = await this.prisma.executiveProfile.create({
      data: {
        userId: input.userId,
        executiveType: input.executiveType,
        headline: input.headline,
        executiveSummary: input.executiveSummary,
        yearsExecutiveExp: input.yearsExecutiveExp,
        industries: input.industries || [],
        specializations: input.specializations || [],
        companyStagesExpertise: input.companyStagesExpertise || [],
        pastRoles: input.pastRoles ? JSON.parse(JSON.stringify(input.pastRoles)) : null,
        notableAchievements: input.notableAchievements || [],
        boardExperience: input.boardExperience || false,
        publicCompanyExp: input.publicCompanyExp || false,
        hoursPerWeekAvailable: input.hoursPerWeekAvailable || 20,
        monthlyRetainerMin: input.monthlyRetainerMin,
        monthlyRetainerMax: input.monthlyRetainerMax,
        hourlyRateMin: input.hourlyRateMin,
        hourlyRateMax: input.hourlyRateMax,
        equityOpenTo: input.equityOpenTo || false,
        linkedinUrl: input.linkedinUrl,
        vettingStatus: 'PENDING',
      },
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
    });

    return profile;
  }

  /**
   * Get executive profile by user ID
   */
  async getProfileByUserId(userId: string) {
    const profile = await this.prisma.executiveProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            profile: true,
          },
        },
        references: true,
        engagements: {
          where: {
            status: { in: ['ACTIVE', 'PROPOSAL', 'NEGOTIATING'] },
          },
          include: {
            clientTenant: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
              },
            },
          },
        },
        toolConfigs: true,
      },
    });

    return profile;
  }

  /**
   * Get executive profile by ID
   */
  async getProfileById(id: string) {
    const profile = await this.prisma.executiveProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            profile: true,
          },
        },
        references: true,
        engagements: {
          include: {
            clientTenant: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
              },
            },
          },
        },
        toolConfigs: true,
      },
    });

    return profile;
  }

  /**
   * Update executive profile
   */
  async updateProfile(userId: string, input: ExecutiveProfileUpdateInput) {
    const profile = await this.prisma.executiveProfile.update({
      where: { userId },
      data: {
        headline: input.headline,
        executiveSummary: input.executiveSummary,
        yearsExecutiveExp: input.yearsExecutiveExp,
        industries: input.industries,
        specializations: input.specializations,
        companyStagesExpertise: input.companyStagesExpertise,
        pastRoles: input.pastRoles ? JSON.parse(JSON.stringify(input.pastRoles)) : undefined,
        notableAchievements: input.notableAchievements,
        boardExperience: input.boardExperience,
        publicCompanyExp: input.publicCompanyExp,
        maxClients: input.maxClients,
        hoursPerWeekAvailable: input.hoursPerWeekAvailable,
        availableFrom: input.availableFrom,
        monthlyRetainerMin: input.monthlyRetainerMin,
        monthlyRetainerMax: input.monthlyRetainerMax,
        hourlyRateMin: input.hourlyRateMin,
        hourlyRateMax: input.hourlyRateMax,
        equityOpenTo: input.equityOpenTo,
        linkedinUrl: input.linkedinUrl,
        searchable: input.searchable,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return profile;
  }

  /**
   * Search for executives
   */
  async searchExecutives(filters: ExecutiveSearchFilters, page = 1, limit = 20) {
    const where: any = {
      vettingStatus: 'APPROVED',
      searchable: true,
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
      where.companyStagesExpertise = { hasSome: filters.companyStages };
    }

    if (filters.minExperience) {
      where.yearsExecutiveExp = { gte: filters.minExperience };
    }

    if (filters.maxHourlyRate) {
      where.hourlyRateMin = { lte: filters.maxHourlyRate };
    }

    if (filters.maxMonthlyRetainer) {
      where.monthlyRetainerMin = { lte: filters.maxMonthlyRetainer };
    }

    if (filters.availableNow) {
      where.OR = [
        { availableFrom: null },
        { availableFrom: { lte: new Date() } },
      ];
      where.currentClientCount = { lt: where.maxClients || 5 };
    }

    if (filters.hasBackgroundCheck) {
      where.backgroundCheckStatus = 'PASSED';
    }

    if (filters.boardExperience) {
      where.boardExperience = true;
    }

    if (filters.publicCompanyExp) {
      where.publicCompanyExp = true;
    }

    const [executives, total] = await Promise.all([
      this.prisma.executiveProfile.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          { featuredExecutive: 'desc' },
          { yearsExecutiveExp: 'desc' },
        ],
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
      }),
      this.prisma.executiveProfile.count({ where }),
    ]);

    return {
      executives,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Add reference to executive profile
   */
  async addReference(executiveProfileId: string, input: ExecutiveReferenceInput) {
    const reference = await this.prisma.executiveReference.create({
      data: {
        executiveProfileId,
        referenceName: input.referenceName,
        referenceTitle: input.referenceTitle,
        referenceCompany: input.referenceCompany,
        referenceEmail: input.referenceEmail,
        referencePhone: input.referencePhone,
        relationshipType: input.relationshipType,
        verificationStatus: 'PENDING',
      },
    });

    // Update references count
    await this.prisma.executiveProfile.update({
      where: { id: executiveProfileId },
      data: {
        referencesProvided: { increment: 1 },
      },
    });

    return reference;
  }

  /**
   * Verify a reference
   */
  async verifyReference(referenceId: string, verified: boolean, notes?: string, rating?: number) {
    const reference = await this.prisma.executiveReference.update({
      where: { id: referenceId },
      data: {
        verificationStatus: verified ? 'VERIFIED' : 'FAILED',
        verificationDate: new Date(),
        verificationNotes: notes,
        rating,
      },
    });

    if (verified) {
      // Update verified references count
      await this.prisma.executiveProfile.update({
        where: { id: reference.executiveProfileId },
        data: {
          referencesVerified: { increment: 1 },
        },
      });
    }

    return reference;
  }

  /**
   * Update vetting status
   */
  async updateVettingStatus(profileId: string, decision: ExecutiveVettingDecision) {
    const profile = await this.prisma.executiveProfile.update({
      where: { id: profileId },
      data: {
        vettingStatus: decision.status,
        vettingNotes: decision.notes,
        interviewScore: decision.interviewScore,
        interviewNotes: decision.interviewNotes,
        vettingCompletedAt: decision.status === 'APPROVED' || decision.status === 'REJECTED'
          ? new Date()
          : undefined,
      },
    });

    return profile;
  }

  /**
   * Start background check
   */
  async startBackgroundCheck(profileId: string) {
    const profile = await this.prisma.executiveProfile.update({
      where: { id: profileId },
      data: {
        backgroundCheckStatus: 'IN_PROGRESS',
        backgroundCheckDate: new Date(),
      },
    });

    return profile;
  }

  /**
   * Complete background check
   */
  async completeBackgroundCheck(profileId: string, passed: boolean) {
    const profile = await this.prisma.executiveProfile.update({
      where: { id: profileId },
      data: {
        backgroundCheckStatus: passed ? 'PASSED' : 'FAILED',
        backgroundCheckExpiry: passed
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
          : undefined,
      },
    });

    return profile;
  }

  /**
   * Verify LinkedIn profile
   */
  async verifyLinkedIn(userId: string, verified: boolean) {
    const profile = await this.prisma.executiveProfile.update({
      where: { userId },
      data: {
        linkedinVerified: verified,
      },
    });

    return profile;
  }

  /**
   * Increment profile views
   */
  async incrementProfileViews(profileId: string) {
    await this.prisma.executiveProfile.update({
      where: { id: profileId },
      data: {
        profileViews: { increment: 1 },
      },
    });
  }

  /**
   * Get featured executives
   */
  async getFeaturedExecutives(limit = 10) {
    const executives = await this.prisma.executiveProfile.findMany({
      where: {
        featuredExecutive: true,
        vettingStatus: 'APPROVED',
        searchable: true,
      },
      take: limit,
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
    });

    return executives;
  }

  /**
   * Set featured status
   */
  async setFeaturedStatus(profileId: string, featured: boolean) {
    const profile = await this.prisma.executiveProfile.update({
      where: { id: profileId },
      data: {
        featuredExecutive: featured,
      },
    });

    return profile;
  }

  /**
   * Get executives pending vetting
   */
  async getPendingVetting(page = 1, limit = 20) {
    const [executives, total] = await Promise.all([
      this.prisma.executiveProfile.findMany({
        where: {
          vettingStatus: { in: ['PENDING', 'APPLICATION_REVIEW', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'REFERENCE_CHECK'] },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          references: true,
        },
      }),
      this.prisma.executiveProfile.count({
        where: {
          vettingStatus: { in: ['PENDING', 'APPLICATION_REVIEW', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'REFERENCE_CHECK'] },
        },
      }),
    ]);

    return {
      executives,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get executive statistics
   */
  async getExecutiveStats() {
    const [totalApproved, totalPending, byType] = await Promise.all([
      this.prisma.executiveProfile.count({
        where: { vettingStatus: 'APPROVED' },
      }),
      this.prisma.executiveProfile.count({
        where: {
          vettingStatus: { in: ['PENDING', 'APPLICATION_REVIEW', 'INTERVIEW_SCHEDULED'] },
        },
      }),
      this.prisma.executiveProfile.groupBy({
        by: ['executiveType'],
        where: { vettingStatus: 'APPROVED' },
        _count: true,
      }),
    ]);

    return {
      totalApproved,
      totalPending,
      byType: byType.map((item) => ({
        type: item.executiveType,
        count: item._count,
      })),
    };
  }
}
