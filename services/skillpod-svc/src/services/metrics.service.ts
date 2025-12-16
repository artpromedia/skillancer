/**
 * @module @skillancer/skillpod-svc/services/metrics
 * Pod metrics service for resource utilization monitoring
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import type { KasmWorkspacesService } from './kasm-workspaces.service.js';
import type { ResourceUtilization } from '../types/environment.types.js';
import type { Redis as RedisType } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface MetricsService {
  getPodMetrics(podId: string): Promise<PodMetrics>;
  recordMetrics(podId: string, metrics: PodMetrics): Promise<void>;
  getMetricsHistory(podId: string, minutes: number): Promise<PodMetrics[]>;
  getAverageMetrics(podId: string, minutes: number): Promise<PodMetrics>;
  clearMetrics(podId: string): Promise<void>;
}

export interface PodMetrics {
  cpuPercent: number;
  memoryPercent: number;
  memoryUsedBytes: number;
  storagePercent: number;
  storageUsedBytes: number;
  networkRxBytes: number;
  networkTxBytes: number;
  timestamp: Date;
}

interface MetricsConfig {
  retentionMinutes: number;
  sampleIntervalSeconds: number;
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export function createMetricsService(
  redis: RedisType,
  kasmService: KasmWorkspacesService,
  config: MetricsConfig = { retentionMinutes: 60, sampleIntervalSeconds: 30 }
): MetricsService {
  const METRICS_KEY_PREFIX = 'pod:metrics:';
  const LATEST_KEY_PREFIX = 'pod:metrics:latest:';

  /**
   * Get current metrics for a pod
   */
  async function getPodMetrics(podId: string): Promise<PodMetrics> {
    // First check if we have cached latest metrics
    const latestKey = `${LATEST_KEY_PREFIX}${podId}`;
    const cached = await redis.get(latestKey);

    if (cached) {
      const parsed = JSON.parse(cached) as PodMetrics & { timestamp: string };
      return {
        ...parsed,
        timestamp: new Date(parsed.timestamp),
      };
    }

    // Try to get from Kasm directly
    // Note: In production, we'd look up the kasmId from the pod record
    try {
      const kasmMetrics = await kasmService.getSessionMetrics(podId);

      const metrics: PodMetrics = {
        cpuPercent: kasmMetrics.cpuUsage,
        memoryPercent: kasmMetrics.memoryUsage,
        memoryUsedBytes: 0, // Would need additional Kasm API call
        storagePercent: 0,
        storageUsedBytes: 0,
        networkRxBytes: kasmMetrics.networkRx,
        networkTxBytes: kasmMetrics.networkTx,
        timestamp: new Date(),
      };

      // Cache for a short time
      await redis.set(latestKey, JSON.stringify(metrics), 'EX', config.sampleIntervalSeconds);

      return metrics;
    } catch {
      // Return default metrics if Kasm is unavailable
      return {
        cpuPercent: 0,
        memoryPercent: 0,
        memoryUsedBytes: 0,
        storagePercent: 0,
        storageUsedBytes: 0,
        networkRxBytes: 0,
        networkTxBytes: 0,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Record metrics snapshot for a pod
   */
  async function recordMetrics(podId: string, metrics: PodMetrics): Promise<void> {
    const historyKey = `${METRICS_KEY_PREFIX}${podId}`;
    const latestKey = `${LATEST_KEY_PREFIX}${podId}`;

    const metricsData = JSON.stringify(metrics);
    const score = metrics.timestamp.getTime();

    // Add to sorted set for history
    await redis.zadd(historyKey, score, metricsData);

    // Update latest
    await redis.set(latestKey, metricsData, 'EX', config.sampleIntervalSeconds * 2);

    // Trim old entries
    const cutoff = Date.now() - config.retentionMinutes * 60 * 1000;
    await redis.zremrangebyscore(historyKey, '-inf', cutoff);
  }

  /**
   * Get metrics history for a pod
   */
  async function getMetricsHistory(podId: string, minutes: number): Promise<PodMetrics[]> {
    const historyKey = `${METRICS_KEY_PREFIX}${podId}`;
    const cutoff = Date.now() - minutes * 60 * 1000;

    const entries = await redis.zrangebyscore(historyKey, cutoff, '+inf');

    return entries.map((entry) => {
      const parsed = JSON.parse(entry) as PodMetrics & { timestamp: string };
      return {
        ...parsed,
        timestamp: new Date(parsed.timestamp),
      };
    });
  }

  /**
   * Get average metrics over a time period
   */
  async function getAverageMetrics(podId: string, minutes: number): Promise<PodMetrics> {
    const history = await getMetricsHistory(podId, minutes);

    if (history.length === 0) {
      return {
        cpuPercent: 0,
        memoryPercent: 0,
        memoryUsedBytes: 0,
        storagePercent: 0,
        storageUsedBytes: 0,
        networkRxBytes: 0,
        networkTxBytes: 0,
        timestamp: new Date(),
      };
    }

    const sum = history.reduce(
      (acc, m) => ({
        cpuPercent: acc.cpuPercent + m.cpuPercent,
        memoryPercent: acc.memoryPercent + m.memoryPercent,
        memoryUsedBytes: acc.memoryUsedBytes + m.memoryUsedBytes,
        storagePercent: acc.storagePercent + m.storagePercent,
        storageUsedBytes: acc.storageUsedBytes + m.storageUsedBytes,
        networkRxBytes: acc.networkRxBytes + m.networkRxBytes,
        networkTxBytes: acc.networkTxBytes + m.networkTxBytes,
      }),
      {
        cpuPercent: 0,
        memoryPercent: 0,
        memoryUsedBytes: 0,
        storagePercent: 0,
        storageUsedBytes: 0,
        networkRxBytes: 0,
        networkTxBytes: 0,
      }
    );

    const count = history.length;

    return {
      cpuPercent: sum.cpuPercent / count,
      memoryPercent: sum.memoryPercent / count,
      memoryUsedBytes: Math.floor(sum.memoryUsedBytes / count),
      storagePercent: sum.storagePercent / count,
      storageUsedBytes: Math.floor(sum.storageUsedBytes / count),
      networkRxBytes: Math.floor(sum.networkRxBytes / count),
      networkTxBytes: Math.floor(sum.networkTxBytes / count),
      timestamp: new Date(),
    };
  }

  /**
   * Clear all metrics for a pod
   */
  async function clearMetrics(podId: string): Promise<void> {
    const historyKey = `${METRICS_KEY_PREFIX}${podId}`;
    const latestKey = `${LATEST_KEY_PREFIX}${podId}`;

    await redis.del(historyKey, latestKey);
  }

  return {
    getPodMetrics,
    recordMetrics,
    getMetricsHistory,
    getAverageMetrics,
    clearMetrics,
  };
}

/**
 * Convert PodMetrics to ResourceUtilization for scaling decisions
 */
export function metricsToUtilization(metrics: PodMetrics): ResourceUtilization {
  return {
    cpuPercent: metrics.cpuPercent,
    memoryPercent: metrics.memoryPercent,
    storagePercent: metrics.storagePercent,
    networkRxBytes: metrics.networkRxBytes,
    networkTxBytes: metrics.networkTxBytes,
  };
}
