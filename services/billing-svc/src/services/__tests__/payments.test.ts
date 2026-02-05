/**
 * @module @skillancer/billing-svc/services/__tests__/payments
 * Comprehensive unit tests for PaymentOrchestrator and payment flows
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const mockPrisma = {
  payment: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  refund: {
    create: vi.fn(),
    aggregate: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
};

vi.mock('@skillancer/database', () => ({
  prisma: mockPrisma,
}));

const mockStripePaymentIntentsCreate = vi.fn();
const mockStripePaymentIntentsConfirm = vi.fn();
const mockStripePaymentIntentsCancel = vi.fn();
const mockStripeRefundsCreate = vi.fn();

vi.mock('../stripe.service.js', () => ({
  getStripe: vi.fn(() => ({
    paymentIntents: {
      create: mockStripePaymentIntentsCreate,
      confirm: mockStripePaymentIntentsConfirm,
      cancel: mockStripePaymentIntentsCancel,
    },
    refunds: {
      create: mockStripeRefundsCreate,
    },
  })),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  PaymentOrchestrator,
  PaymentValidationError,
  PaymentNotFoundError,
  InvalidStateTransitionError,
} from '../payment-orchestrator.js';
import type { PaymentRequest, RefundRequest } from '../payment-orchestrator.js';

// =============================================================================
// TEST SUITE
// =============================================================================

describe('PaymentOrchestrator', () => {
  let orchestrator: PaymentOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    orchestrator = new PaymentOrchestrator();
  });

  // ===========================================================================
  // createPayment
  // ===========================================================================

  describe('createPayment()', () => {
    const validRequest: PaymentRequest = {
      amount: 5000,
      currency: 'usd',
      customerId: 'cus_test123',
      paymentMethodId: 'pm_test123',
      description: 'Test payment',
      metadata: { orderId: 'order-001' },
    };

    it('should create a payment successfully with immediate confirmation', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null); // No existing payment
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-001',
        status: 'PENDING',
        amount: 5000,
        currency: 'USD',
      });
      mockPrisma.payment.update.mockResolvedValue({ id: 'pay-001', status: 'SUCCEEDED' });
      mockPrisma.auditLog.create.mockResolvedValue({});

      mockStripePaymentIntentsCreate.mockResolvedValue({
        id: 'pi_test123',
        status: 'succeeded',
        client_secret: 'pi_test123_secret',
        next_action: null,
      });

      const result = await orchestrator.createPayment(validRequest);

      expect(result.success).toBe(true);
      expect(result.paymentId).toBe('pay-001');
      expect(result.stripePaymentIntentId).toBe('pi_test123');
      expect(result.status).toBe('SUCCEEDED');
      expect(result.requiresAction).toBe(false);
    });

    it('should return existing payment for duplicate idempotency key', async () => {
      const existingPayment = {
        id: 'pay-existing',
        status: 'SUCCEEDED',
        stripePaymentIntentId: 'pi_existing',
        idempotencyKey: 'idem-key-001',
      };
      mockPrisma.payment.findFirst.mockResolvedValue(existingPayment);

      const result = await orchestrator.createPayment({
        ...validRequest,
        idempotencyKey: 'idem-key-001',
      });

      expect(result.paymentId).toBe('pay-existing');
      expect(mockStripePaymentIntentsCreate).not.toHaveBeenCalled();
    });

    it('should handle payment requiring 3D Secure action', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-3ds',
        status: 'PENDING',
        amount: 5000,
      });
      mockPrisma.payment.update.mockResolvedValue({ id: 'pay-3ds', status: 'REQUIRES_ACTION' });
      mockPrisma.auditLog.create.mockResolvedValue({});

      mockStripePaymentIntentsCreate.mockResolvedValue({
        id: 'pi_3ds',
        status: 'requires_action',
        client_secret: 'pi_3ds_secret',
        next_action: {
          redirect_to_url: { url: 'https://stripe.com/3ds' },
        },
      });

      const result = await orchestrator.createPayment(validRequest);

      expect(result.success).toBe(false);
      expect(result.requiresAction).toBe(true);
      expect(result.status).toBe('REQUIRES_ACTION');
      expect(result.actionUrl).toBe('https://stripe.com/3ds');
      expect(result.clientSecret).toBe('pi_3ds_secret');
    });

    it('should validate amount must be positive', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-invalid',
        status: 'PENDING',
      });
      mockPrisma.payment.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await orchestrator.createPayment({ ...validRequest, amount: 0 });

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
    });

    it('should validate amount does not exceed maximum', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-max',
        status: 'PENDING',
      });
      mockPrisma.payment.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await orchestrator.createPayment({
        ...validRequest,
        amount: 100000000,
      });

      expect(result.success).toBe(false);
    });

    it('should validate customer ID is required', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-nocust',
        status: 'PENDING',
      });
      mockPrisma.payment.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await orchestrator.createPayment({
        ...validRequest,
        customerId: '',
      });

      expect(result.success).toBe(false);
    });

    it('should reject unsupported currencies', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-curr',
        status: 'PENDING',
      });
      mockPrisma.payment.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await orchestrator.createPayment({
        ...validRequest,
        currency: 'xyz',
      });

      expect(result.success).toBe(false);
    });

    it('should handle Stripe API failure', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-fail',
        status: 'PENDING',
      });
      mockPrisma.payment.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const stripeError = new Error('Card declined');
      (stripeError as any).code = 'card_declined';
      mockStripePaymentIntentsCreate.mockRejectedValue(stripeError);

      const result = await orchestrator.createPayment(validRequest);

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.error).toBe('Card declined');
      expect(result.errorCode).toBe('card_declined');
    });

    it('should enable automatic payment methods when no payment method specified', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-auto',
        status: 'PENDING',
      });
      mockPrisma.payment.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      mockStripePaymentIntentsCreate.mockResolvedValue({
        id: 'pi_auto',
        status: 'requires_payment_method',
        client_secret: 'pi_auto_secret',
        next_action: null,
      });

      const result = await orchestrator.createPayment({
        ...validRequest,
        paymentMethodId: undefined,
      });

      expect(mockStripePaymentIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          automatic_payment_methods: { enabled: true },
        }),
        expect.anything()
      );
      expect(result.error).toBe('Payment method required');
    });

    it('should use manual capture method when specified', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-manual',
        status: 'PENDING',
      });
      mockPrisma.payment.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      mockStripePaymentIntentsCreate.mockResolvedValue({
        id: 'pi_manual',
        status: 'requires_capture',
        client_secret: null,
        next_action: null,
      });

      await orchestrator.createPayment({
        ...validRequest,
        captureMethod: 'manual',
      });

      expect(mockStripePaymentIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          capture_method: 'manual',
        }),
        expect.anything()
      );
    });

    it('should set metadata with paymentId and idempotencyKey', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-meta',
        status: 'PENDING',
      });
      mockPrisma.payment.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      mockStripePaymentIntentsCreate.mockResolvedValue({
        id: 'pi_meta',
        status: 'succeeded',
        client_secret: null,
        next_action: null,
      });

      await orchestrator.createPayment(validRequest);

      expect(mockStripePaymentIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            paymentId: 'pay-meta',
          }),
        }),
        expect.anything()
      );
    });
  });

  // ===========================================================================
  // confirmPayment
  // ===========================================================================

  describe('confirmPayment()', () => {
    it('should confirm a payment requiring action', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-001',
        stripePaymentIntentId: 'pi_test123',
        status: 'REQUIRES_ACTION',
        paymentMethod: 'pm_test123',
      });

      mockStripePaymentIntentsConfirm.mockResolvedValue({
        id: 'pi_test123',
        status: 'succeeded',
        next_action: null,
      });

      mockPrisma.payment.update.mockResolvedValue({
        id: 'pay-001',
        status: 'SUCCEEDED',
      });

      const result = await orchestrator.confirmPayment('pay-001');

      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCEEDED');
    });

    it('should throw PaymentNotFoundError when payment does not exist', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(orchestrator.confirmPayment('nonexistent')).rejects.toThrow(
        PaymentNotFoundError
      );
    });

    it('should throw when payment has no associated PaymentIntent', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-002',
        stripePaymentIntentId: null,
        status: 'REQUIRES_ACTION',
      });

      await expect(orchestrator.confirmPayment('pay-002')).rejects.toThrow(
        'no associated PaymentIntent'
      );
    });

    it('should pass payment method ID when provided', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-003',
        stripePaymentIntentId: 'pi_test456',
        status: 'REQUIRES_ACTION',
        paymentMethod: null,
      });

      mockStripePaymentIntentsConfirm.mockResolvedValue({
        id: 'pi_test456',
        status: 'succeeded',
        next_action: null,
      });

      mockPrisma.payment.update.mockResolvedValue({});

      await orchestrator.confirmPayment('pay-003', 'pm_new_method');

      expect(mockStripePaymentIntentsConfirm).toHaveBeenCalledWith('pi_test456', {
        payment_method: 'pm_new_method',
      });
    });

    it('should handle confirmation failure and mark payment as FAILED', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-004',
        stripePaymentIntentId: 'pi_test789',
        status: 'REQUIRES_ACTION',
      });

      mockStripePaymentIntentsConfirm.mockRejectedValue(new Error('Authentication failed'));
      mockPrisma.payment.update.mockResolvedValue({});

      await expect(orchestrator.confirmPayment('pay-004')).rejects.toThrow(
        'Authentication failed'
      );

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
          }),
        })
      );
    });
  });

  // ===========================================================================
  // cancelPayment
  // ===========================================================================

  describe('cancelPayment()', () => {
    it('should cancel a pending payment', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-001',
        status: 'PENDING',
        stripePaymentIntentId: 'pi_test123',
      });

      mockStripePaymentIntentsCancel.mockResolvedValue({
        id: 'pi_test123',
        status: 'canceled',
      });

      mockPrisma.payment.update.mockResolvedValue({});

      await orchestrator.cancelPayment('pay-001', 'duplicate');

      expect(mockStripePaymentIntentsCancel).toHaveBeenCalledWith('pi_test123', {
        cancellation_reason: 'duplicate',
      });

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'CANCELED',
          }),
        })
      );
    });

    it('should throw PaymentNotFoundError when payment does not exist', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(orchestrator.cancelPayment('nonexistent')).rejects.toThrow(
        PaymentNotFoundError
      );
    });

    it('should throw InvalidStateTransitionError for succeeded payment', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-002',
        status: 'SUCCEEDED',
      });

      await expect(orchestrator.cancelPayment('pay-002')).rejects.toThrow(
        InvalidStateTransitionError
      );
    });

    it('should cancel payment without Stripe call if no PaymentIntent', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-003',
        status: 'PENDING',
        stripePaymentIntentId: null,
      });
      mockPrisma.payment.update.mockResolvedValue({});

      await orchestrator.cancelPayment('pay-003');

      expect(mockStripePaymentIntentsCancel).not.toHaveBeenCalled();
      expect(mockPrisma.payment.update).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // refundPayment
  // ===========================================================================

  describe('refundPayment()', () => {
    it('should process a full refund', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-001',
        status: 'SUCCEEDED',
        amount: 5000,
        currency: 'USD',
        stripePaymentIntentId: 'pi_test123',
      });

      mockStripeRefundsCreate.mockResolvedValue({
        id: 're_test123',
        status: 'succeeded',
      });

      mockPrisma.refund.create.mockResolvedValue({
        id: 'ref-001',
        stripeRefundId: 're_test123',
        amount: 5000,
        status: 'SUCCEEDED',
      });

      mockPrisma.refund.aggregate.mockResolvedValue({
        _sum: { amount: 5000 },
      });

      mockPrisma.payment.update.mockResolvedValue({});

      const request: RefundRequest = {
        paymentId: 'pay-001',
        reason: 'requested_by_customer',
      };

      const result = await orchestrator.refundPayment(request);

      expect(result.success).toBe(true);
      expect(result.amount).toBe(5000);
      expect(result.stripeRefundId).toBe('re_test123');
    });

    it('should process a partial refund', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-002',
        status: 'SUCCEEDED',
        amount: 5000,
        currency: 'USD',
        stripePaymentIntentId: 'pi_test456',
      });

      mockStripeRefundsCreate.mockResolvedValue({
        id: 're_partial',
        status: 'succeeded',
      });

      mockPrisma.refund.create.mockResolvedValue({
        id: 'ref-002',
        amount: 2000,
      });

      mockPrisma.refund.aggregate.mockResolvedValue({
        _sum: { amount: 2000 },
      });

      mockPrisma.payment.update.mockResolvedValue({});

      const request: RefundRequest = {
        paymentId: 'pay-002',
        amount: 2000,
      };

      const result = await orchestrator.refundPayment(request);

      expect(result.success).toBe(true);
      expect(result.amount).toBe(2000);
    });

    it('should mark payment as PARTIALLY_REFUNDED for partial refund', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-003',
        status: 'SUCCEEDED',
        amount: 5000,
        currency: 'USD',
        stripePaymentIntentId: 'pi_test789',
      });

      mockStripeRefundsCreate.mockResolvedValue({
        id: 're_partial2',
        status: 'succeeded',
      });

      mockPrisma.refund.create.mockResolvedValue({ id: 'ref-003' });
      mockPrisma.refund.aggregate.mockResolvedValue({
        _sum: { amount: 2000 },
      });
      mockPrisma.payment.update.mockResolvedValue({});

      await orchestrator.refundPayment({ paymentId: 'pay-003', amount: 2000 });

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PARTIALLY_REFUNDED',
          }),
        })
      );
    });

    it('should throw PaymentNotFoundError for non-existent payment', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(
        orchestrator.refundPayment({ paymentId: 'nonexistent' })
      ).rejects.toThrow(PaymentNotFoundError);
    });

    it('should throw for payment not in refundable status', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-004',
        status: 'PENDING',
        amount: 5000,
      });

      await expect(
        orchestrator.refundPayment({ paymentId: 'pay-004' })
      ).rejects.toThrow('Cannot refund payment');
    });

    it('should throw when payment has no PaymentIntent', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-005',
        status: 'SUCCEEDED',
        amount: 5000,
        stripePaymentIntentId: null,
      });

      await expect(
        orchestrator.refundPayment({ paymentId: 'pay-005' })
      ).rejects.toThrow('no associated PaymentIntent');
    });

    it('should handle Stripe refund failure gracefully', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-006',
        status: 'SUCCEEDED',
        amount: 5000,
        currency: 'USD',
        stripePaymentIntentId: 'pi_fail',
      });

      mockStripeRefundsCreate.mockRejectedValue(new Error('Refund failed'));

      const result = await orchestrator.refundPayment({ paymentId: 'pay-006' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Refund failed');
    });

    it('should allow refund of a PARTIALLY_REFUNDED payment', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-007',
        status: 'PARTIALLY_REFUNDED',
        amount: 5000,
        currency: 'USD',
        stripePaymentIntentId: 'pi_partial_prev',
      });

      mockStripeRefundsCreate.mockResolvedValue({
        id: 're_remaining',
        status: 'succeeded',
      });

      mockPrisma.refund.create.mockResolvedValue({ id: 'ref-007' });
      mockPrisma.refund.aggregate.mockResolvedValue({
        _sum: { amount: 5000 },
      });
      mockPrisma.payment.update.mockResolvedValue({});

      const result = await orchestrator.refundPayment({
        paymentId: 'pay-007',
        amount: 3000,
      });

      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // getPaymentStatus
  // ===========================================================================

  describe('getPaymentStatus()', () => {
    it('should return payment status and details', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-001',
        status: 'SUCCEEDED',
        amount: 5000,
        currency: 'USD',
        stripePaymentIntentId: 'pi_test123',
        paidAt: new Date('2025-01-01'),
        failureCode: null,
        failureMessage: null,
        refunds: [],
        refundedAmount: 0,
      });

      const result = await orchestrator.getPaymentStatus('pay-001');

      expect(result.status).toBe('SUCCEEDED');
      expect(result.details.amount).toBe(5000);
      expect(result.details.currency).toBe('USD');
    });

    it('should throw PaymentNotFoundError for non-existent payment', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(orchestrator.getPaymentStatus('nonexistent')).rejects.toThrow(
        PaymentNotFoundError
      );
    });

    it('should include refund history in details', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-002',
        status: 'PARTIALLY_REFUNDED',
        amount: 5000,
        currency: 'USD',
        stripePaymentIntentId: 'pi_test456',
        paidAt: new Date(),
        failureCode: null,
        failureMessage: null,
        refunds: [{ id: 'ref-001', amount: 2000, status: 'SUCCEEDED' }],
        refundedAmount: 2000,
      });

      const result = await orchestrator.getPaymentStatus('pay-002');

      expect(result.details.refunds).toHaveLength(1);
      expect(result.details.refundedAmount).toBe(2000);
    });
  });

  // ===========================================================================
  // handlePaymentTimeout
  // ===========================================================================

  describe('handlePaymentTimeout()', () => {
    it('should abandon a pending payment on timeout', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-001',
        status: 'PENDING',
        stripePaymentIntentId: 'pi_test123',
      });

      mockStripePaymentIntentsCancel.mockResolvedValue({});
      mockPrisma.payment.update.mockResolvedValue({});

      await orchestrator.handlePaymentTimeout('pay-001');

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ABANDONED',
            abandonedReason: 'timeout',
          }),
        })
      );
    });

    it('should abandon a processing payment on timeout', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-002',
        status: 'PROCESSING',
        stripePaymentIntentId: 'pi_test456',
      });

      mockStripePaymentIntentsCancel.mockResolvedValue({});
      mockPrisma.payment.update.mockResolvedValue({});

      await orchestrator.handlePaymentTimeout('pay-002');

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ABANDONED' }),
        })
      );
    });

    it('should not timeout a succeeded payment', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-003',
        status: 'SUCCEEDED',
      });

      await orchestrator.handlePaymentTimeout('pay-003');

      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
    });

    it('should handle non-existent payment gracefully', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(orchestrator.handlePaymentTimeout('nonexistent')).resolves.toBeUndefined();
    });

    it('should ignore Stripe cancellation errors for already terminal payments', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-004',
        status: 'REQUIRES_ACTION',
        stripePaymentIntentId: 'pi_already_cancelled',
      });

      mockStripePaymentIntentsCancel.mockRejectedValue(new Error('Already canceled'));
      mockPrisma.payment.update.mockResolvedValue({});

      await expect(orchestrator.handlePaymentTimeout('pay-004')).resolves.toBeUndefined();
      expect(mockPrisma.payment.update).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Fee Calculation via PaymentOrchestrator (integration)
  // ===========================================================================

  describe('payment state transitions', () => {
    it('should track state transition in audit log during creation', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-audit',
        status: 'PENDING',
      });
      mockPrisma.payment.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      mockStripePaymentIntentsCreate.mockResolvedValue({
        id: 'pi_audit',
        status: 'succeeded',
        client_secret: null,
        next_action: null,
      });

      await orchestrator.createPayment({
        amount: 1000,
        currency: 'usd',
        customerId: 'cus_audit',
        paymentMethodId: 'pm_audit',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PAYMENT_STATE_TRANSITION',
            resourceType: 'payment',
            details: { from: 'PENDING', to: 'PROCESSING' },
          }),
        })
      );
    });
  });
});
