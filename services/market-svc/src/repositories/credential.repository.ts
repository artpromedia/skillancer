// @ts-nocheck
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/**
 * @module @skillancer/market-svc/repositories/credential
 * Verified Credential Repository
 *
 * NOTE: ESLint disabled for Prisma type errors - will be resolved after database migration
 */

import type { PrismaClient, Prisma, VerifiedCredential } from '@skillancer/database';

export interface CreateCredentialData {
  userId: string;
  freelancerProfileId?: string;
  sourceCredentialId: string;
  source: 'SKILLPOD' | 'EXTERNAL' | 'MANUAL';
  credentialType:
    | 'COURSE_COMPLETION'
    | 'ASSESSMENT_PASS'
    | 'CERTIFICATION'
    | 'SKILL_BADGE'
    | 'LEARNING_PATH'
    | 'EXTERNAL_CERTIFICATION';
  title: string;
  description?: string;
  skillIds: string[];
  issueDate: Date;
  expirationDate?: Date;
  syncedAt: Date;
  score?: number;
  percentile?: number;
  proficiencyLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  verificationUrl: string;
  verificationCode: string;
  imageUrl?: string;
  badgeUrl?: string;
  metadata?: Record<string, unknown>;
  status?: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'PENDING_RENEWAL';
  isVisible?: boolean;
}

export interface UpdateCredentialData {
  score?: number;
  percentile?: number;
  expirationDate?: Date;
  syncedAt?: Date;
  metadata?: Record<string, unknown>;
  status?: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'PENDING_RENEWAL';
  revokedAt?: Date;
  revocationReason?: string;
  isVisible?: boolean;
  displayOrder?: number;
  lastVerifiedAt?: Date;
}

export class VerifiedCredentialRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateCredentialData): Promise<VerifiedCredential> {
    return this.prisma.verifiedCredential.create({
      data: {
        userId: data.userId,
        freelancerProfileId: data.freelancerProfileId,
        sourceCredentialId: data.sourceCredentialId,
        source: data.source,
        credentialType: data.credentialType,
        title: data.title,
        description: data.description,
        skillIds: data.skillIds,
        issueDate: data.issueDate,
        expirationDate: data.expirationDate,
        syncedAt: data.syncedAt,
        score: data.score,
        percentile: data.percentile,
        proficiencyLevel: data.proficiencyLevel,
        verificationUrl: data.verificationUrl,
        verificationCode: data.verificationCode,
        imageUrl: data.imageUrl,
        badgeUrl: data.badgeUrl,
        metadata: data.metadata as Prisma.JsonObject,
        status: data.status ?? 'ACTIVE',
        isVisible: data.isVisible ?? true,
      },
    });
  }

  async findById(id: string): Promise<VerifiedCredential | null> {
    return this.prisma.verifiedCredential.findUnique({
      where: { id },
    });
  }

  async findBySourceId(
    userId: string,
    sourceCredentialId: string
  ): Promise<VerifiedCredential | null> {
    return this.prisma.verifiedCredential.findUnique({
      where: {
        userId_sourceCredentialId: { userId, sourceCredentialId },
      },
    });
  }

  async findByUser(userId: string): Promise<VerifiedCredential[]> {
    return this.prisma.verifiedCredential.findMany({
      where: { userId },
      orderBy: [{ displayOrder: 'asc' }, { issueDate: 'desc' }],
    });
  }

  async findActiveByUser(userId: string): Promise<VerifiedCredential[]> {
    return this.prisma.verifiedCredential.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      orderBy: [{ displayOrder: 'asc' }, { issueDate: 'desc' }],
    });
  }

  async findVisibleByUser(userId: string): Promise<VerifiedCredential[]> {
    return this.prisma.verifiedCredential.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        isVisible: true,
      },
      orderBy: [{ displayOrder: 'asc' }, { issueDate: 'desc' }],
    });
  }

  async findByUserAndSkill(userId: string, skillId: string): Promise<VerifiedCredential[]> {
    return this.prisma.verifiedCredential.findMany({
      where: {
        userId,
        skillIds: { has: skillId },
        status: 'ACTIVE',
      },
      orderBy: { issueDate: 'desc' },
    });
  }

  async findExpiringSoon(daysAhead: number): Promise<VerifiedCredential[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.prisma.verifiedCredential.findMany({
      where: {
        status: 'ACTIVE',
        expirationDate: {
          lte: futureDate,
          gt: new Date(),
        },
      },
    });
  }

  async findExpired(): Promise<VerifiedCredential[]> {
    return this.prisma.verifiedCredential.findMany({
      where: {
        status: 'ACTIVE',
        expirationDate: {
          lt: new Date(),
        },
      },
    });
  }

  async update(id: string, data: UpdateCredentialData): Promise<VerifiedCredential> {
    return this.prisma.verifiedCredential.update({
      where: { id },
      data: {
        score: data.score,
        percentile: data.percentile,
        expirationDate: data.expirationDate,
        syncedAt: data.syncedAt,
        metadata: data.metadata as Prisma.JsonObject,
        status: data.status,
        revokedAt: data.revokedAt,
        revocationReason: data.revocationReason,
        isVisible: data.isVisible,
        displayOrder: data.displayOrder,
        lastVerifiedAt: data.lastVerifiedAt,
      },
    });
  }

  async updateVisibility(
    id: string,
    isVisible: boolean,
    displayOrder?: number
  ): Promise<VerifiedCredential> {
    return this.prisma.verifiedCredential.update({
      where: { id },
      data: { isVisible, displayOrder },
    });
  }

  async countByUser(userId: string): Promise<{
    total: number;
    active: number;
    certifications: number;
    expiringSoon: number;
  }> {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const [total, active, certifications, expiringSoon] = await Promise.all([
      this.prisma.verifiedCredential.count({ where: { userId } }),
      this.prisma.verifiedCredential.count({ where: { userId, status: 'ACTIVE' } }),
      this.prisma.verifiedCredential.count({
        where: { userId, status: 'ACTIVE', credentialType: 'CERTIFICATION' },
      }),
      this.prisma.verifiedCredential.count({
        where: {
          userId,
          status: 'ACTIVE',
          expirationDate: { lte: thirtyDaysFromNow, gt: new Date() },
        },
      }),
    ]);

    return { total, active, certifications, expiringSoon };
  }

  async delete(id: string): Promise<void> {
    await this.prisma.verifiedCredential.delete({ where: { id } });
  }
}

