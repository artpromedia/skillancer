/**
 * Projects API Client
 * Handles all project-related API calls for the cockpit
 */

// Types
export interface Project {
  id: string;
  name: string;
  description?: string;
  clientId: string;
  clientName?: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  type: 'fixed' | 'hourly' | 'retainer';
  source: 'skillancer' | 'upwork' | 'fiverr' | 'toptal' | 'freelancer' | 'direct';
  externalId?: string;
  externalUrl?: string;
  startDate?: string;
  endDate?: string;
  dueDate?: string;
  budget: {
    type: 'fixed' | 'hourly' | 'retainer';
    amount: number;
    currency: string;
    hourlyRate?: number;
    estimatedHours?: number;
  };
  progress: number; // 0-100
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
  duration: number; // in seconds
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
  status?: Project['status'];
  clientId?: string;
  source?: string;
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'dueDate' | 'status' | 'progress';
  sortOrder?: 'asc' | 'desc';
  tags?: string[];
  priority?: Project['priority'];
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
  status?: Project['status'];
  priority?: Project['priority'];
  type?: Project['type'];
  source?: Project['source'];
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

// API base URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

// Helper for API calls
async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(error.message || `API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// Projects API
export const projectsApi = {
  /**
   * List projects with filters and pagination
   */
  async list(params: ProjectListParams = {}): Promise<ProjectListResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.status) searchParams.set('status', params.status);
    if (params.clientId) searchParams.set('clientId', params.clientId);
    if (params.source) searchParams.set('source', params.source);
    if (params.search) searchParams.set('search', params.search);
    if (params.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
    if (params.priority) searchParams.set('priority', params.priority);
    if (params.tags?.length) searchParams.set('tags', params.tags.join(','));

    const query = searchParams.toString();
    const queryParam = query ? `?${query}` : '';
    return fetchApi<ProjectListResponse>(`/projects${queryParam}`);
  },

  /**
   * Get a single project by ID
   */
  async get(id: string): Promise<Project> {
    return fetchApi<Project>(`/projects/${id}`);
  },

  /**
   * Get project statistics
   */
  async getStats(id: string): Promise<ProjectStats> {
    return fetchApi<ProjectStats>(`/projects/${id}/stats`);
  },

  /**
   * Create a new project
   */
  async create(input: CreateProjectInput): Promise<Project> {
    return fetchApi<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Update an existing project
   */
  async update(input: UpdateProjectInput): Promise<Project> {
    const { id, ...data } = input;
    return fetchApi<Project>(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a project
   */
  async delete(id: string): Promise<void> {
    await fetchApi(`/projects/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Update project progress
   */
  async updateProgress(id: string, progress: number): Promise<Project> {
    return fetchApi<Project>(`/projects/${id}/progress`, {
      method: 'PATCH',
      body: JSON.stringify({ progress }),
    });
  },

  // Tasks
  tasks: {
    /**
     * List tasks for a project
     */
    async list(projectId: string): Promise<{ tasks: ProjectTask[] }> {
      return fetchApi(`/projects/${projectId}/tasks`);
    },

    /**
     * Create a task
     */
    async create(projectId: string, input: CreateTaskInput): Promise<ProjectTask> {
      return fetchApi<ProjectTask>(`/projects/${projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    /**
     * Update a task
     */
    async update(input: UpdateTaskInput): Promise<ProjectTask> {
      const { id, projectId, ...data } = input;
      return fetchApi<ProjectTask>(`/projects/${projectId}/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    /**
     * Delete a task
     */
    async delete(projectId: string, taskId: string): Promise<void> {
      await fetchApi(`/projects/${projectId}/tasks/${taskId}`, {
        method: 'DELETE',
      });
    },

    /**
     * Reorder tasks
     */
    async reorder(
      projectId: string,
      taskOrders: Array<{ id: string; order: number }>
    ): Promise<void> {
      await fetchApi(`/projects/${projectId}/tasks/reorder`, {
        method: 'POST',
        body: JSON.stringify({ taskOrders }),
      });
    },

    /**
     * Move task to different status
     */
    async move(
      projectId: string,
      taskId: string,
      status: ProjectTask['status'],
      order: number
    ): Promise<ProjectTask> {
      return fetchApi<ProjectTask>(`/projects/${projectId}/tasks/${taskId}/move`, {
        method: 'POST',
        body: JSON.stringify({ status, order }),
      });
    },
  },

  // Milestones
  milestones: {
    /**
     * List milestones for a project
     */
    async list(projectId: string): Promise<{ milestones: ProjectMilestone[] }> {
      return fetchApi(`/projects/${projectId}/milestones`);
    },

    /**
     * Create a milestone
     */
    async create(
      projectId: string,
      input: Omit<ProjectMilestone, 'id' | 'projectId' | 'status' | 'order'>
    ): Promise<ProjectMilestone> {
      return fetchApi<ProjectMilestone>(`/projects/${projectId}/milestones`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    /**
     * Update a milestone
     */
    async update(
      projectId: string,
      milestoneId: string,
      data: Partial<ProjectMilestone>
    ): Promise<ProjectMilestone> {
      return fetchApi<ProjectMilestone>(`/projects/${projectId}/milestones/${milestoneId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    /**
     * Submit milestone for approval
     */
    async submit(projectId: string, milestoneId: string): Promise<ProjectMilestone> {
      return fetchApi<ProjectMilestone>(`/projects/${projectId}/milestones/${milestoneId}/submit`, {
        method: 'POST',
      });
    },
  },

  // Time entries
  time: {
    /**
     * List time entries for a project
     */
    async list(
      projectId: string,
      params: { startDate?: string; endDate?: string } = {}
    ): Promise<{ entries: ProjectTimeEntry[]; totalDuration: number }> {
      const searchParams = new URLSearchParams();
      if (params.startDate) searchParams.set('startDate', params.startDate);
      if (params.endDate) searchParams.set('endDate', params.endDate);
      const query = searchParams.toString();
      const queryParam = query ? `?${query}` : '';
      return fetchApi(`/projects/${projectId}/time${queryParam}`);
    },

    /**
     * Add time entry
     */
    async add(
      projectId: string,
      entry: Omit<ProjectTimeEntry, 'id' | 'projectId'>
    ): Promise<ProjectTimeEntry> {
      return fetchApi<ProjectTimeEntry>(`/projects/${projectId}/time`, {
        method: 'POST',
        body: JSON.stringify(entry),
      });
    },
  },

  // Budget
  budget: {
    /**
     * Get budget breakdown
     */
    async get(projectId: string): Promise<{
      total: number;
      spent: number;
      categories: Array<{
        name: string;
        allocated: number;
        spent: number;
      }>;
      expenses: Array<{
        id: string;
        description: string;
        amount: number;
        date: string;
        category: string;
      }>;
    }> {
      return fetchApi(`/projects/${projectId}/budget`);
    },

    /**
     * Add expense
     */
    async addExpense(
      projectId: string,
      expense: {
        description: string;
        amount: number;
        category: string;
        date: string;
      }
    ): Promise<{ id: string }> {
      return fetchApi(`/projects/${projectId}/budget/expenses`, {
        method: 'POST',
        body: JSON.stringify(expense),
      });
    },
  },

  /**
   * Import projects from external platform
   */
  async import(
    source: string,
    options: { syncAll?: boolean; projectIds?: string[] } = {}
  ): Promise<{ imported: number; updated: number; errors: string[] }> {
    return fetchApi(`/projects/import/${source}`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  },

  /**
   * Get all tags used across projects
   */
  async getTags(): Promise<{ tags: string[]; counts: Record<string, number> }> {
    return fetchApi('/projects/tags');
  },

  /**
   * Duplicate a project
   */
  async duplicate(id: string, options: { includeTask?: boolean } = {}): Promise<Project> {
    return fetchApi<Project>(`/projects/${id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  },

  /**
   * Archive a project
   */
  async archive(id: string): Promise<Project> {
    return fetchApi<Project>(`/projects/${id}/archive`, {
      method: 'POST',
    });
  },
};

export default projectsApi;
