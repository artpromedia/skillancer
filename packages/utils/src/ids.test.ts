import { describe, it, expect, vi } from 'vitest';
import {
  generateUuid,
  generateNanoId,
  generateSlugId,
  generateNumericId,
  generatePrefixedId,
  isUuid,
  isNanoId,
  generateSecureToken,
  generateApiKey,
  generateShortCode,
  extractIdPrefix,
} from './ids';

describe('ids', () => {
  describe('generateUuid', () => {
    it('should generate valid UUID v4', () => {
      const uuid = generateUuid();

      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should generate unique UUIDs', () => {
      const uuids = new Set(Array.from({ length: 100 }, () => generateUuid()));
      expect(uuids.size).toBe(100);
    });
  });

  describe('generateNanoId', () => {
    it('should generate ID with default length', () => {
      const id = generateNanoId();
      expect(id).toHaveLength(21);
    });

    it('should generate ID with custom length', () => {
      const id = generateNanoId(10);
      expect(id).toHaveLength(10);
    });

    it('should generate URL-safe characters', () => {
      const id = generateNanoId();
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateNanoId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('generateSlugId', () => {
    it('should generate slug ID with format adjective-noun-suffix', () => {
      const id = generateSlugId();
      const parts = id.split('-');

      // Should have 3 parts (adjective-noun-suffix)
      expect(parts.length).toBe(3);
    });

    it('should generate lowercase slugs', () => {
      const id = generateSlugId();
      expect(id).toBe(id.toLowerCase());
    });

    it('should generate readable slugs', () => {
      const id = generateSlugId();
      expect(id).toMatch(/^[a-z]+-[a-z]+-[a-z0-9]+$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 50 }, () => generateSlugId()));
      expect(ids.size).toBe(50);
    });
  });

  describe('generateNumericId', () => {
    it('should generate numeric ID with default length', () => {
      const id = generateNumericId();
      expect(id).toHaveLength(8);
      expect(id).toMatch(/^\d+$/);
    });

    it('should generate numeric ID with custom length', () => {
      const id = generateNumericId(6);
      expect(id).toHaveLength(6);
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateNumericId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('isUuid', () => {
    it('should validate valid UUID', () => {
      expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should reject invalid UUID', () => {
      expect(isUuid('not-a-uuid')).toBe(false);
    });
  });

  describe('isNanoId', () => {
    it('should validate nanoid', () => {
      const id = generateNanoId();
      expect(isNanoId(id)).toBe(true);
    });

    it('should reject wrong length', () => {
      expect(isNanoId('short', 21)).toBe(false);
    });

    it('should validate custom length', () => {
      const id = generateNanoId(10);
      expect(isNanoId(id, 10)).toBe(true);
    });
  });

  describe('generatePrefixedId', () => {
    it('should generate ID with prefix', () => {
      const id = generatePrefixedId('user');
      expect(id).toMatch(/^user_[a-z0-9]+$/);
    });

    it('should generate unique prefixed IDs', () => {
      const ids = new Set(
        Array.from({ length: 100 }, () => generatePrefixedId('test'))
      );
      expect(ids.size).toBe(100);
    });

    it('should work with different prefixes', () => {
      const orderId = generatePrefixedId('ord');
      const customerId = generatePrefixedId('cust');
      const invoiceId = generatePrefixedId('inv');

      expect(orderId.startsWith('ord_')).toBe(true);
      expect(customerId.startsWith('cust_')).toBe(true);
      expect(invoiceId.startsWith('inv_')).toBe(true);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate token with default length', () => {
      const token = generateSecureToken();
      expect(token).toHaveLength(32);
    });

    it('should generate alphanumeric token', () => {
      const token = generateSecureToken();
      expect(token).toMatch(/^[A-Za-z0-9]+$/);
    });
  });

  describe('generateApiKey', () => {
    it('should generate live API key', () => {
      const key = generateApiKey();
      expect(key.startsWith('sk_live_')).toBe(true);
    });

    it('should generate test API key', () => {
      const key = generateApiKey(false);
      expect(key.startsWith('sk_test_')).toBe(true);
    });
  });

  describe('generateShortCode', () => {
    it('should generate numeric code by default', () => {
      const code = generateShortCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^\d+$/);
    });

    it('should generate alphanumeric code', () => {
      const code = generateShortCode(4, false);
      expect(code).toHaveLength(4);
      expect(code).toMatch(/^[0-9A-Z]+$/);
    });
  });

  describe('extractIdPrefix', () => {
    it('should extract prefix from prefixed ID', () => {
      expect(extractIdPrefix('usr_3k2f8h4m9n1p')).toBe('usr');
    });

    it('should return null for no prefix', () => {
      expect(extractIdPrefix('no-prefix')).toBe(null);
    });

    it('should return null for empty string', () => {
      expect(extractIdPrefix('')).toBe(null);
    });
  });
});
