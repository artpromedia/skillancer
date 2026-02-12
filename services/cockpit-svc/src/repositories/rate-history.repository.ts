// @ts-nocheck
/**
 * Rate History Repository
 *
 * Repository for managing rate history entries.
 */

import {
  type PrismaClient,
  Prisma,
  type RateHistory,
  type RateSource,
} from '../types/prisma-shim.js';
import { logger } from '@skillancer/logger';

import type { RateHistoryCreateInput } from '@skillancer/types/cockpit';

export interface RateHistoryFilters {
  skillId?: string;
  source?: RateSource[];
  startDate?: Date;
  endDate?: Date;
}

export class RateHistoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a rate history entry
   */
  async create(data: RateHistoryCreateInput): Promise<RateHistory> {
    try {
      return await this.prisma.rateHistory.create({
        data: {
          userId: data.userId,
          skillId: data.skillId,
          skillName: data.skillName,
          hourlyRate: new Prisma.Decimal(data.hourlyRate),
          currency: data.currency || 'USD',
          source: data.source || 'MANUAL',
          projectId: data.projectId,
          contractId: data.contractId,
          clientRating: data.clientRating ? new Prisma.Decimal(data.clientRating) : null,
          projectSuccess: data.projectSuccess,
          repeatClient: data.repeatClient,
          effectiveDate: data.effectiveDate,
        },
      });
    } catch (error) {
      logger.error('Failed to create rate history entry', { error, data });
      throw error;
    }
  }

  /**
   * Find rate history entry by ID
   */
  async findById(id: string): Promise<RateHistory | null> {
    try {
      return await this.prisma.rateHistory.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error('Failed to find rate history by id', { error, id });
      throw error;
    }
  }

  /**
   * Find recent rate history for a user
   */
  async findRecent(userId: string, months: number = 12): Promise<RateHistory[]> {
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      return await this.prisma.rateHistory.findMany({
        where: {
          userId,
          effectiveDate: { gte: startDate },
        },
        orderBy: { effectiveDate: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to find recent rate history', { error, userId, months });
      throw error;
    }
  }

  /**
   * Find rate history with filters
   */
  async findByUser(userId: string, filters?: RateHistoryFilters): Promise<RateHistory[]> {
    try {
      const where: Prisma.RateHistoryWhereInput = { userId };

      if (filters?.skillId) {
        where.skillId = filters.skillId;
      }
      if (filters?.source && filters.source.length > 0) {
        where.source = { in: filters.source };
      }
      if (filters?.startDate) {
        where.effectiveDate = { gte: filters.startDate };
      }
      if (filters?.endDate) {
        where.effectiveDate = {
          ...((where.effectiveDate as object) || {}),
          lte: filters.endDate,
        };
      }

      return await this.prisma.rateHistory.findMany({
        where,
        orderBy: { effectiveDate: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to find rate history', { error, userId, filters });
      throw error;
    }
  }

  /**
   * Find rate history for a specific skill
   */
  async findBySkill(userId: string, skillId: string, limit: number = 50): Promise<RateHistory[]> {
    try {
      return await this.prisma.rateHistory.findMany({
        where: {
          userId,
          skillId,
        },
        orderBy: { effectiveDate: 'desc' },
        take: limit,
      });
    } catch (error) {
      logger.error('Failed to find rate history for skill', { error, userId, skillId });
      throw error;
    }
  }

  /**
   * Get the most recent rate for a skill
   */
  async findLatestForSkill(userId: string, skillId: string): Promise<RateHistory | null> {
    try {
      return await this.prisma.rateHistory.findFirst({
        where: {
          userId,
          skillId,
        },
        orderBy: { effectiveDate: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to find latest rate for skill', { error, userId, skillId });
      throw error;
    }
  }

  /**
   * Get average rate over a period
   */
  async getAverageRate(userId: string, startDate?: Date, skillId?: string): Promise<number | null> {
    try {
      const where: Prisma.RateHistoryWhereInput = { userId };
      if (startDate) {
        where.effectiveDate = { gte: startDate };
      }
      if (skillId) {
        where.skillId = skillId;
      }

      const result = await this.prisma.rateHistory.aggregate({
        where,
        _avg: { hourlyRate: true },
      });

      return result._avg.hourlyRate?.toNumber() ?? null;
    } catch (error) {
      logger.error('Failed to get average rate', { error, userId, startDate, skillId });
      throw error;
    }
  }

  /**
   * Get rate statistics for a user
   */
  async getStats(
    userId: string,
    startDate?: Date
  ): Promise<{
    count: number;
    avgRate: number | null;
    minRate: number | null;
    maxRate: number | null;
    avgRating: number | null;
    successRate: number | null;
  }> {
    try {
      const where: Prisma.RateHistoryWhereInput = { userId };
      if (startDate) {
        where.effectiveDate = { gte: startDate };
      }

      const [agg, successCount] = await Promise.all([
        this.prisma.rateHistory.aggregate({
          where,
          _count: { id: true },
          _avg: { hourlyRate: true, clientRating: true },
          _min: { hourlyRate: true },
          _max: { hourlyRate: true },
        }),
        this.prisma.rateHistory.count({
          where: {
            ...where,
            projectSuccess: true,
          },
        }),
      ]);

      const successRate = agg._count.id > 0 ? (successCount / agg._count.id) * 100 : null;

      return {
        count: agg._count.id,
        avgRate: agg._avg.hourlyRate?.toNumber() ?? null,
        minRate: agg._min.hourlyRate?.toNumber() ?? null,
        maxRate: agg._max.hourlyRate?.toNumber() ?? null,
        avgRating: agg._avg.clientRating?.toNumber() ?? null,
        successRate,
      };
    } catch (error) {
      logger.error('Failed to get rate stats', { error, userId, startDate });
      throw error;
    }
  }

  /**
   * Get monthly rate averages for charting
   */
  async getMonthlyAverages(
    userId: string,
    months: number = 12
  ): Promise<Array<{ month: string; avgRate: number; count: number }>> {
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);

      const entries = await this.prisma.rateHistory.findMany({
        where: {
          userId,
          effectiveDate: { gte: startDate },
        },
        orderBy: { effectiveDate: 'asc' },
      });

      // Group by month
      const monthly = new Map<string, { rates: number[]; count: number }>();

      for (const entry of entries) {
        const month = entry.effectiveDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
        });

        if (!monthly.has(month)) {
          monthly.set(month, { rates: [], count: 0 });
        }
        const data = monthly.get(month)!;
        data.rates.push(entry.hourlyRate.toNumber());
        data.count++;
      }

      return Array.from(monthly.entries()).map(([month, data]) => ({
        month,
        avgRate: data.rates.reduce((a, b) => a + b, 0) / data.rates.length,
        count: data.count,
      }));
    } catch (error) {
      logger.error('Failed to get monthly averages', { error, userId, months });
      throw error;
    }
  }

  /**
   * Delete rate history entry
   */
  async delete(id: string): Promise<void> {
    try {
      await this.prisma.rateHistory.delete({
        where: { id },
      });
    } catch (error) {
      logger.error('Failed to delete rate history entry', { error, id });
      throw error;
    }
  }

  /**
   * Delete old entries (for cleanup)
   */
  async deleteOld(olderThan: Date): Promise<number> {
    try {
      const result = await this.prisma.rateHistory.deleteMany({
        where: {
          effectiveDate: { lt: olderThan },
        },
      });
      return result.count;
    } catch (error) {
      logger.error('Failed to delete old rate history', { error, olderThan });
      throw error;
    }
  }
}
