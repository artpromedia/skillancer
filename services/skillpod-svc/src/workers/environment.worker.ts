/**
 * @module @skillancer/skillpod-svc/workers/environment
 * Background workers for environment management
 */

import { logger } from '@skillancer/logger';

import type { EnvironmentPodRepository } from '../repositories/environment-pod.repository.js';
import type { AutoScalingService } from '../services/auto-scaling.service.js';
import type { MetricsService } from '../services/metrics.service.js';
import type { PodService } from '../services/pod.service.js';

// =============================================================================
// TYPES
// =============================================================================

export interface EnvironmentWorkerConfig {
  autoScalingIntervalMs: number;
  metricsCollectionIntervalMs: number;
  expiredPodCleanupIntervalMs: number;
  idlePodCleanupIntervalMs: number;
  idleThresholdMinutes: number;
}

export interface EnvironmentWorkers {
  start(): void;
  stop(): void;
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_CONFIG: EnvironmentWorkerConfig = {
  autoScalingIntervalMs: 60000, // 1 minute
  metricsCollectionIntervalMs: 30000, // 30 seconds
  expiredPodCleanupIntervalMs: 300000, // 5 minutes
  idlePodCleanupIntervalMs: 900000, // 15 minutes
  idleThresholdMinutes: 120, // 2 hours
};

// =============================================================================
// WORKER IMPLEMENTATION
// =============================================================================

export function createEnvironmentWorkers(
  podRepository: EnvironmentPodRepository,
  podService: PodService,
  autoScalingService: AutoScalingService,
  metricsService: MetricsService,
  config: Partial<EnvironmentWorkerConfig> = {}
): EnvironmentWorkers {
  const workerConfig = { ...DEFAULT_CONFIG, ...config };
  const timers: NodeJS.Timeout[] = [];
  let isRunning = false;

  const log = logger.child({ module: 'environment-workers' });

  // ===========================================================================
  // AUTO-SCALING WORKER
  // ===========================================================================

  async function runAutoScaling(): Promise<void> {
    if (!isRunning) return;

    try {
      log.debug('Starting auto-scaling evaluation cycle');

      const decisions = await autoScalingService.evaluateAllPods();
      const scalingDecisions = decisions.filter((d) => d.shouldScale);

      log.info(`Auto-scaling: ${scalingDecisions.length}/${decisions.length} pods need scaling`);

      for (const decision of scalingDecisions) {
        try {
          await autoScalingService.applyScaling(decision.podId, decision);
          log.info(
            {
              podId: decision.podId,
              direction: decision.direction,
              reason: decision.reason,
            },
            'Applied auto-scaling'
          );
        } catch (error) {
          log.error({ podId: decision.podId, error }, 'Failed to apply auto-scaling');
        }
      }
    } catch (error) {
      log.error({ error }, 'Auto-scaling cycle failed');
    }
  }

  // ===========================================================================
  // METRICS COLLECTION WORKER
  // ===========================================================================

  async function runMetricsCollection(): Promise<void> {
    if (!isRunning) return;

    try {
      const runningPods = await podRepository.findRunning();
      log.debug(`Collecting metrics for ${runningPods.length} running pods`);

      for (const pod of runningPods) {
        try {
          const metrics = await metricsService.getPodMetrics(pod.id, pod.kasmWorkspaceId);
          await metricsService.recordMetrics(pod.id, metrics);
        } catch (error) {
          log.warn({ podId: pod.id, error }, 'Failed to collect metrics');
        }
      }
    } catch (error) {
      log.error({ error }, 'Metrics collection cycle failed');
    }
  }

  // ===========================================================================
  // EXPIRED POD CLEANUP WORKER
  // ===========================================================================

  async function runExpiredPodCleanup(): Promise<void> {
    if (!isRunning) return;

    try {
      const expiredPods = await podRepository.findExpired();
      log.info(`Found ${expiredPods.length} expired pods to clean up`);

      for (const pod of expiredPods) {
        try {
          await podService.terminatePod(pod.id);
          log.info({ podId: pod.id, expiresAt: pod.expiresAt }, 'Terminated expired pod');
        } catch (error) {
          log.error({ podId: pod.id, error }, 'Failed to terminate expired pod');
        }
      }
    } catch (error) {
      log.error({ error }, 'Expired pod cleanup cycle failed');
    }
  }

  // ===========================================================================
  // IDLE POD CLEANUP WORKER
  // ===========================================================================

  async function runIdlePodCleanup(): Promise<void> {
    if (!isRunning) return;

    try {
      const idlePods = await podRepository.findIdle(workerConfig.idleThresholdMinutes);
      log.info(`Found ${idlePods.length} idle pods to hibernate`);

      for (const pod of idlePods) {
        try {
          // Hibernate instead of terminate for idle pods
          await podService.hibernatePod(pod.id);
          log.info({ podId: pod.id, lastActivityAt: pod.lastActivityAt }, 'Hibernated idle pod');
        } catch (error) {
          log.error({ podId: pod.id, error }, 'Failed to hibernate idle pod');
        }
      }
    } catch (error) {
      log.error({ error }, 'Idle pod cleanup cycle failed');
    }
  }

  // ===========================================================================
  // START/STOP
  // ===========================================================================

  function start(): void {
    if (isRunning) {
      log.warn('Environment workers already running');
      return;
    }

    isRunning = true;
    log.info('Starting environment workers');

    // Start auto-scaling worker
    timers.push(setInterval(runAutoScaling, workerConfig.autoScalingIntervalMs));
    log.info({ intervalMs: workerConfig.autoScalingIntervalMs }, 'Auto-scaling worker started');

    // Start metrics collection worker
    timers.push(setInterval(runMetricsCollection, workerConfig.metricsCollectionIntervalMs));
    log.info(
      { intervalMs: workerConfig.metricsCollectionIntervalMs },
      'Metrics collection worker started'
    );

    // Start expired pod cleanup worker
    timers.push(setInterval(runExpiredPodCleanup, workerConfig.expiredPodCleanupIntervalMs));
    log.info(
      { intervalMs: workerConfig.expiredPodCleanupIntervalMs },
      'Expired pod cleanup worker started'
    );

    // Start idle pod cleanup worker
    timers.push(setInterval(runIdlePodCleanup, workerConfig.idlePodCleanupIntervalMs));
    log.info(
      { intervalMs: workerConfig.idlePodCleanupIntervalMs },
      'Idle pod cleanup worker started'
    );

    // Run initial cycles after a short delay
    setTimeout(() => {
      runMetricsCollection();
      runAutoScaling();
    }, 5000);
  }

  function stop(): void {
    if (!isRunning) {
      return;
    }

    isRunning = false;
    log.info('Stopping environment workers');

    for (const timer of timers) {
      clearInterval(timer);
    }
    timers.length = 0;

    log.info('Environment workers stopped');
  }

  return {
    start,
    stop,
  };
}
