// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/**
 * @module @skillancer/market-svc/repositories/learning-activity
 * Learning Activity Repository
 *
 * NOTE: ESLint disabled for Prisma type errors - will be resolved after database migration
 */

import type { PrismaClient, LearningActivity } from '@skillancer/database';

export interface UpsertLearningActivityData {
  userId: string;
  totalHoursLearned?: number;
  totalCourses?: number;
  completedCourses?: number;
  totalAssessments?: number;
  passedAssessments?: number;
  totalCredentials?: number;
  activeCredentials?: number;
  currentStreak?: number;
  longestStreak?: number;
  lastLearningDate?: Date | null;
  hoursLast30Days?: number;
  hoursLast90Days?: number;
  hoursLast365Days?: number;
  showOnProfile?: boolean;
  showHours?: boolean;
  showStreak?: boolean;
}

export class LearningActivityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsert(data: UpsertLearningActivityData): Promise<LearningActivity> {
    const existing = await this.findByUser(data.userId);

    if (existing) {
      return this.prisma.learningActivity.update({
        where: { userId: data.userId },
        data: {
          totalHoursLearned: data.totalHoursLearned ?? existing.totalHoursLearned,
          totalCourses: data.totalCourses ?? existing.totalCourses,
          completedCourses: data.completedCourses ?? existing.completedCourses,
          totalAssessments: data.totalAssessments ?? existing.totalAssessments,
          passedAssessments: data.passedAssessments ?? existing.passedAssessments,
          totalCredentials: data.totalCredentials ?? existing.totalCredentials,
          activeCredentials: data.activeCredentials ?? existing.activeCredentials,
          currentStreak: data.currentStreak ?? existing.currentStreak,
          longestStreak: data.longestStreak
            ? Math.max(data.longestStreak, Number(existing.longestStreak))
            : existing.longestStreak,
          lastLearningDate:
            data.lastLearningDate !== undefined ? data.lastLearningDate : existing.lastLearningDate,
          hoursLast30Days: data.hoursLast30Days ?? existing.hoursLast30Days,
          hoursLast90Days: data.hoursLast90Days ?? existing.hoursLast90Days,
          hoursLast365Days: data.hoursLast365Days ?? existing.hoursLast365Days,
          showOnProfile: data.showOnProfile ?? existing.showOnProfile,
          showHours: data.showHours ?? existing.showHours,
          showStreak: data.showStreak ?? existing.showStreak,
        },
      });
    }

    return this.prisma.learningActivity.create({
      data: {
        userId: data.userId,
        totalHoursLearned: data.totalHoursLearned ?? 0,
        totalCourses: data.totalCourses ?? 0,
        completedCourses: data.completedCourses ?? 0,
        totalAssessments: data.totalAssessments ?? 0,
        passedAssessments: data.passedAssessments ?? 0,
        totalCredentials: data.totalCredentials ?? 0,
        activeCredentials: data.activeCredentials ?? 0,
        currentStreak: data.currentStreak ?? 0,
        longestStreak: data.longestStreak ?? 0,
        lastLearningDate: data.lastLearningDate,
        hoursLast30Days: data.hoursLast30Days ?? 0,
        hoursLast90Days: data.hoursLast90Days ?? 0,
        hoursLast365Days: data.hoursLast365Days ?? 0,
        showOnProfile: data.showOnProfile ?? true,
        showHours: data.showHours ?? true,
        showStreak: data.showStreak ?? true,
      },
    });
  }

  async findByUser(userId: string): Promise<LearningActivity | null> {
    return this.prisma.learningActivity.findUnique({
      where: { userId },
    });
  }

  async updateVisibility(
    userId: string,
    options: { showOnProfile?: boolean; showHours?: boolean; showStreak?: boolean }
  ): Promise<LearningActivity | null> {
    const existing = await this.findByUser(userId);
    if (!existing) return null;

    return this.prisma.learningActivity.update({
      where: { userId },
      data: options,
    });
  }

  async incrementStreak(userId: string): Promise<LearningActivity> {
    const existing = await this.findByUser(userId);

    if (!existing) {
      return this.prisma.learningActivity.create({
        data: {
          userId,
          totalHoursLearned: 0,
          totalCourses: 0,
          completedCourses: 0,
          totalAssessments: 0,
          passedAssessments: 0,
          totalCredentials: 0,
          activeCredentials: 0,
          currentStreak: 1,
          longestStreak: 1,
          lastLearningDate: new Date(),
        },
      });
    }

    const newStreak = Number(existing.currentStreak) + 1;
    const longestStreak = Math.max(newStreak, Number(existing.longestStreak));

    return this.prisma.learningActivity.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        longestStreak,
        lastLearningDate: new Date(),
      },
    });
  }

  async resetStreak(userId: string): Promise<LearningActivity | null> {
    const existing = await this.findByUser(userId);
    if (!existing) return null;

    return this.prisma.learningActivity.update({
      where: { userId },
      data: { currentStreak: 0 },
    });
  }

  async getUsersWithActiveStreaks(): Promise<LearningActivity[]> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    return this.prisma.learningActivity.findMany({
      where: {
        currentStreak: { gt: 0 },
        lastLearningDate: { lt: yesterday },
      },
    });
  }
}
