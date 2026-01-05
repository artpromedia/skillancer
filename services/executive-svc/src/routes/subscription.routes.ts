/**
 * Subscription Routes
 *
 * API routes for managing executive subscriptions, billing, and add-ons.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { subscriptionService, TIER_CONFIG } from '../services/subscription.service.js';
import { addonService } from '../services/addon.service.js';

interface SubscriptionParams {
  subscriptionId: string;
}

interface AddonParams {
  addonId: string;
}

interface CreateSubscriptionBody {
  tier: 'BASIC' | 'PRO' | 'ENTERPRISE';
  billingCycle: 'MONTHLY' | 'ANNUAL';
  paymentMethodId?: string;
}

interface UpdateSubscriptionBody {
  tier?: 'BASIC' | 'PRO' | 'ENTERPRISE';
  billingCycle?: 'MONTHLY' | 'ANNUAL';
  cancelAtPeriodEnd?: boolean;
}

interface AddAddonBody {
  addonType: string;
  quantity: number;
}

interface UpdatePaymentMethodBody {
  paymentMethodId: string;
}

interface StripeWebhookBody {
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

export async function subscriptionRoutes(fastify: FastifyInstance) {
  // =========================================================================
  // SUBSCRIPTION MANAGEMENT
  // =========================================================================

  /**
   * GET /subscription - Get current subscription
   */
  fastify.get('/subscription', async (request: FastifyRequest, reply: FastifyReply) => {
    const executiveId = request.user?.executiveId;

    if (!executiveId) {
      return reply.code(401).send({ error: 'Not authenticated as executive' });
    }

    const subscription = await subscriptionService.getSubscription(executiveId);

    if (!subscription) {
      return reply.code(404).send({ error: 'No subscription found' });
    }

    return subscription;
  });

  /**
   * GET /subscription/plans - Get available plans
   */
  fastify.get('/subscription/plans', async (_request: FastifyRequest, _reply: FastifyReply) => {
    return {
      plans: Object.entries(TIER_CONFIG).map(([tier, config]) => ({
        tier,
        ...config,
      })),
    };
  });

  /**
   * POST /subscription - Create subscription
   */
  fastify.post(
    '/subscription',
    async (request: FastifyRequest<{ Body: CreateSubscriptionBody }>, reply: FastifyReply) => {
      const executiveId = request.user?.executiveId;

      if (!executiveId) {
        return reply.code(401).send({ error: 'Not authenticated as executive' });
      }

      const { tier, billingCycle, paymentMethodId } = request.body;

      try {
        const subscription = await subscriptionService.createSubscription({
          executiveId,
          tier,
          billingCycle,
          stripePaymentMethodId: paymentMethodId,
        });

        return reply.code(201).send(subscription);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create subscription';
        return reply.code(400).send({ error: message });
      }
    }
  );

  /**
   * PUT /subscription - Update subscription (upgrade/downgrade)
   */
  fastify.put(
    '/subscription',
    async (request: FastifyRequest<{ Body: UpdateSubscriptionBody }>, reply: FastifyReply) => {
      const executiveId = request.user?.executiveId;

      if (!executiveId) {
        return reply.code(401).send({ error: 'Not authenticated as executive' });
      }

      const subscription = await subscriptionService.getSubscription(executiveId);

      if (!subscription) {
        return reply.code(404).send({ error: 'No subscription found' });
      }

      try {
        const updated = await subscriptionService.updateSubscription(subscription.id, request.body);

        return updated;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update subscription';
        return reply.code(400).send({ error: message });
      }
    }
  );

  /**
   * DELETE /subscription - Cancel subscription
   */
  fastify.delete(
    '/subscription',
    async (
      request: FastifyRequest<{ Querystring: { reason?: string; immediate?: string } }>,
      reply: FastifyReply
    ) => {
      const executiveId = request.user?.executiveId;

      if (!executiveId) {
        return reply.code(401).send({ error: 'Not authenticated as executive' });
      }

      const subscription = await subscriptionService.getSubscription(executiveId);

      if (!subscription) {
        return reply.code(404).send({ error: 'No subscription found' });
      }

      const { reason, immediate } = request.query;

      try {
        const updated = await subscriptionService.cancelSubscription(
          subscription.id,
          reason,
          immediate === 'true'
        );

        return updated;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to cancel subscription';
        return reply.code(400).send({ error: message });
      }
    }
  );

  // =========================================================================
  // USAGE TRACKING
  // =========================================================================

  /**
   * GET /subscription/usage - Get usage summary
   */
  fastify.get('/subscription/usage', async (request: FastifyRequest, reply: FastifyReply) => {
    const executiveId = request.user?.executiveId;

    if (!executiveId) {
      return reply.code(401).send({ error: 'Not authenticated as executive' });
    }

    const usage = await subscriptionService.getUsageSummary(executiveId);

    if (!usage) {
      return reply.code(404).send({ error: 'No subscription found' });
    }

    return usage;
  });

  /**
   * POST /subscription/check-limits - Check if action is allowed
   */
  fastify.post(
    '/subscription/check-limits',
    async (
      request: FastifyRequest<{
        Body: { action: 'add_client' | 'use_skillpod' | 'add_team_member'; amount?: number };
      }>,
      reply: FastifyReply
    ) => {
      const executiveId = request.user?.executiveId;

      if (!executiveId) {
        return reply.code(401).send({ error: 'Not authenticated as executive' });
      }

      const { action, amount } = request.body;
      const result = await subscriptionService.checkLimits(executiveId, action, amount);

      return result;
    }
  );

  // =========================================================================
  // ADD-ONS
  // =========================================================================

  /**
   * GET /subscription/addons - Get active add-ons
   */
  fastify.get('/subscription/addons', async (request: FastifyRequest, reply: FastifyReply) => {
    const executiveId = request.user?.executiveId;

    if (!executiveId) {
      return reply.code(401).send({ error: 'Not authenticated as executive' });
    }

    const subscription = await subscriptionService.getSubscription(executiveId);

    if (!subscription) {
      return reply.code(404).send({ error: 'No subscription found' });
    }

    const addons = await addonService.getActiveAddons(subscription.id);

    return { addons };
  });

  /**
   * GET /subscription/addons/available - Get available add-ons for tier
   */
  fastify.get(
    '/subscription/addons/available',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const executiveId = request.user?.executiveId;

      if (!executiveId) {
        return reply.code(401).send({ error: 'Not authenticated as executive' });
      }

      const subscription = await subscriptionService.getSubscription(executiveId);

      if (!subscription) {
        return reply.code(404).send({ error: 'No subscription found' });
      }

      const availableAddons = addonService.getAvailableAddons(
        subscription.tier as 'BASIC' | 'PRO' | 'ENTERPRISE'
      );

      return { addons: availableAddons };
    }
  );

  /**
   * POST /subscription/addons - Add an addon
   */
  fastify.post(
    '/subscription/addons',
    async (request: FastifyRequest<{ Body: AddAddonBody }>, reply: FastifyReply) => {
      const executiveId = request.user?.executiveId;

      if (!executiveId) {
        return reply.code(401).send({ error: 'Not authenticated as executive' });
      }

      const subscription = await subscriptionService.getSubscription(executiveId);

      if (!subscription) {
        return reply.code(404).send({ error: 'No subscription found' });
      }

      const { addonType, quantity } = request.body;

      try {
        const addon = await addonService.addAddon({
          subscriptionId: subscription.id,
          addonType: addonType as keyof typeof import('../services/addon.service.js').ADDON_CONFIG,
          quantity,
        });

        return reply.code(201).send(addon);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add addon';
        return reply.code(400).send({ error: message });
      }
    }
  );

  /**
   * DELETE /subscription/addons/:addonId - Remove an addon
   */
  fastify.delete(
    '/subscription/addons/:addonId',
    async (request: FastifyRequest<{ Params: AddonParams }>, reply: FastifyReply) => {
      const executiveId = request.user?.executiveId;

      if (!executiveId) {
        return reply.code(401).send({ error: 'Not authenticated as executive' });
      }

      const subscription = await subscriptionService.getSubscription(executiveId);

      if (!subscription) {
        return reply.code(404).send({ error: 'No subscription found' });
      }

      const { addonId } = request.params;

      try {
        await addonService.removeAddon(subscription.id, addonId);
        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to remove addon';
        return reply.code(400).send({ error: message });
      }
    }
  );

  // =========================================================================
  // BILLING
  // =========================================================================

  /**
   * GET /subscription/invoices - Get invoice history
   */
  fastify.get(
    '/subscription/invoices',
    async (request: FastifyRequest<{ Querystring: { limit?: string } }>, reply: FastifyReply) => {
      const executiveId = request.user?.executiveId;

      if (!executiveId) {
        return reply.code(401).send({ error: 'Not authenticated as executive' });
      }

      const subscription = await subscriptionService.getSubscription(executiveId);

      if (!subscription) {
        return reply.code(404).send({ error: 'No subscription found' });
      }

      const limit = request.query.limit ? Number.parseInt(request.query.limit, 10) : 12;
      const invoices = await subscriptionService.getInvoices(subscription.id, limit);

      return { invoices };
    }
  );

  /**
   * PUT /subscription/payment-method - Update payment method
   */
  fastify.put(
    '/subscription/payment-method',
    async (request: FastifyRequest<{ Body: UpdatePaymentMethodBody }>, reply: FastifyReply) => {
      const executiveId = request.user?.executiveId;

      if (!executiveId) {
        return reply.code(401).send({ error: 'Not authenticated as executive' });
      }

      const subscription = await subscriptionService.getSubscription(executiveId);

      if (!subscription) {
        return reply.code(404).send({ error: 'No subscription found' });
      }

      const { paymentMethodId } = request.body;

      try {
        await subscriptionService.updatePaymentMethod(subscription.id, paymentMethodId);
        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update payment method';
        return reply.code(400).send({ error: message });
      }
    }
  );

  // =========================================================================
  // WEBHOOKS
  // =========================================================================

  /**
   * POST /subscription/webhook - Stripe webhook handler
   */
  fastify.post(
    '/subscription/webhook',
    async (request: FastifyRequest<{ Body: StripeWebhookBody }>, reply: FastifyReply) => {
      // In production, verify Stripe webhook signature
      // const sig = request.headers['stripe-signature'];
      // stripe.webhooks.constructEvent(request.body, sig, webhookSecret);

      try {
        await subscriptionService.handleStripeWebhook(request.body);
        return { received: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Webhook processing failed';
        return reply.code(400).send({ error: message });
      }
    }
  );
}

