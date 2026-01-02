/**
 * Availability Routes
 * Sprint M10: Talent Intelligence API
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { availabilityAnalyticsService } from '../services/availability-analytics';

// ============================================================================
// Request/Response Schemas
// ============================================================================

const CurrentAvailabilityQuerySchema = z.object({
  skill: z.string().min(1).describe('Skill to query availability for'),
  experience_level: z
    .enum(['junior', 'mid', 'senior', 'expert'])
    .optional()
    .describe('Filter by experience level'),
  location: z.string().optional().describe('Filter by location (country code)'),
});

const ForecastQuerySchema = z.object({
  skill: z.string().min(1).describe('Skill to forecast'),
  periods: z.coerce
    .number()
    .int()
    .min(1)
    .max(12)
    .default(3)
    .describe('Number of months to forecast'),
  location: z.string().optional().describe('Filter by location'),
});

const RegionalQuerySchema = z.object({
  skill: z.string().min(1).describe('Skill to query'),
  experience_level: z
    .enum(['junior', 'mid', 'senior', 'expert'])
    .optional()
    .describe('Filter by experience level'),
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

const TimezoneQuerySchema = z.object({
  skill: z.string().min(1).describe('Skill to query'),
  experience_level: z
    .enum(['junior', 'mid', 'senior', 'expert'])
    .optional()
    .describe('Filter by experience level'),
});

// ============================================================================
// Route Handler
// ============================================================================

export async function registerAvailabilityRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /availability/current
   * Get current talent availability for a skill
   */
  app.get(
    '/current',
    {
      schema: {
        tags: ['Availability'],
        summary: 'Get current availability',
        description:
          'Returns current talent availability metrics for a specific skill, including number of available freelancers now and in the near future.',
        querystring: CurrentAvailabilityQuerySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  skill: { type: 'string' },
                  experience_level: { type: 'string', nullable: true },
                  location: { type: 'string', nullable: true },
                  available_now: { type: 'number' },
                  available_7_days: { type: 'number' },
                  available_30_days: { type: 'number' },
                  available_90_days: { type: 'number' },
                  total_qualified: { type: 'number' },
                  availability_score: { type: 'number' },
                  avg_hours_per_week: { type: 'number', nullable: true },
                  total_hours_available: { type: 'number', nullable: true },
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
      const query = CurrentAvailabilityQuerySchema.parse(request.query);

      const result = await availabilityAnalyticsService.getCurrentAvailability({
        skill: query.skill,
        experienceLevel: query.experience_level,
        location: query.location,
      });

      if (!result) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `No availability data found for skill: ${query.skill}`,
        });
      }

      return {
        data: {
          skill: result.skill,
          experience_level: result.experienceLevel,
          location: result.location,
          available_now: result.availableNow,
          available_7_days: result.available7Days,
          available_30_days: result.available30Days,
          available_90_days: result.available90Days,
          total_qualified: result.totalQualified,
          availability_score: result.availabilityScore,
          avg_hours_per_week: result.avgHoursPerWeek,
          total_hours_available: result.totalHoursAvailable,
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
   * GET /availability/forecast
   * Forecast future talent availability
   */
  app.get(
    '/forecast',
    {
      schema: {
        tags: ['Availability'],
        summary: 'Forecast talent availability',
        description:
          'Projects future talent availability based on historical patterns, seasonal trends, and project completion estimates.',
        querystring: ForecastQuerySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  skill: { type: 'string' },
                  location: { type: 'string', nullable: true },
                  current_available: { type: 'number' },
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
                  factors: {
                    type: 'object',
                    properties: {
                      project_completions: { type: 'number' },
                      seasonal_adjustment: { type: 'number' },
                      growth_trend: { type: 'number' },
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
      const query = ForecastQuerySchema.parse(request.query);

      const result = await availabilityAnalyticsService.forecastAvailability(
        query.skill,
        query.periods,
        query.location
      );

      return {
        data: {
          skill: result.skill,
          location: result.location,
          current_available: result.currentAvailable,
          forecast: result.forecast.map((f) => ({
            period: f.period.toISOString(),
            projected: f.projected,
            confidence: f.confidence,
          })),
          factors: {
            project_completions: result.factors.projectCompletions,
            seasonal_adjustment: result.factors.seasonalAdjustment,
            growth_trend: result.factors.growthTrend,
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
   * GET /availability/by-region
   * Get availability breakdown by region
   */
  app.get(
    '/by-region',
    {
      schema: {
        tags: ['Availability'],
        summary: 'Get availability by region',
        description:
          'Returns talent availability broken down by geographic region, including regional rates and availability scores.',
        querystring: RegionalQuerySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  skill: { type: 'string' },
                  total_global: { type: 'number' },
                  regions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        region: { type: 'string' },
                        region_name: { type: 'string' },
                        available_now: { type: 'number' },
                        total_qualified: { type: 'number' },
                        availability_score: { type: 'number' },
                        avg_rate: { type: 'number', nullable: true },
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
      const query = RegionalQuerySchema.parse(request.query);

      const result = await availabilityAnalyticsService.getAvailabilityByRegion(
        query.skill,
        query.experience_level
      );

      return {
        data: {
          skill: result.skill,
          total_global: result.totalGlobal,
          regions: result.regions.map((r) => ({
            region: r.region,
            region_name: r.regionName,
            available_now: r.availableNow,
            total_qualified: r.totalQualified,
            availability_score: r.availabilityScore,
            avg_rate: r.avgRate,
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
   * GET /availability/trends
   * Get availability trends over time
   */
  app.get(
    '/trends',
    {
      schema: {
        tags: ['Availability'],
        summary: 'Get availability trends',
        description:
          'Returns historical availability data showing how talent supply has changed over time.',
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
                  periods: { type: 'number' },
                  trends: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        period: { type: 'string', format: 'date-time' },
                        available: { type: 'number' },
                        score: { type: 'number' },
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
      const query = TrendsQuerySchema.parse(request.query);

      const result = await availabilityAnalyticsService.getAvailabilityTrends(
        query.skill,
        query.periods,
        query.location
      );

      return {
        data: {
          skill: query.skill,
          location: query.location || null,
          periods: query.periods,
          trends: result.map((t) => ({
            period: t.period.toISOString(),
            available: t.available,
            score: t.score,
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
   * GET /availability/by-timezone
   * Get availability by timezone distribution
   */
  app.get(
    '/by-timezone',
    {
      schema: {
        tags: ['Availability'],
        summary: 'Get availability by timezone',
        description:
          'Returns talent availability broken down by timezone, useful for planning team coverage and collaboration hours.',
        querystring: TimezoneQuerySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  skill: { type: 'string' },
                  experience_level: { type: 'string', nullable: true },
                  timezones: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        timezone: { type: 'string' },
                        available: { type: 'number' },
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
      const query = TimezoneQuerySchema.parse(request.query);

      const result = await availabilityAnalyticsService.getTimezoneDistribution(
        query.skill,
        query.experience_level
      );

      return {
        data: {
          skill: query.skill,
          experience_level: query.experience_level || null,
          timezones: result,
        },
        meta: {
          request_id: request.id,
          timestamp: new Date().toISOString(),
        },
      };
    }
  );
}
