// @ts-nocheck
/**
 * Earnings Verifier
 * Payment and earnings verification with fraud detection
 * Sprint M4: Portable Verified Work History
 */

import { createLogger } from '@skillancer/logger';
import { prisma } from '@skillancer/database';
import { createHash } from 'crypto';
import {
  Platform,
  VerificationLevel,
  EarningsData,
  getConnector,
} from '../integrations/platform-connector';

const logger = createLogger('earnings-verifier');

// =============================================================================
// TYPES
// =============================================================================

export interface EarningsVerificationRequest {
  userId: string;
  platform: Platform;
  startDate?: Date;
  endDate?: Date;
}

export interface EarningsVerificationResult {
  platform: Platform;
  verified: boolean;
  totalEarnings: number;
  verifiedEarnings: number;
  currency: string;
  discrepancies: EarningsDiscrepancy[];
  fraudIndicators: FraudIndicator[];
  riskScore: number;
  verifiedAt: Date;
}

export interface EarningsDiscrepancy {
  type: 'missing' | 'mismatch' | 'duplicate' | 'suspicious';
  workHistoryId?: string;
  reportedAmount: number;
  verifiedAmount: number;
  difference: number;
  details: string;
}

export interface FraudIndicator {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  evidence: string;
}

export interface EarningsSummary {
  userId: string;
  totalVerifiedEarnings: number;
  totalUnverifiedEarnings: number;
  earningsByPlatform: PlatformEarnings[];
  earningsByYear: YearlyEarnings[];
  currency: string;
  lastVerifiedAt: Date | null;
}

export interface PlatformEarnings {
  platform: Platform;
  totalEarnings: number;
  verifiedEarnings: number;
  projectCount: number;
  verificationLevel: VerificationLevel;
}

export interface YearlyEarnings {
  year: number;
  totalEarnings: number;
  projectCount: number;
}

// =============================================================================
// FRAUD DETECTION RULES
// =============================================================================

const FRAUD_DETECTION_RULES = {
  // Unusually high hourly rate
  highHourlyRate: {
    threshold: 500, // USD
    severity: 'medium' as const,
    description: 'Hourly rate exceeds $500',
  },
  // Single project dominates earnings
  singleProjectDominance: {
    threshold: 0.9, // 90%
    severity: 'low' as const,
    description: 'Single project represents over 90% of earnings',
  },
  // Rapid earnings growth
  rapidGrowth: {
    threshold: 5, // 5x year-over-year
    severity: 'medium' as const,
    description: 'Earnings increased 5x+ year-over-year',
  },
  // Mismatched currency
  currencyMismatch: {
    severity: 'low' as const,
    description: 'Currency mismatch between reported and verified',
  },
  // Round number earnings
  roundNumberPattern: {
    threshold: 0.8, // 80% of projects
    severity: 'low' as const,
    description: 'Most projects have round number amounts',
  },
  // Zero-hour projects with high earnings
  zeroHourHighEarnings: {
    threshold: 1000,
    severity: 'high' as const,
    description: 'High earnings reported with zero hours worked',
  },
};

// =============================================================================
// EARNINGS VERIFIER
// =============================================================================

export class EarningsVerifier {
  // ---------------------------------------------------------------------------
  // VERIFICATION FLOW
  // ---------------------------------------------------------------------------

  /**
   * Verify earnings from a platform
   */
  async verifyPlatformEarnings(
    request: EarningsVerificationRequest
  ): Promise<EarningsVerificationResult> {
    logger.info(
      {
        userId: request.userId,
        platform: request.platform,
      },
      'Starting earnings verification'
    );

    // Get platform connection
    const connection = await prisma.platformConnection.findFirst({
      where: {
        userId: request.userId,
        platform: request.platform,
        isActive: true,
      },
    });

    if (!connection) {
      throw new Error('No active platform connection');
    }

    // Get work history for this platform
    const workHistory = await prisma.workHistory.findMany({
      where: {
        userId: request.userId,
        platform: request.platform,
        ...(request.startDate && { startDate: { gte: request.startDate } }),
        ...(request.endDate && { endDate: { lte: request.endDate } }),
      },
    });

    // Calculate totals from work history
    const reportedTotal = workHistory.reduce((sum, wh) => sum + (wh.earnings || 0), 0);

    // Fetch earnings from platform
    const platformEarnings = await this.fetchPlatformEarnings(
      request.userId,
      request.platform,
      connection
    );

    // Verify individual projects
    const discrepancies: EarningsDiscrepancy[] = [];
    let verifiedTotal = 0;

    for (const wh of workHistory) {
      const verification = await this.verifyProjectEarnings(wh, connection);

      if (verification.verified) {
        verifiedTotal += verification.amount;
      } else if (verification.discrepancy) {
        discrepancies.push(verification.discrepancy);
      }
    }

    // Run fraud detection
    const fraudIndicators = await this.detectFraud(workHistory, reportedTotal, platformEarnings);

    // Calculate risk score
    const riskScore = this.calculateRiskScore(discrepancies, fraudIndicators);

    const result: EarningsVerificationResult = {
      platform: request.platform,
      verified: discrepancies.length === 0 && riskScore < 30,
      totalEarnings: reportedTotal,
      verifiedEarnings: verifiedTotal,
      currency: platformEarnings?.currency || 'USD',
      discrepancies,
      fraudIndicators,
      riskScore,
      verifiedAt: new Date(),
    };

    // Store verification result
    await this.storeVerificationResult(request.userId, result);

    logger.info(
      {
        userId: request.userId,
        platform: request.platform,
        verified: result.verified,
        riskScore,
      },
      'Earnings verification complete'
    );

    return result;
  }

  // ---------------------------------------------------------------------------
  // PLATFORM EARNINGS FETCH
  // ---------------------------------------------------------------------------

  private async fetchPlatformEarnings(
    userId: string,
    platform: Platform,
    connection: any
  ): Promise<EarningsData | null> {
    try {
      const connector = getConnector(platform);

      if (!connector) {
        return null;
      }

      const token = {
        accessToken: connection.accessToken,
        refreshToken: connection.refreshToken,
        expiresAt: connection.tokenExpiresAt,
        tokenType: 'Bearer',
      };

      return await connector.fetchEarnings(token);
    } catch (error) {
      logger.warn({ error, platform }, 'Failed to fetch platform earnings');
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // PROJECT VERIFICATION
  // ---------------------------------------------------------------------------

  private async verifyProjectEarnings(
    workHistory: any,
    connection: any
  ): Promise<{
    verified: boolean;
    amount: number;
    discrepancy?: EarningsDiscrepancy;
  }> {
    // For platform-synced projects, verify against source
    if (workHistory.syncedFromPlatform && workHistory.platformProjectId) {
      try {
        const connector = getConnector(workHistory.platform);

        if (connector) {
          const token = {
            accessToken: connection.accessToken,
            refreshToken: connection.refreshToken,
            expiresAt: connection.tokenExpiresAt,
            tokenType: 'Bearer',
          };

          const result = await connector.verifyData(
            {
              platformProjectId: workHistory.platformProjectId,
              title: workHistory.title,
              earnings: workHistory.earnings,
              currency: workHistory.currency,
              startDate: workHistory.startDate,
              endDate: workHistory.endDate,
              status: workHistory.status,
              skills: workHistory.skills || [],
            },
            token
          );

          if (result.verified) {
            return {
              verified: true,
              amount: workHistory.earnings || 0,
            };
          }
        }
      } catch (error) {
        logger.warn({ error }, 'Project verification failed');
      }
    }

    // Manual entries or verification failed
    return {
      verified: false,
      amount: 0,
      discrepancy: {
        type: 'suspicious',
        workHistoryId: workHistory.id,
        reportedAmount: workHistory.earnings || 0,
        verifiedAmount: 0,
        difference: workHistory.earnings || 0,
        details: 'Could not verify project earnings',
      },
    };
  }

  // ---------------------------------------------------------------------------
  // FRAUD DETECTION
  // ---------------------------------------------------------------------------

  private async detectFraud(
    workHistory: any[],
    reportedTotal: number,
    platformEarnings: EarningsData | null
  ): Promise<FraudIndicator[]> {
    const indicators: FraudIndicator[] = [];

    // Check 1: High hourly rate
    for (const wh of workHistory) {
      if (wh.hoursWorked && wh.hoursWorked > 0) {
        const hourlyRate = (wh.earnings || 0) / wh.hoursWorked;

        if (hourlyRate > FRAUD_DETECTION_RULES.highHourlyRate.threshold) {
          indicators.push({
            type: 'high_hourly_rate',
            severity: FRAUD_DETECTION_RULES.highHourlyRate.severity,
            description: FRAUD_DETECTION_RULES.highHourlyRate.description,
            evidence: `Project "${wh.title}" has $${hourlyRate.toFixed(2)}/hr rate`,
          });
        }
      }
    }

    // Check 2: Single project dominance
    if (reportedTotal > 0) {
      for (const wh of workHistory) {
        const ratio = (wh.earnings || 0) / reportedTotal;

        if (
          ratio > FRAUD_DETECTION_RULES.singleProjectDominance.threshold &&
          workHistory.length > 1
        ) {
          indicators.push({
            type: 'single_project_dominance',
            severity: FRAUD_DETECTION_RULES.singleProjectDominance.severity,
            description: FRAUD_DETECTION_RULES.singleProjectDominance.description,
            evidence: `Project "${wh.title}" is ${(ratio * 100).toFixed(0)}% of total earnings`,
          });
        }
      }
    }

    // Check 3: Round number pattern
    const roundNumberCount = workHistory.filter((wh) => {
      const earnings = wh.earnings || 0;
      return earnings > 0 && earnings % 100 === 0;
    }).length;

    if (
      workHistory.length > 3 &&
      roundNumberCount / workHistory.length > FRAUD_DETECTION_RULES.roundNumberPattern.threshold
    ) {
      indicators.push({
        type: 'round_number_pattern',
        severity: FRAUD_DETECTION_RULES.roundNumberPattern.severity,
        description: FRAUD_DETECTION_RULES.roundNumberPattern.description,
        evidence: `${roundNumberCount}/${workHistory.length} projects have round amounts`,
      });
    }

    // Check 4: Zero hours with high earnings
    for (const wh of workHistory) {
      if (
        (!wh.hoursWorked || wh.hoursWorked === 0) &&
        (wh.earnings || 0) > FRAUD_DETECTION_RULES.zeroHourHighEarnings.threshold
      ) {
        indicators.push({
          type: 'zero_hour_high_earnings',
          severity: FRAUD_DETECTION_RULES.zeroHourHighEarnings.severity,
          description: FRAUD_DETECTION_RULES.zeroHourHighEarnings.description,
          evidence: `Project "${wh.title}" has $${wh.earnings} with no hours logged`,
        });
      }
    }

    // Check 5: Platform total mismatch
    if (platformEarnings && platformEarnings.totalEarnings) {
      const difference = Math.abs(reportedTotal - platformEarnings.totalEarnings);
      const threshold = platformEarnings.totalEarnings * 0.1; // 10% tolerance

      if (difference > threshold) {
        indicators.push({
          type: 'platform_mismatch',
          severity: 'medium',
          description: 'Reported earnings differ significantly from platform',
          evidence: `Reported: $${reportedTotal}, Platform: $${platformEarnings.totalEarnings}`,
        });
      }
    }

    return indicators;
  }

  // ---------------------------------------------------------------------------
  // RISK SCORING
  // ---------------------------------------------------------------------------

  private calculateRiskScore(
    discrepancies: EarningsDiscrepancy[],
    fraudIndicators: FraudIndicator[]
  ): number {
    let score = 0;

    // Discrepancies
    for (const d of discrepancies) {
      switch (d.type) {
        case 'mismatch':
          score += 15;
          break;
        case 'missing':
          score += 10;
          break;
        case 'duplicate':
          score += 25;
          break;
        case 'suspicious':
          score += 20;
          break;
      }
    }

    // Fraud indicators
    for (const f of fraudIndicators) {
      switch (f.severity) {
        case 'low':
          score += 5;
          break;
        case 'medium':
          score += 15;
          break;
        case 'high':
          score += 30;
          break;
      }
    }

    return Math.min(score, 100);
  }

  // ---------------------------------------------------------------------------
  // SUMMARY & AGGREGATION
  // ---------------------------------------------------------------------------

  /**
   * Get earnings summary across all platforms
   */
  async getEarningsSummary(userId: string): Promise<EarningsSummary> {
    // Get all work history
    const workHistory = await prisma.workHistory.findMany({
      where: { userId },
      orderBy: { startDate: 'desc' },
    });

    // Calculate by platform
    const platformMap = new Map<Platform, PlatformEarnings>();

    for (const wh of workHistory) {
      const platform = wh.platform as Platform;
      const existing = platformMap.get(platform) || {
        platform,
        totalEarnings: 0,
        verifiedEarnings: 0,
        projectCount: 0,
        verificationLevel: VerificationLevel.SELF_REPORTED,
      };

      existing.totalEarnings += wh.earnings || 0;
      existing.projectCount += 1;

      if (wh.verificationLevel !== VerificationLevel.SELF_REPORTED) {
        existing.verifiedEarnings += wh.earnings || 0;
      }

      // Use highest verification level
      if ((wh.verificationLevel as VerificationLevel) > existing.verificationLevel) {
        existing.verificationLevel = wh.verificationLevel as VerificationLevel;
      }

      platformMap.set(platform, existing);
    }

    // Calculate by year
    const yearMap = new Map<number, YearlyEarnings>();

    for (const wh of workHistory) {
      const year = new Date(wh.startDate).getFullYear();
      const existing = yearMap.get(year) || {
        year,
        totalEarnings: 0,
        projectCount: 0,
      };

      existing.totalEarnings += wh.earnings || 0;
      existing.projectCount += 1;

      yearMap.set(year, existing);
    }

    // Calculate totals
    let totalVerifiedEarnings = 0;
    let totalUnverifiedEarnings = 0;

    for (const wh of workHistory) {
      if (wh.verificationLevel !== VerificationLevel.SELF_REPORTED) {
        totalVerifiedEarnings += wh.earnings || 0;
      } else {
        totalUnverifiedEarnings += wh.earnings || 0;
      }
    }

    // Get last verification date
    const lastVerified = await prisma.earningsVerification.findFirst({
      where: { userId },
      orderBy: { verifiedAt: 'desc' },
    });

    return {
      userId,
      totalVerifiedEarnings,
      totalUnverifiedEarnings,
      earningsByPlatform: Array.from(platformMap.values()),
      earningsByYear: Array.from(yearMap.values()).sort((a, b) => b.year - a.year),
      currency: 'USD',
      lastVerifiedAt: lastVerified?.verifiedAt || null,
    };
  }

  // ---------------------------------------------------------------------------
  // DATABASE OPERATIONS
  // ---------------------------------------------------------------------------

  private async storeVerificationResult(
    userId: string,
    result: EarningsVerificationResult
  ): Promise<void> {
    await prisma.earningsVerification.create({
      data: {
        userId,
        platform: result.platform,
        verified: result.verified,
        totalEarnings: result.totalEarnings,
        verifiedEarnings: result.verifiedEarnings,
        currency: result.currency,
        discrepancies: result.discrepancies as any,
        fraudIndicators: result.fraudIndicators as any,
        riskScore: result.riskScore,
        verifiedAt: result.verifiedAt,
      },
    });
  }

  /**
   * Get verification history
   */
  async getVerificationHistory(userId: string, platform?: Platform): Promise<any[]> {
    return prisma.earningsVerification.findMany({
      where: {
        userId,
        ...(platform && { platform }),
      },
      orderBy: { verifiedAt: 'desc' },
      take: 10,
    });
  }
}

// Singleton instance
let verifierInstance: EarningsVerifier | null = null;

export function getEarningsVerifier(): EarningsVerifier {
  if (!verifierInstance) {
    verifierInstance = new EarningsVerifier();
  }
  return verifierInstance;
}

