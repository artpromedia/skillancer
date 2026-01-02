/**
 * Usage Metering Middleware
 * Sprint M10: Talent Intelligence API
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { structlog } from '@skillancer/logger';

const logger = structlog.get('usage-metering');

// ============================================================================
// Types
// ============================================================================

interface UsageRecord {
  customerId: string;
  keyId: string;
  endpoint: string;
  method: string;
  path: string;
  queryParams: Record<string, unknown>;
  statusCode: number;
  responseMs: number;
  responseSize: number;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  errorCode?: string;
  errorMessage?: string;
}

interface UsageSummary {
  customerId: string;
  period: Date;
  totalCalls: number;
  byEndpoint: Record<string, number>;
  errorCount: number;
  avgResponseMs: number;
}

interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  resetAt: Date;
  percentUsed: number;
}

// ============================================================================
// Plan Limits
// ============================================================================

const PLAN_LIMITS: Record<string, number> = {
  STARTER: 1000,
  PROFESSIONAL: 10000,
  ENTERPRISE: 100000, // Effectively unlimited, tracked for billing
};

const OVERAGE_RATES: Record<string, number> = {
  STARTER: 0.25, // $0.25 per extra call
  PROFESSIONAL: 0.15,
  ENTERPRISE: 0.05,
};

// ============================================================================
// In-Memory Usage Store (Use Redis in production)
// ============================================================================

interface MonthlyUsage {
  calls: number;
  byEndpoint: Record<string, number>;
  errors: number;
  totalResponseMs: number;
}

const usageStore = new Map<string, MonthlyUsage>();

function getUsageKey(customerId: string): string {
  const now = new Date();
  return `usage:${customerId}:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthlyUsage(customerId: string): MonthlyUsage {
  const key = getUsageKey(customerId);
  let usage = usageStore.get(key);

  if (!usage) {
    usage = {
      calls: 0,
      byEndpoint: {},
      errors: 0,
      totalResponseMs: 0,
    };
    usageStore.set(key, usage);
  }

  return usage;
}

// ============================================================================
// Usage Metering Middleware
// ============================================================================

export async function usageMetering(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const context = request.apiKeyContext;

  if (!context) {
    return; // No auth context, skip metering
  }

  const responseTime = reply.elapsedTime || 0;
  const endpoint = getEndpointName(request.url);

  // Record usage
  const record: UsageRecord = {
    customerId: context.customerId,
    keyId: context.keyId,
    endpoint,
    method: request.method,
    path: request.url,
    queryParams: request.query as Record<string, unknown>,
    statusCode: reply.statusCode,
    responseMs: Math.round(responseTime),
    responseSize: parseInt((reply.getHeader('content-length') as string) || '0', 10),
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'] || 'unknown',
    timestamp: new Date(),
  };

  // Check for errors
  if (reply.statusCode >= 400) {
    record.errorCode = `HTTP_${reply.statusCode}`;
  }

  // Update in-memory counters
  const usage = getMonthlyUsage(context.customerId);
  usage.calls++;
  usage.byEndpoint[endpoint] = (usage.byEndpoint[endpoint] || 0) + 1;
  usage.totalResponseMs += record.responseMs;
  if (record.errorCode) {
    usage.errors++;
  }

  // Persist to database (async)
  persistUsageRecord(record).catch((err) =>
    logger.error('Failed to persist usage', { error: err })
  );

  // Check quota and send alerts
  const quota = await getQuotaStatus(context.customerId, context.plan);

  // Add quota headers
  reply.header('X-Quota-Limit', quota.limit);
  reply.header('X-Quota-Used', quota.used);
  reply.header('X-Quota-Remaining', quota.remaining);
  reply.header('X-Quota-Reset', quota.resetAt.toISOString());

  // Check for alerts
  await checkUsageAlerts(context.customerId, quota);

  logger.debug('Usage recorded', {
    customerId: context.customerId,
    endpoint,
    responseMs: record.responseMs,
    monthlyUsage: usage.calls,
  });
}

// ============================================================================
// Quota Management
// ============================================================================

export async function getQuotaStatus(customerId: string, plan: string): Promise<QuotaStatus> {
  const usage = getMonthlyUsage(customerId);
  const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.STARTER;

  // Calculate reset date (first of next month)
  const now = new Date();
  const resetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    used: usage.calls,
    limit,
    remaining: Math.max(0, limit - usage.calls),
    resetAt,
    percentUsed: Math.round((usage.calls / limit) * 100),
  };
}

export async function checkUsageAlerts(customerId: string, quota: QuotaStatus): Promise<void> {
  // Check for approaching limit (80%)
  if (quota.percentUsed >= 80 && quota.percentUsed < 100) {
    await sendUsageAlert(customerId, 'APPROACHING_LIMIT', quota.percentUsed);
  }

  // Check for limit reached
  if (quota.percentUsed >= 100) {
    await sendUsageAlert(customerId, 'LIMIT_REACHED', quota.percentUsed);
  }
}

async function sendUsageAlert(
  customerId: string,
  alertType: string,
  threshold: number
): Promise<void> {
  // In production:
  // 1. Check if alert already sent this period
  // 2. Create APIUsageAlert record
  // 3. Send email notification

  logger.info('Usage alert', { customerId, alertType, threshold });
}

// ============================================================================
// Billing Integration
// ============================================================================

export async function calculateOverageCharges(
  customerId: string,
  plan: string
): Promise<{ overageCalls: number; overageFee: number }> {
  const usage = getMonthlyUsage(customerId);
  const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.STARTER;
  const rate = OVERAGE_RATES[plan] || OVERAGE_RATES.STARTER;

  const overageCalls = Math.max(0, usage.calls - limit);
  const overageFee = overageCalls * rate;

  return { overageCalls, overageFee };
}

export async function getUsageSummary(customerId: string): Promise<UsageSummary> {
  const usage = getMonthlyUsage(customerId);
  const now = new Date();

  return {
    customerId,
    period: new Date(now.getFullYear(), now.getMonth(), 1),
    totalCalls: usage.calls,
    byEndpoint: usage.byEndpoint,
    errorCount: usage.errors,
    avgResponseMs: usage.calls > 0 ? Math.round(usage.totalResponseMs / usage.calls) : 0,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function getEndpointName(url: string): string {
  // Extract endpoint name from URL
  // /v1/rates/benchmark?skill=React -> rates/benchmark
  const match = url.match(/^\/v1\/([^?]+)/);
  return match ? match[1] : 'unknown';
}

async function persistUsageRecord(record: UsageRecord): Promise<void> {
  // In production:
  // await prisma.aPIUsage.create({ data: record });

  logger.debug('Persisted usage record', {
    customerId: record.customerId,
    endpoint: record.endpoint,
  });
}

// ============================================================================
// Usage Reporting
// ============================================================================

export async function getDailyUsage(
  customerId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ date: string; calls: number }>> {
  // In production, query from database aggregated by day
  return [];
}

export async function getEndpointBreakdown(
  customerId: string,
  period: Date
): Promise<Record<string, number>> {
  const usage = getMonthlyUsage(customerId);
  return usage.byEndpoint;
}

export async function getTopCustomersByUsage(
  limit: number = 10
): Promise<Array<{ customerId: string; calls: number }>> {
  // In production, query from database
  const results: Array<{ customerId: string; calls: number }> = [];

  for (const [key, usage] of usageStore.entries()) {
    const customerId = key.split(':')[1];
    results.push({ customerId, calls: usage.calls });
  }

  return results.sort((a, b) => b.calls - a.calls).slice(0, limit);
}
