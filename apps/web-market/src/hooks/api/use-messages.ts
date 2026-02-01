'use client';

/**
 * Messages API Hooks
 *
 * TanStack Query hooks for message operations including fetching messages
 * with cursor-based pagination, sending messages, and managing reactions.
 */

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  getMessages,
  sendMessage,
  deleteMessage,
  editMessage,
  addReaction,
  removeReaction,
  markAsRead,
  type Message,
  type MessagePagination,
  type PaginatedMessages,
  type SendMessageData,
  type MessageReaction,
  type Conversation,
} from '@/lib/api/messages';

import { conversationQueryKeys } from './use-conversations';

// ============================================================================
// Query Keys
// ============================================================================

export const messageQueryKeys = {
  all: ['messages'] as const,
  lists: () => [...messageQueryKeys.all, 'list'] as const,
  list: (conversationId: string) => [...messageQueryKeys.lists(), conversationId] as const,
  infinite: (conversationId: string) =>
    [...messageQueryKeys.all, 'infinite', conversationId] as const,
} as const;

// ============================================================================
// Types
// ============================================================================

export interface UseMessagesOptions {
  conversationId: string;
  pageSize?: number;
  enabled?: boolean;
  staleTime?: number;
}

export interface UseMessagesReturn {
  messages: Message[];
  isLoading: boolean;
  isFetching: boolean;
  isFetchingPreviousPage: boolean;
  error: Error | null;
  isSuccess: boolean;
  isError: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
}

// ============================================================================
// useMessages Hook (Infinite Query with Cursor Pagination)
// ============================================================================

/**
 * Fetch messages for a conversation with cursor-based pagination.
 * Supports scroll-up loading for older messages.
 */
export function useMessages(options: UseMessagesOptions): UseMessagesReturn {
  const {
    conversationId,
    pageSize = 50,
    enabled = true,
    staleTime = 60000, // 1 minute
  } = options;

  const query = useInfiniteQuery<PaginatedMessages, Error>({
    queryKey: messageQueryKeys.infinite(conversationId),
    queryFn: async ({ pageParam }) => {
      const pagination: MessagePagination = {
        limit: pageSize,
        before: pageParam as string | undefined,
      };
      return getMessages(conversationId, pagination);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      // For scroll-up loading, "next" is actually older messages
      if (!lastPage.hasMore) return undefined;
      return lastPage.cursor;
    },
    getPreviousPageParam: () => undefined, // We don't load "newer" messages via pagination
    enabled: enabled && !!conversationId,
    staleTime,
    refetchOnWindowFocus: false,
  });

  // Flatten messages from all pages (reverse order: oldest first)
  const messages = useMemo(() => {
    if (!query.data?.pages) return [];
    // Pages are in reverse chronological order, so flatten and reverse
    return query.data.pages.flatMap((page) => page.messages).reverse();
  }, [query.data?.pages]);

  const loadMore = useCallback(async () => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      await query.fetchNextPage();
    }
  }, [query]);

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    messages,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingPreviousPage: query.isFetchingNextPage, // Actually loading older messages
    error: query.error,
    isSuccess: query.isSuccess,
    isError: query.isError,
    hasMore: query.hasNextPage ?? false,
    loadMore,
    refetch,
  };
}

// ============================================================================
// Message Mutations
// ============================================================================

interface SendMessageVariables {
  conversationId: string;
  data: SendMessageData;
  optimisticId?: string;
}

interface OptimisticMessage extends Message {
  isOptimistic?: boolean;
}

/**
 * Send a new message with optimistic updates
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, data }: SendMessageVariables): Promise<Message> => {
      return sendMessage(conversationId, data);
    },
    onMutate: async ({ conversationId, data, optimisticId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: messageQueryKeys.infinite(conversationId),
      });

      // Create optimistic message
      const optimisticMessage: OptimisticMessage = {
        id: optimisticId || `temp-${Date.now()}`,
        conversationId,
        senderId: 'current-user', // Will be replaced by actual response
        senderName: 'You',
        type: data.type || 'TEXT',
        content: data.content,
        attachments: [],
        reactions: [],
        linkPreviews: [],
        status: 'SENDING',
        isEdited: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isOptimistic: true,
      };

      // Add to cache
      queryClient.setQueryData<{ pages: PaginatedMessages[]; pageParams: unknown[] }>(
        messageQueryKeys.infinite(conversationId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page, index) =>
              index === 0 ? { ...page, messages: [optimisticMessage, ...page.messages] } : page
            ),
          };
        }
      );

      return { optimisticId: optimisticMessage.id };
    },
    onSuccess: (newMessage, { conversationId }, context) => {
      // Replace optimistic message with real one
      queryClient.setQueryData<{ pages: PaginatedMessages[]; pageParams: unknown[] }>(
        messageQueryKeys.infinite(conversationId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((msg) =>
                msg.id === context?.optimisticId ? newMessage : msg
              ),
            })),
          };
        }
      );

      // Update conversation's last message
      void queryClient.invalidateQueries({
        queryKey: conversationQueryKeys.detail(conversationId),
      });
      void queryClient.invalidateQueries({
        queryKey: conversationQueryKeys.lists(),
      });
    },
    onError: (_err, { conversationId }, context) => {
      // Remove optimistic message on error
      if (context?.optimisticId) {
        queryClient.setQueryData<{ pages: PaginatedMessages[]; pageParams: unknown[] }>(
          messageQueryKeys.infinite(conversationId),
          (old) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                messages: page.messages.filter((msg) => msg.id !== context.optimisticId),
              })),
            };
          }
        );
      }
    },
  });
}

/**
 * Delete a message
 */
export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId: _conversationId,
      messageId,
    }: {
      conversationId: string;
      messageId: string;
    }): Promise<Message> => {
      // API only takes messageId, conversationId is used for cache updates
      return deleteMessage(messageId);
    },
    onMutate: async ({ conversationId, messageId }) => {
      await queryClient.cancelQueries({
        queryKey: messageQueryKeys.infinite(conversationId),
      });

      // Snapshot
      const previousData = queryClient.getQueryData<{
        pages: PaginatedMessages[];
        pageParams: unknown[];
      }>(messageQueryKeys.infinite(conversationId));

      // Optimistically mark as deleted
      queryClient.setQueryData<{ pages: PaginatedMessages[]; pageParams: unknown[] }>(
        messageQueryKeys.infinite(conversationId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((msg) =>
                msg.id === messageId ? { ...msg, isDeleted: true, content: 'Message deleted' } : msg
              ),
            })),
          };
        }
      );

      return { previousData };
    },
    onError: (_err, { conversationId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(messageQueryKeys.infinite(conversationId), context.previousData);
      }
    },
    onSettled: (_, __, { conversationId }) => {
      void queryClient.invalidateQueries({
        queryKey: messageQueryKeys.infinite(conversationId),
      });
    },
  });
}

/**
 * Edit a message
 */
export function useEditMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId: _conversationId,
      messageId,
      content,
    }: {
      conversationId: string;
      messageId: string;
      content: string;
    }): Promise<Message> => {
      // API only takes messageId and content
      return editMessage(messageId, content);
    },
    onMutate: async ({ conversationId, messageId, content }) => {
      await queryClient.cancelQueries({
        queryKey: messageQueryKeys.infinite(conversationId),
      });

      const previousData = queryClient.getQueryData<{
        pages: PaginatedMessages[];
        pageParams: unknown[];
      }>(messageQueryKeys.infinite(conversationId));

      // Optimistically update
      queryClient.setQueryData<{ pages: PaginatedMessages[]; pageParams: unknown[] }>(
        messageQueryKeys.infinite(conversationId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((msg) =>
                msg.id === messageId
                  ? { ...msg, content, isEdited: true, editedAt: new Date().toISOString() }
                  : msg
              ),
            })),
          };
        }
      );

      return { previousData };
    },
    onError: (_err, { conversationId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(messageQueryKeys.infinite(conversationId), context.previousData);
      }
    },
    onSettled: (_, __, { conversationId }) => {
      void queryClient.invalidateQueries({
        queryKey: messageQueryKeys.infinite(conversationId),
      });
    },
  });
}

/**
 * Add reaction to a message
 */
export function useAddReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId: _conversationId,
      messageId,
      emoji,
    }: {
      conversationId: string;
      messageId: string;
      emoji: string;
    }): Promise<MessageReaction> => {
      // API only takes messageId and emoji
      return addReaction(messageId, emoji);
    },
    onMutate: async ({ conversationId, messageId, emoji }) => {
      await queryClient.cancelQueries({
        queryKey: messageQueryKeys.infinite(conversationId),
      });

      const previousData = queryClient.getQueryData<{
        pages: PaginatedMessages[];
        pageParams: unknown[];
      }>(messageQueryKeys.infinite(conversationId));

      // Optimistic reaction
      const newReaction: MessageReaction = {
        emoji,
        userId: 'current-user',
        userName: 'You',
        createdAt: new Date().toISOString(),
      };

      queryClient.setQueryData<{ pages: PaginatedMessages[]; pageParams: unknown[] }>(
        messageQueryKeys.infinite(conversationId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((msg) =>
                msg.id === messageId ? { ...msg, reactions: [...msg.reactions, newReaction] } : msg
              ),
            })),
          };
        }
      );

      return { previousData };
    },
    onError: (_err, { conversationId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(messageQueryKeys.infinite(conversationId), context.previousData);
      }
    },
  });
}

/**
 * Remove reaction from a message
 */
export function useRemoveReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId: _conversationId,
      messageId,
      emoji,
    }: {
      conversationId: string;
      messageId: string;
      emoji: string;
    }): Promise<void> => {
      // API only takes messageId and emoji
      return removeReaction(messageId, emoji);
    },
    onMutate: async ({ conversationId, messageId, emoji }) => {
      await queryClient.cancelQueries({
        queryKey: messageQueryKeys.infinite(conversationId),
      });

      const previousData = queryClient.getQueryData<{
        pages: PaginatedMessages[];
        pageParams: unknown[];
      }>(messageQueryKeys.infinite(conversationId));

      queryClient.setQueryData<{ pages: PaginatedMessages[]; pageParams: unknown[] }>(
        messageQueryKeys.infinite(conversationId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((msg) =>
                msg.id === messageId
                  ? {
                      ...msg,
                      reactions: msg.reactions.filter(
                        (r) => !(r.emoji === emoji && r.userId === 'current-user')
                      ),
                    }
                  : msg
              ),
            })),
          };
        }
      );

      return { previousData };
    },
    onError: (_err, { conversationId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(messageQueryKeys.infinite(conversationId), context.previousData);
      }
    },
  });
}

/**
 * Mark messages as read
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId }: { conversationId: string }): Promise<void> => {
      // API only takes conversationId
      return markAsRead(conversationId);
    },
    onSuccess: (_, { conversationId }) => {
      // Update unread count in conversation
      queryClient.setQueryData<Conversation>(conversationQueryKeys.detail(conversationId), (old) =>
        old ? { ...old, unreadCount: 0 } : old
      );

      // Update in list
      queryClient.setQueriesData<Conversation[]>(
        { queryKey: conversationQueryKeys.lists() },
        (old) => old?.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
      );
    },
  });
}

// ============================================================================
// Real-time Update Helpers
// ============================================================================

/**
 * Add a new message to cache (called from WebSocket handler)
 */
export function useAddMessageToCache() {
  const queryClient = useQueryClient();

  return useCallback(
    (message: Message) => {
      queryClient.setQueryData<{ pages: PaginatedMessages[]; pageParams: unknown[] }>(
        messageQueryKeys.infinite(message.conversationId),
        (old) => {
          if (!old) return old;

          // Check if message already exists
          const exists = old.pages.some((page) => page.messages.some((m) => m.id === message.id));
          if (exists) return old;

          // Add to first page (most recent)
          return {
            ...old,
            pages: old.pages.map((page, index) =>
              index === 0 ? { ...page, messages: [message, ...page.messages] } : page
            ),
          };
        }
      );

      // Update conversation last message
      void queryClient.invalidateQueries({
        queryKey: conversationQueryKeys.detail(message.conversationId),
      });
    },
    [queryClient]
  );
}

/**
 * Update a message in cache (called from WebSocket handler)
 */
export function useUpdateMessageInCache() {
  const queryClient = useQueryClient();

  return useCallback(
    (updatedMessage: Message) => {
      queryClient.setQueryData<{ pages: PaginatedMessages[]; pageParams: unknown[] }>(
        messageQueryKeys.infinite(updatedMessage.conversationId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((msg) =>
                msg.id === updatedMessage.id ? updatedMessage : msg
              ),
            })),
          };
        }
      );
    },
    [queryClient]
  );
}

/**
 * Remove a message from cache (called from WebSocket handler)
 */
export function useRemoveMessageFromCache() {
  const queryClient = useQueryClient();

  return useCallback(
    (conversationId: string, messageId: string) => {
      queryClient.setQueryData<{ pages: PaginatedMessages[]; pageParams: unknown[] }>(
        messageQueryKeys.infinite(conversationId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((msg) =>
                msg.id === messageId ? { ...msg, isDeleted: true, content: 'Message deleted' } : msg
              ),
            })),
          };
        }
      );
    },
    [queryClient]
  );
}
