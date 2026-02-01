/**
 * Messaging API Hooks
 *
 * Re-exports all messaging-related TanStack Query hooks.
 */

// Conversations
export {
  useConversations,
  useConversation,
  useCreateConversation,
  useUpdateConversation,
  useArchiveConversation,
  useTogglePinConversation,
  useToggleMuteConversation,
  usePrefetchConversation,
  useUpdateUnreadCount,
  conversationQueryKeys,
  type UseConversationsOptions,
  type UseConversationOptions,
  type UseConversationsReturn,
  type UseConversationReturn,
  type CreateConversationData,
  type UpdateConversationData,
} from './use-conversations';

// Messages
export {
  useMessages,
  useSendMessage,
  useDeleteMessage,
  useEditMessage,
  useAddReaction,
  useRemoveReaction,
  useMarkAsRead,
  useAddMessageToCache,
  useUpdateMessageInCache,
  useRemoveMessageFromCache,
  messageQueryKeys,
  type UseMessagesOptions,
  type UseMessagesReturn,
} from './use-messages';
