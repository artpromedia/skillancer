/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
'use client';

/**
 * Escrow Hooks
 *
 * TanStack Query hooks for escrow management including funding,
 * releasing, refunding, and fee preview operations.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { contractQueryKeys } from './use-contracts';

import {
  fundEscrow,
  completeFunding,
  releaseEscrow,
  refundEscrow,
  getEscrowFeePreview,
  getEscrowSummary,
  getEscrowBalance,
  type FundEscrowRequest,
  type FundEscrowResponse,
  type ReleaseEscrowRequest,
  type ReleaseEscrowResponse,
  type RefundEscrowRequest,
  type RefundEscrowResponse,
  type EscrowFeePreviewRequest,
  type EscrowFeePreview,
  type EscrowSummary,
  type EscrowBalance,
  type CompleteFundingRequest,
  type CompleteFundingResponse,
} from '@/lib/api/escrow';

// ============================================================================
// Query Keys
// ============================================================================

export const escrowQueryKeys = {
  all: ['escrow'] as const,
  summaries: () => [...escrowQueryKeys.all, 'summary'] as const,
  summary: (contractId: string) => [...escrowQueryKeys.summaries(), contractId] as const,
  balances: () => [...escrowQueryKeys.all, 'balance'] as const,
  balance: (contractId: string) => [...escrowQueryKeys.balances(), contractId] as const,
  fees: () => [...escrowQueryKeys.all, 'fees'] as const,
  feePreview: (request: EscrowFeePreviewRequest) => [...escrowQueryKeys.fees(), request] as const,
};

// ============================================================================
// Types
// ============================================================================

export interface EscrowMutationOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook for fetching escrow summary for a contract
 * Includes balance, transactions, and per-milestone status
 */
export function useEscrowSummary(contractId: string, options?: { enabled?: boolean }) {
  return useQuery<EscrowSummary, Error>({
    queryKey: escrowQueryKeys.summary(contractId),
    queryFn: () => getEscrowSummary(contractId),
    enabled: options?.enabled !== false && Boolean(contractId),
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook for fetching escrow balance for a contract
 */
export function useEscrowBalance(contractId: string, options?: { enabled?: boolean }) {
  return useQuery<EscrowBalance, Error>({
    queryKey: escrowQueryKeys.balance(contractId),
    queryFn: () => getEscrowBalance(contractId),
    enabled: options?.enabled !== false && Boolean(contractId),
    staleTime: 30000,
  });
}

/**
 * Hook for getting fee preview
 * Call with debounce when amount changes
 */
export function useEscrowFeePreview(
  request: EscrowFeePreviewRequest | null,
  options?: { enabled?: boolean }
) {
  return useQuery<EscrowFeePreview, Error>({
    queryKey: escrowQueryKeys.feePreview(request ?? { amount: 0 }),
    queryFn: () => getEscrowFeePreview(request),
    enabled: options?.enabled !== false && Boolean(request) && request.amount > 0,
    staleTime: 60000, // 1 minute
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook for funding escrow
 * Creates a PaymentIntent with manual capture
 */
export function useFundEscrow(
  contractId: string,
  options: EscrowMutationOptions<FundEscrowResponse> = {}
) {
  const queryClient = useQueryClient();
  const { onSuccess, onError, onSettled } = options;

  const mutation = useMutation<FundEscrowResponse, Error, FundEscrowRequest>({
    mutationFn: fundEscrow,
    onSuccess: (data) => {
      // Invalidate escrow and contract queries
      void queryClient.invalidateQueries({ queryKey: escrowQueryKeys.summary(contractId) });
      void queryClient.invalidateQueries({ queryKey: escrowQueryKeys.balance(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.detail(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.milestones(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.payments(contractId) });
      onSuccess?.(data);
    },
    onError: (error) => {
      onError?.(error);
    },
    onSettled: () => {
      onSettled?.();
    },
  });

  return {
    fund: mutation.mutate,
    fundAsync: mutation.mutateAsync,
    isFunding: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}

/**
 * Hook for completing escrow funding after Stripe confirmation
 */
export function useCompleteFunding(
  contractId: string,
  options: EscrowMutationOptions<CompleteFundingResponse> = {}
) {
  const queryClient = useQueryClient();
  const { onSuccess, onError, onSettled } = options;

  const mutation = useMutation<CompleteFundingResponse, Error, CompleteFundingRequest>({
    mutationFn: completeFunding,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: escrowQueryKeys.summary(contractId) });
      void queryClient.invalidateQueries({ queryKey: escrowQueryKeys.balance(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.detail(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.milestones(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.payments(contractId) });
      onSuccess?.(data);
    },
    onError: (error) => {
      onError?.(error);
    },
    onSettled: () => {
      onSettled?.();
    },
  });

  return {
    complete: mutation.mutate,
    completeAsync: mutation.mutateAsync,
    isCompleting: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}

/**
 * Hook for releasing escrow funds to freelancer
 */
export function useReleaseEscrow(
  contractId: string,
  options: EscrowMutationOptions<ReleaseEscrowResponse> = {}
) {
  const queryClient = useQueryClient();
  const { onSuccess, onError, onSettled } = options;

  const mutation = useMutation<ReleaseEscrowResponse, Error, ReleaseEscrowRequest>({
    mutationFn: releaseEscrow,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: escrowQueryKeys.summary(contractId) });
      void queryClient.invalidateQueries({ queryKey: escrowQueryKeys.balance(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.detail(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.milestones(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.payments(contractId) });
      onSuccess?.(data);
    },
    onError: (error) => {
      onError?.(error);
    },
    onSettled: () => {
      onSettled?.();
    },
  });

  return {
    release: mutation.mutate,
    releaseAsync: mutation.mutateAsync,
    isReleasing: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}

/**
 * Hook for refunding escrow funds to client
 */
export function useRefundEscrow(
  contractId: string,
  options: EscrowMutationOptions<RefundEscrowResponse> = {}
) {
  const queryClient = useQueryClient();
  const { onSuccess, onError, onSettled } = options;

  const mutation = useMutation<RefundEscrowResponse, Error, RefundEscrowRequest>({
    mutationFn: refundEscrow,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: escrowQueryKeys.summary(contractId) });
      void queryClient.invalidateQueries({ queryKey: escrowQueryKeys.balance(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.detail(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.milestones(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.payments(contractId) });
      onSuccess?.(data);
    },
    onError: (error) => {
      onError?.(error);
    },
    onSettled: () => {
      onSettled?.();
    },
  });

  return {
    refund: mutation.mutate,
    refundAsync: mutation.mutateAsync,
    isRefunding: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}

// ============================================================================
// Combined Hook
// ============================================================================

export interface UseEscrowOptions {
  onFundSuccess?: (data: FundEscrowResponse) => void;
  onReleaseSuccess?: (data: ReleaseEscrowResponse) => void;
  onRefundSuccess?: (data: RefundEscrowResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * Combined hook for all escrow operations on a contract
 * Provides summary, balance, and all mutation functions
 */
export function useEscrow(contractId: string, options: UseEscrowOptions = {}) {
  const { onFundSuccess, onReleaseSuccess, onRefundSuccess, onError } = options;

  // Queries
  const summaryQuery = useEscrowSummary(contractId);
  const balanceQuery = useEscrowBalance(contractId);

  // Mutations
  const fundMutation = useFundEscrow(contractId, {
    onSuccess: onFundSuccess,
    onError,
  });
  const completeMutation = useCompleteFunding(contractId, {
    onError,
  });
  const releaseMutation = useReleaseEscrow(contractId, {
    onSuccess: onReleaseSuccess,
    onError,
  });
  const refundMutation = useRefundEscrow(contractId, {
    onSuccess: onRefundSuccess,
    onError,
  });

  // Computed values
  const isLoading = summaryQuery.isLoading || balanceQuery.isLoading;
  const isMutating =
    fundMutation.isFunding ||
    completeMutation.isCompleting ||
    releaseMutation.isReleasing ||
    refundMutation.isRefunding;

  // Helper to get milestone escrow status
  const getMilestoneStatus = useCallback(
    (milestoneId: string) => {
      return summaryQuery.data?.milestoneEscrowStatus.find((m) => m.milestoneId === milestoneId);
    },
    [summaryQuery.data]
  );

  return {
    // Query data
    summary: summaryQuery.data,
    balance: balanceQuery.data ?? summaryQuery.data?.balance,
    transactions: summaryQuery.data?.transactions ?? [],

    // Query states
    isLoading,
    isError: summaryQuery.isError || balanceQuery.isError,
    error: summaryQuery.error || balanceQuery.error,

    // Mutation states
    isMutating,

    // Mutations
    fund: fundMutation.fund,
    fundAsync: fundMutation.fundAsync,
    isFunding: fundMutation.isFunding,
    fundError: fundMutation.error,

    complete: completeMutation.complete,
    completeAsync: completeMutation.completeAsync,
    isCompleting: completeMutation.isCompleting,

    release: releaseMutation.release,
    releaseAsync: releaseMutation.releaseAsync,
    isReleasing: releaseMutation.isReleasing,
    releaseError: releaseMutation.error,

    refund: refundMutation.refund,
    refundAsync: refundMutation.refundAsync,
    isRefunding: refundMutation.isRefunding,
    refundError: refundMutation.error,

    // Helpers
    getMilestoneStatus,
    refetch: () => {
      void summaryQuery.refetch();
      void balanceQuery.refetch();
    },
  };
}

// ============================================================================
// Fund Milestone Hook with Stripe Integration
// ============================================================================

export interface UseFundMilestoneWithStripeOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for funding a milestone with Stripe payment flow
 * Handles the complete flow: create PaymentIntent -> confirm -> complete
 */
export function useFundMilestoneWithStripe(
  contractId: string,
  options: UseFundMilestoneWithStripeOptions = {}
) {
  const { onSuccess, onError } = options;
  const [step, setStep] = useState<
    'idle' | 'creating' | 'confirming' | 'completing' | 'done' | 'error'
  >('idle');
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const fundMutation = useFundEscrow(contractId, {
    onSuccess: (data) => {
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setStep('confirming');
      } else {
        // Payment succeeded without additional confirmation needed
        setStep('done');
        onSuccess?.();
      }
    },
    onError: (error) => {
      setStep('error');
      onError?.(error);
    },
  });

  const completeMutation = useCompleteFunding(contractId, {
    onSuccess: () => {
      setStep('done');
      setClientSecret(null);
      onSuccess?.();
    },
    onError: (error) => {
      setStep('error');
      onError?.(error);
    },
  });

  // Start funding process
  const startFunding = useCallback(
    (request: FundEscrowRequest) => {
      setStep('creating');
      fundMutation.fund(request);
    },
    [fundMutation]
  );

  // Complete funding after Stripe confirmation
  const confirmAndComplete = useCallback(
    (paymentIntentId: string) => {
      setStep('completing');
      completeMutation.complete({ paymentIntentId });
    },
    [completeMutation]
  );

  // Reset state
  const reset = useCallback(() => {
    setStep('idle');
    setClientSecret(null);
    fundMutation.reset();
    completeMutation.reset();
  }, [fundMutation, completeMutation]);

  return {
    step,
    clientSecret,
    startFunding,
    confirmAndComplete,
    reset,
    isProcessing: step === 'creating' || step === 'confirming' || step === 'completing',
    error: fundMutation.error || completeMutation.error,
  };
}

// ============================================================================
// Re-export Types from API module
// ============================================================================

export type {
  FundEscrowRequest,
  FundEscrowResponse,
  ReleaseEscrowRequest,
  ReleaseEscrowResponse,
  RefundEscrowRequest,
  RefundEscrowResponse,
  EscrowFeePreviewRequest,
  EscrowFeePreview,
  EscrowSummary,
  EscrowBalance,
  EscrowTransaction,
} from '@/lib/api/escrow';
