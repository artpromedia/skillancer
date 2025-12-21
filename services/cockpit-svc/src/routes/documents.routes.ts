/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Document Routes
 *
 * API endpoints for CRM document management
 */

import { z } from 'zod';

import { CrmError, getStatusCode } from '../errors/crm.errors.js';
import { DocumentService } from '../services/document.service.js';

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';

// ============================================================================
// Validation Schemas
// ============================================================================

const CreateDocumentSchema = z.object({
  clientId: z.string().uuid(),
  opportunityId: z.string().uuid().optional(),
  documentType: z.enum([
    'CONTRACT',
    'PROPOSAL',
    'INVOICE',
    'BRIEF',
    'DELIVERABLE',
    'REFERENCE',
    'OTHER',
  ]),
  fileName: z.string().min(1).max(255),
  fileUrl: z.string().url(),
  fileSize: z.number().positive().optional(),
  mimeType: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
});

const UpdateDocumentSchema = z.object({
  documentType: z
    .enum(['CONTRACT', 'PROPOSAL', 'INVOICE', 'BRIEF', 'DELIVERABLE', 'REFERENCE', 'OTHER'])
    .optional(),
  fileName: z.string().min(1).max(255).optional(),
  fileUrl: z.string().url().optional(),
  fileSize: z.number().positive().optional(),
  mimeType: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
});

const SearchDocumentsSchema = z.object({
  clientId: z.string().uuid().optional(),
  documentType: z
    .array(
      z.enum(['CONTRACT', 'PROPOSAL', 'INVOICE', 'BRIEF', 'DELIVERABLE', 'REFERENCE', 'OTHER'])
    )
    .optional(),
  query: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sortBy: z.enum(['createdAt', 'fileName', 'fileSize']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
});

const GetUploadUrlSchema = z.object({
  clientId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  documentType: z.enum([
    'CONTRACT',
    'PROPOSAL',
    'INVOICE',
    'BRIEF',
    'DELIVERABLE',
    'REFERENCE',
    'OTHER',
  ]),
});

// ============================================================================
// Route Dependencies
// ============================================================================

interface DocumentRouteDeps {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerDocumentRoutes(fastify: FastifyInstance, deps: DocumentRouteDeps): void {
  const { prisma, redis, logger } = deps;

  // Initialize service
  const documentService = new DocumentService(prisma, redis, logger);

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

  // POST /documents - Create a document record
  fastify.post('/', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = CreateDocumentSchema.parse(request.body);

      const document = await documentService.createDocument({
        freelancerUserId: user.id,
        clientId: body.clientId,
        name: body.fileName,
        description: body.description,
        documentType: body.documentType as any,
        fileUrl: body.fileUrl,
        fileName: body.fileName,
        fileSize: body.fileSize || 0,
        mimeType: body.mimeType || 'application/octet-stream',
        tags: body.tags,
      });

      logger.info({
        msg: 'Document created',
        documentId: document.id,
        clientId: body.clientId,
        freelancerId: user.id,
      });

      return await reply.status(201).send({
        success: true,
        data: document,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /documents - Search documents
  fastify.get('/', async (request, reply) => {
    try {
      const user = getUser(request);
      const query = SearchDocumentsSchema.parse(request.query);

      const result = await documentService.searchDocuments({
        freelancerUserId: user.id,
        clientId: query.clientId,
        documentType: query.documentType as any,
        tags: query.tags,
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

  // GET /documents/recent - Get recent documents
  fastify.get('/recent', async (request, reply) => {
    try {
      const user = getUser(request);
      const { limit } = z
        .object({
          limit: z.string().transform(Number).optional(),
        })
        .parse(request.query);

      const documents = await documentService.getRecentDocuments(user.id, limit || 10);

      return await reply.send({
        success: true,
        data: documents,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /documents/stats - Get document statistics
  fastify.get('/stats', async (request, reply) => {
    try {
      const user = getUser(request);

      const stats = await documentService.getDocumentStats(user.id);

      return await reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /documents/upload-url - Get pre-signed upload URL
  fastify.post('/upload-url', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = GetUploadUrlSchema.parse(request.body);

      const urls = await documentService.getUploadUrl(
        user.id,
        body.clientId,
        body.fileName,
        body.documentType
      );

      return await reply.send({
        success: true,
        data: urls,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /documents/by-tag/:tag - Get documents by tag
  fastify.get('/by-tag/:tag', async (request, reply) => {
    try {
      const user = getUser(request);
      const { tag } = request.params as { tag: string };

      const documents = await documentService.searchByTag(user.id, tag);

      return await reply.send({
        success: true,
        data: documents,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /documents/:id - Get document by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      const document = await documentService.getDocument(id, user.id);

      return await reply.send({
        success: true,
        data: document,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PATCH /documents/:id - Update document
  fastify.patch('/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = UpdateDocumentSchema.parse(request.body);

      const document = await documentService.updateDocument(id, user.id, {
        name: body.fileName,
        description: body.description,
        documentType: body.documentType as any,
        tags: body.tags,
      });

      logger.info({
        msg: 'Document updated',
        documentId: id,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        data: document,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // DELETE /documents/:id - Delete document
  fastify.delete('/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      await documentService.deleteDocument(id, user.id);

      logger.info({
        msg: 'Document deleted',
        documentId: id,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        message: 'Document deleted successfully',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });
}
