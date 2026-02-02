/**
 * Payment Management Hooks
 *
 * React Query hooks for payment management in the admin panel.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';

import {
  paymentsService,
  type Payment,
  type PaymentFilters,
  type Payout,
  type PayoutFilters,
  type Refund,
  type RefundFilters,
  type PaymentStats,
  type PayoutStats,
} from '../../lib/api/services/payments';

import type { ApiResponse, PaginatedResponse } from '@skillancer/shared-api-client';

// =============================================================================
// Query Keys
// =============================================================================

export const paymentKeys = {
  all: ['admin', 'payments'] as const,
  lists: () => [...paymentKeys.all, 'list'] as const,
  list: (filters: PaymentFilters) => [...paymentKeys.lists(), filters] as const,
  details: () => [...paymentKeys.all, 'detail'] as const,
  detail: (id: string) => [...paymentKeys.details(), id] as const,
  stats: () => [...paymentKeys.all, 'stats'] as const,
  revenue: () => [...paymentKeys.all, 'revenue'] as const,
};

export const payoutKeys = {
  all: ['admin', 'payouts'] as const,
  lists: () => [...payoutKeys.all, 'list'] as const,
  list: (filters: PayoutFilters) => [...payoutKeys.lists(), filters] as const,
  details: () => [...payoutKeys.all, 'detail'] as const,
  detail: (id: string) => [...payoutKeys.details(), id] as const,
  stats: () => [...payoutKeys.all, 'stats'] as const,
};

export const refundKeys = {
  all: ['admin', 'refunds'] as const,
  lists: () => [...refundKeys.all, 'list'] as const,
  list: (filters: RefundFilters) => [...refundKeys.lists(), filters] as const,
  details: () => [...refundKeys.all, 'detail'] as const,
  detail: (id: string) => [...refundKeys.details(), id] as const,
};

export const escrowKeys = {
  all: ['admin', 'escrow'] as const,
  balance: (projectId: string) => [...escrowKeys.all, 'balance', projectId] as const,
};

// =============================================================================
// Payment Query Hooks
// =============================================================================

/**
 * List payments
 */
export function usePayments(
  filters: PaymentFilters = {},
  options?: Omit<UseQueryOptions<PaginatedResponse<Payment>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: paymentKeys.list(filters),
    queryFn: () => paymentsService.listPayments(filters),
    ...options,
  });
}

/**
 * Get payment by ID
 */
export function usePayment(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<Payment>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: paymentKeys.detail(id),
    queryFn: () => paymentsService.getPayment(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Get payment stats
 */
export function usePaymentStats(
  params?: { startDate?: string; endDate?: string },
  options?: Omit<UseQueryOptions<ApiResponse<PaymentStats>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...paymentKeys.stats(), params],
    queryFn: () => paymentsService.getPaymentStats(params),
    ...options,
  });
}

/**
 * Get revenue stats
 */
export function useRevenueStats(
  params?: { startDate?: string; endDate?: string; groupBy?: 'day' | 'week' | 'month' },
  options?: Omit<UseQueryOptions, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...paymentKeys.revenue(), params],
    queryFn: () => paymentsService.getRevenueStats(params),
    ...options,
  });
}

// =============================================================================
// Payment Mutation Hooks
// =============================================================================

/**
 * Retry payment
 */
export function useRetryPayment(options?: UseMutationOptions<ApiResponse<Payment>, Error, string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => paymentsService.retryPayment(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: paymentKeys.lists() });
    },
    ...options,
  });
}

/**
 * Cancel payment
 */
export function useCancelPayment(
  options?: UseMutationOptions<ApiResponse<Payment>, Error, { id: string; reason: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }) => paymentsService.cancelPayment(id, reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: paymentKeys.lists() });
    },
    ...options,
  });
}

/**
 * Mark payment as completed
 */
export function useMarkPaymentCompleted(
  options?: UseMutationOptions<ApiResponse<Payment>, Error, { id: string; externalRef?: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, externalRef }) => paymentsService.markPaymentCompleted(id, externalRef),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: paymentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: paymentKeys.stats() });
    },
    ...options,
  });
}

// =============================================================================
// Refund Query Hooks
// =============================================================================

/**
 * List refunds
 */
export function useRefunds(
  filters: RefundFilters = {},
  options?: Omit<UseQueryOptions<PaginatedResponse<Refund>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: refundKeys.list(filters),
    queryFn: () => paymentsService.listRefunds(filters),
    ...options,
  });
}

/**
 * Get refund by ID
 */
export function useRefund(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<Refund>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: refundKeys.detail(id),
    queryFn: () => paymentsService.getRefund(id),
    enabled: !!id,
    ...options,
  });
}

// =============================================================================
// Refund Mutation Hooks
// =============================================================================

/**
 * Create refund
 */
export function useCreateRefund(
  options?: UseMutationOptions<
    ApiResponse<Refund>,
    Error,
    {
      paymentId: string;
      amount: number;
      reason: string;
      notifyUser?: boolean;
    }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => paymentsService.createRefund(data),
    onSuccess: (_, { paymentId }) => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.detail(paymentId) });
      queryClient.invalidateQueries({ queryKey: refundKeys.lists() });
    },
    ...options,
  });
}

/**
 * Process refund
 */
export function useProcessRefund(options?: UseMutationOptions<ApiResponse<Refund>, Error, string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => paymentsService.processRefund(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: refundKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: refundKeys.lists() });
    },
    ...options,
  });
}

/**
 * Cancel refund
 */
export function useCancelRefund(
  options?: UseMutationOptions<ApiResponse<Refund>, Error, { id: string; reason: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }) => paymentsService.cancelRefund(id, reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: refundKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: refundKeys.lists() });
    },
    ...options,
  });
}

// =============================================================================
// Payout Query Hooks
// =============================================================================

/**
 * List payouts
 */
export function usePayouts(
  filters: PayoutFilters = {},
  options?: Omit<UseQueryOptions<PaginatedResponse<Payout>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: payoutKeys.list(filters),
    queryFn: () => paymentsService.listPayouts(filters),
    ...options,
  });
}

/**
 * Get payout by ID
 */
export function usePayout(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<Payout>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: payoutKeys.detail(id),
    queryFn: () => paymentsService.getPayout(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Get payout stats
 */
export function usePayoutStats(
  params?: { startDate?: string; endDate?: string },
  options?: Omit<UseQueryOptions<ApiResponse<PayoutStats>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...payoutKeys.stats(), params],
    queryFn: () => paymentsService.getPayoutStats(params),
    ...options,
  });
}

// =============================================================================
// Payout Mutation Hooks
// =============================================================================

/**
 * Approve payout
 */
export function useApprovePayout(
  options?: UseMutationOptions<ApiResponse<Payout>, Error, { id: string; note?: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, note }) => paymentsService.approvePayout(id, note),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: payoutKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: payoutKeys.lists() });
    },
    ...options,
  });
}

/**
 * Reject payout
 */
export function useRejectPayout(
  options?: UseMutationOptions<ApiResponse<Payout>, Error, { id: string; reason: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }) => paymentsService.rejectPayout(id, reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: payoutKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: payoutKeys.lists() });
    },
    ...options,
  });
}

/**
 * Hold payout
 */
export function useHoldPayout(
  options?: UseMutationOptions<ApiResponse<Payout>, Error, { id: string; reason: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }) => paymentsService.holdPayout(id, reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: payoutKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: payoutKeys.lists() });
    },
    ...options,
  });
}

/**
 * Release payout hold
 */
export function useReleasePayout(options?: UseMutationOptions<ApiResponse<Payout>, Error, string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => paymentsService.releasePayout(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: payoutKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: payoutKeys.lists() });
    },
    ...options,
  });
}

/**
 * Process payout
 */
export function useProcessPayout(options?: UseMutationOptions<ApiResponse<Payout>, Error, string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => paymentsService.processPayout(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: payoutKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: payoutKeys.lists() });
      queryClient.invalidateQueries({ queryKey: payoutKeys.stats() });
    },
    ...options,
  });
}

/**
 * Bulk approve payouts
 */
export function useBulkApprovePayouts(
  options?: UseMutationOptions<ApiResponse<{ approved: number }>, Error, string[]>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payoutIds: string[]) => paymentsService.bulkApprovePayout(payoutIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payoutKeys.lists() });
    },
    ...options,
  });
}

/**
 * Bulk process payouts
 */
export function useBulkProcessPayouts(
  options?: UseMutationOptions<ApiResponse<{ processed: number; failed: number }>, Error, string[]>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payoutIds: string[]) => paymentsService.bulkProcessPayout(payoutIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payoutKeys.lists() });
      queryClient.invalidateQueries({ queryKey: payoutKeys.stats() });
    },
    ...options,
  });
}

// =============================================================================
// Escrow Hooks
// =============================================================================

/**
 * Get escrow balance
 */
export function useEscrowBalance(
  projectId: string,
  options?: Omit<UseQueryOptions, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: escrowKeys.balance(projectId),
    queryFn: () => paymentsService.getEscrowBalance(projectId),
    enabled: !!projectId,
    ...options,
  });
}

/**
 * Release escrow
 */
export function useReleaseEscrow(
  options?: UseMutationOptions<
    ApiResponse<{ released: number }>,
    Error,
    {
      projectId: string;
      amount: number;
      recipientId: string;
      note?: string;
    }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, ...data }) => paymentsService.releaseEscrow(projectId, data),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: escrowKeys.balance(projectId) });
      queryClient.invalidateQueries({ queryKey: payoutKeys.lists() });
    },
    ...options,
  });
}
