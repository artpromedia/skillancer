/**
 * Cockpit Finances API Hooks
 *
 * React Query hooks for freelancer financial data from billing-svc.
 * Provides earnings, payouts, transactions, and financial summary.
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';

// =============================================================================
// Types
// =============================================================================

export interface EarningsSummary {
  totalEarnings: number;
  monthToDate: number;
  yearToDate: number;
  allTime: number;
  currency: string;
  growthRate?: number;
  comparedToPrevious?: {
    month: number;
    year: number;
  };
}

export interface BalanceSummary {
  currency: string;
  available: number;
  pending: number;
  reserved: number;
  balances: Array<{
    currency: string;
    available: number;
    pending: number;
  }>;
  pendingReleases: Array<{
    contractId: string;
    contractTitle?: string;
    milestoneId?: string;
    milestoneTitle?: string;
    amount: number;
    currency: string;
    expectedDate: string;
  }>;
  lifetimeStats: {
    totalEarned: number;
    totalWithdrawn: number;
    totalPending: number;
  };
}

export interface PayoutRecord {
  id: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'IN_TRANSIT' | 'PAID' | 'FAILED' | 'CANCELLED';
  type: 'STANDARD' | 'EXPRESS' | 'INSTANT';
  method?: 'BANK_TRANSFER' | 'INSTANT' | 'DEBIT_CARD' | 'PAYPAL' | 'WISE' | 'LOCAL_BANK';
  destination?: {
    type: string;
    last4?: string;
    bankName?: string;
  };
  fees: {
    processingFee: number;
    instantFee?: number;
    currencyConversionFee?: number;
    total: number;
  };
  netAmount: number;
  requestedAt: string;
  estimatedArrival?: string;
  arrivedAt?: string;
  failureReason?: string;
  timeline?: Array<{
    status: string;
    timestamp: string;
    description?: string;
  }>;
}

export interface FinancialTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'payout' | 'refund' | 'fee';
  category?: string;
  status?: 'pending' | 'completed' | 'failed';
  relatedId?: string;
  relatedType?: 'contract' | 'milestone' | 'payout' | 'invoice';
}

export interface PayoutHistory {
  payouts: PayoutRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface FinancialOverview {
  revenue: {
    monthToDate: number;
    yearToDate: number;
    allTime: number;
    growthRate: number;
  };
  balance: {
    available: number;
    pending: number;
    reserved: number;
  };
  payouts: {
    totalWithdrawn: number;
    lastPayout?: PayoutRecord;
    pendingPayouts: number;
  };
  expenses: {
    monthToDate: number;
    yearToDate: number;
  };
  profit: {
    monthToDate: number;
    yearToDate: number;
    margin: number;
  };
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

interface ApiErrorResponse {
  error?: string;
  message?: string;
}

// =============================================================================
// Query Keys
// =============================================================================

export const cockpitFinanceKeys = {
  all: ['cockpit-finances'] as const,
  earnings: () => [...cockpitFinanceKeys.all, 'earnings'] as const,
  earningsSummary: (period?: { startDate?: string; endDate?: string }) =>
    [...cockpitFinanceKeys.earnings(), 'summary', period] as const,
  balance: () => [...cockpitFinanceKeys.all, 'balance'] as const,
  payouts: () => [...cockpitFinanceKeys.all, 'payouts'] as const,
  payoutHistory: (params?: { status?: string; limit?: number; offset?: number }) =>
    [...cockpitFinanceKeys.payouts(), 'history', params] as const,
  payout: (id: string) => [...cockpitFinanceKeys.payouts(), id] as const,
  transactions: () => [...cockpitFinanceKeys.all, 'transactions'] as const,
  transactionList: (filters?: {
    type?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) => [...cockpitFinanceKeys.transactions(), filters] as const,
  overview: () => [...cockpitFinanceKeys.all, 'overview'] as const,
};

// =============================================================================
// API Base URL
// =============================================================================

const BILLING_API_URL =
  process.env.NEXT_PUBLIC_BILLING_API_URL || 'http://localhost:4001/api/billing';

async function apiClient<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('auth_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options?.headers,
  };

  const response = await fetch(`${BILLING_API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({
      error: 'Unknown error',
    }))) as ApiErrorResponse;
    throw new Error(errorData.error ?? errorData.message ?? 'API request failed');
  }

  return response.json() as Promise<ApiResponse<T>>;
}

// =============================================================================
// Earnings Hooks
// =============================================================================

/**
 * Get earnings summary (MTD, YTD, all time)
 */
export function useEarnings(
  period?: { startDate?: string; endDate?: string },
  options?: Omit<UseQueryOptions<EarningsSummary>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: cockpitFinanceKeys.earningsSummary(period),
    queryFn: async (): Promise<EarningsSummary> => {
      // Calculate earnings from balance and payout history
      const balanceResponse = await apiClient<BalanceSummary>('/payouts/balance');
      const payoutsResponse = await apiClient<PayoutHistory>('/payouts?limit=100');

      const balanceData = balanceResponse.data;
      const payoutsData = payoutsResponse.data;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const yearStart = new Date(now.getFullYear(), 0, 1);

      const monthPayouts = payoutsData.payouts
        .filter((p) => new Date(p.requestedAt) >= monthStart && p.status === 'PAID')
        .reduce((sum, p) => sum + p.amount, 0);

      const yearPayouts = payoutsData.payouts
        .filter((p) => new Date(p.requestedAt) >= yearStart && p.status === 'PAID')
        .reduce((sum, p) => sum + p.amount, 0);

      const totalPaid = payoutsData.payouts
        .filter((p) => p.status === 'PAID')
        .reduce((sum, p) => sum + p.amount, 0);

      return {
        totalEarnings: balanceData.available + balanceData.pending + totalPaid,
        monthToDate: monthPayouts + balanceData.available,
        yearToDate: yearPayouts + balanceData.available,
        allTime: balanceData.lifetimeStats.totalEarned,
        currency: balanceData.currency,
      };
    },
    ...options,
  });
}

/**
 * Get available balance and pending amounts
 */
export function useBalance(
  options?: Omit<UseQueryOptions<BalanceSummary>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: cockpitFinanceKeys.balance(),
    queryFn: async (): Promise<BalanceSummary> => {
      const response = await apiClient<BalanceSummary>('/payouts/balance');
      return response.data;
    },
    staleTime: 1000 * 60, // 1 minute
    ...options,
  });
}

// =============================================================================
// Payout Hooks
// =============================================================================

/**
 * Get payout history
 */
export function usePayouts(
  params?: { status?: string; limit?: number; offset?: number },
  options?: Omit<UseQueryOptions<PayoutHistory>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: cockpitFinanceKeys.payoutHistory(params),
    queryFn: async (): Promise<PayoutHistory> => {
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append('status', params.status);
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.offset) queryParams.append('offset', params.offset.toString());

      const query = queryParams.toString();
      const endpoint = query ? `/payouts?${query}` : '/payouts';
      const response = await apiClient<PayoutHistory>(endpoint);
      return response.data;
    },
    ...options,
  });
}

/**
 * Get specific payout details
 */
export function usePayout(
  payoutId: string,
  options?: Omit<UseQueryOptions<PayoutRecord>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: cockpitFinanceKeys.payout(payoutId),
    queryFn: async (): Promise<PayoutRecord> => {
      const response = await apiClient<PayoutRecord>(`/payouts/${payoutId}`);
      return response.data;
    },
    enabled: Boolean(payoutId),
    ...options,
  });
}

/**
 * Request a payout
 */
export function useRequestPayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { amount: number; currency: string; method?: string }) => {
      const response = await apiClient<PayoutRecord>('/payouts', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cockpitFinanceKeys.balance() });
      void queryClient.invalidateQueries({ queryKey: cockpitFinanceKeys.payouts() });
    },
  });
}

// =============================================================================
// Transaction Hooks
// =============================================================================

/**
 * Get transaction history
 */
export function useTransactions(
  filters?: { type?: string; startDate?: string; endDate?: string; limit?: number },
  options?: Omit<
    UseQueryOptions<{ transactions: FinancialTransaction[]; total: number }>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: cockpitFinanceKeys.transactionList(filters),
    queryFn: async (): Promise<{ transactions: FinancialTransaction[]; total: number }> => {
      // Derive transactions from payouts (expand when transaction endpoint available)
      const payoutsResponse = await apiClient<PayoutHistory>(
        `/payouts?limit=${String(filters?.limit ?? 10)}`
      );
      const payoutsData = payoutsResponse.data;

      const transactions: FinancialTransaction[] = payoutsData.payouts.map(
        (payout: PayoutRecord) => ({
          id: payout.id,
          date: payout.requestedAt,
          description: `Payout - ${payout.method ?? 'Bank Transfer'}`,
          amount: -payout.amount,
          type: 'payout' as const,
          category: 'Withdrawal',
          status: payout.status === 'PAID' ? ('completed' as const) : ('pending' as const),
          relatedId: payout.id,
          relatedType: 'payout' as const,
        })
      );

      return {
        transactions,
        total: payoutsData.total,
      };
    },
    ...options,
  });
}

/**
 * Get financial overview/summary
 */
export function useFinancialSummary(
  options?: Omit<UseQueryOptions<FinancialOverview>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: cockpitFinanceKeys.overview(),
    queryFn: async (): Promise<FinancialOverview> => {
      const balanceResponse = await apiClient<BalanceSummary>('/payouts/balance');
      const payoutsResponse = await apiClient<PayoutHistory>('/payouts?limit=100');

      const balanceData = balanceResponse.data;
      const payoutsData = payoutsResponse.data;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const yearStart = new Date(now.getFullYear(), 0, 1);

      const monthPayouts = payoutsData.payouts
        .filter((p) => new Date(p.requestedAt) >= monthStart && p.status === 'PAID')
        .reduce((sum, p) => sum + p.amount, 0);

      const yearPayouts = payoutsData.payouts
        .filter((p) => new Date(p.requestedAt) >= yearStart && p.status === 'PAID')
        .reduce((sum, p) => sum + p.amount, 0);

      const lastPayout = payoutsData.payouts.find((p) => p.status === 'PAID');
      const pendingPayoutsList = payoutsData.payouts.filter(
        (p) => p.status === 'PENDING' || p.status === 'PROCESSING'
      );

      return {
        revenue: {
          monthToDate: monthPayouts + balanceData.available,
          yearToDate: yearPayouts + balanceData.available,
          allTime: balanceData.lifetimeStats.totalEarned,
          growthRate: 0,
        },
        balance: {
          available: balanceData.available,
          pending: balanceData.pending,
          reserved: balanceData.reserved,
        },
        payouts: {
          totalWithdrawn: balanceData.lifetimeStats.totalWithdrawn,
          lastPayout,
          pendingPayouts: pendingPayoutsList.length,
        },
        expenses: {
          monthToDate: 0,
          yearToDate: 0,
        },
        profit: {
          monthToDate: monthPayouts + balanceData.available,
          yearToDate: yearPayouts + balanceData.available,
          margin: 100,
        },
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...options,
  });
}
