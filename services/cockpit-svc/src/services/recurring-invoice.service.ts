/**
 * @module @skillancer/cockpit-svc/services/recurring-invoice
 * Recurring Invoice Service - Recurring invoice management
 */

import { randomBytes } from 'crypto';

import { InvoiceError, InvoiceErrorCode, recurringErrors } from '../errors/invoice.errors.js';
import {
  RecurringInvoiceRepository,
  InvoiceRepository,
  InvoiceSettingsRepository,
  InvoiceTemplateRepository,
  InvoiceActivityRepository,
} from '../repositories/index.js';

import type {
  CreateRecurringInvoiceParams,
  UpdateRecurringInvoiceParams,
  RecurringInvoiceWithDetails,
  CreateLineItemParams,
} from '../types/invoice.types.js';
import type { RecurringInvoice, Invoice } from '@prisma/client';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

export class RecurringInvoiceService {
  private readonly recurringRepository: RecurringInvoiceRepository;
  private readonly invoiceRepository: InvoiceRepository;
  private readonly settingsRepository: InvoiceSettingsRepository;
  private readonly templateRepository: InvoiceTemplateRepository;
  private readonly activityRepository: InvoiceActivityRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger
  ) {
    this.recurringRepository = new RecurringInvoiceRepository(prisma);
    this.invoiceRepository = new InvoiceRepository(prisma);
    this.settingsRepository = new InvoiceSettingsRepository(prisma);
    this.templateRepository = new InvoiceTemplateRepository(prisma);
    this.activityRepository = new InvoiceActivityRepository(prisma);
  }

  /**
   * Create a recurring invoice schedule
   */
  async createRecurringInvoice(params: CreateRecurringInvoiceParams): Promise<RecurringInvoice> {
    // Validate line items
    if (!params.lineItems || params.lineItems.length === 0) {
      throw new InvoiceError(InvoiceErrorCode.INVOICE_NO_LINE_ITEMS);
    }

    // Validate recurrence configuration
    this.validateRecurrenceConfig(params);

    const recurring = await this.recurringRepository.create(params);

    this.logger.info(
      {
        recurringInvoiceId: recurring.id,
        userId: params.freelancerUserId,
        frequency: params.frequency,
      },
      'Recurring invoice created'
    );

    return recurring;
  }

  /**
   * Get recurring invoice by ID
   */
  async getRecurringInvoice(id: string, userId: string): Promise<RecurringInvoiceWithDetails> {
    const recurring = await this.recurringRepository.findById(id);

    if (!recurring || recurring.freelancerUserId !== userId) {
      throw recurringErrors.notFound(id);
    }

    const invoiceCount = await this.recurringRepository.getInvoiceCount(id);

    return {
      ...recurring,
      invoiceCount,
    };
  }

  /**
   * List recurring invoices for user
   */
  async listRecurringInvoices(userId: string): Promise<RecurringInvoice[]> {
    return this.recurringRepository.findByUserId(userId);
  }

  /**
   * Update recurring invoice
   */
  async updateRecurringInvoice(
    id: string,
    userId: string,
    params: UpdateRecurringInvoiceParams
  ): Promise<RecurringInvoice> {
    const existing = await this.recurringRepository.findById(id);

    if (!existing || existing.freelancerUserId !== userId) {
      throw recurringErrors.notFound(id);
    }

    if (!existing.isActive) {
      throw recurringErrors.inactive(id);
    }

    // Validate if recurrence config is being changed
    if (params.frequency || params.interval || params.dayOfMonth || params.dayOfWeek) {
      this.validateRecurrenceConfig({
        ...existing,
        ...params,
        lineItems: params.lineItems ?? (existing.lineItems as unknown as CreateLineItemParams[]),
      } as unknown as CreateRecurringInvoiceParams);
    }

    const recurring = await this.recurringRepository.update(id, params);

    this.logger.info({ recurringInvoiceId: id, userId }, 'Recurring invoice updated');

    return recurring;
  }

  /**
   * Pause recurring invoice
   */
  async pauseRecurringInvoice(id: string, userId: string): Promise<RecurringInvoice> {
    const existing = await this.recurringRepository.findById(id);

    if (!existing || existing.freelancerUserId !== userId) {
      throw recurringErrors.notFound(id);
    }

    if (!existing.isActive) {
      throw recurringErrors.inactive(id);
    }

    const recurring = await this.recurringRepository.pause(id);

    this.logger.info({ recurringInvoiceId: id, userId }, 'Recurring invoice paused');

    return recurring;
  }

  /**
   * Resume recurring invoice
   */
  async resumeRecurringInvoice(id: string, userId: string): Promise<RecurringInvoice> {
    const existing = await this.recurringRepository.findById(id);

    if (!existing || existing.freelancerUserId !== userId) {
      throw recurringErrors.notFound(id);
    }

    if (!existing.isActive) {
      throw recurringErrors.inactive(id);
    }

    if (!existing.isPaused) {
      return existing;
    }

    const recurring = await this.recurringRepository.resume(id);

    this.logger.info({ recurringInvoiceId: id, userId }, 'Recurring invoice resumed');

    return recurring;
  }

  /**
   * Deactivate recurring invoice
   */
  async deactivateRecurringInvoice(id: string, userId: string): Promise<RecurringInvoice> {
    const existing = await this.recurringRepository.findById(id);

    if (!existing || existing.freelancerUserId !== userId) {
      throw recurringErrors.notFound(id);
    }

    const recurring = await this.recurringRepository.deactivate(id);

    this.logger.info({ recurringInvoiceId: id, userId }, 'Recurring invoice deactivated');

    return recurring;
  }

  /**
   * Process all due recurring invoices (called by worker)
   */
  async processDueRecurringInvoices(): Promise<{ created: number; errors: string[] }> {
    const dueRecurring = await this.recurringRepository.findDueToRun();
    let created = 0;
    const errors: string[] = [];

    for (const recurring of dueRecurring) {
      try {
        await this.generateInvoiceFromRecurring(recurring);
        created++;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Recurring ${recurring.id}: ${message}`);
        this.logger.error(
          { recurringInvoiceId: recurring.id, error: message },
          'Failed to generate recurring invoice'
        );
      }
    }

    this.logger.info(
      { processed: dueRecurring.length, created, errors: errors.length },
      'Processed recurring invoices'
    );

    return { created, errors };
  }

  /**
   * Generate invoice from recurring schedule
   */
  async generateInvoiceFromRecurring(recurring: RecurringInvoice): Promise<Invoice> {
    // Check if max reached
    if (recurring.maxInvoices) {
      const count = await this.recurringRepository.getInvoiceCount(recurring.id);
      if (count >= recurring.maxInvoices) {
        throw recurringErrors.maxReached(recurring.id, recurring.maxInvoices);
      }
    }

    // Parse line items template
    const lineItems = recurring.lineItems as unknown as CreateLineItemParams[];

    // Calculate amounts
    const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    let taxAmount = 0;
    if (recurring.taxRate) {
      taxAmount = subtotal * (Number(recurring.taxRate) / 100);
    }
    const total = subtotal + taxAmount;

    // Generate invoice number
    const invoiceNumber = await this.settingsRepository.generateNextNumber(
      recurring.freelancerUserId
    );

    // Calculate due date
    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + recurring.dueDays);

    // Generate view token
    const viewToken = randomBytes(32).toString('hex');

    // Create invoice
    const invoice = await this.invoiceRepository.create({
      freelancerUserId: recurring.freelancerUserId,
      clientId: recurring.clientId,
      projectId: recurring.projectId ?? undefined,
      templateId: recurring.templateId ?? undefined,
      lineItems,
      issueDate,
      dueDate,
      invoiceNumber,
      subtotal,
      discountAmount: 0,
      taxAmount,
      total,
      viewToken,
      taxEnabled: !!recurring.taxRate,
      taxRate: recurring.taxRate ? Number(recurring.taxRate) : undefined,
    });

    // Update recurring schedule
    await this.recurringRepository.recordInvoiceGenerated(recurring.id);

    // Log activity
    await this.activityRepository.logCreated(invoice.id, recurring.freelancerUserId);

    // Auto-send if enabled
    if (recurring.autoSend) {
      await this.invoiceRepository.updateStatus(invoice.id, 'SENT');
      // TODO: Actually send via notification service
    }

    this.logger.info(
      {
        invoiceId: invoice.id,
        recurringInvoiceId: recurring.id,
        autoSent: recurring.autoSend,
      },
      'Invoice generated from recurring'
    );

    return invoice;
  }

  /**
   * Validate recurrence configuration
   */
  private validateRecurrenceConfig(params: CreateRecurringInvoiceParams): void {
    if (params.interval !== undefined && params.interval < 1) {
      throw new InvoiceError(InvoiceErrorCode.INVALID_RECURRENCE_CONFIG, {
        reason: 'Interval must be at least 1',
      });
    }

    if (params.dayOfMonth !== undefined && (params.dayOfMonth < 1 || params.dayOfMonth > 31)) {
      throw new InvoiceError(InvoiceErrorCode.INVALID_RECURRENCE_CONFIG, {
        reason: 'Day of month must be between 1 and 31',
      });
    }

    if (params.dayOfWeek !== undefined && (params.dayOfWeek < 0 || params.dayOfWeek > 6)) {
      throw new InvoiceError(InvoiceErrorCode.INVALID_RECURRENCE_CONFIG, {
        reason: 'Day of week must be between 0 (Sunday) and 6 (Saturday)',
      });
    }

    if (params.endDate && params.endDate < params.startDate) {
      throw new InvoiceError(InvoiceErrorCode.INVALID_RECURRENCE_CONFIG, {
        reason: 'End date must be after start date',
      });
    }

    if (params.maxInvoices !== undefined && params.maxInvoices < 1) {
      throw new InvoiceError(InvoiceErrorCode.INVALID_RECURRENCE_CONFIG, {
        reason: 'Max invoices must be at least 1',
      });
    }
  }
}
