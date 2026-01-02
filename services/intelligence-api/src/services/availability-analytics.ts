/**
 * Availability Analytics Service
 * Sprint M10: Talent Intelligence API
 */

import { structlog } from '@skillancer/logger';

const logger = structlog.get('availability-analytics');

// ============================================================================
// Types
// ============================================================================

export interface AvailabilityData {
  skill: string;
  experienceLevel: string | null;
  location: string | null;
  availableNow: number;
  available7Days: number;
  available30Days: number;
  available90Days: number;
  totalQualified: number;
  availabilityScore: number; // 0-1 scale
  avgHoursPerWeek: number | null;
  totalHoursAvailable: number | null;
  snapshotDate: Date;
}

export interface AvailabilityForecast {
  skill: string;
  location: string | null;
  currentAvailable: number;
  forecast: Array<{
    period: Date;
    projected: number;
    confidence: number;
  }>;
  factors: {
    projectCompletions: number;
    seasonalAdjustment: number;
    growthTrend: number;
  };
}

export interface RegionalAvailability {
  skill: string;
  regions: Array<{
    region: string;
    regionName: string;
    availableNow: number;
    totalQualified: number;
    availabilityScore: number;
    avgRate: number | null;
  }>;
  totalGlobal: number;
}

export interface AvailabilityQueryParams {
  skill: string;
  experienceLevel?: string;
  location?: string;
}

// ============================================================================
// Availability Analytics Service
// ============================================================================

export class AvailabilityAnalyticsService {
  /**
   * Get current availability for a skill
   */
  async getCurrentAvailability(params: AvailabilityQueryParams): Promise<AvailabilityData | null> {
    logger.info('Getting current availability', params);

    const snapshot = await this.queryLatestSnapshot(params);

    if (!snapshot) {
      logger.warn('No availability data found', params);
      return null;
    }

    return {
      skill: params.skill,
      experienceLevel: params.experienceLevel || null,
      location: params.location || null,
      availableNow: snapshot.availableNow,
      available7Days: snapshot.available7Days,
      available30Days: snapshot.available30Days,
      available90Days: snapshot.available90Days,
      totalQualified: snapshot.totalQualified,
      availabilityScore: snapshot.availabilityScore,
      avgHoursPerWeek: snapshot.avgHoursPerWeek,
      totalHoursAvailable: snapshot.totalHoursAvailable,
      snapshotDate: snapshot.snapshotDate,
    };
  }

  /**
   * Forecast future availability
   */
  async forecastAvailability(
    skill: string,
    periods: number = 3, // Number of months to forecast
    location?: string
  ): Promise<AvailabilityForecast> {
    logger.info('Forecasting availability', { skill, periods, location });

    const current = await this.getCurrentAvailability({ skill, location });
    const historical = await this.queryHistoricalSnapshots(skill, 12, location);

    // Calculate growth trend
    const growthTrend = this.calculateGrowthTrend(historical);

    // Calculate seasonal adjustment based on historical patterns
    const seasonalAdjustment = this.calculateSeasonalAdjustment(historical);

    // Estimate project completions that will free up talent
    const projectCompletions = await this.estimateProjectCompletions(skill, location);

    // Generate forecast
    const forecast: AvailabilityForecast['forecast'] = [];
    let projectedAvailable = current?.availableNow || 0;

    for (let i = 1; i <= periods; i++) {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + i);

      // Apply factors
      projectedAvailable = Math.round(
        projectedAvailable * (1 + growthTrend) * seasonalAdjustment + projectCompletions * 0.3 // 30% of completing projects become available
      );

      // Confidence decreases with time
      const confidence = Math.max(0.5, 0.95 - i * 0.1);

      forecast.push({
        period: futureDate,
        projected: projectedAvailable,
        confidence,
      });
    }

    return {
      skill,
      location: location || null,
      currentAvailable: current?.availableNow || 0,
      forecast,
      factors: {
        projectCompletions,
        seasonalAdjustment,
        growthTrend,
      },
    };
  }

  /**
   * Get availability by region
   */
  async getAvailabilityByRegion(
    skill: string,
    experienceLevel?: string
  ): Promise<RegionalAvailability> {
    logger.info('Getting availability by region', { skill, experienceLevel });

    const regions = await this.queryRegionalSnapshots(skill, experienceLevel);

    const totalGlobal = regions.reduce((sum, r) => sum + r.availableNow, 0);

    return {
      skill,
      regions: regions.map((r) => ({
        region: r.region,
        regionName: this.getRegionName(r.region),
        availableNow: r.availableNow,
        totalQualified: r.totalQualified,
        availabilityScore: r.availabilityScore,
        avgRate: r.avgRate,
      })),
      totalGlobal,
    };
  }

  /**
   * Get availability trends over time
   */
  async getAvailabilityTrends(
    skill: string,
    periods: number = 12,
    location?: string
  ): Promise<Array<{ period: Date; available: number; score: number }>> {
    logger.info('Getting availability trends', { skill, periods, location });

    const historical = await this.queryHistoricalSnapshots(skill, periods, location);

    return historical.map((h) => ({
      period: h.snapshotDate,
      available: h.availableNow,
      score: h.availabilityScore,
    }));
  }

  /**
   * Get timezone distribution of available talent
   */
  async getTimezoneDistribution(
    skill: string,
    experienceLevel?: string
  ): Promise<Array<{ timezone: string; available: number; percentage: number }>> {
    logger.info('Getting timezone distribution', { skill, experienceLevel });

    // In production, query from database grouped by timezone
    const timezones = [
      { timezone: 'UTC-8 (Pacific)', available: 450, percentage: 0.25 },
      { timezone: 'UTC-5 (Eastern)', available: 380, percentage: 0.21 },
      { timezone: 'UTC+0 (London)', available: 290, percentage: 0.16 },
      { timezone: 'UTC+1 (CET)', available: 320, percentage: 0.18 },
      { timezone: 'UTC+5:30 (India)', available: 220, percentage: 0.12 },
      { timezone: 'Other', available: 140, percentage: 0.08 },
    ];

    return timezones;
  }

  // ========================================
  // Private Methods
  // ========================================

  private calculateGrowthTrend(
    historical: Array<{ availableNow: number; snapshotDate: Date }>
  ): number {
    if (historical.length < 2) return 0;

    const first = historical[0].availableNow;
    const last = historical[historical.length - 1].availableNow;
    const months = historical.length;

    // Calculate monthly growth rate
    return (last / first) ** (1 / months) - 1;
  }

  private calculateSeasonalAdjustment(
    historical: Array<{ availableNow: number; snapshotDate: Date }>
  ): number {
    // Simplified seasonal adjustment
    // In reality, this would analyze patterns by month
    const currentMonth = new Date().getMonth();

    // Summer months (June-August) typically have higher availability
    if (currentMonth >= 5 && currentMonth <= 7) return 1.1;
    // December typically lower
    if (currentMonth === 11) return 0.9;
    // January usually higher (new year resolutions)
    if (currentMonth === 0) return 1.05;

    return 1.0;
  }

  private async estimateProjectCompletions(skill: string, location?: string): Promise<number> {
    // In production, query contracts with this skill that are ending soon
    return 45; // Mock: 45 projects expected to complete
  }

  private getRegionName(regionCode: string): string {
    const names: Record<string, string> = {
      US: 'United States',
      GB: 'United Kingdom',
      DE: 'Germany',
      IN: 'India',
      CA: 'Canada',
      AU: 'Australia',
      PH: 'Philippines',
      UA: 'Ukraine',
      PL: 'Poland',
      BR: 'Brazil',
    };
    return names[regionCode] || regionCode;
  }

  // ========================================
  // Database Queries (Mock implementations)
  // ========================================

  private async queryLatestSnapshot(params: AvailabilityQueryParams): Promise<any> {
    // Mock data
    return {
      availableNow: 234,
      available7Days: 312,
      available30Days: 456,
      available90Days: 678,
      totalQualified: 1234,
      availabilityScore: 0.72,
      avgHoursPerWeek: 28.5,
      totalHoursAvailable: 6669,
      snapshotDate: new Date(),
    };
  }

  private async queryHistoricalSnapshots(
    skill: string,
    periods: number,
    location?: string
  ): Promise<Array<{ availableNow: number; availabilityScore: number; snapshotDate: Date }>> {
    const results: Array<{ availableNow: number; availabilityScore: number; snapshotDate: Date }> =
      [];
    const now = new Date();

    for (let i = periods - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      results.push({
        availableNow: 200 + Math.floor(Math.random() * 100),
        availabilityScore: 0.65 + Math.random() * 0.15,
        snapshotDate: date,
      });
    }

    return results;
  }

  private async queryRegionalSnapshots(
    skill: string,
    experienceLevel?: string
  ): Promise<
    Array<{
      region: string;
      availableNow: number;
      totalQualified: number;
      availabilityScore: number;
      avgRate: number | null;
    }>
  > {
    // Mock data
    return [
      {
        region: 'US',
        availableNow: 450,
        totalQualified: 1200,
        availabilityScore: 0.68,
        avgRate: 95,
      },
      {
        region: 'GB',
        availableNow: 180,
        totalQualified: 480,
        availabilityScore: 0.72,
        avgRate: 85,
      },
      {
        region: 'DE',
        availableNow: 120,
        totalQualified: 320,
        availabilityScore: 0.75,
        avgRate: 80,
      },
      {
        region: 'IN',
        availableNow: 380,
        totalQualified: 890,
        availabilityScore: 0.82,
        avgRate: 35,
      },
      {
        region: 'UA',
        availableNow: 210,
        totalQualified: 520,
        availabilityScore: 0.78,
        avgRate: 45,
      },
      {
        region: 'PH',
        availableNow: 150,
        totalQualified: 340,
        availabilityScore: 0.85,
        avgRate: 30,
      },
    ];
  }
}

export const availabilityAnalyticsService = new AvailabilityAnalyticsService();
