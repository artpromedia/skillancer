/**
 * @module @skillancer/cockpit-svc/workers/market-sync
 * Market Sync Worker - Periodically syncs client data from Market service
 */

import { ClientRepository } from '../repositories/client.repository.js';
import { ClientHealthScoreService } from '../services/client-health-score.service.js';
import { ClientSearchService } from '../services/client-search.service.js';
import { ClientService } from '../services/client.service.js';

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Default interval: 6 hours
const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000;

export class MarketSyncWorker {
  private readonly clientService: ClientService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger,
    private readonly intervalMs: number = DEFAULT_INTERVAL_MS
  ) {
    // Initialize services with proper dependencies
    const healthScoreService = new ClientHealthScoreService(prisma, redis, logger);
    const searchService = new ClientSearchService(redis, logger);
    this.clientService = new ClientService(
      prisma,
      redis,
      logger,
      healthScoreService,
      searchService
    );
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.intervalId) {
      this.logger.warn('Market sync worker already running');
      return;
    }

    this.logger.info({ intervalMs: this.intervalMs }, 'Starting market sync worker');

    // Schedule periodic runs (don't run immediately - let users trigger first sync)
    this.intervalId = setInterval(() => {
      void this.run();
    }, this.intervalMs);
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info('Market sync worker stopped');
    }
  }

  /**
   * Run a single sync cycle
   */
  async run(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Market sync worker already processing, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    const stats = {
      usersProcessed: 0,
      clientsImported: 0,
      clientsUpdated: 0,
      errors: 0,
    };

    try {
      this.logger.info('Market sync worker starting sync cycle');

      // Get all freelancers who have imported clients from Market
      const freelancers = await this.getFreelancersWithMarketClients();

      for (const freelancer of freelancers) {
        try {
          const result = await this.clientService.syncFromMarket(freelancer.freelancerUserId);

          stats.usersProcessed++;
          stats.clientsImported += result.imported;
          stats.clientsUpdated += result.updated;

          this.logger.debug(
            {
              freelancerUserId: freelancer.freelancerUserId,
              imported: result.imported,
              updated: result.updated,
            },
            'Synced clients for freelancer'
          );
        } catch (error) {
          stats.errors++;
          this.logger.error(
            {
              freelancerUserId: freelancer.freelancerUserId,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            'Failed to sync clients for freelancer'
          );
        }
      }

      const duration = Date.now() - startTime;
      this.logger.info(
        { ...stats, durationMs: duration },
        'Market sync worker completed sync cycle'
      );
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Market sync worker failed'
      );
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get distinct freelancers who have clients imported from Market
   */
  private async getFreelancersWithMarketClients(): Promise<Array<{ freelancerUserId: string }>> {
    const result = await this.prisma.client.findMany({
      where: {
        source: 'SKILLANCER_MARKET',
        platformUserId: { not: null },
      },
      select: {
        freelancerUserId: true,
      },
      distinct: ['freelancerUserId'],
    });

    return result;
  }

  /**
   * Trigger manual sync for a specific freelancer
   */
  async syncForFreelancer(freelancerUserId: string): Promise<{
    imported: number;
    updated: number;
    errors: string[];
  }> {
    return this.clientService.syncFromMarket(freelancerUserId);
  }
}
