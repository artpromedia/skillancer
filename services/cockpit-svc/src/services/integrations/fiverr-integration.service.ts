/**
 * @module @skillancer/cockpit-svc/services/integrations/fiverr
 * Fiverr Integration Service - Sync orders, gigs, and earnings from Fiverr
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
// FIVERR-SPECIFIC TYPES
// ============================================================================

export interface FiverrGig {
  id: string;
  title: string;
  status: string;
  category: string;
  price: number;
  delivery_time: number;
  orders_in_queue: number;
}

export interface FiverrOrder {
  id: string;
  gig_id: string;
  status: string;
  created_at: string;
  delivery_date: string;
  price: number;
  buyer: {
    id: string;
    username: string;
    country: string;
  };
  requirements?: string;
}

export interface FiverrEarning {
  id: string;
  order_id?: string;
  date: string;
  amount: number;
  type: string;
  description?: string;
}

export interface FiverrSyncOptions {
  syncOrders?: boolean;
  syncEarnings?: boolean;
  autoCreateClients?: boolean;
}

type ProjectStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

// ============================================================================
// FIVERR INTEGRATION SERVICE
// ============================================================================

export class FiverrIntegrationService extends BaseIntegrationService {
  private readonly BASE_URL = 'https://api.fiverr.com/v1';
  private readonly OAUTH_URL = 'https://www.fiverr.com/oauth/authorize';
  private readonly TOKEN_URL = 'https://api.fiverr.com/v1/oauth/token';

  constructor(prisma: PrismaClient, logger: Logger, encryption: EncryptionService) {
    super(prisma, logger, encryption);
  }

  // =====================
  // Provider Identity
  // =====================

  get provider(): IntegrationProvider {
    return 'FIVERR';
  }

  get displayName(): string {
    return 'Fiverr';
  }

  // =====================
  // Configuration
  // =====================

  getOAuthConfig(): OAuthConfig | null {
    const clientId = process.env['FIVERR_CLIENT_ID'];
    const clientSecret = process.env['FIVERR_CLIENT_SECRET'];

    if (!clientId || !clientSecret) {
      return null;
    }

    return {
      authorizationUrl: this.OAUTH_URL,
      tokenUrl: this.TOKEN_URL,
      clientId,
      clientSecret,
      scopes: ['seller_orders', 'seller_earnings'],
    };
  }

  getApiKeyConfig(): ApiKeyConfig | null {
    // Fiverr does not support API key authentication
    return null;
  }

  getRateLimitConfig(): RateLimitConfig {
    return {
      maxRequests: 100,
      windowMs: 60000, // 100 requests per minute
    };
  }

  getSupportedSyncTypes(): string[] {
    return ['CLIENT', 'PROJECT', 'PAYMENT'];
  }

  getSupportedWebhookEvents(): string[] {
    return [
      'order.created',
      'order.updated',
      'order.completed',
      'order.cancelled',
      'earning.received',
    ];
  }

  // =====================
  // OAuth Methods
  // =====================

  getOAuthUrl(userId: string, state: string, redirectUri: string): string {
    const config = this.getOAuthConfig();
    if (!config) {
      throw new Error('Fiverr OAuth not configured');
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
      throw new Error('Fiverr OAuth not configured');
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
      this.logger.error({ error, status: response.status }, 'Fiverr token exchange failed');
      throw new Error('Failed to exchange Fiverr authorization code');
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
      throw new Error('Fiverr OAuth not configured');
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
      this.logger.error({ error, status: response.status }, 'Fiverr token refresh failed');
      throw new Error('Failed to refresh Fiverr access token');
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
      this.logger.warn({ error: (error as Error).message }, 'Failed to revoke Fiverr access');
    }
  }

  // =====================
  // API Key Methods
  // =====================

  async validateApiKey(_apiKey: string, _apiSecret?: string): Promise<boolean> {
    // Fiverr does not support API key authentication
    await Promise.resolve();
    return false;
  }

  // =====================
  // Account Methods
  // =====================

  async getAccountInfo(integration: Integration): Promise<AccountInfo> {
    const response = await this.makeRequest<{
      seller: {
        id: string;
        email: string;
        username: string;
        profile_image?: string;
        seller_level?: string;
        rating?: number;
        response_rate?: number;
      };
    }>(integration, 'GET', `${this.BASE_URL}/seller/me`);

    const seller = response.data.seller;

    return {
      id: seller.id,
      email: seller.email,
      name: seller.username,
      avatar: seller.profile_image,
      metadata: {
        seller_level: seller.seller_level,
        rating: seller.rating,
        response_rate: seller.response_rate,
      },
    };
  }

  // =====================
  // Sync Methods
  // =====================

  async sync(integration: Integration, options: SyncOptions): Promise<SyncResult> {
    const context = await this.createSyncContext(integration, options);
    const syncOptions = (integration.syncOptions as FiverrSyncOptions) ?? {};

    try {
      // Sync orders as projects
      if (!options.entityTypes || options.entityTypes.includes('PROJECT')) {
        if (syncOptions.syncOrders !== false) {
          await this.syncOrders(integration, context, options);
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

  private async syncOrders(
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
      const orders = await this.fetchOrders(integration, options.since);

      for (const order of orders) {
        context.recordsProcessed++;

        try {
          const existingMapping = await this.mappingRepo.findByExternalId(
            integration.id,
            'PROJECT',
            order.id
          );

          // Sync buyer as client
          const clientId = await this.syncBuyer(integration, order.buyer);

          if (existingMapping) {
            // Update existing
            const currentHash = this.generateHash(order);
            if (existingMapping.lastSyncHash !== currentHash) {
              await this.updateProjectFromOrder(existingMapping.internalId, order);
              await this.mappingRepo.update(existingMapping.id, {
                lastSyncAt: new Date(),
                lastSyncHash: currentHash,
              });
              context.recordsUpdated++;
            }
          } else {
            // Create new project
            const project = await this.createProjectFromOrder(integration.userId, order, clientId);

            await this.upsertMapping(
              integration,
              'PROJECT',
              order.id,
              project.id,
              'CockpitProject',
              {
                externalName: `Order #${order.id}`,
                externalData: order as unknown as Record<string, unknown>,
              }
            );

            context.recordsCreated++;
          }
        } catch (error) {
          context.recordsFailed++;
          context.errors.push({
            message: (error as Error).message,
            entity: `order:${order.id}`,
          });
        }
      }
    } catch (error) {
      context.errors.push({ message: (error as Error).message, entity: 'orders' });
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
      const earnings = await this.fetchEarnings(integration, options.since);

      for (const earning of earnings) {
        context.recordsProcessed++;

        try {
          const existingMapping = await this.mappingRepo.findByExternalId(
            integration.id,
            'PAYMENT',
            earning.id
          );

          if (existingMapping) {
            continue; // Earnings don't change
          }

          // Find related project
          let projectId: string | undefined;
          let clientId: string | undefined;

          if (earning.order_id) {
            const projectMapping = await this.mappingRepo.findByExternalId(
              integration.id,
              'PROJECT',
              earning.order_id
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

          const transaction = await this.createEarningTransaction(
            integration.userId,
            earning,
            projectId,
            clientId
          );

          await this.upsertMapping(
            integration,
            'PAYMENT',
            earning.id,
            transaction.id,
            'FinancialTransaction',
            {
              externalData: earning as unknown as Record<string, unknown>,
            }
          );

          context.recordsCreated++;
        } catch (error) {
          context.recordsFailed++;
          context.errors.push({
            message: (error as Error).message,
            entity: `earning:${earning.id}`,
          });
        }
      }
    } catch (error) {
      context.errors.push({ message: (error as Error).message, entity: 'earnings' });
    }
  }

  // =====================
  // API Fetch Methods
  // =====================

  async fetchOrders(integration: Integration, since?: Date): Promise<FiverrOrder[]> {
    const params = new URLSearchParams({
      limit: '100',
    });

    if (since) {
      params.set('created_after', since.toISOString());
    }

    const response = await this.makeRequest<{
      orders: FiverrOrder[];
    }>(integration, 'GET', `${this.BASE_URL}/seller/orders?${params.toString()}`);

    return response.data.orders ?? [];
  }

  async fetchEarnings(integration: Integration, since?: Date): Promise<FiverrEarning[]> {
    const params = new URLSearchParams({
      limit: '100',
    });

    if (since) {
      const dateStr = since.toISOString().split('T')[0];
      if (dateStr) {
        params.set('from_date', dateStr);
      }
    }

    const response = await this.makeRequest<{
      earnings: FiverrEarning[];
    }>(integration, 'GET', `${this.BASE_URL}/seller/earnings?${params.toString()}`);

    return response.data.earnings ?? [];
  }

  async fetchGigs(integration: Integration): Promise<FiverrGig[]> {
    const response = await this.makeRequest<{
      gigs: FiverrGig[];
    }>(integration, 'GET', `${this.BASE_URL}/seller/gigs`);

    return response.data.gigs ?? [];
  }

  // =====================
  // Entity Creation Methods
  // =====================

  private async syncBuyer(integration: Integration, buyer: FiverrOrder['buyer']): Promise<string> {
    const existingMapping = await this.mappingRepo.findByExternalId(
      integration.id,
      'CLIENT',
      buyer.id
    );

    if (existingMapping) {
      return existingMapping.internalId;
    }

    const client = await this.prisma.client.create({
      data: {
        freelancerUserId: integration.userId,
        clientType: 'INDIVIDUAL',
        source: 'FIVERR',
        firstName: buyer.username,
        tags: ['fiverr'],
        customFields: {
          fiverr_id: buyer.id,
          fiverr_username: buyer.username,
          fiverr_country: buyer.country,
        },
      },
    });

    await this.upsertMapping(integration, 'CLIENT', buyer.id, client.id, 'Client', {
      externalName: buyer.username,
      externalData: buyer as unknown as Record<string, unknown>,
    });

    return client.id;
  }

  private async createProjectFromOrder(
    userId: string,
    order: FiverrOrder,
    clientId: string
  ): Promise<{ id: string }> {
    const project = await this.prisma.cockpitProject.create({
      data: {
        freelancerUserId: userId,
        clientId,
        name: `Fiverr Order #${order.id}`,
        description: order.requirements,
        projectType: 'CLIENT_WORK',
        source: 'FIVERR',
        status: this.mapOrderStatus(order.status),
        startDate: new Date(order.created_at),
        dueDate: new Date(order.delivery_date),
        budgetType: 'FIXED',
        budgetAmount: order.price,
        currency: 'USD',
        tags: ['fiverr'],
        customFields: {
          fiverr_order_id: order.id,
          fiverr_gig_id: order.gig_id,
        },
      },
      select: { id: true },
    });

    return project;
  }

  private async updateProjectFromOrder(projectId: string, order: FiverrOrder): Promise<void> {
    await this.prisma.cockpitProject.update({
      where: { id: projectId },
      data: {
        status: this.mapOrderStatus(order.status),
        dueDate: new Date(order.delivery_date),
      },
    });
  }

  private async createEarningTransaction(
    userId: string,
    earning: FiverrEarning,
    projectId?: string,
    clientId?: string
  ): Promise<{ id: string }> {
    const transaction = await this.prisma.financialTransaction.create({
      data: {
        userId,
        type: 'INCOME',
        amount: earning.amount,
        currency: 'USD',
        date: new Date(earning.date),
        description: `Fiverr: Order #${earning.order_id ?? 'N/A'}`,
        category: 'Client Payment',
        clientId,
        projectId,
        paymentMethod: 'Fiverr',
        tags: ['fiverr'],
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
      case 'order.created':
      case 'order.updated':
      case 'order.completed':
      case 'order.cancelled':
        await this.sync(integration, { entityTypes: ['PROJECT'] });
        break;

      case 'earning.received':
        await this.sync(integration, { entityTypes: ['PAYMENT'] });
        break;

      default:
        this.logger.info({ eventType }, 'Unhandled Fiverr webhook event');
    }
  }

  // =====================
  // Helper Methods
  // =====================

  private mapOrderStatus(fiverrStatus: string): ProjectStatus {
    const statusMap: Record<string, ProjectStatus> = {
      pending: 'NOT_STARTED',
      in_progress: 'IN_PROGRESS',
      delivered: 'IN_PROGRESS',
      completed: 'COMPLETED',
      cancelled: 'CANCELLED',
      late: 'IN_PROGRESS',
    };
    return statusMap[fiverrStatus.toLowerCase()] ?? 'IN_PROGRESS';
  }

  private generateHash(data: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }
}
