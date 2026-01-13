/**
 * @module @skillancer/market-svc/repositories/contract-activity
 * Contract Activity data access layer
 */

import type {
  LogActivityInput,
  ActivityListOptions,
  ActivityWithDetails,
} from '../types/contract.types.js';
import type { PrismaClient, Prisma, ContractActivityType } from '../types/prisma-shim.js';

/** Actor type for contract activities */
type ContractActorType = 'CLIENT' | 'FREELANCER' | 'ADMIN';

/**
 * Contract Activity Repository
 *
 * Handles database operations for contract activities (audit trail).
 */
export class ContractActivityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private readonly defaultInclude = {
    actor: {
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
      },
    },
  };

  /**
   * Log a contract activity
   */
  async log(data: LogActivityInput) {
    return this.prisma.contractActivity.create({
      data: {
        contractId: data.contractId,
        actorUserId: data.actorUserId ?? null,
        actorType: data.actorType ?? null,
        activityType: data.activityType,
        description: data.description,
        milestoneId: data.milestoneId ?? null,
        timeEntryId: data.timeEntryId ?? null,
        invoiceId: data.invoiceId ?? null,
        amendmentId: data.amendmentId ?? null,
        disputeId: data.disputeId ?? null,
        metadata: (data.metadata ?? null) as Prisma.InputJsonValue,
        visibleToClient: data.visibleToClient ?? true,
        visibleToFreelancer: data.visibleToFreelancer ?? true,
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Log multiple activities in a transaction
   */
  async logMany(activities: LogActivityInput[]) {
    return this.prisma.contractActivity.createMany({
      data: activities.map((a) => ({
        contractId: a.contractId,
        actorUserId: a.actorUserId ?? null,
        actorType: a.actorType ?? null,
        activityType: a.activityType,
        description: a.description,
        milestoneId: a.milestoneId ?? null,
        timeEntryId: a.timeEntryId ?? null,
        invoiceId: a.invoiceId ?? null,
        amendmentId: a.amendmentId ?? null,
        disputeId: a.disputeId ?? null,
        metadata: (a.metadata ?? null) as Prisma.InputJsonValue,
        visibleToClient: a.visibleToClient ?? true,
        visibleToFreelancer: a.visibleToFreelancer ?? true,
      })),
    });
  }

  /**
   * Find activity by ID
   */
  async findById(id: string): Promise<ActivityWithDetails | null> {
    return this.prisma.contractActivity.findUnique({
      where: { id },
      include: this.defaultInclude,
    }) as Promise<ActivityWithDetails | null>;
  }

  /**
   * List activities for a contract
   */
  async list(options: ActivityListOptions): Promise<{
    data: ActivityWithDetails[];
    total: number;
  }> {
    const {
      contractId,
      activityType,
      actorUserId,
      dateFrom,
      dateTo,
      visibleToClient,
      visibleToFreelancer,
      page = 1,
      limit = 50,
    } = options;

    const where: Prisma.ContractActivityWhereInput = { contractId };

    if (activityType) {
      where.activityType = Array.isArray(activityType) ? { in: activityType } : activityType;
    }
    if (actorUserId) where.actorUserId = actorUserId;
    if (visibleToClient !== undefined) where.visibleToClient = visibleToClient;
    if (visibleToFreelancer !== undefined) where.visibleToFreelancer = visibleToFreelancer;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const [data, total] = await Promise.all([
      this.prisma.contractActivity.findMany({
        where,
        include: this.defaultInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.contractActivity.count({ where }),
    ]);

    return { data: data as ActivityWithDetails[], total };
  }

  /**
   * Get recent activities for a contract
   */
  async getRecent(contractId: string, limit: number = 10): Promise<ActivityWithDetails[]> {
    return this.prisma.contractActivity.findMany({
      where: { contractId },
      include: this.defaultInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }) as Promise<ActivityWithDetails[]>;
  }

  /**
   * Get activities by type for a contract
   */
  async getByType(
    contractId: string,
    activityType: ContractActivityType | ContractActivityType[]
  ): Promise<ActivityWithDetails[]> {
    return this.prisma.contractActivity.findMany({
      where: {
        contractId,
        activityType: Array.isArray(activityType) ? { in: activityType } : activityType,
      },
      include: this.defaultInclude,
      orderBy: { createdAt: 'desc' },
    }) as Promise<ActivityWithDetails[]>;
  }

  /**
   * Get activity timeline for a contract
   */
  async getTimeline(contractId: string): Promise<ActivityWithDetails[]> {
    return this.prisma.contractActivity.findMany({
      where: { contractId },
      include: this.defaultInclude,
      orderBy: { createdAt: 'asc' },
    }) as Promise<ActivityWithDetails[]>;
  }

  /**
   * Get user's recent activities across contracts
   */
  async getUserActivities(
    userId: string,
    limit: number = 20
  ): Promise<
    (ActivityWithDetails & { contract: { id: string; title: string; contractNumber: string } })[]
  > {
    return this.prisma.contractActivity.findMany({
      where: { actorUserId: userId },
      include: {
        ...this.defaultInclude,
        contract: {
          select: {
            id: true,
            title: true,
            contractNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }) as Promise<
      (ActivityWithDetails & { contract: { id: string; title: string; contractNumber: string } })[]
    >;
  }

  /**
   * Count activities by type
   */
  async countByType(contractId: string): Promise<Record<ContractActivityType, number>> {
    const counts = await this.prisma.contractActivity.groupBy({
      by: ['activityType'],
      where: { contractId },
      _count: true,
    });

    const result: Partial<Record<ContractActivityType, number>> = {};
    for (const count of counts) {
      result[count.activityType] = count._count;
    }

    return result as Record<ContractActivityType, number>;
  }

  /**
   * Delete activities for a contract (for cleanup)
   */
  async deleteForContract(contractId: string) {
    return this.prisma.contractActivity.deleteMany({
      where: { contractId },
    });
  }

  // =============================================
  // Helper methods for common activity logging
  // =============================================

  /**
   * Log contract created
   */
  async logContractCreated(
    contractId: string,
    actorUserId: string,
    actorType: 'CLIENT' | 'FREELANCER',
    contractDetails: Record<string, unknown>
  ) {
    return this.log({
      contractId,
      actorUserId,
      actorType,
      activityType: 'CONTRACT_CREATED',
      description: 'Contract was created',
      metadata: contractDetails,
    });
  }

  /**
   * Log contract sent for signature
   */
  async logContractSent(
    contractId: string,
    actorUserId: string,
    actorType: 'CLIENT' | 'FREELANCER'
  ) {
    return this.log({
      contractId,
      actorUserId,
      actorType,
      activityType: 'CONTRACT_SENT',
      description: 'Contract sent for signature',
    });
  }

  /**
   * Log contract signed
   */
  async logContractSigned(
    contractId: string,
    actorUserId: string,
    signerRole: 'CLIENT' | 'FREELANCER'
  ) {
    return this.log({
      contractId,
      actorUserId,
      actorType: signerRole,
      activityType: 'CONTRACT_SIGNED',
      description: `Contract signed by ${signerRole.toLowerCase()}`,
      metadata: { signerRole },
    });
  }

  /**
   * Log contract activated
   */
  async logContractActivated(contractId: string) {
    return this.log({
      contractId,
      actorType: 'SYSTEM',
      activityType: 'CONTRACT_ACTIVATED',
      description: 'Contract activated after all signatures received',
    });
  }

  /**
   * Log contract paused
   */
  async logContractPaused(
    contractId: string,
    actorUserId: string,
    actorType: ContractActorType,
    reason?: string
  ) {
    return this.log({
      contractId,
      actorUserId,
      actorType,
      activityType: 'CONTRACT_PAUSED',
      description: reason ? `Contract paused: ${reason}` : 'Contract paused',
      metadata: reason ? { reason } : null,
    });
  }

  /**
   * Log contract resumed
   */
  async logContractResumed(contractId: string, actorUserId: string, actorType: ContractActorType) {
    return this.log({
      contractId,
      actorUserId,
      actorType,
      activityType: 'CONTRACT_RESUMED',
      description: 'Contract resumed',
    });
  }

  /**
   * Log contract completed
   */
  async logContractCompleted(contractId: string, actorUserId?: string) {
    return this.log({
      contractId,
      actorUserId: actorUserId ?? null,
      actorType: actorUserId ? 'CLIENT' : 'SYSTEM',
      activityType: 'CONTRACT_COMPLETED',
      description: 'Contract marked as completed',
    });
  }

  /**
   * Log contract terminated
   */
  async logContractTerminated(
    contractId: string,
    actorUserId: string,
    actorType: ContractActorType,
    reason: string
  ) {
    return this.log({
      contractId,
      actorUserId,
      actorType,
      activityType: 'CONTRACT_TERMINATED',
      description: `Contract terminated: ${reason}`,
      metadata: { reason },
    });
  }

  /**
   * Log milestone created
   */
  async logMilestoneCreated(
    contractId: string,
    actorUserId: string,
    actorType: 'CLIENT' | 'FREELANCER',
    milestoneId: string,
    milestoneTitle: string
  ) {
    return this.log({
      contractId,
      actorUserId,
      actorType,
      activityType: 'MILESTONE_CREATED',
      description: `Milestone "${milestoneTitle}" created`,
      milestoneId,
      metadata: { milestoneTitle },
    });
  }

  /**
   * Log milestone submitted
   */
  async logMilestoneSubmitted(
    contractId: string,
    actorUserId: string,
    milestoneId: string,
    milestoneTitle: string
  ) {
    return this.log({
      contractId,
      actorUserId,
      actorType: 'FREELANCER',
      activityType: 'MILESTONE_SUBMITTED',
      description: `Milestone "${milestoneTitle}" submitted for review`,
      milestoneId,
      metadata: { milestoneTitle },
    });
  }

  /**
   * Log milestone approved
   */
  async logMilestoneApproved(
    contractId: string,
    actorUserId: string,
    milestoneId: string,
    milestoneTitle: string
  ) {
    return this.log({
      contractId,
      actorUserId,
      actorType: 'CLIENT',
      activityType: 'MILESTONE_APPROVED',
      description: `Milestone "${milestoneTitle}" approved`,
      milestoneId,
      metadata: { milestoneTitle },
    });
  }

  /**
   * Log milestone rejected
   */
  async logMilestoneRejected(
    contractId: string,
    actorUserId: string,
    milestoneId: string,
    milestoneTitle: string,
    reason: string
  ) {
    return this.log({
      contractId,
      actorUserId,
      actorType: 'CLIENT',
      activityType: 'MILESTONE_REJECTED',
      description: `Milestone "${milestoneTitle}" rejected: ${reason}`,
      milestoneId,
      metadata: { milestoneTitle, reason },
    });
  }

  /**
   * Log time entry logged
   */
  async logTimeLogged(
    contractId: string,
    actorUserId: string,
    timeEntryId: string,
    hours: number,
    date: Date
  ) {
    return this.log({
      contractId,
      actorUserId,
      actorType: 'FREELANCER',
      activityType: 'TIME_LOGGED',
      description: `${hours} hours logged for ${date.toLocaleDateString()}`,
      timeEntryId,
      metadata: { hours, date: date.toISOString() },
    });
  }

  /**
   * Log time entry approved
   */
  async logTimeApproved(
    contractId: string,
    actorUserId: string,
    timeEntryId: string,
    hours: number
  ) {
    return this.log({
      contractId,
      actorUserId,
      actorType: 'CLIENT',
      activityType: 'TIME_APPROVED',
      description: `${hours} hours approved`,
      timeEntryId,
      metadata: { hours },
    });
  }

  /**
   * Log invoice created
   */
  async logInvoiceCreated(
    contractId: string,
    actorUserId: string,
    invoiceId: string,
    amount: number
  ) {
    return this.log({
      contractId,
      actorUserId,
      actorType: 'FREELANCER',
      activityType: 'INVOICE_CREATED',
      description: `Invoice created for $${amount.toFixed(2)}`,
      invoiceId,
      metadata: { amount },
    });
  }

  /**
   * Log invoice paid
   */
  async logInvoicePaid(contractId: string, invoiceId: string, amount: number) {
    return this.log({
      contractId,
      actorType: 'SYSTEM',
      activityType: 'INVOICE_PAID',
      description: `Payment of $${amount.toFixed(2)} received`,
      invoiceId,
      metadata: { amount },
    });
  }

  /**
   * Log dispute opened
   */
  async logDisputeOpened(
    contractId: string,
    actorUserId: string,
    actorType: 'CLIENT' | 'FREELANCER',
    disputeId: string,
    reason: string
  ) {
    return this.log({
      contractId,
      actorUserId,
      actorType,
      activityType: 'DISPUTE_OPENED',
      description: `Dispute raised: ${reason}`,
      disputeId,
      metadata: { reason },
    });
  }

  /**
   * Log dispute resolved
   */
  async logDisputeResolved(contractId: string, disputeId: string, resolution: string) {
    return this.log({
      contractId,
      actorType: 'ADMIN',
      activityType: 'DISPUTE_RESOLVED',
      description: `Dispute resolved: ${resolution}`,
      disputeId,
      metadata: { resolution },
    });
  }

  /**
   * Log amendment proposed
   */
  async logAmendmentProposed(
    contractId: string,
    actorUserId: string,
    actorType: 'CLIENT' | 'FREELANCER',
    amendmentId: string,
    title: string
  ) {
    return this.log({
      contractId,
      actorUserId,
      actorType,
      activityType: 'AMENDMENT_PROPOSED',
      description: `Amendment proposed: ${title}`,
      amendmentId,
      metadata: { title },
    });
  }

  /**
   * Log amendment approved
   */
  async logAmendmentApproved(
    contractId: string,
    actorUserId: string,
    actorType: 'CLIENT' | 'FREELANCER',
    amendmentId: string,
    title: string
  ) {
    return this.log({
      contractId,
      actorUserId,
      actorType,
      activityType: 'AMENDMENT_APPROVED',
      description: `Amendment approved: ${title}`,
      amendmentId,
      metadata: { title },
    });
  }
}
