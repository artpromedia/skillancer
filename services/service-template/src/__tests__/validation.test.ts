/**
 * @module @skillancer/service-template/tests/validation
 * Validation utilities tests
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import { ValidationError } from '../utils/errors.js';
import {
  validate,
  validateOrThrow,
  formatZodErrors,
  getFirstZodError,
  emptyStringToUndefined,
  trimmedString,
  coerceBoolean,
  commaSeparatedArray,
  parsePagination,
  calculateOffset,
  calculateTotalPages,
  buildPaginationMeta,
} from '../utils/validation.js';

describe('Validation Utilities', () => {
  const TestSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    age: z.number().positive().optional(),
  });

  describe('validate', () => {
    it('should return success for valid data', () => {
      const result = validate(TestSchema, {
        name: 'John',
        email: 'john@example.com',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        name: 'John',
        email: 'john@example.com',
      });
    });

    it('should return errors for invalid data', () => {
      const result = validate(TestSchema, {
        name: '',
        email: 'invalid',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should format nested field paths', () => {
      const NestedSchema = z.object({
        user: z.object({
          profile: z.object({
            name: z.string().min(1),
          }),
        }),
      });

      const result = validate(NestedSchema, {
        user: { profile: { name: '' } },
      });

      expect(result.success).toBe(false);
      expect(result.errors?.[0].field).toBe('user.profile.name');
    });

    it('should format array field paths', () => {
      const ArraySchema = z.object({
        items: z.array(z.string().min(1)),
      });

      const result = validate(ArraySchema, {
        items: ['valid', ''],
      });

      expect(result.success).toBe(false);
      expect(result.errors?.[0].field).toBe('items[1]');
    });
  });

  describe('validateOrThrow', () => {
    it('should return data for valid input', () => {
      const data = validateOrThrow(TestSchema, {
        name: 'John',
        email: 'john@example.com',
      });

      expect(data.name).toBe('John');
      expect(data.email).toBe('john@example.com');
    });

    it('should throw ValidationError for invalid input', () => {
      expect(() =>
        validateOrThrow(TestSchema, {
          name: '',
          email: 'invalid',
        })
      ).toThrow(ValidationError);
    });
  });

  describe('formatZodErrors', () => {
    it('should format Zod errors correctly', () => {
      const result = TestSchema.safeParse({
        name: '',
        email: 'invalid',
      });

      if (!result.success) {
        const formatted = formatZodErrors(result.error);

        expect(formatted.length).toBeGreaterThan(0);
        expect(formatted[0]).toHaveProperty('field');
        expect(formatted[0]).toHaveProperty('message');
        expect(formatted[0]).toHaveProperty('code');
      }
    });
  });

  describe('getFirstZodError', () => {
    it('should return first error message', () => {
      const result = TestSchema.safeParse({
        name: '',
        email: 'invalid',
      });

      if (!result.success) {
        const message = getFirstZodError(result.error);
        expect(message).toBeDefined();
        expect(typeof message).toBe('string');
      }
    });
  });

  describe('emptyStringToUndefined', () => {
    it('should convert empty string to undefined', () => {
      const schema = emptyStringToUndefined(z.string().optional());

      expect(schema.parse('')).toBeUndefined();
      expect(schema.parse('value')).toBe('value');
    });
  });

  describe('trimmedString', () => {
    it('should trim strings', () => {
      const schema = trimmedString();
      expect(schema.parse('  hello  ')).toBe('hello');
    });

    it('should respect min/max', () => {
      const schema = trimmedString({ min: 2, max: 5 });

      expect(schema.parse('  ab  ')).toBe('ab');
      expect(() => schema.parse('a')).toThrow();
      expect(() => schema.parse('toolong')).toThrow();
    });
  });

  describe('coerceBoolean', () => {
    it('should coerce various values to boolean', () => {
      const schema = coerceBoolean();

      expect(schema.parse(true)).toBe(true);
      expect(schema.parse(false)).toBe(false);
      expect(schema.parse('true')).toBe(true);
      expect(schema.parse('false')).toBe(false);
      expect(schema.parse('1')).toBe(true);
      expect(schema.parse('0')).toBe(false);
      expect(schema.parse('yes')).toBe(true);
      expect(schema.parse('no')).toBe(false);
      expect(schema.parse(1)).toBe(true);
      expect(schema.parse(0)).toBe(false);
    });
  });

  describe('commaSeparatedArray', () => {
    it('should parse comma-separated string to array', () => {
      const schema = commaSeparatedArray();

      expect(schema.parse('a,b,c')).toEqual(['a', 'b', 'c']);
      expect(schema.parse('a, b, c')).toEqual(['a', 'b', 'c']);
      expect(schema.parse('')).toEqual([]);
    });

    it('should pass through arrays', () => {
      const schema = commaSeparatedArray();
      expect(schema.parse(['a', 'b'])).toEqual(['a', 'b']);
    });
  });

  describe('parsePagination', () => {
    it('should parse pagination with defaults', () => {
      const result = parsePagination({});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should parse custom values', () => {
      const result = parsePagination({ page: '2', limit: '50' });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
    });

    it('should reject limit over max', () => {
      expect(() => parsePagination({ limit: '500' })).toThrow();
    });
  });

  describe('calculateOffset', () => {
    it('should calculate correct offset', () => {
      expect(calculateOffset(1, 20)).toBe(0);
      expect(calculateOffset(2, 20)).toBe(20);
      expect(calculateOffset(3, 10)).toBe(20);
    });
  });

  describe('calculateTotalPages', () => {
    it('should calculate correct total pages', () => {
      expect(calculateTotalPages(100, 20)).toBe(5);
      expect(calculateTotalPages(101, 20)).toBe(6);
      expect(calculateTotalPages(0, 20)).toBe(0);
    });
  });

  describe('buildPaginationMeta', () => {
    it('should build correct pagination metadata', () => {
      const meta = buildPaginationMeta(100, 2, 20);

      expect(meta.total).toBe(100);
      expect(meta.page).toBe(2);
      expect(meta.limit).toBe(20);
      expect(meta.totalPages).toBe(5);
      expect(meta.hasNext).toBe(true);
      expect(meta.hasPrev).toBe(true);
    });

    it('should handle first page', () => {
      const meta = buildPaginationMeta(100, 1, 20);

      expect(meta.hasPrev).toBe(false);
      expect(meta.hasNext).toBe(true);
    });

    it('should handle last page', () => {
      const meta = buildPaginationMeta(100, 5, 20);

      expect(meta.hasPrev).toBe(true);
      expect(meta.hasNext).toBe(false);
    });
  });
});
