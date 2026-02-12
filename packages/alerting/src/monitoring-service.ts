/**
 * Monitoring & Alerting System
 * SOC 2 compliant observability infrastructure
 */

import { randomBytes } from 'crypto';

export interface Alert {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  condition: AlertCondition;
  triggerValue?: number;
  threshold: number;
  comparisonOperator: ComparisonOperator;
  window: string; // Duration like '5m', '1h'
  triggeredAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  notificationChannels: string[];
  runbook?: string;
  tags: string[];
  lastEvaluated?: Date;
  consecutiveBreaches: number;
  muteUntil?: Date;
  metadata: Record<string, unknown>;
}

export interface AlertCondition {
  metric: string;
  source: string;
  aggregation: 'avg' | 'sum' | 'min' | 'max' | 'count' | 'percentile';
  percentile?: number;
  groupBy?: string[];
  filters?: Record<string, string>;
}

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: AlertCondition;
  threshold: number;
  comparisonOperator: ComparisonOperator;
  window: string;
  severity: AlertSeverity;
  notificationChannels: string[];
  runbook?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface MetricDataPoint {
  name: string;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
  source: string;
}

export interface HealthCheck {
  id: string;
  name: string;
  type: HealthCheckType;
  target: string;
  interval: number; // seconds
  timeout: number; // seconds
  enabled: boolean;
  lastCheck?: Date;
  lastStatus?: HealthStatus;
  consecutiveFailures: number;
  alertOnFailure: boolean;
  notificationChannels: string[];
}

export interface HealthCheckResult {
  checkId: string;
  status: HealthStatus;
  responseTime?: number;
  statusCode?: number;
  message?: string;
  timestamp: Date;
}

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  panels: DashboardPanel[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  isDefault: boolean;
}

export interface DashboardPanel {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'gauge' | 'stat' | 'table' | 'alert_list';
  metrics: string[];
  aggregation: string;
  interval: string;
  position: { x: number; y: number; w: number; h: number };
}

export enum AlertSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

export enum AlertStatus {
  PENDING = 'pending',
  FIRING = 'firing',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  MUTED = 'muted',
}

export enum ComparisonOperator {
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUAL = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUAL = 'lte',
  EQUAL = 'eq',
  NOT_EQUAL = 'ne',
}

export enum HealthCheckType {
  HTTP = 'http',
  HTTPS = 'https',
  TCP = 'tcp',
  DNS = 'dns',
  POSTGRES = 'postgres',
  REDIS = 'redis',
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
}

// In-memory stores
const alerts: Map<string, Alert> = new Map();
const alertRules: Map<string, AlertRule> = new Map();
const healthChecks: Map<string, HealthCheck> = new Map();
const healthCheckResults: HealthCheckResult[] = [];
const metricData: MetricDataPoint[] = [];
const dashboards: Map<string, Dashboard> = new Map();

// Severity to response time SLA (minutes)
const RESPONSE_SLA: Record<AlertSeverity, number> = {
  [AlertSeverity.CRITICAL]: 5,
  [AlertSeverity.HIGH]: 15,
  [AlertSeverity.MEDIUM]: 60,
  [AlertSeverity.LOW]: 240,
  [AlertSeverity.INFO]: 1440,
};

export class MonitoringService {
  constructor() {
    this.initializeDefaultRules();
    this.initializeHealthChecks();
    this.initializeDefaultDashboard();
  }

  // ==================== Metrics ====================

  /**
   * Record a metric data point
   */
  recordMetric(
    name: string,
    value: number,
    tags: Record<string, string> = {},
    source: string = 'application'
  ): void {
    metricData.push({
      name,
      value,
      timestamp: new Date(),
      tags,
      source,
    });

    // Keep only last 1M data points in memory
    if (metricData.length > 1000000) {
      metricData.shift();
    }

    // Check alert rules
    this.evaluateRules(name, value, tags);
  }

  /**
   * Query metrics
   */
  queryMetrics(
    name: string,
    startTime: Date,
    endTime: Date,
    aggregation: 'avg' | 'sum' | 'min' | 'max' | 'count' = 'avg',
    interval: string = '1m',
    tags?: Record<string, string>
  ): { timestamp: Date; value: number }[] {
    let filtered = metricData.filter(
      (m) => m.name === name && m.timestamp >= startTime && m.timestamp <= endTime
    );

    if (tags) {
      filtered = filtered.filter((m) => Object.entries(tags).every(([k, v]) => m.tags[k] === v));
    }

    // Simple aggregation by interval
    const intervalMs = this.parseInterval(interval);
    const buckets: Map<number, number[]> = new Map();

    for (const point of filtered) {
      const bucketTime = Math.floor(point.timestamp.getTime() / intervalMs) * intervalMs;
      if (!buckets.has(bucketTime)) {
        buckets.set(bucketTime, []);
      }
      buckets.get(bucketTime)!.push(point.value);
    }

    const results: { timestamp: Date; value: number }[] = [];
    for (const [time, values] of buckets.entries()) {
      let aggregatedValue: number;
      switch (aggregation) {
        case 'sum':
          aggregatedValue = values.reduce((a, b) => a + b, 0);
          break;
        case 'min':
          aggregatedValue = Math.min(...values);
          break;
        case 'max':
          aggregatedValue = Math.max(...values);
          break;
        case 'count':
          aggregatedValue = values.length;
          break;
        case 'avg':
        default:
          aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
      }
      results.push({ timestamp: new Date(time), value: aggregatedValue });
    }

    return results.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  // ==================== Alerts ====================

  /**
   * Create an alert rule
   */
  createAlertRule(
    rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>
  ): AlertRule {
    const id = `rule_${randomBytes(8).toString('hex')}`;

    const alertRule: AlertRule = {
      ...rule,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    alertRules.set(id, alertRule);
    return alertRule;
  }

  /**
   * Fire an alert
   */
  fireAlert(rule: AlertRule, triggerValue: number): Alert {
    const id = `alert_${Date.now()}_${randomBytes(4).toString('hex')}`;

    // Check for existing active alert for this rule
    const existing = Array.from(alerts.values()).find(
      (a) => a.name === rule.name && a.status === AlertStatus.FIRING
    );

    if (existing) {
      existing.triggerValue = triggerValue;
      existing.consecutiveBreaches++;
      existing.lastEvaluated = new Date();
      alerts.set(existing.id, existing);
      return existing;
    }

    const alert: Alert = {
      id,
      name: rule.name,
      description: `Alert triggered: ${rule.condition.metric} ${rule.comparisonOperator} ${rule.threshold}`,
      severity: rule.severity,
      status: AlertStatus.FIRING,
      condition: rule.condition,
      triggerValue,
      threshold: rule.threshold,
      comparisonOperator: rule.comparisonOperator,
      window: rule.window,
      triggeredAt: new Date(),
      notificationChannels: rule.notificationChannels,
      ...(rule.runbook !== undefined && { runbook: rule.runbook }),
      tags: rule.tags,
      lastEvaluated: new Date(),
      consecutiveBreaches: 1,
      metadata: {},
    };

    alerts.set(id, alert);

    // Send notifications
    this.notifyAlert(alert);

    console.log(`[ALERT] Fired ${id}: ${alert.name} (${alert.severity})`);

    return alert;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): Alert | null {
    const alert = alerts.get(alertId);
    if (!alert) return null;

    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    alerts.set(alertId, alert);
    return alert;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string, resolvedBy: string = 'system'): Alert | null {
    const alert = alerts.get(alertId);
    if (!alert) return null;

    alert.status = AlertStatus.RESOLVED;
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy;

    alerts.set(alertId, alert);
    return alert;
  }

  /**
   * Mute an alert
   */
  muteAlert(alertId: string, duration: string): Alert | null {
    const alert = alerts.get(alertId);
    if (!alert) return null;

    const durationMs = this.parseInterval(duration);
    alert.status = AlertStatus.MUTED;
    alert.muteUntil = new Date(Date.now() + durationMs);

    alerts.set(alertId, alert);
    return alert;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(severity?: AlertSeverity): Alert[] {
    let active = Array.from(alerts.values()).filter(
      (a) => a.status === AlertStatus.FIRING || a.status === AlertStatus.ACKNOWLEDGED
    );

    if (severity) {
      active = active.filter((a) => a.severity === severity);
    }

    return active.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Get alert history
   */
  getAlertHistory(startDate: Date, endDate: Date): Alert[] {
    return Array.from(alerts.values()).filter(
      (a) => a.triggeredAt && a.triggeredAt >= startDate && a.triggeredAt <= endDate
    );
  }

  // ==================== Health Checks ====================

  /**
   * Create a health check
   */
  createHealthCheck(
    check: Omit<HealthCheck, 'id' | 'lastCheck' | 'consecutiveFailures'>
  ): HealthCheck {
    const id = `hc_${randomBytes(8).toString('hex')}`;

    const healthCheck: HealthCheck = {
      ...check,
      id,
      consecutiveFailures: 0,
    };

    healthChecks.set(id, healthCheck);
    return healthCheck;
  }

  /**
   * Run a health check
   */
  async runHealthCheck(checkId: string): Promise<HealthCheckResult> {
    const check = healthChecks.get(checkId);
    if (!check) throw new Error('Health check not found');

    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      // Simulate health check execution
      const { status, statusCode, message } = await this.executeHealthCheck(check);

      result = {
        checkId,
        status,
        responseTime: Date.now() - startTime,
        ...(statusCode !== undefined && { statusCode }),
        ...(message !== undefined && { message }),
        timestamp: new Date(),
      };

      if (status === HealthStatus.HEALTHY) {
        check.consecutiveFailures = 0;
      } else {
        check.consecutiveFailures++;
      }
    } catch (error) {
      result = {
        checkId,
        status: HealthStatus.UNHEALTHY,
        responseTime: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
      check.consecutiveFailures++;
    }

    check.lastCheck = result.timestamp;
    check.lastStatus = result.status;
    healthChecks.set(checkId, check);
    healthCheckResults.push(result);

    // Keep only last 10000 results
    if (healthCheckResults.length > 10000) {
      healthCheckResults.shift();
    }

    // Alert if failing
    if (check.alertOnFailure && check.consecutiveFailures >= 3) {
      this.fireAlert(
        {
          id: `rule_hc_${checkId}`,
          name: `Health Check Failed: ${check.name}`,
          enabled: true,
          condition: { metric: 'health_check', source: check.target, aggregation: 'count' },
          threshold: 1,
          comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL,
          window: '5m',
          severity: AlertSeverity.HIGH,
          notificationChannels: check.notificationChannels,
          tags: ['health-check'],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'system',
        },
        check.consecutiveFailures
      );
    }

    return result;
  }

  /**
   * Get system health overview
   */
  getSystemHealth(): {
    status: HealthStatus;
    components: { name: string; status: HealthStatus; lastCheck?: Date }[];
    uptime: number;
    activeAlerts: number;
  } {
    const checks = Array.from(healthChecks.values());
    const components = checks.map((c) => ({
      name: c.name,
      status: c.lastStatus || HealthStatus.UNKNOWN,
      ...(c.lastCheck !== undefined && { lastCheck: c.lastCheck }),
    }));

    // Overall status is the worst component status
    let overallStatus = HealthStatus.HEALTHY;
    for (const comp of components) {
      if (comp.status === HealthStatus.UNHEALTHY) {
        overallStatus = HealthStatus.UNHEALTHY;
        break;
      } else if (comp.status === HealthStatus.DEGRADED) {
        overallStatus = HealthStatus.DEGRADED;
      }
    }

    const activeAlerts = this.getActiveAlerts().length;

    return {
      status: overallStatus,
      components,
      uptime: process.uptime(),
      activeAlerts,
    };
  }

  // ==================== Dashboards ====================

  /**
   * Get dashboard by ID
   */
  getDashboard(id: string): Dashboard | null {
    return dashboards.get(id) || null;
  }

  /**
   * Get all dashboards
   */
  getDashboards(): Dashboard[] {
    return Array.from(dashboards.values());
  }

  // ==================== Metrics Summary ====================

  /**
   * Get monitoring metrics for compliance
   */
  getComplianceMetrics(
    startDate: Date,
    endDate: Date
  ): {
    totalAlerts: number;
    alertsByStatus: Record<string, number>;
    alertsBySeverity: Record<string, number>;
    mttr: number; // Mean time to resolve (minutes)
    mtta: number; // Mean time to acknowledge (minutes)
    slaCompliance: number;
    uptimePercentage: number;
    healthCheckPassRate: number;
  } {
    const history = this.getAlertHistory(startDate, endDate);

    const alertsByStatus: Record<string, number> = {};
    const alertsBySeverity: Record<string, number> = {};
    let totalResolveTime = 0;
    let totalAckTime = 0;
    let resolvedCount = 0;
    let ackedCount = 0;
    let slaCompliant = 0;

    for (const alert of history) {
      alertsByStatus[alert.status] = (alertsByStatus[alert.status] || 0) + 1;
      alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;

      if (alert.resolvedAt && alert.triggeredAt) {
        const resolveTime = (alert.resolvedAt.getTime() - alert.triggeredAt.getTime()) / 60000;
        totalResolveTime += resolveTime;
        resolvedCount++;
      }

      if (alert.acknowledgedAt && alert.triggeredAt) {
        const ackTime = (alert.acknowledgedAt.getTime() - alert.triggeredAt.getTime()) / 60000;
        totalAckTime += ackTime;
        ackedCount++;

        if (ackTime <= RESPONSE_SLA[alert.severity]) {
          slaCompliant++;
        }
      }
    }

    // Calculate uptime from health check results
    const hcResults = healthCheckResults.filter(
      (r) => r.timestamp >= startDate && r.timestamp <= endDate
    );
    const healthyResults = hcResults.filter((r) => r.status === HealthStatus.HEALTHY);

    return {
      totalAlerts: history.length,
      alertsByStatus,
      alertsBySeverity,
      mttr: resolvedCount > 0 ? Math.round(totalResolveTime / resolvedCount) : 0,
      mtta: ackedCount > 0 ? Math.round(totalAckTime / ackedCount) : 0,
      slaCompliance: ackedCount > 0 ? Math.round((slaCompliant / ackedCount) * 100) : 100,
      uptimePercentage:
        hcResults.length > 0
          ? Math.round((healthyResults.length / hcResults.length) * 100 * 100) / 100
          : 100,
      healthCheckPassRate:
        hcResults.length > 0 ? Math.round((healthyResults.length / hcResults.length) * 100) : 100,
    };
  }

  // Private helpers

  private parseInterval(interval: string): number {
    const match = interval.match(/^(\d+)([smhd])$/);
    if (!match || !match[1] || !match[2]) return 60000; // Default 1 minute

    const value = Number.parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 60000;
    }
  }

  private evaluateRules(
    metricName: string,
    value: number,
    _tags: Record<string, string>
  ): void {
    for (const rule of alertRules.values()) {
      if (!rule.enabled || rule.condition.metric !== metricName) continue;

      let shouldFire = false;
      switch (rule.comparisonOperator) {
        case ComparisonOperator.GREATER_THAN:
          shouldFire = value > rule.threshold;
          break;
        case ComparisonOperator.GREATER_THAN_OR_EQUAL:
          shouldFire = value >= rule.threshold;
          break;
        case ComparisonOperator.LESS_THAN:
          shouldFire = value < rule.threshold;
          break;
        case ComparisonOperator.LESS_THAN_OR_EQUAL:
          shouldFire = value <= rule.threshold;
          break;
        case ComparisonOperator.EQUAL:
          shouldFire = value === rule.threshold;
          break;
        case ComparisonOperator.NOT_EQUAL:
          shouldFire = value !== rule.threshold;
          break;
      }

      if (shouldFire) {
        this.fireAlert(rule, value);
      }
    }
  }

  private async executeHealthCheck(_check: HealthCheck): Promise<{
    status: HealthStatus;
    statusCode?: number;
    message?: string;
  }> {
    // Simulate health check execution
    await new Promise((resolve) => setTimeout(resolve, 50));

    // In production, implement actual health checks
    return { status: HealthStatus.HEALTHY, statusCode: 200, message: 'OK' };
  }

  private notifyAlert(alert: Alert): void {
    // In production, integrate with notification service
    console.log(`[ALERT NOTIFY] ${alert.severity.toUpperCase()}: ${alert.name}`);
  }

  private initializeDefaultRules(): void {
    const defaultRules: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'High Error Rate',
        enabled: true,
        condition: { metric: 'http_errors_5xx', source: 'api-gateway', aggregation: 'count' },
        threshold: 10,
        comparisonOperator: ComparisonOperator.GREATER_THAN,
        window: '5m',
        severity: AlertSeverity.HIGH,
        notificationChannels: ['webhook-alerts', 'pagerduty'],
        runbook: 'docs/runbooks/high-error-rate.md',
        tags: ['api', 'errors'],
        createdBy: 'system',
      },
      {
        name: 'High Response Latency',
        enabled: true,
        condition: { metric: 'http_response_time_p99', source: 'api-gateway', aggregation: 'avg' },
        threshold: 2000,
        comparisonOperator: ComparisonOperator.GREATER_THAN,
        window: '5m',
        severity: AlertSeverity.MEDIUM,
        notificationChannels: ['webhook-alerts'],
        runbook: 'docs/runbooks/high-latency.md',
        tags: ['api', 'latency'],
        createdBy: 'system',
      },
      {
        name: 'Database Connection Pool Exhausted',
        enabled: true,
        condition: { metric: 'db_pool_available', source: 'database', aggregation: 'min' },
        threshold: 5,
        comparisonOperator: ComparisonOperator.LESS_THAN,
        window: '1m',
        severity: AlertSeverity.CRITICAL,
        notificationChannels: ['webhook-alerts', 'pagerduty', 'sms'],
        runbook: 'docs/runbooks/db-pool-exhausted.md',
        tags: ['database', 'connections'],
        createdBy: 'system',
      },
      {
        name: 'High Memory Usage',
        enabled: true,
        condition: { metric: 'memory_usage_percent', source: 'system', aggregation: 'avg' },
        threshold: 90,
        comparisonOperator: ComparisonOperator.GREATER_THAN,
        window: '5m',
        severity: AlertSeverity.HIGH,
        notificationChannels: ['webhook-alerts'],
        tags: ['infrastructure', 'memory'],
        createdBy: 'system',
      },
      {
        name: 'Failed Login Attempts',
        enabled: true,
        condition: { metric: 'auth_login_failed', source: 'auth-svc', aggregation: 'count' },
        threshold: 100,
        comparisonOperator: ComparisonOperator.GREATER_THAN,
        window: '15m',
        severity: AlertSeverity.HIGH,
        notificationChannels: ['webhook-security', 'pagerduty'],
        runbook: 'docs/runbooks/brute-force-attack.md',
        tags: ['security', 'authentication'],
        createdBy: 'system',
      },
    ];

    for (const rule of defaultRules) {
      const id = `rule_${randomBytes(8).toString('hex')}`;
      alertRules.set(id, {
        ...rule,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  private initializeHealthChecks(): void {
    const defaultChecks: Omit<HealthCheck, 'id' | 'lastCheck' | 'consecutiveFailures'>[] = [
      {
        name: 'API Gateway',
        type: HealthCheckType.HTTPS,
        target: 'https://api.skillancer.com/health',
        interval: 30,
        timeout: 10,
        enabled: true,
        alertOnFailure: true,
        notificationChannels: ['webhook-alerts', 'pagerduty'],
      },
      {
        name: 'PostgreSQL Primary',
        type: HealthCheckType.POSTGRES,
        target: 'postgresql://...',
        interval: 60,
        timeout: 5,
        enabled: true,
        alertOnFailure: true,
        notificationChannels: ['webhook-alerts', 'pagerduty'],
      },
      {
        name: 'Redis Cache',
        type: HealthCheckType.REDIS,
        target: 'redis://...',
        interval: 30,
        timeout: 5,
        enabled: true,
        alertOnFailure: true,
        notificationChannels: ['webhook-alerts'],
      },
      {
        name: 'Auth Service',
        type: HealthCheckType.HTTPS,
        target: 'https://auth.skillancer.com/health',
        interval: 30,
        timeout: 10,
        enabled: true,
        alertOnFailure: true,
        notificationChannels: ['webhook-alerts', 'pagerduty'],
      },
    ];

    for (const check of defaultChecks) {
      const id = `hc_${randomBytes(8).toString('hex')}`;
      healthChecks.set(id, {
        ...check,
        id,
        consecutiveFailures: 0,
      });
    }
  }

  private initializeDefaultDashboard(): void {
    dashboards.set('default', {
      id: 'default',
      name: 'System Overview',
      description: 'Main monitoring dashboard',
      panels: [
        {
          id: 'p1',
          title: 'Request Rate',
          type: 'line',
          metrics: ['http_requests_total'],
          aggregation: 'sum',
          interval: '1m',
          position: { x: 0, y: 0, w: 6, h: 4 },
        },
        {
          id: 'p2',
          title: 'Error Rate',
          type: 'line',
          metrics: ['http_errors_5xx'],
          aggregation: 'sum',
          interval: '1m',
          position: { x: 6, y: 0, w: 6, h: 4 },
        },
        {
          id: 'p3',
          title: 'Response Time P99',
          type: 'line',
          metrics: ['http_response_time_p99'],
          aggregation: 'avg',
          interval: '1m',
          position: { x: 0, y: 4, w: 6, h: 4 },
        },
        {
          id: 'p4',
          title: 'Active Alerts',
          type: 'alert_list',
          metrics: [],
          aggregation: 'count',
          interval: '1m',
          position: { x: 6, y: 4, w: 6, h: 4 },
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      isDefault: true,
    });
  }
}

export const monitoringService = new MonitoringService();
