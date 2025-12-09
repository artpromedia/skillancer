/**
 * @module @skillancer/service-template/tests/schemas
 * Schema tests
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import {
  uuidSchema,
  emailSchema,
  phoneSchema,
  paginationSchema,
  sortSchema,
  listQuerySchema,
  idParamSchema,
  idsBodySchema,
  dateRangeSchema,
  addressSchema,
  moneySchema,
  priceRangeSchema,
  statusSchema,
  prioritySchema,
  makeOptional,
  withId,
  withTimestamps,
} from '../schemas/index.js';

describe('Schemas', () => {
  describe('uuidSchema', () => {
    it('should accept valid UUID', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      expect(uuidSchema.parse(uuid)).toBe(uuid);
    });

    it('should reject invalid UUID', () => {
      expect(() => uuidSchema.parse('not-a-uuid')).toThrow();
    });
  });

  describe('emailSchema', () => {
    it('should accept valid email', () => {
      expect(emailSchema.parse('test@example.com')).toBe('test@example.com');
    });

    it('should lowercase email', () => {
      expect(emailSchema.parse('TEST@EXAMPLE.COM')).toBe('test@example.com');
    });

    it('should trim whitespace', () => {
      expect(emailSchema.parse('  test@example.com  ')).toBe('test@example.com');
    });

    it('should reject invalid email', () => {
      expect(() => emailSchema.parse('invalid')).toThrow();
    });
  });

  describe('phoneSchema', () => {
    it('should accept E.164 format', () => {
      expect(phoneSchema.parse('+1234567890')).toBe('+1234567890');
    });

    it('should reject invalid phone', () => {
      expect(() => phoneSchema.parse('1234567890')).toThrow();
      expect(() => phoneSchema.parse('+0234567890')).toThrow(); // starts with 0
    });
  });

  describe('paginationSchema', () => {
    it('should parse pagination with defaults', () => {
      const result = paginationSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should coerce string values', () => {
      const result = paginationSchema.parse({ page: '2', limit: '50' });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
    });

    it('should reject negative page', () => {
      expect(() => paginationSchema.parse({ page: -1 })).toThrow();
    });

    it('should reject limit over 100', () => {
      expect(() => paginationSchema.parse({ limit: 101 })).toThrow();
    });
  });

  describe('sortSchema', () => {
    it('should parse sort options', () => {
      const result = sortSchema.parse({ sort: 'createdAt', order: 'asc' });
      expect(result.sort).toBe('createdAt');
      expect(result.order).toBe('asc');
    });

    it('should default order to desc', () => {
      const result = sortSchema.parse({});
      expect(result.order).toBe('desc');
    });
  });

  describe('listQuerySchema', () => {
    it('should combine pagination, sort, and search', () => {
      const result = listQuerySchema.parse({
        page: '2',
        limit: '10',
        sort: 'name',
        order: 'asc',
        search: 'test',
      });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.sort).toBe('name');
      expect(result.order).toBe('asc');
      expect(result.search).toBe('test');
    });
  });

  describe('idParamSchema', () => {
    it('should accept valid UUID', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const result = idParamSchema.parse({ id: uuid });
      expect(result.id).toBe(uuid);
    });
  });

  describe('idsBodySchema', () => {
    it('should accept array of UUIDs', () => {
      const ids = ['123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001'];
      const result = idsBodySchema.parse({ ids });
      expect(result.ids).toEqual(ids);
    });

    it('should reject empty array', () => {
      expect(() => idsBodySchema.parse({ ids: [] })).toThrow();
    });

    it('should reject more than 100 IDs', () => {
      const ids = Array.from(
        { length: 101 },
        (_, i) => `123e4567-e89b-12d3-a456-42661417400${i.toString().padStart(1, '0')}`
      );
      expect(() => idsBodySchema.parse({ ids })).toThrow();
    });
  });

  describe('dateRangeSchema', () => {
    it('should accept valid date range', () => {
      const result = dateRangeSchema.parse({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.endDate).toBeInstanceOf(Date);
    });

    it('should reject invalid range (start > end)', () => {
      expect(() =>
        dateRangeSchema.parse({
          startDate: '2024-12-31',
          endDate: '2024-01-01',
        })
      ).toThrow();
    });
  });

  describe('addressSchema', () => {
    it('should accept valid address', () => {
      const result = addressSchema.parse({
        street: '123 Main St',
        city: 'New York',
        postalCode: '10001',
        country: 'US',
      });
      expect(result.country).toBe('US');
    });
  });

  describe('moneySchema', () => {
    it('should accept valid money object', () => {
      const result = moneySchema.parse({
        amount: 99.99,
        currency: 'USD',
      });
      expect(result.amount).toBe(99.99);
      expect(result.currency).toBe('USD');
    });

    it('should reject negative amount', () => {
      expect(() =>
        moneySchema.parse({
          amount: -10,
          currency: 'USD',
        })
      ).toThrow();
    });
  });

  describe('priceRangeSchema', () => {
    it('should accept valid price range', () => {
      const result = priceRangeSchema.parse({
        min: 10,
        max: 100,
      });
      expect(result.min).toBe(10);
      expect(result.max).toBe(100);
    });

    it('should reject invalid range (min > max)', () => {
      expect(() =>
        priceRangeSchema.parse({
          min: 100,
          max: 10,
        })
      ).toThrow();
    });
  });

  describe('statusSchema', () => {
    it('should accept valid status', () => {
      expect(statusSchema.parse('active')).toBe('active');
      expect(statusSchema.parse('inactive')).toBe('inactive');
    });

    it('should reject invalid status', () => {
      expect(() => statusSchema.parse('invalid')).toThrow();
    });
  });

  describe('prioritySchema', () => {
    it('should accept valid priority', () => {
      expect(prioritySchema.parse('high')).toBe('high');
    });
  });

  describe('makeOptional', () => {
    it('should make all fields optional', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const optionalSchema = makeOptional(schema);

      const result = optionalSchema.parse({});
      expect(result).toEqual({});
    });
  });

  describe('withId', () => {
    it('should add id field', () => {
      const schema = z.object({
        name: z.string(),
      });
      const withIdSchema = withId(schema);

      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const result = withIdSchema.parse({ id: uuid, name: 'Test' });
      expect(result.id).toBe(uuid);
    });
  });

  describe('withTimestamps', () => {
    it('should add timestamp fields', () => {
      const schema = z.object({
        name: z.string(),
      });
      const withTimestampsSchema = withTimestamps(schema);

      const result = withTimestampsSchema.parse({
        name: 'Test',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      });
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });
  });
});
