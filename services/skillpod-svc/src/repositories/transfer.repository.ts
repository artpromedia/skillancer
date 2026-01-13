/**
 * @module @skillancer/skillpod-svc/repositories/transfer
 * Data transfer attempt repository for database operations
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */

import type { PrismaClient, DataTransferAttempt } from '@/types/prisma-shim.js';

// =============================================================================
// TYPES
// =============================================================================

export type TransferType =
  | 'CLIPBOARD_TEXT'
  | 'CLIPBOARD_IMAGE'
  | 'CLIPBOARD_FILE'
  | 'FILE_DOWNLOAD'
  | 'FILE_UPLOAD'
  | 'USB_TRANSFER'
  | 'PRINT'
  | 'SCREEN_SHARE';

export type TransferDirection = 'INBOUND' | 'OUTBOUND' | 'INTERNAL';

export type TransferAction = 'ALLOWED' | 'BLOCKED' | 'LOGGED' | 'QUARANTINED' | 'OVERRIDE_APPROVED';

export interface CreateTransferAttemptInput {
  sessionId: string;
  userId: string;
  tenantId: string;
  transferType: TransferType;
  direction: TransferDirection;
  contentType?: string;
  contentSize?: number;
  contentHash?: string;
  fileName?: string;
  action: TransferAction;
  reason?: string;
  policyId?: string;
  policyRule?: string;
  sourceApplication?: string;
  targetApplication?: string;
  ipAddress?: string;
}

export interface TransferAttemptFilter {
  sessionId?: string;
  userId?: string;
  tenantId?: string;
  transferType?: TransferType;
  direction?: TransferDirection;
  action?: TransferAction;
  startDate?: Date;
  endDate?: Date;
}

export interface TransferAttemptListOptions {
  page?: number;
  limit?: number;
  orderBy?: 'createdAt';
  orderDirection?: 'asc' | 'desc';
}

export interface TransferStats {
  total: number;
  allowed: number;
  blocked: number;
  logged: number;
  quarantined: number;
  byType: Record<TransferType, number>;
}

// =============================================================================
// REPOSITORY INTERFACE
// =============================================================================

export interface TransferRepository {
  create(input: CreateTransferAttemptInput): Promise<DataTransferAttempt>;
  findById(id: string): Promise<DataTransferAttempt | null>;
  findMany(
    filter: TransferAttemptFilter,
    options?: TransferAttemptListOptions
  ): Promise<{
    attempts: DataTransferAttempt[];
    total: number;
  }>;
  getStats(filter: TransferAttemptFilter): Promise<TransferStats>;
  markAsOverridden(id: string, overrideBy: string, reason: string): Promise<DataTransferAttempt>;
  deleteBySession(sessionId: string): Promise<number>;
}

// =============================================================================
// REPOSITORY IMPLEMENTATION
// =============================================================================

export function createTransferRepository(prisma: PrismaClient): TransferRepository {
  async function create(input: CreateTransferAttemptInput): Promise<DataTransferAttempt> {
    return prisma.dataTransferAttempt.create({
      data: {
        sessionId: input.sessionId,
        userId: input.userId,
        tenantId: input.tenantId,
        transferType: input.transferType,
        direction: input.direction,
        contentType: input.contentType ?? null,
        contentSize: input.contentSize ?? null,
        contentHash: input.contentHash ?? null,
        fileName: input.fileName ?? null,
        action: input.action,
        reason: input.reason ?? null,
        policyId: input.policyId ?? null,
        policyRule: input.policyRule ?? null,
        sourceApplication: input.sourceApplication ?? null,
        targetApplication: input.targetApplication ?? null,
        ipAddress: input.ipAddress ?? null,
      },
    });
  }

  async function findById(id: string): Promise<DataTransferAttempt | null> {
    return prisma.dataTransferAttempt.findUnique({
      where: { id },
    });
  }

  async function findMany(
    filter: TransferAttemptFilter,
    options: TransferAttemptListOptions = {}
  ): Promise<{
    attempts: DataTransferAttempt[];
    total: number;
  }> {
    const { page = 1, limit = 20, orderBy = 'createdAt', orderDirection = 'desc' } = options;
    const skip = (page - 1) * limit;

    const where = buildWhereClause(filter);

    const [attempts, total] = await Promise.all([
      prisma.dataTransferAttempt.findMany({
        where,
        orderBy: { [orderBy]: orderDirection },
        skip,
        take: limit,
      }),
      prisma.dataTransferAttempt.count({ where }),
    ]);

    return { attempts, total };
  }

  async function getStats(filter: TransferAttemptFilter): Promise<TransferStats> {
    const where = buildWhereClause(filter);

    const [total, actionStats, typeStats] = await Promise.all([
      prisma.dataTransferAttempt.count({ where }),
      prisma.dataTransferAttempt.groupBy({
        by: ['action'],
        where,
        _count: { id: true },
      }),
      prisma.dataTransferAttempt.groupBy({
        by: ['transferType'],
        where,
        _count: { id: true },
      }),
    ]);

    const actionCounts = actionStats.reduce(
      (acc, stat) => {
        acc[stat.action.toLowerCase() as keyof typeof acc] = stat._count.id;
        return acc;
      },
      { allowed: 0, blocked: 0, logged: 0, quarantined: 0 }
    );

    const typeCounts = typeStats.reduce(
      (acc, stat) => {
        acc[stat.transferType as TransferType] = stat._count.id;
        return acc;
      },
      {} as Record<TransferType, number>
    );

    return {
      total,
      ...actionCounts,
      byType: typeCounts,
    };
  }

  async function markAsOverridden(
    id: string,
    overrideBy: string,
    reason: string
  ): Promise<DataTransferAttempt> {
    return prisma.dataTransferAttempt.update({
      where: { id },
      data: {
        action: 'OVERRIDE_APPROVED',
        overrideApproved: true,
        overrideBy,
        overrideReason: reason,
      },
    });
  }

  async function deleteBySession(sessionId: string): Promise<number> {
    const result = await prisma.dataTransferAttempt.deleteMany({
      where: { sessionId },
    });
    return result.count;
  }

  return {
    create,
    findById,
    findMany,
    getStats,
    markAsOverridden,
    deleteBySession,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function buildWhereClause(filter: TransferAttemptFilter): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  if (filter.sessionId) where.sessionId = filter.sessionId;
  if (filter.userId) where.userId = filter.userId;
  if (filter.tenantId) where.tenantId = filter.tenantId;
  if (filter.transferType) where.transferType = filter.transferType;
  if (filter.direction) where.direction = filter.direction;
  if (filter.action) where.action = filter.action;

  if (filter.startDate || filter.endDate) {
    where.createdAt = {};
    if (filter.startDate) (where.createdAt as Record<string, unknown>).gte = filter.startDate;
    if (filter.endDate) (where.createdAt as Record<string, unknown>).lte = filter.endDate;
  }

  return where;
}
