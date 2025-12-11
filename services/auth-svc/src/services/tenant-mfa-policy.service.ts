/**
 * @module @skillancer/auth-svc/services/tenant-mfa-policy
 * Tenant MFA Policy Service
 */

import { CacheService } from '@skillancer/cache';
import { prisma, MfaMethod } from '@skillancer/database';

import { getConfig } from '../config/index.js';

import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface TenantMfaPolicy {
  /** Whether MFA is required for the tenant */
  mfaRequired: boolean;
  /** Allowed MFA methods */
  allowedMethods: MfaMethod[];
  /** Grace period in days for new users to set up MFA */
  gracePeriodDays: number;
  /** Require MFA for specific roles */
  requiredForRoles: string[];
  /** Require MFA for specific actions */
  requiredForActions: string[];
  /** Trust device settings */
  trustedDevices: {
    allowed: boolean;
    maxDays: number;
    requireIpMatch: boolean;
  };
  /** Recovery options */
  recovery: {
    emailRecoveryAllowed: boolean;
    adminRecoveryAllowed: boolean;
  };
}

export interface UserMfaEnforcementStatus {
  required: boolean;
  reason: 'tenant_policy' | 'role_policy' | 'user_setting' | 'not_required';
  gracePeriodEnds?: Date;
  isInGracePeriod: boolean;
  allowedMethods: MfaMethod[];
  mustSetupBy?: Date;
}

export interface MfaComplianceResult {
  compliant: boolean;
  reasons: string[];
  actions: string[];
}

// =============================================================================
// DEFAULT POLICY
// =============================================================================

const DEFAULT_MFA_POLICY: TenantMfaPolicy = {
  mfaRequired: false,
  allowedMethods: [MfaMethod.TOTP, MfaMethod.SMS, MfaMethod.EMAIL, MfaMethod.RECOVERY_CODE],
  gracePeriodDays: 7,
  requiredForRoles: ['admin', 'owner'],
  requiredForActions: ['delete_account', 'change_password', 'manage_api_keys'],
  trustedDevices: {
    allowed: true,
    maxDays: 30,
    requireIpMatch: false,
  },
  recovery: {
    emailRecoveryAllowed: true,
    adminRecoveryAllowed: true,
  },
};

// =============================================================================
// CACHE KEYS
// =============================================================================

const CacheKeys = {
  tenantPolicy: (tenantId: string) => `mfa_policy:tenant:${tenantId}`,
  userEnforcement: (userId: string) => `mfa_policy:user:${userId}`,
};

// =============================================================================
// TENANT MFA POLICY SERVICE
// =============================================================================

/**
 * Tenant MFA Policy Service
 *
 * Manages MFA policies at the tenant level:
 * - Tenant-wide MFA requirements
 * - Role-based MFA enforcement
 * - Grace periods for new users
 * - Allowed MFA methods configuration
 */
export class TenantMfaPolicyService {
  private redis: Redis;
  private cache: CacheService;
  private config: ReturnType<typeof getConfig>;

  constructor(redis: Redis) {
    this.redis = redis;
    this.cache = new CacheService(redis, 'mfa_policy');
    this.config = getConfig();
  }

  // ---------------------------------------------------------------------------
  // POLICY RETRIEVAL
  // ---------------------------------------------------------------------------

  /**
   * Get MFA policy for a tenant
   */
  async getTenantMfaPolicy(tenantId: string): Promise<TenantMfaPolicy> {
    // Check cache first
    const cached = await this.redis.get(CacheKeys.tenantPolicy(tenantId));
    if (cached) {
      return { ...DEFAULT_MFA_POLICY, ...(JSON.parse(cached) as Partial<TenantMfaPolicy>) };
    }

    // Get from database
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    const settings = tenant?.settings as { mfaPolicy?: Partial<TenantMfaPolicy> } | null;
    const policy = { ...DEFAULT_MFA_POLICY, ...(settings?.mfaPolicy || {}) };

    // Cache for 5 minutes
    await this.redis.setex(CacheKeys.tenantPolicy(tenantId), 300, JSON.stringify(policy));

    return policy;
  }

  /**
   * Update MFA policy for a tenant
   */
  async updateTenantMfaPolicy(
    tenantId: string,
    updates: Partial<TenantMfaPolicy>
  ): Promise<TenantMfaPolicy> {
    const currentPolicy = await this.getTenantMfaPolicy(tenantId);
    const newPolicy = { ...currentPolicy, ...updates };

    // Get current settings
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    const currentSettings = (tenant?.settings as Record<string, unknown>) || {};

    // Update tenant settings
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...currentSettings,
          mfaPolicy: newPolicy,
        },
      },
    });

    // Invalidate cache
    await this.redis.del(CacheKeys.tenantPolicy(tenantId));

    // If MFA is now required, enforce for existing users
    if (newPolicy.mfaRequired && !currentPolicy.mfaRequired) {
      await this.enforceNewMfaPolicy(tenantId);
    }

    return newPolicy;
  }

  // ---------------------------------------------------------------------------
  // USER ENFORCEMENT
  // ---------------------------------------------------------------------------

  /**
   * Get user's tenant ID via memberships
   */
  private async getUserTenantId(userId: string): Promise<string | null> {
    const membership = await prisma.tenantMember.findFirst({
      where: { userId },
      select: { tenantId: true },
    });
    return membership?.tenantId || null;
  }

  /**
   * Check MFA enforcement status for a user
   */
  async getUserMfaEnforcementStatus(userId: string): Promise<UserMfaEnforcementStatus> {
    // Get user with MFA settings
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        createdAt: true,
        mfa: {
          select: {
            enabled: true,
            enforcedAt: true,
          },
        },
      },
    });

    if (!user) {
      return {
        required: false,
        reason: 'not_required',
        isInGracePeriod: false,
        allowedMethods: DEFAULT_MFA_POLICY.allowedMethods,
      };
    }

    // Get tenant memberships to check for tenant ID and roles
    const memberships = await prisma.tenantMember.findMany({
      where: { userId },
      select: {
        tenantId: true,
        role: true,
      },
    });

    const tenantId = memberships[0]?.tenantId;

    if (!tenantId) {
      return {
        required: user.mfa?.enabled || false,
        reason: user.mfa?.enabled ? 'user_setting' : 'not_required',
        isInGracePeriod: false,
        allowedMethods: DEFAULT_MFA_POLICY.allowedMethods,
      };
    }

    const policy = await this.getTenantMfaPolicy(tenantId);

    // Check if user's role requires MFA
    const userRoles = memberships.map((m) => m.role.toLowerCase());
    const roleRequiresMfa = policy.requiredForRoles.some((role) =>
      userRoles.includes(role.toLowerCase())
    );

    // Determine if MFA is required
    const required = policy.mfaRequired || roleRequiresMfa;

    if (!required) {
      return {
        required: user.mfa?.enabled || false,
        reason: user.mfa?.enabled ? 'user_setting' : 'not_required',
        isInGracePeriod: false,
        allowedMethods: policy.allowedMethods,
      };
    }

    // Calculate grace period
    const enforcedAt = user.mfa?.enforcedAt || user.createdAt;
    const gracePeriodEnds = new Date(
      enforcedAt.getTime() + policy.gracePeriodDays * 24 * 60 * 60 * 1000
    );
    const isInGracePeriod = new Date() < gracePeriodEnds;

    return {
      required: true,
      reason: policy.mfaRequired ? 'tenant_policy' : 'role_policy',
      gracePeriodEnds,
      isInGracePeriod,
      allowedMethods: policy.allowedMethods,
      ...(isInGracePeriod && { mustSetupBy: gracePeriodEnds }),
    };
  }

  /**
   * Check if user is MFA compliant with tenant policy
   */
  async checkMfaCompliance(userId: string): Promise<MfaComplianceResult> {
    const enforcementStatus = await this.getUserMfaEnforcementStatus(userId);

    if (!enforcementStatus.required) {
      return { compliant: true, reasons: [], actions: [] };
    }

    // Get user's MFA settings
    const mfaSettings = await prisma.userMfa.findUnique({
      where: { userId },
      select: {
        enabled: true,
        totpVerified: true,
        phoneVerified: true,
        recoveryCodes: true,
      },
    });

    const reasons: string[] = [];
    const actions: string[] = [];

    // Check if MFA is enabled
    if (!mfaSettings?.enabled) {
      reasons.push('MFA is not enabled');
      actions.push('Enable MFA in your security settings');
    }

    // Check if at least one primary method is configured
    const hasPrimaryMethod = mfaSettings?.totpVerified || mfaSettings?.phoneVerified;
    if (!hasPrimaryMethod) {
      reasons.push('No primary MFA method configured');
      actions.push('Set up TOTP (authenticator app) or SMS verification');
    }

    // Check recovery codes
    const hasRecoveryCodes = (mfaSettings?.recoveryCodes?.length ?? 0) > 0;
    if (!hasRecoveryCodes) {
      reasons.push('No recovery codes available');
      actions.push('Generate recovery codes');
    }

    const compliant = reasons.length === 0;

    // If not compliant and not in grace period, this is critical
    if (!compliant && !enforcementStatus.isInGracePeriod) {
      reasons.unshift('MFA setup deadline has passed');
    }

    return { compliant, reasons, actions };
  }

  /**
   * Check if an action requires MFA (step-up authentication)
   */
  async doesActionRequireMfa(userId: string, action: string): Promise<boolean> {
    const tenantId = await this.getUserTenantId(userId);

    if (!tenantId) {
      // Use default required actions
      return DEFAULT_MFA_POLICY.requiredForActions.includes(action);
    }

    const policy = await this.getTenantMfaPolicy(tenantId);
    return policy.requiredForActions.includes(action);
  }

  /**
   * Check if method is allowed by tenant policy
   */
  async isMethodAllowed(userId: string, method: MfaMethod): Promise<boolean> {
    const tenantId = await this.getUserTenantId(userId);

    if (!tenantId) {
      return true; // All methods allowed without tenant
    }

    const policy = await this.getTenantMfaPolicy(tenantId);
    return policy.allowedMethods.includes(method);
  }

  // ---------------------------------------------------------------------------
  // ENFORCEMENT
  // ---------------------------------------------------------------------------

  /**
   * Enforce MFA for a user (sets enforcement timestamp)
   */
  async enforceMfaForUser(userId: string, reason: string): Promise<void> {
    await prisma.userMfa.upsert({
      where: { userId },
      update: {
        enforcedAt: new Date(),
        enforcedBy: reason,
      },
      create: {
        userId,
        enforcedAt: new Date(),
        enforcedBy: reason,
      },
    });

    // Log enforcement
    console.log(`[MFA Policy] Enforced MFA for user ${userId}: ${reason}`);
  }

  /**
   * Enforce new MFA policy for all users in a tenant
   */
  private async enforceNewMfaPolicy(tenantId: string): Promise<void> {
    // Get all tenant members without MFA enforced
    const memberships = await prisma.tenantMember.findMany({
      where: {
        tenantId,
        user: {
          OR: [{ mfa: null }, { mfa: { enforcedAt: null } }],
        },
      },
      select: { userId: true },
    });

    const userIds = memberships.map((m) => m.userId);

    if (userIds.length === 0) {
      return;
    }

    // Batch update
    const now = new Date();
    for (const userId of userIds) {
      await prisma.userMfa.upsert({
        where: { userId },
        update: { enforcedAt: now, enforcedBy: 'tenant_policy' },
        create: { userId, enforcedAt: now, enforcedBy: 'tenant_policy' },
      });
    }

    console.log(`[MFA Policy] Enforced MFA for ${userIds.length} users in tenant ${tenantId}`);

    // Invalidate user enforcement caches
    const pipeline = this.redis.pipeline();
    for (const userId of userIds) {
      pipeline.del(CacheKeys.userEnforcement(userId));
    }
    await pipeline.exec();
  }

  // ---------------------------------------------------------------------------
  // TRUSTED DEVICES POLICY
  // ---------------------------------------------------------------------------

  /**
   * Check if trusted devices are allowed for user
   */
  async areTrustedDevicesAllowed(userId: string): Promise<{
    allowed: boolean;
    maxDays: number;
    requireIpMatch: boolean;
  }> {
    const tenantId = await this.getUserTenantId(userId);

    if (!tenantId) {
      return DEFAULT_MFA_POLICY.trustedDevices;
    }

    const policy = await this.getTenantMfaPolicy(tenantId);
    return policy.trustedDevices;
  }

  /**
   * Check if recovery method is allowed
   */
  async isRecoveryMethodAllowed(userId: string, method: 'email' | 'admin'): Promise<boolean> {
    const tenantId = await this.getUserTenantId(userId);

    if (!tenantId) {
      return true;
    }

    const policy = await this.getTenantMfaPolicy(tenantId);

    if (method === 'email') {
      return policy.recovery.emailRecoveryAllowed;
    } else {
      return policy.recovery.adminRecoveryAllowed;
    }
  }
}

// =============================================================================
// MODULE-LEVEL INSTANCE MANAGEMENT
// =============================================================================

let tenantMfaPolicyServiceInstance: TenantMfaPolicyService | null = null;

/**
 * Initialize the TenantMfaPolicyService
 */
export function initializeTenantMfaPolicyService(redis: Redis): TenantMfaPolicyService {
  tenantMfaPolicyServiceInstance = new TenantMfaPolicyService(redis);
  return tenantMfaPolicyServiceInstance;
}

/**
 * Get the TenantMfaPolicyService instance
 */
export function getTenantMfaPolicyService(): TenantMfaPolicyService {
  if (!tenantMfaPolicyServiceInstance) {
    throw new Error(
      'TenantMfaPolicyService not initialized. Call initializeTenantMfaPolicyService first.'
    );
  }
  return tenantMfaPolicyServiceInstance;
}

/**
 * Reset the TenantMfaPolicyService instance (for testing)
 */
export function resetTenantMfaPolicyService(): void {
  tenantMfaPolicyServiceInstance = null;
}

export default TenantMfaPolicyService;
