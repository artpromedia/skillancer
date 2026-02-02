/**
 * Proposals API Hooks
 *
 * React Query hooks for proposal-related operations.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  proposalsService,
  type Proposal,
  type ProposalListParams,
  type SubmitProposalInput,
  type UpdateProposalInput,
  type ProposalStatus,
  type ProposalDraft,
  type ProposalStats,
} from '@/lib/api/services';

// =============================================================================
// Query Keys
// =============================================================================

export const proposalKeys = {
  all: ['proposals'] as const,
  lists: () => [...proposalKeys.all, 'list'] as const,
  list: (params: ProposalListParams) => [...proposalKeys.lists(), params] as const,
  details: () => [...proposalKeys.all, 'detail'] as const,
  detail: (id: string) => [...proposalKeys.details(), id] as const,
  my: (params?: ProposalListParams) => [...proposalKeys.all, 'my', params] as const,
  forJob: (jobId: string, params?: ProposalListParams) =>
    [...proposalKeys.all, 'job', jobId, params] as const,
  drafts: () => [...proposalKeys.all, 'drafts'] as const,
  draft: (jobId: string) => [...proposalKeys.drafts(), jobId] as const,
  stats: () => [...proposalKeys.all, 'stats'] as const,
};

// =============================================================================
// Query Hooks
// =============================================================================

/**
 * Get my proposals (as a freelancer)
 */
export function useMyProposals(params: ProposalListParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: proposalKeys.my(params),
    queryFn: () => proposalsService.getMyProposals(params),
    enabled: options?.enabled ?? true,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Get proposals for a specific job (as a client)
 */
export function useJobProposals(
  jobId: string | undefined,
  params: ProposalListParams = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: proposalKeys.forJob(jobId ?? '', params),
    queryFn: () => proposalsService.getJobProposals(jobId, params),
    enabled: !!jobId && (options?.enabled ?? true),
    staleTime: 30 * 1000,
  });
}

/**
 * Get a single proposal by ID
 */
export function useProposal(id: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: proposalKeys.detail(id ?? ''),
    queryFn: () => proposalsService.getById(id),
    enabled: !!id && (options?.enabled ?? true),
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Get proposal draft for a job
 */
export function useProposalDraft(jobId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: proposalKeys.draft(jobId ?? ''),
    queryFn: () => proposalsService.getDraft(jobId),
    enabled: !!jobId && (options?.enabled ?? true),
    staleTime: 60 * 1000,
  });
}

/**
 * Get proposal statistics for current user
 */
export function useProposalStats(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: proposalKeys.stats(),
    queryFn: () => proposalsService.getStats(),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/**
 * Submit a new proposal
 */
export function useSubmitProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SubmitProposalInput) => proposalsService.submit(data),
    onSuccess: (result, variables) => {
      // Invalidate my proposals
      queryClient.invalidateQueries({ queryKey: proposalKeys.my() });

      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: proposalKeys.stats() });

      // Clear draft for this job
      queryClient.removeQueries({ queryKey: proposalKeys.draft(variables.jobId) });

      // Add the new proposal to cache
      if (result.data) {
        queryClient.setQueryData(proposalKeys.detail(result.data.id), result);
      }
    },
  });
}

/**
 * Update an existing proposal
 */
export function useUpdateProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProposalInput }) =>
      proposalsService.update(id, data),
    onSuccess: (result, variables) => {
      // Update the proposal in cache
      queryClient.setQueryData(proposalKeys.detail(variables.id), result);

      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: proposalKeys.my() });
    },
  });
}

/**
 * Withdraw a proposal
 */
export function useWithdrawProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => proposalsService.withdraw(id),
    onSuccess: (result, id) => {
      // Update the proposal in cache
      queryClient.setQueryData(proposalKeys.detail(id), result);

      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: proposalKeys.my() });
      queryClient.invalidateQueries({ queryKey: proposalKeys.stats() });
    },
  });
}

/**
 * Accept a proposal (as a client)
 */
export function useAcceptProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => proposalsService.accept(id),
    onSuccess: (result, id) => {
      // Update the proposal in cache
      queryClient.setQueryData(proposalKeys.detail(id), result);

      // Get the proposal to know which job it's for
      const proposal = result.data;
      if (proposal?.jobId) {
        queryClient.invalidateQueries({ queryKey: proposalKeys.forJob(proposal.jobId) });
      }
    },
  });
}

/**
 * Decline a proposal (as a client)
 */
export function useDeclineProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      proposalsService.reject(id, reason),
    onSuccess: (result, { id }) => {
      // Update the proposal in cache
      queryClient.setQueryData(proposalKeys.detail(id), result);

      // Get the proposal to know which job it's for
      const proposal = result.data;
      if (proposal?.jobId) {
        queryClient.invalidateQueries({ queryKey: proposalKeys.forJob(proposal.jobId) });
      }
    },
  });
}

/**
 * Shortlist a proposal (as a client)
 */
export function useShortlistProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => proposalsService.shortlist(id),
    onSuccess: (result, id) => {
      queryClient.setQueryData(proposalKeys.detail(id), result);

      const proposal = result.data;
      if (proposal?.jobId) {
        queryClient.invalidateQueries({ queryKey: proposalKeys.forJob(proposal.jobId) });
      }
    },
  });
}

/**
 * Save proposal draft
 */
export function useSaveProposalDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<SubmitProposalInput> & { jobId: string }) =>
      proposalsService.saveDraft(data),
    onSuccess: (result, variables) => {
      // Update draft in cache
      queryClient.setQueryData(proposalKeys.draft(variables.jobId), result);
    },
  });
}

/**
 * Delete proposal draft
 */
export function useDeleteProposalDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => proposalsService.deleteDraft(jobId),
    onSuccess: (_, jobId) => {
      // Remove draft from cache
      queryClient.removeQueries({ queryKey: proposalKeys.draft(jobId) });
    },
  });
}

// =============================================================================
// Helper Types
// =============================================================================

export type {
  Proposal,
  ProposalListParams,
  SubmitProposalInput,
  UpdateProposalInput,
  ProposalStatus,
  ProposalDraft,
  ProposalStats,
};
