// @ts-nocheck - Known type issues pending refactor
/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * Usage Tracking Service
 * Tracks and manages metered usage for billing purposes
 */

import { logger } from '@skillancer/logger';

export interface UsageRecord {
  id: string;
  subscriptionId: string;
  metricName: string;
  quantity: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface UsageStats {
  totalQuantity: number;
  recordCount: number;
  periodStart: Date;
  periodEnd: Date;
}

export class UsageService {
  private readonly usageRecords: Map<string, UsageRecord[]> = new Map();

  /**
   * Record usage for a subscription
   */
  async recordUsage(
    subscriptionId: string,
    metricName: string,
    quantity: number,
    metadata?: Record<string, unknown>
  ): Promise<UsageRecord> {
    const record: UsageRecord = {
      id: `usage_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      subscriptionId,
      metricName,
      quantity,
      timestamp: new Date(),
      metadata,
    };

    const existing = this.usageRecords.get(subscriptionId) ?? [];
    existing.push(record);
    this.usageRecords.set(subscriptionId, existing);

    logger.info({ record }, 'Recorded usage');

    return record;
  }

  /**
   * Get usage for a subscription within a period
   */
  getUsage(
    subscriptionId: string,
    metricName: string,
    periodStart: Date,
    periodEnd: Date
  ): UsageRecord[] {
    const records = this.usageRecords.get(subscriptionId) ?? [];
    return records.filter(
      (r) => r.metricName === metricName && r.timestamp >= periodStart && r.timestamp <= periodEnd
    );
  }

  /**
   * Get usage stats for a subscription
   */
  getUsageStats(
    subscriptionId: string,
    metricName: string,
    periodStart: Date,
    periodEnd: Date
  ): UsageStats {
    const records = this.getUsage(subscriptionId, metricName, periodStart, periodEnd);
    const totalQuantity = records.reduce((sum, r) => sum + r.quantity, 0);

    return {
      totalQuantity,
      recordCount: records.length,
      periodStart,
      periodEnd,
    };
  }

  /**
   * Clear usage records for a subscription (for testing)
   */
  clearUsage(subscriptionId: string): void {
    this.usageRecords.delete(subscriptionId);
  }
}

export const usageService = new UsageService();
