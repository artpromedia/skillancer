/**
 * @module @skillancer/cockpit-svc/repositories/webhook-event
 * Webhook Event Repository - Database operations for webhook events
 */

import type { CreateWebhookEventParams } from '../types/integration.types.js';
import type { WebhookEvent, WebhookEventStatus, IntegrationProvider } from '@prisma/client';
import type { PrismaClient } from '@skillancer/database';

export interface WebhookEventFilters {
  integrationId?: string;
  provider?: IntegrationProvider;
  eventType?: string;
  status?: WebhookEventStatus;
  startDate?: Date;
  endDate?: Date;
}

export class WebhookEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(params: CreateWebhookEventParams): Promise<WebhookEvent> {
    return this.prisma.webhookEvent.create({
      data: {
        integrationId: params.integrationId,
        provider: params.provider,
        eventId: params.eventId,
        eventType: params.eventType,
        payload: params.payload as object,
        headers: (params.headers as object) ?? undefined,
        status: (params.status ?? 'PENDING') as WebhookEventStatus,
      },
    });
  }

  async findById(id: string): Promise<WebhookEvent | null> {
    return this.prisma.webhookEvent.findUnique({
      where: { id },
    });
  }

  async findByEventId(
    provider: IntegrationProvider,
    eventId: string
  ): Promise<WebhookEvent | null> {
    return this.prisma.webhookEvent.findFirst({
      where: {
        provider,
        eventId,
      },
    });
  }

  async findPending(limit: number = 100): Promise<WebhookEvent[]> {
    return this.prisma.webhookEvent.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async findByIntegration(integrationId: string, limit: number = 50): Promise<WebhookEvent[]> {
    return this.prisma.webhookEvent.findMany({
      where: { integrationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findByFilters(
    filters: WebhookEventFilters,
    pagination?: { page?: number; limit?: number }
  ): Promise<{ events: WebhookEvent[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (filters.integrationId) {
      where.integrationId = filters.integrationId;
    }
    if (filters.provider) {
      where.provider = filters.provider;
    }
    if (filters.eventType) {
      where.eventType = filters.eventType;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        (where.createdAt as Record<string, Date>).gte = filters.startDate;
      }
      if (filters.endDate) {
        (where.createdAt as Record<string, Date>).lte = filters.endDate;
      }
    }

    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 50;
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      this.prisma.webhookEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.webhookEvent.count({ where }),
    ]);

    return { events, total };
  }

  async findFailedForRetry(maxAttempts: number = 3, limit: number = 100): Promise<WebhookEvent[]> {
    return this.prisma.webhookEvent.findMany({
      where: {
        status: 'FAILED',
        retryCount: { lt: maxAttempts },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async updateStatus(id: string, status: WebhookEventStatus): Promise<WebhookEvent> {
    const data: Record<string, unknown> = { status };

    if (status === 'PROCESSING') {
      data.processedAt = new Date();
    }

    return this.prisma.webhookEvent.update({
      where: { id },
      data,
    });
  }

  async markProcessed(id: string): Promise<WebhookEvent> {
    return this.prisma.webhookEvent.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        processedAt: new Date(),
      },
    });
  }

  async markFailed(
    id: string,
    error: { message: string; details?: Record<string, unknown> }
  ): Promise<WebhookEvent> {
    const event = await this.findById(id);
    if (!event) {
      throw new Error(`Webhook event not found: ${id}`);
    }

    return this.prisma.webhookEvent.update({
      where: { id },
      data: {
        status: 'FAILED',
        processingError: error.message,
        retryCount: event.retryCount + 1,
      },
    });
  }

  async incrementRetry(id: string): Promise<WebhookEvent> {
    return this.prisma.webhookEvent.update({
      where: { id },
      data: {
        retryCount: { increment: 1 },
        status: 'PENDING',
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.webhookEvent.delete({
      where: { id },
    });
  }

  async deleteByIntegration(integrationId: string): Promise<number> {
    const result = await this.prisma.webhookEvent.deleteMany({
      where: { integrationId },
    });
    return result.count;
  }

  async deleteOldEvents(olderThan: Date): Promise<number> {
    const result = await this.prisma.webhookEvent.deleteMany({
      where: {
        createdAt: { lt: olderThan },
        status: { in: ['COMPLETED', 'SKIPPED'] },
      },
    });
    return result.count;
  }

  async getEventStats(since: Date): Promise<{
    total: number;
    processed: number;
    failed: number;
    pending: number;
    byProvider: { provider: IntegrationProvider; count: number }[];
    byEventType: { eventType: string; count: number }[];
  }> {
    const [total, processed, failed, pending, byProvider, byEventType] = await Promise.all([
      this.prisma.webhookEvent.count({ where: { createdAt: { gte: since } } }),
      this.prisma.webhookEvent.count({
        where: { createdAt: { gte: since }, status: 'COMPLETED' },
      }),
      this.prisma.webhookEvent.count({
        where: { createdAt: { gte: since }, status: 'FAILED' },
      }),
      this.prisma.webhookEvent.count({
        where: { createdAt: { gte: since }, status: 'PENDING' },
      }),
      this.prisma.webhookEvent.groupBy({
        by: ['provider'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.webhookEvent.groupBy({
        by: ['eventType'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        take: 20,
        orderBy: { _count: { eventType: 'desc' } },
      }),
    ]);

    return {
      total,
      processed,
      failed,
      pending,
      byProvider: byProvider.map((p) => ({
        provider: p.provider,
        count: p._count._all,
      })),
      byEventType: byEventType.map((e) => ({
        eventType: e.eventType,
        count: e._count._all,
      })),
    };
  }
}
