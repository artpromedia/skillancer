// @ts-nocheck
/**
 * @module @skillancer/integration-hub-svc/optimization/prefetch
 * Prefetch Service - Proactively fetches widget data
 */

import { smartCache } from '../cache/smart-cache.service.js';
import { connectorRegistry } from '../connectors/registry.js';
import type { OAuthTokens } from '../types/index.js';

interface PrefetchJob {
  integrationId: string;
  widgetId: string;
  priority: 'high' | 'medium' | 'low';
  scheduledAt: Date;
}

export class PrefetchService {
  private queue: PrefetchJob[] = [];
  private isProcessing = false;
  private readonly maxConcurrent = 3;

  /**
   * Prefetch all widgets for a workspace
   */
  async prefetchWorkspace(
    workspaceId: string,
    integrations: Array<{ id: string; connectorSlug: string; tokens: OAuthTokens }>
  ): Promise<void> {
    for (const integration of integrations) {
      const connector = connectorRegistry.get(integration.connectorSlug);
      if (!connector) continue;

      for (const widget of connector.supportedWidgets) {
        this.addToQueue({
          integrationId: integration.id,
          widgetId: widget.id,
          priority: 'medium',
          scheduledAt: new Date(),
        });
      }
    }

    this.processQueue();
  }

  /**
   * Prefetch specific widgets (high priority)
   */
  async prefetchWidgets(
    widgets: Array<{ integrationId: string; widgetId: string }>
  ): Promise<void> {
    for (const widget of widgets) {
      this.addToQueue({
        ...widget,
        priority: 'high',
        scheduledAt: new Date(),
      });
    }

    this.processQueue();
  }

  /**
   * Schedule refresh before TTL expires
   */
  scheduleRefresh(integrationId: string, widgetId: string, ttlSeconds: number): void {
    const refreshAt = new Date(Date.now() + (ttlSeconds - 60) * 1000); // 1 min before expiry

    this.addToQueue({
      integrationId,
      widgetId,
      priority: 'low',
      scheduledAt: refreshAt,
    });
  }

  /**
   * Add job to queue
   */
  private addToQueue(job: PrefetchJob): void {
    // Deduplicate
    const exists = this.queue.some(
      (j) => j.integrationId === job.integrationId && j.widgetId === job.widgetId
    );
    if (exists) return;

    this.queue.push(job);
    this.sortQueue();
  }

  /**
   * Sort queue by priority and scheduled time
   */
  private sortQueue(): void {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    this.queue.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.scheduledAt.getTime() - b.scheduledAt.getTime();
    });
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const now = Date.now();
        const readyJobs = this.queue.filter((j) => j.scheduledAt.getTime() <= now);

        if (readyJobs.length === 0) {
          // Wait for next scheduled job
          const nextJob = this.queue[0];
          if (nextJob) {
            const delay = nextJob.scheduledAt.getTime() - now;
            await this.sleep(Math.min(delay, 5000));
          }
          continue;
        }

        // Process up to maxConcurrent jobs
        const batch = readyJobs.slice(0, this.maxConcurrent);
        await Promise.allSettled(batch.map((job) => this.executeJob(job)));

        // Remove processed jobs
        for (const job of batch) {
          const index = this.queue.indexOf(job);
          if (index > -1) this.queue.splice(index, 1);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute a prefetch job
   */
  private async executeJob(job: PrefetchJob): Promise<void> {
    try {
      // Check if already cached and fresh
      const cacheKey = `widget:${job.integrationId}:${job.widgetId}`;
      const cached = await smartCache.get(cacheKey);
      if (cached && !this.isStale(cached)) {
        return; // Still fresh, skip
      }

      // Fetch would go here - needs integration tokens
      console.log(`Prefetching ${job.widgetId} for ${job.integrationId}`);
    } catch (error) {
      console.error(`Prefetch failed for ${job.widgetId}:`, error);
    }
  }

  /**
   * Check if cached data is stale
   */
  private isStale(cached: { expiresAt?: Date }): boolean {
    if (!cached.expiresAt) return true;
    const expiresAt = new Date(cached.expiresAt);
    const staleThreshold = 60 * 1000; // 1 minute before expiry
    return expiresAt.getTime() - Date.now() < staleThreshold;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    this.queue = [];
  }

  /**
   * Get queue status
   */
  getStatus(): { queueLength: number; isProcessing: boolean } {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
    };
  }
}

export const prefetchService = new PrefetchService();
