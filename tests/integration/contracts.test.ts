/**
 * Integration Tests: Contract Flows
 *
 * Tests contract creation, milestone management, and completion.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupIntegrationTests, cleanupIntegrationTests, type TestContext } from './setup';

describe('Contracts Integration', () => {
  let ctx: TestContext;
  let testJobId: string;

  beforeAll(() => {
    ctx = setupIntegrationTests();
  });

  afterAll(() => {
    cleanupIntegrationTests();
  });

  beforeEach(async () => {
    const jobResponse = await ctx.request('POST', '/api/jobs', {
      user: ctx.users.client,
      body: {
        title: 'Contract Test Job',
        description: 'Job for contract integration tests.',
        budget: 20000,
        budgetType: 'FIXED',
      },
    });
    testJobId = (jobResponse.body as any).data.id;
  });

  // ===========================================================================
  // Contract Creation
  // ===========================================================================

  describe('Contract Creation', () => {
    it('should create a contract directly', async () => {
      const response = await ctx.request('POST', '/api/contracts', {
        user: ctx.users.client,
        body: {
          jobId: testJobId,
          freelancerId: ctx.users.freelancer.id,
          amount: 15000,
        },
      });

      expect(response.status).toBe(201);
      const data = (response.body as any).data;
      expect(data.id).toBeDefined();
      expect(data.jobId).toBe(testJobId);
      expect(data.freelancerId).toBe(ctx.users.freelancer.id);
      expect(data.amount).toBe(15000);
      expect(data.status).toBe('ACTIVE');
    });

    it('should create contract from accepted proposal', async () => {
      // Submit and accept proposal
      const proposalResponse = await ctx.request('POST', '/api/proposals', {
        user: ctx.users.freelancer,
        body: {
          jobId: testJobId,
          coverLetter: 'Contract from proposal test.',
          bidAmount: 18000,
        },
      });

      const proposalId = (proposalResponse.body as any).data.id;

      const acceptResponse = await ctx.request('POST', `/api/proposals/${proposalId}/accept`, {
        user: ctx.users.client,
      });

      expect(acceptResponse.status).toBe(200);
      const contract = (acceptResponse.body as any).data.contract;
      expect(contract).toBeDefined();
      expect(contract.status).toBe('ACTIVE');
      expect(contract.freelancerId).toBe(ctx.users.freelancer.id);
      expect(contract.clientId).toBe(ctx.users.client.id);
    });

    it('should reject contract without required fields', async () => {
      const response = await ctx.request('POST', '/api/contracts', {
        user: ctx.users.client,
        body: {
          jobId: testJobId,
          // Missing freelancerId and amount
        },
      });

      expect(response.status).toBe(400);
    });

    it('should reject contract creation without authentication', async () => {
      const response = await ctx.request('POST', '/api/contracts', {
        body: {
          jobId: testJobId,
          freelancerId: ctx.users.freelancer.id,
          amount: 10000,
        },
      });

      expect(response.status).toBe(401);
    });
  });

  // ===========================================================================
  // Milestone Management
  // ===========================================================================

  describe('Milestone Creation and Management', () => {
    let contractId: string;

    beforeEach(async () => {
      const contractResponse = await ctx.request('POST', '/api/contracts', {
        user: ctx.users.client,
        body: {
          jobId: testJobId,
          freelancerId: ctx.users.freelancer.id,
          amount: 15000,
        },
      });
      contractId = (contractResponse.body as any).data.id;
    });

    it('should create a milestone for a contract', async () => {
      const response = await ctx.request('POST', `/api/contracts/${contractId}/milestones`, {
        user: ctx.users.client,
        body: {
          name: 'Design Phase',
          amount: 5000,
          dueDate: '2025-06-01',
          order: 1,
        },
      });

      expect(response.status).toBe(201);
      const data = (response.body as any).data;
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Design Phase');
      expect(data.amount).toBe(5000);
      expect(data.status).toBe('PENDING');
    });

    it('should create multiple milestones', async () => {
      const milestone1 = await ctx.request('POST', `/api/contracts/${contractId}/milestones`, {
        user: ctx.users.client,
        body: { name: 'Phase 1', amount: 5000, order: 1 },
      });

      const milestone2 = await ctx.request('POST', `/api/contracts/${contractId}/milestones`, {
        user: ctx.users.client,
        body: { name: 'Phase 2', amount: 5000, order: 2 },
      });

      const milestone3 = await ctx.request('POST', `/api/contracts/${contractId}/milestones`, {
        user: ctx.users.client,
        body: { name: 'Phase 3', amount: 5000, order: 3 },
      });

      expect(milestone1.status).toBe(201);
      expect(milestone2.status).toBe(201);
      expect(milestone3.status).toBe(201);
    });

    it('should not allow freelancer to create milestones', async () => {
      const response = await ctx.request('POST', `/api/contracts/${contractId}/milestones`, {
        user: ctx.users.freelancer,
        body: { name: 'Unauthorized Milestone', amount: 5000, order: 1 },
      });

      expect(response.status).toBe(403);
    });

    it('should return 404 for milestones on non-existent contract', async () => {
      const response = await ctx.request('POST', '/api/contracts/nonexistent-id/milestones', {
        user: ctx.users.client,
        body: { name: 'Ghost Milestone', amount: 1000, order: 1 },
      });

      expect(response.status).toBe(404);
    });
  });

  // ===========================================================================
  // Contract Completion
  // ===========================================================================

  describe('Contract Completion', () => {
    let contractId: string;

    beforeEach(async () => {
      const contractResponse = await ctx.request('POST', '/api/contracts', {
        user: ctx.users.client,
        body: {
          jobId: testJobId,
          freelancerId: ctx.users.freelancer.id,
          amount: 10000,
        },
      });
      contractId = (contractResponse.body as any).data.id;
    });

    it('should complete a contract', async () => {
      const response = await ctx.request('POST', `/api/contracts/${contractId}/complete`, {
        user: ctx.users.client,
      });

      expect(response.status).toBe(200);
      const data = (response.body as any).data;
      expect(data.status).toBe('COMPLETED');
    });

    it('should not allow freelancer to complete contract', async () => {
      const response = await ctx.request('POST', `/api/contracts/${contractId}/complete`, {
        user: ctx.users.freelancer,
      });

      expect(response.status).toBe(403);
    });

    it('should return 404 for completing non-existent contract', async () => {
      const response = await ctx.request('POST', '/api/contracts/nonexistent-id/complete', {
        user: ctx.users.client,
      });

      expect(response.status).toBe(404);
    });

    it('should retrieve completed contract details', async () => {
      await ctx.request('POST', `/api/contracts/${contractId}/complete`, {
        user: ctx.users.client,
      });

      const getResponse = await ctx.request('GET', `/api/contracts/${contractId}`, {
        user: ctx.users.client,
      });

      expect(getResponse.status).toBe(200);
      expect((getResponse.body as any).data.status).toBe('COMPLETED');
    });
  });

  // ===========================================================================
  // Contract Retrieval
  // ===========================================================================

  describe('Contract Retrieval', () => {
    it('should retrieve contract by ID', async () => {
      const createResponse = await ctx.request('POST', '/api/contracts', {
        user: ctx.users.client,
        body: {
          jobId: testJobId,
          freelancerId: ctx.users.freelancer.id,
          amount: 12000,
        },
      });

      const contractId = (createResponse.body as any).data.id;

      const getResponse = await ctx.request('GET', `/api/contracts/${contractId}`, {
        user: ctx.users.client,
      });

      expect(getResponse.status).toBe(200);
      expect((getResponse.body as any).data.id).toBe(contractId);
      expect((getResponse.body as any).data.amount).toBe(12000);
    });

    it('should return 404 for non-existent contract', async () => {
      const response = await ctx.request('GET', '/api/contracts/nonexistent-id', {
        user: ctx.users.client,
      });

      expect(response.status).toBe(404);
    });
  });
});
