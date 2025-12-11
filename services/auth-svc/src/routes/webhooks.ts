/**
 * @module @skillancer/auth-svc/routes/webhooks
 * Webhook Handlers
 *
 * Handles incoming webhooks from:
 * - Persona (identity verification)
 */

import { prisma } from '@skillancer/database';
import { createLogger } from '@skillancer/logger';

import { getPersonaService, type PersonaWebhookPayload } from '../services/persona.service.js';
import { createVerificationService } from '../services/verification.service.js';

import type { FastifyPluginAsync } from 'fastify';

const logger = createLogger({ serviceName: 'webhooks' });

// =============================================================================
// WEBHOOK ROUTES
// =============================================================================

const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  await Promise.resolve();
  const verificationService = createVerificationService(prisma);
  const personaService = getPersonaService();

  // ===========================================================================
  // PERSONA WEBHOOKS
  // ===========================================================================

  /**
   * POST /webhooks/persona
   * Handle Persona verification events
   *
   * Events handled:
   * - inquiry.created
   * - inquiry.started
   * - inquiry.completed
   * - inquiry.failed
   * - inquiry.expired
   * - inquiry.approved
   * - inquiry.declined
   * - verification.created
   * - verification.passed
   * - verification.failed
   */
  fastify.post(
    '/persona',
    {
      config: {
        // Skip body parsing - we need raw body for signature verification
        rawBody: true,
      },
    },
    async (request, reply) => {
      // Verify webhook signature
      const signature = request.headers['persona-signature'] as string;
      const rawBody = (request as { rawBody?: string }).rawBody ?? '';

      if (!signature) {
        logger.warn('Persona webhook missing signature');
        return reply.status(401).send({ error: 'Missing signature' });
      }

      // Verify signature if webhook secret is configured
      if (personaService['config'].webhookSecret) {
        const isValid = personaService.verifyWebhookSignature(rawBody, signature);
        if (!isValid) {
          logger.warn('Persona webhook invalid signature');
          return reply.status(401).send({ error: 'Invalid signature' });
        }
      }

      try {
        const payload = request.body as PersonaWebhookPayload;

        // Parse the event
        const { eventType, inquiry, included } = personaService.parseWebhookEvent(payload);

        logger.info(
          {
            eventType,
            inquiryId: inquiry?.id,
          },
          'Received Persona webhook'
        );

        // Skip if no inquiry data
        if (!inquiry) {
          logger.debug({ eventType }, 'Webhook has no inquiry data, skipping');
          return await reply.status(200).send({ received: true, processed: false });
        }

        // Process the webhook
        const result = await verificationService.processWebhook(eventType, inquiry, included);

        logger.info(
          {
            eventType,
            inquiryId: result.inquiryId,
            statusUpdated: result.statusUpdated,
            badgeGranted: result.badgeGranted,
          },
          'Persona webhook processed'
        );

        return await reply.status(200).send({
          received: true,
          processed: result.success,
          inquiryId: result.inquiryId,
          statusUpdated: result.statusUpdated,
          badgeGranted: result.badgeGranted,
        });
      } catch (error) {
        logger.error({ error }, 'Persona webhook processing error');

        // Always return 200 to prevent Persona from retrying
        // We log the error for investigation
        return reply.status(200).send({
          received: true,
          processed: false,
          error: 'Processing error',
        });
      }
    }
  );

  /**
   * GET /webhooks/persona/test
   * Test endpoint to verify webhook configuration
   * Only available in development
   */
  if (process.env.NODE_ENV === 'development') {
    fastify.get('/persona/test', async (_request, reply) => {
      return reply.send({
        status: 'ok',
        configured: personaService.isConfigured(),
        webhookSecretConfigured: !!personaService['config'].webhookSecret,
      });
    });
  }
};

export default webhookRoutes;
