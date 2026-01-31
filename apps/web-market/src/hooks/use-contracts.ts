/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
'use client';

/**
 * Contracts Hooks
 *
 * TanStack Query hooks for contract management including listing,
 * fetching details, and performing contract operations.
 */

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  getContracts,
  getContractById,
  signContract,
  pauseContract,
  resumeContract,
  endContract,
  getContractPayments,
  getMilestones,
  submitMilestone,
  approveMilestone,
  requestRevision,
  fundMilestone,
  releaseMilestonePayment,
  getTimeEntries,
  addTimeEntry,
  getContractStats,
  type Contract,
  type ContractFilters,
  type ContractStatus,
  type PaginatedResponse,
  type SignContractData,
  type PaymentInfo,
  type Milestone,
  type TimeEntry,
  type SubmitMilestoneData,
  type AddTimeEntryData,
} from '@/lib/api/contracts';

// ============================================================================
// Query Keys
// ============================================================================

export const contractQueryKeys = {
  all: ['contracts'] as const,
  lists: () => [...contractQueryKeys.all, 'list'] as const,
  list: (filters?: ContractFilters) => [...contractQueryKeys.lists(), filters] as const,
  infinite: (filters?: ContractFilters) => [...contractQueryKeys.all, 'infinite', filters] as const,
  details: () => [...contractQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...contractQueryKeys.details(), id] as const,
  payments: (id: string) => [...contractQueryKeys.detail(id), 'payments'] as const,
  milestones: (id: string) => [...contractQueryKeys.detail(id), 'milestones'] as const,
  timeEntries: (id: string, date?: string) =>
    [...contractQueryKeys.detail(id), 'timeEntries', date] as const,
  stats: () => [...contractQueryKeys.all, 'stats'] as const,
} as const;

// ============================================================================
// Types
// ============================================================================

export interface UseMyContractsOptions {
  status?: ContractStatus | ContractStatus[];
  type?: 'FIXED' | 'HOURLY';
  role?: 'CLIENT' | 'FREELANCER';
  search?: string;
  sortBy?: 'startDate' | 'value' | 'status' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  pageSize?: number;
  enabled?: boolean;
}

export interface UseContractOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

export interface ContractSummary {
  totalActive: number;
  totalEarnings: number;
  totalHoursThisWeek: number;
  pendingMilestones: number;
  escrowBalance: number;
  completedContracts: number;
}

export interface ContractMutationOptions<T = void> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch paginated list of user's contracts
 *
 * @example
 * ```tsx
 * const { contracts, isLoading, hasMore, loadMore } = useMyContracts({
 *   status: 'ACTIVE',
 *   role: 'FREELANCER',
 * });
 * ```
 */
export function useMyContracts(options: UseMyContractsOptions = {}) {
  const {
    status,
    type,
    role,
    search,
    sortBy = 'updatedAt',
    sortOrder = 'desc',
    pageSize = 20,
    enabled = true,
  } = options;

  const filters: ContractFilters = {
    status,
    type,
    role,
    search,
    sortBy,
    sortOrder,
  };

  const query = useInfiniteQuery<
    PaginatedResponse<Contract>,
    Error,
    InfiniteData<PaginatedResponse<Contract>>,
    ReturnType<typeof contractQueryKeys.infinite>,
    number
  >({
    queryKey: contractQueryKeys.infinite(filters),
    queryFn: ({ pageParam }) => getContracts(filters, pageParam, pageSize),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  // Flatten paginated results
  const contracts = useMemo(() => {
    return query.data?.pages.flatMap((page) => page.items) ?? [];
  }, [query.data?.pages]);

  // Get total count from first page
  const total = query.data?.pages[0]?.total ?? 0;

  return {
    contracts,
    total,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    error: query.error,
    hasMore: query.hasNextPage ?? false,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) {
        void query.fetchNextPage();
      }
    },
    refetch: query.refetch,
  };
}

/**
 * Hook to fetch a single contract by ID with full details
 *
 * @example
 * ```tsx
 * const { contract, isLoading, error } = useContract(contractId);
 * ```
 */
export function useContract(contractId: string, options: UseContractOptions = {}) {
  const { enabled = true, refetchInterval } = options;

  const query = useQuery<Contract, Error>({
    queryKey: contractQueryKeys.detail(contractId),
    queryFn: () => getContractById(contractId),
    enabled: enabled && !!contractId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchInterval,
  });

  return {
    contract: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook to fetch contract payment information
 *
 * @example
 * ```tsx
 * const { payments, isLoading } = useContractPayments(contractId);
 * ```
 */
export function useContractPayments(contractId: string, options: UseContractOptions = {}) {
  const { enabled = true } = options;

  const query = useQuery<PaymentInfo, Error>({
    queryKey: contractQueryKeys.payments(contractId),
    queryFn: () => getContractPayments(contractId),
    enabled: enabled && !!contractId,
    staleTime: 30_000,
  });

  return {
    payments: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook to fetch contract milestones
 */
export function useContractMilestones(contractId: string, options: UseContractOptions = {}) {
  const { enabled = true } = options;

  const query = useQuery<Milestone[], Error>({
    queryKey: contractQueryKeys.milestones(contractId),
    queryFn: () => getMilestones(contractId),
    enabled: enabled && !!contractId,
    staleTime: 30_000,
  });

  return {
    milestones: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook to fetch time entries for hourly contracts
 */
export function useTimeEntries(
  contractId: string,
  weekStartDate?: string,
  options: UseContractOptions = {}
) {
  const { enabled = true } = options;

  const query = useQuery<TimeEntry[], Error>({
    queryKey: contractQueryKeys.timeEntries(contractId, weekStartDate),
    queryFn: () => getTimeEntries(contractId, weekStartDate),
    enabled: enabled && !!contractId,
    staleTime: 60_000,
  });

  return {
    timeEntries: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook to fetch contract statistics/summary
 *
 * @example
 * ```tsx
 * const { stats, isLoading } = useContractStats();
 * ```
 */
export function useContractStats(options: UseContractOptions = {}) {
  const { enabled = true } = options;

  const query = useQuery<ContractSummary, Error>({
    queryKey: contractQueryKeys.stats(),
    queryFn: getContractStats,
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  return {
    stats: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook for signing a contract
 */
export function useSignContract(
  contractId: string,
  options: ContractMutationOptions<Contract> = {}
) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<Contract, Error, SignContractData>({
    mutationFn: (data) => signContract(contractId, data),
    onSuccess: (contract) => {
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.detail(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.lists() });
      onSuccess?.(contract);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    sign: mutation.mutate,
    signAsync: mutation.mutateAsync,
    isSigning: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/**
 * Hook for pausing a contract
 */
export function usePauseContract(
  contractId: string,
  options: ContractMutationOptions<Contract> = {}
) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<Contract, Error, void>({
    mutationFn: () => pauseContract(contractId),
    onSuccess: (contract) => {
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.detail(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.stats() });
      onSuccess?.(contract);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    pause: mutation.mutate,
    pauseAsync: mutation.mutateAsync,
    isPausing: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/**
 * Hook for resuming a paused contract
 */
export function useResumeContract(
  contractId: string,
  options: ContractMutationOptions<Contract> = {}
) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<Contract, Error, void>({
    mutationFn: () => resumeContract(contractId),
    onSuccess: (contract) => {
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.detail(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.stats() });
      onSuccess?.(contract);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    resume: mutation.mutate,
    resumeAsync: mutation.mutateAsync,
    isResuming: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/**
 * Hook for ending a contract
 */
export function useEndContract(
  contractId: string,
  options: ContractMutationOptions<Contract> = {}
) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<
    Contract,
    Error,
    { reason: string; feedback?: { rating: number; review: string } }
  >({
    mutationFn: (data) => endContract(contractId, data.reason, data.feedback),
    onSuccess: (contract) => {
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.detail(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.stats() });
      onSuccess?.(contract);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    end: mutation.mutate,
    endAsync: mutation.mutateAsync,
    isEnding: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

// ============================================================================
// Milestone Mutation Hooks
// ============================================================================

/**
 * Hook for submitting milestone work
 */
export function useSubmitMilestone(
  contractId: string,
  options: ContractMutationOptions<Milestone> = {}
) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<
    Milestone,
    Error,
    { milestoneId: string; data: SubmitMilestoneData }
  >({
    mutationFn: ({ milestoneId, data }) => submitMilestone(milestoneId, data),
    onSuccess: (milestone) => {
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.detail(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.milestones(contractId) });
      onSuccess?.(milestone);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    submit: mutation.mutate,
    submitAsync: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/**
 * Hook for approving a milestone (client only)
 */
export function useApproveMilestone(
  contractId: string,
  options: ContractMutationOptions<Milestone> = {}
) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<Milestone, Error, { milestoneId: string; bonusAmount?: number }>({
    mutationFn: ({ milestoneId, bonusAmount }) => approveMilestone(milestoneId, bonusAmount),
    onSuccess: (milestone) => {
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.detail(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.milestones(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.payments(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.stats() });
      onSuccess?.(milestone);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    approve: mutation.mutate,
    approveAsync: mutation.mutateAsync,
    isApproving: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/**
 * Hook for requesting milestone revision (client only)
 */
export function useRequestRevision(
  contractId: string,
  options: ContractMutationOptions<Milestone> = {}
) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<Milestone, Error, { milestoneId: string; notes: string }>({
    mutationFn: ({ milestoneId, notes }) => requestRevision(milestoneId, notes),
    onSuccess: (milestone) => {
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.detail(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.milestones(contractId) });
      onSuccess?.(milestone);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    requestRevision: mutation.mutate,
    requestRevisionAsync: mutation.mutateAsync,
    isRequesting: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/**
 * Hook for funding a milestone (client only)
 */
export function useFundMilestone(
  contractId: string,
  options: ContractMutationOptions<Milestone> = {}
) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<Milestone, Error, { milestoneId: string }>({
    mutationFn: ({ milestoneId }) => fundMilestone(milestoneId),
    onSuccess: (milestone) => {
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.detail(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.milestones(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.payments(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.stats() });
      onSuccess?.(milestone);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    fund: mutation.mutate,
    fundAsync: mutation.mutateAsync,
    isFunding: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/**
 * Hook for releasing milestone payment (client only)
 */
export function useReleaseMilestonePayment(
  contractId: string,
  options: ContractMutationOptions<Milestone> = {}
) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<Milestone, Error, string>({
    mutationFn: (milestoneId) => releaseMilestonePayment(milestoneId),
    onSuccess: (milestone) => {
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.detail(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.milestones(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.payments(contractId) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.stats() });
      onSuccess?.(milestone);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    release: mutation.mutate,
    releaseAsync: mutation.mutateAsync,
    isReleasing: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

// ============================================================================
// Time Entry Mutation Hooks
// ============================================================================

/**
 * Hook for adding a time entry
 */
export function useAddTimeEntry(
  contractId: string,
  options: ContractMutationOptions<TimeEntry> = {}
) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<TimeEntry, Error, AddTimeEntryData>({
    mutationFn: (data) => addTimeEntry(contractId, data),
    onSuccess: (entry) => {
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.detail(contractId) });
      void queryClient.invalidateQueries({
        queryKey: contractQueryKeys.timeEntries(contractId),
      });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.stats() });
      onSuccess?.(entry);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    addEntry: mutation.mutate,
    addEntryAsync: mutation.mutateAsync,
    isAdding: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

// ============================================================================
// Combined Mutation Hook
// ============================================================================

export interface UseContractMutationsOptions {
  contractId: string;
  onSign?: (contract: Contract) => void;
  onPause?: (contract: Contract) => void;
  onResume?: (contract: Contract) => void;
  onEnd?: (contract: Contract) => void;
  onSubmitMilestone?: (milestone: Milestone) => void;
  onApproveMilestone?: (milestone: Milestone) => void;
  onRequestRevision?: (milestone: Milestone) => void;
  onFundMilestone?: (milestone: Milestone) => void;
  onReleaseMilestonePayment?: (milestone: Milestone) => void;
  onAddTimeEntry?: (entry: TimeEntry) => void;
  onError?: (error: Error) => void;
}

/**
 * Combined hook for all contract mutations
 *
 * @example
 * ```tsx
 * const {
 *   sign, pause, resume, end,
 *   submitMilestone, approveMilestone, fundMilestone, releaseMilestonePayment,
 *   addTimeEntry,
 *   isAnyPending
 * } = useContractMutations({ contractId, onError: console.error });
 * ```
 */
export function useContractMutations(options: UseContractMutationsOptions) {
  const {
    contractId,
    onSign,
    onPause,
    onResume,
    onEnd,
    onSubmitMilestone,
    onApproveMilestone,
    onRequestRevision,
    onFundMilestone,
    onReleaseMilestonePayment,
    onAddTimeEntry,
    onError,
  } = options;

  const signHook = useSignContract(contractId, { onSuccess: onSign, onError });
  const pauseHook = usePauseContract(contractId, { onSuccess: onPause, onError });
  const resumeHook = useResumeContract(contractId, { onSuccess: onResume, onError });
  const endHook = useEndContract(contractId, { onSuccess: onEnd, onError });
  const submitMilestoneHook = useSubmitMilestone(contractId, {
    onSuccess: onSubmitMilestone,
    onError,
  });
  const approveMilestoneHook = useApproveMilestone(contractId, {
    onSuccess: onApproveMilestone,
    onError,
  });
  const requestRevisionHook = useRequestRevision(contractId, {
    onSuccess: onRequestRevision,
    onError,
  });
  const fundMilestoneHook = useFundMilestone(contractId, {
    onSuccess: onFundMilestone,
    onError,
  });
  const releaseMilestonePaymentHook = useReleaseMilestonePayment(contractId, {
    onSuccess: onReleaseMilestonePayment,
    onError,
  });
  const addTimeEntryHook = useAddTimeEntry(contractId, { onSuccess: onAddTimeEntry, onError });

  const isAnyPending =
    signHook.isSigning ||
    pauseHook.isPausing ||
    resumeHook.isResuming ||
    endHook.isEnding ||
    submitMilestoneHook.isSubmitting ||
    approveMilestoneHook.isApproving ||
    requestRevisionHook.isRequesting ||
    fundMilestoneHook.isFunding ||
    releaseMilestonePaymentHook.isReleasing ||
    addTimeEntryHook.isAdding;

  return {
    // Contract actions
    sign: signHook.sign,
    isSigning: signHook.isSigning,
    pause: pauseHook.pause,
    isPausing: pauseHook.isPausing,
    resume: resumeHook.resume,
    isResuming: resumeHook.isResuming,
    end: endHook.end,
    isEnding: endHook.isEnding,

    // Milestone actions
    submitMilestone: submitMilestoneHook.submit,
    isSubmittingMilestone: submitMilestoneHook.isSubmitting,
    approveMilestone: approveMilestoneHook.approve,
    isApprovingMilestone: approveMilestoneHook.isApproving,
    requestRevision: requestRevisionHook.requestRevision,
    isRequestingRevision: requestRevisionHook.isRequesting,
    fundMilestone: fundMilestoneHook.fund,
    isFundingMilestone: fundMilestoneHook.isFunding,
    releaseMilestonePayment: releaseMilestonePaymentHook.release,
    isReleasingMilestonePayment: releaseMilestonePaymentHook.isReleasing,

    // Time entry actions
    addTimeEntry: addTimeEntryHook.addEntry,
    isAddingTimeEntry: addTimeEntryHook.isAdding,

    // Overall state
    isAnyPending,
  };
}

// ============================================================================
// Prefetch Helpers
// ============================================================================

/**
 * Prefetch contract details for faster navigation
 */
export function usePrefetchContract() {
  const queryClient = useQueryClient();

  return useCallback(
    (contractId: string) => {
      void queryClient.prefetchQuery({
        queryKey: contractQueryKeys.detail(contractId),
        queryFn: () => getContractById(contractId),
        staleTime: 30_000,
      });
    },
    [queryClient]
  );
}

/**
 * Invalidate all contract-related queries
 */
export function useInvalidateContracts() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: contractQueryKeys.all });
  }, [queryClient]);
}
