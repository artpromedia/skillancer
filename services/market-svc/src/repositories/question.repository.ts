/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * Question Repository
 *
 * Data access layer for project questions (Q&A)
 */

import type { PrismaClient, Prisma } from '../types/prisma-shim.js';

export class QuestionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new question
   */
  async create(data: { jobId: string; askerId: string; question: string; isPublic?: boolean }) {
    return this.prisma.projectQuestion.create({
      data: {
        jobId: data.jobId,
        askerId: data.askerId,
        question: data.question,
        isPublic: data.isPublic ?? true,
      },
      include: {
        asker: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * Find question by ID
   */
  async findById(id: string) {
    return this.prisma.projectQuestion.findUnique({
      where: { id },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            clientId: true,
          },
        },
        asker: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * Find questions for a project
   */
  async findByProjectId(
    jobId: string,
    options: {
      includePrivate?: boolean;
      answered?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const { includePrivate = false, answered, limit = 20, offset = 0 } = options;

    const where: Prisma.ProjectQuestionWhereInput = {
      jobId,
    };

    if (!includePrivate) {
      where.isPublic = true;
    }

    if (answered !== undefined) {
      where.answer = answered ? { not: null } : null;
    }

    const [questions, total] = await Promise.all([
      this.prisma.projectQuestion.findMany({
        where,
        include: {
          asker: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.projectQuestion.count({ where }),
    ]);

    return { questions, total };
  }

  /**
   * Find questions by asker
   */
  async findByAskerId(
    askerId: string,
    options: {
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const { limit = 20, offset = 0 } = options;

    const [questions, total] = await Promise.all([
      this.prisma.projectQuestion.findMany({
        where: { askerId },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.projectQuestion.count({ where: { askerId } }),
    ]);

    return { questions, total };
  }

  /**
   * Answer a question
   */
  async answer(id: string, answer: string) {
    return this.prisma.projectQuestion.update({
      where: { id },
      data: {
        answer,
        answeredAt: new Date(),
      },
    });
  }

  /**
   * Update question
   */
  async update(id: string, data: { question?: string; isPublic?: boolean }) {
    return this.prisma.projectQuestion.update({
      where: { id },
      data,
    });
  }

  /**
   * Pin/unpin a question
   */
  async setPinned(id: string, isPinned: boolean) {
    return this.prisma.projectQuestion.update({
      where: { id },
      data: { isPinned },
    });
  }

  /**
   * Delete question
   */
  async delete(id: string) {
    return this.prisma.projectQuestion.delete({
      where: { id },
    });
  }

  /**
   * Count questions for a project
   */
  async countByProject(jobId: string, options: { answered?: boolean } = {}): Promise<number> {
    const where: Prisma.ProjectQuestionWhereInput = { jobId };

    if (options.answered !== undefined) {
      where.answer = options.answered ? { not: null } : null;
    }

    return this.prisma.projectQuestion.count({ where });
  }

  /**
   * Check if user has already asked a question
   */
  async hasAskedRecently(
    jobId: string,
    askerId: string,
    withinHours: number = 24
  ): Promise<boolean> {
    const since = new Date();
    since.setHours(since.getHours() - withinHours);

    const count = await this.prisma.projectQuestion.count({
      where: {
        jobId,
        askerId,
        createdAt: { gte: since },
      },
    });

    return count > 0;
  }
}
