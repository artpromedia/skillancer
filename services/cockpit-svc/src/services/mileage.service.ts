/**
 * @module @skillancer/cockpit-svc/services/mileage
 * Mileage Service - Mileage tracking for tax deductions
 */

import { FinanceError, FinanceErrorCode } from '../errors/finance.errors.js';
import { MileageLogRepository, MILEAGE_RATES } from '../repositories/mileage-log.repository.js';

import type {
  CreateMileageLogParams,
  UpdateMileageLogParams,
  MileageFilters,
  MileageLogWithDetails,
  MileageSummary,
} from '../types/finance.types.js';
import type { MileageLog } from '../types/prisma-shim.js';
import type { PrismaClient } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';

export class MileageService {
  private readonly mileageRepository: MileageLogRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger
  ) {
    this.mileageRepository = new MileageLogRepository(prisma);
  }

  /**
   * Create a new mileage log
   */
  async createMileageLog(params: CreateMileageLogParams): Promise<MileageLog> {
    // Validate miles
    if (params.miles <= 0) {
      throw new FinanceError(FinanceErrorCode.INVALID_MILEAGE_DISTANCE);
    }

    // Validate project if provided
    if (params.projectId) {
      const project = await this.prisma.cockpitProject.findUnique({
        where: { id: params.projectId },
      });
      if (!project || project.freelancerUserId !== params.userId) {
        throw new FinanceError(FinanceErrorCode.ACCESS_DENIED);
      }
    }

    // Validate client if provided
    if (params.clientId) {
      const client = await this.prisma.client.findUnique({
        where: { id: params.clientId },
      });
      if (!client || client.freelancerUserId !== params.userId) {
        throw new FinanceError(FinanceErrorCode.ACCESS_DENIED);
      }
    }

    const mileageLog = await this.mileageRepository.create(params);

    this.logger.info(
      {
        mileageId: mileageLog.id,
        userId: params.userId,
        miles: params.miles,
        purpose: params.purpose,
      },
      'Mileage log created'
    );

    return mileageLog;
  }

  /**
   * Get mileage log by ID
   */
  async getMileageLog(mileageId: string, userId: string): Promise<MileageLogWithDetails> {
    const mileageLog = await this.mileageRepository.findByIdWithDetails(mileageId);

    if (!mileageLog || mileageLog.userId !== userId) {
      throw new FinanceError(FinanceErrorCode.MILEAGE_LOG_NOT_FOUND);
    }

    return mileageLog;
  }

  /**
   * List mileage logs with filters
   */
  async listMileageLogs(filters: MileageFilters): Promise<{
    logs: MileageLogWithDetails[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { logs, total } = await this.mileageRepository.findByFilters(filters);

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const totalPages = Math.ceil(total / limit);

    return {
      logs,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get recent mileage logs
   */
  async getRecentMileageLogs(userId: string, limit = 10): Promise<MileageLogWithDetails[]> {
    return this.mileageRepository.findRecent(userId, limit);
  }

  /**
   * Update a mileage log
   */
  async updateMileageLog(
    mileageId: string,
    userId: string,
    params: UpdateMileageLogParams
  ): Promise<MileageLog> {
    const existing = await this.mileageRepository.findById(mileageId);

    if (!existing || existing.userId !== userId) {
      throw new FinanceError(FinanceErrorCode.MILEAGE_LOG_NOT_FOUND);
    }

    // Validate miles if provided
    if (params.miles !== undefined && params.miles <= 0) {
      throw new FinanceError(FinanceErrorCode.INVALID_MILEAGE_DISTANCE);
    }

    // Validate project if changed
    if (params.projectId && params.projectId !== existing.projectId) {
      const project = await this.prisma.cockpitProject.findUnique({
        where: { id: params.projectId },
      });
      if (!project || project.freelancerUserId !== userId) {
        throw new FinanceError(FinanceErrorCode.ACCESS_DENIED);
      }
    }

    // Validate client if changed
    if (params.clientId && params.clientId !== existing.clientId) {
      const client = await this.prisma.client.findUnique({
        where: { id: params.clientId },
      });
      if (!client || client.freelancerUserId !== userId) {
        throw new FinanceError(FinanceErrorCode.ACCESS_DENIED);
      }
    }

    const mileageLog = await this.mileageRepository.update(mileageId, params);

    this.logger.info({ mileageId, userId }, 'Mileage log updated');

    return mileageLog;
  }

  /**
   * Delete a mileage log
   */
  async deleteMileageLog(mileageId: string, userId: string): Promise<void> {
    const mileageLog = await this.mileageRepository.findById(mileageId);

    if (!mileageLog || mileageLog.userId !== userId) {
      throw new FinanceError(FinanceErrorCode.MILEAGE_LOG_NOT_FOUND);
    }

    await this.mileageRepository.delete(mileageId);

    this.logger.info({ mileageId, userId }, 'Mileage log deleted');
  }

  /**
   * Get mileage summary for a date range
   */
  async getMileageSummary(userId: string, startDate: Date, endDate: Date): Promise<MileageSummary> {
    return this.mileageRepository.getSummary(userId, startDate, endDate);
  }

  /**
   * Get mileage summary for a tax year
   */
  async getTaxYearSummary(userId: string, taxYear: number): Promise<MileageSummary> {
    return this.mileageRepository.getTaxYearSummary(userId, taxYear);
  }

  /**
   * Get frequent routes for suggestions
   */
  async getFrequentRoutes(
    userId: string,
    limit = 5
  ): Promise<Array<{ startLocation: string; endLocation: string; count: number }>> {
    return this.mileageRepository.getFrequentRoutes(userId, limit);
  }

  /**
   * Get current IRS mileage rates
   */
  getMileageRates(): typeof MILEAGE_RATES {
    return MILEAGE_RATES;
  }

  /**
   * Calculate deduction for a given distance and purpose
   */
  calculateDeduction(
    miles: number,
    purpose: 'CLIENT_MEETING' | 'BUSINESS_ERRAND' | 'TRAVEL' | 'OTHER'
  ): number {
    const rate = MILEAGE_RATES[purpose] ?? 0;
    return miles * rate;
  }

  /**
   * Get monthly mileage breakdown
   */
  async getMonthlyBreakdown(
    userId: string,
    year: number
  ): Promise<
    Array<{
      month: number;
      businessMiles: number;
      totalMiles: number;
      deduction: number;
    }>
  > {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

    const logs = await this.prisma.mileageLog.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
      },
      select: {
        date: true,
        miles: true,
        purpose: true,
        deductionAmount: true,
      },
    });

    // Group by month
    const monthlyData = new Map<
      number,
      { businessMiles: number; totalMiles: number; deduction: number }
    >();

    for (let i = 0; i < 12; i++) {
      monthlyData.set(i, { businessMiles: 0, totalMiles: 0, deduction: 0 });
    }

    for (const log of logs) {
      const month = log.date.getMonth();
      const data = monthlyData.get(month)!;
      const miles = Number(log.miles);

      data.totalMiles += miles;
      data.deduction += Number(log.deductionAmount) || 0;

      // Count CLIENT_MEETING, BUSINESS_ERRAND, and TRAVEL as business miles
      if (
        log.purpose === 'CLIENT_MEETING' ||
        log.purpose === 'BUSINESS_ERRAND' ||
        log.purpose === 'TRAVEL'
      ) {
        data.businessMiles += miles;
      }
    }

    return Array.from(monthlyData.entries()).map(([month, data]) => ({
      month,
      ...data,
    }));
  }
}
