// @ts-nocheck
/**
 * @module @skillancer/skillpod-svc/admin/tenant-management
 * Tenant Management for B2B SkillPod
 *
 * Features:
 * - Create/configure tenants (enterprise customers)
 * - Branding customization
 * - Security policy defaults
 * - Usage limits and quotas
 * - Feature flags per plan
 * - Tenant lifecycle management
 * - GDPR-compliant data handling
 */

import { randomBytes, createHash } from 'crypto';

import { createAuditLog } from '@skillancer/audit-client';
import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';

// =============================================================================
// TYPES
// =============================================================================

export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'DELETED';
export type TenantPlan = 'STARTER' | 'PRO' | 'ENTERPRISE' | 'TRIAL';

export interface TenantBranding {
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  companyName: string;
  supportEmail?: string;
  customDomain?: string;
}

export interface TenantLimits {
  maxUsers: number;
  maxConcurrentSessions: number;
  storageQuotaGB: number;
  recordingStorageGB: number;
  recordingRetentionDays: number;
  maxPolicies: number;
  apiRateLimit: number;
}

export interface TenantFeatureFlags {
  sessionRecording: boolean;
  ssoEnabled: boolean;
  scimProvisioning: boolean;
  customPolicies: boolean;
  apiAccess: boolean;
  webhooks: boolean;
  advancedReporting: boolean;
  complianceReports: boolean;
  watermarking: boolean;
  clipboardBlocking: boolean;
  fileTransferBlocking: boolean;
  screenshotPrevention: boolean;
}

export interface CreateTenantRequest {
  companyName: string;
  industry?: string;
  size?: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
  plan: TenantPlan;
  billingEmail?: string;
  branding?: Partial<TenantBranding>;
}

export interface Tenant {
  id: string;
  slug: string;
  companyName: string;
  industry?: string;
  size?: string;
  status: TenantStatus;
  plan: TenantPlan;
  branding: TenantBranding;
  limits: TenantLimits;
  features: TenantFeatureFlags;
  billingEmail?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt: Date;
  updatedAt: Date;
  suspendedAt?: Date;
  deletedAt?: Date;
}

export interface TenantUsage {
  tenantId: string;
  period: string;
  activeUsers: number;
  totalSessions: number;
  totalSessionMinutes: number;
  storageUsedGB: number;
  recordingStorageUsedGB: number;
  apiCalls: number;
  policyViolations: number;
}

// =============================================================================
// PLAN CONFIGURATIONS
// =============================================================================

const PLAN_LIMITS: Record<TenantPlan, TenantLimits> = {
  STARTER: {
    maxUsers: 5,
    maxConcurrentSessions: 5,
    storageQuotaGB: 10,
    recordingStorageGB: 0,
    recordingRetentionDays: 0,
    maxPolicies: 3,
    apiRateLimit: 100,
  },
  PRO: {
    maxUsers: 25,
    maxConcurrentSessions: 25,
    storageQuotaGB: 100,
    recordingStorageGB: 50,
    recordingRetentionDays: 30,
    maxPolicies: 10,
    apiRateLimit: 1000,
  },
  ENTERPRISE: {
    maxUsers: -1, // Unlimited
    maxConcurrentSessions: -1,
    storageQuotaGB: -1,
    recordingStorageGB: -1,
    recordingRetentionDays: 365,
    maxPolicies: -1,
    apiRateLimit: 10000,
  },
  TRIAL: {
    maxUsers: 5,
    maxConcurrentSessions: 5,
    storageQuotaGB: 10,
    recordingStorageGB: 10,
    recordingRetentionDays: 14,
    maxPolicies: 5,
    apiRateLimit: 500,
  },
};

const PLAN_FEATURES: Record<TenantPlan, TenantFeatureFlags> = {
  STARTER: {
    sessionRecording: false,
    ssoEnabled: false,
    scimProvisioning: false,
    customPolicies: false,
    apiAccess: false,
    webhooks: false,
    advancedReporting: false,
    complianceReports: false,
    watermarking: true,
    clipboardBlocking: true,
    fileTransferBlocking: true,
    screenshotPrevention: false,
  },
  PRO: {
    sessionRecording: true,
    ssoEnabled: true,
    scimProvisioning: false,
    customPolicies: true,
    apiAccess: true,
    webhooks: true,
    advancedReporting: true,
    complianceReports: false,
    watermarking: true,
    clipboardBlocking: true,
    fileTransferBlocking: true,
    screenshotPrevention: true,
  },
  ENTERPRISE: {
    sessionRecording: true,
    ssoEnabled: true,
    scimProvisioning: true,
    customPolicies: true,
    apiAccess: true,
    webhooks: true,
    advancedReporting: true,
    complianceReports: true,
    watermarking: true,
    clipboardBlocking: true,
    fileTransferBlocking: true,
    screenshotPrevention: true,
  },
  TRIAL: {
    sessionRecording: true,
    ssoEnabled: true,
    scimProvisioning: false,
    customPolicies: true,
    apiAccess: true,
    webhooks: true,
    advancedReporting: true,
    complianceReports: true,
    watermarking: true,
    clipboardBlocking: true,
    fileTransferBlocking: true,
    screenshotPrevention: true,
  },
};

// =============================================================================
// TENANT MANAGEMENT SERVICE
// =============================================================================

export class TenantManagementService {
  /**
   * Create a new tenant
   */
  async createTenant(request: CreateTenantRequest): Promise<Tenant> {
    logger.info({ companyName: request.companyName }, 'Creating new tenant');

    // Generate unique slug
    const slug = await this.generateUniqueSlug(request.companyName);

    // Get plan configuration
    const limits = PLAN_LIMITS[request.plan];
    const features = PLAN_FEATURES[request.plan];

    // Default branding
    const branding: TenantBranding = {
      companyName: request.companyName,
      primaryColor: '#2563eb',
      secondaryColor: '#1e40af',
      ...request.branding,
    };

    const tenant = await prisma.$transaction(async (tx) => {
      // Create tenant record
      const newTenant = await tx.skillpodTenant.create({
        data: {
          slug,
          companyName: request.companyName,
          industry: request.industry,
          size: request.size,
          status: 'PENDING',
          plan: request.plan,
          branding: branding as Record<string, unknown>,
          limits: limits as Record<string, unknown>,
          features: features as Record<string, unknown>,
          billingEmail: request.billingEmail || request.adminEmail,
        },
      });

      // Create admin user
      await tx.skillpodTenantUser.create({
        data: {
          tenantId: newTenant.id,
          email: request.adminEmail,
          firstName: request.adminFirstName,
          lastName: request.adminLastName,
          role: 'SUPER_ADMIN',
          status: 'INVITED',
          invitedAt: new Date(),
          inviteToken: this.generateInviteToken(),
          inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Create default security policy
      await tx.skillpodPolicy.create({
        data: {
          tenantId: newTenant.id,
          name: 'Default Policy',
          description: 'Default security policy for all users',
          isDefault: true,
          settings: {
            clipboardBlocking: true,
            fileTransferBlocking: true,
            screenshotPrevention: features.screenshotPrevention,
            watermarking: true,
            sessionTimeout: 480, // 8 hours
            idleTimeout: 30, // 30 minutes
          },
        },
      });

      return newTenant;
    });

    await createAuditLog({
      action: 'TENANT_CREATED',
      resourceType: 'skillpod_tenant',
      resourceId: tenant.id,
      metadata: {
        companyName: request.companyName,
        plan: request.plan,
        adminEmail: request.adminEmail,
      },
    });

    logger.info({ tenantId: tenant.id, slug }, 'Tenant created successfully');

    return this.mapTenantFromDb(tenant);
  }

  /**
   * Get tenant by ID
   */
  async getTenant(tenantId: string): Promise<Tenant | null> {
    const tenant = await prisma.skillpodTenant.findUnique({
      where: { id: tenantId },
    });

    return tenant ? this.mapTenantFromDb(tenant) : null;
  }

  /**
   * Get tenant by slug
   */
  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    const tenant = await prisma.skillpodTenant.findUnique({
      where: { slug },
    });

    return tenant ? this.mapTenantFromDb(tenant) : null;
  }

  /**
   * Update tenant configuration
   */
  async updateTenant(
    tenantId: string,
    updates: Partial<{
      companyName: string;
      industry: string;
      size: string;
      branding: Partial<TenantBranding>;
      billingEmail: string;
    }>
  ): Promise<Tenant> {
    const existing = await prisma.skillpodTenant.findUnique({
      where: { id: tenantId },
    });

    if (!existing) {
      throw new Error('Tenant not found');
    }

    const updateData: Record<string, unknown> = {};

    if (updates.companyName) updateData.companyName = updates.companyName;
    if (updates.industry) updateData.industry = updates.industry;
    if (updates.size) updateData.size = updates.size;
    if (updates.billingEmail) updateData.billingEmail = updates.billingEmail;

    if (updates.branding) {
      updateData.branding = {
        ...(existing.branding as Record<string, unknown>),
        ...updates.branding,
      };
    }

    const tenant = await prisma.skillpodTenant.update({
      where: { id: tenantId },
      data: updateData,
    });

    await createAuditLog({
      action: 'TENANT_UPDATED',
      resourceType: 'skillpod_tenant',
      resourceId: tenantId,
      metadata: { updates: Object.keys(updates) },
    });

    return this.mapTenantFromDb(tenant);
  }

  /**
   * Update tenant plan
   */
  async updateTenantPlan(tenantId: string, plan: TenantPlan): Promise<Tenant> {
    const limits = PLAN_LIMITS[plan];
    const features = PLAN_FEATURES[plan];

    const tenant = await prisma.skillpodTenant.update({
      where: { id: tenantId },
      data: {
        plan,
        limits: limits as Record<string, unknown>,
        features: features as Record<string, unknown>,
      },
    });

    await createAuditLog({
      action: 'TENANT_PLAN_CHANGED',
      resourceType: 'skillpod_tenant',
      resourceId: tenantId,
      metadata: { newPlan: plan },
    });

    logger.info({ tenantId, plan }, 'Tenant plan updated');

    return this.mapTenantFromDb(tenant);
  }

  /**
   * Suspend tenant
   */
  async suspendTenant(tenantId: string, reason: string): Promise<Tenant> {
    const tenant = await prisma.skillpodTenant.update({
      where: { id: tenantId },
      data: {
        status: 'SUSPENDED',
        suspendedAt: new Date(),
        suspensionReason: reason,
      },
    });

    // Terminate all active sessions
    await prisma.skillpodSession.updateMany({
      where: { tenantId, status: 'ACTIVE' },
      data: { status: 'TERMINATED', terminatedAt: new Date() },
    });

    await createAuditLog({
      action: 'TENANT_SUSPENDED',
      resourceType: 'skillpod_tenant',
      resourceId: tenantId,
      metadata: { reason },
    });

    logger.warn({ tenantId, reason }, 'Tenant suspended');

    return this.mapTenantFromDb(tenant);
  }

  /**
   * Reactivate suspended tenant
   */
  async reactivateTenant(tenantId: string): Promise<Tenant> {
    const tenant = await prisma.skillpodTenant.update({
      where: { id: tenantId },
      data: {
        status: 'ACTIVE',
        suspendedAt: null,
        suspensionReason: null,
      },
    });

    await createAuditLog({
      action: 'TENANT_REACTIVATED',
      resourceType: 'skillpod_tenant',
      resourceId: tenantId,
    });

    logger.info({ tenantId }, 'Tenant reactivated');

    return this.mapTenantFromDb(tenant);
  }

  /**
   * Export tenant data (GDPR)
   */
  async exportTenantData(tenantId: string): Promise<{
    tenant: Tenant;
    users: unknown[];
    sessions: unknown[];
    policies: unknown[];
    auditLogs: unknown[];
  }> {
    logger.info({ tenantId }, 'Exporting tenant data');

    const [tenant, users, sessions, policies, auditLogs] = await Promise.all([
      prisma.skillpodTenant.findUnique({ where: { id: tenantId } }),
      prisma.skillpodTenantUser.findMany({ where: { tenantId } }),
      prisma.skillpodSession.findMany({
        where: { tenantId },
        take: 10000,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.skillpodPolicy.findMany({ where: { tenantId } }),
      prisma.auditLog.findMany({
        where: { resourceId: tenantId },
        take: 50000,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    await createAuditLog({
      action: 'TENANT_DATA_EXPORTED',
      resourceType: 'skillpod_tenant',
      resourceId: tenantId,
    });

    return {
      tenant: tenant ? this.mapTenantFromDb(tenant) : ({} as Tenant),
      users,
      sessions,
      policies,
      auditLogs,
    };
  }

  /**
   * Delete tenant (GDPR - right to be forgotten)
   */
  async deleteTenant(tenantId: string, confirmation: string): Promise<void> {
    if (confirmation !== `DELETE-${tenantId}`) {
      throw new Error('Invalid deletion confirmation');
    }

    logger.warn({ tenantId }, 'Initiating tenant deletion');

    await prisma.$transaction(async (tx) => {
      // Delete in order of dependencies
      await tx.skillpodSession.deleteMany({ where: { tenantId } });
      await tx.skillpodPolicy.deleteMany({ where: { tenantId } });
      await tx.skillpodTenantUser.deleteMany({ where: { tenantId } });
      await tx.skillpodAPIKey.deleteMany({ where: { tenantId } });
      await tx.skillpodSSOConfig.deleteMany({ where: { tenantId } });

      // Soft delete tenant record
      await tx.skillpodTenant.update({
        where: { id: tenantId },
        data: {
          status: 'DELETED',
          deletedAt: new Date(),
          // Anonymize data
          companyName: `DELETED-${tenantId.slice(0, 8)}`,
          billingEmail: null,
          branding: {},
        },
      });
    });

    await createAuditLog({
      action: 'TENANT_DELETED',
      resourceType: 'skillpod_tenant',
      resourceId: tenantId,
    });

    logger.warn({ tenantId }, 'Tenant deleted');
  }

  /**
   * Get tenant usage statistics
   */
  async getTenantUsage(tenantId: string, period?: string): Promise<TenantUsage> {
    const now = new Date();
    const periodStart = period ? new Date(period) : new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0);

    const [activeUsers, sessions, storage, apiCalls, violations] = await Promise.all([
      prisma.skillpodTenantUser.count({
        where: { tenantId, status: 'ACTIVE' },
      }),
      prisma.skillpodSession.aggregate({
        where: {
          tenantId,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
        _count: true,
        _sum: { durationMinutes: true },
      }),
      prisma.skillpodStorage.aggregate({
        where: { tenantId },
        _sum: { sizeBytes: true },
      }),
      prisma.skillpodAPILog.count({
        where: {
          tenantId,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
      }),
      prisma.skillpodSecurityEvent.count({
        where: {
          tenantId,
          type: 'POLICY_VIOLATION',
          createdAt: { gte: periodStart, lte: periodEnd },
        },
      }),
    ]);

    return {
      tenantId,
      period: periodStart.toISOString().slice(0, 7),
      activeUsers,
      totalSessions: sessions._count || 0,
      totalSessionMinutes: sessions._sum.durationMinutes || 0,
      storageUsedGB: Math.round(((storage._sum.sizeBytes || 0) / (1024 * 1024 * 1024)) * 100) / 100,
      recordingStorageUsedGB: 0, // Would calculate from recordings
      apiCalls,
      policyViolations: violations,
    };
  }

  /**
   * Check if tenant is within limits
   */
  async checkTenantLimits(tenantId: string): Promise<{
    withinLimits: boolean;
    violations: string[];
  }> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) throw new Error('Tenant not found');

    const usage = await this.getTenantUsage(tenantId);
    const violations: string[] = [];

    if (tenant.limits.maxUsers !== -1 && usage.activeUsers > tenant.limits.maxUsers) {
      violations.push(`User limit exceeded: ${usage.activeUsers}/${tenant.limits.maxUsers}`);
    }

    if (tenant.limits.storageQuotaGB !== -1 && usage.storageUsedGB > tenant.limits.storageQuotaGB) {
      violations.push(
        `Storage limit exceeded: ${usage.storageUsedGB}GB/${tenant.limits.storageQuotaGB}GB`
      );
    }

    return {
      withinLimits: violations.length === 0,
      violations,
    };
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private async generateUniqueSlug(companyName: string): Promise<string> {
    const baseSlug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);

    let slug = baseSlug;
    let counter = 1;

    while (await prisma.skillpodTenant.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  private generateInviteToken(): string {
    return randomBytes(32).toString('hex');
  }

  private mapTenantFromDb(db: Record<string, unknown>): Tenant {
    return {
      id: db.id as string,
      slug: db.slug as string,
      companyName: db.companyName as string,
      industry: db.industry as string | undefined,
      size: db.size as string | undefined,
      status: db.status as TenantStatus,
      plan: db.plan as TenantPlan,
      branding: db.branding as TenantBranding,
      limits: db.limits as TenantLimits,
      features: db.features as TenantFeatureFlags,
      billingEmail: db.billingEmail as string | undefined,
      stripeCustomerId: db.stripeCustomerId as string | undefined,
      stripeSubscriptionId: db.stripeSubscriptionId as string | undefined,
      createdAt: db.createdAt as Date,
      updatedAt: db.updatedAt as Date,
      suspendedAt: db.suspendedAt as Date | undefined,
      deletedAt: db.deletedAt as Date | undefined,
    };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let tenantService: TenantManagementService | null = null;

export function getTenantManagementService(): TenantManagementService {
  if (!tenantService) {
    tenantService = new TenantManagementService();
  }
  return tenantService;
}
