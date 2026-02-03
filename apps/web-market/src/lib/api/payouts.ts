/**
 * Payouts API Client
 *
 * Functions for interacting with billing-svc for payout management.
 * Allows freelancers to manage their earnings and withdraw funds.
 */

const BILLING_API_URL =
  process.env.NEXT_PUBLIC_BILLING_API_URL ?? 'http://localhost:4000/api/billing';

// ============================================================================
// Types
// ============================================================================

export type PayoutStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'IN_TRANSIT'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED';
export type PayoutMethod =
  | 'BANK_TRANSFER'
  | 'INSTANT'
  | 'DEBIT_CARD'
  | 'PAYPAL'
  | 'WISE'
  | 'LOCAL_BANK';
export type PayoutType = 'STANDARD' | 'EXPRESS' | 'INSTANT';
export type PayoutFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'MANUAL';

export interface CurrencyBalance {
  currency: string;
  available: number;
  pending: number;
  lastUpdated?: string;
}

export interface PendingRelease {
  contractId: string;
  contractTitle?: string;
  milestoneId?: string;
  milestoneTitle?: string;
  amount: number;
  currency: string;
  expectedDate: string;
}

export interface LifetimeStats {
  totalEarned: number;
  totalPaidOut: number;
  totalFeesPaid: number;
  payoutCount: number;
}

export interface BalanceSummary {
  userId: string;
  balances: CurrencyBalance[];
  pendingReleases: PendingRelease[];
  lifetimeStats: LifetimeStats;
  nextScheduledPayout: string | null;
}

export interface PayoutFees {
  payoutFee: number;
  processingFee?: number;
  conversionFee: number;
  instantFee?: number;
  totalFee: number;
}

export interface PayoutDestination {
  type: 'bank_account' | 'card';
  bankName?: string;
  last4: string;
  accountType?: string;
}

export interface PayoutTimeline {
  status: PayoutStatus;
  timestamp: string;
  message?: string;
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
  breakdown: Array<{
    label: string;
    amount: string;
    description?: string;
  }>;
  availableBalance: number;
  canProcess: boolean;
  instantAvailable: boolean;
  instantFee?: number;
}

export interface PayoutListResponse {
  payouts: PayoutResponse[];
  total: number;
  hasMore: boolean;
}

export interface PayoutSchedule {
  id: string;
  frequency: PayoutFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  minimumAmount: number;
  currency: string;
  autoPayoutEnabled: boolean;
  lastPayoutAt: string | null;
  nextScheduledAt: string | null;
}

export interface RequestPayoutParams {
  amount: number;
  currency: string;
  targetCurrency?: string;
  method?: PayoutMethod;
  description?: string;
}

export interface InstantPayoutParams {
  amount: number;
  currency: string;
  destination?: 'debit_card' | 'instant_bank';
}

export interface UpdateScheduleParams {
  frequency: PayoutFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  minimumAmount: number;
  currency: string;
  autoPayoutEnabled: boolean;
}

export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  marketRate: number;
  markup: string;
  validUntil: string;
}

export interface SupportedCurrency {
  code: string;
  name: string;
  symbol: string;
  supported: boolean;
  instantPayoutSupported?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = data as { message?: string; error?: string; code?: string };
    throw new Error(error.message ?? error.error ?? `Request failed: ${response.status}`);
  }

  // Handle wrapped responses
  const wrappedData = data as { data?: unknown; success?: boolean };
  if ('data' in wrappedData && wrappedData.success !== false) {
    return wrappedData.data as T;
  }

  return data as T;
}

// ============================================================================
// Balance API
// ============================================================================

/**
 * Get user's payout balance summary
 */
export async function getBalance(): Promise<BalanceSummary> {
  const headers = getAuthHeaders();
  const response = await fetch(`${BILLING_API_URL}/payouts/balance`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  return handleResponse<BalanceSummary>(response);
}

// ============================================================================
// Payout API
// ============================================================================

/**
 * Request a standard payout
 */
export async function requestPayout(params: RequestPayoutParams): Promise<PayoutResponse> {
  const headers = getAuthHeaders();
  const response = await fetch(`${BILLING_API_URL}/payouts`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(params),
  });

  return handleResponse<PayoutResponse>(response);
}

/**
 * Request an instant payout
 */
export async function requestInstantPayout(params: InstantPayoutParams): Promise<PayoutResponse> {
  const headers = getAuthHeaders();
  const response = await fetch(`${BILLING_API_URL}/payouts/instant`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(params),
  });

  return handleResponse<PayoutResponse>(response);
}

/**
 * Preview payout with fee breakdown
 */
export async function previewPayout(
  amount: number,
  currency: string,
  options?: {
    targetCurrency?: string;
    method?: PayoutMethod;
    instant?: boolean;
  }
): Promise<PayoutPreviewResponse> {
  const headers = getAuthHeaders();
  const response = await fetch(`${BILLING_API_URL}/payouts/preview`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      amount,
      currency,
      ...options,
    }),
  });

  return handleResponse<PayoutPreviewResponse>(response);
}

/**
 * Get payout history
 */
export async function getPayoutHistory(options?: {
  status?: PayoutStatus;
  limit?: number;
  offset?: number;
}): Promise<PayoutListResponse> {
  const headers = getAuthHeaders();
  const params = new URLSearchParams();

  if (options?.status) params.set('status', options.status);
  if (options?.limit) params.set('limit', options.limit.toString());
  if (options?.offset) params.set('offset', options.offset.toString());

  const url = `${BILLING_API_URL}/payouts${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  return handleResponse<PayoutListResponse>(response);
}

/**
 * Get specific payout details
 */
export async function getPayout(payoutId: string): Promise<PayoutResponse> {
  const headers = getAuthHeaders();
  const response = await fetch(`${BILLING_API_URL}/payouts/${payoutId}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  return handleResponse<PayoutResponse>(response);
}

/**
 * Cancel a pending payout
 */
export async function cancelPayout(payoutId: string): Promise<PayoutResponse> {
  const headers = getAuthHeaders();
  const response = await fetch(`${BILLING_API_URL}/payouts/${payoutId}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });

  return handleResponse<PayoutResponse>(response);
}

// ============================================================================
// Schedule API
// ============================================================================

/**
 * Get payout schedule
 */
export async function getPayoutSchedule(): Promise<PayoutSchedule | null> {
  const headers = getAuthHeaders();
  const response = await fetch(`${BILLING_API_URL}/payouts/schedule`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  return handleResponse<PayoutSchedule | null>(response);
}

/**
 * Update payout schedule
 */
export async function updatePayoutSchedule(params: UpdateScheduleParams): Promise<PayoutSchedule> {
  const headers = getAuthHeaders();
  const response = await fetch(`${BILLING_API_URL}/payouts/schedule`, {
    method: 'PUT',
    headers,
    credentials: 'include',
    body: JSON.stringify(params),
  });

  return handleResponse<PayoutSchedule>(response);
}

// ============================================================================
// Exchange Rate API
// ============================================================================

/**
 * Get supported currencies
 */
export async function getSupportedCurrencies(): Promise<{ currencies: SupportedCurrency[] }> {
  const headers = getAuthHeaders();
  const response = await fetch(`${BILLING_API_URL}/exchange-rates/currencies`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  return handleResponse<{ currencies: SupportedCurrency[] }>(response);
}

/**
 * Get exchange rate between two currencies
 */
export async function getExchangeRate(from: string, to: string): Promise<ExchangeRate> {
  const headers = getAuthHeaders();
  const response = await fetch(`${BILLING_API_URL}/exchange-rates/${from}/${to}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  return handleResponse<ExchangeRate>(response);
}

/**
 * Preview currency conversion
 */
export async function previewConversion(
  fromCurrency: string,
  toCurrency: string,
  amount: number
): Promise<{
  fromCurrency: string;
  toCurrency: string;
  sourceAmount: number;
  targetAmount: number;
  rate: number;
  conversionFee: number;
}> {
  const headers = getAuthHeaders();
  const response = await fetch(`${BILLING_API_URL}/exchange-rates/preview`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ fromCurrency, toCurrency, amount }),
  });

  return handleResponse(response);
}
