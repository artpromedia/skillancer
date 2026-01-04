// @ts-nocheck
import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';
import { integrationService } from '../services/integration.service';

const log = logger.child({ job: 'scheduled-sync' });

interface SyncConfig {
  syncIntervalMinutes: number;
}

const DEFAULT_SYNC_INTERVAL = 60; // 1 hour

/**
 * Scheduled Sync Job
 * Schedule: Every hour
 *
 * Syncs integration data for all active integrations that are due for sync.
 */
export async function runScheduledSyncJob(): Promise<void> {
  log.info('Starting scheduled sync job');

  try {
    // Find integrations due for sync
    const integrations = await prisma.workspaceIntegration.findMany({
      where: {
        status: 'CONNECTED',
        OR: [
          { lastSyncAt: null },
          { syncStatus: 'NEVER' },
          {
            lastSyncAt: {
              lt: new Date(Date.now() - DEFAULT_SYNC_INTERVAL * 60 * 1000),
            },
          },
        ],
      },
      include: {
        integrationType: true,
        workspace: {
          select: {
            id: true,
            engagementId: true,
          },
        },
      },
    });

    log.info(`Found ${integrations.length} integrations due for sync`);

    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;

    for (const integration of integrations) {
      // Check custom sync interval from config
      const config = integration.config as SyncConfig | null;
      const syncInterval = config?.syncIntervalMinutes || DEFAULT_SYNC_INTERVAL;

      if (integration.lastSyncAt) {
        const minutesSinceLastSync = (Date.now() - integration.lastSyncAt.getTime()) / (60 * 1000);

        if (minutesSinceLastSync < syncInterval) {
          skippedCount++;
          continue;
        }
      }

      try {
        // Mark as syncing
        await prisma.workspaceIntegration.update({
          where: { id: integration.id },
          data: { syncStatus: 'SYNCING' },
        });

        // Perform sync
        await integrationService.syncIntegration({
          integrationId: integration.id,
          workspaceId: integration.workspaceId,
          userId: 'system', // Background job
        });

        successCount++;
        log.info(
          {
            integrationId: integration.id,
            connector: integration.integrationType.slug,
          },
          'Integration synced successfully'
        );
      } catch (error) {
        failureCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        log.error(
          {
            integrationId: integration.id,
            connector: integration.integrationType.slug,
            error: errorMessage,
          },
          'Failed to sync integration'
        );

        // Update sync status
        await prisma.workspaceIntegration.update({
          where: { id: integration.id },
          data: {
            syncStatus: 'FAILED',
            syncError: errorMessage,
          },
        });
      }
    }

    log.info(
      {
        total: integrations.length,
        success: successCount,
        failure: failureCount,
        skipped: skippedCount,
      },
      'Scheduled sync job completed'
    );
  } catch (error) {
    log.error({ error }, 'Scheduled sync job failed');
    throw error;
  }
}

/**
 * Sync a specific integration type across all workspaces
 */
export async function syncByIntegrationType(integrationTypeSlug: string): Promise<void> {
  log.info({ slug: integrationTypeSlug }, 'Syncing all integrations of type');

  const integrations = await prisma.workspaceIntegration.findMany({
    where: {
      status: 'CONNECTED',
      integrationType: { slug: integrationTypeSlug },
    },
    include: {
      integrationType: true,
    },
  });

  for (const integration of integrations) {
    try {
      await integrationService.syncIntegration({
        integrationId: integration.id,
        workspaceId: integration.workspaceId,
        userId: 'system',
      });
    } catch (error) {
      log.error(
        {
          integrationId: integration.id,
          error: error instanceof Error ? error.message : 'Unknown',
        },
        'Failed to sync integration'
      );
    }
  }
}

export default { runScheduledSyncJob, syncByIntegrationType };
