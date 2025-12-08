import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  parseCurrency,
  formatCompactCurrency,
  toMinorUnits,
  toMajorUnits,
  getCurrencySymbol,
  calculatePercentage,
  addPercentage,
  subtractPercentage,
} from './currency';

describe('currency', () => {
  describe('formatCurrency', () => {
    it('should format USD with default options', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('should format EUR with German locale', () => {
      const result = formatCurrency(1234.56, {
        currency: 'EUR',
        locale: 'de-DE',
      });
      expect(result).toContain('1.234,56');
      expect(result).toContain('€');
    });

    it('should format GBP', () => {
      const result = formatCurrency(100, { currency: 'GBP' });
      expect(result).toContain('£');
      expect(result).toContain('100');
    });

    it('should handle zero value', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should handle negative values', () => {
      expect(formatCurrency(-50.25)).toBe('-$50.25');
    });

    it('should respect fraction digits options', () => {
      const result = formatCurrency(100.999, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
      expect(result).toBe('$101');
    });
  });

  describe('parseCurrency', () => {
    it('should parse USD format', () => {
      expect(parseCurrency('$1,234.56')).toBe(1234.56);
    });

    it('should parse European format', () => {
      expect(parseCurrency('€1.234,56')).toBe(1234.56);
    });

    it('should parse simple number with symbol', () => {
      expect(parseCurrency('$100')).toBe(100);
    });

    it('should throw on invalid input', () => {
      expect(() => parseCurrency('not a number')).toThrow('Cannot parse currency value');
    });
  });

  describe('formatCompactCurrency', () => {
    it('should format billions', () => {
      expect(formatCompactCurrency(1234567890)).toBe('$1.2B');
    });

    it('should format millions', () => {
      expect(formatCompactCurrency(1234567)).toBe('$1.2M');
    });

    it('should format thousands', () => {
      expect(formatCompactCurrency(1234)).toBe('$1.2K');
    });

    it('should format small amounts normally', () => {
      const result = formatCompactCurrency(123);
      expect(result).toContain('$');
      expect(result).toContain('123');
    });

    it('should handle negative values', () => {
      expect(formatCompactCurrency(-1234567)).toBe('-$1.2M');
    });

    it('should support different currencies', () => {
      expect(formatCompactCurrency(1000000, 'EUR')).toBe('€1.0M');
    });
  });

  describe('toMinorUnits', () => {
    it('should convert dollars to cents', () => {
      expect(toMinorUnits(12.34)).toBe(1234);
    });

    it('should round correctly', () => {
      expect(toMinorUnits(12.345)).toBe(1235);
    });

    it('should handle JPY (no minor units)', () => {
      expect(toMinorUnits(100, 'JPY')).toBe(100);
    });

    it('should handle BHD (3 decimal places)', () => {
      expect(toMinorUnits(1.234, 'BHD')).toBe(1234);
    });
  });

  describe('toMajorUnits', () => {
    it('should convert cents to dollars', () => {
      expect(toMajorUnits(1234)).toBe(12.34);
    });

    it('should handle JPY', () => {
      expect(toMajorUnits(100, 'JPY')).toBe(100);
    });

    it('should handle BHD', () => {
      expect(toMajorUnits(1234, 'BHD')).toBeCloseTo(1.234);
    });
  });

  describe('getCurrencySymbol', () => {
    it('should return $ for USD', () => {
      expect(getCurrencySymbol('USD')).toBe('$');
    });

    it('should return € for EUR', () => {
      expect(getCurrencySymbol('EUR')).toBe('€');
    });

    it('should return £ for GBP', () => {
      expect(getCurrencySymbol('GBP')).toBe('£');
    });

    it('should return ¥ for JPY', () => {
      expect(getCurrencySymbol('JPY')).toBe('¥');
    });
  });

  describe('calculatePercentage', () => {
    it('should calculate percentage correctly', () => {
      expect(calculatePercentage(100, 15)).toBe(15);
      expect(calculatePercentage(200, 10)).toBe(20);
      expect(calculatePercentage(1000, 7.5)).toBe(75);
    });

    it('should handle zero percentage', () => {
      expect(calculatePercentage(100, 0)).toBe(0);
    });

    it('should handle zero value', () => {
      expect(calculatePercentage(0, 15)).toBe(0);
    });
  });

  describe('addPercentage', () => {
    it('should add percentage to value', () => {
      expect(addPercentage(100, 10)).toBe(110);
      expect(addPercentage(100, 20)).toBe(120);
    });
  });

  describe('subtractPercentage', () => {
    it('should subtract percentage from value', () => {
      expect(subtractPercentage(100, 10)).toBe(90);
      expect(subtractPercentage(100, 20)).toBe(80);
    });
  });
});
