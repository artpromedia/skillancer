/**
 * Webhook Routes for delivery tracking
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { NotificationService } from '../services/notification.service.js';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { getConfig } from '../config/index.js';

const prisma = new PrismaClient();
const notificationService = new NotificationService(prisma);

export async function webhookRoutes(fastify: FastifyInstance) {
  // SendGrid webhook for email events
  fastify.post('/sendgrid', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Verify SendGrid webhook signature
      const isValid = verifySendGridSignature(request);
      if (!isValid) {
        return reply.status(401).send({ error: 'Invalid signature' });
      }

      const events = request.body as SendGridEvent[];

      for (const event of events) {
        await notificationService.handleDeliveryWebhook(
          'SENDGRID',
          mapSendGridEvent(event.event),
          event.sg_message_id,
          new Date(event.timestamp * 1000),
          {
            email: event.email,
            reason: event.reason,
            category: event.category,
          }
        );
      }

      return reply.status(200).send({ received: true });
    } catch (error: any) {
      console.error('SendGrid webhook error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Firebase webhook (if using Firebase functions for delivery receipts)
  fastify.post('/firebase', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { messageId, eventType, timestamp, metadata } = request.body as {
        messageId: string;
        eventType: string;
        timestamp: string;
        metadata?: Record<string, unknown>;
      };

      await notificationService.handleDeliveryWebhook(
        'FIREBASE',
        eventType,
        messageId,
        new Date(timestamp),
        metadata
      );

      return reply.status(200).send({ received: true });
    } catch (error: any) {
      console.error('Firebase webhook error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });
}

// SendGrid event types
interface SendGridEvent {
  email: string;
  timestamp: number;
  event: string;
  sg_message_id: string;
  reason?: string;
  category?: string[];
}

// Verify SendGrid webhook signature
function verifySendGridSignature(request: FastifyRequest): boolean {
  try {
    const config = getConfig();
    const webhookKey = config.sendgridWebhookKey;

    if (!webhookKey) {
      // Skip verification if key not configured
      return true;
    }

    const signature = request.headers['x-twilio-email-event-webhook-signature'] as string;
    const timestamp = request.headers['x-twilio-email-event-webhook-timestamp'] as string;

    if (!signature || !timestamp) {
      return false;
    }

    const payload = timestamp + JSON.stringify(request.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookKey)
      .update(payload)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// Map SendGrid event types to our internal types
function mapSendGridEvent(event: string): string {
  const mapping: Record<string, string> = {
    delivered: 'delivered',
    open: 'opened',
    click: 'clicked',
    bounce: 'bounced',
    dropped: 'failed',
    deferred: 'failed',
    spamreport: 'failed',
    unsubscribe: 'unsubscribed',
  };

  return mapping[event] || event;
}
