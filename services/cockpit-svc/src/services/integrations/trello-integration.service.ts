/**
 * @module @skillancer/cockpit-svc/services/integrations/trello
 * Trello Integration Service - Sync boards, lists, and cards from Trello
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
// TRELLO-SPECIFIC TYPES
// ============================================================================

export interface TrelloBoard {
  id: string;
  name: string;
  desc: string;
  closed: boolean;
  url: string;
  prefs: {
    backgroundColor?: string;
    backgroundImage?: string;
  };
  dateLastActivity?: string;
}

export interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
  idBoard: string;
  pos: number;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  closed: boolean;
  idBoard: string;
  idList: string;
  url: string;
  due?: string;
  dueComplete: boolean;
  labels: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  idMembers: string[];
  pos: number;
  dateLastActivity: string;
  checklists?: TrelloChecklist[];
}

export interface TrelloChecklist {
  id: string;
  name: string;
  idCard: string;
  checkItems: Array<{
    id: string;
    name: string;
    state: 'complete' | 'incomplete';
  }>;
}

export interface TrelloMember {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  email?: string;
}

export interface TrelloSyncOptions {
  syncBoards?: boolean;
  syncCards?: boolean;
  boardIds?: string[];
  autoCreateProjects?: boolean;
  mapListsToStatuses?: boolean;
}

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED';

// ============================================================================
// TRELLO INTEGRATION SERVICE
// ============================================================================

export class TrelloIntegrationService extends BaseIntegrationService {
  private readonly BASE_URL = 'https://api.trello.com/1';
  private readonly OAUTH_URL = 'https://trello.com/1/authorize';
  private readonly TOKEN_URL = 'https://trello.com/1/OAuthGetAccessToken';

  constructor(prisma: PrismaClient, logger: Logger, encryption: EncryptionService) {
    super(prisma, logger, encryption);
  }

  // =====================
  // Provider Identity
  // =====================

  get provider(): IntegrationProvider {
    return 'TRELLO';
  }

  get displayName(): string {
    return 'Trello';
  }

  // =====================
  // Configuration
  // =====================

  getOAuthConfig(): OAuthConfig | null {
    const apiKey = process.env['TRELLO_API_KEY'];
    const apiSecret = process.env['TRELLO_API_SECRET'];

    if (!apiKey || !apiSecret) {
      return null;
    }

    // Trello uses OAuth 1.0a, but we'll use their simplified token flow
    return {
      authorizationUrl: this.OAUTH_URL,
      tokenUrl: this.TOKEN_URL,
      clientId: apiKey,
      clientSecret: apiSecret,
      scopes: ['read', 'write'],
    };
  }

  getApiKeyConfig(): ApiKeyConfig | null {
    // Trello supports API key + token authentication
    return {
      headerName: 'Authorization',
      prefix: 'OAuth ',
      requiresSecret: true,
      additionalFields: [
        {
          name: 'token',
          label: 'API Token',
          type: 'password',
          required: true,
        },
      ],
    };
  }

  getRateLimitConfig() {
    return {
      maxRequests: 100,
      windowMs: 10000, // 100 requests per 10 seconds
    };
  }

  getSupportedSyncTypes(): string[] {
    return ['PROJECT', 'TASK'];
  }

  getSupportedWebhookEvents(): string[] {
    return [
      'createCard',
      'updateCard',
      'deleteCard',
      'addMemberToCard',
      'removeMemberFromCard',
      'updateCheckItemStateOnCard',
    ];
  }

  // =====================
  // OAuth Methods (Simplified Token Flow)
  // =====================

  getOAuthUrl(userId: string, state: string, redirectUri: string): string {
    const config = this.getOAuthConfig();
    if (!config) {
      throw new Error('Trello OAuth not configured');
    }

    const params = new URLSearchParams({
      key: config.clientId,
      name: 'Skillancer',
      scope: 'read,write',
      expiration: 'never',
      response_type: 'token',
      callback_method: 'fragment',
      return_url: `${redirectUri}?state=${state}`,
    });

    return `${this.OAUTH_URL}?${params.toString()}`;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async exchangeAuthCode(code: string, _redirectUri: string): Promise<OAuthTokens> {
    // Trello's simplified flow returns the token directly via fragment
    // The "code" here is actually the token from the redirect
    return {
      accessToken: code,
      // Trello tokens with expiration='never' don't expire
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async refreshAccessToken(_refreshToken: string): Promise<OAuthTokens> {
    // Trello tokens with expiration='never' don't need refresh
    throw new Error('Trello tokens do not require refresh');
  }

  async revokeAccess(accessToken: string): Promise<void> {
    const config = this.getOAuthConfig();
    if (!config) {
      throw new Error('Trello OAuth not configured');
    }

    try {
      await fetch(`${this.BASE_URL}/tokens/${accessToken}?key=${config.clientId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      this.logger.warn({ error: (error as Error).message }, 'Failed to revoke Trello access');
    }
  }

  // =====================
  // API Key Methods
  // =====================

  async validateApiKey(apiKey: string, apiSecret?: string): Promise<boolean> {
    if (!apiSecret) return false;

    try {
      const response = await fetch(`${this.BASE_URL}/members/me?key=${apiKey}&token=${apiSecret}`);
      return response.ok;
    } catch {
      return false;
    }
  }

  // =====================
  // Account Methods
  // =====================

  async getAccountInfo(integration: Integration): Promise<AccountInfo> {
    const response = await this.makeRequest<TrelloMember>(
      integration,
      'GET',
      `${this.BASE_URL}/members/me`
    );

    const member = response.data;

    return {
      id: member.id,
      email: member.email,
      name: member.fullName,
      avatar: member.avatarUrl ? `${member.avatarUrl}/50.png` : undefined,
      metadata: {
        username: member.username,
      },
    };
  }

  // =====================
  // Sync Methods
  // =====================

  async sync(integration: Integration, options: SyncOptions): Promise<SyncResult> {
    const context = await this.createSyncContext(integration, options);
    const syncOptions = (integration.syncOptions as TrelloSyncOptions) ?? {};

    try {
      // Sync boards as projects
      if (!options.entityTypes || options.entityTypes.includes('PROJECT')) {
        if (syncOptions.syncBoards !== false) {
          await this.syncBoards(integration, context, syncOptions);
        }
      }

      // Sync cards as tasks
      if (!options.entityTypes || options.entityTypes.includes('TASK')) {
        if (syncOptions.syncCards !== false) {
          await this.syncCards(integration, context, options, syncOptions);
        }
      }

      return await this.completeSyncContext(context, true);
    } catch (error) {
      context.errors.push({ message: (error as Error).message, entity: 'sync' });
      return await this.completeSyncContext(context, false);
    }
  }

  private async syncBoards(
    integration: Integration,
    context: {
      recordsProcessed: number;
      recordsCreated: number;
      recordsUpdated: number;
      recordsFailed: number;
      errors: Array<{ message: string; entity?: string }>;
    },
    syncOptions: TrelloSyncOptions
  ): Promise<void> {
    try {
      const boards = await this.fetchBoards(integration, syncOptions.boardIds);

      for (const board of boards) {
        if (board.closed) continue; // Skip archived boards

        context.recordsProcessed++;

        try {
          const existingMapping = await this.mappingRepo.findByExternalId(
            integration.id,
            'PROJECT',
            board.id
          );

          if (existingMapping) {
            await this.updateProjectFromBoard(existingMapping.internalId, board);
            await this.mappingRepo.updateLastSync(existingMapping.id);
            context.recordsUpdated++;
          } else {
            const project = await this.createProjectFromBoard(integration.userId, board);

            await this.upsertMapping(
              integration,
              'PROJECT',
              board.id,
              project.id,
              'CockpitProject',
              {
                externalName: board.name,
                externalData: board as unknown as Record<string, unknown>,
              }
            );

            context.recordsCreated++;
          }

          // Sync lists for status mapping
          await this.syncBoardLists(integration, board.id);
        } catch (error) {
          context.recordsFailed++;
          context.errors.push({
            message: (error as Error).message,
            entity: `board:${board.id}`,
          });
        }
      }
    } catch (error) {
      context.errors.push({ message: (error as Error).message, entity: 'boards' });
    }
  }

  private async syncBoardLists(integration: Integration, boardId: string): Promise<void> {
    try {
      const lists = await this.fetchLists(integration, boardId);

      for (const list of lists) {
        if (list.closed) continue;

        const existingMapping = await this.mappingRepo.findByExternalId(
          integration.id,
          'TASK',
          `list:${list.id}`
        );

        if (!existingMapping) {
          // Store list info for status mapping
          await this.prisma.integrationMapping.create({
            data: {
              integrationId: integration.id,
              entityType: 'TASK',
              externalId: `list:${list.id}`,
              internalId: list.id, // Using list ID as internal ID for reference
              internalType: 'TrelloList',
              externalName: list.name,
              externalData: list as unknown as object,
            },
          });
        }
      }
    } catch (error) {
      this.logger.warn({ error, boardId }, 'Failed to sync Trello lists');
    }
  }

  private async processCard(
    integration: Integration,
    card: TrelloCard,
    projectId: string,
    listStatusMap: Map<string, TaskStatus>,
    context: {
      recordsProcessed: number;
      recordsCreated: number;
      recordsUpdated: number;
      recordsFailed: number;
      errors: Array<{ message: string; entity?: string }>;
    }
  ): Promise<void> {
    const existingCardMapping = await this.mappingRepo.findByExternalId(
      integration.id,
      'TASK',
      card.id
    );

    const status = listStatusMap.get(card.idList) ?? this.inferCardStatus(card);

    if (existingCardMapping) {
      await this.updateTaskFromCard(existingCardMapping.internalId, card, status);
      await this.mappingRepo.updateLastSync(existingCardMapping.id);
      context.recordsUpdated++;
    } else {
      const task = await this.createTaskFromCard(integration.userId, card, projectId, status);

      await this.upsertMapping(integration, 'TASK', card.id, task.id, 'ProjectTask', {
        externalName: card.name,
        externalData: card as unknown as Record<string, unknown>,
      });

      context.recordsCreated++;
    }
  }

  private async syncCards(
    integration: Integration,
    context: {
      recordsProcessed: number;
      recordsCreated: number;
      recordsUpdated: number;
      recordsFailed: number;
      errors: Array<{ message: string; entity?: string }>;
    },
    options: SyncOptions,
    _syncOptions: TrelloSyncOptions
  ): Promise<void> {
    try {
      // Get all synced project mappings to find their board IDs
      const projectMappings = await this.prisma.integrationMapping.findMany({
        where: {
          integrationId: integration.id,
          entityType: 'PROJECT',
          internalType: 'CockpitProject',
        },
      });

      for (const mapping of projectMappings) {
        try {
          const cards = await this.fetchCards(integration, mapping.externalId, options.since);

          // Get lists for status mapping
          const listMappings = await this.prisma.integrationMapping.findMany({
            where: {
              integrationId: integration.id,
              entityType: 'TASK',
              externalId: { startsWith: 'list:' },
              externalData: { path: ['idBoard'], equals: mapping.externalId },
            },
          });

          const listStatusMap = this.buildListStatusMap(listMappings);

          for (const card of cards) {
            if (card.closed) continue;

            context.recordsProcessed++;

            try {
              await this.processCard(integration, card, mapping.internalId, listStatusMap, context);
            } catch (error) {
              context.recordsFailed++;
              context.errors.push({
                message: (error as Error).message,
                entity: `card:${card.id}`,
              });
            }
          }
        } catch (error) {
          context.errors.push({
            message: (error as Error).message,
            entity: `board:${mapping.externalId}`,
          });
        }
      }
    } catch (error) {
      context.errors.push({ message: (error as Error).message, entity: 'cards' });
    }
  }

  // =====================
  // API Fetch Methods
  // =====================

  async fetchBoards(integration: Integration, boardIds?: string[]): Promise<TrelloBoard[]> {
    if (boardIds && boardIds.length > 0) {
      const boards: TrelloBoard[] = [];
      for (const id of boardIds) {
        try {
          const response = await this.makeRequest<TrelloBoard>(
            integration,
            'GET',
            `${this.BASE_URL}/boards/${id}`
          );
          boards.push(response.data);
          await this.sleep(100);
        } catch (error) {
          this.logger.warn({ error, boardId: id }, 'Failed to fetch Trello board');
        }
      }
      return boards;
    }

    const response = await this.makeRequest<TrelloBoard[]>(
      integration,
      'GET',
      `${this.BASE_URL}/members/me/boards?filter=open`
    );

    return response.data;
  }

  async fetchLists(integration: Integration, boardId: string): Promise<TrelloList[]> {
    const response = await this.makeRequest<TrelloList[]>(
      integration,
      'GET',
      `${this.BASE_URL}/boards/${boardId}/lists?filter=open`
    );

    return response.data;
  }

  async fetchCards(integration: Integration, boardId: string, since?: Date): Promise<TrelloCard[]> {
    let url = `${this.BASE_URL}/boards/${boardId}/cards?filter=visible&attachments=false&checklists=all`;

    if (since) {
      url += `&since=${since.toISOString()}`;
    }

    const response = await this.makeRequest<TrelloCard[]>(integration, 'GET', url);

    return response.data;
  }

  async fetchCard(integration: Integration, cardId: string): Promise<TrelloCard> {
    const response = await this.makeRequest<TrelloCard>(
      integration,
      'GET',
      `${this.BASE_URL}/cards/${cardId}?checklists=all`
    );

    return response.data;
  }

  // =====================
  // Entity Creation Methods
  // =====================

  private async createProjectFromBoard(
    userId: string,
    board: TrelloBoard
  ): Promise<{ id: string }> {
    const project = await this.prisma.cockpitProject.create({
      data: {
        freelancerUserId: userId,
        name: board.name,
        description: board.desc || undefined,
        projectType: 'INTERNAL',
        source: 'OTHER_PLATFORM',
        status: 'IN_PROGRESS',
        tags: ['trello'],
        customFields: {
          trello_board_id: board.id,
          trello_url: board.url,
        },
      },
      select: { id: true },
    });

    return project;
  }

  private async updateProjectFromBoard(projectId: string, board: TrelloBoard): Promise<void> {
    await this.prisma.cockpitProject.update({
      where: { id: projectId },
      data: {
        name: board.name,
        description: board.desc || undefined,
        status: board.closed ? 'COMPLETED' : 'IN_PROGRESS',
      },
    });
  }

  private async createTaskFromCard(
    userId: string,
    card: TrelloCard,
    projectId: string,
    status: TaskStatus
  ): Promise<{ id: string }> {
    const labels = card.labels.map((l) => l.name).filter(Boolean);

    const task = await this.prisma.projectTask.create({
      data: {
        projectId,
        title: card.name,
        description: card.desc || undefined,
        status,
        priority: this.inferCardPriority(card),
        dueDate: card.due ? new Date(card.due) : undefined,
        tags: ['trello', ...labels],
      },
      select: { id: true },
    });

    return task;
  }

  private async updateTaskFromCard(
    taskId: string,
    card: TrelloCard,
    status: TaskStatus
  ): Promise<void> {
    await this.prisma.projectTask.update({
      where: { id: taskId },
      data: {
        title: card.name,
        description: card.desc || undefined,
        status,
        dueDate: card.due ? new Date(card.due) : undefined,
      },
    });
  }

  // =====================
  // Webhook Methods
  // =====================

  verifyWebhookSignature(payload: string | Buffer, signature: string, secret: string): boolean {
    const payloadString = typeof payload === 'string' ? payload : payload.toString();
    const callbackUrl = secret; // Trello uses callback URL as part of signature

    const expectedSignature = crypto
      .createHmac('sha1', secret)
      .update(payloadString + callbackUrl)
      .digest('base64');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'base64'),
        Buffer.from(expectedSignature, 'base64')
      );
    } catch {
      return false;
    }
  }

  async processWebhook(integration: Integration, webhook: WebhookPayload): Promise<void> {
    const { eventType } = webhook;
    const action = webhook as unknown as {
      type: string;
      data: { card?: { id: string }; board?: { id: string } };
    };

    switch (action.type) {
      case 'createCard':
      case 'updateCard':
      case 'deleteCard':
        if (action.data?.card) {
          await this.sync(integration, { entityTypes: ['TASK'] });
        }
        break;

      default:
        this.logger.info({ eventType }, 'Unhandled Trello webhook event');
    }
  }

  // =====================
  // Helper Methods
  // =====================

  private buildListStatusMap(
    listMappings: Array<{ externalId: string; externalName?: string | null }>
  ): Map<string, TaskStatus> {
    const statusMap = new Map<string, TaskStatus>();

    for (const mapping of listMappings) {
      const listId = mapping.externalId.replace('list:', '');
      const listName = mapping.externalName?.toLowerCase() ?? '';

      let status: TaskStatus = 'TODO';
      if (listName.includes('done') || listName.includes('complete')) {
        status = 'COMPLETED';
      } else if (
        listName.includes('doing') ||
        listName.includes('progress') ||
        listName.includes('review')
      ) {
        status = 'IN_PROGRESS';
      }

      statusMap.set(listId, status);
    }

    return statusMap;
  }

  private inferCardStatus(card: TrelloCard): TaskStatus {
    if (card.dueComplete) return 'COMPLETED';
    if (card.due && new Date(card.due) < new Date()) return 'IN_PROGRESS';
    return 'TODO';
  }

  private inferCardPriority(card: TrelloCard): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' {
    const labels = new Set(card.labels.map((l) => l.name.toLowerCase()));
    const colors = new Set(card.labels.map((l) => l.color));

    if (labels.has('urgent') || colors.has('red')) return 'URGENT';
    if (labels.has('high') || colors.has('orange')) return 'HIGH';
    if (labels.has('low') || colors.has('green')) return 'LOW';
    return 'MEDIUM';
  }

  private generateHash(data: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  // =====================
  // Public Utility Methods
  // =====================

  /**
   * Create a new card on a Trello board
   */
  async createCard(
    integration: Integration,
    listId: string,
    data: { name: string; desc?: string; due?: string; idLabels?: string[] }
  ): Promise<TrelloCard> {
    const response = await this.makeRequest<TrelloCard>(
      integration,
      'POST',
      `${this.BASE_URL}/cards`,
      {
        body: {
          idList: listId,
          ...data,
        },
      }
    );

    return response.data;
  }

  /**
   * Update a Trello card
   */
  async updateCard(
    integration: Integration,
    cardId: string,
    data: Partial<{ name: string; desc: string; due: string; closed: boolean; idList: string }>
  ): Promise<TrelloCard> {
    const response = await this.makeRequest<TrelloCard>(
      integration,
      'PUT',
      `${this.BASE_URL}/cards/${cardId}`,
      { body: data }
    );

    return response.data;
  }

  /**
   * Archive a Trello card
   */
  async archiveCard(integration: Integration, cardId: string): Promise<void> {
    await this.updateCard(integration, cardId, { closed: true });
  }

  /**
   * Create a webhook for a Trello board
   */
  async createWebhook(
    integration: Integration,
    boardId: string,
    callbackUrl: string
  ): Promise<{ id: string }> {
    const response = await this.makeRequest<{ id: string }>(
      integration,
      'POST',
      `${this.BASE_URL}/webhooks`,
      {
        body: {
          idModel: boardId,
          callbackURL: callbackUrl,
          description: 'Skillancer sync webhook',
        },
      }
    );

    return response.data;
  }
}
