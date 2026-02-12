// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/services/time-tracking
 * Comprehensive Time Tracking Service
 *
 * Provides functionality for:
 * - Active timer management (start, pause, resume, stop, discard)
 * - Time entry CRUD operations
 * - Weekly timesheet management
 * - Time reporting and analytics
 * - User settings management
 * - Market contract synchronization
 * - Export capabilities
 */

import { createLogger } from '@skillancer/logger';

import { TimeTrackingError, TimeTrackingErrorCode } from '../errors/time-tracking.errors.js';
import { ComprehensiveTimeEntryRepository } from '../repositories/comprehensive-time-entry.repository.js';
import { TimeCategoryRepository } from '../repositories/time-category.repository.js';
import { TimeSettingsRepository } from '../repositories/time-settings.repository.js';
import { TimerRepository } from '../repositories/timer.repository.js';
import { TimesheetRepository } from '../repositories/timesheet.repository.js';

const logger = createLogger({ name: 'time-tracking-service' });

import type {
  StartTimerParams,
  StopTimerParams,
  UpdateTimerParams,
  ActiveTimerWithDuration,
  CreateTimeEntryParams,
  UpdateTimeEntryParams,
  TimeEntryFilters,
  TimeEntryWithDetails,
  TimeEntrySummary,
  BulkUpdateParams,
  TimesheetView,
  DailyEntries,
  ProjectTimeSummary,
  TimesheetSummary,
  TimeReportParams,
  TimeReport,
  GroupedTimeData,
  ProductivityInsights,
  CreateSettingsParams,
  UpdateSettingsParams,
  CreateCategoryParams,
  UpdateCategoryParams,
  CategoryWithUsage,
  ExportParams,
  ExportResult,
} from '../types/time-tracking.types.js';
import type {
  PrismaClient,
  ActiveTimer,
  Timesheet,
  TimeTrackingSettings,
} from '../types/prisma-shim.js';

export class TimeTrackingService {
  private readonly timerRepository: TimerRepository;
  private readonly timeEntryRepository: ComprehensiveTimeEntryRepository;
  private readonly timesheetRepository: TimesheetRepository;
  private readonly settingsRepository: TimeSettingsRepository;
  private readonly categoryRepository: TimeCategoryRepository;

  constructor(private readonly prisma: PrismaClient) {
    this.timerRepository = new TimerRepository(prisma);
    this.timeEntryRepository = new ComprehensiveTimeEntryRepository(prisma);
    this.timesheetRepository = new TimesheetRepository(prisma);
    this.settingsRepository = new TimeSettingsRepository(prisma);
    this.categoryRepository = new TimeCategoryRepository(prisma);
  }

  // ==========================================
  // Timer Operations
  // ==========================================

  /**
   * Start a new timer for a user
   */
  async startTimer(params: StartTimerParams): Promise<ActiveTimerWithDuration> {
    const { userId, projectId, taskId, description, isBillable } = params;

    // Check if user already has an active timer
    const existingTimer = await this.timerRepository.findByUser(userId);
    if (existingTimer) {
      throw new TimeTrackingError(
        TimeTrackingErrorCode.TIMER_ALREADY_RUNNING,
        `Timer ${existingTimer.id} is already running`
      );
    }

    // Get user settings for default rate
    const _settings = await this.settingsRepository.getOrCreate(userId);

    const timer = await this.timerRepository.upsert({
      userId,
      projectId: projectId ?? null,
      taskId: taskId ?? null,
      description: description ?? null,
      isBillable: isBillable ?? true,
      status: 'RUNNING',
      startedAt: new Date(),
    });

    logger.info({ userId, timerId: timer.id }, 'Timer started');

    return this.enrichTimerWithDuration(timer);
  }

  /**
   * Pause the active timer
   */
  async pauseTimer(userId: string): Promise<ActiveTimerWithDuration> {
    const timer = await this.timerRepository.findByUser(userId);
    if (!timer) {
      throw new TimeTrackingError(TimeTrackingErrorCode.TIMER_NOT_FOUND);
    }

    if (timer.status !== 'RUNNING') {
      throw new TimeTrackingError(TimeTrackingErrorCode.TIMER_NOT_PAUSED);
    }

    // Calculate time spent in current session
    const now = new Date();
    const currentSessionMs = now.getTime() - timer.startedAt.getTime();
    const currentSessionMinutes = Math.floor(currentSessionMs / 60000);
    const newTotalPausedMinutes = timer.totalPausedMinutes + currentSessionMinutes;

    const updated = await this.timerRepository.update(timer.id, {
      status: 'PAUSED',
      pausedAt: now,
      totalPausedMinutes: newTotalPausedMinutes,
    });

    logger.info(
      { userId, timerId: timer.id, totalPausedMinutes: newTotalPausedMinutes },
      'Timer paused'
    );

    return this.enrichTimerWithDuration(updated);
  }

  /**
   * Resume a paused timer
   */
  async resumeTimer(userId: string): Promise<ActiveTimerWithDuration> {
    const timer = await this.timerRepository.findByUser(userId);
    if (!timer) {
      throw new TimeTrackingError(TimeTrackingErrorCode.TIMER_NOT_FOUND);
    }

    if (timer.status !== 'PAUSED') {
      throw new TimeTrackingError(TimeTrackingErrorCode.TIMER_NOT_PAUSED);
    }

    const updated = await this.timerRepository.update(timer.id, {
      status: 'RUNNING',
      pausedAt: null,
    });

    logger.info({ userId, timerId: timer.id }, 'Timer resumed');

    return this.enrichTimerWithDuration(updated);
  }

  /**
   * Stop the timer and create a time entry
   */
  async stopTimer(params: StopTimerParams): Promise<TimeEntryWithDetails> {
    const { userId, description, projectId, taskId, isBillable, applyRounding } = params;

    const timer = await this.timerRepository.findByUser(userId);
    if (!timer) {
      throw new TimeTrackingError(TimeTrackingErrorCode.TIMER_NOT_FOUND);
    }

    // Calculate total duration (totalPausedMinutes tracks already logged time when pausing)
    const now = new Date();
    let durationMinutes = timer.totalPausedMinutes;
    if (timer.status === 'RUNNING') {
      const currentSessionMs = now.getTime() - timer.startedAt.getTime();
      durationMinutes += Math.floor(currentSessionMs / 60000);
    }

    // Apply rounding if requested
    if (applyRounding) {
      const settings = await this.settingsRepository.findByUser(userId);
      if (settings) {
        durationMinutes = this.applyRounding(
          durationMinutes,
          settings.roundingMethod,
          settings.roundingMinutes
        );
      }
    }

    // Ensure minimum duration
    if (durationMinutes < 1) {
      durationMinutes = 1;
    }

    // Get hourly rate from settings
    const settings = await this.settingsRepository.findByUser(userId);
    const hourlyRate = settings?.defaultHourlyRate ?? null;
    const amount = hourlyRate ? (durationMinutes / 60) * Number(hourlyRate) : null;

    // Create the time entry
    const entry = await this.timeEntryRepository.create({
      freelancerUserId: userId,
      projectId: projectId ?? timer.projectId ?? null,
      taskId: taskId ?? timer.taskId ?? null,
      date: timer.startedAt,
      startTime: timer.startedAt,
      endTime: now,
      durationMinutes,
      description: description ?? timer.description ?? null,
      isBillable: isBillable ?? timer.isBillable ?? true,
      hourlyRate: hourlyRate ? Number(hourlyRate) : null,
      amount,
      currency: settings?.defaultCurrency ?? 'USD',
      trackingMethod: 'TIMER',
      source: 'COCKPIT',
    });

    // Delete the timer
    await this.timerRepository.delete(timer.id);

    logger.info(
      { userId, timerId: timer.id, entryId: entry.id, durationMinutes },
      'Timer stopped and time entry created'
    );

    const result = await this.timeEntryRepository.findByIdWithDetails(entry.id);
    if (!result) {
      throw new TimeTrackingError(TimeTrackingErrorCode.ENTRY_NOT_FOUND);
    }
    return result;
  }

  /**
   * Discard the active timer without creating an entry
   */
  async discardTimer(userId: string): Promise<void> {
    const timer = await this.timerRepository.findByUser(userId);
    if (!timer) {
      throw new TimeTrackingError(TimeTrackingErrorCode.TIMER_NOT_FOUND);
    }

    await this.timerRepository.delete(timer.id);

    logger.info({ userId, timerId: timer.id }, 'Timer discarded');
  }

  /**
   * Get the active timer for a user
   */
  async getActiveTimer(userId: string): Promise<ActiveTimerWithDuration | null> {
    const timer = await this.timerRepository.findByUserWithDetails(userId);
    if (!timer) return null;

    return this.enrichTimerWithDuration(timer);
  }

  /**
   * Update the active timer
   */
  async updateActiveTimer(
    userId: string,
    params: UpdateTimerParams
  ): Promise<ActiveTimerWithDuration> {
    const timer = await this.timerRepository.findByUser(userId);
    if (!timer) {
      throw new TimeTrackingError(TimeTrackingErrorCode.TIMER_NOT_FOUND);
    }

    const updated = await this.timerRepository.update(timer.id, {
      projectId: params.projectId,
      taskId: params.taskId,
      description: params.description,
      isBillable: params.isBillable,
    });

    return this.enrichTimerWithDuration(updated);
  }

  // ==========================================
  // Time Entry Operations
  // ==========================================

  /**
   * Create a time entry manually
   */
  async createTimeEntry(params: CreateTimeEntryParams): Promise<TimeEntryWithDetails> {
    const { freelancerUserId, date, durationMinutes } = params;

    // Get user settings for defaults
    const settings = await this.settingsRepository.findByUser(freelancerUserId);
    const hourlyRate =
      params.hourlyRate ??
      (settings?.defaultHourlyRate ? Number(settings.defaultHourlyRate) : null);
    const amount = hourlyRate ? (durationMinutes / 60) * hourlyRate : null;

    const entry = await this.timeEntryRepository.create({
      freelancerUserId,
      projectId: params.projectId ?? null,
      taskId: params.taskId ?? null,
      clientId: params.clientId ?? null,
      marketContractId: params.marketContractId ?? null,
      date,
      startTime: params.startTime ?? null,
      endTime: params.endTime ?? null,
      durationMinutes,
      description: params.description ?? null,
      category: params.category ?? null,
      tags: params.tags ?? [],
      isBillable: params.isBillable ?? true,
      hourlyRate,
      amount,
      currency: settings?.defaultCurrency ?? 'USD',
      trackingMethod: 'MANUAL',
      source: 'COCKPIT',
    });

    logger.info({ userId: freelancerUserId, entryId: entry.id }, 'Time entry created');

    const result = await this.timeEntryRepository.findByIdWithDetails(entry.id);
    if (!result) {
      throw new TimeTrackingError(TimeTrackingErrorCode.ENTRY_NOT_FOUND);
    }
    return result;
  }

  /**
   * Get a time entry by ID
   */
  async getTimeEntry(id: string, userId: string): Promise<TimeEntryWithDetails> {
    const entry = await this.timeEntryRepository.findByIdWithDetails(id);
    if (!entry) {
      throw new TimeTrackingError(TimeTrackingErrorCode.ENTRY_NOT_FOUND);
    }

    if (entry.freelancerUserId !== userId) {
      throw new TimeTrackingError(TimeTrackingErrorCode.ACCESS_DENIED);
    }

    return entry;
  }

  /**
   * Update a time entry
   */
  async updateTimeEntry(
    id: string,
    userId: string,
    params: UpdateTimeEntryParams
  ): Promise<TimeEntryWithDetails> {
    const entry = await this.timeEntryRepository.findById(id);
    if (!entry) {
      throw new TimeTrackingError(TimeTrackingErrorCode.ENTRY_NOT_FOUND);
    }

    if (entry.freelancerUserId !== userId) {
      throw new TimeTrackingError(TimeTrackingErrorCode.ACCESS_DENIED);
    }

    if (entry.isLocked) {
      throw new TimeTrackingError(TimeTrackingErrorCode.ENTRY_LOCKED);
    }

    // Recalculate amount if duration or rate changes
    let amountValue = entry.amount ? Number(entry.amount) : null;
    if (params.durationMinutes !== undefined || params.hourlyRate !== undefined) {
      const duration = params.durationMinutes ?? entry.durationMinutes;
      const rate = params.hourlyRate ?? (entry.hourlyRate ? Number(entry.hourlyRate) : null);
      amountValue = rate ? (duration / 60) * rate : null;
    }

    const updated = await this.timeEntryRepository.update(id, {
      ...params,
      amount: amountValue,
    });

    logger.info({ userId, entryId: id }, 'Time entry updated');

    const result = await this.timeEntryRepository.findByIdWithDetails(updated.id);
    if (!result) {
      throw new TimeTrackingError(TimeTrackingErrorCode.ENTRY_NOT_FOUND);
    }
    return result;
  }

  /**
   * Delete a time entry
   */
  async deleteTimeEntry(id: string, userId: string): Promise<void> {
    const entry = await this.timeEntryRepository.findById(id);
    if (!entry) {
      throw new TimeTrackingError(TimeTrackingErrorCode.ENTRY_NOT_FOUND);
    }

    if (entry.freelancerUserId !== userId) {
      throw new TimeTrackingError(TimeTrackingErrorCode.ACCESS_DENIED);
    }

    if (entry.isLocked) {
      throw new TimeTrackingError(TimeTrackingErrorCode.ENTRY_LOCKED);
    }

    if (entry.isInvoiced) {
      throw new TimeTrackingError(TimeTrackingErrorCode.ENTRIES_ALREADY_INVOICED);
    }

    await this.timeEntryRepository.delete(id);

    logger.info({ userId, entryId: id }, 'Time entry deleted');
  }

  /**
   * Get time entries with filters
   */
  async getTimeEntries(params: TimeEntryFilters): Promise<{
    entries: TimeEntryWithDetails[];
    total: number;
    summary: TimeEntrySummary;
  }> {
    const { entries, total } = await this.timeEntryRepository.findByFilters(params);

    const summary = this.calculateEntrySummary(entries);

    return { entries, total, summary };
  }

  /**
   * Duplicate a time entry
   */
  async duplicateTimeEntry(id: string, userId: string, date?: Date): Promise<TimeEntryWithDetails> {
    const original = await this.timeEntryRepository.findByIdWithDetails(id);
    if (!original) {
      throw new TimeTrackingError(TimeTrackingErrorCode.ENTRY_NOT_FOUND);
    }

    if (original.freelancerUserId !== userId) {
      throw new TimeTrackingError(TimeTrackingErrorCode.ACCESS_DENIED);
    }

    const duplicate = await this.timeEntryRepository.create({
      freelancerUserId: userId,
      projectId: original.projectId,
      taskId: original.taskId,
      clientId: original.clientId,
      date: date ?? new Date(),
      startTime: null,
      endTime: null,
      durationMinutes: original.durationMinutes,
      description: original.description,
      category: original.category,
      tags: original.tags,
      isBillable: original.isBillable,
      hourlyRate: original.hourlyRate ? Number(original.hourlyRate) : null,
      amount: original.amount ? Number(original.amount) : null,
      currency: original.currency,
      trackingMethod: 'MANUAL',
      source: 'COCKPIT',
    });

    const result = await this.timeEntryRepository.findByIdWithDetails(duplicate.id);
    if (!result) {
      throw new TimeTrackingError(TimeTrackingErrorCode.ENTRY_NOT_FOUND);
    }
    return result;
  }

  /**
   * Bulk update time entries
   */
  async bulkUpdateTimeEntries(userId: string, params: BulkUpdateParams): Promise<number> {
    // Verify all entries belong to user and are not locked
    for (const id of params.entryIds) {
      const entry = await this.timeEntryRepository.findById(id);
      if (entry?.freelancerUserId !== userId) {
        throw new TimeTrackingError(
          TimeTrackingErrorCode.ACCESS_DENIED,
          `Entry ${id} access denied`
        );
      }
      if (entry.isLocked) {
        throw new TimeTrackingError(TimeTrackingErrorCode.ENTRY_LOCKED, `Entry ${id} is locked`);
      }
    }

    return this.timeEntryRepository.bulkUpdate(params.entryIds, params.updates);
  }

  // ==========================================
  // Timesheet Operations
  // ==========================================

  /**
   * Get timesheet for a week
   */
  async getTimesheet(userId: string, weekStart: Date): Promise<TimesheetView> {
    // Normalize to Monday
    const normalizedStart = this.getWeekStart(weekStart);
    const weekEnd = new Date(normalizedStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Get entries for the week
    const entries = await this.timeEntryRepository.findByDateRange(
      userId,
      normalizedStart,
      weekEnd
    );

    // Get or create timesheet record with calculated values
    const summary = this.calculateTimesheetSummary(entries);
    const timesheet = await this.timesheetRepository.getOrCreate({
      freelancerUserId: userId,
      weekStartDate: normalizedStart,
      weekEndDate: weekEnd,
      totalMinutes: Math.round(summary.totalHours * 60),
      billableMinutes: Math.round(summary.billableHours * 60),
      totalAmount: 0, // Will be calculated from entries
    });

    // Group by day
    const dailyEntries = this.groupEntriesByDay(entries, normalizedStart);

    // Group by project
    const projectSummaries = this.groupEntriesByProject(entries);

    return {
      timesheet,
      weekStart: normalizedStart,
      weekEnd,
      dailyEntries,
      projectSummaries,
      summary,
    };
  }

  /**
   * Submit timesheet for approval
   */
  async submitTimesheet(userId: string, weekStart: Date): Promise<Timesheet> {
    const normalizedStart = this.getWeekStart(weekStart);
    const timesheet = await this.timesheetRepository.findByUserAndWeek(userId, normalizedStart);

    if (!timesheet) {
      throw new TimeTrackingError(TimeTrackingErrorCode.TIMESHEET_NOT_FOUND);
    }

    if (timesheet.status !== 'DRAFT') {
      throw new TimeTrackingError(TimeTrackingErrorCode.TIMESHEET_ALREADY_SUBMITTED);
    }

    const updated = await this.timesheetRepository.update(timesheet.id, {
      status: 'SUBMITTED',
      submittedAt: new Date(),
    });

    logger.info({ userId, timesheetId: timesheet.id }, 'Timesheet submitted');

    return updated;
  }

  /**
   * Lock timesheet and all its entries
   */
  async lockTimesheet(userId: string, weekStart: Date): Promise<Timesheet> {
    const normalizedStart = this.getWeekStart(weekStart);
    const weekEnd = new Date(normalizedStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const timesheet = await this.timesheetRepository.findByUserAndWeek(userId, normalizedStart);
    if (!timesheet) {
      throw new TimeTrackingError(TimeTrackingErrorCode.TIMESHEET_NOT_FOUND);
    }

    // Lock all entries in this week
    await this.timeEntryRepository.lockByDateRange(
      userId,
      normalizedStart,
      weekEnd,
      'Timesheet locked'
    );

    // Lock the timesheet (using APPROVED status since LOCKED doesn't exist)
    const updated = await this.timesheetRepository.update(timesheet.id, {
      status: 'APPROVED',
      isLocked: true,
      lockedAt: new Date(),
    });

    logger.info({ userId, timesheetId: timesheet.id }, 'Timesheet locked');

    return updated;
  }

  // ==========================================
  // Reporting Operations
  // ==========================================

  /**
   * Generate time report
   */
  async getTimeReport(params: TimeReportParams): Promise<TimeReport> {
    const { freelancerUserId, startDate, endDate, groupBy } = params;

    // Get entries for the date range
    const entries = await this.timeEntryRepository.findByDateRange(
      freelancerUserId ?? '',
      startDate,
      endDate
    );

    // Filter by project/client if specified
    let filteredEntries = entries;
    const projectIdsFilter = params.projectIds;
    if (projectIdsFilter && projectIdsFilter.length > 0) {
      filteredEntries = filteredEntries.filter(
        (e) => e.projectId && projectIdsFilter.includes(e.projectId)
      );
    }
    const clientIdsFilter = params.clientIds;
    if (clientIdsFilter && clientIdsFilter.length > 0) {
      filteredEntries = filteredEntries.filter(
        (e) => e.clientId && clientIdsFilter.includes(e.clientId)
      );
    }

    // Group data
    const groupedData = this.groupReportData(filteredEntries, groupBy);

    // Calculate summary
    const baseSummary = this.calculateEntrySummary(filteredEntries);
    const days = Math.max(
      1,
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    const avgHoursPerDay = baseSummary.totalMinutes / 60 / days;

    return {
      period: {
        startDate,
        endDate,
        days,
      },
      summary: {
        ...baseSummary,
        avgHoursPerDay,
      },
      grouped: groupedData,
      trends: {
        hoursChange: 0, // Would need historical data to calculate
        amountChange: 0,
      },
      entries: filteredEntries,
    };
  }

  /**
   * Get productivity insights
   */
  async getProductivityInsights(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProductivityInsights> {
    const entries = await this.timeEntryRepository.findByDateRange(userId, startDate, endDate);
    const settings = await this.settingsRepository.findByUser(userId);

    const totalMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0);
    const days = Math.max(
      1,
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Calculate working days in range
    const workingDays = this.countWorkingDays(startDate, endDate);

    // Group by category
    const byCategory = this.groupByCategory(entries);

    // Group by day of week
    const byDay = this.groupByDayOfWeek(entries);

    // Group by hour
    const hourlyDistribution = this.groupByHour(entries);

    // Find peak hour and day
    const peakHour = hourlyDistribution.reduce((max, h) => (h.minutes > max.minutes ? h : max), {
      hour: 0,
      minutes: 0,
    });
    const peakDay = byDay.reduce((max, d) => (d.minutes > max.minutes ? d : max), {
      day: 'Monday',
      minutes: 0,
    });

    // Calculate daily target
    const dailyTarget = settings?.targetHoursPerDay ? Number(settings.targetHoursPerDay) * 60 : 480;
    const daysMetTarget = this.countDaysMetTarget(entries, dailyTarget);

    return {
      period: {
        startDate,
        endDate,
        days,
      },
      patterns: {
        peakHour: peakHour.hour,
        peakDay: peakDay.day,
        hourlyDistribution,
        dailyDistribution: byDay,
        categoryDistribution: byCategory.map((c) => ({
          category: c.category,
          minutes: c.minutes,
          percentage: totalMinutes > 0 ? (c.minutes / totalMinutes) * 100 : 0,
        })),
      },
      consistency: {
        workDays: workingDays,
        daysMetTarget,
        consistencyScore: workingDays > 0 ? (daysMetTarget / workingDays) * 100 : 0,
        longestStreak: this.calculateLongestStreak(entries),
        currentStreak: this.calculateCurrentStreak(entries),
      },
      recommendations: this.generateRecommendations(entries, settings),
    };
  }

  // ==========================================
  // Settings Operations
  // ==========================================

  /**
   * Get user's time tracking settings
   */
  async getSettings(userId: string): Promise<TimeTrackingSettings> {
    return this.settingsRepository.getOrCreate(userId);
  }

  /**
   * Update user's time tracking settings
   */
  async updateSettings(
    userId: string,
    params: UpdateSettingsParams
  ): Promise<TimeTrackingSettings> {
    const settings = await this.settingsRepository.findByUser(userId);
    if (!settings) {
      return this.settingsRepository.create({
        userId,
        ...params,
      } as CreateSettingsParams);
    }

    return this.settingsRepository.update(settings.id, params);
  }

  // ==========================================
  // Category Operations
  // ==========================================

  /**
   * Get user's time categories
   */
  async getCategories(userId: string): Promise<CategoryWithUsage[]> {
    const categories = await this.categoryRepository.findByUser(userId);

    // Get usage count for each category
    const result: CategoryWithUsage[] = [];
    for (const category of categories) {
      const entryCount = await this.categoryRepository.countEntriesUsingCategory(
        userId,
        category.name
      );
      result.push({ ...category, entryCount });
    }

    return result;
  }

  /**
   * Create a custom category
   */
  async createCategory(userId: string, params: CreateCategoryParams): Promise<CategoryWithUsage> {
    // Check for duplicate name
    const existing = await this.categoryRepository.findByName(userId, params.name);
    if (existing) {
      throw new TimeTrackingError(TimeTrackingErrorCode.CATEGORY_ALREADY_EXISTS);
    }

    const category = await this.categoryRepository.create({
      freelancerUserId: userId,
      name: params.name,
      color: params.color ?? '#6B7280',
      icon: params.icon ?? null,
      isSystem: false,
      orderIndex: 999,
    });

    return { ...category, entryCount: 0 };
  }

  /**
   * Update a category
   */
  async updateCategory(
    userId: string,
    categoryId: string,
    params: UpdateCategoryParams
  ): Promise<CategoryWithUsage> {
    const category = await this.categoryRepository.findById(categoryId);
    if (category?.freelancerUserId !== userId) {
      throw new TimeTrackingError(TimeTrackingErrorCode.CATEGORY_NOT_FOUND);
    }

    if (category.isSystem) {
      throw new TimeTrackingError(TimeTrackingErrorCode.SYSTEM_CATEGORY_CANNOT_DELETE);
    }

    const updated = await this.categoryRepository.update(categoryId, params);
    const entryCount = await this.categoryRepository.countEntriesUsingCategory(
      userId,
      updated.name
    );

    return { ...updated, entryCount };
  }

  /**
   * Delete a category
   */
  async deleteCategory(userId: string, categoryId: string): Promise<void> {
    const category = await this.categoryRepository.findById(categoryId);
    if (category?.freelancerUserId !== userId) {
      throw new TimeTrackingError(TimeTrackingErrorCode.CATEGORY_NOT_FOUND);
    }

    if (category.isSystem) {
      throw new TimeTrackingError(TimeTrackingErrorCode.SYSTEM_CATEGORY_CANNOT_DELETE);
    }

    const entryCount = await this.categoryRepository.countEntriesUsingCategory(
      userId,
      category.name
    );
    if (entryCount > 0) {
      throw new TimeTrackingError(
        TimeTrackingErrorCode.CATEGORY_IN_USE,
        `Category has ${entryCount} entries`
      );
    }

    await this.categoryRepository.hardDelete(categoryId);
  }

  // ==========================================
  // Export Operations
  // ==========================================

  /**
   * Export time entries
   */
  async exportTimeEntries(params: ExportParams): Promise<ExportResult> {
    if (!params.freelancerUserId) {
      throw new TimeTrackingError(
        TimeTrackingErrorCode.ACCESS_DENIED,
        'freelancerUserId is required for export'
      );
    }

    const entries = await this.timeEntryRepository.findByDateRange(
      params.freelancerUserId,
      params.startDate,
      params.endDate
    );

    // Filter by project/client if specified
    let filteredEntries = entries;
    const projectIdsFilter = params.projectIds;
    if (projectIdsFilter && projectIdsFilter.length > 0) {
      filteredEntries = filteredEntries.filter(
        (e) => e.projectId && projectIdsFilter.includes(e.projectId)
      );
    }
    const clientIdsFilter = params.clientIds;
    if (clientIdsFilter && clientIdsFilter.length > 0) {
      filteredEntries = filteredEntries.filter(
        (e) => e.clientId && clientIdsFilter.includes(e.clientId)
      );
    }

    switch (params.format) {
      case 'csv':
        return this.exportToCsv(filteredEntries);
      case 'xlsx':
      case 'pdf':
        // xlsx and pdf export not yet implemented
        throw new TimeTrackingError(
          TimeTrackingErrorCode.INVALID_EXPORT_FORMAT,
          `Format ${params.format} not yet implemented`
        );
    }
  }

  // ==========================================
  // Helper Methods
  // ==========================================

  private enrichTimerWithDuration(timer: ActiveTimer): ActiveTimerWithDuration {
    const now = new Date();
    let currentDurationMinutes = timer.totalPausedMinutes;

    if (timer.status === 'RUNNING') {
      const runningMs = now.getTime() - timer.startedAt.getTime();
      currentDurationMinutes += Math.floor(runningMs / 60000);
    }

    return {
      ...timer,
      currentDurationMinutes,
    };
  }

  private applyRounding(minutes: number, method: string, increment: number): number {
    if (increment <= 0) return minutes;

    switch (method) {
      case 'ROUND_UP':
        return Math.ceil(minutes / increment) * increment;
      case 'ROUND_DOWN':
        return Math.floor(minutes / increment) * increment;
      case 'ROUND_NEAREST':
      default:
        return Math.round(minutes / increment) * increment;
    }
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private calculateEntrySummary(entries: TimeEntryWithDetails[]): TimeEntrySummary {
    const totalMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0);
    const billableMinutes = entries
      .filter((e) => e.isBillable)
      .reduce((sum, e) => sum + e.durationMinutes, 0);
    const totalAmount = entries
      .filter((e) => e.amount)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    return {
      totalMinutes,
      billableMinutes,
      nonBillableMinutes: totalMinutes - billableMinutes,
      totalAmount,
      entryCount: entries.length,
      billablePercentage: totalMinutes > 0 ? (billableMinutes / totalMinutes) * 100 : 0,
    };
  }

  private groupEntriesByDay(entries: TimeEntryWithDetails[], weekStart: Date): DailyEntries[] {
    const result: DailyEntries[] = [];

    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + i);
      const dayStr = day.toISOString().split('T')[0];

      const dayEntries = entries.filter(
        (e) => new Date(e.date).toISOString().split('T')[0] === dayStr
      );

      const totalMinutes = dayEntries.reduce((sum, e) => sum + e.durationMinutes, 0);

      result.push({
        date: day,
        entries: dayEntries,
        totalMinutes,
        totalHours: totalMinutes / 60,
      });
    }

    return result;
  }

  private groupEntriesByProject(entries: TimeEntryWithDetails[]): ProjectTimeSummary[] {
    const projectMap = new Map<
      string,
      { projectId: string | null; projectName: string; minutes: number; amount: number }
    >();

    for (const entry of entries) {
      const projectKey = entry.projectId ?? 'no-project';
      const existing = projectMap.get(projectKey);

      if (existing) {
        existing.minutes += entry.durationMinutes;
        if (entry.amount) {
          existing.amount += Number(entry.amount);
        }
      } else {
        projectMap.set(projectKey, {
          projectId: entry.projectId ?? null,
          projectName: entry.project?.name ?? 'No Project',
          minutes: entry.durationMinutes,
          amount: entry.amount ? Number(entry.amount) : 0,
        });
      }
    }

    return Array.from(projectMap.values())
      .map((p) => ({
        ...p,
        hours: p.minutes / 60,
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }

  private calculateTimesheetSummary(entries: TimeEntryWithDetails[]): TimesheetSummary {
    const summary = this.calculateEntrySummary(entries);
    const targetHours = 40; // 40 hours default

    return {
      totalHours: summary.totalMinutes / 60,
      billableHours: summary.billableMinutes / 60,
      totalAmount: summary.totalAmount,
      targetHours,
      progressPercent: targetHours > 0 ? (summary.totalMinutes / 60 / targetHours) * 100 : 0,
    };
  }

  private groupReportData(entries: TimeEntryWithDetails[], groupBy: string): GroupedTimeData[] {
    const groups = new Map<string, { entries: TimeEntryWithDetails[]; label: string }>();

    for (const entry of entries) {
      let key = '';
      let label = '';

      switch (groupBy) {
        case 'day': {
          const dateStr = new Date(entry.date).toISOString().split('T')[0] ?? '';
          key = dateStr;
          label = dateStr;
          break;
        }
        case 'week': {
          const weekStart = this.getWeekStart(new Date(entry.date));
          const weekStr = weekStart.toISOString().split('T')[0] ?? '';
          key = weekStr;
          label = `Week of ${weekStr}`;
          break;
        }
        case 'client':
          key = entry.clientId ?? 'no-client';
          label = entry.client
            ? (entry.client.companyName ?? `${entry.client.firstName} ${entry.client.lastName}`)
            : 'No Client';
          break;
        case 'category':
          key = entry.category ?? 'uncategorized';
          label = entry.category ?? 'Uncategorized';
          break;
        case 'project':
        default:
          key = entry.projectId ?? 'no-project';
          label = entry.project?.name ?? 'No Project';
      }

      const existing = groups.get(key);
      if (existing) {
        existing.entries.push(entry);
      } else {
        groups.set(key, { entries: [entry], label });
      }
    }

    return Array.from(groups.entries()).map(([key, { entries: groupEntries, label }]) => {
      const totalMinutes = groupEntries.reduce((sum, e) => sum + e.durationMinutes, 0);
      const totalAmount = groupEntries.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
      return {
        key,
        label,
        minutes: totalMinutes,
        hours: totalMinutes / 60,
        amount: totalAmount,
        entryCount: groupEntries.length,
      };
    });
  }

  private countWorkingDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  private groupByCategory(
    entries: TimeEntryWithDetails[]
  ): Array<{ category: string; minutes: number }> {
    const result: Record<string, number> = {};

    for (const entry of entries) {
      const category = entry.category ?? 'Uncategorized';
      result[category] = (result[category] ?? 0) + entry.durationMinutes;
    }

    return Object.entries(result).map(([category, minutes]) => ({ category, minutes }));
  }

  private groupByDayOfWeek(
    entries: TimeEntryWithDetails[]
  ): Array<{ day: string; minutes: number }> {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const result: Record<string, number> = {};

    for (const day of days) {
      result[day] = 0;
    }

    for (const entry of entries) {
      const dayName = days[new Date(entry.date).getDay()];
      if (dayName && result[dayName] !== undefined) {
        result[dayName] += entry.durationMinutes;
      }
    }

    return days.map((day) => ({ day, minutes: result[day] ?? 0 }));
  }

  private calculateLongestStreak(entries: TimeEntryWithDetails[]): number {
    if (entries.length === 0) return 0;

    const dates = new Set(
      entries
        .map((e) => new Date(e.date).toISOString().split('T')[0])
        .filter((d): d is string => d !== undefined)
    );
    const sortedDates = Array.from(dates).sort((a, b) => a.localeCompare(b));

    let longestStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = sortedDates[i - 1];
      const currDate = sortedDates[i];
      if (!prevDate || !currDate) continue;

      const prev = new Date(prevDate);
      const curr = new Date(currDate);
      const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    return longestStreak;
  }

  private exportToCsv(entries: TimeEntryWithDetails[]): ExportResult {
    const headers = [
      'Date',
      'Project',
      'Task',
      'Description',
      'Duration (minutes)',
      'Billable',
      'Category',
      'Hourly Rate',
      'Amount',
    ];

    const rows = entries.map((e) => [
      new Date(e.date).toISOString().split('T')[0],
      e.project?.name ?? '',
      e.task?.title ?? '',
      e.description ?? '',
      e.durationMinutes.toString(),
      e.isBillable ? 'Yes' : 'No',
      e.category ?? '',
      e.hourlyRate?.toString() ?? '',
      e.amount?.toString() ?? '',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');

    return {
      filename: `time-entries-${new Date().toISOString().split('T')[0]}.csv`,
      mimeType: 'text/csv',
      data: Buffer.from(csv, 'utf-8'),
    };
  }

  private groupByHour(entries: TimeEntryWithDetails[]): Array<{ hour: number; minutes: number }> {
    const result: Record<number, number> = {};

    for (let hour = 0; hour < 24; hour++) {
      result[hour] = 0;
    }

    for (const entry of entries) {
      // Use entry startTime if available, otherwise default to 9am
      const entryHour = entry.startTime ? new Date(entry.startTime).getHours() : 9;
      result[entryHour] = (result[entryHour] ?? 0) + entry.durationMinutes;
    }

    return Object.entries(result).map(([hour, minutes]) => ({
      hour: Number.parseInt(hour, 10),
      minutes,
    }));
  }

  private countDaysMetTarget(entries: TimeEntryWithDetails[], targetMinutes: number): number {
    // Group entries by date
    const byDate = new Map<string, number>();

    for (const entry of entries) {
      const dateKey = new Date(entry.date).toISOString().split('T')[0] ?? '';
      byDate.set(dateKey, (byDate.get(dateKey) ?? 0) + entry.durationMinutes);
    }

    // Count days that met target
    let count = 0;
    for (const minutes of byDate.values()) {
      if (minutes >= targetMinutes) {
        count++;
      }
    }

    return count;
  }

  private calculateCurrentStreak(entries: TimeEntryWithDetails[]): number {
    if (entries.length === 0) return 0;

    const dates = new Set(
      entries
        .map((e) => new Date(e.date).toISOString().split('T')[0])
        .filter((d): d is string => d !== undefined)
    );
    const sortedDates = Array.from(dates).sort((a, b) => b.localeCompare(a)); // Most recent first

    if (sortedDates.length === 0) return 0;

    // Check if there's an entry today or yesterday
    const today = new Date().toISOString().split('T')[0] ?? '';
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0] ?? '';

    if (sortedDates[0] !== today && sortedDates[0] !== yesterday) {
      return 0; // Streak is broken if no entry today or yesterday
    }

    let streak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const currDate = sortedDates[i - 1];
      const prevDate = sortedDates[i];
      if (!currDate || !prevDate) continue;

      const curr = new Date(currDate);
      const prev = new Date(prevDate);
      const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  private generateRecommendations(
    entries: TimeEntryWithDetails[],
    settings: TimeTrackingSettings | null
  ): string[] {
    const recommendations: string[] = [];

    if (entries.length === 0) {
      recommendations.push('Start tracking your time to get personalized productivity insights.');
      return recommendations;
    }

    const totalMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0);
    const dates = new Set(entries.map((e) => new Date(e.date).toISOString().split('T')[0]));
    const avgMinutesPerDay = dates.size > 0 ? totalMinutes / dates.size : 0;
    const dailyTarget = settings?.targetHoursPerDay ? Number(settings.targetHoursPerDay) * 60 : 480;

    if (avgMinutesPerDay < dailyTarget * 0.8) {
      recommendations.push(
        `Your average daily tracked time is below your target. Try to track at least ${Math.round(dailyTarget / 60)} hours per day.`
      );
    }

    if (avgMinutesPerDay > dailyTarget * 1.2) {
      recommendations.push(
        'You are consistently exceeding your daily target. Consider adjusting your workload or target hours.'
      );
    }

    const billableEntries = entries.filter((e) => e.isBillable);
    const billableRatio = entries.length > 0 ? billableEntries.length / entries.length : 0;
    if (billableRatio < 0.5) {
      recommendations.push(
        'Less than half of your time entries are billable. Review your time allocation to maximize billable hours.'
      );
    }

    return recommendations;
  }

  // Removed exportToJson - json not a valid export format
}
