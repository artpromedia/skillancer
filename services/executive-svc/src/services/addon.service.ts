/**
 * Executive Add-on Service
 *
 * Manages subscription add-ons including tool bundles, extra SkillPod hours,
 * team members, and white-label options.
 */

import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';

// Add-on Configuration
export const ADDON_CONFIG = {
  TOOL_BUNDLE_CTO: {
    name: 'CTO Tool Bundle',
    description: 'Technical roadmap, architecture tools, DevOps dashboards',
    price: 79,
    category: 'tool_bundle',
  },
  TOOL_BUNDLE_CFO: {
    name: 'CFO Tool Bundle',
    description: 'Cash flow forecasting, board deck builder, investor updates',
    price: 99,
    category: 'tool_bundle',
  },
  TOOL_BUNDLE_CMO: {
    name: 'CMO Tool Bundle',
    description: 'Marketing analytics, campaign management, brand tools',
    price: 79,
    category: 'tool_bundle',
  },
  TOOL_BUNDLE_CISO: {
    name: 'CISO Tool Bundle',
    description: 'Security dashboard, compliance management, risk assessment',
    price: 129,
    category: 'tool_bundle',
  },
  TOOL_BUNDLE_COO: {
    name: 'COO Tool Bundle',
    description: 'OKR tracking, process management, org chart tools',
    price: 69,
    category: 'tool_bundle',
  },
  TOOL_BUNDLE_CHRO: {
    name: 'CHRO Tool Bundle',
    description: 'HR compliance, headcount planning, people analytics',
    price: 79,
    category: 'tool_bundle',
  },
  TOOL_BUNDLE_CPO: {
    name: 'CPO Tool Bundle',
    description: 'PRD builder, feature prioritization, user research tools',
    price: 79,
    category: 'tool_bundle',
  },
  EXTRA_SKILLPOD_HOURS: {
    name: 'Extra SkillPod Hours',
    description: 'Additional AI-assisted hours beyond your plan',
    price: 2, // Per hour
    category: 'usage',
    unit: 'hour',
  },
  EXTRA_TEAM_MEMBER: {
    name: 'Extra Team Member',
    description: 'Add team members to your subscription',
    price: 49, // Per member per month
    category: 'seats',
    unit: 'member',
  },
  CLIENT_WHITE_LABEL: {
    name: 'Client White-Label',
    description: 'White-label branding for client workspaces',
    price: 29, // Per client per month
    category: 'branding',
    unit: 'client',
  },
} as const;

export type AddonType = keyof typeof ADDON_CONFIG;

interface AddAddonParams {
  subscriptionId: string;
  addonType: AddonType;
  quantity: number;
}

export class AddonService {
  private readonly logger = logger.child({ service: 'AddonService' });

  /**
   * Get available add-ons for a tier
   */
  getAvailableAddons(tier: 'BASIC' | 'PRO' | 'ENTERPRISE') {
    const addons = Object.entries(ADDON_CONFIG).map(([type, config]) => ({
      type,
      ...config,
    }));

    // PRO and ENTERPRISE have tool bundles included
    if (tier === 'PRO' || tier === 'ENTERPRISE') {
      return addons.filter((a) => a.category !== 'tool_bundle');
    }

    return addons;
  }

  /**
   * Get add-on pricing information
   */
  getAddonPricing() {
    return Object.entries(ADDON_CONFIG).map(([type, config]) => ({
      type,
      name: config.name,
      description: config.description,
      price: config.price,
      category: config.category,
      unit: 'unit' in config ? config.unit : 'month',
    }));
  }

  /**
   * Calculate total cost of add-ons
   */
  calculateAddonCost(addons: Array<{ type: AddonType; quantity: number }>) {
    let total = 0;
    const breakdown: Array<{
      type: AddonType;
      name: string;
      quantity: number;
      price: number;
      subtotal: number;
    }> = [];

    for (const addon of addons) {
      const config = ADDON_CONFIG[addon.type];
      const subtotal = config.price * addon.quantity;
      total += subtotal;

      breakdown.push({
        type: addon.type,
        name: config.name,
        quantity: addon.quantity,
        price: config.price,
        subtotal,
      });
    }

    return { total, breakdown };
  }

  /**
   * Add an addon to a subscription
   */
  async addAddon(params: AddAddonParams) {
    const { subscriptionId, addonType, quantity } = params;

    this.logger.info({ subscriptionId, addonType, quantity }, 'Adding addon');

    const subscription = await prisma.executiveSubscription.findUnique({
      where: { id: subscriptionId },
      include: { addons: true },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Check if addon already exists
    const existingAddon = subscription.addons.find(
      (a) => a.addonType === addonType && !a.deactivatedAt
    );

    if (existingAddon) {
      // Update quantity for stackable addons
      if (
        addonType === 'EXTRA_SKILLPOD_HOURS' ||
        addonType === 'EXTRA_TEAM_MEMBER' ||
        addonType === 'CLIENT_WHITE_LABEL'
      ) {
        const updated = await prisma.executiveAddon.update({
          where: { id: existingAddon.id },
          data: { quantity: existingAddon.quantity + quantity },
        });

        // Update team members count if applicable
        if (addonType === 'EXTRA_TEAM_MEMBER') {
          await this.updateTeamMemberLimit(subscriptionId);
        }

        return updated;
      }

      throw new Error(`Addon ${addonType} already active`);
    }

    const config = ADDON_CONFIG[addonType];

    // Create addon
    const addon = await prisma.executiveAddon.create({
      data: {
        subscriptionId,
        addonType,
        quantity,
        pricePerUnit: config.price,
      },
    });

    // Create Stripe subscription item (in production)
    // await this.createStripeAddonItem(subscription.stripeSubscriptionId, addonType, quantity);

    // Update limits if applicable
    if (addonType === 'EXTRA_TEAM_MEMBER') {
      await this.updateTeamMemberLimit(subscriptionId);
    }

    this.logger.info({ addonId: addon.id }, 'Addon added');
    return addon;
  }

  /**
   * Remove an addon from a subscription
   */
  async removeAddon(subscriptionId: string, addonId: string) {
    this.logger.info({ subscriptionId, addonId }, 'Removing addon');

    const addon = await prisma.executiveAddon.findUnique({
      where: { id: addonId },
      include: { subscription: true },
    });

    if (!addon || addon.subscriptionId !== subscriptionId) {
      throw new Error('Addon not found');
    }

    // Soft-delete the addon
    const updated = await prisma.executiveAddon.update({
      where: { id: addonId },
      data: { deactivatedAt: new Date() },
    });

    // Remove from Stripe (in production)
    // await this.removeStripeAddonItem(addon.stripeItemId);

    // Update limits if applicable
    if (addon.addonType === 'EXTRA_TEAM_MEMBER') {
      await this.updateTeamMemberLimit(subscriptionId);
    }

    this.logger.info({ addonId }, 'Addon removed');
    return updated;
  }

  /**
   * Update addon quantity
   */
  async updateAddonQuantity(addonId: string, newQuantity: number) {
    if (newQuantity < 1) {
      throw new Error('Quantity must be at least 1');
    }

    const addon = await prisma.executiveAddon.findUnique({
      where: { id: addonId },
    });

    if (!addon) {
      throw new Error('Addon not found');
    }

    const updated = await prisma.executiveAddon.update({
      where: { id: addonId },
      data: { quantity: newQuantity },
    });

    // Update Stripe (in production)
    // await stripe.subscriptionItems.update(addon.stripeItemId, { quantity: newQuantity });

    return updated;
  }

  /**
   * Get active add-ons for a subscription
   */
  async getActiveAddons(subscriptionId: string) {
    const addons = await prisma.executiveAddon.findMany({
      where: {
        subscriptionId,
        deactivatedAt: null,
      },
    });

    return addons.map((addon) => ({
      ...addon,
      config: ADDON_CONFIG[addon.addonType as AddonType],
      monthlyTotal: addon.pricePerUnit.toNumber() * addon.quantity,
    }));
  }

  /**
   * Provision addon features
   */
  async provisionAddon(subscriptionId: string, addonType: AddonType) {
    this.logger.info({ subscriptionId, addonType }, 'Provisioning addon features');

    switch (addonType) {
      case 'TOOL_BUNDLE_CTO':
        await this.enableToolBundle(subscriptionId, 'cto');
        break;
      case 'TOOL_BUNDLE_CFO':
        await this.enableToolBundle(subscriptionId, 'cfo');
        break;
      case 'TOOL_BUNDLE_CMO':
        await this.enableToolBundle(subscriptionId, 'cmo');
        break;
      case 'TOOL_BUNDLE_CISO':
        await this.enableToolBundle(subscriptionId, 'ciso');
        break;
      case 'TOOL_BUNDLE_COO':
        await this.enableToolBundle(subscriptionId, 'coo');
        break;
      case 'TOOL_BUNDLE_CHRO':
        await this.enableToolBundle(subscriptionId, 'chro');
        break;
      case 'TOOL_BUNDLE_CPO':
        await this.enableToolBundle(subscriptionId, 'cpo');
        break;
      default:
        // Other addons don't need specific provisioning
        break;
    }
  }

  /**
   * Deprovision addon features
   */
  async deprovisionAddon(subscriptionId: string, addonType: AddonType) {
    this.logger.info({ subscriptionId, addonType }, 'Deprovisioning addon features');

    const toolBundleTypes = [
      'TOOL_BUNDLE_CTO',
      'TOOL_BUNDLE_CFO',
      'TOOL_BUNDLE_CMO',
      'TOOL_BUNDLE_CISO',
      'TOOL_BUNDLE_COO',
      'TOOL_BUNDLE_CHRO',
      'TOOL_BUNDLE_CPO',
    ];

    if (toolBundleTypes.includes(addonType)) {
      const role = addonType.replace('TOOL_BUNDLE_', '').toLowerCase();
      await this.disableToolBundle(subscriptionId, role);
    }
  }

  // =========================================================================
  // PRIVATE METHODS
  // =========================================================================

  private async updateTeamMemberLimit(subscriptionId: string) {
    const subscription = await prisma.executiveSubscription.findUnique({
      where: { id: subscriptionId },
      include: {
        addons: {
          where: {
            addonType: 'EXTRA_TEAM_MEMBER',
            deactivatedAt: null,
          },
        },
      },
    });

    if (!subscription) return;

    const extraMembers = subscription.addons.reduce((sum, a) => sum + a.quantity, 0);
    const totalMembers = subscription.teamMembersIncluded + extraMembers;

    // Note: This doesn't change the base teamMembersIncluded, but the total
    // is calculated dynamically when checking limits
    this.logger.debug({ subscriptionId, totalMembers }, 'Team member limit updated');
  }

  private async enableToolBundle(subscriptionId: string, role: string) {
    // Get the executive from the subscription
    const subscription = await prisma.executiveSubscription.findUnique({
      where: { id: subscriptionId },
      select: { executiveId: true },
    });

    if (!subscription) return;

    // Enable the tool configs for this role
    this.logger.info({ executiveId: subscription.executiveId, role }, 'Tool bundle enabled');
    // Implementation would update ExecutiveToolConfig records
  }

  private async disableToolBundle(subscriptionId: string, role: string) {
    const subscription = await prisma.executiveSubscription.findUnique({
      where: { id: subscriptionId },
      select: { executiveId: true },
    });

    if (!subscription) return;

    this.logger.info({ executiveId: subscription.executiveId, role }, 'Tool bundle disabled');
    // Implementation would update ExecutiveToolConfig records
  }
}

export const addonService = new AddonService();
