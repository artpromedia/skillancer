/**
 * @module @skillancer/utils/dates
 * Date manipulation and formatting utilities using date-fns
 */

import {
  format,
  formatDistanceToNow,
  parse,
  isValid,
  addDays as dfAddDays,
  addMonths as dfAddMonths,
  startOfDay as dfStartOfDay,
  endOfDay as dfEndOfDay,
  isBefore as dfIsBefore,
  isAfter as dfIsAfter,
  isSameDay as dfIsSameDay,
  parseISO,
  differenceInBusinessDays,
  addBusinessDays as dfAddBusinessDays,
  isWeekend,
} from 'date-fns';

/**
 * Normalize a date input to a Date object
 * @param date - Date, ISO string, or timestamp
 * @returns Normalized Date object
 */
function normalizeDate(date: Date | string | number): Date {
  if (date instanceof Date) return date;
  if (typeof date === 'string') return parseISO(date);
  return new Date(date);
}

/**
 * Format a date to a string
 * @param date - The date to format
 * @param formatStr - The format string (default: 'MMM d, yyyy')
 * @returns Formatted date string
 * @example
 * formatDate(new Date('2024-01-15')) // 'Jan 15, 2024'
 * formatDate(new Date('2024-01-15'), 'yyyy-MM-dd') // '2024-01-15'
 */
export function formatDate(
  date: Date | string | number,
  formatStr: string = 'MMM d, yyyy'
): string {
  const d = normalizeDate(date);
  if (!isValid(d)) {
    throw new Error('Invalid date provided');
  }
  return format(d, formatStr);
}

/**
 * Format a date relative to now (e.g., "2 hours ago")
 * @param date - The date to format
 * @returns Relative time string
 * @example
 * formatRelative(new Date(Date.now() - 3600000)) // 'about 1 hour ago'
 */
export function formatRelative(date: Date | string | number): string {
  const d = normalizeDate(date);
  if (!isValid(d)) {
    throw new Error('Invalid date provided');
  }
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Format a date with time
 * @param date - The date to format
 * @returns Formatted date and time string
 * @example
 * formatDateTime(new Date('2024-01-15T14:30:00')) // 'Jan 15, 2024 at 2:30 PM'
 */
export function formatDateTime(date: Date | string | number): string {
  const d = normalizeDate(date);
  if (!isValid(d)) {
    throw new Error('Invalid date provided');
  }
  return format(d, "MMM d, yyyy 'at' h:mm a");
}

/**
 * Parse a date string with a specific format
 * @param dateString - The date string to parse
 * @param formatStr - The format of the date string (default: 'yyyy-MM-dd')
 * @returns Parsed Date object
 * @example
 * parseDate('2024-01-15') // Date object for Jan 15, 2024
 * parseDate('15/01/2024', 'dd/MM/yyyy') // Date object for Jan 15, 2024
 */
export function parseDate(dateString: string, formatStr: string = 'yyyy-MM-dd'): Date {
  const parsed = parse(dateString, formatStr, new Date());
  if (!isValid(parsed)) {
    throw new Error(`Invalid date string: ${dateString}`);
  }
  return parsed;
}

/**
 * Check if a value is a valid Date object
 * @param date - The value to check
 * @returns True if the value is a valid Date
 * @example
 * isValidDate(new Date()) // true
 * isValidDate(new Date('invalid')) // false
 * isValidDate('2024-01-15') // false (not a Date object)
 */
export function isValidDate(date: unknown): date is Date {
  return date instanceof Date && isValid(date);
}

/**
 * Add days to a date
 * @param date - The base date
 * @param days - Number of days to add (can be negative)
 * @returns New Date with days added
 * @example
 * addDays(new Date('2024-01-15'), 5) // Date for Jan 20, 2024
 */
export function addDays(date: Date, days: number): Date {
  return dfAddDays(date, days);
}

/**
 * Add months to a date
 * @param date - The base date
 * @param months - Number of months to add (can be negative)
 * @returns New Date with months added
 * @example
 * addMonths(new Date('2024-01-15'), 2) // Date for Mar 15, 2024
 */
export function addMonths(date: Date, months: number): Date {
  return dfAddMonths(date, months);
}

/**
 * Get the start of the day (00:00:00.000)
 * @param date - The date
 * @returns Date set to start of day
 * @example
 * startOfDay(new Date('2024-01-15T14:30:00')) // Date for Jan 15, 2024 00:00:00
 */
export function startOfDay(date: Date): Date {
  return dfStartOfDay(date);
}

/**
 * Get the end of the day (23:59:59.999)
 * @param date - The date
 * @returns Date set to end of day
 * @example
 * endOfDay(new Date('2024-01-15T14:30:00')) // Date for Jan 15, 2024 23:59:59.999
 */
export function endOfDay(date: Date): Date {
  return dfEndOfDay(date);
}

/**
 * Check if the first date is before the second date
 * @param date1 - First date
 * @param date2 - Second date
 * @returns True if date1 is before date2
 * @example
 * isBefore(new Date('2024-01-15'), new Date('2024-01-20')) // true
 */
export function isBefore(date1: Date, date2: Date): boolean {
  return dfIsBefore(date1, date2);
}

/**
 * Check if the first date is after the second date
 * @param date1 - First date
 * @param date2 - Second date
 * @returns True if date1 is after date2
 * @example
 * isAfter(new Date('2024-01-20'), new Date('2024-01-15')) // true
 */
export function isAfter(date1: Date, date2: Date): boolean {
  return dfIsAfter(date1, date2);
}

/**
 * Check if two dates are on the same day
 * @param date1 - First date
 * @param date2 - Second date
 * @returns True if both dates are the same day
 * @example
 * isSameDay(new Date('2024-01-15T10:00'), new Date('2024-01-15T14:00')) // true
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return dfIsSameDay(date1, date2);
}

/**
 * Get the number of business days between two dates
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Number of business days (excludes weekends)
 * @example
 * getBusinessDays(new Date('2024-01-15'), new Date('2024-01-19')) // 4
 */
export function getBusinessDays(startDate: Date, endDate: Date): number {
  return Math.abs(differenceInBusinessDays(endDate, startDate));
}

/**
 * Add business days to a date (skips weekends)
 * @param date - The base date
 * @param days - Number of business days to add
 * @returns New Date with business days added
 * @example
 * addBusinessDays(new Date('2024-01-15'), 5) // Skips weekends
 */
export function addBusinessDays(date: Date, days: number): Date {
  return dfAddBusinessDays(date, days);
}

/**
 * Check if a date falls on a weekend
 * @param date - The date to check
 * @returns True if the date is Saturday or Sunday
 * @example
 * isWeekendDay(new Date('2024-01-13')) // true (Saturday)
 */
export function isWeekendDay(date: Date): boolean {
  return isWeekend(date);
}

/**
 * Check if a date is in the past
 * @param date - The date to check
 * @returns True if the date is before now
 */
export function isPast(date: Date | string | number): boolean {
  const d = normalizeDate(date);
  return dfIsBefore(d, new Date());
}

/**
 * Check if a date is in the future
 * @param date - The date to check
 * @returns True if the date is after now
 */
export function isFuture(date: Date | string | number): boolean {
  const d = normalizeDate(date);
  return dfIsAfter(d, new Date());
}
