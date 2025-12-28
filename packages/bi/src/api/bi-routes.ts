/**
 * @module @skillancer/bi/api
 * BI API routes
 */

import type { KPIService } from '../kpi/kpi-service.js';
import type { ReportService } from '../reports/report-service.js';
import type { FastifyInstance } from 'fastify';

interface DateRangeQuery {
  start?: string;
  end?: string;
  granularity?: string;
  dimensions?: string;
}

interface KPIParams {
  kpiId: string;
}

interface DashboardParams {
  category: string;
}

interface _TargetParams {
  kpiId: string;
  period?: string;
}

export function createBIRoutes(kpiService: KPIService, reportService: ReportService) {
  return async function biRoutes(app: FastifyInstance): Promise<void> {
    // Get single KPI value
    app.get<{ Params: KPIParams; Querystring: DateRangeQuery }>(
      '/kpis/:kpiId',
      {
        schema: {
          tags: ['bi', 'kpi'],
          summary: 'Get KPI value',
          params: {
            type: 'object',
            properties: { kpiId: { type: 'string' } },
            required: ['kpiId'],
          },
        },
      },
      async (request, _reply) => {
        const { kpiId } = request.params;
        const { start, end, granularity, dimensions } = request.query;

        return kpiService.calculateKPI(
          kpiId,
          new Date(start || Date.now() - 30 * 24 * 60 * 60 * 1000),
          new Date(end || Date.now()),
          granularity,
          dimensions?.split(',')
        );
      }
    );

    // Get KPI time series
    app.get<{ Params: KPIParams; Querystring: DateRangeQuery }>(
      '/kpis/:kpiId/timeseries',
      {
        schema: {
          tags: ['bi', 'kpi'],
          summary: 'Get KPI time series',
        },
      },
      async (request, _reply) => {
        const { kpiId } = request.params;
        const { start, end, granularity } = request.query;

        return kpiService.getKPITimeSeries(
          kpiId,
          new Date(start || Date.now() - 90 * 24 * 60 * 60 * 1000),
          new Date(end || Date.now()),
          granularity || 'daily'
        );
      }
    );

    // Batch KPIs
    app.post<{ Body: { kpiIds: string[]; startDate: string; endDate: string } }>(
      '/kpis/batch',
      {
        schema: {
          tags: ['bi', 'kpi'],
          summary: 'Get multiple KPI values',
        },
      },
      async (request, _reply) => {
        const { kpiIds, startDate, endDate } = request.body;
        return kpiService.calculateMultipleKPIs(kpiIds, new Date(startDate), new Date(endDate));
      }
    );

    // Executive dashboard
    app.get<{ Querystring: DateRangeQuery }>(
      '/dashboards/executive',
      {
        schema: {
          tags: ['bi', 'dashboard'],
          summary: 'Get executive dashboard',
        },
      },
      async (request, _reply) => {
        const { start, end } = request.query;
        return kpiService.getExecutiveDashboard(
          new Date(start || Date.now() - 30 * 24 * 60 * 60 * 1000),
          new Date(end || Date.now())
        );
      }
    );

    // Category dashboard
    app.get<{ Params: DashboardParams; Querystring: DateRangeQuery }>(
      '/dashboards/:category',
      {
        schema: {
          tags: ['bi', 'dashboard'],
          summary: 'Get category dashboard',
        },
      },
      async (request, _reply) => {
        const { category } = request.params;
        const { start, end } = request.query;
        return kpiService.getCategoryDashboard(
          category,
          new Date(start || Date.now() - 30 * 24 * 60 * 60 * 1000),
          new Date(end || Date.now())
        );
      }
    );

    // Set KPI target
    app.post<{
      Params: { kpiId: string };
      Body: { period: string; targetValue: number; targetType: 'fixed' | 'growth_rate' };
    }>(
      '/kpis/:kpiId/targets',
      {
        schema: {
          tags: ['bi', 'targets'],
          summary: 'Set KPI target',
        },
      },
      async (request, _reply) => {
        const { kpiId } = request.params;
        const { period, targetValue, targetType } = request.body;
        return kpiService.setKPITarget(kpiId, period, targetValue, targetType, 'system');
      }
    );

    // Get alerts
    app.get<{ Querystring: { kpiIds?: string } }>(
      '/alerts',
      {
        schema: {
          tags: ['bi', 'alerts'],
          summary: 'Get active alerts',
        },
      },
      async (request, _reply) => {
        const { kpiIds } = request.query;
        return kpiService.getActiveAlerts(kpiIds?.split(','));
      }
    );

    // Get insights
    app.get<{ Querystring: DateRangeQuery & { kpiIds: string } }>(
      '/insights',
      {
        schema: {
          tags: ['bi', 'insights'],
          summary: 'Get KPI insights',
        },
      },
      async (request, _reply) => {
        const { kpiIds, start, end } = request.query;
        return kpiService.generateInsights(
          kpiIds.split(','),
          new Date(start || Date.now() - 30 * 24 * 60 * 60 * 1000),
          new Date(end || Date.now())
        );
      }
    );

    // Generate report
    app.post<{ Body: { definitionId: string; startDate: string; endDate: string } }>(
      '/reports/generate',
      {
        schema: {
          tags: ['bi', 'reports'],
          summary: 'Generate report',
        },
      },
      async (request, _reply) => {
        const { definitionId, startDate, endDate } = request.body;
        return reportService.generateReport(definitionId, new Date(startDate), new Date(endDate));
      }
    );

    // List reports
    app.get<{ Querystring: { limit?: string; offset?: string } }>(
      '/reports',
      {
        schema: {
          tags: ['bi', 'reports'],
          summary: 'List generated reports',
        },
      },
      async (request, _reply) => {
        const { limit, offset } = request.query;
        return reportService.listReports(parseInt(limit || '20'), parseInt(offset || '0'));
      }
    );
  };
}
