/**
 * @fileoverview SLO Types and Interfaces
 *
 * Defines types for Service Level Objectives (SLOs), Service Level Indicators (SLIs),
 * error budget calculations, and burn rate alerting.
 */

export type SLIType = 'availability' | 'latency' | 'throughput' | 'error_rate' | 'custom';
export type SLOStatus = 'healthy' | 'warning' | 'critical' | 'exhausted';
export type BurnRateTrend = 'improving' | 'stable' | 'degrading';
export type WindowType = 'rolling' | 'calendar';
export type ReportStatus = 'met' | 'missed' | 'at_risk';

/**
 * Service Level Indicator definition
 */
export interface SLIDefinition {
  /** Type of SLI measurement */
  type: SLIType;
  /** PromQL query for the SLI (for custom types) */
  query: string;
  /** Query for good events (for ratio-based SLIs) */
  goodQuery?: string;
  /** Query for total events (for ratio-based SLIs) */
  totalQuery?: string;
}

/**
 * Time window configuration
 */
export interface WindowConfig {
  /** Type of window (rolling or calendar-based) */
  type: WindowType;
  /** Duration of the window (e.g., '30d', '7d') */
  duration: string;
}

/**
 * Burn rate alert configuration
 */
export interface BurnRateAlert {
  /** Time window for burn rate calculation */
  window: string;
  /** Burn rate threshold */
  burnRate: number;
  /** Alert severity */
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Error budget configuration
 */
export interface ErrorBudgetConfig {
  /** Multi-window burn rate alerts */
  burnRateAlerts: {
    /** Fast burn rate (short window, high rate) */
    fast: BurnRateAlert;
    /** Slow burn rate (long window, lower rate) */
    slow: BurnRateAlert;
  };
}

/**
 * Complete SLO definition
 */
export interface SLODefinition {
  /** Unique identifier for the SLO */
  id: string;
  /** Human-readable name */
  name: string;
  /** Detailed description */
  description: string;
  /** Service this SLO applies to */
  service: string;
  /** SLI configuration */
  sli: SLIDefinition;
  /** Target percentage (e.g., 99.9 for 99.9%) */
  target: number;
  /** Time window configuration */
  window: WindowConfig;
  /** Error budget configuration */
  errorBudget: ErrorBudgetConfig;
  /** Team or individual responsible */
  owner: string;
  /** Tags for categorization */
  tags: string[];
}

/**
 * Calculated error budget values
 */
export interface ErrorBudgetValues {
  /** Percentage of error budget remaining */
  remaining: number;
  /** Percentage of error budget consumed */
  consumed: number;
  /** Remaining budget in minutes */
  minutes: number;
}

/**
 * Burn rate calculation result
 */
export interface BurnRateResult {
  /** Current burn rate multiplier */
  current: number;
  /** Trend direction */
  trend: BurnRateTrend;
}

/**
 * Historical SLI data point
 */
export interface SLIHistoryPoint {
  /** Timestamp of the measurement */
  timestamp: Date;
  /** SLI value at this point */
  sli: number;
  /** Error budget remaining at this point */
  errorBudgetRemaining: number;
}

/**
 * Current status of an SLO
 */
export interface SLOStatusResult {
  /** SLO identifier */
  id: string;
  /** SLO name */
  name: string;
  /** Service name */
  service: string;
  /** Current SLI value */
  currentSLI: number;
  /** Target SLI value */
  target: number;
  /** Remaining error budget percentage */
  errorBudgetRemaining: number;
  /** Consumed error budget percentage */
  errorBudgetConsumed: number;
  /** Remaining error budget in minutes */
  errorBudgetMinutes: number;
  /** Current burn rate */
  currentBurnRate: number;
  /** Burn rate trend */
  burnRateTrend: BurnRateTrend;
  /** Overall status */
  status: SLOStatus;
  /** Estimated time until budget exhaustion */
  timeToExhaustion?: string;
  /** Historical data */
  history: SLIHistoryPoint[];
}

/**
 * SLO report item for a specific period
 */
export interface SLOReportItem {
  /** SLO identifier */
  id: string;
  /** SLO name */
  name: string;
  /** Service name */
  service: string;
  /** Target value */
  target: number;
  /** Achieved value */
  achieved: number;
  /** Report status */
  status: ReportStatus;
  /** Percentage of error budget used */
  errorBudgetUsed: number;
  /** Number of incidents during period */
  incidents: number;
  /** Total downtime in minutes */
  downtimeMinutes: number;
}

/**
 * Complete SLO report
 */
export interface SLOReport {
  /** Report period */
  period: {
    start: Date;
    end: Date;
  };
  /** Individual SLO results */
  slos: SLOReportItem[];
  /** Summary statistics */
  summary: {
    total: number;
    met: number;
    missed: number;
    atRisk: number;
  };
}

/**
 * Summary of all SLO statuses
 */
export interface SLOStatusSummary {
  total: number;
  healthy: number;
  warning: number;
  critical: number;
  exhausted: number;
}

/**
 * Prometheus query result structure
 */
export interface PrometheusQueryResult {
  data?: {
    result?: Array<{
      value?: [number, string];
      values?: Array<[number, string]>;
    }>;
  };
}

/**
 * Prometheus client interface
 */
export interface PrometheusClient {
  query(query: string): Promise<PrometheusQueryResult>;
  queryRange(query: string, start: Date, end: Date, step: string): Promise<PrometheusQueryResult>;
}
