/**
 * @module @skillancer/skillpod-svc/services/kill-switch
 * Instant Kill Switch service for security incident response
 *
 * Terminates all active sessions within 5 seconds, purges cached data,
 * revokes access tokens, and preserves session recordings for forensics.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/promise-function-async */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */

import { Prisma } from '@/types/prisma-shim.js';

import type { CdnService } from './cdn.service.js';
import type { KasmWorkspacesService } from './kasm-workspaces.service.js';
import type {
  WebSocketEnforcementService,
  WebSocketMessage,
} from './websocket-enforcement.service.js';
import type {
  AccessRevocation,
  KillSwitchEvent,
  KillSwitchReason as KillSwitchReasonEnum,
  KillSwitchStatus as KillSwitchStatusEnum,
  PrismaClient,
} from '@/types/prisma-shim.js';
import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export type KillSwitchScope = 'TENANT' | 'USER' | 'POD' | 'SESSION';

export type KillSwitchReason =
  | 'CONTRACT_TERMINATION'
  | 'SECURITY_INCIDENT'
  | 'POLICY_VIOLATION'
  | 'DATA_BREACH_SUSPECTED'
  | 'UNAUTHORIZED_ACCESS'
  | 'MANUAL_TERMINATION'
  | 'SCHEDULED_END'
  | 'COMPLIANCE_REQUIREMENT';

export type KillSwitchStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'PARTIAL_FAILURE'
  | 'FAILED';

export type KillSwitchActionType =
  | 'TERMINATE_SESSION'
  | 'REVOKE_TOKENS'
  | 'PURGE_CACHE'
  | 'NOTIFY_USER'
  | 'NOTIFY_ADMIN'
  | 'BLOCK_RECONNECTION';

export type KillSwitchActionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export interface KillSwitchParams {
  scope: KillSwitchScope;
  tenantId?: string | null;
  userId?: string | null;
  podId?: string | null;
  sessionId?: string | null;
  triggeredBy: string;
  reason: KillSwitchReason;
  details?: string | null;
}

export interface KillSwitchResult {
  eventId: string;
  status: KillSwitchStatus;
  executionTimeMs: number;
  sessionsTerminated: number;
  tokensRevoked: number;
  errors: string[];
}

export interface KillSwitchTargets {
  sessions: SessionInfo[];
  userIds: string[];
  tenantId: string | null;
}

interface SessionInfo {
  id: string;
  userId: string;
  tenantId: string | null;
  kasmId: string | null;
}

export interface AccessBlockStatus {
  blocked: boolean;
  reason?: string | null;
  blockedAt?: Date | null;
  eventId?: string | null;
}

export interface ReinstateAccessParams {
  userId: string;
  reinstatedBy: string;
  reason: string;
  tenantId?: string | null;
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface KillSwitchService {
  execute(params: KillSwitchParams): Promise<KillSwitchResult>;
  reinstateAccess(params: ReinstateAccessParams): Promise<void>;
  isAccessBlocked(userId: string): Promise<AccessBlockStatus>;
  getEvent(eventId: string): Promise<KillSwitchEvent | null>;
  listEvents(params: ListEventsParams): Promise<{ events: KillSwitchEvent[]; total: number }>;
  getRevocationHistory(userId: string): Promise<AccessRevocation[]>;
}

interface ListEventsParams {
  tenantId?: string | null;
  userId?: string | null;
  status?: KillSwitchStatus | null;
  reason?: KillSwitchReason | null;
  startDate?: Date | null;
  endDate?: Date | null;
  page?: number;
  limit?: number;
}

// =============================================================================
// USER MESSAGES
// =============================================================================

const USER_MESSAGES: Record<KillSwitchReason, string> = {
  CONTRACT_TERMINATION:
    'Your access has been terminated due to contract completion or termination. Please contact your administrator for more information.',
  SECURITY_INCIDENT:
    'Your access has been temporarily suspended due to a security incident. Our team is investigating.',
  POLICY_VIOLATION:
    'Your access has been suspended due to a policy violation. Please contact your administrator.',
  DATA_BREACH_SUSPECTED:
    'Your access has been suspended as part of a security investigation. You will be contacted with more information.',
  UNAUTHORIZED_ACCESS: 'Your access has been revoked due to unauthorized access detection.',
  MANUAL_TERMINATION: 'Your access has been terminated by an administrator.',
  SCHEDULED_END: 'Your scheduled access period has ended.',
  COMPLIANCE_REQUIREMENT: 'Your access has been suspended due to compliance requirements.',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function extractSessionInfo(session: {
  id: string;
  userId: string;
  tenantId: string | null;
  config: unknown;
}): SessionInfo {
  const config = (session.config as Record<string, unknown>) || {};
  return {
    id: session.id,
    userId: session.userId,
    tenantId: session.tenantId,
    kasmId: (config['kasmId'] as string) || null,
  };
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export function createKillSwitchService(
  db: PrismaClient,
  redis: Redis,
  kasmService: KasmWorkspacesService,
  wsService: WebSocketEnforcementService,
  cdnService: CdnService
): KillSwitchService {
  const MAX_EXECUTION_TIME_MS = 5000; // 5 second SLA
  const TOKEN_REVOCATION_TTL = 86400; // 24 hours
  const BLOCK_TTL = 604800; // 7 days

  // ==========================================================================
  // MAIN KILL SWITCH EXECUTION
  // ==========================================================================

  async function execute(params: KillSwitchParams): Promise<KillSwitchResult> {
    const startTime = Date.now();

    // Create kill switch event record
    const event = await db.killSwitchEvent.create({
      data: {
        scope: params.scope,
        tenantId: params.tenantId ?? null,
        userId: params.userId ?? null,
        podId: params.podId ?? null,
        sessionId: params.sessionId ?? null,
        triggeredBy: params.triggeredBy,
        triggerReason: params.reason,
        triggerDetails: params.details ?? null,
        status: 'IN_PROGRESS',
      },
    });

    console.log(
      `[KillSwitch] Event ${event.id} started - Scope: ${params.scope}, Reason: ${params.reason}`
    );

    try {
      // Determine targets based on scope
      const targets = await determineTargets(params);

      console.log(
        `[KillSwitch] Targets: ${targets.sessions.length} sessions, ${targets.userIds.length} users`
      );

      // Execute all kill switch actions in parallel for speed
      const results = await Promise.allSettled([
        terminateSessions(event.id, targets.sessions),
        revokeTokens(event.id, targets.userIds),
        purgeCache(event.id, targets),
        blockReconnection(event.id, targets.userIds, targets.tenantId),
        notifyUsers(event.id, targets.userIds, params.reason),
        notifyAdmins(event.id, params),
      ]);

      // Process results
      const executionTime = Date.now() - startTime;
      const errorResults = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => ({
          message: (r.reason as Error)?.message || String(r.reason),
          type: 'UNKNOWN',
        }));

      let status: KillSwitchStatus;
      if (errorResults.length === 0) {
        status = 'COMPLETED';
      } else if (errorResults.length < results.length) {
        status = 'PARTIAL_FAILURE';
      } else {
        status = 'FAILED';
      }

      // Update event with results
      await db.killSwitchEvent.update({
        where: { id: event.id },
        data: {
          status,
          completedAt: new Date(),
          executionTimeMs: executionTime,
          sessionsTerminated: targets.sessions.length,
          tokensRevoked: targets.userIds.length,
          cachePurged: !errorResults.some((e) => e.type === 'CACHE_PURGE'),
          errors: errorResults.length > 0 ? errorResults : Prisma.DbNull,
        },
      });

      console.log(
        `[KillSwitch] Event ${event.id} completed in ${executionTime}ms - Status: ${status}`
      );

      // Verify SLA compliance
      if (executionTime > MAX_EXECUTION_TIME_MS) {
        console.warn(
          `[KillSwitch] SLA BREACH: ${executionTime}ms (target: ${MAX_EXECUTION_TIME_MS}ms)`
        );
      }

      return {
        eventId: event.id,
        status,
        executionTimeMs: executionTime,
        sessionsTerminated: targets.sessions.length,
        tokensRevoked: targets.userIds.length,
        errors: errorResults.map((e) => e.message),
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Critical failure - update event and alert
      await db.killSwitchEvent.update({
        where: { id: event.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          executionTimeMs: executionTime,
          errors: [
            {
              message: (error as Error).message,
              stack: (error as Error).stack,
            },
          ],
        },
      });

      console.error(`[KillSwitch] CRITICAL FAILURE for event ${event.id}:`, error);

      throw error;
    }
  }

  // ==========================================================================
  // TARGET DETERMINATION HELPERS
  // ==========================================================================

  async function getTenantTargets(tenantId: string): Promise<KillSwitchTargets> {
    const sessions: SessionInfo[] = [];
    const userIds: string[] = [];

    const tenantSessions = await db.session.findMany({
      where: { tenantId, status: 'RUNNING' },
    });

    for (const session of tenantSessions) {
      sessions.push(extractSessionInfo(session));
      if (!userIds.includes(session.userId)) {
        userIds.push(session.userId);
      }
    }

    return { sessions, userIds, tenantId };
  }

  async function getUserTargets(userId: string): Promise<KillSwitchTargets> {
    const sessions: SessionInfo[] = [];

    const userSessions = await db.session.findMany({
      where: { userId, status: 'RUNNING' },
    });

    for (const session of userSessions) {
      sessions.push(extractSessionInfo(session));
    }

    return { sessions, userIds: [userId], tenantId: null };
  }

  async function getPodTargets(podId: string): Promise<KillSwitchTargets> {
    const sessions: SessionInfo[] = [];
    const userIds: string[] = [];

    const allRunningSessions = await db.session.findMany({
      where: { status: 'RUNNING' },
    });

    for (const session of allRunningSessions) {
      const config = (session.config as Record<string, unknown>) || {};
      if (config['podId'] === podId) {
        sessions.push(extractSessionInfo(session));
        if (!userIds.includes(session.userId)) {
          userIds.push(session.userId);
        }
      }
    }

    return { sessions, userIds, tenantId: null };
  }

  async function getSessionTargets(sessionId: string): Promise<KillSwitchTargets> {
    const session = await db.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return { sessions: [], userIds: [], tenantId: null };
    }

    return {
      sessions: [extractSessionInfo(session)],
      userIds: [session.userId],
      tenantId: session.tenantId,
    };
  }

  // ==========================================================================
  // TARGET DETERMINATION
  // ==========================================================================

  async function determineTargets(params: KillSwitchParams): Promise<KillSwitchTargets> {
    switch (params.scope) {
      case 'TENANT':
        if (params.tenantId) return getTenantTargets(params.tenantId);
        break;

      case 'USER':
        if (params.userId) return getUserTargets(params.userId);
        break;

      case 'POD':
        if (params.podId) return getPodTargets(params.podId);
        break;

      case 'SESSION':
        if (params.sessionId) return getSessionTargets(params.sessionId);
        break;
    }

    return { sessions: [], userIds: [], tenantId: params.tenantId ?? null };
  }

  // ==========================================================================
  // SESSION TERMINATION
  // ==========================================================================

  async function terminateSessions(eventId: string, sessions: SessionInfo[]): Promise<void> {
    const terminationPromises = sessions.map(async (session) => {
      const action = await db.killSwitchAction.create({
        data: {
          killSwitchEventId: eventId,
          actionType: 'TERMINATE_SESSION',
          target: session.id,
          targetType: 'session',
          status: 'IN_PROGRESS',
          startedAt: new Date(),
        },
      });

      try {
        // Terminate Kasm workspace if available
        if (session.kasmId) {
          try {
            await kasmService.terminateWorkspace(session.kasmId);
          } catch (kasmError) {
            console.warn(
              `[KillSwitch] Failed to terminate Kasm workspace: ${(kasmError as Error).message}`
            );
          }
        }

        // Send immediate termination via WebSocket
        const terminationMessage: WebSocketMessage = {
          type: 'SESSION_TERMINATED',
          data: {
            reason: 'ACCESS_REVOKED',
            message: 'Your session has been terminated. Please contact your administrator.',
            reconnectAllowed: false,
          },
        };

        await wsService.sendToSession(session.id, terminationMessage);

        // Update session record
        await db.session.update({
          where: { id: session.id },
          data: {
            status: 'TERMINATED',
            endedAt: new Date(),
          },
        });

        await db.killSwitchAction.update({
          where: { id: action.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });

        console.log(`[KillSwitch] Session ${session.id} terminated`);
      } catch (error) {
        await db.killSwitchAction.update({
          where: { id: action.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            errorMessage: (error as Error).message,
          },
        });
        throw error;
      }
    });

    await Promise.all(terminationPromises);
  }

  // ==========================================================================
  // TOKEN REVOCATION
  // ==========================================================================

  async function revokeTokens(eventId: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;

    const action = await db.killSwitchAction.create({
      data: {
        killSwitchEventId: eventId,
        actionType: 'REVOKE_TOKENS',
        target: userIds.join(','),
        targetType: 'users',
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    try {
      // Revoke all refresh tokens for each user in database
      await Promise.all(
        userIds.map(async (userId) =>
          db.refreshToken.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
          })
        )
      );

      // Clear session cache in Redis
      await Promise.all(userIds.map(async (userId) => deleteRedisPattern(`session:${userId}:*`)));

      // Add users to revocation blocklist (prevents new token issuance)
      await Promise.all(
        userIds.map(async (userId) =>
          redis.setex(`revoked:${userId}`, TOKEN_REVOCATION_TTL, 'true')
        )
      );

      await db.killSwitchAction.update({
        where: { id: action.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      console.log(`[KillSwitch] Tokens revoked for ${userIds.length} users`);
    } catch (error) {
      await db.killSwitchAction.update({
        where: { id: action.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: (error as Error).message,
        },
      });
      throw error;
    }
  }

  // ==========================================================================
  // CACHE PURGING
  // ==========================================================================

  async function purgeCache(eventId: string, targets: KillSwitchTargets): Promise<void> {
    const action = await db.killSwitchAction.create({
      data: {
        killSwitchEventId: eventId,
        actionType: 'PURGE_CACHE',
        target: 'all_edge_nodes',
        targetType: 'cache',
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    try {
      // Purge Redis cache
      const cachePatterns: string[] = [];

      for (const session of targets.sessions) {
        cachePatterns.push(`session:${session.id}:*`, `pod_data:${session.id}:*`);
      }

      for (const userId of targets.userIds) {
        cachePatterns.push(`user_session:${userId}:*`, `user_pods:${userId}:*`);
      }

      await Promise.all(cachePatterns.map(async (pattern) => deleteRedisPattern(pattern)));

      // Purge CDN edge cache (CloudFront)
      if (targets.tenantId) {
        await cdnService.invalidateTenantCache(targets.tenantId);
      }

      // Also invalidate specific sessions
      await Promise.all(targets.sessions.map(async (s) => cdnService.invalidateSessionCache(s.id)));

      await db.killSwitchAction.update({
        where: { id: action.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      console.log(
        `[KillSwitch] Cache purged - ${cachePatterns.length} Redis patterns, CDN invalidated`
      );
    } catch (error) {
      await db.killSwitchAction.update({
        where: { id: action.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: (error as Error).message,
        },
      });
      throw error;
    }
  }

  // ==========================================================================
  // BLOCK RECONNECTION
  // ==========================================================================

  async function blockReconnection(
    eventId: string,
    userIds: string[],
    tenantId: string | null
  ): Promise<void> {
    if (userIds.length === 0) return;

    const action = await db.killSwitchAction.create({
      data: {
        killSwitchEventId: eventId,
        actionType: 'BLOCK_RECONNECTION',
        target: userIds.join(','),
        targetType: 'users',
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    try {
      // Create access revocation records
      await Promise.all(
        userIds.map((userId) =>
          db.accessRevocation.create({
            data: {
              tenantId,
              userId,
              revokedBy: eventId, // System revocation
              reason: 'Kill switch executed',
              scope: 'SKILLPOD_ONLY',
              isActive: true,
              killSwitchEventId: eventId,
            },
          })
        )
      );

      // Add to real-time blocklist
      await Promise.all(
        userIds.map(async (userId) =>
          redis.setex(
            `blocked:skillpod:${userId}`,
            BLOCK_TTL,
            JSON.stringify({
              eventId,
              blockedAt: new Date().toISOString(),
              reason: 'KILL_SWITCH',
            })
          )
        )
      );

      await db.killSwitchAction.update({
        where: { id: action.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      console.log(`[KillSwitch] ${userIds.length} users blocked from reconnection`);
    } catch (error) {
      await db.killSwitchAction.update({
        where: { id: action.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: (error as Error).message,
        },
      });
      throw error;
    }
  }

  // ==========================================================================
  // USER NOTIFICATION
  // ==========================================================================

  async function notifyUsers(
    eventId: string,
    userIds: string[],
    reason: KillSwitchReason
  ): Promise<void> {
    if (userIds.length === 0) return;

    const action = await db.killSwitchAction.create({
      data: {
        killSwitchEventId: eventId,
        actionType: 'NOTIFY_USER',
        target: userIds.join(','),
        targetType: 'users',
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    try {
      const message =
        USER_MESSAGES[reason] || 'Your access has been revoked. Please contact support.';

      // Create in-app notifications
      await Promise.all(
        userIds.map(async (userId) =>
          db.notification.create({
            data: {
              userId,
              type: 'ACCESS_REVOKED',
              category: 'SYSTEM',
              title: 'Access Revoked',
              body: message,
              data: { eventId, reason },
            },
          })
        )
      );

      await db.killSwitchAction.update({
        where: { id: action.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      console.log(`[KillSwitch] ${userIds.length} users notified`);
    } catch (error) {
      // Non-critical - log but don't fail
      await db.killSwitchAction.update({
        where: { id: action.id },
        data: {
          status: 'COMPLETED', // Mark as completed even with partial failures
          completedAt: new Date(),
          errorMessage: `Some notifications failed: ${(error as Error).message}`,
        },
      });
    }
  }

  // ==========================================================================
  // ADMIN NOTIFICATION
  // ==========================================================================

  async function notifyAdmins(eventId: string, params: KillSwitchParams): Promise<void> {
    const action = await db.killSwitchAction.create({
      data: {
        killSwitchEventId: eventId,
        actionType: 'NOTIFY_ADMIN',
        target: 'admin_team',
        targetType: 'team',
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    try {
      // Find tenant admins if tenant scope
      if (params.tenantId) {
        const tenantAdmins = await db.tenantMember.findMany({
          where: {
            tenantId: params.tenantId,
            role: { in: ['ADMIN', 'OWNER'] },
          },
          select: { userId: true },
        });

        // Create notifications for admins
        await Promise.all(
          tenantAdmins.map(async (admin) =>
            db.notification.create({
              data: {
                userId: admin.userId,
                type: 'KILL_SWITCH_EXECUTED',
                category: 'SYSTEM',
                title: 'Kill Switch Executed',
                body: `Kill switch executed for ${params.scope.toLowerCase()}: ${params.reason}`,
                data: {
                  eventId,
                  scope: params.scope,
                  reason: params.reason,
                  triggeredBy: params.triggeredBy,
                  affectedUserId: params.userId,
                },
              },
            })
          )
        );
      }

      await db.killSwitchAction.update({
        where: { id: action.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      console.log(`[KillSwitch] Admins notified`);
    } catch (error) {
      await db.killSwitchAction.update({
        where: { id: action.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: (error as Error).message,
        },
      });
      throw error;
    }
  }

  // ==========================================================================
  // ACCESS REINSTATEMENT
  // ==========================================================================

  async function reinstateAccess(params: ReinstateAccessParams): Promise<void> {
    const { userId, reinstatedBy, reason } = params;

    // Find active revocations
    const revocations = await db.accessRevocation.findMany({
      where: {
        userId,
        isActive: true,
      },
    });

    // Update all revocations
    await Promise.all(
      revocations.map((revocation) =>
        db.accessRevocation.update({
          where: { id: revocation.id },
          data: {
            isActive: false,
            reinstatedBy,
            reinstatedAt: new Date(),
            reinstateReason: reason,
          },
        })
      )
    );

    // Remove from blocklists
    await redis.del(`blocked:skillpod:${userId}`);
    await redis.del(`revoked:${userId}`);

    // Create notification
    await db.notification.create({
      data: {
        userId,
        type: 'ACCESS_REINSTATED',
        category: 'SYSTEM',
        title: 'Access Reinstated',
        body: 'Your SkillPod access has been reinstated.',
        data: { reinstatedBy, reason },
      },
    });

    console.log(`[KillSwitch] Access reinstated for user ${userId}`);
  }

  // ==========================================================================
  // ACCESS CHECK
  // ==========================================================================

  async function isAccessBlocked(userId: string): Promise<AccessBlockStatus> {
    // Check Redis blocklist first (faster)
    const blockData = await redis.get(`blocked:skillpod:${userId}`);

    if (blockData) {
      try {
        const parsed = JSON.parse(blockData) as {
          eventId: string;
          blockedAt: string;
          reason: string;
        };
        return {
          blocked: true,
          reason: parsed.reason,
          blockedAt: new Date(parsed.blockedAt),
          eventId: parsed.eventId,
        };
      } catch {
        // Invalid JSON, still blocked
        return { blocked: true, reason: 'KILL_SWITCH' };
      }
    }

    // Check database for persistent revocations
    const activeRevocation = await db.accessRevocation.findFirst({
      where: {
        userId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (activeRevocation) {
      return {
        blocked: true,
        reason: activeRevocation.reason,
        blockedAt: activeRevocation.createdAt,
        eventId: activeRevocation.killSwitchEventId,
      };
    }

    return { blocked: false };
  }

  // ==========================================================================
  // EVENT QUERIES
  // ==========================================================================

  function getEvent(eventId: string): Promise<KillSwitchEvent | null> {
    return db.killSwitchEvent.findUnique({
      where: { id: eventId },
      include: { actions: true },
    }) as Promise<KillSwitchEvent | null>;
  }

  async function listEvents(
    params: ListEventsParams
  ): Promise<{ events: KillSwitchEvent[]; total: number }> {
    const { tenantId, userId, status, reason, startDate, endDate, page = 1, limit = 20 } = params;

    interface WhereClause {
      tenantId?: string;
      userId?: string;
      status?: KillSwitchStatusEnum;
      triggerReason?: KillSwitchReasonEnum;
      initiatedAt?: { gte?: Date; lte?: Date };
    }

    const where: WhereClause = {};
    if (tenantId) where.tenantId = tenantId;
    if (userId) where.userId = userId;
    if (status) where.status = status as KillSwitchStatusEnum;
    if (reason) where.triggerReason = reason as KillSwitchReasonEnum;
    if (startDate || endDate) {
      where.initiatedAt = {};
      if (startDate) where.initiatedAt.gte = startDate;
      if (endDate) where.initiatedAt.lte = endDate;
    }

    const [events, total] = await Promise.all([
      db.killSwitchEvent.findMany({
        where,
        include: { actions: true },
        orderBy: { initiatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.killSwitchEvent.count({ where }),
    ]);

    return { events, total };
  }

  function getRevocationHistory(userId: string): Promise<AccessRevocation[]> {
    return db.accessRevocation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }) as Promise<AccessRevocation[]>;
  }

  // ==========================================================================
  // HELPER FUNCTIONS
  // ==========================================================================

  async function deleteRedisPattern(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  return {
    execute,
    reinstateAccess,
    isAccessBlocked,
    getEvent,
    listEvents,
    getRevocationHistory,
  };
}
