/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * Invitation Service
 *
 * Manages project invitations:
 * - Send invitations to freelancers
 * - Accept/decline invitations
 * - Track invitation status
 */

import { ProjectService } from './project.service.js';
import { BiddingError, BiddingErrorCode } from '../errors/bidding.errors.js';
import { InvitationRepository } from '../repositories/invitation.repository.js';

import type {
  SendInvitationInput,
  RespondToInvitationInput,
  InvitationListOptions,
  InvitationWithDetails,
  PaginatedResult,
} from '../types/bidding.types.js';
import type { PrismaClient } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Constants
const MAX_INVITATIONS_PER_PROJECT = 50;
const MAX_PENDING_INVITATIONS_PER_USER = 100;
const DEFAULT_EXPIRATION_DAYS = 14;

export class InvitationService {
  private readonly repository: InvitationRepository;
  private readonly projectService: ProjectService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {
    this.repository = new InvitationRepository(prisma);
    this.projectService = new ProjectService(prisma, redis, logger);
  }

  /**
   * Send an invitation to a freelancer
   */
  async sendInvitation(clientId: string, input: SendInvitationInput) {
    // Validate project ownership
    const project = await this.projectService.getProject(input.jobId);
    if (project.clientId !== clientId) {
      throw new BiddingError(BiddingErrorCode.NOT_PROJECT_OWNER);
    }

    // Check if project is open for bidding
    if (project.status !== 'PUBLISHED') {
      throw new BiddingError(
        BiddingErrorCode.PROJECT_NOT_OPEN,
        'Cannot invite freelancers to unpublished projects'
      );
    }

    // Check if invitation already exists
    if (await this.repository.exists(input.jobId, input.freelancerId)) {
      throw new BiddingError(BiddingErrorCode.INVITATION_ALREADY_SENT);
    }

    // Check invitation limits
    const projectInvitations = await this.repository.countPendingByProject(input.jobId);
    if (projectInvitations >= MAX_INVITATIONS_PER_PROJECT) {
      throw new BiddingError(
        BiddingErrorCode.INVITATION_LIMIT_REACHED,
        'Maximum invitations per project reached'
      );
    }

    const userInvitations = await this.repository.countPendingByUser(input.freelancerId);
    if (userInvitations >= MAX_PENDING_INVITATIONS_PER_USER) {
      throw new BiddingError(
        BiddingErrorCode.INVITATION_LIMIT_REACHED,
        'User has too many pending invitations'
      );
    }

    // Verify invitee is a freelancer
    const invitee = await this.prisma.user.findUnique({
      where: { id: input.freelancerId },
      select: { id: true, displayName: true },
    });

    if (!invitee) {
      throw new BiddingError(BiddingErrorCode.USER_NOT_FOUND, 'Invitee not found');
    }

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (input.expiresInDays || DEFAULT_EXPIRATION_DAYS));

    // Create invitation - build data object conditionally
    const createData: {
      jobId: string;
      inviterId: string;
      inviteeId: string;
      message?: string;
      expiresAt: Date;
    } = {
      jobId: input.jobId,
      inviterId: clientId,
      inviteeId: input.freelancerId,
      expiresAt,
    };
    if (input.message) {
      createData.message = input.message;
    }
    const invitation = await this.repository.create(createData);

    // Publish notification
    await this.publishInvitationNotification('INVITATION_RECEIVED', input.freelancerId, {
      invitationId: invitation.id,
      projectId: input.jobId,
      projectTitle: project.title,
      clientName: project.client?.displayName,
      message: input.message,
    });

    this.logger.info({
      msg: 'Invitation sent',
      invitationId: invitation.id,
      projectId: input.jobId,
      inviterId: clientId,
      inviteeId: input.freelancerId,
    });

    return invitation;
  }

  /**
   * Get invitation by ID
   */
  async getInvitation(invitationId: string, userId: string) {
    const invitation = await this.repository.findById(invitationId);

    if (!invitation) {
      throw new BiddingError(BiddingErrorCode.INVITATION_NOT_FOUND);
    }

    // Only inviter or invitee can view
    if (invitation.inviterId !== userId && invitation.inviteeId !== userId) {
      throw new BiddingError(BiddingErrorCode.FORBIDDEN);
    }

    // Mark as viewed if invitee is viewing
    if (invitation.inviteeId === userId && !invitation.viewedAt) {
      await this.repository.markAsViewed(invitationId);
    }

    return invitation;
  }

  /**
   * Respond to an invitation
   */
  async respondToInvitation(input: RespondToInvitationInput, freelancerId: string) {
    const invitation = await this.repository.findById(input.invitationId);

    if (!invitation) {
      throw new BiddingError(BiddingErrorCode.INVITATION_NOT_FOUND);
    }

    if (invitation.inviteeId !== freelancerId) {
      throw new BiddingError(BiddingErrorCode.NOT_INVITATION_RECIPIENT);
    }

    if (invitation.status !== 'PENDING') {
      throw new BiddingError(BiddingErrorCode.INVITATION_ALREADY_RESPONDED);
    }

    // Check if expired
    if (new Date() > new Date(invitation.expiresAt)) {
      await this.repository.updateStatus(input.invitationId, 'EXPIRED');
      throw new BiddingError(BiddingErrorCode.INVITATION_EXPIRED);
    }

    if (input.accept) {
      await this.repository.accept(input.invitationId);

      // Notify client
      await this.publishInvitationNotification('INVITATION_ACCEPTED', invitation.inviterId, {
        invitationId: input.invitationId,
        projectId: invitation.jobId,
        projectTitle: invitation.job.title,
        freelancerName: invitation.invitee?.displayName,
      });

      this.logger.info({
        msg: 'Invitation accepted',
        invitationId: input.invitationId,
        freelancerId,
      });
    } else {
      await this.repository.decline(input.invitationId, input.message);

      // Notify client
      await this.publishInvitationNotification('INVITATION_DECLINED', invitation.inviterId, {
        invitationId: input.invitationId,
        projectId: invitation.jobId,
        projectTitle: invitation.job.title,
        freelancerName: invitation.invitee?.displayName,
        reason: input.message,
      });

      this.logger.info({
        msg: 'Invitation declined',
        invitationId: input.invitationId,
        freelancerId,
        reason: input.message,
      });
    }
  }

  /**
   * Get invitations sent by user (client)
   */
  async getSentInvitations(
    clientId: string,
    options: InvitationListOptions = {}
  ): Promise<PaginatedResult<InvitationWithDetails>> {
    const { status, page = 1, limit = 20 } = options;

    const result = await this.repository.findSentByUser(clientId, { status, page, limit });

    const invitations: InvitationWithDetails[] = result.invitations.map((inv) =>
      this.mapInvitationToDetails(inv)
    );

    return {
      data: invitations,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
      hasMore: page * limit < result.total,
    };
  }

  /**
   * Get invitations received by user (freelancer)
   */
  async getReceivedInvitations(
    freelancerId: string,
    options: InvitationListOptions = {}
  ): Promise<PaginatedResult<InvitationWithDetails>> {
    const { status, page = 1, limit = 20 } = options;

    const result = await this.repository.findReceivedByUser(freelancerId, {
      status,
      page,
      limit,
    });

    const invitations: InvitationWithDetails[] = result.invitations.map((inv) =>
      this.mapInvitationToDetails(inv)
    );

    return {
      data: invitations,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
      hasMore: page * limit < result.total,
    };
  }

  /**
   * Get invitations for a project
   */
  async getProjectInvitations(
    projectId: string,
    clientId: string,
    options: InvitationListOptions = {}
  ): Promise<PaginatedResult<InvitationWithDetails>> {
    // Verify ownership
    const project = await this.projectService.getProject(projectId);
    if (project.clientId !== clientId) {
      throw new BiddingError(BiddingErrorCode.NOT_PROJECT_OWNER);
    }

    const { status, page = 1, limit = 20 } = options;

    const result = await this.repository.findByProjectId(projectId, { status, page, limit });

    const invitations: InvitationWithDetails[] = result.invitations.map((inv) =>
      this.mapInvitationToDetails(inv)
    );

    return {
      data: invitations,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
      hasMore: page * limit < result.total,
    };
  }

  /**
   * Cancel an invitation
   */
  async cancelInvitation(invitationId: string, clientId: string) {
    const invitation = await this.repository.findById(invitationId);

    if (!invitation) {
      throw new BiddingError(BiddingErrorCode.INVITATION_NOT_FOUND);
    }

    if (invitation.inviterId !== clientId) {
      throw new BiddingError(BiddingErrorCode.FORBIDDEN);
    }

    if (invitation.status !== 'PENDING') {
      throw new BiddingError(
        BiddingErrorCode.INVITATION_ALREADY_RESPONDED,
        'Cannot cancel responded invitation'
      );
    }

    await this.repository.updateStatus(invitationId, 'CANCELLED');

    this.logger.info({
      msg: 'Invitation cancelled',
      invitationId,
      clientId,
    });
  }

  /**
   * Resend an invitation
   */
  async resendInvitation(invitationId: string, clientId: string) {
    const invitation = await this.repository.findById(invitationId);

    if (!invitation) {
      throw new BiddingError(BiddingErrorCode.INVITATION_NOT_FOUND);
    }

    if (invitation.inviterId !== clientId) {
      throw new BiddingError(BiddingErrorCode.FORBIDDEN);
    }

    // Can only resend expired or cancelled invitations
    if (!['EXPIRED', 'CANCELLED'].includes(invitation.status)) {
      throw new BiddingError(
        BiddingErrorCode.VALIDATION_ERROR,
        'Can only resend expired or cancelled invitations'
      );
    }

    // Reset invitation
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + DEFAULT_EXPIRATION_DAYS);

    await this.repository.update(invitationId, {
      status: 'PENDING',
      expiresAt: newExpiresAt,
      viewedAt: null,
    });

    // Notify freelancer
    await this.publishInvitationNotification('INVITATION_RECEIVED', invitation.inviteeId, {
      invitationId,
      projectId: invitation.jobId,
      projectTitle: invitation.job.title,
      clientName: invitation.inviter.displayName,
      isResend: true,
    });

    this.logger.info({
      msg: 'Invitation resent',
      invitationId,
      clientId,
    });
  }

  /**
   * Expire old invitations (called by cron)
   */
  async expireOldInvitations(): Promise<number> {
    const count = await this.repository.expireOldInvitations();

    if (count > 0) {
      this.logger.info({
        msg: 'Expired old invitations',
        count,
      });
    }

    return count;
  }

  /**
   * Map invitation to details format
   */
  private mapInvitationToDetails(inv: Record<string, unknown>): InvitationWithDetails {
    const inviter = inv.inviter as Record<string, unknown> | undefined;
    const invitee = inv.invitee as Record<string, unknown> | undefined;
    const inviteeProfile = invitee?.profile as Record<string, unknown> | undefined;
    const job = inv.job as Record<string, unknown>;

    return {
      id: inv.id as string,
      jobId: inv.jobId as string,
      inviterId: inv.inviterId as string,
      inviteeId: inv.inviteeId as string,
      status: inv.status as InvitationWithDetails['status'],
      message: inv.message as string | undefined,
      viewedAt: inv.viewedAt as Date | undefined,
      respondedAt: inv.respondedAt as Date | undefined,
      sentAt: inv.sentAt as Date,
      expiresAt: inv.expiresAt as Date,
      createdAt: inv.createdAt as Date,
      job: {
        id: job?.id as string,
        title: job?.title as string,
        budgetMin: job?.budgetMin as number | undefined,
        budgetMax: job?.budgetMax as number | undefined,
        currency: (job?.currency as string) || 'USD',
      },
      inviter: {
        id: (inviter?.id as string) || '',
        displayName: (inviter?.displayName as string) || '',
        avatarUrl: inviter?.avatarUrl as string | undefined,
      },
      invitee: {
        id: (invitee?.id as string) || '',
        displayName: (invitee?.displayName as string) || '',
        title: inviteeProfile?.title as string | undefined,
        avatarUrl: invitee?.avatarUrl as string | undefined,
        hourlyRate: inviteeProfile?.hourlyRate ? Number(inviteeProfile.hourlyRate) : undefined,
      },
      project: {
        id: job?.id as string,
        title: job?.title as string,
        slug: (job?.slug as string) || '',
      },
    };
  }

  /**
   * Publish invitation notification
   */
  private async publishInvitationNotification(
    type: string,
    recipientId: string,
    data: Record<string, unknown>
  ) {
    const notification = {
      type,
      recipientId,
      data,
      timestamp: new Date().toISOString(),
    };

    await this.redis.lpush('invitation:notifications', JSON.stringify(notification));
  }
}
