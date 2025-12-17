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

import type {
  AddComplianceInput,
  AddClearanceInput,
  AddAttestationInput,
  ComplianceType,
  ClearanceLevel,
  ComplianceVerificationStatus,
} from '../types/compliance.types.js';
import type { PrismaClient, Prisma } from '@skillancer/database';

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
        type: input.type,
        category: input.category,
        certificationNumber: input.certificationNumber ?? null,
        issuingOrganization: input.issuingOrganization ?? null,
        issueDate: input.issueDate ? new Date(input.issueDate) : null,
        expirationDate: input.expirationDate ? new Date(input.expirationDate) : null,
        documentUrl: input.documentUrl ?? null,
        documentMetadata: (input.documentMetadata as Prisma.InputJsonValue) ?? null,
        trainingHours: input.trainingHours ?? null,
        trainingProvider: input.trainingProvider ?? null,
        trainingCompletedAt: input.trainingCompletedAt ? new Date(input.trainingCompletedAt) : null,
        verificationStatus: 'PENDING',
        metadata: (input.metadata as Prisma.InputJsonValue) ?? null,
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
            fullName: true,
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
        userId_type: {
          userId,
          type,
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
      ...(type && { type }),
      ...(status && { verificationStatus: status }),
      ...(!includeExpired && {
        OR: [{ expirationDate: null }, { expirationDate: { gte: new Date() } }],
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
      certificationNumber: string;
      issuingOrganization: string;
      issueDate: Date;
      expirationDate: Date;
      documentUrl: string;
      documentMetadata: Record<string, unknown>;
      trainingHours: number;
      trainingProvider: string;
      trainingCompletedAt: Date;
      verificationStatus: ComplianceVerificationStatus;
      verifiedAt: Date;
      verifiedBy: string;
      metadata: Record<string, unknown>;
    }>
  ) {
    return this.prisma.freelancerCompliance.update({
      where: { id },
      data: {
        ...(data.certificationNumber !== undefined && {
          certificationNumber: data.certificationNumber,
        }),
        ...(data.issuingOrganization !== undefined && {
          issuingOrganization: data.issuingOrganization,
        }),
        ...(data.issueDate && { issueDate: data.issueDate }),
        ...(data.expirationDate && { expirationDate: data.expirationDate }),
        ...(data.documentUrl !== undefined && { documentUrl: data.documentUrl }),
        ...(data.documentMetadata && {
          documentMetadata: data.documentMetadata as Prisma.InputJsonValue,
        }),
        ...(data.trainingHours !== undefined && { trainingHours: data.trainingHours }),
        ...(data.trainingProvider !== undefined && { trainingProvider: data.trainingProvider }),
        ...(data.trainingCompletedAt && { trainingCompletedAt: data.trainingCompletedAt }),
        ...(data.verificationStatus && { verificationStatus: data.verificationStatus }),
        ...(data.verifiedAt && { verifiedAt: data.verifiedAt }),
        ...(data.verifiedBy && { verifiedBy: data.verifiedBy }),
        ...(data.metadata && { metadata: data.metadata as Prisma.InputJsonValue }),
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
        expirationDate: {
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
            fullName: true,
          },
        },
      },
      orderBy: { expirationDate: 'asc' },
    });
  }

  /**
   * Get expired compliances that need status update
   */
  async getExpiredCompliances() {
    return this.prisma.freelancerCompliance.findMany({
      where: {
        expirationDate: {
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
        level: input.level,
        grantedBy: input.grantedBy,
        caseNumber: input.caseNumber ?? null,
        grantedDate: new Date(input.grantedDate),
        expirationDate: input.expirationDate ? new Date(input.expirationDate) : null,
        investigationType: input.investigationType ?? null,
        polygraphType: input.polygraphType ?? null,
        documentUrl: input.documentUrl ?? null,
        isActive: true,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? null,
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
            fullName: true,
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
        userId_level: {
          userId,
          level,
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
      ...(level && { level }),
      ...(isActive !== undefined && { isActive }),
      ...(!includeExpired && {
        OR: [{ expirationDate: null }, { expirationDate: { gte: new Date() } }],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.securityClearance.findMany({
        where,
        orderBy: { grantedDate: 'desc' },
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
      caseNumber: string;
      grantedDate: Date;
      expirationDate: Date;
      investigationType: string;
      polygraphType: string;
      documentUrl: string;
      isActive: boolean;
      metadata: Record<string, unknown>;
    }>
  ) {
    return this.prisma.securityClearance.update({
      where: { id },
      data: {
        ...(data.grantedBy !== undefined && { grantedBy: data.grantedBy }),
        ...(data.caseNumber !== undefined && { caseNumber: data.caseNumber }),
        ...(data.grantedDate && { grantedDate: data.grantedDate }),
        ...(data.expirationDate && { expirationDate: data.expirationDate }),
        ...(data.investigationType !== undefined && {
          investigationType: data.investigationType,
        }),
        ...(data.polygraphType !== undefined && { polygraphType: data.polygraphType }),
        ...(data.documentUrl !== undefined && { documentUrl: data.documentUrl }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.metadata && { metadata: data.metadata as Prisma.InputJsonValue }),
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
        expirationDate: {
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
            fullName: true,
          },
        },
      },
      orderBy: { expirationDate: 'asc' },
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
    const validUntil = input.validUntil
      ? new Date(input.validUntil)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    return this.prisma.freelancerComplianceAttestation.create({
      data: {
        userId,
        requirementId: input.requirementId,
        attestedAt: new Date(),
        validUntil,
        answers: input.answers as Prisma.InputJsonValue,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        signature: input.signature ?? null,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? null,
      },
      include: {
        requirement: true,
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
            fullName: true,
          },
        },
        requirement: true,
      },
    });
  }

  /**
   * Find active attestation by user and requirement
   */
  async findActiveAttestation(userId: string, requirementId: string) {
    return this.prisma.freelancerComplianceAttestation.findFirst({
      where: {
        userId,
        requirementId,
        validUntil: { gte: new Date() },
      },
      include: {
        requirement: true,
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
      ...(requirementId && { requirementId }),
      ...(!includeExpired && { validUntil: { gte: new Date() } }),
    };

    const [items, total] = await Promise.all([
      this.prisma.freelancerComplianceAttestation.findMany({
        where,
        orderBy: { attestedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          requirement: true,
        },
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
        validUntil: {
          gte: now,
          lte: futureDate,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        requirement: true,
      },
      orderBy: { validUntil: 'asc' },
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
  async listRequirements(params: { isActive?: boolean; category?: string }) {
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
    name: string;
    description: string;
    category: string;
    requiredComplianceTypes: ComplianceType[];
    requiredClearanceLevel?: ClearanceLevel;
    attestationQuestions: Array<{ question: string; required: boolean }>;
    validityPeriodDays?: number;
    isActive?: boolean;
  }) {
    return this.prisma.complianceRequirement.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        requiredComplianceTypes: data.requiredComplianceTypes,
        requiredClearanceLevel: data.requiredClearanceLevel ?? null,
        attestationQuestions: data.attestationQuestions as Prisma.InputJsonValue,
        validityPeriodDays: data.validityPeriodDays ?? 365,
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
      category: string;
      requiredComplianceTypes: ComplianceType[];
      requiredClearanceLevel: ClearanceLevel | null;
      attestationQuestions: Array<{ question: string; required: boolean }>;
      validityPeriodDays: number;
      isActive: boolean;
    }>
  ) {
    return this.prisma.complianceRequirement.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.requiredComplianceTypes && {
          requiredComplianceTypes: data.requiredComplianceTypes,
        }),
        ...(data.requiredClearanceLevel !== undefined && {
          requiredClearanceLevel: data.requiredClearanceLevel,
        }),
        ...(data.attestationQuestions && {
          attestationQuestions: data.attestationQuestions as Prisma.InputJsonValue,
        }),
        ...(data.validityPeriodDays !== undefined && {
          validityPeriodDays: data.validityPeriodDays,
        }),
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
        ...(isRequired !== undefined && { isRequired }),
      },
      include: {
        requirement: true,
      },
      orderBy: { requirement: { name: 'asc' } },
    });
  }

  /**
   * Add a requirement to tenant
   */
  async addTenantRequirement(data: {
    tenantId: string;
    requirementId: string;
    isRequired: boolean;
    customSettings?: Record<string, unknown>;
  }) {
    return this.prisma.tenantComplianceRequirement.create({
      data: {
        tenantId: data.tenantId,
        requirementId: data.requirementId,
        isRequired: data.isRequired,
        customSettings: (data.customSettings as Prisma.InputJsonValue) ?? null,
      },
      include: {
        requirement: true,
      },
    });
  }

  /**
   * Update tenant requirement
   */
  async updateTenantRequirement(
    id: string,
    data: Partial<{
      isRequired: boolean;
      customSettings: Record<string, unknown>;
    }>
  ) {
    return this.prisma.tenantComplianceRequirement.update({
      where: { id },
      data: {
        ...(data.isRequired !== undefined && { isRequired: data.isRequired }),
        ...(data.customSettings && {
          customSettings: data.customSettings as Prisma.InputJsonValue,
        }),
      },
      include: {
        requirement: true,
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
    verificationResult: boolean;
    verificationDetails?: Record<string, unknown>;
    verifiedBy?: string;
    externalReference?: string;
  }) {
    return this.prisma.complianceVerificationLog.create({
      data: {
        complianceId: data.complianceId,
        verificationMethod: data.verificationMethod,
        verificationResult: data.verificationResult,
        verificationDetails: (data.verificationDetails as Prisma.InputJsonValue) ?? null,
        verifiedBy: data.verifiedBy ?? null,
        externalReference: data.externalReference ?? null,
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
              type: true,
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
    const userWhere: Prisma.UserWhereInput = {
      role: 'FREELANCER',
      isActive: true,
    };

    // Get users with required compliances
    if (complianceTypes && complianceTypes.length > 0) {
      userWhere.freelancerCompliances = {
        some: {
          type: { in: complianceTypes },
          verificationStatus: 'VERIFIED',
          OR: [{ expirationDate: null }, { expirationDate: { gte: new Date() } }],
        },
      };
    }

    // Add clearance level filter
    if (clearanceLevel) {
      userWhere.securityClearances = {
        some: {
          level: clearanceLevel,
          isActive: true,
          OR: [{ expirationDate: null }, { expirationDate: { gte: new Date() } }],
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
              OR: [{ expirationDate: null }, { expirationDate: { gte: new Date() } }],
            },
          },
          securityClearances: {
            where: {
              isActive: true,
              OR: [{ expirationDate: null }, { expirationDate: { gte: new Date() } }],
            },
          },
          freelancerComplianceAttestations: {
            where: {
              validUntil: { gte: new Date() },
              ...(requirementIds &&
                requirementIds.length > 0 && {
                  requirementId: { in: requirementIds },
                }),
            },
            include: {
              requirement: true,
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
          OR: [{ expirationDate: null }, { expirationDate: { gte: now } }],
        },
      }),
      this.prisma.freelancerCompliance.count({
        where: { userId, verificationStatus: 'PENDING' },
      }),
      this.prisma.freelancerCompliance.count({
        where: {
          userId,
          OR: [{ verificationStatus: 'EXPIRED' }, { expirationDate: { lt: now } }],
        },
      }),
      this.prisma.securityClearance.count({
        where: {
          userId,
          isActive: true,
          OR: [{ expirationDate: null }, { expirationDate: { gte: now } }],
        },
      }),
      this.prisma.freelancerComplianceAttestation.count({
        where: { userId, validUntil: { gte: now } },
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
          fullName: true,
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
        orderBy: { grantedDate: 'desc' },
      }),
      this.prisma.freelancerComplianceAttestation.findMany({
        where: {
          userId,
          validUntil: { gte: now },
        },
        include: {
          requirement: true,
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
