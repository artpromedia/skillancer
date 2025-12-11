/**
 * @module @skillancer/auth-svc/services/verification
 * Identity Verification Service
 *
 * Orchestrates identity verification flows:
 * - Initiating verification inquiries
 * - Processing webhook events
 * - Managing verification badges
 * - Compliance and audit logging
 */

import { createLogger } from '@skillancer/logger';

import {
  getPersonaService,
  type PersonaInquiry,
  type PersonaDocument,
  type PersonaVerification,
} from './persona.service.js';
import { getConfig } from '../config/index.js';

import type { PrismaClient } from '@skillancer/database';

// Re-map types from Prisma namespace - match the actual Prisma enum values
type VerificationLevel = 'NONE' | 'EMAIL' | 'BASIC' | 'ENHANCED' | 'PREMIUM';
type VerificationType = 'BASIC' | 'GOVERNMENT_ID' | 'ADDRESS' | 'ENHANCED' | 'PREMIUM';
type VerificationStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'NEEDS_REVIEW'
  | 'APPROVED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'CANCELLED';
type DocumentType =
  | 'PASSPORT'
  | 'DRIVERS_LICENSE'
  | 'NATIONAL_ID'
  | 'RESIDENCE_PERMIT'
  | 'UTILITY_BILL'
  | 'BANK_STATEMENT'
  | 'TAX_DOCUMENT'
  | 'OTHER';
type DocumentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';

const logger = createLogger({ serviceName: 'verification-service' });

// =============================================================================
// TYPES
// =============================================================================

export interface StartVerificationOptions {
  userId: string;
  verificationType: 'BASIC' | 'ENHANCED' | 'PREMIUM';
  email?: string;
  phoneNumber?: string;
  redirectUri?: string;
}

export interface StartVerificationResult {
  inquiryId: string;
  personaInquiryId: string;
  sessionToken?: string;
  verificationType: VerificationType;
  expiresAt: Date;
}

export interface VerificationBadge {
  id: string;
  level: VerificationLevel;
  grantedAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

export interface VerificationHistory {
  inquiries: VerificationInquirySummary[];
  currentBadges: VerificationBadge[];
  highestLevel: VerificationLevel;
}

export interface VerificationInquirySummary {
  id: string;
  verificationType: VerificationType;
  status: VerificationStatus;
  initiatedAt: Date;
  completedAt: Date | null;
  resultLevel: VerificationLevel | null;
}

export interface WebhookProcessResult {
  success: boolean;
  inquiryId: string | null;
  eventType: string;
  statusUpdated: boolean;
  badgeGranted: boolean;
}

// =============================================================================
// VERIFICATION SERVICE
// =============================================================================

export class VerificationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Start a new verification inquiry
   */
  async startVerification(options: StartVerificationOptions): Promise<StartVerificationResult> {
    const personaService = getPersonaService();
    const config = getConfig();

    // Check if Persona is configured
    if (!personaService.isConfigured()) {
      throw new VerificationError(
        'Identity verification service not configured',
        'SERVICE_NOT_CONFIGURED'
      );
    }

    // Get template ID for verification type
    const templateId = personaService.getTemplateId(options.verificationType);
    if (!templateId) {
      throw new VerificationError(
        `No template configured for verification type: ${options.verificationType}`,
        'TEMPLATE_NOT_CONFIGURED'
      );
    }

    // Check for existing pending inquiry
    const existingInquiry = await this.prisma.verificationInquiry.findFirst({
      where: {
        userId: options.userId,
        verificationType: options.verificationType as VerificationType,
        status: {
          in: ['PENDING', 'IN_PROGRESS'],
        },
      },
    });

    if (existingInquiry) {
      // Resume existing inquiry if not expired
      if (existingInquiry.expiresAt && existingInquiry.expiresAt > new Date()) {
        const resumeResult = await personaService.resumeInquiry(existingInquiry.personaInquiryId);
        return {
          inquiryId: existingInquiry.id,
          personaInquiryId: existingInquiry.personaInquiryId,
          sessionToken: resumeResult.meta?.['session-token'],
          verificationType: existingInquiry.verificationType,
          expiresAt: existingInquiry.expiresAt,
        };
      }

      // Expire the old inquiry
      await this.prisma.verificationInquiry.update({
        where: { id: existingInquiry.id },
        data: { status: 'EXPIRED' },
      });
    }

    // Get user for reference
    const user = await this.prisma.user.findUnique({
      where: { id: options.userId },
      select: { email: true },
    });

    if (!user) {
      throw new VerificationError('User not found', 'USER_NOT_FOUND');
    }

    // Create Persona inquiry
    const inquiryOptions: {
      userId: string;
      templateId: string;
      email: string;
      redirectUri: string;
      note: string;
      phoneNumber?: string;
    } = {
      userId: options.userId,
      templateId,
      email: options.email ?? user.email,
      redirectUri: options.redirectUri ?? `${config.appUrl}/verification/callback`,
      note: `Skillancer verification: ${options.verificationType}`,
    };

    if (options.phoneNumber) {
      inquiryOptions.phoneNumber = options.phoneNumber;
    }

    const personaResponse = await personaService.createInquiry(inquiryOptions);

    const personaInquiry = personaResponse.data;
    const expiresAt = personaService.getInquiryExpiryDate();

    // Store inquiry in database
    const inquiry = await this.prisma.verificationInquiry.create({
      data: {
        userId: options.userId,
        personaInquiryId: personaInquiry.id,
        personaTemplateId: templateId,
        verificationType: options.verificationType as VerificationType,
        status: 'PENDING',
        expiresAt,
      },
    });

    logger.info(
      {
        inquiryId: inquiry.id,
        personaInquiryId: personaInquiry.id,
        userId: options.userId,
        verificationType: options.verificationType,
      },
      'Verification inquiry created'
    );

    const result: StartVerificationResult = {
      inquiryId: inquiry.id,
      personaInquiryId: personaInquiry.id,
      verificationType: inquiry.verificationType,
      expiresAt,
    };

    const sessionToken = personaResponse.meta?.['session-token'];
    if (sessionToken) {
      result.sessionToken = sessionToken;
    }

    return result;
  }

  /**
   * Get verification status
   */
  async getVerificationStatus(
    inquiryId: string,
    userId: string
  ): Promise<VerificationInquirySummary | null> {
    const inquiry = await this.prisma.verificationInquiry.findFirst({
      where: {
        id: inquiryId,
        userId,
      },
    });

    if (!inquiry) {
      return null;
    }

    return {
      id: inquiry.id,
      verificationType: inquiry.verificationType,
      status: inquiry.status,
      initiatedAt: inquiry.initiatedAt,
      completedAt: inquiry.completedAt,
      resultLevel: inquiry.verificationLevel,
    };
  }

  /**
   * Get user's verification history
   */
  async getVerificationHistory(userId: string): Promise<VerificationHistory> {
    const [inquiries, badges] = await Promise.all([
      this.prisma.verificationInquiry.findMany({
        where: { userId },
        orderBy: { initiatedAt: 'desc' },
        take: 20,
      }),
      this.prisma.userVerificationBadge.findMany({
        where: {
          userId,
          isActive: true,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { level: 'desc' },
      }),
    ]);

    // Determine highest verification level
    const levelOrder: VerificationLevel[] = ['NONE', 'EMAIL', 'BASIC', 'ENHANCED', 'PREMIUM'];
    let highestLevel: VerificationLevel = 'NONE';

    for (const badge of badges) {
      if (levelOrder.indexOf(badge.level) > levelOrder.indexOf(highestLevel)) {
        highestLevel = badge.level;
      }
    }

    return {
      inquiries: inquiries.map((i: (typeof inquiries)[number]) => ({
        id: i.id,
        verificationType: i.verificationType,
        status: i.status,
        initiatedAt: i.initiatedAt,
        completedAt: i.completedAt,
        resultLevel: i.verificationLevel,
      })),
      currentBadges: badges.map((b: (typeof badges)[number]) => ({
        id: b.id,
        level: b.level,
        grantedAt: b.grantedAt,
        expiresAt: b.expiresAt,
        isActive: b.isActive,
      })),
      highestLevel,
    };
  }

  /**
   * Process Persona webhook event
   */
  async processWebhook(
    eventType: string,
    personaInquiry: PersonaInquiry,
    included: Array<PersonaInquiry | PersonaDocument | PersonaVerification>
  ): Promise<WebhookProcessResult> {
    const personaService = getPersonaService();

    // Find our inquiry record
    const inquiry = await this.prisma.verificationInquiry.findUnique({
      where: { personaInquiryId: personaInquiry.id },
      include: { user: true },
    });

    if (!inquiry) {
      logger.warn(
        {
          personaInquiryId: personaInquiry.id,
          eventType,
        },
        'Received webhook for unknown inquiry'
      );
      return {
        success: false,
        inquiryId: null,
        eventType,
        statusUpdated: false,
        badgeGranted: false,
      };
    }

    logger.info(
      {
        inquiryId: inquiry.id,
        personaInquiryId: personaInquiry.id,
        eventType,
        personaStatus: personaInquiry.attributes.status,
      },
      'Processing verification webhook'
    );

    // Map Persona status to our status
    const newStatus = personaService.mapInquiryStatus(
      personaInquiry.attributes.status
    ) as VerificationStatus;

    let statusUpdated = false;
    let badgeGranted = false;

    // Update inquiry status
    if (inquiry.status !== newStatus) {
      const updateData: {
        status: VerificationStatus;
        completedAt?: Date;
        failureReasons?: string[];
      } = {
        status: newStatus as VerificationStatus,
      };

      // Set completion time for terminal states
      if (['APPROVED', 'DECLINED', 'EXPIRED', 'CANCELLED'].includes(newStatus)) {
        updateData.completedAt = new Date();
      }

      // Extract failure reasons if declined
      if (newStatus === 'DECLINED') {
        const failureReasons: string[] = [];

        // Check verifications for failure reasons
        for (const item of included) {
          if (item.type === 'verification') {
            const verification = item as PersonaVerification;
            for (const check of verification.attributes.checks) {
              if (check.status === 'failed') {
                failureReasons.push(...check.reasons);
              }
            }
          }
        }

        if (failureReasons.length > 0) {
          updateData.failureReasons = failureReasons;
        }
      }

      await this.prisma.verificationInquiry.update({
        where: { id: inquiry.id },
        data: updateData,
      });

      statusUpdated = true;
    }

    // Process documents from the inquiry
    await this.processDocuments(inquiry.id, included);

    // Grant badge if approved
    if (newStatus === 'APPROVED' && !inquiry.completedAt) {
      const badge = await this.grantVerificationBadge(
        inquiry.userId,
        inquiry.id,
        inquiry.verificationType
      );

      if (badge) {
        badgeGranted = true;

        // Update user's verification level
        await this.updateUserVerificationLevel(inquiry.userId);
      }
    }

    return {
      success: true,
      inquiryId: inquiry.id,
      eventType,
      statusUpdated,
      badgeGranted,
    };
  }

  /**
   * Process documents from webhook payload
   */
  private async processDocuments(
    inquiryId: string,
    included: Array<PersonaInquiry | PersonaDocument | PersonaVerification>
  ): Promise<void> {
    for (const item of included) {
      if (item.type !== 'document') continue;

      const doc = item as PersonaDocument;
      const attrs = doc.attributes;

      // Map document type
      const documentType = this.mapDocumentType(attrs['document-type']);
      if (!documentType) continue;

      // Extract country code from document fields
      const countryCode = (attrs.fields?.['issuing-country']?.value as string) ?? 'US';

      // Map status
      const status = this.mapDocumentStatus(attrs.status);

      // Upsert document record
      await this.prisma.verificationDocument.upsert({
        where: {
          id: doc.id,
        },
        create: {
          id: doc.id,
          inquiryId,
          documentType,
          documentCountry: countryCode.substring(0, 2).toUpperCase(),
          status,
          verifiedAt: status === 'VERIFIED' ? new Date() : null,
          documentExpiresAt: attrs.fields?.['expiration-date']?.value
            ? new Date(attrs.fields['expiration-date'].value as string)
            : null,
        },
        update: {
          status,
          verifiedAt: status === 'VERIFIED' ? new Date() : null,
        },
      });
    }
  }

  /**
   * Grant verification badge to user
   */
  private async grantVerificationBadge(
    userId: string,
    inquiryId: string,
    verificationType: VerificationType
  ): Promise<VerificationBadge | null> {
    const personaService = getPersonaService();

    // Map verification type to badge level
    const levelMap: Record<VerificationType, VerificationLevel> = {
      BASIC: 'BASIC',
      GOVERNMENT_ID: 'BASIC',
      ADDRESS: 'BASIC',
      ENHANCED: 'ENHANCED',
      PREMIUM: 'PREMIUM',
    };

    const level = levelMap[verificationType];
    if (!level) return null;

    const expiresAt = personaService.getBadgeExpiryDate();

    // Deactivate any existing badge at same level
    await this.prisma.userVerificationBadge.updateMany({
      where: {
        userId,
        level,
        isActive: true,
      },
      data: {
        isActive: false,
        revokedReason: 'Superseded by new verification',
      },
    });

    // Create new badge
    const badge = await this.prisma.userVerificationBadge.create({
      data: {
        userId,
        inquiryId,
        level,
        expiresAt,
        isActive: true,
        displayOnProfile: true,
      },
    });

    // Update the inquiry with the verification level
    await this.prisma.verificationInquiry.update({
      where: { id: inquiryId },
      data: { verificationLevel: level },
    });

    logger.info(
      {
        userId,
        inquiryId,
        level,
        expiresAt,
      },
      'Verification badge granted'
    );

    return {
      id: badge.id,
      level: badge.level,
      grantedAt: badge.grantedAt,
      expiresAt: badge.expiresAt,
      isActive: badge.isActive,
    };
  }

  /**
   * Update user's overall verification level
   */
  private async updateUserVerificationLevel(userId: string): Promise<void> {
    // Get highest active badge
    const highestBadge = await this.prisma.userVerificationBadge.findFirst({
      where: {
        userId,
        isActive: true,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { level: 'desc' },
    });

    const newLevel: VerificationLevel = highestBadge?.level ?? 'NONE';

    await this.prisma.user.update({
      where: { id: userId },
      data: { verificationLevel: newLevel },
    });

    logger.info(
      {
        userId,
        level: newLevel,
      },
      'User verification level updated'
    );
  }

  /**
   * Revoke a verification badge
   */
  async revokeBadge(badgeId: string, reason: string, revokedBy: string): Promise<void> {
    const badge = await this.prisma.userVerificationBadge.findUnique({
      where: { id: badgeId },
    });

    if (!badge || !badge.isActive) {
      throw new VerificationError('Badge not found or already revoked', 'BADGE_NOT_FOUND');
    }

    await this.prisma.userVerificationBadge.update({
      where: { id: badgeId },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });

    // Update user's verification level
    await this.updateUserVerificationLevel(badge.userId);

    logger.warn(
      {
        badgeId,
        userId: badge.userId,
        reason,
        revokedBy,
      },
      'Verification badge revoked'
    );
  }

  /**
   * Manual review approval
   */
  async approveInquiry(inquiryId: string, reviewerId: string, notes?: string): Promise<void> {
    const personaService = getPersonaService();

    const inquiry = await this.prisma.verificationInquiry.findUnique({
      where: { id: inquiryId },
    });

    if (!inquiry) {
      throw new VerificationError('Inquiry not found', 'INQUIRY_NOT_FOUND');
    }

    if (inquiry.status !== 'NEEDS_REVIEW') {
      throw new VerificationError('Inquiry is not pending review', 'INVALID_STATE');
    }

    // Approve in Persona
    await personaService.approveInquiry(inquiry.personaInquiryId);

    // Update local record
    await this.prisma.verificationInquiry.update({
      where: { id: inquiryId },
      data: {
        status: 'APPROVED',
        completedAt: new Date(),
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNotes: notes ?? null,
      },
    });

    // Grant badge
    const badge = await this.grantVerificationBadge(
      inquiry.userId,
      inquiry.id,
      inquiry.verificationType
    );

    if (badge) {
      await this.updateUserVerificationLevel(inquiry.userId);
    }

    logger.info(
      {
        inquiryId,
        reviewerId,
        userId: inquiry.userId,
      },
      'Inquiry manually approved'
    );
  }

  /**
   * Manual review rejection
   */
  async declineInquiry(
    inquiryId: string,
    reviewerId: string,
    reasons: string[],
    notes?: string
  ): Promise<void> {
    const personaService = getPersonaService();

    const inquiry = await this.prisma.verificationInquiry.findUnique({
      where: { id: inquiryId },
    });

    if (!inquiry) {
      throw new VerificationError('Inquiry not found', 'INQUIRY_NOT_FOUND');
    }

    if (inquiry.status !== 'NEEDS_REVIEW') {
      throw new VerificationError('Inquiry is not pending review', 'INVALID_STATE');
    }

    // Decline in Persona
    await personaService.declineInquiry(inquiry.personaInquiryId);

    // Update local record
    await this.prisma.verificationInquiry.update({
      where: { id: inquiryId },
      data: {
        status: 'DECLINED',
        completedAt: new Date(),
        failureReasons: reasons,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNotes: notes ?? null,
      },
    });

    logger.info(
      {
        inquiryId,
        reviewerId,
        userId: inquiry.userId,
        reasons,
      },
      'Inquiry manually declined'
    );
  }

  /**
   * Request data redaction (GDPR)
   */
  async redactVerificationData(userId: string): Promise<void> {
    const personaService = getPersonaService();

    // Get all user's inquiries
    const inquiries = await this.prisma.verificationInquiry.findMany({
      where: { userId },
    });

    // Redact in Persona
    for (const inquiry of inquiries) {
      try {
        await personaService.redactInquiry(inquiry.personaInquiryId);
      } catch (error) {
        logger.error(
          {
            inquiryId: inquiry.id,
            personaInquiryId: inquiry.personaInquiryId,
            error,
          },
          'Failed to redact inquiry in Persona'
        );
      }
    }

    // Mark local records as redacted (we can't delete due to audit requirements)
    await this.prisma.verificationInquiry.updateMany({
      where: { userId },
      data: {
        reviewNotes: '[REDACTED PER USER REQUEST]',
        failureReasons: [],
      },
    });

    // Delete verification documents (they don't contain PII but might have references)
    await this.prisma.verificationDocument.deleteMany({
      where: {
        inquiry: { userId },
      },
    });

    logger.info({ userId }, 'User verification data redacted');
  }

  /**
   * Check if user can start verification
   */
  async canStartVerification(
    userId: string,
    verificationType: 'BASIC' | 'ENHANCED' | 'PREMIUM'
  ): Promise<{
    canStart: boolean;
    reason?: string;
    cooldownUntil?: Date;
  }> {
    // Check for existing active badge at or above this level
    const existingBadge = await this.prisma.userVerificationBadge.findFirst({
      where: {
        userId,
        isActive: true,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        level: {
          in: this.getLevelsAtOrAbove(verificationType),
        },
      },
    });

    if (existingBadge) {
      return {
        canStart: false,
        reason: `Already verified at ${existingBadge.level} level`,
      };
    }

    // Check for recent failed attempts (cooldown period)
    const recentDeclined = await this.prisma.verificationInquiry.findFirst({
      where: {
        userId,
        verificationType: verificationType as VerificationType,
        status: 'DECLINED',
        completedAt: {
          gt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      orderBy: { completedAt: 'desc' },
    });

    if (recentDeclined && recentDeclined.completedAt) {
      const cooldownUntil = new Date(recentDeclined.completedAt.getTime() + 24 * 60 * 60 * 1000);
      return {
        canStart: false,
        reason: 'Please wait 24 hours after a declined verification before trying again',
        cooldownUntil,
      };
    }

    // Check for pending inquiry
    const pendingInquiry = await this.prisma.verificationInquiry.findFirst({
      where: {
        userId,
        verificationType: verificationType as VerificationType,
        status: { in: ['PENDING', 'IN_PROGRESS', 'NEEDS_REVIEW'] },
      },
    });

    if (pendingInquiry) {
      return {
        canStart: false,
        reason: 'You have a pending verification. Please complete or wait for it to expire.',
      };
    }

    return { canStart: true };
  }

  /**
   * Get verification levels at or above a given type
   */
  private getLevelsAtOrAbove(
    verificationType: 'BASIC' | 'ENHANCED' | 'PREMIUM'
  ): VerificationLevel[] {
    const allLevels: VerificationLevel[] = ['BASIC', 'ENHANCED', 'PREMIUM'];
    const typeToLevel: Record<'BASIC' | 'ENHANCED' | 'PREMIUM', VerificationLevel> = {
      BASIC: 'BASIC',
      ENHANCED: 'ENHANCED',
      PREMIUM: 'PREMIUM',
    };

    const targetLevel = typeToLevel[verificationType];
    const targetIndex = allLevels.indexOf(targetLevel);

    return allLevels.slice(targetIndex);
  }

  /**
   * Map Persona document type to our enum
   */
  private mapDocumentType(personaType: string | null): DocumentType | null {
    if (!personaType) return null;

    const typeMap: Record<string, DocumentType> = {
      pp: 'PASSPORT',
      dl: 'DRIVERS_LICENSE',
      id: 'NATIONAL_ID',
      rp: 'RESIDENCE_PERMIT',
      utility_bill: 'UTILITY_BILL',
      bank_statement: 'BANK_STATEMENT',
      tax_document: 'TAX_DOCUMENT',
    };

    return typeMap[personaType.toLowerCase()] ?? 'OTHER';
  }

  /**
   * Map Persona document status to our enum
   */
  private mapDocumentStatus(personaStatus: string): DocumentStatus {
    const statusMap: Record<string, DocumentStatus> = {
      initiated: 'PENDING',
      submitted: 'PENDING',
      processed: 'VERIFIED',
      errored: 'REJECTED',
    };

    return statusMap[personaStatus] ?? 'PENDING';
  }
}

// =============================================================================
// ERROR CLASS
// =============================================================================

export class VerificationError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'VerificationError';
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createVerificationService(prisma: PrismaClient): VerificationService {
  return new VerificationService(prisma);
}
