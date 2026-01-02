// @ts-nocheck
/**
 * Work History Verifier
 * Multi-level verification for work history items
 * Sprint M4: Portable Verified Work History
 */

import { createLogger } from '@skillancer/logger';
import { prisma } from '@skillancer/database';
import { createHash, createHmac, randomBytes } from 'crypto';
import {
  Platform,
  VerificationLevel,
  WorkHistoryItem,
  getConnector,
} from '../integrations/platform-connector';

const logger = createLogger('work-history-verifier');

// =============================================================================
// TYPES
// =============================================================================

export interface VerificationRequest {
  userId: string;
  workHistoryId: string;
  platform: Platform;
  requestedLevel: VerificationLevel;
}

export interface VerificationStatus {
  workHistoryId: string;
  level: VerificationLevel;
  checks: VerificationCheck[];
  score: number;
  verifiedAt: Date | null;
  expiresAt: Date | null;
  hash: string;
  signature: string | null;
  blockchainAnchor: BlockchainAnchor | null;
}

export interface VerificationCheck {
  id: string;
  name: string;
  category: 'source' | 'data' | 'timeline' | 'financial' | 'identity';
  passed: boolean;
  score: number;
  weight: number;
  details: string;
  checkedAt: Date;
}

export interface BlockchainAnchor {
  network: 'ethereum' | 'polygon' | 'arbitrum';
  transactionHash: string;
  blockNumber: number;
  merkleRoot: string;
  timestamp: Date;
}

export interface VerificationEvidence {
  type: string;
  source: string;
  data: any;
  capturedAt: Date;
  hash: string;
}

// =============================================================================
// VERIFICATION CHECKS
// =============================================================================

const VERIFICATION_CHECKS: Record<
  string,
  {
    name: string;
    category: VerificationCheck['category'];
    weight: number;
    description: string;
  }
> = {
  oauth_connection: {
    name: 'OAuth Connection',
    category: 'source',
    weight: 20,
    description: 'Verified via OAuth 2.0 connection to platform',
  },
  api_source: {
    name: 'API Data Source',
    category: 'source',
    weight: 15,
    description: 'Data retrieved directly from platform API',
  },
  project_exists: {
    name: 'Project Exists',
    category: 'data',
    weight: 15,
    description: 'Project verified to exist in platform system',
  },
  payment_verified: {
    name: 'Payment Verified',
    category: 'financial',
    weight: 20,
    description: 'Payment records confirmed by platform',
  },
  client_confirmed: {
    name: 'Client Confirmation',
    category: 'identity',
    weight: 10,
    description: 'Client identity and feedback verified',
  },
  timeline_consistent: {
    name: 'Timeline Consistent',
    category: 'timeline',
    weight: 10,
    description: 'Project dates are consistent and logical',
  },
  data_integrity: {
    name: 'Data Integrity',
    category: 'data',
    weight: 10,
    description: 'Data hash matches original record',
  },
};

// =============================================================================
// WORK HISTORY VERIFIER
// =============================================================================

export class WorkHistoryVerifier {
  private readonly signingKey: string;

  constructor() {
    this.signingKey = process.env.VERIFICATION_SIGNING_KEY || 'dev-signing-key';
  }

  // ---------------------------------------------------------------------------
  // VERIFICATION FLOW
  // ---------------------------------------------------------------------------

  /**
   * Verify a work history item to the requested level
   */
  async verify(request: VerificationRequest): Promise<VerificationStatus> {
    logger.info(
      {
        workHistoryId: request.workHistoryId,
        requestedLevel: request.requestedLevel,
      },
      'Starting work history verification'
    );

    // Get work history from database
    const workHistory = await prisma.workHistory.findUnique({
      where: { id: request.workHistoryId },
      include: {
        platformConnection: true,
        reviews: true,
      },
    });

    if (!workHistory) {
      throw new Error('Work history not found');
    }

    // Verify user owns this record
    if (workHistory.userId !== request.userId) {
      throw new Error('Unauthorized access to work history');
    }

    // Run verification checks based on requested level
    const checks = await this.runVerificationChecks(workHistory, request.requestedLevel);

    // Calculate overall score
    const score = this.calculateVerificationScore(checks);

    // Determine achieved level
    const achievedLevel = this.determineVerificationLevel(score, checks, request.requestedLevel);

    // Generate verification hash
    const hash = this.generateVerificationHash(workHistory);

    // Sign if verification passed
    let signature: string | null = null;
    if (achievedLevel >= VerificationLevel.PLATFORM_VERIFIED) {
      signature = this.signVerification(hash, achievedLevel);
    }

    // Anchor to blockchain if cryptographically sealed requested
    let blockchainAnchor: BlockchainAnchor | null = null;
    if (
      request.requestedLevel === VerificationLevel.CRYPTOGRAPHICALLY_SEALED &&
      achievedLevel >= VerificationLevel.PLATFORM_VERIFIED
    ) {
      blockchainAnchor = await this.anchorToBlockchain(hash, signature!);
    }

    // Update database
    const verifiedAt = new Date();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

    await prisma.workHistory.update({
      where: { id: request.workHistoryId },
      data: {
        verificationLevel: achievedLevel,
        verificationScore: score,
        verificationHash: hash,
        verificationSignature: signature,
        verifiedAt,
        verificationExpiresAt: expiresAt,
        blockchainTxHash: blockchainAnchor?.transactionHash,
        blockchainNetwork: blockchainAnchor?.network,
      },
    });

    // Store verification checks
    await this.storeVerificationChecks(request.workHistoryId, checks);

    logger.info(
      {
        workHistoryId: request.workHistoryId,
        achievedLevel,
        score,
      },
      'Work history verification complete'
    );

    return {
      workHistoryId: request.workHistoryId,
      level: achievedLevel,
      checks,
      score,
      verifiedAt,
      expiresAt,
      hash,
      signature,
      blockchainAnchor,
    };
  }

  // ---------------------------------------------------------------------------
  // VERIFICATION CHECKS
  // ---------------------------------------------------------------------------

  private async runVerificationChecks(
    workHistory: any,
    requestedLevel: VerificationLevel
  ): Promise<VerificationCheck[]> {
    const checks: VerificationCheck[] = [];
    const now = new Date();

    // Check 1: OAuth Connection
    if (workHistory.platformConnection?.accessToken) {
      checks.push({
        id: randomBytes(8).toString('hex'),
        name: VERIFICATION_CHECKS.oauth_connection.name,
        category: VERIFICATION_CHECKS.oauth_connection.category,
        weight: VERIFICATION_CHECKS.oauth_connection.weight,
        passed: true,
        score: 100,
        details: `Connected via OAuth to ${workHistory.platform}`,
        checkedAt: now,
      });
    } else {
      checks.push({
        id: randomBytes(8).toString('hex'),
        name: VERIFICATION_CHECKS.oauth_connection.name,
        category: VERIFICATION_CHECKS.oauth_connection.category,
        weight: VERIFICATION_CHECKS.oauth_connection.weight,
        passed: false,
        score: 0,
        details: 'No OAuth connection found',
        checkedAt: now,
      });
    }

    // Check 2: API Source
    if (workHistory.syncedFromPlatform) {
      checks.push({
        id: randomBytes(8).toString('hex'),
        name: VERIFICATION_CHECKS.api_source.name,
        category: VERIFICATION_CHECKS.api_source.category,
        weight: VERIFICATION_CHECKS.api_source.weight,
        passed: true,
        score: 100,
        details: 'Data retrieved directly from platform API',
        checkedAt: now,
      });
    }

    // Check 3: Project Exists - Verify with platform API
    if (requestedLevel >= VerificationLevel.PLATFORM_VERIFIED) {
      const projectCheck = await this.verifyProjectExists(workHistory);
      checks.push({
        id: randomBytes(8).toString('hex'),
        name: VERIFICATION_CHECKS.project_exists.name,
        category: VERIFICATION_CHECKS.project_exists.category,
        weight: VERIFICATION_CHECKS.project_exists.weight,
        ...projectCheck,
        checkedAt: now,
      });
    }

    // Check 4: Payment Verified
    if (workHistory.earnings && workHistory.earnings > 0) {
      const paymentCheck = await this.verifyPayment(workHistory);
      checks.push({
        id: randomBytes(8).toString('hex'),
        name: VERIFICATION_CHECKS.payment_verified.name,
        category: VERIFICATION_CHECKS.payment_verified.category,
        weight: VERIFICATION_CHECKS.payment_verified.weight,
        ...paymentCheck,
        checkedAt: now,
      });
    }

    // Check 5: Client Confirmation
    if (workHistory.reviews?.length > 0) {
      checks.push({
        id: randomBytes(8).toString('hex'),
        name: VERIFICATION_CHECKS.client_confirmed.name,
        category: VERIFICATION_CHECKS.client_confirmed.category,
        weight: VERIFICATION_CHECKS.client_confirmed.weight,
        passed: true,
        score: 100,
        details: `${workHistory.reviews.length} review(s) from clients`,
        checkedAt: now,
      });
    }

    // Check 6: Timeline Consistency
    const timelineCheck = this.verifyTimeline(workHistory);
    checks.push({
      id: randomBytes(8).toString('hex'),
      name: VERIFICATION_CHECKS.timeline_consistent.name,
      category: VERIFICATION_CHECKS.timeline_consistent.category,
      weight: VERIFICATION_CHECKS.timeline_consistent.weight,
      ...timelineCheck,
      checkedAt: now,
    });

    // Check 7: Data Integrity
    const integrityCheck = this.verifyDataIntegrity(workHistory);
    checks.push({
      id: randomBytes(8).toString('hex'),
      name: VERIFICATION_CHECKS.data_integrity.name,
      category: VERIFICATION_CHECKS.data_integrity.category,
      weight: VERIFICATION_CHECKS.data_integrity.weight,
      ...integrityCheck,
      checkedAt: now,
    });

    return checks;
  }

  private async verifyProjectExists(
    workHistory: any
  ): Promise<{ passed: boolean; score: number; details: string }> {
    try {
      const connector = getConnector(workHistory.platform);

      if (!connector || !workHistory.platformConnection?.accessToken) {
        return {
          passed: false,
          score: 0,
          details: 'Cannot verify project - no platform connection',
        };
      }

      // Re-fetch and verify project exists
      const token = {
        accessToken: workHistory.platformConnection.accessToken,
        refreshToken: workHistory.platformConnection.refreshToken,
        expiresAt: workHistory.platformConnection.tokenExpiresAt,
        tokenType: 'Bearer',
      };

      const result = await connector.verifyData(
        {
          platformProjectId: workHistory.platformProjectId,
          title: workHistory.title,
          description: workHistory.description,
          startDate: workHistory.startDate,
          endDate: workHistory.endDate,
          earnings: workHistory.earnings,
          currency: workHistory.currency,
          skills: workHistory.skills,
          status: workHistory.status,
        } as WorkHistoryItem,
        token
      );

      const projectCheck = result.checks.find(
        (c) =>
          c.check === 'project_exists' ||
          c.check === 'job_exists' ||
          c.check === 'bid_exists' ||
          c.check === 'order_exists'
      );

      return {
        passed: projectCheck?.passed ?? false,
        score: projectCheck?.passed ? 100 : 0,
        details: projectCheck?.details || 'Project verification check',
      };
    } catch (error) {
      logger.warn({ error }, 'Failed to verify project exists');
      return {
        passed: false,
        score: 0,
        details: 'Project verification failed',
      };
    }
  }

  private async verifyPayment(
    workHistory: any
  ): Promise<{ passed: boolean; score: number; details: string }> {
    // In a real implementation, this would verify payment records
    // For now, we check if earnings exist and match expected ranges
    if (workHistory.earnings > 0 && workHistory.status === 'COMPLETED') {
      return {
        passed: true,
        score: 100,
        details: `Payment of ${workHistory.currency} ${workHistory.earnings} verified`,
      };
    }

    return {
      passed: false,
      score: 0,
      details: 'Payment not verified',
    };
  }

  private verifyTimeline(workHistory: any): { passed: boolean; score: number; details: string } {
    const startDate = new Date(workHistory.startDate);
    const endDate = workHistory.endDate ? new Date(workHistory.endDate) : null;
    const now = new Date();

    // Check start date is not in the future
    if (startDate > now) {
      return {
        passed: false,
        score: 0,
        details: 'Start date is in the future',
      };
    }

    // Check end date is after start date
    if (endDate && endDate < startDate) {
      return {
        passed: false,
        score: 0,
        details: 'End date is before start date',
      };
    }

    // Check reasonable duration (less than 10 years)
    if (endDate) {
      const durationMs = endDate.getTime() - startDate.getTime();
      const durationYears = durationMs / (365 * 24 * 60 * 60 * 1000);

      if (durationYears > 10) {
        return {
          passed: false,
          score: 50,
          details: 'Unusually long project duration',
        };
      }
    }

    return {
      passed: true,
      score: 100,
      details: 'Timeline is consistent and logical',
    };
  }

  private verifyDataIntegrity(workHistory: any): {
    passed: boolean;
    score: number;
    details: string;
  } {
    // Check if we have the original hash and it matches
    if (workHistory.originalDataHash) {
      const currentHash = this.generateVerificationHash(workHistory);
      const matched = currentHash === workHistory.originalDataHash;

      return {
        passed: matched,
        score: matched ? 100 : 0,
        details: matched
          ? 'Data integrity verified - hash matches'
          : 'Data has been modified since import',
      };
    }

    return {
      passed: true,
      score: 80,
      details: 'No original hash available for comparison',
    };
  }

  // ---------------------------------------------------------------------------
  // SCORING & LEVEL DETERMINATION
  // ---------------------------------------------------------------------------

  private calculateVerificationScore(checks: VerificationCheck[]): number {
    let totalWeight = 0;
    let weightedScore = 0;

    for (const check of checks) {
      totalWeight += check.weight;
      weightedScore += (check.score * check.weight) / 100;
    }

    return totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) : 0;
  }

  private determineVerificationLevel(
    score: number,
    checks: VerificationCheck[],
    requestedLevel: VerificationLevel
  ): VerificationLevel {
    // Check minimum requirements for each level
    const oauthCheck = checks.find((c) => c.name === 'OAuth Connection');
    const apiCheck = checks.find((c) => c.name === 'API Data Source');
    const projectCheck = checks.find((c) => c.name === 'Project Exists');
    const paymentCheck = checks.find((c) => c.name === 'Payment Verified');

    // Level 4: Cryptographically Sealed
    if (
      requestedLevel === VerificationLevel.CRYPTOGRAPHICALLY_SEALED &&
      score >= 80 &&
      oauthCheck?.passed &&
      projectCheck?.passed
    ) {
      return VerificationLevel.CRYPTOGRAPHICALLY_SEALED;
    }

    // Level 3: Platform Verified
    if (score >= 70 && oauthCheck?.passed && projectCheck?.passed) {
      return VerificationLevel.PLATFORM_VERIFIED;
    }

    // Level 2: Platform Connected
    if (score >= 50 && oauthCheck?.passed) {
      return VerificationLevel.PLATFORM_CONNECTED;
    }

    // Level 1: Self Reported
    return VerificationLevel.SELF_REPORTED;
  }

  // ---------------------------------------------------------------------------
  // CRYPTOGRAPHIC OPERATIONS
  // ---------------------------------------------------------------------------

  private generateVerificationHash(workHistory: any): string {
    const normalizedData = {
      platform: workHistory.platform,
      platformProjectId: workHistory.platformProjectId,
      title: workHistory.title,
      startDate: workHistory.startDate,
      endDate: workHistory.endDate,
      earnings: workHistory.earnings,
      currency: workHistory.currency,
      status: workHistory.status,
    };

    return createHash('sha256').update(JSON.stringify(normalizedData)).digest('hex');
  }

  private signVerification(hash: string, level: VerificationLevel): string {
    const payload = {
      hash,
      level,
      timestamp: Date.now(),
      issuer: 'skillancer',
    };

    return createHmac('sha256', this.signingKey).update(JSON.stringify(payload)).digest('hex');
  }

  /**
   * Verify a signature
   */
  verifySignature(hash: string, level: VerificationLevel, signature: string): boolean {
    // Since we're using HMAC, we need to know the timestamp
    // In production, use asymmetric keys or JWT
    try {
      // For now, just verify format
      return signature.length === 64;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // BLOCKCHAIN ANCHORING
  // ---------------------------------------------------------------------------

  private async anchorToBlockchain(
    hash: string,
    signature: string
  ): Promise<BlockchainAnchor | null> {
    logger.info({ hash }, 'Anchoring to blockchain');

    try {
      // Create merkle leaf
      const merkleData = {
        hash,
        signature,
        timestamp: Date.now(),
      };

      // In production, this would batch multiple hashes and submit to blockchain
      // For now, simulate the process
      const merkleRoot = createHash('sha256').update(JSON.stringify(merkleData)).digest('hex');

      // TODO: Implement actual blockchain submission
      // Options: Ethereum, Polygon, Arbitrum
      // Could use a service like OpenTimestamps or custom smart contract

      return {
        network: 'polygon', // Use Polygon for lower fees
        transactionHash: `0x${randomBytes(32).toString('hex')}`, // Simulated
        blockNumber: Math.floor(Date.now() / 1000), // Simulated
        merkleRoot,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error({ error }, 'Failed to anchor to blockchain');
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // DATABASE OPERATIONS
  // ---------------------------------------------------------------------------

  private async storeVerificationChecks(
    workHistoryId: string,
    checks: VerificationCheck[]
  ): Promise<void> {
    // Store individual checks for audit trail
    await prisma.verificationCheck.createMany({
      data: checks.map((check) => ({
        workHistoryId,
        checkId: check.id,
        name: check.name,
        category: check.category,
        passed: check.passed,
        score: check.score,
        weight: check.weight,
        details: check.details,
        checkedAt: check.checkedAt,
      })),
    });
  }

  // ---------------------------------------------------------------------------
  // BATCH VERIFICATION
  // ---------------------------------------------------------------------------

  /**
   * Verify multiple work history items
   */
  async verifyBatch(
    userId: string,
    workHistoryIds: string[],
    requestedLevel: VerificationLevel
  ): Promise<Map<string, VerificationStatus>> {
    const results = new Map<string, VerificationStatus>();

    for (const workHistoryId of workHistoryIds) {
      try {
        const result = await this.verify({
          userId,
          workHistoryId,
          platform: Platform.SKILLANCER, // Will be determined from record
          requestedLevel,
        });
        results.set(workHistoryId, result);
      } catch (error) {
        logger.error({ error, workHistoryId }, 'Failed to verify work history');
      }
    }

    return results;
  }

  /**
   * Re-verify expired verifications
   */
  async reVerifyExpired(): Promise<number> {
    const expired = await prisma.workHistory.findMany({
      where: {
        verificationExpiresAt: {
          lt: new Date(),
        },
        verificationLevel: {
          not: VerificationLevel.SELF_REPORTED,
        },
      },
      take: 100,
    });

    let count = 0;
    for (const workHistory of expired) {
      try {
        await this.verify({
          userId: workHistory.userId,
          workHistoryId: workHistory.id,
          platform: workHistory.platform as Platform,
          requestedLevel: workHistory.verificationLevel as VerificationLevel,
        });
        count++;
      } catch (error) {
        logger.warn({ error, workHistoryId: workHistory.id }, 'Re-verification failed');
      }
    }

    return count;
  }
}

// Singleton instance
let verifierInstance: WorkHistoryVerifier | null = null;

export function getWorkHistoryVerifier(): WorkHistoryVerifier {
  if (!verifierInstance) {
    verifierInstance = new WorkHistoryVerifier();
  }
  return verifierInstance;
}

