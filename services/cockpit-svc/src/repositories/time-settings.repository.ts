// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/repositories/time-settings
 * Time Tracking Settings data access layer
 */

import type { PrismaClient, TimeTrackingSettings, Prisma } from '@skillancer/database';

export class TimeSettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Find settings by user ID
   */
  async findByUser(userId: string): Promise<TimeTrackingSettings | null> {
    return this.prisma.timeTrackingSettings.findUnique({
      where: { userId },
    });
  }

  /**
   * Create settings
   */
  async create(data: {
    userId: string;
    defaultHourlyRate?: number | null;
    defaultCurrency?: string;
    autoStopAfterMinutes?: number | null;
    idleDetectionMinutes?: number;
    reminderEnabled?: boolean;
    reminderTime?: string | null;
    roundingMethod?: 'NONE' | 'UP' | 'DOWN' | 'NEAREST';
    roundingMinutes?: number;
    workdayStartTime?: string;
    workdayEndTime?: string;
    workDays?: number[];
    targetHoursPerDay?: number;
    targetHoursPerWeek?: number;
    customCategories?: string[];
    autoSyncToMarket?: boolean;
    weekStartDay?: number;
    requireDescription?: boolean;
    requireProject?: boolean;
  }): Promise<TimeTrackingSettings> {
    return this.prisma.timeTrackingSettings.create({
      data: {
        userId: data.userId,
        defaultHourlyRate: data.defaultHourlyRate ?? null,
        defaultCurrency: data.defaultCurrency ?? 'USD',
        autoStopAfterMinutes: data.autoStopAfterMinutes ?? null,
        idleDetectionMinutes: data.idleDetectionMinutes ?? 5,
        reminderEnabled: data.reminderEnabled ?? true,
        reminderTime: data.reminderTime ?? null,
        roundingMethod: data.roundingMethod ?? 'NONE',
        roundingMinutes: data.roundingMinutes ?? 15,
        workdayStartTime: data.workdayStartTime ?? '09:00',
        workdayEndTime: data.workdayEndTime ?? '17:00',
        workDays: data.workDays ?? [1, 2, 3, 4, 5],
        targetHoursPerDay: data.targetHoursPerDay ?? 8,
        targetHoursPerWeek: data.targetHoursPerWeek ?? 40,
        customCategories: data.customCategories ?? [],
        autoSyncToMarket: data.autoSyncToMarket ?? true,
        weekStartDay: data.weekStartDay ?? 1,
        requireDescription: data.requireDescription ?? true,
        requireProject: data.requireProject ?? false,
      },
    });
  }

  /**
   * Update settings
   */
  async update(
    id: string,
    data: Partial<{
      defaultHourlyRate: number | null;
      defaultCurrency: string;
      autoStopAfterMinutes: number | null;
      idleDetectionMinutes: number;
      reminderEnabled: boolean;
      reminderTime: string | null;
      roundingMethod: 'NONE' | 'UP' | 'DOWN' | 'NEAREST';
      roundingMinutes: number;
      workdayStartTime: string;
      workdayEndTime: string;
      workDays: number[];
      targetHoursPerDay: number;
      targetHoursPerWeek: number;
      customCategories: string[];
      autoSyncToMarket: boolean;
      weekStartDay: number;
      requireDescription: boolean;
      requireProject: boolean;
    }>
  ): Promise<TimeTrackingSettings> {
    const updateData: Prisma.TimeTrackingSettingsUpdateInput = {};

    if (data.defaultHourlyRate !== undefined) updateData.defaultHourlyRate = data.defaultHourlyRate;
    if (data.defaultCurrency !== undefined) updateData.defaultCurrency = data.defaultCurrency;
    if (data.autoStopAfterMinutes !== undefined)
      updateData.autoStopAfterMinutes = data.autoStopAfterMinutes;
    if (data.idleDetectionMinutes !== undefined)
      updateData.idleDetectionMinutes = data.idleDetectionMinutes;
    if (data.reminderEnabled !== undefined) updateData.reminderEnabled = data.reminderEnabled;
    if (data.reminderTime !== undefined) updateData.reminderTime = data.reminderTime;
    if (data.roundingMethod !== undefined) updateData.roundingMethod = data.roundingMethod;
    if (data.roundingMinutes !== undefined) updateData.roundingMinutes = data.roundingMinutes;
    if (data.workdayStartTime !== undefined) updateData.workdayStartTime = data.workdayStartTime;
    if (data.workdayEndTime !== undefined) updateData.workdayEndTime = data.workdayEndTime;
    if (data.workDays !== undefined) updateData.workDays = data.workDays;
    if (data.targetHoursPerDay !== undefined) updateData.targetHoursPerDay = data.targetHoursPerDay;
    if (data.targetHoursPerWeek !== undefined)
      updateData.targetHoursPerWeek = data.targetHoursPerWeek;
    if (data.customCategories !== undefined) updateData.customCategories = data.customCategories;
    if (data.autoSyncToMarket !== undefined) updateData.autoSyncToMarket = data.autoSyncToMarket;
    if (data.weekStartDay !== undefined) updateData.weekStartDay = data.weekStartDay;
    if (data.requireDescription !== undefined)
      updateData.requireDescription = data.requireDescription;
    if (data.requireProject !== undefined) updateData.requireProject = data.requireProject;

    return this.prisma.timeTrackingSettings.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Get or create settings (ensures settings exist for user)
   */
  async getOrCreate(userId: string): Promise<TimeTrackingSettings> {
    const existing = await this.findByUser(userId);
    if (existing) return existing;
    return this.create({ userId });
  }

  /**
   * Find all users with reminder enabled at a specific time
   */
  async findUsersWithReminderAt(time: string): Promise<TimeTrackingSettings[]> {
    return this.prisma.timeTrackingSettings.findMany({
      where: {
        reminderEnabled: true,
        reminderTime: time,
      },
    });
  }

  /**
   * Find all users with auto-sync enabled
   */
  async findUsersWithAutoSync(): Promise<TimeTrackingSettings[]> {
    return this.prisma.timeTrackingSettings.findMany({
      where: {
        autoSyncToMarket: true,
      },
    });
  }
}

