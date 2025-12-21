/**
 * @module @skillancer/cockpit-svc/types
 * Type exports for cockpit-svc
 */

export * from './crm.types.js';
export * from './project.types.js';

// Export from time-tracking.types, excluding duplicates from crm.types
export type {
  // Timer types
  StartTimerParams,
  StopTimerParams,
  UpdateTimerParams,
  ActiveTimerWithDuration,
  // Time entry types (use these as primary)
  CreateTimeEntryParams,
  UpdateTimeEntryParams,
  TimeEntryFilters,
  TimeEntryWithDetails,
  TimeEntrySummary,
  BulkUpdateParams,
  // Timesheet types
  TimesheetView,
  DailyEntries,
  ProjectTimeSummary,
  TimesheetSummary,
  // Report types
  TimeReportParams,
  TimeReport,
  GroupedTimeData,
  ProductivityInsights,
  // Settings types
  CreateSettingsParams,
  UpdateSettingsParams,
  // Category types
  CreateCategoryParams,
  UpdateCategoryParams,
  CategoryWithUsage,
  // Export types
  ExportFormat,
  ExportParams,
  ExportResult,
  // Invoice types
  MarkAsInvoicedParams,
} from './time-tracking.types.js';
