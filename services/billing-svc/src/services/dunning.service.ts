// @ts-nocheck - Known type issues pending refactor
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * @module @skillancer/billing-svc/services/dunning
 * Dunning service for failed payment recovery
 *
 * NOTE: This service requires the DunningAttempt model to be added to the schema.
 * Run the schema migration before using this service in production.
 */

import Stripe from 'stripe';

import { getConfig, type Config } from '../config/index.js';
import { getSubscriptionRepository } from '../repositories/subscription.repository.js';

import type { SubscriptionRepository } from '../repositories/subscription.repository.js';

// =============================================================================
// TYPES
// =============================================================================

export interface DunningStep {
  day: number;
  action: 'email' | 'sms' | 'cancel';
  template: string;
  description: string;
}

export interface DunningSchedule {
  name: string;
  steps: DunningStep[];
}

export interface DunningJobData {
  subscriptionId: string;
  step: DunningStep;
  attemptNumber: number;
}

// =============================================================================
// DEFAULT DUNNING SCHEDULE
// =============================================================================

const DEFAULT_DUNNING_SCHEDULE: DunningSchedule = {
  name: 'standard',
  steps: [
    {
      day: 1,
      action: 'email',
      template: 'payment_failed_initial',
      description: 'Initial payment failed notification',
    },
    {
      day: 3,
      action: 'email',
      template: 'payment_failed_reminder',
      description: 'Payment reminder',
    },
    {
      day: 7,
      action: 'email',
      template: 'payment_failed_urgent',
      description: 'Urgent payment notice',
    },
    {
      day: 14,
      action: 'email',
      template: 'payment_failed_final',
      description: 'Final notice before cancellation',
    },
    {
      day: 21,
      action: 'cancel',
      template: 'subscription_canceled',
      description: 'Subscription cancellation',
    },
  ],
};

// =============================================================================
// DUNNING SERVICE (Stub)
// =============================================================================

export class DunningService {
  private readonly subscriptionRepository: SubscriptionRepository;
  private readonly stripe: Stripe;
  private readonly config: Config;
  private readonly schedule: DunningSchedule;
  private initialized: boolean = false;

  constructor(
    subscriptionRepository?: SubscriptionRepository,
    stripeInstance?: Stripe,
    config?: Config,
    schedule?: DunningSchedule
  ) {
    const appConfig = config ?? getConfig();
    this.subscriptionRepository = subscriptionRepository ?? getSubscriptionRepository();
    this.stripe =
      stripeInstance ??
      new Stripe(appConfig.stripe.secretKey, {
        apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
      });
    this.config = appConfig;
    this.schedule = schedule ?? DEFAULT_DUNNING_SCHEDULE;
  }

  /**
   * Initialize dunning job queue
   */
  initialize(): void {
    console.warn('[Dunning Service] Full dunning support requires schema migration.');
    console.warn('[Dunning Service] Using stub implementation.');
    this.initialized = true;
  }

  /**
   * Start dunning process for a subscription
   */
  async startDunning(subscriptionId: string): Promise<void> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);

    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    console.log(`[Dunning Service] Would start dunning for subscription ${subscriptionId}`);
    console.log(`[Dunning Service] Schedule: ${this.schedule.steps.length} steps`);

    // In the full implementation, this would:
    // 1. Create dunning attempt records in database
    // 2. Schedule jobs with BullMQ
    // 3. Track retry attempts
  }

  /**
   * Stop dunning process for a subscription
   */
  stopDunning(subscriptionId: string): void {
    console.log(`[Dunning Service] Would stop dunning for subscription ${subscriptionId}`);
    // In the full implementation, this would:
    // 1. Cancel all scheduled dunning jobs
    // 2. Update dunning attempt records as skipped
  }

  /**
   * Process a dunning step
   */
  processDunningStep(data: DunningJobData): void {
    const { subscriptionId, step, attemptNumber } = data;

    console.log(`[Dunning Service] Processing step ${attemptNumber} for ${subscriptionId}`);
    console.log(`[Dunning Service] Action: ${step.action}, Template: ${step.template}`);

    // In the full implementation, this would:
    // 1. Execute the dunning action (email, SMS, cancel)
    // 2. Update the dunning attempt record
    // 3. Emit events for monitoring
  }

  /**
   * Retry payment manually
   */
  async retryPayment(subscriptionId: string): Promise<{ success: boolean; message: string }> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);

    if (!subscription) {
      return { success: false, message: 'Subscription not found' };
    }

    try {
      // Get latest invoice for subscription
      const invoices = await this.stripe.invoices.list({
        subscription: subscription.stripeSubscriptionId,
        status: 'open',
        limit: 1,
      });

      if (invoices.data.length === 0) {
        return { success: false, message: 'No open invoice found' };
      }

      const invoice = invoices.data[0];
      if (!invoice) {
        return { success: false, message: 'No invoice found' };
      }

      // Attempt to pay the invoice
      await this.stripe.invoices.pay(invoice.id);

      // Stop dunning if payment succeeds
      this.stopDunning(subscriptionId);

      return { success: true, message: 'Payment successful' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Payment retry failed';
      return { success: false, message };
    }
  }

  /**
   * Get dunning status for a subscription
   */
  getDunningStatus(_subscriptionId: string): {
    isInDunning: boolean;
    currentStep: number | null;
    nextAction: DunningStep | null;
    history: Array<{ step: number; status: string; date: Date }>;
  } {
    // Stub implementation - would normally query dunningAttempt table
    return {
      isInDunning: false,
      currentStep: null,
      nextAction: null,
      history: [],
    };
  }

  /**
   * Get dunning schedule
   */
  getSchedule(): DunningSchedule {
    return this.schedule;
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Shutdown service gracefully
   */
  shutdown(): void {
    console.log('[Dunning Service] Shutting down');
    this.initialized = false;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let dunningServiceInstance: DunningService | null = null;

export function getDunningService(): DunningService {
  dunningServiceInstance ??= new DunningService();
  return dunningServiceInstance;
}

export function initializeDunningService(): void {
  dunningServiceInstance = new DunningService();
}

export { DEFAULT_DUNNING_SCHEDULE };
