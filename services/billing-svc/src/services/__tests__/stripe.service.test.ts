/**
 * @module @skillancer/billing-svc/services/__tests__/stripe.service.test
 * Tests for StripeService
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type Stripe from 'stripe';

// Mock Prisma client
vi.mock('@skillancer/database', () => ({
  prisma: {
    stripeCustomer: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
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

// Create mock Stripe API
const mockStripeApi = {
  customers: {
    create: vi.fn(),
    retrieve: vi.fn(),
    update: vi.fn(),
  },
  paymentMethods: {
    retrieve: vi.fn(),
    attach: vi.fn(),
    detach: vi.fn(),
    list: vi.fn(),
  },
  setupIntents: {
    create: vi.fn(),
  },
  webhooks: {
    constructEvent: vi.fn(),
  },
};

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => mockStripeApi),
}));

import { prisma } from '@skillancer/database';
import { StripeService, getStripeService } from '../stripe.service.js';

describe('StripeService', () => {
  let service: StripeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = getStripeService();
  });

  describe('getOrCreateCustomer', () => {
    it('should return existing customer if found', async () => {
      const mockCustomer = { id: 'cus_existing', email: 'test@example.com' };
      (prisma.stripeCustomer.findUnique as Mock).mockResolvedValue({
        stripeCustomerId: 'cus_existing',
      });
      mockStripeApi.customers.retrieve.mockResolvedValue(mockCustomer);

      const result = await service.getOrCreateCustomer('user-123', 'test@example.com', 'Test');

      expect(result.id).toBe('cus_existing');
    });

    it('should create new customer if not found', async () => {
      const mockCustomer = { id: 'cus_new', email: 'new@example.com' };
      (prisma.stripeCustomer.findUnique as Mock).mockResolvedValue(null);
      mockStripeApi.customers.create.mockResolvedValue(mockCustomer);
      (prisma.stripeCustomer.upsert as Mock).mockResolvedValue({
        stripeCustomerId: 'cus_new',
      });

      const result = await service.getOrCreateCustomer('user-123', 'new@example.com', 'New User');

      expect(result.id).toBe('cus_new');
      expect(mockStripeApi.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          name: 'New User',
        })
      );
    });
  });

  describe('getPaymentMethod', () => {
    it('should retrieve payment method from Stripe', async () => {
      const mockPaymentMethod = {
        id: 'pm_123',
        type: 'card',
        card: { brand: 'visa', last4: '4242' },
      };
      mockStripeApi.paymentMethods.retrieve.mockResolvedValue(mockPaymentMethod);

      const result = await service.getPaymentMethod('pm_123');

      expect(result.id).toBe('pm_123');
      expect(mockStripeApi.paymentMethods.retrieve).toHaveBeenCalledWith('pm_123');
    });
  });

  describe('attachPaymentMethod', () => {
    it('should attach payment method to customer', async () => {
      const mockPaymentMethod = { id: 'pm_123', customer: 'cus_123' };
      mockStripeApi.paymentMethods.attach.mockResolvedValue(mockPaymentMethod);

      const result = await service.attachPaymentMethod('pm_123', 'cus_123');

      expect(result.customer).toBe('cus_123');
      expect(mockStripeApi.paymentMethods.attach).toHaveBeenCalledWith('pm_123', {
        customer: 'cus_123',
      });
    });
  });

  describe('detachPaymentMethod', () => {
    it('should detach payment method from customer', async () => {
      const mockPaymentMethod = { id: 'pm_123', customer: null };
      mockStripeApi.paymentMethods.detach.mockResolvedValue(mockPaymentMethod);

      const result = await service.detachPaymentMethod('pm_123');

      expect(result.id).toBe('pm_123');
      expect(mockStripeApi.paymentMethods.detach).toHaveBeenCalledWith('pm_123');
    });
  });

  describe('listPaymentMethods', () => {
    it('should list payment methods for customer', async () => {
      const mockPaymentMethods = [
        { id: 'pm_1', type: 'card' },
        { id: 'pm_2', type: 'card' },
      ];
      mockStripeApi.paymentMethods.list.mockResolvedValue({ data: mockPaymentMethods });

      // When no type specified, it fetches 3 types (card, us_bank_account, sepa_debit)
      // Each returns our mock data, so total = 6 items
      const result = await service.listPaymentMethods('cus_123');

      expect(result.length).toBeGreaterThan(0);
      expect(mockStripeApi.paymentMethods.list).toHaveBeenCalled();
    });

    it('should list only card payment methods when type specified', async () => {
      const mockPaymentMethods = [{ id: 'pm_1', type: 'card' }];
      mockStripeApi.paymentMethods.list.mockResolvedValue({ data: mockPaymentMethods });

      const result = await service.listPaymentMethods('cus_123', 'card');

      expect(result).toHaveLength(1);
      expect(mockStripeApi.paymentMethods.list).toHaveBeenCalledWith({
        customer: 'cus_123',
        type: 'card',
        limit: 100,
      });
    });
  });

  describe('createSetupIntent', () => {
    it('should create setup intent', async () => {
      const mockSetupIntent = {
        id: 'seti_123',
        client_secret: 'seti_123_secret_abc',
        status: 'requires_payment_method',
      };
      mockStripeApi.setupIntents.create.mockResolvedValue(mockSetupIntent);

      const result = await service.createSetupIntent('cus_123', {
        paymentMethodTypes: ['card'],
      });

      expect(result.client_secret).toBe('seti_123_secret_abc');
    });
  });

  describe('constructWebhookEvent', () => {
    it('should construct webhook event from payload', () => {
      const mockEvent = { id: 'evt_123', type: 'payment_method.attached' };
      mockStripeApi.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = service.constructWebhookEvent(
        Buffer.from('payload'),
        'signature',
        'whsec_xxx'
      );

      expect(result.id).toBe('evt_123');
    });
  });

  describe('setDefaultPaymentMethod', () => {
    it('should update customer default payment method', async () => {
      const mockCustomer = {
        id: 'cus_123',
        invoice_settings: { default_payment_method: 'pm_123' },
      };
      mockStripeApi.customers.update.mockResolvedValue(mockCustomer);

      const result = await service.setDefaultPaymentMethod('cus_123', 'pm_123');

      expect(result.id).toBe('cus_123');
      expect(mockStripeApi.customers.update).toHaveBeenCalledWith('cus_123', {
        invoice_settings: { default_payment_method: 'pm_123' },
      });
    });
  });
});
