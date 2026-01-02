/**
 * @module @skillancer/bi/api
 * BI API routes
 */

import type { KPIService } from '../kpi/kpi-service.js';
import type { ReportService } from '../reports/report-service.js';
import type { DateRange, Granularity } from '../kpi/types.js';

interface DateRangeQuery {
  start?: string;
  end?: string;
  granularity?: string;
  dimensions?: string;
}

function parseDateRange(start?: string, end?: string, defaultDays = 30): DateRange {
  return {
    start: new Date(start || Date.now() - defaultDays * 24 * 60 * 60 * 1000),
    end: new Date(end || Date.now()),
  };
}

export function createBIRoutes(kpiService: KPIService, reportService: ReportService) {
  // For non-Fastify usage, provide a simple router pattern
  return {
    async getKPI(kpiId: string, query: DateRangeQuery) {
      const dateRange = parseDateRange(query.start, query.end);
      return kpiService.calculateKPI(kpiId, dateRange, {
        granularity: query.granularity as Granularity | undefined,
        dimensions: query.dimensions?.split(','),
      });
    },

    async getKPITimeSeries(kpiId: string, query: DateRangeQuery) {
      const dateRange = parseDateRange(query.start, query.end, 90);
      const granularity = (query.granularity || 'daily') as Granularity;
      return kpiService.getKPITimeSeries(kpiId, dateRange, granularity);
    },

    async getBatchKPIs(kpiIds: string[], startDate: string, endDate: string) {
      const dateRange: DateRange = {
        start: new Date(startDate),
        end: new Date(endDate),
      };
      // Calculate each KPI
      return Promise.all(kpiIds.map((id) => kpiService.calculateKPI(id, dateRange)));
    },

    async getExecutiveDashboard(query: DateRangeQuery) {
      const dateRange = parseDateRange(query.start, query.end);
      return kpiService.getExecutiveDashboard(dateRange);
    },

    async getProductDashboard(product: 'skillpod' | 'market' | 'cockpit', query: DateRangeQuery) {
      const dateRange = parseDateRange(query.start, query.end);
      return kpiService.getProductDashboard(product, dateRange);
    },

    async setTarget(kpiId: string, period: string, targetValue: number, createdBy: string) {
      return kpiService.setTarget(kpiId, period, targetValue, createdBy);
    },

    async getTarget(kpiId: string, period: string) {
      return kpiService.getTarget(kpiId, period);
    },

    async generateReport(
      definitionId: string,
      startDate: string,
      endDate: string,
      format: 'pdf' | 'excel' | 'csv' | 'json' = 'pdf'
    ) {
      return reportService.generateReport({
        reportId: definitionId,
        format,
        dateRange: {
          start: new Date(startDate),
          end: new Date(endDate),
        },
      });
    },

    getReportDefinitions() {
      return reportService.getAvailableReports();
    },
  };
}
