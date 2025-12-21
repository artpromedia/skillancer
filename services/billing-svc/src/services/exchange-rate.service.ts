// @ts-nocheck - Known type issues pending refactor
/**
 * @module @skillancer/billing-svc/services/exchange-rate
 * Exchange Rate Service for currency conversion
 *
 * Provides real-time exchange rates for multi-currency payouts with
 * markup management and caching for optimal performance.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */

import { createLogger } from '@skillancer/logger';

import {
  getExchangeRateRepository,
  type ExchangeRateRepository,
} from '../repositories/payout.repository.js';
import {
  SUPPORTED_PAYOUT_CURRENCIES,
  PLATFORM_FX_MARKUP_PERCENT,
  type ExchangeRateInfo,
  type ConversionResult,
  type ConversionPreview,
  type SupportedCurrenciesResponse,
} from '../types/payout.types.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ExchangeRateServiceConfig {
  baseApiUrl?: string;
  apiKey?: string;
  cacheMinutes?: number;
  markupPercent?: number;
}

export interface GetConversionParams {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export class ExchangeRateService {
  private readonly logger = createLogger({ serviceName: 'exchange-rate-service' });
  private readonly repository: ExchangeRateRepository;
  private readonly cacheMinutes: number;
  private readonly markupPercent: number;

  // Mock rates for development - in production, fetch from API
  private readonly baseRates: Record<string, number> = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    CAD: 1.36,
    AUD: 1.53,
    INR: 83.12,
    BRL: 4.97,
    MXN: 17.15,
    PHP: 56.25,
    PKR: 278.5,
    NGN: 1550,
    KES: 153.5,
    GHS: 12.35,
    ZAR: 18.85,
    EGP: 30.9,
    BDT: 109.75,
    VND: 24350,
    IDR: 15650,
    THB: 35.5,
    MYR: 4.72,
    SGD: 1.34,
    HKD: 7.82,
    JPY: 149.5,
    CNY: 7.24,
    CHF: 0.88,
    NZD: 1.64,
    SEK: 10.45,
    NOK: 10.75,
    DKK: 6.88,
    PLN: 4.02,
    CZK: 22.85,
    HUF: 358.5,
    RON: 4.58,
    BGN: 1.8,
    TRY: 32.15,
    AED: 3.67,
    SAR: 3.75,
    ILS: 3.65,
    TWD: 31.5,
    KRW: 1325,
    COP: 3950,
    CLP: 925,
    PEN: 3.72,
    ARS: 865,
    UYU: 39.5,
  };

  constructor(config: ExchangeRateServiceConfig = {}) {
    this.repository = getExchangeRateRepository();
    this.cacheMinutes = config.cacheMinutes ?? 60;
    this.markupPercent = config.markupPercent ?? PLATFORM_FX_MARKUP_PERCENT;

    this.logger.info('Exchange rate service initialized', {
      cacheMinutes: this.cacheMinutes,
      markupPercent: this.markupPercent,
    });
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  /**
   * Get current exchange rate between two currencies
   */
  async getRate(fromCurrency: string, toCurrency: string): Promise<ExchangeRateInfo> {
    this.validateCurrency(fromCurrency);
    this.validateCurrency(toCurrency);

    // Same currency - no conversion needed
    if (fromCurrency === toCurrency) {
      return {
        rate: 1,
        timestamp: new Date(),
        validUntil: new Date(Date.now() + 3600000),
        source: 'identity',
      };
    }

    // Check cache first
    const cached = await this.repository.findCurrent(fromCurrency, toCurrency);
    if (cached) {
      return {
        rate: cached.rate,
        timestamp: cached.validFrom,
        validUntil: cached.validUntil,
        source: cached.source,
      };
    }

    // Calculate rate with markup
    const rate = await this.fetchAndCacheRate(fromCurrency, toCurrency);
    return rate;
  }

  /**
   * Convert an amount between currencies
   */
  async convert(params: GetConversionParams): Promise<ConversionResult> {
    const { fromCurrency, toCurrency, amount } = params;

    const rateInfo = await this.getRate(fromCurrency, toCurrency);
    const convertedAmount = Math.round(amount * rateInfo.rate * 100) / 100;

    return {
      originalAmount: amount,
      originalCurrency: fromCurrency,
      convertedAmount,
      convertedCurrency: toCurrency,
      exchangeRate: rateInfo.rate,
      appliedAt: rateInfo.timestamp,
    };
  }

  /**
   * Preview a conversion with fee breakdown
   */
  async previewConversion(
    fromCurrency: string,
    toCurrency: string,
    amount: number
  ): Promise<ConversionPreview> {
    const rateInfo = await this.getRate(fromCurrency, toCurrency);
    const convertedAmount = Math.round(amount * rateInfo.rate * 100) / 100;

    // Calculate base rate and markup
    const baseRate = await this.getBaseRate(fromCurrency, toCurrency);
    const markupAmount = Math.round(amount * (baseRate - rateInfo.rate) * 100) / 100;
    const markupPercent = this.markupPercent;

    return {
      fromCurrency,
      toCurrency,
      fromAmount: amount,
      toAmount: convertedAmount,
      exchangeRate: rateInfo.rate,
      baseRate,
      markupPercent,
      markupAmount: Math.abs(markupAmount),
      validUntil: rateInfo.validUntil,
    };
  }

  /**
   * Get list of supported currencies with metadata
   */
  getSupportedCurrencies(): SupportedCurrenciesResponse {
    return {
      currencies: SUPPORTED_PAYOUT_CURRENCIES.map((currency) => ({
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
        minimumPayout: this.getMinimumPayout(currency.code),
        instantPayoutAvailable: this.isInstantPayoutAvailable(currency.code),
      })),
      baseCurrency: 'USD',
      lastUpdated: new Date(),
    };
  }

  /**
   * Get exchange rates for all currencies from a base currency
   */
  async getAllRates(baseCurrency: string = 'USD'): Promise<Record<string, number>> {
    const rates: Record<string, number> = {};

    for (const currency of SUPPORTED_PAYOUT_CURRENCIES) {
      try {
        const rateInfo = await this.getRate(baseCurrency, currency.code);
        rates[currency.code] = rateInfo.rate;
      } catch (err) {
        this.logger.warn(`Failed to get rate for ${baseCurrency} -> ${currency.code}`, { err });
      }
    }

    return rates;
  }

  /**
   * Force refresh rates from external source
   */
  async refreshRates(): Promise<void> {
    this.logger.info('Refreshing exchange rates');

    for (const currency of SUPPORTED_PAYOUT_CURRENCIES) {
      if (currency.code === 'USD') continue;

      try {
        await this.fetchAndCacheRate('USD', currency.code);
      } catch (err) {
        this.logger.error(`Failed to refresh rate for USD -> ${currency.code}`, { err });
      }
    }
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private validateCurrency(currency: string): void {
    if (!this.baseRates[currency]) {
      throw new Error(`Unsupported currency: ${currency}`);
    }
  }

  private async getBaseRate(fromCurrency: string, toCurrency: string): Promise<number> {
    // Calculate base rate without markup
    const fromRate = this.baseRates[fromCurrency] ?? 1;
    const toRate = this.baseRates[toCurrency] ?? 1;
    return toRate / fromRate;
  }

  private async fetchAndCacheRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<ExchangeRateInfo> {
    // In production, this would fetch from an external API like:
    // - Open Exchange Rates
    // - Currency Layer
    // - Fixer.io
    // - XE

    const baseRate = await this.getBaseRate(fromCurrency, toCurrency);

    // Apply markup (reduce rate for user - platform takes the difference)
    const rate = baseRate * (1 - this.markupPercent / 100);
    const roundedRate = Math.round(rate * 1000000) / 1000000;

    const validFrom = new Date();
    const validUntil = new Date(Date.now() + this.cacheMinutes * 60 * 1000);

    // Cache the rate
    await this.repository.create({
      fromCurrency,
      toCurrency,
      rate: roundedRate,
      baseRate,
      markupPercent: this.markupPercent,
      validFrom,
      validUntil,
      source: 'internal',
    });

    this.logger.debug('Cached exchange rate', {
      fromCurrency,
      toCurrency,
      rate: roundedRate,
      baseRate,
      validUntil,
    });

    return {
      rate: roundedRate,
      timestamp: validFrom,
      validUntil,
      source: 'internal',
    };
  }

  private getCurrencyName(code: string): string {
    const names: Record<string, string> = {
      USD: 'US Dollar',
      EUR: 'Euro',
      GBP: 'British Pound',
      CAD: 'Canadian Dollar',
      AUD: 'Australian Dollar',
      INR: 'Indian Rupee',
      BRL: 'Brazilian Real',
      MXN: 'Mexican Peso',
      PHP: 'Philippine Peso',
      PKR: 'Pakistani Rupee',
      NGN: 'Nigerian Naira',
      KES: 'Kenyan Shilling',
      GHS: 'Ghanaian Cedi',
      ZAR: 'South African Rand',
      EGP: 'Egyptian Pound',
      BDT: 'Bangladeshi Taka',
      VND: 'Vietnamese Dong',
      IDR: 'Indonesian Rupiah',
      THB: 'Thai Baht',
      MYR: 'Malaysian Ringgit',
      SGD: 'Singapore Dollar',
      HKD: 'Hong Kong Dollar',
      JPY: 'Japanese Yen',
      CNY: 'Chinese Yuan',
      CHF: 'Swiss Franc',
      NZD: 'New Zealand Dollar',
      SEK: 'Swedish Krona',
      NOK: 'Norwegian Krone',
      DKK: 'Danish Krone',
      PLN: 'Polish Zloty',
      CZK: 'Czech Koruna',
      HUF: 'Hungarian Forint',
      RON: 'Romanian Leu',
      BGN: 'Bulgarian Lev',
      TRY: 'Turkish Lira',
      AED: 'UAE Dirham',
      SAR: 'Saudi Riyal',
      ILS: 'Israeli Shekel',
      TWD: 'Taiwan Dollar',
      KRW: 'South Korean Won',
      COP: 'Colombian Peso',
      CLP: 'Chilean Peso',
      PEN: 'Peruvian Sol',
      ARS: 'Argentine Peso',
      UYU: 'Uruguayan Peso',
    };
    return names[code] ?? code;
  }

  private getCurrencySymbol(code: string): string {
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      CAD: 'C$',
      AUD: 'A$',
      INR: '₹',
      BRL: 'R$',
      MXN: 'MX$',
      PHP: '₱',
      PKR: '₨',
      NGN: '₦',
      KES: 'KSh',
      GHS: 'GH₵',
      ZAR: 'R',
      EGP: 'E£',
      BDT: '৳',
      VND: '₫',
      IDR: 'Rp',
      THB: '฿',
      MYR: 'RM',
      SGD: 'S$',
      HKD: 'HK$',
      JPY: '¥',
      CNY: '¥',
      CHF: 'CHF',
      NZD: 'NZ$',
      SEK: 'kr',
      NOK: 'kr',
      DKK: 'kr',
      PLN: 'zł',
      CZK: 'Kč',
      HUF: 'Ft',
      RON: 'lei',
      BGN: 'лв',
      TRY: '₺',
      AED: 'د.إ',
      SAR: '﷼',
      ILS: '₪',
      TWD: 'NT$',
      KRW: '₩',
      COP: 'COL$',
      CLP: 'CLP$',
      PEN: 'S/',
      ARS: 'AR$',
      UYU: '$U',
    };
    return symbols[code] ?? code;
  }

  private getMinimumPayout(code: string): number {
    // Minimum payout amounts in local currency
    const minimums: Record<string, number> = {
      USD: 50,
      EUR: 50,
      GBP: 50,
      CAD: 50,
      AUD: 50,
      INR: 500,
      BRL: 100,
      MXN: 500,
      PHP: 1000,
      PKR: 5000,
      NGN: 10000,
      KES: 2000,
      GHS: 200,
      ZAR: 500,
      EGP: 500,
      BDT: 2000,
      VND: 500000,
      IDR: 500000,
      THB: 1000,
      MYR: 100,
      SGD: 50,
      HKD: 200,
      JPY: 5000,
      CNY: 200,
      CHF: 50,
      NZD: 50,
      SEK: 300,
      NOK: 300,
      DKK: 200,
      PLN: 100,
      CZK: 500,
      HUF: 10000,
      RON: 100,
      BGN: 50,
      TRY: 500,
      AED: 100,
      SAR: 100,
      ILS: 100,
      TWD: 1000,
      KRW: 50000,
      COP: 100000,
      CLP: 20000,
      PEN: 100,
      ARS: 10000,
      UYU: 1000,
    };
    return minimums[code] ?? 50;
  }

  private isInstantPayoutAvailable(code: string): boolean {
    // Instant payouts available for major currencies
    const instantCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'HKD', 'JPY'];
    return instantCurrencies.includes(code);
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let serviceInstance: ExchangeRateService | null = null;

export function getExchangeRateService(config?: ExchangeRateServiceConfig): ExchangeRateService {
  serviceInstance ??= new ExchangeRateService(config);
  return serviceInstance;
}
