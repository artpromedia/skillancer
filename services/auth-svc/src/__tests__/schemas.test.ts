/**
 * @module @skillancer/auth-svc/__tests__/schemas.test
 * Unit tests for validation schemas
 */

import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';

import {
  registerRequestSchema,
  loginRequestSchema,
  passwordSchema,
  emailSchema,
  refreshTokenRequestSchema,
  forgotPasswordRequestSchema,
  resetPasswordRequestSchema,
} from '../schemas/index.js';

describe('Validation Schemas', () => {
  describe('emailSchema', () => {
    it('should accept valid email', () => {
      const result = emailSchema.parse('test@example.com');
      expect(result).toBe('test@example.com');
    });

    it('should normalize email to lowercase', () => {
      const result = emailSchema.parse('TEST@EXAMPLE.COM');
      expect(result).toBe('test@example.com');
    });

    it('should trim whitespace', () => {
      const result = emailSchema.parse('  test@example.com  ');
      expect(result).toBe('test@example.com');
    });

    it('should reject invalid email', () => {
      expect(() => emailSchema.parse('invalid-email')).toThrow(ZodError);
    });

    it('should reject empty email', () => {
      expect(() => emailSchema.parse('')).toThrow(ZodError);
    });
  });

  describe('passwordSchema', () => {
    it('should accept valid password', () => {
      const result = passwordSchema.parse('SecurePass123!@#');
      expect(result).toBe('SecurePass123!@#');
    });

    it('should reject password shorter than 12 characters', () => {
      expect(() => passwordSchema.parse('Short1!')).toThrow(ZodError);
    });

    it('should reject password without uppercase', () => {
      expect(() => passwordSchema.parse('lowercase123!@#')).toThrow(ZodError);
    });

    it('should reject password without lowercase', () => {
      expect(() => passwordSchema.parse('UPPERCASE123!@#')).toThrow(ZodError);
    });

    it('should reject password without number', () => {
      expect(() => passwordSchema.parse('NoNumbersHere!@#')).toThrow(ZodError);
    });

    it('should reject password without special character', () => {
      expect(() => passwordSchema.parse('NoSpecialChars123')).toThrow(ZodError);
    });

    it('should accept various special characters', () => {
      const specialChars = ['!', '@', '#', '$', '%', '*', '?', '&', '^', '(', ')', '-', '_', '+'];

      for (const char of specialChars) {
        const password = `ValidPassword1${char}`;
        expect(() => passwordSchema.parse(password)).not.toThrow();
      }
    });
  });

  describe('registerRequestSchema', () => {
    const validData = {
      email: 'test@example.com',
      password: 'SecurePass123!@#',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('should accept valid registration data', () => {
      const result = registerRequestSchema.parse(validData);

      expect(result.email).toBe('test@example.com');
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
    });

    it('should apply defaults for optional fields', () => {
      const result = registerRequestSchema.parse(validData);

      expect(result.timezone).toBe('UTC');
      expect(result.locale).toBe('en');
    });

    it('should accept optional displayName', () => {
      const result = registerRequestSchema.parse({
        ...validData,
        displayName: 'Johnny D',
      });

      expect(result.displayName).toBe('Johnny D');
    });

    it('should trim firstName and lastName', () => {
      const result = registerRequestSchema.parse({
        ...validData,
        firstName: '  John  ',
        lastName: '  Doe  ',
      });

      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
    });

    it('should reject empty firstName', () => {
      expect(() =>
        registerRequestSchema.parse({
          ...validData,
          firstName: '',
        })
      ).toThrow(ZodError);
    });

    it('should reject firstName exceeding 100 chars', () => {
      expect(() =>
        registerRequestSchema.parse({
          ...validData,
          firstName: 'a'.repeat(101),
        })
      ).toThrow(ZodError);
    });

    it('should reject weak password', () => {
      expect(() =>
        registerRequestSchema.parse({
          ...validData,
          password: 'weak',
        })
      ).toThrow(ZodError);
    });
  });

  describe('loginRequestSchema', () => {
    it('should accept valid login data', () => {
      const result = loginRequestSchema.parse({
        email: 'test@example.com',
        password: 'anypassword',
      });

      expect(result.email).toBe('test@example.com');
      expect(result.password).toBe('anypassword');
      expect(result.rememberMe).toBe(false);
    });

    it('should accept rememberMe option', () => {
      const result = loginRequestSchema.parse({
        email: 'test@example.com',
        password: 'anypassword',
        rememberMe: true,
      });

      expect(result.rememberMe).toBe(true);
    });

    it('should not enforce password strength on login', () => {
      // Login should accept any password (strength was checked at registration)
      const result = loginRequestSchema.parse({
        email: 'test@example.com',
        password: 'weak',
      });

      expect(result.password).toBe('weak');
    });

    it('should reject empty password', () => {
      expect(() =>
        loginRequestSchema.parse({
          email: 'test@example.com',
          password: '',
        })
      ).toThrow(ZodError);
    });
  });

  describe('refreshTokenRequestSchema', () => {
    it('should accept valid refresh token', () => {
      const result = refreshTokenRequestSchema.parse({
        refreshToken: 'some-refresh-token',
      });

      expect(result.refreshToken).toBe('some-refresh-token');
    });

    it('should reject empty refresh token', () => {
      expect(() =>
        refreshTokenRequestSchema.parse({
          refreshToken: '',
        })
      ).toThrow(ZodError);
    });

    it('should reject missing refresh token', () => {
      expect(() => refreshTokenRequestSchema.parse({})).toThrow(ZodError);
    });
  });

  describe('forgotPasswordRequestSchema', () => {
    it('should accept valid email', () => {
      const result = forgotPasswordRequestSchema.parse({
        email: 'test@example.com',
      });

      expect(result.email).toBe('test@example.com');
    });

    it('should reject invalid email', () => {
      expect(() =>
        forgotPasswordRequestSchema.parse({
          email: 'invalid',
        })
      ).toThrow(ZodError);
    });
  });

  describe('resetPasswordRequestSchema', () => {
    it('should accept valid reset data', () => {
      const result = resetPasswordRequestSchema.parse({
        token: 'some-reset-token',
        password: 'NewSecurePass123!@#',
        confirmPassword: 'NewSecurePass123!@#',
      });

      expect(result.token).toBe('some-reset-token');
      expect(result.password).toBe('NewSecurePass123!@#');
    });

    it('should reject mismatched passwords', () => {
      expect(() =>
        resetPasswordRequestSchema.parse({
          token: 'some-reset-token',
          password: 'NewSecurePass123!@#',
          confirmPassword: 'DifferentPass123!@#',
        })
      ).toThrow(ZodError);
    });

    it('should reject weak new password', () => {
      expect(() =>
        resetPasswordRequestSchema.parse({
          token: 'some-reset-token',
          password: 'weak',
          confirmPassword: 'weak',
        })
      ).toThrow(ZodError);
    });

    it('should reject empty token', () => {
      expect(() =>
        resetPasswordRequestSchema.parse({
          token: '',
          password: 'NewSecurePass123!@#',
          confirmPassword: 'NewSecurePass123!@#',
        })
      ).toThrow(ZodError);
    });
  });
});
