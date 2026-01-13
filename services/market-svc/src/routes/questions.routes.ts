// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Question Routes
 *
 * Public API endpoints for project Q&A
 */

import { z } from 'zod';

import { BiddingError, getStatusCode } from '../errors/bidding.errors.js';
import { QuestionService } from '../services/question.service.js';

import type { PrismaClient } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';

// ============================================================================
// Validation Schemas
// ============================================================================

const AskQuestionSchema = z.object({
  jobId: z.string().uuid(),
  question: z.string().min(10).max(2000),
  isPublic: z.boolean().optional(),
});

const AnswerQuestionSchema = z.object({
  answer: z.string().min(10).max(5000),
});

const UpdateQuestionSchema = z.object({
  question: z.string().min(10).max(2000).optional(),
  isPublic: z.boolean().optional(),
});

const QuestionListQuerySchema = z.object({
  answered: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
});

// ============================================================================
// Route Dependencies
// ============================================================================

interface QuestionRouteDeps {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerQuestionRoutes(fastify: FastifyInstance, deps: QuestionRouteDeps): void {
  const { prisma, redis, logger } = deps;

  // Initialize service
  const questionService = new QuestionService(prisma, redis, logger);

  // Helper to get authenticated user
  const getUser = (request: any) => {
    if (!request.user) {
      throw new Error('Authentication required');
    }
    return request.user as { id: string; email: string; role: string };
  };

  // Helper to get optional user
  const getOptionalUser = (request: any) => {
    return request.user as { id: string; email: string; role: string } | undefined;
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

  // POST /questions - Ask a question
  fastify.post('/', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = AskQuestionSchema.parse(request.body);

      const question = await questionService.askQuestion(user.id, body);

      logger.info({
        msg: 'Question asked',
        questionId: question.id,
        projectId: body.jobId,
        askerId: user.id,
      });

      return await reply.status(201).send({
        success: true,
        question,
        message: 'Question submitted successfully',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /questions/project/:projectId - Get questions for a project
  fastify.get<{ Params: { projectId: string } }>('/project/:projectId', async (request, reply) => {
    try {
      const user = getOptionalUser(request);
      const { projectId } = request.params;
      const query = QuestionListQuerySchema.parse(request.query);

      const options: { page?: number; limit?: number; answered?: boolean } = {
        page: query.page,
        limit: query.limit,
      };
      if (query.answered !== undefined) {
        options.answered = query.answered;
      }
      const result = await questionService.getProjectQuestions(projectId, user?.id, options);

      return await reply.send({
        success: true,
        ...result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /questions/my - Get questions asked by current user
  fastify.get('/my', async (request, reply) => {
    try {
      const user = getUser(request);
      const { page, limit } = request.query as { page?: string; limit?: string };

      const result = await questionService.getUserQuestions(user.id, {
        page: page ? Number.parseInt(page, 10) : 1,
        limit: limit ? Number.parseInt(limit, 10) : 20,
      });

      return await reply.send({
        success: true,
        ...result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /questions/:questionId - Get a specific question
  fastify.get<{ Params: { questionId: string } }>('/:questionId', async (request, reply) => {
    try {
      const user = getOptionalUser(request);
      const { questionId } = request.params;

      const question = await questionService.getQuestion(questionId, user?.id);

      return await reply.send({
        success: true,
        question,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PATCH /questions/:questionId - Update a question
  fastify.patch<{ Params: { questionId: string } }>('/:questionId', async (request, reply) => {
    try {
      const user = getUser(request);
      const { questionId } = request.params;
      const body = UpdateQuestionSchema.parse(request.body);

      const updateData: { question?: string; isPublic?: boolean } = {};
      if (body.question !== undefined) {
        updateData.question = body.question;
      }
      if (body.isPublic !== undefined) {
        updateData.isPublic = body.isPublic;
      }
      const question = await questionService.updateQuestion(questionId, user.id, updateData);

      logger.info({
        msg: 'Question updated',
        questionId,
        userId: user.id,
      });

      return await reply.send({
        success: true,
        question,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // DELETE /questions/:questionId - Delete a question
  fastify.delete<{ Params: { questionId: string } }>('/:questionId', async (request, reply) => {
    try {
      const user = getUser(request);
      const { questionId } = request.params;

      await questionService.deleteQuestion(questionId, user.id);

      logger.info({
        msg: 'Question deleted',
        questionId,
        userId: user.id,
      });

      return await reply.send({
        success: true,
        message: 'Question deleted successfully',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /questions/:questionId/answer - Answer a question (client)
  fastify.post<{ Params: { questionId: string } }>(
    '/:questionId/answer',
    async (request, reply) => {
      try {
        const user = getUser(request);
        const { questionId } = request.params;
        const body = AnswerQuestionSchema.parse(request.body);

        await questionService.answerQuestion({ questionId, answer: body.answer }, user.id);

        logger.info({
          msg: 'Question answered',
          questionId,
          clientId: user.id,
        });

        return await reply.send({
          success: true,
          message: 'Question answered successfully',
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // POST /questions/:questionId/pin - Pin/unpin a question (client)
  fastify.post<{ Params: { questionId: string } }>('/:questionId/pin', async (request, reply) => {
    try {
      const user = getUser(request);
      const { questionId } = request.params;
      const { pinned } = (request.body as { pinned?: boolean }) || {};

      await questionService.togglePinQuestion(questionId, user.id, pinned !== false);

      logger.info({
        msg: pinned !== false ? 'Question pinned' : 'Question unpinned',
        questionId,
        clientId: user.id,
      });

      return await reply.send({
        success: true,
        message: pinned !== false ? 'Question pinned' : 'Question unpinned',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /questions/project/:projectId/stats - Get Q&A stats for a project
  fastify.get<{ Params: { projectId: string } }>(
    '/project/:projectId/stats',
    async (request, reply) => {
      try {
        const { projectId } = request.params;

        const stats = await questionService.getProjectQAStats(projectId);

        return await reply.send({
          success: true,
          stats,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );
}

