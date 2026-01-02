/**
 * @module @skillancer/integration-hub-svc/monitoring/alerts
 * Integration Alerts - Monitor and alert on integration issues
 */

import { integrationMetrics } from './integration-metrics.js';

export interface AlertCondition {
  id: string;
  name: string;
  check: () => boolean;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export interface Alert {
  id: string;
  conditionId: string;
  name: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggeredAt: Date;
  acknowledged: boolean;
}

export class IntegrationAlerts {
  private conditions: AlertCondition[] = [];
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];

  constructor() {
    this.registerDefaultConditions();
  }

  /**
   * Register default alert conditions
   */
  private registerDefaultConditions(): void {
    // Provider error rate > 5%
    this.registerCondition({
      id: 'provider-error-rate',
      name: 'High Provider Error Rate',
      severity: 'warning',
      message: 'Provider error rate exceeds 5%',
      check: () => {
        const providers = ['github', 'gitlab', 'quickbooks', 'xero', 'stripe', 'plaid'];
        return providers.some((p) => {
          const rate = integrationMetrics.getProviderSuccessRate(p);
          return rate < 95;
        });
      },
    });

    // Cache hit rate < 80%
    this.registerCondition({
      id: 'low-cache-hit-rate',
      name: 'Low Cache Hit Rate',
      severity: 'info',
      message: 'Cache hit rate below 80%',
      check: () => integrationMetrics.getCacheHitRate() < 80,
    });

    // High latency > 2s
    this.registerCondition({
      id: 'high-latency',
      name: 'High API Latency',
      severity: 'warning',
      message: 'Average API latency exceeds 2 seconds',
      check: () => {
        const providers = ['github', 'gitlab', 'quickbooks', 'xero', 'stripe', 'plaid'];
        return providers.some((p) => {
          const latency = integrationMetrics.getProviderLatency(p);
          return latency && latency.avg > 2000;
        });
      },
    });
  }

  /**
   * Register an alert condition
   */
  registerCondition(condition: AlertCondition): void {
    this.conditions.push(condition);
  }

  /**
   * Check all conditions and trigger/resolve alerts
   */
  evaluate(): Alert[] {
    const triggered: Alert[] = [];

    for (const condition of this.conditions) {
      try {
        const isTriggered = condition.check();
        const existingAlert = this.activeAlerts.get(condition.id);

        if (isTriggered && !existingAlert) {
          // Trigger new alert
          const alert: Alert = {
            id: `${condition.id}-${Date.now()}`,
            conditionId: condition.id,
            name: condition.name,
            severity: condition.severity,
            message: condition.message,
            triggeredAt: new Date(),
            acknowledged: false,
          };
          this.activeAlerts.set(condition.id, alert);
          this.alertHistory.push(alert);
          triggered.push(alert);
        } else if (!isTriggered && existingAlert) {
          // Resolve alert
          this.activeAlerts.delete(condition.id);
        }
      } catch (error) {
        console.error(`Error evaluating condition ${condition.id}:`, error);
      }
    }

    return triggered;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(conditionId: string): boolean {
    const alert = this.activeAlerts.get(conditionId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Get alert history
   */
  getHistory(limit = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Get alerts by severity
   */
  getBySeverity(severity: 'info' | 'warning' | 'critical'): Alert[] {
    return this.getActiveAlerts().filter((a) => a.severity === severity);
  }

  /**
   * Get summary for dashboard
   */
  getSummary(): {
    total: number;
    critical: number;
    warning: number;
    info: number;
    unacknowledged: number;
  } {
    const active = this.getActiveAlerts();
    return {
      total: active.length,
      critical: active.filter((a) => a.severity === 'critical').length,
      warning: active.filter((a) => a.severity === 'warning').length,
      info: active.filter((a) => a.severity === 'info').length,
      unacknowledged: active.filter((a) => !a.acknowledged).length,
    };
  }

  /**
   * Clear all alerts (for testing)
   */
  clearAll(): void {
    this.activeAlerts.clear();
    this.alertHistory = [];
  }
}

export const integrationAlerts = new IntegrationAlerts();
