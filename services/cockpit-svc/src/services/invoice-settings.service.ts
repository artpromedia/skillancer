// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/services/invoice-settings
 * Invoice Settings Service - User settings management
 */

import Stripe from 'stripe';

import { InvoiceError, InvoiceErrorCode } from '../errors/invoice.errors.js';
import { InvoiceSettingsRepository } from '../repositories/index.js';

import type { UpdateSettingsParams, BankDetails } from '../types/invoice.types.js';
import type { InvoiceSettings } from '@prisma/client';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

export class InvoiceSettingsService {
  private readonly settingsRepository: InvoiceSettingsRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger
  ) {
    this.settingsRepository = new InvoiceSettingsRepository(prisma);
  }

  /**
   * Get user settings (creates defaults if not exists)
   */
  async getSettings(userId: string): Promise<InvoiceSettings> {
    return this.settingsRepository.getOrCreate(userId);
  }

  /**
   * Update user settings
   */
  async updateSettings(userId: string, params: UpdateSettingsParams): Promise<InvoiceSettings> {
    // Validate number format if provided
    if (params.numberFormat) {
      if (!params.numberFormat.includes('{number}')) {
        throw new InvoiceError(InvoiceErrorCode.INVALID_SETTINGS, {
          reason: 'Number format must include {number} placeholder',
        });
      }
    }

    // Validate reminder days if provided
    if (params.reminderDays) {
      if (!Array.isArray(params.reminderDays) || params.reminderDays.length === 0) {
        throw new InvoiceError(InvoiceErrorCode.INVALID_SETTINGS, {
          reason: 'Reminder days must be a non-empty array',
        });
      }
    }

    const settings = await this.settingsRepository.update(userId, params);

    this.logger.info({ userId }, 'Invoice settings updated');

    return settings;
  }

  /**
   * Update Stripe Connect account
   */
  async updateStripeAccount(userId: string, stripeAccountId: string): Promise<InvoiceSettings> {
    // Verify Stripe account with Stripe API
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (stripeSecretKey) {
      const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' });
      try {
        const account = await stripe.accounts.retrieve(stripeAccountId);

        // Verify account is properly set up
        if (!account.charges_enabled || !account.payouts_enabled) {
          throw new InvoiceError(InvoiceErrorCode.STRIPE_ACCOUNT_INVALID, {
            reason: 'Stripe account is not fully set up. Please complete onboarding.',
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
          });
        }

        this.logger.info({ stripeAccountId, chargesEnabled: account.charges_enabled }, 'Stripe account verified');
      } catch (error: any) {
        if (error instanceof InvoiceError) throw error;
        throw new InvoiceError(InvoiceErrorCode.STRIPE_ACCOUNT_INVALID, {
          reason: 'Failed to verify Stripe account',
          error: error.message,
        });
      }
    }

    const settings = await this.settingsRepository.updateStripeAccount(userId, stripeAccountId);

    this.logger.info({ userId, stripeAccountId }, 'Stripe account updated');

    return settings;
  }

  /**
   * Update PayPal email
   */
  async updatePayPalEmail(userId: string, paypalEmail: string): Promise<InvoiceSettings> {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(paypalEmail)) {
      throw new InvoiceError(InvoiceErrorCode.INVALID_SETTINGS, {
        reason: 'Invalid PayPal email address',
      });
    }

    const settings = await this.settingsRepository.updatePayPalEmail(userId, paypalEmail);

    this.logger.info({ userId, paypalEmail }, 'PayPal email updated');

    return settings;
  }

  /**
   * Update bank details
   */
  async updateBankDetails(userId: string, bankDetails: BankDetails): Promise<InvoiceSettings> {
    const settings = await this.settingsRepository.updateBankDetails(userId, bankDetails);

    this.logger.info({ userId }, 'Bank details updated');

    return settings;
  }

  /**
   * Get next invoice number (preview without incrementing)
   */
  async previewNextInvoiceNumber(userId: string): Promise<string> {
    const settings = await this.settingsRepository.getOrCreate(userId);

    const year = new Date().getFullYear().toString();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const paddedNumber = String(settings.nextInvoiceNumber).padStart(settings.numberPadding, '0');

    return settings.numberFormat
      .replace('{prefix}', settings.invoicePrefix)
      .replace('{year}', year)
      .replace('{month}', month)
      .replace('{number}', paddedNumber);
  }

  /**
   * Check if Stripe is configured
   */
  async isStripeConfigured(userId: string): Promise<boolean> {
    const settings = await this.settingsRepository.findByUserId(userId);
    return !!settings?.stripeAccountId;
  }

  /**
   * Check if PayPal is configured
   */
  async isPayPalConfigured(userId: string): Promise<boolean> {
    const settings = await this.settingsRepository.findByUserId(userId);
    return !!settings?.paypalEmail;
  }

  /**
   * Get payment methods status
   */
  async getPaymentMethodsStatus(userId: string): Promise<{
    stripe: boolean;
    paypal: boolean;
    bankTransfer: boolean;
  }> {
    const settings = await this.settingsRepository.findByUserId(userId);

    return {
      stripe: !!settings?.stripeAccountId,
      paypal: !!settings?.paypalEmail,
      bankTransfer: !!settings?.bankDetails,
    };
  }
}

