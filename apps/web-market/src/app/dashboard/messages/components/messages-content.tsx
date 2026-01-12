/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
'use client';

import { cn } from '@skillancer/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';


import { ConversationList } from '@/components/messaging/conversation-list';
import { MessageThread } from '@/components/messaging/message-thread';
import {
  getConversations,
  getMessages,
  sendMessage,
  togglePinConversation,
  toggleMuteConversation,
} from '@/lib/api/messages';

import type { Conversation, Message } from '@/lib/api/messages';

// Current user ID - in production this would come from auth context
const CURRENT_USER_ID = 'current-user';

// ============================================================================
// Messages Page Content
// ============================================================================

function MessagesPageContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const contractId = searchParams.get('contract');

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Fetch conversations
  const {
    data: conversations = [],
    isLoading: isLoadingConversations,
    error: conversationsError,
  } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => getConversations(),
  });

  // Fetch messages for active conversation
  const {
    data: messagesData,
    isLoading: isLoadingMessages,
  } = useQuery({
    queryKey: ['messages', activeConversationId],
    queryFn: () => getMessages(activeConversationId!),
    enabled: !!activeConversationId,
  });

  const messages = messagesData?.messages || [];

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, attachments }: { content: string; attachments?: File[] }) => {
      if (!activeConversationId) throw new Error('No active conversation');
      return sendMessage(activeConversationId, { content, attachments });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', activeConversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Pin/mute mutations
  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      togglePinConversation(id, pinned),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const muteMutation = useMutation({
    mutationFn: ({ id, muted }: { id: string; muted: boolean }) =>
      toggleMuteConversation(id, muted),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Find conversation by contract ID
  useEffect(() => {
    if (contractId && conversations.length > 0) {
      const conv = conversations.find((c) => c.context?.id === contractId);
      if (conv) {
        setActiveConversationId(conv.id);
      }
    }
  }, [contractId, conversations]);

  const handleSelectConversation = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId);
  }, []);

  const handleSendMessage = useCallback(
    async (content: string, attachments?: File[]) => {
      if (!activeConversationId) return;
      sendMessageMutation.mutate({ content, attachments });
    },
    [activeConversationId, sendMessageMutation]
  );

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  // Loading state
  if (isLoadingConversations) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-muted-foreground">Loading conversations...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (conversationsError) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h3 className="mb-2 text-lg font-semibold">Failed to load messages</h3>
          <p className="text-muted-foreground">
            {conversationsError instanceof Error
              ? conversationsError.message
              : 'An unexpected error occurred'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar - Conversation List */}
      <div
        className={cn(
          'w-full flex-shrink-0 border-r sm:w-80 lg:w-96',
          activeConversationId && 'hidden sm:block'
        )}
      >
        <ConversationList
          activeConversationId={activeConversationId || undefined}
          conversations={conversations}
          currentUserId={CURRENT_USER_ID}
          loading={false}
          onMuteConversation={async (id, muted) => {
            muteMutation.mutate({ id, muted });
          }}
          onPinConversation={async (id, pinned) => {
            pinMutation.mutate({ id, pinned });
          }}
          onSelectConversation={handleSelectConversation}
        />
      </div>

      {/* Main Content - Message Thread */}
      <div className="flex-1">
        {activeConversation ? (
          <MessageThread
            conversation={activeConversation}
            currentUserId={CURRENT_USER_ID}
            hasMore={messagesData?.hasMore || false}
            loading={isLoadingMessages}
            messages={messages}
            onDeleteMessage={async (messageId) => {
              // Feature: Delete message via API - to be implemented
              console.log('Delete message:', messageId);
            }}
            onEditMessage={async (messageId, content) => {
              // Feature: Edit message via API - to be implemented
              console.log('Edit message:', messageId, content);
            }}
            onReactToMessage={async (messageId, emoji) => {
              // Feature: React to message via API - to be implemented
              console.log('React to message:', messageId, emoji);
            }}
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
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Exported Component
// ============================================================================

export function MessagesContent() {
  return (
    <Suspense
      fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}
    >
      <MessagesPageContent />
    </Suspense>
  );
}
