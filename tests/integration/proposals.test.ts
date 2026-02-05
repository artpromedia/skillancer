/**
 * Integration Tests: Proposal Flows
 *
 * Tests proposal submission, acceptance/rejection, and contract creation.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupIntegrationTests, cleanupIntegrationTests, type TestContext } from './setup';

describe('Proposals Integration', () => {
  let ctx: TestContext;
  let testJobId: string;

  beforeAll(() => {
    ctx = setupIntegrationTests();
  });

  afterAll(() => {
    cleanupIntegrationTests();
  });

  beforeEach(async () => {
    // Create a job for proposal tests
    const jobResponse = await ctx.request('POST', '/api/jobs', {
      user: ctx.users.client,
      body: {
        title: 'Test Job for Proposals',
        description: 'A test job that will receive proposals.',
        budget: 10000,
        budgetType: 'FIXED',
        skills: ['React', 'TypeScript'],
      },
    });

    testJobId = (jobResponse.body as any).data.id;
  });

  // ===========================================================================
  // Proposal Submission
  // ===========================================================================

  describe('Proposal Submission', () => {
    it('should submit a proposal for an open job', async () => {
      const response = await ctx.request('POST', '/api/proposals', {
        user: ctx.users.freelancer,
        body: {
          jobId: testJobId,
          coverLetter: 'I am an experienced developer with 5 years of React expertise.',
          bidAmount: 8000,
          estimatedDuration: '2 months',
        },
      });

      expect(response.status).toBe(201);
      const data = (response.body as any).data;
      expect(data.id).toBeDefined();
      expect(data.jobId).toBe(testJobId);
      expect(data.status).toBe('PENDING');
      expect(data.bidAmount).toBe(8000);
      expect(data.coverLetter).toBe(
        'I am an experienced developer with 5 years of React expertise.'
      );
    });

    it('should reject proposal without job ID', async () => {
      const response = await ctx.request('POST', '/api/proposals', {
        user: ctx.users.freelancer,
        body: {
          coverLetter: 'Missing job ID',
          bidAmount: 5000,
        },
      });

      expect(response.status).toBe(400);
    });

    it('should reject proposal without cover letter', async () => {
      const response = await ctx.request('POST', '/api/proposals', {
        user: ctx.users.freelancer,
        body: {
          jobId: testJobId,
          bidAmount: 5000,
        },
      });

      expect(response.status).toBe(400);
    });

    it('should reject proposal without bid amount', async () => {
      const response = await ctx.request('POST', '/api/proposals', {
        user: ctx.users.freelancer,
        body: {
          jobId: testJobId,
          coverLetter: 'Missing bid amount.',
        },
      });

      expect(response.status).toBe(400);
    });

    it('should reject proposal for non-existent job', async () => {
      const response = await ctx.request('POST', '/api/proposals', {
        user: ctx.users.freelancer,
        body: {
          jobId: 'nonexistent-job-id',
          coverLetter: 'Proposal for a ghost job.',
          bidAmount: 3000,
        },
      });

      expect(response.status).toBe(404);
    });

    it('should create proposal with PENDING status', async () => {
      const response = await ctx.request('POST', '/api/proposals', {
        user: ctx.users.freelancer,
        body: {
          jobId: testJobId,
          coverLetter: 'Status check proposal.',
          bidAmount: 7000,
        },
      });

      expect(response.status).toBe(201);
      expect((response.body as any).data.status).toBe('PENDING');
    });
  });

  // ===========================================================================
  // Proposal Acceptance
  // ===========================================================================

  describe('Proposal Acceptance', () => {
    it('should accept a pending proposal', async () => {
      // Submit proposal
      const submitResponse = await ctx.request('POST', '/api/proposals', {
        user: ctx.users.freelancer,
        body: {
          jobId: testJobId,
          coverLetter: 'Proposal to accept.',
          bidAmount: 9000,
        },
      });

      const proposalId = (submitResponse.body as any).data.id;

      // Accept proposal as client
      const acceptResponse = await ctx.request('POST', `/api/proposals/${proposalId}/accept`, {
        user: ctx.users.client,
      });

      expect(acceptResponse.status).toBe(200);
      const data = (acceptResponse.body as any).data;
      expect(data.proposal.status).toBe('ACCEPTED');
    });

    it('should create a contract from accepted proposal', async () => {
      const submitResponse = await ctx.request('POST', '/api/proposals', {
        user: ctx.users.freelancer,
        body: {
          jobId: testJobId,
          coverLetter: 'Proposal that creates a contract.',
          bidAmount: 8500,
        },
      });

      const proposalId = (submitResponse.body as any).data.id;

      const acceptResponse = await ctx.request('POST', `/api/proposals/${proposalId}/accept`, {
        user: ctx.users.client,
      });

      expect(acceptResponse.status).toBe(200);
      const data = (acceptResponse.body as any).data;
      expect(data.contract).toBeDefined();
      expect(data.contract.id).toBeDefined();
      expect(data.contract.status).toBe('ACTIVE');
      expect(data.contract.amount).toBe(8500);
    });

    it('should not allow freelancer to accept their own proposal', async () => {
      const submitResponse = await ctx.request('POST', '/api/proposals', {
        user: ctx.users.freelancer,
        body: {
          jobId: testJobId,
          coverLetter: 'Self-accept attempt.',
          bidAmount: 6000,
        },
      });

      const proposalId = (submitResponse.body as any).data.id;

      const acceptResponse = await ctx.request('POST', `/api/proposals/${proposalId}/accept`, {
        user: ctx.users.freelancer,
      });

      expect(acceptResponse.status).toBe(403);
    });

    it('should not accept an already accepted proposal', async () => {
      const submitResponse = await ctx.request('POST', '/api/proposals', {
        user: ctx.users.freelancer,
        body: {
          jobId: testJobId,
          coverLetter: 'Double accept attempt.',
          bidAmount: 7500,
        },
      });

      const proposalId = (submitResponse.body as any).data.id;

      // Accept first time
      await ctx.request('POST', `/api/proposals/${proposalId}/accept`, {
        user: ctx.users.client,
      });

      // Try to accept again
      const secondAccept = await ctx.request('POST', `/api/proposals/${proposalId}/accept`, {
        user: ctx.users.client,
      });

      expect(secondAccept.status).toBe(400);
    });
  });

  // ===========================================================================
  // Proposal Rejection
  // ===========================================================================

  describe('Proposal Rejection', () => {
    it('should reject a pending proposal', async () => {
      const submitResponse = await ctx.request('POST', '/api/proposals', {
        user: ctx.users.freelancer,
        body: {
          jobId: testJobId,
          coverLetter: 'Proposal to reject.',
          bidAmount: 12000,
        },
      });

      const proposalId = (submitResponse.body as any).data.id;

      const rejectResponse = await ctx.request('POST', `/api/proposals/${proposalId}/reject`, {
        user: ctx.users.client,
      });

      expect(rejectResponse.status).toBe(200);
      expect((rejectResponse.body as any).data.status).toBe('REJECTED');
    });

    it('should not allow freelancer to reject proposal', async () => {
      const submitResponse = await ctx.request('POST', '/api/proposals', {
        user: ctx.users.freelancer,
        body: {
          jobId: testJobId,
          coverLetter: 'Self-reject attempt.',
          bidAmount: 5000,
        },
      });

      const proposalId = (submitResponse.body as any).data.id;

      const rejectResponse = await ctx.request('POST', `/api/proposals/${proposalId}/reject`, {
        user: ctx.users.freelancer,
      });

      expect(rejectResponse.status).toBe(403);
    });

    it('should return 404 for non-existent proposal', async () => {
      const response = await ctx.request('POST', '/api/proposals/nonexistent-id/reject', {
        user: ctx.users.client,
      });

      expect(response.status).toBe(404);
    });
  });
});
