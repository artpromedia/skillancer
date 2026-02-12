/**
 * Zod Validation Schemas for Financial Service
 */

import { z } from 'zod';

// =============================================================================
// ENUMS
// =============================================================================

export const CardStatusSchema = z.enum(['PENDING', 'ACTIVE', 'FROZEN', 'CANCELLED', 'EXPIRED']);

export const CardTypeSchema = z.enum(['VIRTUAL', 'PHYSICAL']);

export const TransactionTypeSchema = z.enum([
  'PURCHASE',
  'REFUND',
  'WITHDRAWAL',
  'TRANSFER',
  'FEE',
  'REWARD',
]);

export const TransactionStatusSchema = z.enum(['PENDING', 'COMPLETED', 'DECLINED', 'REVERSED']);

export const FinancingStatusSchema = z.enum([
  'APPLIED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'FUNDED',
  'REPAID',
  'DEFAULTED',
]);

export const TaxVaultStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'CLOSED']);

// =============================================================================
// SKILLANCER CARD SCHEMAS
// =============================================================================

export const ApplyForCardSchema = z
  .object({
    cardType: CardTypeSchema,
    cardName: z.string().min(1).max(50).optional(),
    spendingLimit: z.number().positive().max(100000).optional(),
    shippingAddress: z
      .object({
        street: z.string().min(1).max(200),
        city: z.string().min(1).max(100),
        state: z.string().min(1).max(100),
        postalCode: z.string().min(1).max(20),
        country: z.string().length(2), // ISO 3166-1 alpha-2
      })
      .optional(), // Only required for physical cards
  })
  .refine((data) => data.cardType !== 'PHYSICAL' || data.shippingAddress !== undefined, {
    message: 'Shipping address is required for physical cards',
  });

export const UpdateCardSchema = z.object({
  cardName: z.string().min(1).max(50).optional(),
  spendingLimit: z.number().positive().max(100000).optional(),
  status: z.enum(['ACTIVE', 'FROZEN']).optional(),
});

export const GetTransactionsQuerySchema = z.object({
  cardId: z.string().uuid().optional(),
  type: TransactionTypeSchema.optional(),
  status: TransactionStatusSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// =============================================================================
// INVOICE FINANCING SCHEMAS
// =============================================================================

export const ApplyForFinancingSchema = z.object({
  invoiceId: z.string().uuid(),
  invoiceAmount: z.number().positive(),
  invoiceDueDate: z.string().datetime(),
  clientName: z.string().min(1).max(200),
  clientEmail: z.string().email().optional(),
  requestedAmount: z.number().positive(),
  notes: z.string().max(2000).optional(),
});

export const UpdateFinancingApplicationSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export const GetFinancingQuerySchema = z.object({
  status: FinancingStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// =============================================================================
// TAX VAULT SCHEMAS
// =============================================================================

export const CreateTaxVaultSchema = z.object({
  name: z.string().min(1).max(100).optional().default('Tax Savings'),
  withholdingRate: z.number().min(0.01).max(0.5), // 1% to 50%
  autoWithhold: z.boolean().optional().default(true),
});

export const UpdateTaxVaultSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  withholdingRate: z.number().min(0.01).max(0.5).optional(),
  autoWithhold: z.boolean().optional(),
  status: TaxVaultStatusSchema.optional(),
});

export const TaxVaultTransferSchema = z.object({
  amount: z.number().positive(),
  direction: z.enum(['IN', 'OUT']),
  description: z.string().max(200).optional(),
});

// =============================================================================
// BUSINESS BANKING SCHEMAS
// =============================================================================

export const CreateBusinessAccountSchema = z.object({
  accountType: z.enum(['CHECKING', 'SAVINGS']),
  businessName: z.string().min(1).max(200),
  businessType: z.enum(['SOLE_PROPRIETOR', 'LLC', 'CORPORATION', 'PARTNERSHIP']),
  ein: z
    .string()
    .regex(/^\d{2}-\d{7}$/, 'Invalid EIN format')
    .optional(),
  address: z.object({
    street: z.string().min(1).max(200),
    city: z.string().min(1).max(100),
    state: z.string().min(1).max(100),
    postalCode: z.string().min(1).max(20),
    country: z.string().length(2),
  }),
});

export const TransferFundsSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amount: z.number().positive(),
  description: z.string().max(200).optional(),
  scheduledDate: z.string().datetime().optional(),
});

export const CreatePayoutSchema = z.object({
  accountId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(['ACH', 'WIRE', 'INSTANT']),
  destinationAccount: z.object({
    routingNumber: z.string().regex(/^\d{9}$/, 'Invalid routing number'),
    accountNumber: z.string().min(4).max(17),
    accountType: z.enum(['CHECKING', 'SAVINGS']),
    bankName: z.string().max(100).optional(),
  }),
  description: z.string().max(200).optional(),
});

// =============================================================================
// REPORTING SCHEMAS
// =============================================================================

export const GetFinancialSummaryQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  groupBy: z.enum(['DAY', 'WEEK', 'MONTH']).optional().default('MONTH'),
});

export const GenerateTaxReportSchema = z.object({
  year: z.number().int().min(2020).max(2030),
  format: z.enum(['PDF', 'CSV', 'JSON']).optional().default('PDF'),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type ApplyForCardInput = z.infer<typeof ApplyForCardSchema>;
export type UpdateCardInput = z.infer<typeof UpdateCardSchema>;
export type ApplyForFinancingInput = z.infer<typeof ApplyForFinancingSchema>;
export type CreateTaxVaultInput = z.infer<typeof CreateTaxVaultSchema>;
export type UpdateTaxVaultInput = z.infer<typeof UpdateTaxVaultSchema>;
export type CreateBusinessAccountInput = z.infer<typeof CreateBusinessAccountSchema>;
export type TransferFundsInput = z.infer<typeof TransferFundsSchema>;
export type CreatePayoutInput = z.infer<typeof CreatePayoutSchema>;
