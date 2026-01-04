/**
 * Demand Routes
 * Sprint M10: Talent Intelligence API
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { demandAnalyticsService } from '../services/demand-analytics';

// ============================================================================
// Request/Response Schemas
// ============================================================================

const CurrentDemandQuerySchema = z.object({
  skill: z.string().min(1).describe('Skill to query demand for'),
  location: z.string().optional().describe('Filter by location (country code)'),
});

const TrendsQuerySchema = z.object({
  skill: z.string().min(1).describe('Skill to query'),
  periods: z.coerce
    .number()
    .int()
    .min(1)
    .max(24)
    .default(12)
    .describe('Number of months of history'),
  location: z.string().optional().describe('Filter by location'),
});

const EmergingQuerySchema = z.object({
  category: z.string().optional().describe('Filter by skill category'),
  limit: z.coerce.number().int().min(1).max(50).default(10).describe('Max results'),
});

const DecliningQuerySchema = z.object({
  category: z.string().optional().describe('Filter by skill category'),
  limit: z.coerce.number().int().min(1).max(50).default(10).describe('Max results'),
});

const CorrelationsQuerySchema = z.object({
  skill: z.string().min(1).describe('Skill to find correlations for'),
  limit: z.coerce.number().int().min(1).max(20).default(10).describe('Max related skills'),
});

const IndustryQuerySchema = z.object({
  skill: z.string().min(1).describe('Skill to query'),
});

const HeatmapQuerySchema = z.object({
  skill: z.string().min(1).describe('Skill to query'),
});

// ============================================================================
// Route Handler
// ============================================================================

export async function registerDemandRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /demand/current
   * Get current demand for a skill
   */
  app.get(
    '/current',
    {
      schema: {
        tags: ['Demand'],
        summary: 'Get current demand',
        description:
          'Returns current demand metrics for a specific skill, including demand score, supply/demand ratio, and competition level.',
        querystring: CurrentDemandQuerySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  skill: { type: 'string' },
                  location: { type: 'string', nullable: true },
                  current_demand: { type: 'number' },
                  demand_score: { type: 'number' },
                  supply_demand_ratio: { type: 'number' },
                  open_positions: { type: 'number' },
                  avg_time_to_fill: { type: 'number' },
                  competition_level: { type: 'string' },
                  trend_direction: { type: 'string' },
                  trend_strength: { type: 'number' },
                  snapshot_date: { type: 'string', format: 'date-time' },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  request_id: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
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
        security: [{ apiKey: [] }],
      },
    },
    async (request, reply) => {
      const query = CurrentDemandQuerySchema.parse(request.query);

      const result = await demandAnalyticsService.getCurrentDemand(query.skill, query.location);

      if (!result) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `No demand data found for skill: ${query.skill}`,
        });
      }

      return {
        data: {
          skill: result.skill,
          location: result.location,
          current_demand: result.currentDemand,
          demand_score: result.demandScore,
          supply_demand_ratio: result.supplyDemandRatio,
          open_positions: result.openPositions,
          avg_time_to_fill: result.avgTimeToFill,
          competition_level: result.competitionLevel,
          trend_direction: result.trendDirection,
          trend_strength: result.trendStrength,
          snapshot_date: result.snapshotDate.toISOString(),
        },
        meta: {
          request_id: request.id,
          timestamp: new Date().toISOString(),
        },
      };
    }
  );

  /**
   * GET /demand/trends
   * Get demand trends with forecast
   */
  app.get(
    '/trends',
    {
      schema: {
        tags: ['Demand'],
        summary: 'Get demand trends',
        description: 'Returns historical demand data with analysis and future projections.',
        querystring: TrendsQuerySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  skill: { type: 'string' },
                  location: { type: 'string', nullable: true },
                  history: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        period: { type: 'string', format: 'date-time' },
                        demand: { type: 'number' },
                        demand_score: { type: 'number' },
                        open_positions: { type: 'number' },
                      },
                    },
                  },
                  forecast: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        period: { type: 'string', format: 'date-time' },
                        projected: { type: 'number' },
                        confidence: { type: 'number' },
                      },
                    },
                  },
                  analysis: {
                    type: 'object',
                    properties: {
                      overall_trend: { type: 'string' },
                      growth_rate: { type: 'number' },
                      peak_month: { type: 'string', nullable: true },
                      low_month: { type: 'string', nullable: true },
                    },
                  },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  request_id: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        security: [{ apiKey: [] }],
      },
    },
    async (request, reply) => {
      const query = TrendsQuerySchema.parse(request.query);

      const result = await demandAnalyticsService.getDemandTrends(
        query.skill,
        query.periods,
        query.location
      );

      return {
        data: {
          skill: result.skill,
          location: result.location,
          history: result.history.map((h) => ({
            period: h.period.toISOString(),
            demand: h.demand,
            demand_score: h.demandScore,
            open_positions: h.openPositions,
          })),
          forecast: result.forecast.map((f) => ({
            period: f.period.toISOString(),
            projected: f.projected,
            confidence: f.confidence,
          })),
          analysis: {
            overall_trend: result.analysis.overallTrend,
            growth_rate: result.analysis.growthRate,
            peak_month: result.analysis.peakMonth,
            low_month: result.analysis.lowMonth,
          },
        },
        meta: {
          request_id: request.id,
          timestamp: new Date().toISOString(),
        },
      };
    }
  );

  /**
   * GET /demand/emerging
   * Get emerging skills with high growth
   */
  app.get(
    '/emerging',
    {
      schema: {
        tags: ['Demand'],
        summary: 'Get emerging skills',
        description:
          'Returns skills with highest growth rates, including drivers and projected demand.',
        querystring: EmergingQuerySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  skills: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        skill: { type: 'string' },
                        category: { type: 'string' },
                        growth_rate: { type: 'number' },
                        current_demand: { type: 'number' },
                        projected_demand: { type: 'number' },
                        time_horizon: { type: 'string' },
                        related_skills: { type: 'array', items: { type: 'string' } },
                        drivers: { type: 'array', items: { type: 'string' } },
                        confidence_level: { type: 'number' },
                      },
                    },
                  },
                  count: { type: 'number' },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  request_id: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        security: [{ apiKey: [] }],
      },
    },
    async (request, reply) => {
      const query = EmergingQuerySchema.parse(request.query);

      const result = await demandAnalyticsService.getEmergingSkills(query.category, query.limit);

      return {
        data: {
          skills: result.map((s) => ({
            skill: s.skill,
            category: s.category,
            growth_rate: s.growthRate,
            current_demand: s.currentDemand,
            projected_demand: s.projectedDemand,
            time_horizon: s.timeHorizon,
            related_skills: s.relatedSkills,
            drivers: s.drivers,
            confidence_level: s.confidenceLevel,
          })),
          count: result.length,
        },
        meta: {
          request_id: request.id,
          timestamp: new Date().toISOString(),
        },
      };
    }
  );

  /**
   * GET /demand/declining
   * Get declining skills
   */
  app.get(
    '/declining',
    {
      schema: {
        tags: ['Demand'],
        summary: 'Get declining skills',
        description:
          'Returns skills with declining demand, including replacement skills and transition paths.',
        querystring: DecliningQuerySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  skills: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        skill: { type: 'string' },
                        category: { type: 'string' },
                        decline_rate: { type: 'number' },
                        current_demand: { type: 'number' },
                        projected_demand: { type: 'number' },
                        replacement_skills: { type: 'array', items: { type: 'string' } },
                        transition_path: { type: 'string', nullable: true },
                        urgency: { type: 'string' },
                      },
                    },
                  },
                  count: { type: 'number' },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  request_id: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        security: [{ apiKey: [] }],
      },
    },
    async (request, reply) => {
      const query = DecliningQuerySchema.parse(request.query);

      const result = await demandAnalyticsService.getDecliningSkills(query.category, query.limit);

      return {
        data: {
          skills: result.map((s) => ({
            skill: s.skill,
            category: s.category,
            decline_rate: s.declineRate,
            current_demand: s.currentDemand,
            projected_demand: s.projectedDemand,
            replacement_skills: s.replacementSkills,
            transition_path: s.transitionPath,
            urgency: s.urgency,
          })),
          count: result.length,
        },
        meta: {
          request_id: request.id,
          timestamp: new Date().toISOString(),
        },
      };
    }
  );

  /**
   * GET /demand/correlations
   * Get skill correlations
   */
  app.get(
    '/correlations',
    {
      schema: {
        tags: ['Demand'],
        summary: 'Get skill correlations',
        description:
          'Returns skills that are frequently co-occurring or correlated with the specified skill.',
        querystring: CorrelationsQuerySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  skill: { type: 'string' },
                  related_skills: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        skill: { type: 'string' },
                        correlation: { type: 'number' },
                        co_occurrence: { type: 'number' },
                        trend: { type: 'string' },
                      },
                    },
                  },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  request_id: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        security: [{ apiKey: [] }],
      },
    },
    async (request, reply) => {
      const query = CorrelationsQuerySchema.parse(request.query);

      const result = await demandAnalyticsService.getSkillCorrelations(query.skill, query.limit);

      return {
        data: {
          skill: result.skill,
          related_skills: result.relatedSkills.map((r) => ({
            skill: r.skill,
            correlation: r.correlation,
            co_occurrence: r.coOccurrence,
            trend: r.trend,
          })),
        },
        meta: {
          request_id: request.id,
          timestamp: new Date().toISOString(),
        },
      };
    }
  );

  /**
   * GET /demand/by-industry
   * Get demand by industry breakdown
   */
  app.get(
    '/by-industry',
    {
      schema: {
        tags: ['Demand'],
        summary: 'Get demand by industry',
        description: 'Returns demand for a skill broken down by industry vertical.',
        querystring: IndustryQuerySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  skill: { type: 'string' },
                  industries: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        industry: { type: 'string' },
                        demand: { type: 'number' },
                        percentage: { type: 'number' },
                      },
                    },
                  },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  request_id: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        security: [{ apiKey: [] }],
      },
    },
    async (request, reply) => {
      const query = IndustryQuerySchema.parse(request.query);

      const result = await demandAnalyticsService.getDemandByIndustry(query.skill);

      return {
        data: {
          skill: query.skill,
          industries: result,
        },
        meta: {
          request_id: request.id,
          timestamp: new Date().toISOString(),
        },
      };
    }
  );

  /**
   * GET /demand/heatmap
   * Get demand heatmap by region
   */
  app.get(
    '/heatmap',
    {
      schema: {
        tags: ['Demand'],
        summary: 'Get demand heatmap',
        description: 'Returns demand intensity by geographic region for visualization.',
        querystring: HeatmapQuerySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  skill: { type: 'string' },
                  regions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        region: { type: 'string' },
                        demand: { type: 'number' },
                        intensity: { type: 'number' },
                      },
                    },
                  },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  request_id: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        security: [{ apiKey: [] }],
      },
    },
    async (request, reply) => {
      const query = HeatmapQuerySchema.parse(request.query);

      const result = await demandAnalyticsService.getDemandHeatmap(query.skill);

      return {
        data: {
          skill: query.skill,
          regions: result,
        },
        meta: {
          request_id: request.id,
          timestamp: new Date().toISOString(),
        },
      };
    }
  );
}
