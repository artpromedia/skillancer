/**
 * @fileoverview Type definitions for the metrics package
 */

import type { StandardUnit } from '@aws-sdk/client-cloudwatch';

/**
 * Configuration for the MetricsService
 */
export interface MetricConfig {
  /**
   * CloudWatch namespace for metrics (e.g., 'Skillancer/Services')
   */
  namespace: string;

  /**
   * Service name for default dimensions
   */
  serviceName: string;

  /**
   * Environment name (e.g., 'production', 'staging', 'development')
   */
  environment: string;

  /**
   * AWS region (defaults to AWS_REGION env var or us-east-1)
   */
  region?: string | undefined;

  /**
   * Interval in milliseconds for automatic metric flushing (default: 60000)
   */
  flushIntervalMs?: number | undefined;

  /**
   * Maximum number of metrics to buffer before auto-flush (default: 20)
   */
  maxBufferSize?: number | undefined;

  /**
   * Enable debug logging (default: false)
   */
  debug?: boolean | undefined;

  /**
   * Skip actual CloudWatch calls (for testing) (default: false)
   */
  dryRun?: boolean | undefined;
}

/**
 * Individual metric data point
 */
export interface MetricData {
  /**
   * Metric name
   */
  name: string;

  /**
   * Metric value
   */
  value: number;

  /**
   * Unit of measurement (default: Count)
   */
  unit?: StandardUnit | undefined;

  /**
   * Additional dimensions for this metric
   */
  dimensions?: Record<string, string> | undefined;

  /**
   * Timestamp for the metric (defaults to now)
   */
  timestamp?: Date | undefined;
}

/**
 * CloudWatch dimension
 */
export interface MetricDimension {
  /**
   * Dimension name
   */
  Name: string;

  /**
   * Dimension value
   */
  Value: string;
}

/**
 * Buffered metric ready for CloudWatch
 */
export interface BufferedMetric {
  /**
   * Metric name
   */
  MetricName: string;

  /**
   * Metric value
   */
  Value: number;

  /**
   * Unit of measurement
   */
  Unit: StandardUnit;

  /**
   * Metric dimensions
   */
  Dimensions: MetricDimension[];

  /**
   * Timestamp
   */
  Timestamp: Date;
}

/**
 * SLO (Service Level Objective) configuration
 */
export interface SLOConfig {
  /**
   * SLO name
   */
  name: string;

  /**
   * Target percentage (e.g., 99.9)
   */
  target: number;

  /**
   * Window in days for SLO calculation
   */
  windowDays: number;

  /**
   * Metric to use for SLI calculation
   */
  metric: string;

  /**
   * Threshold value for the metric
   */
  threshold?: number | undefined;
}

/**
 * Export StandardUnit for external use
 */
export { StandardUnit } from '@aws-sdk/client-cloudwatch';
