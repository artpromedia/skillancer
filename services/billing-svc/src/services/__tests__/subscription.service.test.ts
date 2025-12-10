/**
 * @module @skillancer/billing-svc/tests/subscription.service.test
 * Tests for subscription service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  SubscriptionNotFoundError,
  InvalidPlanError,
  SubscriptionAlreadyExistsError,
  SubscriptionCanceledError,
  InvalidPlanChangeError,
} from '../../errors/index.js';
import {
  type SubscriptionService,
  getSubscriptionService,
  resetSubscriptionService,
} from '../../services/subscription.service.js';

// =============================================================================
// MOCKS
// =============================================================================

// Create mock functions first
const mockGetOrCreateCustomer = vi.fn();
const mockCreateSubscription = vi.fn();
const mockGetSubscription = vi.fn();
const mockUpdateSubscription = vi.fn();
const mockCancelSubscription = vi.fn();
const mockReactivateSubscription = vi.fn();
const mockScheduleSubscriptionUpdate = vi.fn();
const mockReportUsage = vi.fn();

// Mock Stripe service module
vi.mock('../../services/stripe.service.js', () => ({
  getStripeService: () => ({
    getOrCreateCustomer: mockGetOrCreateCustomer,
    createSubscription: mockCreateSubscription,
    getSubscription: mockGetSubscription,
    updateSubscription: mockUpdateSubscription,
    cancelSubscription: mockCancelSubscription,
    reactivateSubscription: mockReactivateSubscription,
    scheduleSubscriptionUpdate: mockScheduleSubscriptionUpdate,
    reportUsage: mockReportUsage,
  }),
}));

// Mock Prisma
vi.mock('@skillancer/database', () => ({
  prisma: {
    subscription: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    subscriptionInvoice: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    usageRecord: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    paymentMethod: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock config
vi.mock('../../config/index.js', () => ({
  getConfig: () => ({
    stripe: {
      secretKey: 'sk_test_xxx',
      webhookSecret: 'whsec_xxx',
    },
    app: {
      nodeEnv: 'test',
    },
  }),
}));

// =============================================================================
// MOCK DATA
// =============================================================================

// Reference to the mock stripe service methods
const mockStripeService = {
  getOrCreateCustomer: mockGetOrCreateCustomer,
  createSubscription: mockCreateSubscription,
  getSubscription: mockGetSubscription,
  updateSubscription: mockUpdateSubscription,
  cancelSubscription: mockCancelSubscription,
  reactivateSubscription: mockReactivateSubscription,
  scheduleSubscriptionUpdate: mockScheduleSubscriptionUpdate,
  reportUsage: mockReportUsage,
};

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
};

const mockStripeCustomer = {
  id: 'cus_123',
  email: 'test@example.com',
};

const mockStripeSubscription = {
  id: 'sub_123',
  customer: 'cus_123',
  status: 'active' as const,
  current_period_start: Math.floor(Date.now() / 1000),
  current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  trial_end: null,
  items: {
    data: [
      {
        id: 'si_123',
        price: {
          id: 'price_123',
          product: 'prod_123',
          unit_amount: 4900,
        },
      },
    ],
  },
  currency: 'usd',
};

const mockSubscription = {
  id: 'sub-uuid-123',
  userId: 'user-123',
  tenantId: null,
  stripeSubscriptionId: 'sub_123',
  stripeCustomerId: 'cus_123',
  stripePriceId: 'price_123',
  stripeProductId: 'prod_123',
  product: 'SKILLPOD',
  plan: 'starter',
  billingInterval: 'MONTHLY',
  status: 'ACTIVE',
  trialEndsAt: null,
  currentPeriodStart: new Date(),
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  cancelAt: null,
  canceledAt: null,
  endedAt: null,
  pendingPlan: null,
  pendingPriceId: null,
  pendingChangeAt: null,
  usageThisPeriod: 0,
  usageLimit: 6000,
  unitAmount: 4900,
  currency: 'usd',
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

// =============================================================================
// TEST HELPERS
// =============================================================================

// eslint-disable-next-line import/order
import { prisma } from '@skillancer/database';
import type Stripe from 'stripe';

const mockPrisma = prisma as unknown as {
  subscription: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  subscriptionInvoice: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  usageRecord: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  user: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  paymentMethod: {
    findMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

// =============================================================================
// TESTS
// =============================================================================

describe('SubscriptionService', () => {
  let service: SubscriptionService;

  beforeEach(() => {
    resetSubscriptionService();
    service = getSubscriptionService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // GET SUBSCRIPTIONS
  // ===========================================================================

  describe('getSubscriptions', () => {
    it('should return subscriptions for a user', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([mockSubscription]);

      const result = await service.getSubscriptions('user-123');

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(mockSubscription.id);
      expect(result[0]?.product).toBe('SKILLPOD');
      expect(result[0]?.plan).toBe('starter');
    });

    it('should return empty array if user has no subscriptions', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([]);

      const result = await service.getSubscriptions('user-456');

      expect(result).toHaveLength(0);
    });
  });

  describe('getSubscription', () => {
    it('should return a specific subscription', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(mockSubscription);

      const result = await service.getSubscription('sub-uuid-123', 'user-123');

      expect(result.id).toBe(mockSubscription.id);
      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith({
        where: { id: 'sub-uuid-123', userId: 'user-123' },
      });
    });

    it('should throw SubscriptionNotFoundError if not found', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await expect(service.getSubscription('invalid-id', 'user-123')).rejects.toThrow(
        SubscriptionNotFoundError
      );
    });
  });

  // ===========================================================================
  // CREATE SUBSCRIPTION
  // ===========================================================================

  describe('createSubscription', () => {
    it('should create a new subscription', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null); // No existing subscription
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockStripeService.getOrCreateCustomer.mockResolvedValue(mockStripeCustomer);
      mockStripeService.createSubscription.mockResolvedValue(mockStripeSubscription);
      mockPrisma.subscription.create.mockResolvedValue(mockSubscription);

      const result = await service.createSubscription('user-123', {
        product: 'SKILLPOD',
        plan: 'starter',
        billingInterval: 'MONTHLY',
      });

      expect(result.product).toBe('SKILLPOD');
      expect(result.plan).toBe('starter');
      expect(mockStripeService.createSubscription).toHaveBeenCalled();
      expect(mockPrisma.subscription.create).toHaveBeenCalled();
    });

    it('should throw InvalidPlanError for invalid plan', async () => {
      await expect(
        service.createSubscription('user-123', {
          product: 'SKILLPOD',
          plan: 'invalid-plan',
          billingInterval: 'MONTHLY',
        })
      ).rejects.toThrow(InvalidPlanError);
    });

    it('should throw SubscriptionAlreadyExistsError if active subscription exists', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(mockSubscription);

      await expect(
        service.createSubscription('user-123', {
          product: 'SKILLPOD',
          plan: 'professional',
          billingInterval: 'MONTHLY',
        })
      ).rejects.toThrow(SubscriptionAlreadyExistsError);
    });
  });

  // ===========================================================================
  // CANCEL SUBSCRIPTION
  // ===========================================================================

  describe('cancelSubscription', () => {
    it('should cancel subscription at period end by default', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(mockSubscription);
      mockStripeService.cancelSubscription.mockResolvedValue({
        ...mockStripeSubscription,
        cancel_at_period_end: true,
      });
      mockPrisma.subscription.update.mockResolvedValue({
        ...mockSubscription,
        cancelAt: new Date(mockStripeSubscription.current_period_end * 1000),
        canceledAt: new Date(),
      });

      const result = await service.cancelSubscription('sub-uuid-123', 'user-123');

      expect(result.cancelAt).toBeTruthy();
      expect(mockStripeService.cancelSubscription).toHaveBeenCalledWith('sub_123', true);
    });

    it('should cancel subscription immediately if atPeriodEnd is false', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(mockSubscription);
      mockStripeService.cancelSubscription.mockResolvedValue({
        ...mockStripeSubscription,
        status: 'canceled',
      });
      mockPrisma.subscription.update.mockResolvedValue({
        ...mockSubscription,
        status: 'CANCELED',
        endedAt: new Date(),
      });

      const result = await service.cancelSubscription('sub-uuid-123', 'user-123', false);

      expect(result.status).toBe('CANCELED');
      expect(mockStripeService.cancelSubscription).toHaveBeenCalledWith('sub_123', false);
    });

    it('should throw SubscriptionNotFoundError if subscription not found', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await expect(service.cancelSubscription('invalid-id', 'user-123')).rejects.toThrow(
        SubscriptionNotFoundError
      );
    });

    it('should throw SubscriptionCanceledError if already canceled', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        ...mockSubscription,
        status: 'CANCELED',
      });

      await expect(service.cancelSubscription('sub-uuid-123', 'user-123')).rejects.toThrow(
        SubscriptionCanceledError
      );
    });
  });

  // ===========================================================================
  // REACTIVATE SUBSCRIPTION
  // ===========================================================================

  describe('reactivateSubscription', () => {
    it('should reactivate a canceled subscription', async () => {
      const canceledSubscription = {
        ...mockSubscription,
        cancelAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        canceledAt: new Date(),
        endedAt: null,
      };

      mockPrisma.subscription.findFirst.mockResolvedValue(canceledSubscription);
      mockStripeService.reactivateSubscription.mockResolvedValue({
        ...mockStripeSubscription,
        cancel_at_period_end: false,
      });
      mockPrisma.subscription.update.mockResolvedValue({
        ...mockSubscription,
        cancelAt: null,
        canceledAt: null,
        status: 'ACTIVE',
      });

      const result = await service.reactivateSubscription('sub-uuid-123', 'user-123');

      expect(result.cancelAt).toBeNull();
      expect(result.status).toBe('ACTIVE');
      expect(mockStripeService.reactivateSubscription).toHaveBeenCalledWith('sub_123');
    });

    it('should throw error if subscription already ended', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        ...mockSubscription,
        cancelAt: null,
        endedAt: new Date(),
      });

      await expect(service.reactivateSubscription('sub-uuid-123', 'user-123')).rejects.toThrow(
        InvalidPlanChangeError
      );
    });
  });

  // ===========================================================================
  // PLAN CHANGES
  // ===========================================================================

  describe('upgradeSubscription', () => {
    it('should upgrade subscription immediately with proration', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(mockSubscription);
      mockStripeService.getSubscription.mockResolvedValue(mockStripeSubscription);
      mockStripeService.updateSubscription.mockResolvedValue({
        ...mockStripeSubscription,
        items: {
          data: [
            {
              ...mockStripeSubscription.items.data[0],
              price: { ...mockStripeSubscription.items.data[0]?.price, unit_amount: 14900 },
            },
          ],
        },
      });
      mockPrisma.subscription.update.mockResolvedValue({
        ...mockSubscription,
        plan: 'professional',
        unitAmount: 14900,
      });

      const result = await service.upgradeSubscription('sub-uuid-123', 'user-123', 'professional');

      expect(result.subscription.plan).toBe('professional');
      expect(result.isImmediate).toBe(true);
      expect(mockStripeService.updateSubscription).toHaveBeenCalledWith(
        'sub_123',
        expect.objectContaining({
          proration_behavior: 'create_prorations',
        })
      );
    });

    it('should throw error when trying to upgrade to same or lower plan', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        ...mockSubscription,
        plan: 'professional',
      });

      await expect(
        service.upgradeSubscription('sub-uuid-123', 'user-123', 'starter')
      ).rejects.toThrow(InvalidPlanChangeError);
    });
  });

  describe('downgradeSubscription', () => {
    it('should schedule downgrade for end of period', async () => {
      const professionalSubscription = {
        ...mockSubscription,
        plan: 'professional',
      };

      mockPrisma.subscription.findFirst.mockResolvedValue(professionalSubscription);
      mockStripeService.getSubscription.mockResolvedValue(mockStripeSubscription);
      mockStripeService.scheduleSubscriptionUpdate.mockResolvedValue({});
      mockPrisma.subscription.update.mockResolvedValue({
        ...professionalSubscription,
        pendingPlan: 'starter',
        pendingChangeAt: professionalSubscription.currentPeriodEnd,
      });

      const result = await service.downgradeSubscription('sub-uuid-123', 'user-123', 'starter');

      expect(result.subscription.pendingPlan).toBe('starter');
      expect(result.isImmediate).toBe(false);
      expect(result.effectiveDate).toEqual(professionalSubscription.currentPeriodEnd);
    });

    it('should throw error when trying to downgrade to same or higher plan', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(mockSubscription);

      await expect(
        service.downgradeSubscription('sub-uuid-123', 'user-123', 'professional')
      ).rejects.toThrow(InvalidPlanChangeError);
    });
  });

  // ===========================================================================
  // USAGE TRACKING
  // ===========================================================================

  describe('recordUsage', () => {
    it('should record usage for SkillPod subscription', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription);
      mockStripeService.reportUsage.mockResolvedValue({});
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.recordUsage('sub-uuid-123', 60, {
        sessionId: 'session-1',
        podId: 'pod-1',
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockStripeService.reportUsage).toHaveBeenCalledWith('sub_123', 60);
    });

    it('should not record usage for non-SkillPod subscriptions', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        product: 'COCKPIT',
      });

      await service.recordUsage('sub-uuid-123', 60);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should throw error if subscription not found', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      await expect(service.recordUsage('invalid-id', 60)).rejects.toThrow(
        SubscriptionNotFoundError
      );
    });
  });

  describe('getUsage', () => {
    it('should return usage summary', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription);
      mockPrisma.usageRecord.findMany.mockResolvedValue([
        { id: 'ur-1', quantity: 30, action: 'INCREMENT', timestamp: new Date() },
        { id: 'ur-2', quantity: 45, action: 'INCREMENT', timestamp: new Date() },
      ]);

      const result = await service.getUsage('sub-uuid-123');

      expect(result.usageMinutes).toBe(75);
      expect(result.usageLimit).toBe(6000);
      expect(result.overageMinutes).toBe(0);
      expect(result.records).toHaveLength(2);
    });

    it('should calculate overage correctly', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        usageLimit: 100,
      });
      mockPrisma.usageRecord.findMany.mockResolvedValue([
        { id: 'ur-1', quantity: 150, action: 'INCREMENT', timestamp: new Date() },
      ]);

      const result = await service.getUsage('sub-uuid-123');

      expect(result.usageMinutes).toBe(150);
      expect(result.overageMinutes).toBe(50);
      expect(result.overageCost).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // INVOICES
  // ===========================================================================

  describe('getInvoices', () => {
    it('should return invoices for subscription', async () => {
      const mockInvoices = [
        { id: 'inv-1', subscriptionId: 'sub-uuid-123', total: 4900 },
        { id: 'inv-2', subscriptionId: 'sub-uuid-123', total: 4900 },
      ];

      mockPrisma.subscriptionInvoice.findMany.mockResolvedValue(mockInvoices);

      const result = await service.getInvoices('sub-uuid-123');

      expect(result).toHaveLength(2);
      expect(mockPrisma.subscriptionInvoice.findMany).toHaveBeenCalledWith({
        where: { subscriptionId: 'sub-uuid-123' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  // ===========================================================================
  // WEBHOOK SYNC
  // ===========================================================================

  describe('syncSubscriptionStatus', () => {
    it('should update subscription status from Stripe', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription);
      mockPrisma.subscription.update.mockResolvedValue({
        ...mockSubscription,
        status: 'PAST_DUE',
      });

      const stripeSubscription = {
        ...mockStripeSubscription,
        status: 'past_due' as const,
      } as unknown as Stripe.Subscription;

      const result = await service.syncSubscriptionStatus(stripeSubscription);

      expect(result?.status).toBe('PAST_DUE');
      expect(mockPrisma.subscription.update).toHaveBeenCalled();
    });

    it('should return null if subscription not found locally', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const result = await service.syncSubscriptionStatus(
        mockStripeSubscription as unknown as Stripe.Subscription
      );

      expect(result).toBeNull();
    });
  });
});
