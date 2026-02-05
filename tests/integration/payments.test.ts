/**
 * Integration Tests: Payment Flows
 *
 * Tests payment method management, escrow funding/release, and refund processing.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupIntegrationTests, cleanupIntegrationTests, type TestContext } from './setup';

describe('Payments Integration', () => {
  let ctx: TestContext;
  let testContractId: string;

  beforeAll(() => {
    ctx = setupIntegrationTests();
  });

  afterAll(() => {
    cleanupIntegrationTests();
  });

  beforeEach(async () => {
    // Create a job and contract for payment tests
    const jobResponse = await ctx.request('POST', '/api/jobs', {
      user: ctx.users.client,
      body: {
        title: 'Payment Test Job',
        description: 'Job for payment integration tests.',
        budget: 10000,
      },
    });

    const jobId = (jobResponse.body as any).data.id;

    const contractResponse = await ctx.request('POST', '/api/contracts', {
      user: ctx.users.client,
      body: {
        jobId,
        freelancerId: ctx.users.freelancer.id,
        amount: 10000,
      },
    });

    testContractId = (contractResponse.body as any).data.id;
  });

  // ===========================================================================
  // Payment Method Management
  // ===========================================================================

  describe('Payment Method Management', () => {
    it('should add a payment method', async () => {
      const response = await ctx.request('POST', '/api/payments/methods', {
        user: ctx.users.client,
        body: {
          stripePaymentMethodId: 'pm_test_visa_4242',
        },
      });

      expect(response.status).toBe(201);
      const data = (response.body as any).data;
      expect(data.id).toBeDefined();
      expect(data.type).toBe('CARD');
      expect(data.cardLast4).toBe('4242');
      expect(data.status).toBe('ACTIVE');
    });

    it('should set first payment method as default', async () => {
      const response = await ctx.request('POST', '/api/payments/methods', {
        user: ctx.users.client,
        body: {
          stripePaymentMethodId: 'pm_test_first_default',
        },
      });

      expect(response.status).toBe(201);
      // First payment method should be default
      expect((response.body as any).data.isDefault).toBe(true);
    });

    it('should list user payment methods', async () => {
      // Add a payment method first
      await ctx.request('POST', '/api/payments/methods', {
        user: ctx.users.client,
        body: { stripePaymentMethodId: 'pm_test_list_1' },
      });

      const response = await ctx.request('GET', '/api/payments/methods', {
        user: ctx.users.client,
      });

      expect(response.status).toBe(200);
      expect(Array.isArray((response.body as any).data)).toBe(true);
      expect((response.body as any).data.length).toBeGreaterThanOrEqual(1);
    });

    it('should remove a payment method', async () => {
      const addResponse = await ctx.request('POST', '/api/payments/methods', {
        user: ctx.users.client,
        body: { stripePaymentMethodId: 'pm_test_remove' },
      });

      const methodId = (addResponse.body as any).data.id;

      const removeResponse = await ctx.request('DELETE', `/api/payments/methods/${methodId}`, {
        user: ctx.users.client,
      });

      expect(removeResponse.status).toBe(200);
    });

    it('should not allow removing another user payment method', async () => {
      const addResponse = await ctx.request('POST', '/api/payments/methods', {
        user: ctx.users.client,
        body: { stripePaymentMethodId: 'pm_test_no_steal' },
      });

      const methodId = (addResponse.body as any).data.id;

      const removeResponse = await ctx.request('DELETE', `/api/payments/methods/${methodId}`, {
        user: ctx.users.freelancer,
      });

      expect(removeResponse.status).toBe(403);
    });

    it('should reject adding payment method without Stripe ID', async () => {
      const response = await ctx.request('POST', '/api/payments/methods', {
        user: ctx.users.client,
        body: {},
      });

      expect(response.status).toBe(400);
    });

    it('should return 404 when removing non-existent payment method', async () => {
      const response = await ctx.request('DELETE', '/api/payments/methods/nonexistent-pm-id', {
        user: ctx.users.client,
      });

      expect(response.status).toBe(404);
    });
  });

  // ===========================================================================
  // Escrow Funding
  // ===========================================================================

  describe('Escrow Funding', () => {
    it('should fund escrow for a contract', async () => {
      const response = await ctx.request('POST', '/api/payments/escrow/fund', {
        user: ctx.users.client,
        body: {
          contractId: testContractId,
          amount: 5000,
          paymentMethodId: 'pm_test_fund',
        },
      });

      expect(response.status).toBe(201);
      const data = (response.body as any).data;
      expect(data.id).toBeDefined();
      expect(data.contractId).toBe(testContractId);
      expect(data.amount).toBe(5000);
      expect(data.status).toBe('FUNDED');
    });

    it('should reject escrow funding without contract ID', async () => {
      const response = await ctx.request('POST', '/api/payments/escrow/fund', {
        user: ctx.users.client,
        body: {
          amount: 5000,
        },
      });

      expect(response.status).toBe(400);
    });

    it('should reject escrow funding without amount', async () => {
      const response = await ctx.request('POST', '/api/payments/escrow/fund', {
        user: ctx.users.client,
        body: {
          contractId: testContractId,
        },
      });

      expect(response.status).toBe(400);
    });

    it('should reject escrow funding without authentication', async () => {
      const response = await ctx.request('POST', '/api/payments/escrow/fund', {
        body: {
          contractId: testContractId,
          amount: 5000,
        },
      });

      expect(response.status).toBe(401);
    });
  });

  // ===========================================================================
  // Escrow Release
  // ===========================================================================

  describe('Escrow Release', () => {
    let escrowId: string;

    beforeEach(async () => {
      const fundResponse = await ctx.request('POST', '/api/payments/escrow/fund', {
        user: ctx.users.client,
        body: {
          contractId: testContractId,
          amount: 5000,
        },
      });
      escrowId = (fundResponse.body as any).data.id;
    });

    it('should release escrow funds', async () => {
      const response = await ctx.request('POST', '/api/payments/escrow/release', {
        user: ctx.users.client,
        body: {
          escrowId,
        },
      });

      expect(response.status).toBe(200);
      expect((response.body as any).data.status).toBe('RELEASED');
    });

    it('should reject release of non-existent escrow', async () => {
      const response = await ctx.request('POST', '/api/payments/escrow/release', {
        user: ctx.users.client,
        body: {
          escrowId: 'nonexistent-escrow-id',
        },
      });

      expect(response.status).toBe(404);
    });

    it('should reject release without escrow ID', async () => {
      const response = await ctx.request('POST', '/api/payments/escrow/release', {
        user: ctx.users.client,
        body: {},
      });

      expect(response.status).toBe(400);
    });

    it('should not allow freelancer to release escrow', async () => {
      const response = await ctx.request('POST', '/api/payments/escrow/release', {
        user: ctx.users.freelancer,
        body: {
          escrowId,
        },
      });

      expect(response.status).toBe(403);
    });
  });

  // ===========================================================================
  // Refund Processing
  // ===========================================================================

  describe('Refund Processing', () => {
    it('should process a full refund', async () => {
      const response = await ctx.request('POST', '/api/payments/refund', {
        user: ctx.users.client,
        body: {
          paymentId: 'pay_test_refund',
          reason: 'requested_by_customer',
        },
      });

      expect(response.status).toBe(200);
      const data = (response.body as any).data;
      expect(data.id).toBeDefined();
      expect(data.status).toBe('SUCCEEDED');
    });

    it('should process a partial refund', async () => {
      const response = await ctx.request('POST', '/api/payments/refund', {
        user: ctx.users.client,
        body: {
          paymentId: 'pay_test_partial_refund',
          amount: 2500,
          reason: 'requested_by_customer',
        },
      });

      expect(response.status).toBe(200);
      expect((response.body as any).data.amount).toBe(2500);
    });

    it('should reject refund without payment ID', async () => {
      const response = await ctx.request('POST', '/api/payments/refund', {
        user: ctx.users.client,
        body: {
          amount: 1000,
        },
      });

      expect(response.status).toBe(400);
    });

    it('should reject refund without authentication', async () => {
      const response = await ctx.request('POST', '/api/payments/refund', {
        body: {
          paymentId: 'pay_test_unauth',
        },
      });

      expect(response.status).toBe(401);
    });
  });
});
