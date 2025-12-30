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

  // TODO: Persist to database/feature flag service
  // TODO: Send alert to on-call
  // TODO: Update status page
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
};
