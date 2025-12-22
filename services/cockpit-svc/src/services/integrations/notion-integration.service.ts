/**
 * @module @skillancer/cockpit-svc/services/integrations/notion
 * Notion Integration Service - Sync databases, pages, and tasks from Notion
 */

/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import crypto from 'node:crypto';

import { BaseIntegrationService } from './base-integration.service.js';

import type {
  OAuthConfig,
  OAuthTokens,
  ApiKeyConfig,
  SyncOptions,
  SyncResult,
  AccountInfo,
  WebhookPayload,
} from '../../types/integration.types.js';
import type { EncryptionService } from '../encryption.service.js';
import type { Integration, IntegrationProvider, PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

// ============================================================================
// NOTION-SPECIFIC TYPES
// ============================================================================

export interface NotionDatabase {
  id: string;
  title: Array<{ plain_text: string }>;
  description?: Array<{ plain_text: string }>;
  icon?: { type: string; emoji?: string };
  created_time: string;
  last_edited_time: string;
  properties: Record<string, NotionProperty>;
}

export interface NotionProperty {
  id: string;
  name: string;
  type: string;
}

export interface NotionPage {
  id: string;
  created_time: string;
  last_edited_time: string;
  archived: boolean;
  icon?: { type: string; emoji?: string };
  parent: {
    type: string;
    database_id?: string;
    page_id?: string;
    workspace?: boolean;
  };
  properties: Record<string, NotionPropertyValue>;
}

export interface NotionPropertyValue {
  id: string;
  type: string;
  title?: Array<{ plain_text: string }>;
  rich_text?: Array<{ plain_text: string }>;
  number?: number;
  select?: { name: string };
  multi_select?: Array<{ name: string }>;
  date?: { start: string; end?: string };
  checkbox?: boolean;
  url?: string;
  email?: string;
  phone_number?: string;
  status?: { name: string };
}

export interface NotionTask {
  id: string;
  title: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  assignee?: string;
  project?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotionSyncOptions {
  syncDatabases?: boolean;
  syncPages?: boolean;
  syncTasks?: boolean;
  databaseIds?: string[];
  autoCreateProjects?: boolean;
}

type _ProjectStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED';

// ============================================================================
// NOTION INTEGRATION SERVICE
// ============================================================================

export class NotionIntegrationService extends BaseIntegrationService {
  private readonly BASE_URL = 'https://api.notion.com/v1';
  private readonly OAUTH_URL = 'https://api.notion.com/v1/oauth/authorize';
  private readonly TOKEN_URL = 'https://api.notion.com/v1/oauth/token';
  private readonly API_VERSION = '2022-06-28';

  constructor(prisma: PrismaClient, logger: Logger, encryption: EncryptionService) {
    super(prisma, logger, encryption);
  }

  // =====================
  // Provider Identity
  // =====================

  get provider(): IntegrationProvider {
    return 'NOTION';
  }

  get displayName(): string {
    return 'Notion';
  }

  // =====================
  // Configuration
  // =====================

  getOAuthConfig(): OAuthConfig | null {
    const clientId = process.env['NOTION_CLIENT_ID'];
    const clientSecret = process.env['NOTION_CLIENT_SECRET'];

    if (!clientId || !clientSecret) {
      return null;
    }

    return {
      authorizationUrl: this.OAUTH_URL,
      tokenUrl: this.TOKEN_URL,
      clientId,
      clientSecret,
      scopes: [], // Notion uses workspace-level permissions, no specific scopes
    };
  }

  getApiKeyConfig(): ApiKeyConfig | null {
    // Notion supports internal integration tokens
    return {
      headerName: 'Authorization',
      prefix: 'Bearer ',
      additionalFields: [
        {
          name: 'workspaceId',
          label: 'Workspace ID',
          type: 'text',
          required: false,
        },
      ],
    };
  }

  getRateLimitConfig() {
    return {
      maxRequests: 3, // Notion has a 3 requests per second limit
      windowMs: 1000,
    };
  }

  getSupportedSyncTypes(): string[] {
    return ['PROJECT', 'TASK', 'DOCUMENT'];
  }

  getSupportedWebhookEvents(): string[] {
    // Notion doesn't have webhooks yet, but we can poll for changes
    return [];
  }

  // =====================
  // OAuth Methods
  // =====================

  getOAuthUrl(userId: string, state: string, redirectUri: string): string {
    const config = this.getOAuthConfig();
    if (!config) {
      throw new Error('Notion OAuth not configured');
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      state,
      owner: 'user', // Get access to user's personal workspace
    });

    return `${this.OAUTH_URL}?${params.toString()}`;
  }

  async exchangeAuthCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();
    if (!config) {
      throw new Error('Notion OAuth not configured');
    }

    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

    const response = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error({ error, status: response.status }, 'Notion token exchange failed');
      throw new Error('Failed to exchange Notion authorization code');
    }

    const data = (await response.json()) as {
      access_token: string;
      token_type: string;
      bot_id: string;
      workspace_id: string;
      workspace_name?: string;
      workspace_icon?: string;
      owner?: {
        type: string;
        user?: {
          id: string;
          name?: string;
          avatar_url?: string;
        };
      };
    };

    // Notion tokens don't expire (until revoked)
    return {
      accessToken: data.access_token,
      tokenType: data.token_type,
      // Store workspace info in scope field for later use
      scope: JSON.stringify({
        workspace_id: data.workspace_id,
        workspace_name: data.workspace_name,
        bot_id: data.bot_id,
      }),
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async refreshAccessToken(_refreshToken: string): Promise<OAuthTokens> {
    // Notion tokens don't expire and don't need refresh
    throw new Error('Notion tokens do not require refresh');
  }

  async revokeAccess(_accessToken: string): Promise<void> {
    // Notion doesn't have a revoke endpoint
    // Users need to disconnect from Notion's integration settings
    this.logger.info('Notion access revocation must be done from Notion settings');
    await Promise.resolve();
  }

  // =====================
  // API Key Methods
  // =====================

  async validateApiKey(apiKey: string, _apiSecret?: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.BASE_URL}/users/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Notion-Version': this.API_VERSION,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  // =====================
  // Account Methods
  // =====================

  async getAccountInfo(integration: Integration): Promise<AccountInfo> {
    const response = await this.makeRequest<{
      object: string;
      id: string;
      name?: string;
      avatar_url?: string;
      type: string;
      person?: { email: string };
      bot?: {
        owner: {
          type: string;
          workspace?: boolean;
          user?: { id: string; name?: string };
        };
        workspace_name?: string;
      };
    }>(integration, 'GET', `${this.BASE_URL}/users/me`);

    const user = response.data;

    // Parse workspace info from stored scope
    let workspaceInfo: { workspace_id?: string; workspace_name?: string } = {};
    try {
      if (integration.scope) {
        workspaceInfo = JSON.parse(integration.scope) as typeof workspaceInfo;
      }
    } catch {
      // Ignore parse errors
    }

    return {
      id: user.id,
      email: user.person?.email,
      name: user.name ?? user.bot?.workspace_name ?? 'Notion User',
      avatar: user.avatar_url,
      metadata: {
        type: user.type,
        workspace_id: workspaceInfo.workspace_id,
        workspace_name: workspaceInfo.workspace_name,
      },
    };
  }

  // =====================
  // Sync Methods
  // =====================

  async sync(integration: Integration, options: SyncOptions): Promise<SyncResult> {
    const context = await this.createSyncContext(integration, options);
    const syncOptions = (integration.syncOptions as NotionSyncOptions) ?? {};

    try {
      // Sync databases as projects
      if (!options.entityTypes || options.entityTypes.includes('PROJECT')) {
        if (syncOptions.syncDatabases !== false) {
          await this.syncDatabases(integration, context, syncOptions);
        }
      }

      // Sync pages as tasks or documents
      if (!options.entityTypes || options.entityTypes.includes('TASK')) {
        if (syncOptions.syncTasks !== false) {
          await this.syncTasks(integration, context, options, syncOptions);
        }
      }

      return await this.completeSyncContext(context, true);
    } catch (error) {
      context.errors.push({ message: (error as Error).message, entity: 'sync' });
      return await this.completeSyncContext(context, false);
    }
  }

  private async syncDatabases(
    integration: Integration,
    context: {
      recordsProcessed: number;
      recordsCreated: number;
      recordsUpdated: number;
      recordsFailed: number;
      errors: Array<{ message: string; entity?: string }>;
    },
    syncOptions: NotionSyncOptions
  ): Promise<void> {
    try {
      const databases = await this.fetchDatabases(integration, syncOptions.databaseIds);

      for (const database of databases) {
        context.recordsProcessed++;

        try {
          const existingMapping = await this.mappingRepo.findByExternalId(
            integration.id,
            'PROJECT',
            database.id
          );

          const title = database.title.map((t) => t.plain_text).join('') || 'Untitled Database';
          const description = database.description?.map((d) => d.plain_text).join('');

          if (existingMapping) {
            await this.updateProjectFromDatabase(existingMapping.internalId, {
              title,
              description,
              lastEditedTime: database.last_edited_time,
            });

            await this.mappingRepo.updateLastSync(existingMapping.id);
            context.recordsUpdated++;
          } else {
            const project = await this.createProjectFromDatabase(integration.userId, {
              id: database.id,
              title,
              description,
              icon: database.icon?.emoji,
              createdTime: database.created_time,
            });

            await this.upsertMapping(
              integration,
              'PROJECT',
              database.id,
              project.id,
              'CockpitProject',
              {
                externalName: title,
                externalData: database as unknown as Record<string, unknown>,
              }
            );

            context.recordsCreated++;
          }
        } catch (error) {
          context.recordsFailed++;
          context.errors.push({
            message: (error as Error).message,
            entity: `database:${database.id}`,
          });
        }
      }
    } catch (error) {
      context.errors.push({ message: (error as Error).message, entity: 'databases' });
    }
  }

  private async syncTasks(
    integration: Integration,
    context: {
      recordsProcessed: number;
      recordsCreated: number;
      recordsUpdated: number;
      recordsFailed: number;
      errors: Array<{ message: string; entity?: string }>;
    },
    options: SyncOptions,
    _syncOptions: NotionSyncOptions
  ): Promise<void> {
    try {
      // Get all synced project mappings to find their database IDs
      const projectMappings = await this.prisma.integrationMapping.findMany({
        where: {
          integrationId: integration.id,
          entityType: 'PROJECT',
        },
      });

      for (const mapping of projectMappings) {
        try {
          const pages = await this.fetchDatabasePages(
            integration,
            mapping.externalId,
            options.since
          );

          for (const page of pages) {
            context.recordsProcessed++;

            try {
              const existingTaskMapping = await this.mappingRepo.findByExternalId(
                integration.id,
                'TASK',
                page.id
              );

              const task = this.parsePageAsTask(page);

              if (existingTaskMapping) {
                await this.updateTaskFromNotion(existingTaskMapping.internalId, task);
                await this.mappingRepo.updateLastSync(existingTaskMapping.id);
                context.recordsUpdated++;
              } else {
                const createdTask = await this.createTaskFromNotion(
                  integration.userId,
                  task,
                  mapping.internalId
                );

                await this.upsertMapping(
                  integration,
                  'TASK',
                  page.id,
                  createdTask.id,
                  'ProjectTask',
                  {
                    externalName: task.title,
                    externalData: page as unknown as Record<string, unknown>,
                  }
                );

                context.recordsCreated++;
              }
            } catch (error) {
              context.recordsFailed++;
              context.errors.push({
                message: (error as Error).message,
                entity: `page:${page.id}`,
              });
            }
          }
        } catch (error) {
          context.errors.push({
            message: (error as Error).message,
            entity: `database:${mapping.externalId}`,
          });
        }
      }
    } catch (error) {
      context.errors.push({ message: (error as Error).message, entity: 'tasks' });
    }
  }

  // =====================
  // API Fetch Methods
  // =====================

  async fetchDatabases(
    integration: Integration,
    databaseIds?: string[]
  ): Promise<NotionDatabase[]> {
    if (databaseIds && databaseIds.length > 0) {
      // Fetch specific databases
      const databases: NotionDatabase[] = [];
      for (const id of databaseIds) {
        try {
          const response = await this.makeRequest<NotionDatabase>(
            integration,
            'GET',
            `${this.BASE_URL}/databases/${id}`
          );
          databases.push(response.data);
          await this.sleep(350); // Rate limiting
        } catch (error) {
          this.logger.warn({ error, databaseId: id }, 'Failed to fetch Notion database');
        }
      }
      return databases;
    }

    // Search for all databases
    const databases: NotionDatabase[] = [];
    let hasMore = true;
    let startCursor: string | undefined;

    while (hasMore) {
      const response = await this.makeRequest<{
        results: NotionDatabase[];
        has_more: boolean;
        next_cursor?: string;
      }>(integration, 'POST', `${this.BASE_URL}/search`, {
        body: {
          filter: { property: 'object', value: 'database' },
          start_cursor: startCursor,
          page_size: 100,
        },
      });

      databases.push(...response.data.results);
      hasMore = response.data.has_more;
      startCursor = response.data.next_cursor;

      if (hasMore) {
        await this.sleep(350); // Rate limiting
      }
    }

    return databases;
  }

  async fetchDatabasePages(
    integration: Integration,
    databaseId: string,
    since?: Date
  ): Promise<NotionPage[]> {
    const pages: NotionPage[] = [];
    let hasMore = true;
    let startCursor: string | undefined;

    const filter = since
      ? {
          timestamp: 'last_edited_time',
          last_edited_time: { on_or_after: since.toISOString() },
        }
      : undefined;

    while (hasMore) {
      const response = await this.makeRequest<{
        results: NotionPage[];
        has_more: boolean;
        next_cursor?: string;
      }>(integration, 'POST', `${this.BASE_URL}/databases/${databaseId}/query`, {
        body: {
          filter,
          start_cursor: startCursor,
          page_size: 100,
        },
      });

      pages.push(...response.data.results.filter((p) => !p.archived));
      hasMore = response.data.has_more;
      startCursor = response.data.next_cursor;

      if (hasMore) {
        await this.sleep(350); // Rate limiting
      }
    }

    return pages;
  }

  async fetchPage(integration: Integration, pageId: string): Promise<NotionPage> {
    const response = await this.makeRequest<NotionPage>(
      integration,
      'GET',
      `${this.BASE_URL}/pages/${pageId}`
    );
    return response.data;
  }

  // =====================
  // Entity Creation Methods
  // =====================

  private async createProjectFromDatabase(
    userId: string,
    database: {
      id: string;
      title: string;
      description?: string;
      icon?: string;
      createdTime: string;
    }
  ): Promise<{ id: string }> {
    const project = await this.prisma.cockpitProject.create({
      data: {
        freelancerUserId: userId,
        name: database.title,
        description: database.description,
        projectType: 'INTERNAL',
        source: 'OTHER_PLATFORM',
        status: 'IN_PROGRESS',
        startDate: new Date(database.createdTime),
        tags: ['notion'],
        customFields: {
          notion_database_id: database.id,
          notion_icon: database.icon,
        },
      },
      select: { id: true },
    });

    return project;
  }

  private async updateProjectFromDatabase(
    projectId: string,
    database: {
      title: string;
      description?: string;
      lastEditedTime: string;
    }
  ): Promise<void> {
    await this.prisma.cockpitProject.update({
      where: { id: projectId },
      data: {
        name: database.title,
        description: database.description,
      },
    });
  }

  private parsePageAsTask(page: NotionPage): NotionTask {
    const properties = page.properties;

    // Try to find common property names
    const titleProp = Object.values(properties).find((p) => p.type === 'title');
    const statusProp =
      properties['Status'] ??
      Object.values(properties).find((p) => p.type === 'status' || p.type === 'select');
    const priorityProp = properties['Priority'];
    const dateProp = properties['Due'] ?? properties['Due Date'] ?? properties['Deadline'];

    const title = titleProp?.title?.map((t) => t.plain_text).join('') || 'Untitled';
    const status = statusProp?.status?.name ?? statusProp?.select?.name;
    const priority = priorityProp?.select?.name;
    const dueDate = dateProp?.date?.start;

    return {
      id: page.id,
      title,
      status,
      priority,
      dueDate,
      createdAt: page.created_time,
      updatedAt: page.last_edited_time,
    };
  }

  private async createTaskFromNotion(
    userId: string,
    task: NotionTask,
    projectId: string
  ): Promise<{ id: string }> {
    const createdTask = await this.prisma.projectTask.create({
      data: {
        projectId,
        title: task.title,
        description: task.description,
        status: this.mapNotionStatus(task.status),
        priority: this.mapNotionPriority(task.priority),
        dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
        tags: ['notion'],
      },
      select: { id: true },
    });

    return createdTask;
  }

  private async updateTaskFromNotion(taskId: string, task: NotionTask): Promise<void> {
    await this.prisma.projectTask.update({
      where: { id: taskId },
      data: {
        title: task.title,
        status: this.mapNotionStatus(task.status),
        priority: this.mapNotionPriority(task.priority),
        dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
      },
    });
  }

  // =====================
  // Webhook Methods
  // =====================

  verifyWebhookSignature(_payload: string | Buffer, _signature: string, _secret: string): boolean {
    // Notion doesn't have webhooks yet
    return false;
  }

  async processWebhook(_integration: Integration, _webhook: WebhookPayload): Promise<void> {
    // Notion doesn't have webhooks yet
    this.logger.warn('Notion webhooks are not supported');
    await Promise.resolve();
  }

  // =====================
  // Helper Methods
  // =====================

  private mapNotionStatus(status?: string): TaskStatus {
    if (!status) return 'TODO';

    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus.includes('done') || normalizedStatus.includes('complete')) {
      return 'COMPLETED';
    }
    if (normalizedStatus.includes('progress') || normalizedStatus.includes('doing')) {
      return 'IN_PROGRESS';
    }
    return 'TODO';
  }

  private mapNotionPriority(priority?: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' {
    if (!priority) return 'MEDIUM';

    const normalizedPriority = priority.toLowerCase();
    if (normalizedPriority.includes('urgent') || normalizedPriority.includes('critical')) {
      return 'URGENT';
    }
    if (normalizedPriority.includes('high')) {
      return 'HIGH';
    }
    if (normalizedPriority.includes('low')) {
      return 'LOW';
    }
    return 'MEDIUM';
  }

  private generateHash(data: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  // =====================
  // Public Utility Methods
  // =====================

  /**
   * Create a new page in a Notion database
   */
  async createPage(
    integration: Integration,
    databaseId: string,
    properties: Record<string, unknown>
  ): Promise<NotionPage> {
    const response = await this.makeRequest<NotionPage>(
      integration,
      'POST',
      `${this.BASE_URL}/pages`,
      {
        body: {
          parent: { database_id: databaseId },
          properties,
        },
      }
    );

    return response.data;
  }

  /**
   * Update a Notion page
   */
  async updatePage(
    integration: Integration,
    pageId: string,
    properties: Record<string, unknown>
  ): Promise<NotionPage> {
    const response = await this.makeRequest<NotionPage>(
      integration,
      'PATCH',
      `${this.BASE_URL}/pages/${pageId}`,
      {
        body: { properties },
      }
    );

    return response.data;
  }

  /**
   * Archive (delete) a Notion page
   */
  async archivePage(integration: Integration, pageId: string): Promise<void> {
    await this.makeRequest(integration, 'PATCH', `${this.BASE_URL}/pages/${pageId}`, {
      body: { archived: true },
    });
  }
}
