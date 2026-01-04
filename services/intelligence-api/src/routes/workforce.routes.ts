/**
 * Workforce Planning Routes
 * Sprint M10: Talent Intelligence API
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { workforceAnalyticsService } from '../services/workforce-analytics';

// ============================================================================
// Request/Response Schemas
// ============================================================================

const SkillRequirementSchema = z.object({
  skill: z.string().min(1),
  count: z.number().int().min(1).max(100),
  experience_level: z.enum(['junior', 'mid', 'senior', 'expert']),
  hours_per_week: z.number().min(1).max(60),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
});

const EstimateTeamBodySchema = z.object({
  skills: z.array(SkillRequirementSchema).min(1).max(20),
  project_duration: z.number().int().min(1).max(36).describe('Duration in months'),
  start_date: z.string().datetime().describe('Desired start date'),
  location: z.string().optional().describe('Preferred location'),
  timezone: z.string().optional().describe('Preferred timezone'),
  budget: z.number().optional().describe('Budget constraint in USD'),
});

const SkillGapQuerySchema = z.object({
  skills: z.string().describe('Comma-separated list of skills'),
  location: z.string().optional(),
});

const MarketReportQuerySchema = z.object({
  category: z.string().optional().describe('Skill category filter'),
  location: z.string().optional().describe('Location filter'),
});

const ScenarioBodySchema = z.object({
  skills: z.array(SkillRequirementSchema).min(1).max(20),
  project_duration: z.number().int().min(1).max(36),
  start_date: z.string().datetime(),
  location: z.string().optional(),
  budget: z.number().optional(),
});

const CompareOptionsQuerySchema = z.object({
  skill: z.string().min(1).describe('Skill to compare'),
  hours_per_week: z.coerce.number().min(1).max(60).describe('Hours per week'),
  duration_months: z.coerce.number().int().min(1).max(36).describe('Duration in months'),
  location: z.string().optional(),
});

// ============================================================================
// Route Handler
// ============================================================================

export async function registerWorkforceRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /workforce/estimate
   * Estimate team cost and timeline
   */
  app.post(
    '/estimate',
    {
      schema: {
        tags: ['Workforce Planning'],
        summary: 'Estimate team cost and availability',
        description:
          'Generates a comprehensive estimate for building a team, including costs, timeline, risks, and alternatives.',
        body: EstimateTeamBodySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  total_cost: { type: 'number' },
                  monthly_burn: { type: 'number' },
                  skill_breakdown: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        skill: { type: 'string' },
                        count: { type: 'number' },
                        experience_level: { type: 'string' },
                        avg_rate: { type: 'number' },
                        monthly_cost: { type: 'number' },
                        availability: { type: 'string' },
                        time_to_hire: { type: 'number' },
                        confidence_level: { type: 'number' },
                      },
                    },
                  },
                  timeline: {
                    type: 'object',
                    properties: {
                      estimated_start_date: { type: 'string', format: 'date-time' },
                      onboarding_time: { type: 'number' },
                      full_productivity_date: { type: 'string', format: 'date-time' },
                    },
                  },
                  risks: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: { type: 'string' },
                        description: { type: 'string' },
                        severity: { type: 'string' },
                        mitigation: { type: 'string' },
                      },
                    },
                  },
                  alternatives: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        suggestion: { type: 'string' },
                        cost_savings: { type: 'number' },
                        tradeoffs: { type: 'array', items: { type: 'string' } },
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
      const body = EstimateTeamBodySchema.parse(request.body);

      const result = await workforceAnalyticsService.estimateTeam({
        skills: body.skills.map((s) => ({
          skill: s.skill,
          count: s.count,
          experienceLevel: s.experience_level,
          hoursPerWeek: s.hours_per_week,
          priority: s.priority,
        })),
        projectDuration: body.project_duration,
        startDate: new Date(body.start_date),
        location: body.location,
        timezone: body.timezone,
        budget: body.budget,
      });

      return {
        data: {
          total_cost: result.totalCost,
          monthly_burn: result.monthlyBurn,
          skill_breakdown: result.skillBreakdown.map((s) => ({
            skill: s.skill,
            count: s.count,
            experience_level: s.experienceLevel,
            avg_rate: s.avgRate,
            monthly_cost: s.monthlyCost,
            availability: s.availability,
            time_to_hire: s.timeToHire,
            confidence_level: s.confidenceLevel,
          })),
          timeline: {
            estimated_start_date: result.timeline.estimatedStartDate.toISOString(),
            onboarding_time: result.timeline.onboardingTime,
            full_productivity_date: result.timeline.fullProductivityDate.toISOString(),
          },
          risks: result.risks,
          alternatives: result.alternatives.map((a) => ({
            suggestion: a.suggestion,
            cost_savings: a.costSavings,
            tradeoffs: a.tradeoffs,
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
   * GET /workforce/skill-gaps
   * Analyze skill gaps in the market
   */
  app.get(
    '/skill-gaps',
    {
      schema: {
        tags: ['Workforce Planning'],
        summary: 'Analyze skill gaps',
        description:
          'Returns analysis of supply vs demand gaps for specified skills with pricing impact projections.',
        querystring: SkillGapQuerySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  analyses: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        skill: { type: 'string' },
                        current_supply: { type: 'number' },
                        projected_demand: { type: 'number' },
                        gap_size: { type: 'number' },
                        gap_severity: { type: 'string' },
                        price_impact: {
                          type: 'object',
                          properties: {
                            current_avg_rate: { type: 'number' },
                            projected_rate: { type: 'number' },
                            change_percent: { type: 'number' },
                          },
                        },
                        recommendations: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              action: { type: 'string' },
                              timeframe: { type: 'string' },
                              cost: { type: 'string', nullable: true },
                            },
                          },
                        },
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
      const query = SkillGapQuerySchema.parse(request.query);
      const skills = query.skills.split(',').map((s) => s.trim());

      const result = await workforceAnalyticsService.analyzeSkillGaps(skills, query.location);

      return {
        data: {
          analyses: result.map((a) => ({
            skill: a.skill,
            current_supply: a.currentSupply,
            projected_demand: a.projectedDemand,
            gap_size: a.gapSize,
            gap_severity: a.gapSeverity,
            price_impact: {
              current_avg_rate: a.priceImpact.currentAvgRate,
              projected_rate: a.priceImpact.projectedRate,
              change_percent: a.priceImpact.changePercent,
            },
            recommendations: a.recommendations,
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
   * GET /workforce/market-report
   * Generate comprehensive market report
   */
  app.get(
    '/market-report',
    {
      schema: {
        tags: ['Workforce Planning'],
        summary: 'Get market report',
        description:
          'Generates a comprehensive market intelligence report with key metrics, trends, and predictions.',
        querystring: MarketReportQuerySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  generated_at: { type: 'string', format: 'date-time' },
                  period: { type: 'string' },
                  executive_summary: { type: 'string' },
                  key_metrics: {
                    type: 'object',
                    properties: {
                      total_active_freelancers: { type: 'number' },
                      total_open_projects: { type: 'number' },
                      avg_project_value: { type: 'number' },
                      market_growth_rate: { type: 'number' },
                    },
                  },
                  top_skills: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        skill: { type: 'string' },
                        demand: { type: 'number' },
                        avg_rate: { type: 'number' },
                        trend: { type: 'string' },
                      },
                    },
                  },
                  emerging_trends: { type: 'array', items: { type: 'string' } },
                  region_insights: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        region: { type: 'string' },
                        talent: { type: 'number' },
                        avg_rate: { type: 'number' },
                        growth: { type: 'number' },
                      },
                    },
                  },
                  predictions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        prediction: { type: 'string' },
                        confidence: { type: 'number' },
                        timeframe: { type: 'string' },
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
      const query = MarketReportQuerySchema.parse(request.query);

      const result = await workforceAnalyticsService.generateMarketReport(
        query.category,
        query.location
      );

      return {
        data: {
          generated_at: result.generatedAt.toISOString(),
          period: result.period,
          executive_summary: result.executiveSummary,
          key_metrics: {
            total_active_freelancers: result.keyMetrics.totalActiveFreelancers,
            total_open_projects: result.keyMetrics.totalOpenProjects,
            avg_project_value: result.keyMetrics.avgProjectValue,
            market_growth_rate: result.keyMetrics.marketGrowthRate,
          },
          top_skills: result.topSkills.map((s) => ({
            skill: s.skill,
            demand: s.demand,
            avg_rate: s.avgRate,
            trend: s.trend,
          })),
          emerging_trends: result.emergingTrends,
          region_insights: result.regionInsights.map((r) => ({
            region: r.region,
            talent: r.talent,
            avg_rate: r.avgRate,
            growth: r.growth,
          })),
          predictions: result.predictions,
        },
        meta: {
          request_id: request.id,
          timestamp: new Date().toISOString(),
        },
      };
    }
  );

  /**
   * POST /workforce/scenarios
   * Run scenario analysis
   */
  app.post(
    '/scenarios',
    {
      schema: {
        tags: ['Workforce Planning'],
        summary: 'Run scenario analysis',
        description:
          'Analyzes multiple market scenarios and their potential impact on your workforce planning.',
        body: ScenarioBodySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  scenarios: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        description: { type: 'string' },
                        probability: { type: 'number' },
                        impact: {
                          type: 'object',
                          properties: {
                            on_costs: { type: 'number' },
                            on_timeline: { type: 'number' },
                            on_availability: { type: 'number' },
                          },
                        },
                        recommendations: { type: 'array', items: { type: 'string' } },
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
      const body = ScenarioBodySchema.parse(request.body);

      const result = await workforceAnalyticsService.runScenarioAnalysis({
        skills: body.skills.map((s) => ({
          skill: s.skill,
          count: s.count,
          experienceLevel: s.experience_level,
          hoursPerWeek: s.hours_per_week,
          priority: s.priority,
        })),
        projectDuration: body.project_duration,
        startDate: new Date(body.start_date),
        location: body.location,
        budget: body.budget,
      });

      return {
        data: {
          scenarios: result.scenarios.map((s) => ({
            name: s.name,
            description: s.description,
            probability: s.probability,
            impact: {
              on_costs: s.impact.onCosts,
              on_timeline: s.impact.onTimeline,
              on_availability: s.impact.onAvailability,
            },
            recommendations: s.recommendations,
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
   * GET /workforce/compare-options
   * Compare freelance vs FTE vs agency
   */
  app.get(
    '/compare-options',
    {
      schema: {
        tags: ['Workforce Planning'],
        summary: 'Compare hiring options',
        description:
          'Compares costs and trade-offs between freelance, full-time, and agency hiring.',
        querystring: CompareOptionsQuerySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  skill: { type: 'string' },
                  hours_per_week: { type: 'number' },
                  duration_months: { type: 'number' },
                  options: {
                    type: 'object',
                    properties: {
                      freelance: {
                        type: 'object',
                        properties: {
                          monthly_cost: { type: 'number' },
                          total_cost: { type: 'number' },
                          pros: { type: 'array', items: { type: 'string' } },
                          cons: { type: 'array', items: { type: 'string' } },
                        },
                      },
                      full_time: {
                        type: 'object',
                        properties: {
                          monthly_cost: { type: 'number' },
                          total_cost: { type: 'number' },
                          pros: { type: 'array', items: { type: 'string' } },
                          cons: { type: 'array', items: { type: 'string' } },
                        },
                      },
                      agency: {
                        type: 'object',
                        properties: {
                          monthly_cost: { type: 'number' },
                          total_cost: { type: 'number' },
                          pros: { type: 'array', items: { type: 'string' } },
                          cons: { type: 'array', items: { type: 'string' } },
                        },
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
      const query = CompareOptionsQuerySchema.parse(request.query);

      const result = await workforceAnalyticsService.compareHiringOptions(
        query.skill,
        query.hours_per_week,
        query.duration_months,
        query.location
      );

      return {
        data: {
          skill: query.skill,
          hours_per_week: query.hours_per_week,
          duration_months: query.duration_months,
          options: {
            freelance: {
              monthly_cost: result.freelance.monthlyCost,
              total_cost: result.freelance.totalCost,
              pros: result.freelance.pros,
              cons: result.freelance.cons,
            },
            full_time: {
              monthly_cost: result.fullTime.monthlyCost,
              total_cost: result.fullTime.totalCost,
              pros: result.fullTime.pros,
              cons: result.fullTime.cons,
            },
            agency: {
              monthly_cost: result.agency.monthlyCost,
              total_cost: result.agency.totalCost,
              pros: result.agency.pros,
              cons: result.agency.cons,
            },
          },
        },
        meta: {
          request_id: request.id,
          timestamp: new Date().toISOString(),
        },
      };
    }
  );
}
