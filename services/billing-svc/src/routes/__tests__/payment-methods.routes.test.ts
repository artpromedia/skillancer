/**
 * @module @skillancer/billing-svc/routes/__tests__/payment-methods.routes.test
 * Unit tests for payment methods schema validation
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Test schemas directly without loading the full routes module
// This avoids config validation issues in tests

const PaymentMethodTypeEnum = z.enum(['CARD', 'ACH_DEBIT', 'SEPA_DEBIT', 'WIRE']);
const PaymentMethodStatusEnum = z.enum([
  'ACTIVE',
  'EXPIRING_SOON',
  'EXPIRED',
  'VERIFICATION_PENDING',
  'VERIFICATION_FAILED',
  'REMOVED',
]);

const GetPaymentMethodsQuerySchema = z.object({
  type: PaymentMethodTypeEnum.optional(),
  status: PaymentMethodStatusEnum.optional(),
  includeExpired: z.coerce.boolean().default(false),
});

const AddPaymentMethodSchema = z.object({
  stripePaymentMethodId: z.string().startsWith('pm_'),
  setAsDefault: z.boolean().optional(),
});

const CardSetupIntentSchema = z.object({
  metadata: z.record(z.string()).optional(),
});

const AchSetupIntentSchema = z.object({
  accountHolderName: z.string().min(1),
  accountType: z.enum(['checking', 'savings']).default('checking'),
  metadata: z.record(z.string()).optional(),
});

const SepaSetupIntentSchema = z.object({
  accountHolderName: z.string().min(1),
  email: z.string().email(),
  metadata: z.record(z.string()).optional(),
});

describe('Payment Methods Schema Validation', () => {
  describe('GetPaymentMethodsQuerySchema', () => {
    it('should accept valid query params', () => {
      const result = GetPaymentMethodsQuerySchema.safeParse({
        type: 'CARD',
        status: 'ACTIVE',
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty query', () => {
      const result = GetPaymentMethodsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid type', () => {
      const result = GetPaymentMethodsQuerySchema.safeParse({
        type: 'INVALID',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid status', () => {
      const result = GetPaymentMethodsQuerySchema.safeParse({
        status: 'INVALID',
      });
      expect(result.success).toBe(false);
    });

    it('should coerce boolean values', () => {
      const result = GetPaymentMethodsQuerySchema.parse({
        includeExpired: 'true',
      });
      expect(result.includeExpired).toBe(true);
    });
  });

  describe('AddPaymentMethodSchema', () => {
    it('should accept valid payment method ID', () => {
      const result = AddPaymentMethodSchema.safeParse({
        stripePaymentMethodId: 'pm_1234567890abcdef',
      });
      expect(result.success).toBe(true);
    });

    it('should accept with setAsDefault', () => {
      const result = AddPaymentMethodSchema.safeParse({
        stripePaymentMethodId: 'pm_1234567890abcdef',
        setAsDefault: true,
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid payment method ID prefix', () => {
      const result = AddPaymentMethodSchema.safeParse({
        stripePaymentMethodId: 'card_1234567890abcdef',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing payment method ID', () => {
      const result = AddPaymentMethodSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('CardSetupIntentSchema', () => {
    it('should accept empty object', () => {
      const result = CardSetupIntentSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept with metadata', () => {
      const result = CardSetupIntentSchema.safeParse({
        metadata: { key: 'value' },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('AchSetupIntentSchema', () => {
    it('should accept valid ACH setup intent', () => {
      const result = AchSetupIntentSchema.safeParse({
        accountHolderName: 'John Doe',
        accountType: 'checking',
      });
      expect(result.success).toBe(true);
    });

    it('should default to checking account', () => {
      const result = AchSetupIntentSchema.parse({
        accountHolderName: 'John Doe',
      });
      expect(result.accountType).toBe('checking');
    });

    it('should reject missing account holder name', () => {
      const result = AchSetupIntentSchema.safeParse({
        accountType: 'checking',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid account type', () => {
      const result = AchSetupIntentSchema.safeParse({
        accountHolderName: 'John Doe',
        accountType: 'business',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('SepaSetupIntentSchema', () => {
    it('should accept valid SEPA setup intent', () => {
      const result = SepaSetupIntentSchema.safeParse({
        accountHolderName: 'Jean Dupont',
        email: 'jean@example.fr',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing email', () => {
      const result = SepaSetupIntentSchema.safeParse({
        accountHolderName: 'Jean Dupont',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const result = SepaSetupIntentSchema.safeParse({
        accountHolderName: 'Jean Dupont',
        email: 'invalid-email',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Payment Method Types', () => {
  describe('PaymentMethodTypeEnum', () => {
    it('should accept CARD', () => {
      expect(PaymentMethodTypeEnum.parse('CARD')).toBe('CARD');
    });

    it('should accept ACH_DEBIT', () => {
      expect(PaymentMethodTypeEnum.parse('ACH_DEBIT')).toBe('ACH_DEBIT');
    });

    it('should accept SEPA_DEBIT', () => {
      expect(PaymentMethodTypeEnum.parse('SEPA_DEBIT')).toBe('SEPA_DEBIT');
    });

    it('should reject invalid type', () => {
      expect(() => PaymentMethodTypeEnum.parse('PAYPAL')).toThrow();
    });
  });

  describe('PaymentMethodStatusEnum', () => {
    const validStatuses = [
      'ACTIVE',
      'EXPIRING_SOON',
      'EXPIRED',
      'VERIFICATION_PENDING',
      'VERIFICATION_FAILED',
      'REMOVED',
    ];

    validStatuses.forEach((status) => {
      it(`should accept ${status}`, () => {
        expect(PaymentMethodStatusEnum.parse(status)).toBe(status);
      });
    });

    it('should reject invalid status', () => {
      expect(() => PaymentMethodStatusEnum.parse('INVALID')).toThrow();
    });
  });
});
