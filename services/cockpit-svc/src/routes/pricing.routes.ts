// @ts-nocheck
/**
 * Pricing Recommendation API Routes
 *
 * Endpoints for skill-based pricing recommendations, market benchmarks,
 * revenue projections, and rate history.
 */

import { PrismaClient } from '@skillancer/database';
import { Router, type Request, type Response, type NextFunction } from 'express';
import Redis from 'ioredis';
import { z } from 'zod';

import { MarketRateBenchmarkRepository } from '../repositories/market-benchmark.repository.js';
import { PricingRecommendationRepository } from '../repositories/pricing-recommendation.repository.js';
import { RateHistoryRepository } from '../repositories/rate-history.repository.js';
import { RevenueProjectionRepository } from '../repositories/revenue-projection.repository.js';
import { SkillRateRepository } from '../repositories/skill-rate.repository.js';
import { ExternalRatesService } from '../services/external-rates.service.js';
import { MLPricingService } from '../services/ml-pricing.service.js';
import { PricingRecommendationService } from '../services/pricing-recommendation.service.js';

const router = Router();

// Initialize dependencies
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const skillRateRepo = new SkillRateRepository(prisma);
const benchmarkRepo = new MarketRateBenchmarkRepository(prisma);
const recommendationRepo = new PricingRecommendationRepository(prisma);
const rateHistoryRepo = new RateHistoryRepository(prisma);
const projectionRepo = new RevenueProjectionRepository(prisma);

const mlPricingService = new MLPricingService(redis);
const externalRatesService = new ExternalRatesService(redis);

// Stub API clients (would be replaced with actual implementations)
const skillPodClient = {
  async getSkillVerification(_userId: string, _skillId: string) {
    return null;
  },
  async getCredentialsForSkill(_userId: string, _skillId: string) {
    return [];
  },
  async getVerifiedSkills(_userId: string) {
    return [];
  },
};

const marketClient = {
  async getSkillRateData(_skillId: string) {
    return null;
  },
};

const cockpitDataService = {
  async getProjectHistoryForSkill(_userId: string, _skillId: string) {
    return {
      projectCount: 0,
      avgRating: 0,
      successRate: 0,
      repeatClientRate: 0,
      yearsExperience: 0,
      totalEarnings: 0,
      avgProjectValue: 0,
    };
  },
  async getProfileSkills(_userId: string) {
    return [];
  },
  async updateProfileSkillRate(_userId: string, _skillId: string, _rate: number) {
    // Update profile
  },
};

const pricingService = new PricingRecommendationService(
  skillRateRepo,
  benchmarkRepo,
  recommendationRepo,
  rateHistoryRepo,
  projectionRepo,
  skillPodClient,
  marketClient,
  cockpitDataService,
  externalRatesService,
  mlPricingService,
  redis
);

// ==================== Dashboard ====================

/**
 * GET /pricing/dashboard
 * Get comprehensive pricing dashboard
 */
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const dashboard = await pricingService.getPricingDashboard(userId);
    res.json(dashboard);
  } catch (error) {
    next(error);
  }
});

// ==================== Skill Rates ====================

/**
 * GET /pricing/skill-rates
 * Get all skill rates for the user
 */
router.get('/skill-rates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const skillRates = await pricingService.getSkillRates(userId);

    res.json({
      skillRates: skillRates.map((r) => ({
        skillId: r.skillId,
        skillName: r.skillName,
        currentHourlyRate: r.currentHourlyRate ? Number(r.currentHourlyRate) : null,
        currentProjectRate: r.currentProjectRate ? Number(r.currentProjectRate) : null,
        currency: r.currency,
        recommendedMinRate: r.recommendedMinRate ? Number(r.recommendedMinRate) : null,
        recommendedOptimalRate: r.recommendedOptimalRate ? Number(r.recommendedOptimalRate) : null,
        recommendedMaxRate: r.recommendedMaxRate ? Number(r.recommendedMaxRate) : null,
        confidenceScore: Number(r.confidenceScore),
        skillLevel: r.skillLevel,
        verificationScore: r.verificationScore ? Number(r.verificationScore) : null,
        experienceYears: r.experienceYears ? Number(r.experienceYears) : null,
        projectsCompleted: r.projectsCompleted,
        avgClientRating: r.avgClientRating ? Number(r.avgClientRating) : null,
        marketPosition: r.marketPosition,
        marketDemand: r.marketDemand,
        competitionLevel: r.competitionLevel,
        calculatedAt: r.calculatedAt,
        validUntil: r.validUntil,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /pricing/skill-rates/:skillId
 * Get skill rate for a specific skill
 */
router.get('/skill-rates/:skillId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { skillId } = req.params;
    const skillRate = await skillRateRepo.findByUserAndSkill(userId, skillId);

    if (!skillRate) {
      return res.status(404).json({ error: 'Skill rate not found' });
    }

    res.json({ skillRate });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /pricing/skill-rates/:skillId/calculate
 * Calculate/recalculate rate for a specific skill
 */
router.post(
  '/skill-rates/:skillId/calculate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { skillId } = req.params;
      const skillRate = await pricingService.calculateSkillRate(userId, skillId);

      // Check if a recommendation was created
      const recommendations = await recommendationRepo.findActive(userId, 1);
      const latestRecommendation = recommendations.find((r) => r.skillId === skillId);

      res.json({
        skillRate: {
          skillId: skillRate.skillId,
          skillName: skillRate.skillName,
          currentHourlyRate: skillRate.currentHourlyRate
            ? Number(skillRate.currentHourlyRate)
            : null,
          recommendedMinRate: skillRate.recommendedMinRate
            ? Number(skillRate.recommendedMinRate)
            : null,
          recommendedOptimalRate: skillRate.recommendedOptimalRate
            ? Number(skillRate.recommendedOptimalRate)
            : null,
          recommendedMaxRate: skillRate.recommendedMaxRate
            ? Number(skillRate.recommendedMaxRate)
            : null,
          confidenceScore: Number(skillRate.confidenceScore),
          marketPosition: skillRate.marketPosition,
          marketDemand: skillRate.marketDemand,
          calculatedAt: skillRate.calculatedAt,
        },
        recommendation: latestRecommendation
          ? {
              id: latestRecommendation.id,
              type: latestRecommendation.recommendationType,
              currentRate: Number(latestRecommendation.currentRate),
              recommendedRate: Number(latestRecommendation.recommendedRate),
              yearlyImpact: Number(latestRecommendation.projectedYearlyImpact),
              reasoning: latestRecommendation.reasoning,
            }
          : undefined,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /pricing/skill-rates/calculate-all
 * Calculate rates for all skills
 */
router.post(
  '/skill-rates/calculate-all',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const skillRates = await pricingService.calculateAllSkillRates(userId);

      res.json({
        skillRates: skillRates.map((r) => ({
          skillId: r.skillId,
          skillName: r.skillName,
          recommendedOptimalRate: r.recommendedOptimalRate
            ? Number(r.recommendedOptimalRate)
            : null,
          confidenceScore: Number(r.confidenceScore),
          marketPosition: r.marketPosition,
        })),
        count: skillRates.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /pricing/skill-rates/:skillId
 * Update current rate for a skill
 */
router.patch('/skill-rates/:skillId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { skillId } = req.params;
    const { currentHourlyRate } = z
      .object({
        currentHourlyRate: z.number().positive(),
      })
      .parse(req.body);

    const updated = await skillRateRepo.update(skillId, userId, {
      currentHourlyRate,
    });

    // Record in history
    await rateHistoryRepo.create({
      userId,
      skillId,
      skillName: updated.skillName,
      hourlyRate: currentHourlyRate,
      source: 'MANUAL',
      effectiveDate: new Date(),
    });

    res.json({ skillRate: updated });
  } catch (error) {
    next(error);
  }
});

// ==================== Recommendations ====================

/**
 * GET /pricing/recommendations
 * Get pricing recommendations
 */
router.get('/recommendations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { status, skillId, limit } = z
      .object({
        status: z
          .string()
          .transform((s) => s.split(','))
          .optional(),
        skillId: z.string().uuid().optional(),
        limit: z.coerce.number().min(1).max(50).default(20),
      })
      .parse(req.query);

    const recommendations = await pricingService.getRecommendations(userId, {
      status: status as any,
      skillId,
      limit,
    });

    res.json({
      recommendations: recommendations.map((r) => ({
        id: r.id,
        recommendationType: r.recommendationType,
        scope: r.scope,
        skillId: r.skillId,
        skillName: r.skillName,
        currentRate: r.currentRate ? Number(r.currentRate) : null,
        recommendedRate: Number(r.recommendedRate),
        rateChange: Number(r.rateChange),
        rateChangePercent: Number(r.rateChangePercent),
        projectedMonthlyImpact: r.projectedMonthlyImpact ? Number(r.projectedMonthlyImpact) : null,
        projectedYearlyImpact: r.projectedYearlyImpact ? Number(r.projectedYearlyImpact) : null,
        confidenceScore: Number(r.confidenceScore),
        reasoning: r.reasoning,
        marketPosition: r.marketPosition,
        competitorAnalysis: r.competitorAnalysis,
        status: r.status,
        validFrom: r.validFrom,
        validUntil: r.validUntil,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /pricing/recommendations/:id
 * Get a specific recommendation
 */
router.get('/recommendations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const recommendation = await recommendationRepo.findById(req.params.id);

    if (!recommendation || recommendation.userId !== userId) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    // Mark as viewed if pending
    if (recommendation.status === 'PENDING') {
      await recommendationRepo.markViewed(recommendation.id);
    }

    res.json({ recommendation });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /pricing/recommendations/:id/apply
 * Apply a recommendation
 */
router.post(
  '/recommendations/:id/apply',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await pricingService.applyRecommendation(userId, req.params.id);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /pricing/recommendations/:id/dismiss
 * Dismiss a recommendation
 */
router.post(
  '/recommendations/:id/dismiss',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { reason } = z
        .object({
          reason: z.string().max(500).optional(),
        })
        .parse(req.body);

      await pricingService.dismissRecommendation(userId, req.params.id, reason);

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== Market Benchmarks ====================

/**
 * GET /pricing/benchmarks/:skillId
 * Get market benchmark for a skill
 */
router.get('/benchmarks/:skillId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { skillId } = req.params;
    const { region } = z
      .object({
        region: z.string().default('GLOBAL'),
      })
      .parse(req.query);

    const benchmark = await pricingService.getBenchmarkForSkill(skillId, region);

    if (!benchmark) {
      return res.status(404).json({ error: 'Benchmark not found' });
    }

    res.json({
      benchmark: {
        skillId: benchmark.skillId,
        skillName: benchmark.skillName,
        category: benchmark.category,
        region: benchmark.region,
        rateP10: Number(benchmark.rateP10),
        rateP25: Number(benchmark.rateP25),
        rateP50: Number(benchmark.rateP50),
        rateP75: Number(benchmark.rateP75),
        rateP90: Number(benchmark.rateP90),
        rateMean: Number(benchmark.rateMean),
        beginnerRate: benchmark.beginnerRate ? Number(benchmark.beginnerRate) : null,
        intermediateRate: benchmark.intermediateRate ? Number(benchmark.intermediateRate) : null,
        advancedRate: benchmark.advancedRate ? Number(benchmark.advancedRate) : null,
        expertRate: benchmark.expertRate ? Number(benchmark.expertRate) : null,
        sampleSize: benchmark.sampleSize,
        jobCount: benchmark.jobCount,
        freelancerCount: benchmark.freelancerCount,
        demandScore: Number(benchmark.demandScore),
        rateChangeMonthly: benchmark.rateChangeMonthly ? Number(benchmark.rateChangeMonthly) : null,
        trendDirection: benchmark.trendDirection,
        sources: benchmark.sources,
        periodStart: benchmark.periodStart,
        periodEnd: benchmark.periodEnd,
        generatedAt: benchmark.generatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /pricing/benchmarks/:skillId/refresh
 * Refresh/update benchmark data for a skill
 */
router.post(
  '/benchmarks/:skillId/refresh',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { skillId } = req.params;
      const benchmark = await pricingService.updateMarketBenchmarks(skillId);

      res.json({ benchmark });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /pricing/benchmarks
 * Get benchmarks for multiple skills (trending, high-demand, etc.)
 */
router.get('/benchmarks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { filter, limit, region } = z
      .object({
        filter: z.enum(['trending', 'high-demand', 'all']).default('all'),
        limit: z.coerce.number().min(1).max(50).default(20),
        region: z.string().optional(),
      })
      .parse(req.query);

    let benchmarks;
    if (filter === 'trending') {
      benchmarks = await benchmarkRepo.findTrending('RISING', region, limit);
    } else if (filter === 'high-demand') {
      benchmarks = await benchmarkRepo.findHighDemand(70, region, limit);
    } else {
      benchmarks = await benchmarkRepo.findHighDemand(0, region, limit);
    }

    res.json({
      benchmarks: benchmarks.map((b) => ({
        skillId: b.skillId,
        skillName: b.skillName,
        category: b.category,
        rateP50: Number(b.rateP50),
        rateP90: Number(b.rateP90),
        demandScore: Number(b.demandScore),
        trendDirection: b.trendDirection,
        jobCount: b.jobCount,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ==================== Revenue Projections ====================

/**
 * GET /pricing/projections
 * Get revenue projections
 */
router.get('/projections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const projections = await pricingService.getProjections(userId);

    res.json({
      projections: projections.map((p) => ({
        id: p.id,
        scenarioName: p.scenarioName,
        scenarioType: p.scenarioType,
        hourlyRate: Number(p.hourlyRate),
        hoursPerWeek: Number(p.hoursPerWeek),
        weeksPerYear: Number(p.weeksPerYear),
        utilizationRate: Number(p.utilizationRate),
        weeklyRevenue: Number(p.weeklyRevenue),
        monthlyRevenue: Number(p.monthlyRevenue),
        yearlyRevenue: Number(p.yearlyRevenue),
        monthlyExpenses: p.monthlyExpenses ? Number(p.monthlyExpenses) : null,
        yearlyExpenses: p.yearlyExpenses ? Number(p.yearlyExpenses) : null,
        monthlyNetIncome: p.monthlyNetIncome ? Number(p.monthlyNetIncome) : null,
        yearlyNetIncome: p.yearlyNetIncome ? Number(p.yearlyNetIncome) : null,
        vsCurrentMonthly: p.vsCurrentMonthly ? Number(p.vsCurrentMonthly) : null,
        vsCurrentYearly: p.vsCurrentYearly ? Number(p.vsCurrentYearly) : null,
        isActive: p.isActive,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /pricing/projections
 * Create a custom projection
 */
router.post('/projections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const data = z
      .object({
        name: z.string().min(1).max(100),
        hourlyRate: z.number().positive(),
        hoursPerWeek: z.number().positive().max(80),
        weeksPerYear: z.number().positive().max(52).optional(),
        utilizationRate: z.number().min(0).max(100).optional(),
        monthlyExpenses: z.number().min(0).optional(),
      })
      .parse(req.body);

    const projection = await pricingService.createCustomProjection(userId, data);

    res.status(201).json({ projection });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /pricing/projections/calculate
 * Recalculate all projections
 */
router.post('/projections/calculate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const params = z
      .object({
        hourlyRate: z.number().positive().optional(),
        hoursPerWeek: z.number().positive().max(80).optional(),
        weeksPerYear: z.number().positive().max(52).optional(),
        utilizationRate: z.number().min(0).max(100).optional(),
        monthlyExpenses: z.number().min(0).optional(),
      })
      .parse(req.body);

    const projections = await pricingService.calculateRevenueProjections(userId, params);

    res.json({
      projections: projections.map((p) => ({
        id: p.id,
        scenarioName: p.scenarioName,
        scenarioType: p.scenarioType,
        monthlyRevenue: Number(p.monthlyRevenue),
        yearlyRevenue: Number(p.yearlyRevenue),
        monthlyNetIncome: p.monthlyNetIncome ? Number(p.monthlyNetIncome) : null,
        yearlyNetIncome: p.yearlyNetIncome ? Number(p.yearlyNetIncome) : null,
        vsCurrentMonthly: p.vsCurrentMonthly ? Number(p.vsCurrentMonthly) : null,
        vsCurrentYearly: p.vsCurrentYearly ? Number(p.vsCurrentYearly) : null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /pricing/projections/:id
 * Delete a custom projection
 */
router.delete('/projections/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await pricingService.deleteProjection(userId, req.params.id);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ==================== Rate History ====================

/**
 * GET /pricing/rate-history
 * Get rate history
 */
router.get('/rate-history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { skillId, months } = z
      .object({
        skillId: z.string().optional(),
        months: z.coerce.number().min(1).max(24).default(12),
      })
      .parse(req.query);

    const { history, trend } = await pricingService.getRateHistory(userId, {
      skillId,
      months,
    });

    res.json({
      history: history.map((h) => ({
        id: h.id,
        skillId: h.skillId,
        skillName: h.skillName,
        hourlyRate: Number(h.hourlyRate),
        currency: h.currency,
        source: h.source,
        projectId: h.projectId,
        contractId: h.contractId,
        clientRating: h.clientRating ? Number(h.clientRating) : null,
        projectSuccess: h.projectSuccess,
        repeatClient: h.repeatClient,
        effectiveDate: h.effectiveDate,
        createdAt: h.createdAt,
      })),
      trend,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /pricing/rate-history
 * Record a rate in history
 */
router.post('/rate-history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const data = z
      .object({
        skillId: z.string().optional(),
        skillName: z.string().optional(),
        hourlyRate: z.number().positive(),
        source: z.enum(['MANUAL', 'PROJECT', 'CONTRACT', 'PROFILE', 'RECOMMENDATION']),
        projectId: z.string().uuid().optional(),
        contractId: z.string().optional(),
        clientRating: z.number().min(0).max(5).optional(),
        projectSuccess: z.boolean().optional(),
        repeatClient: z.boolean().optional(),
      })
      .parse(req.body);

    const entry = await pricingService.recordRate(userId, data);

    res.status(201).json({ entry });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /pricing/rate-history/stats
 * Get rate statistics
 */
router.get('/rate-history/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { months } = z
      .object({
        months: z.coerce.number().min(1).max(24).default(12),
      })
      .parse(req.query);

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const stats = await rateHistoryRepo.getStats(userId, startDate);

    res.json({ stats });
  } catch (error) {
    next(error);
  }
});

export default router;
