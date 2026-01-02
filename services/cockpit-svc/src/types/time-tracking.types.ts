// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/types/time-tracking
 * Type definitions for the comprehensive time tracking system
 */

import type {
  CockpitTimeEntry,
  ActiveTimer,
  Timesheet,
  TimeCategory,
  CockpitProject,
  ProjectTask,
  Client,
} from '@skillancer/database';

// Re-export enums as types for use in service layer
export type {
  TrackingMethod,
  TimeApprovalStatus,
  RoundingMethod,
  TimerStatus,
  TimesheetStatus,
  TimeEntrySource,
  EvidenceType,
} from '@skillancer/database';

// ============================================================================
// TIMER TYPES
// ============================================================================

export interface StartTimerParams {
  userId: string;
  projectId?: string;
  taskId?: string;
  description?: string;
  isBillable?: boolean;
  hourlyRate?: number;
}

export interface StopTimerParams {
  userId: string;
  description?: string;
  projectId?: string;
  taskId?: string;
  isBillable?: boolean;
  category?: string;
  tags?: string[];
  applyRounding?: boolean;
}

export interface UpdateTimerParams {
  projectId?: string;
  taskId?: string;
  description?: string;
  isBillable?: boolean;
}

export interface ActiveTimerWithDuration extends ActiveTimer {
  currentDurationMinutes: number;
  currentAmount?: number;
  project?: {
    id: string;
    name: string;
  } | null;
  task?: {
    id: string;
    title: string;
  } | null;
}

// ============================================================================
// TIME ENTRY TYPES
// ============================================================================

export interface CreateTimeEntryParams {
  freelancerUserId: string;
  projectId?: string;
  taskId?: string;
  clientId?: string;
  marketContractId?: string;
  date: Date;
  startTime?: Date;
  endTime?: Date;
  durationMinutes: number;
  description: string;
  category?: string;
  tags?: string[];
  isBillable?: boolean;
  hourlyRate?: number;
  trackingMethod?: 'TIMER' | 'MANUAL' | 'CALENDAR' | 'SKILLPOD' | 'IMPORTED';
}

export interface UpdateTimeEntryParams {
  projectId?: string;
  taskId?: string;
  clientId?: string;
  date?: Date;
  startTime?: Date;
  endTime?: Date;
  durationMinutes?: number;
  description?: string;
  category?: string;
  tags?: string[];
  isBillable?: boolean;
  hourlyRate?: number;
}

export interface TimeEntryFilters {
  freelancerUserId: string;
  projectId?: string;
  taskId?: string;
  clientId?: string;
  startDate?: Date;
  endDate?: Date;
  isBillable?: boolean;
  isInvoiced?: boolean;
  category?: string;
  tags?: string[];
  search?: string;
  source?: string;
  page?: number;
  limit?: number;
}

export interface TimeEntryWithDetails extends CockpitTimeEntry {
  project?: Pick<CockpitProject, 'id' | 'name'> | null;
  task?: Pick<ProjectTask, 'id' | 'title'> | null;
  client?: Pick<Client, 'id' | 'firstName' | 'lastName' | 'companyName'> | null;
}

export interface TimeEntrySummary {
  totalMinutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
  totalAmount: number;
  entryCount: number;
  billablePercentage: number;
}

export interface BulkUpdateParams {
  entryIds: string[];
  updates: {
    projectId?: string;
    isBillable?: boolean;
    category?: string;
  };
}

// ============================================================================
// TIMESHEET TYPES
// ============================================================================

export interface TimesheetView {
  timesheet: Timesheet;
  weekStart: Date;
  weekEnd: Date;
  dailyEntries: DailyEntries[];
  projectSummaries: ProjectTimeSummary[];
  summary: TimesheetSummary;
}

export interface DailyEntries {
  date: Date;
  entries: TimeEntryWithDetails[];
  totalMinutes: number;
  totalHours: number;
}

export interface ProjectTimeSummary {
  projectId: string | null;
  projectName: string;
  minutes: number;
  hours: number;
  amount: number;
}

export interface TimesheetSummary {
  totalHours: number;
  billableHours: number;
  totalAmount: number;
  targetHours: number;
  progressPercent: number;
}

export interface CreateTimesheetParams {
  freelancerUserId: string;
  weekStartDate: Date;
  weekEndDate: Date;
  totalMinutes: number;
  billableMinutes: number;
  totalAmount: number;
  status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
}

export interface UpdateTimesheetParams {
  status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  submittedAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  isLocked?: boolean;
  lockedAt?: Date;
  notes?: string;
  totalMinutes?: number;
  billableMinutes?: number;
  totalAmount?: number;
}

// ============================================================================
// REPORTING TYPES
// ============================================================================

export interface TimeReportParams {
  freelancerUserId?: string;
  startDate: Date;
  endDate: Date;
  groupBy: 'day' | 'week' | 'month' | 'project' | 'client' | 'category';
  projectId?: string;
  projectIds?: string[];
  clientId?: string;
  clientIds?: string[];
  isBillable?: boolean;
}

export interface TimeReport {
  period: {
    startDate: Date;
    endDate: Date;
    days: number;
  };
  summary: TimeEntrySummary & {
    avgHoursPerDay: number;
  };
  grouped: GroupedTimeData[];
  trends: {
    hoursChange: number;
    amountChange: number;
  };
  entries: TimeEntryWithDetails[];
}

export interface GroupedTimeData {
  key: string;
  label: string;
  minutes: number;
  hours: number;
  amount: number;
  entryCount: number;
}

// ============================================================================
// PRODUCTIVITY INSIGHTS TYPES
// ============================================================================

export interface ProductivityInsights {
  period: {
    startDate: Date;
    endDate: Date;
    days: number;
  };
  patterns: {
    peakHour: number;
    peakDay: string;
    hourlyDistribution: Array<{ hour: number; minutes: number }>;
    dailyDistribution: Array<{ day: string; minutes: number }>;
    categoryDistribution: Array<{
      category: string;
      minutes: number;
      percentage: number;
    }>;
  };
  consistency: {
    workDays: number;
    daysMetTarget: number;
    consistencyScore: number;
    longestStreak: number;
    currentStreak: number;
  };
  recommendations: string[];
}

export interface DailyTotal {
  date: Date;
  minutes: number;
}

// ============================================================================
// SETTINGS TYPES
// ============================================================================

export interface CreateSettingsParams {
  userId: string;
  defaultHourlyRate?: number;
  defaultCurrency?: string;
  autoStopAfterMinutes?: number;
  idleDetectionMinutes?: number;
  reminderEnabled?: boolean;
  reminderTime?: string;
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
}

export interface UpdateSettingsParams {
  defaultHourlyRate?: number;
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
}

// ============================================================================
// CATEGORY TYPES
// ============================================================================

export interface CreateCategoryParams {
  freelancerUserId?: string;
  name: string;
  color?: string;
  icon?: string;
  defaultBillable?: boolean;
  orderIndex?: number;
  isSystem?: boolean;
}

export interface UpdateCategoryParams {
  name?: string;
  color?: string;
  icon?: string;
  defaultBillable?: boolean;
  orderIndex?: number;
  isActive?: boolean;
}

export interface CategoryWithUsage extends TimeCategory {
  entryCount?: number;
  totalMinutes?: number;
}

// ============================================================================
// MARKET SYNC TYPES
// ============================================================================

export interface MarketTimeEntry {
  id: string;
  contractId: string;
  date: Date;
  startTime?: Date;
  endTime?: Date;
  durationMinutes: number;
  description: string;
  hourlyRate?: number;
  amount?: number;
  status: string;
}

export interface MarketSyncResult {
  imported: number;
  updated: number;
  errors: string[];
}

export interface SyncToMarketParams {
  timeEntryId: string;
  contractId: string;
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ExportParams {
  freelancerUserId?: string;
  format: ExportFormat;
  startDate: Date;
  endDate: Date;
  projectId?: string;
  projectIds?: string[];
  clientId?: string;
  clientIds?: string[];
  includeNonBillable?: boolean;
}

export interface ExportResult {
  filename: string;
  mimeType: string;
  data: Buffer;
}

// ============================================================================
// INVOICE TYPES
// ============================================================================

export interface MarkAsInvoicedParams {
  entryIds: string[];
  invoiceId: string;
}

export interface InvoiceSummary {
  totalMinutes: number;
  totalAmount: number;
  entryCount: number;
  byProject: Array<{
    projectId: string;
    projectName: string;
    minutes: number;
    amount: number;
  }>;
}

// ============================================================================
// CALENDAR INTEGRATION TYPES
// ============================================================================

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  source: string;
}

export interface ImportFromCalendarParams {
  events: CalendarEvent[];
  projectId?: string;
  isBillable?: boolean;
  category?: string;
}

// ============================================================================
// IDLE DETECTION TYPES
// ============================================================================

export interface IdleDetectionParams {
  userId: string;
  idleMinutes: number;
  lastActivityAt: Date;
}

export interface IdleNotification {
  userId: string;
  timerId: string;
  idleMinutes: number;
  action: 'pause' | 'stop' | 'continue';
}

// ============================================================================
// REMINDER TYPES
// ============================================================================

export interface TimeReminderParams {
  userId: string;
  reminderTime: string;
  message: string;
}

export interface ReminderNotification {
  userId: string;
  type: 'daily_reminder' | 'weekly_summary' | 'missing_time';
  message: string;
  data?: Record<string, unknown>;
}

