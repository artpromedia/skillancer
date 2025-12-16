/**
 * @module @skillancer/skillpod-svc/services/auto-scaling
 * Auto-scaling service for dynamic pod resource management
 */

import type { MetricsService, PodMetrics } from './metrics.service.js';
import type { EnvironmentPodRepository } from '../repositories/environment-pod.repository.js';
import type { ResourcePoolRepository } from '../repositories/resource-pool.repository.js';
import type {
  ResourceSpec,
  AutoScalingConfig,
  ScalingDecision,
} from '../types/environment.types.js';
import type { Pod, Prisma } from '@prisma/client';
import type { Redis as RedisType } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface AutoScalingService {
  evaluateScaling(podId: string): Promise<ScalingDecision>;
  evaluateAllPods(): Promise<ScalingDecision[]>;
  applyScaling(podId: string, decision: ScalingDecision): Promise<void>;
  getCooldownStatus(podId: string): Promise<CooldownStatus>;
  resetCooldown(podId: string): Promise<void>;
  getScalingHistory(podId: string, limit?: number): Promise<ScalingEvent[]>;
}

export interface CooldownStatus {
  canScaleUp: boolean;
  canScaleDown: boolean;
  scaleUpAvailableAt: Date | null;
  scaleDownAvailableAt: Date | null;
}

export interface ScalingEvent {
  podId: string;
  timestamp: Date;
  fromResources: ResourceSpec;
  toResources: ResourceSpec;
  direction: 'up' | 'down';
  reason: string;
  metrics: PodMetrics;
}

interface KasmWorkspacesService {
  resizeWorkspace(kasmId: string, resources: ResourceSpec): Promise<void>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CACHE_PREFIX = 'scaling:';
const COOLDOWN_PREFIX = 'cooldown:';
const METRICS_WINDOW_MINUTES = 5;
const DEFAULT_CPU_THRESHOLD_UP = 80;
const DEFAULT_CPU_THRESHOLD_DOWN = 30;
const DEFAULT_MEMORY_THRESHOLD_UP = 85;
const DEFAULT_MEMORY_THRESHOLD_DOWN = 40;
const DEFAULT_SCALE_UP_COOLDOWN = 300; // 5 minutes
const DEFAULT_SCALE_DOWN_COOLDOWN = 600; // 10 minutes

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export function createAutoScalingService(
  podRepository: EnvironmentPodRepository,
  resourcePoolRepository: ResourcePoolRepository,
  metricsService: MetricsService,
  kasmService: KasmWorkspacesService,
  redis: RedisType
): AutoScalingService {
  /**
   * Evaluate scaling decision for a single pod
   */
  async function evaluateScaling(podId: string): Promise<ScalingDecision> {
    const pod = await podRepository.findById(podId);

    if (!pod) {
      return createNoScaleDecision(podId, 'Pod not found');
    }

    if (pod.status !== 'RUNNING') {
      return createNoScaleDecision(podId, `Pod is ${pod.status}`);
    }

    if (!pod.autoScalingEnabled) {
      return createNoScaleDecision(podId, 'Auto-scaling disabled');
    }

    const config = pod.autoScalingConfig as AutoScalingConfig;
    const currentResources = pod.resources as ResourceSpec;

    // Get average metrics over the window
    const avgMetrics = await metricsService.getAverageMetrics(podId, METRICS_WINDOW_MINUTES);

    if (!avgMetrics) {
      return createNoScaleDecision(podId, 'No metrics available');
    }

    // Check cooldown
    const cooldown = await getCooldownStatus(podId);

    // Evaluate CPU-based scaling
    const cpuScaling = evaluateCpuScaling(
      avgMetrics.cpuPercent,
      currentResources,
      config,
      cooldown
    );

    // Evaluate memory-based scaling
    const memoryScaling = evaluateMemoryScaling(
      avgMetrics.memoryPercent,
      currentResources,
      config,
      cooldown
    );

    // Determine final decision (scale up takes precedence)
    if (cpuScaling.shouldScale && cpuScaling.direction === 'up') {
      return cpuScaling;
    }
    if (memoryScaling.shouldScale && memoryScaling.direction === 'up') {
      return memoryScaling;
    }
    if (cpuScaling.shouldScale && cpuScaling.direction === 'down') {
      return cpuScaling;
    }
    if (memoryScaling.shouldScale && memoryScaling.direction === 'down') {
      return memoryScaling;
    }

    return createNoScaleDecision(podId, 'Resources within thresholds');
  }

  /**
   * Evaluate all pods with auto-scaling enabled
   */
  async function evaluateAllPods(): Promise<ScalingDecision[]> {
    const pods = await podRepository.findAutoScalingEnabled();
    const decisions: ScalingDecision[] = [];

    for (const pod of pods) {
      try {
        const decision = await evaluateScaling(pod.id);
        decisions.push(decision);
      } catch (error) {
        console.error(`Failed to evaluate scaling for pod ${pod.id}:`, error);
        decisions.push(createNoScaleDecision(pod.id, 'Evaluation error'));
      }
    }

    return decisions;
  }

  /**
   * Apply scaling decision to a pod
   */
  async function applyScaling(podId: string, decision: ScalingDecision): Promise<void> {
    if (!decision.shouldScale || !decision.targetResources) {
      return;
    }

    const pod = await podRepository.findById(podId);
    if (!pod) {
      throw new Error('Pod not found');
    }

    const currentResources = pod.resources as ResourceSpec;

    // Check tenant quota before scaling up
    if (decision.direction === 'up') {
      const quota = await resourcePoolRepository.findQuotaByTenant(pod.tenantId);
      if (quota) {
        const currentUsage = await podRepository.sumResourcesByTenant(pod.tenantId);
        const cpuDelta = decision.targetResources.cpu - currentResources.cpu;
        const memoryDelta = decision.targetResources.memory - currentResources.memory;

        if (currentUsage.totalCpu + cpuDelta > quota.maxCpu) {
          console.warn(`Cannot scale up pod ${podId}: CPU quota would be exceeded`);
          return;
        }
        if (currentUsage.totalMemory + memoryDelta > quota.maxMemory) {
          console.warn(`Cannot scale up pod ${podId}: Memory quota would be exceeded`);
          return;
        }
      }
    }

    // Apply scaling in Kasm
    await kasmService.resizeWorkspace(pod.kasmWorkspaceId, decision.targetResources);

    // Record resource history
    await podRepository.createResourceHistory({
      podId,
      fromResources: currentResources as unknown as Prisma.InputJsonValue,
      toResources: decision.targetResources as unknown as Prisma.InputJsonValue,
      reason: decision.reason || 'auto-scaling',
      triggeredBy: 'auto-scaling',
    });

    // Update pod resources
    await podRepository.update(podId, {
      resources: decision.targetResources as unknown as Prisma.InputJsonValue,
    });

    // Update quota usage
    const quota = await resourcePoolRepository.findQuotaByTenant(pod.tenantId);
    if (quota) {
      const cpuDelta = decision.targetResources.cpu - currentResources.cpu;
      const memoryDelta = decision.targetResources.memory - currentResources.memory;

      if (cpuDelta > 0) {
        await resourcePoolRepository.incrementUsage(pod.tenantId, cpuDelta, memoryDelta, 0);
      } else if (cpuDelta < 0) {
        await resourcePoolRepository.decrementUsage(
          pod.tenantId,
          Math.abs(cpuDelta),
          Math.abs(memoryDelta),
          0
        );
      }
    }

    // Set cooldown
    await setCooldown(podId, decision.direction);

    // Cache scaling event
    await cacheScalingEvent(podId, {
      podId,
      timestamp: new Date(),
      fromResources: currentResources,
      toResources: decision.targetResources,
      direction: decision.direction!,
      reason: decision.reason || 'Threshold exceeded',
      metrics: decision.currentMetrics!,
    });

    console.log(
      `Scaled pod ${podId} ${decision.direction}: ${JSON.stringify(currentResources)} -> ${JSON.stringify(decision.targetResources)}`
    );
  }

  /**
   * Get cooldown status for a pod
   */
  async function getCooldownStatus(podId: string): Promise<CooldownStatus> {
    const scaleUpKey = `${COOLDOWN_PREFIX}${podId}:up`;
    const scaleDownKey = `${COOLDOWN_PREFIX}${podId}:down`;

    const [scaleUpTtl, scaleDownTtl] = await Promise.all([
      redis.ttl(scaleUpKey),
      redis.ttl(scaleDownKey),
    ]);

    return {
      canScaleUp: scaleUpTtl <= 0,
      canScaleDown: scaleDownTtl <= 0,
      scaleUpAvailableAt: scaleUpTtl > 0 ? new Date(Date.now() + scaleUpTtl * 1000) : null,
      scaleDownAvailableAt: scaleDownTtl > 0 ? new Date(Date.now() + scaleDownTtl * 1000) : null,
    };
  }

  /**
   * Reset cooldown for a pod
   */
  async function resetCooldown(podId: string): Promise<void> {
    await Promise.all([
      redis.del(`${COOLDOWN_PREFIX}${podId}:up`),
      redis.del(`${COOLDOWN_PREFIX}${podId}:down`),
    ]);
  }

  /**
   * Get scaling history for a pod
   */
  async function getScalingHistory(podId: string, limit = 20): Promise<ScalingEvent[]> {
    const key = `${CACHE_PREFIX}history:${podId}`;
    const events = await redis.lrange(key, 0, limit - 1);

    return events.map((e) => JSON.parse(e) as ScalingEvent);
  }

  // ===========================================================================
  // HELPER FUNCTIONS
  // ===========================================================================

  function createNoScaleDecision(podId: string, reason: string): ScalingDecision {
    return {
      podId,
      shouldScale: false,
      reason,
    };
  }

  function evaluateCpuScaling(
    cpuPercent: number,
    currentResources: ResourceSpec,
    config: AutoScalingConfig,
    cooldown: CooldownStatus
  ): ScalingDecision {
    const cpuThresholdUp = config.cpuThreshold || DEFAULT_CPU_THRESHOLD_UP;
    const cpuThresholdDown = DEFAULT_CPU_THRESHOLD_DOWN;

    // Check if we should scale up
    if (cpuPercent > cpuThresholdUp && cooldown.canScaleUp) {
      const newCpu = Math.min(currentResources.cpu * 1.5, config.maxResources.cpu);

      if (newCpu > currentResources.cpu) {
        return {
          podId: '',
          shouldScale: true,
          direction: 'up',
          reason: `CPU usage ${cpuPercent.toFixed(1)}% exceeds ${cpuThresholdUp}%`,
          currentResources,
          targetResources: {
            ...currentResources,
            cpu: Math.ceil(newCpu),
          },
          currentMetrics: {
            cpuPercent,
            memoryPercent: 0,
            diskPercent: 0,
            networkIn: 0,
            networkOut: 0,
          },
        };
      }
    }

    // Check if we should scale down
    if (cpuPercent < cpuThresholdDown && cooldown.canScaleDown) {
      const newCpu = Math.max(currentResources.cpu * 0.7, config.minResources.cpu);

      if (newCpu < currentResources.cpu) {
        return {
          podId: '',
          shouldScale: true,
          direction: 'down',
          reason: `CPU usage ${cpuPercent.toFixed(1)}% below ${cpuThresholdDown}%`,
          currentResources,
          targetResources: {
            ...currentResources,
            cpu: Math.floor(newCpu),
          },
          currentMetrics: {
            cpuPercent,
            memoryPercent: 0,
            diskPercent: 0,
            networkIn: 0,
            networkOut: 0,
          },
        };
      }
    }

    return {
      podId: '',
      shouldScale: false,
      reason: 'CPU within thresholds',
    };
  }

  function evaluateMemoryScaling(
    memoryPercent: number,
    currentResources: ResourceSpec,
    config: AutoScalingConfig,
    cooldown: CooldownStatus
  ): ScalingDecision {
    const memoryThresholdUp = config.memoryThreshold || DEFAULT_MEMORY_THRESHOLD_UP;
    const memoryThresholdDown = DEFAULT_MEMORY_THRESHOLD_DOWN;

    // Check if we should scale up
    if (memoryPercent > memoryThresholdUp && cooldown.canScaleUp) {
      const newMemory = Math.min(currentResources.memory * 1.5, config.maxResources.memory);

      if (newMemory > currentResources.memory) {
        return {
          podId: '',
          shouldScale: true,
          direction: 'up',
          reason: `Memory usage ${memoryPercent.toFixed(1)}% exceeds ${memoryThresholdUp}%`,
          currentResources,
          targetResources: {
            ...currentResources,
            memory: Math.ceil(newMemory / 1024) * 1024, // Round to nearest GB
          },
          currentMetrics: {
            cpuPercent: 0,
            memoryPercent,
            diskPercent: 0,
            networkIn: 0,
            networkOut: 0,
          },
        };
      }
    }

    // Check if we should scale down
    if (memoryPercent < memoryThresholdDown && cooldown.canScaleDown) {
      const newMemory = Math.max(currentResources.memory * 0.7, config.minResources.memory);

      if (newMemory < currentResources.memory) {
        return {
          podId: '',
          shouldScale: true,
          direction: 'down',
          reason: `Memory usage ${memoryPercent.toFixed(1)}% below ${memoryThresholdDown}%`,
          currentResources,
          targetResources: {
            ...currentResources,
            memory: Math.floor(newMemory / 1024) * 1024, // Round to nearest GB
          },
          currentMetrics: {
            cpuPercent: 0,
            memoryPercent,
            diskPercent: 0,
            networkIn: 0,
            networkOut: 0,
          },
        };
      }
    }

    return {
      podId: '',
      shouldScale: false,
      reason: 'Memory within thresholds',
    };
  }

  async function setCooldown(podId: string, direction: 'up' | 'down'): Promise<void> {
    const pod = await podRepository.findById(podId);
    if (!pod) return;

    const config = pod.autoScalingConfig as AutoScalingConfig;
    const cooldownSeconds =
      direction === 'up'
        ? config.scaleUpCooldownSeconds || DEFAULT_SCALE_UP_COOLDOWN
        : config.scaleDownCooldownSeconds || DEFAULT_SCALE_DOWN_COOLDOWN;

    const key = `${COOLDOWN_PREFIX}${podId}:${direction}`;
    await redis.set(key, '1', 'EX', cooldownSeconds);
  }

  async function cacheScalingEvent(podId: string, event: ScalingEvent): Promise<void> {
    const key = `${CACHE_PREFIX}history:${podId}`;
    await redis.lpush(key, JSON.stringify(event));
    await redis.ltrim(key, 0, 99); // Keep last 100 events
    await redis.expire(key, 86400 * 7); // 7 days TTL
  }

  return {
    evaluateScaling,
    evaluateAllPods,
    applyScaling,
    getCooldownStatus,
    resetCooldown,
    getScalingHistory,
  };
}
