/**
 * @module @skillancer/cockpit-svc/repositories/invoice-template
 * Invoice Template data access layer
 */

import type { CreateTemplateParams, UpdateTemplateParams } from '../types/invoice.types.js';
import type { InvoiceTemplate } from '@prisma/client';
import type { Prisma, PrismaClient } from '@skillancer/database';

export class InvoiceTemplateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new template
   */
  async create(data: CreateTemplateParams): Promise<InvoiceTemplate> {
    // If this is set as default, unset other defaults first
    if (data.isDefault) {
      await this.clearDefaults(data.freelancerUserId);
    }

    return this.prisma.invoiceTemplate.create({
      data: {
        freelancerUserId: data.freelancerUserId,
        name: data.name,
        description: data.description ?? null,
        isDefault: data.isDefault ?? false,
        logoUrl: data.logoUrl ?? null,
        accentColor: data.accentColor ?? '#3B82F6',
        fontFamily: data.fontFamily ?? 'Inter',
        layout: data.layout ?? 'CLASSIC',
        showLogo: data.showLogo ?? true,
        showPaymentQR: data.showPaymentQR ?? false,
        businessName: data.businessName ?? null,
        businessAddress: (data.businessAddress as Prisma.InputJsonValue) ?? null,
        businessEmail: data.businessEmail ?? null,
        businessPhone: data.businessPhone ?? null,
        businessWebsite: data.businessWebsite ?? null,
        taxNumber: data.taxNumber ?? null,
        defaultNotes: data.defaultNotes ?? null,
        defaultTerms: data.defaultTerms ?? null,
        defaultFooter: data.defaultFooter ?? null,
        paymentInstructions: data.paymentInstructions ?? null,
        defaultDueDays: data.defaultDueDays ?? 30,
        defaultTaxRate: data.defaultTaxRate ?? null,
        defaultTaxLabel: data.defaultTaxLabel ?? null,
        defaultCurrency: data.defaultCurrency ?? 'USD',
        defaultLateFee: (data.defaultLateFee as unknown as Prisma.InputJsonValue) ?? null,
        acceptedPaymentMethods: data.acceptedPaymentMethods ?? [],
        stripeEnabled: data.stripeEnabled ?? false,
        paypalEnabled: data.paypalEnabled ?? false,
        customCss: data.customCss ?? null,
      },
    });
  }

  /**
   * Find template by ID
   */
  async findById(id: string): Promise<InvoiceTemplate | null> {
    return this.prisma.invoiceTemplate.findUnique({
      where: { id },
    });
  }

  /**
   * Find all templates for a user
   */
  async findByUserId(freelancerUserId: string): Promise<InvoiceTemplate[]> {
    return this.prisma.invoiceTemplate.findMany({
      where: {
        freelancerUserId,
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Find default template for a user
   */
  async findDefault(freelancerUserId: string): Promise<InvoiceTemplate | null> {
    return this.prisma.invoiceTemplate.findFirst({
      where: {
        freelancerUserId,
        isDefault: true,
      },
    });
  }

  /**
   * Update a template
   */
  async update(id: string, data: UpdateTemplateParams): Promise<InvoiceTemplate> {
    const template = await this.findById(id);
    if (!template) throw new Error('Template not found');

    // If setting as default, clear other defaults
    if (data.isDefault && !template.isDefault) {
      await this.clearDefaults(template.freelancerUserId);
    }

    return this.prisma.invoiceTemplate.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        isDefault: data.isDefault,
        logoUrl: data.logoUrl,
        accentColor: data.accentColor,
        fontFamily: data.fontFamily,
        layout: data.layout,
        showLogo: data.showLogo,
        showPaymentQR: data.showPaymentQR,
        businessName: data.businessName,
        businessAddress: data.businessAddress as Prisma.InputJsonValue,
        businessEmail: data.businessEmail,
        businessPhone: data.businessPhone,
        businessWebsite: data.businessWebsite,
        taxNumber: data.taxNumber,
        defaultNotes: data.defaultNotes,
        defaultTerms: data.defaultTerms,
        defaultFooter: data.defaultFooter,
        paymentInstructions: data.paymentInstructions,
        defaultDueDays: data.defaultDueDays,
        defaultTaxRate: data.defaultTaxRate,
        defaultTaxLabel: data.defaultTaxLabel,
        defaultCurrency: data.defaultCurrency,
        defaultLateFee: data.defaultLateFee as unknown as Prisma.InputJsonValue,
        acceptedPaymentMethods: data.acceptedPaymentMethods,
        stripeEnabled: data.stripeEnabled,
        paypalEnabled: data.paypalEnabled,
        customCss: data.customCss,
      },
    });
  }

  /**
   * Set template as default
   */
  async setDefault(id: string, freelancerUserId: string): Promise<InvoiceTemplate> {
    await this.clearDefaults(freelancerUserId);

    return this.prisma.invoiceTemplate.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  /**
   * Clear default flag from all user templates
   */
  private async clearDefaults(freelancerUserId: string): Promise<void> {
    await this.prisma.invoiceTemplate.updateMany({
      where: {
        freelancerUserId,
        isDefault: true,
      },
      data: { isDefault: false },
    });
  }

  /**
   * Delete template
   */
  async delete(id: string): Promise<void> {
    await this.prisma.invoiceTemplate.delete({
      where: { id },
    });
  }

  /**
   * Count invoices using template
   */
  async countInvoicesUsingTemplate(templateId: string): Promise<number> {
    return this.prisma.invoice.count({
      where: { templateId },
    });
  }

  /**
   * Duplicate a template
   */
  async duplicate(id: string, newName: string): Promise<InvoiceTemplate> {
    const template = await this.findById(id);
    if (!template) throw new Error('Template not found');

    return this.prisma.invoiceTemplate.create({
      data: {
        freelancerUserId: template.freelancerUserId,
        name: newName,
        description: template.description,
        isDefault: false,
        logoUrl: template.logoUrl,
        accentColor: template.accentColor,
        fontFamily: template.fontFamily,
        layout: template.layout,
        showLogo: template.showLogo,
        showPaymentQR: template.showPaymentQR,
        businessName: template.businessName,
        businessAddress: template.businessAddress ?? undefined,
        businessEmail: template.businessEmail,
        businessPhone: template.businessPhone,
        businessWebsite: template.businessWebsite,
        taxNumber: template.taxNumber,
        defaultNotes: template.defaultNotes,
        defaultTerms: template.defaultTerms,
        defaultFooter: template.defaultFooter,
        paymentInstructions: template.paymentInstructions,
        defaultDueDays: template.defaultDueDays,
        defaultTaxRate: template.defaultTaxRate,
        defaultTaxLabel: template.defaultTaxLabel,
        defaultCurrency: template.defaultCurrency,
        defaultLateFee: template.defaultLateFee ?? undefined,
        acceptedPaymentMethods: template.acceptedPaymentMethods,
        stripeEnabled: template.stripeEnabled,
        paypalEnabled: template.paypalEnabled,
        customCss: template.customCss,
      },
    });
  }
}
