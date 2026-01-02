// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/workers/market-contract-sync
 * Market Contract Sync Worker - Periodically syncs time entries and milestones from Cockpit to Market
 */

import { publishTimeLogged, publishMilestoneCompleted } from '../publishers/index.js';
import {
  MarketContractLinkRepository,
  MarketTimeLinkRepository,
  MarketMilestoneLinkRepository,
} from '../repositories/index.js';

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Default interval: 15 minutes
const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;

// Error threshold before disabling sync for a contract
const MAX_SYNC_ERRORS = 5;

export class MarketContractSyncWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  private readonly contractLinkRepo: MarketContractLinkRepository;
  private readonly timeLinkRepo: MarketTimeLinkRepository;
  private readonly milestoneLinkRepo: MarketMilestoneLinkRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger,
    private readonly intervalMs: number = DEFAULT_INTERVAL_MS
  ) {
    this.contractLinkRepo = new MarketContractLinkRepository(prisma);
    this.timeLinkRepo = new MarketTimeLinkRepository(prisma);
    this.milestoneLinkRepo = new MarketMilestoneLinkRepository(prisma);
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.intervalId) {
      this.logger.warn({ msg: 'Market contract sync worker already running' });
      return;
    }

    this.logger.info({
      msg: 'Starting market contract sync worker',
      intervalMs: this.intervalMs,
    });

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
      this.logger.info({ msg: 'Market contract sync worker stopped' });
    }
  }

  /**
   * Run a single sync cycle
   */
  async run(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug({ msg: 'Market contract sync worker already processing, skipping' });
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    const stats = {
      contractsProcessed: 0,
      timeEntriesSynced: 0,
      milestonesSynced: 0,
      errors: 0,
    };

    try {
      this.logger.info({ msg: 'Market contract sync worker starting sync cycle' });

      // Get all active contracts with auto-sync enabled
      const activeContracts = await this.getActiveContractsForSync();

      for (const contractLink of activeContracts) {
        try {
          // Sync unsynced time entries
          if (contractLink.autoSyncTime) {
            const timeSynced = await this.syncTimeEntriesForContract(contractLink);
            stats.timeEntriesSynced += timeSynced;
          }

          // Sync completed milestones
          const milestonesSynced = await this.syncMilestonesForContract(contractLink);
          stats.milestonesSynced += milestonesSynced;

          stats.contractsProcessed++;

          // Update last synced
          await this.contractLinkRepo.update(contractLink.id, {
            lastSyncedAt: new Date(),
            syncStatus: 'SYNCED',
          });
        } catch (error) {
          stats.errors++;

          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          // Track sync errors
          const errorCount = (contractLink.syncErrorCount || 0) + 1;
          const updateData: Record<string, unknown> = {
            syncError: errorMessage,
            syncErrorCount: errorCount,
            lastSyncedAt: new Date(),
          };

          // Disable sync if too many errors
          if (errorCount >= MAX_SYNC_ERRORS) {
            updateData.syncStatus = 'SYNC_ERROR';
            updateData.autoSyncTime = false;
            this.logger.warn({
              msg: 'Disabling auto-sync due to repeated errors',
              contractLinkId: contractLink.id,
              marketContractId: contractLink.marketContractId,
              errorCount,
            });
          } else {
            updateData.syncStatus = 'PENDING_SYNC';
          }

          await this.contractLinkRepo.update(contractLink.id, updateData);

          this.logger.error({
            msg: 'Failed to sync contract',
            contractLinkId: contractLink.id,
            marketContractId: contractLink.marketContractId,
            error: errorMessage,
          });
        }
      }

      const duration = Date.now() - startTime;
      this.logger.info({
        msg: 'Market contract sync worker completed sync cycle',
        ...stats,
        durationMs: duration,
      });
    } catch (error) {
      this.logger.error({
        msg: 'Market contract sync worker failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get active contracts that need syncing
   */
  private async getActiveContractsForSync() {
    return this.prisma.marketContractLink.findMany({
      where: {
        contractStatus: { in: ['ACTIVE', 'PENDING'] },
        OR: [{ autoSyncTime: true }, { autoRecordPayments: true }],
        syncStatus: { notIn: ['SYNC_ERROR'] },
      },
      include: {
        project: true,
      },
    });
  }

  /**
   * Sync unsynced time entries from Cockpit to Market
   */
  private async syncTimeEntriesForContract(
    contractLink: Awaited<ReturnType<typeof this.getActiveContractsForSync>>[0]
  ): Promise<number> {
    if (!contractLink.projectId) {
      return 0;
    }

    // Find time entries that haven't been synced to Market
    const unsyncedTimeLinks = await this.timeLinkRepo.findUnsyncedFromCockpit(contractLink.id);
    let synced = 0;

    for (const timeLink of unsyncedTimeLinks) {
      if (!timeLink.timeEntry) {
        continue;
      }

      try {
        // Publish time logged event to Market
        await publishTimeLogged(
          {
            contractId: contractLink.marketContractId,
            freelancerUserId: contractLink.freelancerUserId,
            timeEntry: {
              id: timeLink.timeEntry.id,
              date: timeLink.timeEntry.date.toISOString().split('T')[0],
              hours: Number(timeLink.timeEntry.duration) / 60, // Convert minutes to hours
              description: timeLink.timeEntry.description ?? '',
              billable: true, // Synced entries are billable
            },
          },
          this.logger
        );

        // Mark as synced
        await this.timeLinkRepo.update(timeLink.id, {
          status: 'SYNCED',
          syncedAt: new Date(),
        });

        synced++;
      } catch (error) {
        this.logger.error({
          msg: 'Failed to sync time entry',
          timeLinkId: timeLink.id,
          timeEntryId: timeLink.timeEntry.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return synced;
  }

  /**
   * Sync completed milestones from Cockpit to Market
   */
  private async syncMilestonesForContract(
    contractLink: Awaited<ReturnType<typeof this.getActiveContractsForSync>>[0]
  ): Promise<number> {
    // Find milestone links where project milestone is completed but Market milestone isn't synced
    const milestoneLinks = await this.milestoneLinkRepo.findByContractLink(contractLink.id);
    let synced = 0;

    for (const milestoneLink of milestoneLinks) {
      // Skip if already synced or no project milestone
      if (milestoneLink.status === 'APPROVED' || !milestoneLink.projectMilestone) {
        continue;
      }

      // Check if project milestone is completed
      if (milestoneLink.projectMilestone.status !== 'COMPLETED') {
        continue;
      }

      try {
        // Publish milestone completed event to Market
        await publishMilestoneCompleted(
          {
            contractId: contractLink.marketContractId,
            freelancerUserId: contractLink.freelancerUserId,
            milestone: {
              id: milestoneLink.marketMilestoneId,
              projectMilestoneId: milestoneLink.projectMilestoneId!,
              completedAt:
                milestoneLink.projectMilestone.completedAt?.toISOString() ??
                new Date().toISOString(),
            },
          },
          this.logger
        );

        // Mark as submitted (awaiting client approval)
        await this.milestoneLinkRepo.update(milestoneLink.id, {
          status: 'SUBMITTED',
        });

        synced++;
      } catch (error) {
        this.logger.error({
          msg: 'Failed to sync milestone',
          milestoneLinkId: milestoneLink.id,
          marketMilestoneId: milestoneLink.marketMilestoneId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return synced;
  }

  /**
   * Check if the worker is currently running
   */
  isActive(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Get worker health status
   */
  getHealth(): {
    active: boolean;
    running: boolean;
    intervalMs: number;
  } {
    return {
      active: this.intervalId !== null,
      running: this.isRunning,
      intervalMs: this.intervalMs,
    };
  }
}

