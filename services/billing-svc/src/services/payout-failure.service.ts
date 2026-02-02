// @ts-nocheck - Known type issues pending refactor
/**
 * @module @skillancer/billing-svc/services/payout-failure
 * Payout Failure Handler Service
 *
 * Handles payout failures including:
 * - Automatic retry logic with exponential backoff
 * - User notifications
 * - Admin alerts for repeated failures
 */

import { getGlobalPayoutService, type GlobalPayoutService } from './global-payout.service.js';
import { createLogger } from '../lib/logger.js';

// =============================================================================
// TYPES
// =============================================================================

export interface PayoutFailure {
  id: string;
  userId: string;
  payoutId: string;
  amount: number;
  currency: string;
  failureCode: string;
  failureMessage: string;
  attemptNumber: number;
  maxRetries: number;
  nextRetryAt: Date | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface PayoutFailureServiceConfig {
  stripeSecretKey: string;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  notificationServiceUrl?: string;
  adminAlertThreshold?: number;
}

interface NotificationPayload {
  userId: string;
  type: 'payout-failed' | 'payout-retry' | 'payout-retry-exhausted';
  data: Record<string, unknown>;
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export class PayoutFailureService {
  private readonly logger = createLogger({ serviceName: 'payout-failure-service' });
  private readonly payoutService: GlobalPayoutService;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly notificationServiceUrl: string;
  private readonly adminAlertThreshold: number;

  // In-memory tracking (in production, use Redis or DB)
  private failureTracker: Map<string, PayoutFailure> = new Map();
  private userFailureCounts: Map<string, number> = new Map();

  constructor(config: PayoutFailureServiceConfig) {
    this.payoutService = getGlobalPayoutService({ stripeSecretKey: config.stripeSecretKey });
    this.maxRetries = config.maxRetries ?? 3;
    this.baseDelayMs = config.baseDelayMs ?? 60000; // 1 minute
    this.maxDelayMs = config.maxDelayMs ?? 3600000; // 1 hour
    this.notificationServiceUrl = config.notificationServiceUrl ?? 'http://localhost:4003/api';
    this.adminAlertThreshold = config.adminAlertThreshold ?? 5;

    this.logger.info('Payout failure service initialized', {
      maxRetries: this.maxRetries,
      baseDelayMs: this.baseDelayMs,
      adminAlertThreshold: this.adminAlertThreshold,
    });
  }

  // ===========================================================================
  // FAILURE HANDLING
  // ===========================================================================

  /**
   * Handle a payout failure
   */
  async handlePayoutFailure(
    payoutId: string,
    userId: string,
    amount: number,
    currency: string,
    failureCode: string,
    failureMessage: string
  ): Promise<void> {
    this.logger.info('Handling payout failure', {
      payoutId,
      userId,
      amount,
      failureCode,
    });

    // Get existing failure record or create new one
    const existingFailure = this.failureTracker.get(payoutId);
    const attemptNumber = (existingFailure?.attemptNumber ?? 0) + 1;

    // Check if we should retry
    const shouldRetry = this.shouldRetryFailure(failureCode) && attemptNumber <= this.maxRetries;

    // Calculate next retry time
    const nextRetryAt = shouldRetry
      ? new Date(Date.now() + this.calculateBackoff(attemptNumber))
      : null;

    // Create/update failure record
    const failure: PayoutFailure = {
      id: existingFailure?.id ?? this.generateFailureId(),
      userId,
      payoutId,
      amount,
      currency,
      failureCode,
      failureMessage,
      attemptNumber,
      maxRetries: this.maxRetries,
      nextRetryAt,
      createdAt: existingFailure?.createdAt ?? new Date(),
      resolvedAt: null,
    };

    this.failureTracker.set(payoutId, failure);

    // Update user failure count
    const currentCount = this.userFailureCounts.get(userId) ?? 0;
    this.userFailureCounts.set(userId, currentCount + 1);

    // Send notifications
    await this.sendFailureNotification(failure, shouldRetry);

    // Check for admin alert threshold
    if (currentCount + 1 >= this.adminAlertThreshold) {
      await this.sendAdminAlert(userId, currentCount + 1);
    }

    // Schedule retry if applicable
    if (shouldRetry && nextRetryAt) {
      this.scheduleRetry(failure, nextRetryAt);
    }

    this.logger.info('Payout failure handled', {
      payoutId,
      attemptNumber,
      willRetry: shouldRetry,
      nextRetryAt,
    });
  }

  /**
   * Check if a failure code is retryable
   */
  private shouldRetryFailure(failureCode: string): boolean {
    // Non-retryable failure codes
    const nonRetryableCodes = [
      'account_closed',
      'invalid_account',
      'no_account',
      'invalid_currency',
      'bank_account_restricted',
      'fraud',
    ];

    return !nonRetryableCodes.includes(failureCode);
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attemptNumber: number): number {
    // Exponential backoff: baseDelay * 2^(attempt-1)
    const delay = this.baseDelayMs * Math.pow(2, attemptNumber - 1);
    // Add some jitter (±10%)
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    return Math.min(delay + jitter, this.maxDelayMs);
  }

  /**
   * Schedule a retry for a failed payout
   */
  private scheduleRetry(failure: PayoutFailure, retryAt: Date): void {
    const delayMs = retryAt.getTime() - Date.now();

    this.logger.info('Scheduling payout retry', {
      payoutId: failure.payoutId,
      attemptNumber: failure.attemptNumber + 1,
      retryAt,
      delayMs,
    });

    // In production, use a proper job queue (Bull, BullMQ, etc.)
    setTimeout(async () => {
      await this.retryPayout(failure);
    }, delayMs);
  }

  /**
   * Retry a failed payout
   */
  async retryPayout(failure: PayoutFailure): Promise<void> {
    this.logger.info('Retrying failed payout', {
      payoutId: failure.payoutId,
      attemptNumber: failure.attemptNumber + 1,
    });

    try {
      // Attempt the payout again
      await this.payoutService.requestPayout({
        userId: failure.userId,
        amount: failure.amount,
        currency: failure.currency,
        description: `Retry attempt ${failure.attemptNumber + 1} for payout ${failure.payoutId}`,
      });

      // Success! Mark as resolved
      failure.resolvedAt = new Date();
      this.failureTracker.set(failure.payoutId, failure);

      // Send success notification
      await this.sendNotification({
        userId: failure.userId,
        type: 'payout-retry',
        data: {
          payoutId: failure.payoutId,
          amount: failure.amount,
          currency: failure.currency,
          attemptNumber: failure.attemptNumber + 1,
          success: true,
        },
      });

      // Decrement user failure count
      const currentCount = this.userFailureCounts.get(failure.userId) ?? 1;
      this.userFailureCounts.set(failure.userId, Math.max(0, currentCount - 1));

      this.logger.info('Payout retry successful', {
        payoutId: failure.payoutId,
        attemptNumber: failure.attemptNumber + 1,
      });
    } catch (err: any) {
      // Retry failed
      const failureCode = err.code ?? 'retry_failed';
      const failureMessage = err.message ?? 'Retry attempt failed';

      await this.handlePayoutFailure(
        failure.payoutId,
        failure.userId,
        failure.amount,
        failure.currency,
        failureCode,
        failureMessage
      );
    }
  }

  // ===========================================================================
  // NOTIFICATIONS
  // ===========================================================================

  /**
   * Send failure notification to user
   */
  private async sendFailureNotification(failure: PayoutFailure, willRetry: boolean): Promise<void> {
    if (failure.attemptNumber > this.maxRetries) {
      // All retries exhausted
      await this.sendNotification({
        userId: failure.userId,
        type: 'payout-retry-exhausted',
        data: {
          payoutId: failure.payoutId,
          amount: failure.amount,
          currency: failure.currency,
          failureCode: failure.failureCode,
          failureMessage: failure.failureMessage,
          attempts: failure.attemptNumber,
        },
      });
    } else {
      // First failure or retry scheduled
      await this.sendNotification({
        userId: failure.userId,
        type: 'payout-failed',
        data: {
          payoutId: failure.payoutId,
          amount: failure.amount,
          currency: failure.currency,
          failureCode: failure.failureCode,
          failureMessage: failure.failureMessage,
          attemptNumber: failure.attemptNumber,
          willRetry,
          nextRetryAt: failure.nextRetryAt?.toISOString(),
        },
      });
    }
  }

  /**
   * Send notification to notification service
   */
  private async sendNotification(payload: NotificationPayload): Promise<void> {
    try {
      const response = await fetch(`${this.notificationServiceUrl}/notifications/payout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logger.warn('Failed to send notification', {
          status: response.status,
          payload,
        });
      }
    } catch (err) {
      this.logger.error('Error sending notification', { err, payload });
    }
  }

  /**
   * Send admin alert for repeated failures
   */
  private async sendAdminAlert(userId: string, failureCount: number): Promise<void> {
    this.logger.warn('Admin alert: User has repeated payout failures', {
      userId,
      failureCount,
      threshold: this.adminAlertThreshold,
    });

    try {
      await fetch(`${this.notificationServiceUrl}/admin/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'payout_failures',
          severity: 'high',
          userId,
          message: `User ${userId} has ${failureCount} consecutive payout failures`,
          data: {
            userId,
            failureCount,
            threshold: this.adminAlertThreshold,
          },
        }),
      });
    } catch (err) {
      this.logger.error('Error sending admin alert', { err, userId });
    }
  }

  // ===========================================================================
  // STATUS & MANAGEMENT
  // ===========================================================================

  /**
   * Get pending failures for a user
   */
  getPendingFailures(userId: string): PayoutFailure[] {
    const failures: PayoutFailure[] = [];
    for (const failure of this.failureTracker.values()) {
      if (failure.userId === userId && !failure.resolvedAt) {
        failures.push(failure);
      }
    }
    return failures.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get failure count for a user
   */
  getFailureCount(userId: string): number {
    return this.userFailureCounts.get(userId) ?? 0;
  }

  /**
   * Mark a failure as resolved manually
   */
  resolveFailure(payoutId: string): boolean {
    const failure = this.failureTracker.get(payoutId);
    if (failure && !failure.resolvedAt) {
      failure.resolvedAt = new Date();
      this.failureTracker.set(payoutId, failure);

      const currentCount = this.userFailureCounts.get(failure.userId) ?? 1;
      this.userFailureCounts.set(failure.userId, Math.max(0, currentCount - 1));

      return true;
    }
    return false;
  }

  /**
   * Clear all failure records for a user
   */
  clearUserFailures(userId: string): void {
    for (const [payoutId, failure] of this.failureTracker.entries()) {
      if (failure.userId === userId) {
        this.failureTracker.delete(payoutId);
      }
    }
    this.userFailureCounts.delete(userId);
  }

  /**
   * Generate a unique failure ID
   */
  private generateFailureId(): string {
    return `pf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get failure statistics
   */
  getStatistics(): {
    totalFailures: number;
    pendingFailures: number;
    resolvedFailures: number;
    usersWithFailures: number;
    topFailureCodes: Record<string, number>;
  } {
    let pendingCount = 0;
    let resolvedCount = 0;
    const failureCodes: Record<string, number> = {};

    for (const failure of this.failureTracker.values()) {
      if (failure.resolvedAt) {
        resolvedCount++;
      } else {
        pendingCount++;
      }
      failureCodes[failure.failureCode] = (failureCodes[failure.failureCode] ?? 0) + 1;
    }

    // Sort failure codes by count
    const topFailureCodes = Object.fromEntries(
      Object.entries(failureCodes)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
    );

    return {
      totalFailures: this.failureTracker.size,
      pendingFailures: pendingCount,
      resolvedFailures: resolvedCount,
      usersWithFailures: this.userFailureCounts.size,
      topFailureCodes,
    };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let serviceInstance: PayoutFailureService | null = null;

export function getPayoutFailureService(config?: PayoutFailureServiceConfig): PayoutFailureService {
  if (!serviceInstance) {
    if (!config?.stripeSecretKey) {
      throw new Error('Stripe secret key is required to initialize PayoutFailureService');
    }
    serviceInstance = new PayoutFailureService(config);
  }
  return serviceInstance;
}

export default PayoutFailureService;
