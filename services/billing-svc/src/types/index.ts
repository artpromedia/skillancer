/**
 * @module @skillancer/billing-svc/types
 * Type definitions for billing service
 */

// =============================================================================
// PAYOUT ACCOUNT TYPES
// =============================================================================

export type PayoutAccountType = 'EXPRESS' | 'STANDARD' | 'CUSTOM';

export type PayoutAccountStatus = 'PENDING' | 'ONBOARDING' | 'ACTIVE' | 'RESTRICTED' | 'DISABLED';

export interface PayoutAccountRequirements {
  currentlyDue: string[];
  eventuallyDue: string[];
  pastDue: string[];
  disabledReason?: string;
}

export interface PayoutSchedule {
  delayDays: number;
  interval: 'manual' | 'daily' | 'weekly' | 'monthly';
  weeklyAnchor?: string;
  monthlyAnchor?: number;
}

export interface ExternalAccountInfo {
  type: 'bank_account' | 'card';
  last4: string;
  bankName?: string;
  routingLast4?: string;
  currency: string;
  country: string;
}

export interface PayoutAccountResponse {
  id: string;
  status: PayoutAccountStatus;
  accountType: PayoutAccountType;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirements: PayoutAccountRequirements;
  defaultCurrency: string;
  country?: string;
  businessType?: string;
  externalAccount?: ExternalAccountInfo;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePayoutAccountParams {
  country: string;
  businessType?: 'individual' | 'company';
  accountType?: PayoutAccountType;
}

export interface OnboardingLinkResponse {
  onboardingUrl: string;
  expiresAt: string;
}

export interface DashboardLinkResponse {
  dashboardUrl: string;
}

// =============================================================================
// PAYOUT TYPES
// =============================================================================

export type PayoutStatus = 'PENDING' | 'IN_TRANSIT' | 'PAID' | 'FAILED' | 'CANCELED';

export interface PayoutResponse {
  id: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  referenceType?: string;
  referenceId?: string;
  description?: string;
  failureCode?: string;
  failureMessage?: string;
  processedAt?: string;
  arrivedAt?: string;
  createdAt: string;
}

export interface CreatePayoutParams {
  amount: number;
  currency?: string;
  description?: string;
  referenceType?: string;
  referenceId?: string;
}

// =============================================================================
// TRANSACTION TYPES
// =============================================================================

export type TransactionType =
  | 'PAYMENT'
  | 'REFUND'
  | 'ESCROW_HOLD'
  | 'ESCROW_RELEASE'
  | 'SUBSCRIPTION'
  | 'PAYOUT';

export type TransactionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'REQUIRES_ACTION'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export interface TransactionResponse {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  platformFee?: number;
  stripeFee?: number;
  netAmount?: number;
  description?: string;
  referenceType?: string;
  referenceId?: string;
  paymentMethod?: {
    id: string;
    type: string;
    cardBrand?: string;
    cardLast4?: string;
    bankName?: string;
    bankLast4?: string;
  };
  failureCode?: string;
  failureMessage?: string;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionFilters {
  type?: TransactionType;
  status?: TransactionStatus;
  referenceType?: string;
  referenceId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface TransactionListResponse {
  transactions: TransactionResponse[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CreatePaymentParams {
  amount: number;
  currency?: string;
  paymentMethodId: string;
  description?: string;
  referenceType?: string;
  referenceId?: string;
  captureMethod?: 'automatic' | 'manual';
  metadata?: Record<string, string>;
}

export interface PaymentResult {
  transactionId: string;
  stripePaymentIntentId: string;
  status: TransactionStatus;
  amount: number;
  currency: string;
  clientSecret?: string; // For 3D Secure / requires_action
}

export interface CapturePaymentParams {
  amount?: number; // Optional partial capture
}

export interface RefundPaymentParams {
  amount?: number; // Optional partial refund
  reason?: 'requested_by_customer' | 'duplicate' | 'fraudulent';
}

export interface RefundResult {
  refundId: string;
  transactionId: string;
  status: TransactionStatus;
  refundedAmount: number;
}

// =============================================================================
// BILLING ADDRESS TYPES
// =============================================================================

export interface BillingAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

// =============================================================================
// SUPPORTED COUNTRIES
// =============================================================================

export interface SupportedCountriesResponse {
  paymentMethods: {
    card: string[];
    us_bank_account: string[];
    sepa_debit: string[];
    bacs_debit: string[];
  };
  payoutCountries: string[];
}

// Card countries (most Stripe-supported countries)
export const CARD_COUNTRIES = [
  'US',
  'CA',
  'GB',
  'DE',
  'FR',
  'ES',
  'IT',
  'NL',
  'BE',
  'AT',
  'CH',
  'AU',
  'NZ',
  'JP',
  'SG',
  'HK',
  'IE',
  'PT',
  'SE',
  'NO',
  'DK',
  'FI',
  'PL',
  'CZ',
  'GR',
] as const;

// ACH is US only
export const ACH_COUNTRIES = ['US'] as const;

// SEPA countries
export const SEPA_COUNTRIES = [
  'AT',
  'BE',
  'CY',
  'DE',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MC',
  'MT',
  'NL',
  'PT',
  'SI',
  'SK',
  'SM',
] as const;

// BACS is UK only
export const BACS_COUNTRIES = ['GB'] as const;

// Countries that support payouts via Connect
export const PAYOUT_COUNTRIES = [
  'US',
  'CA',
  'GB',
  'DE',
  'FR',
  'ES',
  'IT',
  'NL',
  'BE',
  'AT',
  'CH',
  'AU',
  'NZ',
  'JP',
  'SG',
  'HK',
  'IE',
  'PT',
  'SE',
  'NO',
  'DK',
  'FI',
  'PL',
  'CZ',
  'GR',
  'BR',
  'MX',
  'IN',
] as const;

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Convert a Prisma Decimal to a number
 */
export function decimalToNumber(decimal: unknown): number | undefined {
  if (decimal === null || decimal === undefined) return undefined;
  return Number(decimal);
}

/**
 * Convert a number to a format compatible with Prisma Decimal fields
 */
export function toDecimal(value: number): number {
  return value;
}
