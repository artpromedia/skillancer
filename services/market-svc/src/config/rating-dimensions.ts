/**
 * @module @skillancer/market-svc/config/rating-dimensions
 * Rating dimension configuration for reviews
 *
 * Defines the dimensions on which clients and freelancers rate each other,
 * along with weights for calculating weighted averages.
 */

// =============================================================================
// FREELANCER RATING DIMENSIONS (Client reviewing Freelancer)
// =============================================================================

export const FREELANCER_RATING_DIMENSIONS = {
  quality: {
    key: 'quality',
    label: 'Quality of Work',
    description: 'How well did the deliverables meet requirements?',
    weight: 0.3,
    required: true,
  },
  communication: {
    key: 'communication',
    label: 'Communication',
    description: 'How responsive and clear was the freelancer?',
    weight: 0.2,
    required: true,
  },
  expertise: {
    key: 'expertise',
    label: 'Expertise',
    description: 'Did they demonstrate the claimed skills?',
    weight: 0.2,
    required: true,
  },
  timeliness: {
    key: 'timeliness',
    label: 'Timeliness',
    description: 'Were deadlines met?',
    weight: 0.15,
    required: true,
    aliases: ['deadline'], // Support legacy field name
  },
  professionalism: {
    key: 'professionalism',
    label: 'Professionalism',
    description: 'Was the freelancer professional throughout?',
    weight: 0.15,
    required: true,
  },
} as const;

export type FreelancerDimensionKey = keyof typeof FREELANCER_RATING_DIMENSIONS;

// =============================================================================
// CLIENT RATING DIMENSIONS (Freelancer reviewing Client)
// =============================================================================

export const CLIENT_RATING_DIMENSIONS = {
  clarity: {
    key: 'clarity',
    label: 'Project Clarity',
    description: 'Were requirements and expectations clear?',
    weight: 0.25,
    required: true,
    aliases: ['requirements'], // Support legacy field name
  },
  communication: {
    key: 'communication',
    label: 'Communication',
    description: 'How responsive was the client?',
    weight: 0.25,
    required: true,
    aliases: ['responsiveness'],
  },
  payment: {
    key: 'payment',
    label: 'Payment',
    description: 'Were payments made promptly?',
    weight: 0.25,
    required: true,
    aliases: ['paymentPromptness'],
  },
  professionalism: {
    key: 'professionalism',
    label: 'Professionalism',
    description: 'Was the client professional throughout?',
    weight: 0.25,
    required: true,
  },
} as const;

export type ClientDimensionKey = keyof typeof CLIENT_RATING_DIMENSIONS;

// =============================================================================
// SKILLPOD COMPLIANCE DIMENSIONS (for cross-product trust)
// =============================================================================

export const SKILLPOD_COMPLIANCE_DIMENSIONS = {
  policyAdherence: {
    key: 'policyAdherence',
    label: 'Policy Adherence',
    description: 'Did they follow security policies?',
    weight: 0.4,
    required: true,
  },
  dataHandling: {
    key: 'dataHandling',
    label: 'Data Handling',
    description: 'Was sensitive data handled properly?',
    weight: 0.35,
    required: true,
  },
  sessionBehavior: {
    key: 'sessionBehavior',
    label: 'Session Behavior',
    description: 'Were sessions used appropriately?',
    weight: 0.25,
    required: true,
  },
} as const;

export type ComplianceDimensionKey = keyof typeof SKILLPOD_COMPLIANCE_DIMENSIONS;

// =============================================================================
// DIMENSION CONFIG TYPE
// =============================================================================

interface DimensionConfig {
  key: string;
  label: string;
  description: string;
  weight: number;
  required: boolean;
  aliases?: readonly string[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get dimension configuration by review type
 */
export function getDimensionsForReviewType(
  reviewType: 'CLIENT_TO_FREELANCER' | 'FREELANCER_TO_CLIENT'
): Record<string, DimensionConfig> {
  return reviewType === 'CLIENT_TO_FREELANCER'
    ? (FREELANCER_RATING_DIMENSIONS as unknown as Record<string, DimensionConfig>)
    : (CLIENT_RATING_DIMENSIONS as unknown as Record<string, DimensionConfig>);
}

/**
 * Calculate weighted average from dimension ratings
 */
export function calculateWeightedAverage(
  ratings: Record<string, number>,
  dimensions: Record<string, DimensionConfig>
): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [key, config] of Object.entries(dimensions)) {
    const aliasKey = config.aliases?.[0] ?? '';
    const rating = ratings[key] ?? ratings[aliasKey];
    if (rating !== undefined && rating >= 1 && rating <= 5) {
      weightedSum += rating * config.weight;
      totalWeight += config.weight;
    }
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

/**
 * Validate that all required dimensions are present
 */
export function validateDimensionRatings(
  ratings: Record<string, number>,
  reviewType: 'CLIENT_TO_FREELANCER' | 'FREELANCER_TO_CLIENT'
): { valid: boolean; missing: string[]; invalid: string[] } {
  const dimensions = getDimensionsForReviewType(reviewType);
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const [key, config] of Object.entries(dimensions)) {
    // Check for rating value (supporting aliases)
    let rating = ratings[key];
    if (rating === undefined && config.aliases) {
      for (const alias of config.aliases) {
        if (ratings[alias] !== undefined) {
          rating = ratings[alias];
          break;
        }
      }
    }

    if (config.required && rating === undefined) {
      missing.push(config.label);
    } else if (rating !== undefined) {
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        invalid.push(`${config.label} (must be integer 1-5)`);
      }
    }
  }

  return {
    valid: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
  };
}

/**
 * Normalize ratings to standard keys (handle legacy aliases)
 */
export function normalizeRatings(
  ratings: Record<string, number>,
  reviewType: 'CLIENT_TO_FREELANCER' | 'FREELANCER_TO_CLIENT'
): Record<string, number> {
  const dimensions = getDimensionsForReviewType(reviewType);
  const normalized: Record<string, number> = {};

  for (const [key, config] of Object.entries(dimensions)) {
    let rating = ratings[key];
    if (rating === undefined && config.aliases) {
      for (const alias of config.aliases) {
        if (ratings[alias] !== undefined) {
          rating = ratings[alias];
          break;
        }
      }
    }
    if (rating !== undefined) {
      normalized[key] = rating;
    }
  }

  // Preserve recommendation fields
  if (ratings.wouldHireAgain !== undefined) {
    normalized.wouldHireAgain = ratings.wouldHireAgain;
  }
  if (ratings.wouldWorkAgain !== undefined) {
    normalized.wouldWorkAgain = ratings.wouldWorkAgain;
  }

  return normalized;
}

// =============================================================================
// REVIEW CONFIGURATION
// =============================================================================

export const REVIEW_CONFIG = {
  // Review window after contract completion
  reviewWindowDays: 14,

  // Reminder configuration
  reminderSchedule: [3, 7, 10], // Days after invitation to send reminders
  maxReminders: 3,

  // Content limits
  minFeedbackLength: 10,
  maxPublicFeedbackLength: 5000,
  maxPrivateFeedbackLength: 2000,
  maxResponseLength: 2000,

  // Hide limits
  hideAllowedPerHundredReviews: 1,
  baseHideAllowance: 1,

  // Fraud detection thresholds
  fraud: {
    maxReviewsPerDay: 10,
    newAccountDays: 7,
    maxNegativeFromNewAccount: 3,
    reciprocalRateThreshold: 0.5,
    minReviewsForRingDetection: 5,
  },
} as const;
