/**
 * @module @skillancer/bi/kpi
 * KPI type definitions
 */

export type KPICategory =
  | 'revenue'
  | 'growth'
  | 'engagement'
  | 'retention'
  | 'acquisition'
  | 'marketplace'
  | 'learning'
  | 'operations'
  | 'quality';

export type KPIFormat = 'number' | 'currency' | 'percent' | 'duration' | 'ratio';
export type Granularity = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type ComparisonType = 'previous_period' | 'same_period_last_year' | 'target' | 'none';
export type ThresholdOperator = 'gt' | 'lt' | 'gte' | 'lte';
export type TrendDirection = 'up' | 'down' | 'stable';
export type TargetStatus = 'on_track' | 'at_risk' | 'behind';

export interface KPIThreshold {
  operator: ThresholdOperator;
  value: number;
}

export interface KPIDefinition {
  id: string;
  name: string;
  description: string;
  category: KPICategory;
  query: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct' | 'custom';
  format: KPIFormat;
  decimals?: number;
  currency?: string;
  supportedGranularities: Granularity[];
  defaultGranularity: Granularity;
  comparisonType: ComparisonType;
  hasTarget: boolean;
  targetType?: 'fixed' | 'growth_rate' | 'benchmark';
  thresholds?: {
    warning?: KPIThreshold;
    critical?: KPIThreshold;
  };
  visibility: 'public' | 'internal' | 'executive';
  relatedKPIs?: string[];
  dimensions?: string[];
  tags: string[];
}

export interface KPIValue {
  kpiId: string;
  value: number;
  formattedValue: string;
  period: string;
  granularity: string;
  comparison?: {
    previousValue: number;
    change: number;
    changePercent: number;
    trend: TrendDirection;
  };
  target?: {
    value: number;
    progress: number;
    status: TargetStatus;
  };
  dimensions?: Record<string, KPIDimensionValue[]>;
  metadata: {
    calculatedAt: Date;
    cachedUntil: Date;
    dataFreshness: Date;
  };
}

export interface KPIDimensionValue {
  dimension: string;
  value: number;
  percentage: number;
}

export interface KPITimeSeries {
  kpiId: string;
  granularity: string;
  dataPoints: Array<{
    period: string;
    value: number;
    target?: number;
  }>;
  summary: {
    min: number;
    max: number;
    avg: number;
    total: number;
    trend: TrendDirection;
    trendStrength: number;
  };
}

export interface KPITarget {
  kpiId: string;
  period: string;
  targetValue: number;
  targetType: 'fixed' | 'growth_rate';
  createdAt: Date;
  createdBy: string;
}

export interface KPIAlert {
  kpiId: string;
  kpiName: string;
  severity: 'warning' | 'critical';
  message: string;
  currentValue: number;
  threshold: number;
  triggeredAt: Date;
}

export interface KPIInsight {
  type: 'anomaly' | 'trend' | 'correlation' | 'milestone';
  title: string;
  description: string;
  kpiIds: string[];
  significance: 'low' | 'medium' | 'high';
  data?: Record<string, unknown>;
}

export interface DashboardData {
  timestamp: Date;
  kpis: KPIValue[];
  alerts: KPIAlert[];
  insights: KPIInsight[];
}

export interface DateRange {
  start: Date;
  end: Date;
}
