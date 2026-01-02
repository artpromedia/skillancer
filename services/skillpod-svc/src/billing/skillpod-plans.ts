// @ts-nocheck
/**
 * SkillPod Plans & Pricing System
 * Defines B2B pricing tiers, features, and billing integration
 */

import { prisma } from '@skillancer/database';
import { getLogger } from '@skillancer/logger';
import { getAuditClient } from '@skillancer/audit-client';
import { publishEvent } from '../events/publisher';

const logger = getLogger('skillpod-plans');
const audit = getAuditClient();

// =============================================================================
// PLAN DEFINITIONS
// =============================================================================

export type PlanTier = 'STARTER' | 'PRO' | 'ENTERPRISE' | 'TRIAL';

export type BillingCycle = 'monthly' | 'annual';

export interface PlanFeature {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'security' | 'integration' | 'support' | 'compliance';
}

export interface PlanLimit {
  maxUsers: number;
  maxConcurrentSessions: number;
  maxStorageGb: number;
  maxSessionMinutesPerMonth: number | null; // null = unlimited
  maxApiCallsPerMonth: number;
  retentionDays: number;
}

export interface PlanPricing {
  monthly: number;
  annual: number; // Per month when billed annually
  perUserMonthly?: number; // For per-seat pricing
  perUserAnnual?: number;
}

export interface Plan {
  id: PlanTier;
  name: string;
  tagline: string;
  description: string;
  pricing: PlanPricing;
  limits: PlanLimit;
  features: string[]; // Feature IDs
  recommended?: boolean;
  customPricing?: boolean;
  trialDays?: number;
}

// =============================================================================
// FEATURE CATALOG
// =============================================================================

export const FEATURES: Record<string, PlanFeature> = {
  // Core Features
  vdi_sessions: {
    id: 'vdi_sessions',
    name: 'VDI Sessions',
    description: 'Secure containerized desktop sessions',
    category: 'core',
  },
  session_recording: {
    id: 'session_recording',
    name: 'Session Recording',
    description: 'Record and playback user sessions',
    category: 'core',
  },
  multi_device: {
    id: 'multi_device',
    name: 'Multi-Device Access',
    description: 'Access from desktop, mobile, and web',
    category: 'core',
  },
  file_transfer: {
    id: 'file_transfer',
    name: 'Secure File Transfer',
    description: 'Encrypted file upload and download',
    category: 'core',
  },
  clipboard_control: {
    id: 'clipboard_control',
    name: 'Clipboard Control',
    description: 'Policy-based clipboard restrictions',
    category: 'core',
  },
  custom_images: {
    id: 'custom_images',
    name: 'Custom Container Images',
    description: 'Deploy your own application images',
    category: 'core',
  },

  // Security Features
  mfa: {
    id: 'mfa',
    name: 'Multi-Factor Authentication',
    description: 'TOTP, SMS, and hardware key support',
    category: 'security',
  },
  ip_whitelisting: {
    id: 'ip_whitelisting',
    name: 'IP Whitelisting',
    description: 'Restrict access by IP address',
    category: 'security',
  },
  dlp_policies: {
    id: 'dlp_policies',
    name: 'DLP Policies',
    description: 'Data loss prevention rules',
    category: 'security',
  },
  session_watermarks: {
    id: 'session_watermarks',
    name: 'Session Watermarks',
    description: 'Visible watermarks on screen content',
    category: 'security',
  },
  threat_detection: {
    id: 'threat_detection',
    name: 'Real-time Threat Detection',
    description: 'AI-powered anomaly detection',
    category: 'security',
  },
  zero_trust: {
    id: 'zero_trust',
    name: 'Zero Trust Architecture',
    description: 'Continuous verification and least privilege',
    category: 'security',
  },

  // Integration Features
  sso_saml: {
    id: 'sso_saml',
    name: 'SAML 2.0 SSO',
    description: 'Enterprise single sign-on',
    category: 'integration',
  },
  sso_oidc: {
    id: 'sso_oidc',
    name: 'OIDC SSO',
    description: 'OpenID Connect integration',
    category: 'integration',
  },
  api_access: {
    id: 'api_access',
    name: 'REST API Access',
    description: 'Programmatic API integration',
    category: 'integration',
  },
  webhooks: {
    id: 'webhooks',
    name: 'Webhooks',
    description: 'Real-time event notifications',
    category: 'integration',
  },
  scim: {
    id: 'scim',
    name: 'SCIM Provisioning',
    description: 'Automated user lifecycle management',
    category: 'integration',
  },
  siem_integration: {
    id: 'siem_integration',
    name: 'SIEM Integration',
    description: 'Export logs to Splunk, Sentinel, etc.',
    category: 'integration',
  },

  // Support Features
  email_support: {
    id: 'email_support',
    name: 'Email Support',
    description: 'Standard email support',
    category: 'support',
  },
  priority_support: {
    id: 'priority_support',
    name: 'Priority Support',
    description: '4-hour response SLA',
    category: 'support',
  },
  dedicated_csm: {
    id: 'dedicated_csm',
    name: 'Dedicated CSM',
    description: 'Dedicated customer success manager',
    category: 'support',
  },
  onboarding_assistance: {
    id: 'onboarding_assistance',
    name: 'Onboarding Assistance',
    description: 'Guided setup and migration',
    category: 'support',
  },
  training_sessions: {
    id: 'training_sessions',
    name: 'Training Sessions',
    description: 'Live training for admins and users',
    category: 'support',
  },

  // Compliance Features
  audit_logs: {
    id: 'audit_logs',
    name: 'Audit Logs',
    description: 'Comprehensive activity logging',
    category: 'compliance',
  },
  soc2_compliance: {
    id: 'soc2_compliance',
    name: 'SOC 2 Compliance',
    description: 'SOC 2 Type II certified',
    category: 'compliance',
  },
  hipaa_compliance: {
    id: 'hipaa_compliance',
    name: 'HIPAA Compliance',
    description: 'HIPAA-ready configuration',
    category: 'compliance',
  },
  gdpr_tools: {
    id: 'gdpr_tools',
    name: 'GDPR Tools',
    description: 'Data export, deletion, and consent',
    category: 'compliance',
  },
  custom_retention: {
    id: 'custom_retention',
    name: 'Custom Retention',
    description: 'Configurable data retention policies',
    category: 'compliance',
  },
};

// =============================================================================
// PLAN CATALOG
// =============================================================================

export const PLANS: Record<PlanTier, Plan> = {
  STARTER: {
    id: 'STARTER',
    name: 'Starter',
    tagline: 'Perfect for small teams',
    description: 'Essential VDI capabilities for teams getting started with secure remote access.',
    pricing: {
      monthly: 99,
      annual: 79,
      perUserMonthly: 15,
      perUserAnnual: 12,
    },
    limits: {
      maxUsers: 10,
      maxConcurrentSessions: 5,
      maxStorageGb: 50,
      maxSessionMinutesPerMonth: 10000,
      maxApiCallsPerMonth: 1000,
      retentionDays: 30,
    },
    features: ['vdi_sessions', 'multi_device', 'mfa', 'email_support', 'audit_logs'],
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    tagline: 'For growing organizations',
    description: 'Advanced features and integrations for scaling teams with compliance needs.',
    pricing: {
      monthly: 299,
      annual: 249,
      perUserMonthly: 25,
      perUserAnnual: 20,
    },
    limits: {
      maxUsers: 50,
      maxConcurrentSessions: 25,
      maxStorageGb: 250,
      maxSessionMinutesPerMonth: 50000,
      maxApiCallsPerMonth: 10000,
      retentionDays: 90,
    },
    features: [
      'vdi_sessions',
      'session_recording',
      'multi_device',
      'file_transfer',
      'clipboard_control',
      'mfa',
      'ip_whitelisting',
      'dlp_policies',
      'sso_saml',
      'sso_oidc',
      'api_access',
      'webhooks',
      'priority_support',
      'onboarding_assistance',
      'audit_logs',
      'soc2_compliance',
      'gdpr_tools',
    ],
    recommended: true,
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    tagline: 'Full power, custom solutions',
    description:
      'Complete platform with advanced security, unlimited scale, and white-glove support.',
    pricing: {
      monthly: 0, // Custom pricing
      annual: 0,
    },
    limits: {
      maxUsers: -1, // Unlimited
      maxConcurrentSessions: -1,
      maxStorageGb: -1,
      maxSessionMinutesPerMonth: null,
      maxApiCallsPerMonth: -1,
      retentionDays: 365,
    },
    features: Object.keys(FEATURES), // All features
    customPricing: true,
  },
  TRIAL: {
    id: 'TRIAL',
    name: 'Trial',
    tagline: 'Try before you buy',
    description: 'Full Pro features for 14 days, no credit card required.',
    pricing: {
      monthly: 0,
      annual: 0,
    },
    limits: {
      maxUsers: 10,
      maxConcurrentSessions: 5,
      maxStorageGb: 25,
      maxSessionMinutesPerMonth: 5000,
      maxApiCallsPerMonth: 1000,
      retentionDays: 14,
    },
    features: PLANS?.PRO?.features || [],
    trialDays: 14,
  },
};

// Ensure TRIAL gets PRO features after PLANS object is defined
PLANS.TRIAL.features = PLANS.PRO.features;

// =============================================================================
// PRICING SERVICE
// =============================================================================

class SkillPodPlansService {
  /**
   * Get all available plans
   */
  getAllPlans(): Plan[] {
    return Object.values(PLANS).filter((p) => p.id !== 'TRIAL');
  }

  /**
   * Get a specific plan
   */
  getPlan(tier: PlanTier): Plan | null {
    return PLANS[tier] || null;
  }

  /**
   * Get all features
   */
  getAllFeatures(): PlanFeature[] {
    return Object.values(FEATURES);
  }

  /**
   * Get features for a plan
   */
  getPlanFeatures(tier: PlanTier): PlanFeature[] {
    const plan = PLANS[tier];
    if (!plan) return [];
    return plan.features.map((id) => FEATURES[id]).filter(Boolean);
  }

  /**
   * Check if a plan has a specific feature
   */
  hasFeature(tier: PlanTier, featureId: string): boolean {
    const plan = PLANS[tier];
    if (!plan) return false;
    return plan.features.includes(featureId);
  }

  /**
   * Calculate pricing for a plan
   */
  calculatePrice(params: { tier: PlanTier; billingCycle: BillingCycle; userCount?: number }): {
    basePrice: number;
    perUserPrice: number;
    totalMonthly: number;
    totalAnnual: number;
    discount: number;
  } {
    const plan = PLANS[params.tier];
    if (!plan || plan.customPricing) {
      return {
        basePrice: 0,
        perUserPrice: 0,
        totalMonthly: 0,
        totalAnnual: 0,
        discount: 0,
      };
    }

    const isAnnual = params.billingCycle === 'annual';
    const userCount = params.userCount || 1;

    const basePrice = isAnnual ? plan.pricing.annual : plan.pricing.monthly;
    const perUserPrice = isAnnual
      ? plan.pricing.perUserAnnual || 0
      : plan.pricing.perUserMonthly || 0;

    const totalMonthly = basePrice + perUserPrice * Math.max(0, userCount - 1);
    const totalAnnual = totalMonthly * 12;

    // Calculate annual discount
    const monthlyEquivalent =
      plan.pricing.monthly + (plan.pricing.perUserMonthly || 0) * Math.max(0, userCount - 1);
    const annualSavings = isAnnual ? monthlyEquivalent * 12 - totalAnnual : 0;
    const discount =
      monthlyEquivalent > 0 ? Math.round((annualSavings / (monthlyEquivalent * 12)) * 100) : 0;

    return {
      basePrice,
      perUserPrice,
      totalMonthly,
      totalAnnual,
      discount,
    };
  }

  /**
   * Get upgrade path from current plan
   */
  getUpgradePaths(currentTier: PlanTier): Plan[] {
    const tierOrder = ['TRIAL', 'STARTER', 'PRO', 'ENTERPRISE'];
    const currentIndex = tierOrder.indexOf(currentTier);

    return tierOrder
      .slice(currentIndex + 1)
      .map((tier) => PLANS[tier as PlanTier])
      .filter(Boolean);
  }

  /**
   * Compare two plans
   */
  comparePlans(
    tier1: PlanTier,
    tier2: PlanTier
  ): {
    tier1Only: string[];
    tier2Only: string[];
    shared: string[];
    limitsDiff: Record<string, { tier1: number | null; tier2: number | null }>;
  } {
    const plan1 = PLANS[tier1];
    const plan2 = PLANS[tier2];

    if (!plan1 || !plan2) {
      return { tier1Only: [], tier2Only: [], shared: [], limitsDiff: {} };
    }

    const set1 = new Set(plan1.features);
    const set2 = new Set(plan2.features);

    const tier1Only = plan1.features.filter((f) => !set2.has(f));
    const tier2Only = plan2.features.filter((f) => !set1.has(f));
    const shared = plan1.features.filter((f) => set2.has(f));

    const limitsDiff: Record<string, { tier1: number | null; tier2: number | null }> = {};
    const limitKeys = Object.keys(plan1.limits) as (keyof PlanLimit)[];

    for (const key of limitKeys) {
      const val1 = plan1.limits[key];
      const val2 = plan2.limits[key];
      if (val1 !== val2) {
        limitsDiff[key] = {
          tier1: val1 as number | null,
          tier2: val2 as number | null,
        };
      }
    }

    return { tier1Only, tier2Only, shared, limitsDiff };
  }

  /**
   * Create a subscription for a tenant
   */
  async createSubscription(params: {
    tenantId: string;
    tier: PlanTier;
    billingCycle: BillingCycle;
    userCount?: number;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    createdBy: string;
  }): Promise<{ id: string }> {
    const plan = PLANS[params.tier];
    if (!plan) {
      throw new Error(`Invalid plan tier: ${params.tier}`);
    }

    const pricing = this.calculatePrice({
      tier: params.tier,
      billingCycle: params.billingCycle,
      userCount: params.userCount,
    });

    const subscription = await prisma.subscription.create({
      data: {
        tenantId: params.tenantId,
        planTier: params.tier,
        billingCycle: params.billingCycle,
        status: params.tier === 'TRIAL' ? 'TRIALING' : 'ACTIVE',
        pricePerMonth: pricing.totalMonthly,
        userCount: params.userCount || 1,
        stripeCustomerId: params.stripeCustomerId,
        stripeSubscriptionId: params.stripeSubscriptionId,
        trialEndsAt:
          params.tier === 'TRIAL'
            ? new Date(Date.now() + (plan.trialDays || 14) * 24 * 60 * 60 * 1000)
            : null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(
          Date.now() + (params.billingCycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000
        ),
      },
    });

    // Update tenant with plan limits
    await prisma.tenant.update({
      where: { id: params.tenantId },
      data: {
        planTier: params.tier,
        maxUsers: plan.limits.maxUsers,
        maxConcurrentSessions: plan.limits.maxConcurrentSessions,
        maxStorageGb: plan.limits.maxStorageGb,
      },
    });

    await audit.log({
      action: 'subscription.create',
      actorId: params.createdBy,
      resource: 'subscription',
      resourceId: subscription.id,
      tenantId: params.tenantId,
      metadata: { tier: params.tier, billingCycle: params.billingCycle },
    });

    await publishEvent('subscription.created', {
      tenantId: params.tenantId,
      subscriptionId: subscription.id,
      tier: params.tier,
    });

    logger.info('Subscription created', {
      subscriptionId: subscription.id,
      tenantId: params.tenantId,
      tier: params.tier,
    });

    return { id: subscription.id };
  }

  /**
   * Upgrade or downgrade a subscription
   */
  async changePlan(params: {
    tenantId: string;
    newTier: PlanTier;
    billingCycle?: BillingCycle;
    actorId: string;
  }): Promise<void> {
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId: params.tenantId, status: { in: ['ACTIVE', 'TRIALING'] } },
    });

    if (!subscription) {
      throw new Error('No active subscription found');
    }

    const oldTier = subscription.planTier as PlanTier;
    const newPlan = PLANS[params.newTier];

    if (!newPlan) {
      throw new Error(`Invalid plan tier: ${params.newTier}`);
    }

    const billingCycle = params.billingCycle || subscription.billingCycle;
    const pricing = this.calculatePrice({
      tier: params.newTier,
      billingCycle: billingCycle as BillingCycle,
      userCount: subscription.userCount,
    });

    // Update subscription
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        planTier: params.newTier,
        billingCycle,
        pricePerMonth: pricing.totalMonthly,
        status: params.newTier === 'TRIAL' ? 'TRIALING' : 'ACTIVE',
      },
    });

    // Update tenant limits
    await prisma.tenant.update({
      where: { id: params.tenantId },
      data: {
        planTier: params.newTier,
        maxUsers: newPlan.limits.maxUsers,
        maxConcurrentSessions: newPlan.limits.maxConcurrentSessions,
        maxStorageGb: newPlan.limits.maxStorageGb,
      },
    });

    await audit.log({
      action: 'subscription.change',
      actorId: params.actorId,
      resource: 'subscription',
      resourceId: subscription.id,
      tenantId: params.tenantId,
      metadata: { oldTier, newTier: params.newTier },
    });

    await publishEvent('subscription.changed', {
      tenantId: params.tenantId,
      subscriptionId: subscription.id,
      oldTier,
      newTier: params.newTier,
    });

    logger.info('Plan changed', {
      subscriptionId: subscription.id,
      tenantId: params.tenantId,
      oldTier,
      newTier: params.newTier,
    });
  }

  /**
   * Check if tenant can use a feature
   */
  async canUseFeature(tenantId: string, featureId: string): Promise<boolean> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { planTier: true },
    });

    if (!tenant) return false;
    return this.hasFeature(tenant.planTier as PlanTier, featureId);
  }

  /**
   * Get current usage vs limits
   */
  async getUsageStatus(tenantId: string): Promise<{
    users: { current: number; limit: number; percentage: number };
    sessions: { current: number; limit: number; percentage: number };
    storage: { current: number; limit: number; percentage: number };
    apiCalls: { current: number; limit: number; percentage: number };
    warnings: string[];
  }> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscription: true,
        _count: { select: { users: true } },
      },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const plan = PLANS[tenant.planTier as PlanTier];
    if (!plan) {
      throw new Error('Invalid plan');
    }

    // Get current usage
    const userCount = tenant._count.users;
    const activeSessions = await prisma.session.count({
      where: { tenantId, endedAt: null },
    });
    const storageUsed = tenant.storageUsedGb || 0;

    // API calls this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const apiCalls = await prisma.apiRequest.count({
      where: { tenantId, createdAt: { gte: monthStart } },
    });

    const limits = plan.limits;
    const warnings: string[] = [];

    // Calculate percentages
    const userPct = limits.maxUsers > 0 ? (userCount / limits.maxUsers) * 100 : 0;
    const sessionPct =
      limits.maxConcurrentSessions > 0 ? (activeSessions / limits.maxConcurrentSessions) * 100 : 0;
    const storagePct = limits.maxStorageGb > 0 ? (storageUsed / limits.maxStorageGb) * 100 : 0;
    const apiPct =
      limits.maxApiCallsPerMonth > 0 ? (apiCalls / limits.maxApiCallsPerMonth) * 100 : 0;

    // Generate warnings
    if (userPct >= 90) warnings.push('User limit nearly reached');
    if (sessionPct >= 90) warnings.push('Concurrent session limit nearly reached');
    if (storagePct >= 90) warnings.push('Storage limit nearly reached');
    if (apiPct >= 90) warnings.push('API call limit nearly reached');

    return {
      users: {
        current: userCount,
        limit: limits.maxUsers,
        percentage: Math.min(100, Math.round(userPct)),
      },
      sessions: {
        current: activeSessions,
        limit: limits.maxConcurrentSessions,
        percentage: Math.min(100, Math.round(sessionPct)),
      },
      storage: {
        current: storageUsed,
        limit: limits.maxStorageGb,
        percentage: Math.min(100, Math.round(storagePct)),
      },
      apiCalls: {
        current: apiCalls,
        limit: limits.maxApiCallsPerMonth,
        percentage: Math.min(100, Math.round(apiPct)),
      },
      warnings,
    };
  }

  /**
   * Get pricing quote for custom enterprise plan
   */
  async requestEnterpriseQuote(params: {
    tenantId?: string;
    companyName: string;
    contactEmail: string;
    contactName: string;
    estimatedUsers: number;
    requirements: string[];
    additionalNotes?: string;
  }): Promise<{ quoteId: string }> {
    const quote = await prisma.enterpriseQuote.create({
      data: {
        tenantId: params.tenantId,
        companyName: params.companyName,
        contactEmail: params.contactEmail,
        contactName: params.contactName,
        estimatedUsers: params.estimatedUsers,
        requirements: params.requirements,
        additionalNotes: params.additionalNotes,
        status: 'PENDING',
      },
    });

    await publishEvent('enterprise.quote.requested', {
      quoteId: quote.id,
      companyName: params.companyName,
      contactEmail: params.contactEmail,
    });

    logger.info('Enterprise quote requested', {
      quoteId: quote.id,
      companyName: params.companyName,
    });

    return { quoteId: quote.id };
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

let service: SkillPodPlansService | null = null;

export function getSkillPodPlansService(): SkillPodPlansService {
  if (!service) {
    service = new SkillPodPlansService();
  }
  return service;
}

// Export plan data for use in frontend
export function getPublicPlanData() {
  return {
    plans: Object.values(PLANS)
      .filter((p) => p.id !== 'TRIAL')
      .map((p) => ({
        id: p.id,
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        pricing: p.pricing,
        limits: p.limits,
        featureCount: p.features.length,
        recommended: p.recommended,
        customPricing: p.customPricing,
      })),
    features: Object.values(FEATURES),
  };
}

