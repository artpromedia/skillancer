/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

/**
 * useProposals Hooks
 *
 * TanStack Query hooks for fetching and managing freelancer proposals.
 * Includes hooks for listing, details, stats, and mutations.
 */

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  getMyProposals,
  getProposalDetails,
  getFreelancerProposalStats,
  updateProposal,
  withdrawProposal,
  boostProposal,
  type Proposal,
  type ProposalListResponse,
  type ProposalFilters,
  type ProposalSortBy,
  type ProposalUpdate,
  type FreelancerProposalStats,
  type BoostOptions,
} from '@/lib/api/bids';

// ============================================================================
// Query Keys
// ============================================================================

export const proposalQueryKeys = {
  all: ['proposals'] as const,
  lists: () => [...proposalQueryKeys.all, 'list'] as const,
  list: (filters?: ProposalFilters, sortBy?: ProposalSortBy) =>
    [...proposalQueryKeys.lists(), { filters, sortBy }] as const,
  details: () => [...proposalQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...proposalQueryKeys.details(), id] as const,
  stats: () => [...proposalQueryKeys.all, 'stats'] as const,
};

// ============================================================================
// Types
// ============================================================================

export interface UseMyProposalsOptions {
  filters?: ProposalFilters;
  sortBy?: ProposalSortBy;
  pageSize?: number;
  enabled?: boolean;
}

export interface UseMyProposalsReturn {
  proposals: Proposal[];
  total: number;
  stats: ProposalListResponse['stats'] | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  hasMore: boolean;
  error: Error | null;
  loadMore: () => void;
  refetch: () => Promise<void>;
}

export interface UseProposalOptions {
  enabled?: boolean;
}

export interface UseProposalReturn {
  proposal: Proposal | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface UseProposalStatsReturn {
  stats: FreelancerProposalStats | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface UseUpdateProposalOptions {
  onSuccess?: (proposal: Proposal) => void;
  onError?: (error: Error) => void;
}

export interface UseWithdrawProposalOptions {
  onSuccess?: (proposal: Proposal) => void;
  onError?: (error: Error) => void;
}

export interface UseBoostProposalOptions {
  onSuccess?: (result: { proposal: Proposal; transaction: { id: string; amount: number } }) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch freelancer's proposals with pagination and filtering
 *
 * @example
 * ```tsx
 * const { proposals, isLoading, hasMore, loadMore } = useMyProposals({
 *   filters: { status: 'SUBMITTED' },
 *   sortBy: 'newest',
 * });
 * ```
 */
export function useMyProposals(options: UseMyProposalsOptions = {}): UseMyProposalsReturn {
  const { filters, sortBy = 'newest', pageSize = 20, enabled = true } = options;

  const query = useInfiniteQuery<ProposalListResponse, Error>({
    queryKey: proposalQueryKeys.list(filters, sortBy),
    queryFn: ({ pageParam = 1 }) => {
      return getMyProposals(filters, sortBy, pageParam as number, pageSize);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const proposals = useMemo(() => {
    return query.data?.pages.flatMap((page) => page.proposals) ?? [];
  }, [query.data]);

  const total = query.data?.pages[0]?.total ?? 0;
  const stats = query.data?.pages[0]?.stats;

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [query]);

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    proposals,
    total,
    stats,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasMore: !!query.hasNextPage,
    error: query.error,
    loadMore,
    refetch,
  };
}

/**
 * Hook to fetch a single proposal by ID
 *
 * @example
 * ```tsx
 * const { proposal, isLoading, error } = useProposal('proposal-123');
 * ```
 */
export function useProposal(
  proposalId: string,
  options: UseProposalOptions = {}
): UseProposalReturn {
  const { enabled = true } = options;

  const query = useQuery<Proposal, Error>({
    queryKey: proposalQueryKeys.detail(proposalId),
    queryFn: () => getProposalDetails(proposalId),
    enabled: enabled && !!proposalId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    proposal: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
  };
}

/**
 * Hook to fetch freelancer's overall proposal statistics
 *
 * @example
 * ```tsx
 * const { stats, isLoading } = useProposalStats();
 * if (stats) {
 *   console.log(`Win rate: ${stats.winRate}%`);
 * }
 * ```
 */
export function useProposalStats(enabled = true): UseProposalStatsReturn {
  const query = useQuery<FreelancerProposalStats, Error>({
    queryKey: proposalQueryKeys.stats(),
    queryFn: getFreelancerProposalStats,
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    stats: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  };
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook for updating a proposal (cover letter, rate, etc.)
 *
 * @example
 * ```tsx
 * const { updateProposal, isUpdating } = useUpdateProposal({
 *   onSuccess: () => toast.success('Proposal updated!'),
 * });
 *
 * updateProposal({ proposalId: 'p-123', data: { bidAmount: 5000 } });
 * ```
 */
export function useUpdateProposal(options: UseUpdateProposalOptions = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<Proposal, Error, { proposalId: string; data: ProposalUpdate }>({
    mutationFn: ({ proposalId, data }) => updateProposal(proposalId, data),
    onSuccess: (proposal) => {
      // Update the detail cache
      queryClient.setQueryData(proposalQueryKeys.detail(proposal.id), proposal);
      // Invalidate list to refetch
      void queryClient.invalidateQueries({ queryKey: proposalQueryKeys.lists() });
      onSuccess?.(proposal);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    updateProposal: mutation.mutate,
    updateProposalAsync: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * Hook for withdrawing a proposal
 *
 * @example
 * ```tsx
 * const { withdrawProposal, isWithdrawing } = useWithdrawProposal({
 *   onSuccess: () => router.push('/dashboard/proposals'),
 * });
 *
 * withdrawProposal('proposal-123');
 * ```
 */
export function useWithdrawProposal(options: UseWithdrawProposalOptions = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<Proposal, Error, string>({
    mutationFn: withdrawProposal,
    onSuccess: (proposal) => {
      // Update the detail cache with withdrawn status
      queryClient.setQueryData(proposalQueryKeys.detail(proposal.id), proposal);
      // Invalidate list to refetch
      void queryClient.invalidateQueries({ queryKey: proposalQueryKeys.lists() });
      // Invalidate stats
      void queryClient.invalidateQueries({ queryKey: proposalQueryKeys.stats() });
      onSuccess?.(proposal);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    withdrawProposal: mutation.mutate,
    withdrawProposalAsync: mutation.mutateAsync,
    isWithdrawing: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * Hook for boosting a proposal
 *
 * @example
 * ```tsx
 * const { boostProposal, isBoosting } = useBoostProposal({
 *   onSuccess: (result) => toast.success(`Boosted! Position improved.`),
 * });
 *
 * boostProposal({ proposalId: 'p-123', options: 'PREMIUM' });
 * ```
 */
export function useBoostProposal(options: UseBoostProposalOptions = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<
    { proposal: Proposal; transaction: { id: string; amount: number } },
    Error,
    { proposalId: string; options: BoostOptions }
  >({
    mutationFn: ({ proposalId, options: boostOpts }) => boostProposal(proposalId, boostOpts),
    onSuccess: (result) => {
      // Update the detail cache
      queryClient.setQueryData(proposalQueryKeys.detail(result.proposal.id), result.proposal);
      // Invalidate list to refetch
      void queryClient.invalidateQueries({ queryKey: proposalQueryKeys.lists() });
      onSuccess?.(result);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    boostProposal: mutation.mutate,
    boostProposalAsync: mutation.mutateAsync,
    isBoosting: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

// ============================================================================
// Combined Hook
// ============================================================================

/**
 * Combined hook for all proposal mutations
 *
 * @example
 * ```tsx
 * const { updateProposal, withdrawProposal, boostProposal, isAnyLoading } = useProposalMutations();
 * ```
 */
export function useProposalMutations(
  options: {
    onUpdate?: (proposal: Proposal) => void;
    onWithdraw?: (proposal: Proposal) => void;
    onBoost?: (result: { proposal: Proposal; transaction: { id: string; amount: number } }) => void;
    onError?: (error: Error) => void;
  } = {}
) {
  const update = useUpdateProposal({
    onSuccess: options.onUpdate,
    onError: options.onError,
  });

  const withdraw = useWithdrawProposal({
    onSuccess: options.onWithdraw,
    onError: options.onError,
  });

  const boost = useBoostProposal({
    onSuccess: options.onBoost,
    onError: options.onError,
  });

  return {
    // Update
    updateProposal: update.updateProposal,
    updateProposalAsync: update.updateProposalAsync,
    isUpdating: update.isUpdating,

    // Withdraw
    withdrawProposal: withdraw.withdrawProposal,
    withdrawProposalAsync: withdraw.withdrawProposalAsync,
    isWithdrawing: withdraw.isWithdrawing,

    // Boost
    boostProposal: boost.boostProposal,
    boostProposalAsync: boost.boostProposalAsync,
    isBoosting: boost.isBoosting,

    // Combined state
    isAnyLoading: update.isUpdating || withdraw.isWithdrawing || boost.isBoosting,
  };
}
