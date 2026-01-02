/**
 * Data Aggregation Job
 * Sprint M10: Talent Intelligence API
 *
 * Aggregates raw contract, rate, and availability data into
 * anonymized statistical snapshots for the Intelligence API.
 */

import { PrismaClient } from '@prisma/client';
import { structlog } from '@skillancer/logger';

const logger = structlog.get('data-aggregation');
const prisma = new PrismaClient();

// ============================================================================
// Types
// ============================================================================

interface AggregationConfig {
  minSampleSize: number; // Minimum data points for statistical validity
  privacyThreshold: number; // Minimum unique sources for anonymity
  aggregationWindow: number; // Days to include in rolling window
}

interface RateAggregateData {
  skill: string;
  experienceLevel: string | null;
  location: string | null;
  periodType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  periodStart: Date;
  periodEnd: Date;
  sampleSize: number;
  avgRate: number;
  medianRate: number;
  p10Rate: number;
  p25Rate: number;
  p75Rate: number;
  p90Rate: number;
  minRate: number;
  maxRate: number;
  stdDev: number;
}

interface AvailabilitySnapshotData {
  skill: string;
  experienceLevel: string | null;
  location: string | null;
  snapshotDate: Date;
  availableNow: number;
  available7Days: number;
  available30Days: number;
  available90Days: number;
  totalQualified: number;
  avgHoursPerWeek: number | null;
}

interface DemandSignalData {
  skill: string;
  location: string | null;
  signalDate: Date;
  searchVolume: number;
  projectPostings: number;
  hireVelocity: number;
  avgProjectValue: number | null;
  competitionIndex: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: AggregationConfig = {
  minSampleSize: 5, // Need at least 5 data points
  privacyThreshold: 3, // Need at least 3 unique sources
  aggregationWindow: 90, // 90-day rolling window
};

// ============================================================================
// Data Aggregation Job
// ============================================================================

export class DataAggregationJob {
  private config: AggregationConfig;

  constructor(config: Partial<AggregationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Run full aggregation pipeline
   */
  async run(): Promise<void> {
    const startTime = Date.now();
    logger.info('Starting data aggregation job');

    try {
      // Step 1: Aggregate rate data
      await this.aggregateRates();

      // Step 2: Create availability snapshots
      await this.aggregateAvailability();

      // Step 3: Generate demand signals
      await this.aggregateDemandSignals();

      // Step 4: Cleanup old granular data
      await this.cleanupOldData();

      const duration = Date.now() - startTime;
      logger.info('Data aggregation job completed', { durationMs: duration });
    } catch (error) {
      logger.error('Data aggregation job failed', { error });
      throw error;
    }
  }

  /**
   * Aggregate hourly rate data into statistical summaries
   */
  async aggregateRates(): Promise<void> {
    logger.info('Aggregating rate data');

    const skills = await this.getActiveSkills();

    for (const skill of skills) {
      try {
        // Get raw rate data for this skill
        const rawRates = await this.getRawRateData(skill);

        if (rawRates.length < this.config.minSampleSize) {
          logger.debug('Skipping skill due to insufficient data', {
            skill,
            sampleSize: rawRates.length,
          });
          continue;
        }

        // Check privacy threshold
        const uniqueSources = new Set(rawRates.map((r) => r.sourceId)).size;
        if (uniqueSources < this.config.privacyThreshold) {
          logger.debug('Skipping skill due to privacy threshold', {
            skill,
            uniqueSources,
          });
          continue;
        }

        // Calculate aggregates by experience level and location
        const aggregates = this.calculateRateAggregates(skill, rawRates);

        // Store aggregates
        for (const aggregate of aggregates) {
          await this.storeRateAggregate(aggregate);
        }

        logger.debug('Aggregated rates for skill', { skill, aggregates: aggregates.length });
      } catch (error) {
        logger.error('Failed to aggregate rates for skill', { skill, error });
      }
    }
  }

  /**
   * Create availability snapshots
   */
  async aggregateAvailability(): Promise<void> {
    logger.info('Aggregating availability data');

    const skills = await this.getActiveSkills();

    for (const skill of skills) {
      try {
        const availability = await this.calculateAvailability(skill);

        for (const snapshot of availability) {
          await this.storeAvailabilitySnapshot(snapshot);
        }

        logger.debug('Created availability snapshot for skill', {
          skill,
          snapshots: availability.length,
        });
      } catch (error) {
        logger.error('Failed to aggregate availability for skill', { skill, error });
      }
    }
  }

  /**
   * Generate demand signals from platform activity
   */
  async aggregateDemandSignals(): Promise<void> {
    logger.info('Aggregating demand signals');

    const skills = await this.getActiveSkills();

    for (const skill of skills) {
      try {
        const signals = await this.calculateDemandSignals(skill);

        for (const signal of signals) {
          await this.storeDemandSignal(signal);
        }

        logger.debug('Created demand signals for skill', {
          skill,
          signals: signals.length,
        });
      } catch (error) {
        logger.error('Failed to aggregate demand for skill', { skill, error });
      }
    }
  }

  /**
   * Cleanup old granular data to maintain privacy
   */
  async cleanupOldData(): Promise<void> {
    logger.info('Cleaning up old granular data');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.aggregationWindow);

    // In production, delete raw rate data older than cutoff
    // keeping only aggregated statistics
    logger.info('Cleanup completed', { cutoffDate });
  }

  // ========================================
  // Private Calculation Methods
  // ========================================

  private calculateRateAggregates(
    skill: string,
    rawRates: Array<{
      rate: number;
      experienceLevel: string | null;
      location: string | null;
      sourceId: string;
      recordedAt: Date;
    }>
  ): RateAggregateData[] {
    const aggregates: RateAggregateData[] = [];

    // Group by experience level and location
    const groups = this.groupRates(rawRates);

    for (const [key, rates] of Object.entries(groups)) {
      if (rates.length < this.config.minSampleSize) continue;

      const [experienceLevel, location] = key.split('|');
      const sortedRates = rates.map((r) => r.rate).sort((a, b) => a - b);

      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      aggregates.push({
        skill,
        experienceLevel: experienceLevel || null,
        location: location || null,
        periodType: 'MONTHLY',
        periodStart,
        periodEnd,
        sampleSize: rates.length,
        avgRate: this.calculateMean(sortedRates),
        medianRate: this.calculatePercentile(sortedRates, 50),
        p10Rate: this.calculatePercentile(sortedRates, 10),
        p25Rate: this.calculatePercentile(sortedRates, 25),
        p75Rate: this.calculatePercentile(sortedRates, 75),
        p90Rate: this.calculatePercentile(sortedRates, 90),
        minRate: sortedRates[0],
        maxRate: sortedRates[sortedRates.length - 1],
        stdDev: this.calculateStdDev(sortedRates),
      });
    }

    return aggregates;
  }

  private groupRates(
    rates: Array<{
      rate: number;
      experienceLevel: string | null;
      location: string | null;
      sourceId: string;
    }>
  ): Record<string, typeof rates> {
    const groups: Record<string, typeof rates> = {};

    for (const rate of rates) {
      const key = `${rate.experienceLevel || ''}|${rate.location || ''}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(rate);
    }

    return groups;
  }

  private calculateMean(values: number[]): number {
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  private calculateStdDev(values: number[]): number {
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.round(Math.sqrt(variance) * 100) / 100;
  }

  private async calculateAvailability(skill: string): Promise<AvailabilitySnapshotData[]> {
    // Mock implementation - in production query freelancer availability
    return [
      {
        skill,
        experienceLevel: null,
        location: null,
        snapshotDate: new Date(),
        availableNow: 234,
        available7Days: 312,
        available30Days: 456,
        available90Days: 678,
        totalQualified: 1234,
        avgHoursPerWeek: 28.5,
      },
    ];
  }

  private async calculateDemandSignals(skill: string): Promise<DemandSignalData[]> {
    // Mock implementation - in production analyze search/posting data
    return [
      {
        skill,
        location: null,
        signalDate: new Date(),
        searchVolume: 2450,
        projectPostings: 890,
        hireVelocity: 0.72,
        avgProjectValue: 12500,
        competitionIndex: 1.2,
      },
    ];
  }

  // ========================================
  // Database Operations (Mock)
  // ========================================

  private async getActiveSkills(): Promise<string[]> {
    // Mock - in production query from skills table
    return [
      'React',
      'Node.js',
      'Python',
      'TypeScript',
      'AWS',
      'Kubernetes',
      'Machine Learning',
      'Go',
      'Rust',
      'Vue.js',
    ];
  }

  private async getRawRateData(skill: string): Promise<
    Array<{
      rate: number;
      experienceLevel: string | null;
      location: string | null;
      sourceId: string;
      recordedAt: Date;
    }>
  > {
    // Mock - in production query from contracts/proposals
    const mockData = [];
    for (let i = 0; i < 50; i++) {
      mockData.push({
        rate: 60 + Math.floor(Math.random() * 80),
        experienceLevel: ['junior', 'mid', 'senior', 'expert'][Math.floor(Math.random() * 4)],
        location: ['US', 'GB', 'DE', 'IN'][Math.floor(Math.random() * 4)],
        sourceId: `source-${i}`,
        recordedAt: new Date(),
      });
    }
    return mockData;
  }

  private async storeRateAggregate(aggregate: RateAggregateData): Promise<void> {
    // Mock - in production upsert to RateAggregate table
    logger.debug('Storing rate aggregate', {
      skill: aggregate.skill,
      sampleSize: aggregate.sampleSize,
    });
  }

  private async storeAvailabilitySnapshot(snapshot: AvailabilitySnapshotData): Promise<void> {
    // Mock - in production insert to AvailabilitySnapshot table
    logger.debug('Storing availability snapshot', { skill: snapshot.skill });
  }

  private async storeDemandSignal(signal: DemandSignalData): Promise<void> {
    // Mock - in production insert to DemandSignal table
    logger.debug('Storing demand signal', { skill: signal.skill });
  }
}

// ============================================================================
// Job Entry Point
// ============================================================================

export async function runDataAggregation(): Promise<void> {
  const job = new DataAggregationJob();
  await job.run();
}

// CLI execution
if (require.main === module) {
  runDataAggregation()
    .then(() => {
      logger.info('Data aggregation completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Data aggregation failed', { error });
      process.exit(1);
    });
}
