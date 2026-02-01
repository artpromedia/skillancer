'use client';

import { Button } from '@skillancer/ui';
import { ArrowLeft, Search, Wifi, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ConversationActions } from '@/components/messaging/conversation-actions';
import { ConversationSearch } from '@/components/messaging/conversation-search';
import { MessageThread } from '@/components/messaging/message-thread';
import {
  useConversation,
  useMessages,
  useSendMessage,
  useDeleteMessage,
  useEditMessage,
  useAddReaction,
  useMarkAsRead,
  useArchiveConversation,
  useTogglePinConversation,
  useToggleMuteConversation,
} from '@/hooks/api';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import { blockUser, reportConversation } from '@/lib/api/messages';
import { useMarketAuth } from '@/lib/providers/auth-provider';

import type { Message } from '@/lib/api/messages';

// ============================================================================
// Page Component
// ============================================================================

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId as string;
  const { user } = useMarketAuth();
  const currentUserId = user?.id ?? '';

  // Track last read message for read receipts
  const lastReadMessageRef = useRef<string | null>(null);

  // UI State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // API Hooks
  const {
    conversation,
    isLoading: loadingConversation,
    error: conversationError,
  } = useConversation(conversationId);

  const {
    messages,
    isLoading: loadingMessages,
    hasMore,
    loadMore,
  } = useMessages({
    conversationId,
    enabled: !!conversationId,
    pageSize: 50,
  });

  // Real-time messaging hook
  const { connectionStatus, typingUsers, sendTyping, sendReadReceipt, isConnected } =
    useRealtimeMessages({
      conversationId,
      currentUserId,
      autoConnect: true,
      debug: process.env.NODE_ENV === 'development',
    });

  // Conversation action mutations
  const archiveMutation = useArchiveConversation();
  const pinMutation = useTogglePinConversation();
  const muteMutation = useToggleMuteConversation();

  // Message mutation hooks
  const sendMessageMutation = useSendMessage();
  const deleteMessageMutation = useDeleteMessage();
  const editMessageMutation = useEditMessage();
  const addReactionMutation = useAddReaction();
  const markAsReadMutation = useMarkAsRead();

  // Mark messages as read when conversation loads and send read receipt
  useEffect(() => {
    if (conversation && conversation.unreadCount > 0) {
      markAsReadMutation.mutate({ conversationId });
    }
  }, [conversation, conversationId, markAsReadMutation]);

  // Send read receipt for the latest message when messages are loaded
  useEffect(() => {
    if (messages.length > 0 && isConnected) {
      const lastMessage = messages[messages.length - 1];
      // Only send read receipt if it's from another user and not already read
      if (
        lastMessage &&
        lastMessage.senderId !== currentUserId &&
        lastMessage.id !== lastReadMessageRef.current
      ) {
        lastReadMessageRef.current = lastMessage.id;
        sendReadReceipt(lastMessage.id);
      }
    }
  }, [messages, currentUserId, isConnected, sendReadReceipt]);

  const handleSendMessage = useCallback(
    async (content: string, attachments?: File[]) => {
      await sendMessageMutation.mutateAsync({
        conversationId,
        data: {
          content,
          type: 'TEXT',
          attachments,
        },
        optimisticId: `temp-${Date.now()}`,
      });
    },
    [conversationId, sendMessageMutation]
  );

  const handleEditMessage = useCallback(
    async (messageId: string, content: string) => {
      await editMessageMutation.mutateAsync({
        conversationId,
        messageId,
        content,
      });
    },
    [conversationId, editMessageMutation]
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      await deleteMessageMutation.mutateAsync({
        conversationId,
        messageId,
      });
    },
    [conversationId, deleteMessageMutation]
  );

  const handleReactToMessage = useCallback(
    async (messageId: string, emoji: string) => {
      await addReactionMutation.mutateAsync({
        conversationId,
        messageId,
        emoji,
      });
    },
    [conversationId, addReactionMutation]
  );

  const handleTypingChange = useCallback(
    (isTyping: boolean) => {
      // Send typing indicator via WebSocket using the realtime hook
      sendTyping(isTyping);
    },
    [sendTyping]
  );

  // Conversation action handlers
  const handleArchive = useCallback(async () => {
    await archiveMutation.mutateAsync(conversationId);
    router.push('/dashboard/messages');
  }, [archiveMutation, conversationId, router]);

  const handleBlock = useCallback(
    async (userId: string) => {
      await blockUser(userId);
      router.push('/dashboard/messages');
    },
    [router]
  );

  const handlePin = useCallback(async () => {
    await pinMutation.mutateAsync(conversationId);
  }, [pinMutation, conversationId]);

  const handleMute = useCallback(async () => {
    await muteMutation.mutateAsync(conversationId);
  }, [muteMutation, conversationId]);

  const handleReport = useCallback(
    async (reason: string, description?: string) => {
      await reportConversation(conversationId, reason, description ?? '');
    },
    [conversationId]
  );

  const handleSearchResultSelect = useCallback((message: Message) => {
    // Highlight the message and scroll to it
    setHighlightedMessageId(message.id);
    // Clear highlight after animation
    setTimeout(() => setHighlightedMessageId(null), 2000);
  }, []);

  // Get the other participant for block action
  const otherParticipant = conversation?.participants.find((p) => p.userId !== currentUserId);

  const loading = loadingConversation || loadingMessages;

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-muted-foreground">Loading conversation...</div>
      </div>
    );
  }

  if (conversationError || !conversation) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center">
        <div className="text-muted-foreground mb-4 text-6xl">🔍</div>
        <h2 className="text-xl font-semibold">Conversation not found</h2>
        <p className="text-muted-foreground mt-1">
          This conversation may have been deleted or you don&apos;t have access.
        </p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/messages">Back to Messages</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header with Actions */}
      <div className="flex items-center justify-between border-b p-2">
        {/* Back Button (mobile) */}
        <div className="flex items-center gap-2">
          <Button
            className="sm:hidden"
            size="sm"
            variant="ghost"
            onClick={() => router.push('/dashboard/messages')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {/* Conversation Title (desktop) */}
          <div className="hidden sm:block">
            <h1 className="font-semibold">
              {conversation.title || otherParticipant?.name || 'Conversation'}
            </h1>
            {otherParticipant?.name && conversation.title && (
              <p className="text-muted-foreground text-sm">with {otherParticipant.name}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Connection Status */}
          {isConnected ? (
            <Wifi className="text-muted-foreground h-4 w-4" />
          ) : (
            <WifiOff className="text-muted-foreground h-4 w-4" />
          )}

          {/* Search Toggle */}
          <Button
            size="sm"
            variant={isSearchOpen ? 'secondary' : 'ghost'}
            onClick={() => setIsSearchOpen(!isSearchOpen)}
          >
            <Search className="h-4 w-4" />
          </Button>

          {/* Conversation Actions */}
          <ConversationActions
            conversation={conversation}
            onArchive={handleArchive}
            onBlock={otherParticipant ? () => handleBlock(otherParticipant.userId) : undefined}
            onMute={handleMute}
            onPin={handlePin}
            onReport={handleReport}
            onSearch={() => setIsSearchOpen(true)}
          />
        </div>
      </div>

      {/* Search Bar */}
      <ConversationSearch
        isOpen={isSearchOpen}
        messages={messages}
        placeholder="Search in conversation..."
        onClose={() => setIsSearchOpen(false)}
        onResultSelect={handleSearchResultSelect}
      />

      {/* Connection Status Banner (when disconnected) */}
      {connectionStatus === 'RECONNECTING' && (
        <div className="bg-yellow-50 px-4 py-2 text-center text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
          Reconnecting to real-time messaging...
        </div>
      )}
      {connectionStatus === 'ERROR' && (
        <div className="bg-red-50 px-4 py-2 text-center text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
          Unable to connect to real-time messaging. Messages may be delayed.
        </div>
      )}

      {/* Message Thread */}
      <div className="flex-1 overflow-hidden">
        <MessageThread
          conversation={conversation}
          currentUserId={currentUserId}
          hasMore={hasMore}
          highlightedMessageId={highlightedMessageId}
          loading={loadingMessages}
          messages={messages}
          typingUsers={typingUsers}
          onDeleteMessage={handleDeleteMessage}
          onEditMessage={handleEditMessage}
          onLoadMore={loadMore}
          onReactToMessage={handleReactToMessage}
          onSendMessage={handleSendMessage}
          onTypingChange={handleTypingChange}
        />
      </div>
    </div>
  );
}
