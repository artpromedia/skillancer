/**
 * @module @skillancer/billing-svc/services/__tests__/invoices
 * Comprehensive unit tests for InvoiceService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const mockInvoiceRepository = {
  findByUserId: vi.fn(),
  findBySubscriptionId: vi.fn(),
  findById: vi.fn(),
  findByStripeId: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};

const mockSubscriptionRepository = {
  findById: vi.fn(),
  findByStripeId: vi.fn(),
};

vi.mock('../../repositories/index.js', () => ({
  getInvoiceRepository: vi.fn(() => mockInvoiceRepository),
  getSubscriptionRepository: vi.fn(() => mockSubscriptionRepository),
}));

const mockStripeService = {
  getInvoice: vi.fn(),
  updateInvoice: vi.fn(),
  payInvoiceWithOptions: vi.fn(),
  getUpcomingInvoice: vi.fn(),
};

vi.mock('../stripe.service.js', () => ({
  getStripeService: vi.fn(() => mockStripeService),
}));

vi.mock('../../errors/index.js', () => ({
  BillingError: class extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code: string, statusCode: number) {
      super(message);
      this.name = 'BillingError';
      this.code = code;
      this.statusCode = statusCode;
    }
  },
}));

import { InvoiceService } from '../invoice.service.js';

// =============================================================================
// TEST HELPERS
// =============================================================================

function createMockInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-001',
    subscriptionId: 'sub-001',
    stripeInvoiceId: 'in_test123',
    number: 'INV-2025-001',
    status: 'PAID',
    subtotal: 4900,
    tax: 0,
    total: 4900,
    amountDue: 4900,
    amountPaid: 4900,
    amountRemaining: 0,
    currency: 'usd',
    periodStart: new Date('2025-01-01'),
    periodEnd: new Date('2025-02-01'),
    dueDate: null,
    paidAt: new Date('2025-01-01'),
    hostedInvoiceUrl: 'https://invoice.stripe.com/hosted/abc',
    pdfUrl: 'https://invoice.stripe.com/pdf/abc',
    lineItems: [
      { id: 'li-1', description: 'Pro Plan', quantity: 1, unitAmount: 4900, amount: 4900 },
    ],
    attemptCount: 1,
    nextPaymentAttempt: null,
    createdAt: new Date('2025-01-01'),
    ...overrides,
  };
}

// =============================================================================
// TEST SUITE
// =============================================================================

describe('InvoiceService', () => {
  let service: InvoiceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new InvoiceService();
  });

  // ===========================================================================
  // getInvoicesForUser
  // ===========================================================================

  describe('getInvoicesForUser()', () => {
    it('should return paginated invoices for a user', async () => {
      const mockInvoices = [createMockInvoice(), createMockInvoice({ id: 'inv-002' })];

      mockInvoiceRepository.findByUserId.mockResolvedValue({
        invoices: mockInvoices,
        total: 2,
        page: 1,
        limit: 20,
      });

      const result = await service.getInvoicesForUser('user-001');

      expect(result.invoices).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });

    it('should filter by subscription ID', async () => {
      mockInvoiceRepository.findByUserId.mockResolvedValue({
        invoices: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      await service.getInvoicesForUser('user-001', {
        subscriptionId: 'sub-001',
      });

      expect(mockInvoiceRepository.findByUserId).toHaveBeenCalledWith(
        'user-001',
        expect.objectContaining({ subscriptionId: 'sub-001' }),
        expect.anything()
      );
    });

    it('should filter by status', async () => {
      mockInvoiceRepository.findByUserId.mockResolvedValue({
        invoices: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      await service.getInvoicesForUser('user-001', { status: 'PAID' });

      expect(mockInvoiceRepository.findByUserId).toHaveBeenCalledWith(
        'user-001',
        expect.objectContaining({ status: 'PAID' }),
        expect.anything()
      );
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-06-01');

      mockInvoiceRepository.findByUserId.mockResolvedValue({
        invoices: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      await service.getInvoicesForUser('user-001', { startDate, endDate });

      expect(mockInvoiceRepository.findByUserId).toHaveBeenCalledWith(
        'user-001',
        expect.objectContaining({ startDate, endDate }),
        expect.anything()
      );
    });

    it('should support pagination parameters', async () => {
      mockInvoiceRepository.findByUserId.mockResolvedValue({
        invoices: [],
        total: 50,
        page: 3,
        limit: 10,
      });

      const result = await service.getInvoicesForUser('user-001', { page: 3, limit: 10 });

      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
    });

    it('should format dates as ISO strings in response', async () => {
      const invoice = createMockInvoice();
      mockInvoiceRepository.findByUserId.mockResolvedValue({
        invoices: [invoice],
        total: 1,
        page: 1,
        limit: 20,
      });

      const result = await service.getInvoicesForUser('user-001');

      expect(typeof result.invoices[0].periodStart).toBe('string');
      expect(typeof result.invoices[0].periodEnd).toBe('string');
      expect(typeof result.invoices[0].createdAt).toBe('string');
    });
  });

  // ===========================================================================
  // getInvoicesForSubscription
  // ===========================================================================

  describe('getInvoicesForSubscription()', () => {
    it('should return invoices for a valid subscription owned by user', async () => {
      mockSubscriptionRepository.findById.mockResolvedValue({
        id: 'sub-001',
        userId: 'user-001',
      });

      const mockInvoices = [createMockInvoice()];
      mockInvoiceRepository.findBySubscriptionId.mockResolvedValue({
        invoices: mockInvoices,
        total: 1,
        page: 1,
        limit: 20,
      });

      const result = await service.getInvoicesForSubscription('sub-001', 'user-001');

      expect(result.invoices).toHaveLength(1);
    });

    it('should throw when subscription not found', async () => {
      mockSubscriptionRepository.findById.mockResolvedValue(null);

      await expect(
        service.getInvoicesForSubscription('nonexistent', 'user-001')
      ).rejects.toThrow('Subscription not found');
    });

    it('should throw when subscription belongs to different user', async () => {
      mockSubscriptionRepository.findById.mockResolvedValue({
        id: 'sub-001',
        userId: 'user-other',
      });

      await expect(
        service.getInvoicesForSubscription('sub-001', 'user-001')
      ).rejects.toThrow('Unauthorized');
    });
  });

  // ===========================================================================
  // getInvoiceById
  // ===========================================================================

  describe('getInvoiceById()', () => {
    it('should return invoice details for owner', async () => {
      const invoice = createMockInvoice();
      mockInvoiceRepository.findById.mockResolvedValue(invoice);
      mockSubscriptionRepository.findById.mockResolvedValue({
        id: 'sub-001',
        userId: 'user-001',
      });

      const result = await service.getInvoiceById('inv-001', 'user-001');

      expect(result.id).toBe('inv-001');
      expect(result.total).toBe(4900);
      expect(result.lineItems).toHaveLength(1);
    });

    it('should throw when invoice not found', async () => {
      mockInvoiceRepository.findById.mockResolvedValue(null);

      await expect(service.getInvoiceById('nonexistent', 'user-001')).rejects.toThrow(
        'Invoice not found'
      );
    });

    it('should throw when user does not own the invoice subscription', async () => {
      mockInvoiceRepository.findById.mockResolvedValue(createMockInvoice());
      mockSubscriptionRepository.findById.mockResolvedValue({
        id: 'sub-001',
        userId: 'user-other',
      });

      await expect(service.getInvoiceById('inv-001', 'user-001')).rejects.toThrow(
        'Unauthorized'
      );
    });

    it('should handle null dates correctly', async () => {
      const invoice = createMockInvoice({
        dueDate: null,
        paidAt: null,
        nextPaymentAttempt: null,
      });
      mockInvoiceRepository.findById.mockResolvedValue(invoice);
      mockSubscriptionRepository.findById.mockResolvedValue({
        id: 'sub-001',
        userId: 'user-001',
      });

      const result = await service.getInvoiceById('inv-001', 'user-001');

      expect(result.dueDate).toBeNull();
      expect(result.paidAt).toBeNull();
      expect(result.nextPaymentAttempt).toBeNull();
    });
  });

  // ===========================================================================
  // getInvoiceDownloadUrl
  // ===========================================================================

  describe('getInvoiceDownloadUrl()', () => {
    it('should return existing PDF URL if available', async () => {
      const invoice = createMockInvoice({
        pdfUrl: 'https://invoice.stripe.com/pdf/existing',
      });
      mockInvoiceRepository.findById.mockResolvedValue(invoice);
      mockSubscriptionRepository.findById.mockResolvedValue({
        id: 'sub-001',
        userId: 'user-001',
      });

      const url = await service.getInvoiceDownloadUrl('inv-001', 'user-001');

      expect(url).toBe('https://invoice.stripe.com/pdf/existing');
      expect(mockStripeService.getInvoice).not.toHaveBeenCalled();
    });

    it('should fetch fresh PDF URL from Stripe when not cached', async () => {
      const invoice = createMockInvoice({ pdfUrl: null });
      mockInvoiceRepository.findById.mockResolvedValue(invoice);
      mockSubscriptionRepository.findById.mockResolvedValue({
        id: 'sub-001',
        userId: 'user-001',
      });

      mockStripeService.getInvoice.mockResolvedValue({
        invoice_pdf: 'https://invoice.stripe.com/pdf/fresh',
      });

      mockInvoiceRepository.update.mockResolvedValue({});

      const url = await service.getInvoiceDownloadUrl('inv-001', 'user-001');

      expect(url).toBe('https://invoice.stripe.com/pdf/fresh');
      expect(mockInvoiceRepository.update).toHaveBeenCalledWith(
        'inv-001',
        expect.objectContaining({ pdfUrl: 'https://invoice.stripe.com/pdf/fresh' })
      );
    });

    it('should throw when invoice not found', async () => {
      mockInvoiceRepository.findById.mockResolvedValue(null);

      await expect(
        service.getInvoiceDownloadUrl('nonexistent', 'user-001')
      ).rejects.toThrow('Invoice not found');
    });

    it('should throw when PDF is not available from Stripe', async () => {
      const invoice = createMockInvoice({ pdfUrl: null });
      mockInvoiceRepository.findById.mockResolvedValue(invoice);
      mockSubscriptionRepository.findById.mockResolvedValue({
        id: 'sub-001',
        userId: 'user-001',
      });

      mockStripeService.getInvoice.mockResolvedValue({ invoice_pdf: null });

      await expect(
        service.getInvoiceDownloadUrl('inv-001', 'user-001')
      ).rejects.toThrow('PDF not available');
    });

    it('should throw Unauthorized when user does not own the invoice', async () => {
      mockInvoiceRepository.findById.mockResolvedValue(createMockInvoice());
      mockSubscriptionRepository.findById.mockResolvedValue({
        id: 'sub-001',
        userId: 'user-other',
      });

      await expect(
        service.getInvoiceDownloadUrl('inv-001', 'user-001')
      ).rejects.toThrow('Unauthorized');
    });
  });

  // ===========================================================================
  // payInvoice
  // ===========================================================================

  describe('payInvoice()', () => {
    it('should pay an open invoice successfully', async () => {
      const invoice = createMockInvoice({
        status: 'OPEN',
        amountPaid: 0,
        amountRemaining: 4900,
      });
      mockInvoiceRepository.findById.mockResolvedValue(invoice);
      mockSubscriptionRepository.findById.mockResolvedValue({
        id: 'sub-001',
        userId: 'user-001',
      });

      mockStripeService.payInvoiceWithOptions.mockResolvedValue({
        status: 'paid',
        amount_paid: 4900,
        amount_remaining: 0,
        attempt_count: 1,
        payment_intent: null,
      });

      const updatedInvoice = createMockInvoice({ status: 'PAID', amountPaid: 4900 });
      mockInvoiceRepository.update.mockResolvedValue(updatedInvoice);

      const result = await service.payInvoice('inv-001', 'user-001');

      expect(result.invoice.status).toBe('PAID');
      expect(result.paymentIntent).toBeUndefined();
    });

    it('should update payment method on invoice before paying', async () => {
      const invoice = createMockInvoice({ status: 'OPEN' });
      mockInvoiceRepository.findById.mockResolvedValue(invoice);
      mockSubscriptionRepository.findById.mockResolvedValue({
        id: 'sub-001',
        userId: 'user-001',
      });

      mockStripeService.payInvoiceWithOptions.mockResolvedValue({
        status: 'paid',
        amount_paid: 4900,
        amount_remaining: 0,
        attempt_count: 1,
        payment_intent: null,
      });

      mockInvoiceRepository.update.mockResolvedValue(
        createMockInvoice({ status: 'PAID' })
      );

      await service.payInvoice('inv-001', 'user-001', 'pm_new_method');

      expect(mockStripeService.updateInvoice).toHaveBeenCalledWith(
        'in_test123',
        { default_payment_method: 'pm_new_method' }
      );
    });

    it('should return payment intent client secret when 3DS required', async () => {
      const invoice = createMockInvoice({ status: 'OPEN' });
      mockInvoiceRepository.findById.mockResolvedValue(invoice);
      mockSubscriptionRepository.findById.mockResolvedValue({
        id: 'sub-001',
        userId: 'user-001',
      });

      mockStripeService.payInvoiceWithOptions.mockResolvedValue({
        status: 'open',
        amount_paid: 0,
        amount_remaining: 4900,
        attempt_count: 2,
        payment_intent: {
          status: 'requires_action',
          client_secret: 'pi_secret_3ds',
        },
      });

      mockInvoiceRepository.update.mockResolvedValue(
        createMockInvoice({ status: 'OPEN', attemptCount: 2 })
      );

      const result = await service.payInvoice('inv-001', 'user-001');

      expect(result.paymentIntent).toBeDefined();
      expect(result.paymentIntent!.clientSecret).toBe('pi_secret_3ds');
      expect(result.paymentIntent!.status).toBe('requires_action');
    });

    it('should throw when invoice is not in OPEN status', async () => {
      const invoice = createMockInvoice({ status: 'PAID' });
      mockInvoiceRepository.findById.mockResolvedValue(invoice);
      mockSubscriptionRepository.findById.mockResolvedValue({
        id: 'sub-001',
        userId: 'user-001',
      });

      await expect(service.payInvoice('inv-001', 'user-001')).rejects.toThrow(
        'cannot be paid'
      );
    });

    it('should throw when invoice not found', async () => {
      mockInvoiceRepository.findById.mockResolvedValue(null);

      await expect(service.payInvoice('nonexistent', 'user-001')).rejects.toThrow(
        'Invoice not found'
      );
    });

    it('should throw Unauthorized for non-owner', async () => {
      const invoice = createMockInvoice({ status: 'OPEN' });
      mockInvoiceRepository.findById.mockResolvedValue(invoice);
      mockSubscriptionRepository.findById.mockResolvedValue({
        id: 'sub-001',
        userId: 'user-other',
      });

      await expect(service.payInvoice('inv-001', 'user-001')).rejects.toThrow(
        'Unauthorized'
      );
    });
  });

  // ===========================================================================
  // syncFromStripe
  // ===========================================================================

  describe('syncFromStripe()', () => {
    const stripeInvoice = {
      id: 'in_stripe123',
      subscription: 'sub_stripe123',
      status: 'paid',
      number: 'INV-2025-002',
      subtotal: 9900,
      tax: 0,
      total: 9900,
      amount_due: 9900,
      amount_paid: 9900,
      amount_remaining: 0,
      currency: 'usd',
      period_start: 1735689600,
      period_end: 1738368000,
      due_date: null,
      hosted_invoice_url: 'https://invoice.stripe.com/hosted/new',
      invoice_pdf: 'https://invoice.stripe.com/pdf/new',
      attempt_count: 1,
      next_payment_attempt: null,
      status_transitions: { paid_at: 1735689600 },
      lines: {
        data: [
          {
            id: 'li_stripe1',
            description: 'Enterprise Plan',
            quantity: 1,
            unit_amount_excluding_tax: '9900',
            amount: 9900,
          },
        ],
      },
    };

    it('should create new invoice from Stripe event', async () => {
      mockSubscriptionRepository.findByStripeId.mockResolvedValue({
        id: 'sub-local-001',
      });
      mockInvoiceRepository.findByStripeId.mockResolvedValue(null);
      mockInvoiceRepository.create.mockResolvedValue({});

      await service.syncFromStripe(stripeInvoice as any);

      expect(mockInvoiceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionId: 'sub-local-001',
          stripeInvoiceId: 'in_stripe123',
          status: 'PAID',
          total: 9900,
        })
      );
    });

    it('should update existing invoice from Stripe event', async () => {
      mockSubscriptionRepository.findByStripeId.mockResolvedValue({
        id: 'sub-local-001',
      });
      mockInvoiceRepository.findByStripeId.mockResolvedValue({
        id: 'inv-existing',
      });
      mockInvoiceRepository.update.mockResolvedValue({});

      await service.syncFromStripe(stripeInvoice as any);

      expect(mockInvoiceRepository.update).toHaveBeenCalledWith(
        'inv-existing',
        expect.objectContaining({
          status: 'PAID',
          total: 9900,
        })
      );
    });

    it('should skip non-subscription invoices', async () => {
      await service.syncFromStripe({
        ...stripeInvoice,
        subscription: null,
      } as any);

      expect(mockSubscriptionRepository.findByStripeId).not.toHaveBeenCalled();
    });

    it('should skip when local subscription not found', async () => {
      mockSubscriptionRepository.findByStripeId.mockResolvedValue(null);

      await service.syncFromStripe(stripeInvoice as any);

      expect(mockInvoiceRepository.create).not.toHaveBeenCalled();
      expect(mockInvoiceRepository.update).not.toHaveBeenCalled();
    });

    it('should handle subscription ID as object', async () => {
      mockSubscriptionRepository.findByStripeId.mockResolvedValue({
        id: 'sub-local-001',
      });
      mockInvoiceRepository.findByStripeId.mockResolvedValue(null);
      mockInvoiceRepository.create.mockResolvedValue({});

      await service.syncFromStripe({
        ...stripeInvoice,
        subscription: { id: 'sub_object123' },
      } as any);

      expect(mockSubscriptionRepository.findByStripeId).toHaveBeenCalledWith('sub_object123');
    });

    it('should extract line items from Stripe invoice', async () => {
      mockSubscriptionRepository.findByStripeId.mockResolvedValue({
        id: 'sub-local-001',
      });
      mockInvoiceRepository.findByStripeId.mockResolvedValue(null);
      mockInvoiceRepository.create.mockResolvedValue({});

      await service.syncFromStripe(stripeInvoice as any);

      expect(mockInvoiceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          lineItems: expect.arrayContaining([
            expect.objectContaining({
              id: 'li_stripe1',
              description: 'Enterprise Plan',
              quantity: 1,
            }),
          ]),
        })
      );
    });

    it('should map Stripe invoice statuses correctly', async () => {
      mockSubscriptionRepository.findByStripeId.mockResolvedValue({ id: 'sub-001' });
      mockInvoiceRepository.findByStripeId.mockResolvedValue(null);
      mockInvoiceRepository.create.mockResolvedValue({});

      const testCases = [
        { stripeStatus: 'draft', expectedStatus: 'DRAFT' },
        { stripeStatus: 'open', expectedStatus: 'OPEN' },
        { stripeStatus: 'paid', expectedStatus: 'PAID' },
        { stripeStatus: 'void', expectedStatus: 'VOID' },
        { stripeStatus: 'uncollectible', expectedStatus: 'UNCOLLECTIBLE' },
      ];

      for (const { stripeStatus, expectedStatus } of testCases) {
        vi.clearAllMocks();
        mockSubscriptionRepository.findByStripeId.mockResolvedValue({ id: 'sub-001' });
        mockInvoiceRepository.findByStripeId.mockResolvedValue(null);
        mockInvoiceRepository.create.mockResolvedValue({});

        await service.syncFromStripe({
          ...stripeInvoice,
          status: stripeStatus,
        } as any);

        expect(mockInvoiceRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            status: expectedStatus,
          })
        );
      }
    });
  });

  // ===========================================================================
  // getUpcomingInvoice
  // ===========================================================================

  describe('getUpcomingInvoice()', () => {
    it('should return upcoming invoice preview', async () => {
      mockSubscriptionRepository.findById.mockResolvedValue({
        id: 'sub-001',
        userId: 'user-001',
        stripeCustomerId: 'cus_test123',
        stripeSubscriptionId: 'sub_stripe123',
      });

      mockStripeService.getUpcomingInvoice.mockResolvedValue({
        subtotal: 4900,
        tax: 0,
        total: 4900,
        amount_due: 4900,
        currency: 'usd',
        period_start: 1738368000,
        period_end: 1740960000,
        lines: { data: [] },
      });

      const result = await service.getUpcomingInvoice('sub-001', 'user-001');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('upcoming');
      expect(result!.status).toBe('DRAFT');
      expect(result!.total).toBe(4900);
    });

    it('should return null when no upcoming invoice', async () => {
      mockSubscriptionRepository.findById.mockResolvedValue({
        id: 'sub-001',
        userId: 'user-001',
        stripeCustomerId: 'cus_test123',
        stripeSubscriptionId: 'sub_stripe123',
      });

      mockStripeService.getUpcomingInvoice.mockRejectedValue(new Error('No upcoming invoice'));

      const result = await service.getUpcomingInvoice('sub-001', 'user-001');

      expect(result).toBeNull();
    });

    it('should throw when subscription not found', async () => {
      mockSubscriptionRepository.findById.mockResolvedValue(null);

      await expect(
        service.getUpcomingInvoice('nonexistent', 'user-001')
      ).rejects.toThrow('Subscription not found');
    });

    it('should throw Unauthorized for non-owner', async () => {
      mockSubscriptionRepository.findById.mockResolvedValue({
        id: 'sub-001',
        userId: 'user-other',
      });

      await expect(
        service.getUpcomingInvoice('sub-001', 'user-001')
      ).rejects.toThrow('Unauthorized');
    });
  });

  // ===========================================================================
  // getUserInvoiceStats
  // ===========================================================================

  describe('getUserInvoiceStats()', () => {
    it('should return default stats (stub implementation)', () => {
      const stats = service.getUserInvoiceStats('user-001');

      expect(stats).toEqual({
        totalPaid: 0,
        invoiceCount: 0,
        pendingAmount: 0,
      });
    });
  });
});
