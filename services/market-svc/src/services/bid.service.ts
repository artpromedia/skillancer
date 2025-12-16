/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * Bid Service
 *
 * Core service for managing bids:
 * - Submit and update bids
 * - Shortlist, reject, and accept bids
 * - Bid messaging
 * - Bid quality scoring
 */

import { BidQualityService } from './bid-quality.service.js';
import { ProjectService } from './project.service.js';
import { BiddingError, BiddingErrorCode } from '../errors/bidding.errors.js';
import { BidRepository } from '../repositories/bid.repository.js';

import type {
  SubmitBidInput,
  UpdateBidInput,
  BidListOptions,
  BidWithDetails,
  BidComparisonData,
  ShortlistBidInput,
  RejectBidInput,
  RequestInterviewInput,
  ScheduleInterviewInput,
  AcceptBidInput,
  BidStatus,
  PaginatedResult,
} from '../types/bidding.types.js';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Constants
const MAX_ACTIVE_BIDS_PER_FREELANCER = 50;

export class BidService {
  private readonly repository: BidRepository;
  private readonly projectService: ProjectService;
  private readonly qualityService: BidQualityService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {
    this.repository = new BidRepository(prisma);
    this.projectService = new ProjectService(prisma, redis, logger);
    this.qualityService = new BidQualityService(prisma, redis, logger);
  }

  /**
   * Submit a new bid
   */
  async submitBid(freelancerId: string, input: SubmitBidInput) {
    // Validate project is open for bidding
    const project = await this.projectService.validateProjectForBidding(input.jobId, freelancerId);

    // Check if bid already exists
    if (await this.repository.exists(input.jobId, freelancerId)) {
      throw new BiddingError(BiddingErrorCode.BID_ALREADY_EXISTS);
    }

    // Check active bid limit
    const activeBids = await this.repository.countActiveByFreelancer(freelancerId);
    if (activeBids >= MAX_ACTIVE_BIDS_PER_FREELANCER) {
      throw new BiddingError(BiddingErrorCode.BID_LIMIT_REACHED);
    }

    // Calculate bid quality score
    const qualityResult = await this.qualityService.calculateQualityScore({
      jobId: input.jobId,
      freelancerId,
      coverLetter: input.coverLetter,
      proposedRate: input.proposedRate,
      budgetMin: project.budgetMin ? Number(project.budgetMin) : undefined,
      budgetMax: project.budgetMax ? Number(project.budgetMax) : undefined,
    });

    // Block spam bids
    if (qualityResult.isSpam) {
      throw new BiddingError(BiddingErrorCode.BID_SPAM_DETECTED, qualityResult.spamReason);
    }

    // Create the bid - only include defined optional fields
    const createData: Parameters<typeof this.repository.create>[0] = {
      jobId: input.jobId,
      freelancerId,
      coverLetter: input.coverLetter,
      proposedRate: input.proposedRate,
      qualityScore: qualityResult.score,
      qualityFactors: qualityResult.factors,
      isSpam: false,
    };
    if (input.rateType) createData.rateType = input.rateType;
    if (input.deliveryDays !== undefined) createData.deliveryDays = input.deliveryDays;
    if (input.attachments) createData.attachments = input.attachments;
    if (input.proposedMilestones) createData.proposedMilestones = input.proposedMilestones;

    const bid = await this.repository.create(createData);

    // Publish notification event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bidWithFreelancer = bid as any;
    await this.publishBidNotification('BID_RECEIVED', project.clientId, {
      bidId: bid.id,
      projectId: input.jobId,
      projectTitle: project.title,
      freelancerName: bidWithFreelancer.freelancer?.displayName || 'Unknown',
    });

    this.logger.info({
      msg: 'Bid submitted',
      bidId: bid.id,
      projectId: input.jobId,
      freelancerId,
      qualityScore: qualityResult.score,
    });

    return bid;
  }

  /**
   * Get a bid by ID
   */
  async getBid(bidId: string, userId: string) {
    const bid = await this.repository.findById(bidId);

    if (!bid) {
      throw new BiddingError(BiddingErrorCode.BID_NOT_FOUND);
    }

    // Only bid owner or project owner can view full bid details
    if (bid.freelancerId !== userId && bid.job.clientId !== userId) {
      throw new BiddingError(BiddingErrorCode.FORBIDDEN);
    }

    // Mark as viewed if client is viewing
    if (bid.job.clientId === userId && !bid.viewedByClientAt) {
      await this.repository.markAsViewed(bidId);
    }

    return bid;
  }

  /**
   * Update a bid
   */
  async updateBid(bidId: string, freelancerId: string, input: UpdateBidInput) {
    const bid = await this.repository.findById(bidId);

    if (!bid) {
      throw new BiddingError(BiddingErrorCode.BID_NOT_FOUND);
    }

    if (bid.freelancerId !== freelancerId) {
      throw new BiddingError(BiddingErrorCode.NOT_BID_OWNER);
    }

    // Can only update pending bids
    if (bid.status !== 'PENDING') {
      throw new BiddingError(BiddingErrorCode.INVALID_BID_STATUS, 'Can only update pending bids');
    }

    const updateData: Record<string, unknown> = {};

    if (input.coverLetter) updateData.coverLetter = input.coverLetter;
    if (input.proposedRate !== undefined) updateData.proposedRate = input.proposedRate;
    if (input.rateType) updateData.rateType = input.rateType;
    if (input.deliveryDays !== undefined) updateData.deliveryDays = input.deliveryDays;
    if (input.attachments) updateData.attachments = input.attachments;
    if (input.proposedMilestones) updateData.proposedMilestones = input.proposedMilestones;

    // Recalculate quality score if content changed
    if (input.coverLetter || input.proposedRate !== undefined) {
      const project = await this.projectService.getProject(bid.jobId);
      const qualityResult = await this.qualityService.calculateQualityScore({
        jobId: bid.jobId,
        freelancerId,
        coverLetter: input.coverLetter || bid.coverLetter,
        proposedRate: input.proposedRate ?? Number(bid.proposedRate),
        budgetMin: project.budgetMin ? Number(project.budgetMin) : undefined,
        budgetMax: project.budgetMax ? Number(project.budgetMax) : undefined,
      });

      updateData.qualityScore = qualityResult.score;
      updateData.qualityFactors = qualityResult.factors;
    }

    const updatedBid = await this.repository.update(bidId, updateData);

    this.logger.info({
      msg: 'Bid updated',
      bidId,
      freelancerId,
    });

    return updatedBid;
  }

  /**
   * Withdraw a bid
   */
  async withdrawBid(bidId: string, freelancerId: string) {
    const bid = await this.repository.findById(bidId);

    if (!bid) {
      throw new BiddingError(BiddingErrorCode.BID_NOT_FOUND);
    }

    if (bid.freelancerId !== freelancerId) {
      throw new BiddingError(BiddingErrorCode.NOT_BID_OWNER);
    }

    // Can only withdraw pending or shortlisted bids
    if (!['PENDING', 'SHORTLISTED', 'INTERVIEW_REQUESTED'].includes(bid.status)) {
      throw new BiddingError(
        BiddingErrorCode.INVALID_BID_STATUS,
        'Cannot withdraw bid in current status'
      );
    }

    await this.repository.withdraw(bidId);

    this.logger.info({
      msg: 'Bid withdrawn',
      bidId,
      freelancerId,
    });
  }

  /**
   * Get bids for a project
   */
  async getProjectBids(
    projectId: string,
    userId: string,
    options: BidListOptions = {}
  ): Promise<PaginatedResult<BidWithDetails>> {
    // Verify user is project owner
    const project = await this.projectService.getProject(projectId);
    if (project.clientId !== userId) {
      throw new BiddingError(BiddingErrorCode.NOT_PROJECT_OWNER);
    }

    const result = await this.repository.findByProjectId(projectId, options);

    const bids: BidWithDetails[] = result.bids.map((b) => this.mapBidToDetails(b));

    return {
      data: bids,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      hasMore: result.page < result.totalPages,
    };
  }

  /**
   * Get bids by freelancer
   */
  async getFreelancerBids(
    freelancerId: string,
    options: {
      status?: BidStatus | BidStatus[];
      page?: number;
      limit?: number;
    } = {}
  ) {
    const { status, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const result = await this.repository.findByFreelancerId(freelancerId, {
      ...(status ? { status } : {}),
      limit,
      offset,
    });

    return {
      data: result.bids,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
      hasMore: page * limit < result.total,
    };
  }

  /**
   * Shortlist a bid
   */
  async shortlistBid(input: ShortlistBidInput, userId: string) {
    const bid = await this.validateBidAction(input.bidId, userId, ['PENDING']);

    await this.repository.shortlist(input.bidId);

    // Notify freelancer
    await this.publishBidNotification('BID_SHORTLISTED', bid.freelancerId, {
      bidId: input.bidId,
      projectId: bid.jobId,
      projectTitle: bid.job.title,
    });

    this.logger.info({
      msg: 'Bid shortlisted',
      bidId: input.bidId,
      userId,
    });
  }

  /**
   * Reject a bid
   */
  async rejectBid(input: RejectBidInput, userId: string) {
    const bid = await this.validateBidAction(input.bidId, userId, [
      'PENDING',
      'SHORTLISTED',
      'INTERVIEW_REQUESTED',
      'INTERVIEW_SCHEDULED',
    ]);

    await this.repository.reject(input.bidId, input.reason);

    // Notify freelancer if requested
    if (input.notifyFreelancer !== false) {
      await this.publishBidNotification('BID_REJECTED', bid.freelancerId, {
        bidId: input.bidId,
        projectId: bid.jobId,
        projectTitle: bid.job.title,
        reason: input.reason,
      });
    }

    this.logger.info({
      msg: 'Bid rejected',
      bidId: input.bidId,
      userId,
    });
  }

  /**
   * Request interview
   */
  async requestInterview(input: RequestInterviewInput, userId: string) {
    const bid = await this.validateBidAction(input.bidId, userId, ['PENDING', 'SHORTLISTED']);

    await this.repository.updateStatus(input.bidId, 'INTERVIEW_REQUESTED');

    // Create system message if message provided
    if (input.message) {
      await this.prisma.bidMessage.create({
        data: {
          bidId: input.bidId,
          senderId: userId,
          content: input.message,
          messageType: 'INTERVIEW_REQUEST',
        },
      });
    }

    // Notify freelancer
    await this.publishBidNotification('INTERVIEW_REQUESTED', bid.freelancerId, {
      bidId: input.bidId,
      projectId: bid.jobId,
      projectTitle: bid.job.title,
      message: input.message,
    });

    this.logger.info({
      msg: 'Interview requested',
      bidId: input.bidId,
      userId,
    });
  }

  /**
   * Schedule interview
   */
  async scheduleInterview(input: ScheduleInterviewInput, userId: string) {
    const bid = await this.validateBidAction(input.bidId, userId, [
      'SHORTLISTED',
      'INTERVIEW_REQUESTED',
    ]);

    await this.repository.updateStatus(input.bidId, 'INTERVIEW_SCHEDULED', {
      interviewScheduledAt: input.scheduledAt,
      interviewNotes: input.notes ?? null,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bidWithJob = bid as any;
    // Notify freelancer
    await this.publishBidNotification('INTERVIEW_SCHEDULED', bid.freelancerId, {
      bidId: input.bidId,
      projectId: bid.jobId,
      projectTitle: bidWithJob.job?.title || 'Project',
      scheduledAt: input.scheduledAt,
      meetingUrl: input.meetingUrl,
    });

    this.logger.info({
      msg: 'Interview scheduled',
      bidId: input.bidId,
      userId,
      scheduledAt: input.scheduledAt,
    });
  }

  /**
   * Accept a bid
   */
  async acceptBid(input: AcceptBidInput, userId: string) {
    const bid = await this.validateBidAction(input.bidId, userId, [
      'PENDING',
      'SHORTLISTED',
      'INTERVIEW_REQUESTED',
      'INTERVIEW_SCHEDULED',
    ]);

    // Accept this bid
    await this.repository.accept(input.bidId);

    // Reject all other bids for this project
    const otherBids = await this.prisma.bid.findMany({
      where: {
        jobId: bid.jobId,
        id: { not: input.bidId },
        status: { in: ['PENDING', 'SHORTLISTED', 'INTERVIEW_REQUESTED', 'INTERVIEW_SCHEDULED'] },
      },
      select: { id: true, freelancerId: true },
    });

    for (const otherBid of otherBids) {
      await this.repository.reject(otherBid.id, 'Another bid was accepted');
      await this.publishBidNotification('BID_REJECTED', otherBid.freelancerId, {
        bidId: otherBid.id,
        projectId: bid.jobId,
        projectTitle: bid.job.title,
        reason: 'Another freelancer was selected for this project',
      });
    }

    // Notify accepted freelancer
    await this.publishBidNotification('BID_ACCEPTED', bid.freelancerId, {
      bidId: input.bidId,
      projectId: bid.jobId,
      projectTitle: bid.job.title,
      message: input.message,
    });

    this.logger.info({
      msg: 'Bid accepted',
      bidId: input.bidId,
      userId,
      projectId: bid.jobId,
    });

    return bid;
  }

  /**
   * Get bid comparison data
   */
  async compareBids(bidIds: string[], userId: string): Promise<BidComparisonData> {
    if (bidIds.length === 0) {
      throw new BiddingError(BiddingErrorCode.VALIDATION_ERROR, 'No bids provided');
    }

    // Get first bid to verify project ownership
    const firstBidId = bidIds[0];
    if (!firstBidId) {
      throw new BiddingError(BiddingErrorCode.VALIDATION_ERROR, 'No bids provided');
    }

    const firstBid = await this.repository.findById(firstBidId);
    if (!firstBid) {
      throw new BiddingError(BiddingErrorCode.BID_NOT_FOUND);
    }

    const project = await this.projectService.getProject(firstBid.jobId);
    if (project.clientId !== userId) {
      throw new BiddingError(BiddingErrorCode.NOT_PROJECT_OWNER);
    }

    const bids = await this.repository.getComparisonData(bidIds);

    const rates = bids.map((b) => Number(b.proposedRate));
    const deliveryDays = bids.map((b) => b.deliveryDays).filter((d): d is number => d !== null);

    const sortedRates = [...rates].sort((a, b) => a - b);
    let medianRate = 0;
    if (sortedRates.length > 0) {
      const midIndex = Math.floor(sortedRates.length / 2);
      if (sortedRates.length % 2 === 0) {
        const leftMid = sortedRates[midIndex - 1] ?? 0;
        const rightMid = sortedRates[midIndex] ?? 0;
        medianRate = (leftMid + rightMid) / 2;
      } else {
        medianRate = sortedRates[midIndex] ?? 0;
      }
    }

    const qualityScores = bids.map((b) => Number(b.qualityScore) || 0);
    const qualityDistribution = {
      excellent: qualityScores.filter((s) => s >= 80).length,
      good: qualityScores.filter((s) => s >= 60 && s < 80).length,
      fair: qualityScores.filter((s) => s >= 40 && s < 60).length,
      poor: qualityScores.filter((s) => s < 40).length,
    };

    return {
      bids: bids.map((b) => this.mapBidToDetails(b)),
      averageRate: rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0,
      medianRate,
      rateRange: {
        min: rates.length > 0 ? Math.min(...rates) : 0,
        max: rates.length > 0 ? Math.max(...rates) : 0,
      },
      averageDeliveryDays:
        deliveryDays.length > 0 ? deliveryDays.reduce((a, b) => a + b, 0) / deliveryDays.length : 0,
      topSkillMatches: [], // Would need more complex matching logic
      qualityDistribution,
    };
  }

  /**
   * Get bid statistics for a project
   */
  async getProjectBidStats(projectId: string, userId: string) {
    const project = await this.projectService.getProject(projectId);
    if (project.clientId !== userId) {
      throw new BiddingError(BiddingErrorCode.NOT_PROJECT_OWNER);
    }

    return this.repository.getProjectBidStats(projectId);
  }

  /**
   * Validate bid action
   */
  private async validateBidAction(bidId: string, userId: string, allowedStatuses: BidStatus[]) {
    const bid = await this.repository.findById(bidId);

    if (!bid) {
      throw new BiddingError(BiddingErrorCode.BID_NOT_FOUND);
    }

    if (bid.job.clientId !== userId) {
      throw new BiddingError(BiddingErrorCode.NOT_PROJECT_OWNER);
    }

    if (!allowedStatuses.includes(bid.status as BidStatus)) {
      throw new BiddingError(BiddingErrorCode.INVALID_BID_STATUS);
    }

    return bid;
  }

  /**
   * Map bid to details format
   */
  private mapBidToDetails(bid: Record<string, unknown>): BidWithDetails {
    const freelancer = bid.freelancer as Record<string, unknown>;
    const profile = freelancer?.profile as Record<string, unknown>;
    const ratingAgg = freelancer?.ratingAggregation as Record<string, unknown>;
    const trustScore = freelancer?.trustScore as Record<string, unknown>;
    const skills = (freelancer?.skills as Array<Record<string, unknown>>) || [];
    const _count = bid._count as Record<string, number>;

    return {
      id: bid.id as string,
      jobId: bid.jobId as string,
      freelancerId: bid.freelancerId as string,
      status: bid.status as BidWithDetails['status'],
      bidType: bid.bidType as BidWithDetails['bidType'],
      coverLetter: bid.coverLetter as string,
      proposedRate: Number(bid.proposedRate),
      rateType: bid.rateType as BidWithDetails['rateType'],
      deliveryDays: bid.deliveryDays as number | undefined,
      attachments: (bid.attachments as BidWithDetails['attachments']) || [],
      proposedMilestones: bid.proposedMilestones as BidWithDetails['proposedMilestones'],
      qualityScore: bid.qualityScore as number | undefined,
      qualityFactors: bid.qualityFactors as BidWithDetails['qualityFactors'],
      isSpam: bid.isSpam as boolean,
      isBoosted: bid.isBoosted as boolean,
      viewedByClientAt: bid.viewedByClientAt as Date | undefined,
      shortlistedAt: bid.shortlistedAt as Date | undefined,
      submittedAt: bid.submittedAt as Date,
      freelancer: {
        id: freelancer?.id as string,
        displayName: (freelancer?.displayName as string) || '',
        title: profile?.title as string | undefined,
        avatarUrl: freelancer?.avatarUrl as string | undefined,
        hourlyRate: profile?.hourlyRate ? Number(profile.hourlyRate) : undefined,
        rating: ratingAgg?.freelancerAverageRating
          ? Number(ratingAgg.freelancerAverageRating)
          : undefined,
        reviewCount: ratingAgg?.freelancerTotalReviews as number | undefined,
        completedJobs: (freelancer?._count as Record<string, number>)?.contractsAsFreelancer,
        skills: skills.map((s) => {
          const skill = s.skill as Record<string, unknown>;
          return {
            id: skill?.id as string,
            name: skill?.name as string,
            slug: skill?.slug as string,
            category: skill?.category as string | undefined,
          };
        }),
        country: profile?.country as string | undefined,
        trustScore: trustScore?.overallScore as number | undefined,
        trustTier: trustScore?.tier as string | undefined,
      },
      messageCount: _count?.messages,
    };
  }

  /**
   * Publish bid notification to Redis for async processing
   */
  private async publishBidNotification(
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

    await this.redis.lpush('bid:notifications', JSON.stringify(notification));
  }
}
