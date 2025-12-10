/**
 * @module @skillancer/billing-svc/handlers/__tests__/stripe-webhook.handler.test
 * Tests for Stripe webhook handler
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type Stripe from 'stripe';

// Mock Prisma client
vi.mock('@skillancer/database', () => ({
  prisma: {
    paymentMethod: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    stripeCustomer: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock config
vi.mock('../../config/index.js', () => ({
  getConfig: () => ({
    port: 3000,
    databaseUrl: 'postgresql://test:test@localhost:5432/test',
    stripe: {
      secretKey: 'sk_test_xxx',
      webhookSecret: 'whsec_xxx',
    },
    redis: {
      host: 'localhost',
      port: 6379,
    },
    maxPaymentMethods: 10,
    cardExpirationWarningDays: 30,
    environment: 'test',
    enableJobs: false,
  }),
}));

// Mock Stripe service
vi.mock('../../services/stripe.service.js', () => ({
  getStripeService: () => ({
    getUserIdByStripeCustomerId: vi.fn(),
  }),
}));

// Mock PaymentMethod service
vi.mock('../../services/payment-method.service.js', () => ({
  getPaymentMethodService: () => ({
    syncPaymentMethods: vi.fn(),
  }),
}));

import { prisma } from '@skillancer/database';
import { handleStripeWebhook } from '../stripe-webhook.handler.js';

describe('Stripe Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('payment_method.detached', () => {
    it('should mark payment method as removed when detached', async () => {
      const mockPaymentMethod: Stripe.PaymentMethod = {
        id: 'pm_123',
        object: 'payment_method',
        type: 'card',
        customer: null,
        created: Math.floor(Date.now() / 1000),
        livemode: false,
      } as unknown as Stripe.PaymentMethod;

      const event: Stripe.Event = {
        id: 'evt_123',
        object: 'event',
        type: 'payment_method.detached',
        data: { object: mockPaymentMethod },
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: '2024-11-20',
      } as Stripe.Event;

      (prisma.paymentMethod.findUnique as Mock).mockResolvedValue({
        id: 'pm_db_123',
        stripePaymentMethodId: 'pm_123',
        userId: 'user-123',
        isDefault: false,
      });

      const result = await handleStripeWebhook(event);

      expect(result.handled).toBe(true);
      expect(prisma.paymentMethod.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'REMOVED' },
        })
      );
    });

    it('should skip if payment method not found in database', async () => {
      const mockPaymentMethod: Stripe.PaymentMethod = {
        id: 'pm_unknown',
        object: 'payment_method',
        type: 'card',
        customer: null,
        created: Math.floor(Date.now() / 1000),
        livemode: false,
      } as unknown as Stripe.PaymentMethod;

      const event: Stripe.Event = {
        id: 'evt_123',
        object: 'event',
        type: 'payment_method.detached',
        data: { object: mockPaymentMethod },
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: '2024-11-20',
      } as Stripe.Event;

      (prisma.paymentMethod.findUnique as Mock).mockResolvedValue(null);

      const result = await handleStripeWebhook(event);

      expect(result.handled).toBe(true);
      expect(prisma.paymentMethod.update).not.toHaveBeenCalled();
    });
  });

  describe('payment_method.updated', () => {
    it('should update local record when payment method is updated', async () => {
      const mockPaymentMethod: Stripe.PaymentMethod = {
        id: 'pm_123',
        object: 'payment_method',
        type: 'card',
        customer: 'cus_123',
        card: {
          brand: 'visa',
          last4: '4242',
          exp_month: 6,
          exp_year: 2026,
        },
        billing_details: {
          name: 'Updated Name',
        },
        created: Math.floor(Date.now() / 1000),
        livemode: false,
      } as unknown as Stripe.PaymentMethod;

      const event: Stripe.Event = {
        id: 'evt_123',
        object: 'event',
        type: 'payment_method.updated',
        data: { object: mockPaymentMethod },
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: '2024-11-20',
      } as Stripe.Event;

      (prisma.paymentMethod.findUnique as Mock).mockResolvedValue({
        id: 'pm_db_123',
        stripePaymentMethodId: 'pm_123',
      });

      const result = await handleStripeWebhook(event);

      expect(result.handled).toBe(true);
      expect(prisma.paymentMethod.update).toHaveBeenCalled();
    });
  });

  describe('unhandled events', () => {
    it('should acknowledge unhandled event types', async () => {
      const event: Stripe.Event = {
        id: 'evt_123',
        object: 'event',
        type: 'charge.succeeded' as Stripe.Event.Type,
        data: { object: {} as any },
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: '2024-11-20',
      } as Stripe.Event;

      const result = await handleStripeWebhook(event);

      expect(result.handled).toBe(false);
    });
  });
});
