/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Client Routes
 *
 * API endpoints for CRM client management
 */

import { z } from 'zod';

import { CrmError, getStatusCode } from '../errors/crm.errors.js';
import { ClientHealthScoreService } from '../services/client-health-score.service.js';
import { ClientSearchService } from '../services/client-search.service.js';
import { ClientService } from '../services/client.service.js';

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';

// ============================================================================
// Validation Schemas
// ============================================================================

const CreateClientSchema = z.object({
  clientType: z.enum(['INDIVIDUAL', 'COMPANY']),
  source: z.enum(['MANUAL', 'MARKET_IMPORT', 'REFERRAL', 'WEBSITE', 'LINKEDIN', 'OTHER']),
  companyName: z.string().max(255).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  website: z.string().url().optional().nullable(),
  industry: z.string().max(100).optional(),
  companySize: z.enum(['SOLO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']).optional(),
  timezone: z.string().max(50).optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string()).optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      postalCode: z.string().optional(),
    })
    .optional(),
});

const UpdateClientSchema = CreateClientSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED', 'LEAD', 'PROSPECT']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  defaultHourlyRate: z.number().positive().optional(),
  preferredContactMethod: z.string().max(50).optional(),
});

const SearchClientsSchema = z.object({
  query: z.string().optional(),
  status: z.array(z.string()).optional(),
  source: z.array(z.string()).optional(),
  clientType: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  minTotalRevenue: z.string().transform(Number).optional(),
  minHealthScore: z.string().transform(Number).optional(),
  lastInteractionBefore: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  sortBy: z.enum(['name', 'lastContact', 'lifetimeValue', 'healthScore', 'created']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
});

const ImportFromMarketSchema = z.object({
  platformClientId: z.string().uuid(),
});

const AddInteractionSchema = z.object({
  interactionType: z.enum([
    'EMAIL',
    'CALL',
    'MEETING',
    'VIDEO_CALL',
    'MESSAGE',
    'PROPOSAL_SENT',
    'INVOICE_SENT',
    'PAYMENT_RECEIVED',
    'CONTRACT_SIGNED',
    'PROJECT_COMPLETED',
    'FEEDBACK_RECEIVED',
    'OTHER',
  ]),
  subject: z.string().max(255).optional(),
  notes: z.string().max(10000).optional(),
  sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']).optional(),
  isOutbound: z.boolean().optional(),
  duration: z.number().optional(),
  scheduledAt: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

const AddContactSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  role: z.enum([
    'OWNER',
    'DECISION_MAKER',
    'INFLUENCER',
    'TECHNICAL',
    'BILLING',
    'PROJECT_MANAGER',
    'OTHER',
  ]),
  jobTitle: z.string().max(100).optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
  preferredContactMethod: z.string().max(50).optional(),
});

// ============================================================================
// Route Dependencies
// ============================================================================

interface ClientRouteDeps {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerClientRoutes(fastify: FastifyInstance, deps: ClientRouteDeps): void {
  const { prisma, redis, logger } = deps;

  // Initialize services (order matters - dependencies first)
  const healthScoreService = new ClientHealthScoreService(prisma, redis, logger);
  const searchService = new ClientSearchService(redis, logger);
  const clientService = new ClientService(prisma, redis, logger, healthScoreService, searchService);

  // Helper to get authenticated user
  const getUser = (request: any) => {
    if (!request.user) {
      throw new Error('Authentication required');
    }
    return request.user as { id: string; email: string; role: string };
  };

  // Error handler
  const handleError = (error: unknown, reply: any) => {
    if (error instanceof CrmError) {
      return reply.status(getStatusCode(error.code)).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }
    throw error;
  };

  // POST /clients - Create a new client
  fastify.post('/', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = CreateClientSchema.parse(request.body);

      const client = await clientService.createClient({
        freelancerUserId: user.id,
        clientType: body.clientType as any,
        source: body.source as any,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        companyName: body.companyName,
        companyWebsite: body.website ?? undefined,
        companySize: body.companySize as any,
        industry: body.industry,
        timezone: body.timezone,
        notes: body.notes,
        tags: body.tags,
        address: body.address,
      });

      logger.info({
        msg: 'Client created',
        clientId: client.id,
        freelancerId: user.id,
      });

      return await reply.status(201).send({
        success: true,
        data: client,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /clients/import - Import client from Market
  fastify.post('/import', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = ImportFromMarketSchema.parse(request.body);

      const client = await clientService.importFromMarket(user.id, body.platformClientId);

      logger.info({
        msg: 'Client imported from Market',
        clientId: client.id,
        platformClientId: body.platformClientId,
        freelancerId: user.id,
      });

      return await reply.status(201).send({
        success: true,
        data: client,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /clients/sync - Sync all clients from Market
  fastify.post('/sync', async (request, reply) => {
    try {
      const user = getUser(request);

      const result = await clientService.syncFromMarket(user.id);

      logger.info({
        msg: 'Clients synced from Market',
        imported: result.imported,
        updated: result.updated,
        errors: result.errors.length,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /clients - Search clients
  fastify.get('/', async (request, reply) => {
    try {
      const user = getUser(request);
      const query = SearchClientsSchema.parse(request.query);

      const result = await clientService.searchClients({
        freelancerUserId: user.id,
        query: query.query,
        status: query.status as any,
        source: query.source as any,
        tags: query.tags,
        healthScoreMin: query.minHealthScore,
        lastContactBefore: query.lastInteractionBefore,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        page: query.page,
        limit: query.limit,
      });

      return await reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /clients/stats - Get client statistics
  fastify.get('/stats', async (request, reply) => {
    try {
      const user = getUser(request);

      const stats = await clientService.getClientStats(user.id);

      return await reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /clients/needs-attention - Get clients needing attention
  fastify.get('/needs-attention', async (request, reply) => {
    try {
      const user = getUser(request);

      const clients = await clientService.getClientsNeedingAttention(user.id);

      return await reply.send({
        success: true,
        data: clients,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /clients/:id - Get client by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      const client = await clientService.getClientById(id, user.id);

      return await reply.send({
        success: true,
        data: client,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /clients/:id/health-score - Get client health score breakdown
  fastify.get('/:id/health-score', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      // Verify client belongs to user
      await clientService.getClientById(id, user.id);

      const healthScore = await healthScoreService.getHealthScoreBreakdown(id);

      return await reply.send({
        success: true,
        data: healthScore,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PATCH /clients/:id - Update client
  fastify.patch('/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = UpdateClientSchema.parse(request.body);

      const client = await clientService.updateClient(id, user.id, {
        clientType: body.clientType as any,
        source: body.source as any,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        companyName: body.companyName,
        companyWebsite: body.website ?? undefined,
        companySize: body.companySize as any,
        industry: body.industry,
        timezone: body.timezone,
        notes: body.notes,
        tags: body.tags,
        address: body.address,
        status: body.status as any,
      });

      logger.info({
        msg: 'Client updated',
        clientId: id,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        data: client,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /clients/:id/archive - Archive client
  fastify.post('/:id/archive', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      const client = await clientService.archiveClient(id, user.id);

      logger.info({
        msg: 'Client archived',
        clientId: id,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        data: client,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /clients/:id/restore - Restore archived client
  fastify.post('/:id/restore', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      const client = await clientService.restoreClient(id, user.id);

      logger.info({
        msg: 'Client restored',
        clientId: id,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        data: client,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /clients/:id/interactions - Add interaction
  fastify.post('/:id/interactions', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = AddInteractionSchema.parse(request.body);

      const interaction = await clientService.addInteraction({
        clientId: id,
        freelancerUserId: user.id,
        interactionType: body.interactionType as any,
        description: body.notes || '',
        subject: body.subject,
        sentiment: body.sentiment as any,
        duration: body.duration,
        occurredAt: body.scheduledAt,
      });

      logger.info({
        msg: 'Interaction added',
        clientId: id,
        interactionId: interaction.id,
        freelancerId: user.id,
      });

      return await reply.status(201).send({
        success: true,
        data: interaction,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /clients/:id/contacts - Add contact
  fastify.post('/:id/contacts', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = AddContactSchema.parse(request.body);

      const contact = await clientService.addContact({
        clientId: id,
        freelancerUserId: user.id,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        role: body.role as any,
        jobTitle: body.jobTitle,
        isPrimary: body.isPrimary,
        notes: body.notes,
      });

      logger.info({
        msg: 'Contact added',
        clientId: id,
        contactId: contact.id,
        freelancerId: user.id,
      });

      return await reply.status(201).send({
        success: true,
        data: contact,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /clients/search/full-text - Full-text search using Elasticsearch
  fastify.get('/search/full-text', async (request, reply) => {
    try {
      const user = getUser(request);
      const { query, limit, offset } = z
        .object({
          query: z.string().min(1),
          limit: z.string().transform(Number).optional(),
          offset: z.string().transform(Number).optional(),
        })
        .parse(request.query);

      const result = await searchService.search({
        freelancerUserId: user.id,
        query,
        limit: limit || 20,
        page: offset ? Math.floor(offset / (limit || 20)) + 1 : 1,
      });

      return await reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });
}
