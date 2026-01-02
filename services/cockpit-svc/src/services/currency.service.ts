// @ts-nocheck
/**
 * Currency Conversion Service
 * Handles multi-currency conversion with rate caching
 */

import { logger } from '@skillancer/logger';

interface CurrencyRate {
  rate: number;
  date: Date;
}

export class CurrencyService {
  private rateCache = new Map<string, CurrencyRate>();
  private readonly CACHE_TTL_MS = 3600000; // 1 hour

  async convert(
    amount: number,
    from: string,
    to: string,
    date?: Date
  ): Promise<{
    convertedAmount: number;
    rate: number;
    rateDate: Date;
  }> {
    if (from === to) {
      return { convertedAmount: amount, rate: 1, rateDate: new Date() };
    }

    const rate = await this.getRate(from, to, date);
    return {
      convertedAmount: amount * rate.rate,
      rate: rate.rate,
      rateDate: rate.date,
    };
  }

  async getRate(from: string, to: string, date?: Date): Promise<CurrencyRate> {
    const cacheKey = `${from}_${to}_${date?.toISOString().slice(0, 10) ?? 'latest'}`;
    const cached = this.rateCache.get(cacheKey);

    if (cached && Date.now() - cached.date.getTime() < this.CACHE_TTL_MS) {
      return cached;
    }

    // Fallback rates (in production, fetch from API like Open Exchange Rates)
    const fallbackRates: Record<string, number> = {
      USD_EUR: 0.92,
      EUR_USD: 1.09,
      USD_GBP: 0.79,
      GBP_USD: 1.27,
      USD_CAD: 1.36,
      CAD_USD: 0.74,
      EUR_GBP: 0.86,
      GBP_EUR: 1.16,
    };

    const rate = fallbackRates[`${from}_${to}`] ?? 1;
    const result = { rate, date: new Date() };
    this.rateCache.set(cacheKey, result);

    logger.debug('Currency rate fetched', { from, to, rate });
    return result;
  }

  clearCache(): void {
    this.rateCache.clear();
  }
}

export const currencyService = new CurrencyService();

