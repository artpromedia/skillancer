// @ts-nocheck
/**
 * Enterprise Provisioning Service
 * Handles tenant provisioning during B2B onboarding
 */

import { PrismaClient } from '@/types/prisma-shim.js';
import { randomBytes, createHash } from 'crypto';
import { getLogger } from '@skillancer/logger';
import { getAuditClient } from '@skillancer/audit-client';
import { publishEvent } from '../events/publisher';

// =============================================================================
// TYPES
// =============================================================================

interface TechnicalContact {
  name: string;
  email: string;
  phone?: string;
}

interface CompanyInfo {
  companyName: string;
  industry: string;
  employeeCount: string;
  website?: string;
  billingEmail: string;
  technicalContact: TechnicalContact;
}

interface TeamSetup {
  initialAdmins: Array<{ email: string; role: 'SUPER_ADMIN' | 'SECURITY_ADMIN' }>;
  estimatedUsers: number;
  departments: string[];
}

interface SecurityConfig {
  ssoProvider: 'none' | 'okta' | 'azure_ad' | 'google' | 'custom_saml';
  mfaRequired: boolean;
  ipWhitelisting: boolean;
  allowedIpRanges: string[];
  sessionTimeout: number;
  dataRetentionDays: number;
}

interface PolicyConfig {
  defaultPolicy: 'restrictive' | 'balanced' | 'permissive';
  enableRecording: boolean;
  enableWatermarking: boolean;
  blockClipboard: boolean;
  blockFileTransfer: boolean;
  blockScreenshots: boolean;
}

interface PlanSelection {
  planId: 'STARTER' | 'PRO' | 'ENTERPRISE';
  billingPeriod: 'monthly' | 'annual';
}

interface ProvisioningRequest {
  company: CompanyInfo;
  team: TeamSetup;
  security: SecurityConfig;
  policies: PolicyConfig;
  plan: PlanSelection;
}

interface ProvisioningResult {
  tenantId: string;
  tenantSlug: string;
  adminPortalUrl: string;
  invitesSent: number;
  setupToken: string;
}

// =============================================================================
// PLAN CONFIGURATION
// =============================================================================

const PLAN_LIMITS = {
  STARTER: {
    maxUsers: 5,
    maxConcurrentSessions: 5,
    storageQuotaGB: 10,
    maxRecordingsHours: 10,
    maxPolicies: 3,
    apiRateLimit: 100,
  },
  PRO: {
    maxUsers: 25,
    maxConcurrentSessions: 25,
    storageQuotaGB: 100,
    maxRecordingsHours: 100,
    maxPolicies: 20,
    apiRateLimit: 1000,
  },
  ENTERPRISE: {
    maxUsers: -1, // Unlimited
    maxConcurrentSessions: -1,
    storageQuotaGB: -1,
    maxRecordingsHours: -1,
    maxPolicies: -1,
    apiRateLimit: 10000,
  },
};

const PLAN_FEATURES = {
  STARTER: {
    sessionRecording: true,
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
};

// =============================================================================
// PROVISIONING SERVICE
// =============================================================================

export class EnterpriseProvisioningService {
  private prisma: PrismaClient;
  private logger = getLogger('enterprise-provisioning');
  private audit = getAuditClient();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Generate URL-safe slug from company name
   */
  private generateSlug(companyName: string): string {
    const base = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);

    const suffix = randomBytes(4).toString('hex');
    return `${base}-${suffix}`;
  }

  /**
   * Generate secure setup token
   */
  private generateSetupToken(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Generate invite token for admin users
   */
  private generateInviteToken(): string {
    return randomBytes(24).toString('base64url');
  }

  /**
   * Validate provisioning request
   */
  private async validateRequest(request: ProvisioningRequest): Promise<void> {
    // Check required fields
    if (!request.company.companyName?.trim()) {
      throw new Error('Company name is required');
    }

    if (!request.company.billingEmail?.trim()) {
      throw new Error('Billing email is required');
    }

    if (!request.team.initialAdmins?.length) {
      throw new Error('At least one admin is required');
    }

    // Check for duplicate company
    const existingTenant = await this.prisma.skillpodTenant.findFirst({
      where: {
        companyName: { equals: request.company.companyName, mode: 'insensitive' },
      },
    });

    if (existingTenant) {
      throw new Error('A tenant with this company name already exists');
    }

    // Check admin email uniqueness
    const adminEmails = request.team.initialAdmins.map((a) => a.email.toLowerCase());
    const duplicates = adminEmails.filter((e, i) => adminEmails.indexOf(e) !== i);
    if (duplicates.length > 0) {
      throw new Error(`Duplicate admin emails: ${duplicates.join(', ')}`);
    }

    // Check if admins already exist in another tenant
    const existingUsers = await this.prisma.skillpodUser.findMany({
      where: {
        email: { in: adminEmails },
      },
      select: { email: true },
    });

    if (existingUsers.length > 0) {
      throw new Error(`Users already exist: ${existingUsers.map((u) => u.email).join(', ')}`);
    }
  }

  /**
   * Create default security policy
   */
  private async createDefaultPolicy(tenantId: string, config: PolicyConfig): Promise<string> {
    const policy = await this.prisma.skillpodPolicy.create({
      data: {
        tenantId,
        name: 'Default Policy',
        description: 'Auto-created during onboarding',
        isDefault: true,
        settings: {
          sessionRecording: config.enableRecording,
          watermarking: config.enableWatermarking,
          clipboardBlocking: config.blockClipboard,
          fileTransferBlocking: config.blockFileTransfer,
          screenshotPrevention: config.blockScreenshots,
          preset: config.defaultPolicy,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return policy.id;
  }

  /**
   * Send admin invitations
   */
  private async sendAdminInvites(
    tenantId: string,
    admins: Array<{ email: string; role: 'SUPER_ADMIN' | 'SECURITY_ADMIN' }>,
    companyName: string
  ): Promise<number> {
    let sentCount = 0;

    for (const admin of admins) {
      const inviteToken = this.generateInviteToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Create pending user record
      await this.prisma.skillpodUser.create({
        data: {
          tenantId,
          email: admin.email.toLowerCase(),
          role: admin.role,
          status: 'INVITED',
          inviteToken,
          inviteExpiresAt: expiresAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Publish event for notification service
      await publishEvent('skillpod.admin.invited', {
        tenantId,
        email: admin.email,
        role: admin.role,
        companyName,
        inviteToken,
        expiresAt: expiresAt.toISOString(),
      });

      sentCount++;
    }

    return sentCount;
  }

  /**
   * Initialize SSO configuration if selected
   */
  private async initializeSsoConfig(
    tenantId: string,
    ssoProvider: SecurityConfig['ssoProvider']
  ): Promise<void> {
    if (ssoProvider === 'none') return;

    const ssoType =
      ssoProvider === 'custom_saml'
        ? 'SAML'
        : ssoProvider === 'azure_ad' || ssoProvider === 'google'
          ? 'OIDC'
          : 'SAML';

    await this.prisma.skillpodSsoConfig.create({
      data: {
        tenantId,
        provider: ssoProvider,
        type: ssoType,
        enabled: false, // Needs manual configuration
        status: 'PENDING_SETUP',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Create billing subscription
   */
  private async createSubscription(
    tenantId: string,
    plan: PlanSelection,
    billingEmail: string
  ): Promise<void> {
    if (plan.planId === 'ENTERPRISE') {
      // Enterprise requires manual setup
      await this.prisma.skillpodSubscription.create({
        data: {
          tenantId,
          planId: plan.planId,
          status: 'PENDING_CONTRACT',
          billingEmail,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Notify sales team
      await publishEvent('skillpod.enterprise.signup', {
        tenantId,
        billingEmail,
      });
    } else {
      // Create trial subscription (14 days)
      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      await this.prisma.skillpodSubscription.create({
        data: {
          tenantId,
          planId: plan.planId,
          billingPeriod: plan.billingPeriod,
          status: 'TRIALING',
          trialEndsAt,
          billingEmail,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }
  }

  /**
   * Main provisioning flow
   */
  async provision(request: ProvisioningRequest): Promise<ProvisioningResult> {
    this.logger.info('Starting enterprise provisioning', {
      companyName: request.company.companyName,
      plan: request.plan.planId,
    });

    // Validate request
    await this.validateRequest(request);

    const slug = this.generateSlug(request.company.companyName);
    const setupToken = this.generateSetupToken();

    // Use transaction for atomic creation
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create tenant
      const tenant = await tx.skillpodTenant.create({
        data: {
          companyName: request.company.companyName,
          slug,
          industry: request.company.industry,
          employeeCount: request.company.employeeCount,
          website: request.company.website,
          billingEmail: request.company.billingEmail,
          technicalContactName: request.company.technicalContact.name,
          technicalContactEmail: request.company.technicalContact.email,
          technicalContactPhone: request.company.technicalContact.phone,
          planId: request.plan.planId,
          status: 'ACTIVE',
          limits: PLAN_LIMITS[request.plan.planId],
          features: PLAN_FEATURES[request.plan.planId],
          setupToken,
          setupTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // 2. Create tenant settings
      await tx.skillpodTenantSettings.create({
        data: {
          tenantId: tenant.id,
          mfaRequired: request.security.mfaRequired,
          ipWhitelisting: request.security.ipWhitelisting,
          allowedIpRanges: request.security.allowedIpRanges,
          sessionTimeoutMinutes: request.security.sessionTimeout,
          dataRetentionDays: request.security.dataRetentionDays,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // 3. Create departments if provided
      if (request.team.departments.length > 0) {
        await tx.skillpodDepartment.createMany({
          data: request.team.departments.map((name) => ({
            tenantId: tenant.id,
            name,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        });
      }

      return tenant;
    });

    // 4. Create default policy (outside transaction for simplicity)
    await this.createDefaultPolicy(result.id, request.policies);

    // 5. Initialize SSO config
    await this.initializeSsoConfig(result.id, request.security.ssoProvider);

    // 6. Create subscription
    await this.createSubscription(result.id, request.plan, request.company.billingEmail);

    // 7. Send admin invites
    const invitesSent = await this.sendAdminInvites(
      result.id,
      request.team.initialAdmins,
      request.company.companyName
    );

    // 8. Publish provisioning complete event
    await publishEvent('skillpod.tenant.provisioned', {
      tenantId: result.id,
      tenantSlug: slug,
      companyName: request.company.companyName,
      planId: request.plan.planId,
      adminCount: invitesSent,
    });

    // 9. Log audit event
    await this.audit.log({
      action: 'TENANT_PROVISIONED',
      resourceType: 'TENANT',
      resourceId: result.id,
      metadata: {
        companyName: request.company.companyName,
        planId: request.plan.planId,
        industry: request.company.industry,
      },
    });

    this.logger.info('Enterprise provisioning complete', {
      tenantId: result.id,
      slug,
      invitesSent,
    });

    return {
      tenantId: result.id,
      tenantSlug: slug,
      adminPortalUrl: `https://skillpod.skillancer.io/${slug}/admin`,
      invitesSent,
      setupToken,
    };
  }

  /**
   * Verify setup token and complete initial setup
   */
  async verifySetupToken(token: string): Promise<{ tenantId: string; companyName: string }> {
    const tenant = await this.prisma.skillpodTenant.findFirst({
      where: {
        setupToken: token,
        setupTokenExpiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        companyName: true,
      },
    });

    if (!tenant) {
      throw new Error('Invalid or expired setup token');
    }

    return {
      tenantId: tenant.id,
      companyName: tenant.companyName,
    };
  }

  /**
   * Complete setup and clear setup token
   */
  async completeSetup(tenantId: string): Promise<void> {
    await this.prisma.skillpodTenant.update({
      where: { id: tenantId },
      data: {
        setupToken: null,
        setupTokenExpiresAt: null,
        onboardingCompletedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await this.audit.log({
      action: 'TENANT_SETUP_COMPLETED',
      resourceType: 'TENANT',
      resourceId: tenantId,
    });
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

let provisioningService: EnterpriseProvisioningService | null = null;

export function getEnterpriseProvisioningService(): EnterpriseProvisioningService {
  if (!provisioningService) {
    const { PrismaClient } = require('@prisma/client');
    provisioningService = new EnterpriseProvisioningService(new PrismaClient());
  }
  return provisioningService;
}
