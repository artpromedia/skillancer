/**
 * @module @skillancer/cockpit-svc/repositories/mileage-log
 * Mileage Log data access layer
 */

import type {
  CreateMileageLogParams,
  UpdateMileageLogParams,
  MileageFilters,
  MileageLogWithDetails,
  MileageSummary,
} from '../types/finance.types.js';
import type { Prisma, PrismaClient, MileageLog, MileagePurpose } from '@skillancer/database';

// 2024 IRS standard mileage rates (cents per mile)
export const MILEAGE_RATES = {
  BUSINESS: 0.67, // 67 cents per mile
  MEDICAL: 0.21, // 21 cents per mile
  CHARITABLE: 0.14, // 14 cents per mile
  PERSONAL: 0, // Not deductible
} as const;

export class MileageLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new mileage log
   */
  async create(data: CreateMileageLogParams): Promise<MileageLog> {
    // Calculate deduction based on purpose and rate
    const rate = MILEAGE_RATES[data.purpose] ?? 0;
    const deductibleAmount = data.distance * rate;

    return this.prisma.mileageLog.create({
      data: {
        userId: data.userId,
        projectId: data.projectId ?? null,
        clientId: data.clientId ?? null,
        date: data.date,
        startLocation: data.startLocation,
        endLocation: data.endLocation,
        distance: data.distance,
        distanceUnit: data.distanceUnit ?? 'MILES',
        purpose: data.purpose,
        notes: data.notes ?? null,
        vehicleInfo: data.vehicleInfo ?? null,
        odometerStart: data.odometerStart ?? null,
        odometerEnd: data.odometerEnd ?? null,
        mileageRate: rate,
        deductibleAmount,
      },
    });
  }

  /**
   * Find mileage log by ID
   */
  async findById(id: string): Promise<MileageLog | null> {
    return this.prisma.mileageLog.findUnique({
      where: { id },
    });
  }

  /**
   * Find mileage log by ID with details
   */
  async findByIdWithDetails(id: string): Promise<MileageLogWithDetails | null> {
    return this.prisma.mileageLog.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, companyName: true } },
        project: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Find mileage logs with filters
   */
  async findByFilters(filters: MileageFilters): Promise<{
    logs: MileageLogWithDetails[];
    total: number;
  }> {
    const where: Prisma.MileageLogWhereInput = {
      userId: filters.userId,
    };

    if (filters.projectId) {
      where.projectId = filters.projectId;
    }

    if (filters.clientId) {
      where.clientId = filters.clientId;
    }

    if (filters.purpose) {
      where.purpose = filters.purpose;
    }

    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) {
        where.date.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.date.lte = filters.endDate;
      }
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.mileageLog.findMany({
        where,
        include: {
          client: { select: { id: true, firstName: true, lastName: true, companyName: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.mileageLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Find all mileage logs for a user
   */
  async findByUserId(userId: string): Promise<MileageLog[]> {
    return this.prisma.mileageLog.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Find recent mileage logs
   */
  async findRecent(userId: string, limit = 10): Promise<MileageLogWithDetails[]> {
    return this.prisma.mileageLog.findMany({
      where: { userId },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, companyName: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
      take: limit,
    });
  }

  /**
   * Get mileage summary for a period
   */
  async getSummary(userId: string, startDate: Date, endDate: Date): Promise<MileageSummary> {
    const logs = await this.prisma.mileageLog.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
      },
      select: {
        distance: true,
        purpose: true,
        deductibleAmount: true,
      },
    });

    let totalMiles = 0;
    let businessMiles = 0;
    let personalMiles = 0;
    let charitableMiles = 0;
    let medicalMiles = 0;
    let estimatedDeduction = 0;

    for (const log of logs) {
      const distance = Number(log.distance);
      totalMiles += distance;
      estimatedDeduction += Number(log.deductibleAmount) || 0;

      switch (log.purpose) {
        case 'BUSINESS':
          businessMiles += distance;
          break;
        case 'PERSONAL':
          personalMiles += distance;
          break;
        case 'CHARITABLE':
          charitableMiles += distance;
          break;
        case 'MEDICAL':
          medicalMiles += distance;
          break;
      }
    }

    return {
      totalMiles,
      businessMiles,
      personalMiles,
      charitableMiles,
      medicalMiles,
      estimatedDeduction,
    };
  }

  /**
   * Get mileage summary by tax year
   */
  async getTaxYearSummary(userId: string, taxYear: number): Promise<MileageSummary> {
    const startDate = new Date(taxYear, 0, 1);
    const endDate = new Date(taxYear, 11, 31, 23, 59, 59, 999);
    return this.getSummary(userId, startDate, endDate);
  }

  /**
   * Update a mileage log
   */
  async update(id: string, data: UpdateMileageLogParams): Promise<MileageLog> {
    const existing = await this.findById(id);
    if (!existing) throw new Error('Mileage log not found');

    // Recalculate deduction if distance or purpose changed
    let deductibleAmount = existing.deductibleAmount;
    let mileageRate = existing.mileageRate;

    const distance = data.distance ?? Number(existing.distance);
    const purpose = data.purpose ?? existing.purpose;

    if (data.distance !== undefined || data.purpose !== undefined) {
      mileageRate = MILEAGE_RATES[purpose] ?? 0;
      deductibleAmount = distance * mileageRate;
    }

    return this.prisma.mileageLog.update({
      where: { id },
      data: {
        projectId: data.projectId,
        clientId: data.clientId,
        date: data.date,
        startLocation: data.startLocation,
        endLocation: data.endLocation,
        distance: data.distance,
        distanceUnit: data.distanceUnit,
        purpose: data.purpose,
        notes: data.notes,
        vehicleInfo: data.vehicleInfo,
        odometerStart: data.odometerStart,
        odometerEnd: data.odometerEnd,
        mileageRate,
        deductibleAmount,
      },
    });
  }

  /**
   * Delete a mileage log
   */
  async delete(id: string): Promise<void> {
    await this.prisma.mileageLog.delete({
      where: { id },
    });
  }

  /**
   * Get frequent routes for suggestions
   */
  async getFrequentRoutes(
    userId: string,
    limit = 5
  ): Promise<Array<{ startLocation: string; endLocation: string; count: number }>> {
    const routes = await this.prisma.mileageLog.groupBy({
      by: ['startLocation', 'endLocation'],
      where: { userId },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    return routes.map((r) => ({
      startLocation: r.startLocation,
      endLocation: r.endLocation,
      count: r._count.id,
    }));
  }

  /**
   * Calculate distance from odometer readings
   */
  calculateDistanceFromOdometer(odometerStart: number, odometerEnd: number): number {
    if (odometerEnd <= odometerStart) {
      throw new Error('End odometer must be greater than start odometer');
    }
    return odometerEnd - odometerStart;
  }
}
