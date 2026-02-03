'use client';

/**
 * Payouts Hooks
 *
 * TanStack Query hooks for payout management.
 * Provides data fetching, mutations, and caching for the payout system.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type {
  PayoutStatus,
  PayoutMethod,
  RequestPayoutParams,
  InstantPayoutParams,
  UpdateScheduleParams,
} from '@/lib/api/payouts';

import {
  getBalance,
  requestPayout,
  requestInstantPayout,
  previewPayout,
  getPayoutHistory,
  getPayout,
  cancelPayout,
  getPayoutSchedule,
  updatePayoutSchedule,
  getSupportedCurrencies,
  getExchangeRate,
  previewConversion,
} from '@/lib/api/payouts';

// ============================================================================
// Query Keys
// ============================================================================

export const payoutKeys = {
  all: ['payouts'] as const,
  balance: () => [...payoutKeys.all, 'balance'] as const,
  history: (filters?: { status?: PayoutStatus; limit?: number; offset?: number }) =>
    [...payoutKeys.all, 'history', filters] as const,
  detail: (id: string) => [...payoutKeys.all, 'detail', id] as const,
  schedule: () => [...payoutKeys.all, 'schedule'] as const,
  preview: (amount: number, currency: string, options?: Record<string, unknown>) =>
    [...payoutKeys.all, 'preview', amount, currency, options] as const,
  currencies: () => [...payoutKeys.all, 'currencies'] as const,
  exchangeRate: (from: string, to: string) =>
    [...payoutKeys.all, 'exchangeRate', from, to] as const,
};

// ============================================================================
// Balance Hooks
// ============================================================================

/**
 * Hook to fetch user's balance summary
 */
export function useBalance(options?: { enabled?: boolean; refetchInterval?: number | false }) {
  return useQuery({
    queryKey: payoutKeys.balance(),
    queryFn: getBalance,
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
    staleTime: 30000, // 30 seconds
  });
}

// ============================================================================
// Payout Hooks
// ============================================================================

/**
 * Hook to fetch payout history
 */
export function usePayoutHistory(options?: {
  status?: PayoutStatus;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}) {
  const { status, limit, offset, enabled = true } = options ?? {};

  return useQuery({
    queryKey: payoutKeys.history({ status, limit, offset }),
    queryFn: () => getPayoutHistory({ status, limit, offset }),
    enabled,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to fetch a specific payout
 */
export function usePayout(payoutId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: payoutKeys.detail(payoutId),
    queryFn: () => getPayout(payoutId),
    enabled: options?.enabled ?? !!payoutId,
  });
}

/**
 * Hook to preview payout fees
 */
export function usePayoutPreview(
  amount: number,
  currency: string,
  options?: {
    targetCurrency?: string;
    method?: PayoutMethod;
    instant?: boolean;
    enabled?: boolean;
  }
) {
  const { targetCurrency, method, instant, enabled = true } = options ?? {};

  return useQuery({
    queryKey: payoutKeys.preview(amount, currency, { targetCurrency, method, instant }),
    queryFn: () => previewPayout(amount, currency, { targetCurrency, method, instant }),
    enabled: enabled && amount > 0,
    staleTime: 30000, // 30 seconds - exchange rates change
  });
}

/**
 * Hook to request a standard payout
 */
export function useRequestPayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: RequestPayoutParams) => requestPayout(params),
    onSuccess: () => {
      // Invalidate balance and history
      void queryClient.invalidateQueries({ queryKey: payoutKeys.balance() });
      void queryClient.invalidateQueries({ queryKey: payoutKeys.history() });
    },
  });
}

/**
 * Hook to request an instant payout
 */
export function useRequestInstantPayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: InstantPayoutParams) => requestInstantPayout(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: payoutKeys.balance() });
      void queryClient.invalidateQueries({ queryKey: payoutKeys.history() });
    },
  });
}

/**
 * Hook to cancel a pending payout
 */
export function useCancelPayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payoutId: string) => cancelPayout(payoutId),
    onSuccess: (data, payoutId) => {
      void queryClient.invalidateQueries({ queryKey: payoutKeys.balance() });
      void queryClient.invalidateQueries({ queryKey: payoutKeys.history() });
      void queryClient.invalidateQueries({ queryKey: payoutKeys.detail(payoutId) });
    },
  });
}

// ============================================================================
// Schedule Hooks
// ============================================================================

/**
 * Hook to fetch payout schedule
 */
export function usePayoutSchedule(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: payoutKeys.schedule(),
    queryFn: getPayoutSchedule,
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook to update payout schedule
 */
export function useUpdatePayoutSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UpdateScheduleParams) => updatePayoutSchedule(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: payoutKeys.schedule() });
      void queryClient.invalidateQueries({ queryKey: payoutKeys.balance() });
    },
  });
}

// ============================================================================
// Currency Hooks
// ============================================================================

/**
 * Hook to fetch supported currencies
 */
export function useSupportedCurrencies(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: payoutKeys.currencies(),
    queryFn: getSupportedCurrencies,
    enabled: options?.enabled ?? true,
    staleTime: 3600000, // 1 hour - currencies don't change often
  });
}

/**
 * Hook to get exchange rate
 */
export function useExchangeRate(from: string, to: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: payoutKeys.exchangeRate(from, to),
    queryFn: () => getExchangeRate(from, to),
    enabled: options?.enabled ?? (!!from && !!to && from !== to),
    staleTime: 60000, // 1 minute - exchange rates change frequently
  });
}

/**
 * Hook to preview currency conversion
 */
export function useConversionPreview(
  fromCurrency: string,
  toCurrency: string,
  amount: number,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: [...payoutKeys.exchangeRate(fromCurrency, toCurrency), 'preview', amount],
    queryFn: () => previewConversion(fromCurrency, toCurrency, amount),
    enabled: options?.enabled ?? (!!fromCurrency && !!toCurrency && amount > 0),
    staleTime: 30000,
  });
}

// ============================================================================
// Combined Hook for Payout Page
// ============================================================================

/**
 * Combined hook for payout dashboard - fetches all required data
 */
export function usePayoutDashboard() {
  const balanceQuery = useBalance({ refetchInterval: 30000 });
  const historyQuery = usePayoutHistory({ limit: 10 });
  const scheduleQuery = usePayoutSchedule();

  const isLoading = balanceQuery.isLoading || historyQuery.isLoading || scheduleQuery.isLoading;
  const error = balanceQuery.error || historyQuery.error || scheduleQuery.error;

  return {
    balance: balanceQuery.data,
    payouts: historyQuery.data,
    schedule: scheduleQuery.data,
    isLoading,
    error,
    refetch: () => {
      void balanceQuery.refetch();
      void historyQuery.refetch();
      void scheduleQuery.refetch();
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format currency amount for display
 */
export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get status display info
 */
export function getPayoutStatusInfo(status: PayoutStatus): {
  label: string;
  color: string;
  bgColor: string;
} {
  const statusMap: Record<PayoutStatus, { label: string; color: string; bgColor: string }> = {
    PENDING: { label: 'Pending', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
    PROCESSING: { label: 'Processing', color: 'text-blue-700', bgColor: 'bg-blue-100' },
    IN_TRANSIT: { label: 'In Transit', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
    PAID: { label: 'Paid', color: 'text-green-700', bgColor: 'bg-green-100' },
    FAILED: { label: 'Failed', color: 'text-red-700', bgColor: 'bg-red-100' },
    CANCELLED: { label: 'Cancelled', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  };

  return statusMap[status] ?? { label: status, color: 'text-gray-700', bgColor: 'bg-gray-100' };
}

/**
 * Get frequency display label
 */
export function getFrequencyLabel(frequency: string): string {
  const labels: Record<string, string> = {
    DAILY: 'Daily',
    WEEKLY: 'Weekly',
    BIWEEKLY: 'Every 2 weeks',
    MONTHLY: 'Monthly',
    MANUAL: 'Manual only',
  };
  return labels[frequency] ?? frequency;
}

/**
 * Get day of week name
 */
export function getDayOfWeekName(day: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[day] ?? '';
}

/**
 * Get ordinal suffix for a day of the month (e.g., 1st, 2nd, 3rd, 4th)
 */
export function getDaySuffix(day: number): string {
  if (day > 3 && day < 21) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

// Re-export types
export type {
  BalanceSummary,
  PayoutResponse,
  PayoutPreviewResponse,
  PayoutListResponse,
  PayoutSchedule,
  RequestPayoutParams,
  InstantPayoutParams,
  UpdateScheduleParams,
  PayoutStatus,
  PayoutMethod,
  SupportedCurrency,
  ExchangeRate,
} from '@/lib/api/payouts';
