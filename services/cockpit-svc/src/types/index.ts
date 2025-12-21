/**
 * @module @skillancer/cockpit-svc/types
 * Type exports for cockpit-svc
 */

export * from './crm.types.js';

// Export from project.types, excluding duplicates that conflict with invoice.types
export type {
  // Project types
  CreateProjectParams,
  UpdateProjectParams,
  ProjectFilters,
  ProjectWithDetails,
  ProjectWithMetrics,
  // Task types
  CreateTaskParams,
  UpdateTaskParams,
  TaskFilters,
  TaskWithSubtasks,
  TaskOrder,
  TaskStats,
  // Milestone types
  CreateMilestoneParams,
  UpdateMilestoneParams,
  MilestoneWithProgress,
  Deliverable,
  // Activity types
  ProjectActivityItem,
  LogActivityParams as ProjectLogActivityParams,
  // File types
  CreateFileParams,
  FileFilters,
  // Template types - use aliases to avoid conflicts
  TemplateTask,
  TemplateMilestone,
  CreateTemplateParams as ProjectCreateTemplateParams,
  UpdateTemplateParams as ProjectUpdateTemplateParams,
  TemplateWithUsage,
  ProjectTemplateWithStats,
  // Time entry types
  CreateTimeEntryParams as ProjectCreateTimeEntryParams,
  UpdateTimeEntryParams as ProjectUpdateTimeEntryParams,
  TimeEntryFilters as ProjectTimeEntryFilters,
  TimeStats,
  // Workload types
  CapacitySettings,
  DailyWorkload,
  WorkloadView,
  WorkloadDay,
  WorkloadSummary,
  // Stats types
  ProjectStats,
  TimeSummary,
  FinancialSummary,
  Deadline,
  // Enum re-exports
  ProjectType,
  ProjectStatus,
  BudgetType,
  TaskStatus,
  MilestoneStatus,
  Priority,
  ProjectSource,
  ProjectFileType,
  ProjectActivityType,
  TimeEntrySource,
} from './project.types.js';

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

// Financial types (CP-3.1: Income & Expense Tracking)
export * from './finance.types.js';

// Invoice types (CP-3.2: Professional Invoicing)
export * from './invoice.types.js';
