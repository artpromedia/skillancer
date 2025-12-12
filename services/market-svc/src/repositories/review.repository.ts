/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * @module @skillancer/market-svc/repositories/review
 * Review data access layer
 *
 * NOTE: This repository uses Prisma client methods that will be available
 * after running `pnpm db:generate` to regenerate the Prisma client with
 * the updated schema.
 */

import type { PrismaClient } from '@skillancer/database';

/**
 * Review Repository
 *
 * Handles database operations for reviews.
 * Uses Prisma client for all database interactions.
 */
export class ReviewRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Find a review by ID
   */
  async findById(id: string) {
    return this.prisma.review.findUnique({
      where: { id },
    });
  }

  /**
   * Find a review by contract and reviewer
   */
  async findByContractAndReviewer(contractId: string, reviewerId: string) {
    return this.prisma.review.findFirst({
      where: {
        contractId,
        reviewerId,
      },
    });
  }

  /**
   * Find reviews for a user (as reviewee)
   */
  async findByReviewee(revieweeId: string, options: { limit?: number; offset?: number } = {}) {
    const { limit = 10, offset = 0 } = options;

    return this.prisma.review.findMany({
      where: {
        revieweeId,
        status: 'REVEALED',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Count reviews for a user
   */
  async countByReviewee(revieweeId: string) {
    return this.prisma.review.count({
      where: {
        revieweeId,
        status: 'REVEALED',
      },
    });
  }

  /**
   * Update a review
   */
  async update(id: string, data: Record<string, unknown>) {
    return this.prisma.review.update({
      where: { id },
      data,
    });
  }
}
