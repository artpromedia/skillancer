/**
 * @module @skillancer/market-svc/workers/credential-expiration
 * Credential Expiration Worker - Periodically checks and updates credential statuses
 */

import { CredentialSyncService } from '../services/credential-sync.service.js';

import type { PrismaClient } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface CredentialExpirationWorkerDeps {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
}

export interface CredentialExpirationWorkerConfig {
  /**
   * Enable the worker
   */
  enabled: boolean;
  /**
   * Interval between runs in milliseconds (default: 1 hour)
   */
  intervalMs: number;
  /**
   * Days ahead to check for expiring credentials (for notifications)
   */
  expirationWarningDays: number;
  /**
   * Batch size for processing credentials
   */
  batchSize: number;
}

export interface CredentialExpirationResult {
  expired: number;
  expiringSoon: number;
  recalculatedConfidences: number;
  duration: number;
}

export interface CredentialExpirationWorker {
  /**
   * Start the worker
   */
  start(): void;

  /**
   * Stop the worker
   */
  stop(): void;

  /**
   * Run once immediately (for testing or manual trigger)
   */
  runOnce(): Promise<CredentialExpirationResult>;

  /**
   * Check if worker is running
   */
  isRunning(): boolean;

  /**
   * Get last run result
   */
  getLastRunResult(): CredentialExpirationResult | null;
}

const DEFAULT_CONFIG: CredentialExpirationWorkerConfig = {
  enabled: true,
  intervalMs: 60 * 60 * 1000, // 1 hour
  expirationWarningDays: 30,
  batchSize: 100,
};

// =============================================================================
// WORKER IMPLEMENTATION
// =============================================================================

export function createCredentialExpirationWorker(
  deps: CredentialExpirationWorkerDeps,
  config: Partial<CredentialExpirationWorkerConfig> = {}
): CredentialExpirationWorker {
  const { prisma, redis, logger } = deps;
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const credentialService = new CredentialSyncService(prisma, redis, logger);

  let intervalId: NodeJS.Timeout | null = null;
  let running = false;
  let lastRunResult: CredentialExpirationResult | null = null;

  const runOnce = async (): Promise<CredentialExpirationResult> => {
    const startTime = Date.now();

    logger.info({ msg: 'Starting credential expiration check' });

    try {
      // Process expiring credentials
      const { expired, expiringSoon } = await credentialService.processExpiringCredentials();

      // Recalculate skill confidences for users with expiring/expired credentials
      const recalculatedConfidences = 0;

      // The processExpiringCredentials already handles cache invalidation
      // Additional confidence recalculation could be added here if needed

      const duration = Date.now() - startTime;

      lastRunResult = {
        expired,
        expiringSoon,
        recalculatedConfidences,
        duration,
      };

      logger.info({
        msg: 'Credential expiration check completed',
        expired,
        expiringSoon,
        recalculatedConfidences,
        durationMs: duration,
      });

      return lastRunResult;
    } catch (error) {
      logger.error({ msg: 'Credential expiration check failed', error });
      throw error;
    }
  };

  const start = (): void => {
    if (!mergedConfig.enabled) {
      logger.info({ msg: 'Credential expiration worker is disabled' });
      return;
    }

    if (running) {
      logger.warn({ msg: 'Credential expiration worker is already running' });
      return;
    }

    logger.info({
      msg: 'Starting credential expiration worker',
      intervalMs: mergedConfig.intervalMs,
      expirationWarningDays: mergedConfig.expirationWarningDays,
    });

    running = true;

    // Run immediately on start
    runOnce().catch((error: unknown) => {
      logger.error({ msg: 'Initial credential expiration check failed', error });
    });

    // Schedule periodic runs
    intervalId = setInterval(() => {
      runOnce().catch((error: unknown) => {
        logger.error({ msg: 'Scheduled credential expiration check failed', error });
      });
    }, mergedConfig.intervalMs);
  };

  const stop = (): void => {
    if (!running) {
      logger.warn({ msg: 'Credential expiration worker is not running' });
      return;
    }

    logger.info({ msg: 'Stopping credential expiration worker' });

    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }

    running = false;
  };

  const isRunning = (): boolean => running;

  const getLastRunResult = (): CredentialExpirationResult | null => lastRunResult;

  return {
    start,
    stop,
    runOnce,
    isRunning,
    getLastRunResult,
  };
}
