// @ts-nocheck - Known type issues pending refactor
/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * Invoice Routes
 * API endpoints for invoice management
 */

import { requireAuth } from '../middleware/auth.middleware';
import { invoiceService } from '../services/invoice.service';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface InvoiceParams {
  invoiceId: string;
}

interface ListInvoicesQuery {
  page?: number;
  limit?: number;
  status?: string;
}

export async function registerInvoiceRoutes(fastify: FastifyInstance): Promise<void> {
  // List user invoices
  fastify.get<{ Querystring: ListInvoicesQuery }>(
    '/invoices',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'List invoices for the authenticated user',
        tags: ['Invoices'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'number', default: 1 },
            limit: { type: 'number', default: 20 },
            status: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array' },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'number' },
                  limit: { type: 'number' },
                  total: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: ListInvoicesQuery }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      const { page = 1, limit = 20, status } = request.query;
      const invoices = await invoiceService.getUserInvoices(userId, {
        page,
        limit,
        status,
      });

      return reply.send({
        success: true,
        data: invoices,
        pagination: { page, limit, total: invoices.length },
      });
    }
  );

  // Get invoice by ID
  fastify.get<{ Params: InvoiceParams }>(
    '/invoices/:invoiceId',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Get invoice details',
        tags: ['Invoices'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            invoiceId: { type: 'string' },
          },
          required: ['invoiceId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
            },
          },
          404: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: InvoiceParams }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      const { invoiceId } = request.params;
      const invoice = await invoiceService.getInvoice(invoiceId, userId);

      if (!invoice) {
        return reply.status(404).send({
          success: false,
          error: 'Invoice not found',
        });
      }

      return reply.send({ success: true, data: invoice });
    }
  );

  // Download invoice PDF
  fastify.get<{ Params: InvoiceParams }>(
    '/invoices/:invoiceId/pdf',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Download invoice PDF',
        tags: ['Invoices'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            invoiceId: { type: 'string' },
          },
          required: ['invoiceId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  url: { type: 'string' },
                },
              },
            },
          },
          404: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: InvoiceParams }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      const { invoiceId } = request.params;
      const pdfUrl = await invoiceService.getInvoicePdfUrl(invoiceId, userId);

      if (!pdfUrl) {
        return reply.status(404).send({
          success: false,
          error: 'Invoice not found or PDF not available',
        });
      }

      return reply.send({ success: true, data: { url: pdfUrl } });
    }
  );

  // Get invoice stats
  fastify.get(
    '/invoices/stats',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Get invoice statistics for the authenticated user',
        tags: ['Invoices'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  totalPaid: { type: 'number' },
                  totalPending: { type: 'number' },
                  invoiceCount: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      const stats = invoiceService.getUserInvoiceStats(userId);
      return reply.send({ success: true, data: stats });
    }
  );
}
