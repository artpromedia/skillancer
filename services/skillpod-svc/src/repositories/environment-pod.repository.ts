/**
 * @module @skillancer/skillpod-svc/repositories/environment-pod
 * Environment Pod repository for database operations
 *
 * Note: This file contains type mismatches due to exactOptionalPropertyTypes.
 * Prisma uses `null` for optional fields while our interfaces use `undefined`.
 * This is acceptable as the values are equivalent at runtime.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable import/order */

import type {
  PrismaClient,
  Pod,
  PodSession,
  PodResourceHistory,
  PodStatus,
  ScalingEventType,
  Prisma,
} from '@prisma/client';
import type {
  ResourceSpec,
  AutoScalingConfig,
  ResourceUtilization,
} from '../types/environment.types.js';

// =============================================================================
// TYPES
// =============================================================================

export interface PodWithRelations extends Pod {
  template?: {
    id: string;
    name: string;
    slug: string;
    category: string;
    iconUrl: string | null;
  } | null;
  owner?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  securityPolicy?: {
    id: string;
    name: string;
  } | null;
  _count?: {
    podSessions: number;
    resourceHistory: number;
  };
}

export interface CreatePodInput {
  tenantId: string;
  ownerId: string;
  templateId?: string;
  name: string;
  description?: string;
  status: PodStatus;
  currentResources: ResourceSpec;
  resourceLimits: ResourceSpec;
  autoScalingEnabled: boolean;
  autoScalingConfig?: AutoScalingConfig;
  securityPolicyId?: string;
  persistentStorage: boolean;
  storageVolumeId?: string;
  expiresAt?: Date;
}

export interface UpdatePodInput {
  name?: string;
  description?: string;
  status?: PodStatus;
  kasmId?: string | null;
  kasmStatus?: string | null;
  currentResources?: ResourceSpec;
  resourceLimits?: ResourceSpec;
  autoScalingEnabled?: boolean;
  autoScalingConfig?: AutoScalingConfig | null;
  securityPolicyId?: string | null;
  connectionUrl?: string | null;
  connectionToken?: string | null;
  lastAccessedAt?: Date;
  terminatedAt?: Date;
  expiresAt?: Date | null;
  totalCostCents?: number;
}

export interface PodListFilter {
  tenantId: string;
  ownerId?: string;
  status?: PodStatus;
  templateId?: string;
  autoScalingEnabled?: boolean;
}

export interface PodListOptions {
  page?: number;
  limit?: number;
  orderBy?: 'createdAt' | 'lastAccessedAt' | 'name' | 'status';
  orderDirection?: 'asc' | 'desc';
}

export interface CreateResourceHistoryInput {
  podId: string;
  resources: ResourceSpec;
  utilization?: ResourceUtilization;
  scalingEvent?: ScalingEventType;
  scalingReason?: string;
  hourlyRateCents: number;
  recordedAt?: Date;
}

export interface CreatePodSessionInput {
  podId: string;
  userId: string;
  startedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

// =============================================================================
// REPOSITORY INTERFACE
// =============================================================================

export interface EnvironmentPodRepository {
  // Pod CRUD
  create(input: CreatePodInput): Promise<Pod>;
  findById(id: string): Promise<PodWithRelations | null>;
  findByKasmId(kasmId: string): Promise<PodWithRelations | null>;
  findMany(
    filter: PodListFilter,
    options?: PodListOptions
  ): Promise<{ pods: PodWithRelations[]; total: number }>;
  update(id: string, input: UpdatePodInput): Promise<Pod>;
  delete(id: string): Promise<void>;

  // Auto-scaling queries
  findAutoScalingEnabled(): Promise<Pod[]>;
  findRunning(tenantId?: string): Promise<Pod[]>;
  findExpired(): Promise<Pod[]>;
  findIdle(idleMinutes: number): Promise<Pod[]>;

  // Resource history
  createResourceHistory(input: CreateResourceHistoryInput): Promise<PodResourceHistory>;
  getResourceHistory(podId: string, limit?: number): Promise<PodResourceHistory[]>;
  getRecentResourceHistory(podId: string, limit: number): Promise<PodResourceHistory[]>;

  // Pod sessions
  createSession(input: CreatePodSessionInput): Promise<PodSession>;
  endSession(sessionId: string, durationMins: number, costCents: number): Promise<PodSession>;
  getActiveSessions(podId: string): Promise<PodSession[]>;

  // Stats
  countByTenant(tenantId: string): Promise<number>;
  countActiveByTenant(tenantId: string): Promise<number>;
  countByOwner(ownerId: string): Promise<number>;
  sumResourcesByTenant(
    tenantId: string
  ): Promise<{ cpu: number; memory: number; storage: number; gpus: number }>;
}

// =============================================================================
// REPOSITORY IMPLEMENTATION
// =============================================================================

export function createEnvironmentPodRepository(prisma: PrismaClient): EnvironmentPodRepository {
  // ---------------------------------------------------------------------------
  // Pod CRUD
  // ---------------------------------------------------------------------------

  async function create(input: CreatePodInput): Promise<Pod> {
    return prisma.pod.create({
      data: {
        tenantId: input.tenantId,
        ownerId: input.ownerId,
        templateId: input.templateId,
        name: input.name,
        description: input.description,
        status: input.status,
        currentResources: input.currentResources as unknown as Prisma.InputJsonValue,
        resourceLimits: input.resourceLimits as unknown as Prisma.InputJsonValue,
        autoScalingEnabled: input.autoScalingEnabled,
        autoScalingConfig: input.autoScalingConfig as unknown as Prisma.InputJsonValue,
        securityPolicyId: input.securityPolicyId,
        persistentStorage: input.persistentStorage,
        storageVolumeId: input.storageVolumeId,
        expiresAt: input.expiresAt,
      },
    });
  }

  async function findById(id: string): Promise<PodWithRelations | null> {
    return prisma.pod.findUnique({
      where: { id },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
            iconUrl: true,
          },
        },
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        securityPolicy: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            podSessions: true,
            resourceHistory: true,
          },
        },
      },
    });
  }

  async function findByKasmId(kasmId: string): Promise<PodWithRelations | null> {
    return prisma.pod.findUnique({
      where: { kasmId },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
            iconUrl: true,
          },
        },
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        securityPolicy: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            podSessions: true,
            resourceHistory: true,
          },
        },
      },
    });
  }

  async function findMany(
    filter: PodListFilter,
    options: PodListOptions = {}
  ): Promise<{ pods: PodWithRelations[]; total: number }> {
    const { page = 1, limit = 20, orderBy = 'createdAt', orderDirection = 'desc' } = options;
    const skip = (page - 1) * limit;

    const whereConditions: Prisma.PodWhereInput[] = [{ tenantId: filter.tenantId }];

    if (filter.ownerId) {
      whereConditions.push({ ownerId: filter.ownerId });
    }

    if (filter.status) {
      whereConditions.push({ status: filter.status });
    }

    if (filter.templateId) {
      whereConditions.push({ templateId: filter.templateId });
    }

    if (filter.autoScalingEnabled !== undefined) {
      whereConditions.push({ autoScalingEnabled: filter.autoScalingEnabled });
    }

    const where: Prisma.PodWhereInput = { AND: whereConditions };

    const [pods, total] = await Promise.all([
      prisma.pod.findMany({
        where,
        include: {
          template: {
            select: {
              id: true,
              name: true,
              slug: true,
              category: true,
              iconUrl: true,
            },
          },
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          securityPolicy: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              podSessions: true,
              resourceHistory: true,
            },
          },
        },
        orderBy: { [orderBy]: orderDirection },
        skip,
        take: limit,
      }),
      prisma.pod.count({ where }),
    ]);

    return { pods, total };
  }

  async function update(id: string, input: UpdatePodInput): Promise<Pod> {
    // Build update data - only include defined fields
    const simpleFields = [
      'name',
      'description',
      'status',
      'kasmId',
      'kasmStatus',
      'autoScalingEnabled',
      'securityPolicyId',
      'connectionUrl',
      'connectionToken',
      'lastAccessedAt',
      'terminatedAt',
      'expiresAt',
      'totalCostCents',
    ] as const;

    const jsonFields = ['currentResources', 'resourceLimits', 'autoScalingConfig'] as const;

    const data: Prisma.PodUpdateInput = {};

    for (const field of simpleFields) {
      if (input[field] !== undefined) {
        (data as Record<string, unknown>)[field] = input[field];
      }
    }

    for (const field of jsonFields) {
      if (input[field] !== undefined) {
        (data as Record<string, unknown>)[field] = input[field] as Prisma.InputJsonValue;
      }
    }

    return prisma.pod.update({
      where: { id },
      data,
    });
  }

  async function deletePod(id: string): Promise<void> {
    await prisma.pod.delete({
      where: { id },
    });
  }

  // ---------------------------------------------------------------------------
  // Auto-scaling queries
  // ---------------------------------------------------------------------------

  async function findAutoScalingEnabled(): Promise<Pod[]> {
    return prisma.pod.findMany({
      where: {
        autoScalingEnabled: true,
        status: 'RUNNING',
      },
    });
  }

  async function findRunning(tenantId?: string): Promise<Pod[]> {
    return prisma.pod.findMany({
      where: {
        status: 'RUNNING',
        ...(tenantId && { tenantId }),
      },
    });
  }

  async function findExpired(): Promise<Pod[]> {
    return prisma.pod.findMany({
      where: {
        expiresAt: {
          lte: new Date(),
        },
        status: {
          notIn: ['TERMINATED', 'ERROR'],
        },
      },
    });
  }

  async function findIdle(idleMinutes: number): Promise<Pod[]> {
    const idleThreshold = new Date(Date.now() - idleMinutes * 60 * 1000);
    return prisma.pod.findMany({
      where: {
        status: 'RUNNING',
        lastAccessedAt: {
          lte: idleThreshold,
        },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Resource history
  // ---------------------------------------------------------------------------

  async function createResourceHistory(
    input: CreateResourceHistoryInput
  ): Promise<PodResourceHistory> {
    return prisma.podResourceHistory.create({
      data: {
        podId: input.podId,
        resources: input.resources as unknown as Prisma.InputJsonValue,
        utilization: input.utilization as unknown as Prisma.InputJsonValue,
        scalingEvent: input.scalingEvent,
        scalingReason: input.scalingReason,
        hourlyRateCents: input.hourlyRateCents,
        recordedAt: input.recordedAt ?? new Date(),
      },
    });
  }

  async function getResourceHistory(podId: string, limit = 100): Promise<PodResourceHistory[]> {
    return prisma.podResourceHistory.findMany({
      where: { podId },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });
  }

  // getRecentResourceHistory is an alias for getResourceHistory for backwards compatibility
  const getRecentResourceHistory = getResourceHistory;

  // ---------------------------------------------------------------------------
  // Pod sessions
  // ---------------------------------------------------------------------------

  async function createSession(input: CreatePodSessionInput): Promise<PodSession> {
    return prisma.podSession.create({
      data: {
        podId: input.podId,
        userId: input.userId,
        startedAt: input.startedAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  async function endSession(
    sessionId: string,
    durationMins: number,
    costCents: number
  ): Promise<PodSession> {
    return prisma.podSession.update({
      where: { id: sessionId },
      data: {
        endedAt: new Date(),
        durationMins,
        costCents,
      },
    });
  }

  async function getActiveSessions(podId: string): Promise<PodSession[]> {
    return prisma.podSession.findMany({
      where: {
        podId,
        endedAt: null,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  async function countByTenant(tenantId: string): Promise<number> {
    return prisma.pod.count({
      where: { tenantId },
    });
  }

  async function countActiveByTenant(tenantId: string): Promise<number> {
    return prisma.pod.count({
      where: {
        tenantId,
        status: {
          in: ['RUNNING', 'PROVISIONING', 'STARTING'],
        },
      },
    });
  }

  async function countByOwner(ownerId: string): Promise<number> {
    return prisma.pod.count({
      where: { ownerId },
    });
  }

  async function sumResourcesByTenant(
    tenantId: string
  ): Promise<{ cpu: number; memory: number; storage: number; gpus: number }> {
    const activePods = await prisma.pod.findMany({
      where: {
        tenantId,
        status: {
          in: ['RUNNING', 'PROVISIONING', 'STARTING'],
        },
      },
      select: {
        currentResources: true,
      },
    });

    return activePods.reduce(
      (acc, pod) => {
        const resources = pod.currentResources as unknown as ResourceSpec;
        return {
          cpu: acc.cpu + (resources.cpu || 0),
          memory: acc.memory + (resources.memory || 0),
          storage: acc.storage + (resources.storage || 0),
          gpus: acc.gpus + (resources.gpu ? 1 : 0),
        };
      },
      { cpu: 0, memory: 0, storage: 0, gpus: 0 }
    );
  }

  return {
    create,
    findById,
    findByKasmId,
    findMany,
    update,
    delete: deletePod,
    findAutoScalingEnabled,
    findRunning,
    findExpired,
    findIdle,
    createResourceHistory,
    getResourceHistory,
    getRecentResourceHistory,
    createSession,
    endSession,
    getActiveSessions,
    countByTenant,
    countActiveByTenant,
    countByOwner,
    sumResourcesByTenant,
  };
}
