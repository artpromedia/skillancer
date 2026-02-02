/**
 * SendGrid Webhook Handler
 *
 * Fastify plugin for processing SendGrid webhook events
 */

import { logger } from '@skillancer/logger';

import {
  getEmailLoggingService,
  type SendGridWebhookEvent,
} from '../services/email-logging.service.js';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ============================================================================
// Types
// ============================================================================

export interface WebhookConfig {
  /** Path prefix for webhook endpoints */
  prefix?: string;
  /** Enable signature verification */
  verifySignature?: boolean;
  /** Custom webhook secret (falls back to env var) */
  webhookSecret?: string;
  /** Callback for successful webhook processing */
  onSuccess?: (events: SendGridWebhookEvent[]) => void | Promise<void>;
  /** Callback for webhook errors */
  onError?: (error: Error, events?: SendGridWebhookEvent[]) => void | Promise<void>;
}

// ============================================================================
// Signature Verification
// ============================================================================

/**
 * Verify SendGrid webhook signature
 */
function verifySignature(
  payload: string,
  signature: string,
  timestamp: string,
  _webhookSecret?: string
): boolean {
  const loggingService = getEmailLoggingService();
  return loggingService.verifyWebhookSignature(payload, signature, timestamp);
}

// ============================================================================
// Fastify Plugin
// ============================================================================

/**
 * Register SendGrid webhook routes with Fastify
 */
export async function registerWebhookRoutes(
  fastify: FastifyInstance,
  config?: WebhookConfig
): Promise<void> {
  const prefix = config?.prefix || '/webhooks/sendgrid';
  const verifySignatures = config?.verifySignature !== false;

  // Health check endpoint
  fastify.get(`${prefix}/health`, async (_request, reply) => {
    return reply.send({ status: 'ok', service: 'sendgrid-webhook' });
  });

  // Main webhook endpoint
  fastify.post<{
    Body: SendGridWebhookEvent[];
  }>(
    prefix,
    {
      preHandler: (request, reply, done) => {
        if (!verifySignatures) {
          done();
          return;
        }

        const signature = request.headers['x-twilio-email-event-webhook-signature'] as string;
        const timestamp = request.headers['x-twilio-email-event-webhook-timestamp'] as string;

        if (!signature || !timestamp) {
          logger.warn({}, 'Missing webhook signature headers');
          void reply.status(401).send({ error: 'Missing signature headers' });
          done(new Error('Missing signature headers'));
          return;
        }

        const rawBody = JSON.stringify(request.body);
        const isValid = verifySignature(rawBody, signature, timestamp, config?.webhookSecret);

        if (!isValid) {
          logger.warn({}, 'Invalid webhook signature');
          void reply.status(401).send({ error: 'Invalid signature' });
          done(new Error('Invalid signature'));
          return;
        }
        done();
      },
    },
    async (request: FastifyRequest<{ Body: SendGridWebhookEvent[] }>, reply: FastifyReply) => {
      const events = request.body;

      if (!Array.isArray(events)) {
        logger.warn({}, 'Invalid webhook payload - expected array');
        return reply.status(400).send({ error: 'Invalid payload format' });
      }

      try {
        const loggingService = getEmailLoggingService();
        const logs = await loggingService.processWebhook(events);

        // Call success callback if provided
        if (config?.onSuccess) {
          await config.onSuccess(events);
        }

        // SendGrid expects 200 response
        return reply.status(200).send({
          success: true,
          processed: logs.length,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');

        logger.error(
          {
            error: err.message,
            eventCount: events.length,
          },
          'Webhook processing failed'
        );

        // Call error callback if provided
        if (config?.onError) {
          await config.onError(err, events);
        }

        // Still return 200 to prevent SendGrid from retrying
        return reply.status(200).send({
          success: false,
          error: err.message,
        });
      }
    }
  );

  logger.info(
    {
      prefix,
      verifySignatures,
    },
    'SendGrid webhook routes registered'
  );
}

// ============================================================================
// Standalone Handler
// ============================================================================

/**
 * Standalone webhook handler for non-Fastify environments
 */
export async function handleWebhook(
  events: SendGridWebhookEvent[],
  options?: {
    signature?: string;
    timestamp?: string;
    webhookSecret?: string;
  }
): Promise<{ success: boolean; processed: number; error?: string }> {
  const loggingService = getEmailLoggingService();

  // Verify signature if provided
  if (options?.signature && options?.timestamp) {
    const rawBody = JSON.stringify(events);
    const isValid = loggingService.verifyWebhookSignature(
      rawBody,
      options.signature,
      options.timestamp
    );

    if (!isValid) {
      return {
        success: false,
        processed: 0,
        error: 'Invalid signature',
      };
    }
  }

  try {
    const logs = await loggingService.processWebhook(events);
    return {
      success: true,
      processed: logs.length,
    };
  } catch (error) {
    return {
      success: false,
      processed: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Generate a test webhook event
 */
export function createTestWebhookEvent(
  overrides?: Partial<SendGridWebhookEvent>
): SendGridWebhookEvent {
  return {
    email: 'test@example.com',
    timestamp: Math.floor(Date.now() / 1000),
    event: 'delivered',
    sg_event_id: `test-${Date.now()}`,
    sg_message_id: `test-msg-${Date.now()}`,
    ...overrides,
  };
}

/**
 * Create a batch of test webhook events
 */
export function createTestWebhookBatch(
  events: Array<{ event: string; email?: string }>
): SendGridWebhookEvent[] {
  const baseTimestamp = Math.floor(Date.now() / 1000);

  return events.map((e, i) => ({
    email: e.email || 'test@example.com',
    timestamp: baseTimestamp + i,
    event: e.event,
    sg_event_id: `test-${baseTimestamp}-${i}`,
    sg_message_id: `test-msg-${baseTimestamp}`,
  }));
}
