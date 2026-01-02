// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/repositories/interaction
 * Client Interaction data access layer
 */

import { Prisma } from '@skillancer/database';

import type { InteractionSearchParams } from '../types/crm.types.js';
import type { PrismaClient, InteractionType, Sentiment } from '@skillancer/database';

export class InteractionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new interaction
   */
  async create(data: {
    clientId: string;
    freelancerUserId: string;
    interactionType: InteractionType;
    subject?: string | null;
    description: string;
    occurredAt: Date;
    duration?: number | null;
    outcome?: string | null;
    nextSteps?: string | null;
    followUpRequired: boolean;
    followUpDate?: Date | null;
    attachments?: Array<{ name: string; url: string; type: string }> | null;
    sentiment?: Sentiment | null;
    opportunityId?: string | null;
    projectId?: string | null;
  }) {
    return this.prisma.clientInteraction.create({
      data: {
        clientId: data.clientId,
        freelancerUserId: data.freelancerUserId,
        interactionType: data.interactionType,
        subject: data.subject ?? null,
        description: data.description,
        occurredAt: data.occurredAt,
        duration: data.duration ?? null,
        outcome: data.outcome ?? null,
        nextSteps: data.nextSteps ?? null,
        followUpRequired: data.followUpRequired,
        followUpDate: data.followUpDate ?? null,
        attachments: (data.attachments as Prisma.InputJsonValue) ?? Prisma.DbNull,
        sentiment: data.sentiment ?? null,
        opportunityId: data.opportunityId ?? null,
        projectId: data.projectId ?? null,
      },
    });
  }

  /**
   * Find an interaction by ID
   */
  async findById(id: string) {
    return this.prisma.clientInteraction.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
          },
        },
        opportunity: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  }

  /**
   * Find interactions by client
   */
  async findByClient(
    clientId: string,
    params?: {
      interactionType?: InteractionType[];
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      page?: number;
    }
  ) {
    const where: Prisma.ClientInteractionWhereInput = {
      clientId,
      ...(params?.interactionType && { interactionType: { in: params.interactionType } }),
      ...(params?.startDate && { occurredAt: { gte: params.startDate } }),
      ...(params?.endDate && { occurredAt: { lte: params.endDate } }),
    };

    const limit = params?.limit ?? 20;
    const page = params?.page ?? 1;

    const [interactions, total] = await Promise.all([
      this.prisma.clientInteraction.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.clientInteraction.count({ where }),
    ]);

    return { interactions, total };
  }

  /**
   * Count interactions by client since a date
   */
  async countByClient(clientId: string, options?: { since?: Date }) {
    return this.prisma.clientInteraction.count({
      where: {
        clientId,
        ...(options?.since && { occurredAt: { gte: options.since } }),
      },
    });
  }

  /**
   * Find interactions requiring follow-up
   */
  async findPendingFollowUps(freelancerUserId: string, beforeDate?: Date) {
    return this.prisma.clientInteraction.findMany({
      where: {
        freelancerUserId,
        followUpRequired: true,
        followUpDate: beforeDate ? { lte: beforeDate } : { not: null },
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
          },
        },
      },
      orderBy: { followUpDate: 'asc' },
    });
  }

  /**
   * Update an interaction
   */
  async update(
    id: string,
    data: Partial<{
      subject: string | null;
      description: string;
      occurredAt: Date;
      duration: number | null;
      outcome: string | null;
      nextSteps: string | null;
      followUpRequired: boolean;
      followUpDate: Date | null;
      attachments: Array<{ name: string; url: string; type: string }> | null;
      sentiment: Sentiment | null;
    }>
  ) {
    const updateData: Prisma.ClientInteractionUpdateInput = {};

    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.occurredAt !== undefined) updateData.occurredAt = data.occurredAt;
    if (data.duration !== undefined) updateData.duration = data.duration;
    if (data.outcome !== undefined) updateData.outcome = data.outcome;
    if (data.nextSteps !== undefined) updateData.nextSteps = data.nextSteps;
    if (data.followUpRequired !== undefined) updateData.followUpRequired = data.followUpRequired;
    if (data.followUpDate !== undefined) updateData.followUpDate = data.followUpDate;
    if (data.attachments !== undefined) {
      updateData.attachments =
        data.attachments === null ? Prisma.DbNull : (data.attachments as Prisma.InputJsonValue);
    }
    if (data.sentiment !== undefined) updateData.sentiment = data.sentiment;

    return this.prisma.clientInteraction.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete an interaction
   */
  async delete(id: string) {
    return this.prisma.clientInteraction.delete({
      where: { id },
    });
  }
}

