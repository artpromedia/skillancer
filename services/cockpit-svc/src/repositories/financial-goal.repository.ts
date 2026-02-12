// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/repositories/financial-goal
 * Financial Goal data access layer
 */

import type {
  CreateGoalParams,
  UpdateGoalParams,
  GoalFilters,
  GoalWithProgress,
} from '../types/finance.types.js';
import type {
  FinancialGoal,
  FinancialGoalType,
  FinancialGoalStatus,
} from '../types/prisma-shim.js';
import type { Prisma, PrismaClient } from '../types/prisma-shim.js';

export class FinancialGoalRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new financial goal
   */
  async create(data: CreateGoalParams): Promise<FinancialGoal> {
    return this.prisma.financialGoal.create({
      data: {
        userId: data.userId,
        name: data.name,
        goalType: data.goalType,
        targetAmount: data.targetAmount,
        currentAmount: 0,
        currency: data.currency ?? 'USD',
        periodType: data.periodType ?? null,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        description: data.description ?? null,
        categoryFilter: data.linkedCategoryIds ?? [],
        status: 'IN_PROGRESS',
      },
    });
  }

  /**
   * Find goal by ID
   */
  async findById(id: string): Promise<FinancialGoal | null> {
    return this.prisma.financialGoal.findUnique({
      where: { id },
    });
  }

  /**
   * Find goals by user with filters
   */
  async findByFilters(filters: GoalFilters): Promise<FinancialGoal[]> {
    const where: Prisma.FinancialGoalWhereInput = {
      userId: filters.userId,
    };

    if (filters.goalType) {
      where.goalType = filters.goalType;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.periodType) {
      where.periodType = filters.periodType;
    }

    if (filters.startDate || filters.endDate) {
      where.AND = [];

      if (filters.startDate) {
        where.AND.push({
          OR: [{ endDate: null }, { endDate: { gte: filters.startDate } }],
        });
      }

      if (filters.endDate) {
        where.AND.push({ startDate: { lte: filters.endDate } });
      }
    }

    return this.prisma.financialGoal.findMany({
      where,
      orderBy: [{ status: 'asc' }, { endDate: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Find all goals for a user
   */
  async findByUserId(userId: string, status?: FinancialGoalStatus): Promise<FinancialGoal[]> {
    return this.prisma.financialGoal.findMany({
      where: {
        userId,
        ...(status ? { status } : {}),
      },
      orderBy: [{ status: 'asc' }, { endDate: 'asc' }],
    });
  }

  /**
   * Find active goals with progress calculation
   */
  async findActiveWithProgress(userId: string): Promise<GoalWithProgress[]> {
    const goals = await this.prisma.financialGoal.findMany({
      where: {
        userId,
        status: 'IN_PROGRESS',
      },
    });

    const now = new Date();

    return goals.map((goal) => {
      const currentAmount = Number(goal.currentAmount);
      const targetAmount = Number(goal.targetAmount);

      const progressPercentage =
        targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;

      const remainingAmount = Math.max(targetAmount - currentAmount, 0);

      // Calculate days remaining if end date exists
      let daysRemaining: number | undefined;
      if (goal.endDate) {
        const msRemaining = goal.endDate.getTime() - now.getTime();
        daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
      }

      // Determine trend
      let trend: 'ON_TRACK' | 'AHEAD' | 'BEHIND' | 'AT_RISK' = 'ON_TRACK';

      if (goal.endDate && goal.startDate && daysRemaining !== undefined) {
        const totalDays = Math.ceil(
          (goal.endDate.getTime() - goal.startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const elapsedDays = totalDays - daysRemaining;
        const expectedProgress = totalDays > 0 ? (elapsedDays / totalDays) * 100 : 0;

        if (progressPercentage >= 100) {
          trend = 'AHEAD';
        } else if (progressPercentage >= expectedProgress + 10) {
          trend = 'AHEAD';
        } else if (progressPercentage < expectedProgress - 20) {
          trend = 'AT_RISK';
        } else if (progressPercentage < expectedProgress - 5) {
          trend = 'BEHIND';
        }
      } else if (progressPercentage >= 100) {
        trend = 'AHEAD';
      }

      // Calculate projected completion
      let projectedCompletion: Date | undefined;
      if (progressPercentage > 0 && progressPercentage < 100 && goal.startDate) {
        const startTime = goal.startDate.getTime();
        const elapsedTime = now.getTime() - startTime;
        const progressRate = progressPercentage / elapsedTime;
        const remainingProgress = 100 - progressPercentage;
        const remainingTime = remainingProgress / progressRate;
        projectedCompletion = new Date(now.getTime() + remainingTime);
      }

      return {
        ...goal,
        progressPercentage,
        remainingAmount,
        daysRemaining,
        projectedCompletion,
        trend,
      };
    });
  }

  /**
   * Update a goal
   */
  async update(id: string, data: UpdateGoalParams): Promise<FinancialGoal> {
    return this.prisma.financialGoal.update({
      where: { id },
      data: {
        name: data.name,
        targetAmount: data.targetAmount,
        currentAmount: data.currentAmount,
        periodType: data.periodType,
        startDate: data.startDate,
        endDate: data.endDate,
        description: data.description,
        status: data.status,
        categoryFilter: data.linkedCategoryIds,
      },
    });
  }

  /**
   * Update goal progress (currentAmount)
   */
  async updateProgress(id: string, currentAmount: number): Promise<FinancialGoal> {
    const goal = await this.findById(id);
    if (!goal) throw new Error('Goal not found');

    const targetAmount = Number(goal.targetAmount);

    // Check if goal is completed
    let status: FinancialGoalStatus = goal.status;
    if (currentAmount >= targetAmount && goal.status === 'IN_PROGRESS') {
      status = 'ACHIEVED';
    }

    return this.prisma.financialGoal.update({
      where: { id },
      data: {
        currentAmount,
        status,
        ...(status === 'ACHIEVED' ? { achievedAt: new Date() } : {}),
      },
    });
  }

  /**
   * Recalculate goal progress based on linked categories
   */
  async recalculateProgress(goalId: string): Promise<FinancialGoal> {
    const goal = await this.findById(goalId);
    if (!goal) throw new Error('Goal not found');

    if (!goal.categoryFilter || goal.categoryFilter.length === 0) {
      return goal; // No linked categories to calculate from
    }

    // Get period dates
    let startDate = goal.startDate ?? new Date();
    let endDate = goal.endDate ?? new Date();

    // For periodic goals, use current period
    if (goal.periodType) {
      const now = new Date();
      const periodDates = this.getPeriodDates(now, goal.periodType);
      startDate = periodDates.start;
      endDate = periodDates.end;
    }

    // Sum transactions in linked categories
    const result = await this.prisma.financialTransaction.aggregate({
      where: {
        userId: goal.userId,
        category: { in: goal.categoryFilter },
        date: { gte: startDate, lte: endDate },
        status: 'CONFIRMED',
      },
      _sum: { amount: true },
    });

    const currentAmount = Number(result._sum.amount) || 0;

    return this.updateProgress(goalId, currentAmount);
  }

  /**
   * Mark goal as completed
   */
  async markCompleted(id: string): Promise<FinancialGoal> {
    return this.prisma.financialGoal.update({
      where: { id },
      data: {
        status: 'ACHIEVED',
        achievedAt: new Date(),
      },
    });
  }

  /**
   * Mark goal as abandoned
   */
  async markAbandoned(id: string): Promise<FinancialGoal> {
    return this.prisma.financialGoal.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  /**
   * Delete a goal
   */
  async delete(id: string): Promise<void> {
    await this.prisma.financialGoal.delete({
      where: { id },
    });
  }

  /**
   * Get period start and end dates
   */
  private getPeriodDates(
    date: Date,
    periodType: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM'
  ): { start: Date; end: Date } {
    const year = date.getFullYear();
    const month = date.getMonth();

    switch (periodType) {
      case 'CUSTOM': {
        // For custom period, just return current day
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);

        const end = new Date(date);
        end.setHours(23, 59, 59, 999);

        return { start, end };
      }

      case 'MONTHLY': {
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
        return { start, end };
      }

      case 'QUARTERLY': {
        const quarter = Math.floor(month / 3);
        const start = new Date(year, quarter * 3, 1);
        const end = new Date(year, quarter * 3 + 3, 0, 23, 59, 59, 999);
        return { start, end };
      }

      case 'YEARLY': {
        const start = new Date(year, 0, 1);
        const end = new Date(year, 11, 31, 23, 59, 59, 999);
        return { start, end };
      }

      default:
        return { start: date, end: date };
    }
  }
}
