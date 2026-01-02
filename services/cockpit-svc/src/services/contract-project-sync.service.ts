// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/services/contract-project-sync
 * Contract-Project Sync Service - Bidirectional sync between Market contracts and Cockpit projects
 */

import {
  MarketContractLinkRepository,
  MarketMilestoneLinkRepository,
  MarketTimeLinkRepository,
  MarketPaymentLinkRepository,
  MarketClientCacheRepository,
  ProjectRepository,
  ClientRepository,
  MilestoneRepository,
} from '../repositories/index.js';

import type { ClientService } from './client.service.js';
import type { FinancialTransactionService } from './financial-transaction.service.js';
import type { ProjectService } from './project.service.js';
import type { TimeTrackingService } from './time-tracking.service.js';
import type {
  SyncResult,
  MarketClientInfo,
  ClientSyncResult,
} from '../types/contract-project.types.js';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type {
  ContractCreatedEvent,
  ContractStatusChangedEvent,
  ContractMilestoneUpdatedEvent,
  ContractTimeLoggedEvent,
  ContractPaymentReceivedEvent,
  ContractDisputeEvent,
  ContractEndedEvent,
  ProjectTimeLoggedEvent,
  ProjectMilestoneCompletedEvent,
  MarketContractStatus,
  MarketMilestoneStatus,
} from '@skillancer/types/cockpit';
import type { Redis } from 'ioredis';

// Cockpit project status mapping
const COCKPIT_STATUS_MAP: Record<MarketContractStatus, string> = {
  PENDING: 'NOT_STARTED',
  ACTIVE: 'IN_PROGRESS',
  PAUSED: 'ON_HOLD',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  DISPUTED: 'ON_HOLD',
};

// Cockpit milestone status mapping
const COCKPIT_MILESTONE_STATUS_MAP: Record<MarketMilestoneStatus, string> = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'IN_PROGRESS',
  APPROVED: 'COMPLETED',
  PAID: 'COMPLETED',
  DISPUTED: 'PENDING',
};

export class ContractProjectSyncService {
  private readonly contractLinkRepo: MarketContractLinkRepository;
  private readonly milestoneLinkRepo: MarketMilestoneLinkRepository;
  private readonly timeLinkRepo: MarketTimeLinkRepository;
  private readonly paymentLinkRepo: MarketPaymentLinkRepository;
  private readonly clientCacheRepo: MarketClientCacheRepository;
  private readonly projectRepo: ProjectRepository;
  private readonly clientRepo: ClientRepository;
  private readonly milestoneRepo: MilestoneRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger,
    private readonly projectService: ProjectService,
    private readonly clientService: ClientService,
    private readonly timeTrackingService: TimeTrackingService,
    private readonly financialService: FinancialTransactionService
  ) {
    this.contractLinkRepo = new MarketContractLinkRepository(prisma);
    this.milestoneLinkRepo = new MarketMilestoneLinkRepository(prisma);
    this.timeLinkRepo = new MarketTimeLinkRepository(prisma);
    this.paymentLinkRepo = new MarketPaymentLinkRepository(prisma);
    this.clientCacheRepo = new MarketClientCacheRepository(prisma);
    this.projectRepo = new ProjectRepository(prisma);
    this.clientRepo = new ClientRepository(prisma);
    this.milestoneRepo = new MilestoneRepository(prisma);
  }

  // ==================== Contract Events ====================

  /**
   * Handle contract created event from Market
   */
  async handleContractCreated(event: ContractCreatedEvent): Promise<void> {
    const { payload } = event;
    const correlationId = event.correlationId;

    this.logger.info({
      msg: 'Processing contract created event',
      contractId: payload.contractId,
      freelancerId: payload.freelancerId,
      correlationId,
    });

    try {
      // Cache client info
      await this.cacheMarketClient(payload.client);

      // Check if link already exists
      const existingLink = await this.contractLinkRepo.findByMarketId(payload.contractId);

      if (existingLink) {
        this.logger.info({
          msg: 'Contract link already exists, updating',
          linkId: existingLink.id,
          correlationId,
        });
        await this.updateContractLink(existingLink.id, payload);
        return;
      }

      // Get or create Cockpit client
      const clientResult = await this.getOrCreateCockpitClient(
        payload.freelancerId,
        payload.client
      );

      // Create contract link
      const contractLink = await this.contractLinkRepo.create({
        freelancerUserId: payload.freelancerId,
        marketContractId: payload.contractId,
        marketJobId: payload.jobId ?? null,
        marketClientId: payload.clientUserId,
        clientId: clientResult.clientId,
        contractTitle: payload.title,
        contractType: this.mapContractType(payload.contractType),
        contractStatus: this.mapContractStatus(payload.status),
        currency: payload.currency,
        hourlyRate: payload.hourlyRate ?? null,
        fixedPrice: payload.fixedPrice ?? null,
        budgetCap: payload.budgetCap ?? null,
        startDate: new Date(payload.startDate),
        endDate: payload.endDate ? new Date(payload.endDate) : null,
        lastSyncedAt: new Date(),
        autoCreateProject: true,
        autoSyncTime: true,
        autoRecordPayments: true,
      });

      this.logger.info({
        msg: 'Contract link created',
        linkId: contractLink.id,
        correlationId,
      });

      // Auto-create project if enabled and contract is active
      if (payload.status === 'ACTIVE') {
        await this.createProjectFromContract(contractLink.id, payload, clientResult.clientId);
      }

      // Create milestone links if provided
      if (payload.milestones && payload.milestones.length > 0) {
        for (const milestone of payload.milestones) {
          await this.milestoneLinkRepo.create({
            contractLinkId: contractLink.id,
            marketMilestoneId: milestone.id,
            title: milestone.title,
            amount: milestone.amount,
            status: 'PENDING',
            dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
            lastSyncedAt: new Date(),
          });
        }
      }
    } catch (error) {
      this.logger.error({
        msg: 'Failed to process contract created event',
        error: error instanceof Error ? error.message : 'Unknown error',
        contractId: payload.contractId,
        correlationId,
      });
      throw error;
    }
  }

  /**
   * Handle contract status changed event from Market
   */
  async handleContractStatusChanged(event: ContractStatusChangedEvent): Promise<void> {
    const { payload } = event;
    const correlationId = event.correlationId;

    this.logger.info({
      msg: 'Processing contract status changed event',
      contractId: payload.contractId,
      previousStatus: payload.previousStatus,
      newStatus: payload.newStatus,
      correlationId,
    });

    const contractLink = await this.contractLinkRepo.findByMarketId(payload.contractId);

    if (!contractLink) {
      this.logger.warn({
        msg: 'No contract link found',
        contractId: payload.contractId,
        correlationId,
      });
      return;
    }

    // Update contract link status
    await this.contractLinkRepo.update(contractLink.id, {
      contractStatus: this.mapContractStatus(payload.newStatus),
      lastSyncedAt: new Date(),
    });

    // Update project status if linked
    if (contractLink.projectId) {
      const cockpitStatus = COCKPIT_STATUS_MAP[payload.newStatus] || 'IN_PROGRESS';

      await this.projectService.updateProject({
        projectId: contractLink.projectId,
        freelancerUserId: payload.freelancerId,
        updates: {
          status: cockpitStatus,
          ...(payload.newStatus === 'COMPLETED' && { completedAt: new Date() }),
        },
      });

      this.logger.info({
        msg: 'Project status updated',
        projectId: contractLink.projectId,
        newStatus: cockpitStatus,
        correlationId,
      });
    }

    // Handle specific status transitions
    if (
      payload.newStatus === 'ACTIVE' &&
      !contractLink.projectId &&
      contractLink.autoCreateProject
    ) {
      // Create project on contract activation
      // We need to fetch contract details from Market API for this
      this.logger.info({
        msg: 'Contract activated, project creation pending full contract data',
        contractId: payload.contractId,
        correlationId,
      });
    }
  }

  /**
   * Handle milestone updated event from Market
   */
  async handleMilestoneUpdated(event: ContractMilestoneUpdatedEvent): Promise<void> {
    const { payload } = event;
    const correlationId = event.correlationId;

    this.logger.info({
      msg: 'Processing milestone updated event',
      contractId: payload.contractId,
      milestoneId: payload.milestoneId,
      action: payload.action,
      correlationId,
    });

    const contractLink = await this.contractLinkRepo.findByMarketId(payload.contractId);

    if (!contractLink) {
      this.logger.warn({
        msg: 'No contract link found for milestone update',
        contractId: payload.contractId,
        correlationId,
      });
      return;
    }

    // Find or create milestone link
    let milestoneLink = await this.milestoneLinkRepo.findByMarketId(
      contractLink.id,
      payload.milestoneId
    );

    if (!milestoneLink) {
      milestoneLink = await this.milestoneLinkRepo.create({
        contractLinkId: contractLink.id,
        marketMilestoneId: payload.milestoneId,
        title: payload.milestone.title,
        amount: payload.milestone.amount,
        status: this.mapMilestoneStatus(payload.milestone.status),
        dueDate: payload.milestone.dueDate ? new Date(payload.milestone.dueDate) : null,
        lastSyncedAt: new Date(),
      });

      // Create project milestone if project exists
      if (contractLink.projectId) {
        const projectMilestone = await this.milestoneRepo.create({
          projectId: contractLink.projectId,
          title: payload.milestone.title,
          description: payload.milestone.description ?? null,
          orderIndex: 0,
          dueDate: payload.milestone.dueDate ? new Date(payload.milestone.dueDate) : null,
          status: 'PENDING',
          marketMilestoneId: payload.milestoneId,
          amount: payload.milestone.amount,
        });

        await this.milestoneLinkRepo.update(milestoneLink.id, {
          projectMilestoneId: projectMilestone.id,
        });
      }
    } else {
      // Update milestone link
      await this.milestoneLinkRepo.update(milestoneLink.id, {
        title: payload.milestone.title,
        amount: payload.milestone.amount,
        status: this.mapMilestoneStatus(payload.milestone.status),
        dueDate: payload.milestone.dueDate ? new Date(payload.milestone.dueDate) : null,
        lastSyncedAt: new Date(),
      });

      // Update project milestone if linked
      if (milestoneLink.projectMilestoneId) {
        await this.milestoneRepo.update(milestoneLink.projectMilestoneId, {
          title: payload.milestone.title,
          amount: payload.milestone.amount,
          status: COCKPIT_MILESTONE_STATUS_MAP[payload.milestone.status] || 'PENDING',
          dueDate: payload.milestone.dueDate ? new Date(payload.milestone.dueDate) : null,
          ...(payload.milestone.status === 'APPROVED' || payload.milestone.status === 'PAID'
            ? { completedAt: new Date() }
            : {}),
        });
      }
    }
  }

  /**
   * Handle time logged event from Market
   */
  async handleTimeLogged(event: ContractTimeLoggedEvent): Promise<void> {
    const { payload } = event;
    const correlationId = event.correlationId;

    this.logger.info({
      msg: 'Processing time logged event',
      contractId: payload.contractId,
      timeLogId: payload.timeLogId,
      hours: payload.hours,
      correlationId,
    });

    const contractLink = await this.contractLinkRepo.findByMarketId(payload.contractId);

    if (!contractLink) {
      this.logger.warn({
        msg: 'No contract link found for time log',
        contractId: payload.contractId,
        correlationId,
      });
      return;
    }

    // Check if time log already linked
    const existingLink = await this.timeLinkRepo.findByMarketId(payload.timeLogId);

    if (existingLink) {
      // Update existing link
      await this.timeLinkRepo.update(existingLink.id, {
        hours: payload.hours,
        description: payload.description,
        amount: payload.amount,
        status: this.mapTimeLinkStatus(payload.status),
        lastSyncedAt: new Date(),
      });

      // Update Cockpit time entry if linked
      if (existingLink.timeEntryId) {
        await this.timeTrackingService.updateTimeEntry({
          timeEntryId: existingLink.timeEntryId,
          freelancerUserId: payload.freelancerId,
          updates: {
            durationMinutes: Math.round(payload.hours * 60),
            description: payload.description,
          },
        });
      }
      return;
    }

    // Create time link
    const timeLink = await this.timeLinkRepo.create({
      contractLinkId: contractLink.id,
      marketTimeLogId: payload.timeLogId,
      source: 'MARKET',
      date: new Date(payload.date),
      hours: payload.hours,
      description: payload.description,
      amount: payload.amount,
      status: this.mapTimeLinkStatus(payload.status),
      lastSyncedAt: new Date(),
    });

    // Create Cockpit time entry if auto-sync enabled and project exists
    if (contractLink.autoSyncTime && contractLink.projectId) {
      const timeEntry = await this.timeTrackingService.createTimeEntry({
        freelancerUserId: payload.freelancerId,
        projectId: contractLink.projectId,
        date: new Date(payload.date),
        durationMinutes: Math.round(payload.hours * 60),
        description: payload.description || 'Time logged via Skillancer Market',
        isBillable: true,
        hourlyRate: payload.hourlyRate,
        source: 'MARKET',
        tags: ['market', 'auto-synced'],
      });

      await this.timeLinkRepo.update(timeLink.id, {
        timeEntryId: timeEntry.id,
      });

      this.logger.info({
        msg: 'Created Cockpit time entry from Market',
        timeEntryId: timeEntry.id,
        timeLogId: payload.timeLogId,
        correlationId,
      });
    }
  }

  /**
   * Handle payment received event from Market
   */
  async handlePaymentReceived(event: ContractPaymentReceivedEvent): Promise<void> {
    const { payload } = event;
    const correlationId = event.correlationId;

    this.logger.info({
      msg: 'Processing payment received event',
      contractId: payload.contractId,
      paymentId: payload.paymentId,
      netAmount: payload.netAmount,
      status: payload.status,
      correlationId,
    });

    const contractLink = await this.contractLinkRepo.findByMarketId(payload.contractId);

    if (!contractLink) {
      this.logger.warn({
        msg: 'No contract link found for payment',
        contractId: payload.contractId,
        correlationId,
      });
      return;
    }

    // Check if payment already linked
    const existingLink = await this.paymentLinkRepo.findByMarketId(payload.paymentId);

    if (existingLink) {
      // Update status
      await this.paymentLinkRepo.update(existingLink.id, {
        status: this.mapPaymentStatus(payload.status),
        paidAt: payload.paidAt ? new Date(payload.paidAt) : null,
        lastSyncedAt: new Date(),
      });
      return;
    }

    // Find milestone link if applicable
    let milestoneLinkId: string | null = null;
    if (payload.milestoneId) {
      const milestoneLink = await this.milestoneLinkRepo.findByMarketId(
        contractLink.id,
        payload.milestoneId
      );
      milestoneLinkId = milestoneLink?.id ?? null;
    }

    // Create payment link
    const paymentLink = await this.paymentLinkRepo.create({
      contractLinkId: contractLink.id,
      marketPaymentId: payload.paymentId,
      marketInvoiceId: payload.marketInvoiceId ?? null,
      paymentType: this.mapPaymentType(payload.paymentType),
      grossAmount: payload.grossAmount,
      platformFee: payload.platformFee,
      netAmount: payload.netAmount,
      currency: payload.currency,
      status: this.mapPaymentStatus(payload.status),
      paidAt: payload.paidAt ? new Date(payload.paidAt) : null,
      milestoneLinkId,
      lastSyncedAt: new Date(),
    });

    // Create income transaction if payment completed and auto-record enabled
    if (payload.status === 'COMPLETED' && contractLink.autoRecordPayments) {
      const transaction = await this.financialService.createTransaction({
        userId: payload.freelancerId,
        type: 'INCOME',
        amount: payload.netAmount,
        currency: payload.currency,
        date: payload.paidAt ? new Date(payload.paidAt) : new Date(),
        description: this.buildPaymentDescription(payload, contractLink),
        category: 'Client Payment',
        source: 'MARKET',
        marketPaymentId: payload.paymentId,
        clientId: contractLink.clientId ?? undefined,
        projectId: contractLink.projectId ?? undefined,
        paymentMethod: 'Skillancer Market',
        tags: ['market', payload.paymentType.toLowerCase()],
      });

      await this.paymentLinkRepo.update(paymentLink.id, {
        transactionId: transaction.id,
      });

      // Record platform fee as expense
      if (payload.platformFee > 0) {
        await this.financialService.createTransaction({
          userId: payload.freelancerId,
          type: 'EXPENSE',
          amount: payload.platformFee,
          currency: payload.currency,
          date: payload.paidAt ? new Date(payload.paidAt) : new Date(),
          description: `Skillancer Market fee for ${contractLink.contractTitle}`,
          category: 'Commissions and Fees',
          source: 'MARKET',
          projectId: contractLink.projectId ?? undefined,
          isDeductible: true,
          tags: ['market', 'platform-fee'],
        });
      }

      this.logger.info({
        msg: 'Created income transaction from Market payment',
        transactionId: transaction.id,
        paymentId: payload.paymentId,
        netAmount: payload.netAmount,
        correlationId,
      });
    }
  }

  /**
   * Handle contract dispute event from Market
   */
  async handleDispute(event: ContractDisputeEvent): Promise<void> {
    const { payload } = event;
    const correlationId = event.correlationId;

    this.logger.info({
      msg: 'Processing contract dispute event',
      contractId: payload.contractId,
      disputeId: payload.disputeId,
      status: payload.status,
      correlationId,
    });

    const contractLink = await this.contractLinkRepo.findByMarketId(payload.contractId);

    if (!contractLink) {
      this.logger.warn({
        msg: 'No contract link found for dispute',
        contractId: payload.contractId,
        correlationId,
      });
      return;
    }

    // Update contract status
    await this.contractLinkRepo.update(contractLink.id, {
      contractStatus: 'DISPUTED',
      lastSyncedAt: new Date(),
    });

    // Update project to ON_HOLD
    if (contractLink.projectId) {
      await this.projectService.updateProject({
        projectId: contractLink.projectId,
        freelancerUserId: payload.freelancerId,
        updates: {
          status: 'ON_HOLD',
        },
      });

      // Add project note about dispute
      await this.projectService.addNote({
        projectId: contractLink.projectId,
        freelancerUserId: payload.freelancerId,
        content: `Dispute opened: ${payload.disputeType}. Status: ${payload.status}`,
        noteType: 'DISPUTE',
        isImportant: true,
      });
    }

    // Handle resolution
    if (payload.status === 'RESOLVED' && payload.resolution) {
      // Record any refund as expense
      if (payload.resolution.clientRefundAmount > 0) {
        await this.financialService.createTransaction({
          userId: payload.freelancerId,
          type: 'EXPENSE',
          amount: payload.resolution.clientRefundAmount,
          currency: contractLink.currency,
          date: new Date(),
          description: `Refund for dispute on ${contractLink.contractTitle}`,
          category: 'Refunds',
          source: 'MARKET',
          projectId: contractLink.projectId ?? undefined,
          tags: ['market', 'dispute', 'refund'],
        });
      }

      // Update project note
      if (contractLink.projectId) {
        await this.projectService.addNote({
          projectId: contractLink.projectId,
          freelancerUserId: payload.freelancerId,
          content: `Dispute resolved: ${payload.resolution.outcome}. Received: $${payload.resolution.freelancerAmount}`,
          noteType: 'DISPUTE_RESOLVED',
        });
      }
    }
  }

  /**
   * Handle contract ended event from Market
   */
  async handleContractEnded(event: ContractEndedEvent): Promise<void> {
    const { payload } = event;
    const correlationId = event.correlationId;

    this.logger.info({
      msg: 'Processing contract ended event',
      contractId: payload.contractId,
      endReason: payload.endReason,
      totalEarned: payload.totalEarned,
      correlationId,
    });

    const contractLink = await this.contractLinkRepo.findByMarketId(payload.contractId);

    if (!contractLink) {
      this.logger.warn({
        msg: 'No contract link found for contract end',
        contractId: payload.contractId,
        correlationId,
      });
      return;
    }

    // Update contract link
    const finalStatus = payload.endReason === 'COMPLETED' ? 'COMPLETED' : 'CANCELLED';
    await this.contractLinkRepo.update(contractLink.id, {
      contractStatus: finalStatus,
      endDate: new Date(payload.endedAt),
      lastSyncedAt: new Date(),
    });

    // Update project
    if (contractLink.projectId) {
      const projectStatus = payload.endReason === 'COMPLETED' ? 'COMPLETED' : 'CANCELLED';

      await this.projectService.updateProject({
        projectId: contractLink.projectId,
        freelancerUserId: payload.freelancerId,
        updates: {
          status: projectStatus,
          completedAt: projectStatus === 'COMPLETED' ? new Date(payload.endedAt) : undefined,
        },
      });

      // Add client feedback as note
      if (payload.clientRating || payload.clientReview) {
        await this.projectService.addNote({
          projectId: contractLink.projectId,
          freelancerUserId: payload.freelancerId,
          content: this.buildFeedbackNote(payload),
          noteType: 'CLIENT_FEEDBACK',
        });
      }
    }

    // Update client stats
    if (contractLink.clientId) {
      await this.clientService.updateClientStats(contractLink.clientId, {
        lastProjectDate: new Date(payload.endedAt),
        totalProjects: { increment: 1 },
        lifetimeValue: { increment: payload.totalEarned },
      });

      if (payload.clientRating) {
        await this.clientService.addRating(contractLink.clientId, {
          rating: payload.clientRating,
          review: payload.clientReview,
          source: 'MARKET',
          contractId: payload.contractId,
        });
      }
    }
  }

  // ==================== Cockpit → Market Sync ====================

  /**
   * Handle time logged in Cockpit project
   */
  async handleProjectTimeLogged(event: ProjectTimeLoggedEvent): Promise<void> {
    const { payload } = event;

    if (!payload.linkedContractId) return;

    const contractLink = await this.contractLinkRepo.findByMarketId(payload.linkedContractId);

    if (!contractLink || !contractLink.autoSyncTime) return;

    // Check if already synced from Market
    const existingLink = await this.timeLinkRepo.findByTimeEntryId(payload.timeEntryId);

    if (existingLink && existingLink.source === 'MARKET') {
      // This time entry came from Market, don't sync back
      return;
    }

    // Mark for push to Market (actual push would be done by a worker)
    if (!existingLink) {
      await this.timeLinkRepo.create({
        contractLinkId: contractLink.id,
        marketTimeLogId: `pending_${payload.timeEntryId}`,
        timeEntryId: payload.timeEntryId,
        source: 'COCKPIT',
        date: new Date(payload.date),
        hours: payload.durationMinutes / 60,
        description: payload.description,
        amount:
          (payload.durationMinutes / 60) *
            (payload.hourlyRate ?? Number(contractLink.hourlyRate)) || 0,
        status: 'PENDING',
        lastSyncedAt: new Date(),
      });
    }
  }

  /**
   * Handle milestone completed in Cockpit project
   */
  async handleProjectMilestoneCompleted(event: ProjectMilestoneCompletedEvent): Promise<void> {
    const { payload } = event;

    if (!payload.linkedContractMilestoneId) return;

    // Find milestone link
    const milestoneLink = await this.milestoneLinkRepo.findByProjectMilestoneId(
      payload.milestoneId
    );

    if (!milestoneLink) return;

    // Mark milestone as submitted in our tracking
    await this.milestoneLinkRepo.update(milestoneLink.id, {
      status: 'SUBMITTED',
      lastSyncedAt: new Date(),
    });

    // Note: Actual submission to Market would be done by a worker/API call
    this.logger.info({
      msg: 'Milestone marked for Market submission',
      milestoneId: milestoneLink.id,
      marketMilestoneId: milestoneLink.marketMilestoneId,
    });
  }

  // ==================== Helper Methods ====================

  private async createProjectFromContract(
    contractLinkId: string,
    contract: ContractCreatedEvent['payload'],
    clientId: string
  ): Promise<void> {
    // Determine budget type and amount
    let budgetType: 'HOURLY' | 'FIXED' | 'RETAINER' = 'HOURLY';
    let budgetAmount: number | undefined;
    let hourlyRate: number | undefined;

    switch (contract.contractType) {
      case 'FIXED_PRICE':
        budgetType = 'FIXED';
        budgetAmount = contract.fixedPrice;
        break;
      case 'HOURLY':
        budgetType = 'HOURLY';
        hourlyRate = contract.hourlyRate;
        budgetAmount = contract.budgetCap;
        break;
      case 'RETAINER':
        budgetType = 'RETAINER';
        budgetAmount = contract.retainerAmount;
        break;
    }

    // Create project
    const project = await this.projectService.createProject({
      freelancerUserId: contract.freelancerId,
      clientId,
      name: contract.title,
      description: contract.description,
      projectType: 'CLIENT_WORK',
      source: 'SKILLANCER_MARKET',
      status: 'IN_PROGRESS',
      startDate: new Date(contract.startDate),
      dueDate: contract.endDate ? new Date(contract.endDate) : undefined,
      budgetType,
      budgetAmount,
      hourlyRate,
      currency: contract.currency,
      tags: ['market', ...contract.skills.slice(0, 5)],
      customFields: {
        market_contract_id: contract.contractId,
        market_job_id: contract.jobId,
        market_job_category: contract.jobCategory,
      },
    });

    // Update contract link with project ID
    await this.contractLinkRepo.update(contractLinkId, {
      projectId: project.id,
    });

    this.logger.info({
      msg: 'Project created from contract',
      projectId: project.id,
      contractId: contract.contractId,
    });

    // Create milestones if contract has them
    if (contract.milestones && contract.milestones.length > 0) {
      for (let i = 0; i < contract.milestones.length; i++) {
        const milestone = contract.milestones[i];
        const projectMilestone = await this.milestoneRepo.create({
          projectId: project.id,
          title: milestone.title,
          description: milestone.description ?? null,
          orderIndex: i,
          dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
          status: 'PENDING',
          marketMilestoneId: milestone.id,
          amount: milestone.amount,
        });

        // Find and update milestone link
        const milestoneLink = await this.milestoneLinkRepo.findByMarketId(
          contractLinkId,
          milestone.id
        );
        if (milestoneLink) {
          await this.milestoneLinkRepo.update(milestoneLink.id, {
            projectMilestoneId: projectMilestone.id,
          });
        }
      }
    }
  }

  private async getOrCreateCockpitClient(
    freelancerId: string,
    marketClient: MarketClientInfo
  ): Promise<ClientSyncResult> {
    // Check if client already linked
    const cached = await this.clientCacheRepo.findByMarketId(marketClient.userId);

    if (cached?.cockpitClientId) {
      const existingClient = await this.clientRepo.findById(cached.cockpitClientId);
      if (existingClient && existingClient.freelancerUserId === freelancerId) {
        return {
          created: false,
          linked: true,
          clientId: existingClient.id,
        };
      }
    }

    // Search for matching client by email
    if (marketClient.email) {
      const matchingClient = await this.clientRepo.findByEmail(freelancerId, marketClient.email);
      if (matchingClient) {
        // Link existing client
        await this.clientCacheRepo.upsert({
          marketUserId: marketClient.userId,
          displayName: marketClient.displayName,
          companyName: marketClient.companyName ?? null,
          email: marketClient.email ?? null,
          avatarUrl: marketClient.avatarUrl ?? null,
          country: marketClient.country ?? null,
          timezone: marketClient.timezone ?? null,
          cockpitClientId: matchingClient.id,
          lastSyncedAt: new Date(),
        });
        return {
          created: false,
          linked: true,
          clientId: matchingClient.id,
        };
      }
    }

    // Create new client
    const nameParts = marketClient.displayName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || undefined;

    const newClient = await this.clientService.createClient({
      freelancerUserId: freelancerId,
      clientType: marketClient.companyName ? 'COMPANY' : 'INDIVIDUAL',
      source: 'SKILLANCER_MARKET',
      companyName: marketClient.companyName ?? undefined,
      firstName,
      lastName,
      email: marketClient.email ?? undefined,
      timezone: marketClient.timezone ?? undefined,
      avatarUrl: marketClient.avatarUrl ?? undefined,
      tags: ['market'],
      customFields: {
        market_user_id: marketClient.userId,
        country: marketClient.country,
      },
    });

    // Cache the client
    await this.clientCacheRepo.upsert({
      marketUserId: marketClient.userId,
      displayName: marketClient.displayName,
      companyName: marketClient.companyName ?? null,
      email: marketClient.email ?? null,
      avatarUrl: marketClient.avatarUrl ?? null,
      country: marketClient.country ?? null,
      timezone: marketClient.timezone ?? null,
      cockpitClientId: newClient.id,
      lastSyncedAt: new Date(),
    });

    return {
      created: true,
      linked: true,
      clientId: newClient.id,
    };
  }

  private async cacheMarketClient(client: MarketClientInfo): Promise<void> {
    await this.clientCacheRepo.upsert({
      marketUserId: client.userId,
      displayName: client.displayName,
      companyName: client.companyName ?? null,
      email: client.email ?? null,
      avatarUrl: client.avatarUrl ?? null,
      country: client.country ?? null,
      timezone: client.timezone ?? null,
      lastSyncedAt: new Date(),
    });
  }

  private async updateContractLink(
    linkId: string,
    contract: ContractCreatedEvent['payload']
  ): Promise<void> {
    await this.contractLinkRepo.update(linkId, {
      contractTitle: contract.title,
      contractStatus: this.mapContractStatus(contract.status),
      hourlyRate: contract.hourlyRate ?? null,
      fixedPrice: contract.fixedPrice ?? null,
      budgetCap: contract.budgetCap ?? null,
      startDate: new Date(contract.startDate),
      endDate: contract.endDate ? new Date(contract.endDate) : null,
      lastSyncedAt: new Date(),
      syncStatus: 'SYNCED',
    });
  }

  // ==================== Mapping Helpers ====================

  private mapContractType(type: string): 'HOURLY' | 'FIXED_PRICE' | 'RETAINER' {
    const map: Record<string, 'HOURLY' | 'FIXED_PRICE' | 'RETAINER'> = {
      HOURLY: 'HOURLY',
      FIXED_PRICE: 'FIXED_PRICE',
      RETAINER: 'RETAINER',
    };
    return map[type] || 'HOURLY';
  }

  private mapContractStatus(
    status: string
  ): 'PENDING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED' {
    const map: Record<
      string,
      'PENDING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED'
    > = {
      PENDING: 'PENDING',
      ACTIVE: 'ACTIVE',
      PAUSED: 'PAUSED',
      COMPLETED: 'COMPLETED',
      CANCELLED: 'CANCELLED',
      DISPUTED: 'DISPUTED',
    };
    return map[status] || 'PENDING';
  }

  private mapMilestoneStatus(
    status: string
  ): 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'PAID' | 'DISPUTED' {
    const map: Record<
      string,
      'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'PAID' | 'DISPUTED'
    > = {
      PENDING: 'PENDING',
      IN_PROGRESS: 'IN_PROGRESS',
      SUBMITTED: 'SUBMITTED',
      APPROVED: 'APPROVED',
      PAID: 'PAID',
      DISPUTED: 'DISPUTED',
    };
    return map[status] || 'PENDING';
  }

  private mapTimeLinkStatus(status: string): 'PENDING' | 'APPROVED' | 'DISPUTED' | 'PAID' {
    const map: Record<string, 'PENDING' | 'APPROVED' | 'DISPUTED' | 'PAID'> = {
      PENDING: 'PENDING',
      APPROVED: 'APPROVED',
      DISPUTED: 'DISPUTED',
      PAID: 'PAID',
    };
    return map[status] || 'PENDING';
  }

  private mapPaymentType(type: string): 'MILESTONE' | 'HOURLY' | 'BONUS' | 'RETAINER' | 'REFUND' {
    const map: Record<string, 'MILESTONE' | 'HOURLY' | 'BONUS' | 'RETAINER' | 'REFUND'> = {
      MILESTONE: 'MILESTONE',
      HOURLY: 'HOURLY',
      BONUS: 'BONUS',
      RETAINER: 'RETAINER',
      REFUND: 'REFUND',
    };
    return map[type] || 'MILESTONE';
  }

  private mapPaymentStatus(
    status: string
  ): 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' {
    const map: Record<string, 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'> = {
      PENDING: 'PENDING',
      PROCESSING: 'PROCESSING',
      COMPLETED: 'COMPLETED',
      FAILED: 'FAILED',
      REFUNDED: 'REFUNDED',
    };
    return map[status] || 'PENDING';
  }

  private buildPaymentDescription(
    payment: ContractPaymentReceivedEvent['payload'],
    contractLink: { contractTitle: string }
  ): string {
    let description = `Skillancer Market: ${contractLink.contractTitle}`;

    switch (payment.paymentType) {
      case 'MILESTONE':
        description += ' - Milestone payment';
        break;
      case 'HOURLY':
        if (payment.weekEnding) {
          description += ` - Week ending ${new Date(payment.weekEnding).toLocaleDateString()}`;
        }
        break;
      case 'BONUS':
        description += ' - Bonus';
        break;
      case 'RETAINER':
        description += ' - Retainer';
        break;
      case 'REFUND':
        description += ' - Refund';
        break;
    }

    return description;
  }

  private buildFeedbackNote(payload: ContractEndedEvent['payload']): string {
    let note = `## Client Feedback\n\n`;

    if (payload.clientRating) {
      note += `**Rating:** ${'⭐'.repeat(payload.clientRating)}\n\n`;
    }

    if (payload.clientReview) {
      note += `**Review:**\n${payload.clientReview}\n\n`;
    }

    if (payload.wouldHireAgain !== undefined) {
      note += `**Would hire again:** ${payload.wouldHireAgain ? 'Yes' : 'No'}\n`;
    }

    note += `\n---\n*Synced from Skillancer Market*`;

    return note;
  }

  // ==================== Manual Sync Operations ====================

  /**
   * Manually sync a contract from Market
   */
  async syncContract(marketContractId: string): Promise<SyncResult> {
    const result: SyncResult = {
      synced: { milestones: 0, timeLogs: 0, payments: 0 },
      errors: [],
    };

    // Implementation would call Market API to get latest data
    // and sync milestones, time logs, and payments

    this.logger.info({
      msg: 'Manual contract sync completed',
      marketContractId,
      result,
    });

    return result;
  }

  /**
   * Link an existing project to a Market contract
   */
  async linkContractToProject(
    marketContractId: string,
    projectId: string,
    syncOptions?: { syncTime?: boolean; syncMilestones?: boolean }
  ): Promise<void> {
    const contractLink = await this.contractLinkRepo.findByMarketId(marketContractId);

    if (!contractLink) {
      throw new Error(`Contract link not found for ${marketContractId}`);
    }

    await this.contractLinkRepo.update(contractLink.id, {
      projectId,
      autoSyncTime: syncOptions?.syncTime ?? true,
    });

    // Optionally sync existing milestones
    if (syncOptions?.syncMilestones) {
      const milestoneLinks = await this.milestoneLinkRepo.findByContractLink(contractLink.id);

      for (const link of milestoneLinks) {
        if (!link.projectMilestoneId) {
          const projectMilestone = await this.milestoneRepo.create({
            projectId,
            title: link.title,
            orderIndex: 0,
            dueDate: link.dueDate,
            status: 'PENDING',
            marketMilestoneId: link.marketMilestoneId,
            amount: Number(link.amount),
          });

          await this.milestoneLinkRepo.update(link.id, {
            projectMilestoneId: projectMilestone.id,
          });
        }
      }
    }

    this.logger.info({
      msg: 'Contract linked to project',
      marketContractId,
      projectId,
    });
  }

  /**
   * Unlink a contract from a project
   */
  async unlinkContractFromProject(
    marketContractId: string,
    keepProject: boolean = true
  ): Promise<void> {
    const contractLink = await this.contractLinkRepo.findByMarketId(marketContractId);

    if (!contractLink) {
      throw new Error(`Contract link not found for ${marketContractId}`);
    }

    if (!keepProject && contractLink.projectId) {
      // Delete project (will cascade to related entities)
      await this.projectRepo.delete(contractLink.projectId);
    }

    await this.contractLinkRepo.update(contractLink.id, {
      projectId: null,
    });

    this.logger.info({
      msg: 'Contract unlinked from project',
      marketContractId,
      keepProject,
    });
  }
}

