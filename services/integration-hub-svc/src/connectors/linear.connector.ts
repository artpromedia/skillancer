// @ts-nocheck
import { BaseConnector, ConnectorConfig, ConnectionStatus } from './base.connector';

// Linear Connector
// Issue tracking integration for COO Tool Suite

export interface LinearConfig extends ConnectorConfig {
  apiKey: string;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
  description?: string;
}

export interface LinearCycle {
  id: string;
  number: number;
  name?: string;
  startsAt: string;
  endsAt: string;
  progress: number;
  completedIssueCountHistory: number[];
  issueCountHistory: number[];
  scopeHistory: number[];
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number;
  priorityLabel: string;
  state: { id: string; name: string; color: string; type: string };
  assignee?: { id: string; name: string; email: string };
  project?: { id: string; name: string };
  cycle?: { id: string; number: number };
  estimate?: number;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LinearProject {
  id: string;
  name: string;
  description?: string;
  state: string;
  progress: number;
  targetDate?: string;
  lead?: { id: string; name: string };
}

export class LinearConnector extends BaseConnector {
  private baseUrl = 'https://api.linear.app/graphql';
  private apiKey: string;

  constructor(config: LinearConfig) {
    super(config);
    this.apiKey = config.apiKey;
  }

  async connect(): Promise<ConnectionStatus> {
    try {
      await this.query('query { viewer { id name } }');
      this.connectionStatus = {
        connected: true,
        lastConnected: new Date(),
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
    this.apiKey = '';
    this.connectionStatus = { connected: false };
  }

  // Get all teams
  async getTeams(): Promise<LinearTeam[]> {
    const query = `
      query {
        teams {
          nodes {
            id
            name
            key
            description
          }
        }
      }
    `;
    const result = await this.query(query);
    return result.data.teams.nodes;
  }

  // Get cycles for a team
  async getCycles(teamId: string): Promise<LinearCycle[]> {
    const query = `
      query($teamId: String!) {
        team(id: $teamId) {
          cycles {
            nodes {
              id
              number
              name
              startsAt
              endsAt
              progress
            }
          }
        }
      }
    `;
    const result = await this.query(query, { teamId });
    return result.data.team?.cycles?.nodes || [];
  }

  // Get current active cycle
  async getCurrentCycle(teamId: string): Promise<LinearCycle | null> {
    const query = `
      query($teamId: String!) {
        team(id: $teamId) {
          activeCycle {
            id
            number
            name
            startsAt
            endsAt
            progress
          }
        }
      }
    `;
    const result = await this.query(query, { teamId });
    return result.data.team?.activeCycle || null;
  }

  // Get issues with filters
  async getIssues(filters?: {
    teamId?: string;
    cycleId?: string;
    assigneeId?: string;
    state?: string;
    first?: number;
  }): Promise<LinearIssue[]> {
    const query = `
      query($filter: IssueFilter, $first: Int) {
        issues(filter: $filter, first: $first) {
          nodes {
            id
            identifier
            title
            description
            priority
            priorityLabel
            state { id name color type }
            assignee { id name email }
            project { id name }
            cycle { id number }
            estimate
            dueDate
            createdAt
            updatedAt
          }
        }
      }
    `;

    const filter: Record<string, any> = {};
    if (filters?.teamId) filter.team = { id: { eq: filters.teamId } };
    if (filters?.cycleId) filter.cycle = { id: { eq: filters.cycleId } };
    if (filters?.assigneeId) filter.assignee = { id: { eq: filters.assigneeId } };

    const result = await this.query(query, { filter, first: filters?.first || 100 });
    return result.data.issues.nodes;
  }

  // Get projects for a team
  async getProjects(teamId: string): Promise<LinearProject[]> {
    const query = `
      query($teamId: String!) {
        team(id: $teamId) {
          projects {
            nodes {
              id
              name
              description
              state
              progress
              targetDate
              lead { id name }
            }
          }
        }
      }
    `;
    const result = await this.query(query, { teamId });
    return result.data.team?.projects?.nodes || [];
  }

  // Get cycle progress for widget
  async getCycleProgress(teamId: string): Promise<{
    cycle: { number: number; name?: string; endsAt: string } | null;
    progress: number;
    completed: number;
    total: number;
    velocity: number;
  }> {
    const cycle = await this.getCurrentCycle(teamId);
    if (!cycle) {
      return { cycle: null, progress: 0, completed: 0, total: 0, velocity: 0 };
    }

    const issues = await this.getIssues({ teamId, cycleId: cycle.id });
    const completed = issues.filter((i) => i.state.type === 'completed').length;
    const total = issues.length;

    // Simple velocity: issues completed per week
    const cycleStart = new Date(cycle.startsAt);
    const now = new Date();
    const weeksElapsed = Math.max(
      1,
      (now.getTime() - cycleStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    const velocity = Math.round(completed / weeksElapsed);

    return {
      cycle: { number: cycle.number, name: cycle.name, endsAt: cycle.endsAt },
      progress: Math.round(cycle.progress * 100),
      completed,
      total,
      velocity,
    };
  }

  // Get team issues summary for widget
  async getTeamIssuesSummary(teamId: string): Promise<{
    total: number;
    byState: Array<{ name: string; count: number; color: string }>;
    byPriority: Array<{ label: string; count: number }>;
    byAssignee: Array<{ name: string; count: number }>;
  }> {
    const issues = await this.getIssues({ teamId });

    const stateCounts: Record<string, { count: number; color: string }> = {};
    const priorityCounts: Record<string, number> = {};
    const assigneeCounts: Record<string, number> = {};

    for (const issue of issues) {
      // By state
      const stateName = issue.state.name;
      if (!stateCounts[stateName]) {
        stateCounts[stateName] = { count: 0, color: issue.state.color };
      }
      stateCounts[stateName].count++;

      // By priority
      const priorityLabel = issue.priorityLabel || 'No Priority';
      priorityCounts[priorityLabel] = (priorityCounts[priorityLabel] || 0) + 1;

      // By assignee
      const assigneeName = issue.assignee?.name || 'Unassigned';
      assigneeCounts[assigneeName] = (assigneeCounts[assigneeName] || 0) + 1;
    }

    return {
      total: issues.length,
      byState: Object.entries(stateCounts).map(([name, data]) => ({
        name,
        count: data.count,
        color: data.color,
      })),
      byPriority: Object.entries(priorityCounts).map(([label, count]) => ({
        label,
        count,
      })),
      byAssignee: Object.entries(assigneeCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  private async query(query: string, variables?: Record<string, any>): Promise<any> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Linear API error: ${response.status}`);
    }

    const result = await response.json();
    if (result.errors) {
      throw new Error(result.errors[0]?.message || 'GraphQL error');
    }

    return result;
  }
}

export const createLinearConnector = (config: LinearConfig) => new LinearConnector(config);
