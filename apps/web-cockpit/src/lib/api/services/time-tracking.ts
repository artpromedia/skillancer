/**
 * Time Tracking Service
 *
 * Type-safe API methods for time tracking operations using the shared API client.
 */

import { getApiClient } from '../api-client';

import type { ApiResponse, PaginatedResponse } from '@skillancer/shared-api-client';

// =============================================================================
// Types
// =============================================================================

export interface TimeEntry {
  id: string;
  userId: string;
  projectId?: string;
  taskId?: string;
  categoryId?: string;
  description: string;
  startTime: string;
  endTime?: string;
  duration: number;
  billable: boolean;
  hourlyRate?: number;
  tags: string[];
  source: 'manual' | 'timer' | 'import';
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntryCreate {
  projectId?: string;
  taskId?: string;
  categoryId?: string;
  description: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  billable?: boolean;
  hourlyRate?: number;
  tags?: string[];
  source?: 'manual' | 'timer' | 'import';
}

export interface TimeEntryUpdate {
  projectId?: string;
  taskId?: string;
  categoryId?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  billable?: boolean;
  hourlyRate?: number;
  tags?: string[];
}

export interface TimeCategory {
  id: string;
  name: string;
  color: string;
  description?: string;
  hourlyRate?: number;
  billable: boolean;
  isActive: boolean;
}

export interface TimerState {
  id: string;
  userId: string;
  isRunning: boolean;
  isPaused: boolean;
  startTime: string;
  pausedAt?: string;
  pausedDuration: number;
  projectId?: string;
  taskId?: string;
  categoryId?: string;
  description: string;
  billable: boolean;
  tags: string[];
}

export interface TimeReport {
  period: {
    start: string;
    end: string;
  };
  totalDuration: number;
  billableDuration: number;
  nonBillableDuration: number;
  totalEarnings: number;
  entriesCount: number;
  byProject: Array<{
    projectId: string;
    projectName: string;
    duration: number;
    earnings: number;
  }>;
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    duration: number;
    earnings: number;
  }>;
  byDay: Array<{
    date: string;
    duration: number;
    earnings: number;
  }>;
}

export interface TimeReportParams {
  startDate: string;
  endDate: string;
  projectIds?: string[];
  categoryIds?: string[];
  billable?: boolean;
}

export interface TimeEntryFilters {
  page?: number;
  limit?: number;
  projectId?: string;
  taskId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  billable?: boolean;
  search?: string;
  sortBy?: 'startTime' | 'duration' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  totalDuration: number;
  dailyTotals: Array<{
    date: string;
    duration: number;
    billableDuration: number;
  }>;
  projectBreakdown: Array<{
    projectId: string;
    projectName: string;
    duration: number;
    percentage: number;
  }>;
}

export interface DailyReport {
  date: string;
  totalDuration: number;
  billableDuration: number;
  entries: TimeEntry[];
  hourlyBreakdown: Array<{
    hour: number;
    duration: number;
  }>;
}

// =============================================================================
// Time Tracking API Service
// =============================================================================

export const timeTrackingService = {
  // =============================================================================
  // Time Entries
  // =============================================================================

  /**
   * List time entries with filters
   */
  async list(filters: TimeEntryFilters = {}): Promise<PaginatedResponse<TimeEntry>> {
    const client = getApiClient();
    const { page = 1, limit = 50, ...rest } = filters;

    return client.get<TimeEntry[]>('/time-entries', {
      params: { page, limit, ...rest },
    }) as Promise<PaginatedResponse<TimeEntry>>;
  },

  /**
   * Get a single time entry
   */
  async getById(id: string): Promise<ApiResponse<TimeEntry>> {
    const client = getApiClient();
    return client.get<TimeEntry>(`/time-entries/${id}`);
  },

  /**
   * Create a time entry
   */
  async create(data: TimeEntryCreate): Promise<ApiResponse<TimeEntry>> {
    const client = getApiClient();
    return client.post<TimeEntry, TimeEntryCreate>('/time-entries', data);
  },

  /**
   * Update a time entry
   */
  async update(id: string, data: TimeEntryUpdate): Promise<ApiResponse<TimeEntry>> {
    const client = getApiClient();
    return client.patch<TimeEntry, TimeEntryUpdate>(`/time-entries/${id}`, data);
  },

  /**
   * Delete a time entry
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`/time-entries/${id}`);
  },

  /**
   * Bulk delete time entries
   */
  async bulkDelete(ids: string[]): Promise<ApiResponse<{ deleted: number }>> {
    const client = getApiClient();
    return client.post<{ deleted: number }, { ids: string[] }>('/time-entries/bulk-delete', {
      ids,
    });
  },

  /**
   * Duplicate a time entry
   */
  async duplicate(id: string, date?: string): Promise<ApiResponse<TimeEntry>> {
    const client = getApiClient();
    return client.post<TimeEntry, { date?: string }>(`/time-entries/${id}/duplicate`, { date });
  },

  // =============================================================================
  // Timer
  // =============================================================================

  /**
   * Get current timer state
   */
  async getTimerState(): Promise<ApiResponse<TimerState | null>> {
    const client = getApiClient();
    return client.get<TimerState | null>('/timer/state');
  },

  /**
   * Start a new timer
   */
  async startTimer(data: {
    projectId?: string;
    taskId?: string;
    categoryId?: string;
    description?: string;
    billable?: boolean;
    tags?: string[];
  }): Promise<ApiResponse<TimerState>> {
    const client = getApiClient();
    return client.post<TimerState>('/timer/start', data);
  },

  /**
   * Stop the running timer
   */
  async stopTimer(): Promise<ApiResponse<TimeEntry>> {
    const client = getApiClient();
    return client.post<TimeEntry>('/timer/stop');
  },

  /**
   * Pause the running timer
   */
  async pauseTimer(): Promise<ApiResponse<TimerState>> {
    const client = getApiClient();
    return client.post<TimerState>('/timer/pause');
  },

  /**
   * Resume a paused timer
   */
  async resumeTimer(): Promise<ApiResponse<TimerState>> {
    const client = getApiClient();
    return client.post<TimerState>('/timer/resume');
  },

  /**
   * Update the running timer
   */
  async updateTimer(data: {
    projectId?: string;
    taskId?: string;
    categoryId?: string;
    description?: string;
    billable?: boolean;
    tags?: string[];
  }): Promise<ApiResponse<TimerState>> {
    const client = getApiClient();
    return client.patch<TimerState>('/timer', data);
  },

  /**
   * Discard the running timer
   */
  async discardTimer(): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>('/timer');
  },

  // =============================================================================
  // Categories
  // =============================================================================

  /**
   * List categories
   */
  async getCategories(): Promise<ApiResponse<TimeCategory[]>> {
    const client = getApiClient();
    return client.get<TimeCategory[]>('/time-categories');
  },

  /**
   * Create a category
   */
  async createCategory(
    data: Omit<TimeCategory, 'id' | 'isActive'>
  ): Promise<ApiResponse<TimeCategory>> {
    const client = getApiClient();
    return client.post<TimeCategory>('/time-categories', data);
  },

  /**
   * Update a category
   */
  async updateCategory(
    id: string,
    data: Partial<TimeCategory>
  ): Promise<ApiResponse<TimeCategory>> {
    const client = getApiClient();
    return client.patch<TimeCategory>(`/time-categories/${id}`, data);
  },

  /**
   * Delete a category
   */
  async deleteCategory(id: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`/time-categories/${id}`);
  },

  // =============================================================================
  // Reports
  // =============================================================================

  /**
   * Generate a time report
   */
  async generateReport(params: TimeReportParams): Promise<ApiResponse<TimeReport>> {
    const client = getApiClient();
    const { projectIds, categoryIds, ...rest } = params;

    const queryParams: Record<string, string | boolean | undefined> = { ...rest };
    if (projectIds?.length) {
      queryParams.projectIds = projectIds.join(',');
    }
    if (categoryIds?.length) {
      queryParams.categoryIds = categoryIds.join(',');
    }

    return client.get<TimeReport>('/time-reports', { params: queryParams });
  },

  /**
   * Get weekly report
   */
  async getWeeklyReport(weekStart?: string): Promise<ApiResponse<WeeklyReport>> {
    const client = getApiClient();
    return client.get<WeeklyReport>('/time-reports/weekly', {
      params: weekStart ? { weekStart } : undefined,
    });
  },

  /**
   * Get daily report
   */
  async getDailyReport(date?: string): Promise<ApiResponse<DailyReport>> {
    const client = getApiClient();
    return client.get<DailyReport>('/time-reports/daily', {
      params: date ? { date } : undefined,
    });
  },

  /**
   * Export time entries
   */
  async exportEntries(
    params: TimeReportParams & { format: 'csv' | 'pdf' | 'xlsx' }
  ): Promise<Blob> {
    const client = getApiClient();
    const axios = client.getAxiosInstance();
    const response = await axios.get('/time-entries/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};

export default timeTrackingService;
