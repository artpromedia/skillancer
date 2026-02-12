// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/types/project
 * Project Management Type Definitions
 */

import type {
  CockpitProjectType,
  CockpitProjectStatus,
  CockpitBudgetType,
  CockpitTaskStatus,
  CockpitMilestoneStatus,
  CrmPriority,
  ProjectSource,
  ProjectFileType,
  ProjectActivityType,
  TimeEntrySource,
} from '@skillancer/database';

// Re-export enums for convenience
export type {
  ProjectSource,
  ProjectFileType,
  ProjectActivityType,
  TimeEntrySource,
} from '@skillancer/database';

// Alias the cockpit-specific types for cleaner usage
export type ProjectType = CockpitProjectType;
export type ProjectStatus = CockpitProjectStatus;
export type BudgetType = CockpitBudgetType;
export type TaskStatus = CockpitTaskStatus;
export type MilestoneStatus = CockpitMilestoneStatus;
export type Priority = CrmPriority;

// ============================================================================
// PROJECT TYPES
// ============================================================================

export interface CreateProjectParams {
  freelancerUserId: string;
  clientId?: string;
  name: string;
  description?: string;
  projectType?: ProjectType;
  category?: string;
  tags?: string[];
  status?: ProjectStatus;
  priority?: CrmPriority;
  startDate?: Date;
  dueDate?: Date;
  budgetType?: BudgetType;
  budgetAmount?: number;
  hourlyRate?: number;
  currency?: string;
  estimatedHours?: number;
  color?: string;
  notes?: string;
  templateId?: string;
}

export interface UpdateProjectParams extends Partial<
  Omit<CreateProjectParams, 'freelancerUserId'>
> {
  isArchived?: boolean;
  isFavorite?: boolean;
  progressPercent?: number;
  trackedHours?: number;
  billableHours?: number;
  totalBilled?: number;
  totalPaid?: number;
  completedAt?: Date | null;
  customFields?: Record<string, unknown>;
}

export interface ProjectFilters {
  freelancerUserId: string;
  clientId?: string;
  status?: ProjectStatus[];
  priority?: CrmPriority[];
  source?: ProjectSource[];
  projectType?: ProjectType[];
  tags?: string[];
  hasOverdueTasks?: boolean;
  startDateFrom?: Date;
  startDateTo?: Date;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  isArchived?: boolean;
  isFavorite?: boolean;
  search?: string;
  sortBy?:
    | 'name'
    | 'dueDate'
    | 'deadline'
    | 'status'
    | 'priority'
    | 'created'
    | 'updated'
    | 'progress';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface TaskStats {
  total: number;
  completed: number;
  inProgress: number;
  todo: number;
  blocked: number;
  overdue: number;
}

export interface Deadline {
  type: 'TASK' | 'MILESTONE';
  id: string;
  title: string;
  dueDate: Date;
}

export interface ProjectWithMetrics {
  id: string;
  name: string;
  description: string | null;
  source: ProjectSource;
  projectType: ProjectType;
  status: ProjectStatus;
  priority: CrmPriority;
  progressPercent: number;
  startDate: Date | null;
  dueDate: Date | null;
  trackedHours: number;
  estimatedHours: number | null;
  totalBilled: number;
  isArchived: boolean;
  isFavorite: boolean;
  color: string | null;
  tags: string[];
  createdAt: Date;
  client: {
    id: string;
    displayName: string;
  } | null;
  taskStats: TaskStats;
  upcomingDeadlines: Deadline[];
  isOverdue: boolean;
}

export interface TimeSummary {
  totalHours: number;
  billableHours: number;
  thisWeekHours: number;
  billablePercentage: number;
}

export interface FinancialSummary {
  budgetType: BudgetType | null;
  budgetAmount: number;
  hourlyRate: number | undefined;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  budgetUsed: number;
  budgetRemaining: number;
  projectedTotal: number;
}

export interface TaskWithSubtasks {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  parentTaskId: string | null;
  orderIndex: number;
  status: TaskStatus;
  priority: CrmPriority;
  startDate: Date | null;
  dueDate: Date | null;
  completedAt: Date | null;
  estimatedMinutes: number;
  trackedMinutes: number;
  milestoneId: string | null;
  tags: string[];
  isRecurring: boolean;
  recurrenceRule: string | null;
  createdAt: Date;
  updatedAt: Date;
  subtasks: TaskWithSubtasks[];
}

export interface ProjectWithDetails {
  id: string;
  freelancerUserId: string;
  clientId: string | null;
  source: ProjectSource;
  marketContractId: string | null;
  externalId: string | null;
  externalPlatform: string | null;
  externalUrl: string | null;
  name: string;
  description: string | null;
  projectType: ProjectType;
  category: string | null;
  tags: string[];
  status: ProjectStatus;
  priority: CrmPriority;
  startDate: Date | null;
  dueDate: Date | null;
  completedAt: Date | null;
  budgetType: BudgetType | null;
  budgetAmount: number | null;
  hourlyRate: number | null;
  currency: string;
  progressPercent: number;
  estimatedHours: number | null;
  trackedHours: number;
  billableHours: number;
  totalBilled: number;
  totalPaid: number;
  isArchived: boolean;
  isFavorite: boolean;
  color: string | null;
  notes: string | null;
  customFields: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  client: {
    id: string;
    displayName: string;
    email: string | null;
    companyName: string | null;
  } | null;
  tasks: TaskWithSubtasks[];
  milestones: MilestoneWithProgress[];
  recentActivity: ProjectActivityItem[];
  taskStats: TaskStats;
  timeSummary: TimeSummary;
  financialSummary: FinancialSummary;
}

// ============================================================================
// TASK TYPES
// ============================================================================

export interface CreateTaskParams {
  projectId: string;
  freelancerUserId: string;
  title: string;
  description?: string;
  parentTaskId?: string;
  status?: TaskStatus;
  priority?: CrmPriority;
  startDate?: Date;
  dueDate?: Date;
  estimatedMinutes?: number;
  milestoneId?: string;
  tags?: string[];
  isRecurring?: boolean;
  recurrenceRule?: string;
}

export interface UpdateTaskParams {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: CrmPriority;
  startDate?: Date;
  dueDate?: Date;
  estimatedMinutes?: number;
  milestoneId?: string | null;
  tags?: string[];
  isRecurring?: boolean;
  recurrenceRule?: string | null;
}

export interface TaskOrder {
  taskId: string;
  orderIndex: number;
  parentTaskId?: string | null;
}

export interface TaskFilters {
  projectId?: string;
  freelancerUserId?: string;
  status?: TaskStatus[];
  priority?: CrmPriority[];
  milestoneId?: string;
  dueDateBefore?: Date;
  dueDateAfter?: Date;
  isOverdue?: boolean;
  search?: string;
  sortBy?: 'orderIndex' | 'dueDate' | 'priority' | 'status' | 'created';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// ============================================================================
// MILESTONE TYPES
// ============================================================================

export interface Deliverable {
  title: string;
  description?: string;
  completed: boolean;
  orderIndex: number;
}

export interface CreateMilestoneParams {
  projectId: string;
  freelancerUserId: string;
  title: string;
  description?: string;
  dueDate?: Date;
  amount?: number;
  deliverables?: Array<{ title: string; description?: string }>;
}

export interface UpdateMilestoneParams {
  title?: string;
  description?: string;
  dueDate?: Date | null;
  amount?: number | null;
  deliverables?: Deliverable[];
  status?: MilestoneStatus;
}

export interface MilestoneWithProgress {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  orderIndex: number;
  dueDate: Date | null;
  completedAt: Date | null;
  status: MilestoneStatus;
  marketMilestoneId: string | null;
  amount: number | null;
  isPaid: boolean;
  deliverables: Deliverable[] | null;
  createdAt: Date;
  updatedAt: Date;
  taskCount: number;
  completedTaskCount: number;
  progressPercent: number;
}

// ============================================================================
// TIME ENTRY TYPES
// ============================================================================

export interface CreateTimeEntryParams {
  projectId: string;
  freelancerUserId: string;
  taskId?: string;
  description?: string;
  date?: Date;
  startTime?: Date;
  endTime?: Date;
  durationMinutes?: number;
  isBillable?: boolean;
  source?: TimeEntrySource;
}

export interface UpdateTimeEntryParams {
  description?: string;
  date?: Date;
  startTime?: Date;
  endTime?: Date;
  durationMinutes?: number;
  isBillable?: boolean;
  hourlyRate?: number;
  taskId?: string | null;
}

export interface TimeEntryFilters {
  freelancerUserId: string;
  projectId?: string;
  taskId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  startDate?: Date;
  endDate?: Date;
  isBillable?: boolean;
  isInvoiced?: boolean;
  page?: number;
  limit?: number;
}

export interface TimeStats {
  totalMinutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
  estimatedMinutes: number;
  remainingMinutes: number;
  utilizationPercent: number;
}

// ============================================================================
// ACTIVITY TYPES
// ============================================================================

export interface ProjectActivityItem {
  id: string;
  projectId: string;
  activityType: ProjectActivityType;
  description: string;
  taskId: string | null;
  milestoneId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface LogActivityParams {
  projectId: string;
  activityType: ProjectActivityType;
  description: string;
  taskId?: string;
  milestoneId?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// FILE TYPES
// ============================================================================

export interface CreateFileParams {
  projectId: string;
  name: string;
  description?: string;
  fileType: ProjectFileType;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  folder?: string;
  tags?: string[];
}

export interface FileFilters {
  projectId: string;
  fileType?: ProjectFileType[];
  folder?: string;
  search?: string;
}

// ============================================================================
// TEMPLATE TYPES
// ============================================================================

export interface TemplateTask {
  title: string;
  description?: string;
  estimatedMinutes?: number;
  orderIndex: number;
  subtasks?: Array<{
    title: string;
    description?: string;
    estimatedMinutes?: number;
  }>;
}

export interface TemplateMilestone {
  title: string;
  description?: string;
  orderIndex: number;
  deliverables?: Array<{ title: string; description?: string }>;
}

export interface CreateTemplateParams {
  freelancerUserId: string;
  name: string;
  description?: string;
  category?: string;
  projectType?: ProjectType;
  budgetType?: BudgetType;
  defaultHourlyRate?: number;
  estimatedHours?: number;
  tags?: string[];
  tasks?: Array<{
    title: string;
    description?: string;
    estimatedMinutes?: number;
    subtasks?: Array<{
      title: string;
      description?: string;
      estimatedMinutes?: number;
    }>;
  }>;
  milestones?: Array<{
    title: string;
    description?: string;
    daysFromStart?: number;
    deliverables?: Array<{
      title: string;
      description?: string;
    }>;
  }>;
}

export interface UpdateTemplateParams {
  name?: string;
  description?: string;
  category?: string;
  projectType?: ProjectType;
  budgetType?: BudgetType;
  defaultHourlyRate?: number;
  estimatedHours?: number;
  tags?: string[];
  tasks?: Array<{
    title: string;
    description?: string;
    estimatedMinutes?: number;
    subtasks?: Array<{
      title: string;
      description?: string;
      estimatedMinutes?: number;
    }>;
  }>;
  milestones?: Array<{
    title: string;
    description?: string;
    daysFromStart?: number;
    deliverables?: Array<{
      title: string;
      description?: string;
    }>;
  }>;
}

export interface TemplateWithUsage {
  id: string;
  freelancerUserId: string;
  name: string;
  description: string | null;
  category: string | null;
  taskCount: number;
  milestoneCount: number;
  useCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectTemplateWithStats {
  id: string;
  freelancerUserId: string;
  name: string;
  description: string | null;
  category: string | null;
  projectType: ProjectType | null;
  budgetType: BudgetType | null;
  defaultHourlyRate: number | null;
  estimatedHours: number | null;
  taskStructure: unknown;
  milestoneStructure: unknown;
  tags: string[] | null;
  useCount: number;
  createdAt: Date;
  updatedAt: Date;
  taskCount: number;
  milestoneCount: number;
}

// ============================================================================
// WORKLOAD TYPES
// ============================================================================

export interface CapacitySettings {
  hoursPerDay: number;
  workDays: number[]; // 0=Sunday, 1=Monday, etc.
  bufferPercent: number;
}

export interface DailyWorkload {
  date: Date;
  capacityMinutes: number;
  scheduledMinutes: number;
  loggedMinutes: number;
  availableMinutes: number;
  isWorkDay: boolean;
  projects: Array<{
    projectId: string;
    projectName: string;
    scheduledMinutes: number;
  }>;
}

export interface WorkloadView {
  startDate: Date;
  endDate: Date;
  dailyWorkload: DailyWorkload[];
  totalCapacityMinutes: number;
  committedMinutes: number;
  loggedMinutes: number;
  availableMinutes: number;
  utilizationPercent: number;
  isOverbooked: boolean;
  projects: Array<{
    projectId: string;
    projectName: string;
    clientName?: string;
    deadline: Date | null;
    remainingMinutes: number;
    priority: Priority;
    status: ProjectStatus;
  }>;
}

export interface WorkloadDay {
  date: Date;
  tasks: Array<{
    id: string;
    title: string;
    projectId: string;
    projectName: string;
    dueDate: Date;
    status: TaskStatus;
    estimatedMinutes: number;
  }>;
  taskCount: number;
  estimatedHours: number;
  isOverloaded: boolean;
}

export interface WorkloadSummary {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  totalEstimatedHours: number;
  avgHoursPerDay: number;
  overloadedDays: number;
}

// ============================================================================
// STATS TYPES
// ============================================================================

export interface ProjectStats {
  total: number;
  byStatus: Partial<Record<ProjectStatus, number>>;
  byType: Partial<Record<ProjectType, number>>;
  totalTrackedHours: number;
  totalBilled: number;
  totalPaid: number;
  activeProjects: number;
  overdueProjects: number;
  completedThisMonth: number;
}

// ============================================================================
// MARKET SYNC TYPES
// ============================================================================

// MarketSyncResult is defined in crm.types.ts to avoid duplicate export

export interface ContractStatusMapping {
  [key: string]: ProjectStatus;
}

export interface MilestoneStatusMapping {
  [key: string]: MilestoneStatus;
}
