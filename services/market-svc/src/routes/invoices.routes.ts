/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Invoice Routes
 *
 * API endpoints for invoice management on ContractV2
 */

import { z } from 'zod';

import { InvoiceService, InvoiceError } from '../services/invoice.service.js';

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';

// ============================================================================
// Validation Schemas
// ============================================================================

const InvoiceIdParam = z.object({
  id: z.string().uuid(),
});

const ContractIdParam = z.object({
  contractId: z.string().uuid(),
});

const GenerateInvoiceSchema = z.object({
  contractId: z.string().uuid(),
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
  description: z.string().max(500).optional(),
  dueDate: z.string().datetime().optional(),
  lineItems: z
    .array(
      z.object({
        type: z.enum(['MILESTONE', 'TIME_ENTRY', 'EXPENSE', 'ADJUSTMENT']),
        description: z.string().min(1).max(255),
        quantity: z.number().positive(),
        unitPrice: z.number(),
        milestoneId: z.string().uuid().optional(),
        timeEntryId: z.string().uuid().optional(),
      })
    )
    .optional(),
});

const PayInvoiceSchema = z.object({
  paymentMethodId: z.string().min(1),
  idempotencyKey: z.string().uuid().optional(),
});

const InvoiceListQuerySchema = z.object({
  limit: z.string().transform(Number).default('20'),
  offset: z.string().transform(Number).default('0'),
  status: z.enum(['DRAFT', 'SENT', 'VIEWED', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
});

const UserInvoiceListQuerySchema = z.object({
  limit: z.string().transform(Number).default('20'),
  offset: z.string().transform(Number).default('0'),
  status: z.enum(['DRAFT', 'SENT', 'VIEWED', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
});

// ============================================================================
// Route Dependencies
// ============================================================================

interface InvoiceRouteDeps {
  prisma: PrismaClient;
  logger: Logger;
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerInvoiceRoutes(fastify: FastifyInstance, deps: InvoiceRouteDeps): void {
  const { prisma, logger } = deps;

  // Initialize service
  const invoiceService = new InvoiceService(prisma);

  // Helper to get authenticated user
  const getUser = (request: any) => {
    if (!request.user) {
      throw new Error('Authentication required');
    }
    return request.user as { id: string; email: string; role: string };
  };

  // Error handler
  const handleError = (error: unknown, reply: FastifyReply) => {
    if (error instanceof InvoiceError) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }
    throw error;
  };

  // ==========================================================================
  // INVOICE GENERATION
  // ==========================================================================

  // POST /invoices - Generate a new invoice
  fastify.post('/', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = GenerateInvoiceSchema.parse(request.body);

      // Default period is last 7 days if not specified
      const now = new Date();
      const defaultPeriodEnd = new Date(now);
      const defaultPeriodStart = new Date(now);
      defaultPeriodStart.setDate(defaultPeriodStart.getDate() - 7);

      const invoice = await invoiceService.generateInvoice({
        contractId: body.contractId,
        periodStart: body.periodStart ? new Date(body.periodStart) : defaultPeriodStart,
        periodEnd: body.periodEnd ? new Date(body.periodEnd) : defaultPeriodEnd,
        ...(body.description && { notes: body.description }),
        ...(body.dueDate && { dueDate: new Date(body.dueDate) }),
      });

      logger.info({
        msg: 'Invoice generated',
        invoiceId: invoice.id,
        contractId: body.contractId,
        userId: user.id,
      });

      return await reply.status(201).send({
        success: true,
        data: invoice,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /invoices/auto-generate - Auto-generate weekly invoice for hourly contract
  fastify.post('/auto-generate', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = z.object({ contractId: z.string().uuid() }).parse(request.body);

      const invoice = await invoiceService.autoGenerateWeeklyInvoice(body.contractId);

      if (!invoice) {
        return await reply.send({
          success: true,
          data: null,
          message: 'No billable time entries for this period',
        });
      }

      logger.info({
        msg: 'Weekly invoice auto-generated',
        invoiceId: invoice.id,
        contractId: body.contractId,
        userId: user.id,
      });

      return await reply.status(201).send({
        success: true,
        data: invoice,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================================================
  // INVOICE RETRIEVAL
  // ==========================================================================

  // GET /invoices/:id - Get invoice by ID
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      const { id } = InvoiceIdParam.parse(request.params);
      getUser(request);

      const invoice = await prisma.contractInvoice.findUnique({
        where: { id },
        include: {
          contract: {
            select: {
              id: true,
              title: true,
              contractType: true,
              status: true,
              client: {
                select: { id: true, displayName: true, email: true },
              },
              freelancer: {
                select: { id: true, displayName: true, email: true },
              },
            },
          },
          lineItems: true,
        },
      });

      if (!invoice) {
        return await reply.status(404).send({
          success: false,
          error: {
            code: 'INVOICE_NOT_FOUND',
            message: 'Invoice not found',
          },
        });
      }

      return await reply.send({
        success: true,
        data: invoice,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /invoices/contract/:contractId - List invoices for a contract
  fastify.get<{
    Params: { contractId: string };
    Querystring: { limit?: string; offset?: string; status?: string };
  }>('/contract/:contractId', async (request, reply) => {
    try {
      const { contractId } = ContractIdParam.parse(request.params);
      const { limit, offset, status } = InvoiceListQuerySchema.parse(request.query);
      getUser(request);

      const invoices = await invoiceService.listContractInvoices(contractId, {
        limit,
        offset,
        status: status as any,
      });

      return await reply.send({
        success: true,
        data: invoices,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /invoices/stats/:contractId - Get invoice statistics for a contract
  fastify.get<{ Params: { contractId: string } }>('/stats/:contractId', async (request, reply) => {
    try {
      const { contractId } = ContractIdParam.parse(request.params);
      getUser(request);

      const stats = await invoiceService.getInvoiceStats(contractId);

      return await reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /invoices/client - List invoices for authenticated client
  fastify.get<{
    Querystring: { limit?: string; offset?: string; status?: string };
  }>('/client', async (request, reply) => {
    try {
      const user = getUser(request);
      const { limit, offset, status } = UserInvoiceListQuerySchema.parse(request.query);

      const invoices = await invoiceService.listClientInvoices(user.id, {
        limit,
        offset,
        status: status as any,
      });

      return await reply.send({
        success: true,
        data: invoices,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /invoices/freelancer - List invoices for authenticated freelancer
  fastify.get<{
    Querystring: { limit?: string; offset?: string; status?: string };
  }>('/freelancer', async (request, reply) => {
    try {
      const user = getUser(request);
      const { limit, offset, status } = UserInvoiceListQuerySchema.parse(request.query);

      const invoices = await invoiceService.listFreelancerInvoices(user.id, {
        limit,
        offset,
        status: status as any,
      });

      return await reply.send({
        success: true,
        data: invoices,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================================================
  // INVOICE ACTIONS
  // ==========================================================================

  // POST /invoices/:id/send - Send invoice to client
  fastify.post<{ Params: { id: string } }>('/:id/send', async (request, reply) => {
    try {
      const { id } = InvoiceIdParam.parse(request.params);
      const user = getUser(request);

      const invoice = await invoiceService.sendInvoice(id);

      logger.info({
        msg: 'Invoice sent',
        invoiceId: id,
        userId: user.id,
      });

      return await reply.send({
        success: true,
        data: invoice,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /invoices/:id/view - Mark invoice as viewed
  fastify.post<{ Params: { id: string } }>('/:id/view', async (request, reply) => {
    try {
      const { id } = InvoiceIdParam.parse(request.params);
      const user = getUser(request);

      const invoice = await invoiceService.markAsViewed(id);

      logger.info({
        msg: 'Invoice viewed',
        invoiceId: id,
        userId: user.id,
      });

      return await reply.send({
        success: true,
        data: invoice,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /invoices/:id/pay - Pay invoice
  fastify.post<{ Params: { id: string } }>('/:id/pay', async (request, reply) => {
    try {
      const { id } = InvoiceIdParam.parse(request.params);
      const user = getUser(request);
      const body = PayInvoiceSchema.parse(request.body);

      const result = await invoiceService.payInvoice(id, user.id, body.paymentMethodId);

      logger.info({
        msg: 'Invoice payment initiated',
        invoiceId: id,
        paymentIntentId: result.paymentIntentId,
        userId: user.id,
      });

      return await reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /invoices/:id/cancel - Cancel invoice
  fastify.post<{ Params: { id: string } }>('/:id/cancel', async (request, reply) => {
    try {
      const { id } = InvoiceIdParam.parse(request.params);
      const user = getUser(request);
      const body = z.object({ reason: z.string().max(500).optional() }).parse(request.body);

      const invoice = await invoiceService.cancelInvoice(
        id,
        user.id,
        body.reason ?? 'No reason provided'
      );

      logger.info({
        msg: 'Invoice cancelled',
        invoiceId: id,
        reason: body.reason,
        userId: user.id,
      });

      return await reply.send({
        success: true,
        data: invoice,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /invoices/:id/remind - Send payment reminder
  fastify.post<{ Params: { id: string } }>('/:id/remind', async (request, reply) => {
    try {
      const { id } = InvoiceIdParam.parse(request.params);
      const user = getUser(request);

      await invoiceService.sendReminder(id);

      logger.info({
        msg: 'Invoice reminder sent',
        invoiceId: id,
        userId: user.id,
      });

      return await reply.send({
        success: true,
        message: 'Reminder sent successfully',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });
}
