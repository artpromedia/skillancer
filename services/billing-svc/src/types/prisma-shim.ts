/**
 * Prisma Types Shim for Billing Service
 *
 * This file provides type definitions for Prisma models when the Prisma client
 * hasn't been generated with the billing schema (e.g., offline builds).
 */

// Re-export PrismaClient from actual prisma
export { PrismaClient } from '@prisma/client';

// =============================================================================
// ENUMS (as string literal types)
// =============================================================================

export type PaymentMethodType =
  | 'CARD'
  | 'ACH_DEBIT'
  | 'SEPA_DEBIT'
  | 'BANK_TRANSFER'
  | 'PAYPAL'
  | 'CRYPTO';

export type PaymentMethodStatus =
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'FAILED'
  | 'REMOVED'
  | 'PENDING_VERIFICATION';

export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED'
  | 'ESCROWED'
  | 'RELEASED'
  | 'DISPUTED';

export type EscrowStatus =
  | 'PENDING'
  | 'FUNDED'
  | 'PARTIALLY_RELEASED'
  | 'RELEASED'
  | 'REFUNDED'
  | 'DISPUTED';

export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELED';

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'VIEWED' | 'PAID' | 'OVERDUE' | 'CANCELED' | 'VOID';

export type SubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'UNPAID'
  | 'INCOMPLETE'
  | 'INCOMPLETE_EXPIRED'
  | 'PAUSED';

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'WON' | 'LOST' | 'CLOSED';

export type TransactionType =
  | 'PAYMENT'
  | 'REFUND'
  | 'PAYOUT'
  | 'FEE'
  | 'ADJUSTMENT'
  | 'ESCROW_FUND'
  | 'ESCROW_RELEASE';

// =============================================================================
// ENUM VALUE OBJECTS (for using enums as values)
// =============================================================================

export const PaymentMethodType = {
  CARD: 'CARD' as const,
  ACH_DEBIT: 'ACH_DEBIT' as const,
  SEPA_DEBIT: 'SEPA_DEBIT' as const,
  BANK_TRANSFER: 'BANK_TRANSFER' as const,
  PAYPAL: 'PAYPAL' as const,
  CRYPTO: 'CRYPTO' as const,
};

export const PaymentMethodStatus = {
  ACTIVE: 'ACTIVE' as const,
  EXPIRING_SOON: 'EXPIRING_SOON' as const,
  EXPIRED: 'EXPIRED' as const,
  FAILED: 'FAILED' as const,
  REMOVED: 'REMOVED' as const,
  PENDING_VERIFICATION: 'PENDING_VERIFICATION' as const,
};

export const PaymentStatus = {
  PENDING: 'PENDING' as const,
  PROCESSING: 'PROCESSING' as const,
  COMPLETED: 'COMPLETED' as const,
  FAILED: 'FAILED' as const,
  REFUNDED: 'REFUNDED' as const,
  ESCROWED: 'ESCROWED' as const,
  RELEASED: 'RELEASED' as const,
  DISPUTED: 'DISPUTED' as const,
};

export const EscrowStatus = {
  PENDING: 'PENDING' as const,
  FUNDED: 'FUNDED' as const,
  PARTIALLY_RELEASED: 'PARTIALLY_RELEASED' as const,
  RELEASED: 'RELEASED' as const,
  REFUNDED: 'REFUNDED' as const,
  DISPUTED: 'DISPUTED' as const,
};

export const PayoutStatus = {
  PENDING: 'PENDING' as const,
  PROCESSING: 'PROCESSING' as const,
  COMPLETED: 'COMPLETED' as const,
  FAILED: 'FAILED' as const,
  CANCELED: 'CANCELED' as const,
};

export const InvoiceStatus = {
  DRAFT: 'DRAFT' as const,
  SENT: 'SENT' as const,
  VIEWED: 'VIEWED' as const,
  PAID: 'PAID' as const,
  OVERDUE: 'OVERDUE' as const,
  CANCELED: 'CANCELED' as const,
  VOID: 'VOID' as const,
};

export const SubscriptionStatus = {
  TRIALING: 'TRIALING' as const,
  ACTIVE: 'ACTIVE' as const,
  PAST_DUE: 'PAST_DUE' as const,
  CANCELED: 'CANCELED' as const,
  UNPAID: 'UNPAID' as const,
  INCOMPLETE: 'INCOMPLETE' as const,
  INCOMPLETE_EXPIRED: 'INCOMPLETE_EXPIRED' as const,
  PAUSED: 'PAUSED' as const,
};

export const DisputeStatus = {
  OPEN: 'OPEN' as const,
  UNDER_REVIEW: 'UNDER_REVIEW' as const,
  WON: 'WON' as const,
  LOST: 'LOST' as const,
  CLOSED: 'CLOSED' as const,
};

export const TransactionType = {
  PAYMENT: 'PAYMENT' as const,
  REFUND: 'REFUND' as const,
  PAYOUT: 'PAYOUT' as const,
  FEE: 'FEE' as const,
  ADJUSTMENT: 'ADJUSTMENT' as const,
  ESCROW_FUND: 'ESCROW_FUND' as const,
  ESCROW_RELEASE: 'ESCROW_RELEASE' as const,
};

// =============================================================================
// MODEL INTERFACES (minimal stubs)
// =============================================================================

export interface PaymentMethod {
  id: string;
  userId: string;
  stripePaymentMethodId: string;
  stripeCustomerId: string;
  type: PaymentMethodType;
  isDefault: boolean;
  status: PaymentMethodStatus;
  cardBrand?: string | null;
  cardLast4?: string | null;
  cardExpMonth?: number | null;
  cardExpYear?: number | null;
  cardFunding?: string | null;
  fingerprint?: string | null;
  bankName?: string | null;
  bankLast4?: string | null;
  bankAccountType?: string | null;
  bankRoutingLast4?: string | null;
  sepaCountry?: string | null;
  sepaBankCode?: string | null;
  billingName?: string | null;
  billingEmail?: string | null;
  billingCountry?: string | null;
  billingPostalCode?: string | null;
  expirationWarningAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}

export interface PaymentTransaction {
  id: string;
  userId: string;
  stripePaymentIntentId?: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  type: TransactionType;
  [key: string]: unknown;
}

export interface Escrow {
  id: string;
  contractId: string;
  clientId: string;
  freelancerId: string;
  amount: number;
  status: EscrowStatus;
  [key: string]: unknown;
}

export interface Payout {
  id: string;
  userId: string;
  amount: number;
  status: PayoutStatus;
  [key: string]: unknown;
}

export interface PayoutAccount {
  id: string;
  userId: string;
  stripeConnectId?: string | null;
  [key: string]: unknown;
}

export interface Subscription {
  id: string;
  userId: string;
  stripeSubscriptionId: string;
  status: SubscriptionStatus;
  [key: string]: unknown;
}

export interface Invoice {
  id: string;
  userId: string;
  status: InvoiceStatus;
  [key: string]: unknown;
}

export interface Dispute {
  id: string;
  status: DisputeStatus;
  [key: string]: unknown;
}

export interface Coupon {
  id: string;
  code: string;
  [key: string]: unknown;
}

export interface CouponRedemption {
  id: string;
  couponId: string;
  userId: string;
  [key: string]: unknown;
}

// =============================================================================
// PRISMA NAMESPACE STUBS
// =============================================================================

export namespace Prisma {
  export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
  export interface JsonObject {
    [key: string]: JsonValue;
  }
  export type JsonArray = JsonValue[];
  export type InputJsonValue = string | number | boolean | null | InputJsonObject | InputJsonArray;
  export interface InputJsonObject {
    [key: string]: InputJsonValue;
  }
  export type InputJsonArray = InputJsonValue[];

  export const DbNull: unique symbol = Symbol('DbNull');
  export const JsonNull: unique symbol = Symbol('JsonNull');
  export const AnyNull: unique symbol = Symbol('AnyNull');

  export interface PaymentMethodWhereInput {
    [key: string]: unknown;
  }

  export interface PaymentMethodUpdateInput {
    [key: string]: unknown;
  }

  export interface SubscriptionWhereInput {
    [key: string]: unknown;
  }

  export interface SubscriptionUpdateInput {
    [key: string]: unknown;
  }
}
