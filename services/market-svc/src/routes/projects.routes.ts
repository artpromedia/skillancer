/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Project Routes
 *
 * Public API endpoints for project management
 */

import { z } from 'zod';

import { BiddingError, getStatusCode } from '../errors/bidding.errors.js';
import { signalJobViewed } from '../hooks/learning-signals.hook.js';
import { ProjectService } from '../services/project.service.js';

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';

// ============================================================================
// Validation Schemas
// ============================================================================

const CreateProjectSchema = z.object({
  title: z.string().min(10).max(200),
  description: z.string().min(50).max(10000),
  budgetType: z.enum(['FIXED', 'HOURLY', 'MONTHLY']),
  budgetMin: z.number().positive().optional(),
  budgetMax: z.number().positive().optional(),
  estimatedDuration: z.number().positive().optional(),
  durationUnit: z.enum(['HOURS', 'DAYS', 'WEEKS', 'MONTHS']).optional(),
  experienceLevel: z.enum(['ENTRY', 'INTERMEDIATE', 'EXPERT']).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE', 'INVITE_ONLY']).optional(),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().url(),
        size: z.number().optional(),
        mimeType: z.string().optional(),
      })
    )
    .optional(),
  skillIds: z.array(z.string().uuid()).optional(),
});

const UpdateProjectSchema = CreateProjectSchema.partial().extend({
  status: z.enum(['DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED', 'COMPLETED']).optional(),
});

const SearchProjectsSchema = z.object({
  query: z.string().optional(),
  skills: z.array(z.string()).optional(),
  budgetMin: z.string().transform(Number).optional(),
  budgetMax: z.string().transform(Number).optional(),
  budgetType: z.enum(['FIXED', 'HOURLY', 'MONTHLY']).optional(),
  experienceLevel: z.enum(['ENTRY', 'INTERMEDIATE', 'EXPERT']).optional(),
  status: z.enum(['PUBLISHED']).optional(),
  sortBy: z.enum(['relevance', 'newest', 'budget_high', 'budget_low', 'bids_count']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
});

// ============================================================================
// Route Dependencies
// ============================================================================

interface ProjectRouteDeps {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerProjectRoutes(fastify: FastifyInstance, deps: ProjectRouteDeps): void {
  const { prisma, redis, logger } = deps;

  // Initialize service
  const projectService = new ProjectService(prisma, redis, logger);

  // Helper to get authenticated user
  const getUser = (request: any) => {
    if (!request.user) {
      throw new Error('Authentication required');
    }
    return request.user as { id: string; email: string; role: string };
  };

  // Error handler
  const handleError = (error: unknown, reply: any) => {
    if (error instanceof BiddingError) {
      return reply.status(getStatusCode(error.code)).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }
    throw error;
  };

  // POST /projects - Create a new project
  fastify.post('/', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = CreateProjectSchema.parse(request.body);

      // Extract skill IDs
      const { skillIds, ...projectData } = body;

      const project = await projectService.createProject(user.id, {
        ...projectData,
        skills: skillIds,
      });

      logger.info({
        msg: 'Project created',
        projectId: project.id,
        clientId: user.id,
      });

      return await reply.status(201).send({
        success: true,
        project,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /projects/search - Search projects
  fastify.get('/search', async (request, reply) => {
    try {
      const query = SearchProjectsSchema.parse(request.query);

      const result = await projectService.searchProjects({
        query: query.query,
        skills: query.skills,
        budgetMin: query.budgetMin,
        budgetMax: query.budgetMax,
        budgetType: query.budgetType,
        experienceLevel: query.experienceLevel,
        status: query.status || 'PUBLISHED',
        sortBy: query.sortBy,
        page: query.page,
        limit: query.limit,
      });

      return await reply.send({
        success: true,
        ...result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /projects/my - Get current user's projects
  fastify.get('/my', async (request, reply) => {
    try {
      const user = getUser(request);
      const { status, page, limit } = request.query as {
        status?: string;
        page?: string;
        limit?: string;
      };

      const result = await projectService.getClientProjects(user.id, {
        status: status as any,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });

      return await reply.send({
        success: true,
        ...result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /projects/:projectId - Get project by ID
  fastify.get<{ Params: { projectId: string } }>('/:projectId', async (request, reply) => {
    try {
      const { projectId } = request.params;
      const project = await projectService.getProject(projectId);

      // Signal job viewed for learning recommendations (fire and forget)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      const user = (request as any).user as { id: string } | undefined;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      const source = (request.query as any).source as
        | 'search'
        | 'recommendation'
        | 'direct'
        | 'email'
        | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      void signalJobViewed(user?.id, project, { source: source || 'direct' });

      return await reply.send({
        success: true,
        project,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /projects/slug/:slug - Get project by slug
  fastify.get<{ Params: { slug: string } }>('/slug/:slug', async (request, reply) => {
    try {
      const { slug } = request.params;
      const project = await projectService.getProjectBySlug(slug);

      return await reply.send({
        success: true,
        project,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PATCH /projects/:projectId - Update project
  fastify.patch<{ Params: { projectId: string } }>('/:projectId', async (request, reply) => {
    try {
      const user = getUser(request);
      const { projectId } = request.params;
      const body = UpdateProjectSchema.parse(request.body);

      const { skillIds, ...updateData } = body;

      const project = await projectService.updateProject(projectId, user.id, {
        ...updateData,
        skills: skillIds,
      });

      logger.info({
        msg: 'Project updated',
        projectId,
        clientId: user.id,
      });

      return await reply.send({
        success: true,
        project,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /projects/:projectId/publish - Publish a project
  fastify.post<{ Params: { projectId: string } }>('/:projectId/publish', async (request, reply) => {
    try {
      const user = getUser(request);
      const { projectId } = request.params;

      const project = await projectService.publishProject(projectId, user.id);

      logger.info({
        msg: 'Project published',
        projectId,
        clientId: user.id,
      });

      return await reply.send({
        success: true,
        project,
        message: 'Project is now open for bids',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /projects/:projectId/close - Close a project
  fastify.post<{ Params: { projectId: string } }>('/:projectId/close', async (request, reply) => {
    try {
      const user = getUser(request);
      const { projectId } = request.params;
      const body = (request.body as { reason?: string }) || {};
      const reason = body.reason === 'cancelled' ? 'cancelled' : 'completed';

      const project = await projectService.closeProject(projectId, user.id, reason);

      logger.info({
        msg: 'Project closed',
        projectId,
        clientId: user.id,
        reason,
      });

      return await reply.send({
        success: true,
        project,
        message: 'Project is now closed',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // DELETE /projects/:projectId - Delete project (soft delete)
  fastify.delete<{ Params: { projectId: string } }>('/:projectId', async (request, reply) => {
    try {
      const user = getUser(request);
      const { projectId } = request.params;

      await projectService.deleteProject(projectId, user.id);

      logger.info({
        msg: 'Project deleted',
        projectId,
        clientId: user.id,
      });

      return await reply.send({
        success: true,
        message: 'Project deleted successfully',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /projects/:projectId/stats - Get project statistics
  fastify.get<{ Params: { projectId: string } }>('/:projectId/stats', async (request, reply) => {
    try {
      const user = getUser(request);
      const { projectId } = request.params;

      const stats = await projectService.getProjectStats(projectId, user.id);

      return await reply.send({
        success: true,
        stats,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });
}
