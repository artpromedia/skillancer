/**
 * @module @skillancer/analytics/api
 * Analytics API routes
 */

import type { AnalyticsQueryService } from '../query/analytics-query-service.js';
import type { FastifyInstance, FastifyRequest, FastifyReply, FastifySchema } from 'fastify';

// Extended schema type for Swagger support
interface ExtendedSchema extends FastifySchema {
  tags?: string[];
  summary?: string;
}

interface DateRangeQuery {
  start?: string;
  end?: string;
}

interface UserParams {
  userId: string;
}

interface FunnelParams {
  funnelName: string;
}

interface ExperimentParams {
  experimentId: string;
}

interface ExperimentQuery extends DateRangeQuery {
  metric?: string;
}

interface CohortQuery extends DateRangeQuery {
  type?: 'day' | 'week' | 'month';
  segment?: string;
}

interface SegmentQuery extends DateRangeQuery {
  by?: string;
  metric?: string;
}

export function createAnalyticsRoutes(queryService: AnalyticsQueryService) {
  return async function analyticsRoutes(app: FastifyInstance): Promise<void> {
    // Real-time metrics
    app.get(
      '/realtime',
      {
        schema: {
          tags: ['analytics'],
          summary: 'Get real-time metrics',
          response: {
            200: {
              type: 'object',
              properties: {
                timestamp: { type: 'string' },
                activeUsers: { type: 'object' },
                recentEvents: { type: 'object' },
                topPages: { type: 'array' },
              },
            },
          },
        } as ExtendedSchema,
      },
      async (_request: FastifyRequest, _reply: FastifyReply) => {
        return queryService.getRealtimeMetrics();
      }
    );

    // User analytics
    app.get<{ Params: UserParams; Querystring: DateRangeQuery }>(
      '/users/:userId',
      {
        schema: {
          tags: ['analytics'],
          summary: 'Get user analytics',
          params: {
            type: 'object',
            properties: { userId: { type: 'string' } },
            required: ['userId'],
          },
          querystring: {
            type: 'object',
            properties: {
              start: { type: 'string' },
              end: { type: 'string' },
            },
          },
        } as ExtendedSchema,
      },
      async (request, _reply) => {
        const { userId } = request.params;
        const { start, end } = request.query;

        return queryService.getUserAnalytics(userId, {
          start: new Date(start || Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(end || Date.now()),
        });
      }
    );

    // Funnel analysis
    app.get<{ Params: FunnelParams; Querystring: DateRangeQuery & { segment?: string } }>(
      '/funnels/:funnelName',
      {
        schema: {
          tags: ['analytics'],
          summary: 'Get funnel analysis',
          params: {
            type: 'object',
            properties: { funnelName: { type: 'string' } },
            required: ['funnelName'],
          },
        } as ExtendedSchema,
      },
      async (request, _reply) => {
        const { funnelName } = request.params;
        const { start, end, segment } = request.query;

        return queryService.getFunnelAnalysis(
          funnelName,
          {
            start: new Date(start || Date.now() - 30 * 24 * 60 * 60 * 1000),
            end: new Date(end || Date.now()),
          },
          segment
        );
      }
    );

    // Cohort retention
    app.get<{ Querystring: CohortQuery }>(
      '/cohorts/retention',
      {
        schema: {
          tags: ['analytics'],
          summary: 'Get cohort retention data',
        } as ExtendedSchema,
      },
      async (request, _reply) => {
        const { type = 'week', start, end, segment } = request.query;

        return queryService.getCohortRetention(
          type,
          {
            start: new Date(start || Date.now() - 90 * 24 * 60 * 60 * 1000),
            end: new Date(end || Date.now()),
          },
          segment
        );
      }
    );

    // User segments
    app.get(
      '/segments',
      {
        schema: {
          tags: ['analytics'],
          summary: 'Get user segments',
        } as ExtendedSchema,
      },
      async (_request, _reply) => {
        return queryService.getUserSegments();
      }
    );

    // Segment breakdown
    app.get<{ Querystring: SegmentQuery }>(
      '/segments/breakdown',
      {
        schema: {
          tags: ['analytics'],
          summary: 'Get segment breakdown',
        } as ExtendedSchema,
      },
      async (request, _reply) => {
        const { by = 'platform', metric = 'users', start, end } = request.query;

        return queryService.getSegmentBreakdown(by, metric, {
          start: new Date(start || Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(end || Date.now()),
        });
      }
    );

    // Experiment results
    app.get<{ Params: ExperimentParams; Querystring: ExperimentQuery }>(
      '/experiments/:experimentId',
      {
        schema: {
          tags: ['analytics'],
          summary: 'Get A/B experiment results',
          params: {
            type: 'object',
            properties: { experimentId: { type: 'string' } },
            required: ['experimentId'],
          },
        } as ExtendedSchema,
      },
      async (request, _reply) => {
        const { experimentId } = request.params;
        const { metric = 'conversions', start, end } = request.query;

        return queryService.getExperimentResults(experimentId, metric, {
          start: new Date(start || Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(end || Date.now()),
        });
      }
    );
  };
}
