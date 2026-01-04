// @ts-nocheck
import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';
import { integrationService } from '../services/integration.service';

const log = logger.child({ job: 'health-check' });

const UNHEALTHY_THRESHOLD_HOURS = 24;

/**
 * Integration Health Check Job
 * Schedule: Every 6 hours
 *
 * Tests all connected integrations and marks unhealthy ones.
 */
export async function runHealthCheckJob(): Promise<void> {
  log.info('Starting integration health check job');

  try {
    // Get all connected integrations
    const integrations = await prisma.workspaceIntegration.findMany({
      where: {
        status: { in: ['CONNECTED', 'ERROR'] },
      },
      include: {
        integrationType: true,
        workspace: {
          include: {
            engagement: {
              select: {
                executiveId: true,
              },
            },
          },
        },
      },
    });

    log.info(`Checking health of ${integrations.length} integrations`);

    let healthyCount = 0;
    let unhealthyCount = 0;
    let criticalCount = 0;

    for (const integration of integrations) {
      try {
        const result = await integrationService.testIntegration({
          integrationId: integration.id,
          workspaceId: integration.workspaceId,
          userId: 'system',
        });

        if (result.healthy) {
          healthyCount++;

          // Clear previous error if now healthy
          if (integration.status === 'ERROR') {
            await prisma.workspaceIntegration.update({
              where: { id: integration.id },
              data: {
                status: 'CONNECTED',
                syncError: null,
              },
            });
            log.info(
              {
                integrationId: integration.id,
                connector: integration.integrationType.slug,
              },
              'Integration recovered'
            );
          }
        } else {
          unhealthyCount++;

          // Check if unhealthy for too long
          const errorSince = integration.updatedAt;
          const hoursUnhealthy = (Date.now() - errorSince.getTime()) / (1000 * 60 * 60);

          if (integration.status === 'ERROR' && hoursUnhealthy >= UNHEALTHY_THRESHOLD_HOURS) {
            criticalCount++;
            log.warn(
              {
                integrationId: integration.id,
                connector: integration.integrationType.slug,
                hoursUnhealthy: Math.round(hoursUnhealthy),
              },
              'Integration unhealthy for extended period'
            );

            // TODO: Send notification to executive
            await notifyUnhealthyIntegration(integration);
          }

          // Update status if not already error
          if (integration.status !== 'ERROR') {
            await prisma.workspaceIntegration.update({
              where: { id: integration.id },
              data: {
                status: 'ERROR',
                syncError: result.error || 'Health check failed',
              },
            });
          }
        }
      } catch (error) {
        unhealthyCount++;
        log.error(
          {
            integrationId: integration.id,
            connector: integration.integrationType.slug,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'Health check failed for integration'
        );
      }
    }

    log.info(
      {
        total: integrations.length,
        healthy: healthyCount,
        unhealthy: unhealthyCount,
        critical: criticalCount,
      },
      'Health check job completed'
    );
  } catch (error) {
    log.error({ error }, 'Health check job failed');
    throw error;
  }
}

interface IntegrationWithDetails {
  id: string;
  integrationType: {
    slug: string;
    name: string;
  };
  workspace: {
    engagement: {
      executiveId: string;
    } | null;
  };
}

async function notifyUnhealthyIntegration(integration: IntegrationWithDetails): Promise<void> {
  const executiveId = integration.workspace.engagement?.executiveId;
  if (!executiveId) return;

  // TODO: Integrate with notification service
  log.info(
    {
      executiveId,
      integrationId: integration.id,
      connector: integration.integrationType.slug,
    },
    'Would notify executive about unhealthy integration'
  );
}

/**
 * Get health summary for all integrations
 */
export async function getHealthSummary(): Promise<HealthSummary> {
  const stats = await prisma.workspaceIntegration.groupBy({
    by: ['status'],
    _count: { id: true },
  });

  const summary: HealthSummary = {
    total: 0,
    connected: 0,
    expired: 0,
    error: 0,
    pending: 0,
  };

  for (const stat of stats) {
    summary.total += stat._count.id;
    switch (stat.status) {
      case 'CONNECTED':
        summary.connected = stat._count.id;
        break;
      case 'EXPIRED':
        summary.expired = stat._count.id;
        break;
      case 'ERROR':
        summary.error = stat._count.id;
        break;
      case 'PENDING':
        summary.pending = stat._count.id;
        break;
    }
  }

  return summary;
}

interface HealthSummary {
  total: number;
  connected: number;
  expired: number;
  error: number;
  pending: number;
}

export default { runHealthCheckJob, getHealthSummary };
