/**
 * @module @skillancer/billing-svc/types/payout
 * Type definitions for the global payout system
 */

// =============================================================================
// ENUMS
// =============================================================================

export type PayoutStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'IN_TRANSIT'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED';

export type PayoutMethod = 'BANK_TRANSFER' | 'INSTANT' | 'DEBIT_CARD' | 'PAYPAL';

export type PayoutType = 'STANDARD' | 'EXPRESS' | 'INSTANT';

export type PayoutFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'MANUAL';

// =============================================================================
// BALANCE TYPES
// =============================================================================

export interface CurrencyBalance {
  currency: string;
  amount: number;
}

export interface PendingRelease {
  contractId: string;
  contractTitle?: string;
  milestoneId?: string;
  milestoneTitle?: string;
  amount: number;
  currency: string;
  expectedDate: Date;
}

export interface LifetimeStats {
  totalEarned: number;
  totalPaidOut: number;
  totalFees: number;
}

export interface StripeBalanceInfo {
  available: CurrencyBalance[];
  pending: CurrencyBalance[];
  instantAvailable?: CurrencyBalance[];
}

export interface PayoutBalanceSummary {
  available: CurrencyBalance[];
  pending: CurrencyBalance[];
  pendingReleases: PendingRelease[];
  lifetime: LifetimeStats;
  stripeBalance: StripeBalanceInfo | null;
  defaultCurrency: string;
}

// =============================================================================
// FEE TYPES
// =============================================================================

export interface PayoutFees {
  payoutFee: number;
  conversionFee: number;
  totalFee: number;
}

export interface PayoutFeeBreakdown {
  label: string;
  amount: string;
  description?: string;
}

// =============================================================================
// CONVERSION TYPES
// =============================================================================

export interface ExchangeRateInfo {
  rate: number;
  baseRate: number;
  markup: number;
  fromCurrency: string;
  toCurrency: string;
  validUntil?: Date;
}

export interface ConversionResult {
  fromCurrency: string;
  toCurrency: string;
  sourceAmount: number;
  targetAmount: number;
  rate: number;
  baseRate: number;
  conversionFee: number;
  validUntil?: Date;
}

export interface ConversionPreview extends ConversionResult {
  breakdown: Array<{
    label: string;
    description: string;
  }>;
  marketRate: number;
  ourRate: number;
  savings: number | null;
}

// =============================================================================
// PAYOUT REQUEST TYPES
// =============================================================================

export interface RequestPayoutParams {
  userId: string;
  amount: number;
  currency: string;
  targetCurrency?: string;
  method?: PayoutMethod;
  type?: PayoutType;
}

export interface PayoutPreviewParams {
  userId: string;
  amount: number;
  currency: string;
  targetCurrency?: string;
  method?: PayoutMethod;
  type?: PayoutType;
}

export interface InstantPayoutParams {
  userId: string;
  amount: number;
  currency: string;
}

// =============================================================================
// PAYOUT RESPONSE TYPES
// =============================================================================

export interface PayoutDestination {
  type: 'bank_account' | 'card';
  bankName?: string;
  last4: string;
  accountType?: string;
  routingLast4?: string;
}

export interface PayoutTimeline {
  status: PayoutStatus;
  timestamp: string;
  message?: string;
}

export interface SourceTransaction {
  id: string;
  contractTitle?: string;
  milestoneTitle?: string;
  amount: number;
  currency: string;
  createdAt: string;
}

export interface PayoutResponse {
  id: string;
  amount: number;
  currency: string;
  originalAmount?: number;
  originalCurrency?: string;
  exchangeRate?: number;
  status: PayoutStatus;
  method: PayoutMethod;
  type: PayoutType;
  fees: PayoutFees;
  netAmount: number;
  destination?: PayoutDestination;
  estimatedArrival?: string;
  arrivedAt?: string;
  failureCode?: string;
  failureMessage?: string;
  timeline?: PayoutTimeline[];
  sourceTransactions?: SourceTransaction[];
  createdAt: string;
  updatedAt: string;
}

export interface PayoutPreviewResponse {
  grossAmount: number;
  currency: string;
  conversion?: {
    targetAmount: number;
    targetCurrency: string;
    rate: number;
    marketRate: number;
    conversionFee: number;
  };
  fees: PayoutFees;
  netAmount: number;
  estimatedArrival: string;
  breakdown: PayoutFeeBreakdown[];
  instantAvailable: boolean;
  instantFee?: number;
}

export interface PayoutListResponse {
  payouts: PayoutResponse[];
  total: number;
  page: number;
  totalPages: number;
}

// =============================================================================
// SCHEDULE TYPES
// =============================================================================

export interface PayoutScheduleParams {
  frequency: PayoutFrequency;
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-28 for monthly
  minimumAmount?: number;
  currency?: string;
  autoPayoutEnabled?: boolean;
}

export interface PayoutScheduleResponse {
  id: string;
  frequency: PayoutFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  minimumAmount: number;
  currency: string;
  autoPayoutEnabled: boolean;
  lastPayoutAt?: string;
  nextScheduledAt?: string;
}

// =============================================================================
// EXCHANGE RATE TYPES
// =============================================================================

export interface ExchangeRateResponse {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  marketRate: number;
  markup: string;
  conversion?: {
    sourceAmount: number;
    targetAmount: number;
  };
  validUntil: string;
}

export interface SupportedCurrency {
  code: string;
  name: string;
  symbol: string;
  supported: boolean;
  instantPayoutSupported?: boolean;
}

export interface SupportedCurrenciesResponse {
  currencies: SupportedCurrency[];
  payoutCurrencies: string[];
  instantPayoutCurrencies: string[];
}

// =============================================================================
// MINIMUM AMOUNTS BY CURRENCY
// =============================================================================

export const MINIMUM_PAYOUT_AMOUNTS: Record<string, number> = {
  USD: 25,
  EUR: 25,
  GBP: 20,
  CAD: 25,
  AUD: 25,
  NZD: 25,
  CHF: 25,
  DKK: 200,
  SEK: 250,
  NOK: 250,
  JPY: 3000,
  SGD: 35,
  HKD: 200,
  INR: 2000,
  BRL: 125,
  MXN: 500,
  PLN: 100,
  CZK: 600,
};

// =============================================================================
// SUPPORTED CURRENCIES
// =============================================================================

export const SUPPORTED_PAYOUT_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$' },
  { code: 'PLN', name: 'Polish Złoty', symbol: 'zł' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
] as const;

export const INSTANT_PAYOUT_CURRENCIES = ['USD', 'EUR', 'GBP'] as const;

// =============================================================================
// FEE STRUCTURES
// =============================================================================

export const PAYOUT_FEES_BY_REGION: Record<string, number> = {
  US: 0.25, // ACH
  CA: 0.25,
  GB: 0.2, // Faster Payments
  EU: 0.25, // SEPA
  AU: 0.25,
  DEFAULT: 3.0, // International wire
};

export const SEPA_COUNTRIES = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
];

export const INSTANT_PAYOUT_FEE_PERCENT = 1.0; // 1% for instant payouts
export const EXPRESS_PAYOUT_SURCHARGE = 2.0; // $2 extra for express
export const CONVERSION_MARKUP_PERCENT = 2.0; // 2% on currency conversion
