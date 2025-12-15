/**
 * @module @skillancer/billing-svc/services/time-log
 * Time tracking service for hourly contracts
 */

import { createLogger } from '@skillancer/logger';

const logger = createLogger({ serviceName: 'time-log-service' });

import { getFeeCalculatorService } from './fee-calculator.service.js';
import { BillingError } from '../errors/index.js';
import { getTimeLogRepository, getContractRepository } from '../repositories/escrow.repository.js';

import type {
  CreateTimeLogParams,
  ApproveTimeLogParams,
  RejectTimeLogParams,
  TimeLogSummary,
  TimeLogEntry,
} from '../types/escrow.types.js';

// =============================================================================
// TIME LOG SERVICE CLASS
// =============================================================================

export class TimeLogService {
  private get timeLogRepository() {
    return getTimeLogRepository();
  }

  private get contractRepository() {
    return getContractRepository();
  }

  private get escrowRepository() {
    return getEscrowRepository();
  }

  private get feeCalculator() {
    return getFeeCalculatorService();
  }

  // ===========================================================================
  // CREATE TIME LOG
  // ===========================================================================

  /**
   * Create a new time log entry
   */
  async createTimeLog(params: CreateTimeLogParams, freelancerUserId: string) {
    logger.info({ params }, '[TimeLogService] Creating time log');

    // Validate contract
    const contract = await this.contractRepository.findById(params.contractId);
    if (!contract) {
      throw new BillingError('Contract not found', 'CONTRACT_NOT_FOUND');
    }

    // Validate freelancer
    if (contract.freelancerId !== freelancerUserId) {
      throw new BillingError('Only freelancer can log time', 'NOT_AUTHORIZED');
    }

    // Contract must be hourly and active
    if (contract.rateType !== 'HOURLY') {
      throw new BillingError('Time logs only for hourly contracts', 'NOT_HOURLY_CONTRACT');
    }

    if (contract.status !== 'ACTIVE') {
      throw new BillingError('Contract must be active', 'INVALID_CONTRACT_STATUS');
    }

    // Calculate duration and amount
    let duration = params.duration;
    if (!duration && params.endTime) {
      duration = Math.round((params.endTime.getTime() - params.startTime.getTime()) / (1000 * 60));
    }

    let amount: number | undefined;
    if (duration) {
      const billing = this.feeCalculator.calculateTimeLogBilling({
        durationMinutes: duration,
        hourlyRate: params.hourlyRate,
      });
      amount = billing.grossAmount;
    }

    const timeLog = await this.timeLogRepository.create({
      contractId: params.contractId,
      description: params.description,
      startTime: params.startTime,
      endTime: params.endTime,
      duration,
      hourlyRate: params.hourlyRate,
      amount,
      skillpodSessionId: params.skillpodSessionId,
      isVerified: params.isVerified,
    });

    logger.info({ timeLogId: timeLog.id }, '[TimeLogService] Time log created');
    return timeLog;
  }

  /**
   * Update a time log entry
   */
  async updateTimeLog(
    timeLogId: string,
    freelancerUserId: string,
    params: Partial<CreateTimeLogParams>
  ) {
    logger.info({ timeLogId, params }, '[TimeLogService] Updating time log');

    const timeLog = await this.timeLogRepository.findById(timeLogId);
    if (!timeLog) {
      throw new BillingError('Time log not found', 'TIME_LOG_NOT_FOUND');
    }

    // Validate freelancer
    if (timeLog.contract.freelancerId !== freelancerUserId) {
      throw new BillingError('Not authorized', 'NOT_AUTHORIZED');
    }

    // Can only update pending logs
    if (timeLog.status !== 'PENDING') {
      throw new BillingError('Can only update pending time logs', 'INVALID_STATUS');
    }

    // Recalculate if time changed
    let duration = params.duration ?? timeLog.duration;
    if (params.endTime && params.startTime) {
      duration = Math.round((params.endTime.getTime() - params.startTime.getTime()) / (1000 * 60));
    }

    let amount = timeLog.amount ? Number(timeLog.amount) : undefined;
    if (duration) {
      const billing = this.feeCalculator.calculateTimeLogBilling({
        durationMinutes: duration,
        hourlyRate: params.hourlyRate ?? Number(timeLog.hourlyRate),
      });
      amount = billing.grossAmount;
    }

    const updated = await this.timeLogRepository.update(timeLogId, {
      description: params.description,
      startTime: params.startTime,
      endTime: params.endTime,
      duration,
      hourlyRate: params.hourlyRate,
      amount,
    });

    logger.info({ timeLogId }, '[TimeLogService] Time log updated');
    return updated;
  }

  /**
   * Delete a time log entry
   */
  async deleteTimeLog(timeLogId: string, userId: string): Promise<void> {
    logger.info({ timeLogId }, '[TimeLogService] Deleting time log');

    const timeLog = await this.timeLogRepository.findById(timeLogId);
    if (!timeLog) {
      throw new BillingError('Time log not found', 'TIME_LOG_NOT_FOUND');
    }

    // Only freelancer can delete pending logs
    if (timeLog.contract.freelancerId !== userId) {
      throw new BillingError('Not authorized', 'NOT_AUTHORIZED');
    }

    if (timeLog.status !== 'PENDING') {
      throw new BillingError('Can only delete pending time logs', 'INVALID_STATUS');
    }

    // Delete using prisma directly since we don't have a delete method in repo
    await this.timeLogRepository.update(timeLogId, {
      status: 'REJECTED',
      rejectedAt: new Date(),
      rejectionReason: 'Deleted by freelancer',
    });

    logger.info({ timeLogId }, '[TimeLogService] Time log deleted');
  }

  // ===========================================================================
  // APPROVE/REJECT TIME LOGS
  // ===========================================================================

  /**
   * Approve a time log entry (client)
   */
  async approveTimeLog(params: ApproveTimeLogParams) {
    logger.info({ params }, '[TimeLogService] Approving time log');

    const timeLog = await this.timeLogRepository.findById(params.timeLogId);
    if (!timeLog) {
      throw new BillingError('Time log not found', 'TIME_LOG_NOT_FOUND');
    }

    // Validate client
    if (timeLog.contract.clientId !== params.clientUserId) {
      throw new BillingError('Only client can approve time logs', 'NOT_AUTHORIZED');
    }

    // Must be pending
    if (timeLog.status !== 'PENDING') {
      throw new BillingError('Time log is not pending', 'INVALID_STATUS');
    }

    const updated = await this.timeLogRepository.update(params.timeLogId, {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: params.clientUserId,
    });

    logger.info({ timeLogId: params.timeLogId }, '[TimeLogService] Time log approved');
    return updated;
  }

  /**
   * Reject a time log entry (client)
   */
  async rejectTimeLog(params: RejectTimeLogParams) {
    logger.info({ params }, '[TimeLogService] Rejecting time log');

    const timeLog = await this.timeLogRepository.findById(params.timeLogId);
    if (!timeLog) {
      throw new BillingError('Time log not found', 'TIME_LOG_NOT_FOUND');
    }

    // Validate client
    if (timeLog.contract.clientId !== params.clientUserId) {
      throw new BillingError('Only client can reject time logs', 'NOT_AUTHORIZED');
    }

    // Must be pending
    if (timeLog.status !== 'PENDING') {
      throw new BillingError('Time log is not pending', 'INVALID_STATUS');
    }

    const updated = await this.timeLogRepository.update(params.timeLogId, {
      status: 'REJECTED',
      rejectedAt: new Date(),
      rejectionReason: params.reason,
    });

    logger.info({ timeLogId: params.timeLogId }, '[TimeLogService] Time log rejected');
    return updated;
  }

  /**
   * Bulk approve time logs (client)
   */
  async bulkApproveTimeLogs(timeLogIds: string[], clientUserId: string) {
    logger.info({ timeLogIds }, '[TimeLogService] Bulk approving time logs');

    const results = [];
    for (const id of timeLogIds) {
      try {
        const result = await this.approveTimeLog({ timeLogId: id, clientUserId });
        results.push({ id, success: true, timeLog: result });
      } catch (error) {
        results.push({ id, success: false, error: (error as Error).message });
      }
    }

    return results;
  }

  // ===========================================================================
  // BILLING
  // ===========================================================================

  /**
   * Bill approved time logs for a contract
   * Creates escrow fund requests for approved time
   */
  async billApprovedTime(contractId: string, clientUserId: string) {
    logger.info({ contractId }, '[TimeLogService] Billing approved time');

    const contract = await this.contractRepository.findById(contractId);
    if (!contract) {
      throw new BillingError('Contract not found', 'CONTRACT_NOT_FOUND');
    }

    if (contract.clientId !== clientUserId) {
      throw new BillingError('Only client can bill time', 'NOT_AUTHORIZED');
    }

    // Get all approved unbilled time logs
    const timeLogs = await this.timeLogRepository.findApprovedUnbilled(contractId);

    if (timeLogs.length === 0) {
      throw new BillingError('No approved time logs to bill', 'NO_LOGS_TO_BILL');
    }

    // Calculate total
    const totalAmount = timeLogs.reduce((sum, log) => sum + Number(log.amount ?? 0), 0);
    const totalMinutes = timeLogs.reduce((sum, log) => sum + (log.duration ?? 0), 0);

    // Get fee preview
    const fees = this.feeCalculator.getFeesPreview({
      amount: totalAmount,
      platformFeePercent: Number(contract.platformFeePercent),
      secureMode: contract.secureMode,
      secureModeFeePercent: contract.secureModeFeePercent
        ? Number(contract.secureModeFeePercent)
        : undefined,
    });

    logger.info(
      { totalAmount, totalMinutes, logCount: timeLogs.length },
      '[TimeLogService] Time billing calculated'
    );

    return {
      timeLogs: timeLogs.map((log) => ({
        id: log.id,
        duration: log.duration,
        amount: Number(log.amount ?? 0),
      })),
      summary: {
        totalMinutes,
        totalHours: Math.round((totalMinutes / 60) * 100) / 100,
        totalAmount,
        logCount: timeLogs.length,
      },
      fees,
    };
  }

  /**
   * Mark time logs as billed after payment
   */
  async markAsBilled(timeLogIds: string[]): Promise<void> {
    logger.info({ timeLogIds }, '[TimeLogService] Marking time logs as billed');
    await this.timeLogRepository.markAsBilled(timeLogIds);
  }

  // ===========================================================================
  // QUERY METHODS
  // ===========================================================================

  /**
   * Get time log by ID
   */
  async getTimeLog(timeLogId: string, userId: string) {
    const timeLog = await this.timeLogRepository.findById(timeLogId);
    if (!timeLog) {
      throw new BillingError('Time log not found', 'TIME_LOG_NOT_FOUND');
    }

    // Validate access
    if (timeLog.contract.clientId !== userId && timeLog.contract.freelancerId !== userId) {
      throw new BillingError('Not authorized', 'NOT_AUTHORIZED');
    }

    return timeLog;
  }

  /**
   * Get time logs for a contract
   */
  async getTimeLogsByContract(contractId: string, userId: string, status?: string) {
    const contract = await this.contractRepository.findById(contractId);
    if (!contract) {
      throw new BillingError('Contract not found', 'CONTRACT_NOT_FOUND');
    }

    // Validate access
    if (contract.clientId !== userId && contract.freelancerId !== userId) {
      throw new BillingError('Not authorized', 'NOT_AUTHORIZED');
    }

    return this.timeLogRepository.findByContract(contractId, status);
  }

  /**
   * Get time log summary for a contract
   */
  async getTimeLogSummary(contractId: string, userId: string): Promise<TimeLogSummary> {
    const contract = await this.contractRepository.findById(contractId);
    if (!contract) {
      throw new BillingError('Contract not found', 'CONTRACT_NOT_FOUND');
    }

    // Validate access
    if (contract.clientId !== userId && contract.freelancerId !== userId) {
      throw new BillingError('Not authorized', 'NOT_AUTHORIZED');
    }

    const summary = await this.timeLogRepository.getSummary(contractId);
    const logs = await this.timeLogRepository.findByContract(contractId);

    return {
      contractId,
      totalHours: summary.totalMinutes / 60,
      totalAmount: summary.totalAmount,
      pendingHours: summary.pendingMinutes / 60,
      pendingAmount: summary.pendingAmount,
      approvedHours: summary.approvedMinutes / 60,
      approvedAmount: summary.approvedAmount,
      billedHours: summary.billedMinutes / 60,
      billedAmount: summary.billedAmount,
      logs: logs.map(
        (log): TimeLogEntry => ({
          id: log.id,
          description: log.description,
          startTime: log.startTime,
          endTime: log.endTime,
          duration: log.duration,
          hourlyRate: Number(log.hourlyRate),
          amount: log.amount ? Number(log.amount) : null,
          status: log.status as never,
          isVerified: log.isVerified,
          createdAt: log.createdAt,
        })
      ),
    };
  }

  /**
   * Get pending time logs for client review
   */
  async getPendingForReview(contractId: string, clientUserId: string) {
    const contract = await this.contractRepository.findById(contractId);
    if (!contract) {
      throw new BillingError('Contract not found', 'CONTRACT_NOT_FOUND');
    }

    if (contract.clientId !== clientUserId) {
      throw new BillingError('Not authorized', 'NOT_AUTHORIZED');
    }

    return this.timeLogRepository.findPendingByContract(contractId);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let timeLogServiceInstance: TimeLogService | null = null;

export function getTimeLogService(): TimeLogService {
  timeLogServiceInstance ??= new TimeLogService();
  return timeLogServiceInstance;
}

export function resetTimeLogService(): void {
  timeLogServiceInstance = null;
}
