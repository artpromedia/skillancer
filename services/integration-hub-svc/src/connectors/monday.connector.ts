// @ts-nocheck
import { BaseConnector, ConnectorConfig, ConnectionStatus } from './base.connector';

// Monday.com Connector
// Project management integration for COO Tool Suite

export interface MondayConfig extends ConnectorConfig {
  apiToken: string;
}

export interface MondayBoard {
  id: string;
  name: string;
  state: 'active' | 'archived' | 'deleted';
  board_kind: 'public' | 'private' | 'share';
  items_count: number;
  columns: MondayColumn[];
  groups: MondayGroup[];
}

export interface MondayColumn {
  id: string;
  title: string;
  type: string;
}

export interface MondayGroup {
  id: string;
  title: string;
  color: string;
}

export interface MondayItem {
  id: string;
  name: string;
  state: 'active' | 'archived' | 'deleted';
  group: { id: string; title: string };
  column_values: Array<{
    id: string;
    title: string;
    value: string | null;
    text: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface MondayUser {
  id: string;
  name: string;
  email: string;
  photo_thumb: string;
}

export class MondayConnector extends BaseConnector {
  private baseUrl = 'https://api.monday.com/v2';
  private apiToken: string;

  constructor(config: MondayConfig) {
    super(config);
    this.apiToken = config.apiToken;
  }

  async connect(): Promise<ConnectionStatus> {
    try {
      await this.query('query { me { id name } }');
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
    this.apiToken = '';
    this.connectionStatus = { connected: false };
  }

  // Get all boards
  async getBoards(): Promise<MondayBoard[]> {
    const query = `
      query {
        boards(limit: 50) {
          id
          name
          state
          board_kind
          items_count
          columns { id title type }
          groups { id title color }
        }
      }
    `;
    const result = await this.query(query);
    return result.data.boards;
  }

  // Get board items
  async getBoardItems(boardId: string, limit = 100): Promise<MondayItem[]> {
    const query = `
      query($boardId: ID!, $limit: Int!) {
        boards(ids: [$boardId]) {
          items_page(limit: $limit) {
            items {
              id
              name
              state
              group { id title }
              column_values { id title value text }
              created_at
              updated_at
            }
          }
        }
      }
    `;
    const result = await this.query(query, { boardId, limit });
    return result.data.boards[0]?.items_page?.items || [];
  }

  // Get workspaces
  async getWorkspaces(): Promise<Array<{ id: string; name: string }>> {
    const query = `
      query {
        workspaces {
          id
          name
        }
      }
    `;
    const result = await this.query(query);
    return result.data.workspaces;
  }

  // Get users
  async getUsers(): Promise<MondayUser[]> {
    const query = `
      query {
        users {
          id
          name
          email
          photo_thumb
        }
      }
    `;
    const result = await this.query(query);
    return result.data.users;
  }

  // Get board status summary for widget
  async getBoardStatus(boardId: string): Promise<{
    total: number;
    byGroup: Array<{ name: string; count: number; color: string }>;
    updatedThisWeek: number;
  }> {
    const items = await this.getBoardItems(boardId);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const groupCounts: Record<string, { count: number; color: string }> = {};
    let updatedThisWeek = 0;

    for (const item of items) {
      if (item.state === 'active') {
        const groupTitle = item.group.title;
        if (!groupCounts[groupTitle]) {
          groupCounts[groupTitle] = { count: 0, color: '#666' };
        }
        groupCounts[groupTitle].count++;

        if (new Date(item.updated_at) >= oneWeekAgo) {
          updatedThisWeek++;
        }
      }
    }

    return {
      total: items.filter((i) => i.state === 'active').length,
      byGroup: Object.entries(groupCounts).map(([name, data]) => ({
        name,
        count: data.count,
        color: data.color,
      })),
      updatedThisWeek,
    };
  }

  private async query(query: string, variables?: Record<string, any>): Promise<any> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: this.apiToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Monday API error: ${response.status}`);
    }

    const result = await response.json();
    if (result.errors) {
      throw new Error(result.errors[0]?.message || 'GraphQL error');
    }

    return result;
  }
}

export const createMondayConnector = (config: MondayConfig) => new MondayConnector(config);
