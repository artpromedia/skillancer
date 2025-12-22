/**
 * @module @skillancer/cockpit-svc/services/integrations/asana
 * Asana Integration Service - Projects and tasks sync
 */

import crypto from 'node:crypto';

import { BaseIntegrationService, type RateLimitConfig } from './base-integration.service.js';

import type {
  OAuthConfig,
  OAuthTokens,
  ApiKeyConfig,
  SyncOptions,
  SyncResult,
  AccountInfo,
  WebhookPayload,
  SyncContext,
} from '../../types/integration.types.js';
import type { EncryptionService } from '../encryption.service.js';
import type { Integration, IntegrationProvider, PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

// ============================================================================
// Types
// ============================================================================

interface AsanaWorkspace {
  gid: string;
  name: string;
  is_organization: boolean;
}

interface AsanaProject {
  gid: string;
  name: string;
  notes?: string;
  due_on?: string;
  start_on?: string;
  archived: boolean;
  public: boolean;
  workspace: { gid: string; name: string };
  team?: { gid: string; name: string };
  current_status?: {
    text: string;
    color: 'green' | 'yellow' | 'red' | 'blue';
  };
  custom_fields?: AsanaCustomField[];
  created_at: string;
  modified_at: string;
}

interface AsanaTask {
  gid: string;
  name: string;
  notes?: string;
  completed: boolean;
  completed_at?: string;
  due_on?: string;
  due_at?: string;
  start_on?: string;
  assignee?: { gid: string; name: string };
  projects?: Array<{ gid: string; name: string }>;
  tags?: Array<{ gid: string; name: string }>;
  custom_fields?: AsanaCustomField[];
  created_at: string;
  modified_at: string;
}

interface AsanaCustomField {
  gid: string;
  name: string;
  type: 'text' | 'number' | 'enum' | 'multi_enum' | 'date';
  text_value?: string;
  number_value?: number;
  enum_value?: { gid: string; name: string };
  multi_enum_values?: Array<{ gid: string; name: string }>;
  date_value?: string;
}

interface AsanaUser {
  gid: string;
  name: string;
  email: string;
  photo?: { image_128x128: string };
}

interface AsanaSyncOptions {
  workspaceId?: string;
  projectIds?: string[];
  syncTasks?: boolean;
  syncSubtasks?: boolean;
  includeArchived?: boolean;
}

type ProjectStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED' | 'BLOCKED';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

// ============================================================================
// Asana Integration Service
// ============================================================================

export class AsanaIntegrationService extends BaseIntegrationService {
  private readonly BASE_URL = 'https://app.asana.com/api/1.0';
  private readonly OAUTH_URL = 'https://app.asana.com/-/oauth_authorize';
  private readonly TOKEN_URL = 'https://app.asana.com/-/oauth_token';

  constructor(prisma: PrismaClient, logger: Logger, encryption: EncryptionService) {
    super(prisma, logger, encryption);
  }

  // ============================================================================
  // Provider Info
  // ============================================================================

  get provider(): IntegrationProvider {
    return 'ASANA';
  }

  get displayName(): string {
    return 'Asana';
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  getOAuthConfig(): OAuthConfig | null {
    const clientId = process.env.ASANA_CLIENT_ID;
    const clientSecret = process.env.ASANA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return null;
    }

    return {
      authorizationUrl: this.OAUTH_URL,
      tokenUrl: this.TOKEN_URL,
      clientId,
      clientSecret,
      scopes: ['default'],
    };
  }

  getApiKeyConfig(): ApiKeyConfig | null {
    return {
      headerName: 'Authorization',
      prefix: 'Bearer',
      requiresSecret: false,
    };
  }

  getRateLimitConfig(): RateLimitConfig {
    return {
      maxRequests: 150,
      windowMs: 60 * 1000, // 150 requests per minute
    };
  }

  // ============================================================================
  // OAuth Methods
  // ============================================================================

  getOAuthUrl(userId: string, state: string, redirectUri: string): string {
    const config = this.getOAuthConfig();
    if (!config) {
      throw this.createError('CONFIG_ERROR', 'Asana OAuth not configured');
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
    });

    return `${this.OAUTH_URL}?${params.toString()}`;
  }

  async exchangeAuthCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();
    if (!config) {
      throw this.createError('CONFIG_ERROR', 'Asana OAuth not configured');
    }

    const response = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error({ error, status: response.status }, 'Asana OAuth exchange failed');
      throw this.createError('OAUTH_ERROR', 'Failed to exchange authorization code');
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();
    if (!config) {
      throw this.createError('CONFIG_ERROR', 'Asana OAuth not configured');
    }

    const response = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error({ error, status: response.status }, 'Asana token refresh failed');
      throw this.createError('REFRESH_ERROR', 'Failed to refresh access token');
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async revokeAccess(_accessToken: string): Promise<void> {
    // Asana doesn't have a revoke endpoint
    // Users must revoke from their Asana settings
    this.logger.info('Asana access revocation must be done from Asana settings');
  }

  // ============================================================================
  // API Key Methods
  // ============================================================================

  async validateApiKey(apiKey: string, _apiSecret?: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.BASE_URL}/users/me`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Account Info
  // ============================================================================

  async getAccountInfo(integration: Integration): Promise<AccountInfo> {
    const response = await this.makeRequest<{ data: AsanaUser }>(
      integration,
      'GET',
      `${this.BASE_URL}/users/me`
    );

    const user = response.data.data;

    return {
      id: user.gid,
      email: user.email,
      name: user.name,
      avatar: user.photo?.image_128x128,
    };
  }

  // ============================================================================
  // Sync Methods
  // ============================================================================

  getSupportedSyncTypes(): string[] {
    return ['projects', 'tasks'];
  }

  async sync(integration: Integration, options: SyncOptions): Promise<SyncResult> {
    const context = await this.createSyncContext(integration, options);
    const syncOptions = (integration.syncOptions as AsanaSyncOptions) ?? {};

    try {
      // Determine what to sync
      const entityTypes = options.entityTypes ?? ['projects', 'tasks'];

      if (entityTypes.includes('projects')) {
        await this.syncProjects(integration, context, syncOptions);
      }

      if (entityTypes.includes('tasks')) {
        await this.syncTasks(integration, context, options, syncOptions);
      }

      return await this.completeSyncContext(context, context.errors.length === 0);
    } catch (error) {
      context.errors.push({
        message: (error as Error).message,
        entity: 'sync',
      });
      return await this.completeSyncContext(context, false);
    }
  }

  // ============================================================================
  // Project Sync
  // ============================================================================

  async fetchWorkspaces(integration: Integration): Promise<AsanaWorkspace[]> {
    const response = await this.makeRequest<{ data: AsanaWorkspace[] }>(
      integration,
      'GET',
      `${this.BASE_URL}/workspaces`
    );
    return response.data.data;
  }

  async fetchProjects(
    integration: Integration,
    workspaceId: string,
    archived = false
  ): Promise<AsanaProject[]> {
    const projects: AsanaProject[] = [];
    let offset: string | undefined;

    do {
      const url = new URL(`${this.BASE_URL}/workspaces/${workspaceId}/projects`);
      url.searchParams.set(
        'opt_fields',
        'name,notes,due_on,start_on,archived,public,current_status,created_at,modified_at'
      );
      url.searchParams.set('archived', String(archived));
      url.searchParams.set('limit', '100');
      if (offset) {
        url.searchParams.set('offset', offset);
      }

      const response = await this.makeRequest<{
        data: AsanaProject[];
        next_page?: { offset: string };
      }>(integration, 'GET', url.toString());

      projects.push(...response.data.data);
      offset = response.data.next_page?.offset;
    } while (offset);

    return projects;
  }

  private async syncProjects(
    integration: Integration,
    context: SyncContext,
    syncOptions: AsanaSyncOptions
  ): Promise<void> {
    try {
      // Get workspace
      let workspaceId = syncOptions.workspaceId;
      if (!workspaceId) {
        const workspaces = await this.fetchWorkspaces(integration);
        const firstWorkspace = workspaces[0];
        if (!firstWorkspace) {
          throw this.createError('NO_WORKSPACE', 'No Asana workspaces found');
        }
        workspaceId = firstWorkspace.gid;
      }

      const projects = await this.fetchProjects(
        integration,
        workspaceId,
        syncOptions.includeArchived
      );

      for (const project of projects) {
        context.recordsProcessed++;

        try {
          await this.processProject(integration, project);
          context.recordsCreated++;
        } catch (error) {
          context.recordsFailed++;
          context.errors.push({
            message: (error as Error).message,
            entity: `project:${project.gid}`,
          });
        }
      }
    } catch (error) {
      context.errors.push({
        message: (error as Error).message,
        entity: 'projects',
      });
    }
  }

  private async processProject(
    integration: Integration,
    asanaProject: AsanaProject
  ): Promise<void> {
    const existingMapping = await this.mappingRepo.findByExternalId(
      integration.id,
      'PROJECT',
      asanaProject.gid
    );

    const status = this.mapAsanaProjectStatus(asanaProject);

    if (existingMapping) {
      // Update existing project
      await this.prisma.cockpitProject.update({
        where: { id: existingMapping.internalId },
        data: {
          name: asanaProject.name,
          description: asanaProject.notes,
          status,
          startDate: asanaProject.start_on ? new Date(asanaProject.start_on) : undefined,
          dueDate: asanaProject.due_on ? new Date(asanaProject.due_on) : undefined,
          updatedAt: new Date(),
        },
      });

      await this.mappingRepo.updateLastSync(existingMapping.id);
    } else {
      // Create new project
      const project = await this.prisma.cockpitProject.create({
        data: {
          freelancerUserId: integration.userId,
          name: asanaProject.name,
          description: asanaProject.notes,
          status,
          source: 'OTHER_PLATFORM',
          startDate: asanaProject.start_on ? new Date(asanaProject.start_on) : undefined,
          dueDate: asanaProject.due_on ? new Date(asanaProject.due_on) : undefined,
          tags: ['asana'],
          customFields: {
            asana_gid: asanaProject.gid,
            asana_workspace: asanaProject.workspace.name,
          },
        },
      });

      await this.upsertMapping(
        integration,
        'PROJECT',
        asanaProject.gid,
        project.id,
        'CockpitProject',
        {
          externalName: asanaProject.name,
          externalData: asanaProject as unknown as Record<string, unknown>,
        }
      );
    }
  }

  // ============================================================================
  // Task Sync
  // ============================================================================

  async fetchTasks(
    integration: Integration,
    projectId: string,
    since?: Date
  ): Promise<AsanaTask[]> {
    const tasks: AsanaTask[] = [];
    let offset: string | undefined;

    do {
      const url = new URL(`${this.BASE_URL}/projects/${projectId}/tasks`);
      url.searchParams.set(
        'opt_fields',
        'name,notes,completed,completed_at,due_on,due_at,start_on,assignee.name,projects.name,tags.name,created_at,modified_at'
      );
      url.searchParams.set('limit', '100');

      if (since) {
        url.searchParams.set('modified_since', since.toISOString());
      }
      if (offset) {
        url.searchParams.set('offset', offset);
      }

      const response = await this.makeRequest<{
        data: AsanaTask[];
        next_page?: { offset: string };
      }>(integration, 'GET', url.toString());

      tasks.push(...response.data.data);
      offset = response.data.next_page?.offset;
    } while (offset);

    return tasks;
  }

  private async syncTasks(
    integration: Integration,
    context: SyncContext,
    options: SyncOptions,
    syncOptions: AsanaSyncOptions
  ): Promise<void> {
    try {
      // Get all synced projects
      const projectMappings = await this.prisma.integrationMapping.findMany({
        where: {
          integrationId: integration.id,
          entityType: 'PROJECT',
          internalType: 'CockpitProject',
        },
      });

      // Filter to specific projects if configured
      const filteredMappings = syncOptions.projectIds?.length
        ? projectMappings.filter((m) => syncOptions.projectIds?.includes(m.externalId))
        : projectMappings;

      for (const mapping of filteredMappings) {
        try {
          const tasks = await this.fetchTasks(integration, mapping.externalId, options.since);

          for (const task of tasks) {
            context.recordsProcessed++;

            try {
              await this.processTask(integration, task, mapping.internalId);
              context.recordsCreated++;
            } catch (error) {
              context.recordsFailed++;
              context.errors.push({
                message: (error as Error).message,
                entity: `task:${task.gid}`,
              });
            }
          }
        } catch (error) {
          context.errors.push({
            message: (error as Error).message,
            entity: `project:${mapping.externalId}`,
          });
        }
      }
    } catch (error) {
      context.errors.push({
        message: (error as Error).message,
        entity: 'tasks',
      });
    }
  }

  private async processTask(
    integration: Integration,
    asanaTask: AsanaTask,
    projectId: string
  ): Promise<void> {
    const existingMapping = await this.mappingRepo.findByExternalId(
      integration.id,
      'TASK',
      asanaTask.gid
    );

    const status = this.mapAsanaTaskStatus(asanaTask);
    const priority = this.inferTaskPriority(asanaTask);

    if (existingMapping) {
      // Update existing task
      await this.prisma.projectTask.update({
        where: { id: existingMapping.internalId },
        data: {
          title: asanaTask.name,
          description: asanaTask.notes,
          status,
          priority,
          dueDate: asanaTask.due_on ? new Date(asanaTask.due_on) : undefined,
          completedAt: asanaTask.completed_at ? new Date(asanaTask.completed_at) : undefined,
          updatedAt: new Date(),
        },
      });

      await this.mappingRepo.updateLastSync(existingMapping.id);
    } else {
      // Create new task
      const task = await this.prisma.projectTask.create({
        data: {
          projectId,
          title: asanaTask.name,
          description: asanaTask.notes,
          status,
          priority,
          dueDate: asanaTask.due_on ? new Date(asanaTask.due_on) : undefined,
          completedAt: asanaTask.completed_at ? new Date(asanaTask.completed_at) : undefined,
          tags: asanaTask.tags?.map((t) => t.name) ?? [],
        },
      });

      await this.upsertMapping(integration, 'TASK', asanaTask.gid, task.id, 'ProjectTask', {
        externalName: asanaTask.name,
        externalData: asanaTask as unknown as Record<string, unknown>,
      });
    }
  }

  // ============================================================================
  // Create/Update Operations
  // ============================================================================

  async createTask(
    integration: Integration,
    projectGid: string,
    task: {
      name: string;
      notes?: string;
      due_on?: string;
      assignee?: string;
    }
  ): Promise<AsanaTask> {
    const response = await this.makeRequest<{ data: AsanaTask }>(
      integration,
      'POST',
      `${this.BASE_URL}/tasks`,
      {
        body: {
          data: {
            ...task,
            projects: [projectGid],
          },
        },
      }
    );

    return response.data.data;
  }

  async updateTask(
    integration: Integration,
    taskGid: string,
    updates: {
      name?: string;
      notes?: string;
      completed?: boolean;
      due_on?: string;
    }
  ): Promise<AsanaTask> {
    const response = await this.makeRequest<{ data: AsanaTask }>(
      integration,
      'PUT',
      `${this.BASE_URL}/tasks/${taskGid}`,
      {
        body: { data: updates },
      }
    );

    return response.data.data;
  }

  // ============================================================================
  // Webhook Methods
  // ============================================================================

  getSupportedWebhookEvents(): string[] {
    return ['task', 'project', 'story'];
  }

  verifyWebhookSignature(payload: string | Buffer, signature: string, secret: string): boolean {
    const payloadStr = typeof payload === 'string' ? payload : payload.toString();
    const expectedSignature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch {
      return false;
    }
  }

  async processWebhook(integration: Integration, payload: WebhookPayload): Promise<void> {
    const eventType = payload.eventType;
    const data = payload.payload;

    this.logger.info({ eventType, integration: integration.id }, 'Processing Asana webhook');

    switch (eventType) {
      case 'task':
        await this.handleTaskWebhook(integration, data);
        break;

      case 'project':
        await this.handleProjectWebhook(integration, data);
        break;

      default:
        this.logger.debug({ eventType }, 'Unhandled Asana webhook event');
    }
  }

  private async handleTaskWebhook(
    integration: Integration,
    data: Record<string, unknown>
  ): Promise<void> {
    const taskGid = data.gid as string;
    if (!taskGid) return;

    // Fetch updated task details
    const response = await this.makeRequest<{ data: AsanaTask }>(
      integration,
      'GET',
      `${this.BASE_URL}/tasks/${taskGid}?opt_fields=name,notes,completed,completed_at,due_on,modified_at`
    );

    const task = response.data.data;
    const mapping = await this.mappingRepo.findByExternalId(integration.id, 'TASK', taskGid);

    if (mapping) {
      await this.prisma.projectTask.update({
        where: { id: mapping.internalId },
        data: {
          title: task.name,
          description: task.notes,
          status: this.mapAsanaTaskStatus(task),
          dueDate: task.due_on ? new Date(task.due_on) : null,
          completedAt: task.completed_at ? new Date(task.completed_at) : null,
          updatedAt: new Date(),
        },
      });

      await this.mappingRepo.updateLastSync(mapping.id);
    }
  }

  private async handleProjectWebhook(
    integration: Integration,
    data: Record<string, unknown>
  ): Promise<void> {
    const projectGid = data.gid as string;
    if (!projectGid) return;

    const response = await this.makeRequest<{ data: AsanaProject }>(
      integration,
      'GET',
      `${this.BASE_URL}/projects/${projectGid}?opt_fields=name,notes,archived,due_on,start_on,current_status,modified_at`
    );

    const project = response.data.data;
    const mapping = await this.mappingRepo.findByExternalId(integration.id, 'PROJECT', projectGid);

    if (mapping) {
      await this.prisma.cockpitProject.update({
        where: { id: mapping.internalId },
        data: {
          name: project.name,
          description: project.notes,
          status: this.mapAsanaProjectStatus(project),
          dueDate: project.due_on ? new Date(project.due_on) : null,
          startDate: project.start_on ? new Date(project.start_on) : null,
          updatedAt: new Date(),
        },
      });

      await this.mappingRepo.updateLastSync(mapping.id);
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private mapAsanaProjectStatus(project: AsanaProject): ProjectStatus {
    if (project.archived) return 'CANCELLED';

    const statusColor = project.current_status?.color;
    switch (statusColor) {
      case 'green':
        return 'COMPLETED';
      case 'yellow':
        return 'IN_PROGRESS';
      case 'red':
        return 'ON_HOLD';
      default:
        return 'NOT_STARTED';
    }
  }

  private mapAsanaTaskStatus(task: AsanaTask): TaskStatus {
    if (task.completed) return 'COMPLETED';
    if (task.due_on) {
      const dueDate = new Date(task.due_on);
      if (dueDate < new Date()) {
        return 'IN_PROGRESS'; // Overdue, likely being worked on
      }
    }
    return 'TODO';
  }

  private inferTaskPriority(task: AsanaTask): Priority {
    // Check tags for priority hints
    const tagNames = task.tags?.map((t) => t.name.toLowerCase()) ?? [];

    if (tagNames.some((t) => t.includes('urgent') || t.includes('critical'))) {
      return 'URGENT';
    }
    if (tagNames.some((t) => t.includes('high'))) {
      return 'HIGH';
    }
    if (tagNames.some((t) => t.includes('low'))) {
      return 'LOW';
    }

    // Check due date proximity
    if (task.due_on) {
      const daysUntilDue = Math.ceil(
        (new Date(task.due_on).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilDue <= 1) return 'URGENT';
      if (daysUntilDue <= 3) return 'HIGH';
    }

    return 'MEDIUM';
  }
}
