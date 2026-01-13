// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/repositories/external-calendar
 * External Calendar Repository
 */

import type { PrismaClient, ExternalCalendar } from '../types/prisma-shim.js';

export interface UpsertCalendarData {
  connectionId: string;
  externalId: string;
  name: string;
  description?: string | null;
  color?: string | null;
  timezone?: string | null;
  accessRole?: string | null;
  isPrimary?: boolean;
  syncEnabled?: boolean;
}

export class ExternalCalendarRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<ExternalCalendar | null> {
    return this.prisma.externalCalendar.findUnique({
      where: { id },
    });
  }

  async findByConnection(connectionId: string): Promise<ExternalCalendar[]> {
    return this.prisma.externalCalendar.findMany({
      where: { connectionId },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
    });
  }

  async findByExternalId(
    connectionId: string,
    externalId: string
  ): Promise<ExternalCalendar | null> {
    return this.prisma.externalCalendar.findUnique({
      where: {
        connectionId_externalId: { connectionId, externalId },
      },
    });
  }

  async upsert(data: UpsertCalendarData): Promise<ExternalCalendar> {
    return this.prisma.externalCalendar.upsert({
      where: {
        connectionId_externalId: {
          connectionId: data.connectionId,
          externalId: data.externalId,
        },
      },
      create: {
        connectionId: data.connectionId,
        externalId: data.externalId,
        name: data.name,
        description: data.description ?? null,
        color: data.color ?? null,
        timezone: data.timezone ?? null,
        accessRole: data.accessRole ?? null,
        isPrimary: data.isPrimary ?? false,
        syncEnabled: data.syncEnabled ?? data.isPrimary ?? false,
        syncEvents: true,
        createEventsHere: false,
        isDefault: false,
      },
      update: {
        name: data.name,
        description: data.description,
        color: data.color,
        timezone: data.timezone,
        accessRole: data.accessRole,
        isPrimary: data.isPrimary,
      },
    });
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      description: string | null;
      color: string | null;
      timezone: string | null;
      syncEnabled: boolean;
      syncEvents: boolean;
      createEventsHere: boolean;
      isDefault: boolean;
    }>
  ): Promise<ExternalCalendar> {
    return this.prisma.externalCalendar.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.externalCalendar.delete({
      where: { id },
    });
  }

  async deleteByConnection(connectionId: string): Promise<number> {
    const result = await this.prisma.externalCalendar.deleteMany({
      where: { connectionId },
    });
    return result.count;
  }

  async findEnabledForSync(connectionId: string): Promise<ExternalCalendar[]> {
    return this.prisma.externalCalendar.findMany({
      where: {
        connectionId,
        syncEnabled: true,
        syncEvents: true,
      },
    });
  }

  async findWritable(connectionId: string): Promise<ExternalCalendar[]> {
    return this.prisma.externalCalendar.findMany({
      where: {
        connectionId,
        accessRole: { in: ['owner', 'writer'] },
      },
    });
  }

  async getDefaultForEvents(userId: string): Promise<ExternalCalendar | null> {
    // First try to find a calendar marked for event creation
    const withCreateEvents = await this.prisma.externalCalendar.findFirst({
      where: {
        connection: { userId, syncEnabled: true },
        createEventsHere: true,
      },
      include: { connection: true },
    });

    if (withCreateEvents) return withCreateEvents;

    // Fall back to primary calendar
    return this.prisma.externalCalendar.findFirst({
      where: {
        connection: { userId, syncEnabled: true },
        isPrimary: true,
        accessRole: { in: ['owner', 'writer'] },
      },
      include: { connection: true },
    });
  }
}

