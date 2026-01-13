/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * Question Service
 *
 * Manages project Q&A:
 * - Ask questions about projects
 * - Answer questions as project owner
 * - Pin important questions
 */

import { ProjectService } from './project.service.js';
import { BiddingError, BiddingErrorCode } from '../errors/bidding.errors.js';
import { QuestionRepository } from '../repositories/question.repository.js';

import type {
  AskQuestionInput,
  AnswerQuestionInput,
  QuestionWithDetails,
  PaginatedResult,
} from '../types/bidding.types.js';
import type { PrismaClient } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Constants
const MAX_QUESTIONS_PER_PROJECT = 100;
const QUESTIONS_PER_USER_PER_PROJECT = 5;
const RATE_LIMIT_HOURS = 1;

export class QuestionService {
  private readonly repository: QuestionRepository;
  private readonly projectService: ProjectService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {
    this.repository = new QuestionRepository(prisma);
    this.projectService = new ProjectService(prisma, redis, logger);
  }

  /**
   * Ask a question about a project
   */
  async askQuestion(askerId: string, input: AskQuestionInput) {
    // Validate project exists and is published
    const project = await this.projectService.getProject(input.jobId);

    if (project.status !== 'PUBLISHED') {
      throw new BiddingError(
        BiddingErrorCode.PROJECT_NOT_OPEN,
        'Cannot ask questions on closed projects'
      );
    }

    // Clients cannot ask questions on their own projects
    if (project.clientId === askerId) {
      throw new BiddingError(
        BiddingErrorCode.VALIDATION_ERROR,
        'Cannot ask questions on your own project'
      );
    }

    // Check question limits
    const totalQuestions = await this.repository.countByProject(input.jobId);
    if (totalQuestions >= MAX_QUESTIONS_PER_PROJECT) {
      throw new BiddingError(
        BiddingErrorCode.QUESTION_LIMIT_REACHED,
        'Maximum questions for this project reached'
      );
    }

    // Check rate limit
    const recentlyAsked = await this.repository.hasAskedRecently(
      input.jobId,
      askerId,
      RATE_LIMIT_HOURS
    );
    if (recentlyAsked) {
      throw new BiddingError(
        BiddingErrorCode.RATE_LIMITED,
        `Please wait ${RATE_LIMIT_HOURS} hour(s) before asking another question`
      );
    }

    // Check per-user limit for this project
    const userQuestions = await this.prisma.projectQuestion.count({
      where: { jobId: input.jobId, askerId },
    });
    if (userQuestions >= QUESTIONS_PER_USER_PER_PROJECT) {
      throw new BiddingError(
        BiddingErrorCode.QUESTION_LIMIT_REACHED,
        'Maximum questions per user for this project reached'
      );
    }

    // Create question
    const question = await this.repository.create({
      jobId: input.jobId,
      askerId,
      question: input.question,
      isPublic: input.isPublic ?? true,
    });

    // Notify project owner
    await this.publishQuestionNotification('QUESTION_ASKED', project.clientId as string, {
      questionId: question.id,
      projectId: input.jobId,
      projectTitle: project.title,
      askerName: question.asker.displayName,
      isPublic: input.isPublic,
    });

    this.logger.info({
      msg: 'Question asked',
      questionId: question.id,
      projectId: input.jobId,
      askerId,
    });

    return question;
  }

  /**
   * Get a question by ID
   */
  async getQuestion(questionId: string, userId?: string) {
    const question = await this.repository.findById(questionId);

    if (!question) {
      throw new BiddingError(BiddingErrorCode.QUESTION_NOT_FOUND);
    }

    // Private questions only visible to asker or project owner
    if (!question.isPublic) {
      if (userId !== question.askerId && userId !== question.job.clientId) {
        throw new BiddingError(BiddingErrorCode.FORBIDDEN);
      }
    }

    return this.mapQuestionToDetails(question);
  }

  /**
   * Answer a question
   */
  async answerQuestion(input: AnswerQuestionInput, clientId: string) {
    const question = await this.repository.findById(input.questionId);

    if (!question) {
      throw new BiddingError(BiddingErrorCode.QUESTION_NOT_FOUND);
    }

    // Only project owner can answer
    if (question.job.clientId !== clientId) {
      throw new BiddingError(BiddingErrorCode.NOT_PROJECT_OWNER);
    }

    // Check if already answered
    if (question.answer) {
      throw new BiddingError(BiddingErrorCode.QUESTION_ALREADY_ANSWERED);
    }

    await this.repository.answer(input.questionId, input.answer);

    // Notify asker
    await this.publishQuestionNotification('QUESTION_ANSWERED', question.askerId, {
      questionId: input.questionId,
      projectId: question.jobId,
      projectTitle: question.job.title,
    });

    this.logger.info({
      msg: 'Question answered',
      questionId: input.questionId,
      clientId,
    });
  }

  /**
   * Update a question
   */
  async updateQuestion(
    questionId: string,
    userId: string,
    data: { question?: string; isPublic?: boolean }
  ) {
    const question = await this.repository.findById(questionId);

    if (!question) {
      throw new BiddingError(BiddingErrorCode.QUESTION_NOT_FOUND);
    }

    // Only asker can update question
    if (question.askerId !== userId) {
      throw new BiddingError(BiddingErrorCode.FORBIDDEN);
    }

    // Cannot update answered questions
    if (question.answer) {
      throw new BiddingError(BiddingErrorCode.VALIDATION_ERROR, 'Cannot update answered questions');
    }

    return this.repository.update(questionId, data);
  }

  /**
   * Delete a question
   */
  async deleteQuestion(questionId: string, userId: string) {
    const question = await this.repository.findById(questionId);

    if (!question) {
      throw new BiddingError(BiddingErrorCode.QUESTION_NOT_FOUND);
    }

    // Asker or project owner can delete
    if (question.askerId !== userId && question.job.clientId !== userId) {
      throw new BiddingError(BiddingErrorCode.FORBIDDEN);
    }

    await this.repository.delete(questionId);

    this.logger.info({
      msg: 'Question deleted',
      questionId,
      userId,
    });
  }

  /**
   * Pin/unpin a question (client only)
   */
  async togglePinQuestion(questionId: string, clientId: string, pinned: boolean) {
    const question = await this.repository.findById(questionId);

    if (!question) {
      throw new BiddingError(BiddingErrorCode.QUESTION_NOT_FOUND);
    }

    if (question.job.clientId !== clientId) {
      throw new BiddingError(BiddingErrorCode.NOT_PROJECT_OWNER);
    }

    await this.repository.setPinned(questionId, pinned);

    this.logger.info({
      msg: pinned ? 'Question pinned' : 'Question unpinned',
      questionId,
      clientId,
    });
  }

  /**
   * Get questions for a project
   */
  async getProjectQuestions(
    projectId: string,
    userId?: string,
    options: { page?: number; limit?: number; answered?: boolean } = {}
  ): Promise<PaginatedResult<QuestionWithDetails>> {
    const { page = 1, limit = 20, answered } = options;
    const offset = (page - 1) * limit;

    // Check if user is project owner to include private questions
    const project = await this.projectService.getProject(projectId);
    const includePrivate = userId === project.clientId;

    const findOptions: {
      includePrivate?: boolean;
      answered?: boolean;
      limit?: number;
      offset?: number;
    } = {
      includePrivate,
      limit,
      offset,
    };
    if (answered !== undefined) {
      findOptions.answered = answered;
    }
    const result = await this.repository.findByProjectId(projectId, findOptions);

    const questions: QuestionWithDetails[] = result.questions.map((q) =>
      this.mapQuestionToDetails(q)
    );

    return {
      data: questions,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
      hasMore: page * limit < result.total,
    };
  }

  /**
   * Get questions asked by user
   */
  async getUserQuestions(
    userId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<PaginatedResult<QuestionWithDetails>> {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const result = await this.repository.findByAskerId(userId, { limit, offset });

    const questions: QuestionWithDetails[] = result.questions.map((q) =>
      this.mapQuestionToDetails(q)
    );

    return {
      data: questions,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
      hasMore: page * limit < result.total,
    };
  }

  /**
   * Get Q&A statistics for a project
   */
  async getProjectQAStats(projectId: string) {
    const [totalQuestions, answeredQuestions] = await Promise.all([
      this.repository.countByProject(projectId),
      this.repository.countByProject(projectId, { answered: true }),
    ]);

    return {
      totalQuestions,
      answeredQuestions,
      unansweredQuestions: totalQuestions - answeredQuestions,
      answerRate: totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0,
    };
  }

  /**
   * Map question to details format
   */
  private mapQuestionToDetails(q: Record<string, unknown>): QuestionWithDetails {
    const asker = q.asker as Record<string, unknown>;
    const job = q.job as Record<string, unknown>;

    return {
      id: q.id as string,
      jobId: q.jobId as string,
      askerId: q.askerId as string,
      question: q.question as string,
      answer: q.answer as string | undefined,
      isPublic: q.isPublic as boolean,
      isPinned: q.isPinned as boolean,
      answeredAt: q.answeredAt as Date | undefined,
      createdAt: q.createdAt as Date,
      asker: {
        id: asker?.id as string,
        displayName: asker?.displayName as string,
        avatarUrl: asker?.avatarUrl as string | undefined,
      },
      project: job
        ? {
            id: job.id as string,
            title: job.title as string,
            slug: job.slug as string,
          }
        : undefined,
    };
  }

  /**
   * Publish question notification
   */
  private async publishQuestionNotification(
    type: string,
    recipientId: string,
    data: Record<string, unknown>
  ) {
    const notification = {
      type,
      recipientId,
      data,
      timestamp: new Date().toISOString(),
    };

    await this.redis.lpush('question:notifications', JSON.stringify(notification));
  }
}
