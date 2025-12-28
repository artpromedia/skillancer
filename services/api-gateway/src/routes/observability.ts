/**
 * @module @skillancer/api-gateway/routes/observability
 * Observability and SLO tracking routes
 */

import {
  getSLOService,
  defaultSLOs,
  type SLOStatusResult,
  type SLOReport,
} from '@skillancer/metrics';

import { getConfig } from '../config/index.js';

import type { FastifyInstance } from 'fastify';

interface SLOStatusParams {
  sloId?: string;
}

interface SLOReportQuery {
  period?: string;
  services?: string;
  tags?: string;
}

interface DashboardInfo {
  uid: string;
  title: string;
  url: string;
  description: string;
  tags: string[];
}

interface SLOStatusResponse {
  timestamp: string;
  slos: SLOStatusResult[];
  summary: {
    total: number;
    healthy: number;
    warning: number;
    breached: number;
    healthRate: number;
  };
}

/**
 * Register observability routes
 */
export function observabilityRoutes(
  app: FastifyInstance,
  _opts: Record<string, never>,
  done: (err?: Error) => void
): void {
  const _config = getConfig();
  const sloService = getSLOService();

  // Register default SLOs on startup
  for (const slo of defaultSLOs) {
    sloService.registerSLO(slo);
  }

  /**
   * Get all SLO statuses
   */
  app.get<{ Params: SLOStatusParams; Querystring: { service?: string } }>(
    '/api/slo/status',
    {
      schema: {
        tags: ['observability', 'slo'],
        summary: 'Get SLO status',
        description: 'Returns the current status of all SLOs or a specific SLO',
        querystring: {
          type: 'object',
          properties: {
            service: { type: 'string', description: 'Filter by service name' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              timestamp: { type: 'string' },
              slos: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    sloId: { type: 'string' },
                    name: { type: 'string' },
                    service: { type: 'string' },
                    currentSLI: { type: 'number' },
                    target: { type: 'number' },
                    status: { type: 'string' },
                    errorBudget: {
                      type: 'object',
                      properties: {
                        total: { type: 'number' },
                        consumed: { type: 'number' },
                        remaining: { type: 'number' },
                        consumedPercent: { type: 'number' },
                        remainingPercent: { type: 'number' },
                      },
                    },
                    burnRate: {
                      type: 'object',
                      properties: {
                        fastWindow: { type: 'number' },
                        slowWindow: { type: 'number' },
                        isAlerting: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
              summary: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  healthy: { type: 'number' },
                  warning: { type: 'number' },
                  breached: { type: 'number' },
                  healthRate: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request, _reply): Promise<SLOStatusResponse> => {
      const { service } = request.query;

      let statuses = await sloService.getAllSLOStatuses();

      // Filter by service if specified
      if (service) {
        statuses = statuses.filter((s) => s.service === service);
      }

      const summary = {
        total: statuses.length,
        healthy: statuses.filter((s) => s.status === 'healthy').length,
        warning: statuses.filter((s) => s.status === 'warning').length,
        breached: statuses.filter((s) => s.status === 'breached').length,
        healthRate: 0,
      };
      summary.healthRate = summary.total > 0 ? (summary.healthy / summary.total) * 100 : 100;

      return {
        timestamp: new Date().toISOString(),
        slos: statuses,
        summary,
      };
    }
  );

  /**
   * Get specific SLO status
   */
  app.get<{ Params: { sloId: string } }>(
    '/api/slo/status/:sloId',
    {
      schema: {
        tags: ['observability', 'slo'],
        summary: 'Get specific SLO status',
        description: 'Returns the current status of a specific SLO',
        params: {
          type: 'object',
          properties: {
            sloId: { type: 'string', description: 'SLO identifier' },
          },
          required: ['sloId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              sloId: { type: 'string' },
              name: { type: 'string' },
              service: { type: 'string' },
              currentSLI: { type: 'number' },
              target: { type: 'number' },
              status: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    async (request, reply): Promise<SLOStatusResult | { error: string; message: string }> => {
      const { sloId } = request.params;

      const status = await sloService.getSLOStatus(sloId);

      if (!status) {
        void reply.status(404);
        return {
          error: 'SLO_NOT_FOUND',
          message: `SLO with ID '${sloId}' not found`,
        };
      }

      return status;
    }
  );

  /**
   * Generate SLO report
   */
  app.get<{ Querystring: SLOReportQuery }>(
    '/api/slo/report',
    {
      schema: {
        tags: ['observability', 'slo'],
        summary: 'Generate SLO report',
        description: 'Generates a comprehensive SLO report for the specified period',
        querystring: {
          type: 'object',
          properties: {
            period: {
              type: 'string',
              enum: ['1h', '6h', '24h', '7d', '30d'],
              default: '24h',
              description: 'Report period',
            },
            services: {
              type: 'string',
              description: 'Comma-separated list of services to include',
            },
            tags: {
              type: 'string',
              description: 'Comma-separated list of tags to filter by',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              reportId: { type: 'string' },
              generatedAt: { type: 'string' },
              period: {
                type: 'object',
                properties: {
                  start: { type: 'string' },
                  end: { type: 'string' },
                  duration: { type: 'string' },
                },
              },
              summary: {
                type: 'object',
                properties: {
                  totalSLOs: { type: 'number' },
                  healthySLOs: { type: 'number' },
                  warningSLOs: { type: 'number' },
                  breachedSLOs: { type: 'number' },
                  overallHealthRate: { type: 'number' },
                  avgErrorBudgetRemaining: { type: 'number' },
                },
              },
              sloDetails: { type: 'array' },
            },
          },
        },
      },
    },
    async (request): Promise<SLOReport> => {
      const { period = '24h', services, tags } = request.query;

      // Parse period to duration
      const durationMs = parsePeriodToMs(period);
      const end = new Date();
      const start = new Date(end.getTime() - durationMs);

      const report = await sloService.getSLOReport(start, end);

      // Filter by services if specified
      if (services) {
        const serviceList = services.split(',').map((s) => s.trim());
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        report.sloDetails = report.sloDetails.filter((d) => serviceList.includes(d.service));
      }

      // Filter by tags if specified
      if (tags) {
        const tagList = tags.split(',').map((t) => t.trim());
        /* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
        report.sloDetails = report.sloDetails.filter((d) =>
          d.tags?.some((t) => tagList.includes(t))
        );
        /* eslint-enable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
      }

      // Recalculate summary after filtering
      report.summary = {
        totalSLOs: report.sloDetails.length,
        healthySLOs: report.sloDetails.filter((d) => d.status === 'healthy').length,
        warningSLOs: report.sloDetails.filter((d) => d.status === 'warning').length,
        breachedSLOs: report.sloDetails.filter((d) => d.status === 'breached').length,
        overallHealthRate:
          report.sloDetails.length > 0
            ? (report.sloDetails.filter((d) => d.status === 'healthy').length /
                report.sloDetails.length) *
              100
            : 100,
        avgErrorBudgetRemaining:
          report.sloDetails.length > 0
            ? // eslint-disable-next-line @typescript-eslint/no-unsafe-return
              report.sloDetails.reduce((sum, d) => sum + d.errorBudget.remainingPercent, 0) /
              report.sloDetails.length
            : 100,
      };

      return report;
    }
  );

  /**
   * Get available dashboards
   */
  app.get(
    '/api/observability/dashboards',
    {
      schema: {
        tags: ['observability'],
        summary: 'List available dashboards',
        description: 'Returns a list of available Grafana dashboards with their URLs',
        response: {
          200: {
            type: 'object',
            properties: {
              grafanaUrl: { type: 'string' },
              dashboards: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    uid: { type: 'string' },
                    title: { type: 'string' },
                    url: { type: 'string' },
                    description: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    (): { grafanaUrl: string; dashboards: DashboardInfo[] } => {
      const grafanaUrl = process.env.GRAFANA_URL || 'http://localhost:3001';

      const dashboards: DashboardInfo[] = [
        {
          uid: 'platform-overview',
          title: 'Platform Overview',
          url: `${grafanaUrl}/d/platform-overview`,
          description:
            'Real-time overview of all platform services, health status, and key metrics',
          tags: ['overview', 'platform', 'health'],
        },
        {
          uid: 'slo-dashboard',
          title: 'SLO Dashboard',
          url: `${grafanaUrl}/d/slo-dashboard`,
          description: 'Service Level Objectives tracking with error budgets and burn rates',
          tags: ['slo', 'reliability', 'sre'],
        },
        {
          uid: 'service-detail',
          title: 'Service Detail',
          url: `${grafanaUrl}/d/service-detail`,
          description:
            'Detailed metrics for a specific service including latency, errors, and resources',
          tags: ['service', 'detail', 'debugging'],
        },
        {
          uid: 'business-metrics',
          title: 'Business Metrics',
          url: `${grafanaUrl}/d/business-metrics`,
          description: 'Key business KPIs including revenue, transactions, users, and engagement',
          tags: ['business', 'kpi', 'revenue'],
        },
      ];

      return {
        grafanaUrl,
        dashboards,
      };
    }
  );

  /**
   * Get metrics endpoint (Prometheus format)
   */
  app.get(
    '/api/observability/metrics',
    {
      schema: {
        tags: ['observability'],
        summary: 'Get SLO metrics',
        description: 'Returns SLO metrics in Prometheus format',
        produces: ['text/plain'],
      },
    },
    async (_request, reply): Promise<void> => {
      const metrics = await sloService.getMetrics();
      void reply.header('Content-Type', 'text/plain; charset=utf-8');
      void reply.send(metrics);
    }
  );

  done();
}

/**
 * Parse period string to milliseconds
 */
function parsePeriodToMs(period: string): number {
  const value = parseInt(period, 10);
  const unit = period.replace(/\d+/g, '');

  switch (unit) {
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    case 'm':
      return value * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000; // Default to 24 hours
  }
}
