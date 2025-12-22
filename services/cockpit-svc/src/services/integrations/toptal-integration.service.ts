/**
 * @module @skillancer/cockpit-svc/services/integrations/toptal
 * Toptal Integration Service - Sync engagements, time logs, and payments from Toptal
 */

/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

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
import type { Integration, IntegrationProvider, PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

// ============================================================================
// TOPTAL-SPECIFIC TYPES
// ============================================================================

export interface ToptalEngagement {
  id: string;
  title: string;
  status: string;
  type: 'hourly' | 'fixed';
  start_date: string;
  end_date?: string;
  hourly_rate?: number;
  fixed_price?: number;
  currency: string;
  client: {
    id: string;
    company_name: string;
    contact_name: string;
    contact_email?: string;
    country?: string;
  };
  description?: string;
}

export interface ToptalTimeLog {
  id: string;
  engagement_id: string;
  date: string;
  hours: number;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  task_type?: string;
}

export interface ToptalPayment {
  id: string;
  engagement_id?: string;
  date: string;
  amount: number;
  currency: string;
  type: string;
  description: string;
  status: 'pending' | 'completed';
}

export interface ToptalSyncOptions {
  syncEngagements?: boolean;
  syncTimeLogs?: boolean;
  syncPayments?: boolean;
  autoCreateClients?: boolean;
}

type ProjectStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

// ============================================================================
// TOPTAL INTEGRATION SERVICE
// ============================================================================

export class ToptalIntegrationService extends BaseIntegrationService {
  private readonly BASE_URL = 'https://api.toptal.com/v1';
  private readonly OAUTH_URL = 'https://www.toptal.com/oauth/authorize';
  private readonly TOKEN_URL = 'https://api.toptal.com/v1/oauth/token';

  constructor(prisma: PrismaClient, logger: Logger, encryption: EncryptionService) {
    super(prisma, logger, encryption);
  }

  // =====================
  // Provider Identity
  // =====================

  get provider(): IntegrationProvider {
    return 'TOPTAL';
  }

  get displayName(): string {
    return 'Toptal';
  }

  // =====================
  // Configuration
  // =====================

  getOAuthConfig(): OAuthConfig | null {
    const clientId = process.env['TOPTAL_CLIENT_ID'];
    const clientSecret = process.env['TOPTAL_CLIENT_SECRET'];

    if (!clientId || !clientSecret) {
      return null;
    }

    return {
      authorizationUrl: this.OAUTH_URL,
      tokenUrl: this.TOKEN_URL,
      clientId,
      clientSecret,
      scopes: ['engagements', 'time_logs', 'payments'],
    };
  }

  getApiKeyConfig(): ApiKeyConfig | null {
    // Toptal does not support API key authentication
    return null;
  }

  getRateLimitConfig(): RateLimitConfig {
    return {
      maxRequests: 100,
      windowMs: 60000, // 100 requests per minute
    };
  }

  getSupportedSyncTypes(): string[] {
    return ['CLIENT', 'PROJECT', 'TIME_ENTRY', 'PAYMENT'];
  }

  getSupportedWebhookEvents(): string[] {
    return [
      'engagement.created',
      'engagement.updated',
      'engagement.ended',
      'time_log.submitted',
      'time_log.approved',
      'payment.completed',
    ];
  }

  // =====================
  // OAuth Methods
  // =====================

  getOAuthUrl(userId: string, state: string, redirectUri: string): string {
    const config = this.getOAuthConfig();
    if (!config) {
      throw new Error('Toptal OAuth not configured');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: redirectUri,
      state,
      scope: config.scopes.join(' '),
    });

    return `${this.OAUTH_URL}?${params.toString()}`;
  }

  async exchangeAuthCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();
    if (!config) {
      throw new Error('Toptal OAuth not configured');
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
      this.logger.error({ error, status: response.status }, 'Toptal token exchange failed');
      throw new Error('Failed to exchange Toptal authorization code');
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
      throw new Error('Toptal OAuth not configured');
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
      this.logger.error({ error, status: response.status }, 'Toptal token refresh failed');
      throw new Error('Failed to refresh Toptal access token');
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
      await fetch(`${this.BASE_URL}/oauth/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${accessToken}`,
        },
        body: new URLSearchParams({
          token: accessToken,
        }),
      });
    } catch (error) {
      this.logger.warn({ error: (error as Error).message }, 'Failed to revoke Toptal access');
    }
  }

  // =====================
  // API Key Methods
  // =====================

  async validateApiKey(_apiKey: string, _apiSecret?: string): Promise<boolean> {
    await Promise.resolve();
    return false;
  }

  // =====================
  // Account Methods
  // =====================

  async getAccountInfo(integration: Integration): Promise<AccountInfo> {
    const response = await this.makeRequest<{
      user: {
        id: string;
        email: string;
        first_name: string;
        last_name: string;
        avatar_url?: string;
        talent_type?: string;
        skills?: string[];
      };
    }>(integration, 'GET', `${this.BASE_URL}/me`);

    const user = response.data.user;

    return {
      id: user.id,
      email: user.email,
      name: `${user.first_name} ${user.last_name}`,
      avatar: user.avatar_url,
      metadata: {
        talent_type: user.talent_type,
        skills: user.skills,
      },
    };
  }

  // =====================
  // Sync Methods
  // =====================

  async sync(integration: Integration, options: SyncOptions): Promise<SyncResult> {
    const context = await this.createSyncContext(integration, options);
    const syncOptions = (integration.syncOptions as ToptalSyncOptions) ?? {};

    try {
      // Sync engagements as projects
      if (!options.entityTypes || options.entityTypes.includes('PROJECT')) {
        if (syncOptions.syncEngagements !== false) {
          await this.syncEngagements(integration, context, options);
        }
      }

      // Sync time logs
      if (!options.entityTypes || options.entityTypes.includes('TIME_ENTRY')) {
        if (syncOptions.syncTimeLogs !== false) {
          await this.syncTimeLogs(integration, context, options);
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

  private async syncEngagements(
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
      const engagements = await this.fetchEngagements(integration);

      for (const engagement of engagements) {
        context.recordsProcessed++;

        try {
          const existingMapping = await this.mappingRepo.findByExternalId(
            integration.id,
            'PROJECT',
            engagement.id
          );

          // Sync client first
          const clientId = await this.syncClient(integration, engagement.client);

          if (existingMapping) {
            const currentHash = this.generateHash(engagement);
            if (existingMapping.lastSyncHash !== currentHash) {
              await this.updateProjectFromEngagement(existingMapping.internalId, engagement);
              await this.mappingRepo.update(existingMapping.id, {
                lastSyncAt: new Date(),
                lastSyncHash: currentHash,
              });
              context.recordsUpdated++;
            }
          } else {
            const project = await this.createProjectFromEngagement(
              integration.userId,
              engagement,
              clientId
            );

            await this.upsertMapping(
              integration,
              'PROJECT',
              engagement.id,
              project.id,
              'CockpitProject',
              {
                externalType: engagement.type,
                externalName: engagement.title,
                externalData: engagement as unknown as Record<string, unknown>,
              }
            );

            context.recordsCreated++;
          }
        } catch (error) {
          context.recordsFailed++;
          context.errors.push({
            message: (error as Error).message,
            entity: `engagement:${engagement.id}`,
          });
        }
      }
    } catch (error) {
      context.errors.push({ message: (error as Error).message, entity: 'engagements' });
    }
  }

  private async syncTimeLogs(
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
      const endDate = new Date();
      const startDate = options.fullSync
        ? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
        : (options.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

      const timeLogs = await this.fetchTimeLogs(integration, startDate, endDate);

      for (const log of timeLogs) {
        context.recordsProcessed++;

        try {
          const existingMapping = await this.mappingRepo.findByExternalId(
            integration.id,
            'TIME_ENTRY',
            log.id
          );

          const projectMapping = await this.mappingRepo.findByExternalId(
            integration.id,
            'PROJECT',
            log.engagement_id
          );

          if (existingMapping) {
            const currentHash = this.generateHash(log);
            if (existingMapping.lastSyncHash !== currentHash) {
              await this.updateTimeLogEntry(existingMapping.internalId, log);
              await this.mappingRepo.update(existingMapping.id, {
                lastSyncAt: new Date(),
                lastSyncHash: currentHash,
              });
              context.recordsUpdated++;
            }
          } else {
            const timeEntry = await this.createTimeLogEntry(
              integration.userId,
              log,
              projectMapping?.internalId
            );

            await this.upsertMapping(
              integration,
              'TIME_ENTRY',
              log.id,
              timeEntry.id,
              'CockpitTimeEntry',
              {
                externalName: log.description,
                externalData: log as unknown as Record<string, unknown>,
              }
            );

            context.recordsCreated++;
          }
        } catch (error) {
          context.recordsFailed++;
          context.errors.push({
            message: (error as Error).message,
            entity: `time_log:${log.id}`,
          });
        }
      }
    } catch (error) {
      context.errors.push({ message: (error as Error).message, entity: 'time_logs' });
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
            continue; // Only sync completed payments
          }

          const existingMapping = await this.mappingRepo.findByExternalId(
            integration.id,
            'PAYMENT',
            payment.id
          );

          if (existingMapping) {
            continue; // Payments don't change
          }

          let projectId: string | undefined;
          let clientId: string | undefined;

          if (payment.engagement_id) {
            const projectMapping = await this.mappingRepo.findByExternalId(
              integration.id,
              'PROJECT',
              payment.engagement_id
            );
            if (projectMapping) {
              projectId = projectMapping.internalId;
              const project = await this.prisma.cockpitProject.findUnique({
                where: { id: projectId },
                select: { clientId: true },
              });
              clientId = project?.clientId ?? undefined;
            }
          }

          const transaction = await this.createPaymentTransaction(
            integration.userId,
            payment,
            projectId,
            clientId
          );

          await this.upsertMapping(
            integration,
            'PAYMENT',
            payment.id,
            transaction.id,
            'FinancialTransaction',
            {
              externalName: payment.description,
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

  private async fetchEngagements(integration: Integration): Promise<ToptalEngagement[]> {
    const response = await this.makeRequest<{
      engagements: ToptalEngagement[];
    }>(integration, 'GET', `${this.BASE_URL}/engagements`);

    return response.data.engagements ?? [];
  }

  private async fetchTimeLogs(
    integration: Integration,
    startDate: Date,
    endDate: Date
  ): Promise<ToptalTimeLog[]> {
    const params = new URLSearchParams({
      start_date: startDate.toISOString().split('T')[0] ?? '',
      end_date: endDate.toISOString().split('T')[0] ?? '',
    });

    const response = await this.makeRequest<{
      time_logs: ToptalTimeLog[];
    }>(integration, 'GET', `${this.BASE_URL}/time_logs?${params.toString()}`);

    return response.data.time_logs ?? [];
  }

  private async fetchPayments(integration: Integration, since?: Date): Promise<ToptalPayment[]> {
    const params = new URLSearchParams({
      limit: '100',
    });

    if (since) {
      params.set('from_date', since.toISOString().split('T')[0] ?? '');
    }

    const response = await this.makeRequest<{
      payments: ToptalPayment[];
    }>(integration, 'GET', `${this.BASE_URL}/payments?${params.toString()}`);

    return response.data.payments ?? [];
  }

  // =====================
  // Entity Creation Methods
  // =====================

  private async syncClient(
    integration: Integration,
    clientData: ToptalEngagement['client']
  ): Promise<string> {
    const existingMapping = await this.mappingRepo.findByExternalId(
      integration.id,
      'CLIENT',
      clientData.id
    );

    if (existingMapping) {
      return existingMapping.internalId;
    }

    const nameParts = clientData.contact_name.split(' ');

    const client = await this.prisma.client.create({
      data: {
        freelancerUserId: integration.userId,
        clientType: 'COMPANY',
        source: 'TOPTAL',
        companyName: clientData.company_name,
        firstName: nameParts[0] ?? 'Unknown',
        lastName: nameParts.slice(1).join(' ') || undefined,
        email: clientData.contact_email,
        tags: ['toptal'],
        customFields: {
          toptal_id: clientData.id,
          toptal_country: clientData.country,
        },
      },
    });

    await this.upsertMapping(integration, 'CLIENT', clientData.id, client.id, 'Client', {
      externalName: clientData.company_name,
      externalData: clientData as unknown as Record<string, unknown>,
    });

    return client.id;
  }

  private async createProjectFromEngagement(
    userId: string,
    engagement: ToptalEngagement,
    clientId: string
  ): Promise<{ id: string }> {
    const project = await this.prisma.cockpitProject.create({
      data: {
        freelancerUserId: userId,
        clientId,
        name: engagement.title,
        description: engagement.description,
        projectType: 'CLIENT_WORK',
        source: 'TOPTAL',
        status: this.mapEngagementStatus(engagement.status),
        startDate: new Date(engagement.start_date),
        dueDate: engagement.end_date ? new Date(engagement.end_date) : undefined,
        budgetType: engagement.type === 'hourly' ? 'HOURLY' : 'FIXED',
        hourlyRate: engagement.hourly_rate,
        budgetAmount: engagement.fixed_price,
        currency: engagement.currency,
        tags: ['toptal'],
        customFields: {
          toptal_engagement_id: engagement.id,
        },
      },
      select: { id: true },
    });

    return project;
  }

  private async updateProjectFromEngagement(
    projectId: string,
    engagement: ToptalEngagement
  ): Promise<void> {
    await this.prisma.cockpitProject.update({
      where: { id: projectId },
      data: {
        status: this.mapEngagementStatus(engagement.status),
        dueDate: engagement.end_date ? new Date(engagement.end_date) : undefined,
      },
    });
  }

  private async createTimeLogEntry(
    userId: string,
    log: ToptalTimeLog,
    projectId?: string
  ): Promise<{ id: string }> {
    const durationMinutes = Math.round(log.hours * 60);

    const timeEntry = await this.prisma.cockpitTimeEntry.create({
      data: {
        freelancerUserId: userId,
        projectId,
        date: new Date(log.date),
        durationMinutes,
        description: log.description || 'Toptal time log',
        category: log.task_type ?? 'Development',
        isBillable: true,
        trackingMethod: 'IMPORTED',
        tags: ['toptal'],
      },
      select: { id: true },
    });

    return timeEntry;
  }

  private async updateTimeLogEntry(entryId: string, log: ToptalTimeLog): Promise<void> {
    const durationMinutes = Math.round(log.hours * 60);

    await this.prisma.cockpitTimeEntry.update({
      where: { id: entryId },
      data: {
        durationMinutes,
        description: log.description,
      },
    });
  }

  private async createPaymentTransaction(
    userId: string,
    payment: ToptalPayment,
    projectId?: string,
    clientId?: string
  ): Promise<{ id: string }> {
    const transaction = await this.prisma.financialTransaction.create({
      data: {
        userId,
        type: 'INCOME',
        amount: payment.amount,
        currency: payment.currency,
        date: new Date(payment.date),
        description: `Toptal: ${payment.description}`,
        category: 'Client Payment',
        clientId,
        projectId,
        paymentMethod: 'Toptal',
        tags: ['toptal', payment.type],
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
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch {
      return false;
    }
  }

  async processWebhook(integration: Integration, webhook: WebhookPayload): Promise<void> {
    const { eventType } = webhook;

    switch (eventType) {
      case 'engagement.created':
      case 'engagement.updated':
      case 'engagement.ended':
        await this.sync(integration, { entityTypes: ['PROJECT'] });
        break;

      case 'time_log.submitted':
      case 'time_log.approved':
        await this.sync(integration, { entityTypes: ['TIME_ENTRY'] });
        break;

      case 'payment.completed':
        await this.sync(integration, { entityTypes: ['PAYMENT'] });
        break;

      default:
        this.logger.info({ eventType }, 'Unhandled Toptal webhook event');
    }
  }

  // =====================
  // Helper Methods
  // =====================

  private mapEngagementStatus(status: string): ProjectStatus {
    const statusMap: Record<string, ProjectStatus> = {
      active: 'IN_PROGRESS',
      paused: 'ON_HOLD',
      completed: 'COMPLETED',
      ended: 'COMPLETED',
      cancelled: 'CANCELLED',
    };
    return statusMap[status.toLowerCase()] ?? 'NOT_STARTED';
  }

  private generateHash(data: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }
}
