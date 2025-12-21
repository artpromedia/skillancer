/**
 * @module @skillancer/cockpit-svc/services/financial-goal
 * Financial Goal Service - Goal tracking and management
 */

import { FinanceError, FinanceErrorCode } from '../errors/finance.errors.js';
import { FinancialGoalRepository } from '../repositories/index.js';

import type {
  CreateGoalParams,
  UpdateGoalParams,
  GoalFilters,
  GoalWithProgress,
} from '../types/finance.types.js';
import type { PrismaClient, FinancialGoal } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

export class FinancialGoalService {
  private readonly goalRepository: FinancialGoalRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger
  ) {
    this.goalRepository = new FinancialGoalRepository(prisma);
  }

  /**
   * Create a new financial goal
   */
  async createGoal(params: CreateGoalParams): Promise<FinancialGoal> {
    // Validate amounts
    if (params.targetAmount <= 0) {
      throw new FinanceError(FinanceErrorCode.INVALID_GOAL_AMOUNT);
    }

    // Validate dates
    if (params.endDate && params.endDate < params.startDate) {
      throw new FinanceError(FinanceErrorCode.INVALID_GOAL_DATES);
    }

    // Validate linked categories if provided
    if (params.linkedCategoryIds && params.linkedCategoryIds.length > 0) {
      const categories = await this.prisma.transactionCategory.findMany({
        where: {
          id: { in: params.linkedCategoryIds },
          userId: params.userId,
        },
      });

      if (categories.length !== params.linkedCategoryIds.length) {
        throw new FinanceError(FinanceErrorCode.CATEGORY_NOT_FOUND);
      }
    }

    const goal = await this.goalRepository.create(params);

    this.logger.info(
      { goalId: goal.id, userId: params.userId, type: params.goalType },
      'Financial goal created'
    );

    return goal;
  }

  /**
   * Get goal by ID
   */
  async getGoal(goalId: string, userId: string): Promise<FinancialGoal> {
    const goal = await this.goalRepository.findById(goalId);

    if (!goal || goal.userId !== userId) {
      throw new FinanceError(FinanceErrorCode.GOAL_NOT_FOUND);
    }

    return goal;
  }

  /**
   * List goals with filters
   */
  async listGoals(filters: GoalFilters): Promise<FinancialGoal[]> {
    return this.goalRepository.findByFilters(filters);
  }

  /**
   * Get active goals with progress
   */
  async getActiveGoalsWithProgress(userId: string): Promise<GoalWithProgress[]> {
    return this.goalRepository.findActiveWithProgress(userId);
  }

  /**
   * Update a goal
   */
  async updateGoal(
    goalId: string,
    userId: string,
    params: UpdateGoalParams
  ): Promise<FinancialGoal> {
    const existing = await this.goalRepository.findById(goalId);

    if (!existing || existing.userId !== userId) {
      throw new FinanceError(FinanceErrorCode.GOAL_NOT_FOUND);
    }

    // Validate amounts if provided
    if (params.targetAmount !== undefined && params.targetAmount <= 0) {
      throw new FinanceError(FinanceErrorCode.INVALID_GOAL_AMOUNT);
    }

    // Validate dates if provided
    const startDate = params.startDate ?? existing.startDate;
    const endDate = params.endDate ?? existing.endDate;

    if (endDate && endDate < startDate) {
      throw new FinanceError(FinanceErrorCode.INVALID_GOAL_DATES);
    }

    // Validate linked categories if changed
    if (params.linkedCategoryIds && params.linkedCategoryIds.length > 0) {
      const categories = await this.prisma.transactionCategory.findMany({
        where: {
          id: { in: params.linkedCategoryIds },
          userId,
        },
      });

      if (categories.length !== params.linkedCategoryIds.length) {
        throw new FinanceError(FinanceErrorCode.CATEGORY_NOT_FOUND);
      }
    }

    const goal = await this.goalRepository.update(goalId, params);

    this.logger.info({ goalId, userId }, 'Financial goal updated');

    return goal;
  }

  /**
   * Update goal progress
   */
  async updateProgress(
    goalId: string,
    userId: string,
    currentAmount: number
  ): Promise<FinancialGoal> {
    const goal = await this.goalRepository.findById(goalId);

    if (!goal || goal.userId !== userId) {
      throw new FinanceError(FinanceErrorCode.GOAL_NOT_FOUND);
    }

    if (goal.status !== 'ACTIVE') {
      throw new FinanceError(FinanceErrorCode.GOAL_ALREADY_COMPLETED);
    }

    const updated = await this.goalRepository.updateProgress(goalId, currentAmount);

    if (updated.status === 'COMPLETED') {
      this.logger.info({ goalId, userId }, 'Financial goal completed!');
    }

    return updated;
  }

  /**
   * Recalculate goal progress from linked categories
   */
  async recalculateProgress(goalId: string, userId: string): Promise<FinancialGoal> {
    const goal = await this.goalRepository.findById(goalId);

    if (!goal || goal.userId !== userId) {
      throw new FinanceError(FinanceErrorCode.GOAL_NOT_FOUND);
    }

    const updated = await this.goalRepository.recalculateProgress(goalId);

    this.logger.info({ goalId, newAmount: updated.currentAmount }, 'Goal progress recalculated');

    return updated;
  }

  /**
   * Mark goal as completed
   */
  async completeGoal(goalId: string, userId: string): Promise<FinancialGoal> {
    const goal = await this.goalRepository.findById(goalId);

    if (!goal || goal.userId !== userId) {
      throw new FinanceError(FinanceErrorCode.GOAL_NOT_FOUND);
    }

    if (goal.status === 'COMPLETED') {
      throw new FinanceError(FinanceErrorCode.GOAL_ALREADY_COMPLETED);
    }

    const completed = await this.goalRepository.markCompleted(goalId);

    this.logger.info({ goalId, userId }, 'Financial goal marked as completed');

    return completed;
  }

  /**
   * Abandon a goal
   */
  async abandonGoal(goalId: string, userId: string): Promise<FinancialGoal> {
    const goal = await this.goalRepository.findById(goalId);

    if (!goal || goal.userId !== userId) {
      throw new FinanceError(FinanceErrorCode.GOAL_NOT_FOUND);
    }

    if (goal.status === 'COMPLETED') {
      throw new FinanceError(FinanceErrorCode.GOAL_ALREADY_COMPLETED);
    }

    const abandoned = await this.goalRepository.markAbandoned(goalId);

    this.logger.info({ goalId, userId }, 'Financial goal abandoned');

    return abandoned;
  }

  /**
   * Delete a goal
   */
  async deleteGoal(goalId: string, userId: string): Promise<void> {
    const goal = await this.goalRepository.findById(goalId);

    if (!goal || goal.userId !== userId) {
      throw new FinanceError(FinanceErrorCode.GOAL_NOT_FOUND);
    }

    await this.goalRepository.delete(goalId);

    this.logger.info({ goalId, userId }, 'Financial goal deleted');
  }

  /**
   * Get goal summary dashboard data
   */
  async getGoalSummary(userId: string): Promise<{
    activeCount: number;
    completedCount: number;
    totalTargetAmount: number;
    totalCurrentAmount: number;
    overallProgress: number;
    topGoals: GoalWithProgress[];
  }> {
    const activeGoals = await this.goalRepository.findActiveWithProgress(userId);
    const completedGoals = await this.goalRepository.findByUserId(userId, 'COMPLETED');

    const totalTargetAmount = activeGoals.reduce((sum, g) => sum + Number(g.targetAmount), 0);
    const totalCurrentAmount = activeGoals.reduce((sum, g) => sum + Number(g.currentAmount), 0);
    const overallProgress =
      totalTargetAmount > 0 ? (totalCurrentAmount / totalTargetAmount) * 100 : 0;

    return {
      activeCount: activeGoals.length,
      completedCount: completedGoals.length,
      totalTargetAmount,
      totalCurrentAmount,
      overallProgress,
      topGoals: activeGoals.slice(0, 5),
    };
  }
}
