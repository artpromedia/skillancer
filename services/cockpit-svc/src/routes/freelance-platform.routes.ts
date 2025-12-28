/**
 * @module @skillancer/cockpit-svc/routes/freelance-platforms
 * Freelance Platform Routes - Platform-specific endpoints for freelance integrations
 */

import { z } from 'zod';

import { FiverrIntegrationService } from '../services/integrations/fiverr-integration.service.js';
import { FreelancerIntegrationService } from '../services/integrations/freelancer-integration.service.js';
import { IntegrationPlatformService } from '../services/integrations/integration-platform.service.js';
import { ToptalIntegrationService } from '../services/integrations/toptal-integration.service.js';
import { UpworkIntegrationService } from '../services/integrations/upwork-integration.service.js';

import type { EncryptionService } from '../services/encryption.service.js';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// =====================
// Request Schemas
// =====================

const syncOptionsSchema = z.object({
  syncContracts: z.boolean().optional(),
  syncEngagements: z.boolean().optional(),
  syncOrders: z.boolean().optional(),
  syncProjects: z.boolean().optional(),
  syncTimeEntries: z.boolean().optional(),
  syncTimeLogs: z.boolean().optional(),
  syncTimeTracking: z.boolean().optional(),
  syncEarnings: z.boolean().optional(),
  syncPayments: z.boolean().optional(),
  syncMilestones: z.boolean().optional(),
  autoCreateClients: z.boolean().optional(),
});

const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// =====================
// Route Dependencies
// =====================

export interface FreelancePlatformRouteDeps {
  prisma: PrismaClient;
  logger: Logger;
  encryption: EncryptionService;
}

// =====================
// Route Registration
// =====================

export function registerFreelancePlatformRoutes(
  app: FastifyInstance,
  deps: FreelancePlatformRouteDeps
): void {
  const { prisma, logger, encryption } = deps;

  // Initialize services
  const platformService = new IntegrationPlatformService(prisma, logger, encryption);
  const upworkService = new UpworkIntegrationService(prisma, logger, encryption);
  const fiverrService = new FiverrIntegrationService(prisma, logger, encryption);
  const toptalService = new ToptalIntegrationService(prisma, logger, encryption);
  const freelancerService = new FreelancerIntegrationService(prisma, logger, encryption);

  // Register providers
  platformService.registerProvider(upworkService);
  platformService.registerProvider(fiverrService);
  platformService.registerProvider(toptalService);
  platformService.registerProvider(freelancerService);

  // Helper to get user ID from request
  const getUserId = (request: FastifyRequest): string | null => {
    return (request as unknown as { userId?: string }).userId ?? null;
  };

  // Error handler
  const handleError = (error: unknown, reply: FastifyReply, context: string): FastifyReply => {
    logger.error({ error, context }, 'Freelance platform route error');
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: error.message },
        });
      }
      if (error.message.includes('not connected')) {
        return reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: error.message },
        });
      }
    }
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  };

  // =====================
  // Upwork Routes
  // =====================

  /**
   * GET /freelance/upwork/contracts
   * Get contracts from connected Upwork account
   */
  app.get('/freelance/upwork/contracts', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'UPWORK', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Upwork not connected' },
        });
      }

      const contracts = await upworkService.fetchContracts(integration);

      return await reply.send({
        success: true,
        data: {
          contracts,
          total: contracts.length,
        },
      });
    } catch (error) {
      return handleError(error, reply, 'upwork.contracts');
    }
  });

  /**
   * GET /freelance/upwork/time-entries
   * Get time entries from Upwork
   */
  app.get('/freelance/upwork/time-entries', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const query = dateRangeSchema.parse(request.query);
      const startDate = query.startDate
        ? new Date(query.startDate)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = query.endDate ? new Date(query.endDate) : new Date();

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'UPWORK', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Upwork not connected' },
        });
      }

      const timeEntries = await upworkService.fetchTimeEntries(integration, startDate, endDate);

      return await reply.send({
        success: true,
        data: {
          timeEntries,
          total: timeEntries.length,
          range: { startDate, endDate },
        },
      });
    } catch (error) {
      return handleError(error, reply, 'upwork.time-entries');
    }
  });

  /**
   * GET /freelance/upwork/earnings
   * Get earnings from Upwork
   */
  app.get('/freelance/upwork/earnings', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const query = dateRangeSchema.parse(request.query);
      const startDate = query.startDate
        ? new Date(query.startDate)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = query.endDate ? new Date(query.endDate) : new Date();

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'UPWORK', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Upwork not connected' },
        });
      }

      const earnings = await upworkService.fetchEarnings(integration, startDate, endDate);

      // Calculate summary
      const summary = {
        total: earnings.reduce((sum, e) => sum + Number.parseFloat(e.amount), 0),
        currency: 'USD',
        count: earnings.length,
      };

      return await reply.send({
        success: true,
        data: {
          earnings,
          summary,
          range: { startDate, endDate },
        },
      });
    } catch (error) {
      return handleError(error, reply, 'upwork.earnings');
    }
  });

  /**
   * PATCH /freelance/upwork/sync-options
   * Update Upwork sync options
   */
  app.patch('/freelance/upwork/sync-options', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const options = syncOptionsSchema.parse(request.body);

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'UPWORK' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Upwork not connected' },
        });
      }

      const updated = await prisma.integration.update({
        where: { id: integration.id },
        data: {
          syncOptions: {
            ...(integration.syncOptions as Record<string, unknown> | null),
            ...options,
          },
        },
      });

      return await reply.send({
        success: true,
        data: { syncOptions: updated.syncOptions },
      });
    } catch (error) {
      return handleError(error, reply, 'upwork.sync-options');
    }
  });

  // =====================
  // Fiverr Routes
  // =====================

  /**
   * GET /freelance/fiverr/gigs
   * Get gigs from connected Fiverr account
   */
  app.get('/freelance/fiverr/gigs', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'FIVERR', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Fiverr not connected' },
        });
      }

      const gigs = await fiverrService.fetchGigs(integration);

      return await reply.send({
        success: true,
        data: {
          gigs,
          total: gigs.length,
        },
      });
    } catch (error) {
      return handleError(error, reply, 'fiverr.gigs');
    }
  });

  /**
   * GET /freelance/fiverr/orders
   * Get orders from Fiverr
   */
  app.get('/freelance/fiverr/orders', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'FIVERR', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Fiverr not connected' },
        });
      }

      const orders = await fiverrService.fetchOrders(integration);

      return await reply.send({
        success: true,
        data: {
          orders,
          total: orders.length,
        },
      });
    } catch (error) {
      return handleError(error, reply, 'fiverr.orders');
    }
  });

  /**
   * GET /freelance/fiverr/earnings
   * Get earnings from Fiverr
   */
  app.get('/freelance/fiverr/earnings', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'FIVERR', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Fiverr not connected' },
        });
      }

      const earnings = await fiverrService.fetchEarnings(integration);

      const summary = {
        total: earnings.reduce((sum, e) => sum + e.amount, 0),
        currency: 'USD',
        count: earnings.length,
      };

      return await reply.send({
        success: true,
        data: {
          earnings,
          summary,
        },
      });
    } catch (error) {
      return handleError(error, reply, 'fiverr.earnings');
    }
  });

  /**
   * PATCH /freelance/fiverr/sync-options
   * Update Fiverr sync options
   */
  app.patch('/freelance/fiverr/sync-options', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const options = syncOptionsSchema.parse(request.body);

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'FIVERR' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Fiverr not connected' },
        });
      }

      const updated = await prisma.integration.update({
        where: { id: integration.id },
        data: {
          syncOptions: {
            ...(integration.syncOptions as Record<string, unknown> | null),
            ...options,
          },
        },
      });

      return await reply.send({
        success: true,
        data: { syncOptions: updated.syncOptions },
      });
    } catch (error) {
      return handleError(error, reply, 'fiverr.sync-options');
    }
  });

  // =====================
  // Toptal Routes
  // =====================

  /**
   * GET /freelance/toptal/engagements
   * Get engagements from connected Toptal account
   */
  app.get('/freelance/toptal/engagements', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'TOPTAL', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Toptal not connected' },
        });
      }

      // Use the private method by triggering a sync
      const result = await toptalService.sync(integration, {
        entityTypes: ['PROJECT'],
        dryRun: true,
      });

      return await reply.send({
        success: true,
        data: {
          message: 'Use /integrations/{id}/sync to sync engagements',
          syncStatus: result,
        },
      });
    } catch (error) {
      return handleError(error, reply, 'toptal.engagements');
    }
  });

  /**
   * GET /freelance/toptal/time-logs
   * Get time logs from Toptal
   */
  app.get('/freelance/toptal/time-logs', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'TOPTAL', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Toptal not connected' },
        });
      }

      const result = await toptalService.sync(integration, {
        entityTypes: ['TIME_ENTRY'],
        dryRun: true,
      });

      return await reply.send({
        success: true,
        data: {
          message: 'Use /integrations/{id}/sync to sync time logs',
          syncStatus: result,
        },
      });
    } catch (error) {
      return handleError(error, reply, 'toptal.time-logs');
    }
  });

  /**
   * PATCH /freelance/toptal/sync-options
   * Update Toptal sync options
   */
  app.patch('/freelance/toptal/sync-options', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const options = syncOptionsSchema.parse(request.body);

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'TOPTAL' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Toptal not connected' },
        });
      }

      const updated = await prisma.integration.update({
        where: { id: integration.id },
        data: {
          syncOptions: {
            ...(integration.syncOptions as Record<string, unknown> | null),
            ...options,
          },
        },
      });

      return await reply.send({
        success: true,
        data: { syncOptions: updated.syncOptions },
      });
    } catch (error) {
      return handleError(error, reply, 'toptal.sync-options');
    }
  });

  // =====================
  // Freelancer.com Routes
  // =====================

  /**
   * GET /freelance/freelancer/projects
   * Get projects from Freelancer.com
   */
  app.get('/freelance/freelancer/projects', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'FREELANCER', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Freelancer.com not connected' },
        });
      }

      const result = await freelancerService.sync(integration, {
        entityTypes: ['PROJECT'],
        dryRun: true,
      });

      return await reply.send({
        success: true,
        data: {
          message: 'Use /integrations/{id}/sync to sync projects',
          syncStatus: result,
        },
      });
    } catch (error) {
      return handleError(error, reply, 'freelancer.projects');
    }
  });

  /**
   * GET /freelance/freelancer/bids
   * Get active bids from Freelancer.com
   */
  app.get('/freelance/freelancer/bids', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'FREELANCER', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Freelancer.com not connected' },
        });
      }

      const bids = await freelancerService.fetchActiveBids(integration);

      return await reply.send({
        success: true,
        data: {
          bids,
          total: bids.length,
        },
      });
    } catch (error) {
      return handleError(error, reply, 'freelancer.bids');
    }
  });

  /**
   * GET /freelance/freelancer/earnings
   * Get earnings summary from Freelancer.com
   */
  app.get('/freelance/freelancer/earnings', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'FREELANCER', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Freelancer.com not connected' },
        });
      }

      const summary = await freelancerService.fetchEarningsSummary(integration);

      return await reply.send({
        success: true,
        data: { summary },
      });
    } catch (error) {
      return handleError(error, reply, 'freelancer.earnings');
    }
  });

  /**
   * PATCH /freelance/freelancer/sync-options
   * Update Freelancer.com sync options
   */
  app.patch('/freelance/freelancer/sync-options', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const options = syncOptionsSchema.parse(request.body);

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'FREELANCER' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Freelancer.com not connected' },
        });
      }

      const updated = await prisma.integration.update({
        where: { id: integration.id },
        data: {
          syncOptions: {
            ...(integration.syncOptions as Record<string, unknown> | null),
            ...options,
          },
        },
      });

      return await reply.send({
        success: true,
        data: { syncOptions: updated.syncOptions },
      });
    } catch (error) {
      return handleError(error, reply, 'freelancer.sync-options');
    }
  });

  // =====================
  // Cross-Platform Routes
  // =====================

  /**
   * GET /freelance/summary
   * Get combined summary across all connected freelance platforms
   */
  app.get('/freelance/summary', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const integrations = await prisma.integration.findMany({
        where: {
          userId,
          provider: { in: ['UPWORK', 'FIVERR', 'TOPTAL', 'FREELANCER'] },
          status: 'CONNECTED',
        },
      });

      const platformSummaries: Record<
        string,
        {
          connected: boolean;
          lastSync?: Date | null;
          syncStatus?: string;
        }
      > = {
        upwork: { connected: false },
        fiverr: { connected: false },
        toptal: { connected: false },
        freelancer: { connected: false },
      };

      for (const integration of integrations) {
        const key = integration.provider.toLowerCase();
        platformSummaries[key] = {
          connected: true,
          lastSync: integration.lastSyncAt,
          syncStatus: integration.lastSyncStatus ?? undefined,
        };
      }

      // Get aggregated project counts
      const projectCounts = await prisma.cockpitProject.groupBy({
        by: ['source'],
        where: {
          freelancerUserId: userId,
          source: { in: ['UPWORK', 'FIVERR', 'TOPTAL', 'FREELANCER'] },
        },
        _count: { _all: true },
      });

      // Get aggregated earnings
      const earnings = await prisma.financialTransaction.aggregate({
        where: {
          userId,
          type: 'INCOME',
          tags: { hasSome: ['upwork', 'fiverr', 'toptal', 'freelancer'] },
        },
        _sum: { amount: true },
        _count: true,
      });

      return await reply.send({
        success: true,
        data: {
          platforms: platformSummaries,
          totals: {
            connectedPlatforms: integrations.length,
            projectsByPlatform: Object.fromEntries(
              projectCounts.map((p) => [p.source?.toLowerCase() ?? 'unknown', p._count._all])
            ),
            totalProjects: projectCounts.reduce(
              (sum: number, p) => sum + (p._count._all),
              0
            ),
            totalEarnings: earnings._sum.amount ?? 0,
            earningsTransactions: earnings._count,
          },
        },
      });
    } catch (error) {
      return handleError(error, reply, 'freelance.summary');
    }
  });

  /**
   * POST /freelance/sync-all
   * Trigger sync for all connected freelance platforms
   */
  app.post('/freelance/sync-all', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const integrations = await prisma.integration.findMany({
        where: {
          userId,
          provider: { in: ['UPWORK', 'FIVERR', 'TOPTAL', 'FREELANCER'] },
          status: 'CONNECTED',
          syncEnabled: true,
        },
      });

      const results: Record<string, { success: boolean; error?: string }> = {};

      for (const integration of integrations) {
        const key = integration.provider.toLowerCase();
        try {
          const service = platformService.getProviderService(integration.provider);
          await service.sync(integration, {});
          results[key] = { success: true };
        } catch (error) {
          results[key] = {
            success: false,
            error: (error as Error).message,
          };
        }
      }

      const successCount = Object.values(results).filter((r) => r.success).length;

      return await reply.send({
        success: true,
        data: {
          results,
          summary: {
            total: integrations.length,
            succeeded: successCount,
            failed: integrations.length - successCount,
          },
        },
      });
    } catch (error) {
      return handleError(error, reply, 'freelance.sync-all');
    }
  });

  logger.info('Freelance platform routes registered');
}
