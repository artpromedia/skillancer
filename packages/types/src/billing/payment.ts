/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * @skillancer/types - Billing: Payment Types
 * Payment and transaction schemas
 */

import { z } from 'zod';

import {
  uuidSchema,
  dateSchema,
  currencyCodeSchema,
  moneySchema,
  timestampsSchema,
} from '../common/base';

// =============================================================================
// Payment Enums
// =============================================================================

/**
 * Payment status
 */
export const paymentStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'CANCELLED',
  'DISPUTED',
  'ON_HOLD',
]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

/**
 * Payment type
 */
export const paymentTypeSchema = z.enum([
  'ESCROW_FUND',
  'ESCROW_RELEASE',
  'ESCROW_REFUND',
  'MILESTONE_PAYMENT',
  'HOURLY_PAYMENT',
  'SERVICE_PURCHASE',
  'SUBSCRIPTION',
  'PLATFORM_FEE',
  'WITHDRAWAL',
  'DEPOSIT',
  'BONUS',
  'REFUND',
  'ADJUSTMENT',
]);
export type PaymentType = z.infer<typeof paymentTypeSchema>;

/**
 * Payment method type
 */
export const paymentMethodTypeSchema = z.enum([
  'CARD',
  'BANK_ACCOUNT',
  'PAYPAL',
  'STRIPE',
  'WIRE_TRANSFER',
  'CRYPTO',
  'SKILLANCER_BALANCE',
]);
export type PaymentMethodType = z.infer<typeof paymentMethodTypeSchema>;

/**
 * Transaction direction
 */
export const transactionDirectionSchema = z.enum(['CREDIT', 'DEBIT']);
export type TransactionDirection = z.infer<typeof transactionDirectionSchema>;

// =============================================================================
// Payment Sub-schemas
// =============================================================================

/**
 * Payment method schema
 */
export const paymentMethodSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  type: paymentMethodTypeSchema,
  isDefault: z.boolean().default(false),
  isVerified: z.boolean().default(false),

  // Card details (masked)
  cardBrand: z.enum(['VISA', 'MASTERCARD', 'AMEX', 'DISCOVER', 'OTHER']).optional(),
  cardLast4: z.string().length(4).optional(),
  cardExpMonth: z.number().int().min(1).max(12).optional(),
  cardExpYear: z.number().int().optional(),

  // Bank details (masked)
  bankName: z.string().max(100).optional(),
  bankAccountLast4: z.string().length(4).optional(),
  bankRoutingLast4: z.string().length(4).optional(),

  // PayPal
  paypalEmail: z.string().email().optional(),

  // External provider details
  externalId: z.string().optional(),
  externalProvider: z.enum(['STRIPE', 'PAYPAL', 'WISE', 'OTHER']).optional(),

  // Billing address
  billingAddress: z
    .object({
      name: z.string().max(200),
      street1: z.string().max(200),
      street2: z.string().max(200).optional(),
      city: z.string().max(100),
      state: z.string().max(100).optional(),
      postalCode: z.string().max(20).optional(),
      country: z.string().length(2),
    })
    .optional(),

  ...timestampsSchema.shape,
});
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

/**
 * Fee breakdown
 */
export const feeBreakdownSchema = z.object({
  platformFee: z.number().nonnegative(),
  platformFeePercent: z.number().min(0).max(100),
  processingFee: z.number().nonnegative(),
  processingFeePercent: z.number().min(0).max(100).optional(),
  taxAmount: z.number().nonnegative().default(0),
  taxPercent: z.number().min(0).max(100).optional(),
  totalFees: z.number().nonnegative(),
});
export type FeeBreakdown = z.infer<typeof feeBreakdownSchema>;

// =============================================================================
// Main Payment Schema
// =============================================================================

/**
 * Complete payment/transaction schema
 */
export const paymentSchema = z.object({
  id: uuidSchema,
  transactionNumber: z.string(), // Human-readable transaction number

  // Type and status
  type: paymentTypeSchema,
  direction: transactionDirectionSchema,
  status: paymentStatusSchema,

  // Parties
  payerUserId: uuidSchema.optional(),
  payeeUserId: uuidSchema.optional(),
  tenantId: uuidSchema.optional(),

  // Related entities
  contractId: uuidSchema.optional(),
  milestoneId: uuidSchema.optional(),
  invoiceId: uuidSchema.optional(),
  subscriptionId: uuidSchema.optional(),
  serviceOrderId: uuidSchema.optional(),

  // Amount
  amount: z.number().positive(),
  currency: currencyCodeSchema.default('USD'),

  // Fees
  fees: feeBreakdownSchema.optional(),
  netAmount: z.number().nonnegative(), // Amount after fees

  // Payment method
  paymentMethodId: uuidSchema.optional(),
  paymentMethodType: paymentMethodTypeSchema.optional(),

  // Description
  description: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),

  // External provider
  externalId: z.string().optional(),
  externalProvider: z.enum(['STRIPE', 'PAYPAL', 'WISE', 'MANUAL', 'OTHER']).optional(),
  externalStatus: z.string().optional(),

  // Timing
  processedAt: dateSchema.optional(),
  completedAt: dateSchema.optional(),
  failedAt: dateSchema.optional(),
  failureReason: z.string().max(500).optional(),

  // Refund info
  isRefund: z.boolean().default(false),
  originalPaymentId: uuidSchema.optional(),
  refundReason: z.string().max(500).optional(),
  refundedAmount: z.number().nonnegative().default(0),

  // Dispute
  hasDispute: z.boolean().default(false),
  disputeId: uuidSchema.optional(),

  // Receipt
  receiptUrl: z.string().url().optional(),

  // Metadata
  metadata: z.record(z.unknown()).optional(),

  ...timestampsSchema.shape,
});
export type Payment = z.infer<typeof paymentSchema>;

// =============================================================================
// Payment CRUD Schemas
// =============================================================================

/**
 * Create payment input
 */
export const createPaymentSchema = z.object({
  type: paymentTypeSchema,
  amount: z.number().positive(),
  currency: currencyCodeSchema.default('USD'),
  payeeUserId: uuidSchema.optional(),
  contractId: uuidSchema.optional(),
  milestoneId: uuidSchema.optional(),
  invoiceId: uuidSchema.optional(),
  paymentMethodId: uuidSchema.optional(),
  description: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});
export type CreatePayment = z.infer<typeof createPaymentSchema>;

/**
 * Process refund input
 */
export const refundPaymentSchema = z.object({
  paymentId: uuidSchema,
  amount: z.number().positive().optional(), // Full refund if not specified
  reason: z.string().max(500),
});
export type RefundPayment = z.infer<typeof refundPaymentSchema>;

/**
 * Payment filter parameters
 */
export const paymentFilterSchema = z.object({
  payerUserId: uuidSchema.optional(),
  payeeUserId: uuidSchema.optional(),
  contractId: uuidSchema.optional(),
  type: z.array(paymentTypeSchema).optional(),
  status: z.array(paymentStatusSchema).optional(),
  direction: transactionDirectionSchema.optional(),
  minAmount: z.number().nonnegative().optional(),
  maxAmount: z.number().nonnegative().optional(),
  currency: currencyCodeSchema.optional(),
  dateFrom: dateSchema.optional(),
  dateTo: dateSchema.optional(),
});
export type PaymentFilter = z.infer<typeof paymentFilterSchema>;

// =============================================================================
// Wallet/Balance Schema
// =============================================================================

/**
 * User wallet/balance schema
 */
export const walletSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,

  // Available balance (can withdraw)
  availableBalance: z.number().nonnegative().default(0),

  // Pending balance (in escrow, processing)
  pendingBalance: z.number().nonnegative().default(0),

  // Reserved balance (held for disputes, etc.)
  reservedBalance: z.number().nonnegative().default(0),

  currency: currencyCodeSchema.default('USD'),

  // Withdrawal settings
  minWithdrawalAmount: z.number().positive().default(50),
  autoWithdrawalEnabled: z.boolean().default(false),
  autoWithdrawalThreshold: z.number().positive().optional(),
  autoWithdrawalPaymentMethodId: uuidSchema.optional(),

  // Stats
  totalEarnings: z.number().nonnegative().default(0),
  totalWithdrawals: z.number().nonnegative().default(0),
  totalFeesPaid: z.number().nonnegative().default(0),

  lastTransactionAt: dateSchema.optional(),

  ...timestampsSchema.shape,
});
export type Wallet = z.infer<typeof walletSchema>;

/**
 * Withdrawal request schema
 */
export const withdrawalRequestSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  walletId: uuidSchema,
  paymentMethodId: uuidSchema,

  amount: z.number().positive(),
  currency: currencyCodeSchema,

  // Fees
  withdrawalFee: z.number().nonnegative().default(0),
  netAmount: z.number().nonnegative(),

  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']),

  processedAt: dateSchema.optional(),
  completedAt: dateSchema.optional(),
  failedAt: dateSchema.optional(),
  failureReason: z.string().max(500).optional(),

  externalId: z.string().optional(),

  ...timestampsSchema.shape,
});
export type WithdrawalRequest = z.infer<typeof withdrawalRequestSchema>;

/**
 * Create withdrawal request input
 */
export const createWithdrawalSchema = z.object({
  amount: z.number().positive(),
  paymentMethodId: uuidSchema,
});
export type CreateWithdrawal = z.infer<typeof createWithdrawalSchema>;
