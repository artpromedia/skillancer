/**
 * @module @skillancer/cockpit-svc/services/integrations/freelancer
 * Freelancer.com Integration Service - Sync projects, milestones, and payments
 */

import crypto from 'node:crypto';

import { BaseIntegrationService } from './base-integration.service.js';

import type { RateLimitConfig } from './base-integration.service.js';
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
import type {
  Integration,
  IntegrationProvider,
  PrismaClient,
} from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

// ============================================================================
// FREELANCER.COM-SPECIFIC TYPES
// ============================================================================

export interface FreelancerProject {
  id: number;
  title: string;
  description?: string;
  status: string;
  type: 'hourly' | 'fixed';
  bid_id?: number;
  budget: {
    minimum: number;
    maximum?: number;
  };
  currency: {
    code: string;
    sign: string;
  };
  time_submitted: number;
  time_updated?: number;
  frontend_project_status: string;
  employer: {
    id: number;
    username: string;
    display_name?: string;
    email?: string;
    avatar_url?: string;
    location?: {
      country?: {
        name: string;
      };
    };
  };
}

export interface FreelancerMilestone {
  id: number;
  project_id: number;
  description: string;
  amount: number;
  currency: {
    code: string;
  };
  status: string;
  time_created: number;
  time_released?: number;
}

export interface FreelancerPayment {
  id: number;
  project_id: number;
  milestone_id?: number;
  amount: number;
  currency: {
    code: string;
  };
  time_created: number;
  type: string;
  status: string;
  description?: string;
}

export interface FreelancerTimeTrack {
  id: number;
  project_id: number;
  start_time: number;
  end_time?: number;
  duration_seconds: number;
  description?: string;
  status: string;
}

export interface FreelancerSyncOptions {
  syncProjects?: boolean;
  syncMilestones?: boolean;
  syncPayments?: boolean;
  syncTimeTracking?: boolean;
  autoCreateClients?: boolean;
}

type ProjectStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

// ============================================================================
// FREELANCER.COM INTEGRATION SERVICE
// ============================================================================

export class FreelancerIntegrationService extends BaseIntegrationService {
  private readonly BASE_URL = 'https://www.freelancer.com/api';
  private readonly OAUTH_URL = 'https://accounts.freelancer.com/oauth/authorize';
  private readonly TOKEN_URL = 'https://accounts.freelancer.com/oauth/token';

  constructor(prisma: PrismaClient, logger: Logger, encryption: EncryptionService) {
    super(prisma, logger, encryption);
  }

  // =====================
  // Provider Identity
  // =====================

  get provider(): IntegrationProvider {
    return 'FREELANCER';
  }

  get displayName(): string {
    return 'Freelancer.com';
  }

  // =====================
  // Configuration
  // =====================

  getOAuthConfig(): OAuthConfig | null {
    const clientId = process.env['FREELANCER_CLIENT_ID'];
    const clientSecret = process.env['FREELANCER_CLIENT_SECRET'];

    if (!clientId || !clientSecret) {
      return null;
    }

    return {
      authorizationUrl: this.OAUTH_URL,
      tokenUrl: this.TOKEN_URL,
      clientId,
      clientSecret,
      scopes: ['basic', 'projects', 'milestones', 'payments'],
    };
  }

  getApiKeyConfig(): ApiKeyConfig | null {
    // Freelancer supports API tokens
    return {
      headerName: 'Freelancer-OAuth-V1',
      prefix: '',
    };
  }

  getRateLimitConfig(): RateLimitConfig {
    return {
      maxRequests: 60,
      windowMs: 60000, // 60 requests per minute
    };
  }

  getSupportedSyncTypes(): string[] {
    return ['CLIENT', 'PROJECT', 'MILESTONE', 'TIME_ENTRY', 'PAYMENT'];
  }

  getSupportedWebhookEvents(): string[] {
    return [
      'project.awarded',
      'project.updated',
      'project.completed',
      'milestone.created',
      'milestone.released',
      'payment.received',
    ];
  }

  // =====================
  // OAuth Methods
  // =====================

  getOAuthUrl(userId: string, state: string, redirectUri: string): string {
    const config = this.getOAuthConfig();
    if (!config) {
      throw new Error('Freelancer OAuth not configured');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: redirectUri,
      state,
      scope: config.scopes.join(' '),
      prompt: 'select_account',
    });

    return `${this.OAUTH_URL}?${params.toString()}`;
  }

  async exchangeAuthCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();
    if (!config) {
      throw new Error('Freelancer OAuth not configured');
    }

    const response = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error({ error, status: response.status }, 'Freelancer token exchange failed');
      throw new Error('Failed to exchange Freelancer authorization code');
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
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
      throw new Error('Freelancer OAuth not configured');
    }

    const response = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error({ error, status: response.status }, 'Freelancer token refresh failed');
      throw new Error('Failed to refresh Freelancer access token');
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async revokeAccess(accessToken: string): Promise<void> {
    try {
      await fetch('https://accounts.freelancer.com/oauth/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token: accessToken,
        }),
      });
    } catch (error) {
      this.logger.warn({ error: (error as Error).message }, 'Failed to revoke Freelancer access');
    }
  }

  // =====================
  // API Key Methods
  // =====================

  async validateApiKey(apiKey: string, _apiSecret?: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.BASE_URL}/users/0.1/self`, {
        headers: {
          'Freelancer-OAuth-V1': apiKey,
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
      result: {
        id: number;
        username: string;
        email?: string;
        display_name?: string;
        avatar_url?: string;
        role?: string;
      };
    }>(integration, 'GET', `${this.BASE_URL}/users/0.1/self`);

    const user = response.data.result;

    return {
      id: user.id.toString(),
      email: user.email,
      name: user.display_name ?? user.username,
      avatar: user.avatar_url,
      metadata: {
        username: user.username,
        role: user.role,
      },
    };
  }

  // =====================
  // Sync Methods
  // =====================

  async sync(integration: Integration, options: SyncOptions): Promise<SyncResult> {
    const context = await this.createSyncContext(integration, options);
    const syncOptions = (integration.syncOptions as FreelancerSyncOptions) ?? {};

    try {
      // Sync projects
      if (!options.entityTypes || options.entityTypes.includes('PROJECT')) {
        if (syncOptions.syncProjects !== false) {
          await this.syncProjects(integration, context, options);
        }
      }

      // Sync milestones
      if (!options.entityTypes || options.entityTypes.includes('MILESTONE')) {
        if (syncOptions.syncMilestones !== false) {
          await this.syncMilestones(integration, context, options);
        }
      }

      // Sync time tracking
      if (!options.entityTypes || options.entityTypes.includes('TIME_ENTRY')) {
        if (syncOptions.syncTimeTracking !== false) {
          await this.syncTimeTracking(integration, context, options);
        }
      }

      // Sync payments
      if (!options.entityTypes || options.entityTypes.includes('PAYMENT')) {
        if (syncOptions.syncPayments !== false) {
          await this.syncPayments(integration, context, options);
        }
      }

      return await this.completeSyncContext(context, true);
    } catch (error) {
      context.errors.push({ message: (error as Error).message, entity: 'sync' });
      return await this.completeSyncContext(context, false);
    }
  }

  private async syncProjects(
    integration: Integration,
    context: {
      recordsProcessed: number;
      recordsCreated: number;
      recordsUpdated: number;
      recordsFailed: number;
      errors: Array<{ message: string; entity?: string }>;
    },
    options: SyncOptions
  ): Promise<void> {
    try {
      const projects = await this.fetchProjects(integration, options.since);

      for (const project of projects) {
        context.recordsProcessed++;

        try {
          const existingMapping = await this.mappingRepo.findByExternalId(
            integration.id,
            'PROJECT',
            project.id.toString()
          );

          // Sync employer as client
          const clientId = await this.syncEmployer(integration, project.employer);

          if (existingMapping) {
            const currentHash = this.generateHash(project);
            if (existingMapping.lastSyncHash !== currentHash) {
              await this.updateProjectFromFreelancer(existingMapping.internalId, project);
              await this.mappingRepo.update(existingMapping.id, {
                lastSyncAt: new Date(),
                lastSyncHash: currentHash,
              });
              context.recordsUpdated++;
            }
          } else {
            const cockpitProject = await this.createProjectFromFreelancer(
              integration.userId,
              project,
              clientId
            );

            await this.upsertMapping(
              integration,
              'PROJECT',
              project.id.toString(),
              cockpitProject.id,
              'CockpitProject',
              {
                externalType: project.type,
                externalName: project.title,
                externalData: project as unknown as Record<string, unknown>,
              }
            );

            context.recordsCreated++;
          }
        } catch (error) {
          context.recordsFailed++;
          context.errors.push({
            message: (error as Error).message,
            entity: `project:${project.id}`,
          });
        }
      }
    } catch (error) {
      context.errors.push({ message: (error as Error).message, entity: 'projects' });
    }
  }

  private async syncMilestones(
    integration: Integration,
    context: {
      recordsProcessed: number;
      recordsCreated: number;
      recordsUpdated: number;
      recordsFailed: number;
      errors: Array<{ message: string; entity?: string }>;
    },
    _options: SyncOptions
  ): Promise<void> {
    try {
      const milestones = await this.fetchMilestones(integration);

      for (const milestone of milestones) {
        context.recordsProcessed++;

        try {
          const existingMapping = await this.mappingRepo.findByExternalId(
            integration.id,
            'MILESTONE',
            milestone.id.toString()
          );

          if (existingMapping) {
            const currentHash = this.generateHash(milestone);
            if (existingMapping.lastSyncHash !== currentHash) {
              await this.updateMilestone(existingMapping.internalId, milestone);
              await this.mappingRepo.update(existingMapping.id, {
                lastSyncAt: new Date(),
                lastSyncHash: currentHash,
              });
              context.recordsUpdated++;
            }
          } else {
            const projectMapping = await this.mappingRepo.findByExternalId(
              integration.id,
              'PROJECT',
              milestone.project_id.toString()
            );

            if (!projectMapping) {
              context.recordsFailed++;
              continue;
            }

            const task = await this.createMilestoneTask(
              integration.userId,
              milestone,
              projectMapping.internalId
            );

            await this.upsertMapping(
              integration,
              'MILESTONE',
              milestone.id.toString(),
              task.id,
              'CockpitTask',
              {
                externalName: milestone.description,
                externalData: milestone as unknown as Record<string, unknown>,
              }
            );

            context.recordsCreated++;
          }
        } catch (error) {
          context.recordsFailed++;
          context.errors.push({
            message: (error as Error).message,
            entity: `milestone:${milestone.id}`,
          });
        }
      }
    } catch (error) {
      context.errors.push({ message: (error as Error).message, entity: 'milestones' });
    }
  }

  private async syncTimeTracking(
    integration: Integration,
    context: {
      recordsProcessed: number;
      recordsCreated: number;
      recordsUpdated: number;
      recordsFailed: number;
      errors: Array<{ message: string; entity?: string }>;
    },
    options: SyncOptions
  ): Promise<void> {
    try {
      const timeTracks = await this.fetchTimeTracking(integration, options.since);

      for (const track of timeTracks) {
        context.recordsProcessed++;

        try {
          const existingMapping = await this.mappingRepo.findByExternalId(
            integration.id,
            'TIME_ENTRY',
            track.id.toString()
          );

          const projectMapping = await this.mappingRepo.findByExternalId(
            integration.id,
            'PROJECT',
            track.project_id.toString()
          );

          if (existingMapping) {
            const currentHash = this.generateHash(track);
            if (existingMapping.lastSyncHash !== currentHash) {
              await this.updateTimeEntry(existingMapping.internalId, track);
              await this.mappingRepo.update(existingMapping.id, {
                lastSyncAt: new Date(),
                lastSyncHash: currentHash,
              });
              context.recordsUpdated++;
            }
          } else {
            const timeEntry = await this.createTimeEntry(
              integration.userId,
              track,
              projectMapping?.internalId
            );

            await this.upsertMapping(
              integration,
              'TIME_ENTRY',
              track.id.toString(),
              timeEntry.id,
              'CockpitTimeEntry',
              {
                externalName: track.description ?? 'Freelancer time track',
                externalData: track as unknown as Record<string, unknown>,
              }
            );

            context.recordsCreated++;
          }
        } catch (error) {
          context.recordsFailed++;
          context.errors.push({
            message: (error as Error).message,
            entity: `time_track:${track.id}`,
          });
        }
      }
    } catch (error) {
      context.errors.push({ message: (error as Error).message, entity: 'time_tracking' });
    }
  }

  private async syncPayments(
    integration: Integration,
    context: {
      recordsProcessed: number;
      recordsCreated: number;
      recordsUpdated: number;
      recordsFailed: number;
      errors: Array<{ message: string; entity?: string }>;
    },
    options: SyncOptions
  ): Promise<void> {
    try {
      const payments = await this.fetchPayments(integration, options.since);

      for (const payment of payments) {
        context.recordsProcessed++;

        try {
          if (payment.status !== 'completed') {
            continue;
          }

          const existingMapping = await this.mappingRepo.findByExternalId(
            integration.id,
            'PAYMENT',
            payment.id.toString()
          );

          if (existingMapping) {
            continue; // Completed payments don't change
          }

          const projectMapping = await this.mappingRepo.findByExternalId(
            integration.id,
            'PROJECT',
            payment.project_id.toString()
          );

          let clientId: string | undefined;
          if (projectMapping) {
            const project = await this.prisma.cockpitProject.findUnique({
              where: { id: projectMapping.internalId },
              select: { clientId: true },
            });
            clientId = project?.clientId ?? undefined;
          }

          const transaction = await this.createPaymentTransaction(
            integration.userId,
            payment,
            projectMapping?.internalId,
            clientId
          );

          await this.upsertMapping(
            integration,
            'PAYMENT',
            payment.id.toString(),
            transaction.id,
            'FinancialTransaction',
            {
              externalName: payment.description ?? 'Freelancer payment',
              externalData: payment as unknown as Record<string, unknown>,
            }
          );

          context.recordsCreated++;
        } catch (error) {
          context.recordsFailed++;
          context.errors.push({
            message: (error as Error).message,
            entity: `payment:${payment.id}`,
          });
        }
      }
    } catch (error) {
      context.errors.push({ message: (error as Error).message, entity: 'payments' });
    }
  }

  // =====================
  // API Fetch Methods
  // =====================

  private async fetchProjects(
    integration: Integration,
    since?: Date
  ): Promise<FreelancerProject[]> {
    const params = new URLSearchParams({
      limit: '100',
      project_types: 'fixed,hourly',
      project_statuses: 'active,draft,completed,pending,closed',
    });

    if (since) {
      params.set('from_time', Math.floor(since.getTime() / 1000).toString());
    }

    const response = await this.makeRequest<{
      result: {
        projects: FreelancerProject[];
      };
    }>(
      integration,
      'GET',
      `${this.BASE_URL}/projects/0.1/projects?${params.toString()}&compact=false`
    );

    return response.data.result?.projects ?? [];
  }

  private async fetchMilestones(integration: Integration): Promise<FreelancerMilestone[]> {
    const response = await this.makeRequest<{
      result: {
        milestones: FreelancerMilestone[];
      };
    }>(integration, 'GET', `${this.BASE_URL}/projects/0.1/milestones?limit=100`);

    return response.data.result?.milestones ?? [];
  }

  private async fetchTimeTracking(
    integration: Integration,
    since?: Date
  ): Promise<FreelancerTimeTrack[]> {
    const params = new URLSearchParams({
      limit: '100',
    });

    if (since) {
      params.set('from_time', Math.floor(since.getTime() / 1000).toString());
    }

    const response = await this.makeRequest<{
      result: {
        time_tracking: FreelancerTimeTrack[];
      };
    }>(integration, 'GET', `${this.BASE_URL}/projects/0.1/time_tracking?${params.toString()}`);

    return response.data.result?.time_tracking ?? [];
  }

  private async fetchPayments(
    integration: Integration,
    since?: Date
  ): Promise<FreelancerPayment[]> {
    const params = new URLSearchParams({
      limit: '100',
    });

    if (since) {
      params.set('from_time', Math.floor(since.getTime() / 1000).toString());
    }

    const response = await this.makeRequest<{
      result: {
        payments: FreelancerPayment[];
      };
    }>(integration, 'GET', `${this.BASE_URL}/payments/0.1/payments?${params.toString()}`);

    return response.data.result?.payments ?? [];
  }

  // =====================
  // Entity Creation Methods
  // =====================

  private async syncEmployer(
    integration: Integration,
    employer: FreelancerProject['employer']
  ): Promise<string> {
    const existingMapping = await this.mappingRepo.findByExternalId(
      integration.id,
      'CLIENT',
      employer.id.toString()
    );

    if (existingMapping) {
      return existingMapping.internalId;
    }

    const nameParts = (employer.display_name ?? employer.username).split(' ');

    const client = await this.prisma.client.create({
      data: {
        freelancerUserId: integration.userId,
        clientType: 'INDIVIDUAL',
        source: 'FREELANCER',
        firstName: nameParts[0] ?? 'Unknown',
        lastName: nameParts.slice(1).join(' ') || undefined,
        email: employer.email,
        address: employer.location?.country?.name
          ? { country: employer.location.country.name }
          : undefined,
        avatarUrl: employer.avatar_url,
        tags: ['freelancer'],
        customFields: {
          freelancer_id: employer.id,
          freelancer_username: employer.username,
        } as object,
      },
    });

    await this.upsertMapping(integration, 'CLIENT', employer.id.toString(), client.id, 'Client', {
      externalName: employer.display_name ?? employer.username,
      externalData: employer as unknown as Record<string, unknown>,
    });

    return client.id;
  }

  private async createProjectFromFreelancer(
    userId: string,
    project: FreelancerProject,
    clientId: string
  ): Promise<{ id: string }> {
    const cockpitProject = await this.prisma.cockpitProject.create({
      data: {
        freelancerUserId: userId,
        clientId,
        name: project.title,
        description: project.description,
        projectType: 'CLIENT_WORK',
        source: 'FREELANCER',
        status: this.mapProjectStatus(project.frontend_project_status),
        startDate: new Date(project.time_submitted * 1000),
        budgetType: project.type === 'hourly' ? 'HOURLY' : 'FIXED',
        budgetAmount: project.budget.maximum ?? project.budget.minimum,
        currency: project.currency.code,
        tags: ['freelancer'],
        customFields: {
          freelancer_project_id: project.id,
          freelancer_bid_id: project.bid_id,
        },
      },
      select: { id: true },
    });

    return cockpitProject;
  }

  private async updateProjectFromFreelancer(
    projectId: string,
    project: FreelancerProject
  ): Promise<void> {
    await this.prisma.cockpitProject.update({
      where: { id: projectId },
      data: {
        status: this.mapProjectStatus(project.frontend_project_status),
      },
    });
  }

  private async createMilestoneTask(
    userId: string,
    milestone: FreelancerMilestone,
    projectId: string
  ): Promise<{ id: string }> {
    const task = await this.prisma.projectTask.create({
      data: {
        projectId,
        title: milestone.description || 'Milestone',
        description: `Amount: ${milestone.amount} ${milestone.currency.code}`,
        status: this.mapMilestoneStatus(milestone.status),
        priority: 'MEDIUM',
        tags: ['freelancer', 'milestone'],
      },
      select: { id: true },
    });

    return task;
  }

  private async updateMilestone(taskId: string, milestone: FreelancerMilestone): Promise<void> {
    await this.prisma.projectTask.update({
      where: { id: taskId },
      data: {
        status: this.mapMilestoneStatus(milestone.status),
      },
    });
  }

  private async createTimeEntry(
    userId: string,
    track: FreelancerTimeTrack,
    projectId?: string
  ): Promise<{ id: string }> {
    const durationMinutes = Math.round(track.duration_seconds / 60);

    const timeEntry = await this.prisma.cockpitTimeEntry.create({
      data: {
        freelancerUserId: userId,
        projectId,
        date: new Date(track.start_time * 1000),
        durationMinutes,
        description: track.description
          ? `${track.description} (Freelancer: ${track.id})`
          : `Freelancer time track ${track.id}`,
        category: 'Development',
        isBillable: true,
        trackingMethod: 'IMPORTED',
        tags: ['freelancer'],
      },
      select: { id: true },
    });

    return timeEntry;
  }

  private async updateTimeEntry(entryId: string, track: FreelancerTimeTrack): Promise<void> {
    const durationMinutes = Math.round(track.duration_seconds / 60);

    await this.prisma.cockpitTimeEntry.update({
      where: { id: entryId },
      data: {
        durationMinutes,
        description: track.description,
      },
    });
  }

  private async createPaymentTransaction(
    userId: string,
    payment: FreelancerPayment,
    projectId?: string,
    clientId?: string
  ): Promise<{ id: string }> {
    const transaction = await this.prisma.financialTransaction.create({
      data: {
        userId,
        type: 'INCOME',
        amount: payment.amount,
        currency: payment.currency.code,
        date: new Date(payment.time_created * 1000),
        description: payment.description || `Freelancer: ${payment.type}`,
        category: 'Client Payment',
        clientId,
        projectId,
        paymentMethod: 'Freelancer',
        tags: ['freelancer', payment.type],
      },
      select: { id: true },
    });

    return transaction;
  }

  // =====================
  // Webhook Methods
  // =====================

  verifyWebhookSignature(payload: string | Buffer, signature: string, secret: string): boolean {
    const payloadString = typeof payload === 'string' ? payload : payload.toString();
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(`sha256=${expectedSignature}`)
      );
    } catch {
      return false;
    }
  }

  async processWebhook(integration: Integration, webhook: WebhookPayload): Promise<void> {
    const { eventType } = webhook;

    switch (eventType) {
      case 'project.awarded':
      case 'project.updated':
      case 'project.completed':
        await this.sync(integration, { entityTypes: ['PROJECT'] });
        break;

      case 'milestone.created':
      case 'milestone.released':
        await this.sync(integration, { entityTypes: ['MILESTONE'] });
        break;

      case 'payment.received':
        await this.sync(integration, { entityTypes: ['PAYMENT'] });
        break;

      default:
        this.logger.info({ eventType }, 'Unhandled Freelancer webhook event');
    }
  }

  // =====================
  // Helper Methods
  // =====================

  private mapProjectStatus(status: string): ProjectStatus {
    const statusMap: Record<string, ProjectStatus> = {
      active: 'IN_PROGRESS',
      completed: 'COMPLETED',
      pending: 'NOT_STARTED',
      draft: 'NOT_STARTED',
      closed: 'COMPLETED',
      cancelled: 'CANCELLED',
      frozen: 'ON_HOLD',
    };
    return statusMap[status.toLowerCase()] ?? 'NOT_STARTED';
  }

  private mapMilestoneStatus(status: string): 'TODO' | 'IN_PROGRESS' | 'COMPLETED' {
    const statusMap: Record<string, 'TODO' | 'IN_PROGRESS' | 'COMPLETED'> = {
      created: 'TODO',
      requested: 'IN_PROGRESS',
      released: 'COMPLETED',
      cancelled: 'COMPLETED',
      disputed: 'IN_PROGRESS',
    };
    return statusMap[status.toLowerCase()] ?? 'TODO';
  }

  private generateHash(data: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  // =====================
  // Public Utility Methods
  // =====================

  /**
   * Fetch active bids/proposals for the connected freelancer
   */
  async fetchActiveBids(integration: Integration): Promise<
    Array<{
      id: number;
      project_id: number;
      amount: number;
      currency: string;
      period: number;
      description: string;
      status: string;
    }>
  > {
    const response = await this.makeRequest<{
      result: {
        bids: Array<{
          id: number;
          project_id: number;
          amount: number;
          currency: { code: string };
          period: number;
          description: string;
          award_status: string;
        }>;
      };
    }>(integration, 'GET', `${this.BASE_URL}/projects/0.1/bids?limit=50`);

    return (response.data.result?.bids ?? []).map((bid) => ({
      id: bid.id,
      project_id: bid.project_id,
      amount: bid.amount,
      currency: bid.currency.code,
      period: bid.period,
      description: bid.description,
      status: bid.award_status,
    }));
  }

  /**
   * Fetch earnings summary for the connected freelancer
   */
  async fetchEarningsSummary(integration: Integration): Promise<{
    total: number;
    pending: number;
    withdrawn: number;
    currency: string;
  }> {
    const response = await this.makeRequest<{
      result: {
        balance: number;
        pending: number;
        withdrawn: number;
        currency: { code: string };
      };
    }>(integration, 'GET', `${this.BASE_URL}/payments/0.1/account`);

    const result = response.data.result;

    return {
      total: result?.balance ?? 0,
      pending: result?.pending ?? 0,
      withdrawn: result?.withdrawn ?? 0,
      currency: result?.currency?.code ?? 'USD',
    };
  }
}
