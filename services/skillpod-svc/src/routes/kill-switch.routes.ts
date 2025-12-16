/**
 * @module @skillancer/skillpod-svc/routes/kill-switch
 * Kill Switch API endpoints for security incident response
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */

import { z } from 'zod';

import type { KillSwitchService } from '../services/kill-switch.service.js';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// =============================================================================
// SCHEMAS
// =============================================================================

const KillSwitchScopeEnum = z.enum(['TENANT', 'USER', 'POD', 'SESSION']);
const KillSwitchReasonEnum = z.enum([
  'CONTRACT_TERMINATION',
  'SECURITY_INCIDENT',
  'POLICY_VIOLATION',
  'DATA_BREACH_SUSPECTED',
  'UNAUTHORIZED_ACCESS',
  'MANUAL_TERMINATION',
  'SCHEDULED_END',
  'COMPLIANCE_REQUIREMENT',
]);
const KillSwitchStatusEnum = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'PARTIAL_FAILURE',
  'FAILED',
]);

const ExecuteKillSwitchSchema = z
  .object({
    scope: KillSwitchScopeEnum,
    tenantId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    podId: z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
    reason: KillSwitchReasonEnum,
    details: z.string().max(2000).optional(),
  })
  .refine(
    (data) => {
      // Validate that required fields are present based on scope
      switch (data.scope) {
        case 'TENANT':
          return !!data.tenantId;
        case 'USER':
          return !!data.userId;
        case 'POD':
          return !!data.podId;
        case 'SESSION':
          return !!data.sessionId;
        default:
          return false;
      }
    },
    {
      message: 'Required target field missing for the specified scope',
    }
  );

const ReinstateAccessSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(1000),
});

const ListEventsQuerySchema = z.object({
  tenantId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  status: KillSwitchStatusEnum.optional(),
  reason: KillSwitchReasonEnum.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// =============================================================================
// ROUTES
// =============================================================================

export function killSwitchRoutes(killSwitchService: KillSwitchService) {
  return async function (fastify: FastifyInstance): Promise<void> {
    // =========================================================================
    // EXECUTE KILL SWITCH
    // =========================================================================

    fastify.post(
      '/kill-switch',
      {
        schema: {
          description: 'Execute kill switch to immediately terminate access',
          tags: ['Kill Switch'],
          body: {
            type: 'object',
            required: ['scope', 'reason'],
            properties: {
              scope: { type: 'string', enum: ['TENANT', 'USER', 'POD', 'SESSION'] },
              tenantId: { type: 'string', format: 'uuid' },
              userId: { type: 'string', format: 'uuid' },
              podId: { type: 'string', format: 'uuid' },
              sessionId: { type: 'string', format: 'uuid' },
              reason: {
                type: 'string',
                enum: [
                  'CONTRACT_TERMINATION',
                  'SECURITY_INCIDENT',
                  'POLICY_VIOLATION',
                  'DATA_BREACH_SUSPECTED',
                  'UNAUTHORIZED_ACCESS',
                  'MANUAL_TERMINATION',
                  'SCHEDULED_END',
                  'COMPLIANCE_REQUIREMENT',
                ],
              },
              details: { type: 'string', maxLength: 2000 },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                eventId: { type: 'string', format: 'uuid' },
                status: { type: 'string' },
                executionTimeMs: { type: 'number' },
                sessionsTerminated: { type: 'number' },
                podsTerminated: { type: 'number' },
                tokensRevoked: { type: 'number' },
                errors: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const parseResult = ExecuteKillSwitchSchema.safeParse(request.body);

        if (!parseResult.success) {
          return reply.status(400).send({
            error: 'Validation Error',
            message: parseResult.error.errors.map((e) => e.message).join(', '),
          });
        }

        const triggeredBy = (request.headers['x-user-id'] as string) || 'system';
        const body = parseResult.data;

        try {
          const result = await killSwitchService.execute({
            scope: body.scope,
            tenantId: body.tenantId ?? null,
            userId: body.userId ?? null,
            podId: body.podId ?? null,
            sessionId: body.sessionId ?? null,
            triggeredBy,
            reason: body.reason,
            details: body.details ?? null,
          });

          return await reply.send(result);
        } catch (error) {
          request.log.error(error, 'Kill switch execution failed');
          return reply.status(500).send({
            error: 'Kill Switch Failed',
            message: 'Failed to execute kill switch. Security team has been notified.',
          });
        }
      }
    );

    // =========================================================================
    // GET KILL SWITCH EVENT
    // =========================================================================

    fastify.get(
      '/kill-switch/:eventId',
      {
        schema: {
          description: 'Get kill switch event details',
          tags: ['Kill Switch'],
          params: {
            type: 'object',
            required: ['eventId'],
            properties: {
              eventId: { type: 'string', format: 'uuid' },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                event: { type: 'object' },
              },
            },
            404: {
              type: 'object',
              properties: {
                error: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      async (request: FastifyRequest<{ Params: { eventId: string } }>, reply: FastifyReply) => {
        const { eventId } = request.params;

        const event = await killSwitchService.getEvent(eventId);

        if (!event) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Kill switch event not found',
          });
        }

        return reply.send({ event });
      }
    );

    // =========================================================================
    // LIST KILL SWITCH EVENTS
    // =========================================================================

    fastify.get(
      '/kill-switch',
      {
        schema: {
          description: 'List kill switch events with filtering',
          tags: ['Kill Switch'],
          querystring: {
            type: 'object',
            properties: {
              tenantId: { type: 'string', format: 'uuid' },
              userId: { type: 'string', format: 'uuid' },
              status: {
                type: 'string',
                enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'PARTIAL_FAILURE', 'FAILED'],
              },
              reason: {
                type: 'string',
                enum: [
                  'CONTRACT_TERMINATION',
                  'SECURITY_INCIDENT',
                  'POLICY_VIOLATION',
                  'DATA_BREACH_SUSPECTED',
                  'UNAUTHORIZED_ACCESS',
                  'MANUAL_TERMINATION',
                  'SCHEDULED_END',
                  'COMPLIANCE_REQUIREMENT',
                ],
              },
              startDate: { type: 'string', format: 'date-time' },
              endDate: { type: 'string', format: 'date-time' },
              page: { type: 'integer', minimum: 1, default: 1 },
              limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                events: { type: 'array' },
                total: { type: 'number' },
                page: { type: 'number' },
                totalPages: { type: 'number' },
              },
            },
          },
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const parseResult = ListEventsQuerySchema.safeParse(request.query);

        if (!parseResult.success) {
          return reply.status(400).send({
            error: 'Validation Error',
            message: parseResult.error.errors.map((e) => e.message).join(', '),
          });
        }

        const params = parseResult.data;
        const { events, total } = await killSwitchService.listEvents({
          tenantId: params.tenantId ?? null,
          userId: params.userId ?? null,
          status: params.status ?? null,
          reason: params.reason ?? null,
          startDate: params.startDate ? new Date(params.startDate) : null,
          endDate: params.endDate ? new Date(params.endDate) : null,
          page: params.page,
          limit: params.limit,
        });

        return reply.send({
          events,
          total,
          page: params.page,
          totalPages: Math.ceil(total / params.limit),
        });
      }
    );

    // =========================================================================
    // CHECK ACCESS STATUS
    // =========================================================================

    fastify.get(
      '/access-status/:userId',
      {
        schema: {
          description: 'Check if user access is blocked',
          tags: ['Kill Switch'],
          params: {
            type: 'object',
            required: ['userId'],
            properties: {
              userId: { type: 'string', format: 'uuid' },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                userId: { type: 'string' },
                blocked: { type: 'boolean' },
                reason: { type: 'string' },
                blockedAt: { type: 'string', format: 'date-time' },
                eventId: { type: 'string' },
                canReinstate: { type: 'boolean' },
              },
            },
          },
        },
      },
      async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
        const { userId } = request.params;

        const status = await killSwitchService.isAccessBlocked(userId);

        return reply.send({
          userId,
          blocked: status.blocked,
          reason: status.reason,
          blockedAt: status.blockedAt?.toISOString(),
          eventId: status.eventId,
          canReinstate: status.blocked, // Admins can reinstate blocked users
        });
      }
    );

    // =========================================================================
    // REINSTATE ACCESS
    // =========================================================================

    fastify.post(
      '/access/reinstate',
      {
        schema: {
          description: 'Reinstate user access after kill switch',
          tags: ['Kill Switch'],
          body: {
            type: 'object',
            required: ['userId', 'reason'],
            properties: {
              userId: { type: 'string', format: 'uuid' },
              reason: { type: 'string', minLength: 10, maxLength: 1000 },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const parseResult = ReinstateAccessSchema.safeParse(request.body);

        if (!parseResult.success) {
          return reply.status(400).send({
            error: 'Validation Error',
            message: parseResult.error.errors.map((e) => e.message).join(', '),
          });
        }

        const reinstatedBy = (request.headers['x-user-id'] as string) || 'system';
        const tenantId = request.headers['x-tenant-id'] as string | undefined;
        const { userId, reason } = parseResult.data;

        try {
          await killSwitchService.reinstateAccess({
            userId,
            reinstatedBy,
            reason,
            tenantId: tenantId ?? null,
          });

          return await reply.send({
            success: true,
            message: 'Access reinstated successfully',
          });
        } catch (error) {
          request.log.error(error, 'Failed to reinstate access');
          return reply.status(500).send({
            error: 'Reinstatement Failed',
            message: 'Failed to reinstate access. Please try again.',
          });
        }
      }
    );

    // =========================================================================
    // GET REVOCATION HISTORY
    // =========================================================================

    fastify.get(
      '/revocations/:userId',
      {
        schema: {
          description: 'Get user revocation history',
          tags: ['Kill Switch'],
          params: {
            type: 'object',
            required: ['userId'],
            properties: {
              userId: { type: 'string', format: 'uuid' },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                revocations: { type: 'array' },
              },
            },
          },
        },
      },
      async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
        const { userId } = request.params;

        const revocations = await killSwitchService.getRevocationHistory(userId);

        return reply.send({
          revocations: revocations.map((r) => ({
            id: r.id,
            revokedBy: r.revokedBy,
            reason: r.reason,
            scope: r.scope,
            isActive: r.isActive,
            expiresAt: r.expiresAt?.toISOString(),
            reinstatedBy: r.reinstatedBy,
            reinstatedAt: r.reinstatedAt?.toISOString(),
            reinstateReason: r.reinstateReason,
            killSwitchEventId: r.killSwitchEventId,
            createdAt: r.createdAt.toISOString(),
          })),
        });
      }
    );

    // =========================================================================
    // EMERGENCY TENANT KILL SWITCH
    // =========================================================================

    fastify.post(
      '/kill-switch/tenant/:tenantId',
      {
        schema: {
          description: 'Execute kill switch for entire tenant (emergency)',
          tags: ['Kill Switch'],
          params: {
            type: 'object',
            required: ['tenantId'],
            properties: {
              tenantId: { type: 'string', format: 'uuid' },
            },
          },
          body: {
            type: 'object',
            required: ['reason'],
            properties: {
              reason: {
                type: 'string',
                enum: [
                  'CONTRACT_TERMINATION',
                  'SECURITY_INCIDENT',
                  'POLICY_VIOLATION',
                  'DATA_BREACH_SUSPECTED',
                  'UNAUTHORIZED_ACCESS',
                  'MANUAL_TERMINATION',
                  'SCHEDULED_END',
                  'COMPLIANCE_REQUIREMENT',
                ],
              },
              details: { type: 'string', maxLength: 2000 },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                eventId: { type: 'string' },
                status: { type: 'string' },
                executionTimeMs: { type: 'number' },
                sessionsTerminated: { type: 'number' },
                podsTerminated: { type: 'number' },
                tokensRevoked: { type: 'number' },
              },
            },
          },
        },
      },
      async (
        request: FastifyRequest<{
          Params: { tenantId: string };
          Body: { reason: string; details?: string };
        }>,
        reply: FastifyReply
      ) => {
        const { tenantId } = request.params;
        const { reason, details } = request.body as { reason: string; details?: string };
        const triggeredBy = (request.headers['x-user-id'] as string) || 'system';

        try {
          const result = await killSwitchService.execute({
            scope: 'TENANT',
            tenantId,
            triggeredBy,
            reason: reason as Parameters<typeof killSwitchService.execute>[0]['reason'],
            details: details ?? null,
          });

          return await reply.send(result);
        } catch (error) {
          request.log.error(error, 'Tenant kill switch failed');
          return reply.status(500).send({
            error: 'Kill Switch Failed',
            message: 'Failed to execute tenant kill switch',
          });
        }
      }
    );

    // =========================================================================
    // EMERGENCY USER KILL SWITCH
    // =========================================================================

    fastify.post(
      '/kill-switch/user/:userId',
      {
        schema: {
          description: 'Execute kill switch for specific user',
          tags: ['Kill Switch'],
          params: {
            type: 'object',
            required: ['userId'],
            properties: {
              userId: { type: 'string', format: 'uuid' },
            },
          },
          body: {
            type: 'object',
            required: ['reason'],
            properties: {
              reason: {
                type: 'string',
                enum: [
                  'CONTRACT_TERMINATION',
                  'SECURITY_INCIDENT',
                  'POLICY_VIOLATION',
                  'DATA_BREACH_SUSPECTED',
                  'UNAUTHORIZED_ACCESS',
                  'MANUAL_TERMINATION',
                  'SCHEDULED_END',
                  'COMPLIANCE_REQUIREMENT',
                ],
              },
              details: { type: 'string', maxLength: 2000 },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                eventId: { type: 'string' },
                status: { type: 'string' },
                executionTimeMs: { type: 'number' },
                sessionsTerminated: { type: 'number' },
                podsTerminated: { type: 'number' },
                tokensRevoked: { type: 'number' },
              },
            },
          },
        },
      },
      async (
        request: FastifyRequest<{
          Params: { userId: string };
          Body: { reason: string; details?: string };
        }>,
        reply: FastifyReply
      ) => {
        const { userId } = request.params;
        const { reason, details } = request.body as { reason: string; details?: string };
        const triggeredBy = (request.headers['x-user-id'] as string) || 'system';
        const tenantId = request.headers['x-tenant-id'] as string | undefined;

        try {
          const result = await killSwitchService.execute({
            scope: 'USER',
            userId,
            tenantId: tenantId ?? null,
            triggeredBy,
            reason: reason as Parameters<typeof killSwitchService.execute>[0]['reason'],
            details: details ?? null,
          });

          return await reply.send(result);
        } catch (error) {
          request.log.error(error, 'User kill switch failed');
          return reply.status(500).send({
            error: 'Kill Switch Failed',
            message: 'Failed to execute user kill switch',
          });
        }
      }
    );

    // =========================================================================
    // KILL SWITCH STATISTICS
    // =========================================================================

    fastify.get(
      '/kill-switch/stats',
      {
        schema: {
          description: 'Get kill switch statistics',
          tags: ['Kill Switch'],
          querystring: {
            type: 'object',
            properties: {
              tenantId: { type: 'string', format: 'uuid' },
              startDate: { type: 'string', format: 'date-time' },
              endDate: { type: 'string', format: 'date-time' },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                totalEvents: { type: 'number' },
                byStatus: { type: 'object' },
                byReason: { type: 'object' },
                byScope: { type: 'object' },
                avgExecutionTimeMs: { type: 'number' },
                slaBreaches: { type: 'number' },
              },
            },
          },
        },
      },
      async (
        request: FastifyRequest<{
          Querystring: { tenantId?: string; startDate?: string; endDate?: string };
        }>,
        reply: FastifyReply
      ) => {
        const { tenantId, startDate, endDate } = request.query;

        // Build filter
        const where: Record<string, unknown> = {};
        if (tenantId) where.tenantId = tenantId;
        if (startDate || endDate) {
          where.initiatedAt = {};
          if (startDate) (where.initiatedAt as Record<string, unknown>).gte = new Date(startDate);
          if (endDate) (where.initiatedAt as Record<string, unknown>).lte = new Date(endDate);
        }

        // Get all events for stats calculation
        const events = await (
          request.server as FastifyInstance & {
            db: {
              killSwitchEvent: {
                findMany: (args: unknown) => Promise<
                  Array<{
                    status: string;
                    triggerReason: string;
                    scope: string;
                    executionTimeMs?: number | null;
                  }>
                >;
              };
            };
          }
        ).db.killSwitchEvent.findMany({
          where,
          select: {
            status: true,
            triggerReason: true,
            scope: true,
            executionTimeMs: true,
          },
        });

        const byStatus: Record<string, number> = {};
        const byReason: Record<string, number> = {};
        const byScope: Record<string, number> = {};
        let totalExecutionTime = 0;
        let executionTimeCount = 0;
        let slaBreaches = 0;

        for (const event of events) {
          // Count by status
          byStatus[event.status] = (byStatus[event.status] || 0) + 1;

          // Count by reason
          byReason[event.triggerReason] = (byReason[event.triggerReason] || 0) + 1;

          // Count by scope
          byScope[event.scope] = (byScope[event.scope] || 0) + 1;

          // Execution time stats
          if (event.executionTimeMs !== null && event.executionTimeMs !== undefined) {
            totalExecutionTime += event.executionTimeMs;
            executionTimeCount++;

            if (event.executionTimeMs > 5000) {
              slaBreaches++;
            }
          }
        }

        return reply.send({
          totalEvents: events.length,
          byStatus,
          byReason,
          byScope,
          avgExecutionTimeMs:
            executionTimeCount > 0 ? Math.round(totalExecutionTime / executionTimeCount) : 0,
          slaBreaches,
        });
      }
    );
  };
}
