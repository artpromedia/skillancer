// @ts-nocheck
/**
 * Learning Goal Repository
 */

import {
  type PrismaClient,
  type LearningGoal,
  type LearningGoalType,
  type GoalPeriodType,
  GoalStatus,
} from '@skillancer/database';

export interface CreateLearningGoalInput {
  userId: string;
  goalType: LearningGoalType;
  title: string;
  description?: string;
  targetValue: number;
  targetUnit: string;
  targetSkillId?: string;
  targetSkillName?: string;
  targetCourseId?: string;
  targetCertificationId?: string;
  periodType: GoalPeriodType;
  periodStart: Date;
  periodEnd: Date;
  linkedJobCategoryId?: string;
  linkedRateTarget?: number;
  reminderEnabled?: boolean;
  reminderFrequency?: string;
}

export class LearningGoalRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateLearningGoalInput): Promise<LearningGoal> {
    return this.prisma.learningGoal.create({
      data: {
        userId: input.userId,
        goalType: input.goalType,
        title: input.title,
        description: input.description,
        targetValue: input.targetValue,
        targetUnit: input.targetUnit,
        targetSkillId: input.targetSkillId,
        targetSkillName: input.targetSkillName,
        targetCourseId: input.targetCourseId,
        targetCertificationId: input.targetCertificationId,
        periodType: input.periodType,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        currentValue: 0,
        progressPercent: 0,
        status: GoalStatus.ACTIVE,
        linkedJobCategoryId: input.linkedJobCategoryId,
        linkedRateTarget: input.linkedRateTarget,
        reminderEnabled: input.reminderEnabled ?? true,
        reminderFrequency: input.reminderFrequency,
      },
    });
  }

  async findById(id: string): Promise<LearningGoal | null> {
    return this.prisma.learningGoal.findUnique({ where: { id } });
  }

  async findByUser(
    userId: string,
    filters?: { status?: GoalStatus[]; goalType?: LearningGoalType[] }
  ): Promise<LearningGoal[]> {
    return this.prisma.learningGoal.findMany({
      where: {
        userId,
        ...(filters?.status && { status: { in: filters.status } }),
        ...(filters?.goalType && { goalType: { in: filters.goalType } }),
      },
      orderBy: { periodEnd: 'asc' },
    });
  }

  async update(id: string, data: Partial<LearningGoal>): Promise<LearningGoal> {
    return this.prisma.learningGoal.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.learningGoal.delete({ where: { id } });
  }
}

