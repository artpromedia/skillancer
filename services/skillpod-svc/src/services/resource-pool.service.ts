/**
 * @module @skillancer/skillpod-svc/services/resource-pool
 * Resource pool and quota management service
 */

// @ts-nocheck - TODO: Fix TypeScript errors related to Prisma type conversions
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */

import type { EnvironmentPodRepository } from '../repositories/environment-pod.repository.js';
import type { ResourcePoolRepository } from '../repositories/resource-pool.repository.js';
import type { TenantQuota, ResourceSpec } from '../types/environment.types.js';
import type { ResourcePool, TenantResourceQuota } from '@prisma/client';
import type { Redis as RedisType } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface ResourcePoolService {
  // Pool management
  createPool(params: CreatePoolParams): Promise<ResourcePool>;
  getPoolById(poolId: string): Promise<ResourcePool | null>;
  listPools(tenantId?: string): Promise<ResourcePool[]>;
  updatePool(poolId: string, updates: UpdatePoolParams): Promise<ResourcePool>;
  deletePool(poolId: string): Promise<void>;

  // Quota management
  getQuota(tenantId: string): Promise<TenantQuota>;
  updateQuota(tenantId: string, quota: Partial<TenantQuota>): Promise<TenantResourceQuota>;
  initializeQuota(tenantId: string, tier: QuotaTier): Promise<TenantResourceQuota>;

  // Capacity planning
  getPoolCapacity(poolId: string): Promise<PoolCapacity>;
  getAvailableCapacity(tenantId: string): Promise<AvailableCapacity>;
  checkCapacity(tenantId: string, resources: ResourceSpec): Promise<CapacityCheck>;
  reserveCapacity(tenantId: string, resources: ResourceSpec): Promise<ReservationToken>;
  releaseCapacity(reservationToken: string): Promise<void>;
}

export interface CreatePoolParams {
  name: string;
  description?: string;
  tenantId?: string; // null for shared pools
  region: string;
  totalCpu: number;
  totalMemory: number;
  totalStorage: number;
  totalGpus?: number;
  gpuType?: string;
  priority?: number;
  isActive?: boolean;
}

export interface UpdatePoolParams {
  name?: string;
  description?: string;
  totalCpu?: number;
  totalMemory?: number;
  totalStorage?: number;
  totalGpus?: number;
  gpuType?: string;
  priority?: number;
  isActive?: boolean;
}

export interface PoolCapacity {
  poolId: string;
  total: ResourceSpec;
  used: ResourceSpec;
  available: ResourceSpec;
  utilizationPercent: number;
}

export interface AvailableCapacity {
  tenantId: string;
  quota: TenantQuota;
  used: ResourceSpec;
  available: ResourceSpec;
  utilizationPercent: number;
}

export interface CapacityCheck {
  hasCapacity: boolean;
  missing: Partial<ResourceSpec>;
  reason?: string;
}

export interface ReservationToken {
  token: string;
  tenantId: string;
  resources: ResourceSpec;
  expiresAt: Date;
}

export type QuotaTier = 'free' | 'starter' | 'professional' | 'enterprise' | 'unlimited';

// =============================================================================
// QUOTA TIERS
// =============================================================================

const QUOTA_TIERS: Record<QuotaTier, Omit<TenantQuota, 'tenantId'>> = {
  free: {
    maxCpu: 4,
    maxMemory: 8192, // 8 GB
    maxStorage: 50,
    maxGpus: 0,
    maxPods: 2,
    maxConcurrentPods: 1,
  },
  starter: {
    maxCpu: 16,
    maxMemory: 32768, // 32 GB
    maxStorage: 200,
    maxGpus: 0,
    maxPods: 10,
    maxConcurrentPods: 5,
  },
  professional: {
    maxCpu: 64,
    maxMemory: 131072, // 128 GB
    maxStorage: 1000,
    maxGpus: 2,
    maxPods: 50,
    maxConcurrentPods: 20,
  },
  enterprise: {
    maxCpu: 256,
    maxMemory: 524288, // 512 GB
    maxStorage: 5000,
    maxGpus: 8,
    maxPods: 200,
    maxConcurrentPods: 100,
  },
  unlimited: {
    maxCpu: 9999,
    maxMemory: 99999999,
    maxStorage: 99999,
    maxGpus: 99,
    maxPods: 9999,
    maxConcurrentPods: 999,
  },
};

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export function createResourcePoolService(
  poolRepository: ResourcePoolRepository,
  podRepository: EnvironmentPodRepository,
  redis: RedisType
): ResourcePoolService {
  const RESERVATION_PREFIX = 'reservation:';
  const RESERVATION_TTL = 300; // 5 minutes

  // ===========================================================================
  // POOL MANAGEMENT
  // ===========================================================================

  async function createPool(params: CreatePoolParams): Promise<ResourcePool> {
    return poolRepository.createPool({
      name: params.name,
      description: params.description,
      tenantId: params.tenantId || null,
      region: params.region,
      totalCpu: params.totalCpu,
      totalMemory: params.totalMemory,
      totalStorage: params.totalStorage,
      totalGpus: params.totalGpus || 0,
      gpuType: params.gpuType || null,
      priority: params.priority || 0,
      isActive: params.isActive ?? true,
    });
  }

  async function getPoolById(poolId: string): Promise<ResourcePool | null> {
    return poolRepository.findPoolById(poolId);
  }

  async function listPools(tenantId?: string): Promise<ResourcePool[]> {
    if (tenantId) {
      return poolRepository.findPools(tenantId);
    }
    return poolRepository.findSharedPools();
  }

  async function updatePool(poolId: string, updates: UpdatePoolParams): Promise<ResourcePool> {
    const pool = await poolRepository.findPoolById(poolId);
    if (!pool) {
      throw new Error('Resource pool not found');
    }

    return poolRepository.updatePool(poolId, updates);
  }

  async function deletePool(poolId: string): Promise<void> {
    const pool = await poolRepository.findPoolById(poolId);
    if (!pool) {
      throw new Error('Resource pool not found');
    }

    // Check if pool has active pods
    if (pool.tenantId) {
      const usage = await podRepository.sumResourcesByTenant(pool.tenantId);
      if (usage.activePods > 0) {
        throw new Error('Cannot delete pool with active pods');
      }
    }

    await poolRepository.updatePool(poolId, { isActive: false });
  }

  // ===========================================================================
  // QUOTA MANAGEMENT
  // ===========================================================================

  async function getQuota(tenantId: string): Promise<TenantQuota> {
    const quota = await poolRepository.findQuotaByTenant(tenantId);

    if (!quota) {
      // Return default free tier quota
      return {
        tenantId,
        ...QUOTA_TIERS.free,
      };
    }

    return {
      tenantId: quota.tenantId,
      maxCpu: quota.maxCpu,
      maxMemory: quota.maxMemory,
      maxStorage: quota.maxStorage,
      maxGpus: quota.maxGpus,
      maxPods: quota.maxPods,
      maxConcurrentPods: quota.maxConcurrentPods,
    };
  }

  async function updateQuota(
    tenantId: string,
    updates: Partial<TenantQuota>
  ): Promise<TenantResourceQuota> {
    const existingQuota = await poolRepository.findQuotaByTenant(tenantId);

    if (!existingQuota) {
      // Create new quota with updates
      return poolRepository.createQuota({
        tenantId,
        ...QUOTA_TIERS.free,
        ...updates,
      });
    }

    return poolRepository.updateQuota(tenantId, updates);
  }

  async function initializeQuota(tenantId: string, tier: QuotaTier): Promise<TenantResourceQuota> {
    const existingQuota = await poolRepository.findQuotaByTenant(tenantId);

    if (existingQuota) {
      return poolRepository.updateQuota(tenantId, QUOTA_TIERS[tier]);
    }

    return poolRepository.createQuota({
      tenantId,
      ...QUOTA_TIERS[tier],
    });
  }

  // ===========================================================================
  // CAPACITY PLANNING
  // ===========================================================================

  async function getPoolCapacity(poolId: string): Promise<PoolCapacity> {
    const pool = await poolRepository.findPoolById(poolId);
    if (!pool) {
      throw new Error('Resource pool not found');
    }

    // Calculate used resources from pods in this pool
    let used: ResourceSpec = { cpu: 0, memory: 0, storage: 0, gpu: false };

    if (pool.tenantId) {
      const usage = await podRepository.sumResourcesByTenant(pool.tenantId);
      used = {
        cpu: usage.totalCpu,
        memory: usage.totalMemory,
        storage: usage.totalStorage,
        gpu: false,
      };
    }

    const total: ResourceSpec = {
      cpu: pool.totalCpu,
      memory: pool.totalMemory,
      storage: pool.totalStorage,
      gpu: pool.totalGpus > 0,
      gpuType: pool.gpuType || undefined,
    };

    const available: ResourceSpec = {
      cpu: Math.max(0, pool.totalCpu - used.cpu),
      memory: Math.max(0, pool.totalMemory - used.memory),
      storage: Math.max(0, pool.totalStorage - used.storage),
      gpu: pool.totalGpus > 0,
    };

    const utilizationPercent = pool.totalCpu > 0 ? (used.cpu / pool.totalCpu) * 100 : 0;

    return {
      poolId,
      total,
      used,
      available,
      utilizationPercent: Math.round(utilizationPercent * 100) / 100,
    };
  }

  async function getAvailableCapacity(tenantId: string): Promise<AvailableCapacity> {
    const quota = await getQuota(tenantId);
    const usage = await podRepository.sumResourcesByTenant(tenantId);

    const used: ResourceSpec = {
      cpu: usage.totalCpu,
      memory: usage.totalMemory,
      storage: usage.totalStorage,
      gpu: false,
    };

    const available: ResourceSpec = {
      cpu: Math.max(0, quota.maxCpu - used.cpu),
      memory: Math.max(0, quota.maxMemory - used.memory),
      storage: Math.max(0, quota.maxStorage - used.storage),
      gpu: quota.maxGpus > 0,
    };

    const utilizationPercent = quota.maxCpu > 0 ? (used.cpu / quota.maxCpu) * 100 : 0;

    return {
      tenantId,
      quota,
      used,
      available,
      utilizationPercent: Math.round(utilizationPercent * 100) / 100,
    };
  }

  async function checkCapacity(tenantId: string, resources: ResourceSpec): Promise<CapacityCheck> {
    const capacity = await getAvailableCapacity(tenantId);
    const missing: Partial<ResourceSpec> = {};
    const reasons: string[] = [];

    if (resources.cpu > capacity.available.cpu) {
      missing.cpu = resources.cpu - capacity.available.cpu;
      reasons.push(`Need ${missing.cpu} more CPU cores`);
    }

    if (resources.memory > capacity.available.memory) {
      missing.memory = resources.memory - capacity.available.memory;
      reasons.push(`Need ${missing.memory}MB more memory`);
    }

    if (resources.storage > capacity.available.storage) {
      missing.storage = resources.storage - capacity.available.storage;
      reasons.push(`Need ${missing.storage}GB more storage`);
    }

    if (resources.gpu && capacity.quota.maxGpus <= 0) {
      missing.gpu = true;
      reasons.push('GPU not available in quota');
    }

    const hasCapacity = Object.keys(missing).length === 0;

    return {
      hasCapacity,
      missing,
      reason: hasCapacity ? undefined : reasons.join('; '),
    };
  }

  async function reserveCapacity(
    tenantId: string,
    resources: ResourceSpec
  ): Promise<ReservationToken> {
    // Check if capacity is available
    const check = await checkCapacity(tenantId, resources);
    if (!check.hasCapacity) {
      throw new Error(`Insufficient capacity: ${check.reason}`);
    }

    // Generate reservation token
    const token = `res_${tenantId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

    // Store reservation
    const reservation: ReservationToken = {
      token,
      tenantId,
      resources,
      expiresAt: new Date(Date.now() + RESERVATION_TTL * 1000),
    };

    await redis.set(
      `${RESERVATION_PREFIX}${token}`,
      JSON.stringify(reservation),
      'EX',
      RESERVATION_TTL
    );

    // Temporarily increment usage
    await poolRepository.incrementUsage(
      tenantId,
      resources.cpu,
      resources.memory,
      resources.storage
    );

    return reservation;
  }

  async function releaseCapacity(reservationToken: string): Promise<void> {
    const key = `${RESERVATION_PREFIX}${reservationToken}`;
    const data = await redis.get(key);

    if (!data) {
      // Reservation already expired or doesn't exist
      return;
    }

    const reservation = JSON.parse(data) as ReservationToken;

    // Release reserved capacity
    await poolRepository.decrementUsage(
      reservation.tenantId,
      reservation.resources.cpu,
      reservation.resources.memory,
      reservation.resources.storage
    );

    // Delete reservation
    await redis.del(key);
  }

  return {
    createPool,
    getPoolById,
    listPools,
    updatePool,
    deletePool,
    getQuota,
    updateQuota,
    initializeQuota,
    getPoolCapacity,
    getAvailableCapacity,
    checkCapacity,
    reserveCapacity,
    releaseCapacity,
  };
}
