/**
 * Executive Subscription Service
 *
 * Manages executive subscription lifecycle, tier enforcement, billing integration,
 * and usage tracking for the Skillancer Executive Suite.
 */

import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';
import type { Prisma } from '@prisma/client';

// Tier Configuration
export const TIER_CONFIG = {
  BASIC: {
    name: 'Basic',
    price: { monthly: 199, annual: 1909 }, // ~20% discount annual
    maxClients: 3,
    skillpodHoursIncluded: 20,
    teamMembersIncluded: 1,
    features: [
      'Basic dashboard',
      'Tool bundles as add-ons',
      'Email support',
      'Standard response time',
    ],
    toolBundlesIncluded: false,
    apiAccess: false,
  },
  PRO: {
    name: 'Pro',
    price: { monthly: 499, annual: 4790 },
    maxClients: 999, // Effectively unlimited
    skillpodHoursIncluded: 100,
    teamMembersIncluded: 3,
    features: [
      'Full dashboard',
      'All tool bundles included',
      'Priority support',
      '3 team members',
      'API access',
      'Advanced analytics',
    ],
    toolBundlesIncluded: true,
    apiAccess: true,
  },
  ENTERPRISE: {
    name: 'Enterprise',
    price: { monthly: null, annual: null }, // Custom pricing
    maxClients: 999,
    skillpodHoursIncluded: 9999, // Unlimited
    teamMembersIncluded: 999, // Unlimited
    features: [
      'Everything in Pro',
      'Unlimited SkillPod hours',
      'White-label option',
      'Custom integrations',
      'Dedicated CSM',
      'SLA guarantee',
      'Custom contracts',
    ],
    toolBundlesIncluded: true,
    apiAccess: true,
  },
} as const;

export type ExecutiveTier = keyof typeof TIER_CONFIG;
export type BillingCycle = 'MONTHLY' | 'ANNUAL';

interface CreateSubscriptionParams {
  executiveId: string;
  tier: ExecutiveTier;
  billingCycle: BillingCycle;
  stripePaymentMethodId?: string;
}

interface UpdateSubscriptionParams {
  tier?: ExecutiveTier;
  billingCycle?: BillingCycle;
  cancelAtPeriodEnd?: boolean;
}

interface UsageParams {
  skillpodHours?: number;
  clients?: number;
  teamMembers?: number;
}

export class SubscriptionService {
  private readonly logger = logger.child({ service: 'SubscriptionService' });

  /**
   * Create a new subscription for an executive
   */
  async createSubscription(params: CreateSubscriptionParams) {
    const { executiveId, tier, billingCycle, stripePaymentMethodId } = params;

    this.logger.info({ executiveId, tier, billingCycle }, 'Creating subscription');

    // Check if executive already has a subscription
    const existing = await prisma.executiveSubscription.findUnique({
      where: { executiveId },
    });

    if (existing && existing.status !== 'CANCELLED') {
      throw new Error('Executive already has an active subscription');
    }

    const tierConfig = TIER_CONFIG[tier];
    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === 'MONTHLY') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    // Create Stripe subscription (mock for now)
    let stripeData: { subscriptionId?: string; customerId?: string } = {};
    if (tier !== 'ENTERPRISE') {
      stripeData = await this.createStripeSubscription(
        executiveId,
        tier,
        billingCycle,
        stripePaymentMethodId
      );
    }

    const subscription = await prisma.executiveSubscription.create({
      data: {
        executiveId,
        tier,
        billingCycle,
        maxClients: tierConfig.maxClients,
        skillpodHoursIncluded: tierConfig.skillpodHoursIncluded,
        skillpodHoursUsed: 0,
        teamMembersIncluded: tierConfig.teamMembersIncluded,
        teamMembersUsed: 0,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        stripeSubscriptionId: stripeData.subscriptionId,
        stripeCustomerId: stripeData.customerId,
      },
      include: {
        addons: true,
      },
    });

    this.logger.info({ subscriptionId: subscription.id }, 'Subscription created');
    return subscription;
  }

  /**
   * Get subscription for an executive
   */
  async getSubscription(executiveId: string) {
    const subscription = await prisma.executiveSubscription.findUnique({
      where: { executiveId },
      include: {
        addons: {
          where: { deactivatedAt: null },
        },
        executive: {
          select: {
            id: true,
            headline: true,
            executiveType: true,
            currentClients: true,
          },
        },
      },
    });

    if (!subscription) {
      return null;
    }

    // Calculate totals with add-ons
    const extraSkillpodHours = subscription.addons
      .filter((a) => a.addonType === 'EXTRA_SKILLPOD_HOURS')
      .reduce((sum, a) => sum + a.quantity, 0);

    const extraTeamMembers = subscription.addons
      .filter((a) => a.addonType === 'EXTRA_TEAM_MEMBER')
      .reduce((sum, a) => sum + a.quantity, 0);

    return {
      ...subscription,
      totalSkillpodHours: subscription.skillpodHoursIncluded + extraSkillpodHours,
      totalTeamMembers: subscription.teamMembersIncluded + extraTeamMembers,
      tierConfig: TIER_CONFIG[subscription.tier as ExecutiveTier],
    };
  }

  /**
   * Update subscription (upgrade/downgrade)
   */
  async updateSubscription(subscriptionId: string, updates: UpdateSubscriptionParams) {
    const subscription = await prisma.executiveSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const updateData: Prisma.ExecutiveSubscriptionUpdateInput = {};

    if (updates.tier && updates.tier !== subscription.tier) {
      const newTierConfig = TIER_CONFIG[updates.tier];
      updateData.tier = updates.tier;
      updateData.maxClients = newTierConfig.maxClients;
      updateData.skillpodHoursIncluded = newTierConfig.skillpodHoursIncluded;
      updateData.teamMembersIncluded = newTierConfig.teamMembersIncluded;

      // Handle Stripe upgrade/downgrade proration
      if (subscription.stripeSubscriptionId) {
        await this.updateStripeSubscription(subscription.stripeSubscriptionId, updates.tier);
      }
    }

    if (updates.billingCycle) {
      updateData.billingCycle = updates.billingCycle;
    }

    if (updates.cancelAtPeriodEnd !== undefined) {
      updateData.cancelAtPeriodEnd = updates.cancelAtPeriodEnd;
      if (updates.cancelAtPeriodEnd) {
        updateData.cancelledAt = new Date();
      }
    }

    const updated = await prisma.executiveSubscription.update({
      where: { id: subscriptionId },
      data: updateData,
      include: { addons: true },
    });

    this.logger.info({ subscriptionId, updates }, 'Subscription updated');
    return updated;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, reason?: string, immediate = false) {
    const subscription = await prisma.executiveSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const now = new Date();

    const updated = await prisma.executiveSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: immediate ? 'CANCELLED' : subscription.status,
        cancelAtPeriodEnd: !immediate,
        cancelledAt: now,
        cancelReason: reason,
      },
    });

    // Cancel in Stripe
    if (subscription.stripeSubscriptionId) {
      await this.cancelStripeSubscription(subscription.stripeSubscriptionId, immediate);
    }

    this.logger.info({ subscriptionId, reason, immediate }, 'Subscription cancelled');
    return updated;
  }

  /**
   * Track SkillPod usage
   */
  async trackSkillPodUsage(executiveId: string, hours: number) {
    const subscription = await prisma.executiveSubscription.findUnique({
      where: { executiveId },
    });

    if (!subscription) {
      throw new Error('No active subscription');
    }

    const updated = await prisma.executiveSubscription.update({
      where: { id: subscription.id },
      data: {
        skillpodHoursUsed: { increment: hours },
      },
    });

    this.logger.info(
      { executiveId, hours, total: updated.skillpodHoursUsed },
      'SkillPod usage tracked'
    );
    return updated;
  }

  /**
   * Check if action is allowed within limits
   */
  async checkLimits(
    executiveId: string,
    action: 'add_client' | 'use_skillpod' | 'add_team_member',
    amount = 1
  ) {
    const subscription = await this.getSubscription(executiveId);

    if (!subscription) {
      return { allowed: false, reason: 'No active subscription' };
    }

    if (subscription.status !== 'ACTIVE') {
      return { allowed: false, reason: 'Subscription is not active' };
    }

    switch (action) {
      case 'add_client':
        if ((subscription.executive?.currentClients || 0) >= subscription.maxClients) {
          return {
            allowed: false,
            reason: `Client limit reached (${subscription.maxClients})`,
            upgrade: 'PRO',
          };
        }
        break;

      case 'use_skillpod':
        if (subscription.skillpodHoursUsed + amount > subscription.totalSkillpodHours) {
          return {
            allowed: false,
            reason: `SkillPod hours limit reached (${subscription.totalSkillpodHours})`,
            canAddOn: true,
          };
        }
        break;

      case 'add_team_member':
        if (subscription.teamMembersUsed >= subscription.totalTeamMembers) {
          return {
            allowed: false,
            reason: `Team member limit reached (${subscription.totalTeamMembers})`,
            canAddOn: true,
          };
        }
        break;
    }

    return { allowed: true };
  }

  /**
   * Get usage summary for an executive
   */
  async getUsageSummary(executiveId: string, period?: { start: Date; end: Date }) {
    const subscription = await this.getSubscription(executiveId);

    if (!subscription) {
      return null;
    }

    // Get client count
    const activeEngagements = await prisma.executiveEngagement.count({
      where: {
        executiveId,
        status: { in: ['ACTIVE', 'PROPOSAL', 'CONTRACT_SENT'] },
      },
    });

    return {
      tier: subscription.tier,
      billingCycle: subscription.billingCycle,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      usage: {
        clients: {
          used: activeEngagements,
          limit: subscription.maxClients,
          percentage: Math.round((activeEngagements / subscription.maxClients) * 100),
        },
        skillpodHours: {
          used: subscription.skillpodHoursUsed,
          limit: subscription.totalSkillpodHours,
          percentage: Math.round(
            (subscription.skillpodHoursUsed / subscription.totalSkillpodHours) * 100
          ),
        },
        teamMembers: {
          used: subscription.teamMembersUsed,
          limit: subscription.totalTeamMembers,
          percentage: Math.round(
            (subscription.teamMembersUsed / subscription.totalTeamMembers) * 100
          ),
        },
      },
      addons: subscription.addons,
    };
  }

  /**
   * Get invoices for a subscription
   */
  async getInvoices(subscriptionId: string, limit = 12) {
    const subscription = await prisma.executiveSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription || !subscription.stripeCustomerId) {
      return [];
    }

    // In production, fetch from Stripe
    // return await stripe.invoices.list({ customer: subscription.stripeCustomerId, limit });

    // Mock invoices for development
    return this.getMockInvoices(subscriptionId, limit);
  }

  /**
   * Update payment method
   */
  async updatePaymentMethod(subscriptionId: string, paymentMethodId: string) {
    const subscription = await prisma.executiveSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription || !subscription.stripeCustomerId) {
      throw new Error('Subscription not found or no Stripe customer');
    }

    // In production, update in Stripe
    // await stripe.customers.update(subscription.stripeCustomerId, {
    //   invoice_settings: { default_payment_method: paymentMethodId },
    // });

    this.logger.info({ subscriptionId, paymentMethodId }, 'Payment method updated');
    return { success: true };
  }

  /**
   * Handle Stripe webhook events
   */
  async handleStripeWebhook(event: { type: string; data: { object: Record<string, unknown> } }) {
    const { type, data } = event;

    this.logger.info({ type }, 'Processing Stripe webhook');

    switch (type) {
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(data.object);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(data.object);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(data.object);
        break;

      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(data.object);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(data.object);
        break;

      default:
        this.logger.debug({ type }, 'Unhandled webhook event');
    }
  }

  // =========================================================================
  // PRIVATE METHODS
  // =========================================================================

  private async createStripeSubscription(
    executiveId: string,
    tier: ExecutiveTier,
    _billingCycle: BillingCycle,
    _paymentMethodId?: string
  ) {
    // In production, create actual Stripe subscription
    // const customer = await stripe.customers.create({ ... });
    // const subscription = await stripe.subscriptions.create({ ... });

    // Mock for development
    return {
      subscriptionId: `sub_mock_${executiveId.substring(0, 8)}`,
      customerId: `cus_mock_${executiveId.substring(0, 8)}`,
    };
  }

  private async updateStripeSubscription(_subscriptionId: string, _newTier: ExecutiveTier) {
    // In production, update Stripe subscription with proration
    this.logger.info({ _subscriptionId, _newTier }, 'Would update Stripe subscription');
  }

  private async cancelStripeSubscription(_subscriptionId: string, _immediate: boolean) {
    // In production, cancel Stripe subscription
    this.logger.info({ _subscriptionId, _immediate }, 'Would cancel Stripe subscription');
  }

  private async handleSubscriptionCreated(_data: Record<string, unknown>) {
    // Handle new subscription from Stripe
  }

  private async handleSubscriptionUpdated(_data: Record<string, unknown>) {
    // Handle subscription updates from Stripe
  }

  private async handleSubscriptionDeleted(data: Record<string, unknown>) {
    const stripeSubId = data.id as string;

    await prisma.executiveSubscription.updateMany({
      where: { stripeSubscriptionId: stripeSubId },
      data: { status: 'CANCELLED' },
    });
  }

  private async handlePaymentSucceeded(data: Record<string, unknown>) {
    const customerId = data.customer as string;

    // Reset usage counters for new period
    const subscription = await prisma.executiveSubscription.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (subscription) {
      const now = new Date();
      const periodEnd = new Date(now);
      if (subscription.billingCycle === 'MONTHLY') {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      } else {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      }

      await prisma.executiveSubscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          skillpodHoursUsed: 0,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
    }
  }

  private async handlePaymentFailed(data: Record<string, unknown>) {
    const customerId = data.customer as string;

    await prisma.executiveSubscription.updateMany({
      where: { stripeCustomerId: customerId },
      data: { status: 'PAST_DUE' },
    });
  }

  private getMockInvoices(subscriptionId: string, limit: number) {
    const invoices = [];
    const now = new Date();

    for (let i = 0; i < limit; i++) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);

      invoices.push({
        id: `inv_mock_${subscriptionId.substring(0, 4)}_${i}`,
        created: date.toISOString(),
        amount_due: 49900, // $499 in cents
        amount_paid: 49900,
        status: 'paid',
        invoice_pdf: `https://invoice.stripe.com/mock/${subscriptionId}/${i}`,
      });
    }

    return invoices;
  }
}

export const subscriptionService = new SubscriptionService();
