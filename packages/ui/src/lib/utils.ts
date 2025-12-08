import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with Tailwind CSS classes intelligently
 * Combines clsx for conditional classes and tailwind-merge for deduplication
 * 
 * @example
 * cn('px-2 py-1', 'px-4') // => 'py-1 px-4'
 * cn('text-red-500', condition && 'text-blue-500') // => 'text-blue-500' if condition is true
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date using Intl.DateTimeFormat
 * 
 * @example
 * formatDate(new Date()) // => "Dec 8, 2025"
 * formatDate(new Date(), { format: 'long' }) // => "December 8, 2025"
 * formatDate(new Date(), { includeTime: true }) // => "Dec 8, 2025, 2:30 PM"
 */
export function formatDate(
  date: Date | string | number,
  options?: {
    format?: 'short' | 'medium' | 'long' | 'full';
    includeTime?: boolean;
    locale?: string;
  }
): string {
  const { format = 'medium', includeTime = false, locale = 'en-US' } = options ?? {};

  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return 'Invalid date';
  }

  const dateStyleMap: Record<string, Intl.DateTimeFormatOptions['dateStyle']> = {
    short: 'short',
    medium: 'medium',
    long: 'long',
    full: 'full',
  };

  const formatOptions: Intl.DateTimeFormatOptions = {
    dateStyle: dateStyleMap[format],
    ...(includeTime && { timeStyle: 'short' }),
  };

  return new Intl.DateTimeFormat(locale, formatOptions).format(dateObj);
}

/**
 * Format a relative time string (e.g., "2 hours ago", "in 3 days")
 * 
 * @example
 * formatRelativeTime(new Date(Date.now() - 3600000)) // => "1 hour ago"
 * formatRelativeTime(new Date(Date.now() + 86400000)) // => "in 1 day"
 */
export function formatRelativeTime(
  date: Date | string | number,
  options?: { locale?: string }
): string {
  const { locale = 'en-US' } = options ?? {};

  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return 'Invalid date';
  }

  const now = Date.now();
  const diff = dateObj.getTime() - now;
  const absDiff = Math.abs(diff);

  const units: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
    { unit: 'year', ms: 31536000000 },
    { unit: 'month', ms: 2628000000 },
    { unit: 'week', ms: 604800000 },
    { unit: 'day', ms: 86400000 },
    { unit: 'hour', ms: 3600000 },
    { unit: 'minute', ms: 60000 },
    { unit: 'second', ms: 1000 },
  ];

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  for (const { unit, ms } of units) {
    if (absDiff >= ms || unit === 'second') {
      const value = Math.round(diff / ms);
      return rtf.format(value, unit);
    }
  }

  return 'just now';
}

/**
 * Format a number as currency
 * 
 * @example
 * formatCurrency(1234.56) // => "$1,234.56"
 * formatCurrency(1234.56, { currency: 'EUR' }) // => "€1,234.56"
 * formatCurrency(1234.56, { compact: true }) // => "$1.2K"
 */
export function formatCurrency(
  amount: number,
  options?: {
    currency?: string;
    locale?: string;
    compact?: boolean;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }
): string {
  const {
    currency = 'USD',
    locale = 'en-US',
    compact = false,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options ?? {};

  const formatOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    minimumFractionDigits: compact ? 0 : minimumFractionDigits,
    maximumFractionDigits: compact ? 1 : maximumFractionDigits,
    ...(compact && { notation: 'compact' }),
  };

  return new Intl.NumberFormat(locale, formatOptions).format(amount);
}

/**
 * Format a number with optional compact notation
 * 
 * @example
 * formatNumber(1234567) // => "1,234,567"
 * formatNumber(1234567, { compact: true }) // => "1.2M"
 */
export function formatNumber(
  value: number,
  options?: {
    locale?: string;
    compact?: boolean;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }
): string {
  const {
    locale = 'en-US',
    compact = false,
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
  } = options ?? {};

  const formatOptions: Intl.NumberFormatOptions = {
    minimumFractionDigits,
    maximumFractionDigits,
    ...(compact && { notation: 'compact' }),
  };

  return new Intl.NumberFormat(locale, formatOptions).format(value);
}

/**
 * Truncate text to a specified length with ellipsis
 * 
 * @example
 * truncate('Hello World', 8) // => "Hello..."
 * truncate('Hello', 10) // => "Hello"
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Generate initials from a name
 * 
 * @example
 * getInitials('John Doe') // => "JD"
 * getInitials('John') // => "J"
 * getInitials('John Michael Doe') // => "JD"
 */
export function getInitials(name: string, maxLength = 2): string {
  if (!name) return '';

  const parts = name.trim().split(/\s+/);
  
  if (parts.length === 1) {
    return (parts[0] ?? '').charAt(0).toUpperCase();
  }

  const first = parts[0] ?? '';
  const last = parts[parts.length - 1] ?? '';
  const initials = [first, last]
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return initials.slice(0, maxLength);
}

/**
 * Sleep for a specified duration (useful for testing/debugging)
 * 
 * @example
 * await sleep(1000) // Wait for 1 second
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Debounce a function call
 * 
 * @example
 * const debouncedSearch = debounce((query) => search(query), 300);
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return function (...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Check if we're running on the server (SSR)
 */
export const isServer = typeof window === 'undefined';

/**
 * Check if we're running on the client
 */
export const isClient = !isServer;
