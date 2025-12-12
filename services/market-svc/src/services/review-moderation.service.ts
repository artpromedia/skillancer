/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * Review Moderation Service
 *
 * Handles content moderation for reviews including:
 * - Profanity filtering
 * - Spam detection
 * - Report handling
 * - Admin moderation workflows
 */

import type { PrismaClient, Review, ReviewReport, ReportStatus } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Common profanity patterns (simplified - in production use a proper library)
const PROFANITY_PATTERNS = [
  /\b(f+u+c+k+|sh+i+t+|a+s+s+h+o+l+e+|b+i+t+c+h+|d+a+m+n+)\b/gi,
  /\b(bastard|crap|dick|piss|slut|whore)\b/gi,
];

// Spam indicators
const SPAM_INDICATORS = [
  /(.)\1{4,}/g, // Repeated characters (5+)
  /https?:\/\/[^\s]+/gi, // URLs
  /\b\d{10,}\b/g, // Long numbers (phone numbers)
  /[\w.-]+@[\w.-]+\.\w+/g, // Email addresses
  /\b(buy now|click here|free money|act now|limited time)\b/gi, // Spam phrases
];

export interface ModerationResult {
  isClean: boolean;
  hasProfanity: boolean;
  hasSpam: boolean;
  flaggedContent: string[];
  sanitizedContent?: string;
  suggestedAction: 'approve' | 'review' | 'reject';
}

export interface ModerationQueueItem {
  review: Review;
  reports: ReviewReport[];
  reportCount: number;
  autoFlagged: boolean;
  flagReasons: string[];
}

export interface ModerateReviewParams {
  reviewId: string;
  moderatorId: string;
  action: 'approve' | 'hide' | 'delete';
  reason: string;
}

export interface ResolveReportParams {
  reportId: string;
  moderatorId: string;
  status: ReportStatus;
  resolution: string;
}

export class ReviewModerationService {
  private readonly AUTO_FLAG_THRESHOLD = 3; // Auto-flag after this many reports

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {}

  /**
   * Analyze content for moderation issues
   */
  analyzeContent(content: string): ModerationResult {
    const flaggedContent: string[] = [];
    let hasProfanity = false;
    let hasSpam = false;

    // Check for profanity
    for (const pattern of PROFANITY_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        hasProfanity = true;
        flaggedContent.push(...matches);
      }
    }

    // Check for spam
    for (const pattern of SPAM_INDICATORS) {
      const matches = content.match(pattern);
      if (matches) {
        hasSpam = true;
        flaggedContent.push(...matches);
      }
    }

    const isClean = !hasProfanity && !hasSpam;

    // Determine suggested action
    let suggestedAction: 'approve' | 'review' | 'reject' = 'approve';
    if (hasProfanity && hasSpam) {
      suggestedAction = 'reject';
    } else if (hasProfanity || hasSpam) {
      suggestedAction = 'review';
    }

    const result: ModerationResult = {
      isClean,
      hasProfanity,
      hasSpam,
      flaggedContent: [...new Set(flaggedContent)],
      suggestedAction,
    };

    if (!isClean) {
      result.sanitizedContent = this.sanitizeContent(content);
    }

    return result;
  }

  /**
   * Sanitize content by masking profanity
   */
  sanitizeContent(content: string): string {
    let sanitized = content;

    for (const pattern of PROFANITY_PATTERNS) {
      sanitized = sanitized.replace(pattern, (match) => '*'.repeat(match.length));
    }

    return sanitized;
  }

  /**
   * Get moderation queue
   */
  async getModerationQueue(options: { page?: number; limit?: number } = {}): Promise<{
    items: ModerationQueueItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    // Get reviews that need moderation
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: {
          OR: [
            { moderatedAt: null },
            {
              reports: {
                some: {
                  status: 'PENDING',
                },
              },
            },
          ],
        },
        include: {
          reports: {
            where: { status: 'PENDING' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.review.count({
        where: {
          OR: [
            { moderatedAt: null },
            {
              reports: {
                some: {
                  status: 'PENDING',
                },
              },
            },
          ],
        },
      }),
    ]);

    const items: ModerationQueueItem[] = reviews.map((review) => {
      const reportCount = review.reports.length;
      const autoFlagged = reportCount >= this.AUTO_FLAG_THRESHOLD;
      const flagReasons: string[] = [];

      if (autoFlagged) {
        flagReasons.push(`Auto-flagged: ${reportCount} reports`);
      }

      // Analyze content if present
      if (review.content) {
        const analysis = this.analyzeContent(review.content);
        if (analysis.hasProfanity) flagReasons.push('Contains profanity');
        if (analysis.hasSpam) flagReasons.push('Contains spam indicators');
      }

      return {
        review,
        reports: review.reports,
        reportCount,
        autoFlagged,
        flagReasons,
      };
    });

    return {
      items,
      total,
      page,
      limit,
    };
  }

  /**
   * Get review with all reports for moderation
   */
  async getReviewWithReports(reviewId: string): Promise<{
    review: Review;
    reports: ReviewReport[];
    analysis: ModerationResult | null;
  }> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        reports: {
          orderBy: { createdAt: 'desc' },
        },
        reviewer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        reviewee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!review) {
      throw new Error('Review not found');
    }

    const analysis = review.content ? this.analyzeContent(review.content) : null;

    return {
      review,
      reports: review.reports,
      analysis,
    };
  }

  /**
   * Moderate a review
   */
  async moderateReview(params: ModerateReviewParams): Promise<Review> {
    const { reviewId, moderatorId, action, reason } = params;

    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new Error('Review not found');
    }

    let updatedReview: Review;

    switch (action) {
      case 'approve':
        updatedReview = await this.prisma.review.update({
          where: { id: reviewId },
          data: {
            moderatedAt: new Date(),
            moderatedBy: moderatorId,
            moderationReason: reason || null,
          },
        });
        break;

      case 'hide':
        updatedReview = await this.prisma.review.update({
          where: { id: reviewId },
          data: {
            status: 'HIDDEN',
            moderatedAt: new Date(),
            moderatedBy: moderatorId,
            moderationReason: reason || null,
          },
        });
        break;

      case 'delete':
        // Soft delete by hiding and marking
        updatedReview = await this.prisma.review.update({
          where: { id: reviewId },
          data: {
            status: 'HIDDEN',
            moderatedAt: new Date(),
            moderatedBy: moderatorId,
            moderationReason: `DELETED: ${reason || 'No reason provided'}`,
          },
        });
        break;

      default:
        throw new Error(`Unknown moderation action: ${String(action)}`);
    }

    // Resolve all pending reports for this review
    await this.prisma.reviewReport.updateMany({
      where: {
        reviewId,
        status: 'PENDING',
      },
      data: {
        status: action === 'hide' || action === 'delete' ? 'RESOLVED' : 'DISMISSED',
        resolvedBy: moderatorId,
        resolvedAt: new Date(),
        resolution: `Moderation action: ${action}`,
      },
    });

    this.logger.info({
      msg: 'Review moderated',
      reviewId,
      moderatorId,
      action,
      reason,
    });

    return updatedReview;
  }

  /**
   * Get pending reports
   */
  async getPendingReports(options: { page?: number; limit?: number } = {}): Promise<{
    reports: ReviewReport[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      this.prisma.reviewReport.findMany({
        where: { status: 'PENDING' },
        include: {
          review: true,
          reporter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.reviewReport.count({
        where: { status: 'PENDING' },
      }),
    ]);

    return {
      reports,
      total,
      page,
      limit,
    };
  }

  /**
   * Resolve a specific report
   */
  async resolveReport(params: ResolveReportParams): Promise<ReviewReport> {
    const { reportId, moderatorId, status, resolution } = params;

    const report = await this.prisma.reviewReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new Error('Report not found');
    }

    if (report.status !== 'PENDING') {
      throw new Error('Report has already been resolved');
    }

    const updatedReport = await this.prisma.reviewReport.update({
      where: { id: reportId },
      data: {
        status,
        resolvedBy: moderatorId,
        resolvedAt: new Date(),
        resolution: resolution || null,
      },
    });

    this.logger.info({
      msg: 'Report resolved',
      reportId,
      moderatorId,
      status,
    });

    return updatedReport;
  }

  /**
   * Get system statistics
   */
  async getSystemStats(): Promise<{
    pendingReviews: number;
    pendingReports: number;
    totalReviews: number;
    hiddenReviews: number;
    recentModerations: number;
  }> {
    const [pendingReviews, pendingReports, totalReviews, hiddenReviews, recentModerations] =
      await Promise.all([
        this.prisma.review.count({
          where: { moderatedAt: null },
        }),
        this.prisma.reviewReport.count({
          where: { status: 'PENDING' },
        }),
        this.prisma.review.count(),
        this.prisma.review.count({
          where: { status: 'HIDDEN' },
        }),
        this.prisma.review.count({
          where: {
            moderatedAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
        }),
      ]);

    return {
      pendingReviews,
      pendingReports,
      totalReviews,
      hiddenReviews,
      recentModerations,
    };
  }
}
