/**
 * @module @skillancer/cockpit-svc/repositories/availability-schedule
 * Availability Schedule Repository
 */

import type { WeeklyHours, DateOverrides } from '../types/calendar.types.js';
import type { PrismaClient, AvailabilitySchedule, Prisma } from '@skillancer/database';

export class AvailabilityScheduleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    userId: string;
    name: string;
    timezone?: string;
    weeklyHours: WeeklyHours;
    dateOverrides?: DateOverrides;
    isDefault?: boolean;
    bufferBefore?: number;
    bufferAfter?: number;
    minNoticeHours?: number;
    maxAdvanceDays?: number;
  }): Promise<AvailabilitySchedule> {
    // If this will be the default, unset any existing default
    if (data.isDefault) {
      await this.clearDefault(data.userId);
    }

    return this.prisma.availabilitySchedule.create({
      data: {
        userId: data.userId,
        name: data.name,
        timezone: data.timezone ?? 'UTC',
        weeklyHours: data.weeklyHours as unknown as Prisma.InputJsonValue,
        dateOverrides: (data.dateOverrides ?? {}) as unknown as Prisma.InputJsonValue,
        isDefault: data.isDefault ?? false,
        bufferBefore: data.bufferBefore ?? 0,
        bufferAfter: data.bufferAfter ?? 0,
        minNoticeHours: data.minNoticeHours ?? 1,
        maxAdvanceDays: data.maxAdvanceDays ?? 60,
      },
    });
  }

  async findById(id: string): Promise<AvailabilitySchedule | null> {
    return this.prisma.availabilitySchedule.findUnique({
      where: { id },
    });
  }

  async findByUser(userId: string): Promise<AvailabilitySchedule[]> {
    return this.prisma.availabilitySchedule.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async findDefault(userId: string): Promise<AvailabilitySchedule | null> {
    return this.prisma.availabilitySchedule.findFirst({
      where: { userId, isDefault: true },
    });
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      timezone: string;
      weeklyHours: WeeklyHours;
      dateOverrides: DateOverrides;
      isDefault: boolean;
      bufferBefore: number;
      bufferAfter: number;
      minNoticeHours: number;
      maxAdvanceDays: number;
    }>
  ): Promise<AvailabilitySchedule> {
    // If setting as default, clear other defaults first
    if (data.isDefault) {
      const schedule = await this.findById(id);
      if (schedule) {
        await this.clearDefault(schedule.userId, id);
      }
    }

    const updateData: Prisma.AvailabilityScheduleUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.weeklyHours !== undefined) {
      updateData.weeklyHours = data.weeklyHours as unknown as Prisma.InputJsonValue;
    }
    if (data.dateOverrides !== undefined) {
      updateData.dateOverrides = data.dateOverrides as unknown as Prisma.InputJsonValue;
    }
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    if (data.bufferBefore !== undefined) updateData.bufferBefore = data.bufferBefore;
    if (data.bufferAfter !== undefined) updateData.bufferAfter = data.bufferAfter;
    if (data.minNoticeHours !== undefined) updateData.minNoticeHours = data.minNoticeHours;
    if (data.maxAdvanceDays !== undefined) updateData.maxAdvanceDays = data.maxAdvanceDays;

    return this.prisma.availabilitySchedule.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string): Promise<AvailabilitySchedule> {
    return this.prisma.availabilitySchedule.delete({
      where: { id },
    });
  }

  async clearDefault(userId: string, exceptId?: string): Promise<void> {
    await this.prisma.availabilitySchedule.updateMany({
      where: {
        userId,
        isDefault: true,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { isDefault: false },
    });
  }

  async setDefault(id: string): Promise<AvailabilitySchedule> {
    const schedule = await this.findById(id);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    await this.clearDefault(schedule.userId, id);

    return this.prisma.availabilitySchedule.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  async addDateOverride(
    id: string,
    date: string, // YYYY-MM-DD format
    slots: Array<{ start: string; end: string }> | null // null for day off
  ): Promise<AvailabilitySchedule> {
    const schedule = await this.findById(id);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const existingOverrides = (schedule.dateOverrides as unknown as DateOverrides) || {};
    const updatedOverrides: DateOverrides = {
      ...existingOverrides,
      [date]: slots,
    };

    return this.prisma.availabilitySchedule.update({
      where: { id },
      data: {
        dateOverrides: updatedOverrides as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async removeDateOverride(id: string, date: string): Promise<AvailabilitySchedule> {
    const schedule = await this.findById(id);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const existingOverrides = (schedule.dateOverrides as unknown as DateOverrides) || {};
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [date]: _, ...remainingOverrides } = existingOverrides;

    return this.prisma.availabilitySchedule.update({
      where: { id },
      data: {
        dateOverrides: remainingOverrides as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async findWithBookingLinks(id: string) {
    return this.prisma.availabilitySchedule.findUnique({
      where: { id },
      include: {
        bookingLinks: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            eventDuration: true,
          },
        },
      },
    });
  }

  async countBookingLinks(id: string): Promise<number> {
    return this.prisma.bookingLink.count({
      where: { scheduleId: id, isActive: true },
    });
  }
}
