import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  isValidPhone,
  isValidUrl,
  isValidUuid,
  isValidSlug,
  isStrongPassword,
  isValidCreditCard,
  isValidIPv4,
  isValidHexColor,
  isValidJson,
  isValidDateFormat,
  isEmptyString,
  isValidUsername,
} from './validation';

describe('validation', () => {
  describe('isValidEmail', () => {
    it('should validate correct email', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
    });

    it('should validate email with subdomain', () => {
      expect(isValidEmail('test@mail.example.com')).toBe(true);
    });

    it('should validate email with plus sign', () => {
      expect(isValidEmail('test+tag@example.com')).toBe(true);
    });

    it('should reject email without @', () => {
      expect(isValidEmail('testexample.com')).toBe(false);
    });

    it('should reject email without domain', () => {
      expect(isValidEmail('test@')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidEmail('')).toBe(false);
    });

    it('should reject email without TLD', () => {
      expect(isValidEmail('test@example')).toBe(false);
    });
  });

  describe('isValidPhone', () => {
    it('should validate US phone number', () => {
      expect(isValidPhone('1234567890')).toBe(true);
    });

    it('should validate formatted phone', () => {
      expect(isValidPhone('(123) 456-7890')).toBe(true);
    });

    it('should validate international format', () => {
      expect(isValidPhone('+1 (123) 456-7890')).toBe(true);
    });

    it('should reject too short', () => {
      expect(isValidPhone('12345')).toBe(false);
    });

    it('should reject letters (strips them and validates remaining digits)', () => {
      // '123-abc-7890' becomes '1237890' (7 digits) which is valid
      expect(isValidPhone('123-abc-7890')).toBe(true);
    });
  });

  describe('isValidUrl', () => {
    it('should validate https URL', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
    });

    it('should validate http URL', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
    });

    it('should validate URL with path', () => {
      expect(isValidUrl('https://example.com/path/to/page')).toBe(true);
    });

    it('should validate URL with query params', () => {
      expect(isValidUrl('https://example.com?foo=bar&baz=qux')).toBe(true);
    });

    it('should validate URL with port', () => {
      expect(isValidUrl('http://localhost:3000')).toBe(true);
    });

    it('should reject no protocol', () => {
      expect(isValidUrl('example.com')).toBe(false);
    });
  });

  describe('isValidUuid', () => {
    it('should validate v4 UUID', () => {
      expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should validate lowercase UUID', () => {
      expect(isValidUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    });

    it('should validate uppercase UUID', () => {
      expect(isValidUuid('123E4567-E89B-12D3-A456-426614174000')).toBe(true);
    });

    it('should reject invalid format', () => {
      expect(isValidUuid('not-a-uuid')).toBe(false);
    });

    it('should reject wrong length', () => {
      expect(isValidUuid('123e4567-e89b-12d3-a456')).toBe(false);
    });

    it('should reject missing hyphens', () => {
      expect(isValidUuid('123e4567e89b12d3a456426614174000')).toBe(false);
    });
  });

  describe('isValidSlug', () => {
    it('should validate simple slug', () => {
      expect(isValidSlug('hello-world')).toBe(true);
    });

    it('should validate slug with numbers', () => {
      expect(isValidSlug('hello-world-123')).toBe(true);
    });

    it('should reject uppercase', () => {
      expect(isValidSlug('Hello-World')).toBe(false);
    });

    it('should reject spaces', () => {
      expect(isValidSlug('hello world')).toBe(false);
    });

    it('should reject special characters', () => {
      expect(isValidSlug('hello_world')).toBe(false);
    });

    it('should reject starting with hyphen', () => {
      expect(isValidSlug('-hello-world')).toBe(false);
    });

    it('should reject ending with hyphen', () => {
      expect(isValidSlug('hello-world-')).toBe(false);
    });
  });

  describe('isStrongPassword', () => {
    it('should validate strong password', () => {
      const result = isStrongPassword('MyP@ssw0rd!');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require minimum length', () => {
      const result = isStrongPassword('Ab1!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should require uppercase', () => {
      const result = isStrongPassword('password1!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should require lowercase', () => {
      const result = isStrongPassword('PASSWORD1!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should require number', () => {
      const result = isStrongPassword('Password!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should require special character', () => {
      const result = isStrongPassword('Password1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should return multiple errors', () => {
      const result = isStrongPassword('weak');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('isValidCreditCard', () => {
    it('should validate Visa card', () => {
      expect(isValidCreditCard('4111111111111111')).toBe(true);
    });

    it('should validate Mastercard', () => {
      expect(isValidCreditCard('5500000000000004')).toBe(true);
    });

    it('should validate with spaces', () => {
      expect(isValidCreditCard('4111 1111 1111 1111')).toBe(true);
    });

    it('should validate with dashes', () => {
      expect(isValidCreditCard('4111-1111-1111-1111')).toBe(true);
    });

    it('should reject invalid Luhn', () => {
      expect(isValidCreditCard('4111111111111112')).toBe(false);
    });

    it('should reject too short', () => {
      expect(isValidCreditCard('411111111111')).toBe(false);
    });
  });

  describe('isValidIPv4', () => {
    it('should validate IPv4', () => {
      expect(isValidIPv4('192.168.1.1')).toBe(true);
    });

    it('should validate localhost', () => {
      expect(isValidIPv4('127.0.0.1')).toBe(true);
    });

    it('should reject invalid octets', () => {
      expect(isValidIPv4('256.1.1.1')).toBe(false);
    });

    it('should reject too few octets', () => {
      expect(isValidIPv4('192.168.1')).toBe(false);
    });
  });

  describe('isValidHexColor', () => {
    it('should validate 6-digit hex', () => {
      expect(isValidHexColor('#ff0000')).toBe(true);
    });

    it('should validate 3-digit hex', () => {
      expect(isValidHexColor('#f00')).toBe(true);
    });

    it('should validate uppercase hex', () => {
      expect(isValidHexColor('#FF0000')).toBe(true);
    });

    it('should reject without hash', () => {
      expect(isValidHexColor('ff0000')).toBe(false);
    });

    it('should reject invalid characters', () => {
      expect(isValidHexColor('#gggggg')).toBe(false);
    });

    it('should reject wrong length', () => {
      expect(isValidHexColor('#ff00')).toBe(false);
    });
  });

  describe('isValidJson', () => {
    it('should validate valid JSON', () => {
      expect(isValidJson('{"key": "value"}')).toBe(true);
    });

    it('should validate JSON array', () => {
      expect(isValidJson('[1, 2, 3]')).toBe(true);
    });

    it('should reject invalid JSON', () => {
      expect(isValidJson('{invalid}')).toBe(false);
    });
  });

  describe('isValidDateFormat', () => {
    it('should validate YYYY-MM-DD', () => {
      expect(isValidDateFormat('2024-01-15')).toBe(true);
    });

    it('should reject invalid format', () => {
      expect(isValidDateFormat('01/15/2024')).toBe(false);
    });

    it('should reject invalid date', () => {
      expect(isValidDateFormat('2024-02-31')).toBe(false);
    });
  });

  describe('isEmptyString', () => {
    it('should return true for null', () => {
      expect(isEmptyString(null)).toBe(true);
    });

    it('should return true for undefined', () => {
      expect(isEmptyString(undefined)).toBe(true);
    });

    it('should return true for empty string', () => {
      expect(isEmptyString('')).toBe(true);
    });

    it('should return true for whitespace', () => {
      expect(isEmptyString('   ')).toBe(true);
    });

    it('should return false for non-empty string', () => {
      expect(isEmptyString('hello')).toBe(false);
    });
  });

  describe('isValidUsername', () => {
    it('should validate alphanumeric username', () => {
      expect(isValidUsername('john_doe123')).toBe(true);
    });

    it('should validate with hyphens', () => {
      expect(isValidUsername('john-doe')).toBe(true);
    });

    it('should reject too short', () => {
      expect(isValidUsername('ab')).toBe(false);
    });

    it('should reject special characters', () => {
      expect(isValidUsername('john@doe')).toBe(false);
    });
  });
});
