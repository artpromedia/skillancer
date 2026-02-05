/**
 * Integration Tests: Job Posting Flows
 *
 * Tests job CRUD, search/filtering, and status transitions.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTests, cleanupIntegrationTests, type TestContext } from './setup';

describe('Jobs Integration', () => {
  let ctx: TestContext;

  beforeAll(() => {
    ctx = setupIntegrationTests();
  });

  afterAll(() => {
    cleanupIntegrationTests();
  });

  // ===========================================================================
  // Job CRUD
  // ===========================================================================

  describe('Job Posting CRUD', () => {
    let createdJobId: string;

    it('should create a new job posting', async () => {
      const response = await ctx.request('POST', '/api/jobs', {
        user: ctx.users.client,
        body: {
          title: 'Full-Stack Developer Needed',
          description: 'Looking for an experienced full-stack developer for a 3-month project.',
          budget: 15000,
          budgetType: 'FIXED',
          skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'],
        },
      });

      expect(response.status).toBe(201);
      const data = (response.body as any).data;
      expect(data.id).toBeDefined();
      expect(data.title).toBe('Full-Stack Developer Needed');
      expect(data.budget).toBe(15000);
      expect(data.status).toBe('OPEN');
      createdJobId = data.id;
    });

    it('should retrieve the created job', async () => {
      const response = await ctx.request('GET', `/api/jobs/${createdJobId}`, {
        user: ctx.users.client,
      });

      expect(response.status).toBe(200);
      const data = (response.body as any).data;
      expect(data.id).toBe(createdJobId);
      expect(data.title).toBe('Full-Stack Developer Needed');
    });

    it('should update a job posting', async () => {
      const response = await ctx.request('PUT', `/api/jobs/${createdJobId}`, {
        user: ctx.users.client,
        body: {
          title: 'Senior Full-Stack Developer Needed',
          budget: 20000,
        },
      });

      expect(response.status).toBe(200);
      const data = (response.body as any).data;
      expect(data.title).toBe('Senior Full-Stack Developer Needed');
      expect(data.budget).toBe(20000);
    });

    it('should not allow non-owner to update a job', async () => {
      const response = await ctx.request('PUT', `/api/jobs/${createdJobId}`, {
        user: ctx.users.freelancer,
        body: { title: 'Hacked Title' },
      });

      expect(response.status).toBe(403);
    });

    it('should delete a job posting', async () => {
      // Create a job to delete
      const createResponse = await ctx.request('POST', '/api/jobs', {
        user: ctx.users.client,
        body: {
          title: 'Job To Delete',
          description: 'This job will be deleted.',
          budget: 1000,
        },
      });

      const jobId = (createResponse.body as any).data.id;

      const deleteResponse = await ctx.request('DELETE', `/api/jobs/${jobId}`, {
        user: ctx.users.client,
      });

      expect(deleteResponse.status).toBe(200);

      // Verify job is deleted
      const getResponse = await ctx.request('GET', `/api/jobs/${jobId}`, {
        user: ctx.users.client,
      });

      expect(getResponse.status).toBe(404);
    });

    it('should not allow non-owner to delete a job', async () => {
      const response = await ctx.request('DELETE', `/api/jobs/${createdJobId}`, {
        user: ctx.users.freelancer,
      });

      expect(response.status).toBe(403);
    });
  });

  // ===========================================================================
  // Validation
  // ===========================================================================

  describe('Job Validation', () => {
    it('should reject job without title', async () => {
      const response = await ctx.request('POST', '/api/jobs', {
        user: ctx.users.client,
        body: {
          description: 'Missing title',
          budget: 5000,
        },
      });

      expect(response.status).toBe(400);
    });

    it('should reject job without description', async () => {
      const response = await ctx.request('POST', '/api/jobs', {
        user: ctx.users.client,
        body: {
          title: 'Missing Description',
          budget: 5000,
        },
      });

      expect(response.status).toBe(400);
    });

    it('should reject job without budget', async () => {
      const response = await ctx.request('POST', '/api/jobs', {
        user: ctx.users.client,
        body: {
          title: 'Missing Budget',
          description: 'This job has no budget.',
        },
      });

      expect(response.status).toBe(400);
    });
  });

  // ===========================================================================
  // Search and Filtering
  // ===========================================================================

  describe('Job Search and Filtering', () => {
    it('should list all jobs', async () => {
      // Create multiple jobs
      await ctx.request('POST', '/api/jobs', {
        user: ctx.users.client,
        body: { title: 'React Developer', description: 'Frontend work', budget: 5000 },
      });
      await ctx.request('POST', '/api/jobs', {
        user: ctx.users.client,
        body: { title: 'Python Backend', description: 'API development', budget: 8000 },
      });

      const response = await ctx.request('GET', '/api/jobs', {
        user: ctx.users.freelancer,
      });

      expect(response.status).toBe(200);
      const data = (response.body as any).data;
      expect(data.jobs.length).toBeGreaterThanOrEqual(2);
      expect(data.total).toBeGreaterThanOrEqual(2);
    });

    it('should return job with correct structure', async () => {
      const listResponse = await ctx.request('GET', '/api/jobs', {
        user: ctx.users.freelancer,
      });

      expect(listResponse.status).toBe(200);
      const jobs = (listResponse.body as any).data.jobs;

      if (jobs.length > 0) {
        const job = jobs[0];
        expect(job).toHaveProperty('id');
        expect(job).toHaveProperty('title');
        expect(job).toHaveProperty('description');
        expect(job).toHaveProperty('budget');
        expect(job).toHaveProperty('status');
      }
    });

    it('should return 404 for non-existent job', async () => {
      const response = await ctx.request('GET', '/api/jobs/nonexistent-job-id', {
        user: ctx.users.freelancer,
      });

      expect(response.status).toBe(404);
    });
  });

  // ===========================================================================
  // Job Status Transitions
  // ===========================================================================

  describe('Job Status Transitions', () => {
    it('should create job in OPEN status', async () => {
      const response = await ctx.request('POST', '/api/jobs', {
        user: ctx.users.client,
        body: {
          title: 'Status Test Job',
          description: 'Testing status transitions',
          budget: 3000,
        },
      });

      expect(response.status).toBe(201);
      expect((response.body as any).data.status).toBe('OPEN');
    });

    it('should transition job to IN_PROGRESS', async () => {
      const createResponse = await ctx.request('POST', '/api/jobs', {
        user: ctx.users.client,
        body: { title: 'In Progress Job', description: 'Will move to in-progress', budget: 4000 },
      });

      const jobId = (createResponse.body as any).data.id;

      const updateResponse = await ctx.request('PUT', `/api/jobs/${jobId}`, {
        user: ctx.users.client,
        body: { status: 'IN_PROGRESS' },
      });

      expect(updateResponse.status).toBe(200);
      expect((updateResponse.body as any).data.status).toBe('IN_PROGRESS');
    });

    it('should transition job to COMPLETED', async () => {
      const createResponse = await ctx.request('POST', '/api/jobs', {
        user: ctx.users.client,
        body: { title: 'Complete Job', description: 'Will be completed', budget: 2000 },
      });

      const jobId = (createResponse.body as any).data.id;

      const updateResponse = await ctx.request('PUT', `/api/jobs/${jobId}`, {
        user: ctx.users.client,
        body: { status: 'COMPLETED' },
      });

      expect(updateResponse.status).toBe(200);
      expect((updateResponse.body as any).data.status).toBe('COMPLETED');
    });

    it('should transition job to CANCELLED', async () => {
      const createResponse = await ctx.request('POST', '/api/jobs', {
        user: ctx.users.client,
        body: { title: 'Cancel Job', description: 'Will be cancelled', budget: 1000 },
      });

      const jobId = (createResponse.body as any).data.id;

      const updateResponse = await ctx.request('PUT', `/api/jobs/${jobId}`, {
        user: ctx.users.client,
        body: { status: 'CANCELLED' },
      });

      expect(updateResponse.status).toBe(200);
      expect((updateResponse.body as any).data.status).toBe('CANCELLED');
    });
  });
});
