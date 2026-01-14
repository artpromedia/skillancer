/**
 * @module @skillancer/billing-svc/middleware/subscription
 * Subscription access control middleware
 *
 * Works with the existing Subscription model.
 */

import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';

import { getSubscriptionService } from '../services/subscription.service.js';

import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';

// =============================================================================
// TYPES
// =============================================================================

export interface SubscriptionContext {
  subscriptionId: string;
  product: string;
  plan: string;
  status: string;
  usageLimit?: number;
  currentUsage?: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    subscription?: SubscriptionContext;
  }
}

type ProductType = 'SKILLPOD' | 'COCKPIT';

// =============================================================================
// SUBSCRIPTION ACCESS MIDDLEWARE
// =============================================================================

/**
 * Require active subscription for a specific product
 */
export function requireSubscription(product: ProductType) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply,
    done?: HookHandlerDoneFunction
  ): Promise<void> {
    const user = request.user;

    if (!user) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    try {
      const subscriptionService = getSubscriptionService();
      const subscription = await subscriptionService.getActiveSubscription(user.id, product);

      if (!subscription) {
        return await reply.status(403).send({
          error: 'SUBSCRIPTION_REQUIRED',
          message: `Active ${product} subscription required`,
          product,
          upgradeUrl: `/billing/subscribe?product=${product.toLowerCase()}`,
        });
      }

      // Check if subscription is in a usable state
      const usableStatuses = ['ACTIVE', 'TRIALING'];
      if (!usableStatuses.includes(subscription.status)) {
        return await reply.status(403).send({
          error: 'SUBSCRIPTION_INACTIVE',
          message: 'Subscription is not active',
          status: subscription.status,
          product,
        });
      }

      // Attach subscription context to request
      const subContext: SubscriptionContext = {
        subscriptionId: subscription.id,
        product: subscription.product,
        plan: subscription.plan,
        status: subscription.status,
        currentUsage: subscription.usageThisPeriod,
      };
      if (subscription.usageLimit !== null) {
        subContext.usageLimit = subscription.usageLimit;
      }
      request.subscription = subContext;

      if (done) {
        done();
      }
    } catch (error) {
      console.error('[Subscription Middleware] Error checking subscription:', error);
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to verify subscription',
      });
    }
  };
}

/**
 * Require a specific plan tier or higher
 */
export function requirePlan(requiredPlans: string[]) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply,
    done?: HookHandlerDoneFunction
  ): Promise<void> {
    const subscription = request.subscription;

    if (!subscription) {
      return reply.status(403).send({
        error: 'SUBSCRIPTION_REQUIRED',
        message: 'Active subscription required',
      });
    }

    if (!requiredPlans.includes(subscription.plan)) {
      return reply.status(403).send({
        error: 'PLAN_UPGRADE_REQUIRED',
        message: `This feature requires one of these plans: ${requiredPlans.join(', ')}`,
        currentPlan: subscription.plan,
        requiredPlans,
        upgradeUrl: '/billing/upgrade',
      });
    }

    if (done) {
      done();
    }
  };
}

/**
 * Require a specific feature
 * Note: Feature checks require plan configuration - stub implementation
 */
export function requireFeature(featureKey: string) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply,
    done?: HookHandlerDoneFunction
  ): Promise<void> {
    const subscription = request.subscription;

    if (!subscription) {
      return reply.status(403).send({
        error: 'SUBSCRIPTION_REQUIRED',
        message: 'Active subscription required',
      });
    }

    // Feature checking requires plan configuration
    // For now, just pass through - implement when plan config is available
    logger.debug({ featureKey, plan: subscription.plan }, 'Checking feature access');

    if (done) {
      done();
    }
  };
}

/**
 * Check current usage against limit
 */
export function checkUsageLimit() {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply,
    done?: HookHandlerDoneFunction
  ): Promise<void> {
    const subscription = request.subscription;

    if (!subscription) {
      return reply.status(403).send({
        error: 'SUBSCRIPTION_REQUIRED',
        message: 'Active subscription required',
      });
    }

    // Add usage info to request
    const usageInfo = {
      current: subscription.currentUsage ?? 0,
      limit: subscription.usageLimit,
      remaining: subscription.usageLimit
        ? subscription.usageLimit - (subscription.currentUsage ?? 0)
        : null,
      unlimited: !subscription.usageLimit,
    };

    // Attach to request for use in handlers
    (request as FastifyRequest & { usageInfo?: typeof usageInfo }).usageInfo = usageInfo;

    if (done) {
      done();
    }
  };
}

/**
 * Enforce usage limits (reject if exceeded)
 */
export function enforceUsageLimit() {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply,
    done?: HookHandlerDoneFunction
  ): Promise<void> {
    const subscription = request.subscription;

    if (!subscription) {
      return reply.status(403).send({
        error: 'SUBSCRIPTION_REQUIRED',
        message: 'Active subscription required',
      });
    }

    // Check if usage limit is set and exceeded
    if (subscription.usageLimit && (subscription.currentUsage ?? 0) >= subscription.usageLimit) {
      return reply.status(429).send({
        error: 'USAGE_LIMIT_EXCEEDED',
        message: 'You have reached your usage limit for this billing period',
        currentUsage: subscription.currentUsage,
        limit: subscription.usageLimit,
        resetDate: null, // Would need subscription period end date
        upgradeUrl: '/billing/upgrade',
      });
    }

    if (done) {
      done();
    }
  };
}

/**
 * Require seat to be available (stub for per-seat subscriptions)
 * Note: Full seat management requires SeatAssignment model
 */
export function requireSeatAvailable() {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply,
    done?: HookHandlerDoneFunction
  ): Promise<void> {
    const subscription = request.subscription;

    if (!subscription) {
      return reply.status(403).send({
        error: 'SUBSCRIPTION_REQUIRED',
        message: 'Active subscription required',
      });
    }

    // Seat management requires extended schema
    // For now, pass through
    logger.debug('Seat management requires extended schema');

    if (done) {
      done();
    }
  };
}

/**
 * Check if user is the subscription owner
 */
export function requireSubscriptionOwner() {
  return async function (
    request: FastifyRequest<{ Params?: { subscriptionId?: string } }>,
    reply: FastifyReply,
    done?: HookHandlerDoneFunction
  ): Promise<void> {
    const user = request.user;
    const subscriptionId = request.params?.subscriptionId;

    if (!user) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    if (!subscriptionId) {
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: 'Subscription ID required',
      });
    }

    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        select: { userId: true },
      });

      if (!subscription) {
        return await reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Subscription not found',
        });
      }

      if (subscription.userId !== user.id) {
        // Check if user is admin via authContext
        const authContext = (request as FastifyRequest & { authContext?: { roles?: string[] } })
          .authContext;
        const roles = authContext?.roles ?? [];

        if (!roles.includes('admin')) {
          return await reply.status(403).send({
            error: 'FORBIDDEN',
            message: 'You do not own this subscription',
          });
        }
      }

      if (done) {
        done();
      }
    } catch (error) {
      console.error('[Subscription Middleware] Owner check failed:', error);
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to verify subscription ownership',
      });
    }
  };
}
