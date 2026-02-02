/**
 * Support Management Hooks
 *
 * React Query hooks for support ticket management in the admin panel.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';

import {
  supportService,
  type SupportTicket,
  type TicketFilters,
  type TicketMessage,
  type TicketNote,
  type CannedResponse,
  type SupportStats,
  type TicketStatus,
  type TicketPriority,
  type TicketCategory,
} from '../../lib/api/services/support';

import type { ApiResponse, PaginatedResponse } from '@skillancer/shared-api-client';

// =============================================================================
// Query Keys
// =============================================================================

export const ticketKeys = {
  all: ['admin', 'support', 'tickets'] as const,
  lists: () => [...ticketKeys.all, 'list'] as const,
  list: (filters: TicketFilters) => [...ticketKeys.lists(), filters] as const,
  details: () => [...ticketKeys.all, 'detail'] as const,
  detail: (id: string) => [...ticketKeys.details(), id] as const,
  byNumber: (ticketNumber: string) => [...ticketKeys.all, 'number', ticketNumber] as const,
  messages: (id: string) => [...ticketKeys.detail(id), 'messages'] as const,
  notes: (id: string) => [...ticketKeys.detail(id), 'notes'] as const,
};

export const cannedResponseKeys = {
  all: ['admin', 'support', 'canned'] as const,
  list: (params?: Record<string, unknown>) => [...cannedResponseKeys.all, params] as const,
};

export const supportStatsKeys = {
  all: ['admin', 'support', 'stats'] as const,
  stats: (params?: Record<string, unknown>) => [...supportStatsKeys.all, params] as const,
  agentPerformance: (agentId: string, params?: Record<string, unknown>) =>
    [...supportStatsKeys.all, 'agent', agentId, params] as const,
};

// =============================================================================
// Ticket Query Hooks
// =============================================================================

/**
 * List tickets
 */
export function useTickets(
  filters: TicketFilters = {},
  options?: Omit<UseQueryOptions<PaginatedResponse<SupportTicket>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ticketKeys.list(filters),
    queryFn: () => supportService.listTickets(filters),
    ...options,
  });
}

/**
 * Get ticket by ID
 */
export function useTicket(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<SupportTicket>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ticketKeys.detail(id),
    queryFn: () => supportService.getTicket(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Get ticket by number
 */
export function useTicketByNumber(
  ticketNumber: string,
  options?: Omit<UseQueryOptions<ApiResponse<SupportTicket>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ticketKeys.byNumber(ticketNumber),
    queryFn: () => supportService.getByTicketNumber(ticketNumber),
    enabled: !!ticketNumber,
    ...options,
  });
}

/**
 * Get ticket messages
 */
export function useTicketMessages(
  ticketId: string,
  params?: { page?: number; limit?: number; includeInternal?: boolean },
  options?: Omit<UseQueryOptions<PaginatedResponse<TicketMessage>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ticketKeys.messages(ticketId),
    queryFn: () => supportService.getMessages(ticketId, params),
    enabled: !!ticketId,
    ...options,
  });
}

/**
 * Get ticket notes
 */
export function useTicketNotes(
  ticketId: string,
  options?: Omit<UseQueryOptions<ApiResponse<TicketNote[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ticketKeys.notes(ticketId),
    queryFn: () => supportService.getNotes(ticketId),
    enabled: !!ticketId,
    ...options,
  });
}

// =============================================================================
// Ticket Mutation Hooks
// =============================================================================

/**
 * Create ticket
 */
export function useCreateTicket(
  options?: UseMutationOptions<
    ApiResponse<SupportTicket>,
    Error,
    {
      userId: string;
      subject: string;
      description: string;
      category: TicketCategory;
      priority?: TicketPriority;
      tags?: string[];
      assignTo?: string;
    }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => supportService.createTicket(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
      queryClient.invalidateQueries({ queryKey: supportStatsKeys.all });
    },
    ...options,
  });
}

/**
 * Update ticket
 */
export function useUpdateTicket(
  options?: UseMutationOptions<
    ApiResponse<SupportTicket>,
    Error,
    {
      id: string;
      data: {
        status?: TicketStatus;
        priority?: TicketPriority;
        category?: TicketCategory;
        tags?: string[];
        assignedTo?: string;
        team?: string;
      };
    }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => supportService.updateTicket(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
    },
    ...options,
  });
}

/**
 * Close ticket
 */
export function useCloseTicket(
  options?: UseMutationOptions<
    ApiResponse<SupportTicket>,
    Error,
    { id: string; resolution?: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, resolution }) => supportService.closeTicket(id, resolution),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
      queryClient.invalidateQueries({ queryKey: supportStatsKeys.all });
    },
    ...options,
  });
}

/**
 * Reopen ticket
 */
export function useReopenTicket(
  options?: UseMutationOptions<ApiResponse<SupportTicket>, Error, { id: string; reason?: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }) => supportService.reopenTicket(id, reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
      queryClient.invalidateQueries({ queryKey: supportStatsKeys.all });
    },
    ...options,
  });
}

/**
 * Merge tickets
 */
export function useMergeTickets(
  options?: UseMutationOptions<
    ApiResponse<SupportTicket>,
    Error,
    { targetId: string; sourceIds: string[] }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ targetId, sourceIds }) => supportService.mergeTickets(targetId, sourceIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
    },
    ...options,
  });
}

/**
 * Assign ticket
 */
export function useAssignTicket(
  options?: UseMutationOptions<ApiResponse<SupportTicket>, Error, { id: string; agentId: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, agentId }) => supportService.assignTicket(id, agentId),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
    },
    ...options,
  });
}

/**
 * Unassign ticket
 */
export function useUnassignTicket(
  options?: UseMutationOptions<ApiResponse<SupportTicket>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => supportService.unassignTicket(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
    },
    ...options,
  });
}

/**
 * Escalate ticket
 */
export function useEscalateTicket(
  options?: UseMutationOptions<
    ApiResponse<SupportTicket>,
    Error,
    { id: string; reason: string; escalateTo?: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason, escalateTo }) =>
      supportService.escalateTicket(id, reason, escalateTo),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
    },
    ...options,
  });
}

/**
 * Send message
 */
export function useSendTicketMessage(
  options?: UseMutationOptions<
    ApiResponse<TicketMessage>,
    Error,
    {
      ticketId: string;
      content: string;
      contentType?: 'text' | 'html';
      attachmentIds?: string[];
      isInternal?: boolean;
    }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, ...data }) => supportService.sendMessage(ticketId, data),
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.messages(ticketId) });
      queryClient.invalidateQueries({ queryKey: ticketKeys.detail(ticketId) });
    },
    ...options,
  });
}

/**
 * Add note
 */
export function useAddTicketNote(
  options?: UseMutationOptions<
    ApiResponse<TicketNote>,
    Error,
    { ticketId: string; content: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, content }) => supportService.addNote(ticketId, content),
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.notes(ticketId) });
    },
    ...options,
  });
}

/**
 * Delete note
 */
export function useDeleteTicketNote(
  options?: UseMutationOptions<ApiResponse<void>, Error, { ticketId: string; noteId: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, noteId }) => supportService.deleteNote(ticketId, noteId),
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.notes(ticketId) });
    },
    ...options,
  });
}

/**
 * Bulk assign tickets
 */
export function useBulkAssignTickets(
  options?: UseMutationOptions<
    ApiResponse<{ assigned: number }>,
    Error,
    { ticketIds: string[]; agentId: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketIds, agentId }) => supportService.bulkAssign(ticketIds, agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
    },
    ...options,
  });
}

/**
 * Bulk close tickets
 */
export function useBulkCloseTickets(
  options?: UseMutationOptions<
    ApiResponse<{ closed: number }>,
    Error,
    { ticketIds: string[]; resolution?: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketIds, resolution }) => supportService.bulkClose(ticketIds, resolution),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
      queryClient.invalidateQueries({ queryKey: supportStatsKeys.all });
    },
    ...options,
  });
}

/**
 * Bulk update priority
 */
export function useBulkUpdateTicketPriority(
  options?: UseMutationOptions<
    ApiResponse<{ updated: number }>,
    Error,
    { ticketIds: string[]; priority: TicketPriority }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketIds, priority }) => supportService.bulkUpdatePriority(ticketIds, priority),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
    },
    ...options,
  });
}

// =============================================================================
// Canned Response Hooks
// =============================================================================

/**
 * Get canned responses
 */
export function useCannedResponses(
  params?: { category?: TicketCategory; search?: string },
  options?: Omit<UseQueryOptions<ApiResponse<CannedResponse[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: cannedResponseKeys.list(params),
    queryFn: () => supportService.getCannedResponses(params),
    ...options,
  });
}

/**
 * Create canned response
 */
export function useCreateCannedResponse(
  options?: UseMutationOptions<
    ApiResponse<CannedResponse>,
    Error,
    Omit<CannedResponse, 'id' | 'usageCount' | 'createdBy' | 'createdAt' | 'updatedAt'>
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => supportService.createCannedResponse(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cannedResponseKeys.all });
    },
    ...options,
  });
}

/**
 * Update canned response
 */
export function useUpdateCannedResponse(
  options?: UseMutationOptions<
    ApiResponse<CannedResponse>,
    Error,
    { id: string; data: Partial<CannedResponse> }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => supportService.updateCannedResponse(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cannedResponseKeys.all });
    },
    ...options,
  });
}

/**
 * Delete canned response
 */
export function useDeleteCannedResponse(
  options?: UseMutationOptions<ApiResponse<void>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => supportService.deleteCannedResponse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cannedResponseKeys.all });
    },
    ...options,
  });
}

/**
 * Use canned response
 */
export function useUseCannedResponse(
  options?: UseMutationOptions<
    ApiResponse<{ content: string }>,
    Error,
    {
      id: string;
      ticketId: string;
      variables?: Record<string, string>;
    }
  >
) {
  return useMutation({
    mutationFn: ({ id, ticketId, variables }) =>
      supportService.useCannedResponse(id, ticketId, variables),
    ...options,
  });
}

// =============================================================================
// Stats Hooks
// =============================================================================

/**
 * Get support stats
 */
export function useSupportStats(
  params?: { startDate?: string; endDate?: string; team?: string },
  options?: Omit<UseQueryOptions<ApiResponse<SupportStats>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: supportStatsKeys.stats(params),
    queryFn: () => supportService.getStats(params),
    ...options,
  });
}

/**
 * Get agent performance
 */
export function useAgentPerformance(
  agentId: string,
  params?: { startDate?: string; endDate?: string },
  options?: Omit<UseQueryOptions, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: supportStatsKeys.agentPerformance(agentId, params),
    queryFn: () => supportService.getAgentPerformance(agentId, params),
    enabled: !!agentId,
    ...options,
  });
}
