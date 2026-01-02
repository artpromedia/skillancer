// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/repositories/calendar-connection
 * Calendar Connection Repository
 */

import type {
  CreateConnectionParams,
  UpdateConnectionParams,
  ConnectionWithCalendars,
} from '../types/calendar.types.js';
import type { PrismaClient, CalendarConnection, CalendarProvider } from '@skillancer/database';

export class CalendarConnectionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateConnectionParams): Promise<CalendarConnection> {
    return this.prisma.calendarConnection.create({
      data: {
        userId: data.userId,
        provider: data.provider,
        providerAccountId: data.providerAccountId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? null,
        tokenExpiresAt: data.tokenExpiresAt ?? null,
        email: data.email,
        displayName: data.displayName ?? null,
        syncEnabled: data.syncEnabled ?? true,
        syncDirection: data.syncDirection ?? 'BIDIRECTIONAL',
        syncStatus: 'PENDING',
        selectedCalendarIds: [],
      },
    });
  }

  async findById(id: string): Promise<CalendarConnection | null> {
    return this.prisma.calendarConnection.findUnique({
      where: { id },
    });
  }

  async findByIdWithCalendars(id: string): Promise<ConnectionWithCalendars | null> {
    return this.prisma.calendarConnection.findUnique({
      where: { id },
      include: { calendars: true },
    });
  }

  async findByUser(userId: string): Promise<ConnectionWithCalendars[]> {
    return this.prisma.calendarConnection.findMany({
      where: { userId },
      include: { calendars: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByProviderAccount(
    userId: string,
    provider: CalendarProvider,
    providerAccountId: string
  ): Promise<CalendarConnection | null> {
    return this.prisma.calendarConnection.findUnique({
      where: {
        userId_provider_providerAccountId: {
          userId,
          provider,
          providerAccountId,
        },
      },
    });
  }

  async findByProvider(userId: string, provider: CalendarProvider): Promise<CalendarConnection[]> {
    return this.prisma.calendarConnection.findMany({
      where: { userId, provider },
    });
  }

  async update(id: string, data: UpdateConnectionParams): Promise<CalendarConnection> {
    return this.prisma.calendarConnection.update({
      where: { id },
      data: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
        syncEnabled: data.syncEnabled,
        syncDirection: data.syncDirection,
        selectedCalendarIds: data.selectedCalendarIds,
        primaryCalendarId: data.primaryCalendarId,
        lastSyncAt: data.lastSyncAt,
        lastSyncError: data.lastSyncError,
        syncStatus: data.syncStatus,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.calendarConnection.delete({
      where: { id },
    });
  }

  async findNeedingSync(): Promise<CalendarConnection[]> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    return this.prisma.calendarConnection.findMany({
      where: {
        syncEnabled: true,
        syncStatus: { not: 'SYNCING' },
        OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: oneHourAgo } }],
      },
    });
  }

  async findWithExpiredTokens(): Promise<CalendarConnection[]> {
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    return this.prisma.calendarConnection.findMany({
      where: {
        syncEnabled: true,
        tokenExpiresAt: { lt: fiveMinutesFromNow },
        refreshToken: { not: null },
      },
    });
  }
}

