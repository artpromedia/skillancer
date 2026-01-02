// @ts-nocheck
import { prisma } from '../config';
import { logger } from '@skillancer/logger';
import { oauthService } from '../services/oauth.service';

const log = logger.child({ job: 'token-refresh' });

/**
 * Token Refresh Job
 * Schedule: Every 15 minutes
 *
 * Refreshes OAuth tokens that are expiring within the next 30 minutes.
 */
export async function runTokenRefreshJob(): Promise<void> {
  log.info('Starting token refresh job');

  const thirtyMinutesFromNow = new Date();
  thirtyMinutesFromNow.setMinutes(thirtyMinutesFromNow.getMinutes() + 30);

  try {
    // Find integrations with tokens expiring soon
    const expiringIntegrations = await prisma.workspaceIntegration.findMany({
      where: {
        status: 'CONNECTED',
        tokenExpiry: {
          lte: thirtyMinutesFromNow,
          gt: new Date(), // Not already expired
        },
        refreshToken: { not: null },
      },
      include: {
        integrationType: true,
      },
    });

    log.info(`Found ${expiringIntegrations.length} integrations with expiring tokens`);

    let successCount = 0;
    let failureCount = 0;

    for (const integration of expiringIntegrations) {
      try {
        await oauthService.refreshTokens(integration.id);
        successCount++;
        log.info(
          {
            integrationId: integration.id,
            connector: integration.integrationType.slug,
          },
          'Token refreshed successfully'
        );
      } catch (error) {
        failureCount++;
        log.error(
          {
            integrationId: integration.id,
            connector: integration.integrationType.slug,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'Failed to refresh token'
        );

        // Mark as expired if refresh fails
        await prisma.workspaceIntegration.update({
          where: { id: integration.id },
          data: {
            status: 'EXPIRED',
            syncError: 'Token refresh failed. Please reconnect.',
          },
        });

        // TODO: Notify user about expired integration
      }
    }

    log.info(
      {
        total: expiringIntegrations.length,
        success: successCount,
        failure: failureCount,
      },
      'Token refresh job completed'
    );
  } catch (error) {
    log.error({ error }, 'Token refresh job failed');
    throw error;
  }
}

/**
 * Handle already expired tokens
 */
export async function markExpiredTokens(): Promise<void> {
  log.info('Checking for expired tokens');

  const result = await prisma.workspaceIntegration.updateMany({
    where: {
      status: 'CONNECTED',
      tokenExpiry: { lt: new Date() },
    },
    data: {
      status: 'EXPIRED',
      syncError: 'Token expired. Please reconnect.',
    },
  });

  if (result.count > 0) {
    log.warn({ count: result.count }, 'Marked integrations as expired');
  }
}

export default { runTokenRefreshJob, markExpiredTokens };

