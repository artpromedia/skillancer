/**
 * @module @skillancer/billing-svc/services/global-payout
 * Global Payout Service for multi-currency payouts
 *
 * Provides comprehensive payout functionality including:
 * - Balance management
 * - Multi-currency support with conversion
 * - Instant and standard payouts
 * - Scheduled automatic payouts
 * - Fee calculation and breakdown
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createLogger } from '@skillancer/logger';
import Stripe from 'stripe';

import { getExchangeRateService, type ExchangeRateService } from './exchange-rate.service.js';
import {
  getPayoutRepository,
  getPayoutBalanceRepository,
  getPayoutScheduleRepository,
  type PayoutRepository,
  type PayoutBalanceRepository,
  type PayoutScheduleRepository,
} from '../repositories/payout.repository.js';
import {
  type PayoutStatus,
  type PayoutFrequency,
  type RequestPayoutParams,
  type InstantPayoutParams,
  type PayoutPreviewParams,
  type PayoutResponse,
  type PayoutPreviewResponse,
  type PayoutBalanceSummary,
  type PayoutScheduleParams,
  type PayoutScheduleResponse,
  type PayoutListResponse,
  type PayoutFeeBreakdown,
  MINIMUM_PAYOUT_AMOUNTS,
  PAYOUT_FEES_BY_REGION,
  INSTANT_PAYOUT_CURRENCIES,
} from '../types/payout.types.js';

// =============================================================================
// TYPES
// =============================================================================

export interface GlobalPayoutServiceConfig {
  stripeSecretKey: string;
  platformFeePercent?: number;
  instantPayoutEnabled?: boolean;
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export class GlobalPayoutService {
  private readonly logger = createLogger({ serviceName: 'global-payout-service' });
  private readonly stripe: Stripe;
  private readonly payoutRepo: PayoutRepository;
  private readonly balanceRepo: PayoutBalanceRepository;
  private readonly scheduleRepo: PayoutScheduleRepository;
  private readonly exchangeService: ExchangeRateService;
  private readonly platformFeePercent: number;
  private readonly instantPayoutEnabled: boolean;

  constructor(config: GlobalPayoutServiceConfig) {
    this.stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2024-12-18.acacia' });
    this.payoutRepo = getPayoutRepository();
    this.balanceRepo = getPayoutBalanceRepository();
    this.scheduleRepo = getPayoutScheduleRepository();
    this.exchangeService = getExchangeRateService();
    this.platformFeePercent = config.platformFeePercent ?? 2.5;
    this.instantPayoutEnabled = config.instantPayoutEnabled ?? true;

    this.logger.info('Global payout service initialized', {
      platformFeePercent: this.platformFeePercent,
      instantPayoutEnabled: this.instantPayoutEnabled,
    });
  }

  // ===========================================================================
  // BALANCE MANAGEMENT
  // ===========================================================================

  /**
   * Get user's payout balance summary across all currencies
   */
  async getBalance(userId: string): Promise<PayoutBalanceSummary> {
    const balances = await this.balanceRepo.findByUserId(userId);

    // Group balances by currency
    const currencyBalances = balances.map((b) => ({
      currency: b.currency,
      available: b.availableBalance,
      pending: b.pendingBalance,
      lastUpdated: new Date(),
    }));

    // Calculate pending releases (from escrow)
    const pendingReleases = await this.getPendingReleases(userId);

    // Calculate lifetime stats
    const lifetimeStats = {
      totalEarned: balances.reduce((sum, b) => sum + b.totalEarned, 0),
      totalPaidOut: balances.reduce((sum, b) => sum + b.totalPaidOut, 0),
      totalFeesPaid: 0, // Calculate from payout history
      payoutCount: 0,
    };

    // Get next scheduled payout
    const schedule = await this.scheduleRepo.findByUserId(userId);
    const nextScheduledPayout = schedule?.nextScheduledAt ?? null;

    return {
      userId,
      balances: currencyBalances,
      pendingReleases,
      lifetimeStats,
      nextScheduledPayout,
    };
  }

  /**
   * Add funds to user's available balance
   * Called when escrow is released or payment received
   */
  async addToBalance(
    userId: string,
    amount: number,
    currency: string,
    description?: string
  ): Promise<void> {
    this.logger.info('Adding to balance', { userId, amount, currency });

    await this.balanceRepo.incrementAvailable(userId, currency, amount);

    this.logger.info('Balance updated', { userId, amount, currency, description });
  }

  /**
   * Reserve funds from available balance (pending payout)
   */
  async reserveBalance(userId: string, amount: number, currency: string): Promise<void> {
    await this.balanceRepo.moveToPending(userId, currency, amount);
  }

  /**
   * Release reserved funds back to available
   */
  async releaseReservedBalance(userId: string, amount: number, currency: string): Promise<void> {
    await this.balanceRepo.moveFromPending(userId, currency, amount);
  }

  // ===========================================================================
  // PAYOUT OPERATIONS
  // ===========================================================================

  /**
   * Request a standard payout
   */
  async requestPayout(params: RequestPayoutParams): Promise<PayoutResponse> {
    const {
      userId,
      amount,
      currency,
      targetCurrency,
      method = 'BANK_TRANSFER',
      description,
    } = params;

    this.logger.info('Processing payout request', { userId, amount, currency, method });

    // Get user's payout account
    const payoutAccount = await this.payoutRepo.findAccountByUserId(userId);
    if (!payoutAccount) {
      throw new Error('No payout account found. Please complete onboarding first.');
    }

    if (payoutAccount.status !== 'ACTIVE') {
      throw new Error('Payout account is not active. Please complete verification.');
    }

    // Validate amount
    const effectiveCurrency = targetCurrency ?? currency;
    const minAmount = MINIMUM_PAYOUT_AMOUNTS[effectiveCurrency] ?? 50;
    if (amount < minAmount) {
      throw new Error(`Minimum payout amount is ${minAmount} ${effectiveCurrency}`);
    }

    // Check balance
    const balance = await this.balanceRepo.findByUserAndCurrency(userId, currency);
    if (!balance || balance.availableBalance < amount) {
      throw new Error('Insufficient balance for payout');
    }

    // Calculate conversion if needed
    let finalAmount = amount;
    let exchangeRate: number | undefined;
    let conversionFee = 0;

    if (targetCurrency && targetCurrency !== currency) {
      const conversion = await this.exchangeService.convert({
        fromCurrency: currency,
        toCurrency: targetCurrency,
        amount,
      });
      finalAmount = conversion.convertedAmount;
      exchangeRate = conversion.exchangeRate;
      conversionFee = this.calculateConversionFee(amount, currency);
    }

    // Calculate payout fee
    const feeBreakdown = this.calculateFees(finalAmount, effectiveCurrency, method);
    const netAmount = finalAmount - feeBreakdown.totalFee;

    // Reserve balance
    await this.reserveBalance(userId, amount, currency);

    try {
      // Create Stripe transfer to connected account
      const transfer = await this.stripe.transfers.create({
        amount: Math.round(amount * 100), // Stripe uses cents
        currency: currency.toLowerCase(),
        destination: payoutAccount.stripeConnectAccountId,
        description: description ?? 'Skillancer payout',
        metadata: {
          userId,
          payoutMethod: method,
          targetCurrency: effectiveCurrency,
        },
      });

      // Create payout record
      const payout = await this.payoutRepo.create({
        payoutAccountId: payoutAccount.id,
        userId,
        stripeTransferId: transfer.id,
        amount: netAmount,
        currency: effectiveCurrency,
        originalAmount: amount,
        originalCurrency: currency,
        exchangeRate,
        payoutFee: feeBreakdown.totalFee,
        conversionFee,
        status: 'PENDING',
        method,
        type: 'STANDARD',
        estimatedArrival: this.calculateEstimatedArrival(method, effectiveCurrency),
      });

      // Update balance
      await this.balanceRepo.incrementTotalPaidOut(userId, currency, amount);

      this.logger.info('Payout created successfully', {
        payoutId: payout.id,
        transferId: transfer.id,
        amount: netAmount,
        currency: effectiveCurrency,
      });

      return this.formatPayoutResponse(payout, feeBreakdown);
    } catch (err) {
      // Release reserved balance on failure
      await this.releaseReservedBalance(userId, amount, currency);

      this.logger.error('Payout creation failed', { err, userId, amount });
      throw err;
    }
  }

  /**
   * Request an instant payout (higher fees, faster delivery)
   */
  async requestInstantPayout(params: InstantPayoutParams): Promise<PayoutResponse> {
    const { userId, amount, currency, destination } = params;

    if (!this.instantPayoutEnabled) {
      throw new Error('Instant payouts are not enabled');
    }

    if (!INSTANT_PAYOUT_CURRENCIES.includes(currency)) {
      throw new Error(`Instant payouts not available for ${currency}`);
    }

    this.logger.info('Processing instant payout request', { userId, amount, currency });

    // Get payout account
    const payoutAccount = await this.payoutRepo.findAccountByUserId(userId);
    if (!payoutAccount) {
      throw new Error('No payout account found');
    }

    // Check balance
    const balance = await this.balanceRepo.findByUserAndCurrency(userId, currency);
    if (!balance || balance.availableBalance < amount) {
      throw new Error('Insufficient balance for instant payout');
    }

    // Calculate instant payout fees (higher than standard)
    const feeBreakdown = this.calculateFees(amount, currency, 'DEBIT_CARD');
    feeBreakdown.instantFee = Math.max(amount * 0.015, 1.5); // 1.5% or $1.50 min
    feeBreakdown.totalFee += feeBreakdown.instantFee;
    const netAmount = amount - feeBreakdown.totalFee;

    // Reserve balance
    await this.reserveBalance(userId, amount, currency);

    try {
      // Create Stripe instant payout
      const transfer = await this.stripe.transfers.create({
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        destination: payoutAccount.stripeConnectAccountId,
        metadata: {
          userId,
          payoutType: 'instant',
          destination: destination ?? 'debit_card',
        },
      });

      // Create payout record
      const payout = await this.payoutRepo.create({
        payoutAccountId: payoutAccount.id,
        userId,
        stripeTransferId: transfer.id,
        amount: netAmount,
        currency,
        originalAmount: amount,
        originalCurrency: currency,
        payoutFee: feeBreakdown.totalFee,
        conversionFee: 0,
        status: 'PROCESSING',
        method: 'DEBIT_CARD',
        type: 'INSTANT',
        destination: { type: destination ?? 'debit_card' },
        estimatedArrival: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      });

      await this.balanceRepo.incrementTotalPaidOut(userId, currency, amount);

      return this.formatPayoutResponse(payout, feeBreakdown);
    } catch (err) {
      await this.releaseReservedBalance(userId, amount, currency);
      this.logger.error('Instant payout failed', { err, userId, amount });
      throw err;
    }
  }

  /**
   * Preview payout with fee breakdown
   */
  async previewPayout(params: PayoutPreviewParams): Promise<PayoutPreviewResponse> {
    const {
      userId,
      amount,
      currency,
      targetCurrency,
      method = 'BANK_TRANSFER',
      instant = false,
    } = params;

    // Check balance
    const balance = await this.balanceRepo.findByUserAndCurrency(userId, currency);
    const availableBalance = balance?.availableBalance ?? 0;

    // Calculate conversion if needed
    let convertedAmount = amount;
    let conversionDetails = undefined;
    let conversionFee = 0;

    if (targetCurrency && targetCurrency !== currency) {
      const preview = await this.exchangeService.previewConversion(
        currency,
        targetCurrency,
        amount
      );
      convertedAmount = preview.toAmount;
      conversionFee = this.calculateConversionFee(amount, currency);
      conversionDetails = {
        fromCurrency: currency,
        toCurrency: targetCurrency,
        exchangeRate: preview.exchangeRate,
        convertedAmount: preview.toAmount,
      };
    }

    // Calculate fees
    const effectiveMethod = instant ? 'DEBIT_CARD' : method;
    const feeBreakdown = this.calculateFees(
      convertedAmount,
      targetCurrency ?? currency,
      effectiveMethod
    );

    if (instant) {
      feeBreakdown.instantFee = Math.max(convertedAmount * 0.015, 1.5);
      feeBreakdown.totalFee += feeBreakdown.instantFee;
    }

    if (conversionFee > 0) {
      feeBreakdown.conversionFee = conversionFee;
      feeBreakdown.totalFee += conversionFee;
    }

    const netAmount = convertedAmount - feeBreakdown.totalFee;
    const estimatedArrival = this.calculateEstimatedArrival(
      effectiveMethod,
      targetCurrency ?? currency,
      instant
    );

    return {
      grossAmount: amount,
      currency: targetCurrency ?? currency,
      fees: feeBreakdown,
      netAmount,
      estimatedArrival,
      availableBalance,
      canProcess: availableBalance >= amount && netAmount > 0,
      conversion: conversionDetails,
    };
  }

  /**
   * Get payout by ID
   */
  async getPayout(payoutId: string): Promise<PayoutResponse | null> {
    const payout = await this.payoutRepo.findById(payoutId);
    if (!payout) return null;

    const feeBreakdown = this.parseFeeBreakdown(payout);
    return this.formatPayoutResponse(payout, feeBreakdown);
  }

  /**
   * Get user's payout history
   */
  async getPayoutHistory(
    userId: string,
    options?: {
      status?: PayoutStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<PayoutListResponse> {
    const { payouts, total } = await this.payoutRepo.findByUserId(userId, options);

    return {
      payouts: payouts.map((p) => this.formatPayoutResponse(p, this.parseFeeBreakdown(p))),
      total,
      hasMore: (options?.offset ?? 0) + payouts.length < total,
    };
  }

  /**
   * Cancel a pending payout
   */
  async cancelPayout(payoutId: string, userId: string): Promise<PayoutResponse> {
    const payout = await this.payoutRepo.findById(payoutId);
    if (!payout) {
      throw new Error('Payout not found');
    }

    // Verify ownership
    const account = await this.payoutRepo.findAccountByUserId(userId);
    if (!account || payout.payoutAccountId !== account.id) {
      throw new Error('Unauthorized to cancel this payout');
    }

    if (payout.status !== 'PENDING') {
      throw new Error('Only pending payouts can be cancelled');
    }

    // Parse metadata
    const metadata = this.parsePayoutMetadata(payout);

    // Try to cancel Stripe transfer
    if (payout.stripeTransferId) {
      try {
        await this.stripe.transfers.createReversal(payout.stripeTransferId);
      } catch (err) {
        this.logger.warn('Failed to reverse Stripe transfer', {
          err,
          transferId: payout.stripeTransferId,
        });
        throw new Error('Unable to cancel payout - it may have already been processed');
      }
    }

    // Update payout status
    const updated = await this.payoutRepo.update(payoutId, {
      status: 'CANCELLED',
    });

    // Refund balance
    const originalAmount = metadata.originalAmount ?? payout.amount;
    const originalCurrency = metadata.originalCurrency ?? payout.currency;
    await this.releaseReservedBalance(userId, originalAmount, originalCurrency);

    return this.formatPayoutResponse(updated, this.parseFeeBreakdown(updated));
  }

  // ===========================================================================
  // SCHEDULE MANAGEMENT
  // ===========================================================================

  /**
   * Get user's payout schedule
   */
  async getSchedule(userId: string): Promise<PayoutScheduleResponse | null> {
    const schedule = await this.scheduleRepo.findByUserId(userId);
    if (!schedule) return null;

    return {
      id: schedule.id,
      frequency: schedule.frequency,
      dayOfWeek: schedule.dayOfWeek,
      dayOfMonth: schedule.dayOfMonth,
      minimumAmount: schedule.minimumAmount,
      currency: schedule.currency,
      autoPayoutEnabled: schedule.autoPayoutEnabled,
      lastPayoutAt: schedule.lastPayoutAt ?? null,
      nextScheduledAt: schedule.nextScheduledAt ?? null,
    };
  }

  /**
   * Create or update payout schedule
   */
  async updateSchedule(
    userId: string,
    params: PayoutScheduleParams
  ): Promise<PayoutScheduleResponse> {
    const existing = await this.scheduleRepo.findByUserId(userId);

    // Calculate next scheduled payout
    const nextScheduledAt = this.calculateNextScheduledDate(
      params.frequency,
      params.dayOfWeek,
      params.dayOfMonth
    );

    const scheduleData = {
      ...params,
      userId,
      nextScheduledAt,
    };

    let schedule;
    if (existing) {
      schedule = await this.scheduleRepo.update(userId, scheduleData);
    } else {
      schedule = await this.scheduleRepo.create(scheduleData);
    }

    if (!schedule) {
      throw new Error('Failed to create/update schedule');
    }

    return {
      id: schedule.id,
      frequency: schedule.frequency,
      dayOfWeek: schedule.dayOfWeek,
      dayOfMonth: schedule.dayOfMonth,
      minimumAmount: schedule.minimumAmount,
      currency: schedule.currency,
      autoPayoutEnabled: schedule.autoPayoutEnabled,
      lastPayoutAt: schedule.lastPayoutAt ?? null,
      nextScheduledAt: schedule.nextScheduledAt ?? null,
    };
  }

  /**
   * Process scheduled payouts (called by cron job)
   */
  async processScheduledPayouts(): Promise<void> {
    const now = new Date();
    const dueSchedules = await this.scheduleRepo.findDueSchedules(now);

    this.logger.info('Processing scheduled payouts', { count: dueSchedules.length });

    for (const schedule of dueSchedules) {
      try {
        // Get user's balance
        const balance = await this.balanceRepo.findByUserAndCurrency(
          schedule.userId,
          schedule.currency
        );

        if (!balance || balance.availableBalance < schedule.minimumAmount) {
          this.logger.debug('Skipping scheduled payout - insufficient balance', {
            userId: schedule.userId,
            available: balance?.availableBalance ?? 0,
            minimum: schedule.minimumAmount,
          });
          continue;
        }

        // Process payout
        await this.requestPayout({
          userId: schedule.userId,
          amount: balance.availableBalance,
          currency: schedule.currency,
          description: 'Scheduled automatic payout',
        });

        // Update schedule
        const nextScheduledAt = this.calculateNextScheduledDate(
          schedule.frequency,
          schedule.dayOfWeek,
          schedule.dayOfMonth
        );

        await this.scheduleRepo.update(schedule.userId, {
          lastPayoutAt: now,
          nextScheduledAt,
        });

        this.logger.info('Scheduled payout processed', {
          userId: schedule.userId,
          amount: balance.availableBalance,
        });
      } catch (err) {
        this.logger.error('Failed to process scheduled payout', {
          err,
          userId: schedule.userId,
        });
      }
    }
  }

  // ===========================================================================
  // WEBHOOK HANDLERS
  // ===========================================================================

  /**
   * Handle Stripe payout events
   */
  async handlePayoutEvent(event: Stripe.Event): Promise<void> {
    const payout = event.data.object as Stripe.Payout | Stripe.Transfer;

    switch (event.type) {
      case 'payout.paid':
        await this.handlePayoutPaid(payout as Stripe.Payout);
        break;
      case 'payout.failed':
        await this.handlePayoutFailed(payout as Stripe.Payout);
        break;
      case 'payout.canceled':
        await this.handlePayoutCanceled(payout as Stripe.Payout);
        break;
      case 'transfer.paid':
        await this.handleTransferPaid(payout as Stripe.Transfer);
        break;
      case 'transfer.failed':
        await this.handleTransferFailed(payout as Stripe.Transfer);
        break;
      default:
        this.logger.debug('Unhandled payout event', { type: event.type });
    }
  }

  private async handlePayoutPaid(payout: Stripe.Payout): Promise<void> {
    const record = await this.payoutRepo.findByStripeId(payout.id);
    if (!record) return;

    await this.payoutRepo.update(record.id, {
      status: 'PAID',
      arrivedAt: payout.arrival_date ? new Date(payout.arrival_date * 1000) : new Date(),
    });

    this.logger.info('Payout marked as paid', { payoutId: record.id });
  }

  private async handlePayoutFailed(payout: Stripe.Payout): Promise<void> {
    const record = await this.payoutRepo.findByStripeId(payout.id);
    if (!record) return;

    await this.payoutRepo.update(record.id, {
      status: 'FAILED',
      failureCode: payout.failure_code ?? undefined,
      failureMessage: payout.failure_message ?? undefined,
    });

    // Refund balance
    const metadata = this.parsePayoutMetadata(record);
    const userId = metadata.userId ?? record.payoutAccount?.userId;
    if (userId) {
      const originalAmount = metadata.originalAmount ?? record.amount;
      const originalCurrency = metadata.originalCurrency ?? record.currency;
      await this.releaseReservedBalance(userId, originalAmount, originalCurrency);
    }

    this.logger.error('Payout failed', {
      payoutId: record.id,
      failureCode: payout.failure_code,
    });
  }

  private async handlePayoutCanceled(payout: Stripe.Payout): Promise<void> {
    const record = await this.payoutRepo.findByStripeId(payout.id);
    if (!record) return;

    await this.payoutRepo.update(record.id, {
      status: 'CANCELLED',
    });

    this.logger.info('Payout canceled', { payoutId: record.id });
  }

  private async handleTransferPaid(transfer: Stripe.Transfer): Promise<void> {
    const record = await this.payoutRepo.findByStripeId(transfer.id);
    if (!record) return;

    await this.payoutRepo.update(record.id, {
      status: 'IN_TRANSIT',
    });

    this.logger.info('Transfer successful, payout in transit', { payoutId: record.id });
  }

  private async handleTransferFailed(transfer: Stripe.Transfer): Promise<void> {
    const record = await this.payoutRepo.findByStripeId(transfer.id);
    if (!record) return;

    await this.payoutRepo.update(record.id, {
      status: 'FAILED',
      failureMessage: 'Transfer failed',
    });

    this.logger.error('Transfer failed', { payoutId: record.id, transferId: transfer.id });
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private async getPendingReleases(userId: string) {
    // This would query escrow releases that are pending
    // For now, return empty array
    return [];
  }

  private calculateFees(amount: number, currency: string, method: string): PayoutFeeBreakdown {
    // Get region-based fees
    const region = this.getRegionForCurrency(currency);
    const regionFee = PAYOUT_FEES_BY_REGION[region] ?? PAYOUT_FEES_BY_REGION.DEFAULT ?? 3;

    // Fixed fee based on region, no percentage fee for payouts
    const fixedFee = regionFee;
    const processingFee = amount * 0.005; // 0.5% processing

    const totalFee = fixedFee + processingFee;

    return {
      payoutFee: fixedFee,
      processingFee,
      conversionFee: 0,
      instantFee: 0,
      totalFee: Math.round(totalFee * 100) / 100,
    };
  }

  private calculateConversionFee(amount: number, currency: string): number {
    // 0.5% conversion fee
    return Math.round(amount * 0.005 * 100) / 100;
  }

  private getRegionForCurrency(currency: string): string {
    const regionMap: Record<string, string> = {
      USD: 'US',
      EUR: 'EU',
      GBP: 'UK',
      CAD: 'CA',
      AUD: 'AU',
      INR: 'IN',
      BRL: 'BR',
      MXN: 'MX',
      NGN: 'NG',
      KES: 'KE',
      GHS: 'GH',
      ZAR: 'ZA',
      PHP: 'PH',
      PKR: 'PK',
    };
    return regionMap[currency] ?? 'GLOBAL';
  }

  private calculateEstimatedArrival(method: string, currency: string, instant = false): Date {
    const now = new Date();

    if (instant) {
      // 30 minutes for instant
      return new Date(now.getTime() + 30 * 60 * 1000);
    }

    // Business days based on method and region
    const businessDays = this.getBusinessDaysForPayout(method, currency);
    const arrival = new Date(now);
    let daysAdded = 0;

    while (daysAdded < businessDays) {
      arrival.setDate(arrival.getDate() + 1);
      const day = arrival.getDay();
      if (day !== 0 && day !== 6) {
        daysAdded++;
      }
    }

    return arrival;
  }

  private getBusinessDaysForPayout(method: string, currency: string): number {
    const baseMap: Record<string, number> = {
      BANK_TRANSFER: 3,
      DEBIT_CARD: 1,
      PAYPAL: 1,
      WISE: 2,
      LOCAL_BANK: 2,
    };

    const regionModifier: Record<string, number> = {
      USD: 0,
      EUR: 0,
      GBP: 0,
      CAD: 1,
      AUD: 1,
      INR: 2,
      NGN: 3,
      KES: 3,
      PHP: 2,
    };

    const base = baseMap[method] ?? 3;
    const modifier = regionModifier[currency] ?? 1;

    return base + modifier;
  }

  private calculateNextScheduledDate(
    frequency: PayoutFrequency,
    dayOfWeek?: number,
    dayOfMonth?: number
  ): Date {
    const now = new Date();
    const next = new Date(now);

    switch (frequency) {
      case 'DAILY':
        next.setDate(next.getDate() + 1);
        break;

      case 'WEEKLY': {
        const targetDay = dayOfWeek ?? 5; // Default to Friday
        const currentDay = now.getDay();
        const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
        next.setDate(next.getDate() + daysUntil);
        break;
      }

      case 'BIWEEKLY':
        next.setDate(next.getDate() + 14);
        break;

      case 'MONTHLY': {
        const targetDate = dayOfMonth ?? 1;
        next.setMonth(next.getMonth() + 1);
        next.setDate(Math.min(targetDate, this.getDaysInMonth(next)));
        break;
      }

      case 'MANUAL':
      default:
        return new Date(0); // Far past - won't trigger
    }

    // Set to business hours
    next.setHours(9, 0, 0, 0);

    return next;
  }

  private getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  private parsePayoutMetadata(payout: any): Record<string, any> {
    try {
      if (payout.description?.startsWith('{')) {
        return JSON.parse(payout.description);
      }
    } catch {
      // Ignore parse errors
    }
    return {};
  }

  private parseFeeBreakdown(payout: any): PayoutFeeBreakdown {
    const metadata = this.parsePayoutMetadata(payout);
    return {
      payoutFee: metadata.payoutFee ?? 0,
      processingFee: 0,
      conversionFee: metadata.conversionFee ?? 0,
      instantFee: 0,
      totalFee: (metadata.payoutFee ?? 0) + (metadata.conversionFee ?? 0),
    };
  }

  private formatPayoutResponse(payout: any, fees: PayoutFeeBreakdown): PayoutResponse {
    const metadata = this.parsePayoutMetadata(payout);

    return {
      id: payout.id,
      amount: payout.amount,
      currency: payout.currency,
      status: this.mapPrismaStatusToLocal(payout.status),
      method: metadata.method ?? 'BANK_TRANSFER',
      type: metadata.type ?? 'STANDARD',
      fees,
      estimatedArrival: metadata.estimatedArrival ? new Date(metadata.estimatedArrival) : null,
      arrivedAt: payout.arrivedAt ?? null,
      createdAt: payout.createdAt,
      failureReason: payout.failureMessage ?? null,
    };
  }

  private mapPrismaStatusToLocal(status: string): PayoutStatus {
    const map: Record<string, PayoutStatus> = {
      PENDING: 'PENDING',
      IN_TRANSIT: 'IN_TRANSIT',
      PAID: 'PAID',
      FAILED: 'FAILED',
      CANCELED: 'CANCELLED',
    };
    return map[status] ?? 'PENDING';
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let serviceInstance: GlobalPayoutService | null = null;

export function getGlobalPayoutService(config?: GlobalPayoutServiceConfig): GlobalPayoutService {
  if (!serviceInstance) {
    if (!config?.stripeSecretKey) {
      throw new Error('Stripe secret key is required to initialize GlobalPayoutService');
    }
    serviceInstance = new GlobalPayoutService(config);
  }
  return serviceInstance;
}
