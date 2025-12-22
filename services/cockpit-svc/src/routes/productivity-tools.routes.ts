/**
 * @module @skillancer/cockpit-svc/routes/productivity-tools
 * Productivity Tools Routes - Platform-specific endpoints for productivity integrations
 */

import { z } from 'zod';

import { IntegrationPlatformService } from '../services/integrations/integration-platform.service.js';
import { NotionIntegrationService } from '../services/integrations/notion-integration.service.js';
import { TrelloIntegrationService } from '../services/integrations/trello-integration.service.js';

import type { EncryptionService } from '../services/encryption.service.js';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// =====================
// Request Schemas
// =====================

const syncOptionsSchema = z.object({
  syncDatabases: z.boolean().optional(),
  syncBoards: z.boolean().optional(),
  syncPages: z.boolean().optional(),
  syncCards: z.boolean().optional(),
  syncTasks: z.boolean().optional(),
  databaseIds: z.array(z.string()).optional(),
  boardIds: z.array(z.string()).optional(),
  autoCreateProjects: z.boolean().optional(),
  mapListsToStatuses: z.boolean().optional(),
});

const _paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// =====================
// Route Dependencies
// =====================

export interface ProductivityToolRouteDeps {
  prisma: PrismaClient;
  logger: Logger;
  encryption: EncryptionService;
}

// =====================
// Route Registration
// =====================

export function registerProductivityToolRoutes(
  app: FastifyInstance,
  deps: ProductivityToolRouteDeps
): void {
  const { prisma, logger, encryption } = deps;

  // Initialize services
  const platformService = new IntegrationPlatformService(prisma, logger, encryption);
  const notionService = new NotionIntegrationService(prisma, logger, encryption);
  const trelloService = new TrelloIntegrationService(prisma, logger, encryption);

  // Register providers
  platformService.registerProvider(notionService);
  platformService.registerProvider(trelloService);

  // Helper to get user ID from request
  const getUserId = (request: FastifyRequest): string | null => {
    return (request as unknown as { userId?: string }).userId ?? null;
  };

  // Error handler
  const handleError = (error: unknown, reply: FastifyReply, context: string): FastifyReply => {
    logger.error({ error, context }, 'Productivity tool route error');
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: error.message },
        });
      }
      if (error.message.includes('not connected')) {
        return reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: error.message },
        });
      }
    }
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  };

  // =====================
  // Notion Routes
  // =====================

  /**
   * GET /productivity/notion/databases
   * Get databases from connected Notion workspace
   */
  app.get('/productivity/notion/databases', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'NOTION', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Notion not connected' },
        });
      }

      const databases = await notionService.fetchDatabases(integration);

      return await reply.send({
        success: true,
        data: {
          databases: databases.map((db) => ({
            id: db.id,
            title: db.title.map((t) => t.plain_text).join(''),
            description: db.description?.map((d) => d.plain_text).join(''),
            icon: db.icon?.emoji,
            lastEdited: db.last_edited_time,
          })),
          total: databases.length,
        },
      });
    } catch (error) {
      return handleError(error, reply, 'notion.databases');
    }
  });

  /**
   * GET /productivity/notion/databases/:databaseId/pages
   * Get pages from a specific Notion database
   */
  app.get<{
    Params: { databaseId: string };
    Querystring: { since?: string };
  }>('/productivity/notion/databases/:databaseId/pages', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const { databaseId } = request.params;
      const { since } = request.query;

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'NOTION', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Notion not connected' },
        });
      }

      const sinceDate = since ? new Date(since) : undefined;
      const pages = await notionService.fetchDatabasePages(integration, databaseId, sinceDate);

      return await reply.send({
        success: true,
        data: {
          pages: pages.map((page) => ({
            id: page.id,
            icon: page.icon?.emoji,
            createdTime: page.created_time,
            lastEditedTime: page.last_edited_time,
            properties: page.properties,
          })),
          total: pages.length,
        },
      });
    } catch (error) {
      return handleError(error, reply, 'notion.database.pages');
    }
  });

  /**
   * POST /productivity/notion/databases/:databaseId/pages
   * Create a new page in a Notion database
   */
  app.post<{
    Params: { databaseId: string };
    Body: { properties: Record<string, unknown> };
  }>('/productivity/notion/databases/:databaseId/pages', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const { databaseId } = request.params;
      const { properties } = request.body;

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'NOTION', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Notion not connected' },
        });
      }

      const page = await notionService.createPage(integration, databaseId, properties);

      return await reply.status(201).send({
        success: true,
        data: { page },
      });
    } catch (error) {
      return handleError(error, reply, 'notion.page.create');
    }
  });

  /**
   * PATCH /productivity/notion/pages/:pageId
   * Update a Notion page
   */
  app.patch<{
    Params: { pageId: string };
    Body: { properties: Record<string, unknown> };
  }>('/productivity/notion/pages/:pageId', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const { pageId } = request.params;
      const { properties } = request.body;

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'NOTION', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Notion not connected' },
        });
      }

      const page = await notionService.updatePage(integration, pageId, properties);

      return await reply.send({
        success: true,
        data: { page },
      });
    } catch (error) {
      return handleError(error, reply, 'notion.page.update');
    }
  });

  /**
   * DELETE /productivity/notion/pages/:pageId
   * Archive a Notion page
   */
  app.delete<{
    Params: { pageId: string };
  }>('/productivity/notion/pages/:pageId', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const { pageId } = request.params;

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'NOTION', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Notion not connected' },
        });
      }

      await notionService.archivePage(integration, pageId);

      return await reply.send({
        success: true,
        message: 'Page archived successfully',
      });
    } catch (error) {
      return handleError(error, reply, 'notion.page.delete');
    }
  });

  /**
   * POST /productivity/notion/sync
   * Trigger a sync from Notion
   */
  app.post<{
    Body: z.infer<typeof syncOptionsSchema>;
  }>('/productivity/notion/sync', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const options = syncOptionsSchema.parse(request.body);

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'NOTION', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Notion not connected' },
        });
      }

      // Update sync options
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          syncOptions: options as object,
        },
      });

      const result = await notionService.sync(integration, {});

      return await reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      return handleError(error, reply, 'notion.sync');
    }
  });

  // =====================
  // Trello Routes
  // =====================

  /**
   * GET /productivity/trello/boards
   * Get boards from connected Trello account
   */
  app.get('/productivity/trello/boards', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'TRELLO', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Trello not connected' },
        });
      }

      const boards = await trelloService.fetchBoards(integration);

      return await reply.send({
        success: true,
        data: {
          boards: boards.map((board) => ({
            id: board.id,
            name: board.name,
            description: board.desc,
            url: board.url,
            closed: board.closed,
            lastActivity: board.dateLastActivity,
          })),
          total: boards.length,
        },
      });
    } catch (error) {
      return handleError(error, reply, 'trello.boards');
    }
  });

  /**
   * GET /productivity/trello/boards/:boardId/lists
   * Get lists from a Trello board
   */
  app.get<{
    Params: { boardId: string };
  }>('/productivity/trello/boards/:boardId/lists', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const { boardId } = request.params;

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'TRELLO', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Trello not connected' },
        });
      }

      const lists = await trelloService.fetchLists(integration, boardId);

      return await reply.send({
        success: true,
        data: {
          lists: lists.map((list) => ({
            id: list.id,
            name: list.name,
            closed: list.closed,
            position: list.pos,
          })),
          total: lists.length,
        },
      });
    } catch (error) {
      return handleError(error, reply, 'trello.board.lists');
    }
  });

  /**
   * GET /productivity/trello/boards/:boardId/cards
   * Get cards from a Trello board
   */
  app.get<{
    Params: { boardId: string };
    Querystring: { since?: string };
  }>('/productivity/trello/boards/:boardId/cards', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const { boardId } = request.params;
      const { since } = request.query;

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'TRELLO', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Trello not connected' },
        });
      }

      const sinceDate = since ? new Date(since) : undefined;
      const cards = await trelloService.fetchCards(integration, boardId, sinceDate);

      return await reply.send({
        success: true,
        data: {
          cards: cards.map((card) => ({
            id: card.id,
            name: card.name,
            description: card.desc,
            listId: card.idList,
            url: card.url,
            due: card.due,
            dueComplete: card.dueComplete,
            labels: card.labels,
            lastActivity: card.dateLastActivity,
          })),
          total: cards.length,
        },
      });
    } catch (error) {
      return handleError(error, reply, 'trello.board.cards');
    }
  });

  /**
   * POST /productivity/trello/lists/:listId/cards
   * Create a new card in a Trello list
   */
  app.post<{
    Params: { listId: string };
    Body: { name: string; desc?: string; due?: string; idLabels?: string[] };
  }>('/productivity/trello/lists/:listId/cards', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const { listId } = request.params;
      const { name, desc, due, idLabels } = request.body;

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'TRELLO', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Trello not connected' },
        });
      }

      const card = await trelloService.createCard(integration, listId, {
        name,
        desc,
        due,
        idLabels,
      });

      return await reply.status(201).send({
        success: true,
        data: { card },
      });
    } catch (error) {
      return handleError(error, reply, 'trello.card.create');
    }
  });

  /**
   * PATCH /productivity/trello/cards/:cardId
   * Update a Trello card
   */
  app.patch<{
    Params: { cardId: string };
    Body: Partial<{ name: string; desc: string; due: string; closed: boolean; idList: string }>;
  }>('/productivity/trello/cards/:cardId', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const { cardId } = request.params;

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'TRELLO', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Trello not connected' },
        });
      }

      const card = await trelloService.updateCard(integration, cardId, request.body);

      return await reply.send({
        success: true,
        data: { card },
      });
    } catch (error) {
      return handleError(error, reply, 'trello.card.update');
    }
  });

  /**
   * DELETE /productivity/trello/cards/:cardId
   * Archive a Trello card
   */
  app.delete<{
    Params: { cardId: string };
  }>('/productivity/trello/cards/:cardId', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const { cardId } = request.params;

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'TRELLO', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Trello not connected' },
        });
      }

      await trelloService.archiveCard(integration, cardId);

      return await reply.send({
        success: true,
        message: 'Card archived successfully',
      });
    } catch (error) {
      return handleError(error, reply, 'trello.card.delete');
    }
  });

  /**
   * POST /productivity/trello/sync
   * Trigger a sync from Trello
   */
  app.post<{
    Body: z.infer<typeof syncOptionsSchema>;
  }>('/productivity/trello/sync', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const options = syncOptionsSchema.parse(request.body);

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'TRELLO', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Trello not connected' },
        });
      }

      // Update sync options
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          syncOptions: options as object,
        },
      });

      const result = await trelloService.sync(integration, {});

      return await reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      return handleError(error, reply, 'trello.sync');
    }
  });

  /**
   * POST /productivity/trello/boards/:boardId/webhook
   * Create a webhook for a Trello board
   */
  app.post<{
    Params: { boardId: string };
    Body: { callbackUrl: string };
  }>('/productivity/trello/boards/:boardId/webhook', async (request, reply) => {
    try {
      const userId = getUserId(request);
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const { boardId } = request.params;
      const { callbackUrl } = request.body;

      const integration = await prisma.integration.findFirst({
        where: { userId, provider: 'TRELLO', status: 'CONNECTED' },
      });

      if (!integration) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Trello not connected' },
        });
      }

      const webhook = await trelloService.createWebhook(integration, boardId, callbackUrl);

      return await reply.status(201).send({
        success: true,
        data: { webhookId: webhook.id },
      });
    } catch (error) {
      return handleError(error, reply, 'trello.webhook.create');
    }
  });
}
