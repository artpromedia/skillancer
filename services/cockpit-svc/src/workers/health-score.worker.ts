/**
 * @module @skillancer/cockpit-svc/workers/health-score
 * Health Score Worker - Periodically updates client health scores
 */

import { ClientRepository } from '../repositories/client.repository.js';
import { ClientHealthScoreService } from '../services/client-health-score.service.js';

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Default interval: 1 hour
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
// Batch size for processing
const BATCH_SIZE = 100;

export class HealthScoreWorker {
  private readonly healthScoreService: ClientHealthScoreService;
  private readonly clientRepository: ClientRepository;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger,
    private readonly intervalMs: number = DEFAULT_INTERVAL_MS
  ) {
    this.healthScoreService = new ClientHealthScoreService(prisma, redis, logger);
    this.clientRepository = new ClientRepository(prisma);
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.intervalId) {
      this.logger.warn('Health score worker already running');
      return;
    }

    this.logger.info({ intervalMs: this.intervalMs }, 'Starting health score worker');

    // Run immediately on start
    void this.run();

    // Schedule periodic runs
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
      this.logger.info('Health score worker stopped');
    }
  }

  /**
   * Run a single update cycle
   */
  async run(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Health score worker already processing, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    let processedCount = 0;
    let errorCount = 0;

    try {
      this.logger.info('Health score worker starting update cycle');

      let hasMore = true;
      let offset = 0;

      while (hasMore) {
        // Get batch of clients that need health score update
        const clients = await this.getClientsNeedingUpdate(offset, BATCH_SIZE);

        if (clients.length === 0) {
          hasMore = false;
          continue;
        }

        // Process each client
        for (const client of clients) {
          try {
            await this.healthScoreService.calculateAndUpdate(client.id);
            processedCount++;
          } catch (error) {
            errorCount++;
            this.logger.error(
              {
                clientId: client.id,
                error: error instanceof Error ? error.message : 'Unknown error',
              },
              'Failed to update health score for client'
            );
          }
        }

        offset += BATCH_SIZE;

        // Check if we got a full batch
        if (clients.length < BATCH_SIZE) {
          hasMore = false;
        }
      }

      const duration = Date.now() - startTime;
      this.logger.info(
        { processedCount, errorCount, durationMs: duration },
        'Health score worker completed update cycle'
      );
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Health score worker failed'
      );
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get clients that need health score update
   * Updates clients that haven't been scored in the last 24 hours
   */
  private async getClientsNeedingUpdate(
    offset: number,
    limit: number
  ): Promise<Array<{ id: string }>> {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    // Query clients with stale health scores
    const clients = await this.prisma.client.findMany({
      where: {
        OR: [{ healthScoreUpdatedAt: null }, { healthScoreUpdatedAt: { lt: oneDayAgo } }],
        status: {
          in: ['ACTIVE', 'LEAD', 'PROSPECT'],
        },
      },
      select: { id: true },
      skip: offset,
      take: limit,
      orderBy: { healthScoreUpdatedAt: 'asc' },
    });

    return clients;
  }

  /**
   * Force update all clients
   */
  async forceUpdateAll(): Promise<{ processed: number; errors: number }> {
    let processedCount = 0;
    let errorCount = 0;

    const clients = await this.prisma.client.findMany({
      where: {
        status: {
          in: ['ACTIVE', 'LEAD', 'PROSPECT'],
        },
      },
      select: { id: true },
    });

    for (const client of clients) {
      try {
        await this.healthScoreService.calculateAndUpdate(client.id);
        processedCount++;
      } catch {
        errorCount++;
      }
    }

    return { processed: processedCount, errors: errorCount };
  }
}
