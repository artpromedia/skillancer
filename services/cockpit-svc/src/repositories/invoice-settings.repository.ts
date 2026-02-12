// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/repositories/invoice-settings
 * Invoice Settings data access layer
 */

import type { UpdateSettingsParams } from '../types/invoice.types.js';
import type { InvoiceSettings } from '../types/prisma-shim.js';
import type { Prisma, PrismaClient } from '../types/prisma-shim.js';

export class InvoiceSettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Get or create settings for a user
   */
  async getOrCreate(userId: string): Promise<InvoiceSettings> {
    const existing = await this.findByUserId(userId);
    if (existing) return existing;

    return this.prisma.invoiceSettings.create({
      data: {
        userId,
        invoicePrefix: 'INV',
        numberPadding: 4,
        numberFormat: '{prefix}-{year}{number}',
        nextInvoiceNumber: 1,
        defaultDueDays: 30,
        defaultCurrency: 'USD',
      },
    });
  }

  /**
   * Find settings by user ID
   */
  async findByUserId(userId: string): Promise<InvoiceSettings | null> {
    return this.prisma.invoiceSettings.findUnique({
      where: { userId },
    });
  }

  /**
   * Update settings
   */
  async update(userId: string, data: UpdateSettingsParams): Promise<InvoiceSettings> {
    return this.prisma.invoiceSettings.upsert({
      where: { userId },
      create: {
        userId,
        invoicePrefix: data.invoicePrefix ?? 'INV',
        numberPadding: data.numberPadding ?? 4,
        numberFormat: data.numberFormat ?? '{prefix}-{year}{number}',
        nextInvoiceNumber: 1,
        defaultDueDays: data.defaultDueDays ?? 30,
        defaultCurrency: data.defaultCurrency ?? 'USD',
        defaultTemplateId: data.defaultTemplateId ?? null,
        defaultTaxEnabled: data.defaultTaxEnabled ?? false,
        defaultTaxRate: data.defaultTaxRate ?? null,
        defaultTaxLabel: data.defaultTaxLabel ?? null,
        taxNumber: data.taxNumber ?? null,
        defaultLateFeeEnabled: data.defaultLateFeeEnabled ?? false,
        defaultLateFeeType: data.defaultLateFeeType ?? null,
        defaultLateFeeValue: data.defaultLateFeeValue ?? null,
        lateFeeGraceDays: data.lateFeeGraceDays ?? 0,
        autoReminders: data.autoReminders ?? true,
        reminderDays: data.reminderDays ?? [7, 3, 1, 0],
        stripeAccountId: data.stripeAccountId ?? null,
        paypalEmail: data.paypalEmail ?? null,
        bankDetails: (data.bankDetails as Prisma.InputJsonValue) ?? null,
      },
      update: {
        invoicePrefix: data.invoicePrefix,
        numberPadding: data.numberPadding,
        numberFormat: data.numberFormat,
        defaultDueDays: data.defaultDueDays,
        defaultCurrency: data.defaultCurrency,
        defaultTemplateId: data.defaultTemplateId,
        defaultTaxEnabled: data.defaultTaxEnabled,
        defaultTaxRate: data.defaultTaxRate,
        defaultTaxLabel: data.defaultTaxLabel,
        taxNumber: data.taxNumber,
        defaultLateFeeEnabled: data.defaultLateFeeEnabled,
        defaultLateFeeType: data.defaultLateFeeType,
        defaultLateFeeValue: data.defaultLateFeeValue,
        lateFeeGraceDays: data.lateFeeGraceDays,
        autoReminders: data.autoReminders,
        reminderDays: data.reminderDays,
        stripeAccountId: data.stripeAccountId,
        paypalEmail: data.paypalEmail,
        bankDetails: data.bankDetails as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Generate next invoice number
   */
  async generateNextNumber(userId: string): Promise<string> {
    // Use transaction for atomicity
    return this.prisma.$transaction(async (tx) => {
      const settings = await tx.invoiceSettings.upsert({
        where: { userId },
        create: {
          userId,
          invoicePrefix: 'INV',
          numberPadding: 4,
          numberFormat: '{prefix}-{year}{number}',
          nextInvoiceNumber: 1,
          defaultDueDays: 30,
          defaultCurrency: 'USD',
        },
        update: {},
      });

      // Increment the number
      const nextNumber = settings.nextInvoiceNumber;
      await tx.invoiceSettings.update({
        where: { userId },
        data: { nextInvoiceNumber: { increment: 1 } },
      });

      // Format the invoice number
      const year = new Date().getFullYear().toString();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const paddedNumber = String(nextNumber).padStart(settings.numberPadding, '0');

      const invoiceNumber = settings.numberFormat
        .replace('{prefix}', settings.invoicePrefix)
        .replace('{year}', year)
        .replace('{month}', month)
        .replace('{number}', paddedNumber);

      return invoiceNumber;
    });
  }

  /**
   * Update Stripe account
   */
  async updateStripeAccount(userId: string, stripeAccountId: string): Promise<InvoiceSettings> {
    return this.prisma.invoiceSettings.upsert({
      where: { userId },
      create: {
        userId,
        invoicePrefix: 'INV',
        numberPadding: 4,
        numberFormat: '{prefix}-{year}{number}',
        nextInvoiceNumber: 1,
        defaultDueDays: 30,
        defaultCurrency: 'USD',
        stripeAccountId,
      },
      update: { stripeAccountId },
    });
  }

  /**
   * Update PayPal email
   */
  async updatePayPalEmail(userId: string, paypalEmail: string): Promise<InvoiceSettings> {
    return this.prisma.invoiceSettings.upsert({
      where: { userId },
      create: {
        userId,
        invoicePrefix: 'INV',
        numberPadding: 4,
        numberFormat: '{prefix}-{year}{number}',
        nextInvoiceNumber: 1,
        defaultDueDays: 30,
        defaultCurrency: 'USD',
        paypalEmail,
      },
      update: { paypalEmail },
    });
  }

  /**
   * Update bank details
   */
  async updateBankDetails(
    userId: string,
    bankDetails: UpdateSettingsParams['bankDetails']
  ): Promise<InvoiceSettings> {
    return this.prisma.invoiceSettings.upsert({
      where: { userId },
      create: {
        userId,
        invoicePrefix: 'INV',
        numberPadding: 4,
        numberFormat: '{prefix}-{year}{number}',
        nextInvoiceNumber: 1,
        defaultDueDays: 30,
        defaultCurrency: 'USD',
        bankDetails: bankDetails as Prisma.InputJsonValue,
      },
      update: { bankDetails: bankDetails as Prisma.InputJsonValue },
    });
  }

  /**
   * Get reminder settings
   */
  async getReminderSettings(userId: string): Promise<{
    autoReminders: boolean;
    reminderDays: number[];
  }> {
    const settings = await this.getOrCreate(userId);
    return {
      autoReminders: settings.autoReminders,
      reminderDays: settings.reminderDays,
    };
  }
}
