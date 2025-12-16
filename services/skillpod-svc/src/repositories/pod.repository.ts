/**
 * @module @skillancer/skillpod-svc/repositories/pod
 * Pod/Session repository for database operations
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import type { PrismaClient, Session, PodSecurityPolicy } from '@prisma/client';

// =============================================================================
// TYPES
// =============================================================================

export interface PodWithPolicy extends Session {
  securityPolicy: PodSecurityPolicy | null;
}

export interface CreatePodInput {
  userId: string;
  tenantId: string;
  policyId?: string;
  type?: 'DEVELOPMENT' | 'TESTING' | 'PRODUCTION' | 'TRAINING';
  config?: Record<string, unknown>;
}

export interface UpdatePodInput {
  status?: string;
  policyId?: string;
  config?: Record<string, unknown>;
  endedAt?: Date;
}

export interface PodListFilter {
  tenantId: string;
  userId?: string;
  status?: string;
  type?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface PodListOptions {
  page?: number;
  limit?: number;
  orderBy?: 'createdAt' | 'startedAt' | 'status';
  orderDirection?: 'asc' | 'desc';
}

// =============================================================================
// REPOSITORY INTERFACE
// =============================================================================

export interface PodRepository {
  create(input: CreatePodInput): Promise<Session>;
  findById(id: string): Promise<PodWithPolicy | null>;
  findByKasmId(kasmId: string): Promise<PodWithPolicy | null>;
  findMany(
    filter: PodListFilter,
    options?: PodListOptions
  ): Promise<{
    pods: PodWithPolicy[];
    total: number;
  }>;
  update(id: string, input: UpdatePodInput): Promise<Session>;
  delete(id: string): Promise<void>;
  countByTenant(tenantId: string): Promise<number>;
  countByUser(userId: string): Promise<number>;
  countActive(tenantId: string): Promise<number>;
}

// =============================================================================
// REPOSITORY IMPLEMENTATION
// =============================================================================

export function createPodRepository(prisma: PrismaClient): PodRepository {
  async function create(input: CreatePodInput): Promise<Session> {
    return prisma.session.create({
      data: {
        userId: input.userId,
        tenantId: input.tenantId,
        securityPolicyId: input.policyId,
        type: input.type ?? 'DEVELOPMENT',
        status: 'PENDING',
        config: (input.config ?? {}) as object,
        startedAt: new Date(),
      },
    });
  }

  async function findById(id: string): Promise<PodWithPolicy | null> {
    return prisma.session.findUnique({
      where: { id },
      include: { securityPolicy: true },
    });
  }

  async function findByKasmId(kasmId: string): Promise<PodWithPolicy | null> {
    const sessions = await prisma.session.findMany({
      where: {
        config: {
          path: ['kasmId'],
          equals: kasmId,
        },
      },
      include: { securityPolicy: true },
      take: 1,
    });

    return sessions[0] ?? null;
  }

  async function findMany(
    filter: PodListFilter,
    options: PodListOptions = {}
  ): Promise<{
    pods: PodWithPolicy[];
    total: number;
  }> {
    const { page = 1, limit = 20, orderBy = 'createdAt', orderDirection = 'desc' } = options;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId: filter.tenantId };
    if (filter.userId) where.userId = filter.userId;
    if (filter.status) where.status = filter.status;
    if (filter.type) where.type = filter.type;
    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) (where.createdAt as Record<string, unknown>).gte = filter.startDate;
      if (filter.endDate) (where.createdAt as Record<string, unknown>).lte = filter.endDate;
    }

    const [pods, total] = await Promise.all([
      prisma.session.findMany({
        where,
        include: { securityPolicy: true },
        orderBy: { [orderBy]: orderDirection },
        skip,
        take: limit,
      }),
      prisma.session.count({ where }),
    ]);

    return { pods, total };
  }

  async function update(id: string, input: UpdatePodInput): Promise<Session> {
    const data: Record<string, unknown> = {};
    if (input.status) data.status = input.status;
    if (input.policyId) data.securityPolicyId = input.policyId;
    if (input.config) data.config = input.config;
    if (input.endedAt) data.endedAt = input.endedAt;

    return prisma.session.update({
      where: { id },
      data,
    });
  }

  async function deletePod(id: string): Promise<void> {
    await prisma.session.delete({ where: { id } });
  }

  async function countByTenant(tenantId: string): Promise<number> {
    return prisma.session.count({ where: { tenantId } });
  }

  async function countByUser(userId: string): Promise<number> {
    return prisma.session.count({ where: { userId } });
  }

  async function countActive(tenantId: string): Promise<number> {
    return prisma.session.count({
      where: {
        tenantId,
        status: { in: ['PROVISIONING', 'RUNNING', 'PAUSED'] },
      },
    });
  }

  return {
    create,
    findById,
    findByKasmId,
    findMany,
    update,
    delete: deletePod,
    countByTenant,
    countByUser,
    countActive,
  };
}
