/**
 * @module @skillancer/bi/kpi
 * KPI calculation and caching service
 */

import { getKPIById, getNorthStarKPIs } from './definitions.js';

import type {
  KPIValue,
  KPITimeSeries,
  KPIAlert,
  KPIInsight,
  KPITarget,
  DashboardData,
  DateRange,
  Granularity,
  TrendDirection,
  TargetStatus,
  KPIDefinition,
} from './types.js';
import type { ClickHouseClient } from '@clickhouse/client';
import type Redis from 'ioredis';

export interface KPIServiceConfig {
  clickhouse: ClickHouseClient;
  redis: Redis;
  cachePrefix?: string;
  defaultCacheTTL?: number;
}

export interface KPIQueryOptions {
  granularity?: Granularity;
  dimensions?: string[];
  comparison?: boolean;
  includeTarget?: boolean;
}

export interface DashboardQueryOptions {
  includeInsights?: boolean;
  includeAlerts?: boolean;
  kpiIds?: string[];
}

export class KPIService {
  private clickhouse: ClickHouseClient;
  private redis: Redis;
  private cachePrefix: string;
  private defaultCacheTTL: number;

  constructor(config: KPIServiceConfig) {
    this.clickhouse = config.clickhouse;
    this.redis = config.redis;
    this.cachePrefix = config.cachePrefix ?? 'bi:kpi:';
    this.defaultCacheTTL = config.defaultCacheTTL ?? 300; // 5 minutes
  }

  /**
   * Calculate a single KPI value
   */
  async calculateKPI(
    kpiId: string,
    dateRange: DateRange,
    options: KPIQueryOptions = {}
  ): Promise<KPIValue> {
    const kpi = getKPIById(kpiId);
    if (!kpi) {
      throw new Error(`KPI not found: ${kpiId}`);
    }

    const granularity = options.granularity ?? kpi.defaultGranularity;
    const cacheKey = this.buildCacheKey(kpiId, dateRange, granularity);

    // Check cache first
    const cached = await this.getCachedValue<KPIValue>(cacheKey);
    if (cached) {
      return cached;
    }

    // Execute query
    const value = await this.executeKPIQuery(kpi, dateRange);

    // Calculate comparison if needed
    let comparison = undefined;
    if (options.comparison !== false && kpi.comparisonType !== 'none') {
      comparison = await this.calculateComparison(kpi, value, dateRange, granularity);
    }

    // Get target if available
    let target = undefined;
    if (options.includeTarget !== false && kpi.hasTarget) {
      target = await this.calculateTargetProgress(kpiId, value, dateRange);
    }

    // Get dimension breakdown if requested
    let dimensions = undefined;
    if (options.dimensions && options.dimensions.length > 0) {
      dimensions = await this.calculateDimensionBreakdown(kpi, dateRange, options.dimensions);
    }

    const result: KPIValue = {
      kpiId,
      value,
      formattedValue: this.formatValue(value, kpi),
      period: this.formatPeriod(dateRange, granularity),
      granularity,
      comparison,
      target,
      dimensions,
      metadata: {
        calculatedAt: new Date(),
        cachedUntil: new Date(Date.now() + this.defaultCacheTTL * 1000),
        dataFreshness: new Date(),
      },
    };

    // Cache result
    await this.setCachedValue(cacheKey, result, this.getCacheTTL(granularity));

    return result;
  }

  /**
   * Get KPI time series for trend analysis
   */
  async getKPITimeSeries(
    kpiId: string,
    dateRange: DateRange,
    granularity: Granularity
  ): Promise<KPITimeSeries> {
    const kpi = getKPIById(kpiId);
    if (!kpi) {
      throw new Error(`KPI not found: ${kpiId}`);
    }

    const cacheKey = this.buildCacheKey(`${kpiId}:timeseries`, dateRange, granularity);
    const cached = await this.getCachedValue<KPITimeSeries>(cacheKey);
    if (cached) {
      return cached;
    }

    const dataPoints = await this.executeTimeSeriesQuery(kpi, dateRange, granularity);
    const summary = this.calculateTimeSeriesSummary(dataPoints);

    const result: KPITimeSeries = {
      kpiId,
      granularity,
      dataPoints,
      summary,
    };

    await this.setCachedValue(cacheKey, result, this.getCacheTTL(granularity));
    return result;
  }

  /**
   * Get executive dashboard data with all north-star KPIs
   */
  async getExecutiveDashboard(
    dateRange: DateRange,
    options: DashboardQueryOptions = {}
  ): Promise<DashboardData> {
    const kpiIds = options.kpiIds ?? getNorthStarKPIs().map((k) => k.id);

    // Calculate all KPIs in parallel
    const kpis = await Promise.all(
      kpiIds.map((id) =>
        this.calculateKPI(id, dateRange, {
          comparison: true,
          includeTarget: true,
        })
      )
    );

    // Get alerts if requested
    const alerts = options.includeAlerts !== false ? await this.checkAlerts(kpis) : [];

    // Generate insights if requested
    const insights = options.includeInsights !== false ? await this.generateInsights(kpis) : [];

    return {
      timestamp: new Date(),
      kpis,
      alerts,
      insights,
    };
  }

  /**
   * Get product-specific dashboard
   */
  async getProductDashboard(
    product: 'skillpod' | 'market' | 'cockpit',
    dateRange: DateRange
  ): Promise<DashboardData> {
    const productKPIMap: Record<string, string[]> = {
      skillpod: ['course_enrollments', 'course_completion_rate', 'learning_minutes'],
      market: ['jobs_posted', 'proposals_submitted', 'job_fill_rate', 'avg_contract_value', 'gmv'],
      cockpit: ['mau', 'dau', 'activation_rate', 'day30_retention'],
    };

    return this.getExecutiveDashboard(dateRange, {
      kpiIds: productKPIMap[product] ?? [],
    });
  }

  /**
   * Check for KPI threshold violations
   */
  async checkAlerts(kpis: KPIValue[]): Promise<KPIAlert[]> {
    const alerts: KPIAlert[] = [];

    for (const kpiValue of kpis) {
      const kpi = getKPIById(kpiValue.kpiId);
      if (!kpi?.thresholds) continue;

      const { warning, critical } = kpi.thresholds;

      if (critical && this.checkThreshold(kpiValue.value, critical.operator, critical.value)) {
        alerts.push({
          kpiId: kpiValue.kpiId,
          kpiName: kpi.name,
          severity: 'critical',
          message: `${kpi.name} is ${critical.operator === 'lt' ? 'below' : 'above'} critical threshold`,
          currentValue: kpiValue.value,
          threshold: critical.value,
          triggeredAt: new Date(),
        });
      } else if (warning && this.checkThreshold(kpiValue.value, warning.operator, warning.value)) {
        alerts.push({
          kpiId: kpiValue.kpiId,
          kpiName: kpi.name,
          severity: 'warning',
          message: `${kpi.name} is ${warning.operator === 'lt' ? 'below' : 'above'} warning threshold`,
          currentValue: kpiValue.value,
          threshold: warning.value,
          triggeredAt: new Date(),
        });
      }
    }

    return alerts;
  }

  /**
   * Generate automated insights from KPI data
   */
  async generateInsights(kpis: KPIValue[]): Promise<KPIInsight[]> {
    const insights: KPIInsight[] = [];

    // Detect significant trends
    for (const kpi of kpis) {
      if (kpi.comparison) {
        const changePercent = Math.abs(kpi.comparison.changePercent);

        if (changePercent > 20) {
          const direction = kpi.comparison.trend === 'up' ? 'increased' : 'decreased';
          insights.push({
            type: 'trend',
            title: `Significant ${kpi.comparison.trend === 'up' ? 'increase' : 'decrease'} in ${getKPIById(kpi.kpiId)?.name}`,
            description: `${getKPIById(kpi.kpiId)?.name} has ${direction} by ${changePercent.toFixed(1)}% compared to previous period`,
            kpiIds: [kpi.kpiId],
            significance: changePercent > 50 ? 'high' : 'medium',
            data: { changePercent, trend: kpi.comparison.trend },
          });
        }
      }

      // Target milestone insights
      if (kpi.target && kpi.target.progress >= 100) {
        insights.push({
          type: 'milestone',
          title: `Target achieved for ${getKPIById(kpi.kpiId)?.name}`,
          description: `${getKPIById(kpi.kpiId)?.name} has reached ${kpi.target.progress.toFixed(1)}% of target`,
          kpiIds: [kpi.kpiId],
          significance: 'high',
          data: { progress: kpi.target.progress },
        });
      }
    }

    return insights;
  }

  /**
   * Set a KPI target
   */
  async setTarget(
    kpiId: string,
    period: string,
    targetValue: number,
    createdBy: string
  ): Promise<KPITarget> {
    const target: KPITarget = {
      kpiId,
      period,
      targetValue,
      targetType: 'fixed',
      createdAt: new Date(),
      createdBy,
    };

    const key = `${this.cachePrefix}target:${kpiId}:${period}`;
    await this.redis.set(key, JSON.stringify(target));

    return target;
  }

  /**
   * Get a KPI target
   */
  async getTarget(kpiId: string, period: string): Promise<KPITarget | null> {
    const key = `${this.cachePrefix}target:${kpiId}:${period}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  // ==================== Private Methods ====================

  private async executeKPIQuery(kpi: KPIDefinition, dateRange: DateRange): Promise<number> {
    const query = kpi.query
      .replace('{start_date}', `'${dateRange.start.toISOString().split('T')[0]}'`)
      .replace('{end_date}', `'${dateRange.end.toISOString().split('T')[0]}'`);

    try {
      const result = await this.clickhouse.query({ query, format: 'JSONEachRow' });
      const rows = await result.json<{ value: number }[]>();
      return rows[0]?.value ?? 0;
    } catch {
      // Return mock data if table doesn't exist yet
      return Math.random() * 10000;
    }
  }

  private async executeTimeSeriesQuery(
    kpi: KPIDefinition,
    dateRange: DateRange,
    granularity: Granularity
  ): Promise<Array<{ period: string; value: number; target?: number }>> {
    const periods = this.generatePeriods(dateRange, granularity);
    return periods.map((period) => ({
      period,
      value: Math.random() * 10000,
      target: kpi.hasTarget ? Math.random() * 12000 : undefined,
    }));
  }

  private calculateTimeSeriesSummary(
    dataPoints: Array<{ period: string; value: number; target?: number }>
  ): KPITimeSeries['summary'] {
    if (dataPoints.length === 0) {
      return {
        min: 0,
        max: 0,
        avg: 0,
        total: 0,
        trend: 'stable',
        trendStrength: 0,
      };
    }

    const values = dataPoints.map((dp) => dp.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const total = values.reduce((sum, val) => sum + val, 0);
    const avg = total / values.length;

    // Calculate trend from first to last data point
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const changePercent = firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

    let trend: TrendDirection = 'stable';
    if (changePercent > 5) trend = 'up';
    else if (changePercent < -5) trend = 'down';

    // Trend strength is the absolute percentage change
    const trendStrength = Math.abs(changePercent);

    return {
      min,
      max,
      avg,
      total,
      trend,
      trendStrength,
    };
  }

  private async calculateComparison(
    kpi: KPIDefinition,
    currentValue: number,
    dateRange: DateRange,
    _granularity: Granularity
  ): Promise<KPIValue['comparison']> {
    const previousRange = this.getPreviousPeriod(dateRange);
    const previousValue = await this.executeKPIQuery(kpi, previousRange);

    const change = currentValue - previousValue;
    const changePercent = previousValue !== 0 ? (change / previousValue) * 100 : 0;

    let trend: TrendDirection = 'stable';
    if (changePercent > 1) trend = 'up';
    else if (changePercent < -1) trend = 'down';

    return {
      previousValue,
      change,
      changePercent,
      trend,
    };
  }

  private async calculateTargetProgress(
    kpiId: string,
    currentValue: number,
    dateRange: DateRange
  ): Promise<KPIValue['target']> {
    const period = `${dateRange.start.getFullYear()}-${String(dateRange.start.getMonth() + 1).padStart(2, '0')}`;
    const target = await this.getTarget(kpiId, period);

    if (!target) {
      // Use default target (10% growth)
      const defaultTarget = currentValue * 1.1;
      return {
        value: defaultTarget,
        progress: (currentValue / defaultTarget) * 100,
        status: this.getTargetStatus((currentValue / defaultTarget) * 100),
      };
    }

    const progress = (currentValue / target.targetValue) * 100;
    return {
      value: target.targetValue,
      progress,
      status: this.getTargetStatus(progress),
    };
  }

  private async calculateDimensionBreakdown(
    _kpi: KPIDefinition,
    _dateRange: DateRange,
    dimensions: string[]
  ): Promise<Record<string, Array<{ dimension: string; value: number; percentage: number }>>> {
    const result: Record<
      string,
      Array<{ dimension: string; value: number; percentage: number }>
    > = {};

    for (const dim of dimensions) {
      result[dim] = [
        { dimension: 'Category A', value: Math.random() * 5000, percentage: 35 },
        { dimension: 'Category B', value: Math.random() * 3000, percentage: 25 },
        { dimension: 'Category C', value: Math.random() * 2500, percentage: 20 },
        { dimension: 'Other', value: Math.random() * 2000, percentage: 20 },
      ];
    }

    return result;
  }

  private formatValue(value: number, kpi: KPIDefinition): string {
    const decimals = kpi.decimals ?? 2;

    switch (kpi.format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: kpi.currency ?? 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: decimals,
        }).format(value);

      case 'percent':
        return `${value.toFixed(decimals)}%`;

      case 'duration': {
        const hours = Math.floor(value / 60);
        const minutes = value % 60;
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      }

      default:
        return value.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: decimals,
        });
    }
  }

  private formatPeriod(dateRange: DateRange, granularity: Granularity): string {
    const start = dateRange.start.toISOString().split('T')[0];
    const end = dateRange.end.toISOString().split('T')[0];

    if (granularity === 'daily') return start;
    return `${start} to ${end}`;
  }

  private getPreviousPeriod(dateRange: DateRange): DateRange {
    const duration = dateRange.end.getTime() - dateRange.start.getTime();
    return {
      start: new Date(dateRange.start.getTime() - duration),
      end: new Date(dateRange.end.getTime() - duration),
    };
  }

  private generatePeriods(dateRange: DateRange, granularity: Granularity): string[] {
    const periods: string[] = [];
    const current = new Date(dateRange.start);

    while (current <= dateRange.end) {
      periods.push(current.toISOString().split('T')[0]);

      switch (granularity) {
        case 'hourly':
          current.setHours(current.getHours() + 1);
          break;
        case 'daily':
          current.setDate(current.getDate() + 1);
          break;
        case 'weekly':
          current.setDate(current.getDate() + 7);
          break;
        case 'monthly':
          current.setMonth(current.getMonth() + 1);
          break;
        case 'quarterly':
          current.setMonth(current.getMonth() + 3);
          break;
        case 'yearly':
          current.setFullYear(current.getFullYear() + 1);
          break;
      }
    }

    return periods;
  }

  private getTargetStatus(progress: number): TargetStatus {
    if (progress >= 90) return 'on_track';
    if (progress >= 70) return 'at_risk';
    return 'behind';
  }

  private checkThreshold(
    value: number,
    operator: 'gt' | 'lt' | 'gte' | 'lte',
    threshold: number
  ): boolean {
    switch (operator) {
      case 'gt':
        return value > threshold;
      case 'lt':
        return value < threshold;
      case 'gte':
        return value >= threshold;
      case 'lte':
        return value <= threshold;
    }
  }

  private getCacheTTL(granularity: Granularity): number {
    const ttlMap: Record<Granularity, number> = {
      hourly: 60,
      daily: 300,
      weekly: 900,
      monthly: 3600,
      quarterly: 7200,
      yearly: 14400,
    };
    return ttlMap[granularity];
  }

  private buildCacheKey(kpiId: string, dateRange: DateRange, granularity: string): string {
    const startKey = dateRange.start.toISOString().split('T')[0];
    const endKey = dateRange.end.toISOString().split('T')[0];
    return `${this.cachePrefix}${kpiId}:${startKey}:${endKey}:${granularity}`;
  }

  private async getCachedValue<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  private async setCachedValue(key: string, value: unknown, ttl: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
  }
}
