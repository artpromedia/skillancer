/**
 * @module @skillancer/utils/currency
 * Currency formatting and conversion utilities
 */

/**
 * Options for formatting currency
 */
export interface FormatCurrencyOptions {
  /** ISO 4217 currency code (default: 'USD') */
  currency?: string;
  /** BCP 47 locale (default: 'en-US') */
  locale?: string;
  /** Minimum fraction digits (default: 2) */
  minimumFractionDigits?: number;
  /** Maximum fraction digits (default: 2) */
  maximumFractionDigits?: number;
}

/**
 * Currency minor unit configuration (cents per dollar, etc.)
 */
const CURRENCY_MINOR_UNITS: Record<string, number> = {
  USD: 100,
  EUR: 100,
  GBP: 100,
  JPY: 1, // Yen has no minor unit
  KRW: 1, // Won has no minor unit
  BHD: 1000, // Bahraini Dinar has 3 decimal places
  KWD: 1000, // Kuwaiti Dinar has 3 decimal places
  OMR: 1000, // Omani Rial has 3 decimal places
};

/**
 * Format a number as currency
 * @param amount - The amount to format (in major units, e.g., dollars)
 * @param options - Formatting options
 * @returns Formatted currency string
 * @example
 * formatCurrency(1234.56) // '$1,234.56'
 * formatCurrency(1234.56, { currency: 'EUR', locale: 'de-DE' }) // '1.234,56 €'
 */
export function formatCurrency(
  amount: number,
  options: FormatCurrencyOptions = {}
): string {
  const {
    currency = 'USD',
    locale = 'en-US',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(amount);
}

/**
 * Parse a currency string to a number
 * @param value - The currency string to parse
 * @returns The numeric value
 * @throws Error if the string cannot be parsed
 * @example
 * parseCurrency('$1,234.56') // 1234.56
 * parseCurrency('€1.234,56') // 1234.56
 */
export function parseCurrency(value: string): number {
  // Remove all non-numeric characters except decimal separators
  const cleaned = value
    .replace(/[^\d.,-]/g, '') // Remove currency symbols and spaces
    .replace(/,(?=\d{3})/g, '') // Remove thousand separators (,)
    .replace(/\.(?=\d{3})/g, '') // Remove thousand separators (.)
    .replace(/,/g, '.'); // Convert remaining commas to dots for parsing

  const parsed = parseFloat(cleaned);

  if (isNaN(parsed)) {
    throw new Error(`Cannot parse currency value: ${value}`);
  }

  return parsed;
}

/**
 * Format a number as compact currency (e.g., $1.2M)
 * @param amount - The amount to format
 * @param currency - ISO 4217 currency code (default: 'USD')
 * @returns Compact formatted currency string
 * @example
 * formatCompactCurrency(1234567) // '$1.2M'
 * formatCompactCurrency(1234) // '$1.2K'
 * formatCompactCurrency(123) // '$123'
 */
export function formatCompactCurrency(
  amount: number,
  currency: string = 'USD'
): string {
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  const symbol = getCurrencySymbol(currency);

  if (absAmount >= 1_000_000_000) {
    return `${sign}${symbol}${(absAmount / 1_000_000_000).toFixed(1)}B`;
  }
  if (absAmount >= 1_000_000) {
    return `${sign}${symbol}${(absAmount / 1_000_000).toFixed(1)}M`;
  }
  if (absAmount >= 1_000) {
    return `${sign}${symbol}${(absAmount / 1_000).toFixed(1)}K`;
  }

  return formatCurrency(amount, { currency, minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Convert from major units to minor units (e.g., dollars to cents)
 * @param amount - Amount in major units
 * @param currency - ISO 4217 currency code (default: 'USD')
 * @returns Amount in minor units
 * @example
 * toMinorUnits(12.34) // 1234 (cents)
 * toMinorUnits(100, 'JPY') // 100 (yen has no minor unit)
 */
export function toMinorUnits(
  amount: number,
  currency: string = 'USD'
): number {
  const multiplier = CURRENCY_MINOR_UNITS[currency.toUpperCase()] ?? 100;
  return Math.round(amount * multiplier);
}

/**
 * Convert from minor units to major units (e.g., cents to dollars)
 * @param amount - Amount in minor units
 * @param currency - ISO 4217 currency code (default: 'USD')
 * @returns Amount in major units
 * @example
 * toMajorUnits(1234) // 12.34 (dollars)
 * toMajorUnits(100, 'JPY') // 100 (yen has no minor unit)
 */
export function toMajorUnits(
  amount: number,
  currency: string = 'USD'
): number {
  const divisor = CURRENCY_MINOR_UNITS[currency.toUpperCase()] ?? 100;
  return amount / divisor;
}

/**
 * Get the currency symbol for a given currency code
 * @param currency - ISO 4217 currency code
 * @param locale - BCP 47 locale (default: 'en-US')
 * @returns Currency symbol
 * @example
 * getCurrencySymbol('USD') // '$'
 * getCurrencySymbol('EUR') // '€'
 */
export function getCurrencySymbol(
  currency: string,
  locale: string = 'en-US'
): string {
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(0);

  // Extract symbol by removing digits and whitespace
  return formatted.replace(/[\d\s.,]/g, '').trim();
}

/**
 * Calculate percentage of a value
 * @param value - The base value
 * @param percentage - The percentage to calculate
 * @returns The calculated percentage value
 * @example
 * calculatePercentage(100, 15) // 15
 * calculatePercentage(1000, 7.5) // 75
 */
export function calculatePercentage(value: number, percentage: number): number {
  return (value * percentage) / 100;
}

/**
 * Add a percentage to a value
 * @param value - The base value
 * @param percentage - The percentage to add
 * @returns The value plus the percentage
 * @example
 * addPercentage(100, 10) // 110
 */
export function addPercentage(value: number, percentage: number): number {
  return value + calculatePercentage(value, percentage);
}

/**
 * Subtract a percentage from a value
 * @param value - The base value
 * @param percentage - The percentage to subtract
 * @returns The value minus the percentage
 * @example
 * subtractPercentage(100, 10) // 90
 */
export function subtractPercentage(value: number, percentage: number): number {
  return value - calculatePercentage(value, percentage);
}
