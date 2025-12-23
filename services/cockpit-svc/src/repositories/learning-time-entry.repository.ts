/**
 * Learning Time Entry Repository
 */

import {
  type PrismaClient,
  Prisma,
  type LearningTimeEntry,
  type LearningContentType,
} from '@skillancer/database';

export interface CreateLearningTimeEntryInput {
  userId: string;
  skillPodSessionId: string;
  contentType: LearningContentType;
  contentId: string;
  contentTitle: string;
  courseId?: string;
  courseTitle?: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  totalMinutes: number;
  activeMinutes: number;
  skillIds: string[];
  skillNames: string[];
  primarySkillId?: string;
  primarySkillName?: string;
  category?: string;
  subcategory?: string;
  difficulty?: string;
  progressGained?: number;
  isCompleted?: boolean;
  isDeductible?: boolean;
  deductionCategory?: string;
  notes?: string;
}

export class LearningTimeEntryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateLearningTimeEntryInput): Promise<LearningTimeEntry> {
    return this.prisma.learningTimeEntry.create({
      data: {
        userId: input.userId,
        skillPodSessionId: input.skillPodSessionId,
        contentType: input.contentType,
        contentId: input.contentId,
        contentTitle: input.contentTitle,
        courseId: input.courseId,
        courseTitle: input.courseTitle,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        totalMinutes: input.totalMinutes,
        activeMinutes: input.activeMinutes,
        skillIds: input.skillIds,
        skillNames: input.skillNames,
        primarySkillId: input.primarySkillId,
        primarySkillName: input.primarySkillName,
        category: input.category ?? 'Professional Development',
        subcategory: input.subcategory,
        difficulty: input.difficulty,
        progressGained: input.progressGained ?? 0,
        isCompleted: input.isCompleted ?? false,
        isDeductible: input.isDeductible ?? true,
        deductionCategory: input.deductionCategory,
        notes: input.notes,
        syncedAt: new Date(),
      },
    });
  }

  async findById(id: string): Promise<LearningTimeEntry | null> {
    return this.prisma.learningTimeEntry.findUnique({ where: { id } });
  }

  async findBySessionId(sessionId: string): Promise<LearningTimeEntry | null> {
    return this.prisma.learningTimeEntry.findUnique({ where: { skillPodSessionId: sessionId } });
  }

  async findByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<LearningTimeEntry[]> {
    return this.prisma.learningTimeEntry.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'desc' },
    });
  }

  async findByContentId(userId: string, contentId: string): Promise<LearningTimeEntry[]> {
    return this.prisma.learningTimeEntry.findMany({
      where: { userId, contentId },
      orderBy: { date: 'desc' },
    });
  }

  async findRecent(userId: string, limit: number): Promise<LearningTimeEntry[]> {
    return this.prisma.learningTimeEntry.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: limit,
    });
  }

  async getTotalMinutes(userId: string, startDate: Date, endDate: Date): Promise<number> {
    const result = await this.prisma.learningTimeEntry.aggregate({
      where: { userId, date: { gte: startDate, lte: endDate } },
      _sum: { activeMinutes: true },
    });
    return result._sum.activeMinutes ?? 0;
  }
}
