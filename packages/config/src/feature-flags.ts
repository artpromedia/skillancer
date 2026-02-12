/**
 * Feature Flags Configuration
 *
 * Centralized feature flag definitions for Skillancer.
 * Used for gradual rollouts, A/B testing, and kill switches.
 */

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage?: number;
  environments: ('development' | 'staging' | 'production')[];
  targetGroups?: string[];
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Core Platform Features
 */
export const CORE_FEATURES: Record<string, FeatureFlag> = {
  // SkillPod VDI
  SKILLPOD_ENABLED: {
    id: 'skillpod_enabled',
    name: 'SkillPod VDI',
    description: 'Enable SkillPod secure virtual desktop sessions',
    enabled: true,
    environments: ['development', 'staging', 'production'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  },

  SKILLPOD_RECORDINGS: {
    id: 'skillpod_recordings',
    name: 'SkillPod Recordings',
    description: 'Enable session recording in SkillPod',
    enabled: true,
    environments: ['development', 'staging', 'production'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  },

  SKILLPOD_KEYSTROKE_LOGGING: {
    id: 'skillpod_keystroke_logging',
    name: 'SkillPod Keystroke Logging',
    description: 'Enable keystroke logging for maximum security policies',
    enabled: true,
    targetGroups: ['enterprise', 'security_focused'],
    environments: ['production'],
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-15'),
  },

  // Verification System
  SKILL_VERIFICATION: {
    id: 'skill_verification',
    name: 'Skill Verification',
    description: 'Enable skill verification and assessments',
    enabled: true,
    environments: ['development', 'staging', 'production'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  },

  IDENTITY_VERIFICATION: {
    id: 'identity_verification',
    name: 'Identity Verification',
    description: 'Enable ID verification via third-party provider',
    enabled: true,
    environments: ['development', 'staging', 'production'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  },

  BACKGROUND_CHECKS: {
    id: 'background_checks',
    name: 'Background Checks',
    description: 'Enable background check requests',
    enabled: true,
    targetGroups: ['enterprise'],
    environments: ['production'],
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-15'),
  },

  // Cockpit Dashboard
  COCKPIT_ENABLED: {
    id: 'cockpit_enabled',
    name: 'Cockpit Dashboard',
    description: 'Enable Cockpit freelancer dashboard',
    enabled: true,
    environments: ['development', 'staging', 'production'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  },

  COCKPIT_INVOICING: {
    id: 'cockpit_invoicing',
    name: 'Cockpit Invoicing',
    description: 'Enable invoice generation in Cockpit',
    enabled: true,
    environments: ['development', 'staging', 'production'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  },

  COCKPIT_ANALYTICS: {
    id: 'cockpit_analytics',
    name: 'Cockpit Analytics',
    description: 'Enable advanced analytics in Cockpit',
    enabled: true,
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    createdAt: new Date('2024-01-08'),
    updatedAt: new Date('2024-01-15'),
  },
};

/**
 * New Features (Gradual Rollout)
 */
export const NEW_FEATURES: Record<string, FeatureFlag> = {
  AI_MATCHING: {
    id: 'ai_matching',
    name: 'AI Job Matching',
    description: 'AI-powered job recommendations',
    enabled: true,
    rolloutPercentage: 50,
    environments: ['development', 'staging', 'production'],
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-15'),
  },

  SMART_PROPOSALS: {
    id: 'smart_proposals',
    name: 'Smart Proposals',
    description: 'AI-assisted proposal writing',
    enabled: true,
    rolloutPercentage: 25,
    environments: ['development', 'staging'],
    createdAt: new Date('2024-01-12'),
    updatedAt: new Date('2024-01-15'),
  },

  PROJECT_TEMPLATES: {
    id: 'project_templates',
    name: 'Project Templates',
    description: 'Pre-built contract templates for common project types',
    enabled: true,
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-15'),
  },

  TEAM_ACCOUNTS: {
    id: 'team_accounts',
    name: 'Team Accounts',
    description: 'Multi-user team accounts for agencies',
    enabled: false,
    environments: ['development'],
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },

  VIDEO_INTERVIEWS: {
    id: 'video_interviews',
    name: 'Video Interviews',
    description: 'Built-in video interview scheduling',
    enabled: true,
    rolloutPercentage: 75,
    environments: ['development', 'staging', 'production'],
    createdAt: new Date('2024-01-08'),
    updatedAt: new Date('2024-01-15'),
  },
};

/**
 * Experimental Features (Internal Testing)
 */
export const EXPERIMENTAL_FEATURES: Record<string, FeatureFlag> = {
  NEW_SEARCH_UI: {
    id: 'new_search_ui',
    name: 'New Search UI',
    description: 'Redesigned search experience',
    enabled: true,
    targetGroups: ['internal', 'beta_testers'],
    environments: ['development', 'staging'],
    createdAt: new Date('2024-01-14'),
    updatedAt: new Date('2024-01-15'),
  },

  REAL_TIME_COLLABORATION: {
    id: 'real_time_collaboration',
    name: 'Real-time Collaboration',
    description: 'Live document collaboration in SkillPod',
    enabled: false,
    environments: ['development'],
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },

  CRYPTO_PAYMENTS: {
    id: 'crypto_payments',
    name: 'Cryptocurrency Payments',
    description: 'Accept crypto for payments',
    enabled: false,
    environments: ['development'],
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },
};

/**
 * Operations & Maintenance Flags
 */
export const OPERATIONS_FLAGS: Record<string, FeatureFlag> = {
  MAINTENANCE_MODE: {
    id: 'maintenance_mode',
    name: 'Maintenance Mode',
    description: 'Enable platform-wide maintenance mode',
    enabled: false,
    environments: ['development', 'staging', 'production'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  },

  READ_ONLY_MODE: {
    id: 'read_only_mode',
    name: 'Read-Only Mode',
    description: 'Disable all write operations',
    enabled: false,
    environments: ['development', 'staging', 'production'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  },

  REGISTRATIONS_ENABLED: {
    id: 'registrations_enabled',
    name: 'New Registrations',
    description: 'Allow new user registrations',
    enabled: true,
    environments: ['development', 'staging', 'production'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  },

  PAYMENTS_ENABLED: {
    id: 'payments_enabled',
    name: 'Payment Processing',
    description: 'Enable payment processing',
    enabled: true,
    environments: ['development', 'staging', 'production'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  },

  NOTIFICATIONS_ENABLED: {
    id: 'notifications_enabled',
    name: 'Notifications',
    description: 'Enable email and push notifications',
    enabled: true,
    environments: ['development', 'staging', 'production'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  },
};

/**
 * All feature flags combined
 */
export const ALL_FLAGS: Record<string, FeatureFlag> = {
  ...CORE_FEATURES,
  ...NEW_FEATURES,
  ...EXPERIMENTAL_FEATURES,
  ...OPERATIONS_FLAGS,
};

/**
 * Feature flag evaluation
 */
export function isFeatureEnabled(
  flagId: string,
  context?: {
    userId?: string;
    userGroups?: string[];
    environment?: string;
  }
): boolean {
  const flag = ALL_FLAGS[flagId];

  if (!flag) {
    console.warn(`Unknown feature flag: ${flagId}`);
    return false;
  }

  // Check if enabled at all
  if (!flag.enabled) {
    return false;
  }

  // Check environment
  const env = context?.environment || process.env.NODE_ENV || 'development';
  if (!flag.environments.includes(env as any)) {
    return false;
  }

  // Check expiration
  if (flag.expiresAt && new Date() > flag.expiresAt) {
    return false;
  }

  // Check target groups
  if (flag.targetGroups && flag.targetGroups.length > 0) {
    const userGroups = context?.userGroups || [];
    const hasMatchingGroup = flag.targetGroups.some((g) => userGroups.includes(g));
    if (!hasMatchingGroup) {
      return false;
    }
  }

  // Check rollout percentage
  if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
    if (!context?.userId) {
      return false;
    }
    const hash = simpleHash(context.userId + flagId);
    const bucket = hash % 100;
    if (bucket >= flag.rolloutPercentage) {
      return false;
    }
  }

  return true;
}

/**
 * Simple hash function for rollout bucketing
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Get all enabled flags for a user
 */
export function getEnabledFlags(context?: {
  userId?: string;
  userGroups?: string[];
  environment?: string;
}): string[] {
  return Object.keys(ALL_FLAGS).filter((flagId) => isFeatureEnabled(flagId, context));
}

/**
 * Emergency kill switch - disable critical features
 */
export async function emergencyDisable(flagIds: string[], reason: string): Promise<void> {
  console.error(`EMERGENCY DISABLE: ${flagIds.join(', ')}`);
  console.error(`Reason: ${reason}`);

  for (const flagId of flagIds) {
    if (ALL_FLAGS[flagId]) {
      ALL_FLAGS[flagId].enabled = false;
      ALL_FLAGS[flagId].updatedAt = new Date();
    }
  }

  // Persist to Redis if available
  const service = getFeatureFlagService();
  if (service) {
    await service.emergencyDisable(flagIds, reason);
  }
}

// =============================================================================
// Feature Flag Service (Database & Redis Persistence)
// =============================================================================

import type { Redis } from 'ioredis';

export interface FeatureFlagServiceConfig {
  redis: Redis;
  environment: string;
  cacheExpirationSeconds?: number;
  onFlagChange?: (flagId: string, enabled: boolean) => void;
}

export interface PersistedFeatureFlag extends FeatureFlag {
  overrideEnabled?: boolean;
  overrideSource?: 'database' | 'emergency' | 'api';
}

/**
 * Feature Flag Service with Redis persistence
 *
 * This service bridges the static flag definitions with runtime overrides.
 * Static definitions provide defaults, while Redis stores runtime changes.
 */
export class FeatureFlagService {
  private readonly redis: Redis;
  private readonly environment: string;
  private readonly cacheExpiration: number;
  private readonly onFlagChange?: (flagId: string, enabled: boolean) => void;

  private static readonly KEY_PREFIX = 'feature:flag:';
  private static readonly OVERRIDE_PREFIX = 'feature:override:';
  private static readonly EMERGENCY_KEY = 'feature:emergency:disabled';

  constructor(config: FeatureFlagServiceConfig) {
    this.redis = config.redis;
    this.environment = config.environment;
    this.cacheExpiration = config.cacheExpirationSeconds ?? 300;
    this.onFlagChange = config.onFlagChange;
  }

  /**
   * Sync static flags to Redis on startup
   */
  async syncFlags(): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const [key, flag] of Object.entries(ALL_FLAGS)) {
      const redisKey = `${FeatureFlagService.KEY_PREFIX}${this.environment}:${flag.id}`;
      pipeline.set(redisKey, JSON.stringify(flag), 'EX', this.cacheExpiration);
    }

    await pipeline.exec();
    console.log(`[FeatureFlags] Synced ${Object.keys(ALL_FLAGS).length} flags to Redis`);
  }

  /**
   * Check if a feature is enabled with Redis override support
   */
  async isEnabled(
    flagId: string,
    context?: {
      userId?: string;
      userGroups?: string[];
    }
  ): Promise<boolean> {
    // Check emergency disabled list first
    const emergencyDisabled = await this.redis.sismember(FeatureFlagService.EMERGENCY_KEY, flagId);
    if (emergencyDisabled) {
      return false;
    }

    // Check for runtime override
    const overrideKey = `${FeatureFlagService.OVERRIDE_PREFIX}${this.environment}:${flagId}`;
    const override = await this.redis.get(overrideKey);
    if (override !== null) {
      return override === 'true';
    }

    // Fall back to static evaluation
    return isFeatureEnabled(flagId, {
      ...context,
      environment: this.environment,
    });
  }

  /**
   * Get flag details including overrides
   */
  async getFlag(flagId: string): Promise<PersistedFeatureFlag | null> {
    const staticFlag = ALL_FLAGS[flagId];
    if (!staticFlag) return null;

    const overrideKey = `${FeatureFlagService.OVERRIDE_PREFIX}${this.environment}:${flagId}`;
    const override = await this.redis.get(overrideKey);

    const emergencyDisabled = await this.redis.sismember(FeatureFlagService.EMERGENCY_KEY, flagId);

    return {
      ...staticFlag,
      enabled: emergencyDisabled
        ? false
        : override !== null
          ? override === 'true'
          : staticFlag.enabled,
      overrideEnabled: override !== null ? override === 'true' : undefined,
      overrideSource: emergencyDisabled ? 'emergency' : override !== null ? 'api' : undefined,
    };
  }

  /**
   * Get all flags with current state
   */
  async getAllFlags(): Promise<PersistedFeatureFlag[]> {
    const flags: PersistedFeatureFlag[] = [];

    for (const flagId of Object.keys(ALL_FLAGS)) {
      const flag = await this.getFlag(flagId);
      if (flag) flags.push(flag);
    }

    return flags;
  }

  /**
   * Set runtime override for a flag
   */
  async setOverride(flagId: string, enabled: boolean, expiresInSeconds?: number): Promise<void> {
    if (!ALL_FLAGS[flagId]) {
      throw new Error(`Unknown feature flag: ${flagId}`);
    }

    const overrideKey = `${FeatureFlagService.OVERRIDE_PREFIX}${this.environment}:${flagId}`;

    if (expiresInSeconds) {
      await this.redis.setex(overrideKey, expiresInSeconds, String(enabled));
    } else {
      await this.redis.set(overrideKey, String(enabled));
    }

    // Update in-memory state
    ALL_FLAGS[flagId].enabled = enabled;
    ALL_FLAGS[flagId].updatedAt = new Date();

    this.onFlagChange?.(flagId, enabled);
    console.log(`[FeatureFlags] Override set: ${flagId} = ${enabled}`);
  }

  /**
   * Remove runtime override
   */
  async clearOverride(flagId: string): Promise<void> {
    const overrideKey = `${FeatureFlagService.OVERRIDE_PREFIX}${this.environment}:${flagId}`;
    await this.redis.del(overrideKey);

    // Restore in-memory state
    const staticFlag =
      CORE_FEATURES[flagId] ||
      NEW_FEATURES[flagId] ||
      EXPERIMENTAL_FEATURES[flagId] ||
      OPERATIONS_FLAGS[flagId];

    if (staticFlag) {
      ALL_FLAGS[flagId].enabled = staticFlag.enabled;
    }

    console.log(`[FeatureFlags] Override cleared: ${flagId}`);
  }

  /**
   * Emergency disable flags
   */
  async emergencyDisable(flagIds: string[], reason: string): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const flagId of flagIds) {
      pipeline.sadd(FeatureFlagService.EMERGENCY_KEY, flagId);
      // Update in-memory
      if (ALL_FLAGS[flagId]) {
        ALL_FLAGS[flagId].enabled = false;
      }
    }

    // Store reason for audit
    pipeline.hset(
      'feature:emergency:reasons',
      Date.now().toString(),
      JSON.stringify({
        flagIds,
        reason,
        timestamp: new Date().toISOString(),
      })
    );

    await pipeline.exec();

    // Notify
    for (const flagId of flagIds) {
      this.onFlagChange?.(flagId, false);
    }

    console.error(`[FeatureFlags] EMERGENCY DISABLE: ${flagIds.join(', ')} - ${reason}`);
  }

  /**
   * Remove emergency disable
   */
  async clearEmergencyDisable(flagIds: string[]): Promise<void> {
    for (const flagId of flagIds) {
      await this.redis.srem(FeatureFlagService.EMERGENCY_KEY, flagId);

      // Restore state
      const staticFlag = ALL_FLAGS[flagId];
      if (staticFlag) {
        const overrideKey = `${FeatureFlagService.OVERRIDE_PREFIX}${this.environment}:${flagId}`;
        const override = await this.redis.get(overrideKey);
        ALL_FLAGS[flagId].enabled = override !== null ? override === 'true' : staticFlag.enabled;
      }
    }

    console.log(`[FeatureFlags] Emergency disable cleared: ${flagIds.join(', ')}`);
  }

  /**
   * Get emergency disabled flags
   */
  async getEmergencyDisabled(): Promise<string[]> {
    return this.redis.smembers(FeatureFlagService.EMERGENCY_KEY);
  }

  /**
   * Update rollout percentage
   */
  async setRolloutPercentage(flagId: string, percentage: number): Promise<void> {
    if (!ALL_FLAGS[flagId]) {
      throw new Error(`Unknown feature flag: ${flagId}`);
    }

    if (percentage < 0 || percentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }

    ALL_FLAGS[flagId].rolloutPercentage = percentage;
    ALL_FLAGS[flagId].updatedAt = new Date();

    // Persist to Redis
    const redisKey = `${FeatureFlagService.KEY_PREFIX}${this.environment}:${flagId}`;
    await this.redis.set(redisKey, JSON.stringify(ALL_FLAGS[flagId]), 'EX', this.cacheExpiration);

    console.log(`[FeatureFlags] Rollout updated: ${flagId} = ${percentage}%`);
  }

  /**
   * Add user to target group
   */
  async addToTargetGroup(flagId: string, group: string): Promise<void> {
    if (!ALL_FLAGS[flagId]) {
      throw new Error(`Unknown feature flag: ${flagId}`);
    }

    if (!ALL_FLAGS[flagId].targetGroups) {
      ALL_FLAGS[flagId].targetGroups = [];
    }

    if (!ALL_FLAGS[flagId].targetGroups!.includes(group)) {
      ALL_FLAGS[flagId].targetGroups!.push(group);
      ALL_FLAGS[flagId].updatedAt = new Date();

      const redisKey = `${FeatureFlagService.KEY_PREFIX}${this.environment}:${flagId}`;
      await this.redis.set(redisKey, JSON.stringify(ALL_FLAGS[flagId]), 'EX', this.cacheExpiration);
    }
  }

  /**
   * Remove user from target group
   */
  async removeFromTargetGroup(flagId: string, group: string): Promise<void> {
    if (!ALL_FLAGS[flagId]) {
      throw new Error(`Unknown feature flag: ${flagId}`);
    }

    if (ALL_FLAGS[flagId].targetGroups) {
      ALL_FLAGS[flagId].targetGroups = ALL_FLAGS[flagId].targetGroups!.filter((g) => g !== group);
      ALL_FLAGS[flagId].updatedAt = new Date();

      const redisKey = `${FeatureFlagService.KEY_PREFIX}${this.environment}:${flagId}`;
      await this.redis.set(redisKey, JSON.stringify(ALL_FLAGS[flagId]), 'EX', this.cacheExpiration);
    }
  }
}

// Singleton instance
let featureFlagServiceInstance: FeatureFlagService | null = null;

/**
 * Initialize the feature flag service
 */
export function initializeFeatureFlagService(config: FeatureFlagServiceConfig): FeatureFlagService {
  featureFlagServiceInstance = new FeatureFlagService(config);
  return featureFlagServiceInstance;
}

/**
 * Get the feature flag service instance
 */
export function getFeatureFlagService(): FeatureFlagService | null {
  return featureFlagServiceInstance;
}

/**
 * Reset the feature flag service (for testing)
 */
export function resetFeatureFlagService(): void {
  featureFlagServiceInstance = null;
}

export default {
  CORE_FEATURES,
  NEW_FEATURES,
  EXPERIMENTAL_FEATURES,
  OPERATIONS_FLAGS,
  ALL_FLAGS,
  isFeatureEnabled,
  getEnabledFlags,
  emergencyDisable,
  FeatureFlagService,
  initializeFeatureFlagService,
  getFeatureFlagService,
  resetFeatureFlagService,
};
