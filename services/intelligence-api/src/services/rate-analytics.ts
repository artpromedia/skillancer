/**
 * Rate Analytics Service
 * Sprint M10: Talent Intelligence API
 */

import { structlog } from '@skillancer/logger';

const logger = structlog.get('rate-analytics');

// ============================================================================
// Types
// ============================================================================

export interface RateBenchmark {
  skill: string;
  experienceLevel: string | null;
  location: string | null;
  projectType: string | null;
  sampleSize: number;
  rates: {
    hourly: {
      p10: number;
      p25: number;
      p50: number;
      p75: number;
      p90: number;
      mean: number;
    };
    fixedProject: {
      average: number | null;
      median: number | null;
    };
  };
  trend: {
    yoyChange: number | null;
    qoqChange: number | null;
    momChange: number | null;
    direction: 'up' | 'down' | 'stable';
  };
  dataQuality: {
    confidence: number; // 0-1
    freshness: string; // "current", "recent", "stale"
    lastUpdated: Date;
  };
}

export interface RateComparison {
  baseSkill: string;
  comparisons: Array<{
    skill: string;
    p50Rate: number;
    difference: number; // percentage vs base
    sampleSize: number;
  }>;
}

export interface RateHistory {
  skill: string;
  experienceLevel: string | null;
  location: string | null;
  dataPoints: Array<{
    period: Date;
    p50: number;
    p25: number;
    p75: number;
    sampleSize: number;
  }>;
  trendLine: {
    slope: number;
    direction: 'up' | 'down' | 'stable';
    rSquared: number;
  };
}

export interface RateQueryParams {
  skill: string;
  experienceLevel?: string;
  location?: string;
  projectType?: string;
}

// ============================================================================
// Constants
// ============================================================================

const MINIMUM_SAMPLE_SIZE = 10;
const CONFIDENCE_THRESHOLDS = {
  HIGH: 100,
  MEDIUM: 50,
  LOW: 10,
};

const EXPERIENCE_LEVELS = ['junior', 'mid', 'senior', 'expert', 'lead'];
const PROJECT_TYPES = ['hourly', 'fixed', 'retainer'];

// ============================================================================
// Rate Analytics Service
// ============================================================================

export class RateAnalyticsService {
  /**
   * Get rate benchmark for a skill
   */
  async getBenchmark(params: RateQueryParams): Promise<RateBenchmark | null> {
    logger.info('Getting rate benchmark', params);

    // In production, query from RateAggregate table
    const aggregateData = await this.queryRateAggregate(params);

    if (!aggregateData || aggregateData.sampleSize < MINIMUM_SAMPLE_SIZE) {
      logger.warn('Insufficient sample size', {
        skill: params.skill,
        sampleSize: aggregateData?.sampleSize || 0,
      });
      return null;
    }

    // Calculate confidence based on sample size
    const confidence = this.calculateConfidence(aggregateData.sampleSize);
    const freshness = this.calculateFreshness(aggregateData.calculatedAt);

    // Determine trend direction
    const direction = this.getTrendDirection(aggregateData.yoyChange);

    return {
      skill: params.skill,
      experienceLevel: params.experienceLevel || null,
      location: params.location || null,
      projectType: params.projectType || null,
      sampleSize: aggregateData.sampleSize,
      rates: {
        hourly: {
          p10: aggregateData.p10,
          p25: aggregateData.p25,
          p50: aggregateData.p50,
          p75: aggregateData.p75,
          p90: aggregateData.p90,
          mean: aggregateData.mean,
        },
        fixedProject: {
          average: aggregateData.fixedProjectAvg,
          median: aggregateData.fixedProjectP50,
        },
      },
      trend: {
        yoyChange: aggregateData.yoyChange,
        qoqChange: aggregateData.qoqChange,
        momChange: aggregateData.momChange,
        direction,
      },
      dataQuality: {
        confidence,
        freshness,
        lastUpdated: aggregateData.calculatedAt,
      },
    };
  }

  /**
   * Compare rates across multiple skills
   */
  async compareRates(
    baseSkill: string,
    compareSkills: string[],
    options?: { experienceLevel?: string; location?: string }
  ): Promise<RateComparison> {
    logger.info('Comparing rates', { baseSkill, compareSkills });

    const baseBenchmark = await this.getBenchmark({
      skill: baseSkill,
      ...options,
    });

    if (!baseBenchmark) {
      throw new Error(`No benchmark data for base skill: ${baseSkill}`);
    }

    const comparisons = await Promise.all(
      compareSkills.map(async (skill) => {
        const benchmark = await this.getBenchmark({
          skill,
          ...options,
        });

        if (!benchmark) {
          return null;
        }

        const difference =
          ((benchmark.rates.hourly.p50 - baseBenchmark.rates.hourly.p50) /
            baseBenchmark.rates.hourly.p50) *
          100;

        return {
          skill,
          p50Rate: benchmark.rates.hourly.p50,
          difference: Math.round(difference * 10) / 10,
          sampleSize: benchmark.sampleSize,
        };
      })
    );

    return {
      baseSkill,
      comparisons: comparisons.filter((c) => c !== null) as RateComparison['comparisons'],
    };
  }

  /**
   * Get historical rate data
   */
  async getRateHistory(
    skill: string,
    options?: {
      experienceLevel?: string;
      location?: string;
      periods?: number; // Number of months
    }
  ): Promise<RateHistory> {
    logger.info('Getting rate history', { skill, options });

    const periods = options?.periods || 12;
    const dataPoints = await this.queryHistoricalRates(skill, periods, options);

    // Calculate trend line
    const trendLine = this.calculateTrendLine(dataPoints);

    return {
      skill,
      experienceLevel: options?.experienceLevel || null,
      location: options?.location || null,
      dataPoints,
      trendLine,
    };
  }

  /**
   * Get rates by location comparison
   */
  async getRatesByLocation(
    skill: string,
    locations: string[],
    experienceLevel?: string
  ): Promise<Array<{ location: string; p50: number; sampleSize: number }>> {
    logger.info('Getting rates by location', { skill, locations });

    const results = await Promise.all(
      locations.map(async (location) => {
        const benchmark = await this.getBenchmark({
          skill,
          location,
          experienceLevel,
        });

        return benchmark
          ? {
              location,
              p50: benchmark.rates.hourly.p50,
              sampleSize: benchmark.sampleSize,
            }
          : null;
      })
    );

    return results.filter((r) => r !== null) as Array<{
      location: string;
      p50: number;
      sampleSize: number;
    }>;
  }

  /**
   * Get rates by experience level
   */
  async getRatesByExperience(
    skill: string,
    location?: string
  ): Promise<Array<{ level: string; p50: number; p25: number; p75: number; sampleSize: number }>> {
    logger.info('Getting rates by experience', { skill, location });

    const results = await Promise.all(
      EXPERIENCE_LEVELS.map(async (level) => {
        const benchmark = await this.getBenchmark({
          skill,
          experienceLevel: level,
          location,
        });

        return benchmark
          ? {
              level,
              p50: benchmark.rates.hourly.p50,
              p25: benchmark.rates.hourly.p25,
              p75: benchmark.rates.hourly.p75,
              sampleSize: benchmark.sampleSize,
            }
          : null;
      })
    );

    return results.filter((r) => r !== null) as Array<{
      level: string;
      p50: number;
      p25: number;
      p75: number;
      sampleSize: number;
    }>;
  }

  // ========================================
  // Private Methods
  // ========================================

  private calculateConfidence(sampleSize: number): number {
    if (sampleSize >= CONFIDENCE_THRESHOLDS.HIGH) return 0.95;
    if (sampleSize >= CONFIDENCE_THRESHOLDS.MEDIUM) return 0.8;
    if (sampleSize >= CONFIDENCE_THRESHOLDS.LOW) return 0.6;
    return 0.4;
  }

  private calculateFreshness(calculatedAt: Date): 'current' | 'recent' | 'stale' {
    const ageInDays = (Date.now() - calculatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays <= 1) return 'current';
    if (ageInDays <= 7) return 'recent';
    return 'stale';
  }

  private getTrendDirection(yoyChange: number | null): 'up' | 'down' | 'stable' {
    if (yoyChange === null) return 'stable';
    if (yoyChange > 0.02) return 'up';
    if (yoyChange < -0.02) return 'down';
    return 'stable';
  }

  private calculateTrendLine(
    dataPoints: Array<{ period: Date; p50: number }>
  ): RateHistory['trendLine'] {
    if (dataPoints.length < 3) {
      return { slope: 0, direction: 'stable', rSquared: 0 };
    }

    // Simple linear regression
    const n = dataPoints.length;
    const xValues = dataPoints.map((_, i) => i);
    const yValues = dataPoints.map((d) => d.p50);

    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    // R-squared calculation
    const meanY = sumY / n;
    const ssTotal = yValues.reduce((sum, y) => sum + (y - meanY) ** 2, 0);
    const ssResidual = yValues.reduce((sum, y, i) => {
      const predicted = meanY + slope * (i - (n - 1) / 2);
      return sum + (y - predicted) ** 2;
    }, 0);
    const rSquared = 1 - ssResidual / ssTotal;

    return {
      slope: Math.round(slope * 100) / 100,
      direction: slope > 0.5 ? 'up' : slope < -0.5 ? 'down' : 'stable',
      rSquared: Math.round(rSquared * 100) / 100,
    };
  }

  // ========================================
  // Database Queries (Mock implementations)
  // ========================================

  private async queryRateAggregate(params: RateQueryParams): Promise<any> {
    // In production, query from RateAggregate table
    // Mock data for development
    return {
      skill: params.skill,
      sampleSize: 1547,
      p10: 45,
      p25: 65,
      p50: 85,
      p75: 115,
      p90: 150,
      mean: 92,
      fixedProjectAvg: 2500,
      fixedProjectP50: 2200,
      yoyChange: 0.08,
      qoqChange: 0.02,
      momChange: 0.01,
      calculatedAt: new Date(),
    };
  }

  private async queryHistoricalRates(
    skill: string,
    periods: number,
    options?: { experienceLevel?: string; location?: string }
  ): Promise<RateHistory['dataPoints']> {
    // Mock historical data
    const dataPoints: RateHistory['dataPoints'] = [];
    const now = new Date();

    for (let i = periods - 1; i >= 0; i--) {
      const period = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const baseRate = 80 + i * 0.5; // Slight upward trend

      dataPoints.push({
        period,
        p50: Math.round(baseRate),
        p25: Math.round(baseRate * 0.75),
        p75: Math.round(baseRate * 1.35),
        sampleSize: 1200 + Math.floor(Math.random() * 500),
      });
    }

    return dataPoints;
  }
}

export const rateAnalyticsService = new RateAnalyticsService();
