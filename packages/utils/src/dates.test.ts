import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatDate,
  formatRelative,
  formatDateTime,
  parseDate,
  isValidDate,
  addDays,
  addMonths,
  startOfDay,
  endOfDay,
  isBefore,
  isAfter,
  isSameDay,
  getBusinessDays,
  addBusinessDays,
  isWeekendDay,
  isPast,
  isFuture,
} from './dates';

describe('dates', () => {
  describe('formatDate', () => {
    it('should format Date object with default format', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      expect(formatDate(date)).toMatch(/Jan 15, 2024/);
    });

    it('should format ISO string', () => {
      expect(formatDate('2024-01-15')).toBe('Jan 15, 2024');
    });

    it('should format timestamp', () => {
      const timestamp = new Date(2024, 0, 15, 12, 0, 0).getTime(); // Jan 15, 2024 noon local
      expect(formatDate(timestamp)).toMatch(/Jan 15, 2024/);
    });

    it('should use custom format', () => {
      const date = new Date(2024, 0, 15, 12, 0, 0); // Jan 15, 2024 noon local
      expect(formatDate(date, 'yyyy-MM-dd')).toBe('2024-01-15');
      expect(formatDate(date, 'dd/MM/yyyy')).toBe('15/01/2024');
    });

    it('should throw on invalid date', () => {
      expect(() => formatDate('invalid')).toThrow('Invalid date provided');
    });
  });

  describe('formatRelative', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should format past dates', () => {
      const pastDate = new Date('2024-01-15T11:00:00Z');
      expect(formatRelative(pastDate)).toMatch(/hour ago/);
    });

    it('should format future dates', () => {
      const futureDate = new Date('2024-01-15T14:00:00Z');
      expect(formatRelative(futureDate)).toMatch(/hours/);
    });
  });

  describe('formatDateTime', () => {
    it('should format date with time', () => {
      const date = new Date('2024-01-15T14:30:00');
      const result = formatDateTime(date);
      expect(result).toMatch(/Jan 15, 2024/);
      expect(result).toMatch(/at/);
    });
  });

  describe('parseDate', () => {
    it('should parse date string with default format', () => {
      const result = parseDate('2024-01-15');
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(15);
    });

    it('should parse with custom format', () => {
      const result = parseDate('15/01/2024', 'dd/MM/yyyy');
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(15);
    });

    it('should throw on invalid date string', () => {
      expect(() => parseDate('invalid')).toThrow('Invalid date string');
    });
  });

  describe('isValidDate', () => {
    it('should return true for valid Date', () => {
      expect(isValidDate(new Date())).toBe(true);
    });

    it('should return false for invalid Date', () => {
      expect(isValidDate(new Date('invalid'))).toBe(false);
    });

    it('should return false for non-Date values', () => {
      expect(isValidDate('2024-01-15')).toBe(false);
      expect(isValidDate(null)).toBe(false);
      expect(isValidDate(undefined)).toBe(false);
    });
  });

  describe('addDays', () => {
    it('should add days to date', () => {
      const date = new Date(2024, 0, 15, 12, 0, 0); // Jan 15, 2024 noon local
      const result = addDays(date, 5);
      expect(result.getDate()).toBe(20);
    });

    it('should handle negative days', () => {
      const date = new Date(2024, 0, 15, 12, 0, 0); // Jan 15, 2024 noon local
      const result = addDays(date, -5);
      expect(result.getDate()).toBe(10);
    });

    it('should handle month rollover', () => {
      const date = new Date(2024, 0, 30, 12, 0, 0); // Jan 30, 2024 noon local
      const result = addDays(date, 5);
      expect(result.getMonth()).toBe(1); // February
    });
  });

  describe('addMonths', () => {
    it('should add months to date', () => {
      const date = new Date('2024-01-15');
      const result = addMonths(date, 2);
      expect(result.getMonth()).toBe(2); // March
    });

    it('should handle year rollover', () => {
      const date = new Date('2024-11-15');
      const result = addMonths(date, 3);
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(1); // February
    });
  });

  describe('startOfDay', () => {
    it('should return start of day', () => {
      const date = new Date('2024-01-15T14:30:45.123');
      const result = startOfDay(date);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });
  });

  describe('endOfDay', () => {
    it('should return end of day', () => {
      const date = new Date('2024-01-15T14:30:45.123');
      const result = endOfDay(date);
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
    });
  });

  describe('isBefore', () => {
    it('should return true if date1 is before date2', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-20');
      expect(isBefore(date1, date2)).toBe(true);
    });

    it('should return false if date1 is after date2', () => {
      const date1 = new Date('2024-01-20');
      const date2 = new Date('2024-01-15');
      expect(isBefore(date1, date2)).toBe(false);
    });
  });

  describe('isAfter', () => {
    it('should return true if date1 is after date2', () => {
      const date1 = new Date('2024-01-20');
      const date2 = new Date('2024-01-15');
      expect(isAfter(date1, date2)).toBe(true);
    });

    it('should return false if date1 is before date2', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-20');
      expect(isAfter(date1, date2)).toBe(false);
    });
  });

  describe('isSameDay', () => {
    it('should return true for same day different times', () => {
      const date1 = new Date('2024-01-15T10:00:00');
      const date2 = new Date('2024-01-15T18:00:00');
      expect(isSameDay(date1, date2)).toBe(true);
    });

    it('should return false for different days', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-16');
      expect(isSameDay(date1, date2)).toBe(false);
    });
  });

  describe('getBusinessDays', () => {
    it('should count business days excluding weekends', () => {
      // Monday Jan 15 to Friday Jan 19 = 4 business days
      const start = new Date(2024, 0, 15, 12, 0, 0); // Jan 15, 2024 noon local
      const end = new Date(2024, 0, 19, 12, 0, 0); // Jan 19, 2024 noon local
      expect(getBusinessDays(start, end)).toBe(4);
    });

    it('should return 0 for same day', () => {
      const date = new Date(2024, 0, 15, 12, 0, 0);
      expect(getBusinessDays(date, date)).toBe(0);
    });
  });

  describe('addBusinessDays', () => {
    it('should skip weekends', () => {
      // Friday Jan 12 at noon local time, add 3 business days = Wednesday Jan 17
      const friday = new Date(2024, 0, 12, 12, 0, 0); // Jan 12, 2024 noon
      const result = addBusinessDays(friday, 3);
      expect(result.getDay()).toBe(3); // Wednesday
    });
  });

  describe('isWeekendDay', () => {
    it('should return true for Saturday', () => {
      const saturday = new Date(2024, 0, 13, 12, 0, 0); // Jan 13, 2024 noon
      expect(isWeekendDay(saturday)).toBe(true);
    });

    it('should return true for Sunday', () => {
      const sunday = new Date(2024, 0, 14, 12, 0, 0); // Jan 14, 2024 noon
      expect(isWeekendDay(sunday)).toBe(true);
    });

    it('should return false for weekday', () => {
      const monday = new Date(2024, 0, 15, 12, 0, 0); // Jan 15, 2024 noon
      expect(isWeekendDay(monday)).toBe(false);
    });
  });

  describe('isPast', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return true for past dates', () => {
      expect(isPast('2024-01-14')).toBe(true);
    });

    it('should return false for future dates', () => {
      expect(isPast('2024-01-16')).toBe(false);
    });
  });

  describe('isFuture', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return true for future dates', () => {
      expect(isFuture('2024-01-16')).toBe(true);
    });

    it('should return false for past dates', () => {
      expect(isFuture('2024-01-14')).toBe(false);
    });
  });
});
