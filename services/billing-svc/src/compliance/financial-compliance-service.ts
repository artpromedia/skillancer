// @ts-nocheck
/**
 * Financial Compliance Service
 * KYC, AML, and regulatory compliance for financial services
 * Sprint M5: Freelancer Financial Services
 */

import { createLogger } from '../lib/logger.js';
import Stripe from 'stripe';

const logger = createLogger({ serviceName: 'financial-compliance' });

// ============================================================================
// TYPES
// ============================================================================

export type KycStatus = 'pending' | 'verified' | 'failed' | 'expired';
export type KycLevel = 'basic' | 'enhanced' | 'full';
export type DocumentType = 'passport' | 'drivers_license' | 'national_id';
export type TaxIdType = 'ssn' | 'ein' | 'itin';

export interface KycVerification {
  userId: string;
  status: KycStatus;
  level: KycLevel;
  identityStatus: string;
  addressStatus: string;
  taxIdVerified: boolean;
  verifiedAt?: Date;
  expiresAt?: Date;
}

export interface VerificationResult {
  success: boolean;
  status: KycStatus;
  requirements?: string[];
  errors?: string[];
}

export interface TransactionRisk {
  score: number; // 0-100
  level: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
  requiresReview: boolean;
}

export interface AmlCheck {
  passed: boolean;
  watchlistHits: number;
  pepMatch: boolean;
  sanctionsMatch: boolean;
  adverseMedia: boolean;
}

// ============================================================================
// THRESHOLDS & LIMITS
// ============================================================================

const LIMITS = {
  dailyTransaction: 10000,
  weeklyTransaction: 50000,
  monthlyTransaction: 200000,
  singleTransaction: 5000,
  kycRequiredThreshold: 3000,
  enhancedKycThreshold: 10000,
  reportingThreshold: 10000, // CTR threshold
};

const RISK_THRESHOLDS = {
  low: 25,
  medium: 50,
  high: 75,
};

// ============================================================================
// FINANCIAL COMPLIANCE SERVICE
// ============================================================================

class FinancialComplianceService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-06-20',
    });
  }

  // --------------------------------------------------------------------------
  // KYC VERIFICATION
  // --------------------------------------------------------------------------

  async initiateKycVerification(
    userId: string,
    level: KycLevel = 'basic'
  ): Promise<{ verificationSessionId: string; url: string }> {
    logger.info('Initiating KYC verification', { userId, level });

    try {
      const session = await this.stripe.identity.verificationSessions.create({
        type: 'document',
        metadata: { userId, level },
        options: {
          document: {
            allowed_types: ['passport', 'driving_license', 'id_card'],
            require_id_number: level !== 'basic',
            require_matching_selfie: level === 'full',
          },
        },
      });

      metrics.increment('kyc.verification.initiated', { level });

      return {
        verificationSessionId: session.id,
        url: session.url!,
      };
    } catch (error) {
      logger.error('Failed to initiate KYC', { userId, error });
      throw error;
    }
  }

  async getKycStatus(userId: string): Promise<KycVerification | null> {
    // In production, fetch from database
    logger.info('Getting KYC status', { userId });

    return {
      userId,
      status: 'pending',
      level: 'basic',
      identityStatus: 'pending',
      addressStatus: 'pending',
      taxIdVerified: false,
    };
  }

  async handleVerificationResult(
    sessionId: string,
    status: 'verified' | 'requires_input' | 'canceled'
  ): Promise<VerificationResult> {
    logger.info('Handling verification result', { sessionId, status });

    try {
      const session = await this.stripe.identity.verificationSessions.retrieve(sessionId);
      const userId = session.metadata?.userId;

      if (status === 'verified') {
        metrics.increment('kyc.verification.completed', { status: 'success' });
        return { success: true, status: 'verified' };
      }

      const requirements = session.last_error?.code ? [session.last_error.code] : [];

      metrics.increment('kyc.verification.completed', { status: 'failed' });
      return {
        success: false,
        status: 'failed',
        requirements,
        errors: session.last_error ? [session.last_error.reason || 'Verification failed'] : [],
      };
    } catch (error) {
      logger.error('Failed to process verification result', { sessionId, error });
      throw error;
    }
  }

  async verifyTaxId(
    userId: string,
    taxIdType: TaxIdType,
    taxId: string
  ): Promise<{ verified: boolean; last4: string }> {
    logger.info('Verifying tax ID', { userId, taxIdType });

    // In production, use IRS TIN matching or third-party service
    const last4 = taxId.slice(-4);
    const verified = taxId.length === 9; // Basic validation

    metrics.increment('kyc.tax_id.verified', { type: taxIdType, verified: String(verified) });

    return { verified, last4 };
  }

  // --------------------------------------------------------------------------
  // TRANSACTION RISK ASSESSMENT
  // --------------------------------------------------------------------------

  async assessTransactionRisk(params: {
    userId: string;
    amount: number;
    type: 'payout' | 'deposit' | 'card_transaction';
    destination?: string;
    merchantCategory?: string;
  }): Promise<TransactionRisk> {
    const { userId, amount, type, destination, merchantCategory } = params;
    logger.info('Assessing transaction risk', { userId, amount, type });

    const flags: string[] = [];
    let score = 0;

    // Amount-based risk
    if (amount > LIMITS.singleTransaction) {
      score += 20;
      flags.push('high_value_transaction');
    }

    if (amount > LIMITS.reportingThreshold) {
      score += 30;
      flags.push('ctr_threshold_exceeded');
    }

    // Velocity checks (simplified - in production, query DB)
    const recentTransactions = await this.getRecentTransactionCount(userId);
    if (recentTransactions > 10) {
      score += 15;
      flags.push('high_velocity');
    }

    // New destination
    if (destination && !(await this.isKnownDestination(userId, destination))) {
      score += 10;
      flags.push('new_destination');
    }

    // High-risk merchant categories
    const highRiskMcc = ['7995', '6211', '6012']; // Gambling, securities, financial
    if (merchantCategory && highRiskMcc.includes(merchantCategory)) {
      score += 25;
      flags.push('high_risk_merchant');
    }

    // Determine risk level
    let level: TransactionRisk['level'];
    if (score < RISK_THRESHOLDS.low) level = 'low';
    else if (score < RISK_THRESHOLDS.medium) level = 'medium';
    else if (score < RISK_THRESHOLDS.high) level = 'high';
    else level = 'critical';

    const requiresReview = level === 'high' || level === 'critical';

    metrics.histogram('risk.transaction.score', score, { type, level });

    return { score, level, flags, requiresReview };
  }

  private async getRecentTransactionCount(userId: string): Promise<number> {
    // In production, query database for last 24h transactions
    return 5;
  }

  private async isKnownDestination(userId: string, destination: string): Promise<boolean> {
    // In production, check user's previous destinations
    return true;
  }

  // --------------------------------------------------------------------------
  // AML SCREENING
  // --------------------------------------------------------------------------

  async performAmlCheck(userId: string, name: string): Promise<AmlCheck> {
    logger.info('Performing AML check', { userId });

    // In production, integrate with AML provider (e.g., ComplyAdvantage, Chainalysis)
    const result: AmlCheck = {
      passed: true,
      watchlistHits: 0,
      pepMatch: false,
      sanctionsMatch: false,
      adverseMedia: false,
    };

    metrics.increment('aml.check.completed', { passed: String(result.passed) });

    return result;
  }

  async checkSanctionsList(params: {
    name: string;
    country?: string;
    dateOfBirth?: string;
  }): Promise<{ matched: boolean; matches: Array<{ list: string; score: number }> }> {
    // In production, check OFAC, EU, UN sanctions lists
    return { matched: false, matches: [] };
  }

  // --------------------------------------------------------------------------
  // TRANSACTION LIMITS
  // --------------------------------------------------------------------------

  async checkTransactionLimits(
    userId: string,
    amount: number,
    type: 'payout' | 'deposit'
  ): Promise<{ allowed: boolean; reason?: string; limit?: number }> {
    logger.info('Checking transaction limits', { userId, amount, type });

    // Single transaction limit
    if (amount > LIMITS.singleTransaction) {
      const kyc = await this.getKycStatus(userId);
      if (kyc?.level !== 'enhanced' && kyc?.level !== 'full') {
        return {
          allowed: false,
          reason: 'enhanced_kyc_required',
          limit: LIMITS.singleTransaction,
        };
      }
    }

    // In production, check daily/weekly/monthly totals from DB
    const dailyTotal = await this.getDailyTotal(userId, type);
    if (dailyTotal + amount > LIMITS.dailyTransaction) {
      return {
        allowed: false,
        reason: 'daily_limit_exceeded',
        limit: LIMITS.dailyTransaction,
      };
    }

    return { allowed: true };
  }

  private async getDailyTotal(userId: string, type: string): Promise<number> {
    // In production, sum today's transactions from database
    return 0;
  }

  // --------------------------------------------------------------------------
  // REPORTING
  // --------------------------------------------------------------------------

  async generateCtr(params: {
    userId: string;
    amount: number;
    transactionId: string;
    type: string;
  }): Promise<{ reportId: string; filed: boolean }> {
    // Currency Transaction Report for amounts > $10,000
    logger.info('Generating CTR', { ...params });

    if (params.amount < LIMITS.reportingThreshold) {
      return { reportId: '', filed: false };
    }

    // In production, file with FinCEN
    const reportId = `CTR-${Date.now()}`;

    metrics.increment('compliance.ctr.filed');

    return { reportId, filed: true };
  }

  async fileSar(params: {
    userId: string;
    description: string;
    transactionIds: string[];
    riskScore: number;
  }): Promise<{ sarId: string }> {
    // Suspicious Activity Report
    logger.info('Filing SAR', { userId: params.userId, riskScore: params.riskScore });

    // In production, file with FinCEN
    const sarId = `SAR-${Date.now()}`;

    metrics.increment('compliance.sar.filed');

    return { sarId };
  }

  // --------------------------------------------------------------------------
  // DOCUMENT MANAGEMENT
  // --------------------------------------------------------------------------

  async uploadComplianceDocument(params: {
    userId: string;
    type: 'id_front' | 'id_back' | 'proof_of_address' | 'w9' | 'tax_return';
    fileUrl: string;
    fileName: string;
    mimeType: string;
  }): Promise<{ documentId: string }> {
    logger.info('Uploading compliance document', {
      userId: params.userId,
      type: params.type,
    });

    // In production, save to database and trigger review
    const documentId = `DOC-${Date.now()}`;

    metrics.increment('compliance.document.uploaded', { type: params.type });

    return { documentId };
  }

  async reviewDocument(
    documentId: string,
    reviewerId: string,
    decision: 'approved' | 'rejected',
    notes?: string
  ): Promise<void> {
    logger.info('Reviewing document', { documentId, decision });

    // In production, update database
    metrics.increment('compliance.document.reviewed', { decision });
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let complianceService: FinancialComplianceService | null = null;

export function getFinancialComplianceService(): FinancialComplianceService {
  if (!complianceService) {
    complianceService = new FinancialComplianceService();
  }
  return complianceService;
}

