/**
 * Dispute Management Hooks
 *
 * React Query hooks for dispute resolution in the admin panel.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';

import {
  disputesService,
  type Dispute,
  type DisputeStatus,
  type DisputeType,
  type DisputeMessage,
  type DisputeEvidence,
  type Resolution,
  type ResolutionProposal,
  type DisputeStats,
} from '../../lib/api/services/disputes';

import type { ApiResponse, PaginatedResponse } from '@skillancer/shared-api-client';

// =============================================================================
// Query Keys
// =============================================================================

export const disputeKeys = {
  all: ['admin', 'disputes'] as const,
  lists: () => [...disputeKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...disputeKeys.lists(), filters] as const,
  details: () => [...disputeKeys.all, 'detail'] as const,
  detail: (id: string) => [...disputeKeys.details(), id] as const,
  byCaseNumber: (caseNumber: string) => [...disputeKeys.all, 'case', caseNumber] as const,
  messages: (id: string) => [...disputeKeys.detail(id), 'messages'] as const,
  evidence: (id: string) => [...disputeKeys.detail(id), 'evidence'] as const,
  resolutions: (id: string) => [...disputeKeys.detail(id), 'resolutions'] as const,
  stats: () => [...disputeKeys.all, 'stats'] as const,
};

// =============================================================================
// Query Hooks
// =============================================================================

interface DisputeFilters {
  page?: number;
  limit?: number;
  status?: DisputeStatus | DisputeStatus[];
  type?: DisputeType | DisputeType[];
  assignedTo?: string;
  projectId?: string;
  partyId?: string;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
  createdAfter?: string;
  createdBefore?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * List disputes
 */
export function useDisputes(
  filters: DisputeFilters = {},
  options?: Omit<UseQueryOptions<PaginatedResponse<Dispute>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: disputeKeys.list(filters),
    queryFn: () => disputesService.listDisputes(filters),
    ...options,
  });
}

/**
 * Get dispute by ID
 */
export function useDispute(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<Dispute>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: disputeKeys.detail(id),
    queryFn: () => disputesService.getDispute(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Get dispute by case number
 */
export function useDisputeByCaseNumber(
  caseNumber: string,
  options?: Omit<UseQueryOptions<ApiResponse<Dispute>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: disputeKeys.byCaseNumber(caseNumber),
    queryFn: () => disputesService.getDisputeByCaseNumber(caseNumber),
    enabled: !!caseNumber,
    ...options,
  });
}

/**
 * Get dispute messages
 */
export function useDisputeMessages(
  disputeId: string,
  params?: { page?: number; limit?: number },
  options?: Omit<UseQueryOptions<PaginatedResponse<DisputeMessage>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: disputeKeys.messages(disputeId),
    queryFn: () => disputesService.getMessages(disputeId, params),
    enabled: !!disputeId,
    ...options,
  });
}

/**
 * Get dispute evidence
 */
export function useDisputeEvidence(
  disputeId: string,
  options?: Omit<UseQueryOptions<ApiResponse<DisputeEvidence[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: disputeKeys.evidence(disputeId),
    queryFn: () => disputesService.getEvidence(disputeId),
    enabled: !!disputeId,
    ...options,
  });
}

/**
 * Get resolution proposals
 */
export function useResolutionProposals(
  disputeId: string,
  options?: Omit<UseQueryOptions<ApiResponse<ResolutionProposal[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: disputeKeys.resolutions(disputeId),
    queryFn: () => disputesService.getResolutionProposals(disputeId),
    enabled: !!disputeId,
    ...options,
  });
}

/**
 * Get dispute stats
 */
export function useDisputeStats(
  params?: { startDate?: string; endDate?: string },
  options?: Omit<UseQueryOptions<ApiResponse<DisputeStats>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...disputeKeys.stats(), params],
    queryFn: () => disputesService.getStats(params),
    ...options,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/**
 * Update dispute
 */
export function useUpdateDispute(
  options?: UseMutationOptions<ApiResponse<Dispute>, Error, { id: string; data: Partial<Dispute> }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => disputesService.updateDispute(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: disputeKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: disputeKeys.lists() });
    },
    ...options,
  });
}

/**
 * Assign dispute
 */
export function useAssignDispute(
  options?: UseMutationOptions<ApiResponse<Dispute>, Error, { id: string; mediatorId: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, mediatorId }) => disputesService.assignDispute(id, mediatorId),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: disputeKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: disputeKeys.lists() });
    },
    ...options,
  });
}

/**
 * Unassign dispute
 */
export function useUnassignDispute(
  options?: UseMutationOptions<ApiResponse<Dispute>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => disputesService.unassignDispute(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: disputeKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: disputeKeys.lists() });
    },
    ...options,
  });
}

/**
 * Escalate dispute
 */
export function useEscalateDispute(
  options?: UseMutationOptions<
    ApiResponse<Dispute>,
    Error,
    { id: string; reason: string; escalateTo?: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason, escalateTo }) =>
      disputesService.escalateDispute(id, reason, escalateTo),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: disputeKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: disputeKeys.lists() });
    },
    ...options,
  });
}

/**
 * Close dispute
 */
export function useCloseDispute(
  options?: UseMutationOptions<
    ApiResponse<Dispute>,
    Error,
    { id: string; resolution: string; outcome?: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, resolution, outcome }) =>
      disputesService.closeDispute(id, resolution, outcome),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: disputeKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: disputeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: disputeKeys.stats() });
    },
    ...options,
  });
}

/**
 * Reopen dispute
 */
export function useReopenDispute(
  options?: UseMutationOptions<ApiResponse<Dispute>, Error, { id: string; reason: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }) => disputesService.reopenDispute(id, reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: disputeKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: disputeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: disputeKeys.stats() });
    },
    ...options,
  });
}

/**
 * Request response from party
 */
export function useRequestDisputeResponse(
  options?: UseMutationOptions<
    ApiResponse<void>,
    Error,
    { id: string; partyId: string; message?: string }
  >
) {
  return useMutation({
    mutationFn: ({ id, partyId, message }) => disputesService.requestResponse(id, partyId, message),
    ...options,
  });
}

/**
 * Send message
 */
export function useSendDisputeMessage(
  options?: UseMutationOptions<
    ApiResponse<DisputeMessage>,
    Error,
    {
      disputeId: string;
      content: string;
      isInternal?: boolean;
      visibleTo?: string[];
      attachmentIds?: string[];
    }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ disputeId, ...data }) => disputesService.sendMessage(disputeId, data),
    onSuccess: (_, { disputeId }) => {
      queryClient.invalidateQueries({ queryKey: disputeKeys.messages(disputeId) });
    },
    ...options,
  });
}

/**
 * Upload evidence
 */
export function useUploadDisputeEvidence(
  options?: UseMutationOptions<
    ApiResponse<DisputeEvidence>,
    Error,
    {
      disputeId: string;
      file: File;
      description?: string;
    }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ disputeId, file, description }) =>
      disputesService.uploadEvidence(disputeId, file, description),
    onSuccess: (_, { disputeId }) => {
      queryClient.invalidateQueries({ queryKey: disputeKeys.evidence(disputeId) });
    },
    ...options,
  });
}

/**
 * Propose resolution
 */
export function useProposeResolution(
  options?: UseMutationOptions<
    ApiResponse<ResolutionProposal>,
    Error,
    {
      disputeId: string;
      proposal: Omit<
        ResolutionProposal,
        'id' | 'disputeId' | 'proposedBy' | 'proposedAt' | 'status'
      >;
    }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ disputeId, proposal }) => disputesService.proposeResolution(disputeId, proposal),
    onSuccess: (_, { disputeId }) => {
      queryClient.invalidateQueries({ queryKey: disputeKeys.resolutions(disputeId) });
    },
    ...options,
  });
}

/**
 * Implement resolution
 */
export function useImplementResolution(
  options?: UseMutationOptions<
    ApiResponse<Resolution>,
    Error,
    {
      disputeId: string;
      resolution: Omit<Resolution, 'id' | 'implementedAt' | 'implementedBy'>;
    }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ disputeId, resolution }) =>
      disputesService.implementResolution(disputeId, resolution),
    onSuccess: (_, { disputeId }) => {
      queryClient.invalidateQueries({ queryKey: disputeKeys.detail(disputeId) });
      queryClient.invalidateQueries({ queryKey: disputeKeys.resolutions(disputeId) });
      queryClient.invalidateQueries({ queryKey: disputeKeys.stats() });
    },
    ...options,
  });
}
