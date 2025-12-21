/**
 * @module @skillancer/cockpit-svc/services/invoice-template
 * Invoice Template Service - Template management operations
 */

import { InvoiceError, InvoiceErrorCode, templateErrors } from '../errors/invoice.errors.js';
import { InvoiceTemplateRepository } from '../repositories/index.js';

import type { CreateTemplateParams, UpdateTemplateParams } from '../types/invoice.types.js';
import type { InvoiceTemplate } from '@prisma/client';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

export class InvoiceTemplateService {
  private readonly templateRepository: InvoiceTemplateRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger
  ) {
    this.templateRepository = new InvoiceTemplateRepository(prisma);
  }

  /**
   * Create a new template
   */
  async createTemplate(params: CreateTemplateParams): Promise<InvoiceTemplate> {
    const template = await this.templateRepository.create(params);

    this.logger.info(
      { templateId: template.id, userId: params.freelancerUserId },
      'Invoice template created'
    );

    return template;
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string, userId: string): Promise<InvoiceTemplate> {
    const template = await this.templateRepository.findById(templateId);

    if (!template || template.freelancerUserId !== userId) {
      throw templateErrors.notFound(templateId);
    }

    return template;
  }

  /**
   * List user templates
   */
  async listTemplates(userId: string): Promise<InvoiceTemplate[]> {
    return this.templateRepository.findByUserId(userId);
  }

  /**
   * Get default template
   */
  async getDefaultTemplate(userId: string): Promise<InvoiceTemplate | null> {
    return this.templateRepository.findDefault(userId);
  }

  /**
   * Update a template
   */
  async updateTemplate(
    templateId: string,
    userId: string,
    params: UpdateTemplateParams
  ): Promise<InvoiceTemplate> {
    const existing = await this.templateRepository.findById(templateId);

    if (!existing || existing.freelancerUserId !== userId) {
      throw templateErrors.notFound(templateId);
    }

    const template = await this.templateRepository.update(templateId, params);

    this.logger.info({ templateId, userId }, 'Invoice template updated');

    return template;
  }

  /**
   * Set template as default
   */
  async setDefault(templateId: string, userId: string): Promise<InvoiceTemplate> {
    const existing = await this.templateRepository.findById(templateId);

    if (!existing || existing.freelancerUserId !== userId) {
      throw templateErrors.notFound(templateId);
    }

    const template = await this.templateRepository.setDefault(templateId, userId);

    this.logger.info({ templateId, userId }, 'Default template set');

    return template;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string, userId: string): Promise<void> {
    const template = await this.templateRepository.findById(templateId);

    if (!template || template.freelancerUserId !== userId) {
      throw templateErrors.notFound(templateId);
    }

    if (template.isDefault) {
      throw templateErrors.cannotDeleteDefault(templateId);
    }

    // Check if template is in use
    const invoiceCount = await this.templateRepository.countInvoicesUsingTemplate(templateId);
    if (invoiceCount > 0) {
      throw templateErrors.inUse(templateId, invoiceCount);
    }

    await this.templateRepository.delete(templateId);

    this.logger.info({ templateId, userId }, 'Invoice template deleted');
  }

  /**
   * Duplicate a template
   */
  async duplicateTemplate(
    templateId: string,
    userId: string,
    newName: string
  ): Promise<InvoiceTemplate> {
    const existing = await this.templateRepository.findById(templateId);

    if (!existing || existing.freelancerUserId !== userId) {
      throw templateErrors.notFound(templateId);
    }

    const template = await this.templateRepository.duplicate(templateId, newName);

    this.logger.info(
      { templateId, newTemplateId: template.id, userId },
      'Invoice template duplicated'
    );

    return template;
  }
}
