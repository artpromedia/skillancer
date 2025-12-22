/**
 * @module @skillancer/cockpit-svc/workers/webhook-processor
 * Webhook Processor Worker - Processes incoming webhook events
 */

import { WebhookEventRepository } from '../repositories/webhook-event.repository.js';
import { IntegrationPlatformService } from '../services/integrations/integration-platform.service.js';

import type { EncryptionService } from '../services/encryption.service.js';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

/**
 * Configuration for the webhook processor worker
 */
export interface WebhookProcessorConfig {
  /** Interval between processing cycles in milliseconds */
  pollIntervalMs: number;
  /** Maximum events to process per cycle */
  batchSize: number;
  /** Maximum retry attempts for failed events */
  maxRetries: number;
  /** Delay before retrying failed events in milliseconds */
  retryDelayMs: number;
  /** Enable/disable the worker */
  enabled: boolean;
}

const DEFAULT_CONFIG: WebhookProcessorConfig = {
  pollIntervalMs: 5000, // 5 seconds
  batchSize: 50,
  maxRetries: 3,
  retryDelayMs: 30000, // 30 seconds
  enabled: true,
};

/**
 * Worker for processing webhook events
 */
export class WebhookProcessorWorker {
  private readonly service: IntegrationPlatformService;
  private readonly webhookRepo: WebhookEventRepository;
  private readonly config: WebhookProcessorConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
    private readonly encryption: EncryptionService,
    config: Partial<WebhookProcessorConfig> = {}
  ) {
    this.service = new IntegrationPlatformService(prisma, logger, encryption);
    this.webhookRepo = new WebhookEventRepository(prisma);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the worker
   */
  start(): void {
    if (!this.config.enabled) {
      this.logger.info('Webhook processor worker is disabled');
      return;
    }

    if (this.intervalId) {
      this.logger.warn('Webhook processor worker is already running');
      return;
    }

    this.logger.info(
      { pollIntervalMs: this.config.pollIntervalMs, batchSize: this.config.batchSize },
      'Starting webhook processor worker'
    );

    // Run immediately, then on interval
    void this.runCycle();
    this.intervalId = setInterval(() => void this.runCycle(), this.config.pollIntervalMs);
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info('Webhook processor worker stopped');
    }
  }

  /**
   * Run a processing cycle
   */
  private async runCycle(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Webhook processing already in progress, skipping');
      return;
    }

    this.isRunning = true;

    try {
      await this.processPendingEvents();
      await this.retryFailedEvents();
    } catch (error) {
      this.logger.error({ error: (error as Error).message }, 'Error in webhook processing cycle');
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process pending webhook events
   */
  private async processPendingEvents(): Promise<void> {
    const events = await this.webhookRepo.findPending(this.config.batchSize);

    if (events.length === 0) {
      return;
    }

    this.logger.info({ count: events.length }, 'Processing pending webhook events');

    for (const event of events) {
      await this.processEvent(event.id);
    }
  }

  /**
   * Retry failed webhook events
   */
  private async retryFailedEvents(): Promise<void> {
    const failedEvents = await this.webhookRepo.findFailedForRetry(
      this.config.maxRetries,
      this.config.batchSize
    );

    if (failedEvents.length === 0) {
      return;
    }

    this.logger.info({ count: failedEvents.length }, 'Retrying failed webhook events');

    for (const event of failedEvents) {
      // Check if enough time has passed since last attempt
      const lastAttemptAge = event.processedAt
        ? Date.now() - event.processedAt.getTime()
        : this.config.retryDelayMs + 1;

      if (lastAttemptAge >= this.config.retryDelayMs) {
        await this.processEvent(event.id);
      }
    }
  }

  /**
   * Process a single webhook event
   */
  private async processEvent(eventId: string): Promise<void> {
    try {
      await this.service.processWebhookEvent(eventId);
    } catch (error) {
      this.logger.error(
        { eventId, error: (error as Error).message },
        'Failed to process webhook event'
      );
    }
  }

  /**
   * Clean up old processed events
   */
  async cleanupOldEvents(olderThanDays: number = 30): Promise<number> {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - olderThanDays);

    const deleted = await this.webhookRepo.deleteOldEvents(threshold);

    this.logger.info({ deleted, olderThanDays }, 'Cleaned up old webhook events');

    return deleted;
  }

  /**
   * Get worker status
   */
  getStatus(): {
    running: boolean;
    config: WebhookProcessorConfig;
  } {
    return {
      running: !!this.intervalId,
      config: this.config,
    };
  }
}
