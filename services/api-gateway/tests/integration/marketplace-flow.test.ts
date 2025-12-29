import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestClient, TestClient } from '@skillancer/testing';
import type { Job, Proposal, Contract } from '@skillancer/types';

/**
 * Marketplace Flow Integration Tests
 * Tests job posting, proposal, and contract flows
 */

describe('Marketplace Flow Integration', () => {
  let clientClient: TestClient;
  let freelancerClient: TestClient;
  let testJob: Job;
  let testProposal: Proposal;

  beforeAll(async () => {
    clientClient = await createTestClient({ role: 'client' });
    freelancerClient = await createTestClient({ role: 'freelancer' });

    await clientClient.authenticate('client@test.com', 'TestPassword123!');
    await freelancerClient.authenticate('freelancer@test.com', 'TestPassword123!');
  });

  afterAll(async () => {
    await clientClient.cleanup();
    await freelancerClient.cleanup();
  });

  describe('Job Posting', () => {
    it('should create a new job posting', async () => {
      const response = await clientClient.post('/api/jobs', {
        title: 'Full Stack Developer for E-commerce Platform',
        description:
          'Looking for an experienced developer to build a modern e-commerce platform using React and Node.js.',
        skills: ['react', 'nodejs', 'postgresql', 'typescript'],
        budget: {
          type: 'fixed',
          amount: 5000,
          currency: 'USD',
        },
        duration: '1-3 months',
        experienceLevel: 'intermediate',
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.title).toBe('Full Stack Developer for E-commerce Platform');
      expect(response.data.status).toBe('draft');

      testJob = response.data;
    });

    it('should publish a job', async () => {
      const response = await clientClient.post(`/api/jobs/${testJob.id}/publish`);

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('published');
    });

    it('should validate required job fields', async () => {
      const response = await clientClient.post('/api/jobs', {
        title: 'Incomplete Job',
      });

      expect(response.status).toBe(400);
      expect(response.data.errors).toContainEqual(
        expect.objectContaining({ field: 'description' })
      );
    });

    it('should prevent freelancer from posting jobs', async () => {
      const response = await freelancerClient.post('/api/jobs', {
        title: 'Unauthorized Job',
        description: 'Should not be allowed',
        budget: { type: 'fixed', amount: 1000 },
      });

      expect(response.status).toBe(403);
    });
  });

  describe('Job Search', () => {
    it('should search jobs by keyword', async () => {
      const response = await freelancerClient.get('/api/jobs/search', {
        params: { q: 'e-commerce' },
      });

      expect(response.status).toBe(200);
      expect(response.data.jobs).toBeInstanceOf(Array);
      expect(
        response.data.jobs.some((j: Job) => j.title.toLowerCase().includes('e-commerce'))
      ).toBe(true);
    });

    it('should filter jobs by skills', async () => {
      const response = await freelancerClient.get('/api/jobs/search', {
        params: { skills: ['react', 'nodejs'] },
      });

      expect(response.status).toBe(200);
      expect(
        response.data.jobs.every((j: Job) =>
          j.skills.some((s) => ['react', 'nodejs'].includes(s.toLowerCase()))
        )
      ).toBe(true);
    });

    it('should filter jobs by budget range', async () => {
      const response = await freelancerClient.get('/api/jobs/search', {
        params: { minBudget: 3000, maxBudget: 10000 },
      });

      expect(response.status).toBe(200);
      expect(
        response.data.jobs.every((j: Job) => j.budget.amount >= 3000 && j.budget.amount <= 10000)
      ).toBe(true);
    });

    it('should paginate search results', async () => {
      const response1 = await freelancerClient.get('/api/jobs/search', {
        params: { page: 1, limit: 10 },
      });
      const response2 = await freelancerClient.get('/api/jobs/search', {
        params: { page: 2, limit: 10 },
      });

      expect(response1.data.jobs).toHaveLength(10);
      expect(response2.data.pagination.page).toBe(2);
      expect(response1.data.jobs[0].id).not.toBe(response2.data.jobs[0]?.id);
    });

    it('should only return published jobs to freelancers', async () => {
      const response = await freelancerClient.get('/api/jobs/search');

      expect(response.data.jobs.every((j: Job) => j.status === 'published')).toBe(true);
    });
  });

  describe('Proposal Submission', () => {
    it('should submit a proposal to a job', async () => {
      const response = await freelancerClient.post(`/api/jobs/${testJob.id}/proposals`, {
        coverLetter:
          'I am excited to work on this e-commerce project. I have 5+ years of experience with React and Node.js.',
        bidAmount: 4500,
        estimatedDuration: '6 weeks',
        milestones: [
          { title: 'Setup & Architecture', amount: 1000, duration: '1 week' },
          { title: 'Frontend Development', amount: 1500, duration: '2 weeks' },
          { title: 'Backend & Integration', amount: 1500, duration: '2 weeks' },
          { title: 'Testing & Deployment', amount: 500, duration: '1 week' },
        ],
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.status).toBe('pending');

      testProposal = response.data;
    });

    it('should validate cover letter minimum length', async () => {
      const response = await freelancerClient.post(`/api/jobs/${testJob.id}/proposals`, {
        coverLetter: 'Too short',
        bidAmount: 4000,
      });

      expect(response.status).toBe(400);
      expect(response.data.error).toMatch(/cover.*letter|minimum/i);
    });

    it('should prevent duplicate proposals', async () => {
      const response = await freelancerClient.post(`/api/jobs/${testJob.id}/proposals`, {
        coverLetter: 'Another proposal from the same freelancer',
        bidAmount: 4000,
      });

      expect(response.status).toBe(409);
      expect(response.data.error).toMatch(/already.*submitted|duplicate/i);
    });

    it('should prevent clients from submitting proposals', async () => {
      const response = await clientClient.post(`/api/jobs/${testJob.id}/proposals`, {
        coverLetter: 'Clients should not submit proposals',
        bidAmount: 4000,
      });

      expect(response.status).toBe(403);
    });
  });

  describe('Proposal Management', () => {
    it('should list proposals for job owner', async () => {
      const response = await clientClient.get(`/api/jobs/${testJob.id}/proposals`);

      expect(response.status).toBe(200);
      expect(response.data.proposals).toBeInstanceOf(Array);
      expect(response.data.proposals.some((p: Proposal) => p.id === testProposal.id)).toBe(true);
    });

    it('should not list proposals to non-owners', async () => {
      const otherClient = await createTestClient({ role: 'client' });
      await otherClient.authenticate('other@test.com', 'TestPassword123!');

      const response = await otherClient.get(`/api/jobs/${testJob.id}/proposals`);

      expect(response.status).toBe(403);
      await otherClient.cleanup();
    });

    it('should view proposal details', async () => {
      const response = await clientClient.get(`/api/proposals/${testProposal.id}`);

      expect(response.status).toBe(200);
      expect(response.data.coverLetter).toBeDefined();
      expect(response.data.freelancer).toBeDefined();
    });

    it('should shortlist a proposal', async () => {
      const response = await clientClient.post(`/api/proposals/${testProposal.id}/shortlist`);

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('shortlisted');
    });

    it('should allow freelancer to update their proposal', async () => {
      const response = await freelancerClient.patch(`/api/proposals/${testProposal.id}`, {
        bidAmount: 4200,
      });

      expect(response.status).toBe(200);
      expect(response.data.bidAmount).toBe(4200);
    });

    it('should allow freelancer to withdraw proposal', async () => {
      // First create a new proposal to withdraw
      const newJobResponse = await clientClient.post('/api/jobs', {
        title: 'Another Job',
        description: 'For withdrawal testing',
        skills: ['python'],
        budget: { type: 'fixed', amount: 2000 },
      });
      await clientClient.post(`/api/jobs/${newJobResponse.data.id}/publish`);

      const proposalResponse = await freelancerClient.post(
        `/api/jobs/${newJobResponse.data.id}/proposals`,
        {
          coverLetter: 'Test proposal for withdrawal',
          bidAmount: 1800,
        }
      );

      const withdrawResponse = await freelancerClient.delete(
        `/api/proposals/${proposalResponse.data.id}`
      );

      expect(withdrawResponse.status).toBe(200);
      expect(withdrawResponse.data.status).toBe('withdrawn');
    });
  });

  describe('Hiring Process', () => {
    it('should hire a freelancer from proposal', async () => {
      const response = await clientClient.post(`/api/proposals/${testProposal.id}/hire`, {
        message: 'Welcome to the project! Looking forward to working with you.',
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('contract');
      expect(response.data.contract.status).toBe('pending');
      expect(response.data.contract.freelancerId).toBe(testProposal.freelancerId);
    });

    it('should update proposal status to accepted', async () => {
      const response = await freelancerClient.get(`/api/proposals/${testProposal.id}`);

      expect(response.data.status).toBe('accepted');
    });

    it('should close job after hiring', async () => {
      const response = await clientClient.get(`/api/jobs/${testJob.id}`);

      expect(response.data.status).toBe('in_progress');
    });
  });

  describe('Contract Lifecycle', () => {
    let contract: Contract;

    beforeAll(async () => {
      const response = await clientClient.get(`/api/jobs/${testJob.id}/contract`);
      contract = response.data;
    });

    it('should retrieve contract details', async () => {
      const response = await freelancerClient.get(`/api/contracts/${contract.id}`);

      expect(response.status).toBe(200);
      expect(response.data.jobId).toBe(testJob.id);
      expect(response.data.milestones).toBeInstanceOf(Array);
    });

    it('should sign contract as freelancer', async () => {
      const response = await freelancerClient.post(`/api/contracts/${contract.id}/sign`);

      expect(response.status).toBe(200);
      expect(response.data.freelancerSigned).toBe(true);
    });

    it('should sign contract as client', async () => {
      const response = await clientClient.post(`/api/contracts/${contract.id}/sign`);

      expect(response.status).toBe(200);
      expect(response.data.clientSigned).toBe(true);
      expect(response.data.status).toBe('active');
    });

    it('should submit milestone for review', async () => {
      const milestone = contract.milestones[0];

      const response = await freelancerClient.post(
        `/api/contracts/${contract.id}/milestones/${milestone.id}/submit`,
        {
          message: 'Milestone completed. Please review.',
          deliverables: [{ name: 'Architecture Document', url: 'https://docs.example.com/arch' }],
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('submitted');
    });

    it('should approve milestone and release payment', async () => {
      const milestone = contract.milestones[0];

      const response = await clientClient.post(
        `/api/contracts/${contract.id}/milestones/${milestone.id}/approve`
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('completed');
      expect(response.data.paidAt).toBeDefined();
    });

    it('should request milestone revision', async () => {
      const milestone = contract.milestones[1];

      // Submit milestone first
      await freelancerClient.post(
        `/api/contracts/${contract.id}/milestones/${milestone.id}/submit`,
        { message: 'Frontend complete' }
      );

      const response = await clientClient.post(
        `/api/contracts/${contract.id}/milestones/${milestone.id}/request-revision`,
        {
          feedback: 'Need some adjustments to the responsive design.',
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('revision_requested');
    });

    it('should complete contract after all milestones', async () => {
      // Complete remaining milestones
      for (const milestone of contract.milestones.slice(1)) {
        await freelancerClient.post(
          `/api/contracts/${contract.id}/milestones/${milestone.id}/submit`,
          { message: 'Completed' }
        );
        await clientClient.post(`/api/contracts/${contract.id}/milestones/${milestone.id}/approve`);
      }

      const response = await clientClient.get(`/api/contracts/${contract.id}`);

      expect(response.data.status).toBe('completed');
    });
  });

  describe('Reviews and Ratings', () => {
    let completedContract: Contract;

    beforeAll(async () => {
      const response = await clientClient.get('/api/contracts', {
        params: { status: 'completed' },
      });
      completedContract = response.data.contracts[0];
    });

    it('should submit client review', async () => {
      const response = await clientClient.post(`/api/contracts/${completedContract.id}/reviews`, {
        rating: 5,
        comment: 'Excellent work! Delivered on time and high quality.',
        skillRatings: {
          communication: 5,
          quality: 5,
          expertise: 5,
          professionalism: 5,
          wouldRecommend: true,
        },
      });

      expect(response.status).toBe(201);
      expect(response.data.rating).toBe(5);
    });

    it('should submit freelancer review', async () => {
      const response = await freelancerClient.post(
        `/api/contracts/${completedContract.id}/reviews`,
        {
          rating: 5,
          comment: 'Great client to work with. Clear requirements and prompt payment.',
          skillRatings: {
            communication: 5,
            clarity: 5,
            professionalism: 5,
            paymentPromptness: 5,
          },
        }
      );

      expect(response.status).toBe(201);
    });

    it('should prevent duplicate reviews', async () => {
      const response = await clientClient.post(`/api/contracts/${completedContract.id}/reviews`, {
        rating: 4,
        comment: 'Duplicate review',
      });

      expect(response.status).toBe(409);
    });

    it('should update user ratings', async () => {
      const response = await freelancerClient.get('/api/me/profile');

      expect(response.data.rating).toBeGreaterThan(0);
      expect(response.data.reviewCount).toBeGreaterThan(0);
    });
  });

  describe('Job Management', () => {
    it('should list client jobs', async () => {
      const response = await clientClient.get('/api/me/jobs');

      expect(response.status).toBe(200);
      expect(response.data.jobs).toBeInstanceOf(Array);
    });

    it('should list freelancer contracts', async () => {
      const response = await freelancerClient.get('/api/me/contracts');

      expect(response.status).toBe(200);
      expect(response.data.contracts).toBeInstanceOf(Array);
    });

    it('should close a job without hiring', async () => {
      // Create a new job
      const jobResponse = await clientClient.post('/api/jobs', {
        title: 'Job to Close',
        description: 'Will be closed without hiring',
        skills: ['java'],
        budget: { type: 'fixed', amount: 3000 },
      });
      await clientClient.post(`/api/jobs/${jobResponse.data.id}/publish`);

      const response = await clientClient.post(`/api/jobs/${jobResponse.data.id}/close`, {
        reason: 'Requirements changed',
      });

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('closed');
    });
  });

  describe('Saved Jobs and Favorites', () => {
    it('should save a job', async () => {
      const response = await freelancerClient.post(`/api/jobs/${testJob.id}/save`);

      expect(response.status).toBe(200);
    });

    it('should list saved jobs', async () => {
      const response = await freelancerClient.get('/api/me/saved-jobs');

      expect(response.status).toBe(200);
      expect(response.data.jobs.some((j: Job) => j.id === testJob.id)).toBe(true);
    });

    it('should unsave a job', async () => {
      const response = await freelancerClient.delete(`/api/jobs/${testJob.id}/save`);

      expect(response.status).toBe(200);

      const savedResponse = await freelancerClient.get('/api/me/saved-jobs');
      expect(savedResponse.data.jobs.some((j: Job) => j.id === testJob.id)).toBe(false);
    });
  });

  describe('Analytics and Stats', () => {
    it('should get job analytics for client', async () => {
      const response = await clientClient.get(`/api/jobs/${testJob.id}/analytics`);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('views');
      expect(response.data).toHaveProperty('proposalCount');
    });

    it('should get freelancer earnings summary', async () => {
      const response = await freelancerClient.get('/api/me/earnings');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('totalEarned');
      expect(response.data).toHaveProperty('pendingPayments');
    });
  });
});
