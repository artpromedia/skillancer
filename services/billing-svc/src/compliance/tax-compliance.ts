// @ts-nocheck
/**
 * Tax Compliance Service
 * 1099 reporting, IRS filing, and tax record compliance
 * Sprint M6: Invoice Financing & Advanced Tax Tools
 */

import { createLogger } from '../lib/logger.js';

const logger = createLogger({ serviceName: 'tax-compliance' });

// ============================================================================
// TYPES
// ============================================================================

export interface TINValidation {
  tin: string;
  name: string;
  valid: boolean;
  matchCode: 'match' | 'mismatch' | 'not_found' | 'pending';
  lastChecked: Date;
}

export interface FilingDeadline {
  formType: '1099-K' | '1099-NEC' | '1099-MISC';
  year: number;
  recipientDeadline: Date;
  irsDeadline: Date;
  correctionDeadline: Date;
}

export interface BNotice {
  userId: string;
  tinType: 'ssn' | 'ein';
  noticeType: 'first' | 'second';
  receivedDate: Date;
  responseDeadline: Date;
  resolved: boolean;
}

export interface BackupWithholding {
  userId: string;
  rate: number;
  startDate: Date;
  reason: 'b_notice' | 'tin_mismatch' | 'unreported_income';
  active: boolean;
}

export interface StateFilingRequirement {
  state: string;
  threshold: number;
  formType: string;
  filingDeadline: Date;
  required: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// 1099-K threshold (post-2024)
const FORM_1099K_THRESHOLD = 600;

// 1099-NEC threshold
const FORM_1099NEC_THRESHOLD = 600;

// Backup withholding rate (current IRS rate)
const BACKUP_WITHHOLDING_RATE = 0.24; // 24%

// Record retention period (IRS requirement)
const RECORD_RETENTION_YEARS = 7;

// Filing deadlines (typical year)
const DEADLINES = {
  recipientDeadline: { month: 1, day: 31 }, // Jan 31
  irsElectronicDeadline: { month: 3, day: 31 }, // Mar 31
  irsPaperDeadline: { month: 2, day: 28 }, // Feb 28
};

// States requiring 1099 reporting (Combined Federal/State Filing Program)
const CF_SF_STATES = new Set([
  'AL',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'GA',
  'HI',
  'ID',
  'IN',
  'KS',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NJ',
  'NM',
  'NC',
  'ND',
  'OH',
  'OK',
  'SC',
  'WI',
]);

// States with independent filing requirements
const INDEPENDENT_FILING_STATES: Record<
  string,
  { threshold: number; deadline: { month: number; day: number } }
> = {
  CA: { threshold: 600, deadline: { month: 1, day: 31 } },
  NY: { threshold: 600, deadline: { month: 1, day: 31 } },
  PA: { threshold: 600, deadline: { month: 1, day: 31 } },
};

// ============================================================================
// TAX COMPLIANCE SERVICE
// ============================================================================

export class TaxComplianceService {
  // --------------------------------------------------------------------------
  // 1099 THRESHOLD TRACKING
  // --------------------------------------------------------------------------

  /**
   * Check if user meets 1099-K reporting threshold
   */
  async check1099KThreshold(
    userId: string,
    year: number
  ): Promise<{ meetsThreshold: boolean; amount: number; transactionCount: number }> {
    logger.info('Checking 1099-K threshold', { userId, year });

    // Get total payments received
    const { totalAmount, transactionCount } = await this.getYearlyPayments(userId, year);

    const meetsThreshold = totalAmount >= FORM_1099K_THRESHOLD;

    if (meetsThreshold) {
      logger.info('User meets 1099-K threshold', { userId, year, totalAmount });
      metrics.increment('compliance.1099k.threshold_met');
    }

    return {
      meetsThreshold,
      amount: totalAmount,
      transactionCount,
    };
  }

  /**
   * Get all users meeting 1099 threshold for a year
   */
  async getUsersMeeting1099Threshold(year: number): Promise<
    Array<{
      userId: string;
      amount: number;
      transactionCount: number;
    }>
  > {
    logger.info('Getting users meeting 1099 threshold', { year });
    // In production: Query database
    return [];
  }

  // --------------------------------------------------------------------------
  // TIN MATCHING
  // --------------------------------------------------------------------------

  /**
   * Validate TIN with IRS (TIN Matching Program)
   */
  async validateTIN(tin: string, name: string): Promise<TINValidation> {
    logger.info('Validating TIN', { tinLast4: tin.slice(-4) });

    // In production: Call IRS TIN Matching API
    // https://www.irs.gov/tax-professionals/taxpayer-identification-number-tin-matching

    // Stub response
    return {
      tin: tin.slice(-4).padStart(tin.length, '*'),
      name,
      valid: true,
      matchCode: 'pending',
      lastChecked: new Date(),
    };
  }

  /**
   * Handle TIN mismatch from IRS
   */
  async handleTINMismatch(userId: string, validation: TINValidation): Promise<void> {
    logger.warn('TIN mismatch detected', { userId, matchCode: validation.matchCode });

    // Create B-Notice if needed
    if (validation.matchCode === 'mismatch') {
      await this.createBNotice(userId, 'first');
      metrics.increment('compliance.tin.mismatch');
    }
  }

  // --------------------------------------------------------------------------
  // B-NOTICE HANDLING
  // --------------------------------------------------------------------------

  /**
   * Create a B-Notice for a user
   */
  async createBNotice(userId: string, type: 'first' | 'second'): Promise<BNotice> {
    const notice: BNotice = {
      userId,
      tinType: 'ssn',
      noticeType: type,
      receivedDate: new Date(),
      responseDeadline: this.calculateBNoticeDeadline(type),
      resolved: false,
    };

    logger.info('Created B-Notice', { userId, type });
    metrics.increment('compliance.b_notice.created', { type });

    // In production: Save to database and send notification
    return notice;
  }

  /**
   * Calculate B-Notice response deadline
   */
  private calculateBNoticeDeadline(type: 'first' | 'second'): Date {
    const deadline = new Date();
    // First B-Notice: 30 business days to respond
    // Second B-Notice: User must provide W-9 in person or certified mail
    deadline.setDate(deadline.getDate() + (type === 'first' ? 45 : 30));
    return deadline;
  }

  /**
   * Handle B-Notice response
   */
  async resolveBNotice(noticeId: string, newTIN: string): Promise<boolean> {
    logger.info('Resolving B-Notice', { noticeId });

    // Validate new TIN
    const validation = await this.validateTIN(newTIN, '');

    if (validation.matchCode === 'match') {
      // Update user's TIN and mark notice as resolved
      metrics.increment('compliance.b_notice.resolved');
      return true;
    }

    return false;
  }

  // --------------------------------------------------------------------------
  // BACKUP WITHHOLDING
  // --------------------------------------------------------------------------

  /**
   * Start backup withholding for a user
   */
  async startBackupWithholding(
    userId: string,
    reason: BackupWithholding['reason']
  ): Promise<BackupWithholding> {
    logger.warn('Starting backup withholding', { userId, reason });

    const withholding: BackupWithholding = {
      userId,
      rate: BACKUP_WITHHOLDING_RATE,
      startDate: new Date(),
      reason,
      active: true,
    };

    metrics.increment('compliance.backup_withholding.started', { reason });

    // In production: Save to database and update payment processing
    return withholding;
  }

  /**
   * Stop backup withholding
   */
  async stopBackupWithholding(userId: string): Promise<void> {
    logger.info('Stopping backup withholding', { userId });
    metrics.increment('compliance.backup_withholding.stopped');
  }

  /**
   * Calculate backup withholding amount
   */
  calculateWithholdingAmount(paymentAmount: number): number {
    return Math.round(paymentAmount * BACKUP_WITHHOLDING_RATE * 100) / 100;
  }

  // --------------------------------------------------------------------------
  // FILING DEADLINES
  // --------------------------------------------------------------------------

  /**
   * Get filing deadlines for a tax year
   */
  getFilingDeadlines(year: number): FilingDeadline {
    const nextYear = year + 1;

    return {
      formType: '1099-K',
      year,
      recipientDeadline: new Date(
        nextYear,
        DEADLINES.recipientDeadline.month - 1,
        DEADLINES.recipientDeadline.day
      ),
      irsDeadline: new Date(
        nextYear,
        DEADLINES.irsElectronicDeadline.month - 1,
        DEADLINES.irsElectronicDeadline.day
      ),
      correctionDeadline: new Date(nextYear, 3, 30), // April 30
    };
  }

  /**
   * Check if we're within filing window
   */
  isWithinFilingWindow(year: number): boolean {
    const deadlines = this.getFilingDeadlines(year);
    const now = new Date();
    return now >= new Date(year + 1, 0, 1) && now <= deadlines.correctionDeadline;
  }

  /**
   * Get days until deadline
   */
  getDaysUntilDeadline(year: number, deadlineType: 'recipient' | 'irs'): number {
    const deadlines = this.getFilingDeadlines(year);
    const deadline =
      deadlineType === 'recipient' ? deadlines.recipientDeadline : deadlines.irsDeadline;
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  // --------------------------------------------------------------------------
  // STATE COMPLIANCE
  // --------------------------------------------------------------------------

  /**
   * Get state filing requirements for a user
   */
  async getStateFilingRequirements(
    userId: string,
    year: number
  ): Promise<StateFilingRequirement[]> {
    logger.info('Getting state filing requirements', { userId, year });

    // Get user's state from profile
    const userState = await this.getUserState(userId);

    if (!userState) {
      return [];
    }

    const requirements: StateFilingRequirement[] = [];

    // Check if state is in CF/SF program
    if (CF_SF_STATES.has(userState)) {
      requirements.push({
        state: userState,
        threshold: FORM_1099K_THRESHOLD,
        formType: '1099-K',
        filingDeadline: this.getFilingDeadlines(year).irsDeadline,
        required: true,
      });
    }

    // Check independent filing states
    if (INDEPENDENT_FILING_STATES[userState]) {
      const stateReq = INDEPENDENT_FILING_STATES[userState];
      requirements.push({
        state: userState,
        threshold: stateReq.threshold,
        formType: 'State 1099',
        filingDeadline: new Date(year + 1, stateReq.deadline.month - 1, stateReq.deadline.day),
        required: true,
      });
    }

    return requirements;
  }

  // --------------------------------------------------------------------------
  // RECORD RETENTION
  // --------------------------------------------------------------------------

  /**
   * Check if records can be purged
   */
  canPurgeRecords(recordYear: number): boolean {
    const currentYear = new Date().getFullYear();
    return currentYear - recordYear > RECORD_RETENTION_YEARS;
  }

  /**
   * Get minimum retention date
   */
  getMinRetentionDate(): Date {
    const date = new Date();
    date.setFullYear(date.getFullYear() - RECORD_RETENTION_YEARS);
    return date;
  }

  /**
   * Get records due for retention review
   */
  async getRecordsDueForReview(): Promise<
    {
      year: number;
      recordCount: number;
      canPurge: boolean;
    }[]
  > {
    logger.info('Getting records due for retention review');
    // In production: Query database
    return [];
  }

  // --------------------------------------------------------------------------
  // AUDIT SUPPORT
  // --------------------------------------------------------------------------

  /**
   * Generate tax compliance report
   */
  async generateComplianceReport(year: number): Promise<{
    formsGenerated: number;
    formsFiled: number;
    bNoticesIssued: number;
    backupWithholdingAccounts: number;
    tinMatchRate: number;
  }> {
    logger.info('Generating tax compliance report', { year });

    // In production: Query metrics and database
    return {
      formsGenerated: 0,
      formsFiled: 0,
      bNoticesIssued: 0,
      backupWithholdingAccounts: 0,
      tinMatchRate: 0,
    };
  }

  // --------------------------------------------------------------------------
  // PRIVATE HELPERS
  // --------------------------------------------------------------------------

  private async getYearlyPayments(
    userId: string,
    year: number
  ): Promise<{ totalAmount: number; transactionCount: number }> {
    // In production: Query database
    return { totalAmount: 0, transactionCount: 0 };
  }

  private async getUserState(userId: string): Promise<string | null> {
    // In production: Query user profile
    return null;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let service: TaxComplianceService | null = null;

export function getTaxComplianceService(): TaxComplianceService {
  if (!service) {
    service = new TaxComplianceService();
  }
  return service;
}
