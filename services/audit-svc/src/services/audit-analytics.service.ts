/**
 * @module @skillancer/audit-svc/services/audit-analytics.service
 * Analytics and anomaly detection for audit logs
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-redundant-type-constituents */
// Prisma client types are not available until `prisma generate` is run

import * as auditLogRepository from '../repositories/audit-log.repository.js';
import {
  type AuditSearchFilters,
  type AuditDashboardStats,
  type AuditAnalytics,
  type AuditBaseline,
  AnomalySeverity,
} from '../types/index.js';

import type { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

export function initializeAnalyticsService(prismaClient: PrismaClient): void {
  prisma = prismaClient;
}

export async function getDashboardStats(
  filters: AuditSearchFilters = {}
): Promise<AuditDashboardStats> {
  const [totalEvents, categoryBreakdown, hourlyTrends, eventCounts] = await Promise.all([
    auditLogRepository.countAuditLogs(filters),
    auditLogRepository.aggregateByCategory(filters),
    auditLogRepository.aggregateHourlyTrends(filters),
    auditLogRepository.aggregateEventCountsByType(filters),
  ]);

  const eventsByCategory: Record<string, number> = {};
  for (const cat of categoryBreakdown) {
    eventsByCategory[cat._id] = cat.count;
  }

  const eventsByHour: Record<number, number> = {};
  for (const h of hourlyTrends) {
    eventsByHour[h._id] = h.count;
  }

  const topEventTypes = eventCounts.slice(0, 10).map((e) => ({
    eventType: e._id,
    count: e.count,
  }));

  return {
    totalEvents,
    eventsByCategory,
    eventsByHour,
    topEventTypes,
    anomalies: [],
    generatedAt: new Date(),
  };
}

export async function recordAnalytics(
  data: Omit<AuditAnalytics, 'id' | 'createdAt'>
): Promise<AuditAnalytics> {
  if (!prisma) {
    throw new Error('Analytics service not initialized');
  }

  const record = await prisma.auditAnalytics.create({
    data: {
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      metricType: data.metricType,
      dimensions: data.dimensions,
      value: data.value,
      metadata: data.metadata as Record<string, unknown>,
    },
  });

  return {
    id: record.id,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    metricType: record.metricType,
    dimensions: record.dimensions as Record<string, unknown>,
    value: record.value.toNumber(),
    metadata: record.metadata as Record<string, unknown>,
    createdAt: record.createdAt,
  };
}

export async function getAnalytics(
  metricType: string,
  options: {
    startDate: Date;
    endDate: Date;
    dimensions?: Record<string, unknown>;
  }
): Promise<AuditAnalytics[]> {
  if (!prisma) {
    throw new Error('Analytics service not initialized');
  }

  const records = await prisma.auditAnalytics.findMany({
    where: {
      metricType,
      periodStart: { gte: options.startDate },
      periodEnd: { lte: options.endDate },
    },
    orderBy: { periodStart: 'asc' },
  });

  return records.map(
    (r: {
      id: string;
      periodStart: Date;
      periodEnd: Date;
      metricType: string;
      dimensions: unknown;
      value: { toNumber(): number };
      metadata: unknown;
      createdAt: Date;
    }) => ({
      id: r.id,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      metricType: r.metricType,
      dimensions: r.dimensions as Record<string, unknown>,
      value: r.value.toNumber(),
      metadata: r.metadata as Record<string, unknown>,
      createdAt: r.createdAt,
    })
  );
}

export async function detectAnomalies(
  actorId: string,
  eventType: string,
  currentCount: number
): Promise<{
  isAnomaly: boolean;
  severity: AnomalySeverity;
  message?: string;
}> {
  if (!prisma) {
    return { isAnomaly: false, severity: AnomalySeverity.LOW };
  }

  const baseline = await getBaseline(actorId, eventType);
  if (!baseline) {
    return { isAnomaly: false, severity: AnomalySeverity.LOW };
  }

  const deviation = Math.abs(currentCount - baseline.avgCount);
  const threshold = baseline.stdDev * 2;

  if (deviation <= threshold) {
    return { isAnomaly: false, severity: AnomalySeverity.LOW };
  }

  let severity = AnomalySeverity.LOW;
  if (deviation > baseline.stdDev * 3) {
    severity = AnomalySeverity.CRITICAL;
  } else if (deviation > baseline.stdDev * 2.5) {
    severity = AnomalySeverity.HIGH;
  } else if (deviation > baseline.stdDev * 2) {
    severity = AnomalySeverity.MEDIUM;
  }

  return {
    isAnomaly: true,
    severity,
    message: `Activity deviation detected: ${currentCount} events vs baseline ${baseline.avgCount.toFixed(1)} (±${baseline.stdDev.toFixed(1)})`,
  };
}

async function getBaseline(actorId: string, eventType: string): Promise<AuditBaseline | null> {
  if (!prisma) return null;

  const record = await prisma.auditBaseline.findFirst({
    where: {
      actorId,
      eventType,
    },
    orderBy: { calculatedAt: 'desc' },
  });

  if (!record) return null;

  return {
    id: record.id,
    actorId: record.actorId,
    eventType: record.eventType,
    avgCount: record.avgCount.toNumber(),
    stdDev: record.stdDev.toNumber(),
    minCount: record.minCount,
    maxCount: record.maxCount,
    sampleSize: record.sampleSize,
    calculatedAt: record.calculatedAt,
  };
}

export async function updateBaseline(
  actorId: string,
  eventType: string
): Promise<AuditBaseline | null> {
  if (!prisma) return null;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dailyCounts = await auditLogRepository.aggregateDailyCountsByActor(
    actorId,
    eventType,
    thirtyDaysAgo
  );

  if (dailyCounts.length < 7) {
    return null;
  }

  const counts = dailyCounts.map((d) => d.count);
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  const variance = counts.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / counts.length;
  const stdDev = Math.sqrt(variance);

  const record = await prisma.auditBaseline.upsert({
    where: {
      actorId_eventType: {
        actorId,
        eventType,
      },
    },
    update: {
      avgCount: avg,
      stdDev,
      minCount: Math.min(...counts),
      maxCount: Math.max(...counts),
      sampleSize: counts.length,
      calculatedAt: new Date(),
    },
    create: {
      actorId,
      eventType,
      avgCount: avg,
      stdDev,
      minCount: Math.min(...counts),
      maxCount: Math.max(...counts),
      sampleSize: counts.length,
    },
  });

  return {
    id: record.id,
    actorId: record.actorId,
    eventType: record.eventType,
    avgCount: record.avgCount.toNumber(),
    stdDev: record.stdDev.toNumber(),
    minCount: record.minCount,
    maxCount: record.maxCount,
    sampleSize: record.sampleSize,
    calculatedAt: record.calculatedAt,
  };
}
