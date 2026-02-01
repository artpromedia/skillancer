'use client';

import { Button, cn } from '@skillancer/ui';
import { Plus } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { ConversationList } from '@/components/messaging/conversation-list';
import { NewConversationModal } from '@/components/messaging/conversation-starter';
import { MessageThread } from '@/components/messaging/message-thread';
import {
  useConversations,
  useMessages,
  useSendMessage,
  useDeleteMessage,
  useEditMessage,
  useAddReaction,
  useTogglePinConversation,
  useToggleMuteConversation,
  useMarkAsRead,
} from '@/hooks/api';
import { useMarketAuth } from '@/lib/providers/auth-provider';

// ============================================================================
// Messages Page Content
// ============================================================================

function MessagesPageContent() {
  const searchParams = useSearchParams();
  const contractId = searchParams.get('contract');
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const { user } = useMarketAuth();
  const currentUserId = user?.id ?? '';

  // Local state
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);

  // API Hooks
  const { conversations, isLoading: loadingConversations } = useConversations();

  const {
    messages,
    isLoading: loadingMessages,
    hasMore,
    loadMore,
  } = useMessages({
    conversationId: activeConversationId || '',
    enabled: !!activeConversationId,
    pageSize: 50,
  });

  // Mutation hooks
  const sendMessageMutation = useSendMessage();
  const deleteMessageMutation = useDeleteMessage();
  const editMessageMutation = useEditMessage();
  const addReactionMutation = useAddReaction();
  const togglePinMutation = useTogglePinConversation();
  const toggleMuteMutation = useToggleMuteConversation();
  const markAsReadMutation = useMarkAsRead();

  // Find conversation by contract ID
  useEffect(() => {
    if (contractId && conversations.length > 0) {
      const conv = conversations.find((c) => c.context?.id === contractId);
      if (conv) {
        setActiveConversationId(conv.id);
      }
    }
  }, [contractId, conversations]);

  // Mark messages as read when conversation is selected
  useEffect(() => {
    if (activeConversationId) {
      const conversation = conversations.find((c) => c.id === activeConversationId);
      if (conversation && conversation.unreadCount > 0) {
        markAsReadMutation.mutate({ conversationId: activeConversationId });
      }
    }
  }, [activeConversationId, conversations, markAsReadMutation]);

  // Scroll-up pagination for older messages
  const handleScroll = useCallback(() => {
    const container = messageContainerRef.current;
    if (!container) return;

    // Load more when scrolled near top (100px threshold)
    if (container.scrollTop < 100 && hasMore) {
      loadMore().catch(console.error);
    }
  }, [hasMore, loadMore]);

  const handleSelectConversation = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId);
  }, []);

  const handleSendMessage = useCallback(
    async (content: string, attachments?: File[]) => {
      if (!activeConversationId) return;

      await sendMessageMutation.mutateAsync({
        conversationId: activeConversationId,
        data: {
          content,
          type: 'TEXT',
          attachments,
        },
        optimisticId: `temp-${Date.now()}`,
      });
    },
    [activeConversationId, sendMessageMutation]
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!activeConversationId) return;
      await deleteMessageMutation.mutateAsync({
        conversationId: activeConversationId,
        messageId,
      });
    },
    [activeConversationId, deleteMessageMutation]
  );

  const handleEditMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!activeConversationId) return;
      await editMessageMutation.mutateAsync({
        conversationId: activeConversationId,
        messageId,
        content,
      });
    },
    [activeConversationId, editMessageMutation]
  );

  const handleReactToMessage = useCallback(
    async (messageId: string, emoji: string) => {
      if (!activeConversationId) return;
      await addReactionMutation.mutateAsync({
        conversationId: activeConversationId,
        messageId,
        emoji,
      });
    },
    [activeConversationId, addReactionMutation]
  );

  const handlePinConversation = useCallback(
    async (conversationId: string, _pinned: boolean) => {
      await togglePinMutation.mutateAsync(conversationId);
    },
    [togglePinMutation]
  );

  const handleMuteConversation = useCallback(
    async (conversationId: string, _muted: boolean) => {
      await toggleMuteMutation.mutateAsync(conversationId);
    },
    [toggleMuteMutation]
  );

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar - Conversation List */}
      <div
        className={cn(
          'w-full flex-shrink-0 border-r sm:w-80 lg:w-96',
          activeConversationId && 'hidden sm:block'
        )}
      >
        {/* New Conversation Header */}
        <div className="flex items-center justify-between border-b p-3">
          <h2 className="font-semibold">Messages</h2>
          <Button size="sm" variant="outline" onClick={() => setIsNewConversationOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            New
          </Button>
        </div>

        <ConversationList
          activeConversationId={activeConversationId || undefined}
          conversations={conversations}
          currentUserId={currentUserId}
          loading={loadingConversations}
          onMuteConversation={handleMuteConversation}
          onPinConversation={handlePinConversation}
          onSelectConversation={handleSelectConversation}
        />
      </div>

      {/* Main Content - Message Thread */}
      <div ref={messageContainerRef} className="flex-1" onScroll={handleScroll}>
        {activeConversation ? (
          <MessageThread
            conversation={activeConversation}
            currentUserId={currentUserId}
            hasMore={hasMore}
            loading={loadingMessages}
            messages={messages}
            onDeleteMessage={handleDeleteMessage}
            onEditMessage={handleEditMessage}
            onLoadMore={loadMore}
            onReactToMessage={handleReactToMessage}
            onSendMessage={handleSendMessage}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="text-muted-foreground mb-4 text-6xl">💬</div>
            <h2 className="text-xl font-semibold">Your Messages</h2>
            <p className="text-muted-foreground mt-1 max-w-md">
              Select a conversation from the list to start messaging, or messages will appear here
              when clients contact you.
            </p>
            <Button className="mt-4" onClick={() => setIsNewConversationOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Start a Conversation
            </Button>
          </div>
        )}
      </div>

      {/* New Conversation Modal */}
      <NewConversationModal
        contacts={[]} // Would be populated with contacts from API
        isOpen={isNewConversationOpen}
        onClose={() => setIsNewConversationOpen(false)}
      />
    </div>
  );
}

// ============================================================================
// Page Component
// ============================================================================

export default function MessagesPage() {
  return (
    <Suspense
      fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}
    >
      <MessagesPageContent />
    </Suspense>
  );
}
