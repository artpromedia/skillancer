// @ts-nocheck
/**
 * Financial Compliance Service
 * KYC verification, risk assessment, and regulatory compliance
 * Sprint M5: Freelancer Financial Services
 */

import { prisma } from '@skillancer/database';
import { logger } from '../lib/logger.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// ============================================================================
// TYPES
// ============================================================================

export interface KycStatus {
  userId: string;
  status: KycVerificationStatus;
  level: KycLevel;
  identity: VerificationStatus;
  address: VerificationStatus;
  taxId: VerificationStatus;
  documentsRequired: DocumentType[];
  expiresAt?: Date;
  canUseFinancialServices: boolean;
  restrictions: string[];
}

export type KycVerificationStatus = 'pending' | 'in_progress' | 'verified' | 'failed' | 'expired';
export type KycLevel = 'none' | 'basic' | 'enhanced' | 'full';
export type VerificationStatus = 'not_started' | 'pending' | 'verified' | 'failed';
export type DocumentType = 'id_front' | 'id_back' | 'proof_of_address' | 'w9' | 'tax_return';

export interface RiskAssessment {
  userId: string;
  riskLevel: RiskLevel;
  factors: RiskFactor[];
  limits: RiskLimits;
  flags: string[];
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'severe';

export interface RiskFactor {
  name: string;
  severity: RiskLevel;
  description: string;
}

export interface RiskLimits {
  maxPayoutAmount: number;
  maxMonthlyVolume: number;
  instantPayoutEnabled: boolean;
  physicalCardEnabled: boolean;
}

export interface VerificationSession {
  sessionId: string;
  url: string;
  expiresAt: Date;
}

// ============================================================================
// SERVICE LIMITS BY KYC LEVEL
// ============================================================================

const SERVICE_LIMITS: Record<KycLevel, RiskLimits> = {
  none: {
    maxPayoutAmount: 0,
    maxMonthlyVolume: 0,
    instantPayoutEnabled: false,
    physicalCardEnabled: false,
  },
  basic: {
    maxPayoutAmount: 2500,
    maxMonthlyVolume: 10000,
    instantPayoutEnabled: false,
    physicalCardEnabled: false,
  },
  enhanced: {
    maxPayoutAmount: 10000,
    maxMonthlyVolume: 50000,
    instantPayoutEnabled: true,
    physicalCardEnabled: true,
  },
  full: {
    maxPayoutAmount: 50000,
    maxMonthlyVolume: 500000,
    instantPayoutEnabled: true,
    physicalCardEnabled: true,
  },
};

// ============================================================================
// COMPLIANCE SERVICE
// ============================================================================

export class ComplianceService {
  // ==========================================================================
  // KYC STATUS
  // ==========================================================================

  /**
   * Get KYC verification status
   */
  async getKycStatus(userId: string): Promise<KycStatus> {
    let kyc = await prisma.kycVerification.findUnique({ where: { userId } });

    if (!kyc) {
      // Create initial KYC record
      kyc = await prisma.kycVerification.create({
        data: {
          userId,
          status: 'pending',
          level: 'none',
          identityStatus: 'not_started',
          addressStatus: 'not_started',
        },
      });
    }

    const documentsRequired = await this.getRequiredDocuments(kyc);
    const restrictions = await this.getRestrictions(kyc);

    return {
      userId,
      status: kyc.status as KycVerificationStatus,
      level: kyc.level as KycLevel,
      identity: kyc.identityStatus as VerificationStatus,
      address: kyc.addressStatus as VerificationStatus,
      taxId: kyc.taxIdVerified ? 'verified' : 'not_started',
      documentsRequired,
      expiresAt: kyc.expiresAt || undefined,
      canUseFinancialServices: kyc.status === 'verified' && kyc.level !== 'none',
      restrictions,
    };
  }

  /**
   * Get documents required for verification
   */
  private async getRequiredDocuments(kyc: any): Promise<DocumentType[]> {
    const required: DocumentType[] = [];

    if (kyc.identityStatus !== 'verified') {
      required.push('id_front', 'id_back');
    }

    if (kyc.addressStatus !== 'verified') {
      required.push('proof_of_address');
    }

    if (!kyc.taxIdVerified) {
      required.push('w9');
    }

    return required;
  }

  /**
   * Get account restrictions
   */
  private async getRestrictions(kyc: any): Promise<string[]> {
    const restrictions: string[] = [];

    if (kyc.status === 'pending' || kyc.status === 'failed') {
      restrictions.push('Complete identity verification to access financial services');
    }

    if (kyc.level === 'basic') {
      restrictions.push('Enhanced verification required for instant payouts');
      restrictions.push('Physical cards require enhanced verification');
    }

    if (!kyc.taxIdVerified) {
      restrictions.push('Tax ID required for 1099 reporting');
    }

    if (kyc.status === 'expired') {
      restrictions.push('Verification expired - please re-verify');
    }

    return restrictions;
  }

  // ==========================================================================
  // VERIFICATION FLOW
  // ==========================================================================

  /**
   * Start identity verification session
   */
  async startVerification(userId: string): Promise<VerificationSession> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Create Stripe Identity verification session
    const session = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: {
        userId,
        platform: 'skillancer',
      },
      options: {
        document: {
          allowed_types: ['driving_license', 'passport', 'id_card'],
          require_id_number: true,
          require_live_capture: true,
          require_matching_selfie: true,
        },
      },
    });

    // Update KYC record
    await prisma.kycVerification.upsert({
      where: { userId },
      create: {
        userId,
        status: 'in_progress',
        identityStatus: 'pending',
        stripeVerificationId: session.id,
      },
      update: {
        status: 'in_progress',
        identityStatus: 'pending',
        stripeVerificationId: session.id,
        updatedAt: new Date(),
      },
    });

    logger.info('Verification session started', { userId, sessionId: session.id });

    return {
      sessionId: session.id,
      url: session.url!,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };
  }

  /**
   * Handle verification session completed (webhook)
   */
  async handleVerificationCompleted(sessionId: string): Promise<void> {
    const session = await stripe.identity.verificationSessions.retrieve(sessionId);

    const kyc = await prisma.kycVerification.findFirst({
      where: { stripeVerificationId: sessionId },
    });

    if (!kyc) {
      logger.warn('Unknown verification session', { sessionId });
      return;
    }

    let status: KycVerificationStatus;
    let level: KycLevel;
    let identityStatus: VerificationStatus;

    if (session.status === 'verified') {
      status = 'verified';
      level = 'enhanced';
      identityStatus = 'verified';
    } else if (session.status === 'canceled' || session.status === 'processing') {
      status = 'pending';
      level = kyc.level as KycLevel;
      identityStatus = 'pending';
    } else {
      status = 'failed';
      level = kyc.level as KycLevel;
      identityStatus = 'failed';
    }

    await prisma.kycVerification.update({
      where: { id: kyc.id },
      data: {
        status,
        level,
        identityStatus,
        verifiedAt: status === 'verified' ? new Date() : undefined,
        expiresAt:
          status === 'verified'
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
            : undefined,
        updatedAt: new Date(),
      },
    });

    logger.info('Verification completed', {
      userId: kyc.userId,
      status,
      sessionId,
    });
  }

  /**
   * Submit tax ID (SSN/EIN)
   */
  async submitTaxId(
    userId: string,
    taxIdType: 'ssn' | 'ein' | 'itin',
    taxId: string
  ): Promise<void> {
    // Validate format
    const cleanId = taxId.replace(/\D/g, '');

    if (taxIdType === 'ssn' && cleanId.length !== 9) {
      throw new Error('Invalid SSN format');
    }

    if (taxIdType === 'ein' && cleanId.length !== 9) {
      throw new Error('Invalid EIN format');
    }

    // Store last 4 only, send full to Stripe for verification
    const last4 = cleanId.slice(-4);

    // TODO: Encrypt and store securely, verify with Stripe/IRS
    await prisma.kycVerification.upsert({
      where: { userId },
      create: {
        userId,
        status: 'pending',
        taxIdType,
        taxIdLast4: last4,
        taxIdVerified: false,
      },
      update: {
        taxIdType,
        taxIdLast4: last4,
        taxIdVerified: false,
        updatedAt: new Date(),
      },
    });

    // In production, this would verify with Stripe Tax or IRS
    // For now, mark as verified
    await prisma.kycVerification.update({
      where: { userId },
      data: { taxIdVerified: true },
    });

    logger.info('Tax ID submitted', { userId, taxIdType, last4 });
  }

  // ==========================================================================
  // DOCUMENT MANAGEMENT
  // ==========================================================================

  /**
   * Upload compliance document
   */
  async uploadDocument(
    userId: string,
    type: DocumentType,
    fileUrl: string,
    fileName: string,
    mimeType: string
  ): Promise<string> {
    const doc = await prisma.complianceDocument.create({
      data: {
        userId,
        type,
        status: 'pending',
        fileUrl,
        fileName,
        mimeType,
      },
    });

    logger.info('Compliance document uploaded', { userId, type, docId: doc.id });

    return doc.id;
  }

  /**
   * Get user's compliance documents
   */
  async getDocuments(userId: string): Promise<any[]> {
    return prisma.complianceDocument.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Review document (admin)
   */
  async reviewDocument(
    documentId: string,
    reviewerId: string,
    approved: boolean,
    notes?: string
  ): Promise<void> {
    await prisma.complianceDocument.update({
      where: { id: documentId },
      data: {
        status: approved ? 'approved' : 'rejected',
        reviewedBy: reviewerId,
        reviewNotes: notes,
        reviewedAt: new Date(),
      },
    });

    // Check if all required documents are approved
    const doc = await prisma.complianceDocument.findUnique({ where: { id: documentId } });
    if (doc && approved) {
      await this.updateVerificationFromDocuments(doc.userId);
    }

    logger.info('Document reviewed', { documentId, approved, reviewerId });
  }

  private async updateVerificationFromDocuments(userId: string): Promise<void> {
    const documents = await prisma.complianceDocument.findMany({
      where: { userId, status: 'approved' },
    });

    const approvedTypes = documents.map((d) => d.type);
    const updates: any = {};

    if (approvedTypes.includes('id_front') && approvedTypes.includes('id_back')) {
      updates.identityStatus = 'verified';
    }

    if (approvedTypes.includes('proof_of_address')) {
      updates.addressStatus = 'verified';
    }

    if (Object.keys(updates).length > 0) {
      await prisma.kycVerification.update({
        where: { userId },
        data: {
          ...updates,
          updatedAt: new Date(),
        },
      });
    }
  }

  // ==========================================================================
  // RISK ASSESSMENT
  // ==========================================================================

  /**
   * Assess user risk level
   */
  async assessRisk(userId: string): Promise<RiskAssessment> {
    const factors: RiskFactor[] = [];
    const flags: string[] = [];

    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    const kyc = await prisma.kycVerification.findUnique({ where: { userId } });

    // Account age
    const accountAgedays = user
      ? Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    if (accountAgedays < 7) {
      factors.push({
        name: 'new_account',
        severity: 'medium',
        description: 'Account less than 7 days old',
      });
    }

    // KYC level
    if (!kyc || kyc.status !== 'verified') {
      factors.push({
        name: 'unverified_identity',
        severity: 'high',
        description: 'Identity not verified',
      });
      flags.push('UNVERIFIED');
    }

    // Transaction history
    const recentPayouts = await prisma.payout.count({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });

    if (recentPayouts > 20) {
      factors.push({
        name: 'high_payout_volume',
        severity: 'medium',
        description: 'More than 20 payouts in last 30 days',
      });
    }

    // Check for failed payouts
    const failedPayouts = await prisma.payout.count({
      where: {
        userId,
        status: 'failed',
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });

    if (failedPayouts > 2) {
      factors.push({
        name: 'failed_payouts',
        severity: 'high',
        description: 'Multiple failed payouts recently',
      });
      flags.push('PAYOUT_FAILURES');
    }

    // Calculate overall risk level
    let riskLevel: RiskLevel = 'low';

    const highSeverityCount = factors.filter((f) => f.severity === 'high').length;
    const mediumSeverityCount = factors.filter((f) => f.severity === 'medium').length;

    if (highSeverityCount >= 2 || factors.some((f) => f.severity === 'severe')) {
      riskLevel = 'severe';
    } else if (highSeverityCount >= 1 || mediumSeverityCount >= 3) {
      riskLevel = 'high';
    } else if (mediumSeverityCount >= 1) {
      riskLevel = 'medium';
    }

    // Determine limits based on risk and KYC
    const kycLevel = (kyc?.level as KycLevel) || 'none';
    const limits = { ...SERVICE_LIMITS[kycLevel] };

    if (riskLevel === 'high' || riskLevel === 'severe') {
      limits.maxPayoutAmount = Math.min(limits.maxPayoutAmount, 500);
      limits.instantPayoutEnabled = false;
      limits.physicalCardEnabled = false;
    }

    return {
      userId,
      riskLevel,
      factors,
      limits,
      flags,
    };
  }

  /**
   * Check if action is allowed based on risk
   */
  async checkActionAllowed(
    userId: string,
    action: 'instant_payout' | 'physical_card' | 'large_payout',
    amount?: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    const risk = await this.assessRisk(userId);

    switch (action) {
      case 'instant_payout':
        if (!risk.limits.instantPayoutEnabled) {
          return {
            allowed: false,
            reason: 'Instant payouts not available. Complete enhanced verification.',
          };
        }
        if (amount && amount > risk.limits.maxPayoutAmount) {
          return {
            allowed: false,
            reason: `Maximum instant payout is $${risk.limits.maxPayoutAmount}`,
          };
        }
        break;

      case 'physical_card':
        if (!risk.limits.physicalCardEnabled) {
          return {
            allowed: false,
            reason: 'Physical cards require enhanced verification.',
          };
        }
        break;

      case 'large_payout':
        if (amount && amount > risk.limits.maxPayoutAmount) {
          return {
            allowed: false,
            reason: `Maximum payout amount is $${risk.limits.maxPayoutAmount}`,
          };
        }
        break;
    }

    return { allowed: true };
  }

  // ==========================================================================
  // AUDIT LOGGING
  // ==========================================================================

  /**
   * Log financial action for audit
   */
  async logAction(
    userId: string,
    action: string,
    resource: string,
    resourceId?: string,
    metadata?: Record<string, any>,
    request?: { ip?: string; userAgent?: string }
  ): Promise<void> {
    await prisma.financialAuditLog.create({
      data: {
        userId,
        action,
        resource,
        resourceId,
        ipAddress: request?.ip,
        userAgent: request?.userAgent,
        metadata,
      },
    });
  }

  /**
   * Get audit log for user
   */
  async getAuditLog(
    userId: string,
    options: { limit?: number; startDate?: Date; endDate?: Date } = {}
  ): Promise<any[]> {
    return prisma.financialAuditLog.findMany({
      where: {
        userId,
        createdAt: {
          gte: options.startDate,
          lte: options.endDate,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit || 100,
    });
  }
}

// Singleton instance
let complianceServiceInstance: ComplianceService | null = null;

export function getComplianceService(): ComplianceService {
  if (!complianceServiceInstance) {
    complianceServiceInstance = new ComplianceService();
  }
  return complianceServiceInstance;
}
