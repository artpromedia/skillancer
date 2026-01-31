/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

/**
 * useClientProposals Hooks
 *
 * TanStack Query hooks for client-side proposal management.
 * Handles fetching proposals for jobs and client actions (shortlist, decline, hire).
 */

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  getProposalsForJob,
  getClientProposalStats,
  shortlistProposal,
  unshortlistProposal,
  archiveProposal,
  unarchiveProposal,
  declineProposal,
  hireFreelancer,
  proposeInterviewTimes,
  subscribeToJobProposals,
  type Proposal,
  type ProposalListResponse,
  type ProposalFilters,
  type ProposalSortBy,
  type ClientProposalStats,
  type Contract,
  type HireData,
  type JobProposalEvent,
} from '@/lib/api/bids';

// ============================================================================
// Query Keys
// ============================================================================

export const clientProposalQueryKeys = {
  all: ['client-proposals'] as const,
  lists: () => [...clientProposalQueryKeys.all, 'list'] as const,
  list: (jobId: string, filters?: ProposalFilters, sortBy?: ProposalSortBy) =>
    [...clientProposalQueryKeys.lists(), jobId, { filters, sortBy }] as const,
  details: () => [...clientProposalQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...clientProposalQueryKeys.details(), id] as const,
  stats: (jobId: string) => [...clientProposalQueryKeys.all, 'stats', jobId] as const,
};

// ============================================================================
// Types
// ============================================================================

export interface UseJobProposalsOptions {
  jobId: string;
  filters?: ProposalFilters;
  sortBy?: ProposalSortBy;
  pageSize?: number;
  enabled?: boolean;
}

export interface UseJobProposalsReturn {
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

export interface UseClientProposalStatsReturn {
  stats: ClientProposalStats | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface UseMutationOptions<TData = void> {
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch proposals for a specific job (client view)
 *
 * @example
 * ```tsx
 * const { proposals, isLoading, hasMore, loadMore } = useJobProposals({
 *   jobId: 'job-123',
 *   sortBy: 'match_score',
 * });
 * ```
 */
export function useJobProposals(options: UseJobProposalsOptions): UseJobProposalsReturn {
  const { jobId, filters, sortBy = 'match_score', pageSize = 20, enabled = true } = options;

  const query = useInfiniteQuery<ProposalListResponse, Error>({
    queryKey: clientProposalQueryKeys.list(jobId, filters, sortBy),
    queryFn: ({ pageParam = 1 }) => {
      return getProposalsForJob(jobId, filters, sortBy, pageParam as number, pageSize);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    enabled: enabled && !!jobId,
    staleTime: 60 * 1000, // 1 minute - proposals change frequently
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
 * Hook to fetch client's proposal statistics for a job
 *
 * @example
 * ```tsx
 * const { stats, isLoading } = useClientProposalStats('job-123');
 * if (stats) {
 *   console.log(`Average bid: ${stats.averageBid}`);
 * }
 * ```
 */
export function useClientProposalStats(
  jobId: string,
  enabled = true
): UseClientProposalStatsReturn {
  const query = useQuery<ClientProposalStats, Error>({
    queryKey: clientProposalQueryKeys.stats(jobId),
    queryFn: () => getClientProposalStats(jobId),
    enabled: enabled && !!jobId,
    staleTime: 2 * 60 * 1000, // 2 minutes
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
 * Hook for shortlisting a proposal
 *
 * @example
 * ```tsx
 * const { shortlist, isShortlisting } = useShortlistProposal({
 *   onSuccess: () => toast.success('Added to shortlist!'),
 * });
 *
 * shortlist('proposal-123');
 * ```
 */
export function useShortlistProposal(options: UseMutationOptions<Proposal> = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<Proposal, Error, string>({
    mutationFn: shortlistProposal,
    onSuccess: (proposal) => {
      // Invalidate all proposal lists
      void queryClient.invalidateQueries({ queryKey: clientProposalQueryKeys.lists() });
      onSuccess?.(proposal);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    shortlist: mutation.mutate,
    shortlistAsync: mutation.mutateAsync,
    isShortlisting: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * Hook for removing a proposal from shortlist
 */
export function useUnshortlistProposal(options: UseMutationOptions<Proposal> = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<Proposal, Error, string>({
    mutationFn: unshortlistProposal,
    onSuccess: (proposal) => {
      void queryClient.invalidateQueries({ queryKey: clientProposalQueryKeys.lists() });
      onSuccess?.(proposal);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    unshortlist: mutation.mutate,
    unshortlistAsync: mutation.mutateAsync,
    isUnshortlisting: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * Hook for archiving a proposal
 */
export function useArchiveProposal(options: UseMutationOptions<Proposal> = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<Proposal, Error, string>({
    mutationFn: archiveProposal,
    onSuccess: (proposal) => {
      void queryClient.invalidateQueries({ queryKey: clientProposalQueryKeys.lists() });
      onSuccess?.(proposal);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    archive: mutation.mutate,
    archiveAsync: mutation.mutateAsync,
    isArchiving: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * Hook for unarchiving a proposal
 */
export function useUnarchiveProposal(options: UseMutationOptions<Proposal> = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<Proposal, Error, string>({
    mutationFn: unarchiveProposal,
    onSuccess: (proposal) => {
      void queryClient.invalidateQueries({ queryKey: clientProposalQueryKeys.lists() });
      onSuccess?.(proposal);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    unarchive: mutation.mutate,
    unarchiveAsync: mutation.mutateAsync,
    isUnarchiving: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * Hook for declining (rejecting) a proposal
 *
 * @example
 * ```tsx
 * const { decline, isDeclining } = useDeclineProposal({
 *   onSuccess: () => toast.success('Proposal declined'),
 * });
 *
 * decline({ proposalId: 'p-123', reason: 'Found a better match' });
 * ```
 */
export function useDeclineProposal(options: UseMutationOptions<Proposal> = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<Proposal, Error, { proposalId: string; reason?: string }>({
    mutationFn: ({ proposalId, reason }) => declineProposal(proposalId, reason),
    onSuccess: (proposal) => {
      void queryClient.invalidateQueries({ queryKey: clientProposalQueryKeys.lists() });
      onSuccess?.(proposal);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    decline: mutation.mutate,
    declineAsync: mutation.mutateAsync,
    isDeclining: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * Hook for accepting a proposal and creating a contract (hiring)
 *
 * @example
 * ```tsx
 * const { accept, isAccepting } = useAcceptProposal({
 *   onSuccess: (contract) => router.push(`/contracts/${contract.id}`),
 * });
 *
 * accept({ proposalId: 'p-123', totalAmount: 5000 });
 * ```
 */
export function useAcceptProposal(options: UseMutationOptions<Contract> = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<Contract, Error, HireData>({
    mutationFn: (data: HireData) => hireFreelancer(data),
    onSuccess: (contract) => {
      // Invalidate proposals list
      void queryClient.invalidateQueries({ queryKey: clientProposalQueryKeys.lists() });
      // Also invalidate client jobs as proposal count may change
      void queryClient.invalidateQueries({ queryKey: ['client-jobs'] });
      onSuccess?.(contract);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    accept: mutation.mutate,
    acceptAsync: mutation.mutateAsync,
    isAccepting: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * Hook for scheduling an interview
 */
export function useScheduleInterview(options: UseMutationOptions = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<
    unknown,
    Error,
    {
      proposalId: string;
      slots: { startTime: string; endTime: string }[];
      timezone: string;
      notes?: string;
    }
  >({
    mutationFn: ({ proposalId, slots, timezone, notes }) =>
      proposeInterviewTimes(proposalId, slots, timezone, notes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientProposalQueryKeys.lists() });
      onSuccess?.();
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    scheduleInterview: mutation.mutate,
    scheduleInterviewAsync: mutation.mutateAsync,
    isScheduling: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

// ============================================================================
// Combined Mutations Hook
// ============================================================================

/**
 * Combined hook for all client proposal mutations
 *
 * @example
 * ```tsx
 * const { shortlist, decline, accept, isAnyLoading } = useClientProposalMutations({
 *   jobId: 'job-123',
 * });
 * ```
 */
export function useClientProposalMutations(
  options: {
    jobId?: string;
    onShortlist?: (proposal: Proposal) => void;
    onDecline?: (proposal: Proposal) => void;
    onAccept?: (contract: Contract) => void;
    onArchive?: (proposal: Proposal) => void;
    onError?: (error: Error) => void;
  } = {}
) {
  const shortlistMutation = useShortlistProposal({
    onSuccess: options.onShortlist,
    onError: options.onError,
  });

  const unshortlistMutation = useUnshortlistProposal({
    onError: options.onError,
  });

  const declineMutation = useDeclineProposal({
    onSuccess: options.onDecline,
    onError: options.onError,
  });

  const acceptMutation = useAcceptProposal({
    onSuccess: options.onAccept,
    onError: options.onError,
  });

  const archiveMutation = useArchiveProposal({
    onSuccess: options.onArchive,
    onError: options.onError,
  });

  const unarchiveMutation = useUnarchiveProposal({
    onError: options.onError,
  });

  return {
    // Shortlist
    shortlist: shortlistMutation.shortlist,
    shortlistAsync: shortlistMutation.shortlistAsync,
    isShortlisting: shortlistMutation.isShortlisting,

    // Unshortlist
    unshortlist: unshortlistMutation.unshortlist,
    unshortlistAsync: unshortlistMutation.unshortlistAsync,
    isUnshortlisting: unshortlistMutation.isUnshortlisting,

    // Decline
    decline: declineMutation.decline,
    declineAsync: declineMutation.declineAsync,
    isDeclining: declineMutation.isDeclining,

    // Accept
    accept: acceptMutation.accept,
    acceptAsync: acceptMutation.acceptAsync,
    isAccepting: acceptMutation.isAccepting,

    // Archive
    archive: archiveMutation.archive,
    archiveAsync: archiveMutation.archiveAsync,
    isArchiving: archiveMutation.isArchiving,

    // Unarchive
    unarchive: unarchiveMutation.unarchive,
    unarchiveAsync: unarchiveMutation.unarchiveAsync,
    isUnarchiving: unarchiveMutation.isUnarchiving,

    // Combined state
    isAnyLoading:
      shortlistMutation.isShortlisting ||
      unshortlistMutation.isUnshortlisting ||
      declineMutation.isDeclining ||
      acceptMutation.isAccepting ||
      archiveMutation.isArchiving ||
      unarchiveMutation.isUnarchiving,
  };
}

// ============================================================================
// Real-time Updates Hook
// ============================================================================

/**
 * Hook for subscribing to real-time proposal updates for a job
 *
 * @example
 * ```tsx
 * const { newProposalCount } = useJobProposalSubscription({
 *   jobId: 'job-123',
 *   onNewProposal: (proposal) => {
 *     toast.info(`New proposal from ${proposal.freelancer.name}`);
 *   },
 * });
 * ```
 */
export function useJobProposalSubscription(options: {
  jobId: string;
  enabled?: boolean;
  onNewProposal?: (proposal: Proposal) => void;
  onProposalUpdated?: (proposal: Proposal) => void;
  onProposalWithdrawn?: (proposalId: string) => void;
}) {
  const { jobId, enabled = true, onNewProposal, onProposalUpdated, onProposalWithdrawn } = options;
  const queryClient = useQueryClient();
  const newProposalCountRef = useRef(0);

  useEffect(() => {
    if (!enabled || !jobId) return;

    const unsubscribe = subscribeToJobProposals(jobId, (event: JobProposalEvent) => {
      switch (event.type) {
        case 'NEW_PROPOSAL':
          newProposalCountRef.current += 1;
          // Invalidate the proposals list to refetch
          void queryClient.invalidateQueries({
            queryKey: clientProposalQueryKeys.list(jobId),
          });
          // Also invalidate stats
          void queryClient.invalidateQueries({
            queryKey: clientProposalQueryKeys.stats(jobId),
          });
          onNewProposal?.(event.proposal);
          break;

        case 'PROPOSAL_UPDATED':
          void queryClient.invalidateQueries({
            queryKey: clientProposalQueryKeys.list(jobId),
          });
          onProposalUpdated?.(event.proposal);
          break;

        case 'PROPOSAL_WITHDRAWN':
          void queryClient.invalidateQueries({
            queryKey: clientProposalQueryKeys.list(jobId),
          });
          void queryClient.invalidateQueries({
            queryKey: clientProposalQueryKeys.stats(jobId),
          });
          onProposalWithdrawn?.(event.proposalId);
          break;
      }
    });

    return unsubscribe;
  }, [jobId, enabled, queryClient, onNewProposal, onProposalUpdated, onProposalWithdrawn]);

  const resetNewProposalCount = useCallback(() => {
    newProposalCountRef.current = 0;
  }, []);

  return {
    newProposalCount: newProposalCountRef.current,
    resetNewProposalCount,
  };
}
