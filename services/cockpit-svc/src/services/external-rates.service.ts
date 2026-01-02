// @ts-nocheck
/**
 * External Rates Service
 *
 * Fetches and normalizes rate data from external platforms.
 * (Upwork, Fiverr, Glassdoor, etc.)
 */

import { logger } from '@skillancer/logger';

import type { ExternalRateData } from '@skillancer/types/cockpit';
import type { Redis } from 'ioredis';

interface NormalizedRate {
  rate: number;
  level?: string;
  weight?: number;
}

interface ExternalRatesConfig {
  upworkApiUrl?: string;
  fiverrApiUrl?: string;
  glassdoorApiUrl?: string;
  cacheTtlSeconds: number;
}

export class ExternalRatesService {
  private readonly config: ExternalRatesConfig;

  constructor(
    private readonly redis: Redis,
    config?: Partial<ExternalRatesConfig>
  ) {
    this.config = {
      upworkApiUrl: config?.upworkApiUrl || process.env.UPWORK_API_URL,
      fiverrApiUrl: config?.fiverrApiUrl || process.env.FIVERR_API_URL,
      glassdoorApiUrl: config?.glassdoorApiUrl || process.env.GLASSDOOR_API_URL,
      cacheTtlSeconds: config?.cacheTtlSeconds || 86400, // 24 hours
    };
  }

  /**
   * Get aggregated rates for a skill from all external sources
   */
  async getRatesForSkill(skillId: string): Promise<ExternalRateData | null> {
    const cacheKey = `external-rates:${skillId}`;
    const cached = await this.getCached<ExternalRateData>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const [upworkData, fiverrData, glassdoorData] = await Promise.allSettled([
        this.getUpworkRates(skillId),
        this.getFiverrRates(skillId),
        this.getGlassdoorRates(skillId),
      ]);

      const allRates: NormalizedRate[] = [];
      const sources: string[] = [];

      if (upworkData.status === 'fulfilled' && upworkData.value) {
        allRates.push(...upworkData.value.rates);
        sources.push('upwork');
      }
      if (fiverrData.status === 'fulfilled' && fiverrData.value) {
        allRates.push(...fiverrData.value.rates);
        sources.push('fiverr');
      }
      if (glassdoorData.status === 'fulfilled' && glassdoorData.value) {
        allRates.push(...glassdoorData.value.rates);
        sources.push('glassdoor');
      }

      if (allRates.length === 0) {
        return null;
      }

      // Calculate weighted median
      const median = this.calculateWeightedMedian(allRates);

      const result: ExternalRateData = {
        source: sources.join(','),
        rates: allRates,
        median,
        updatedAt: new Date(),
      };

      // Cache the result
      await this.setCached(cacheKey, result, this.config.cacheTtlSeconds);

      return result;
    } catch (error) {
      logger.error('Failed to get external rates for skill', { error, skillId });
      return null;
    }
  }

  /**
   * Get rates from Upwork
   */
  async getUpworkRates(skillId: string): Promise<ExternalRateData | null> {
    if (!this.config.upworkApiUrl) {
      return this.getMockUpworkRates(skillId);
    }

    try {
      const response = await fetch(
        `${this.config.upworkApiUrl}/rates/${encodeURIComponent(skillId)}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000),
        }
      );

      if (!response.ok) {
        throw new Error(`Upwork API returned ${response.status}`);
      }

      const data = await response.json();

      return {
        source: 'upwork',
        rates: this.normalizeUpworkRates(data),
        median: data.median || this.calculateMedian(data.rates),
        updatedAt: new Date(),
      };
    } catch (error) {
      logger.warn('Failed to fetch Upwork rates', { error, skillId });
      return this.getMockUpworkRates(skillId);
    }
  }

  /**
   * Get rates from Fiverr
   */
  async getFiverrRates(skillId: string): Promise<ExternalRateData | null> {
    if (!this.config.fiverrApiUrl) {
      return this.getMockFiverrRates(skillId);
    }

    try {
      const response = await fetch(
        `${this.config.fiverrApiUrl}/rates/${encodeURIComponent(skillId)}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000),
        }
      );

      if (!response.ok) {
        throw new Error(`Fiverr API returned ${response.status}`);
      }

      const data = await response.json();

      return {
        source: 'fiverr',
        rates: this.normalizeFiverrRates(data),
        median: data.median || this.calculateMedian(data.rates),
        updatedAt: new Date(),
      };
    } catch (error) {
      logger.warn('Failed to fetch Fiverr rates', { error, skillId });
      return this.getMockFiverrRates(skillId);
    }
  }

  /**
   * Get rates from Glassdoor
   */
  async getGlassdoorRates(skillId: string): Promise<ExternalRateData | null> {
    if (!this.config.glassdoorApiUrl) {
      return this.getMockGlassdoorRates(skillId);
    }

    try {
      const response = await fetch(
        `${this.config.glassdoorApiUrl}/rates/${encodeURIComponent(skillId)}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000),
        }
      );

      if (!response.ok) {
        throw new Error(`Glassdoor API returned ${response.status}`);
      }

      const data = await response.json();

      return {
        source: 'glassdoor',
        rates: this.normalizeGlassdoorRates(data),
        median: data.median || this.calculateMedian(data.rates),
        updatedAt: new Date(),
      };
    } catch (error) {
      logger.warn('Failed to fetch Glassdoor rates', { error, skillId });
      return this.getMockGlassdoorRates(skillId);
    }
  }

  /**
   * Normalize Upwork rate data
   */
  private normalizeUpworkRates(data: any): NormalizedRate[] {
    if (!data.rates || !Array.isArray(data.rates)) {
      return [];
    }

    return data.rates.map((r: any) => ({
      rate: typeof r === 'number' ? r : r.rate || r.hourlyRate || 0,
      level: r.level || r.experienceLevel,
      weight: 1.0,
    }));
  }

  /**
   * Normalize Fiverr rate data (convert from gig prices to hourly)
   */
  private normalizeFiverrRates(data: any): NormalizedRate[] {
    if (!data.rates || !Array.isArray(data.rates)) {
      return [];
    }

    return data.rates.map((r: any) => {
      // Fiverr uses gig pricing, estimate hourly based on delivery time
      const price = typeof r === 'number' ? r : r.price || 0;
      const estimatedHours = r.deliveryHours || 4;
      const hourlyRate = price / estimatedHours;

      return {
        rate: hourlyRate,
        level: r.level || r.sellerLevel,
        weight: 0.8, // Lower weight due to gig-based pricing uncertainty
      };
    });
  }

  /**
   * Normalize Glassdoor rate data
   */
  private normalizeGlassdoorRates(data: any): NormalizedRate[] {
    if (!data.rates || !Array.isArray(data.rates)) {
      return [];
    }

    return data.rates.map((r: any) => {
      // Convert annual salary to hourly rate (assuming 2080 hours/year)
      let rate = typeof r === 'number' ? r : r.rate || r.hourlyRate || 0;
      if (r.type === 'salary' || r.isAnnual) {
        rate = rate / 2080;
      }

      return {
        rate,
        level: r.level || r.experienceLevel,
        weight: 1.2, // Higher weight for employment data
      };
    });
  }

  /**
   * Calculate weighted median
   */
  private calculateWeightedMedian(rates: NormalizedRate[]): number {
    if (rates.length === 0) return 0;

    // Sort by rate
    const sorted = [...rates].sort((a, b) => a.rate - b.rate);

    // Calculate total weight
    const totalWeight = sorted.reduce((sum, r) => sum + (r.weight || 1), 0);
    const halfWeight = totalWeight / 2;

    // Find weighted median
    let cumWeight = 0;
    for (const r of sorted) {
      cumWeight += r.weight || 1;
      if (cumWeight >= halfWeight) {
        return r.rate;
      }
    }

    return sorted[Math.floor(sorted.length / 2)].rate;
  }

  /**
   * Calculate simple median
   */
  private calculateMedian(rates: any[]): number {
    if (!rates || rates.length === 0) return 0;

    const values = rates.map((r) => (typeof r === 'number' ? r : r.rate || 0));
    const sorted = values.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Mock Upwork rates for development/fallback
   */
  private getMockUpworkRates(skillId: string): ExternalRateData {
    // Generate realistic mock rates based on skill category
    const baseRate = this.getBaseRateForSkill(skillId);

    return {
      source: 'upwork',
      rates: [
        { rate: baseRate * 0.5, level: 'BEGINNER', weight: 1.0 },
        { rate: baseRate * 0.75, level: 'INTERMEDIATE', weight: 1.0 },
        { rate: baseRate, level: 'ADVANCED', weight: 1.0 },
        { rate: baseRate * 1.4, level: 'EXPERT', weight: 1.0 },
      ],
      median: baseRate * 0.875,
      updatedAt: new Date(),
    };
  }

  /**
   * Mock Fiverr rates for development/fallback
   */
  private getMockFiverrRates(skillId: string): ExternalRateData {
    const baseRate = this.getBaseRateForSkill(skillId) * 0.7; // Fiverr tends to be lower

    return {
      source: 'fiverr',
      rates: [
        { rate: baseRate * 0.6, level: 'Level 1', weight: 0.8 },
        { rate: baseRate * 0.8, level: 'Level 2', weight: 0.8 },
        { rate: baseRate, level: 'Top Rated', weight: 0.8 },
      ],
      median: baseRate * 0.8,
      updatedAt: new Date(),
    };
  }

  /**
   * Mock Glassdoor rates for development/fallback
   */
  private getMockGlassdoorRates(skillId: string): ExternalRateData {
    const baseRate = this.getBaseRateForSkill(skillId) * 1.2; // Employment tends to be higher

    return {
      source: 'glassdoor',
      rates: [
        { rate: baseRate * 0.7, level: 'Junior', weight: 1.2 },
        { rate: baseRate, level: 'Mid', weight: 1.2 },
        { rate: baseRate * 1.3, level: 'Senior', weight: 1.2 },
        { rate: baseRate * 1.6, level: 'Staff/Principal', weight: 1.2 },
      ],
      median: baseRate,
      updatedAt: new Date(),
    };
  }

  /**
   * Get base rate for skill category (for mock data)
   */
  private getBaseRateForSkill(skillId: string): number {
    const skillLower = skillId.toLowerCase();

    // High-paying skills
    if (
      skillLower.includes('machine-learning') ||
      skillLower.includes('ai') ||
      skillLower.includes('blockchain') ||
      skillLower.includes('security')
    ) {
      return 150;
    }

    // Above average skills
    if (
      skillLower.includes('react') ||
      skillLower.includes('typescript') ||
      skillLower.includes('python') ||
      skillLower.includes('node') ||
      skillLower.includes('aws') ||
      skillLower.includes('kubernetes')
    ) {
      return 100;
    }

    // Average skills
    if (
      skillLower.includes('javascript') ||
      skillLower.includes('java') ||
      skillLower.includes('php') ||
      skillLower.includes('sql')
    ) {
      return 75;
    }

    // Entry-level skills
    if (
      skillLower.includes('html') ||
      skillLower.includes('css') ||
      skillLower.includes('wordpress')
    ) {
      return 50;
    }

    // Default
    return 65;
  }

  /**
   * Get cached value
   */
  private async getCached<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    } catch (error) {
      logger.error('Failed to get cached external rates', { error, key });
      return null;
    }
  }

  /**
   * Set cached value
   */
  private async setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      logger.error('Failed to cache external rates', { error, key });
    }
  }
}

