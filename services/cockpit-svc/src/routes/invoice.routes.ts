// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Invoice Routes
 *
 * API endpoints for Professional Invoicing System (CP-3.2)
 * - Invoice CRUD operations
 * - Line items management
 * - Payment processing (Stripe, PayPal)
 * - Recurring invoices
 * - Templates
 * - PDF generation
 * - Client portal (public endpoints)
 * - Settings management
 */

import { z } from 'zod';

import { InvoiceError, InvoiceErrorCode } from '../errors/invoice.errors.js';
import { InvoicePaymentService } from '../services/invoice-payment.service.js';
import { InvoicePdfService } from '../services/invoice-pdf.service.js';
import { InvoiceSettingsService } from '../services/invoice-settings.service.js';
import { InvoiceTemplateService } from '../services/invoice-template.service.js';
import { InvoiceService } from '../services/invoice.service.js';
import { RecurringInvoiceService } from '../services/recurring-invoice.service.js';

import type {
  CreateInvoiceParams,
  UpdateInvoiceParams,
  CreateRecurringInvoiceParams,
  UpdateRecurringInvoiceParams,
} from '../types/invoice.types.js';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';

// ============================================================================
// Validation Schemas
// ============================================================================

// -- Line Item Schema --
const LineItemSchema = z.object({
  itemType: z
    .enum(['SERVICE', 'PRODUCT', 'EXPENSE', 'DISCOUNT', 'TIME_ENTRY', 'MILESTONE'])
    .optional(),
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unitType: z.string().max(20).optional(),
  unitPrice: z.number(),
  isTaxable: z.boolean().optional(),
  timeEntryIds: z.array(z.string().uuid()).optional(),
  milestoneId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  periodStart: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  periodEnd: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
});

// -- Invoice Schemas --
const CreateInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  issueDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  dueDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  currency: z.string().length(3).optional(),
  title: z.string().max(200).optional(),
  summary: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(2000).optional(),
  templateId: z.string().uuid().optional(),
  lineItems: z.array(LineItemSchema).min(1),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  discountValue: z.number().min(0).optional(),
  taxEnabled: z.boolean().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  taxLabel: z.string().max(50).optional(),
  lateFeeEnabled: z.boolean().optional(),
  lateFeeType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  lateFeeValue: z.number().min(0).optional(),
  paymentInstructions: z.string().max(2000).optional(),
  acceptedPaymentMethods: z.array(z.string()).optional(),
});

const UpdateInvoiceSchema = CreateInvoiceSchema.partial().omit({ clientId: true });

const ListInvoicesSchema = z.object({
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  status: z.string().optional(),
  startDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  endDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  minAmount: z
    .string()
    .transform((s) => parseFloat(s))
    .optional(),
  maxAmount: z
    .string()
    .transform((s) => parseFloat(s))
    .optional(),
  isOverdue: z
    .string()
    .transform((s) => s === 'true')
    .optional(),
  search: z.string().optional(),
  page: z
    .string()
    .transform((s) => parseInt(s, 10))
    .optional(),
  limit: z
    .string()
    .transform((s) => parseInt(s, 10))
    .optional(),
  sortBy: z.enum(['issueDate', 'dueDate', 'total', 'status', 'invoiceNumber']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// -- Payment Schemas --
const RecordPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentDate: z.string().transform((s) => new Date(s)),
  paymentMethod: z.enum([
    'BANK_TRANSFER',
    'CASH',
    'CHECK',
    'CREDIT_CARD',
    'PAYPAL',
    'STRIPE',
    'OTHER',
  ]),
  transactionId: z.string().optional(),
  notes: z.string().max(500).optional(),
});

const InitializePaymentSchema = z.object({
  paymentMethod: z.enum(['stripe', 'paypal']),
  amount: z.number().positive().optional(),
});

// -- Template Schemas --
const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
  logoUrl: z.string().url().optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  fontFamily: z.string().max(100).optional(),
  layout: z.enum(['CLASSIC', 'MODERN', 'MINIMAL', 'DETAILED']).optional(),
  showLogo: z.boolean().optional(),
  showPaymentQR: z.boolean().optional(),
  businessName: z.string().max(200).optional(),
  businessAddress: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  businessEmail: z.string().email().optional(),
  businessPhone: z.string().max(20).optional(),
  businessWebsite: z.string().url().optional(),
  taxNumber: z.string().max(50).optional(),
  defaultNotes: z.string().max(2000).optional(),
  defaultTerms: z.string().max(2000).optional(),
  defaultFooter: z.string().max(500).optional(),
  paymentInstructions: z.string().max(2000).optional(),
  defaultDueDays: z.number().int().min(0).max(365).optional(),
  defaultTaxRate: z.number().min(0).max(100).optional(),
  defaultTaxLabel: z.string().max(50).optional(),
  defaultCurrency: z.string().length(3).optional(),
  defaultLateFee: z
    .object({
      type: z.enum(['PERCENTAGE', 'FIXED']),
      value: z.number().min(0),
    })
    .optional(),
  acceptedPaymentMethods: z.array(z.string()).optional(),
  stripeEnabled: z.boolean().optional(),
  paypalEnabled: z.boolean().optional(),
  customCss: z.string().max(10000).optional(),
});

const UpdateTemplateSchema = CreateTemplateSchema.partial();

// -- Recurring Invoice Schemas --
const CreateRecurringInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(100),
  lineItems: z.array(LineItemSchema).min(1),
  frequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  interval: z.number().int().min(1).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  maxInvoices: z.number().int().min(1).optional(),
  dueDays: z.number().int().min(0).optional(),
  autoSend: z.boolean().optional(),
  templateId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  taxRate: z.number().min(0).max(100).optional(),
});

const UpdateRecurringInvoiceSchema = CreateRecurringInvoiceSchema.partial().omit({
  clientId: true,
});

// -- Settings Schemas --
const UpdateSettingsSchema = z.object({
  invoicePrefix: z.string().max(10).optional(),
  numberPadding: z.number().int().min(1).max(10).optional(),
  numberFormat: z.string().max(50).optional(),
  defaultDueDays: z.number().int().min(0).max(365).optional(),
  defaultCurrency: z.string().length(3).optional(),
  defaultTemplateId: z.string().uuid().optional(),
  defaultTaxEnabled: z.boolean().optional(),
  defaultTaxRate: z.number().min(0).max(100).optional(),
  defaultTaxLabel: z.string().max(50).optional(),
  taxNumber: z.string().max(50).optional(),
  defaultLateFeeEnabled: z.boolean().optional(),
  defaultLateFeeType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  defaultLateFeeValue: z.number().min(0).optional(),
  lateFeeGraceDays: z.number().int().min(0).optional(),
  autoReminders: z.boolean().optional(),
  reminderDays: z.array(z.number().int()).optional(),
  stripeAccountId: z.string().optional(),
  paypalEmail: z.string().email().optional(),
  bankDetails: z
    .object({
      bankName: z.string().optional(),
      accountName: z.string().optional(),
      accountNumber: z.string().optional(),
      routingNumber: z.string().optional(),
      swiftCode: z.string().optional(),
      iban: z.string().optional(),
      additionalInfo: z.string().optional(),
    })
    .optional(),
});

// ============================================================================
// Route Registration
// ============================================================================

interface InvoiceRouteDeps {
  prisma: PrismaClient;
  logger: Logger;
}

export async function registerInvoiceRoutes(
  app: FastifyInstance,
  deps: InvoiceRouteDeps
): Promise<void> {
  const { prisma, logger } = deps;

  // Initialize services
  const invoiceService = new InvoiceService(prisma, logger);
  const templateService = new InvoiceTemplateService(prisma, logger);
  const recurringService = new RecurringInvoiceService(prisma, logger);
  const paymentService = new InvoicePaymentService(prisma, logger);
  const settingsService = new InvoiceSettingsService(prisma, logger);
  const pdfService = new InvoicePdfService(prisma, logger);

  // Error handler
  const handleError = (error: unknown, reply: any) => {
    if (error instanceof InvoiceError) {
      return reply.status(error.statusCode).send(error.toJSON());
    }
    logger.error({ error }, 'Unhandled invoice error');
    return reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  };

  // ============================================================================
  // INVOICES
  // ============================================================================

  // Create invoice
  app.post('/finance/invoices', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const body = CreateInvoiceSchema.parse(request.body);

      const invoice = await invoiceService.createInvoice({
        freelancerUserId: userId,
        ...body,
      } as CreateInvoiceParams);

      return await reply.status(201).send({ data: invoice });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // List invoices
  app.get('/finance/invoices', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const query = ListInvoicesSchema.parse(request.query);

      const statusArray = query.status?.split(',') as any[];

      const result = await invoiceService.listInvoices({
        freelancerUserId: userId,
        ...query,
        status: statusArray,
      });

      return await reply.send({
        data: result.invoices,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Get invoice dashboard
  app.get('/finance/invoices/dashboard', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const dashboard = await invoiceService.getDashboard(userId);
      return await reply.send({ data: dashboard });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Get single invoice
  app.get('/finance/invoices/:id', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const { id } = request.params as { id: string };

      const invoice = await invoiceService.getInvoice(id, userId);
      return await reply.send({ data: invoice });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Update invoice
  app.patch('/finance/invoices/:id', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const { id } = request.params as { id: string };
      const body = UpdateInvoiceSchema.parse(request.body);

      const invoice = await invoiceService.updateInvoice(id, userId, body as UpdateInvoiceParams);
      return await reply.send({ data: invoice });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Delete invoice
  app.delete('/finance/invoices/:id', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const { id } = request.params as { id: string };

      await invoiceService.deleteInvoice(id, userId);
      return await reply.status(204).send();
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Send invoice
  app.post('/finance/invoices/:id/send', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const { id } = request.params as { id: string };
      const body = request.body as any;

      const invoice = await invoiceService.sendInvoice(id, userId, {
        to: body?.to,
        cc: body?.cc,
        message: body?.message,
        attachPdf: body?.attachPdf ?? true,
      });

      return await reply.send({ data: invoice });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Void invoice
  app.post('/finance/invoices/:id/void', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const { id } = request.params as { id: string };
      const body = request.body as any;

      const invoice = await invoiceService.voidInvoice(id, userId, body?.reason);
      return await reply.send({ data: invoice });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Record payment
  app.post('/finance/invoices/:id/payments', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const { id } = request.params as { id: string };
      const body = RecordPaymentSchema.parse(request.body);

      const invoice = await invoiceService.recordPayment({
        invoiceId: id,
        freelancerUserId: userId,
        ...body,
      });

      return await reply.status(201).send({ data: invoice });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Get invoice payments
  app.get('/finance/invoices/:id/payments', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const { id } = request.params as { id: string };

      const payments = await paymentService.getInvoicePayments(id, userId);
      return await reply.send({ data: payments });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Generate PDF
  app.post('/finance/invoices/:id/pdf', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const { id } = request.params as { id: string };

      const pdfUrl = await pdfService.generatePdf(id, userId);
      return await reply.send({ data: { pdfUrl } });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ============================================================================
  // TEMPLATES
  // ============================================================================

  // Create template
  app.post('/finance/invoice-templates', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const body = CreateTemplateSchema.parse(request.body);

      const template = await templateService.createTemplate({
        freelancerUserId: userId,
        ...body,
      });

      return await reply.status(201).send({ data: template });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // List templates
  app.get('/finance/invoice-templates', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const templates = await templateService.listTemplates(userId);
      return await reply.send({ data: templates });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Get template
  app.get('/finance/invoice-templates/:id', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const { id } = request.params as { id: string };

      const template = await templateService.getTemplate(id, userId);
      return await reply.send({ data: template });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Update template
  app.patch('/finance/invoice-templates/:id', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const { id } = request.params as { id: string };
      const body = UpdateTemplateSchema.parse(request.body);

      const template = await templateService.updateTemplate(id, userId, body);
      return await reply.send({ data: template });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Delete template
  app.delete('/finance/invoice-templates/:id', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const { id } = request.params as { id: string };

      await templateService.deleteTemplate(id, userId);
      return await reply.status(204).send();
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Set default template
  app.post('/finance/invoice-templates/:id/default', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const { id } = request.params as { id: string };

      const template = await templateService.setDefault(id, userId);
      return await reply.send({ data: template });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Duplicate template
  app.post('/finance/invoice-templates/:id/duplicate', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const { id } = request.params as { id: string };
      const body = request.body as any;

      const template = await templateService.duplicateTemplate(id, userId, body?.name ?? 'Copy');

      return await reply.status(201).send({ data: template });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ============================================================================
  // RECURRING INVOICES
  // ============================================================================

  // Create recurring invoice
  app.post('/finance/recurring-invoices', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const body = CreateRecurringInvoiceSchema.parse(request.body);

      // Calculate totals from line items
      const subtotal = body.lineItems.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );
      const taxAmount = body.taxRate ? subtotal * (body.taxRate / 100) : 0;
      const total = subtotal + taxAmount;

      const recurring = await recurringService.createRecurringInvoice({
        freelancerUserId: userId,
        ...body,
        subtotal,
        taxAmount,
        total,
      } as CreateRecurringInvoiceParams);

      return await reply.status(201).send({ data: recurring });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // List recurring invoices
  app.get('/finance/recurring-invoices', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const recurring = await recurringService.listRecurringInvoices(userId);
      return await reply.send({ data: recurring });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Get recurring invoice
  app.get('/finance/recurring-invoices/:id', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const { id } = request.params as { id: string };

      const recurring = await recurringService.getRecurringInvoice(id, userId);
      return await reply.send({ data: recurring });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Update recurring invoice
  app.patch('/finance/recurring-invoices/:id', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const { id } = request.params as { id: string };
      const body = UpdateRecurringInvoiceSchema.parse(request.body);

      const recurring = await recurringService.updateRecurringInvoice(
        id,
        userId,
        body as UpdateRecurringInvoiceParams
      );
      return await reply.send({ data: recurring });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Pause recurring invoice
  app.post('/finance/recurring-invoices/:id/pause', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const { id } = request.params as { id: string };

      const recurring = await recurringService.pauseRecurringInvoice(id, userId);
      return await reply.send({ data: recurring });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Resume recurring invoice
  app.post('/finance/recurring-invoices/:id/resume', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const { id } = request.params as { id: string };

      const recurring = await recurringService.resumeRecurringInvoice(id, userId);
      return await reply.send({ data: recurring });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Deactivate recurring invoice
  app.delete('/finance/recurring-invoices/:id', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const { id } = request.params as { id: string };

      await recurringService.deactivateRecurringInvoice(id, userId);
      return await reply.status(204).send();
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ============================================================================
  // SETTINGS
  // ============================================================================

  // Get settings
  app.get('/finance/invoice-settings', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const settings = await settingsService.getSettings(userId);
      return await reply.send({ data: settings });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Update settings
  app.patch('/finance/invoice-settings', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const body = UpdateSettingsSchema.parse(request.body);

      const settings = await settingsService.updateSettings(userId, body);
      return await reply.send({ data: settings });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Preview next invoice number
  app.get('/finance/invoice-settings/preview-number', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const nextNumber = await settingsService.previewNextInvoiceNumber(userId);
      return await reply.send({ data: { nextNumber } });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Get payment methods status
  app.get('/finance/invoice-settings/payment-methods', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const status = await settingsService.getPaymentMethodsStatus(userId);
      return await reply.send({ data: status });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ============================================================================
  // PUBLIC ENDPOINTS (Client Portal)
  // ============================================================================

  // Get invoice by view token (public)
  app.get('/public/invoices/:viewToken', async (request, reply) => {
    try {
      const { viewToken } = request.params as { viewToken: string };
      const ipAddress = request.ip;

      // Mark as viewed
      await invoiceService.markAsViewed(viewToken, ipAddress);

      // Get public view
      const publicView = await invoiceService.getPublicView(viewToken);
      return await reply.send({ data: publicView });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Initialize payment (public)
  app.post('/public/invoices/:viewToken/pay', async (request, reply) => {
    try {
      const { viewToken } = request.params as { viewToken: string };
      const body = InitializePaymentSchema.parse(request.body);

      const result = await paymentService.initializePayment(viewToken, body);
      return await reply.send({ data: result });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ============================================================================
  // WEBHOOKS
  // ============================================================================

  // Stripe webhook
  app.post('/webhooks/stripe/invoice', async (request, reply) => {
    try {
      const event = request.body as any;

      // TODO: Verify Stripe signature
      // const sig = request.headers['stripe-signature'];
      // const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);

      if (event.type === 'payment_intent.succeeded') {
        const paymentIntentId = event.data.object.id;
        await paymentService.handleStripeWebhook(paymentIntentId, 'succeeded');
      } else if (event.type === 'payment_intent.payment_failed') {
        const paymentIntentId = event.data.object.id;
        await paymentService.handleStripeWebhook(paymentIntentId, 'failed');
      }

      return await reply.send({ received: true });
    } catch (error) {
      logger.error({ error }, 'Stripe webhook error');
      return reply.status(400).send({ error: 'Webhook error' });
    }
  });

  // PayPal webhook
  app.post('/webhooks/paypal/invoice', async (request, reply) => {
    try {
      const event = request.body as any;

      // TODO: Verify PayPal signature

      if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
        const orderId = event.resource.supplementary_data?.related_ids?.order_id;
        if (orderId) {
          await paymentService.handlePayPalWebhook(orderId, 'COMPLETED');
        }
      } else if (event.event_type === 'PAYMENT.CAPTURE.DENIED') {
        const orderId = event.resource.supplementary_data?.related_ids?.order_id;
        if (orderId) {
          await paymentService.handlePayPalWebhook(orderId, 'DECLINED');
        }
      }

      return await reply.send({ received: true });
    } catch (error) {
      logger.error({ error }, 'PayPal webhook error');
      return reply.status(400).send({ error: 'Webhook error' });
    }
  });

  logger.info('Invoice routes registered');
}

