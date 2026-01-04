/**
 * Data Anonymizer Service
 * Sprint M10: Talent Intelligence API
 *
 * Ensures all data exposed through the Intelligence API is properly
 * anonymized to protect individual freelancer privacy while maintaining
 * statistical validity.
 */

import { createLogger } from '@skillancer/logger';
import * as crypto from 'crypto';

const logger = createLogger({ service: 'data-anonymizer' });

// ============================================================================
// Types
// ============================================================================

interface AnonymizationConfig {
  minGroupSize: number; // Minimum records to form a reportable group
  kAnonymity: number; // k-anonymity threshold
  noise: {
    enabled: boolean;
    percentageRange: number; // +/- percentage for noise
  };
  generalization: {
    rateRounding: number; // Round rates to nearest X
    locationLevel: 'country' | 'region' | 'city';
    experienceBuckets: string[];
  };
  suppression: {
    maxSuppression: number; // Max % of data that can be suppressed
  };
}

interface RawRecord {
  id: string;
  userId?: string;
  freelancerId?: string;
  rate?: number;
  location?: string;
  city?: string;
  region?: string;
  country?: string;
  experienceYears?: number;
  skills?: string[];
  projectDetails?: string;
  clientId?: string;
  [key: string]: unknown;
}

interface AnonymizedRecord {
  recordHash: string;
  rate?: number;
  location?: string;
  experienceLevel?: string;
  skills?: string[];
  [key: string]: unknown;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: AnonymizationConfig = {
  minGroupSize: 5,
  kAnonymity: 5,
  noise: {
    enabled: true,
    percentageRange: 3, // +/- 3%
  },
  generalization: {
    rateRounding: 5, // Round to nearest $5
    locationLevel: 'country',
    experienceBuckets: ['0-2', '2-5', '5-10', '10+'],
  },
  suppression: {
    maxSuppression: 0.1, // Max 10% suppression
  },
};

// ============================================================================
// Data Anonymizer Service
// ============================================================================

export class DataAnonymizer {
  private config: AnonymizationConfig;
  private salt: string;

  constructor(config: Partial<AnonymizationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.salt = process.env.ANONYMIZATION_SALT || 'skillancer-intelligence-api';
  }

  /**
   * Anonymize a batch of records
   */
  anonymizeBatch(records: RawRecord[]): AnonymizedRecord[] {
    logger.info('Anonymizing batch', { recordCount: records.length });

    // Step 1: Remove direct identifiers
    const deidentified = records.map((r) => this.removeDirectIdentifiers(r));

    // Step 2: Generalize quasi-identifiers
    const generalized = deidentified.map((r) => this.generalizeQuasiIdentifiers(r));

    // Step 3: Check k-anonymity
    const { valid, suppressed } = this.enforceKAnonymity(generalized);

    // Step 4: Add noise to numerical values
    const noised = this.config.noise.enabled ? valid.map((r) => this.addNoise(r)) : valid;

    // Step 5: Generate record hashes
    const hashed = noised.map((r) => this.addRecordHash(r));

    logger.info('Anonymization complete', {
      originalCount: records.length,
      outputCount: hashed.length,
      suppressedCount: suppressed.length,
    });

    return hashed;
  }

  /**
   * Anonymize a single rate value with differential privacy
   */
  anonymizeRate(rate: number): number {
    // Round to configured precision
    let anonymizedRate =
      Math.round(rate / this.config.generalization.rateRounding) *
      this.config.generalization.rateRounding;

    // Add noise if enabled
    if (this.config.noise.enabled) {
      const noisePercent = ((Math.random() * 2 - 1) * this.config.noise.percentageRange) / 100;
      anonymizedRate = Math.round(anonymizedRate * (1 + noisePercent));
    }

    return anonymizedRate;
  }

  /**
   * Generalize location to configured level
   */
  generalizeLocation(location: {
    city?: string;
    region?: string;
    country?: string;
  }): string | null {
    switch (this.config.generalization.locationLevel) {
      case 'city':
        return location.city || location.region || location.country || null;
      case 'region':
        return location.region || location.country || null;
      case 'country':
      default:
        return location.country || null;
    }
  }

  /**
   * Convert years of experience to bucket
   */
  generalizeExperience(years: number): string {
    const buckets = this.config.generalization.experienceBuckets;

    if (years < 2) return buckets[0] || 'junior';
    if (years < 5) return buckets[1] || 'mid';
    if (years < 10) return buckets[2] || 'senior';
    return buckets[3] || 'expert';
  }

  /**
   * Check if a dataset meets k-anonymity requirements
   */
  checkKAnonymity(
    records: AnonymizedRecord[],
    quasiIdentifiers: string[]
  ): {
    isValid: boolean;
    violations: Array<{ group: string; count: number }>;
  } {
    const groups = new Map<string, number>();

    for (const record of records) {
      const key = quasiIdentifiers.map((qi) => String(record[qi] || '')).join('|');
      groups.set(key, (groups.get(key) || 0) + 1);
    }

    const violations: Array<{ group: string; count: number }> = [];

    for (const [group, count] of groups) {
      if (count < this.config.kAnonymity) {
        violations.push({ group, count });
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
    };
  }

  /**
   * Generate a one-way hash for a record
   */
  generateRecordHash(record: Record<string, unknown>): string {
    const data = JSON.stringify(record);
    return crypto.createHmac('sha256', this.salt).update(data).digest('hex').substring(0, 16);
  }

  /**
   * Validate that aggregated data has sufficient sample size
   */
  validateSampleSize(count: number): boolean {
    return count >= this.config.minGroupSize;
  }

  // ========================================
  // Private Methods
  // ========================================

  private removeDirectIdentifiers(record: RawRecord): Partial<RawRecord> {
    // Remove all direct identifiers
    const { id, userId, freelancerId, clientId, projectDetails, ...rest } = record;
    return rest;
  }

  private generalizeQuasiIdentifiers(record: Partial<RawRecord>): AnonymizedRecord {
    const result: AnonymizedRecord = {
      recordHash: '',
    };

    // Generalize rate
    if (record.rate !== undefined) {
      result.rate = this.anonymizeRate(record.rate);
    }

    // Generalize location
    if (record.country || record.region || record.city) {
      result.location = this.generalizeLocation({
        city: record.city,
        region: record.region,
        country: record.country,
      });
    }

    // Generalize experience
    if (record.experienceYears !== undefined) {
      result.experienceLevel = this.generalizeExperience(record.experienceYears);
    }

    // Keep skills (already categorical)
    if (record.skills) {
      result.skills = record.skills;
    }

    return result;
  }

  private enforceKAnonymity(records: AnonymizedRecord[]): {
    valid: AnonymizedRecord[];
    suppressed: AnonymizedRecord[];
  } {
    const quasiIdentifiers = ['location', 'experienceLevel'];
    const groups = new Map<string, AnonymizedRecord[]>();

    // Group records
    for (const record of records) {
      const key = quasiIdentifiers.map((qi) => String(record[qi] || '')).join('|');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(record);
    }

    const valid: AnonymizedRecord[] = [];
    const suppressed: AnonymizedRecord[] = [];

    // Check each group
    for (const [, groupRecords] of groups) {
      if (groupRecords.length >= this.config.kAnonymity) {
        valid.push(...groupRecords);
      } else {
        suppressed.push(...groupRecords);
      }
    }

    // Check suppression threshold
    const suppressionRate = suppressed.length / records.length;
    if (suppressionRate > this.config.suppression.maxSuppression) {
      logger.warn('Suppression rate exceeds threshold', {
        rate: suppressionRate,
        threshold: this.config.suppression.maxSuppression,
      });
    }

    return { valid, suppressed };
  }

  private addNoise(record: AnonymizedRecord): AnonymizedRecord {
    if (record.rate !== undefined) {
      const noisePercent = ((Math.random() * 2 - 1) * this.config.noise.percentageRange) / 100;
      record.rate = Math.round(record.rate * (1 + noisePercent));
    }
    return record;
  }

  private addRecordHash(record: AnonymizedRecord): AnonymizedRecord {
    record.recordHash = this.generateRecordHash(record);
    return record;
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const dataAnonymizer = new DataAnonymizer();

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a count meets minimum threshold for public reporting
 */
export function isReportable(count: number, threshold: number = 5): boolean {
  return count >= threshold;
}

/**
 * Round a value to maintain privacy
 */
export function roundForPrivacy(value: number, precision: number = 5): number {
  return Math.round(value / precision) * precision;
}

/**
 * Apply differential privacy noise to a count
 */
export function addLaplaceNoise(value: number, epsilon: number = 1): number {
  // Laplace mechanism for differential privacy
  const scale = 1 / epsilon;
  const u = Math.random() - 0.5;
  const noise = -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  return Math.round(value + noise);
}

/**
 * Truncate text to prevent re-identification
 */
export function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
