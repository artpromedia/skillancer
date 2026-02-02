/**
 * Moderation Hooks
 *
 * React Query hooks for content moderation in the admin panel.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';

import {
  moderationService,
  type ModerationItem,
  type ModerationStatus,
  type ModerationPriority,
  type ContentType,
  type ModerationRule,
  type ModerationQueue,
  type ModerationStats,
} from '../../lib/api/services/moderation';

import type { ApiResponse, PaginatedResponse } from '@skillancer/shared-api-client';

// =============================================================================
// Query Keys
// =============================================================================

export const moderationKeys = {
  all: ['admin', 'moderation'] as const,
  lists: () => [...moderationKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...moderationKeys.lists(), filters] as const,
  details: () => [...moderationKeys.all, 'detail'] as const,
  detail: (id: string) => [...moderationKeys.details(), id] as const,
  nextInQueue: () => [...moderationKeys.all, 'next'] as const,
  rules: () => [...moderationKeys.all, 'rules'] as const,
  rule: (id: string) => [...moderationKeys.rules(), id] as const,
  queues: () => [...moderationKeys.all, 'queues'] as const,
  stats: () => [...moderationKeys.all, 'stats'] as const,
};

// =============================================================================
// Query Hooks
// =============================================================================

interface ModerationFilters {
  page?: number;
  limit?: number;
  contentType?: ContentType | ContentType[];
  status?: ModerationStatus | ModerationStatus[];
  priority?: ModerationPriority | ModerationPriority[];
  assignedTo?: string;
  reportedBy?: string;
  search?: string;
  createdAfter?: string;
  createdBefore?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * List moderation items
 */
export function useModerationItems(
  filters: ModerationFilters = {},
  options?: Omit<UseQueryOptions<PaginatedResponse<ModerationItem>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: moderationKeys.list(filters),
    queryFn: () => moderationService.listItems(filters),
    ...options,
  });
}

/**
 * Get moderation item by ID
 */
export function useModerationItem(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<ModerationItem>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: moderationKeys.detail(id),
    queryFn: () => moderationService.getItem(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Get next item in queue
 */
export function useNextModerationItem(
  queueId?: string,
  options?: Omit<UseQueryOptions<ApiResponse<ModerationItem | null>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...moderationKeys.nextInQueue(), queueId],
    queryFn: () => moderationService.getNextInQueue(queueId),
    ...options,
  });
}

/**
 * Get moderation rules
 */
export function useModerationRules(
  options?: Omit<UseQueryOptions<ApiResponse<ModerationRule[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: moderationKeys.rules(),
    queryFn: () => moderationService.getRules(),
    ...options,
  });
}

/**
 * Get moderation queues
 */
export function useModerationQueues(
  options?: Omit<UseQueryOptions<ApiResponse<ModerationQueue[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: moderationKeys.queues(),
    queryFn: () => moderationService.getQueues(),
    ...options,
  });
}

/**
 * Get moderation stats
 */
export function useModerationStats(
  params?: { startDate?: string; endDate?: string },
  options?: Omit<UseQueryOptions<ApiResponse<ModerationStats>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...moderationKeys.stats(), params],
    queryFn: () => moderationService.getStats(params),
    ...options,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/**
 * Approve moderation item
 */
export function useApproveItem(
  options?: UseMutationOptions<ApiResponse<ModerationItem>, Error, { id: string; note?: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, note }) => moderationService.approveItem(id, note),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: moderationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: moderationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: moderationKeys.stats() });
    },
    ...options,
  });
}

/**
 * Reject moderation item
 */
export function useRejectItem(
  options?: UseMutationOptions<
    ApiResponse<ModerationItem>,
    Error,
    { id: string; reason: string; note?: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason, note }) => moderationService.rejectItem(id, reason, note),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: moderationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: moderationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: moderationKeys.stats() });
    },
    ...options,
  });
}

/**
 * Flag moderation item
 */
export function useFlagItem(
  options?: UseMutationOptions<
    ApiResponse<ModerationItem>,
    Error,
    { id: string; flag: string; note?: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, flag, note }) => moderationService.flagItem(id, flag, note),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: moderationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: moderationKeys.lists() });
    },
    ...options,
  });
}

/**
 * Escalate moderation item
 */
export function useEscalateItem(
  options?: UseMutationOptions<
    ApiResponse<ModerationItem>,
    Error,
    { id: string; reason: string; escalateTo?: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason, escalateTo }) =>
      moderationService.escalateItem(id, reason, escalateTo),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: moderationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: moderationKeys.lists() });
    },
    ...options,
  });
}

/**
 * Remove content
 */
export function useRemoveContent(
  options?: UseMutationOptions<
    ApiResponse<ModerationItem>,
    Error,
    { id: string; reason: string; notifyUser?: boolean }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason, notifyUser }) =>
      moderationService.removeContent(id, reason, notifyUser),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: moderationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: moderationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: moderationKeys.stats() });
    },
    ...options,
  });
}

/**
 * Assign moderation item
 */
export function useAssignModerationItem(
  options?: UseMutationOptions<
    ApiResponse<ModerationItem>,
    Error,
    { id: string; moderatorId: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, moderatorId }) => moderationService.assignItem(id, moderatorId),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: moderationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: moderationKeys.lists() });
    },
    ...options,
  });
}

/**
 * Unassign moderation item
 */
export function useUnassignModerationItem(
  options?: UseMutationOptions<ApiResponse<ModerationItem>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => moderationService.unassignItem(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: moderationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: moderationKeys.lists() });
    },
    ...options,
  });
}

/**
 * Handle appeal
 */
export function useHandleAppeal(
  options?: UseMutationOptions<
    ApiResponse<ModerationItem>,
    Error,
    { id: string; approved: boolean; note?: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, approved, note }) => moderationService.handleAppeal(id, approved, note),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: moderationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: moderationKeys.lists() });
    },
    ...options,
  });
}

/**
 * Create moderation rule
 */
export function useCreateModerationRule(
  options?: UseMutationOptions<
    ApiResponse<ModerationRule>,
    Error,
    Omit<ModerationRule, 'id' | 'createdAt' | 'updatedAt' | 'triggeredCount'>
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => moderationService.createRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moderationKeys.rules() });
    },
    ...options,
  });
}

/**
 * Update moderation rule
 */
export function useUpdateModerationRule(
  options?: UseMutationOptions<
    ApiResponse<ModerationRule>,
    Error,
    { id: string; data: Partial<ModerationRule> }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => moderationService.updateRule(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: moderationKeys.rule(id) });
      queryClient.invalidateQueries({ queryKey: moderationKeys.rules() });
    },
    ...options,
  });
}

/**
 * Delete moderation rule
 */
export function useDeleteModerationRule(
  options?: UseMutationOptions<ApiResponse<void>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => moderationService.deleteRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moderationKeys.rules() });
    },
    ...options,
  });
}

/**
 * Bulk approve items
 */
export function useBulkApproveItems(
  options?: UseMutationOptions<ApiResponse<{ approved: number }>, Error, string[]>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemIds: string[]) => moderationService.bulkApprove(itemIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moderationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: moderationKeys.stats() });
    },
    ...options,
  });
}

/**
 * Bulk reject items
 */
export function useBulkRejectItems(
  options?: UseMutationOptions<
    ApiResponse<{ rejected: number }>,
    Error,
    { itemIds: string[]; reason: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemIds, reason }) => moderationService.bulkReject(itemIds, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moderationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: moderationKeys.stats() });
    },
    ...options,
  });
}

/**
 * Bulk assign items
 */
export function useBulkAssignItems(
  options?: UseMutationOptions<
    ApiResponse<{ assigned: number }>,
    Error,
    { itemIds: string[]; moderatorId: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemIds, moderatorId }) => moderationService.bulkAssign(itemIds, moderatorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moderationKeys.lists() });
    },
    ...options,
  });
}
