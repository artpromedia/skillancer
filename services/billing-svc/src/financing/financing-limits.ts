// @ts-nocheck
/**
 * Financing Limits Service
 * Per-user and platform-wide financing limits
 * Sprint M6: Invoice Financing & Advanced Tax Tools
 */

import { createLogger } from '@skillancer/logger';

const logger = createLogger({ serviceName: 'financing-limits' });

// ============================================================================
// TYPES
// ============================================================================

export interface UserLimits {
  userId: string;
  maxOutstandingAdvances: number;
  maxSingleAdvance: number;
  maxTotalOutstanding: number;
  currentOutstanding: number;
  currentAdvanceCount: number;
  availableCredit: number;
  tier: CreditTier;
  lastIncreaseAt?: Date;
  lastDecreaseAt?: Date;
  coolingOffUntil?: Date;
}

export type CreditTier = 'new' | 'standard' | 'preferred' | 'premium';

export interface PlatformLimits {
  totalOutstandingExposure: number;
  maxDailyFunding: number;
  reserveRequirement: number;
  currentTotalOutstanding: number;
  todayFunding: number;
  availableCapacity: number;
}

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  availableAmount?: number;
  suggestedAction?: string;
}

// ============================================================================
// TIER CONFIGURATIONS
// ============================================================================

const TIER_CONFIG: Record<
  CreditTier,
  {
    maxOutstandingAdvances: number;
    maxSingleAdvance: number;
    maxTotalOutstanding: number;
  }
> = {
  new: {
    maxOutstandingAdvances: 1,
    maxSingleAdvance: 2500,
    maxTotalOutstanding: 2500,
  },
  standard: {
    maxOutstandingAdvances: 3,
    maxSingleAdvance: 5000,
    maxTotalOutstanding: 10000,
  },
  preferred: {
    maxOutstandingAdvances: 5,
    maxSingleAdvance: 15000,
    maxTotalOutstanding: 30000,
  },
  premium: {
    maxOutstandingAdvances: 10,
    maxSingleAdvance: 25000,
    maxTotalOutstanding: 75000,
  },
};

const PLATFORM_DEFAULTS: PlatformLimits = {
  totalOutstandingExposure: 10000000, // $10M max exposure
  maxDailyFunding: 500000, // $500K per day
  reserveRequirement: 0.1, // 10% reserve
  currentTotalOutstanding: 0,
  todayFunding: 0,
  availableCapacity: 0,
};

// ============================================================================
// FINANCING LIMITS SERVICE
// ============================================================================

class FinancingLimitsService {
  // --------------------------------------------------------------------------
  // USER LIMITS
  // --------------------------------------------------------------------------

  async getUserLimits(userId: string): Promise<UserLimits> {
    logger.info('Getting user limits', { userId });

    // In production, fetch from database
    const tier = await this.getUserTier(userId);
    const config = TIER_CONFIG[tier];
    const currentOutstanding = await this.getCurrentOutstanding(userId);
    const currentAdvanceCount = await this.getCurrentAdvanceCount(userId);

    const limits: UserLimits = {
      userId,
      ...config,
      tier,
      currentOutstanding,
      currentAdvanceCount,
      availableCredit: Math.max(0, config.maxTotalOutstanding - currentOutstanding),
    };

    return limits;
  }

  async checkUserLimits(userId: string, requestedAmount: number): Promise<LimitCheckResult> {
    logger.info('Checking user limits', { userId, requestedAmount });

    const limits = await this.getUserLimits(userId);

    // Check cooling off period
    if (limits.coolingOffUntil && new Date() < limits.coolingOffUntil) {
      return {
        allowed: false,
        reason: 'Account in cooling-off period',
        suggestedAction: `Try again after ${limits.coolingOffUntil.toLocaleDateString()}`,
      };
    }

    // Check max advances
    if (limits.currentAdvanceCount >= limits.maxOutstandingAdvances) {
      return {
        allowed: false,
        reason: 'Maximum number of active advances reached',
        suggestedAction: 'Wait for an existing advance to be repaid',
      };
    }

    // Check single advance limit
    if (requestedAmount > limits.maxSingleAdvance) {
      return {
        allowed: false,
        reason: `Exceeds maximum single advance ($${limits.maxSingleAdvance.toLocaleString()})`,
        availableAmount: limits.maxSingleAdvance,
      };
    }

    // Check total outstanding limit
    if (limits.currentOutstanding + requestedAmount > limits.maxTotalOutstanding) {
      const available = Math.max(0, limits.maxTotalOutstanding - limits.currentOutstanding);
      return {
        allowed: false,
        reason: 'Would exceed total outstanding limit',
        availableAmount: available,
        suggestedAction:
          available > 0 ? `Maximum available: $${available.toLocaleString()}` : undefined,
      };
    }

    // Check platform limits
    const platformCheck = await this.checkPlatformLimits(requestedAmount);
    if (!platformCheck.allowed) {
      return platformCheck;
    }

    return { allowed: true, availableAmount: limits.availableCredit };
  }

  // --------------------------------------------------------------------------
  // TIER MANAGEMENT
  // --------------------------------------------------------------------------

  async getUserTier(userId: string): Promise<CreditTier> {
    // In production, calculate based on:
    // - Account age
    // - Repayment history
    // - Total volume
    // - Platform activity

    const history = await this.getUserHistory(userId);

    if (history.totalAdvances === 0) {
      return 'new';
    }

    if (history.defaultCount > 0) {
      return 'new';
    }

    if (history.totalAdvances >= 20 && history.onTimeRate >= 0.98) {
      return 'premium';
    }

    if (history.totalAdvances >= 10 && history.onTimeRate >= 0.95) {
      return 'preferred';
    }

    if (history.totalAdvances >= 3 && history.onTimeRate >= 0.9) {
      return 'standard';
    }

    return 'new';
  }

  async upgradeTier(userId: string): Promise<CreditTier | null> {
    const currentTier = await this.getUserTier(userId);
    const tiers: CreditTier[] = ['new', 'standard', 'preferred', 'premium'];
    const currentIndex = tiers.indexOf(currentTier);

    if (currentIndex >= tiers.length - 1) {
      return null; // Already at max tier
    }

    const newTier = tiers[currentIndex + 1];
    await this.setUserTier(userId, newTier);

    logger.info('User tier upgraded', { userId, from: currentTier, to: newTier });
    metrics.increment('financing.tier.upgrade', { to: newTier });

    return newTier;
  }

  async downgradeTier(userId: string, reason: string): Promise<CreditTier> {
    const currentTier = await this.getUserTier(userId);
    const tiers: CreditTier[] = ['new', 'standard', 'preferred', 'premium'];
    const currentIndex = tiers.indexOf(currentTier);

    const newTier = currentIndex > 0 ? tiers[currentIndex - 1] : 'new';
    await this.setUserTier(userId, newTier);

    logger.warn('User tier downgraded', { userId, from: currentTier, to: newTier, reason });
    metrics.increment('financing.tier.downgrade', { to: newTier, reason });

    return newTier;
  }

  private async setUserTier(userId: string, tier: CreditTier): Promise<void> {
    // In production, update database
  }

  // --------------------------------------------------------------------------
  // PLATFORM LIMITS
  // --------------------------------------------------------------------------

  async getPlatformLimits(): Promise<PlatformLimits> {
    // In production, fetch from database/cache
    const currentTotalOutstanding = await this.getTotalPlatformOutstanding();
    const todayFunding = await this.getTodayFunding();

    const limits: PlatformLimits = {
      ...PLATFORM_DEFAULTS,
      currentTotalOutstanding,
      todayFunding,
      availableCapacity: Math.min(
        PLATFORM_DEFAULTS.totalOutstandingExposure - currentTotalOutstanding,
        PLATFORM_DEFAULTS.maxDailyFunding - todayFunding
      ),
    };

    return limits;
  }

  async checkPlatformLimits(requestedAmount: number): Promise<LimitCheckResult> {
    const limits = await this.getPlatformLimits();

    // Check total exposure
    if (limits.currentTotalOutstanding + requestedAmount > limits.totalOutstandingExposure) {
      logger.warn('Platform exposure limit would be exceeded', {
        current: limits.currentTotalOutstanding,
        requested: requestedAmount,
        max: limits.totalOutstandingExposure,
      });

      return {
        allowed: false,
        reason: 'Platform capacity temporarily reached',
        suggestedAction: 'Please try again later',
      };
    }

    // Check daily funding limit
    if (limits.todayFunding + requestedAmount > limits.maxDailyFunding) {
      return {
        allowed: false,
        reason: 'Daily funding limit reached',
        suggestedAction: 'Please try again tomorrow',
      };
    }

    return { allowed: true };
  }

  // --------------------------------------------------------------------------
  // DYNAMIC ADJUSTMENTS
  // --------------------------------------------------------------------------

  async applyCoolingOff(userId: string, days: number, reason: string): Promise<void> {
    const coolingOffUntil = new Date();
    coolingOffUntil.setDate(coolingOffUntil.getDate() + days);

    logger.info('Applied cooling-off period', { userId, days, reason, until: coolingOffUntil });

    // In production, update database
    metrics.increment('financing.cooling_off.applied', { reason });
  }

  async adjustSeasonalLimits(): Promise<void> {
    // Adjust limits based on seasonal patterns
    // e.g., increase limits during Q4 when invoicing is higher
    const month = new Date().getMonth();
    const isHighSeason = month >= 9 && month <= 11; // Oct-Dec

    if (isHighSeason) {
      // Temporarily increase platform limits
      logger.info('Applying seasonal limit increase');
    }
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

  private async getCurrentOutstanding(userId: string): Promise<number> {
    // In production, sum from database
    return 0;
  }

  private async getCurrentAdvanceCount(userId: string): Promise<number> {
    // In production, count from database
    return 0;
  }

  private async getTotalPlatformOutstanding(): Promise<number> {
    // In production, sum all active advances
    return 2500000;
  }

  private async getTodayFunding(): Promise<number> {
    // In production, sum today's funded advances
    return 75000;
  }

  private async getUserHistory(userId: string): Promise<{
    totalAdvances: number;
    onTimeRate: number;
    defaultCount: number;
    totalVolume: number;
  }> {
    // In production, aggregate from database
    return {
      totalAdvances: 5,
      onTimeRate: 1.0,
      defaultCount: 0,
      totalVolume: 15000,
    };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let limitsService: FinancingLimitsService | null = null;

export function getFinancingLimitsService(): FinancingLimitsService {
  if (!limitsService) {
    limitsService = new FinancingLimitsService();
  }
  return limitsService;
}

