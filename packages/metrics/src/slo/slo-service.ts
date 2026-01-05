/**
 * @fileoverview SLO Service Implementation
 *
 * Provides comprehensive SLO tracking including:
 * - SLI calculation from Prometheus metrics
 * - Error budget computation
 * - Multi-window burn rate analysis
 * - Historical tracking and reporting
 */

import { defaultSLODefinitions } from './definitions.js';

import type {
  SLODefinition,
  SLOStatusResult,
  SLOReport,
  SLOReportItem,
  SLOStatusSummary,
  ErrorBudgetValues,
  BurnRateResult,
  SLIHistoryPoint,
  PrometheusClient,
  PrometheusQueryResult,
  SLOStatus,
  ReportStatus,
} from './types.js';
import type { Logger } from 'pino';

/**
 * SLO Service for tracking and calculating Service Level Objectives
 */
export class SLOService {
  private sloDefinitions: Map<string, SLODefinition> = new Map();
  private sloGauge: Map<string, number> = new Map();
  private budgetGauge: Map<string, number> = new Map();
  private burnRateGauge: Map<string, number> = new Map();

  constructor(
    private prometheusClient: PrometheusClient,
    private logger: Logger
  ) {
    this.registerDefaultSLOs();
  }

  // ==================== SLO Registration ====================

  /**
   * Register a single SLO definition
   */
  registerSLO(definition: SLODefinition): void {
    this.sloDefinitions.set(definition.id, definition);
    this.logger.info(
      {
        sloId: definition.id,
        service: definition.service,
        target: definition.target,
      },
      'SLO registered'
    );
  }

  /**
   * Register all default SLOs
   */
  registerDefaultSLOs(): void {
    for (const slo of defaultSLODefinitions) {
      this.registerSLO(slo);
    }
    this.logger.info(
      {
        count: defaultSLODefinitions.length,
      },
      'Default SLOs registered'
    );
  }

  /**
   * Get all registered SLO definitions
   */
  getSLODefinitions(): SLODefinition[] {
    return Array.from(this.sloDefinitions.values());
  }

  /**
   * Get a specific SLO definition
   */
  getSLODefinition(sloId: string): SLODefinition | undefined {
    return this.sloDefinitions.get(sloId);
  }

  // ==================== SLO Status Calculation ====================

  /**
   * Get the current status of a specific SLO
   */
  async getSLOStatus(sloId: string): Promise<SLOStatusResult | null> {
    const definition = this.sloDefinitions.get(sloId);
    if (!definition) {
      this.logger.warn({ sloId }, 'SLO not found');
      return null;
    }

    try {
      // Calculate current SLI
      const currentSLI = await this.calculateCurrentSLI(definition);

      // Calculate error budget
      const errorBudget = this.calculateErrorBudget(definition.target, currentSLI);

      // Calculate burn rate
      const burnRate = await this.calculateBurnRate(definition);

      // Determine overall status
      const status = this.determineStatus(errorBudget.remaining, burnRate.current);

      // Calculate time to exhaustion
      const timeToExhaustion = this.calculateTimeToExhaustion(
        errorBudget.remaining,
        burnRate.current,
        definition.window.duration
      );

      // Get historical data
      const history = await this.getSLIHistory(definition, 7);

      // Update internal gauges for metrics export
      this.sloGauge.set(sloId, currentSLI);
      this.budgetGauge.set(sloId, errorBudget.remaining);
      this.burnRateGauge.set(sloId, burnRate.current);

      return {
        id: definition.id,
        name: definition.name,
        service: definition.service,
        currentSLI,
        target: definition.target,
        errorBudgetRemaining: errorBudget.remaining,
        errorBudgetConsumed: errorBudget.consumed,
        errorBudgetMinutes: errorBudget.minutes,
        currentBurnRate: burnRate.current,
        burnRateTrend: burnRate.trend,
        status,
        timeToExhaustion,
        history,
      };
    } catch (error) {
      this.logger.error(
        {
          sloId,
          error: (error as Error).message,
        },
        'Failed to get SLO status'
      );
      throw error;
    }
  }

  /**
   * Get status for all registered SLOs
   */
  async getAllSLOStatuses(): Promise<{
    slos: SLOStatusResult[];
    summary: SLOStatusSummary;
  }> {
    const slos: SLOStatusResult[] = [];
    const summary: SLOStatusSummary = {
      total: 0,
      healthy: 0,
      warning: 0,
      critical: 0,
      exhausted: 0,
    };

    for (const [id] of this.sloDefinitions) {
      try {
        const status = await this.getSLOStatus(id);
        if (status) {
          slos.push(status);
          summary.total++;
          summary[status.status]++;
        }
      } catch (error) {
        this.logger.error(
          {
            sloId: id,
            error: (error as Error).message,
          },
          'Failed to get SLO status'
        );
      }
    }

    return { slos, summary };
  }

  /**
   * Get SLO statuses for a specific service
   */
  async getServiceSLOStatuses(service: string): Promise<SLOStatusResult[]> {
    const statuses: SLOStatusResult[] = [];

    for (const [id, definition] of this.sloDefinitions) {
      if (definition.service === service) {
        const status = await this.getSLOStatus(id);
        if (status) {
          statuses.push(status);
        }
      }
    }

    return statuses;
  }

  // ==================== SLO Reporting ====================

  /**
   * Generate an SLO report for a specific time period
   */
  async getSLOReport(startDate: Date, endDate: Date): Promise<SLOReport> {
    const items: SLOReportItem[] = [];
    let met = 0;
    let missed = 0;
    let atRisk = 0;

    for (const [id, definition] of this.sloDefinitions) {
      try {
        const achieved = await this.calculateSLIForPeriod(definition, startDate, endDate);
        const errorBudgetUsed = ((definition.target - achieved) / (100 - definition.target)) * 100;

        let status: ReportStatus;
        if (achieved >= definition.target) {
          status = 'met';
          met++;
        } else if (errorBudgetUsed <= 100) {
          status = 'at_risk';
          atRisk++;
        } else {
          status = 'missed';
          missed++;
        }

        const incidents = await this.getIncidentCount(definition.service, startDate, endDate);
        const downtimeMinutes = await this.getDowntimeMinutes(
          definition.service,
          startDate,
          endDate
        );

        items.push({
          id,
          name: definition.name,
          service: definition.service,
          target: definition.target,
          achieved,
          status,
          errorBudgetUsed: Math.min(100, Math.max(0, errorBudgetUsed)),
          incidents,
          downtimeMinutes,
        });
      } catch (error) {
        this.logger.error(
          {
            sloId: id,
            error: (error as Error).message,
          },
          'Failed to calculate SLO for report'
        );
      }
    }

    return {
      period: { start: startDate, end: endDate },
      slos: items,
      summary: {
        total: items.length,
        met,
        missed,
        atRisk,
      },
    };
  }

  // ==================== SLI Calculations ====================

  /**
   * Calculate current SLI value based on the SLO definition
   */
  private async calculateCurrentSLI(definition: SLODefinition): Promise<number> {
    const windowDuration = definition.window.duration;

    try {
      if (definition.sli.goodQuery && definition.sli.totalQuery) {
        const goodQuery = this.replaceWindow(definition.sli.goodQuery, windowDuration);
        const totalQuery = this.replaceWindow(definition.sli.totalQuery, windowDuration);

        const [goodResult, totalResult] = await Promise.all([
          this.prometheusClient.query(`sum(increase(${goodQuery}))`),
          this.prometheusClient.query(`sum(increase(${totalQuery}))`),
        ]);

        const good = this.extractValue(goodResult);
        const total = this.extractValue(totalResult);

        if (total === 0) return 100;
        return (good / total) * 100;
      }

      // Custom query
      if (definition.sli.query) {
        const result = await this.prometheusClient.query(definition.sli.query);
        return this.extractValue(result);
      }

      return 100;
    } catch (error) {
      this.logger.error(
        {
          sloId: definition.id,
          error: (error as Error).message,
        },
        'Failed to calculate SLI'
      );
      return 0;
    }
  }

  /**
   * Calculate SLI for a specific time period
   */
  private async calculateSLIForPeriod(
    definition: SLODefinition,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    try {
      if (definition.sli.goodQuery && definition.sli.totalQuery) {
        const [goodResult, totalResult] = await Promise.all([
          this.prometheusClient.queryRange(
            definition.sli.goodQuery.replace('[5m]', '[1h]'),
            startDate,
            endDate,
            '1h'
          ),
          this.prometheusClient.queryRange(
            definition.sli.totalQuery.replace('[5m]', '[1h]'),
            startDate,
            endDate,
            '1h'
          ),
        ]);

        const good = this.sumRangeValues(goodResult);
        const total = this.sumRangeValues(totalResult);

        if (total === 0) return 100;
        return (good / total) * 100;
      }

      return 100;
    } catch (error) {
      this.logger.error(
        {
          sloId: definition.id,
          error: (error as Error).message,
        },
        'Failed to calculate SLI for period'
      );
      return 0;
    }
  }

  /**
   * Calculate SLI for a specific window (e.g., '1h', '6h')
   */
  private async calculateSLIForWindow(definition: SLODefinition, window: string): Promise<number> {
    if (!definition.sli.goodQuery || !definition.sli.totalQuery) return 100;

    try {
      const goodQuery = this.replaceWindow(definition.sli.goodQuery, window);
      const totalQuery = this.replaceWindow(definition.sli.totalQuery, window);

      const [goodResult, totalResult] = await Promise.all([
        this.prometheusClient.query(`sum(increase(${goodQuery}))`),
        this.prometheusClient.query(`sum(increase(${totalQuery}))`),
      ]);

      const good = this.extractValue(goodResult);
      const total = this.extractValue(totalResult);

      if (total === 0) return 100;
      return (good / total) * 100;
    } catch {
      return 100;
    }
  }

  // ==================== Error Budget Calculations ====================

  /**
   * Calculate error budget values
   */
  private calculateErrorBudget(target: number, currentSLI: number): ErrorBudgetValues {
    // Error budget is the allowed failure rate
    const errorBudgetTotal = 100 - target; // e.g., 0.1% for 99.9% target
    const errorBudgetUsed = Math.max(0, target - currentSLI);
    const consumed = errorBudgetTotal > 0 ? (errorBudgetUsed / errorBudgetTotal) * 100 : 0;
    const remaining = 100 - consumed;

    // Calculate remaining minutes (assuming 30-day window)
    const totalMinutesInWindow = 30 * 24 * 60;
    const totalErrorBudgetMinutes = (errorBudgetTotal / 100) * totalMinutesInWindow;
    const remainingMinutes = (remaining / 100) * totalErrorBudgetMinutes;

    return {
      remaining: Math.max(0, Math.min(100, remaining)),
      consumed: Math.max(0, Math.min(100, consumed)),
      minutes: Math.max(0, Math.round(remainingMinutes)),
    };
  }

  // ==================== Burn Rate Calculations ====================

  /**
   * Calculate current burn rate and trend
   */
  private async calculateBurnRate(definition: SLODefinition): Promise<BurnRateResult> {
    try {
      // Calculate burn rate over last hour
      const hourSLI = await this.calculateSLIForWindow(definition, '1h');
      const errorRate = 100 - hourSLI;
      const targetErrorRate = 100 - definition.target;
      const currentBurnRate = targetErrorRate > 0 ? errorRate / targetErrorRate : 0;

      // Calculate 6-hour burn rate for trend analysis
      const sixHourSLI = await this.calculateSLIForWindow(definition, '6h');
      const sixHourErrorRate = 100 - sixHourSLI;
      const sixHourBurnRate = targetErrorRate > 0 ? sixHourErrorRate / targetErrorRate : 0;

      // Determine trend
      let trend: 'improving' | 'stable' | 'degrading';
      if (currentBurnRate < sixHourBurnRate * 0.8) {
        trend = 'improving';
      } else if (currentBurnRate > sixHourBurnRate * 1.2) {
        trend = 'degrading';
      } else {
        trend = 'stable';
      }

      return { current: Math.max(0, currentBurnRate), trend };
    } catch (error) {
      this.logger.error(
        {
          sloId: definition.id,
          error: (error as Error).message,
        },
        'Failed to calculate burn rate'
      );
      return { current: 0, trend: 'stable' };
    }
  }

  // ==================== Status Determination ====================

  /**
   * Determine SLO status based on error budget and burn rate
   */
  private determineStatus(errorBudgetRemaining: number, burnRate: number): SLOStatus {
    if (errorBudgetRemaining <= 0) return 'exhausted';
    if (burnRate > 10 || errorBudgetRemaining < 10) return 'critical';
    if (burnRate > 5 || errorBudgetRemaining < 25) return 'warning';
    return 'healthy';
  }

  /**
   * Calculate estimated time until error budget exhaustion
   */
  private calculateTimeToExhaustion(
    errorBudgetRemaining: number,
    burnRate: number,
    windowDuration: string
  ): string | undefined {
    if (burnRate <= 1 || errorBudgetRemaining <= 0) return undefined;

    const windowMinutes = this.parseWindowToMinutes(windowDuration);
    const budgetMinutes = windowMinutes * (errorBudgetRemaining / 100);
    const minutesToExhaustion = budgetMinutes / burnRate;

    if (minutesToExhaustion < 60) {
      return `${Math.round(minutesToExhaustion)}m`;
    } else if (minutesToExhaustion < 1440) {
      return `${Math.round(minutesToExhaustion / 60)}h`;
    } else {
      const days = Math.floor(minutesToExhaustion / 1440);
      const hours = Math.round((minutesToExhaustion % 1440) / 60);
      return `${days}d ${hours}h`;
    }
  }

  // ==================== Historical Data ====================

  /**
   * Get SLI history for the past N days
   */
  private async getSLIHistory(definition: SLODefinition, days: number): Promise<SLIHistoryPoint[]> {
    const history: SLIHistoryPoint[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      try {
        const sli = await this.calculateSLIForPeriod(definition, date, endDate);
        const errorBudget = this.calculateErrorBudget(definition.target, sli);

        history.push({
          timestamp: date,
          sli,
          errorBudgetRemaining: errorBudget.remaining,
        });
      } catch {
        // Skip days with no data
      }
    }

    return history;
  }

  // ==================== Incident Tracking ====================

  /**
   * Get incident count for a service in a time period
   */
  private async getIncidentCount(service: string, startDate: Date, endDate: Date): Promise<number> {
    try {
      const query = `sum(increase(alerts_total{service="${service}",severity=~"critical|high"}[${this.getDurationString(startDate, endDate)}]))`;
      const result = await this.prometheusClient.query(query);
      return Math.round(this.extractValue(result));
    } catch {
      return 0;
    }
  }

  /**
   * Get total downtime minutes for a service
   */
  private async getDowntimeMinutes(
    service: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    try {
      const duration = this.getDurationString(startDate, endDate);
      const query = `sum(count_over_time((up{service="${service}"} == 0)[${duration}:1m]))`;
      const result = await this.prometheusClient.query(query);
      return Math.round(this.extractValue(result));
    } catch {
      return 0;
    }
  }

  // ==================== Metrics Export ====================

  /**
   * Get metrics for Prometheus scraping
   */
  getMetrics(): string {
    const lines: string[] = [
      '# HELP slo_current_sli Current SLI value',
      '# TYPE slo_current_sli gauge',
    ];

    for (const [sloId, value] of this.sloGauge) {
      const definition = this.sloDefinitions.get(sloId);
      if (definition) {
        lines.push(`slo_current_sli{slo_id="${sloId}",service="${definition.service}"} ${value}`);
      }
    }

    lines.push('# HELP slo_target SLO target value');
    lines.push('# TYPE slo_target gauge');

    for (const [sloId, definition] of this.sloDefinitions) {
      lines.push(
        `slo_target{slo_id="${sloId}",service="${definition.service}"} ${definition.target}`
      );
    }

    lines.push('# HELP slo_error_budget_remaining Remaining error budget percentage');
    lines.push('# TYPE slo_error_budget_remaining gauge');

    for (const [sloId, value] of this.budgetGauge) {
      const definition = this.sloDefinitions.get(sloId);
      if (definition) {
        lines.push(
          `slo_error_budget_remaining{slo_id="${sloId}",service="${definition.service}"} ${value}`
        );
      }
    }

    lines.push('# HELP slo_burn_rate Current error budget burn rate');
    lines.push('# TYPE slo_burn_rate gauge');

    for (const [sloId, value] of this.burnRateGauge) {
      const definition = this.sloDefinitions.get(sloId);
      if (definition) {
        lines.push(`slo_burn_rate{slo_id="${sloId}",service="${definition.service}"} ${value}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Update all SLO metrics (call periodically)
   */
  async updateMetrics(): Promise<void> {
    for (const [id] of this.sloDefinitions) {
      try {
        await this.getSLOStatus(id);
      } catch (error) {
        this.logger.error(
          {
            sloId: id,
            error: (error as Error).message,
          },
          'Failed to update SLO metrics'
        );
      }
    }
    this.logger.debug(
      {
        count: this.sloDefinitions.size,
      },
      'SLO metrics updated'
    );
  }

  // ==================== Helper Methods ====================

  private replaceWindow(query: string, window: string): string {
    return query.replace(/\[\d+[mhd]\]/g, `[${window}]`);
  }

  private parseWindowToMinutes(duration: string): number {
    const match = duration.match(/(\d+)([dhm])/);
    if (!match) return 43200; // Default 30 days

    const valueStr = match[1];
    const unit = match[2];
    if (!valueStr || !unit) return 43200; // Default 30 days

    const value = Number.parseInt(valueStr, 10);

    switch (unit) {
      case 'd':
        return value * 24 * 60;
      case 'h':
        return value * 60;
      case 'm':
        return value;
      default:
        return 43200;
    }
  }

  private getDurationString(start: Date, end: Date): string {
    const seconds = Math.ceil((end.getTime() - start.getTime()) / 1000);
    if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.ceil(seconds / 3600)}h`;
    return `${Math.ceil(seconds / 86400)}d`;
  }

  private extractValue(result: PrometheusQueryResult): number {
    if (result?.data?.result?.[0]?.value?.[1]) {
      const value = parseFloat(result.data.result[0].value[1]);
      return isNaN(value) ? 0 : value;
    }
    return 0;
  }

  private sumRangeValues(result: PrometheusQueryResult): number {
    if (!result?.data?.result?.[0]?.values) return 0;
    return result.data.result[0].values.reduce((sum: number, [, value]: [number, string]) => {
      const parsed = parseFloat(value);
      return sum + (isNaN(parsed) ? 0 : parsed);
    }, 0);
  }
}

// ==================== Factory Functions ====================

let sloServiceInstance: SLOService | null = null;

/**
 * Create a new SLO service instance
 */
export function createSLOService(prometheusClient: PrometheusClient, logger: Logger): SLOService {
  return new SLOService(prometheusClient, logger);
}

/**
 * Get or create singleton SLO service instance
 */
export function getSLOService(prometheusClient: PrometheusClient, logger: Logger): SLOService {
  if (!sloServiceInstance) {
    sloServiceInstance = new SLOService(prometheusClient, logger);
  }
  return sloServiceInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetSLOService(): void {
  sloServiceInstance = null;
}
