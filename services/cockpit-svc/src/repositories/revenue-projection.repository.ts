/**
 * Revenue Projection Repository
 *
 * Repository for managing revenue projection scenarios.
 */

import {
  type PrismaClient,
  Prisma,
  type RevenueProjection,
  type ScenarioType,
} from '@skillancer/database';
import { logger } from '@skillancer/logger';

import type { ProjectionCreateInput } from '@skillancer/types/cockpit';

export class RevenueProjectionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a revenue projection
   */
  async create(data: ProjectionCreateInput): Promise<RevenueProjection> {
    try {
      return await this.prisma.revenueProjection.create({
        data: {
          userId: data.userId,
          scenarioName: data.scenarioName,
          scenarioType: data.scenarioType,
          hourlyRate: new Prisma.Decimal(data.hourlyRate),
          hoursPerWeek: new Prisma.Decimal(data.hoursPerWeek),
          weeksPerYear: new Prisma.Decimal(data.weeksPerYear || 48),
          utilizationRate: new Prisma.Decimal(data.utilizationRate || 75),
          weeklyRevenue: new Prisma.Decimal(data.weeklyRevenue),
          monthlyRevenue: new Prisma.Decimal(data.monthlyRevenue),
          yearlyRevenue: new Prisma.Decimal(data.yearlyRevenue),
          monthlyExpenses: data.monthlyExpenses ? new Prisma.Decimal(data.monthlyExpenses) : null,
          yearlyExpenses: data.yearlyExpenses ? new Prisma.Decimal(data.yearlyExpenses) : null,
          monthlyNetIncome: data.monthlyNetIncome
            ? new Prisma.Decimal(data.monthlyNetIncome)
            : null,
          yearlyNetIncome: data.yearlyNetIncome ? new Prisma.Decimal(data.yearlyNetIncome) : null,
          vsCurrentMonthly: data.vsCurrentMonthly
            ? new Prisma.Decimal(data.vsCurrentMonthly)
            : null,
          vsCurrentYearly: data.vsCurrentYearly ? new Prisma.Decimal(data.vsCurrentYearly) : null,
          isActive: data.isActive || false,
        },
      });
    } catch (error) {
      logger.error('Failed to create revenue projection', { error, data });
      throw error;
    }
  }

  /**
   * Create or update a projection (for recalculation)
   */
  async upsert(data: ProjectionCreateInput): Promise<RevenueProjection> {
    try {
      // Find existing projection of same type
      const existing = await this.prisma.revenueProjection.findFirst({
        where: {
          userId: data.userId,
          scenarioType: data.scenarioType,
          scenarioName: data.scenarioType === 'CUSTOM' ? data.scenarioName : undefined,
        },
      });

      if (existing) {
        return await this.prisma.revenueProjection.update({
          where: { id: existing.id },
          data: {
            scenarioName: data.scenarioName,
            hourlyRate: new Prisma.Decimal(data.hourlyRate),
            hoursPerWeek: new Prisma.Decimal(data.hoursPerWeek),
            weeksPerYear: new Prisma.Decimal(data.weeksPerYear || 48),
            utilizationRate: new Prisma.Decimal(data.utilizationRate || 75),
            weeklyRevenue: new Prisma.Decimal(data.weeklyRevenue),
            monthlyRevenue: new Prisma.Decimal(data.monthlyRevenue),
            yearlyRevenue: new Prisma.Decimal(data.yearlyRevenue),
            monthlyExpenses: data.monthlyExpenses ? new Prisma.Decimal(data.monthlyExpenses) : null,
            yearlyExpenses: data.yearlyExpenses ? new Prisma.Decimal(data.yearlyExpenses) : null,
            monthlyNetIncome: data.monthlyNetIncome
              ? new Prisma.Decimal(data.monthlyNetIncome)
              : null,
            yearlyNetIncome: data.yearlyNetIncome ? new Prisma.Decimal(data.yearlyNetIncome) : null,
            vsCurrentMonthly: data.vsCurrentMonthly
              ? new Prisma.Decimal(data.vsCurrentMonthly)
              : null,
            vsCurrentYearly: data.vsCurrentYearly ? new Prisma.Decimal(data.vsCurrentYearly) : null,
            isActive: data.isActive,
          },
        });
      }

      return await this.create(data);
    } catch (error) {
      logger.error('Failed to upsert revenue projection', { error, data });
      throw error;
    }
  }

  /**
   * Find projection by ID
   */
  async findById(id: string): Promise<RevenueProjection | null> {
    try {
      return await this.prisma.revenueProjection.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error('Failed to find projection by id', { error, id });
      throw error;
    }
  }

  /**
   * Find all projections for a user
   */
  async findByUser(userId: string): Promise<RevenueProjection[]> {
    try {
      return await this.prisma.revenueProjection.findMany({
        where: { userId },
        orderBy: { scenarioType: 'asc' },
      });
    } catch (error) {
      logger.error('Failed to find projections for user', { error, userId });
      throw error;
    }
  }

  /**
   * Find projection by scenario type
   */
  async findByType(userId: string, type: ScenarioType): Promise<RevenueProjection | null> {
    try {
      return await this.prisma.revenueProjection.findFirst({
        where: {
          userId,
          scenarioType: type,
        },
      });
    } catch (error) {
      logger.error('Failed to find projection by type', { error, userId, type });
      throw error;
    }
  }

  /**
   * Find active projection
   */
  async findActive(userId: string): Promise<RevenueProjection | null> {
    try {
      return await this.prisma.revenueProjection.findFirst({
        where: {
          userId,
          isActive: true,
        },
      });
    } catch (error) {
      logger.error('Failed to find active projection', { error, userId });
      throw error;
    }
  }

  /**
   * Find custom projections
   */
  async findCustom(userId: string): Promise<RevenueProjection[]> {
    try {
      return await this.prisma.revenueProjection.findMany({
        where: {
          userId,
          scenarioType: 'CUSTOM',
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to find custom projections', { error, userId });
      throw error;
    }
  }

  /**
   * Set a projection as active (deactivate others)
   */
  async setActive(userId: string, projectionId: string): Promise<RevenueProjection> {
    try {
      // Deactivate all other projections
      await this.prisma.revenueProjection.updateMany({
        where: {
          userId,
          id: { not: projectionId },
        },
        data: { isActive: false },
      });

      // Activate the selected one
      return await this.prisma.revenueProjection.update({
        where: { id: projectionId },
        data: { isActive: true },
      });
    } catch (error) {
      logger.error('Failed to set active projection', { error, userId, projectionId });
      throw error;
    }
  }

  /**
   * Update a projection
   */
  async update(
    id: string,
    data: Partial<{
      scenarioName: string;
      hourlyRate: number;
      hoursPerWeek: number;
      weeksPerYear: number;
      utilizationRate: number;
      monthlyExpenses: number;
      isActive: boolean;
    }>
  ): Promise<RevenueProjection> {
    try {
      const updateData: Prisma.RevenueProjectionUpdateInput = {};

      if (data.scenarioName !== undefined) {
        updateData.scenarioName = data.scenarioName;
      }
      if (data.hourlyRate !== undefined) {
        updateData.hourlyRate = new Prisma.Decimal(data.hourlyRate);
      }
      if (data.hoursPerWeek !== undefined) {
        updateData.hoursPerWeek = new Prisma.Decimal(data.hoursPerWeek);
      }
      if (data.weeksPerYear !== undefined) {
        updateData.weeksPerYear = new Prisma.Decimal(data.weeksPerYear);
      }
      if (data.utilizationRate !== undefined) {
        updateData.utilizationRate = new Prisma.Decimal(data.utilizationRate);
      }
      if (data.monthlyExpenses !== undefined) {
        updateData.monthlyExpenses = new Prisma.Decimal(data.monthlyExpenses);
        updateData.yearlyExpenses = new Prisma.Decimal(data.monthlyExpenses * 12);
      }
      if (data.isActive !== undefined) {
        updateData.isActive = data.isActive;
      }

      // Recalculate revenues if rate or hours changed
      if (
        data.hourlyRate !== undefined ||
        data.hoursPerWeek !== undefined ||
        data.weeksPerYear !== undefined ||
        data.utilizationRate !== undefined
      ) {
        const current = await this.findById(id);
        if (current) {
          const hourlyRate = data.hourlyRate ?? current.hourlyRate.toNumber();
          const hoursPerWeek = data.hoursPerWeek ?? current.hoursPerWeek.toNumber();
          const weeksPerYear = data.weeksPerYear ?? current.weeksPerYear.toNumber();
          const utilizationRate = data.utilizationRate ?? current.utilizationRate.toNumber();

          const billableHours = hoursPerWeek * (utilizationRate / 100);
          const weeklyRevenue = hourlyRate * billableHours;
          const monthlyRevenue = weeklyRevenue * 4.33;
          const yearlyRevenue = weeklyRevenue * weeksPerYear;

          updateData.weeklyRevenue = new Prisma.Decimal(weeklyRevenue);
          updateData.monthlyRevenue = new Prisma.Decimal(monthlyRevenue);
          updateData.yearlyRevenue = new Prisma.Decimal(yearlyRevenue);

          const monthlyExpenses = data.monthlyExpenses ?? current.monthlyExpenses?.toNumber() ?? 0;
          const yearlyExpenses = monthlyExpenses * 12;
          updateData.monthlyNetIncome = new Prisma.Decimal(monthlyRevenue - monthlyExpenses);
          updateData.yearlyNetIncome = new Prisma.Decimal(yearlyRevenue - yearlyExpenses);
        }
      }

      return await this.prisma.revenueProjection.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      logger.error('Failed to update projection', { error, id, data });
      throw error;
    }
  }

  /**
   * Delete a projection
   */
  async delete(id: string): Promise<void> {
    try {
      await this.prisma.revenueProjection.delete({
        where: { id },
      });
    } catch (error) {
      logger.error('Failed to delete projection', { error, id });
      throw error;
    }
  }

  /**
   * Delete all projections for a user
   */
  async deleteByUser(userId: string): Promise<number> {
    try {
      const result = await this.prisma.revenueProjection.deleteMany({
        where: { userId },
      });
      return result.count;
    } catch (error) {
      logger.error('Failed to delete projections for user', { error, userId });
      throw error;
    }
  }

  /**
   * Delete custom projections only
   */
  async deleteCustom(userId: string): Promise<number> {
    try {
      const result = await this.prisma.revenueProjection.deleteMany({
        where: {
          userId,
          scenarioType: 'CUSTOM',
        },
      });
      return result.count;
    } catch (error) {
      logger.error('Failed to delete custom projections', { error, userId });
      throw error;
    }
  }
}
