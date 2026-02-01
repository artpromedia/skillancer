'use client';

/**
 * Conversations API Hooks
 *
 * TanStack Query hooks for conversation management including listing,
 * fetching details, and creating new conversations.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  getConversations,
  getConversationById,
  type Conversation,
  type ConversationFilters,
  type ConversationStatus,
} from '@/lib/api/messages';

// ============================================================================
// Query Keys
// ============================================================================

export const conversationQueryKeys = {
  all: ['conversations'] as const,
  lists: () => [...conversationQueryKeys.all, 'list'] as const,
  list: (filters?: ConversationFilters) => [...conversationQueryKeys.lists(), filters] as const,
  details: () => [...conversationQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...conversationQueryKeys.details(), id] as const,
} as const;

// ============================================================================
// Types
// ============================================================================

export interface UseConversationsOptions {
  status?: ConversationStatus;
  unreadOnly?: boolean;
  search?: string;
  contextType?: 'JOB' | 'CONTRACT' | 'PROPOSAL';
  contextId?: string;
  enabled?: boolean;
  refetchInterval?: number;
  staleTime?: number;
}

export interface UseConversationOptions {
  enabled?: boolean;
  refetchInterval?: number;
  staleTime?: number;
}

export interface UseConversationsReturn {
  conversations: Conversation[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  isSuccess: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

export interface UseConversationReturn {
  conversation: Conversation | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  isSuccess: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

// ============================================================================
// useConversations Hook
// ============================================================================

/**
 * Fetch all conversations with optional filters
 */
export function useConversations(options: UseConversationsOptions = {}): UseConversationsReturn {
  const queryClient = useQueryClient();
  const {
    status,
    unreadOnly,
    search,
    contextType,
    contextId,
    enabled = true,
    refetchInterval,
    staleTime = 30000, // 30 seconds
  } = options;

  const filters: ConversationFilters = {
    status,
    unreadOnly,
    search,
    contextType,
    contextId,
  };

  const query = useQuery({
    queryKey: conversationQueryKeys.list(filters),
    queryFn: () => getConversations(filters),
    enabled,
    refetchInterval,
    staleTime,
    refetchOnWindowFocus: true,
  });

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: conversationQueryKeys.lists(),
    });
  }, [queryClient]);

  return {
    conversations: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    isSuccess: query.isSuccess,
    isError: query.isError,
    refetch,
    invalidate,
  };
}

// ============================================================================
// useConversation Hook
// ============================================================================

/**
 * Fetch a single conversation by ID
 */
export function useConversation(
  conversationId: string,
  options: UseConversationOptions = {}
): UseConversationReturn {
  const queryClient = useQueryClient();
  const { enabled = true, refetchInterval, staleTime = 30000 } = options;

  const query = useQuery({
    queryKey: conversationQueryKeys.detail(conversationId),
    queryFn: () => getConversationById(conversationId),
    enabled: enabled && !!conversationId,
    refetchInterval,
    staleTime,
  });

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: conversationQueryKeys.detail(conversationId),
    });
  }, [queryClient, conversationId]);

  return {
    conversation: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    isSuccess: query.isSuccess,
    isError: query.isError,
    refetch,
    invalidate,
  };
}

// ============================================================================
// Conversation Mutations
// ============================================================================

export interface CreateConversationData {
  participantIds: string[];
  title?: string;
  contextType?: 'JOB' | 'CONTRACT' | 'PROPOSAL';
  contextId?: string;
  initialMessage?: string;
}

export interface UpdateConversationData {
  title?: string;
  isPinned?: boolean;
  isMuted?: boolean;
  status?: ConversationStatus;
}

/**
 * Create a new conversation
 */
export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateConversationData): Promise<Conversation> => {
      // API endpoint: POST /api/v1/messages/conversations
      const response = await fetch('/api/v1/messages/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create conversation');
      }

      return response.json() as Promise<Conversation>;
    },
    onSuccess: (newConversation) => {
      // Add to cache
      queryClient.setQueryData<Conversation>(
        conversationQueryKeys.detail(newConversation.id),
        newConversation
      );
      // Invalidate list to refetch
      void queryClient.invalidateQueries({
        queryKey: conversationQueryKeys.lists(),
      });
    },
  });
}

/**
 * Update conversation settings (pin, mute, archive)
 */
export function useUpdateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      data,
    }: {
      conversationId: string;
      data: UpdateConversationData;
    }): Promise<Conversation> => {
      // API endpoint: PATCH /api/v1/messages/conversations/:id
      const response = await fetch(`/api/v1/messages/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update conversation');
      }

      return response.json() as Promise<Conversation>;
    },
    onMutate: async ({ conversationId, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: conversationQueryKeys.detail(conversationId),
      });

      // Snapshot previous value
      const previousConversation = queryClient.getQueryData<Conversation>(
        conversationQueryKeys.detail(conversationId)
      );

      // Optimistically update
      if (previousConversation) {
        queryClient.setQueryData<Conversation>(conversationQueryKeys.detail(conversationId), {
          ...previousConversation,
          ...data,
        });
      }

      return { previousConversation };
    },
    onError: (_err, { conversationId }, context) => {
      // Rollback on error
      if (context?.previousConversation) {
        queryClient.setQueryData(
          conversationQueryKeys.detail(conversationId),
          context.previousConversation
        );
      }
    },
    onSettled: (_, __, { conversationId }) => {
      // Refetch to ensure consistency
      void queryClient.invalidateQueries({
        queryKey: conversationQueryKeys.detail(conversationId),
      });
      void queryClient.invalidateQueries({
        queryKey: conversationQueryKeys.lists(),
      });
    },
  });
}

/**
 * Archive a conversation
 */
export function useArchiveConversation() {
  const updateMutation = useUpdateConversation();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      return updateMutation.mutateAsync({
        conversationId,
        data: { status: 'ARCHIVED' },
      });
    },
  });
}

/**
 * Pin/unpin a conversation
 */
export function useTogglePinConversation() {
  const queryClient = useQueryClient();
  const updateMutation = useUpdateConversation();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const current = queryClient.getQueryData<Conversation>(
        conversationQueryKeys.detail(conversationId)
      );
      return updateMutation.mutateAsync({
        conversationId,
        data: { isPinned: !current?.isPinned },
      });
    },
  });
}

/**
 * Mute/unmute a conversation
 */
export function useToggleMuteConversation() {
  const queryClient = useQueryClient();
  const updateMutation = useUpdateConversation();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const current = queryClient.getQueryData<Conversation>(
        conversationQueryKeys.detail(conversationId)
      );
      return updateMutation.mutateAsync({
        conversationId,
        data: { isMuted: !current?.isMuted },
      });
    },
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Prefetch a conversation for faster navigation
 */
export function usePrefetchConversation() {
  const queryClient = useQueryClient();

  return useCallback(
    (conversationId: string) => {
      void queryClient.prefetchQuery({
        queryKey: conversationQueryKeys.detail(conversationId),
        queryFn: () => getConversationById(conversationId),
        staleTime: 30000,
      });
    },
    [queryClient]
  );
}

/**
 * Update unread count in cache (called from WebSocket handler)
 */
export function useUpdateUnreadCount() {
  const queryClient = useQueryClient();

  return useCallback(
    (conversationId: string, unreadCount: number) => {
      queryClient.setQueryData<Conversation>(conversationQueryKeys.detail(conversationId), (old) =>
        old ? { ...old, unreadCount } : old
      );

      // Also update in list cache
      queryClient.setQueriesData<Conversation[]>(
        { queryKey: conversationQueryKeys.lists() },
        (old) => old?.map((c) => (c.id === conversationId ? { ...c, unreadCount } : c))
      );
    },
    [queryClient]
  );
}
