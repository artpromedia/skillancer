/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/require-await */
/**
 * @module @skillancer/market-svc/repositories/compliance
 * Compliance data access layer for freelancer compliance management
 */

import { type PrismaClient, Prisma } from '../types/prisma-shim.js';

import type {
  AddComplianceInput,
  AddClearanceInput,
  AddAttestationInput,
  ComplianceType,
  ClearanceLevel,
  ComplianceVerificationStatus,
  ComplianceCategory,
} from '../types/compliance.types.js';

// ============================================================================
// Types for repository operations
// ============================================================================

export interface ListCompliancesParams {
  userId: string;
  type?: ComplianceType;
  status?: ComplianceVerificationStatus;
  includeExpired?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListClearancesParams {
  userId: string;
  level?: ClearanceLevel;
  isActive?: boolean;
  includeExpired?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListAttestationsParams {
  userId: string;
  requirementId?: string;
  includeExpired?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListVerificationLogsParams {
  complianceId?: string;
  limit?: number;
  offset?: number;
}

export interface FindEligibleFreelancersParams {
  complianceTypes?: ComplianceType[];
  clearanceLevel?: ClearanceLevel;
  requirementIds?: string[];
  limit?: number;
  offset?: number;
}

export interface FreelancerComplianceStats {
  totalCompliances: number;
  verifiedCompliances: number;
  pendingCompliances: number;
  expiredCompliances: number;
  activeClearances: number;
  activeAttestations: number;
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Compliance Repository
 *
 * Handles all database operations for compliance-related entities:
 * - FreelancerCompliance (certifications, training)
 * - SecurityClearance (government clearances)
 * - FreelancerComplianceAttestation (self-attestations)
 * - ComplianceRequirement (system-wide requirements)
 * - TenantComplianceRequirement (tenant-specific requirements)
 * - ComplianceVerificationLog (verification audit trail)
 */
export class ComplianceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // ===========================================================================
  // FREELANCER COMPLIANCE OPERATIONS
  // ===========================================================================

  /**
   * Add a new compliance record for a freelancer
   */
  async addCompliance(userId: string, input: AddComplianceInput) {
    return this.prisma.freelancerCompliance.create({
      data: {
        userId,
        complianceType: input.complianceType,
        certificationName: input.certificationName ?? null,
        certificationId: input.certificationId ?? null,
        issuingOrganization: input.issuingOrganization ?? null,
        issuedAt: input.issuedAt ?? null,
        expiresAt: input.expiresAt ?? null,
        documentUrl: input.documentUrl ?? null,
        selfAttested: input.selfAttested ?? false,
        attestedAt: input.selfAttested ? new Date() : null,
        trainingCompleted: input.trainingCompleted ?? false,
        trainingCompletedAt: input.trainingCompleted ? new Date() : null,
        trainingProvider: input.trainingProvider ?? null,
        verificationStatus: 'PENDING',
      },
    });
  }

  /**
   * Find a compliance record by ID
   */
  async findComplianceById(id: string) {
    return this.prisma.freelancerCompliance.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        verificationLogs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
  }

  /**
   * Find compliance by user and type (unique constraint)
   */
  async findComplianceByUserAndType(userId: string, type: ComplianceType) {
    return this.prisma.freelancerCompliance.findUnique({
      where: {
        userId_complianceType: {
          userId,
          complianceType: type,
        },
      },
    });
  }

  /**
   * List compliance records for a user
   */
  async listCompliances(params: ListCompliancesParams) {
    const { userId, type, status, includeExpired = false, limit = 50, offset = 0 } = params;

    const where: Prisma.FreelancerComplianceWhereInput = {
      userId,
      ...(type && { complianceType: type }),
      ...(status && { verificationStatus: status }),
      ...(!includeExpired && {
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.freelancerCompliance.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          verificationLogs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.freelancerCompliance.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Update a compliance record
   */
  async updateCompliance(
    id: string,
    data: Partial<{
      certificationName: string;
      certificationId: string;
      issuingOrganization: string;
      issuedAt: Date;
      expiresAt: Date;
      documentUrl: string;
      selfAttested: boolean;
      attestedAt: Date;
      trainingCompleted: boolean;
      trainingProvider: string;
      trainingCompletedAt: Date;
      verificationStatus: ComplianceVerificationStatus;
      verifiedAt: Date;
      verifiedBy: string;
      verificationDetails: Record<string, unknown>;
    }>
  ) {
    return this.prisma.freelancerCompliance.update({
      where: { id },
      data: {
        ...(data.certificationName !== undefined && {
          certificationName: data.certificationName,
        }),
        ...(data.certificationId !== undefined && {
          certificationId: data.certificationId,
        }),
        ...(data.issuingOrganization !== undefined && {
          issuingOrganization: data.issuingOrganization,
        }),
        ...(data.issuedAt && { issuedAt: data.issuedAt }),
        ...(data.expiresAt && { expiresAt: data.expiresAt }),
        ...(data.documentUrl !== undefined && { documentUrl: data.documentUrl }),
        ...(data.selfAttested !== undefined && { selfAttested: data.selfAttested }),
        ...(data.attestedAt && { attestedAt: data.attestedAt }),
        ...(data.trainingCompleted !== undefined && {
          trainingCompleted: data.trainingCompleted,
        }),
        ...(data.trainingProvider !== undefined && { trainingProvider: data.trainingProvider }),
        ...(data.trainingCompletedAt && { trainingCompletedAt: data.trainingCompletedAt }),
        ...(data.verificationStatus && { verificationStatus: data.verificationStatus }),
        ...(data.verifiedAt && { verifiedAt: data.verifiedAt }),
        ...(data.verifiedBy && { verifiedBy: data.verifiedBy }),
        ...(data.verificationDetails && {
          verificationDetails: data.verificationDetails as Prisma.InputJsonValue,
        }),
      },
    });
  }

  /**
   * Delete a compliance record
   */
  async deleteCompliance(id: string) {
    return this.prisma.freelancerCompliance.delete({
      where: { id },
    });
  }

  /**
   * Get expiring compliances (within specified days)
   */
  async getExpiringCompliances(daysAhead: number = 30) {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + daysAhead);

    return this.prisma.freelancerCompliance.findMany({
      where: {
        expiresAt: {
          gte: now,
          lte: futureDate,
        },
        verificationStatus: 'VERIFIED',
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
      orderBy: { expiresAt: 'asc' },
    });
  }

  /**
   * Get expired compliances that need status update
   */
  async getExpiredCompliances() {
    return this.prisma.freelancerCompliance.findMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
        verificationStatus: {
          not: 'EXPIRED',
        },
      },
    });
  }

  /**
   * Bulk update compliance status to expired
   */
  async markCompliancesExpired(ids: string[]) {
    return this.prisma.freelancerCompliance.updateMany({
      where: { id: { in: ids } },
      data: { verificationStatus: 'EXPIRED' },
    });
  }

  // ===========================================================================
  // SECURITY CLEARANCE OPERATIONS
  // ===========================================================================

  /**
   * Add a security clearance for a freelancer
   */
  async addClearance(userId: string, input: AddClearanceInput) {
    return this.prisma.securityClearance.create({
      data: {
        userId,
        clearanceLevel: input.level,
        grantedBy: input.grantedBy,
        grantedAt: new Date(input.grantedDate),
        expiresAt: input.expirationDate ? new Date(input.expirationDate) : null,
        investigationType: input.investigationType ?? null,
        investigationDate: input.investigationDate ? new Date(input.investigationDate) : null,
        polygraphCompleted: input.polygraphCompleted ?? false,
        polygraphDate: input.polygraphDate ? new Date(input.polygraphDate) : null,
        verificationStatus: 'PENDING',
        isActive: true,
      },
    });
  }

  /**
   * Find a clearance by ID
   */
  async findClearanceById(id: string) {
    return this.prisma.securityClearance.findUnique({
      where: { id },
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
  }

  /**
   * Find clearance by user and level (unique constraint)
   */
  async findClearanceByUserAndLevel(userId: string, level: ClearanceLevel) {
    return this.prisma.securityClearance.findUnique({
      where: {
        userId_clearanceLevel: {
          userId,
          clearanceLevel: level,
        },
      },
    });
  }

  /**
   * List clearances for a user
   */
  async listClearances(params: ListClearancesParams) {
    const { userId, level, isActive, includeExpired = false, limit = 50, offset = 0 } = params;

    const where: Prisma.SecurityClearanceWhereInput = {
      userId,
      ...(level && { clearanceLevel: level }),
      ...(isActive !== undefined && { isActive }),
      ...(!includeExpired && {
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.securityClearance.findMany({
        where,
        orderBy: { grantedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.securityClearance.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Update a clearance record
   */
  async updateClearance(
    id: string,
    data: Partial<{
      grantedBy: string;
      grantedAt: Date;
      expiresAt: Date;
      investigationType: string;
      investigationDate: Date;
      polygraphCompleted: boolean;
      polygraphDate: Date;
      verificationStatus: ComplianceVerificationStatus;
      verifiedAt: Date;
      verificationMethod: string;
      isActive: boolean;
      internalNotes: string;
    }>
  ) {
    return this.prisma.securityClearance.update({
      where: { id },
      data: {
        ...(data.grantedBy !== undefined && { grantedBy: data.grantedBy }),
        ...(data.grantedAt && { grantedAt: data.grantedAt }),
        ...(data.expiresAt && { expiresAt: data.expiresAt }),
        ...(data.investigationType !== undefined && {
          investigationType: data.investigationType,
        }),
        ...(data.investigationDate && { investigationDate: data.investigationDate }),
        ...(data.polygraphCompleted !== undefined && {
          polygraphCompleted: data.polygraphCompleted,
        }),
        ...(data.polygraphDate && { polygraphDate: data.polygraphDate }),
        ...(data.verificationStatus && { verificationStatus: data.verificationStatus }),
        ...(data.verifiedAt && { verifiedAt: data.verifiedAt }),
        ...(data.verificationMethod !== undefined && {
          verificationMethod: data.verificationMethod,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.internalNotes !== undefined && { internalNotes: data.internalNotes }),
      },
    });
  }

  /**
   * Delete a clearance record
   */
  async deleteClearance(id: string) {
    return this.prisma.securityClearance.delete({
      where: { id },
    });
  }

  /**
   * Get expiring clearances
   */
  async getExpiringClearances(daysAhead: number = 60) {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + daysAhead);

    return this.prisma.securityClearance.findMany({
      where: {
        expiresAt: {
          gte: now,
          lte: futureDate,
        },
        isActive: true,
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
      orderBy: { expiresAt: 'asc' },
    });
  }

  // ===========================================================================
  // ATTESTATION OPERATIONS
  // ===========================================================================

  /**
   * Add an attestation for a freelancer
   */
  async addAttestation(userId: string, input: AddAttestationInput) {
    // Calculate expiration date (default: 1 year from now)
    const expiresAt = input.validUntil
      ? new Date(input.validUntil)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    return this.prisma.freelancerComplianceAttestation.create({
      data: {
        userId,
        requirementCode: input.requirementId,
        tenantRequirementId: input.tenantRequirementId ?? null,
        attestedAt: new Date(),
        expiresAt,
        answers: input.answers as Prisma.InputJsonValue,
        ipAddress: input.ipAddress ?? '',
        userAgent: input.userAgent ?? null,
        digitalSignature: input.signature ?? null,
        isActive: true,
      },
    });
  }

  /**
   * Find an attestation by ID
   */
  async findAttestationById(id: string) {
    return this.prisma.freelancerComplianceAttestation.findUnique({
      where: { id },
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
  }

  /**
   * Find active attestation by user and requirement
   */
  async findActiveAttestation(userId: string, requirementCode: string) {
    return this.prisma.freelancerComplianceAttestation.findFirst({
      where: {
        userId,
        requirementCode,
        expiresAt: { gte: new Date() },
        isActive: true,
      },
    });
  }

  /**
   * List attestations for a user
   */
  async listAttestations(params: ListAttestationsParams) {
    const { userId, requirementId, includeExpired = false, limit = 50, offset = 0 } = params;

    const where: Prisma.FreelancerComplianceAttestationWhereInput = {
      userId,
      ...(requirementId && { requirementCode: requirementId }),
      ...(!includeExpired && { expiresAt: { gte: new Date() }, isActive: true }),
    };

    const [items, total] = await Promise.all([
      this.prisma.freelancerComplianceAttestation.findMany({
        where,
        orderBy: { attestedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.freelancerComplianceAttestation.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Get expiring attestations
   */
  async getExpiringAttestations(daysAhead: number = 30) {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + daysAhead);

    return this.prisma.freelancerComplianceAttestation.findMany({
      where: {
        expiresAt: {
          gte: now,
          lte: futureDate,
        },
        isActive: true,
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
      orderBy: { expiresAt: 'asc' },
    });
  }

  // ===========================================================================
  // COMPLIANCE REQUIREMENT OPERATIONS
  // ===========================================================================

  /**
   * Find a requirement by ID
   */
  async findRequirementById(id: string) {
    return this.prisma.complianceRequirement.findUnique({
      where: { id },
    });
  }

  /**
   * List all active requirements
   */
  async listRequirements(params: { isActive?: boolean; category?: ComplianceCategory }) {
    const { isActive = true, category } = params;

    return this.prisma.complianceRequirement.findMany({
      where: {
        isActive,
        ...(category && { category }),
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Create a compliance requirement
   */
  async createRequirement(data: {
    code: string;
    name: string;
    description: string;
    category: ComplianceCategory;
    requiresCertification?: boolean;
    requiresTraining?: boolean;
    requiresAttestation?: boolean;
    requiresBackgroundCheck?: boolean;
    validityPeriodDays?: number;
    verificationRequired?: boolean;
    verificationProviders?: string[];
    trainingUrl?: string;
    certificationUrl?: string;
    isActive?: boolean;
  }) {
    return this.prisma.complianceRequirement.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        category: data.category,
        requiresCertification: data.requiresCertification ?? false,
        requiresTraining: data.requiresTraining ?? false,
        requiresAttestation: data.requiresAttestation ?? false,
        requiresBackgroundCheck: data.requiresBackgroundCheck ?? false,
        validityPeriodDays: data.validityPeriodDays ?? 365,
        verificationRequired: data.verificationRequired ?? true,
        verificationProviders: data.verificationProviders ?? [],
        trainingUrl: data.trainingUrl ?? null,
        certificationUrl: data.certificationUrl ?? null,
        isActive: data.isActive ?? true,
      },
    });
  }

  /**
   * Update a compliance requirement
   */
  async updateRequirement(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      category: ComplianceCategory;
      requiresCertification: boolean;
      requiresTraining: boolean;
      requiresAttestation: boolean;
      requiresBackgroundCheck: boolean;
      validityPeriodDays: number;
      verificationRequired: boolean;
      verificationProviders: string[];
      trainingUrl: string | null;
      certificationUrl: string | null;
      isActive: boolean;
    }>
  ) {
    return this.prisma.complianceRequirement.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.requiresCertification !== undefined && {
          requiresCertification: data.requiresCertification,
        }),
        ...(data.requiresTraining !== undefined && {
          requiresTraining: data.requiresTraining,
        }),
        ...(data.requiresAttestation !== undefined && {
          requiresAttestation: data.requiresAttestation,
        }),
        ...(data.requiresBackgroundCheck !== undefined && {
          requiresBackgroundCheck: data.requiresBackgroundCheck,
        }),
        ...(data.validityPeriodDays !== undefined && {
          validityPeriodDays: data.validityPeriodDays,
        }),
        ...(data.verificationRequired !== undefined && {
          verificationRequired: data.verificationRequired,
        }),
        ...(data.verificationProviders !== undefined && {
          verificationProviders: data.verificationProviders,
        }),
        ...(data.trainingUrl !== undefined && { trainingUrl: data.trainingUrl }),
        ...(data.certificationUrl !== undefined && { certificationUrl: data.certificationUrl }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  // ===========================================================================
  // TENANT COMPLIANCE REQUIREMENT OPERATIONS
  // ===========================================================================

  /**
   * Get tenant's compliance requirements
   */
  async getTenantRequirements(tenantId: string, params?: { isRequired?: boolean }) {
    const { isRequired } = params ?? {};

    return this.prisma.tenantComplianceRequirement.findMany({
      where: {
        tenantId,
        ...(isRequired !== undefined && { requiresAttestation: isRequired }),
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Add a requirement to tenant
   */
  async addTenantRequirement(data: {
    tenantId: string;
    code: string;
    name: string;
    description?: string;
    requiresCertification?: boolean;
    requiresTraining?: boolean;
    requiresAttestation?: boolean;
    attestationQuestions?: Array<{ question: string; type: string; requiredAnswer?: string }>;
    validityPeriodDays?: number;
    isActive?: boolean;
  }) {
    return this.prisma.tenantComplianceRequirement.create({
      data: {
        tenantId: data.tenantId,
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        requiresCertification: data.requiresCertification ?? false,
        requiresTraining: data.requiresTraining ?? false,
        requiresAttestation: data.requiresAttestation ?? true,
        attestationQuestions: data.attestationQuestions
          ? (data.attestationQuestions as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        validityPeriodDays: data.validityPeriodDays ?? null,
        isActive: data.isActive ?? true,
      },
    });
  }

  /**
   * Update tenant requirement
   */
  async updateTenantRequirement(
    id: string,
    data: Partial<{
      name: string;
      description: string | null;
      requiresCertification: boolean;
      requiresTraining: boolean;
      requiresAttestation: boolean;
      attestationQuestions: Array<{
        question: string;
        type: string;
        requiredAnswer?: string;
      }> | null;
      validityPeriodDays: number | null;
      isActive: boolean;
    }>
  ) {
    return this.prisma.tenantComplianceRequirement.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.requiresCertification !== undefined && {
          requiresCertification: data.requiresCertification,
        }),
        ...(data.requiresTraining !== undefined && { requiresTraining: data.requiresTraining }),
        ...(data.requiresAttestation !== undefined && {
          requiresAttestation: data.requiresAttestation,
        }),
        ...(data.attestationQuestions !== undefined && {
          attestationQuestions: data.attestationQuestions as Prisma.InputJsonValue,
        }),
        ...(data.validityPeriodDays !== undefined && {
          validityPeriodDays: data.validityPeriodDays,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  /**
   * Remove tenant requirement
   */
  async removeTenantRequirement(id: string) {
    return this.prisma.tenantComplianceRequirement.delete({
      where: { id },
    });
  }

  // ===========================================================================
  // VERIFICATION LOG OPERATIONS
  // ===========================================================================

  /**
   * Create a verification log entry
   */
  async createVerificationLog(data: {
    complianceId: string;
    verificationMethod: string;
    verificationProvider?: string;
    status: ComplianceVerificationStatus;
    failureReason?: string;
    responseData?: Record<string, unknown>;
  }) {
    return this.prisma.complianceVerificationLog.create({
      data: {
        complianceId: data.complianceId,
        verificationMethod: data.verificationMethod,
        verificationProvider: data.verificationProvider ?? null,
        status: data.status,
        failureReason: data.failureReason ?? null,
        responseData: data.responseData
          ? (data.responseData as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        attemptedAt: new Date(),
      },
    });
  }

  /**
   * List verification logs
   */
  async listVerificationLogs(params: ListVerificationLogsParams) {
    const { complianceId, limit = 50, offset = 0 } = params;

    const where: Prisma.ComplianceVerificationLogWhereInput = {
      ...(complianceId && { complianceId }),
    };

    const [items, total] = await Promise.all([
      this.prisma.complianceVerificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          compliance: {
            select: {
              id: true,
              complianceType: true,
              userId: true,
            },
          },
        },
      }),
      this.prisma.complianceVerificationLog.count({ where }),
    ]);

    return { items, total };
  }

  // ===========================================================================
  // ELIGIBILITY AND MATCHING QUERIES
  // ===========================================================================

  /**
   * Find freelancers with specific compliance qualifications
   */
  async findEligibleFreelancers(params: FindEligibleFreelancersParams) {
    const { complianceTypes, clearanceLevel, requirementIds, limit = 100, offset = 0 } = params;

    // Build the query for finding eligible freelancers
    // Filter users by status instead of role (role is on TenantMember)
    const userWhere: Prisma.UserWhereInput = {
      status: 'ACTIVE',
    };

    // Get users with required compliances
    if (complianceTypes && complianceTypes.length > 0) {
      userWhere.freelancerCompliances = {
        some: {
          complianceType: { in: complianceTypes },
          verificationStatus: 'VERIFIED',
          OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
        },
      };
    }

    // Add clearance level filter
    if (clearanceLevel) {
      userWhere.securityClearances = {
        some: {
          clearanceLevel,
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
        },
      };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: userWhere,
        take: limit,
        skip: offset,
        include: {
          freelancerCompliances: {
            where: {
              verificationStatus: 'VERIFIED',
              OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
            },
          },
          securityClearances: {
            where: {
              isActive: true,
              OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
            },
          },
          freelancerComplianceAttestations: {
            where: {
              expiresAt: { gte: new Date() },
              isActive: true,
              ...(requirementIds &&
                requirementIds.length > 0 && {
                  requirementCode: { in: requirementIds },
                }),
            },
          },
        },
      }),
      this.prisma.user.count({ where: userWhere }),
    ]);

    return { users, total };
  }

  /**
   * Get compliance statistics for a freelancer
   */
  async getFreelancerComplianceStats(userId: string): Promise<FreelancerComplianceStats> {
    const now = new Date();

    const [
      totalCompliances,
      verifiedCompliances,
      pendingCompliances,
      expiredCompliances,
      activeClearances,
      activeAttestations,
    ] = await Promise.all([
      this.prisma.freelancerCompliance.count({ where: { userId } }),
      this.prisma.freelancerCompliance.count({
        where: {
          userId,
          verificationStatus: 'VERIFIED',
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        },
      }),
      this.prisma.freelancerCompliance.count({
        where: { userId, verificationStatus: 'PENDING' },
      }),
      this.prisma.freelancerCompliance.count({
        where: {
          userId,
          OR: [{ verificationStatus: 'EXPIRED' }, { expiresAt: { lt: now } }],
        },
      }),
      this.prisma.securityClearance.count({
        where: {
          userId,
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        },
      }),
      this.prisma.freelancerComplianceAttestation.count({
        where: { userId, expiresAt: { gte: now }, isActive: true },
      }),
    ]);

    return {
      totalCompliances,
      verifiedCompliances,
      pendingCompliances,
      expiredCompliances,
      activeClearances,
      activeAttestations,
    };
  }

  /**
   * Get full compliance profile for a freelancer
   */
  async getFreelancerComplianceProfile(userId: string) {
    const now = new Date();

    const [user, compliances, clearances, attestations, stats] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      }),
      this.prisma.freelancerCompliance.findMany({
        where: { userId },
        include: {
          verificationLogs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.securityClearance.findMany({
        where: { userId },
        orderBy: { grantedAt: 'desc' },
      }),
      this.prisma.freelancerComplianceAttestation.findMany({
        where: {
          userId,
          expiresAt: { gte: now },
          isActive: true,
        },
        orderBy: { attestedAt: 'desc' },
      }),
      this.getFreelancerComplianceStats(userId),
    ]);

    if (!user) {
      return null;
    }

    return {
      user,
      compliances,
      clearances,
      attestations,
      stats,
    };
  }
}
