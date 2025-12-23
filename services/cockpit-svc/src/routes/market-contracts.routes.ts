/**
 * @module @skillancer/cockpit-svc/routes/market-contracts
 * Market Contract Integration API Routes
 */

import { Type } from '@sinclair/typebox';

import {
  MarketContractLinkRepository,
  MarketMilestoneLinkRepository,
  MarketTimeLinkRepository,
  MarketPaymentLinkRepository,
} from '../repositories/index.js';

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Redis } from 'ioredis';

// ============================================================================
// SCHEMAS
// ============================================================================

const ContractLinkParamsSchema = Type.Object({
  marketContractId: Type.String(),
});

const ContractListQuerySchema = Type.Object({
  status: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number({ default: 50 })),
  offset: Type.Optional(Type.Number({ default: 0 })),
});

const LinkContractBodySchema = Type.Object({
  projectId: Type.String(),
  syncTime: Type.Optional(Type.Boolean({ default: true })),
  syncMilestones: Type.Optional(Type.Boolean({ default: true })),
});

const UpdateSettingsBodySchema = Type.Object({
  autoSyncTime: Type.Optional(Type.Boolean()),
  autoRecordPayments: Type.Optional(Type.Boolean()),
  autoCreateProject: Type.Optional(Type.Boolean()),
});

const UnlinkQuerySchema = Type.Object({
  keepProject: Type.Optional(Type.Boolean({ default: true })),
});

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ContractLinkParams {
  marketContractId: string;
}

interface ContractListQuery {
  status?: string;
  limit?: number;
  offset?: number;
}

interface LinkContractBody {
  projectId: string;
  syncTime?: boolean;
  syncMilestones?: boolean;
}

interface UpdateSettingsBody {
  autoSyncTime?: boolean;
  autoRecordPayments?: boolean;
  autoCreateProject?: boolean;
}

interface UnlinkQuery {
  keepProject?: boolean;
}

// ============================================================================
// ROUTE REGISTRATION
// ============================================================================

export async function registerMarketContractRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  _redis: Redis,
  logger: Logger
) {
  const contractLinkRepo = new MarketContractLinkRepository(prisma);
  const milestoneLinkRepo = new MarketMilestoneLinkRepository(prisma);
  const timeLinkRepo = new MarketTimeLinkRepository(prisma);
  const paymentLinkRepo = new MarketPaymentLinkRepository(prisma);

  // ==================== GET /api/cockpit/market/contracts ====================
  app.get<{
    Querystring: ContractListQuery;
  }>(
    '/contracts',
    {
      schema: {
        querystring: ContractListQuerySchema,
        summary: 'List linked Market contracts',
        tags: ['Market Integration'],
      },
    },
    async (request: FastifyRequest<{ Querystring: ContractListQuery }>, reply: FastifyReply) => {
      const freelancerUserId = request.headers['x-user-id'] as string;

      if (!freelancerUserId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { status, limit, offset } = request.query;

      try {
        const { links, total } = await contractLinkRepo.findByFreelancer(
          freelancerUserId,
          status ? { contractStatus: status as never } : undefined,
          { limit: limit ?? 50, offset: offset ?? 0 }
        );

        // Transform to response format
        const contracts = await Promise.all(
          links.map(async (link) => {
            // Get milestone summary
            const milestoneSummary = await milestoneLinkRepo.getMilestoneSummary(link.id);

            // Get payment summary
            const paymentSummary = await paymentLinkRepo.getPaymentSummary(link.id);

            return {
              id: link.id,
              marketContractId: link.marketContractId,
              projectId: link.projectId,
              clientId: link.clientId,
              title: link.contractTitle,
              contractType: link.contractType,
              status: link.contractStatus,
              client: link.client
                ? {
                    id: link.client.id,
                    name: [link.client.firstName, link.client.lastName].filter(Boolean).join(' '),
                    companyName: link.client.companyName,
                    avatarUrl: link.client.avatarUrl,
                  }
                : null,
              project: link.project
                ? {
                    id: link.project.id,
                    name: link.project.name,
                    status: link.project.status,
                  }
                : null,
              financials: {
                currency: link.currency,
                hourlyRate: link.hourlyRate ? Number(link.hourlyRate) : null,
                fixedPrice: link.fixedPrice ? Number(link.fixedPrice) : null,
                earnedToDate: paymentSummary.totalNet,
                pendingPayments: paymentSummary.pendingAmount,
              },
              milestones: {
                total: milestoneSummary.total,
                completed: milestoneSummary.completed,
                pending: milestoneSummary.pending,
              },
              syncStatus: link.syncStatus,
              lastSyncedAt: link.lastSyncedAt,
            };
          })
        );

        return await reply.send({
          contracts,
          total,
        });
      } catch (error) {
        logger.error({
          msg: 'Failed to list linked contracts',
          error: error instanceof Error ? error.message : 'Unknown error',
          freelancerUserId,
        });
        return reply.code(500).send({ error: 'Failed to list contracts' });
      }
    }
  );

  // ==================== GET /api/cockpit/market/contracts/:marketContractId ====================
  app.get<{
    Params: ContractLinkParams;
  }>(
    '/contracts/:marketContractId',
    {
      schema: {
        params: ContractLinkParamsSchema,
        summary: 'Get contract details',
        tags: ['Market Integration'],
      },
    },
    async (request: FastifyRequest<{ Params: ContractLinkParams }>, reply: FastifyReply) => {
      const freelancerUserId = request.headers['x-user-id'] as string;
      const { marketContractId } = request.params;

      if (!freelancerUserId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      try {
        const contractLink = await contractLinkRepo.findByMarketIdWithDetails(marketContractId);

        if (!contractLink) {
          return await reply.code(404).send({ error: 'Contract not found' });
        }

        if (contractLink.freelancerUserId !== freelancerUserId) {
          return await reply.code(403).send({ error: 'Forbidden' });
        }

        // Format response
        const response = {
          contract: {
            id: contractLink.id,
            marketContractId: contractLink.marketContractId,
            projectId: contractLink.projectId,
            title: contractLink.contractTitle,
            contractType: contractLink.contractType,
            status: contractLink.contractStatus,
            client: contractLink.client
              ? {
                  id: contractLink.client.id,
                  firstName: contractLink.client.firstName,
                  lastName: contractLink.client.lastName,
                  companyName: contractLink.client.companyName,
                  email: contractLink.client.email,
                }
              : null,
            project: contractLink.project
              ? {
                  id: contractLink.project.id,
                  name: contractLink.project.name,
                  status: contractLink.project.status,
                  description: contractLink.project.description,
                }
              : null,
            financials: {
              currency: contractLink.currency,
              hourlyRate: contractLink.hourlyRate ? Number(contractLink.hourlyRate) : null,
              fixedPrice: contractLink.fixedPrice ? Number(contractLink.fixedPrice) : null,
              budgetCap: contractLink.budgetCap ? Number(contractLink.budgetCap) : null,
            },
            timeline: {
              startDate: contractLink.startDate,
              endDate: contractLink.endDate,
            },
            milestones: contractLink.milestoneLinks.map((ml) => ({
              id: ml.id,
              marketMilestoneId: ml.marketMilestoneId,
              projectMilestoneId: ml.projectMilestoneId,
              title: ml.title,
              amount: Number(ml.amount),
              status: ml.status,
              dueDate: ml.dueDate,
              linkedToProject: !!ml.projectMilestone,
            })),
            timeLogs: contractLink.timeLinks.map((tl) => ({
              id: tl.id,
              date: tl.date,
              hours: Number(tl.hours),
              description: tl.description,
              amount: Number(tl.amount),
              status: tl.status,
              syncedToProject: !!tl.timeEntry,
            })),
            payments: contractLink.paymentLinks.map((pl) => ({
              id: pl.id,
              type: pl.paymentType,
              grossAmount: Number(pl.grossAmount),
              platformFee: Number(pl.platformFee),
              netAmount: Number(pl.netAmount),
              currency: pl.currency,
              status: pl.status,
              paidAt: pl.paidAt,
              recordedAsIncome: !!pl.transactionId,
            })),
            settings: {
              autoCreateProject: contractLink.autoCreateProject,
              autoSyncTime: contractLink.autoSyncTime,
              autoRecordPayments: contractLink.autoRecordPayments,
            },
            syncStatus: contractLink.syncStatus,
            syncError: contractLink.syncError,
            lastSyncedAt: contractLink.lastSyncedAt,
          },
        };

        return await reply.send(response);
      } catch (error) {
        logger.error({
          msg: 'Failed to get contract details',
          error: error instanceof Error ? error.message : 'Unknown error',
          marketContractId,
        });
        return reply.code(500).send({ error: 'Failed to get contract details' });
      }
    }
  );

  // ==================== POST /api/cockpit/market/contracts/:marketContractId/link ====================
  app.post<{
    Params: ContractLinkParams;
    Body: LinkContractBody;
  }>(
    '/contracts/:marketContractId/link',
    {
      schema: {
        params: ContractLinkParamsSchema,
        body: LinkContractBodySchema,
        summary: 'Link contract to existing project',
        tags: ['Market Integration'],
      },
    },
    async (
      request: FastifyRequest<{ Params: ContractLinkParams; Body: LinkContractBody }>,
      reply: FastifyReply
    ) => {
      const freelancerUserId = request.headers['x-user-id'] as string;
      const { marketContractId } = request.params;
      const { projectId, syncTime, syncMilestones } = request.body;

      if (!freelancerUserId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      try {
        const contractLink = await contractLinkRepo.findByMarketId(marketContractId);

        if (!contractLink) {
          return await reply.code(404).send({ error: 'Contract not found' });
        }

        if (contractLink.freelancerUserId !== freelancerUserId) {
          return await reply.code(403).send({ error: 'Forbidden' });
        }

        // Update contract link with project
        await contractLinkRepo.update(contractLink.id, {
          projectId,
          autoSyncTime: syncTime ?? true,
        });

        // Sync milestones if requested
        if (syncMilestones) {
          const milestoneLinks = await milestoneLinkRepo.findByContractLink(contractLink.id);

          for (const ml of milestoneLinks) {
            if (!ml.projectMilestoneId) {
              const projectMilestone = await prisma.projectMilestone.create({
                data: {
                  projectId,
                  title: ml.title,
                  orderIndex: 0,
                  dueDate: ml.dueDate,
                  status: 'PENDING',
                  marketMilestoneId: ml.marketMilestoneId,
                  amount: ml.amount,
                },
              });

              await milestoneLinkRepo.update(ml.id, {
                projectMilestoneId: projectMilestone.id,
              });
            }
          }
        }

        const updatedLink = await contractLinkRepo.findByMarketIdWithDetails(marketContractId);

        return await reply.send({
          success: true,
          contractLink: {
            id: updatedLink!.id,
            projectId: updatedLink!.projectId,
            milestonesLinked: updatedLink!.milestoneLinks.filter((ml) => ml.projectMilestoneId)
              .length,
          },
        });
      } catch (error) {
        logger.error({
          msg: 'Failed to link contract to project',
          error: error instanceof Error ? error.message : 'Unknown error',
          marketContractId,
          projectId,
        });
        return reply.code(500).send({ error: 'Failed to link contract' });
      }
    }
  );

  // ==================== DELETE /api/cockpit/market/contracts/:marketContractId/link ====================
  app.delete<{
    Params: ContractLinkParams;
    Querystring: UnlinkQuery;
  }>(
    '/contracts/:marketContractId/link',
    {
      schema: {
        params: ContractLinkParamsSchema,
        querystring: UnlinkQuerySchema,
        summary: 'Unlink contract from project',
        tags: ['Market Integration'],
      },
    },
    async (
      request: FastifyRequest<{ Params: ContractLinkParams; Querystring: UnlinkQuery }>,
      reply: FastifyReply
    ) => {
      const freelancerUserId = request.headers['x-user-id'] as string;
      const { marketContractId } = request.params;
      const { keepProject } = request.query;

      if (!freelancerUserId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      try {
        const contractLink = await contractLinkRepo.findByMarketId(marketContractId);

        if (!contractLink) {
          return await reply.code(404).send({ error: 'Contract not found' });
        }

        if (contractLink.freelancerUserId !== freelancerUserId) {
          return await reply.code(403).send({ error: 'Forbidden' });
        }

        if (!keepProject && contractLink.projectId) {
          // Delete project (will cascade to related entities)
          await prisma.cockpitProject.delete({
            where: { id: contractLink.projectId },
          });
        }

        // Update contract link
        await contractLinkRepo.update(contractLink.id, {
          projectId: null,
        });

        return await reply.send({ success: true });
      } catch (error) {
        logger.error({
          msg: 'Failed to unlink contract from project',
          error: error instanceof Error ? error.message : 'Unknown error',
          marketContractId,
        });
        return reply.code(500).send({ error: 'Failed to unlink contract' });
      }
    }
  );

  // ==================== PATCH /api/cockpit/market/contracts/:marketContractId/settings ====================
  app.patch<{
    Params: ContractLinkParams;
    Body: UpdateSettingsBody;
  }>(
    '/contracts/:marketContractId/settings',
    {
      schema: {
        params: ContractLinkParamsSchema,
        body: UpdateSettingsBodySchema,
        summary: 'Update contract sync settings',
        tags: ['Market Integration'],
      },
    },
    async (
      request: FastifyRequest<{ Params: ContractLinkParams; Body: UpdateSettingsBody }>,
      reply: FastifyReply
    ) => {
      const freelancerUserId = request.headers['x-user-id'] as string;
      const { marketContractId } = request.params;
      const { autoSyncTime, autoRecordPayments, autoCreateProject } = request.body;

      if (!freelancerUserId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      try {
        const contractLink = await contractLinkRepo.findByMarketId(marketContractId);

        if (!contractLink) {
          return await reply.code(404).send({ error: 'Contract not found' });
        }

        if (contractLink.freelancerUserId !== freelancerUserId) {
          return await reply.code(403).send({ error: 'Forbidden' });
        }

        await contractLinkRepo.update(contractLink.id, {
          ...(autoSyncTime !== undefined && { autoSyncTime }),
          ...(autoRecordPayments !== undefined && { autoRecordPayments }),
          ...(autoCreateProject !== undefined && { autoCreateProject }),
        });

        return await reply.send({ success: true });
      } catch (error) {
        logger.error({
          msg: 'Failed to update contract settings',
          error: error instanceof Error ? error.message : 'Unknown error',
          marketContractId,
        });
        return reply.code(500).send({ error: 'Failed to update settings' });
      }
    }
  );

  // ==================== POST /api/cockpit/market/contracts/:marketContractId/sync ====================
  app.post<{
    Params: ContractLinkParams;
  }>(
    '/contracts/:marketContractId/sync',
    {
      schema: {
        params: ContractLinkParamsSchema,
        summary: 'Manually sync contract data',
        tags: ['Market Integration'],
      },
    },
    async (request: FastifyRequest<{ Params: ContractLinkParams }>, reply: FastifyReply) => {
      const freelancerUserId = request.headers['x-user-id'] as string;
      const { marketContractId } = request.params;

      if (!freelancerUserId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      try {
        const contractLink = await contractLinkRepo.findByMarketId(marketContractId);

        if (!contractLink) {
          return await reply.code(404).send({ error: 'Contract not found' });
        }

        if (contractLink.freelancerUserId !== freelancerUserId) {
          return await reply.code(403).send({ error: 'Forbidden' });
        }

        // Get current counts
        const milestoneLinks = await milestoneLinkRepo.findByContractLink(contractLink.id);
        const timeSummary = await timeLinkRepo.getTimeSummary(contractLink.id);
        const paymentSummary = await paymentLinkRepo.getPaymentSummary(contractLink.id);

        // Update last synced
        await contractLinkRepo.update(contractLink.id, {
          lastSyncedAt: new Date(),
          syncStatus: 'SYNCED',
          syncError: null,
        });

        // Note: Full sync would call Market API for latest data
        // For now, return current counts
        return await reply.send({
          synced: {
            milestones: milestoneLinks.length,
            timeLogs: timeSummary.entries,
            payments: paymentSummary.paymentCount,
          },
          errors: [],
        });
      } catch (error) {
        logger.error({
          msg: 'Failed to sync contract',
          error: error instanceof Error ? error.message : 'Unknown error',
          marketContractId,
        });
        return reply.code(500).send({ error: 'Failed to sync contract' });
      }
    }
  );

  // ==================== GET /api/cockpit/market/summary ====================
  app.get(
    '/summary',
    {
      schema: {
        summary: 'Get Market activity summary',
        tags: ['Market Integration'],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const freelancerUserId = request.headers['x-user-id'] as string;

      if (!freelancerUserId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      try {
        // Get active contracts count
        const activeContracts = await contractLinkRepo.countActive(freelancerUserId);

        // Get this month's earnings
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const earnings = await paymentLinkRepo.getTotalEarnings(freelancerUserId, {
          startDate: monthStart,
          endDate: monthEnd,
        });

        // Get pending payments
        const { links } = await contractLinkRepo.findByFreelancer(
          freelancerUserId,
          { contractStatus: 'ACTIVE' },
          { limit: 100 }
        );

        let pendingPayments = 0;
        for (const link of links) {
          const summary = await paymentLinkRepo.getPaymentSummary(link.id);
          pendingPayments += summary.pendingAmount;
        }

        // Get this week's hours
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);

        let weeklyHours = 0;
        for (const link of links) {
          const timeSummary = await timeLinkRepo.getTimeSummary(link.id, {
            startDate: weekStart,
            endDate: now,
          });
          weeklyHours += timeSummary.totalHours;
        }

        // Get milestone stats
        let milestonesSubmitted = 0;
        let milestonesApproved = 0;
        for (const link of links) {
          milestonesSubmitted += await milestoneLinkRepo.countByStatus(link.id, 'SUBMITTED');
          milestonesApproved += await milestoneLinkRepo.countByStatus(link.id, 'APPROVED');
        }

        return await reply.send({
          summary: {
            activeContracts,
            totalEarnedThisMonth: earnings.net,
            pendingPayments,
            hoursLoggedThisWeek: Math.round(weeklyHours * 100) / 100,
            milestonesSubmitted,
            milestonesApproved,
          },
          recentActivity: [], // Would be populated from activity log
        });
      } catch (error) {
        logger.error({
          msg: 'Failed to get Market summary',
          error: error instanceof Error ? error.message : 'Unknown error',
          freelancerUserId,
        });
        return reply.code(500).send({ error: 'Failed to get summary' });
      }
    }
  );
}
