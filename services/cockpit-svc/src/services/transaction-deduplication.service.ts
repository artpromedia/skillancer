/**
 * Transaction Deduplication Service
 *
 * Handles detection and resolution of duplicate transactions across different sources.
 * Uses multiple strategies including deduplication keys, fuzzy matching, and ML-based similarity.
 */

import { createHash } from 'crypto';

import {
  type PrismaClient,
  type UnifiedTransaction,
  UnifiedTransactionSource,
  UnifiedSyncStatus,
} from '@skillancer/database';
import { logger } from '@skillancer/logger';

import type { UnifiedTransactionRepository } from '../repositories/unified-transaction.repository';
import type {
  AnySourceTransaction,
  DuplicatePair,
  DeduplicationResult,
} from '../types/unified-financial.types';

/**
 * Configuration for deduplication
 */
export interface DeduplicationConfig {
  /** Enable fuzzy matching for cross-source duplicates */
  enableFuzzyMatching: boolean;
  /** Amount tolerance for fuzzy matching (as decimal, e.g., 0.01 = 1%) */
  amountTolerance: number;
  /** Date tolerance in days for fuzzy matching */
  dateTolerance: number;
  /** Minimum confidence score for auto-merge (0-100) */
  autoMergeThreshold: number;
  /** Minimum confidence score for flagging as potential duplicate (0-100) */
  reviewThreshold: number;
}

const DEFAULT_CONFIG: DeduplicationConfig = {
  enableFuzzyMatching: true,
  amountTolerance: 0.01, // 1% tolerance
  dateTolerance: 3, // 3 days
  autoMergeThreshold: 95,
  reviewThreshold: 70,
};

export class TransactionDeduplicationService {
  private config: DeduplicationConfig;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly transactionRepo: UnifiedTransactionRepository,
    config?: Partial<DeduplicationConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate a unique deduplication key for a source transaction
   */
  generateDeduplicationKey(transaction: AnySourceTransaction): string {
    // Create a composite key based on source, external ID, and core attributes
    const keyComponents = [
      transaction.source,
      transaction.externalId,
      transaction.amount.toFixed(2),
      transaction.currency,
      transaction.transactionDate.toISOString().split('T')[0], // Date only
    ];

    const compositeKey = keyComponents.join('|');

    // Hash for consistent length and to handle special characters
    return createHash('sha256').update(compositeKey).digest('hex').substring(0, 64);
  }

  /**
   * Check if a transaction already exists
   */
  async isDuplicate(userId: string, transaction: AnySourceTransaction): Promise<boolean> {
    const deduplicationKey = this.generateDeduplicationKey(transaction);
    const existing = await this.transactionRepo.findByDeduplicationKey(userId, deduplicationKey);
    return existing !== null;
  }

  /**
   * Find exact duplicates by deduplication key
   */
  async findExactDuplicate(
    userId: string,
    transaction: AnySourceTransaction
  ): Promise<UnifiedTransaction | null> {
    const deduplicationKey = this.generateDeduplicationKey(transaction);
    return this.transactionRepo.findByDeduplicationKey(userId, deduplicationKey);
  }

  /**
   * Find potential duplicates using fuzzy matching
   */
  async findPotentialDuplicates(
    userId: string,
    transaction: AnySourceTransaction
  ): Promise<DuplicatePair[]> {
    if (!this.config.enableFuzzyMatching) {
      return [];
    }

    const { amount, transactionDate, currency } = transaction;
    const amountMin = amount * (1 - this.config.amountTolerance);
    const amountMax = amount * (1 + this.config.amountTolerance);

    const dateMin = new Date(transactionDate);
    dateMin.setDate(dateMin.getDate() - this.config.dateTolerance);

    const dateMax = new Date(transactionDate);
    dateMax.setDate(dateMax.getDate() + this.config.dateTolerance);

    // Find transactions within tolerance range
    const candidates = await this.prisma.unifiedTransaction.findMany({
      where: {
        userId,
        originalCurrency: currency,
        originalAmount: {
          gte: amountMin,
          lte: amountMax,
        },
        transactionDate: {
          gte: dateMin,
          lte: dateMax,
        },
        syncStatus: { not: UnifiedSyncStatus.DUPLICATE },
      },
    });

    const duplicatePairs: DuplicatePair[] = [];

    for (const candidate of candidates) {
      const confidenceScore = this.calculateSimilarityScore(transaction, candidate);

      if (confidenceScore >= this.config.reviewThreshold) {
        duplicatePairs.push({
          transaction1: {
            id: 'new',
            source: transaction.source,
            externalId: transaction.externalId,
            amount: transaction.amount,
            date: transaction.transactionDate,
            description: transaction.description,
          },
          transaction2: {
            id: candidate.id,
            source: candidate.source,
            externalId: candidate.externalId,
            amount: candidate.originalAmount.toNumber(),
            date: candidate.transactionDate,
            description: candidate.description ?? undefined,
          },
          confidenceScore,
          matchReason: this.getMatchReason(transaction, candidate, confidenceScore),
          suggestedAction:
            confidenceScore >= this.config.autoMergeThreshold
              ? 'merge'
              : confidenceScore >= this.config.reviewThreshold
                ? 'review'
                : 'keep_both',
        });
      }
    }

    return duplicatePairs;
  }

  /**
   * Run deduplication across all transactions for a user
   */
  async runDeduplication(userId: string): Promise<DeduplicationResult> {
    logger.info('Starting deduplication run', { userId });

    const result: DeduplicationResult = {
      totalChecked: 0,
      duplicatesFound: 0,
      autoMerged: 0,
      pendingReview: [],
    };

    // Get all synced transactions (non-duplicates)
    const transactions = await this.prisma.unifiedTransaction.findMany({
      where: {
        userId,
        syncStatus: { not: UnifiedSyncStatus.DUPLICATE },
      },
      orderBy: { transactionDate: 'desc' },
    });

    result.totalChecked = transactions.length;

    // Compare each transaction with others
    const checked = new Set<string>();

    for (let i = 0; i < transactions.length; i++) {
      const tx1 = transactions[i]!;

      if (checked.has(tx1.id)) continue;

      for (let j = i + 1; j < transactions.length; j++) {
        const tx2 = transactions[j]!;

        if (checked.has(tx2.id)) continue;
        if (tx1.source === tx2.source) continue; // Same source unlikely to be duplicates

        const score = this.calculateSimilarityScoreBetweenTransactions(tx1, tx2);

        if (score >= this.config.reviewThreshold) {
          result.duplicatesFound++;

          if (score >= this.config.autoMergeThreshold) {
            // Auto-merge: keep the one with more data, mark other as duplicate
            const [keeper, duplicate] = this.selectKeeperTransaction(tx1, tx2);
            await this.transactionRepo.updateSyncStatus(
              duplicate.id,
              UnifiedSyncStatus.DUPLICATE,
              `Merged with ${keeper.id} (score: ${score})`
            );
            checked.add(duplicate.id);
            result.autoMerged++;
          } else {
            // Add to pending review
            result.pendingReview.push({
              transaction1: {
                id: tx1.id,
                source: tx1.source,
                externalId: tx1.externalId,
                amount: tx1.originalAmount.toNumber(),
                date: tx1.transactionDate,
                description: tx1.description ?? undefined,
              },
              transaction2: {
                id: tx2.id,
                source: tx2.source,
                externalId: tx2.externalId,
                amount: tx2.originalAmount.toNumber(),
                date: tx2.transactionDate,
                description: tx2.description ?? undefined,
              },
              confidenceScore: score,
              matchReason: this.getMatchReasonBetweenTransactions(tx1, tx2, score),
              suggestedAction: 'review',
            });
          }
        }
      }
    }

    logger.info('Deduplication run completed', {
      userId,
      ...result,
      pendingReviewCount: result.pendingReview.length,
    });

    return result;
  }

  /**
   * Manually merge two transactions
   */
  async mergeTransactions(
    keeperId: string,
    duplicateId: string,
    userId: string
  ): Promise<UnifiedTransaction> {
    // Verify both transactions belong to the user
    const [keeper, duplicate] = await Promise.all([
      this.transactionRepo.findById(keeperId),
      this.transactionRepo.findById(duplicateId),
    ]);

    if (!keeper || keeper.userId !== userId) {
      throw new Error('Keeper transaction not found or unauthorized');
    }
    if (!duplicate || duplicate.userId !== userId) {
      throw new Error('Duplicate transaction not found or unauthorized');
    }

    // Merge metadata and attachments
    const mergedMetadata = {
      ...((duplicate.metadata as Record<string, unknown>) ?? {}),
      ...((keeper.metadata as Record<string, unknown>) ?? {}),
      mergedFrom: [
        ...(((keeper.metadata as Record<string, unknown>)?.mergedFrom as string[]) ?? []),
        duplicate.id,
      ],
    };

    const mergedAttachments = [
      ...keeper.attachments,
      ...duplicate.attachments.filter((a) => !keeper.attachments.includes(a)),
    ];

    // Update keeper with merged data
    const updated = await this.prisma.unifiedTransaction.update({
      where: { id: keeperId },
      data: {
        metadata: mergedMetadata,
        attachments: mergedAttachments,
        updatedAt: new Date(),
      },
    });

    // Mark duplicate
    await this.transactionRepo.updateSyncStatus(
      duplicateId,
      UnifiedSyncStatus.DUPLICATE,
      `Manually merged with ${keeperId}`
    );

    logger.info('Transactions merged', { keeperId, duplicateId, userId });

    return updated;
  }

  /**
   * Mark transactions as not duplicates
   */
  async markNotDuplicate(
    transactionId1: string,
    transactionId2: string,
    userId: string
  ): Promise<void> {
    // Add to exclusion list in metadata
    const [tx1, tx2] = await Promise.all([
      this.transactionRepo.findById(transactionId1),
      this.transactionRepo.findById(transactionId2),
    ]);

    if (!tx1 || tx1.userId !== userId || !tx2 || tx2.userId !== userId) {
      throw new Error('Transaction not found or unauthorized');
    }

    // Add exclusion metadata to both
    await Promise.all([
      this.prisma.unifiedTransaction.update({
        where: { id: transactionId1 },
        data: {
          metadata: {
            ...((tx1.metadata as Record<string, unknown>) ?? {}),
            notDuplicateOf: [
              ...(((tx1.metadata as Record<string, unknown>)?.notDuplicateOf as string[]) ?? []),
              transactionId2,
            ],
          },
        },
      }),
      this.prisma.unifiedTransaction.update({
        where: { id: transactionId2 },
        data: {
          metadata: {
            ...((tx2.metadata as Record<string, unknown>) ?? {}),
            notDuplicateOf: [
              ...(((tx2.metadata as Record<string, unknown>)?.notDuplicateOf as string[]) ?? []),
              transactionId1,
            ],
          },
        },
      }),
    ]);

    logger.info('Marked as not duplicates', { transactionId1, transactionId2, userId });
  }

  /**
   * Calculate similarity score between a source transaction and existing unified transaction
   */
  private calculateSimilarityScore(
    source: AnySourceTransaction,
    existing: UnifiedTransaction
  ): number {
    let score = 0;

    // Amount match (40 points)
    const amountDiff = Math.abs(source.amount - existing.originalAmount.toNumber());
    const amountPercent = amountDiff / source.amount;
    score += Math.max(0, 40 * (1 - amountPercent / this.config.amountTolerance));

    // Date match (30 points)
    const daysDiff = Math.abs(
      (source.transactionDate.getTime() - existing.transactionDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    score += Math.max(0, 30 * (1 - daysDiff / this.config.dateTolerance));

    // Currency match (10 points)
    if (source.currency === existing.originalCurrency) {
      score += 10;
    }

    // Description similarity (10 points)
    if (source.description && existing.description) {
      const similarity = this.calculateStringSimilarity(source.description, existing.description);
      score += 10 * similarity;
    }

    // Client/Project match (10 points)
    if (source.clientExternalId && existing.externalClientName) {
      const similarity = this.calculateStringSimilarity(
        source.clientExternalId,
        existing.externalClientName
      );
      score += 5 * similarity;
    }
    if (source.projectExternalId && existing.externalProjectName) {
      const similarity = this.calculateStringSimilarity(
        source.projectExternalId,
        existing.externalProjectName
      );
      score += 5 * similarity;
    }

    return Math.round(score);
  }

  /**
   * Calculate similarity score between two unified transactions
   */
  private calculateSimilarityScoreBetweenTransactions(
    tx1: UnifiedTransaction,
    tx2: UnifiedTransaction
  ): number {
    let score = 0;

    // Amount match (40 points)
    const amount1 = tx1.originalAmount.toNumber();
    const amount2 = tx2.originalAmount.toNumber();
    const amountDiff = Math.abs(amount1 - amount2);
    const amountPercent = amountDiff / Math.max(amount1, amount2);
    score += Math.max(0, 40 * (1 - amountPercent / this.config.amountTolerance));

    // Date match (30 points)
    const daysDiff = Math.abs(
      (tx1.transactionDate.getTime() - tx2.transactionDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    score += Math.max(0, 30 * (1 - daysDiff / this.config.dateTolerance));

    // Currency match (10 points)
    if (tx1.originalCurrency === tx2.originalCurrency) {
      score += 10;
    }

    // Description similarity (10 points)
    if (tx1.description && tx2.description) {
      const similarity = this.calculateStringSimilarity(tx1.description, tx2.description);
      score += 10 * similarity;
    }

    // Client match (5 points)
    if (tx1.clientId && tx2.clientId && tx1.clientId === tx2.clientId) {
      score += 5;
    } else if (tx1.externalClientName && tx2.externalClientName) {
      const similarity = this.calculateStringSimilarity(
        tx1.externalClientName,
        tx2.externalClientName
      );
      score += 5 * similarity;
    }

    // Project match (5 points)
    if (
      tx1.cockpitProjectId &&
      tx2.cockpitProjectId &&
      tx1.cockpitProjectId === tx2.cockpitProjectId
    ) {
      score += 5;
    } else if (tx1.externalProjectName && tx2.externalProjectName) {
      const similarity = this.calculateStringSimilarity(
        tx1.externalProjectName,
        tx2.externalProjectName
      );
      score += 5 * similarity;
    }

    // Check exclusion list
    const tx1NotDups =
      ((tx1.metadata as Record<string, unknown>)?.notDuplicateOf as string[]) ?? [];
    const tx2NotDups =
      ((tx2.metadata as Record<string, unknown>)?.notDuplicateOf as string[]) ?? [];
    if (tx1NotDups.includes(tx2.id) || tx2NotDups.includes(tx1.id)) {
      return 0; // Explicitly marked as not duplicates
    }

    return Math.round(score);
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;

    const maxLen = Math.max(s1.length, s2.length);
    const distance = this.levenshteinDistance(s1, s2);

    return 1 - distance / maxLen;
  }

  /**
   * Levenshtein distance implementation
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const len1 = s1.length;
    const len2 = s2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0]![j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j - 1]! + cost
        );
      }
    }

    return matrix[len1]![len2]!;
  }

  /**
   * Get human-readable match reason
   */
  private getMatchReason(
    source: AnySourceTransaction,
    existing: UnifiedTransaction,
    score: number
  ): string {
    const reasons: string[] = [];

    const amountDiff = Math.abs(source.amount - existing.originalAmount.toNumber());
    if (amountDiff < source.amount * 0.001) {
      reasons.push('exact amount match');
    } else {
      reasons.push(`similar amount (${((amountDiff / source.amount) * 100).toFixed(1)}% diff)`);
    }

    const daysDiff = Math.abs(
      (source.transactionDate.getTime() - existing.transactionDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (daysDiff < 1) {
      reasons.push('same date');
    } else {
      reasons.push(`${Math.round(daysDiff)} days apart`);
    }

    if (source.description && existing.description) {
      const similarity = this.calculateStringSimilarity(source.description, existing.description);
      if (similarity > 0.8) {
        reasons.push('similar description');
      }
    }

    return `${score}% confidence: ${reasons.join(', ')}`;
  }

  /**
   * Get match reason between two transactions
   */
  private getMatchReasonBetweenTransactions(
    tx1: UnifiedTransaction,
    tx2: UnifiedTransaction,
    score: number
  ): string {
    const reasons: string[] = [];

    const amount1 = tx1.originalAmount.toNumber();
    const amount2 = tx2.originalAmount.toNumber();
    const amountDiff = Math.abs(amount1 - amount2);
    if (amountDiff < amount1 * 0.001) {
      reasons.push('exact amount match');
    } else {
      reasons.push(`similar amount (${((amountDiff / amount1) * 100).toFixed(1)}% diff)`);
    }

    const daysDiff = Math.abs(
      (tx1.transactionDate.getTime() - tx2.transactionDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff < 1) {
      reasons.push('same date');
    } else {
      reasons.push(`${Math.round(daysDiff)} days apart`);
    }

    reasons.push(`${tx1.source} ↔ ${tx2.source}`);

    return `${score}% confidence: ${reasons.join(', ')}`;
  }

  /**
   * Select which transaction to keep when merging
   */
  private selectKeeperTransaction(
    tx1: UnifiedTransaction,
    tx2: UnifiedTransaction
  ): [UnifiedTransaction, UnifiedTransaction] {
    // Prefer transactions with more data
    let score1 = 0;
    let score2 = 0;

    // Prefer linked to internal entities
    if (tx1.clientId) score1 += 2;
    if (tx2.clientId) score2 += 2;
    if (tx1.cockpitProjectId) score1 += 2;
    if (tx2.cockpitProjectId) score2 += 2;

    // Prefer more attachments
    score1 += tx1.attachments.length;
    score2 += tx2.attachments.length;

    // Prefer internal sources
    if (
      tx1.source === UnifiedTransactionSource.MARKET ||
      tx1.source === UnifiedTransactionSource.COCKPIT
    )
      score1 += 3;
    if (
      tx2.source === UnifiedTransactionSource.MARKET ||
      tx2.source === UnifiedTransactionSource.COCKPIT
    )
      score2 += 3;

    // Prefer more recent
    if (tx1.createdAt > tx2.createdAt) score1 += 1;
    else score2 += 1;

    return score1 >= score2 ? [tx1, tx2] : [tx2, tx1];
  }
}
