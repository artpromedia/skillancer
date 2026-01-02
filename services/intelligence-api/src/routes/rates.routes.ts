/**
 * Rate Benchmarking API Routes
 * Sprint M10: Talent Intelligence API
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { rateAnalyticsService } from '../services/rate-analytics';

// ============================================================================
// Request Schemas
// ============================================================================

const BenchmarkQuerySchema = z.object({
  skill: z.string().min(1).describe('Skill name to benchmark (required)'),
  experience_level: z
    .enum(['junior', 'mid', 'senior', 'expert', 'lead'])
    .optional()
    .describe('Experience level filter'),
  location: z.string().optional().describe('Location filter (ISO country code)'),
  project_type: z.enum(['hourly', 'fixed', 'retainer']).optional().describe('Project type filter'),
});

const CompareQuerySchema = z.object({
  base_skill: z.string().min(1).describe('Base skill for comparison'),
  compare_skills: z.string().min(1).describe('Comma-separated list of skills to compare'),
  experience_level: z.enum(['junior', 'mid', 'senior', 'expert', 'lead']).optional(),
  location: z.string().optional(),
});

const HistoryQuerySchema = z.object({
  skill: z.string().min(1).describe('Skill name'),
  experience_level: z.enum(['junior', 'mid', 'senior', 'expert', 'lead']).optional(),
  location: z.string().optional(),
  periods: z.coerce.number().min(1).max(24).default(12).describe('Number of months of history'),
});

const ByLocationQuerySchema = z.object({
  skill: z.string().min(1),
  locations: z.string().min(1).describe('Comma-separated list of location codes'),
  experience_level: z.enum(['junior', 'mid', 'senior', 'expert', 'lead']).optional(),
});

const ByExperienceQuerySchema = z.object({
  skill: z.string().min(1),
  location: z.string().optional(),
});

// ============================================================================
// Routes
// ============================================================================

export async function ratesRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /v1/rates/benchmark
   * Get rate benchmark for a specific skill
   */
  app.get(
    '/benchmark',
    {
      schema: {
        tags: ['Rates'],
        summary: 'Get rate benchmark for a skill',
        description: `
        Returns rate percentiles and trends for a specific skill.
        Data is based on actual transaction data from the Skillancer platform.
      `,
        querystring: {
          type: 'object',
          required: ['skill'],
          properties: {
            skill: { type: 'string', description: 'Skill name (e.g., "React", "Python")' },
            experience_level: {
              type: 'string',
              enum: ['junior', 'mid', 'senior', 'expert', 'lead'],
            },
            location: { type: 'string', description: 'ISO country code (e.g., "US", "GB")' },
            project_type: { type: 'string', enum: ['hourly', 'fixed', 'retainer'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              skill: { type: 'string' },
              experience_level: { type: 'string', nullable: true },
              location: { type: 'string', nullable: true },
              sample_size: { type: 'number' },
              rates: {
                type: 'object',
                properties: {
                  hourly: {
                    type: 'object',
                    properties: {
                      p10: { type: 'number' },
                      p25: { type: 'number' },
                      p50: { type: 'number' },
                      p75: { type: 'number' },
                      p90: { type: 'number' },
                      mean: { type: 'number' },
                    },
                  },
                  fixed_project: {
                    type: 'object',
                    properties: {
                      average: { type: 'number', nullable: true },
                      median: { type: 'number', nullable: true },
                    },
                  },
                },
              },
              trend: {
                type: 'object',
                properties: {
                  yoy_change: { type: 'number', nullable: true },
                  qoq_change: { type: 'number', nullable: true },
                  direction: { type: 'string', enum: ['up', 'down', 'stable'] },
                },
              },
              data_quality: {
                type: 'object',
                properties: {
                  confidence: { type: 'number' },
                  freshness: { type: 'string' },
                  last_updated: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = BenchmarkQuerySchema.parse(request.query);

      const benchmark = await rateAnalyticsService.getBenchmark({
        skill: query.skill,
        experienceLevel: query.experience_level,
        location: query.location,
        projectType: query.project_type,
      });

      if (!benchmark) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `No rate data available for skill: ${query.skill}. Try a broader query.`,
          statusCode: 404,
        });
      }

      return {
        skill: benchmark.skill,
        experience_level: benchmark.experienceLevel,
        location: benchmark.location,
        sample_size: benchmark.sampleSize,
        rates: {
          hourly: {
            p10: benchmark.rates.hourly.p10,
            p25: benchmark.rates.hourly.p25,
            p50: benchmark.rates.hourly.p50,
            p75: benchmark.rates.hourly.p75,
            p90: benchmark.rates.hourly.p90,
            mean: benchmark.rates.hourly.mean,
          },
          fixed_project: {
            average: benchmark.rates.fixedProject.average,
            median: benchmark.rates.fixedProject.median,
          },
        },
        trend: {
          yoy_change: benchmark.trend.yoyChange,
          qoq_change: benchmark.trend.qoqChange,
          direction: benchmark.trend.direction,
        },
        data_quality: {
          confidence: benchmark.dataQuality.confidence,
          freshness: benchmark.dataQuality.freshness,
          last_updated: benchmark.dataQuality.lastUpdated.toISOString(),
        },
      };
    }
  );

  /**
   * GET /v1/rates/compare
   * Compare rates across multiple skills
   */
  app.get(
    '/compare',
    {
      schema: {
        tags: ['Rates'],
        summary: 'Compare rates across multiple skills',
        description: 'Compare the median hourly rate of multiple skills against a base skill.',
        querystring: {
          type: 'object',
          required: ['base_skill', 'compare_skills'],
          properties: {
            base_skill: { type: 'string' },
            compare_skills: { type: 'string', description: 'Comma-separated list' },
            experience_level: {
              type: 'string',
              enum: ['junior', 'mid', 'senior', 'expert', 'lead'],
            },
            location: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = CompareQuerySchema.parse(request.query);
      const compareSkills = query.compare_skills.split(',').map((s) => s.trim());

      const comparison = await rateAnalyticsService.compareRates(query.base_skill, compareSkills, {
        experienceLevel: query.experience_level,
        location: query.location,
      });

      return {
        base_skill: comparison.baseSkill,
        comparisons: comparison.comparisons.map((c) => ({
          skill: c.skill,
          p50_rate: c.p50Rate,
          difference_percent: c.difference,
          sample_size: c.sampleSize,
        })),
      };
    }
  );

  /**
   * GET /v1/rates/history
   * Get historical rate data for trend analysis
   */
  app.get(
    '/history',
    {
      schema: {
        tags: ['Rates'],
        summary: 'Get historical rate trends',
        description: 'Returns monthly rate data for trend analysis over the specified period.',
        querystring: {
          type: 'object',
          required: ['skill'],
          properties: {
            skill: { type: 'string' },
            experience_level: {
              type: 'string',
              enum: ['junior', 'mid', 'senior', 'expert', 'lead'],
            },
            location: { type: 'string' },
            periods: { type: 'number', default: 12, minimum: 1, maximum: 24 },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = HistoryQuerySchema.parse(request.query);

      const history = await rateAnalyticsService.getRateHistory(query.skill, {
        experienceLevel: query.experience_level,
        location: query.location,
        periods: query.periods,
      });

      return {
        skill: history.skill,
        experience_level: history.experienceLevel,
        location: history.location,
        data_points: history.dataPoints.map((dp) => ({
          period: dp.period.toISOString().substring(0, 7), // YYYY-MM format
          p50: dp.p50,
          p25: dp.p25,
          p75: dp.p75,
          sample_size: dp.sampleSize,
        })),
        trend_line: {
          slope: history.trendLine.slope,
          direction: history.trendLine.direction,
          r_squared: history.trendLine.rSquared,
        },
      };
    }
  );

  /**
   * GET /v1/rates/by-location
   * Compare rates across different locations
   */
  app.get(
    '/by-location',
    {
      schema: {
        tags: ['Rates'],
        summary: 'Compare rates across locations',
        description: 'Returns rate comparison across multiple geographic locations.',
        querystring: {
          type: 'object',
          required: ['skill', 'locations'],
          properties: {
            skill: { type: 'string' },
            locations: { type: 'string', description: 'Comma-separated ISO country codes' },
            experience_level: {
              type: 'string',
              enum: ['junior', 'mid', 'senior', 'expert', 'lead'],
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = ByLocationQuerySchema.parse(request.query);
      const locations = query.locations.split(',').map((l) => l.trim().toUpperCase());

      const results = await rateAnalyticsService.getRatesByLocation(
        query.skill,
        locations,
        query.experience_level
      );

      return {
        skill: query.skill,
        experience_level: query.experience_level || null,
        locations: results.map((r) => ({
          location: r.location,
          p50_rate: r.p50,
          sample_size: r.sampleSize,
        })),
      };
    }
  );

  /**
   * GET /v1/rates/by-experience
   * Compare rates across experience levels
   */
  app.get(
    '/by-experience',
    {
      schema: {
        tags: ['Rates'],
        summary: 'Compare rates across experience levels',
        description: 'Returns rate breakdown by experience level for a skill.',
        querystring: {
          type: 'object',
          required: ['skill'],
          properties: {
            skill: { type: 'string' },
            location: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = ByExperienceQuerySchema.parse(request.query);

      const results = await rateAnalyticsService.getRatesByExperience(query.skill, query.location);

      return {
        skill: query.skill,
        location: query.location || null,
        levels: results.map((r) => ({
          experience_level: r.level,
          p50_rate: r.p50,
          p25_rate: r.p25,
          p75_rate: r.p75,
          sample_size: r.sampleSize,
        })),
      };
    }
  );
}
