/**
 * @module @skillancer/cockpit-svc/services/integrations/upwork
 * Upwork Integration Service - Sync contracts, time entries, and earnings from Upwork
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
// UPWORK-SPECIFIC TYPES
// ============================================================================

export interface UpworkContract {
  reference: string;
  title: string;
  status: string;
  job_type: string;
  engagement_start_date: string;
  engagement_end_date?: string;
  hourly_rate?: string;
  fixed_price_contract?: boolean;
  budget?: string;
  client: {
    reference: string;
    name: string;
    country: string;
    feedback_score?: number;
  };
  company: {
    reference: string;
    name: string;
  };
}

export interface UpworkTimeEntry {
  reference: string;
  contract_reference: string;
  worked_on: string;
  hours: string;
  charge: string;
  memo: string;
  task?: {
    code: string;
    description: string;
  };
}

export interface UpworkEarning {
  reference: string;
  date: string;
  type: string;
  amount: string;
  description: string;
  contract_reference?: string;
}

export interface UpworkSyncOptions {
  syncContracts?: boolean;
  syncTimeEntries?: boolean;
  syncEarnings?: boolean;
  autoCreateClients?: boolean;
}

type ProjectStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

// ============================================================================
// UPWORK INTEGRATION SERVICE
// ============================================================================

export class UpworkIntegrationService extends BaseIntegrationService {
  private readonly BASE_URL = 'https://www.upwork.com/api';
  private readonly OAUTH_URL = 'https://www.upwork.com/ab/account-security/oauth2/authorize';
  private readonly TOKEN_URL = 'https://www.upwork.com/api/v3/oauth2/token';

  constructor(prisma: PrismaClient, logger: Logger, encryption: EncryptionService) {
    super(prisma, logger, encryption);
  }

  // =====================
  // Provider Identity
  // =====================

  get provider(): IntegrationProvider {
    return 'UPWORK';
  }

  get displayName(): string {
    return 'Upwork';
  }

  // =====================
  // Configuration
  // =====================

  getOAuthConfig(): OAuthConfig | null {
    const clientId = process.env['UPWORK_CLIENT_ID'];
    const clientSecret = process.env['UPWORK_CLIENT_SECRET'];

    if (!clientId || !clientSecret) {
      return null;
    }

    return {
      authorizationUrl: this.OAUTH_URL,
      tokenUrl: this.TOKEN_URL,
      clientId,
      clientSecret,
      scopes: [],
    };
  }

  getApiKeyConfig(): ApiKeyConfig | null {
    // Upwork does not support API key authentication
    return null;
  }

  getRateLimitConfig(): RateLimitConfig {
    return {
      maxRequests: 60,
      windowMs: 60000, // 60 requests per minute
    };
  }

  getSupportedSyncTypes(): string[] {
    return ['CLIENT', 'PROJECT', 'TIME_ENTRY', 'PAYMENT'];
  }

  getSupportedWebhookEvents(): string[] {
    return [
      'engagement.created',
      'engagement.updated',
      'time.submitted',
      'time.approved',
      'payment.received',
    ];
  }

  // =====================
  // OAuth Methods
  // =====================

  getOAuthUrl(userId: string, state: string, redirectUri: string): string {
    const config = this.getOAuthConfig();
    if (!config) {
      throw new Error('Upwork OAuth not configured');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: redirectUri,
      state,
    });

    return `${this.OAUTH_URL}?${params.toString()}`;
  }

  async exchangeAuthCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();
    if (!config) {
      throw new Error('Upwork OAuth not configured');
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
      this.logger.error({ error, status: response.status }, 'Upwork token exchange failed');
      throw new Error('Failed to exchange Upwork authorization code');
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
      scope?: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();
    if (!config) {
      throw new Error('Upwork OAuth not configured');
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
      this.logger.error({ error, status: response.status }, 'Upwork token refresh failed');
      throw new Error('Failed to refresh Upwork access token');
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

  async revokeAccess(accessToken: string): Promise<void> {
    const config = this.getOAuthConfig();
    if (!config) return;

    try {
      await fetch(`${this.BASE_URL}/v3/oauth2/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token: accessToken,
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }),
      });
    } catch (error) {
      this.logger.warn({ error: (error as Error).message }, 'Failed to revoke Upwork access');
    }
  }

  // =====================
  // API Key Methods
  // =====================

  async validateApiKey(_apiKey: string, _apiSecret?: string): Promise<boolean> {
    // Upwork does not support API key authentication
    await Promise.resolve();
    return false;
  }

  // =====================
  // Account Methods
  // =====================

  async getAccountInfo(integration: Integration): Promise<AccountInfo> {
    const response = await this.makeRequest<{
      contractor: {
        reference: string;
        email: string;
        first_name: string;
        last_name: string;
        portrait_url?: string;
        profile_key: string;
        title?: string;
        dev_profile_title?: string;
      };
    }>(integration, 'GET', `${this.BASE_URL}/v3/contractor/my/info`);

    const user = response.data.contractor;

    return {
      id: user.reference,
      email: user.email,
      name: `${user.first_name} ${user.last_name}`,
      avatar: user.portrait_url,
      metadata: {
        profile_key: user.profile_key,
        title: user.title,
        dev_profile_title: user.dev_profile_title,
      },
    };
  }

  // =====================
  // Sync Methods
  // =====================

  async sync(integration: Integration, options: SyncOptions): Promise<SyncResult> {
    const context = await this.createSyncContext(integration, options);
    const syncOptions = (integration.syncOptions as UpworkSyncOptions) ?? {};

    try {
      // Sync contracts as projects
      if (!options.entityTypes || options.entityTypes.includes('PROJECT')) {
        if (syncOptions.syncContracts !== false) {
          await this.syncContracts(integration, context, options);
        }
      }

      // Sync time entries
      if (!options.entityTypes || options.entityTypes.includes('TIME_ENTRY')) {
        if (syncOptions.syncTimeEntries !== false) {
          await this.syncTimeEntries(integration, context, options);
        }
      }

      // Sync earnings
      if (!options.entityTypes || options.entityTypes.includes('PAYMENT')) {
        if (syncOptions.syncEarnings !== false) {
          await this.syncEarnings(integration, context, options);
        }
      }

      return await this.completeSyncContext(context, true);
    } catch (error) {
      context.errors.push({ message: (error as Error).message, entity: 'sync' });
      return await this.completeSyncContext(context, false);
    }
  }

  private async syncContracts(
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
      const contracts = await this.fetchContracts(integration);

      for (const contract of contracts) {
        context.recordsProcessed++;

        try {
          // Check for existing mapping
          const existingMapping = await this.mappingRepo.findByExternalId(
            integration.id,
            'PROJECT',
            contract.reference
          );

          // Sync client first
          const clientId = await this.syncClient(integration, contract.client, contract.company);

          if (existingMapping) {
            // Update existing - check hash for changes
            const currentHash = this.generateHash(contract);
            if (existingMapping.lastSyncHash !== currentHash) {
              await this.updateProjectFromContract(existingMapping.internalId, contract);
              await this.mappingRepo.update(existingMapping.id, {
                lastSyncAt: new Date(),
                lastSyncHash: currentHash,
                externalData: contract as unknown as Record<string, unknown>,
              });
              context.recordsUpdated++;
            }
          } else {
            // Create new project
            const project = await this.createProjectFromContract(
              integration.userId,
              contract,
              clientId
            );

            await this.upsertMapping(
              integration,
              'PROJECT',
              contract.reference,
              project.id,
              'CockpitProject',
              {
                externalType: contract.job_type,
                externalName: contract.title,
                externalData: contract as unknown as Record<string, unknown>,
              }
            );

            context.recordsCreated++;
          }
        } catch (error) {
          context.recordsFailed++;
          context.errors.push({
            message: (error as Error).message,
            entity: `contract:${contract.reference}`,
          });
        }
      }
    } catch (error) {
      context.errors.push({ message: (error as Error).message, entity: 'contracts' });
    }
  }

  private async syncTimeEntries(
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
        ? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // 1 year
        : (options.since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)); // 7 days

      const timeEntries = await this.fetchTimeEntries(integration, startDate, endDate);

      for (const entry of timeEntries) {
        context.recordsProcessed++;

        try {
          const existingMapping = await this.mappingRepo.findByExternalId(
            integration.id,
            'TIME_ENTRY',
            entry.reference
          );

          // Find project mapping
          const projectMapping = await this.mappingRepo.findByExternalId(
            integration.id,
            'PROJECT',
            entry.contract_reference
          );

          if (existingMapping) {
            const currentHash = this.generateHash(entry);
            if (existingMapping.lastSyncHash !== currentHash) {
              await this.updateTimeEntryFromUpwork(
                existingMapping.internalId,
                entry,
                projectMapping?.internalId
              );
              await this.mappingRepo.update(existingMapping.id, {
                lastSyncAt: new Date(),
                lastSyncHash: currentHash,
              });
              context.recordsUpdated++;
            }
          } else {
            const timeEntry = await this.createTimeEntryFromUpwork(
              integration.userId,
              entry,
              projectMapping?.internalId
            );

            await this.upsertMapping(
              integration,
              'TIME_ENTRY',
              entry.reference,
              timeEntry.id,
              'CockpitTimeEntry',
              {
                externalName: entry.memo,
                externalData: entry as unknown as Record<string, unknown>,
              }
            );

            context.recordsCreated++;
          }
        } catch (error) {
          context.recordsFailed++;
          context.errors.push({
            message: (error as Error).message,
            entity: `time_entry:${entry.reference}`,
          });
        }
      }
    } catch (error) {
      context.errors.push({ message: (error as Error).message, entity: 'time_entries' });
    }
  }

  private async syncEarnings(
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
        ? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // 1 year
        : (options.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // 30 days

      const earnings = await this.fetchEarnings(integration, startDate, endDate);

      for (const earning of earnings) {
        context.recordsProcessed++;

        try {
          // Only sync actual earnings
          if (earning.type !== 'fixed_price' && earning.type !== 'hourly') {
            continue;
          }

          const existingMapping = await this.mappingRepo.findByExternalId(
            integration.id,
            'PAYMENT',
            earning.reference
          );

          if (existingMapping) {
            continue; // Earnings don't change once recorded
          }

          // Find related project
          let projectId: string | undefined;
          let clientId: string | undefined;

          if (earning.contract_reference) {
            const projectMapping = await this.mappingRepo.findByExternalId(
              integration.id,
              'PROJECT',
              earning.contract_reference
            );
            if (projectMapping) {
              projectId = projectMapping.internalId;
              // Get client from project
              const project = await this.prisma.cockpitProject.findUnique({
                where: { id: projectId },
                select: { clientId: true },
              });
              clientId = project?.clientId ?? undefined;
            }
          }

          // Create income transaction
          const transaction = await this.createEarningTransaction(
            integration.userId,
            earning,
            projectId,
            clientId
          );

          await this.upsertMapping(
            integration,
            'PAYMENT',
            earning.reference,
            transaction.id,
            'FinancialTransaction',
            {
              externalName: earning.description,
              externalData: earning as unknown as Record<string, unknown>,
            }
          );

          context.recordsCreated++;
        } catch (error) {
          context.recordsFailed++;
          context.errors.push({
            message: (error as Error).message,
            entity: `earning:${earning.reference}`,
          });
        }
      }
    } catch (error) {
      context.errors.push({ message: (error as Error).message, entity: 'earnings' });
    }
  }

  // =====================
  // API Fetch Methods (Public for route access)
  // =====================

  async fetchContracts(integration: Integration): Promise<UpworkContract[]> {
    const contracts: UpworkContract[] = [];
    let offset = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
      const response = await this.makeRequest<{
        engagements: UpworkContract[];
      }>(
        integration,
        'GET',
        `${this.BASE_URL}/v3/contractor/engagements?include_sub_teams=true&offset=${offset}&limit=${limit}`
      );

      const engagements = response.data.engagements ?? [];
      contracts.push(...engagements);

      hasMore = engagements.length === limit;
      offset += limit;

      // Rate limiting
      if (hasMore) {
        await this.sleep(500);
      }
    }

    return contracts;
  }

  async fetchTimeEntries(
    integration: Integration,
    startDate: Date,
    endDate: Date
  ): Promise<UpworkTimeEntry[]> {
    const entries: UpworkTimeEntry[] = [];

    // Upwork requires fetching per week
    const current = new Date(startDate);
    while (current <= endDate) {
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const effectiveEndDate = new Date(Math.min(weekEnd.getTime(), endDate.getTime()));

      const response = await this.makeRequest<{
        hours: UpworkTimeEntry[];
      }>(
        integration,
        'GET',
        `${this.BASE_URL}/v3/contractor/hours?start_date=${this.formatDate(current)}&end_date=${this.formatDate(effectiveEndDate)}`
      );

      const weekEntries = response.data.hours ?? [];
      entries.push(...weekEntries);

      current.setDate(current.getDate() + 7);

      // Rate limiting
      await this.sleep(200);
    }

    return entries;
  }

  async fetchEarnings(
    integration: Integration,
    startDate: Date,
    endDate: Date
  ): Promise<UpworkEarning[]> {
    const response = await this.makeRequest<{
      earnings: UpworkEarning[];
    }>(
      integration,
      'GET',
      `${this.BASE_URL}/v3/contractor/earnings?start_date=${this.formatDate(startDate)}&end_date=${this.formatDate(endDate)}`
    );

    return response.data.earnings ?? [];
  }

  // =====================
  // Entity Creation Methods
  // =====================

  private async syncClient(
    integration: Integration,
    clientData: UpworkContract['client'],
    companyData: UpworkContract['company']
  ): Promise<string> {
    const existingMapping = await this.mappingRepo.findByExternalId(
      integration.id,
      'CLIENT',
      clientData.reference
    );

    if (existingMapping) {
      return existingMapping.internalId;
    }

    // Parse client name
    const nameParts = clientData.name.split(' ');
    const firstName = nameParts[0] ?? 'Unknown';
    const lastName = nameParts.slice(1).join(' ') || undefined;

    // Create client
    const client = await this.prisma.client.create({
      data: {
        freelancerUserId: integration.userId,
        clientType: companyData ? 'COMPANY' : 'INDIVIDUAL',
        source: 'UPWORK',
        companyName: companyData?.name,
        firstName,
        lastName,
        tags: ['upwork'],
        customFields: {
          upwork_reference: clientData.reference,
          upwork_country: clientData.country,
          upwork_feedback_score: clientData.feedback_score,
        },
      },
    });

    await this.upsertMapping(integration, 'CLIENT', clientData.reference, client.id, 'Client', {
      externalName: clientData.name,
      externalData: { client: clientData, company: companyData } as unknown as Record<
        string,
        unknown
      >,
    });

    return client.id;
  }

  private async createProjectFromContract(
    userId: string,
    contract: UpworkContract,
    clientId: string
  ): Promise<{ id: string }> {
    const isHourly = !contract.fixed_price_contract;

    const project = await this.prisma.cockpitProject.create({
      data: {
        freelancerUserId: userId,
        clientId,
        name: contract.title,
        projectType: 'CLIENT_WORK',
        source: 'UPWORK',
        status: this.mapContractStatus(contract.status),
        startDate: contract.engagement_start_date
          ? new Date(contract.engagement_start_date)
          : undefined,
        dueDate: contract.engagement_end_date ? new Date(contract.engagement_end_date) : undefined,
        budgetType: isHourly ? 'HOURLY' : 'FIXED',
        hourlyRate:
          isHourly && contract.hourly_rate ? Number.parseFloat(contract.hourly_rate) : undefined,
        budgetAmount: !isHourly && contract.budget ? Number.parseFloat(contract.budget) : undefined,
        currency: 'USD',
        tags: ['upwork'],
        customFields: {
          upwork_reference: contract.reference,
          upwork_job_type: contract.job_type,
        },
      },
      select: { id: true },
    });

    return project;
  }

  private async updateProjectFromContract(
    projectId: string,
    contract: UpworkContract
  ): Promise<void> {
    const newStatus = this.mapContractStatus(contract.status);

    await this.prisma.cockpitProject.update({
      where: { id: projectId },
      data: {
        status: newStatus,
        dueDate: contract.engagement_end_date ? new Date(contract.engagement_end_date) : undefined,
      },
    });
  }

  private async createTimeEntryFromUpwork(
    userId: string,
    entry: UpworkTimeEntry,
    projectId?: string
  ): Promise<{ id: string }> {
    const hours = Number.parseFloat(entry.hours);
    const durationMinutes = Math.round(hours * 60);
    const charge = Number.parseFloat(entry.charge);

    const timeEntry = await this.prisma.cockpitTimeEntry.create({
      data: {
        freelancerUserId: userId,
        projectId,
        date: new Date(entry.worked_on),
        durationMinutes,
        description: entry.memo || 'Upwork time entry',
        category: entry.task?.description ?? 'Development',
        isBillable: true,
        hourlyRate: hours > 0 ? charge / hours : 0,
        trackingMethod: 'IMPORTED',
        tags: ['upwork'],
      },
      select: { id: true },
    });

    return timeEntry;
  }

  private async updateTimeEntryFromUpwork(
    entryId: string,
    entry: UpworkTimeEntry,
    _projectId?: string
  ): Promise<void> {
    const hours = Number.parseFloat(entry.hours);
    const durationMinutes = Math.round(hours * 60);

    await this.prisma.cockpitTimeEntry.update({
      where: { id: entryId },
      data: {
        durationMinutes,
        description: entry.memo,
      },
    });
  }

  private async createEarningTransaction(
    userId: string,
    earning: UpworkEarning,
    projectId?: string,
    clientId?: string
  ): Promise<{ id: string }> {
    const transaction = await this.prisma.financialTransaction.create({
      data: {
        userId,
        type: 'INCOME',
        amount: Number.parseFloat(earning.amount),
        currency: 'USD',
        date: new Date(earning.date),
        description: `Upwork: ${earning.description}`,
        category: 'Client Payment',
        clientId,
        projectId,
        paymentMethod: 'Upwork',
        tags: ['upwork', earning.type],
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
        await this.sync(integration, { entityTypes: ['PROJECT'] });
        break;

      case 'time.submitted':
      case 'time.approved':
        await this.sync(integration, { entityTypes: ['TIME_ENTRY'] });
        break;

      case 'payment.received':
        await this.sync(integration, { entityTypes: ['PAYMENT'] });
        break;

      default:
        this.logger.info({ eventType }, 'Unhandled Upwork webhook event');
    }
  }

  // =====================
  // Helper Methods
  // =====================

  private mapContractStatus(upworkStatus: string): ProjectStatus {
    const statusMap: Record<string, ProjectStatus> = {
      active: 'IN_PROGRESS',
      paused: 'ON_HOLD',
      ended: 'COMPLETED',
      closed: 'COMPLETED',
    };
    return statusMap[upworkStatus.toLowerCase()] ?? 'NOT_STARTED';
  }

  private formatDate(date: Date): string {
    const dateStr = date.toISOString().split('T')[0];
    return dateStr ?? '';
  }

  private generateHash(data: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }
}
