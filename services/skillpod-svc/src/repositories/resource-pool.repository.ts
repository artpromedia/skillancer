/**
 * @module @skillancer/skillpod-svc/repositories/resource-pool
 * Resource pool and tenant quota repository for database operations
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
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */

import type { PrismaClient, ResourcePool, TenantResourceQuota, Prisma } from '@/types/prisma-shim.js';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateResourcePoolInput {
  tenantId?: string;
  name: string;
  description?: string;
  instanceType: string;
  minInstances: number;
  maxInstances: number;
  warmPoolSize?: number;
  scaleUpThreshold?: number;
  scaleDownThreshold?: number;
  scaleUpCooldown?: number;
  scaleDownCooldown?: number;
  hourlyRateCents: number;
}

export interface UpdateResourcePoolInput {
  name?: string;
  description?: string;
  minInstances?: number;
  maxInstances?: number;
  currentInstances?: number;
  warmPoolSize?: number;
  warmInstances?: number;
  scaleUpThreshold?: number;
  scaleDownThreshold?: number;
  scaleUpCooldown?: number;
  scaleDownCooldown?: number;
  hourlyRateCents?: number;
  isActive?: boolean;
}

export interface CreateQuotaInput {
  tenantId: string;
  maxCpu: number;
  maxMemory: number;
  maxStorage: number;
  maxPods: number;
  maxGpus?: number;
}

export interface UpdateQuotaInput {
  maxCpu?: number;
  usedCpu?: number;
  maxMemory?: number;
  usedMemory?: number;
  maxStorage?: number;
  usedStorage?: number;
  maxPods?: number;
  activePods?: number;
  maxGpus?: number;
  usedGpus?: number;
}

export interface ResourcePoolListFilter {
  tenantId?: string;
  isActive?: boolean;
  instanceType?: string;
}

// =============================================================================
// REPOSITORY INTERFACE
// =============================================================================

export interface ResourcePoolRepository {
  // Resource pools
  createPool(input: CreateResourcePoolInput): Promise<ResourcePool>;
  findPoolById(id: string): Promise<ResourcePool | null>;
  findPools(filter?: ResourcePoolListFilter): Promise<ResourcePool[]>;
  findSharedPools(): Promise<ResourcePool[]>;
  updatePool(id: string, input: UpdateResourcePoolInput): Promise<ResourcePool>;
  deletePool(id: string): Promise<void>;

  // Tenant quotas
  createQuota(input: CreateQuotaInput): Promise<TenantResourceQuota>;
  findQuotaByTenant(tenantId: string): Promise<TenantResourceQuota | null>;
  updateQuota(tenantId: string, input: UpdateQuotaInput): Promise<TenantResourceQuota>;
  incrementUsage(
    tenantId: string,
    cpu: number,
    memory: number,
    storage: number,
    gpus?: number
  ): Promise<TenantResourceQuota>;
  decrementUsage(
    tenantId: string,
    cpu: number,
    memory: number,
    storage: number,
    gpus?: number
  ): Promise<TenantResourceQuota>;
  incrementActivePods(tenantId: string): Promise<TenantResourceQuota>;
  decrementActivePods(tenantId: string): Promise<TenantResourceQuota>;
}

// =============================================================================
// REPOSITORY IMPLEMENTATION
// =============================================================================

export function createResourcePoolRepository(prisma: PrismaClient): ResourcePoolRepository {
  // ---------------------------------------------------------------------------
  // Resource Pools
  // ---------------------------------------------------------------------------

  async function createPool(input: CreateResourcePoolInput): Promise<ResourcePool> {
    return prisma.resourcePool.create({
      data: {
        tenantId: input.tenantId ?? null,
        name: input.name,
        description: input.description,
        instanceType: input.instanceType,
        minInstances: input.minInstances,
        maxInstances: input.maxInstances,
        warmPoolSize: input.warmPoolSize ?? 0,
        scaleUpThreshold: input.scaleUpThreshold ?? 70,
        scaleDownThreshold: input.scaleDownThreshold ?? 30,
        scaleUpCooldown: input.scaleUpCooldown ?? 300,
        scaleDownCooldown: input.scaleDownCooldown ?? 600,
        hourlyRateCents: input.hourlyRateCents,
      },
    });
  }

  async function findPoolById(id: string): Promise<ResourcePool | null> {
    return prisma.resourcePool.findUnique({
      where: { id },
    });
  }

  async function findPools(filter: ResourcePoolListFilter = {}): Promise<ResourcePool[]> {
    const whereConditions: Prisma.ResourcePoolWhereInput[] = [];

    if (filter.tenantId !== undefined) {
      whereConditions.push({ tenantId: filter.tenantId ?? null });
    }

    if (filter.isActive !== undefined) {
      whereConditions.push({ isActive: filter.isActive });
    }

    if (filter.instanceType) {
      whereConditions.push({ instanceType: filter.instanceType });
    }

    const where: Prisma.ResourcePoolWhereInput =
      whereConditions.length > 0 ? { AND: whereConditions } : {};

    return prisma.resourcePool.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async function findSharedPools(): Promise<ResourcePool[]> {
    return prisma.resourcePool.findMany({
      where: {
        tenantId: null,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async function updatePool(id: string, input: UpdateResourcePoolInput): Promise<ResourcePool> {
    const data: Prisma.ResourcePoolUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.minInstances !== undefined) data.minInstances = input.minInstances;
    if (input.maxInstances !== undefined) data.maxInstances = input.maxInstances;
    if (input.currentInstances !== undefined) data.currentInstances = input.currentInstances;
    if (input.warmPoolSize !== undefined) data.warmPoolSize = input.warmPoolSize;
    if (input.warmInstances !== undefined) data.warmInstances = input.warmInstances;
    if (input.scaleUpThreshold !== undefined) data.scaleUpThreshold = input.scaleUpThreshold;
    if (input.scaleDownThreshold !== undefined) data.scaleDownThreshold = input.scaleDownThreshold;
    if (input.scaleUpCooldown !== undefined) data.scaleUpCooldown = input.scaleUpCooldown;
    if (input.scaleDownCooldown !== undefined) data.scaleDownCooldown = input.scaleDownCooldown;
    if (input.hourlyRateCents !== undefined) data.hourlyRateCents = input.hourlyRateCents;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    return prisma.resourcePool.update({
      where: { id },
      data,
    });
  }

  async function deletePool(id: string): Promise<void> {
    await prisma.resourcePool.delete({
      where: { id },
    });
  }

  // ---------------------------------------------------------------------------
  // Tenant Quotas
  // ---------------------------------------------------------------------------

  async function createQuota(input: CreateQuotaInput): Promise<TenantResourceQuota> {
    return prisma.tenantResourceQuota.create({
      data: {
        tenantId: input.tenantId,
        maxCpu: input.maxCpu,
        maxMemory: input.maxMemory,
        maxStorage: input.maxStorage,
        maxPods: input.maxPods,
        maxGpus: input.maxGpus ?? 0,
      },
    });
  }

  async function findQuotaByTenant(tenantId: string): Promise<TenantResourceQuota | null> {
    return prisma.tenantResourceQuota.findUnique({
      where: { tenantId },
    });
  }

  async function updateQuota(
    tenantId: string,
    input: UpdateQuotaInput
  ): Promise<TenantResourceQuota> {
    const data: Prisma.TenantResourceQuotaUpdateInput = {};

    if (input.maxCpu !== undefined) data.maxCpu = input.maxCpu;
    if (input.usedCpu !== undefined) data.usedCpu = input.usedCpu;
    if (input.maxMemory !== undefined) data.maxMemory = input.maxMemory;
    if (input.usedMemory !== undefined) data.usedMemory = input.usedMemory;
    if (input.maxStorage !== undefined) data.maxStorage = input.maxStorage;
    if (input.usedStorage !== undefined) data.usedStorage = input.usedStorage;
    if (input.maxPods !== undefined) data.maxPods = input.maxPods;
    if (input.activePods !== undefined) data.activePods = input.activePods;
    if (input.maxGpus !== undefined) data.maxGpus = input.maxGpus;
    if (input.usedGpus !== undefined) data.usedGpus = input.usedGpus;

    return prisma.tenantResourceQuota.update({
      where: { tenantId },
      data,
    });
  }

  async function incrementUsage(
    tenantId: string,
    cpu: number,
    memory: number,
    storage: number,
    gpus = 0
  ): Promise<TenantResourceQuota> {
    return prisma.tenantResourceQuota.update({
      where: { tenantId },
      data: {
        usedCpu: { increment: cpu },
        usedMemory: { increment: memory },
        usedStorage: { increment: storage },
        usedGpus: { increment: gpus },
      },
    });
  }

  async function decrementUsage(
    tenantId: string,
    cpu: number,
    memory: number,
    storage: number,
    gpus = 0
  ): Promise<TenantResourceQuota> {
    return prisma.tenantResourceQuota.update({
      where: { tenantId },
      data: {
        usedCpu: { decrement: cpu },
        usedMemory: { decrement: memory },
        usedStorage: { decrement: storage },
        usedGpus: { decrement: gpus },
      },
    });
  }

  async function incrementActivePods(tenantId: string): Promise<TenantResourceQuota> {
    return prisma.tenantResourceQuota.update({
      where: { tenantId },
      data: {
        activePods: { increment: 1 },
      },
    });
  }

  async function decrementActivePods(tenantId: string): Promise<TenantResourceQuota> {
    return prisma.tenantResourceQuota.update({
      where: { tenantId },
      data: {
        activePods: { decrement: 1 },
      },
    });
  }

  return {
    createPool,
    findPoolById,
    findPools,
    findSharedPools,
    updatePool,
    deletePool,
    createQuota,
    findQuotaByTenant,
    updateQuota,
    incrementUsage,
    decrementUsage,
    incrementActivePods,
    decrementActivePods,
  };
}
