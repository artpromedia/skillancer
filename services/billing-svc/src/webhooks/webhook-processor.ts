// @ts-nocheck
/**
 * @module @skillancer/billing-svc/webhooks/webhook-processor
 * Stripe Webhook Processor with production-grade reliability
 *
 * Features:
 * - Signature verification (CRITICAL for security)
 * - Idempotency handling (prevents duplicate processing)
 * - Event ordering (handles out-of-order delivery)
 * - Retry logic with exponential backoff
 * - Dead letter queue for failed events
 * - Comprehensive logging and metrics
 */

import { prisma } from '@skillancer/database';
import Stripe from 'stripe';

import { logger } from '../lib/logger.js';
import {
  handleAccountUpdated,
  handlePayoutPaid,
  handlePayoutFailed,
  handleTransferCreated,
  handleAccountDeauthorized,
} from './handlers/connect-handlers.js';
import {
  handleDisputeCreated,
  handleDisputeUpdated,
  handleDisputeClosed,
} from './handlers/dispute-handlers.js';
import {
  handlePaymentIntentSucceeded,
  handlePaymentIntentFailed,
  handlePaymentIntentRequiresAction,
} from './handlers/payment-intent-handlers.js';
import {
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
} from './handlers/subscription-handlers.js';

// =============================================================================
// TYPES
// =============================================================================

export interface WebhookProcessingResult {
  success: boolean;
  eventId: string;
  eventType: string;
  processed: boolean;
  skipped: boolean;
  error?: string;
  processingTimeMs: number;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
    previous_attributes?: Record<string, unknown>;
  };
  created: number;
  livemode: boolean;
  api_version: string;
}

export interface WebhookMetrics {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  averageProcessingTimeMs: number;
  eventTypeCounts: Record<string, number>;
}

type WebhookHandler = (event: Stripe.Event) => Promise<void>;

// =============================================================================
// WEBHOOK PROCESSOR CLASS
// =============================================================================

export class WebhookProcessor {
  private stripe: Stripe;
  private webhookSecret: string;
  private handlers: Map<string, WebhookHandler>;
  private metrics: WebhookMetrics;
  private maxRetries: number = 3;
  private retryDelays: number[] = [1000, 5000, 30000]; // 1s, 5s, 30s

  constructor(stripeSecretKey: string, webhookSecret: string) {
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
    });
    this.webhookSecret = webhookSecret;
    this.handlers = new Map();
    this.metrics = {
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      averageProcessingTimeMs: 0,
      eventTypeCounts: {},
    };

    this.registerHandlers();
  }

  /**
   * Register all webhook event handlers
   */
  private registerHandlers(): void {
    // Payment Intent events
    this.handlers.set('payment_intent.succeeded', handlePaymentIntentSucceeded);
    this.handlers.set('payment_intent.payment_failed', handlePaymentIntentFailed);
    this.handlers.set('payment_intent.requires_action', handlePaymentIntentRequiresAction);

    // Invoice events
    this.handlers.set('invoice.paid', handleInvoicePaid);
    this.handlers.set('invoice.payment_failed', handleInvoicePaymentFailed);

    // Subscription events
    this.handlers.set('customer.subscription.created', handleSubscriptionCreated);
    this.handlers.set('customer.subscription.updated', handleSubscriptionUpdated);
    this.handlers.set('customer.subscription.deleted', handleSubscriptionDeleted);

    // Connect events
    this.handlers.set('account.updated', handleAccountUpdated);
    this.handlers.set('account.application.deauthorized', handleAccountDeauthorized);
    this.handlers.set('payout.paid', handlePayoutPaid);
    this.handlers.set('payout.failed', handlePayoutFailed);
    this.handlers.set('transfer.created', handleTransferCreated);

    // Dispute events
    this.handlers.set('charge.dispute.created', handleDisputeCreated);
    this.handlers.set('charge.dispute.updated', handleDisputeUpdated);
    this.handlers.set('charge.dispute.closed', handleDisputeClosed);

    logger.info(`Registered ${this.handlers.size} webhook handlers`);
  }

  /**
   * Verify webhook signature - CRITICAL for security
   */
  verifySignature(payload: string | Buffer, signature: string): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (error) {
      logger.error({ error }, 'Webhook signature verification failed');
      throw new WebhookSignatureError('Invalid webhook signature');
    }
  }

  /**
   * Process a webhook event with full reliability guarantees
   */
  async processEvent(event: Stripe.Event): Promise<WebhookProcessingResult> {
    const startTime = Date.now();
    const eventId = event.id;
    const eventType = event.type;

    logger.info({ eventId, eventType }, 'Processing webhook event');

    try {
      // Check idempotency - have we already processed this event?
      const existingEvent = await this.getProcessedEvent(eventId);
      if (existingEvent) {
        logger.info({ eventId }, 'Event already processed, skipping');
        this.metrics.skippedCount++;
        return {
          success: true,
          eventId,
          eventType,
          processed: false,
          skipped: true,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Check event ordering for related events
      await this.ensureEventOrdering(event);

      // Mark event as processing
      await this.markEventProcessing(event);

      // Get handler for event type
      const handler = this.handlers.get(eventType);
      if (!handler) {
        logger.warn({ eventType }, 'No handler registered for event type');
        await this.markEventCompleted(eventId, 'no_handler');
        return {
          success: true,
          eventId,
          eventType,
          processed: false,
          skipped: true,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Execute handler with retry logic
      await this.executeWithRetry(handler, event);

      // Mark event as completed
      await this.markEventCompleted(eventId, 'success');

      // Update metrics
      this.updateMetrics(eventType, Date.now() - startTime, true);

      logger.info(
        { eventId, eventType, processingTimeMs: Date.now() - startTime },
        'Webhook event processed successfully'
      );

      return {
        success: true,
        eventId,
        eventType,
        processed: true,
        skipped: false,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ eventId, eventType, error: errorMessage }, 'Webhook processing failed');

      // Send to dead letter queue
      await this.sendToDeadLetterQueue(event, errorMessage);

      // Mark event as failed
      await this.markEventFailed(eventId, errorMessage);

      // Update metrics
      this.updateMetrics(eventType, Date.now() - startTime, false);

      return {
        success: false,
        eventId,
        eventType,
        processed: false,
        skipped: false,
        error: errorMessage,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute handler with exponential backoff retry
   */
  private async executeWithRetry(handler: WebhookHandler, event: Stripe.Event): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        await handler(event);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.maxRetries) {
          const delay = this.retryDelays[attempt] || this.retryDelays[this.retryDelays.length - 1];
          logger.warn(
            { eventId: event.id, attempt: attempt + 1, delay, error: lastError.message },
            'Webhook handler failed, retrying'
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Check if event was already processed (idempotency)
   */
  private async getProcessedEvent(eventId: string): Promise<boolean> {
    const event = await prisma.webhookEvent.findUnique({
      where: { stripeEventId: eventId },
    });
    return event?.status === 'completed';
  }

  /**
   * Ensure events are processed in correct order for related resources
   */
  private async ensureEventOrdering(event: Stripe.Event): Promise<void> {
    // For certain event types, we need to ensure ordering
    const orderingRequired = [
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ];

    if (!orderingRequired.includes(event.type)) {
      return;
    }

    // Check for pending events with earlier timestamps for the same resource
    const resourceId = (event.data.object as { id?: string }).id;
    if (!resourceId) return;

    const pendingEarlierEvents = await prisma.webhookEvent.findMany({
      where: {
        resourceId,
        status: 'processing',
        createdAt: { lt: new Date(event.created * 1000) },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Wait for earlier events to complete (with timeout)
    for (const pendingEvent of pendingEarlierEvents) {
      await this.waitForEventCompletion(pendingEvent.stripeEventId, 30000);
    }
  }

  /**
   * Wait for an event to complete processing
   */
  private async waitForEventCompletion(eventId: string, timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 500;

    while (Date.now() - startTime < timeoutMs) {
      const event = await prisma.webhookEvent.findUnique({
        where: { stripeEventId: eventId },
      });

      if (!event || event.status === 'completed' || event.status === 'failed') {
        return;
      }

      await this.sleep(pollInterval);
    }

    logger.warn({ eventId }, 'Timeout waiting for event completion');
  }

  /**
   * Mark event as being processed
   */
  private async markEventProcessing(event: Stripe.Event): Promise<void> {
    const resourceId = (event.data.object as { id?: string }).id;

    await prisma.webhookEvent.upsert({
      where: { stripeEventId: event.id },
      create: {
        stripeEventId: event.id,
        eventType: event.type,
        resourceId: resourceId || null,
        payload: event as unknown as Record<string, unknown>,
        status: 'processing',
        attempts: 1,
        createdAt: new Date(event.created * 1000),
      },
      update: {
        status: 'processing',
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });
  }

  /**
   * Mark event as completed
   */
  private async markEventCompleted(eventId: string, result: string): Promise<void> {
    await prisma.webhookEvent.update({
      where: { stripeEventId: eventId },
      data: {
        status: 'completed',
        processedAt: new Date(),
        result,
      },
    });
  }

  /**
   * Mark event as failed
   */
  private async markEventFailed(eventId: string, error: string): Promise<void> {
    await prisma.webhookEvent.update({
      where: { stripeEventId: eventId },
      data: {
        status: 'failed',
        error,
        lastAttemptAt: new Date(),
      },
    });
  }

  /**
   * Send failed event to dead letter queue for manual review
   */
  private async sendToDeadLetterQueue(event: Stripe.Event, error: string): Promise<void> {
    await prisma.webhookDeadLetter.create({
      data: {
        stripeEventId: event.id,
        eventType: event.type,
        payload: event as unknown as Record<string, unknown>,
        error,
        createdAt: new Date(),
      },
    });

    // Alert on critical failures
    const criticalEvents = ['payment_intent.succeeded', 'payout.failed', 'charge.dispute.created'];
    if (criticalEvents.includes(event.type)) {
      await this.alertCriticalFailure(event, error);
    }

    logger.error({ eventId: event.id, eventType: event.type }, 'Event sent to dead letter queue');
  }

  /**
   * Alert on critical webhook failures
   */
  private async alertCriticalFailure(event: Stripe.Event, error: string): Promise<void> {
    logger.error(
      {
        alertType: 'CRITICAL_WEBHOOK_FAILURE',
        eventId: event.id,
        eventType: event.type,
        error,
        livemode: event.livemode,
      },
      '🚨 CRITICAL: Webhook processing failure requires immediate attention'
    );

    // TODO: Send to PagerDuty
  }

  /**
   * Update processing metrics
   */
  private updateMetrics(eventType: string, processingTimeMs: number, success: boolean): void {
    this.metrics.totalProcessed++;
    if (success) {
      this.metrics.successCount++;
    } else {
      this.metrics.failureCount++;
    }

    // Update running average
    this.metrics.averageProcessingTimeMs =
      (this.metrics.averageProcessingTimeMs * (this.metrics.totalProcessed - 1) +
        processingTimeMs) /
      this.metrics.totalProcessed;

    // Track by event type
    this.metrics.eventTypeCounts[eventType] = (this.metrics.eventTypeCounts[eventType] || 0) + 1;
  }

  /**
   * Get current metrics
   */
  getMetrics(): WebhookMetrics {
    return { ...this.metrics };
  }

  /**
   * Reprocess failed events from dead letter queue
   */
  async reprocessDeadLetterQueue(limit: number = 10): Promise<number> {
    const deadLetterEvents = await prisma.webhookDeadLetter.findMany({
      where: { reprocessedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    let reprocessedCount = 0;

    for (const dlEvent of deadLetterEvents) {
      try {
        const event = dlEvent.payload as unknown as Stripe.Event;
        const result = await this.processEvent(event);

        if (result.success) {
          await prisma.webhookDeadLetter.update({
            where: { id: dlEvent.id },
            data: { reprocessedAt: new Date() },
          });
          reprocessedCount++;
        }
      } catch (error) {
        logger.error(
          { eventId: dlEvent.stripeEventId, error },
          'Failed to reprocess dead letter event'
        );
      }
    }

    return reprocessedCount;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// ERRORS
// =============================================================================

export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookSignatureError';
  }
}

export class WebhookProcessingError extends Error {
  constructor(
    message: string,
    public eventId: string,
    public eventType: string
  ) {
    super(message);
    this.name = 'WebhookProcessingError';
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let webhookProcessor: WebhookProcessor | null = null;

export function initializeWebhookProcessor(
  stripeSecretKey: string,
  webhookSecret: string
): WebhookProcessor {
  webhookProcessor = new WebhookProcessor(stripeSecretKey, webhookSecret);
  return webhookProcessor;
}

export function getWebhookProcessor(): WebhookProcessor {
  if (!webhookProcessor) {
    throw new Error('WebhookProcessor not initialized. Call initializeWebhookProcessor first.');
  }
  return webhookProcessor;
}
