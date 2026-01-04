// @ts-nocheck
/**
 * Webhook Service
 *
 * Handles incoming webhooks from integration providers
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';
// Stub redis client - TODO: Replace with actual cache package
const redis = {
  get: async (key: string) => null,
  set: async (key: string, value: string, mode?: string, ttl?: number) => 'OK',
  del: async (...keys: string[]) => 1,
  exists: async (key: string) => 0,
  keys: async (pattern: string) => [] as string[],
  publish: async (channel: string, message: string) => 1,
};
import { connectorRegistry } from '../connectors/registry';
import type { WebhookResult } from '../connectors/base.connector';

// Webhook event types
export interface WebhookEvent {
  id: string;
  connectorSlug: string;
  integrationId: string;
  eventType: string;
  payload: Record<string, unknown>;
  receivedAt: Date;
  processedAt?: Date;
  status: 'pending' | 'processed' | 'failed';
  error?: string;
}

// Webhook registration result
export interface WebhookRegistration {
  webhookId: string;
  webhookUrl: string;
  webhookSecret: string;
  events: string[];
}

class WebhookService {
  private readonly REPLAY_WINDOW_SECONDS = 300; // 5 minutes
  private readonly PROCESSED_WEBHOOKS_TTL = 86400; // 24 hours

  /**
   * Register a webhook with the provider
   */
  async registerWebhook(integrationId: string, events: string[]): Promise<WebhookRegistration> {
    const integration = await prisma.workspaceIntegration.findUnique({
      where: { id: integrationId },
      include: { integrationType: true },
    });

    if (!integration) {
      throw new Error('Integration not found');
    }

    const connector = connectorRegistry.get(integration.integrationType.slug);
    if (!connector || !connector.webhookEnabled) {
      throw new Error('Connector does not support webhooks');
    }

    // Generate webhook secret
    const webhookSecret = this.generateWebhookSecret();

    // Build webhook URL
    const baseUrl = process.env.INTEGRATION_HUB_URL || 'https://api.skillancer.com/integration-hub';
    const webhookUrl = `${baseUrl}/webhooks/${integration.integrationType.slug}`;

    // Register with provider (connector-specific)
    // For now, we store the registration locally
    // Each connector can implement provider registration in handleWebhook setup

    // Update integration with webhook info
    await prisma.workspaceIntegration.update({
      where: { id: integrationId },
      data: {
        webhookId: `wh_${integrationId}`,
        webhookSecret: webhookSecret,
      },
    });

    logger.info('Webhook registered', {
      integrationId,
      connectorSlug: integration.integrationType.slug,
      events,
    });

    return {
      webhookId: `wh_${integrationId}`,
      webhookUrl,
      webhookSecret,
      events,
    };
  }

  /**
   * Handle incoming webhook from provider
   */
  async handleIncomingWebhook(
    connectorSlug: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>
  ): Promise<WebhookResult> {
    const connector = connectorRegistry.get(connectorSlug);
    if (!connector) {
      throw new Error(`Unknown connector: ${connectorSlug}`);
    }

    if (!connector.webhookEnabled || !connector.handleWebhook) {
      throw new Error(`Connector ${connectorSlug} does not support webhooks`);
    }

    // Extract signature from headers (provider-specific)
    const signature = this.extractSignature(connectorSlug, headers);

    // Check for replay attacks
    const webhookId = this.extractWebhookId(payload);
    if (webhookId) {
      const isReplay = await this.checkReplayAttack(webhookId);
      if (isReplay) {
        logger.warn('Webhook replay attack detected', { webhookId, connectorSlug });
        throw new Error('Webhook replay detected');
      }
    }

    // Process webhook through connector
    const result = await connector.handleWebhook(payload, signature);

    // Mark as processed to prevent replays
    if (webhookId) {
      await this.markWebhookProcessed(webhookId);
    }

    // Invalidate relevant caches
    if (result.integrationId) {
      await this.invalidateIntegrationCache(result.integrationId);
    }

    // Emit event for real-time updates
    await this.emitWebhookEvent(connectorSlug, result);

    logger.info('Webhook processed', {
      connectorSlug,
      eventType: result.eventType,
      integrationId: result.integrationId,
    });

    return result;
  }

  /**
   * Validate webhook signature
   */
  validateSignature(
    connectorSlug: string,
    payload: string | Buffer,
    signature: string,
    secret: string
  ): boolean {
    try {
      const algorithm = this.getSignatureAlgorithm(connectorSlug);
      const expectedSignature = this.computeSignature(algorithm, payload, secret);

      // Use timing-safe comparison
      const sigBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedSignature);

      if (sigBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return timingSafeEqual(sigBuffer, expectedBuffer);
    } catch (error) {
      logger.error('Signature validation error', { connectorSlug, error });
      return false;
    }
  }

  /**
   * Validate webhook timestamp (prevent replay attacks)
   */
  validateTimestamp(timestamp: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    const diff = Math.abs(now - timestamp);
    return diff <= this.REPLAY_WINDOW_SECONDS;
  }

  /**
   * Unregister webhook
   */
  async unregisterWebhook(integrationId: string): Promise<void> {
    const integration = await prisma.workspaceIntegration.findUnique({
      where: { id: integrationId },
      include: { integrationType: true },
    });

    if (!integration || !integration.webhookId) {
      return;
    }

    // Clear webhook info from integration
    await prisma.workspaceIntegration.update({
      where: { id: integrationId },
      data: {
        webhookId: null,
        webhookSecret: null,
      },
    });

    logger.info('Webhook unregistered', {
      integrationId,
      webhookId: integration.webhookId,
    });
  }

  /**
   * Get webhook events for an integration
   */
  async getWebhookEvents(
    integrationId: string,
    options: { limit?: number; status?: string } = {}
  ): Promise<WebhookEvent[]> {
    const { limit = 50, status } = options;
    const cacheKey = `webhook:events:${integrationId}`;

    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      const events = JSON.parse(cached) as WebhookEvent[];
      if (status) {
        return events.filter((e) => e.status === status).slice(0, limit);
      }
      return events.slice(0, limit);
    }

    // In production, these would be stored in a database table
    // For now, return empty array
    return [];
  }

  // Private helper methods

  private generateWebhookSecret(): string {
    const bytes = require('crypto').randomBytes(32);
    return bytes.toString('hex');
  }

  private extractSignature(connectorSlug: string, headers: Record<string, string>): string {
    // Different providers use different header names
    const headerMap: Record<string, string> = {
      slack: 'x-slack-signature',
      github: 'x-hub-signature-256',
      jira: 'x-atlassian-webhook-signature',
      notion: 'x-notion-signature',
      google: 'x-goog-signature',
    };

    const headerName = headerMap[connectorSlug] || 'x-webhook-signature';
    return headers[headerName] || headers[headerName.toLowerCase()] || '';
  }

  private extractWebhookId(payload: Record<string, unknown>): string | null {
    // Try common webhook ID fields
    return (
      (payload.event_id as string) ||
      (payload.id as string) ||
      (payload.webhook_id as string) ||
      null
    );
  }

  private async checkReplayAttack(webhookId: string): Promise<boolean> {
    const key = `webhook:processed:${webhookId}`;
    const exists = await redis.exists(key);
    return exists === 1;
  }

  private async markWebhookProcessed(webhookId: string): Promise<void> {
    const key = `webhook:processed:${webhookId}`;
    await redis.set(key, '1', 'EX', this.PROCESSED_WEBHOOKS_TTL);
  }

  private async invalidateIntegrationCache(integrationId: string): Promise<void> {
    const pattern = `integration:${integrationId}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  private async emitWebhookEvent(connectorSlug: string, result: WebhookResult): Promise<void> {
    const channel = `webhook:${connectorSlug}:${result.eventType}`;
    await redis.publish(channel, JSON.stringify(result));
  }

  private getSignatureAlgorithm(connectorSlug: string): string {
    // Different providers use different algorithms
    const algorithmMap: Record<string, string> = {
      slack: 'sha256',
      github: 'sha256',
      jira: 'sha256',
      notion: 'sha256',
      google: 'sha256',
    };
    return algorithmMap[connectorSlug] || 'sha256';
  }

  private computeSignature(algorithm: string, payload: string | Buffer, secret: string): string {
    const hmac = createHmac(algorithm, secret);
    hmac.update(payload);
    return hmac.digest('hex');
  }
}

export const webhookService = new WebhookService();
