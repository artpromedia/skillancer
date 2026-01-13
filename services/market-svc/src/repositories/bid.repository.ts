/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * @module @skillancer/market-svc/repositories/bid
 * Bid data access layer
 */

import type {
  BidStatus,
  BidType,
  BudgetType,
  BidListOptions,
  ProposedMilestone,
  BidQualityFactors,
} from '../types/bidding.types.js';
import type { PrismaClient, Prisma } from '../types/prisma-shim.js';

/**
 * Bid Repository
 *
 * Handles database operations for bids.
 */
export class BidRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new bid
   */
  async create(data: {
    jobId: string;
    freelancerId: string;
    coverLetter: string;
    proposedRate: number;
    rateType?: BudgetType;
    deliveryDays?: number;
    attachments?: unknown[];
    proposedMilestones?: ProposedMilestone[];
    bidType?: BidType;
    qualityScore?: number;
    qualityFactors?: BidQualityFactors;
    isSpam?: boolean;
    spamReason?: string;
  }) {
    return this.prisma.bid.create({
      data: {
        jobId: data.jobId,
        freelancerId: data.freelancerId,
        coverLetter: data.coverLetter,
        proposedRate: data.proposedRate,
        rateType: data.rateType || 'FIXED',
        deliveryDays: data.deliveryDays ?? null,
        attachments: (data.attachments || []) as unknown as Prisma.InputJsonValue,
        proposedMilestones: data.proposedMilestones as unknown as Prisma.InputJsonValue,
        bidType: data.bidType || 'STANDARD',
        qualityScore: data.qualityScore ?? null,
        qualityFactors: data.qualityFactors as unknown as Prisma.InputJsonValue,
        isSpam: data.isSpam || false,
        spamReason: data.spamReason ?? null,
        status: 'PENDING',
      },
      include: {
        freelancer: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            profile: {
              select: {
                title: true,
                hourlyRate: true,
                country: true,
              },
            },
            ratingAggregation: {
              select: {
                freelancerAverageRating: true,
                freelancerTotalReviews: true,
              },
            },
            trustScore: {
              select: {
                overallScore: true,
                tier: true,
              },
            },
          },
        },
        job: {
          select: {
            id: true,
            title: true,
            clientId: true,
          },
        },
      },
    });
  }

  /**
   * Find a bid by ID
   */
  async findById(id: string) {
    return this.prisma.bid.findUnique({
      where: { id },
      include: {
        freelancer: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            profile: {
              select: {
                title: true,
                hourlyRate: true,
                country: true,
              },
            },
            skills: {
              include: {
                skill: true,
              },
              take: 10,
            },
            ratingAggregation: {
              select: {
                freelancerAverageRating: true,
                freelancerTotalReviews: true,
              },
            },
            trustScore: {
              select: {
                overallScore: true,
                tier: true,
              },
            },
          },
        },
        job: {
          select: {
            id: true,
            title: true,
            slug: true,
            clientId: true,
            status: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });
  }

  /**
   * Find a bid by job and freelancer
   */
  async findByJobAndFreelancer(jobId: string, freelancerId: string) {
    return this.prisma.bid.findUnique({
      where: {
        jobId_freelancerId: {
          jobId,
          freelancerId,
        },
      },
    });
  }

  /**
   * Find all bids for a project
   */
  async findByProjectId(jobId: string, options: BidListOptions = {}) {
    const { status, sortBy = 'newest', includeSpam = false, page = 1, limit = 20 } = options;

    const where: Prisma.BidWhereInput = {
      jobId,
      withdrawnAt: null,
    };

    if (status) {
      where.status = Array.isArray(status) ? { in: status } : status;
    }

    if (!includeSpam) {
      where.isSpam = false;
    }

    const orderBy = this.getSortOrder(sortBy);
    const offset = (page - 1) * limit;

    const [bids, total] = await Promise.all([
      this.prisma.bid.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        include: {
          freelancer: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              profile: {
                select: {
                  title: true,
                  hourlyRate: true,
                  country: true,
                },
              },
              skills: {
                include: {
                  skill: true,
                },
                take: 5,
              },
              ratingAggregation: {
                select: {
                  freelancerAverageRating: true,
                  freelancerTotalReviews: true,
                },
              },
              trustScore: {
                select: {
                  overallScore: true,
                  tier: true,
                },
              },
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
      }),
      this.prisma.bid.count({ where }),
    ]);

    return {
      bids,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find bids by freelancer ID
   */
  async findByFreelancerId(
    freelancerId: string,
    options: {
      status?: BidStatus | BidStatus[];
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const { status, limit = 20, offset = 0 } = options;

    const where: Prisma.BidWhereInput = {
      freelancerId,
      withdrawnAt: null,
    };

    if (status) {
      where.status = Array.isArray(status) ? { in: status } : status;
    }

    const [bids, total] = await Promise.all([
      this.prisma.bid.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          job: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              budgetMin: true,
              budgetMax: true,
              currency: true,
              client: {
                select: {
                  id: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
      }),
      this.prisma.bid.count({ where }),
    ]);

    return { bids, total };
  }

  /**
   * Update a bid
   */
  async update(id: string, data: Partial<Prisma.BidUpdateInput>) {
    return this.prisma.bid.update({
      where: { id },
      data,
      include: {
        freelancer: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
            clientId: true,
          },
        },
      },
    });
  }

  /**
   * Update bid status
   */
  async updateStatus(
    id: string,
    status: BidStatus,
    additionalData?: Partial<Prisma.BidUpdateInput>
  ) {
    const data: Prisma.BidUpdateInput = {
      status,
      ...additionalData,
    };

    // Set timestamp based on status
    switch (status) {
      case 'SHORTLISTED':
        data.shortlistedAt = new Date();
        break;
      case 'INTERVIEW_REQUESTED':
        data.interviewRequestedAt = new Date();
        break;
      case 'REJECTED':
        data.rejectedAt = new Date();
        break;
      case 'WITHDRAWN':
        data.withdrawnAt = new Date();
        break;
    }

    return this.prisma.bid.update({
      where: { id },
      data,
    });
  }

  /**
   * Mark bid as viewed by client
   */
  async markAsViewed(id: string) {
    return this.prisma.bid.update({
      where: { id },
      data: {
        viewedByClientAt: new Date(),
      },
    });
  }

  /**
   * Shortlist a bid
   */
  async shortlist(id: string) {
    return this.updateStatus(id, 'SHORTLISTED');
  }

  /**
   * Reject a bid
   */
  async reject(id: string, reason?: string) {
    return this.updateStatus(id, 'REJECTED', {
      rejectionReason: reason ?? null,
    });
  }

  /**
   * Accept a bid
   */
  async accept(id: string) {
    return this.updateStatus(id, 'ACCEPTED');
  }

  /**
   * Withdraw a bid
   */
  async withdraw(id: string) {
    return this.updateStatus(id, 'WITHDRAWN');
  }

  /**
   * Check if bid exists
   */
  async exists(jobId: string, freelancerId: string): Promise<boolean> {
    const bid = await this.prisma.bid.findUnique({
      where: {
        jobId_freelancerId: {
          jobId,
          freelancerId,
        },
      },
      select: { id: true },
    });

    return bid !== null;
  }

  /**
   * Count active bids by freelancer
   */
  async countActiveByFreelancer(freelancerId: string): Promise<number> {
    return this.prisma.bid.count({
      where: {
        freelancerId,
        status: {
          in: ['PENDING', 'SHORTLISTED', 'INTERVIEW_REQUESTED', 'INTERVIEW_SCHEDULED'],
        },
        withdrawnAt: null,
      },
    });
  }

  /**
   * Get bid statistics for a project
   */
  async getProjectBidStats(jobId: string) {
    const stats = await this.prisma.bid.aggregate({
      where: {
        jobId,
        withdrawnAt: null,
        isSpam: false,
      },
      _count: true,
      _avg: {
        proposedRate: true,
        qualityScore: true,
        deliveryDays: true,
      },
      _min: {
        proposedRate: true,
      },
      _max: {
        proposedRate: true,
      },
    });

    const statusCounts = await this.prisma.bid.groupBy({
      by: ['status'],
      where: {
        jobId,
        withdrawnAt: null,
        isSpam: false,
      },
      _count: true,
    });

    return {
      totalBids: stats._count,
      averageRate: stats._avg.proposedRate,
      averageQualityScore: stats._avg.qualityScore,
      averageDeliveryDays: stats._avg.deliveryDays,
      minRate: stats._min.proposedRate,
      maxRate: stats._max.proposedRate,
      statusCounts: statusCounts.reduce(
        (acc, { status, _count }) => {
          acc[status] = _count;
          return acc;
        },
        {} as Record<string, number>
      ),
    };
  }

  /**
   * Get comparison data for bids
   */
  async getComparisonData(bidIds: string[]) {
    return this.prisma.bid.findMany({
      where: {
        id: { in: bidIds },
      },
      include: {
        freelancer: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            profile: {
              select: {
                title: true,
                hourlyRate: true,
                country: true,
                yearsExperience: true,
              },
            },
            skills: {
              include: {
                skill: true,
              },
            },
            ratingAggregation: {
              select: {
                freelancerAverageRating: true,
                freelancerTotalReviews: true,
              },
            },
            trustScore: {
              select: {
                overallScore: true,
                tier: true,
              },
            },
            _count: {
              select: {
                contractsAsFreelancer: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get sort order based on sortBy parameter
   */
  private getSortOrder(sortBy: string): Prisma.BidOrderByWithRelationInput {
    switch (sortBy) {
      case 'newest':
        return { submittedAt: 'desc' };
      case 'quality_score':
        return { qualityScore: 'desc' };
      case 'rate_low':
        return { proposedRate: 'asc' };
      case 'rate_high':
        return { proposedRate: 'desc' };
      case 'delivery_days':
        return { deliveryDays: 'asc' };
      default:
        return { submittedAt: 'desc' };
    }
  }
}
