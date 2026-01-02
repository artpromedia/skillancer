// @ts-nocheck
/**
 * @module @skillancer/integration-hub-svc/webhooks/webhook-to-realtime
 * Webhook to Real-time Bridge
 *
 * Maps webhook events to affected widgets and broadcasts updates
 */

import { logger } from '@skillancer/logger';
import { eventBroadcaster } from '../realtime/event-broadcaster.js';
import { smartCache } from '../cache/smart-cache.service.js';
import { connectorRegistry } from '../connectors/registry.js';

// Widget mapping: which widgets are affected by which webhook events
const WEBHOOK_WIDGET_MAP: Record<string, Record<string, string[]>> = {
  github: {
    push: ['recent-commits', 'commit-activity', 'contributor-stats'],
    pull_request: ['pr-review-status', 'open-prs', 'pr-metrics'],
    pull_request_review: ['pr-review-status'],
    issues: ['issue-tracker', 'issue-metrics'],
    release: ['release-tracker', 'deployment-status'],
    workflow_run: ['ci-cd-status', 'build-health'],
    star: ['repo-metrics'],
    fork: ['repo-metrics'],
  },
  gitlab: {
    push: ['recent-commits', 'commit-activity'],
    merge_request: ['mr-review-status', 'open-mrs'],
    pipeline: ['ci-cd-status', 'pipeline-health'],
    issue: ['issue-tracker'],
    release: ['release-tracker'],
  },
  stripe: {
    'invoice.paid': ['revenue-metrics', 'mrr-metrics', 'accounts-receivable'],
    'invoice.payment_failed': ['revenue-metrics', 'payment-volume'],
    'customer.subscription.created': ['subscription-analytics', 'mrr-metrics'],
    'customer.subscription.updated': ['subscription-analytics', 'mrr-metrics'],
    'customer.subscription.deleted': ['subscription-analytics', 'mrr-metrics', 'churn-metrics'],
    'charge.succeeded': ['payment-volume', 'revenue-by-product'],
    'charge.refunded': ['refund-analytics', 'revenue-metrics'],
  },
  quickbooks: {
    'transaction.created': ['cash-position', 'profit-loss-summary', 'cash-flow'],
    'transaction.updated': ['cash-position', 'profit-loss-summary'],
    'invoice.created': ['accounts-receivable', 'revenue-by-customer'],
    'invoice.paid': ['accounts-receivable', 'cash-position'],
    'bill.created': ['accounts-payable'],
    'bill.paid': ['accounts-payable', 'cash-position'],
  },
  xero: {
    'INVOICE.CREATED': ['accounts-receivable', 'profit-loss-summary'],
    'INVOICE.PAID': ['accounts-receivable', 'cash-position'],
    'BILL.CREATED': ['accounts-payable'],
    'BILL.PAID': ['accounts-payable', 'cash-position'],
    'BANK_TRANSACTION.CREATED': ['cash-position', 'bank-summary'],
  },
  jira: {
    'jira:issue_created': ['issue-tracker', 'sprint-progress'],
    'jira:issue_updated': ['issue-tracker', 'sprint-progress'],
    sprint_started: ['sprint-progress'],
    sprint_closed: ['sprint-progress', 'velocity-metrics'],
  },
  slack: {
    message: ['channel-activity'],
    reaction_added: ['engagement-metrics'],
  },
};

export interface WebhookEvent {
  provider: string;
  eventType: string;
  integrationId: string;
  workspaceId: string;
  payload: unknown;
}

export class WebhookToRealtimeBridge {
  /**
   * Process webhook and broadcast updates
   */
  async processWebhook(event: WebhookEvent): Promise<void> {
    const { provider, eventType, integrationId, workspaceId, payload } = event;

    logger.info('Processing webhook for realtime', { provider, eventType, integrationId });

    try {
      // 1. Determine affected widgets
      const affectedWidgets = this.getAffectedWidgets(provider, eventType);

      if (affectedWidgets.length === 0) {
        logger.debug('No widgets affected by webhook', { provider, eventType });
        return;
      }

      // 2. Invalidate cache for affected widgets
      await this.invalidateWidgetCache(integrationId, affectedWidgets);

      // 3. Fetch fresh data for affected widgets
      const widgetData = await this.fetchWidgetData(integrationId, affectedWidgets);

      // 4. Broadcast updates to connected clients
      await this.broadcastUpdates(workspaceId, integrationId, widgetData);

      logger.info('Webhook processed for realtime', {
        provider,
        eventType,
        widgetsUpdated: affectedWidgets.length,
      });
    } catch (error) {
      logger.error('Error processing webhook for realtime', { error, provider, eventType });

      // Broadcast error to clients
      eventBroadcaster.broadcastError(workspaceId, {
        integrationId,
        code: 'WEBHOOK_PROCESSING_ERROR',
        message: 'Failed to process webhook update',
      });
    }
  }

  /**
   * Get widgets affected by webhook event
   */
  private getAffectedWidgets(provider: string, eventType: string): string[] {
    const providerMap = WEBHOOK_WIDGET_MAP[provider.toLowerCase()];
    if (!providerMap) return [];

    // Check exact match
    if (providerMap[eventType]) {
      return providerMap[eventType];
    }

    // Check partial match (e.g., "invoice.paid" matches "invoice.*")
    for (const [pattern, widgets] of Object.entries(providerMap)) {
      if (pattern.includes('*')) {
        const regex = new RegExp(`^${pattern.replace('*', '.*')}$`);
        if (regex.test(eventType)) {
          return widgets;
        }
      }
    }

    return [];
  }

  /**
   * Invalidate cache for affected widgets
   */
  private async invalidateWidgetCache(integrationId: string, widgets: string[]): Promise<void> {
    for (const widgetId of widgets) {
      await smartCache.invalidateWidget(integrationId, widgetId);
    }
  }

  /**
   * Fetch fresh data for widgets
   */
  private async fetchWidgetData(
    integrationId: string,
    widgets: string[]
  ): Promise<Map<string, unknown>> {
    const results = new Map<string, unknown>();

    // TODO: Get connector and tokens from database
    // For now, return empty - actual implementation would fetch from connector

    for (const widgetId of widgets) {
      try {
        // This would fetch from the connector
        // const data = await connector.getWidgetData(tokens, widgetId);
        // results.set(widgetId, data);
        results.set(widgetId, { updated: true, timestamp: Date.now() });
      } catch (error) {
        logger.warn('Failed to fetch widget data', { widgetId, error });
      }
    }

    return results;
  }

  /**
   * Broadcast updates to connected clients
   */
  private async broadcastUpdates(
    workspaceId: string,
    integrationId: string,
    widgetData: Map<string, unknown>
  ): Promise<void> {
    for (const [widgetId, data] of widgetData) {
      eventBroadcaster.broadcastWidgetUpdate(workspaceId, integrationId, widgetId, data);
    }

    // Broadcast sync complete
    eventBroadcaster.broadcastSyncComplete(workspaceId, integrationId, {
      success: true,
      widgetsUpdated: Array.from(widgetData.keys()),
      duration: 0,
    });
  }

  /**
   * Get all registered webhook-to-widget mappings
   */
  getMappings(): typeof WEBHOOK_WIDGET_MAP {
    return WEBHOOK_WIDGET_MAP;
  }

  /**
   * Register custom webhook-to-widget mapping
   */
  registerMapping(provider: string, eventType: string, widgets: string[]): void {
    if (!WEBHOOK_WIDGET_MAP[provider]) {
      WEBHOOK_WIDGET_MAP[provider] = {};
    }
    WEBHOOK_WIDGET_MAP[provider][eventType] = widgets;
  }
}

// Singleton instance
export const webhookToRealtimeBridge = new WebhookToRealtimeBridge();

