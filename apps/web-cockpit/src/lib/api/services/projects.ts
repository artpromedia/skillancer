/**
 * Projects Service
 *
 * Type-safe API methods for project operations using the shared API client.
 */

import {
  type ApiResponse,
  type PaginatedResponse,
  COCKPIT_ENDPOINTS,
} from '@skillancer/shared-api-client';

import { getApiClient } from '../api-client';

// =============================================================================
// Types
// =============================================================================

export type ProjectStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ProjectType = 'fixed' | 'hourly' | 'retainer';
export type ProjectSource = 'skillancer' | 'upwork' | 'fiverr' | 'toptal' | 'freelancer' | 'direct';

export interface Project {
  id: string;
  name: string;
  description?: string;
  clientId: string;
  clientName?: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  type: ProjectType;
  source: ProjectSource;
  externalId?: string;
  externalUrl?: string;
  startDate?: string;
  endDate?: string;
  dueDate?: string;
  budget: {
    type: ProjectType;
    amount: number;
    currency: string;
    hourlyRate?: number;
    estimatedHours?: number;
  };
  progress: number;
  tags: string[];
  teamMembers?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  assignee?: string;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  amount: number;
  dueDate?: string;
  status: 'pending' | 'in_progress' | 'submitted' | 'approved' | 'paid';
  submittedAt?: string;
  approvedAt?: string;
  paidAt?: string;
  order: number;
}

export interface ProjectTimeEntry {
  id: string;
  projectId: string;
  taskId?: string;
  description?: string;
  startTime: string;
  endTime?: string;
  duration: number;
  billable: boolean;
  invoiced: boolean;
}

export interface ProjectStats {
  totalBudget: number;
  spent: number;
  remaining: number;
  hoursLogged: number;
  hoursEstimated: number;
  tasksTotal: number;
  tasksCompleted: number;
  milestonesTotal: number;
  milestonesPaid: number;
}

export interface ProjectListParams {
  page?: number;
  limit?: number;
  status?: ProjectStatus;
  clientId?: string;
  source?: string;
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'dueDate' | 'status' | 'progress';
  sortOrder?: 'asc' | 'desc';
  tags?: string[];
  priority?: ProjectPriority;
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  clientId: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  type?: ProjectType;
  source?: ProjectSource;
  startDate?: string;
  endDate?: string;
  dueDate?: string;
  budget: Project['budget'];
  tags?: string[];
}

export interface UpdateProjectInput extends Partial<CreateProjectInput> {
  id: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: ProjectTask['status'];
  priority?: ProjectTask['priority'];
  assignee?: string;
  dueDate?: string;
  estimatedHours?: number;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  id: string;
  projectId: string;
}

// =============================================================================
// Projects API Service
// =============================================================================

export const projectsService = {
  /**
   * List projects with filters
   */
  async list(params: ProjectListParams = {}): Promise<PaginatedResponse<Project>> {
    const client = getApiClient();
    const { page = 1, limit = 20, tags, ...rest } = params;

    const queryParams: Record<string, string | number | boolean | undefined> = {
      page,
      limit,
      ...rest,
    };

    if (tags?.length) {
      queryParams.tags = tags.join(',');
    }

    return client.get<Project[]>('/projects', {
      params: queryParams,
    }) as Promise<PaginatedResponse<Project>>;
  },

  /**
   * Get a single project by ID
   */
  async getById(id: string): Promise<ApiResponse<Project>> {
    const client = getApiClient();
    return client.get<Project>(`/projects/${id}`);
  },

  /**
   * Create a new project
   */
  async create(data: CreateProjectInput): Promise<ApiResponse<Project>> {
    const client = getApiClient();
    return client.post<Project, CreateProjectInput>('/projects', data);
  },

  /**
   * Update a project
   */
  async update(id: string, data: Partial<CreateProjectInput>): Promise<ApiResponse<Project>> {
    const client = getApiClient();
    return client.patch<Project>(`/projects/${id}`, data);
  },

  /**
   * Delete a project
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`/projects/${id}`);
  },

  /**
   * Get project statistics
   */
  async getStats(id: string): Promise<ApiResponse<ProjectStats>> {
    const client = getApiClient();
    return client.get<ProjectStats>(`/projects/${id}/stats`);
  },

  /**
   * Archive a project
   */
  async archive(id: string): Promise<ApiResponse<Project>> {
    const client = getApiClient();
    return client.post<Project>(`/projects/${id}/archive`);
  },

  /**
   * Unarchive a project
   */
  async unarchive(id: string): Promise<ApiResponse<Project>> {
    const client = getApiClient();
    return client.post<Project>(`/projects/${id}/unarchive`);
  },

  // =============================================================================
  // Tasks
  // =============================================================================

  /**
   * Get tasks for a project
   */
  async getTasks(projectId: string): Promise<ApiResponse<ProjectTask[]>> {
    const client = getApiClient();
    return client.get<ProjectTask[]>(`/projects/${projectId}/tasks`);
  },

  /**
   * Create a task
   */
  async createTask(projectId: string, data: CreateTaskInput): Promise<ApiResponse<ProjectTask>> {
    const client = getApiClient();
    return client.post<ProjectTask, CreateTaskInput>(`/projects/${projectId}/tasks`, data);
  },

  /**
   * Update a task
   */
  async updateTask(
    projectId: string,
    taskId: string,
    data: Partial<CreateTaskInput>
  ): Promise<ApiResponse<ProjectTask>> {
    const client = getApiClient();
    return client.patch<ProjectTask>(`/projects/${projectId}/tasks/${taskId}`, data);
  },

  /**
   * Delete a task
   */
  async deleteTask(projectId: string, taskId: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`/projects/${projectId}/tasks/${taskId}`);
  },

  /**
   * Reorder tasks
   */
  async reorderTasks(projectId: string, taskIds: string[]): Promise<ApiResponse<ProjectTask[]>> {
    const client = getApiClient();
    return client.post<ProjectTask[], { taskIds: string[] }>(
      `/projects/${projectId}/tasks/reorder`,
      { taskIds }
    );
  },

  // =============================================================================
  // Milestones
  // =============================================================================

  /**
   * Get milestones for a project
   */
  async getMilestones(projectId: string): Promise<ApiResponse<ProjectMilestone[]>> {
    const client = getApiClient();
    return client.get<ProjectMilestone[]>(`/projects/${projectId}/milestones`);
  },

  /**
   * Create a milestone
   */
  async createMilestone(
    projectId: string,
    data: Omit<ProjectMilestone, 'id' | 'projectId' | 'submittedAt' | 'approvedAt' | 'paidAt'>
  ): Promise<ApiResponse<ProjectMilestone>> {
    const client = getApiClient();
    return client.post<ProjectMilestone>(`/projects/${projectId}/milestones`, data);
  },

  /**
   * Update a milestone
   */
  async updateMilestone(
    projectId: string,
    milestoneId: string,
    data: Partial<ProjectMilestone>
  ): Promise<ApiResponse<ProjectMilestone>> {
    const client = getApiClient();
    return client.patch<ProjectMilestone>(`/projects/${projectId}/milestones/${milestoneId}`, data);
  },

  /**
   * Delete a milestone
   */
  async deleteMilestone(projectId: string, milestoneId: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`/projects/${projectId}/milestones/${milestoneId}`);
  },

  /**
   * Submit a milestone for approval
   */
  async submitMilestone(
    projectId: string,
    milestoneId: string
  ): Promise<ApiResponse<ProjectMilestone>> {
    const client = getApiClient();
    return client.post<ProjectMilestone>(`/projects/${projectId}/milestones/${milestoneId}/submit`);
  },

  // =============================================================================
  // Time Entries
  // =============================================================================

  /**
   * Get time entries for a project
   */
  async getTimeEntries(
    projectId: string,
    params?: { startDate?: string; endDate?: string }
  ): Promise<ApiResponse<ProjectTimeEntry[]>> {
    const client = getApiClient();
    return client.get<ProjectTimeEntry[]>(`/projects/${projectId}/time-entries`, { params });
  },
};

export default projectsService;
