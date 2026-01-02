// @ts-nocheck
import { BaseConnector, ConnectorConfig, ConnectionStatus } from './base.connector';

// Asana Connector
// Project management integration for COO Tool Suite

export interface AsanaConfig extends ConnectorConfig {
  accessToken: string;
  refreshToken?: string;
  workspaceId?: string;
}

export interface AsanaProject {
  gid: string;
  name: string;
  owner: { gid: string; name: string } | null;
  currentStatus: {
    color: 'green' | 'yellow' | 'red' | null;
    text: string | null;
  } | null;
  dueDate: string | null;
  completed: boolean;
  completedAt: string | null;
  members: Array<{ gid: string; name: string }>;
  numTasks: number;
  numCompletedTasks: number;
}

export interface AsanaTask {
  gid: string;
  name: string;
  completed: boolean;
  completedAt: string | null;
  dueOn: string | null;
  dueAt: string | null;
  assignee: { gid: string; name: string } | null;
  projects: Array<{ gid: string; name: string }>;
  tags: Array<{ gid: string; name: string }>;
  numSubtasks: number;
}

export interface AsanaUser {
  gid: string;
  name: string;
  email: string;
  photo: { image_128x128: string } | null;
}

export interface AsanaTeam {
  gid: string;
  name: string;
  description: string;
}

export interface AsanaGoal {
  gid: string;
  name: string;
  owner: { gid: string; name: string } | null;
  dueOn: string | null;
  status: string;
  currentStatusUpdate: { text: string } | null;
}

export class AsanaConnector extends BaseConnector {
  private baseUrl = 'https://app.asana.com/api/1.0';
  private accessToken: string;
  private workspaceId?: string;

  constructor(config: AsanaConfig) {
    super(config);
    this.accessToken = config.accessToken;
    this.workspaceId = config.workspaceId;
  }

  async connect(): Promise<ConnectionStatus> {
    try {
      const response = await this.request('/users/me');
      this.connectionStatus = {
        connected: true,
        lastConnected: new Date(),
        error: undefined,
      };
      return this.connectionStatus;
    } catch (error) {
      this.connectionStatus = {
        connected: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
      return this.connectionStatus;
    }
  }

  async disconnect(): Promise<void> {
    this.accessToken = '';
    this.connectionStatus = { connected: false };
  }

  // Get all workspaces the user has access to
  async getWorkspaces(): Promise<Array<{ gid: string; name: string }>> {
    const response = await this.request('/workspaces');
    return response.data;
  }

  // Get projects in a workspace
  async getProjects(
    workspaceId?: string,
    options?: { archived?: boolean; team?: string }
  ): Promise<AsanaProject[]> {
    const wsId = workspaceId || this.workspaceId;
    if (!wsId) throw new Error('Workspace ID required');

    const params = new URLSearchParams({
      workspace: wsId,
      opt_fields:
        'name,owner,current_status,due_date,completed,completed_at,members,num_tasks,num_completed_tasks',
    });

    if (options?.archived !== undefined) {
      params.set('archived', String(options.archived));
    }
    if (options?.team) {
      params.set('team', options.team);
    }

    const response = await this.request(`/projects?${params}`);
    return response.data;
  }

  // Get tasks with filters
  async getTasks(
    projectId: string,
    filters?: {
      completed?: boolean;
      assignee?: string;
      modifiedSince?: Date;
    }
  ): Promise<AsanaTask[]> {
    const params = new URLSearchParams({
      project: projectId,
      opt_fields: 'name,completed,completed_at,due_on,due_at,assignee,projects,tags,num_subtasks',
    });

    if (filters?.completed !== undefined) {
      params.set('completed_since', filters.completed ? 'now' : '');
    }
    if (filters?.assignee) {
      params.set('assignee', filters.assignee);
    }
    if (filters?.modifiedSince) {
      params.set('modified_since', filters.modifiedSince.toISOString());
    }

    const response = await this.request(`/tasks?${params}`);
    return response.data;
  }

  // Get tasks for a user
  async getUserTasks(userId: string, workspaceId?: string): Promise<AsanaTask[]> {
    const wsId = workspaceId || this.workspaceId;
    if (!wsId) throw new Error('Workspace ID required');

    const params = new URLSearchParams({
      assignee: userId,
      workspace: wsId,
      opt_fields: 'name,completed,completed_at,due_on,due_at,projects,tags',
    });

    const response = await this.request(`/tasks?${params}`);
    return response.data;
  }

  // Get teams in a workspace
  async getTeams(workspaceId?: string): Promise<AsanaTeam[]> {
    const wsId = workspaceId || this.workspaceId;
    if (!wsId) throw new Error('Workspace ID required');

    const response = await this.request(`/workspaces/${wsId}/teams`);
    return response.data;
  }

  // Get users in a workspace
  async getUsers(workspaceId?: string): Promise<AsanaUser[]> {
    const wsId = workspaceId || this.workspaceId;
    if (!wsId) throw new Error('Workspace ID required');

    const params = new URLSearchParams({
      opt_fields: 'name,email,photo',
    });

    const response = await this.request(`/workspaces/${wsId}/users?${params}`);
    return response.data;
  }

  // Get goals in a workspace
  async getGoals(workspaceId?: string): Promise<AsanaGoal[]> {
    const wsId = workspaceId || this.workspaceId;
    if (!wsId) throw new Error('Workspace ID required');

    const params = new URLSearchParams({
      workspace: wsId,
      opt_fields: 'name,owner,due_on,status,current_status_update',
    });

    const response = await this.request(`/goals?${params}`);
    return response.data;
  }

  // Get project overview for widget
  async getProjectOverview(workspaceId?: string): Promise<{
    total: number;
    byStatus: { onTrack: number; atRisk: number; offTrack: number; noStatus: number };
    upcomingDeadlines: Array<{ name: string; dueDate: string }>;
  }> {
    const projects = await this.getProjects(workspaceId, { archived: false });

    const byStatus = { onTrack: 0, atRisk: 0, offTrack: 0, noStatus: 0 };
    const upcomingDeadlines: Array<{ name: string; dueDate: string }> = [];

    const now = new Date();
    const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    for (const project of projects) {
      if (!project.completed) {
        const color = project.currentStatus?.color;
        if (color === 'green') byStatus.onTrack++;
        else if (color === 'yellow') byStatus.atRisk++;
        else if (color === 'red') byStatus.offTrack++;
        else byStatus.noStatus++;

        if (project.dueDate) {
          const dueDate = new Date(project.dueDate);
          if (dueDate <= twoWeeksFromNow && dueDate >= now) {
            upcomingDeadlines.push({ name: project.name, dueDate: project.dueDate });
          }
        }
      }
    }

    upcomingDeadlines.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    return {
      total: projects.filter((p) => !p.completed).length,
      byStatus,
      upcomingDeadlines: upcomingDeadlines.slice(0, 5),
    };
  }

  // Get task summary for widget
  async getTaskSummary(projectId: string): Promise<{
    total: number;
    completed: number;
    overdue: number;
    completionRate: number;
    byAssignee: Array<{ name: string; count: number }>;
  }> {
    const tasks = await this.getTasks(projectId);
    const now = new Date();

    let completed = 0;
    let overdue = 0;
    const assigneeCounts: Record<string, number> = {};

    for (const task of tasks) {
      if (task.completed) {
        completed++;
      } else {
        if (task.dueOn && new Date(task.dueOn) < now) {
          overdue++;
        }
      }

      const assigneeName = task.assignee?.name || 'Unassigned';
      assigneeCounts[assigneeName] = (assigneeCounts[assigneeName] || 0) + 1;
    }

    const byAssignee = Object.entries(assigneeCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      total: tasks.length,
      completed,
      overdue,
      completionRate: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
      byAssignee,
    };
  }

  // Get team workload for widget
  async getTeamWorkload(workspaceId?: string): Promise<
    Array<{
      user: { gid: string; name: string };
      taskCount: number;
      overdueTasks: number;
      dueSoon: number;
    }>
  > {
    const users = await this.getUsers(workspaceId);
    const workload: Array<{
      user: { gid: string; name: string };
      taskCount: number;
      overdueTasks: number;
      dueSoon: number;
    }> = [];

    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    for (const user of users.slice(0, 20)) {
      // Limit to avoid rate limits
      try {
        const tasks = await this.getUserTasks(user.gid, workspaceId);
        const incompleteTasks = tasks.filter((t) => !t.completed);

        let overdueTasks = 0;
        let dueSoon = 0;

        for (const task of incompleteTasks) {
          if (task.dueOn) {
            const dueDate = new Date(task.dueOn);
            if (dueDate < now) overdueTasks++;
            else if (dueDate <= oneWeekFromNow) dueSoon++;
          }
        }

        workload.push({
          user: { gid: user.gid, name: user.name },
          taskCount: incompleteTasks.length,
          overdueTasks,
          dueSoon,
        });
      } catch {
        // Skip users we can't fetch tasks for
      }
    }

    return workload.sort((a, b) => b.taskCount - a.taskCount);
  }

  private async request(endpoint: string, options?: RequestInit): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.errors?.[0]?.message || `Asana API error: ${response.status}`);
    }

    return response.json();
  }
}

export const createAsanaConnector = (config: AsanaConfig) => new AsanaConnector(config);

