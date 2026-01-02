// @ts-nocheck
/**
 * Portable Credential System
 * W3C Verifiable Credentials for work history
 * Sprint M4: Portable Verified Work History
 */

import { createLogger } from '@skillancer/logger';
import { prisma } from '@skillancer/database';
import { createHash, createSign, createVerify, randomUUID } from 'crypto';
import { Platform, VerificationLevel } from '../integrations/platform-connector';

const logger = createLogger('portable-credential');

// =============================================================================
// W3C VERIFIABLE CREDENTIALS TYPES
// =============================================================================

export interface VerifiableCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: CredentialIssuer;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: CredentialSubject;
  proof: CredentialProof;
  credentialStatus?: CredentialStatus;
}

export interface CredentialIssuer {
  id: string;
  name: string;
  url?: string;
  image?: string;
}

export interface CredentialSubject {
  id: string;
  type?: string;
  [key: string]: any;
}

export interface CredentialProof {
  type: string;
  created: string;
  verificationMethod: string;
  proofPurpose: string;
  proofValue: string;
}

export interface CredentialStatus {
  id: string;
  type: string;
  statusListIndex?: number;
  statusListCredential?: string;
}

export type CredentialType = 'WorkHistory' | 'Earnings' | 'Skills' | 'Reviews' | 'CompleteProfile';

export interface CredentialOptions {
  type: CredentialType;
  subjectId: string;
  subjectData: Record<string, any>;
  verificationLevel: VerificationLevel;
  expirationDays?: number;
  includeBlockchainAnchor?: boolean;
}

export interface CredentialBundle {
  credentials: VerifiableCredential[];
  presentation?: VerifiablePresentation;
  metadata: CredentialBundleMetadata;
}

export interface VerifiablePresentation {
  '@context': string[];
  id: string;
  type: string[];
  holder: string;
  verifiableCredential: VerifiableCredential[];
  proof: CredentialProof;
}

export interface CredentialBundleMetadata {
  userId: string;
  createdAt: Date;
  totalCredentials: number;
  platforms: Platform[];
  verificationLevels: Record<VerificationLevel, number>;
  bundleHash: string;
}

// =============================================================================
// CREDENTIAL CONTEXTS
// =============================================================================

const CONTEXTS = {
  base: ['https://www.w3.org/2018/credentials/v1', 'https://skillancer.com/credentials/v1'],
  workHistory: 'https://skillancer.com/credentials/work-history/v1',
  earnings: 'https://skillancer.com/credentials/earnings/v1',
  skills: 'https://skillancer.com/credentials/skills/v1',
  reviews: 'https://skillancer.com/credentials/reviews/v1',
  profile: 'https://skillancer.com/credentials/profile/v1',
};

const CREDENTIAL_TYPES: Record<CredentialType, string[]> = {
  WorkHistory: ['VerifiableCredential', 'WorkHistoryCredential'],
  Earnings: ['VerifiableCredential', 'EarningsCredential'],
  Skills: ['VerifiableCredential', 'SkillsCredential'],
  Reviews: ['VerifiableCredential', 'ReviewsCredential'],
  CompleteProfile: ['VerifiableCredential', 'ProfessionalProfileCredential'],
};

// =============================================================================
// PORTABLE CREDENTIAL SERVICE
// =============================================================================

export class PortableCredentialService {
  private readonly issuerDid: string;
  private readonly issuerName: string;
  private readonly baseUrl: string;
  private readonly privateKey: string;
  private readonly publicKey: string;

  constructor() {
    this.issuerDid = process.env.SKILLANCER_ISSUER_DID || 'did:web:skillancer.com';
    this.issuerName = 'Skillancer';
    this.baseUrl = process.env.APP_URL || 'https://skillancer.com';

    // In production, these would be loaded from secure key storage
    this.privateKey = process.env.CREDENTIAL_SIGNING_KEY || '';
    this.publicKey = process.env.CREDENTIAL_PUBLIC_KEY || '';
  }

  // ---------------------------------------------------------------------------
  // CREDENTIAL ISSUANCE
  // ---------------------------------------------------------------------------

  /**
   * Issue a verifiable credential
   */
  async issueCredential(options: CredentialOptions): Promise<VerifiableCredential> {
    logger.info(
      { type: options.type, subjectId: options.subjectId },
      'Issuing verifiable credential'
    );

    const credentialId = `urn:uuid:${randomUUID()}`;
    const issuanceDate = new Date().toISOString();
    const expirationDate = options.expirationDays
      ? new Date(Date.now() + options.expirationDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    // Build credential subject based on type
    const credentialSubject = this.buildCredentialSubject(
      options.type,
      options.subjectId,
      options.subjectData
    );

    // Build the credential
    const credential: Omit<VerifiableCredential, 'proof'> = {
      '@context': [...CONTEXTS.base, this.getContextForType(options.type)],
      id: credentialId,
      type: CREDENTIAL_TYPES[options.type],
      issuer: {
        id: this.issuerDid,
        name: this.issuerName,
        url: this.baseUrl,
        image: `${this.baseUrl}/logo.png`,
      },
      issuanceDate,
      ...(expirationDate && { expirationDate }),
      credentialSubject,
      credentialStatus: {
        id: `${this.baseUrl}/api/v1/credentials/status/${credentialId}`,
        type: 'CredentialStatusList2021',
      },
    };

    // Create proof
    const proof = await this.createProof(credential);

    const verifiableCredential: VerifiableCredential = {
      ...credential,
      proof,
    };

    // Store in database
    await this.storeCredential(verifiableCredential, options);

    logger.info({ credentialId, type: options.type }, 'Verifiable credential issued');

    return verifiableCredential;
  }

  /**
   * Issue multiple credentials as a bundle
   */
  async issueCredentialBundle(userId: string, types: CredentialType[]): Promise<CredentialBundle> {
    logger.info({ userId, types }, 'Issuing credential bundle');

    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        workHistory: {
          include: { reviews: true },
          where: {
            verificationLevel: {
              not: VerificationLevel.SELF_REPORTED,
            },
          },
        },
        platformConnections: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const credentials: VerifiableCredential[] = [];
    const platforms = new Set<Platform>();
    const verificationLevelCounts: Record<VerificationLevel, number> = {
      [VerificationLevel.SELF_REPORTED]: 0,
      [VerificationLevel.PLATFORM_CONNECTED]: 0,
      [VerificationLevel.PLATFORM_VERIFIED]: 0,
      [VerificationLevel.CRYPTOGRAPHICALLY_SEALED]: 0,
    };

    // Issue each requested credential type
    for (const type of types) {
      const credential = await this.issueTypedCredential(userId, type, user);
      if (credential) {
        credentials.push(credential);
      }
    }

    // Count platforms and verification levels
    for (const wh of user.workHistory) {
      platforms.add(wh.platform as Platform);
      verificationLevelCounts[wh.verificationLevel as VerificationLevel]++;
    }

    // Create presentation if multiple credentials
    let presentation: VerifiablePresentation | undefined;
    if (credentials.length > 1) {
      presentation = await this.createPresentation(userId, credentials);
    }

    // Calculate bundle hash
    const bundleHash = this.hashCredentials(credentials);

    const bundle: CredentialBundle = {
      credentials,
      presentation,
      metadata: {
        userId,
        createdAt: new Date(),
        totalCredentials: credentials.length,
        platforms: Array.from(platforms),
        verificationLevels: verificationLevelCounts,
        bundleHash,
      },
    };

    return bundle;
  }

  private async issueTypedCredential(
    userId: string,
    type: CredentialType,
    userData: any
  ): Promise<VerifiableCredential | null> {
    switch (type) {
      case 'WorkHistory':
        return this.issueWorkHistoryCredential(userId, userData);
      case 'Earnings':
        return this.issueEarningsCredential(userId, userData);
      case 'Skills':
        return this.issueSkillsCredential(userId, userData);
      case 'Reviews':
        return this.issueReviewsCredential(userId, userData);
      case 'CompleteProfile':
        return this.issueCompleteProfileCredential(userId, userData);
      default:
        return null;
    }
  }

  // ---------------------------------------------------------------------------
  // TYPED CREDENTIAL ISSUANCE
  // ---------------------------------------------------------------------------

  private async issueWorkHistoryCredential(
    userId: string,
    userData: any
  ): Promise<VerifiableCredential> {
    const workHistory = userData.workHistory || [];

    const subjectData = {
      totalProjects: workHistory.length,
      completedProjects: workHistory.filter((wh: any) => wh.status === 'COMPLETED').length,
      platforms: [...new Set(workHistory.map((wh: any) => wh.platform))],
      dateRange: {
        earliest:
          workHistory.length > 0
            ? new Date(
                Math.min(...workHistory.map((wh: any) => new Date(wh.startDate).getTime()))
              ).toISOString()
            : null,
        latest:
          workHistory.length > 0
            ? new Date(
                Math.max(...workHistory.map((wh: any) => new Date(wh.startDate).getTime()))
              ).toISOString()
            : null,
      },
      projects: workHistory.slice(0, 10).map((wh: any) => ({
        title: wh.title,
        platform: wh.platform,
        startDate: wh.startDate,
        endDate: wh.endDate,
        skills: wh.skills,
        verificationLevel: wh.verificationLevel,
        verificationHash: wh.verificationHash,
      })),
    };

    const highestLevel = this.getHighestVerificationLevel(workHistory);

    return this.issueCredential({
      type: 'WorkHistory',
      subjectId: `${this.issuerDid}/users/${userId}`,
      subjectData,
      verificationLevel: highestLevel,
      expirationDays: 365,
    });
  }

  private async issueEarningsCredential(
    userId: string,
    userData: any
  ): Promise<VerifiableCredential> {
    const workHistory = userData.workHistory || [];

    // Calculate earnings by platform
    const earningsByPlatform: Record<string, number> = {};
    let totalEarnings = 0;

    for (const wh of workHistory) {
      const platform = wh.platform || 'UNKNOWN';
      earningsByPlatform[platform] = (earningsByPlatform[platform] || 0) + (wh.earnings || 0);
      totalEarnings += wh.earnings || 0;
    }

    // Only include verified earnings in credential
    const verifiedWorkHistory = workHistory.filter(
      (wh: any) => wh.verificationLevel !== VerificationLevel.SELF_REPORTED
    );
    const verifiedEarnings = verifiedWorkHistory.reduce(
      (sum: number, wh: any) => sum + (wh.earnings || 0),
      0
    );

    const subjectData = {
      totalVerifiedEarnings: verifiedEarnings,
      currency: 'USD',
      earningsByPlatform,
      projectCount: verifiedWorkHistory.length,
      verificationPercentage:
        totalEarnings > 0 ? Math.round((verifiedEarnings / totalEarnings) * 100) : 0,
    };

    const highestLevel = this.getHighestVerificationLevel(verifiedWorkHistory);

    return this.issueCredential({
      type: 'Earnings',
      subjectId: `${this.issuerDid}/users/${userId}`,
      subjectData,
      verificationLevel: highestLevel,
      expirationDays: 365,
    });
  }

  private async issueSkillsCredential(
    userId: string,
    userData: any
  ): Promise<VerifiableCredential> {
    const workHistory = userData.workHistory || [];

    // Extract and count skills
    const skillCounts: Record<string, { count: number; verified: number }> = {};

    for (const wh of workHistory) {
      const skills = wh.skills || [];
      const isVerified = wh.verificationLevel !== VerificationLevel.SELF_REPORTED;

      for (const skill of skills) {
        if (!skillCounts[skill]) {
          skillCounts[skill] = { count: 0, verified: 0 };
        }
        skillCounts[skill].count++;
        if (isVerified) {
          skillCounts[skill].verified++;
        }
      }
    }

    // Sort by count and take top skills
    const topSkills = Object.entries(skillCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([name, data]) => ({
        name,
        projectCount: data.count,
        verifiedProjectCount: data.verified,
        verificationPercentage: Math.round((data.verified / data.count) * 100),
      }));

    const subjectData = {
      totalSkills: Object.keys(skillCounts).length,
      topSkills,
      skillCategories: this.categorizeSkills(topSkills),
    };

    return this.issueCredential({
      type: 'Skills',
      subjectId: `${this.issuerDid}/users/${userId}`,
      subjectData,
      verificationLevel: VerificationLevel.PLATFORM_VERIFIED,
      expirationDays: 365,
    });
  }

  private async issueReviewsCredential(
    userId: string,
    userData: any
  ): Promise<VerifiableCredential> {
    const workHistory = userData.workHistory || [];

    // Aggregate reviews
    const allReviews = workHistory.flatMap((wh: any) => wh.reviews || []);
    const verifiedReviews = allReviews.filter((r: any) => r.verified);

    const ratings = verifiedReviews.map((r: any) => r.rating / (r.maxRating || 5));
    const averageRating =
      ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0;

    const subjectData = {
      totalReviews: allReviews.length,
      verifiedReviews: verifiedReviews.length,
      averageRating: Math.round(averageRating * 5 * 100) / 100,
      ratingDistribution: this.calculateRatingDistribution(verifiedReviews),
      platforms: [...new Set(workHistory.map((wh: any) => wh.platform))],
    };

    return this.issueCredential({
      type: 'Reviews',
      subjectId: `${this.issuerDid}/users/${userId}`,
      subjectData,
      verificationLevel: VerificationLevel.PLATFORM_VERIFIED,
      expirationDays: 365,
    });
  }

  private async issueCompleteProfileCredential(
    userId: string,
    userData: any
  ): Promise<VerifiableCredential> {
    const workHistory = userData.workHistory || [];
    const connections = userData.platformConnections || [];

    const verifiedWorkHistory = workHistory.filter(
      (wh: any) => wh.verificationLevel !== VerificationLevel.SELF_REPORTED
    );

    const subjectData = {
      displayName: userData.name,
      connectedPlatforms: connections.filter((c: any) => c.isActive).map((c: any) => c.platform),
      profileCompleteness: this.calculateProfileCompleteness(userData),
      workHistory: {
        totalProjects: workHistory.length,
        verifiedProjects: verifiedWorkHistory.length,
        completedProjects: workHistory.filter((wh: any) => wh.status === 'COMPLETED').length,
      },
      earnings: {
        total: workHistory.reduce((sum: number, wh: any) => sum + (wh.earnings || 0), 0),
        verified: verifiedWorkHistory.reduce((sum: number, wh: any) => sum + (wh.earnings || 0), 0),
        currency: 'USD',
      },
      skills: this.extractTopSkills(workHistory),
      reviews: {
        total: workHistory.flatMap((wh: any) => wh.reviews || []).length,
        averageRating: this.calculateAverageRating(workHistory),
      },
      memberSince: userData.createdAt,
      lastVerified: new Date().toISOString(),
    };

    return this.issueCredential({
      type: 'CompleteProfile',
      subjectId: `${this.issuerDid}/users/${userId}`,
      subjectData,
      verificationLevel: this.getHighestVerificationLevel(verifiedWorkHistory),
      expirationDays: 365,
    });
  }

  // ---------------------------------------------------------------------------
  // PRESENTATION
  // ---------------------------------------------------------------------------

  private async createPresentation(
    userId: string,
    credentials: VerifiableCredential[]
  ): Promise<VerifiablePresentation> {
    const presentationId = `urn:uuid:${randomUUID()}`;

    const presentation: Omit<VerifiablePresentation, 'proof'> = {
      '@context': CONTEXTS.base,
      id: presentationId,
      type: ['VerifiablePresentation'],
      holder: `${this.issuerDid}/users/${userId}`,
      verifiableCredential: credentials,
    };

    const proof = await this.createProof(presentation);

    return {
      ...presentation,
      proof,
    };
  }

  // ---------------------------------------------------------------------------
  // PROOF CREATION & VERIFICATION
  // ---------------------------------------------------------------------------

  private async createProof(data: any): Promise<CredentialProof> {
    const canonicalized = JSON.stringify(data, Object.keys(data).sort());
    const hash = createHash('sha256').update(canonicalized).digest();

    let proofValue: string;

    if (this.privateKey) {
      // Sign with RSA key
      const sign = createSign('RSA-SHA256');
      sign.update(hash);
      proofValue = sign.sign(this.privateKey, 'base64');
    } else {
      // Development: use HMAC
      proofValue = createHash('sha256')
        .update(hash + (process.env.CREDENTIAL_SECRET || 'dev-secret'))
        .digest('base64');
    }

    return {
      type: 'RsaSignature2018',
      created: new Date().toISOString(),
      verificationMethod: `${this.issuerDid}#key-1`,
      proofPurpose: 'assertionMethod',
      proofValue,
    };
  }

  /**
   * Verify a credential's proof
   */
  async verifyCredentialProof(
    credential: VerifiableCredential
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Verify issuer
    if (!credential.issuer || credential.issuer.id !== this.issuerDid) {
      errors.push('Invalid issuer');
    }

    // Verify expiration
    if (credential.expirationDate) {
      if (new Date(credential.expirationDate) < new Date()) {
        errors.push('Credential has expired');
      }
    }

    // Verify proof
    const { proof, ...dataWithoutProof } = credential;
    const canonicalized = JSON.stringify(dataWithoutProof, Object.keys(dataWithoutProof).sort());
    const hash = createHash('sha256').update(canonicalized).digest();

    if (this.publicKey && proof.type === 'RsaSignature2018') {
      try {
        const verify = createVerify('RSA-SHA256');
        verify.update(hash);
        const isValid = verify.verify(this.publicKey, proof.proofValue, 'base64');
        if (!isValid) {
          errors.push('Invalid proof signature');
        }
      } catch {
        errors.push('Proof verification failed');
      }
    }

    // Check revocation status
    if (credential.credentialStatus) {
      const isRevoked = await this.checkRevocationStatus(credential.id);
      if (isRevoked) {
        errors.push('Credential has been revoked');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ---------------------------------------------------------------------------
  // CREDENTIAL MANAGEMENT
  // ---------------------------------------------------------------------------

  private async storeCredential(
    credential: VerifiableCredential,
    options: CredentialOptions
  ): Promise<void> {
    await prisma.verifiableCredential.create({
      data: {
        id: credential.id,
        type: options.type,
        subjectId: options.subjectId,
        issuerId: credential.issuer.id,
        issuanceDate: new Date(credential.issuanceDate),
        expirationDate: credential.expirationDate ? new Date(credential.expirationDate) : null,
        verificationLevel: options.verificationLevel,
        credentialData: credential as any,
        proofHash: createHash('sha256').update(credential.proof.proofValue).digest('hex'),
        revoked: false,
      },
    });
  }

  /**
   * Revoke a credential
   */
  async revokeCredential(credentialId: string, reason: string): Promise<void> {
    await prisma.verifiableCredential.update({
      where: { id: credentialId },
      data: {
        revoked: true,
        revokedAt: new Date(),
        revocationReason: reason,
      },
    });

    logger.info({ credentialId, reason }, 'Credential revoked');
  }

  private async checkRevocationStatus(credentialId: string): Promise<boolean> {
    const credential = await prisma.verifiableCredential.findUnique({
      where: { id: credentialId },
      select: { revoked: true },
    });

    return credential?.revoked ?? false;
  }

  /**
   * Get credential by ID
   */
  async getCredential(credentialId: string): Promise<VerifiableCredential | null> {
    const stored = await prisma.verifiableCredential.findUnique({
      where: { id: credentialId },
    });

    if (!stored) {
      return null;
    }

    return stored.credentialData as unknown as VerifiableCredential;
  }

  /**
   * List credentials for a user
   */
  async listCredentials(userId: string): Promise<VerifiableCredential[]> {
    const stored = await prisma.verifiableCredential.findMany({
      where: {
        subjectId: { contains: userId },
        revoked: false,
      },
      orderBy: { issuanceDate: 'desc' },
    });

    return stored.map((s) => s.credentialData as unknown as VerifiableCredential);
  }

  // ---------------------------------------------------------------------------
  // HELPER METHODS
  // ---------------------------------------------------------------------------

  private getContextForType(type: CredentialType): string {
    switch (type) {
      case 'WorkHistory':
        return CONTEXTS.workHistory;
      case 'Earnings':
        return CONTEXTS.earnings;
      case 'Skills':
        return CONTEXTS.skills;
      case 'Reviews':
        return CONTEXTS.reviews;
      case 'CompleteProfile':
        return CONTEXTS.profile;
    }
  }

  private buildCredentialSubject(
    type: CredentialType,
    subjectId: string,
    subjectData: Record<string, any>
  ): CredentialSubject {
    return {
      id: subjectId,
      type: `${type}Subject`,
      ...subjectData,
    };
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

  private hashCredentials(credentials: VerifiableCredential[]): string {
    const hashes = credentials.map((c) => c.proof.proofValue);
    return createHash('sha256').update(hashes.join('')).digest('hex');
  }

  private categorizeSkills(skills: { name: string }[]): Record<string, string[]> {
    const categories: Record<string, string[]> = {
      programming: [],
      design: [],
      marketing: [],
      writing: [],
      other: [],
    };

    const categoryPatterns: Record<string, RegExp> = {
      programming: /javascript|typescript|python|java|react|node|sql|php|ruby|go|rust|c\+\+|c#/i,
      design: /design|figma|photoshop|illustrator|ui|ux|sketch|adobe/i,
      marketing: /seo|marketing|ads|google|facebook|social media|content/i,
      writing: /writing|copywriting|content|blog|article|editing/i,
    };

    for (const skill of skills) {
      let categorized = false;
      for (const [category, pattern] of Object.entries(categoryPatterns)) {
        if (pattern.test(skill.name)) {
          categories[category].push(skill.name);
          categorized = true;
          break;
        }
      }
      if (!categorized) {
        categories.other.push(skill.name);
      }
    }

    return categories;
  }

  private calculateRatingDistribution(reviews: any[]): Record<number, number> {
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    for (const review of reviews) {
      const normalized = Math.round((review.rating / (review.maxRating || 5)) * 5);
      distribution[normalized] = (distribution[normalized] || 0) + 1;
    }

    return distribution;
  }

  private calculateProfileCompleteness(userData: any): number {
    let score = 0;
    const checks = [
      { field: 'name', weight: 10 },
      { field: 'email', weight: 10 },
      { field: 'bio', weight: 10 },
      { field: 'avatarUrl', weight: 5 },
      { field: 'location', weight: 5 },
    ];

    for (const check of checks) {
      if (userData[check.field]) {
        score += check.weight;
      }
    }

    // Platform connections
    const activeConnections = (userData.platformConnections || []).filter(
      (c: any) => c.isActive
    ).length;
    score += Math.min(activeConnections * 10, 30);

    // Work history
    const workHistory = userData.workHistory || [];
    score += Math.min(workHistory.length * 3, 30);

    return Math.min(score, 100);
  }

  private extractTopSkills(workHistory: any[]): string[] {
    const skillCounts: Record<string, number> = {};

    for (const wh of workHistory) {
      for (const skill of wh.skills || []) {
        skillCounts[skill] = (skillCounts[skill] || 0) + 1;
      }
    }

    return Object.entries(skillCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([skill]) => skill);
  }

  private calculateAverageRating(workHistory: any[]): number {
    const allReviews = workHistory.flatMap((wh) => wh.reviews || []);
    if (allReviews.length === 0) return 0;

    const sum = allReviews.reduce((acc, r) => acc + r.rating / (r.maxRating || 5), 0);
    return Math.round((sum / allReviews.length) * 5 * 100) / 100;
  }
}

// Singleton instance
let serviceInstance: PortableCredentialService | null = null;

export function getPortableCredentialService(): PortableCredentialService {
  if (!serviceInstance) {
    serviceInstance = new PortableCredentialService();
  }
  return serviceInstance;
}

