// @ts-nocheck
/**
 * ML Pricing Service
 *
 * Integrates with ML microservice for rate predictions.
 * Includes fallback logic for when ML service is unavailable.
 */

import crypto from 'crypto';

import { logger } from '@skillancer/logger';

import type { RateFeatures, RatePrediction } from '@skillancer/types/cockpit';
import type { Redis } from 'ioredis';

interface MLServiceConfig {
  url: string;
  timeout: number;
}

export class MLPricingService {
  private readonly config: MLServiceConfig;

  constructor(
    private readonly redis: Redis,
    config?: Partial<MLServiceConfig>
  ) {
    this.config = {
      url: config?.url || process.env.ML_PRICING_SERVICE_URL || 'http://localhost:8000',
      timeout: config?.timeout || 5000,
    };
  }

  /**
   * Predict rate using ML model or fallback
   */
  async predictRate(features: RateFeatures): Promise<RatePrediction> {
    // Check cache
    const cacheKey = `rate-prediction:${this.hashFeatures(features)}`;
    const cached = await this.getCached<RatePrediction>(cacheKey);
    if (cached) {
      logger.debug('Using cached rate prediction', { cacheKey });
      return cached;
    }

    try {
      const prediction = await this.callMLService(features);

      // Cache for 1 hour
      await this.setCached(cacheKey, prediction, 3600);

      return prediction;
    } catch (error) {
      logger.warn('ML pricing prediction failed, using fallback', { error });
      // Fallback to rule-based calculation
      return this.fallbackPrediction(features);
    }
  }

  /**
   * Batch predict rates for multiple skills
   */
  async batchPredictRates(featuresArray: RateFeatures[]): Promise<Map<string, RatePrediction>> {
    const results = new Map<string, RatePrediction>();

    // Process in parallel with concurrency limit
    const batchSize = 5;
    for (let i = 0; i < featuresArray.length; i += batchSize) {
      const batch = featuresArray.slice(i, i + batchSize);
      const predictions = await Promise.all(
        batch.map(async (features) => ({
          skillName: features.skillName,
          prediction: await this.predictRate(features),
        }))
      );

      for (const { skillName, prediction } of predictions) {
        results.set(skillName, prediction);
      }
    }

    return results;
  }

  /**
   * Get skills suggested for a role
   */
  async getSkillsForRole(role: string): Promise<string[]> {
    try {
      const response = await fetch(
        `${this.config.url}/skills/role?role=${encodeURIComponent(role)}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(this.config.timeout),
        }
      );

      if (!response.ok) {
        throw new Error(`ML service returned ${response.status}`);
      }

      const data = await response.json();
      return data.skills || [];
    } catch (error) {
      logger.error('Failed to get skills for role', { error, role });
      return [];
    }
  }

  /**
   * Call the ML service
   */
  private async callMLService(features: RateFeatures): Promise<RatePrediction> {
    const response = await fetch(`${this.config.url}/predict/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        features: this.normalizeFeatures(features),
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`ML service returned ${response.status}`);
    }

    const data = await response.json();

    return {
      minRate: data.min_rate,
      optimalRate: data.optimal_rate,
      maxRate: data.max_rate,
      confidence: data.confidence * 100,
    };
  }

  /**
   * Normalize features for ML model
   */
  private normalizeFeatures(features: RateFeatures): Record<string, number> {
    return {
      skill_level: this.encodeProficiencyLevel(features.skillLevel),
      verification_score: features.verificationScore / 100,
      credential_count: Math.min(features.credentialCount, 10) / 10,
      has_certification: features.hasCertification ? 1 : 0,
      years_experience: Math.min(features.yearsExperience, 20) / 20,
      project_count: Math.min(features.projectCount, 100) / 100,
      avg_rating: features.avgRating / 5,
      success_rate: features.successRate / 100,
      repeat_client_rate: features.repeatClientRate / 100,
      market_median: features.marketMedian,
      market_p75: features.marketP75,
      market_p90: features.marketP90,
      demand_score: features.demandScore / 100,
      competition_level: Math.min(features.competitionLevel, 10000) / 10000,
      external_median: features.externalMedian,
      has_current_rate: features.currentRate ? 1 : 0,
      current_rate: features.currentRate || 0,
    };
  }

  /**
   * Encode proficiency level to numeric value
   */
  private encodeProficiencyLevel(level: string): number {
    const encoding: Record<string, number> = {
      BEGINNER: 0.25,
      INTERMEDIATE: 0.5,
      ADVANCED: 0.75,
      EXPERT: 1.0,
    };
    return encoding[level.toUpperCase()] || 0.5;
  }

  /**
   * Rule-based fallback prediction when ML is unavailable
   */
  private fallbackPrediction(features: RateFeatures): RatePrediction {
    // Start with market median or default
    let baseRate = features.marketMedian || 50;

    // Skill level adjustment
    const levelMultiplier: Record<string, number> = {
      BEGINNER: 0.7,
      INTERMEDIATE: 1.0,
      ADVANCED: 1.3,
      EXPERT: 1.6,
    };
    baseRate *= levelMultiplier[features.skillLevel.toUpperCase()] || 1.0;

    // Verification bonus (up to 10%)
    if (features.verificationScore >= 80) {
      baseRate *= 1.1;
    } else if (features.verificationScore >= 60) {
      baseRate *= 1.05;
    }

    // Certification bonus
    if (features.hasCertification) {
      baseRate *= 1.1;
    }

    // Experience adjustment
    if (features.yearsExperience >= 10) {
      baseRate *= 1.2;
    } else if (features.yearsExperience >= 5) {
      baseRate *= 1.1;
    } else if (features.yearsExperience >= 2) {
      baseRate *= 1.05;
    }

    // Project count adjustment
    if (features.projectCount >= 50) {
      baseRate *= 1.15;
    } else if (features.projectCount >= 20) {
      baseRate *= 1.1;
    } else if (features.projectCount >= 10) {
      baseRate *= 1.05;
    }

    // Rating adjustment
    if (features.avgRating >= 4.8) {
      baseRate *= 1.1;
    } else if (features.avgRating >= 4.5) {
      baseRate *= 1.05;
    } else if (features.avgRating < 4.0 && features.avgRating > 0) {
      baseRate *= 0.9;
    }

    // Success rate adjustment
    if (features.successRate >= 95) {
      baseRate *= 1.05;
    } else if (features.successRate < 80 && features.successRate > 0) {
      baseRate *= 0.95;
    }

    // Repeat client adjustment
    if (features.repeatClientRate >= 50) {
      baseRate *= 1.05;
    }

    // Demand adjustment
    if (features.demandScore >= 80) {
      baseRate *= 1.1;
    } else if (features.demandScore >= 60) {
      baseRate *= 1.05;
    } else if (features.demandScore < 30) {
      baseRate *= 0.95;
    }

    // Calculate range
    const minRate = baseRate * 0.8;
    const maxRate = baseRate * 1.3;

    return {
      minRate: Math.round(minRate),
      optimalRate: Math.round(baseRate),
      maxRate: Math.round(maxRate),
      confidence: 60, // Lower confidence for fallback
    };
  }

  /**
   * Hash features for cache key
   */
  private hashFeatures(features: RateFeatures): string {
    const normalized = this.normalizeFeatures(features);
    const str = JSON.stringify(normalized);
    return crypto.createHash('md5').update(str).digest('hex');
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
      logger.error('Failed to get cached value', { error, key });
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
      logger.error('Failed to set cached value', { error, key });
    }
  }
}

