/**
 * @module @skillancer/market-svc/messaging/credential-events
 * SkillPod Credential Event Consumer
 *
 * Handles credential-related events from SkillPod service
 */

import { CredentialSyncService } from '../services/credential-sync.service.js';

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type {
  CredentialEarnedEvent,
  CredentialRevokedEvent,
  CredentialRenewedEvent,
  SkillAssessmentCompletedEvent,
  LearningProgressEvent,
} from '@skillancer/types';
import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface CredentialEventConsumerDeps {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
}

export interface CredentialEventConsumerConfig {
  /**
   * Enable event consumption
   */
  enabled: boolean;
  /**
   * Maximum retry attempts for failed events
   */
  maxRetries: number;
  /**
   * Retry delay in milliseconds
   */
  retryDelayMs: number;
  /**
   * Dead letter queue name for failed events
   */
  deadLetterQueue: string;
}

const DEFAULT_CONFIG: CredentialEventConsumerConfig = {
  enabled: true,
  maxRetries: 3,
  retryDelayMs: 5000,
  deadLetterQueue: 'credential-events-dlq',
};

// =============================================================================
// EVENT ROUTING TABLE
// =============================================================================

export const CREDENTIAL_EVENT_TYPES = {
  CREDENTIAL_EARNED: 'credential.earned',
  CREDENTIAL_REVOKED: 'credential.revoked',
  CREDENTIAL_RENEWED: 'credential.renewed',
  SKILL_ASSESSMENT_COMPLETED: 'skill.assessment.completed',
  LEARNING_PROGRESS: 'learning.progress.updated',
} as const;

export type CredentialEventType =
  (typeof CREDENTIAL_EVENT_TYPES)[keyof typeof CREDENTIAL_EVENT_TYPES];

// =============================================================================
// CREDENTIAL EVENT CONSUMER
// =============================================================================

export interface CredentialEventConsumer {
  /**
   * Process a credential earned event
   */
  processCredentialEarned(event: CredentialEarnedEvent): Promise<void>;

  /**
   * Process a credential revoked event
   */
  processCredentialRevoked(event: CredentialRevokedEvent): Promise<void>;

  /**
   * Process a credential renewed event
   */
  processCredentialRenewed(event: CredentialRenewedEvent): Promise<void>;

  /**
   * Process a skill assessment completed event
   */
  processSkillAssessmentCompleted(event: SkillAssessmentCompletedEvent): Promise<void>;

  /**
   * Process a learning progress event
   */
  processLearningProgress(event: LearningProgressEvent): Promise<void>;

  /**
   * Route and process any credential event by type
   */
  processEvent(eventType: CredentialEventType, payload: unknown): Promise<void>;

  /**
   * Get consumer statistics
   */
  getStats(): ConsumerStats;

  /**
   * Reset consumer statistics
   */
  resetStats(): void;
}

export interface ConsumerStats {
  eventsProcessed: number;
  eventsFailed: number;
  eventsRetried: number;
  lastEventAt: Date | null;
  eventsByType: Record<string, number>;
}

// =============================================================================
// CONSUMER IMPLEMENTATION
// =============================================================================

export function createCredentialEventConsumer(
  deps: CredentialEventConsumerDeps,
  config: Partial<CredentialEventConsumerConfig> = {}
): CredentialEventConsumer {
  const { prisma, redis, logger } = deps;
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const credentialService = new CredentialSyncService(prisma, redis, logger);

  const stats: ConsumerStats = {
    eventsProcessed: 0,
    eventsFailed: 0,
    eventsRetried: 0,
    lastEventAt: null,
    eventsByType: {},
  };

  const incrementEventCount = (eventType: string): void => {
    stats.eventsByType[eventType] = (stats.eventsByType[eventType] ?? 0) + 1;
  };

  const processWithRetry = async <T>(
    eventType: string,
    processor: () => Promise<T>
  ): Promise<void> => {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= mergedConfig.maxRetries; attempt++) {
      try {
        await processor();
        stats.eventsProcessed++;
        stats.lastEventAt = new Date();
        incrementEventCount(eventType);

        logger.debug({
          msg: 'Event processed successfully',
          eventType,
          attempt,
        });

        return;
      } catch (error) {
        lastError = error as Error;
        stats.eventsRetried++;

        logger.warn({
          msg: 'Event processing failed, retrying',
          eventType,
          attempt,
          maxRetries: mergedConfig.maxRetries,
          error: lastError.message,
        });

        if (attempt < mergedConfig.maxRetries) {
          await sleep(mergedConfig.retryDelayMs * attempt);
        }
      }
    }

    // All retries exhausted
    stats.eventsFailed++;

    logger.error({
      msg: 'Event processing failed after all retries',
      eventType,
      maxRetries: mergedConfig.maxRetries,
      error: lastError?.message,
    });

    // Send to dead letter queue (fire and forget)
    sendToDeadLetterQueue(eventType, lastError?.message ?? 'Unknown error').catch(
      (err: unknown) => {
        logger.error({ msg: 'Failed to send to DLQ', error: err });
      }
    );
  };

  const sendToDeadLetterQueue = async (eventType: string, errorMessage: string): Promise<void> => {
    const dlqKey = `${mergedConfig.deadLetterQueue}:${Date.now()}`;
    await redis.setex(
      dlqKey,
      86400 * 7, // Keep for 7 days
      JSON.stringify({
        eventType,
        errorMessage,
        timestamp: new Date().toISOString(),
      })
    );
  };

  const processCredentialEarned = async (event: CredentialEarnedEvent): Promise<void> => {
    if (!mergedConfig.enabled) {
      logger.debug({
        msg: 'Consumer disabled, skipping event',
        eventType: CREDENTIAL_EVENT_TYPES.CREDENTIAL_EARNED,
      });
      return;
    }

    await processWithRetry(CREDENTIAL_EVENT_TYPES.CREDENTIAL_EARNED, async () => {
      await credentialService.handleCredentialEarned(event);
    });
  };

  const processCredentialRevoked = async (event: CredentialRevokedEvent): Promise<void> => {
    if (!mergedConfig.enabled) {
      logger.debug({
        msg: 'Consumer disabled, skipping event',
        eventType: CREDENTIAL_EVENT_TYPES.CREDENTIAL_REVOKED,
      });
      return;
    }

    await processWithRetry(CREDENTIAL_EVENT_TYPES.CREDENTIAL_REVOKED, async () => {
      await credentialService.handleCredentialRevoked(event);
    });
  };

  const processCredentialRenewed = async (event: CredentialRenewedEvent): Promise<void> => {
    if (!mergedConfig.enabled) {
      logger.debug({
        msg: 'Consumer disabled, skipping event',
        eventType: CREDENTIAL_EVENT_TYPES.CREDENTIAL_RENEWED,
      });
      return;
    }

    await processWithRetry(CREDENTIAL_EVENT_TYPES.CREDENTIAL_RENEWED, async () => {
      await credentialService.handleCredentialRenewed(event);
    });
  };

  const processSkillAssessmentCompleted = async (
    event: SkillAssessmentCompletedEvent
  ): Promise<void> => {
    if (!mergedConfig.enabled) {
      logger.debug({
        msg: 'Consumer disabled, skipping event',
        eventType: CREDENTIAL_EVENT_TYPES.SKILL_ASSESSMENT_COMPLETED,
      });
      return;
    }

    await processWithRetry(CREDENTIAL_EVENT_TYPES.SKILL_ASSESSMENT_COMPLETED, async () => {
      await credentialService.handleSkillAssessmentCompleted(event);
    });
  };

  const processLearningProgress = async (event: LearningProgressEvent): Promise<void> => {
    if (!mergedConfig.enabled) {
      logger.debug({
        msg: 'Consumer disabled, skipping event',
        eventType: CREDENTIAL_EVENT_TYPES.LEARNING_PROGRESS,
      });
      return;
    }

    await processWithRetry(CREDENTIAL_EVENT_TYPES.LEARNING_PROGRESS, async () => {
      await credentialService.handleLearningProgressUpdated(event);
    });
  };

  const processEvent = async (eventType: CredentialEventType, payload: unknown): Promise<void> => {
    logger.info({ msg: 'Processing credential event', eventType });

    switch (eventType) {
      case CREDENTIAL_EVENT_TYPES.CREDENTIAL_EARNED:
        await processCredentialEarned(payload as CredentialEarnedEvent);
        break;

      case CREDENTIAL_EVENT_TYPES.CREDENTIAL_REVOKED:
        await processCredentialRevoked(payload as CredentialRevokedEvent);
        break;

      case CREDENTIAL_EVENT_TYPES.CREDENTIAL_RENEWED:
        await processCredentialRenewed(payload as CredentialRenewedEvent);
        break;

      case CREDENTIAL_EVENT_TYPES.SKILL_ASSESSMENT_COMPLETED:
        await processSkillAssessmentCompleted(payload as SkillAssessmentCompletedEvent);
        break;

      case CREDENTIAL_EVENT_TYPES.LEARNING_PROGRESS:
        await processLearningProgress(payload as LearningProgressEvent);
        break;

      default:
        logger.warn({ msg: 'Unknown credential event type', eventType: eventType as string });
    }
  };

  const getStats = (): ConsumerStats => ({ ...stats });

  const resetStats = (): void => {
    stats.eventsProcessed = 0;
    stats.eventsFailed = 0;
    stats.eventsRetried = 0;
    stats.lastEventAt = null;
    stats.eventsByType = {};
  };

  return {
    processCredentialEarned,
    processCredentialRevoked,
    processCredentialRenewed,
    processSkillAssessmentCompleted,
    processLearningProgress,
    processEvent,
    getStats,
    resetStats,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
