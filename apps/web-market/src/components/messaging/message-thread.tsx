/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises, @typescript-eslint/no-misused-promises */
'use client';

import { Avatar, AvatarFallback, AvatarImage, Button, cn, Skeleton } from '@skillancer/ui';
import { ArrowDown, CheckCheck, Loader2, MoreVertical, Phone, Video } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { MessageBubble } from './message-bubble';
import { MessageInput } from './message-input';
import { SkillPodIndicator } from './skillpod-indicator';

import type { TypingUser } from '@/hooks/use-messaging';
import type { Message, Conversation, Participant } from '@/lib/api/messages';

// ============================================================================
// Types
// ============================================================================

interface MessageThreadProps {
  conversation: Conversation;
  messages: Message[];
  currentUserId: string;
  loading?: boolean;
  hasMore?: boolean;
  typingUsers?: TypingUser[];
  onLoadMore?: () => Promise<void>;
  onSendMessage: (content: string, attachments?: File[]) => Promise<void>;
  onEditMessage?: (messageId: string, content: string) => Promise<void>;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  onReactToMessage?: (messageId: string, emoji: string) => Promise<void>;
  onReplyToMessage?: (message: Message) => void;
  onTypingChange?: (isTyping: boolean) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatMessageDate(date: string): string {
  const messageDate = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (messageDate.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (messageDate.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return messageDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function shouldShowDateDivider(
  currentMessage: Message,
  previousMessage: Message | undefined
): boolean {
  if (!previousMessage) return true;

  const currentDate = new Date(currentMessage.createdAt).toDateString();
  const prevDate = new Date(previousMessage.createdAt).toDateString();

  return currentDate !== prevDate;
}

function shouldGroupMessages(
  currentMessage: Message,
  previousMessage: Message | undefined
): boolean {
  if (!previousMessage) return false;
  if (previousMessage.senderId !== currentMessage.senderId) return false;

  const timeDiff =
    new Date(currentMessage.createdAt).getTime() - new Date(previousMessage.createdAt).getTime();

  // Group messages within 2 minutes
  return timeDiff < 120000;
}

// ============================================================================
// Typing Indicator
// ============================================================================

interface TypingIndicatorProps {
  users: TypingUser[];
}

function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const names =
    users.length === 1
      ? users[0].userName
      : users.length === 2
        ? `${users[0].userName} and ${users[1].userName}`
        : `${users[0].userName} and ${users.length - 1} others`;

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="flex space-x-1">
        <span
          className="bg-muted-foreground h-2 w-2 animate-bounce rounded-full"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="bg-muted-foreground h-2 w-2 animate-bounce rounded-full"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="bg-muted-foreground h-2 w-2 animate-bounce rounded-full"
          style={{ animationDelay: '300ms' }}
        />
      </div>
      <span className="text-muted-foreground text-sm">{names} is typing...</span>
    </div>
  );
}

// ============================================================================
// Thread Header
// ============================================================================

interface ThreadHeaderProps {
  conversation: Conversation;
  currentUserId: string;
}

function ThreadHeader({ conversation, currentUserId }: ThreadHeaderProps) {
  const otherParticipant = conversation.participants.find((p) => p.userId !== currentUserId);

  const displayName = conversation.title || otherParticipant?.name || 'Unknown';
  const avatarUrl = otherParticipant?.avatarUrl;
  const isOnline = otherParticipant?.isOnline ?? false;
  const role = otherParticipant?.role;

  return (
    <div className="flex items-center justify-between border-b px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar className="h-10 w-10">
            <AvatarImage alt={displayName} src={avatarUrl} />
            <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
          </Avatar>
          {isOnline && (
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500 dark:border-gray-900" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{displayName}</h3>
            {role && (
              <span className="text-muted-foreground text-xs">
                {role === 'CLIENT' ? 'Client' : 'Freelancer'}
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {isOnline ? (
              <span className="text-green-600">Active now</span>
            ) : otherParticipant?.lastSeenAt ? (
              `Last seen ${new Date(otherParticipant.lastSeenAt).toLocaleString()}`
            ) : (
              'Offline'
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* SkillPod Indicator */}
        {conversation.context?.type === 'CONTRACT' && (
          <SkillPodIndicator contractId={conversation.context.id} size="sm" />
        )}

        <Button size="icon" title="Voice call" variant="ghost">
          <Phone className="h-5 w-5" />
        </Button>
        <Button size="icon" title="Video call" variant="ghost">
          <Video className="h-5 w-5" />
        </Button>
        <Button size="icon" title="More options" variant="ghost">
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Message List
// ============================================================================

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => Promise<void>;
  onEdit?: (messageId: string, content: string) => Promise<void>;
  onDelete?: (messageId: string) => Promise<void>;
  onReact?: (messageId: string, emoji: string) => Promise<void>;
  onReply?: (message: Message) => void;
}

function MessageList({
  messages,
  currentUserId,
  loading,
  hasMore,
  onLoadMore,
  onEdit,
  onDelete,
  onReact,
  onReply,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // Handle scroll position
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    setShowScrollButton(distanceFromBottom > 200);
    setAutoScroll(distanceFromBottom < 100);
  }, []);

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (autoScroll) {
      scrollToBottom(false);
    }
  }, [messages.length, autoScroll, scrollToBottom]);

  // Load more when scrolling to top
  const handleLoadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !onLoadMore) return;

    setLoadingMore(true);
    try {
      await onLoadMore();
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, onLoadMore]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTopReached = () => {
      if (container.scrollTop < 100 && hasMore && !loadingMore) {
        handleLoadMore();
      }
    };

    container.addEventListener('scroll', handleTopReached);
    return () => container.removeEventListener('scroll', handleTopReached);
  }, [hasMore, loadingMore, handleLoadMore]);

  return (
    <div className="relative flex-1 overflow-hidden">
      <div ref={containerRef} className="h-full overflow-y-auto px-4 py-4" onScroll={handleScroll}>
        {/* Load More */}
        {hasMore && (
          <div className="mb-4 flex justify-center">
            <Button disabled={loadingMore} size="sm" variant="ghost" onClick={handleLoadMore}>
              {loadingMore ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                'Load earlier messages'
              )}
            </Button>
          </div>
        )}

        {/* Messages */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={cn('flex gap-2', i % 2 === 0 ? 'justify-end' : '')}>
                {i % 2 !== 0 && <Skeleton className="h-8 w-8 rounded-full" />}
                <div className="space-y-1">
                  <Skeleton
                    className={cn(
                      'h-16 w-64 rounded-2xl',
                      i % 2 === 0 ? 'rounded-br-sm' : 'rounded-bl-sm'
                    )}
                  />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="text-muted-foreground mb-2 text-4xl">💬</div>
            <p className="text-muted-foreground">No messages yet</p>
            <p className="text-muted-foreground text-sm">Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((message, index) => {
              const previousMessage = index > 0 ? messages[index - 1] : undefined;
              const showDivider = shouldShowDateDivider(message, previousMessage);
              const isGrouped = shouldGroupMessages(message, previousMessage);
              const isOwn = message.senderId === currentUserId;

              return (
                <div key={message.id}>
                  {showDivider && (
                    <div className="my-4 flex items-center gap-4">
                      <div className="bg-border h-px flex-1" />
                      <span className="text-muted-foreground text-xs">
                        {formatMessageDate(message.createdAt)}
                      </span>
                      <div className="bg-border h-px flex-1" />
                    </div>
                  )}
                  <MessageBubble
                    isGrouped={isGrouped}
                    isOwn={isOwn}
                    message={message}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    onReact={onReact}
                    onReply={onReply ? () => onReply(message) : undefined}
                  />
                </div>
              );
            })}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <Button
          className="absolute bottom-4 right-4 rounded-full shadow-lg"
          size="icon"
          variant="secondary"
          onClick={() => scrollToBottom()}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function MessageThread({
  conversation,
  messages,
  currentUserId,
  loading,
  hasMore,
  typingUsers = [],
  onLoadMore,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onReactToMessage,
  onReplyToMessage,
  onTypingChange,
}: MessageThreadProps) {
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const handleReply = useCallback(
    (message: Message) => {
      setReplyingTo(message);
      onReplyToMessage?.(message);
    },
    [onReplyToMessage]
  );

  const handleSend = useCallback(
    async (content: string, attachments?: File[]) => {
      await onSendMessage(content, attachments);
      setReplyingTo(null);
    },
    [onSendMessage]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <ThreadHeader conversation={conversation} currentUserId={currentUserId} />

      {/* Messages */}
      <MessageList
        currentUserId={currentUserId}
        hasMore={hasMore}
        loading={loading}
        messages={messages}
        onDelete={onDeleteMessage}
        onEdit={onEditMessage}
        onLoadMore={onLoadMore}
        onReact={onReactToMessage}
        onReply={handleReply}
      />

      {/* Typing Indicator */}
      <TypingIndicator users={typingUsers} />

      {/* Input */}
      <MessageInput
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        onSend={handleSend}
        onTypingChange={onTypingChange}
      />
    </div>
  );
}
