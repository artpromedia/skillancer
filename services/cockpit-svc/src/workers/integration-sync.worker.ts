/**
 * @module @skillancer/cockpit-svc/workers/integration-sync
 * Integration Sync Worker - Processes scheduled syncs
 */

import { IntegrationPlatformService } from '../services/integrations/integration-platform.service.js';

import type { EncryptionService } from '../services/encryption.service.js';
import type { PrismaClient } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';

/**
 * Configuration for the sync worker
 */
export interface IntegrationSyncWorkerConfig {
  /** Interval between sync cycles in milliseconds */
  pollIntervalMs: number;
  /** Maximum concurrent syncs */
  maxConcurrentSyncs: number;
  /** Token refresh buffer in minutes */
  tokenRefreshBufferMinutes: number;
  /** Enable/disable the worker */
  enabled: boolean;
}

const DEFAULT_CONFIG: IntegrationSyncWorkerConfig = {
  pollIntervalMs: 60000, // 1 minute
  maxConcurrentSyncs: 5,
  tokenRefreshBufferMinutes: 5,
  enabled: true,
};

/**
 * Worker for processing scheduled integration syncs
 */
export class IntegrationSyncWorker {
  private readonly service: IntegrationPlatformService;
  private readonly config: IntegrationSyncWorkerConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private activeSyncs = 0;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
    private readonly encryption: EncryptionService,
    config: Partial<IntegrationSyncWorkerConfig> = {}
  ) {
    this.service = new IntegrationPlatformService(prisma, logger, encryption);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the worker
   */
  start(): void {
    if (!this.config.enabled) {
      this.logger.info('Integration sync worker is disabled');
      return;
    }

    if (this.intervalId) {
      this.logger.warn('Integration sync worker is already running');
      return;
    }

    this.logger.info(
      {
        pollIntervalMs: this.config.pollIntervalMs,
        maxConcurrentSyncs: this.config.maxConcurrentSyncs,
      },
      'Starting integration sync worker'
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
      this.logger.info('Integration sync worker stopped');
    }
  }

  /**
   * Run a sync cycle
   */
  private async runCycle(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Sync cycle already in progress, skipping');
      return;
    }

    this.isRunning = true;

    try {
      // First, refresh expiring tokens
      await this.refreshExpiringTokens();

      // Then, process scheduled syncs
      await this.processScheduledSyncs();
    } catch (error) {
      this.logger.error({ error: (error as Error).message }, 'Error in sync cycle');
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Refresh tokens that are about to expire
   */
  private async refreshExpiringTokens(): Promise<void> {
    try {
      await this.service.refreshExpiringTokens(this.config.tokenRefreshBufferMinutes);
    } catch (error) {
      this.logger.error({ error: (error as Error).message }, 'Error refreshing tokens');
    }
  }

  /**
   * Process integrations that are due for sync
   */
  private async processScheduledSyncs(): Promise<void> {
    const dueIntegrations = await this.service.getIntegrationsDueForSync();

    if (dueIntegrations.length === 0) {
      this.logger.debug('No integrations due for sync');
      return;
    }

    this.logger.info({ count: dueIntegrations.length }, 'Processing scheduled syncs');

    // Process with concurrency limit
    const queue = [...dueIntegrations];

    while (queue.length > 0 && this.activeSyncs < this.config.maxConcurrentSyncs) {
      const integration = queue.shift();
      if (!integration) break;

      this.activeSyncs++;

      // Don't await - run concurrently
      this.processSingleSync(integration.id, integration.userId).finally(() => {
        this.activeSyncs--;
      });
    }
  }

  /**
   * Process a single sync
   */
  private async processSingleSync(integrationId: string, userId: string): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.service.triggerSync(integrationId, userId, {
        fullSync: false,
      });

      const durationMs = Date.now() - startTime;

      this.logger.info(
        {
          integrationId,
          syncLogId: result.syncLogId,
          recordsProcessed: result.recordsProcessed,
          recordsCreated: result.recordsCreated,
          recordsUpdated: result.recordsUpdated,
          durationMs,
        },
        'Scheduled sync completed'
      );
    } catch (error) {
      const durationMs = Date.now() - startTime;

      this.logger.error(
        { integrationId, error: (error as Error).message, durationMs },
        'Scheduled sync failed'
      );
    }
  }

  /**
   * Get worker status
   */
  getStatus(): {
    running: boolean;
    activeSyncs: number;
    config: IntegrationSyncWorkerConfig;
  } {
    return {
      running: !!this.intervalId,
      activeSyncs: this.activeSyncs,
      config: this.config,
    };
  }
}
