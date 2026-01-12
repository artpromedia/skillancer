/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await, no-console */
'use client';

import { Button } from '@skillancer/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { MessageThread } from '@/components/messaging/message-thread';
import {
  getConversationById,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  addReaction,
} from '@/lib/api/messages';

import type { TypingUser } from '@/hooks/use-messaging';
import type { Conversation, Message } from '@/lib/api/messages';

// Current user ID - in production this would come from auth context
const CURRENT_USER_ID = 'current-user';

// ============================================================================
// Page Component
// ============================================================================

export function ConversationContent() {
  const queryClient = useQueryClient();
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId as string;

  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  // Fetch conversation
  const {
    data: conversation,
    isLoading: isLoadingConversation,
    error: conversationError,
  } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => getConversationById(conversationId),
    enabled: !!conversationId,
  });

  // Fetch messages
  const {
    data: messagesData,
    isLoading: isLoadingMessages,
  } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => getMessages(conversationId),
    enabled: !!conversationId,
  });

  const messages = messagesData?.messages || [];

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, attachments }: { content: string; attachments?: File[] }) => {
      return sendMessage(conversationId, { content, attachments });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
    },
  });

  // Edit message mutation
  const editMessageMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      return editMessage(messageId, content);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    },
  });

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return deleteMessage(messageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    },
  });

  // React to message mutation
  const reactMutation = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      return addReaction(messageId, emoji);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    },
  });

  const handleSendMessage = useCallback(
    async (content: string, attachments?: File[]) => {
      sendMessageMutation.mutate({ content, attachments });
    },
    [sendMessageMutation]
  );

  const handleEditMessage = useCallback(
    async (messageId: string, content: string) => {
      editMessageMutation.mutate({ messageId, content });
    },
    [editMessageMutation]
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      deleteMessageMutation.mutate(messageId);
    },
    [deleteMessageMutation]
  );

  const handleReactToMessage = useCallback(
    async (messageId: string, emoji: string) => {
      reactMutation.mutate({ messageId, emoji });
    },
    [reactMutation]
  );

  const loading = isLoadingConversation || isLoadingMessages;

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-muted-foreground">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (conversationError) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center">
        <AlertCircle className="mb-4 h-12 w-12 text-red-500" />
        <h2 className="text-xl font-semibold">Failed to load conversation</h2>
        <p className="text-muted-foreground mt-1">
          {conversationError instanceof Error
            ? conversationError.message
            : 'An unexpected error occurred'}
        </p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/messages">Back to Messages</Link>
        </Button>
      </div>
    );
  }

  if (!conversation) {
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
      {/* Mobile Back Button */}
      <div className="border-b p-2 sm:hidden">
        <Button size="sm" variant="ghost" onClick={() => router.push('/dashboard/messages')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Messages
        </Button>
      </div>

      {/* Message Thread */}
      <div className="flex-1 overflow-hidden">
        <MessageThread
          conversation={conversation}
          currentUserId={CURRENT_USER_ID}
          hasMore={messagesData?.hasMore || false}
          loading={false}
          messages={messages}
          typingUsers={typingUsers}
          onDeleteMessage={handleDeleteMessage}
          onEditMessage={handleEditMessage}
          onLoadMore={async () => {
            // Feature: Load more messages via pagination - not yet implemented
          }}
          onReactToMessage={handleReactToMessage}
          onSendMessage={handleSendMessage}
          onTypingChange={(_isTyping) => {
            // Feature: Send typing indicator via WebSocket - not yet implemented
          }}
        />
      </div>
    </div>
  );
}
