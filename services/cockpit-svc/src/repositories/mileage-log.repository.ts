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
import type { MileageLog, MileagePurpose } from '../types/prisma-shim.js';
import type { Prisma, PrismaClient } from '../types/prisma-shim.js';

// 2024 IRS standard mileage rates (cents per mile)
export const MILEAGE_RATES = {
  CLIENT_MEETING: 0.67, // 67 cents per mile
  BUSINESS_ERRAND: 0.67, // 67 cents per mile
  TRAVEL: 0.67, // 67 cents per mile
  OTHER: 0, // Not deductible by default
} as const;

export class MileageLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new mileage log
   */
  async create(data: CreateMileageLogParams): Promise<MileageLog> {
    // Calculate deduction based on purpose and rate
    const rate = MILEAGE_RATES[data.purpose] ?? 0;
    const deductionAmount = data.miles * rate;

    return this.prisma.mileageLog.create({
      data: {
        userId: data.userId,
        projectId: data.projectId ?? null,
        clientId: data.clientId ?? null,
        date: data.date,
        description: data.description ?? '',
        startLocation: data.startLocation ?? null,
        endLocation: data.endLocation ?? null,
        miles: data.miles,
        purpose: data.purpose,
        roundTrip: data.roundTrip ?? false,
        taxYear: data.taxYear ?? new Date().getFullYear(),
        ratePerMile: rate,
        deductionAmount,
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
        miles: true,
        purpose: true,
        deductionAmount: true,
      },
    });

    let totalMiles = 0;
    let clientMeetingMiles = 0;
    let businessErrandMiles = 0;
    let travelMiles = 0;
    let otherMiles = 0;
    let estimatedDeduction = 0;

    for (const log of logs) {
      const miles = Number(log.miles);
      totalMiles += miles;
      estimatedDeduction += Number(log.deductionAmount) || 0;

      switch (log.purpose) {
        case 'CLIENT_MEETING':
          clientMeetingMiles += miles;
          break;
        case 'BUSINESS_ERRAND':
          businessErrandMiles += miles;
          break;
        case 'TRAVEL':
          travelMiles += miles;
          break;
        case 'OTHER':
          otherMiles += miles;
          break;
      }
    }

    return {
      totalMiles,
      clientMeetingMiles,
      businessErrandMiles,
      travelMiles,
      otherMiles,
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

    // Recalculate deduction if miles or purpose changed
    let deductionAmount: number | undefined;
    let ratePerMile: number | undefined;

    const miles = data.miles ?? Number(existing.miles);
    const purpose = data.purpose ?? existing.purpose;

    if (data.miles !== undefined || data.purpose !== undefined) {
      ratePerMile = MILEAGE_RATES[purpose] ?? 0;
      deductionAmount = miles * ratePerMile;
    }

    return this.prisma.mileageLog.update({
      where: { id },
      data: {
        projectId: data.projectId,
        clientId: data.clientId,
        date: data.date,
        description: data.description,
        startLocation: data.startLocation,
        endLocation: data.endLocation,
        miles: data.miles,
        purpose: data.purpose,
        roundTrip: data.roundTrip,
        ratePerMile,
        deductionAmount,
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
      where: {
        userId,
        startLocation: { not: null },
        endLocation: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    return routes
      .filter((r) => r.startLocation && r.endLocation)
      .map((r) => ({
        startLocation: r.startLocation!,
        endLocation: r.endLocation!,
        count: r._count.id,
      }));
  }
}
