/**
 * Contracts API Hooks
 *
 * React Query hooks for contract-related operations.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  contractsService,
  type Contract,
  type ContractMilestone,
  type ContractListParams,
  type CreateContractInput,
  type UpdateContractInput,
  type SubmitMilestoneInput,
  type RequestRevisionInput,
  type TimeEntry,
  type TimeEntryInput,
  type ContractReview,
  type SubmitReviewInput,
  type ContractStatus,
  type MilestoneStatus,
} from '@/lib/api/services';

// =============================================================================
// Query Keys
// =============================================================================

export const contractKeys = {
  all: ['contracts'] as const,
  lists: () => [...contractKeys.all, 'list'] as const,
  list: (params: ContractListParams) => [...contractKeys.lists(), params] as const,
  details: () => [...contractKeys.all, 'detail'] as const,
  detail: (id: string) => [...contractKeys.details(), id] as const,
  my: (params?: ContractListParams) => [...contractKeys.all, 'my', params] as const,
  milestones: (contractId: string) => [...contractKeys.all, 'milestones', contractId] as const,
  milestone: (contractId: string, milestoneId: string) =>
    [...contractKeys.milestones(contractId), milestoneId] as const,
  timeEntries: (contractId: string, params?: { startDate?: string; endDate?: string }) =>
    [...contractKeys.all, 'timeEntries', contractId, params] as const,
  reviews: (contractId: string) => [...contractKeys.all, 'reviews', contractId] as const,
};

// =============================================================================
// Query Hooks
// =============================================================================

/**
 * Get my contracts (both as client and freelancer)
 */
export function useMyContracts(params: ContractListParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: contractKeys.my(params),
    queryFn: () => contractsService.getMyContracts(params),
    enabled: options?.enabled ?? true,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Get contracts where I'm the client
 */
export function useClientContracts(
  params: Omit<ContractListParams, 'role'> = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: contractKeys.list({ ...params, role: 'client' }),
    queryFn: () => contractsService.getMyContracts({ ...params, role: 'client' }),
    enabled: options?.enabled ?? true,
    staleTime: 30 * 1000,
  });
}

/**
 * Get contracts where I'm the freelancer
 */
export function useFreelancerContracts(
  params: Omit<ContractListParams, 'role'> = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: contractKeys.list({ ...params, role: 'freelancer' }),
    queryFn: () => contractsService.getMyContracts({ ...params, role: 'freelancer' }),
    enabled: options?.enabled ?? true,
    staleTime: 30 * 1000,
  });
}

/**
 * Get a single contract by ID
 */
export function useContract(id: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: contractKeys.detail(id ?? ''),
    queryFn: () => contractsService.getById(id),
    enabled: !!id && (options?.enabled ?? true),
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Get milestones for a contract
 */
export function useContractMilestones(
  contractId: string | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: contractKeys.milestones(contractId ?? ''),
    queryFn: () => contractsService.getMilestones(contractId),
    enabled: !!contractId && (options?.enabled ?? true),
    staleTime: 30 * 1000,
  });
}

/**
 * Get time entries for a contract
 */
export function useTimeEntries(
  contractId: string | undefined,
  params: { startDate?: string; endDate?: string } = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: contractKeys.timeEntries(contractId ?? '', params),
    queryFn: () => contractsService.getTimeEntries(contractId, params),
    enabled: !!contractId && (options?.enabled ?? true),
    staleTime: 60 * 1000,
  });
}

/**
 * Get reviews for a contract
 */
export function useContractReviews(
  contractId: string | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: contractKeys.reviews(contractId ?? ''),
    queryFn: () => contractsService.getReviews(contractId),
    enabled: !!contractId && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/**
 * Create a new contract (from accepted proposal)
 */
export function useCreateContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateContractInput) => contractsService.create(data),
    onSuccess: (result) => {
      // Invalidate contract lists
      void queryClient.invalidateQueries({ queryKey: contractKeys.my() });

      // Add the new contract to cache
      if (result.data) {
        queryClient.setQueryData(contractKeys.detail(result.data.id), result);
      }
    },
  });
}

/**
 * Update a contract
 */
export function useUpdateContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateContractInput }) =>
      contractsService.update(id, data),
    onSuccess: (result, variables) => {
      // Update the contract in cache
      queryClient.setQueryData(contractKeys.detail(variables.id), result);

      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: contractKeys.my() });
    },
  });
}

/**
 * Sign a contract
 */
export function useSignContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => contractsService.sign(id),
    onSuccess: (result, id) => {
      queryClient.setQueryData(contractKeys.detail(id), result);
      queryClient.invalidateQueries({ queryKey: contractKeys.my() });
    },
  });
}

/**
 * Pause a contract
 */
export function usePauseContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      contractsService.pause(id, reason),
    onSuccess: (result, { id }) => {
      queryClient.setQueryData(contractKeys.detail(id), result);
      queryClient.invalidateQueries({ queryKey: contractKeys.my() });
    },
  });
}

/**
 * Resume a paused contract
 */
export function useResumeContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => contractsService.resume(id),
    onSuccess: (result, id) => {
      queryClient.setQueryData(contractKeys.detail(id), result);
      queryClient.invalidateQueries({ queryKey: contractKeys.my() });
    },
  });
}

/**
 * Complete a contract
 */
export function useCompleteContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => contractsService.complete(id),
    onSuccess: (result, id) => {
      queryClient.setQueryData(contractKeys.detail(id), result);
      void queryClient.invalidateQueries({ queryKey: contractKeys.my() });
    },
  });
}

/**
 * Cancel a contract
 */
export function useCancelContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      contractsService.cancel(id, reason),
    onSuccess: (result, { id }) => {
      queryClient.setQueryData(contractKeys.detail(id), result);
      void queryClient.invalidateQueries({ queryKey: contractKeys.my() });
    },
  });
}

// =============================================================================
// Milestone Mutation Hooks
// =============================================================================

/**
 * Fund a milestone (as client)
 */
export function useFundMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contractId, milestoneId }: { contractId: string; milestoneId: string }) =>
      contractsService.fundMilestone(contractId, milestoneId),
    onSuccess: (result, { contractId }) => {
      // Invalidate milestones and contract
      queryClient.invalidateQueries({ queryKey: contractKeys.milestones(contractId) });
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(contractId) });
    },
  });
}

/**
 * Submit milestone work (as freelancer)
 */
export function useSubmitMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      contractId,
      milestoneId,
      data,
    }: {
      contractId: string;
      milestoneId: string;
      data: SubmitMilestoneInput;
    }) => contractsService.submitMilestone(contractId, milestoneId, data),
    onSuccess: (result, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: contractKeys.milestones(contractId) });
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(contractId) });
    },
  });
}

/**
 * Approve milestone (as client)
 */
export function useApproveMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contractId, milestoneId }: { contractId: string; milestoneId: string }) =>
      contractsService.approveMilestone(contractId, milestoneId),
    onSuccess: (result, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: contractKeys.milestones(contractId) });
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(contractId) });
    },
  });
}

/**
 * Request revision on a milestone (as client)
 */
export function useRequestRevision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      contractId,
      milestoneId,
      data,
    }: {
      contractId: string;
      milestoneId: string;
      data: RequestRevisionInput;
    }) => contractsService.requestRevision(contractId, milestoneId, data),
    onSuccess: (result, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: contractKeys.milestones(contractId) });
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(contractId) });
    },
  });
}

/**
 * Release milestone payment (as client) - alias for approve milestone
 */
export function useReleaseMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contractId, milestoneId }: { contractId: string; milestoneId: string }) =>
      contractsService.approveMilestone(contractId, milestoneId),
    onSuccess: (result, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: contractKeys.milestones(contractId) });
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(contractId) });
    },
  });
}

// =============================================================================
// Time Entry Mutation Hooks
// =============================================================================

/**
 * Log time entry (for hourly contracts)
 */
export function useLogTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contractId, data }: { contractId: string; data: TimeEntryInput }) =>
      contractsService.addTimeEntry(contractId, data),
    onSuccess: (result, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: contractKeys.timeEntries(contractId) });
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(contractId) });
    },
  });
}

/**
 * Update time entry
 */
export function useUpdateTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      contractId,
      entryId,
      data,
    }: {
      contractId: string;
      entryId: string;
      data: Partial<TimeEntryInput>;
    }) => contractsService.updateTimeEntry(contractId, entryId, data),
    onSuccess: (result, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: contractKeys.timeEntries(contractId) });
    },
  });
}

/**
 * Delete time entry
 */
export function useDeleteTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contractId, entryId }: { contractId: string; entryId: string }) =>
      contractsService.deleteTimeEntry(contractId, entryId),
    onSuccess: (result, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: contractKeys.timeEntries(contractId) });
    },
  });
}

/**
 * Approve time entries (as client)
 */
export function useApproveTimeEntries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contractId, entryIds }: { contractId: string; entryIds: string[] }) =>
      contractsService.approveTimeEntries(contractId, entryIds),
    onSuccess: (result, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: contractKeys.timeEntries(contractId) });
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(contractId) });
    },
  });
}

// =============================================================================
// Review Mutation Hooks
// =============================================================================

/**
 * Submit a review for a completed contract
 */
export function useSubmitReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contractId, data }: { contractId: string; data: SubmitReviewInput }) =>
      contractsService.submitReview(contractId, data),
    onSuccess: (result, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: contractKeys.reviews(contractId) });
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(contractId) });
    },
  });
}

// =============================================================================
// Helper Types
// =============================================================================

export type {
  Contract,
  ContractMilestone,
  ContractListParams,
  CreateContractInput,
  UpdateContractInput,
  SubmitMilestoneInput,
  RequestRevisionInput,
  TimeEntry,
  TimeEntryInput,
  ContractReview,
  SubmitReviewInput,
  ContractStatus,
  MilestoneStatus,
};
