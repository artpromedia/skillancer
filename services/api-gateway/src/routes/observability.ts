/**
 * @module @skillancer/api-gateway/routes/observability
 * Observability and SLO tracking routes
 */

import {
  createSLOService,
  defaultSLODefinitions,
  type SLOStatusResult,
  type SLOReport,
  type PrometheusClient,
} from '@skillancer/metrics';
import type { Logger } from 'pino';

import { getConfig } from '../config/index.js';

// Import type extensions
import '../types/index.js';

import type { FastifyInstance } from 'fastify';

interface SLOStatusParams {
  sloId?: string;
}

interface SLOReportQuery {
  period?: string;
  services?: string;
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
    critical: number;
    healthRate: number;
  };
}

/**
 * Create a stub Prometheus client for development/non-Prometheus environments
 */
function createStubPrometheusClient(): PrometheusClient {
  return {
    async query(_query: string) {
      return { status: 'success' as const, data: { resultType: 'vector' as const, result: [] } };
    },
    async queryRange(_query: string, _start: Date, _end: Date, _step: string) {
      return { status: 'success' as const, data: { resultType: 'matrix' as const, result: [] } };
    },
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
  const prometheusClient = createStubPrometheusClient();
  // Fastify uses pino under the hood, so we can safely cast to pino Logger
  const logger = app.log as unknown as Logger;
  const sloService = createSLOService(prometheusClient, logger);

  // Register default SLOs on startup
  for (const slo of defaultSLODefinitions) {
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
                  critical: { type: 'number' },
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

      const result = await sloService.getAllSLOStatuses();
      let sloStatuses = result.slos;

      // Filter by service if specified
      if (service) {
        sloStatuses = sloStatuses.filter((s) => s.service === service);
      }

      const summary = {
        total: sloStatuses.length,
        healthy: sloStatuses.filter((s) => s.status === 'healthy').length,
        warning: sloStatuses.filter((s) => s.status === 'warning').length,
        critical: sloStatuses.filter((s) => s.status === 'critical').length,
        healthRate: 0,
      };
      summary.healthRate = summary.total > 0 ? (summary.healthy / summary.total) * 100 : 100;

      return {
        timestamp: new Date().toISOString(),
        slos: sloStatuses,
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
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              period: {
                type: 'object',
                properties: {
                  start: { type: 'string', format: 'date-time' },
                  end: { type: 'string', format: 'date-time' },
                },
              },
              slos: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    service: { type: 'string' },
                    target: { type: 'number' },
                    achieved: { type: 'number' },
                    status: { type: 'string', enum: ['met', 'at_risk', 'missed'] },
                    errorBudgetUsed: { type: 'number' },
                    incidents: { type: 'number' },
                    downtimeMinutes: { type: 'number' },
                  },
                },
              },
              summary: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  met: { type: 'number' },
                  missed: { type: 'number' },
                  atRisk: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request): Promise<SLOReport> => {
      const { period = '24h', services } = request.query;

      // Parse period to duration
      const durationMs = parsePeriodToMs(period);
      const end = new Date();
      const start = new Date(end.getTime() - durationMs);

      const report = await sloService.getSLOReport(start, end);

      // Filter by services if specified
      if (services) {
        const serviceList = services.split(',').map((s: string) => s.trim());
        report.slos = report.slos.filter((slo) => serviceList.includes(slo.service));
      }

      // Recalculate summary after filtering
      const met = report.slos.filter((slo) => slo.status === 'met').length;
      const missed = report.slos.filter((slo) => slo.status === 'missed').length;
      const atRisk = report.slos.filter((slo) => slo.status === 'at_risk').length;

      report.summary = {
        total: report.slos.length,
        met,
        missed,
        atRisk,
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
  const value = Number.parseInt(period, 10);
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
