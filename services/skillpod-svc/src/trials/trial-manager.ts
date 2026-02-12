// @ts-nocheck
/**
 * Trial Management Service
 * Manages B2B trial lifecycle, conversion tracking, and trial optimization
 */

import { prisma } from '@skillancer/database';
import { getLogger } from '@skillancer/logger';
import { getAuditClient } from '@skillancer/audit-client';
import { publishEvent } from '../events/publisher';
import { sendEmail } from '../notifications/email';
import { PLANS } from '../billing/skillpod-plans';

const logger = getLogger('trial-manager');
const audit = getAuditClient();

// =============================================================================
// TYPES
// =============================================================================

export type TrialStatus = 'ACTIVE' | 'EXTENDED' | 'CONVERTED' | 'EXPIRED' | 'CANCELLED';

export interface TrialConfig {
  defaultDays: number;
  maxExtensionDays: number;
  maxExtensions: number;
  reminderDays: number[];
  features: string[]; // Feature IDs enabled during trial
}

export interface TrialInfo {
  id: string;
  tenantId: string;
  status: TrialStatus;
  startedAt: Date;
  expiresAt: Date;
  daysRemaining: number;
  usageScore: number; // 0-100 engagement score
  conversionLikelihood: 'low' | 'medium' | 'high';
  extensions: number;
  targetPlan: string;
  convertedAt?: Date;
  cancelledAt?: Date;
}

export interface TrialMetrics {
  totalSessions: number;
  uniqueUsers: number;
  avgSessionDuration: number;
  featuresUsed: string[];
  policiesCreated: number;
  ssoConfigured: boolean;
  usersInvited: number;
  daysActive: number;
}

export interface TrialEngagement {
  score: number; // 0-100
  signals: {
    positive: string[];
    negative: string[];
  };
  recommendations: string[];
}

// =============================================================================
// TRIAL CONFIGURATION
// =============================================================================

const DEFAULT_TRIAL_CONFIG: TrialConfig = {
  defaultDays: 14,
  maxExtensionDays: 14,
  maxExtensions: 2,
  reminderDays: [7, 3, 1, 0], // Days before expiry to send reminders
  features: PLANS.PRO.features, // Trial gets Pro features
};

// Engagement scoring weights
const ENGAGEMENT_WEIGHTS = {
  sessions: 0.25,
  users: 0.2,
  policies: 0.15,
  sso: 0.15,
  invites: 0.15,
  daysActive: 0.1,
};

// =============================================================================
// TRIAL MANAGER SERVICE
// =============================================================================

class TrialManagerService {
  private config: TrialConfig = DEFAULT_TRIAL_CONFIG;

  /**
   * Start a new trial for a tenant
   */
  async startTrial(params: {
    tenantId: string;
    targetPlan?: string;
    referralSource?: string;
    createdBy: string;
  }): Promise<TrialInfo> {
    const { tenantId, targetPlan = 'PRO', createdBy, referralSource } = params;

    // Check if tenant already has a trial or subscription
    const existingTrial = await prisma.trial.findFirst({
      where: { tenantId, status: { in: ['ACTIVE', 'EXTENDED'] } },
    });

    if (existingTrial) {
      throw new Error('Tenant already has an active trial');
    }

    const existingSub = await prisma.subscription.findFirst({
      where: { tenantId, status: 'ACTIVE' },
    });

    if (existingSub) {
      throw new Error('Tenant already has an active subscription');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.defaultDays * 24 * 60 * 60 * 1000);

    // Create trial record
    const trial = await prisma.trial.create({
      data: {
        tenantId,
        status: 'ACTIVE',
        startedAt: now,
        expiresAt,
        targetPlan,
        referralSource,
        extensions: 0,
      },
    });

    // Update tenant with trial features
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        planTier: 'TRIAL',
        trialExpiresAt: expiresAt,
        maxUsers: PLANS.TRIAL.limits.maxUsers,
        maxConcurrentSessions: PLANS.TRIAL.limits.maxConcurrentSessions,
        maxStorageGb: PLANS.TRIAL.limits.maxStorageGb,
      },
    });

    await audit.log({
      action: 'trial.start',
      actorId: createdBy,
      resource: 'trial',
      resourceId: trial.id,
      tenantId,
      metadata: { targetPlan, expiresAt },
    });

    await publishEvent('trial.started', {
      trialId: trial.id,
      tenantId,
      expiresAt,
      targetPlan,
    });

    // Send welcome email
    await this.sendTrialEmail(tenantId, 'welcome');

    logger.info('Trial started', { trialId: trial.id, tenantId, expiresAt });

    return this.getTrialInfo(trial.id);
  }

  /**
   * Extend a trial
   */
  async extendTrial(params: {
    trialId: string;
    additionalDays: number;
    reason: string;
    extendedBy: string;
  }): Promise<TrialInfo> {
    const trial = await prisma.trial.findUnique({
      where: { id: params.trialId },
    });

    if (!trial) {
      throw new Error('Trial not found');
    }

    if (trial.status !== 'ACTIVE' && trial.status !== 'EXTENDED') {
      throw new Error('Trial cannot be extended');
    }

    if (trial.extensions >= this.config.maxExtensions) {
      throw new Error(`Maximum extensions (${this.config.maxExtensions}) reached`);
    }

    if (params.additionalDays > this.config.maxExtensionDays) {
      throw new Error(`Maximum extension is ${this.config.maxExtensionDays} days`);
    }

    const newExpiresAt = new Date(
      trial.expiresAt.getTime() + params.additionalDays * 24 * 60 * 60 * 1000
    );

    await prisma.trial.update({
      where: { id: params.trialId },
      data: {
        status: 'EXTENDED',
        expiresAt: newExpiresAt,
        extensions: { increment: 1 },
        extensionReason: params.reason,
      },
    });

    await prisma.tenant.update({
      where: { id: trial.tenantId },
      data: { trialExpiresAt: newExpiresAt },
    });

    await audit.log({
      action: 'trial.extend',
      actorId: params.extendedBy,
      resource: 'trial',
      resourceId: trial.id,
      tenantId: trial.tenantId,
      metadata: { additionalDays: params.additionalDays, reason: params.reason },
    });

    await publishEvent('trial.extended', {
      trialId: trial.id,
      tenantId: trial.tenantId,
      newExpiresAt,
      additionalDays: params.additionalDays,
    });

    // Notify tenant
    await this.sendTrialEmail(trial.tenantId, 'extended', {
      additionalDays: params.additionalDays,
    });

    logger.info('Trial extended', {
      trialId: trial.id,
      additionalDays: params.additionalDays,
      newExpiresAt,
    });

    return this.getTrialInfo(params.trialId);
  }

  /**
   * Convert trial to paid subscription
   */
  async convertTrial(params: {
    trialId: string;
    plan: string;
    billingCycle: 'monthly' | 'annual';
    stripeSubscriptionId?: string;
    convertedBy: string;
  }): Promise<{ subscriptionId: string }> {
    const trial = await prisma.trial.findUnique({
      where: { id: params.trialId },
      include: { tenant: true },
    });

    if (!trial) {
      throw new Error('Trial not found');
    }

    if (trial.status === 'CONVERTED') {
      throw new Error('Trial already converted');
    }

    // Create subscription
    const plan = PLANS[params.plan as keyof typeof PLANS];
    if (!plan) {
      throw new Error('Invalid plan');
    }

    const subscription = await prisma.subscription.create({
      data: {
        tenantId: trial.tenantId,
        planTier: params.plan,
        billingCycle: params.billingCycle,
        status: 'ACTIVE',
        pricePerMonth:
          params.billingCycle === 'annual' ? plan.pricing.annual : plan.pricing.monthly,
        stripeSubscriptionId: params.stripeSubscriptionId,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(
          Date.now() + (params.billingCycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000
        ),
      },
    });

    // Update trial
    await prisma.trial.update({
      where: { id: params.trialId },
      data: {
        status: 'CONVERTED',
        convertedAt: new Date(),
        convertedPlan: params.plan,
      },
    });

    // Update tenant
    await prisma.tenant.update({
      where: { id: trial.tenantId },
      data: {
        planTier: params.plan,
        trialExpiresAt: null,
        maxUsers: plan.limits.maxUsers,
        maxConcurrentSessions: plan.limits.maxConcurrentSessions,
        maxStorageGb: plan.limits.maxStorageGb,
      },
    });

    await audit.log({
      action: 'trial.convert',
      actorId: params.convertedBy,
      resource: 'trial',
      resourceId: trial.id,
      tenantId: trial.tenantId,
      metadata: { plan: params.plan, billingCycle: params.billingCycle },
    });

    await publishEvent('trial.converted', {
      trialId: trial.id,
      tenantId: trial.tenantId,
      subscriptionId: subscription.id,
      plan: params.plan,
    });

    // Send conversion email
    await this.sendTrialEmail(trial.tenantId, 'converted', { plan: params.plan });

    logger.info('Trial converted', {
      trialId: trial.id,
      plan: params.plan,
      subscriptionId: subscription.id,
    });

    return { subscriptionId: subscription.id };
  }

  /**
   * Expire a trial
   */
  async expireTrial(trialId: string): Promise<void> {
    const trial = await prisma.trial.findUnique({
      where: { id: trialId },
    });

    if (!trial) {
      throw new Error('Trial not found');
    }

    if (trial.status !== 'ACTIVE' && trial.status !== 'EXTENDED') {
      return; // Already expired or converted
    }

    await prisma.trial.update({
      where: { id: trialId },
      data: { status: 'EXPIRED' },
    });

    // Downgrade tenant to limited free tier or disable
    await prisma.tenant.update({
      where: { id: trial.tenantId },
      data: {
        planTier: 'EXPIRED',
        maxUsers: 1,
        maxConcurrentSessions: 0, // No sessions allowed
        maxStorageGb: 0,
      },
    });

    await publishEvent('trial.expired', {
      trialId: trial.id,
      tenantId: trial.tenantId,
    });

    // Send expiration email
    await this.sendTrialEmail(trial.tenantId, 'expired');

    logger.info('Trial expired', { trialId: trial.id, tenantId: trial.tenantId });
  }

  /**
   * Cancel a trial
   */
  async cancelTrial(params: {
    trialId: string;
    reason?: string;
    feedback?: string;
    cancelledBy: string;
  }): Promise<void> {
    const trial = await prisma.trial.findUnique({
      where: { id: params.trialId },
    });

    if (!trial) {
      throw new Error('Trial not found');
    }

    await prisma.trial.update({
      where: { id: params.trialId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: params.reason,
        cancellationFeedback: params.feedback,
      },
    });

    await prisma.tenant.update({
      where: { id: trial.tenantId },
      data: {
        planTier: 'CANCELLED',
        maxConcurrentSessions: 0,
      },
    });

    await audit.log({
      action: 'trial.cancel',
      actorId: params.cancelledBy,
      resource: 'trial',
      resourceId: trial.id,
      tenantId: trial.tenantId,
      metadata: { reason: params.reason },
    });

    await publishEvent('trial.cancelled', {
      trialId: trial.id,
      tenantId: trial.tenantId,
      reason: params.reason,
    });

    logger.info('Trial cancelled', { trialId: trial.id, reason: params.reason });
  }

  /**
   * Get trial information
   */
  async getTrialInfo(trialId: string): Promise<TrialInfo> {
    const trial = await prisma.trial.findUnique({
      where: { id: trialId },
    });

    if (!trial) {
      throw new Error('Trial not found');
    }

    const metrics = await this.getTrialMetrics(trialId);
    const engagement = this.calculateEngagement(metrics);
    const daysRemaining = Math.max(
      0,
      Math.ceil((trial.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    );

    return {
      id: trial.id,
      tenantId: trial.tenantId,
      status: trial.status as TrialStatus,
      startedAt: trial.startedAt,
      expiresAt: trial.expiresAt,
      daysRemaining,
      usageScore: engagement.score,
      conversionLikelihood: this.predictConversion(engagement.score, daysRemaining),
      extensions: trial.extensions,
      targetPlan: trial.targetPlan || 'PRO',
      convertedAt: trial.convertedAt || undefined,
      cancelledAt: trial.cancelledAt || undefined,
    };
  }

  /**
   * Get trial metrics for a tenant
   */
  async getTrialMetrics(trialId: string): Promise<TrialMetrics> {
    const trial = await prisma.trial.findUnique({
      where: { id: trialId },
    });

    if (!trial) {
      throw new Error('Trial not found');
    }

    const tenantId = trial.tenantId;

    // Session metrics
    const sessions = await prisma.session.findMany({
      where: {
        tenantId,
        createdAt: { gte: trial.startedAt },
      },
      select: {
        userId: true,
        createdAt: true,
        endedAt: true,
      },
    });

    const totalSessions = sessions.length;
    const uniqueUsers = new Set(sessions.map((s) => s.userId)).size;

    const sessionDurations = sessions
      .filter((s) => s.endedAt)
      .map((s) => (s.endedAt!.getTime() - s.createdAt.getTime()) / 60000);

    const avgSessionDuration =
      sessionDurations.length > 0
        ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length
        : 0;

    // Policy metrics
    const policiesCreated = await prisma.policy.count({
      where: {
        tenantId,
        createdAt: { gte: trial.startedAt },
      },
    });

    // SSO configured
    const ssoConfig = await prisma.ssoConfiguration.findFirst({
      where: { tenantId, status: 'ACTIVE' },
    });

    // Users invited
    const usersInvited = await prisma.user.count({
      where: {
        tenantId,
        createdAt: { gte: trial.startedAt },
      },
    });

    // Days with activity
    const activeDays = new Set(sessions.map((s) => s.createdAt.toISOString().split('T')[0]));

    // Features used (based on audit logs)
    const featureLogs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        createdAt: { gte: trial.startedAt },
        action: {
          in: [
            'session.start',
            'policy.create',
            'sso.configure',
            'user.invite',
            'report.generate',
            'api.key.create',
          ],
        },
      },
      select: { action: true },
      distinct: ['action'],
    });

    return {
      totalSessions,
      uniqueUsers,
      avgSessionDuration: Math.round(avgSessionDuration),
      featuresUsed: featureLogs.map((l) => l.action),
      policiesCreated,
      ssoConfigured: !!ssoConfig,
      usersInvited,
      daysActive: activeDays.size,
    };
  }

  /**
   * Calculate engagement score
   */
  calculateEngagement(metrics: TrialMetrics): TrialEngagement {
    const signals = { positive: [] as string[], negative: [] as string[] };

    // Session score (0-100)
    const sessionScore = Math.min(100, (metrics.totalSessions / 50) * 100);
    if (metrics.totalSessions >= 20) signals.positive.push('Strong session activity');
    if (metrics.totalSessions < 5) signals.negative.push('Low session activity');

    // User score
    const userScore = Math.min(100, (metrics.uniqueUsers / 10) * 100);
    if (metrics.uniqueUsers >= 5) signals.positive.push('Multiple users engaged');
    if (metrics.uniqueUsers < 2) signals.negative.push('Single user only');

    // Policy score
    const policyScore = metrics.policiesCreated > 0 ? 100 : 0;
    if (metrics.policiesCreated > 0) signals.positive.push('Custom policies created');
    else signals.negative.push('No policies configured');

    // SSO score
    const ssoScore = metrics.ssoConfigured ? 100 : 0;
    if (metrics.ssoConfigured) signals.positive.push('SSO integrated');
    else signals.negative.push('SSO not configured');

    // Invite score
    const inviteScore = Math.min(100, (metrics.usersInvited / 5) * 100);
    if (metrics.usersInvited >= 3) signals.positive.push('Team members invited');
    if (metrics.usersInvited < 2) signals.negative.push('No team expansion');

    // Activity score
    const activityScore = Math.min(100, (metrics.daysActive / 7) * 100);
    if (metrics.daysActive >= 5) signals.positive.push('Consistent daily usage');
    if (metrics.daysActive < 3) signals.negative.push('Sporadic usage');

    // Weighted total
    const score = Math.round(
      sessionScore * ENGAGEMENT_WEIGHTS.sessions +
        userScore * ENGAGEMENT_WEIGHTS.users +
        policyScore * ENGAGEMENT_WEIGHTS.policies +
        ssoScore * ENGAGEMENT_WEIGHTS.sso +
        inviteScore * ENGAGEMENT_WEIGHTS.invites +
        activityScore * ENGAGEMENT_WEIGHTS.daysActive
    );

    // Generate recommendations
    const recommendations: string[] = [];
    if (!metrics.ssoConfigured) {
      recommendations.push('Connect your identity provider for seamless SSO');
    }
    if (metrics.policiesCreated === 0) {
      recommendations.push('Create a custom policy to test security controls');
    }
    if (metrics.usersInvited < 3) {
      recommendations.push('Invite team members to see collaboration features');
    }
    if (metrics.totalSessions < 10) {
      recommendations.push('Run more sessions to fully evaluate the platform');
    }

    return { score, signals, recommendations };
  }

  /**
   * Predict conversion likelihood
   */
  private predictConversion(
    engagementScore: number,
    daysRemaining: number
  ): 'low' | 'medium' | 'high' {
    // High engagement + time left = high conversion
    if (engagementScore >= 70 && daysRemaining >= 3) return 'high';
    if (engagementScore >= 50 && daysRemaining >= 5) return 'high';

    // Medium engagement or running low on time
    if (engagementScore >= 40) return 'medium';
    if (daysRemaining >= 7 && engagementScore >= 20) return 'medium';

    // Low engagement or expired
    return 'low';
  }

  /**
   * Process expiring trials (run by scheduler)
   */
  async processExpiringTrials(): Promise<void> {
    const now = new Date();

    for (const daysOut of this.config.reminderDays) {
      const targetDate = new Date(now.getTime() + daysOut * 24 * 60 * 60 * 1000);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

      const expiringTrials = await prisma.trial.findMany({
        where: {
          status: { in: ['ACTIVE', 'EXTENDED'] },
          expiresAt: { gte: startOfDay, lte: endOfDay },
        },
      });

      for (const trial of expiringTrials) {
        if (daysOut === 0) {
          // Expire today
          await this.expireTrial(trial.id);
        } else {
          // Send reminder
          await this.sendTrialEmail(trial.tenantId, 'reminder', { daysRemaining: daysOut });
        }
      }

      logger.info(`Processed ${expiringTrials.length} trials expiring in ${daysOut} days`);
    }
  }

  /**
   * Send trial-related emails
   */
  private async sendTrialEmail(
    tenantId: string,
    emailType: 'welcome' | 'reminder' | 'extended' | 'expired' | 'converted',
    data?: Record<string, any>
  ): Promise<void> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          where: { role: 'ADMIN' },
          take: 1,
        },
      },
    });

    if (!tenant || !tenant.users[0]) return;

    const adminEmail = tenant.users[0].email;
    const templates: Record<string, { subject: string; template: string }> = {
      welcome: {
        subject: 'Welcome to your SkillPod Trial! 🚀',
        template: 'trial-welcome',
      },
      reminder: {
        subject: `Your SkillPod trial expires in ${data?.daysRemaining} days`,
        template: 'trial-reminder',
      },
      extended: {
        subject: 'Good news! Your SkillPod trial has been extended',
        template: 'trial-extended',
      },
      expired: {
        subject: 'Your SkillPod trial has ended',
        template: 'trial-expired',
      },
      converted: {
        subject: 'Welcome to SkillPod! Your subscription is active',
        template: 'trial-converted',
      },
    };

    const emailConfig = templates[emailType];
    if (!emailConfig) return;

    await sendEmail({
      to: adminEmail,
      subject: emailConfig.subject,
      template: emailConfig.template,
      data: {
        tenantName: tenant.name,
        ...data,
      },
    });
  }

  /**
   * Get list of trials for admin dashboard
   */
  async listTrials(params: {
    status?: TrialStatus[];
    page?: number;
    limit?: number;
  }): Promise<{ trials: TrialInfo[]; total: number }> {
    const { status, page = 1, limit = 20 } = params;

    const where = status ? { status: { in: status } } : {};

    const [trials, total] = await Promise.all([
      prisma.trial.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.trial.count({ where }),
    ]);

    const trialInfos = await Promise.all(trials.map((t) => this.getTrialInfo(t.id)));

    return { trials: trialInfos, total };
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

let service: TrialManagerService | null = null;

export function getTrialManagerService(): TrialManagerService {
  if (!service) {
    service = new TrialManagerService();
  }
  return service;
}
