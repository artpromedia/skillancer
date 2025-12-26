/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Time Tracking API Client
 *
 * Client for interacting with time tracking backend services.
 * Handles all HTTP requests for time entries, projects, categories, and reports.
 *
 * @module lib/api/time
 */

// ============================================================================
// Types
// ============================================================================

export interface TimeEntry {
  id: string;
  userId: string;
  projectId?: string;
  taskId?: string;
  categoryId?: string;
  description: string;
  startTime: string;
  endTime?: string;
  duration: number; // in seconds
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

export interface Project {
  id: string;
  name: string;
  clientId?: string;
  color: string;
  hourlyRate?: number;
  budget?: number;
  budgetType?: 'hours' | 'amount';
  isActive: boolean;
}

export interface Category {
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
  summary: {
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
    earnings: number;
    entriesCount: number;
  };
  byProject: Array<{
    projectId: string;
    projectName: string;
    hours: number;
    billableHours: number;
    earnings: number;
    color: string;
  }>;
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    hours: number;
    color: string;
  }>;
  byDay: Array<{
    date: string;
    hours: number;
    billableHours: number;
  }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// API Client Configuration
// ============================================================================

interface ApiClientConfig {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  onUnauthorized?: () => void;
  onError?: (error: ApiError) => void;
}

// ============================================================================
// Time API Client Class
// ============================================================================

export class TimeApiClient {
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = config;
  }

  // --------------------------------------------------------------------------
  // HTTP Helpers
  // --------------------------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: Record<string, string | number | boolean | undefined>;
    }
  ): Promise<T> {
    const token = await this.config.getAccessToken();

    // Build URL with query params
    const url = new URL(`${this.config.baseUrl}${path}`);
    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      if (response.status === 401) {
        this.config.onUnauthorized?.();
      }

      const error: ApiError = await response.json().catch(() => ({
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred',
      }));

      this.config.onError?.(error);
      throw error;
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // --------------------------------------------------------------------------
  // Time Entries
  // --------------------------------------------------------------------------

  /**
   * Get time entries with optional filters
   */
  async getEntries(filters?: {
    startDate?: string;
    endDate?: string;
    projectId?: string;
    categoryId?: string;
    billable?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResponse<TimeEntry>> {
    return this.request('GET', '/time/entries', { params: filters });
  }

  /**
   * Get a single time entry by ID
   */
  async getEntry(id: string): Promise<TimeEntry> {
    return this.request('GET', `/time/entries/${id}`);
  }

  /**
   * Create a new time entry
   */
  async createEntry(data: TimeEntryCreate): Promise<TimeEntry> {
    return this.request('POST', '/time/entries', { body: data });
  }

  /**
   * Update an existing time entry
   */
  async updateEntry(id: string, data: TimeEntryUpdate): Promise<TimeEntry> {
    return this.request('PATCH', `/time/entries/${id}`, { body: data });
  }

  /**
   * Delete a time entry
   */
  async deleteEntry(id: string): Promise<void> {
    return this.request('DELETE', `/time/entries/${id}`);
  }

  /**
   * Bulk create time entries
   */
  async bulkCreateEntries(entries: TimeEntryCreate[]): Promise<TimeEntry[]> {
    return this.request('POST', '/time/entries/bulk', { body: { entries } });
  }

  /**
   * Bulk delete time entries
   */
  async bulkDeleteEntries(ids: string[]): Promise<void> {
    return this.request('DELETE', '/time/entries/bulk', { body: { ids } });
  }

  // --------------------------------------------------------------------------
  // Timer
  // --------------------------------------------------------------------------

  /**
   * Get current timer state
   */
  async getTimerState(): Promise<TimerState | null> {
    return this.request('GET', '/time/timer');
  }

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
  }): Promise<TimerState> {
    return this.request('POST', '/time/timer/start', { body: data });
  }

  /**
   * Stop the current timer and create a time entry
   */
  async stopTimer(): Promise<TimeEntry> {
    return this.request('POST', '/time/timer/stop');
  }

  /**
   * Pause the current timer
   */
  async pauseTimer(): Promise<TimerState> {
    return this.request('POST', '/time/timer/pause');
  }

  /**
   * Resume a paused timer
   */
  async resumeTimer(): Promise<TimerState> {
    return this.request('POST', '/time/timer/resume');
  }

  /**
   * Update timer details (description, project, etc.)
   */
  async updateTimer(data: {
    projectId?: string;
    taskId?: string;
    categoryId?: string;
    description?: string;
    billable?: boolean;
    tags?: string[];
  }): Promise<TimerState> {
    return this.request('PATCH', '/time/timer', { body: data });
  }

  /**
   * Discard the current timer without saving
   */
  async discardTimer(): Promise<void> {
    return this.request('DELETE', '/time/timer');
  }

  // --------------------------------------------------------------------------
  // Projects
  // --------------------------------------------------------------------------

  /**
   * Get all projects
   */
  async getProjects(filters?: { active?: boolean; clientId?: string }): Promise<Project[]> {
    return this.request('GET', '/time/projects', { params: filters });
  }

  /**
   * Get a single project by ID
   */
  async getProject(id: string): Promise<Project> {
    return this.request('GET', `/time/projects/${id}`);
  }

  // --------------------------------------------------------------------------
  // Categories
  // --------------------------------------------------------------------------

  /**
   * Get all categories
   */
  async getCategories(filters?: { active?: boolean }): Promise<Category[]> {
    return this.request('GET', '/time/categories', { params: filters });
  }

  /**
   * Get a single category by ID
   */
  async getCategory(id: string): Promise<Category> {
    return this.request('GET', `/time/categories/${id}`);
  }

  /**
   * Create a new category
   */
  async createCategory(data: {
    name: string;
    color: string;
    description?: string;
    hourlyRate?: number;
    billable?: boolean;
  }): Promise<Category> {
    return this.request('POST', '/time/categories', { body: data });
  }

  /**
   * Update an existing category
   */
  async updateCategory(
    id: string,
    data: Partial<{
      name: string;
      color: string;
      description: string;
      hourlyRate: number;
      billable: boolean;
      isActive: boolean;
    }>
  ): Promise<Category> {
    return this.request('PATCH', `/time/categories/${id}`, { body: data });
  }

  /**
   * Delete a category
   */
  async deleteCategory(id: string): Promise<void> {
    return this.request('DELETE', `/time/categories/${id}`);
  }

  // --------------------------------------------------------------------------
  // Reports
  // --------------------------------------------------------------------------

  /**
   * Get time report for a date range
   */
  async getReport(filters: {
    startDate: string;
    endDate: string;
    projectId?: string;
    categoryId?: string;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<TimeReport> {
    return this.request('GET', '/time/reports', { params: filters });
  }

  /**
   * Get weekly summary
   */
  async getWeeklySummary(weekStart?: string): Promise<{
    totalHours: number;
    billableHours: number;
    earnings: number;
    dailyBreakdown: Array<{ date: string; hours: number; billable: number }>;
  }> {
    return this.request('GET', '/time/reports/weekly', {
      params: { weekStart },
    });
  }

  /**
   * Export time entries
   */
  async exportEntries(filters: {
    startDate: string;
    endDate: string;
    format: 'csv' | 'pdf' | 'xlsx';
    projectId?: string;
    categoryId?: string;
  }): Promise<Blob> {
    const token = await this.config.getAccessToken();

    const url = new URL(`${this.config.baseUrl}/time/export`);
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    return response.blob();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let clientInstance: TimeApiClient | null = null;

export function createTimeApiClient(config: ApiClientConfig): TimeApiClient {
  clientInstance = new TimeApiClient(config);
  return clientInstance;
}

export function getTimeApiClient(): TimeApiClient {
  if (!clientInstance) {
    throw new Error('Time API client not initialized. Call createTimeApiClient first.');
  }
  return clientInstance;
}

// ============================================================================
// React Query Keys
// ============================================================================

export const timeQueryKeys = {
  all: ['time'] as const,
  entries: () => [...timeQueryKeys.all, 'entries'] as const,
  entry: (id: string) => [...timeQueryKeys.entries(), id] as const,
  entriesFiltered: (filters: Record<string, unknown>) =>
    [...timeQueryKeys.entries(), filters] as const,
  timer: () => [...timeQueryKeys.all, 'timer'] as const,
  projects: () => [...timeQueryKeys.all, 'projects'] as const,
  project: (id: string) => [...timeQueryKeys.projects(), id] as const,
  categories: () => [...timeQueryKeys.all, 'categories'] as const,
  category: (id: string) => [...timeQueryKeys.categories(), id] as const,
  reports: () => [...timeQueryKeys.all, 'reports'] as const,
  report: (filters: Record<string, unknown>) => [...timeQueryKeys.reports(), filters] as const,
  weeklySummary: (weekStart?: string) => [...timeQueryKeys.reports(), 'weekly', weekStart] as const,
};
