/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises, jsx-a11y/alt-text */
'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  cn,
  Input,
  Skeleton,
} from '@skillancer/ui';
import {
  Archive,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  FileText,
  Image,
  MessageSquare,
  Mic,
  MoreVertical,
  Pin,
  PinOff,
  Search,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import type { Conversation, Message, MessageType } from '@/lib/api/messages';

// ============================================================================
// Types
// ============================================================================

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId?: string;
  loading?: boolean;
  onSelectConversation: (conversationId: string) => void;
  onPinConversation?: (conversationId: string, pinned: boolean) => Promise<void>;
  onMuteConversation?: (conversationId: string, muted: boolean) => Promise<void>;
  onArchiveConversation?: (conversationId: string) => Promise<void>;
  onDeleteConversation?: (conversationId: string) => Promise<void>;
  currentUserId: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getMessagePreview(message: Message | undefined, currentUserId: string): string {
  if (!message) return 'No messages yet';

  if (message.isDeleted) return 'Message deleted';

  const prefix = message.senderId === currentUserId ? 'You: ' : '';

  switch (message.type) {
    case 'IMAGE':
      return `${prefix}📷 Photo`;
    case 'FILE':
      return `${prefix}📎 ${message.attachments[0]?.name || 'File'}`;
    case 'VOICE':
      return `${prefix}🎤 Voice message`;
    case 'SYSTEM':
      return message.content;
    case 'CONTRACT_EVENT':
      return `📋 ${message.content}`;
    default:
      return `${prefix}${message.content}`;
  }
}

function getMessageIcon(type: MessageType | undefined) {
  switch (type) {
    case 'IMAGE':
      return <Image className="h-3 w-3" />;
    case 'FILE':
      return <FileText className="h-3 w-3" />;
    case 'VOICE':
      return <Mic className="h-3 w-3" />;
    default:
      return null;
  }
}

function formatRelativeTime(date: string): string {
  const now = new Date();
  const messageDate = new Date(date);
  const diffMs = now.getTime() - messageDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return messageDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ============================================================================
// Conversation Item
// ============================================================================

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  currentUserId: string;
  onSelect: () => void;
  onPin?: (pinned: boolean) => Promise<void>;
  onMute?: (muted: boolean) => Promise<void>;
  onArchive?: () => Promise<void>;
  onDelete?: () => Promise<void>;
}

function getMessageStatusIcon(status: string) {
  if (status === 'READ') return <CheckCheck className="h-4 w-4 text-blue-500" />;
  if (status === 'DELIVERED') return <CheckCheck className="text-muted-foreground h-4 w-4" />;
  return <Check className="text-muted-foreground h-4 w-4" />;
}

function getEmptyStateMessage(searchQuery: string, filter: string): string {
  if (searchQuery) return 'No conversations found';
  if (filter === 'unread') return 'No unread messages';
  if (filter === 'pinned') return 'No pinned conversations';
  return 'No conversations yet';
}

function ConversationItem({
  conversation,
  isActive,
  currentUserId,
  onSelect,
  onPin,
  onMute,
  onArchive,
  onDelete,
}: Readonly<ConversationItemProps>) {
  const [showMenu, setShowMenu] = useState(false);

  const otherParticipant = conversation.participants.find((p) => p.userId !== currentUserId);
  const displayName = conversation.title || otherParticipant?.name || 'Unknown';
  const avatarUrl = otherParticipant?.avatarUrl;
  const isOnline = otherParticipant?.isOnline ?? false;

  const lastMessage = conversation.lastMessage;
  const preview = getMessagePreview(lastMessage, currentUserId);
  const timeAgo = lastMessage ? formatRelativeTime(lastMessage.createdAt) : '';

  const isRead =
    !lastMessage || lastMessage.senderId === currentUserId || lastMessage.status === 'READ';

  return (
    <div className="relative">
      <button
        className={cn(
          'flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors',
          isActive ? 'bg-primary/10' : 'hover:bg-muted/50',
          !isRead && 'bg-muted/30'
        )}
        type="button"
        onClick={onSelect}
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <Avatar className="h-12 w-12">
            <AvatarImage alt={displayName} src={avatarUrl} />
            <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
          </Avatar>
          {isOnline && (
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500 dark:border-gray-900" />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className={cn('truncate font-medium', !isRead && 'font-semibold')}>
                {displayName}
              </span>
              {conversation.isPinned && <Pin className="text-muted-foreground h-3 w-3" />}
              {conversation.isMuted && <BellOff className="text-muted-foreground h-3 w-3" />}
            </div>
            <span className="text-muted-foreground flex-shrink-0 text-xs">{timeAgo}</span>
          </div>

          <div className="mt-0.5 flex items-center justify-between gap-2">
            <p
              className={cn(
                'text-muted-foreground truncate text-sm',
                !isRead && 'text-foreground font-medium'
              )}
            >
              {preview}
            </p>
            <div className="flex items-center gap-1">
              {/* Message Status */}
              {lastMessage?.senderId === currentUserId && (
                <span className="text-muted-foreground flex-shrink-0">
                  {getMessageStatusIcon(lastMessage.status)}
                </span>
              )}
              {/* Unread Badge */}
              {conversation.unreadCount > 0 && (
                <Badge className="bg-primary h-5 min-w-[20px] justify-center px-1.5 text-xs">
                  {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                </Badge>
              )}
            </div>
          </div>

          {/* Context Badge */}
          {conversation.context && (
            <div className="mt-1">
              <Badge className="text-xs" variant="outline">
                {conversation.context.type === 'JOB' && '💼'}
                {conversation.context.type === 'CONTRACT' && '📋'}
                {conversation.context.type === 'PROPOSAL' && '📝'}
                <span className="ml-1 truncate">{conversation.context.title}</span>
              </Badge>
            </div>
          )}
        </div>

        {/* Menu Button */}
        <button
          className="text-muted-foreground hover:text-foreground -mr-1 flex-shrink-0 p-1 opacity-0 transition-opacity group-hover:opacity-100"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <div
          className="absolute right-2 top-12 z-10 w-48 rounded-lg border bg-white py-1 shadow-lg dark:bg-gray-900"
          role="menu"
          tabIndex={-1}
          onBlur={() => setShowMenu(false)}
          onMouseLeave={() => setShowMenu(false)}
        >
          {onPin && (
            <button
              className="hover:bg-muted flex w-full items-center gap-2 px-3 py-2 text-sm"
              type="button"
              onClick={() => {
                onPin(!conversation.isPinned);
                setShowMenu(false);
              }}
            >
              {conversation.isPinned ? (
                <>
                  <PinOff className="h-4 w-4" /> Unpin
                </>
              ) : (
                <>
                  <Pin className="h-4 w-4" /> Pin
                </>
              )}
            </button>
          )}
          {onMute && (
            <button
              className="hover:bg-muted flex w-full items-center gap-2 px-3 py-2 text-sm"
              type="button"
              onClick={() => {
                onMute(!conversation.isMuted);
                setShowMenu(false);
              }}
            >
              {conversation.isMuted ? (
                <>
                  <Bell className="h-4 w-4" /> Unmute
                </>
              ) : (
                <>
                  <BellOff className="h-4 w-4" /> Mute
                </>
              )}
            </button>
          )}
          {onArchive && (
            <button
              className="hover:bg-muted flex w-full items-center gap-2 px-3 py-2 text-sm"
              type="button"
              onClick={() => {
                onArchive();
                setShowMenu(false);
              }}
            >
              <Archive className="h-4 w-4" /> Archive
            </button>
          )}
          {onDelete && (
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
              type="button"
              onClick={() => {
                onDelete();
                setShowMenu(false);
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function ConversationSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-8" />
        </div>
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ConversationList({
  conversations,
  activeConversationId,
  loading,
  onSelectConversation,
  onPinConversation,
  onMuteConversation,
  onArchiveConversation,
  onDeleteConversation,
  currentUserId,
}: Readonly<ConversationListProps>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'pinned'>('all');

  const filteredConversations = useMemo(() => {
    let result = conversations;

    // Apply filter
    switch (filter) {
      case 'unread':
        result = result.filter((c) => c.unreadCount > 0);
        break;
      case 'pinned':
        result = result.filter((c) => c.isPinned);
        break;
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((c) => {
        const participantMatch = c.participants.some((p) => p.name.toLowerCase().includes(query));
        const titleMatch = c.title?.toLowerCase().includes(query);
        const contextMatch = c.context?.title.toLowerCase().includes(query);
        return participantMatch || titleMatch || contextMatch;
      });
    }

    // Sort: pinned first, then by last message date
    return result.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const aDate = a.lastMessage?.createdAt || a.createdAt;
      const bDate = b.lastMessage?.createdAt || b.createdAt;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
  }, [conversations, filter, searchQuery]);

  const unreadCount = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MessageSquare className="h-5 w-5" />
            Messages
            {unreadCount > 0 && <Badge variant="secondary">{unreadCount}</Badge>}
          </h2>
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant={filter === 'all' ? 'secondary' : 'ghost'}
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={filter === 'unread' ? 'secondary' : 'ghost'}
            onClick={() => setFilter('unread')}
          >
            Unread
            {unreadCount > 0 && (
              <Badge className="ml-1" variant="destructive">
                {unreadCount}
              </Badge>
            )}
          </Button>
          <Button
            size="sm"
            variant={filter === 'pinned' ? 'secondary' : 'ghost'}
            onClick={() => setFilter('pinned')}
          >
            <Pin className="mr-1 h-3 w-3" />
            Pinned
          </Button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="space-y-1 p-2">
            {Array.from({ length: 5 }, (_, i) => `skeleton-${i}`).map((id) => (
              <ConversationSkeleton key={id} />
            ))}
          </div>
        )}
        {!loading && filteredConversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="text-muted-foreground mb-3 h-12 w-12" />
            <p className="text-muted-foreground">{getEmptyStateMessage(searchQuery, filter)}</p>
          </div>
        )}
        {!loading && filteredConversations.length > 0 && (
          <div className="space-y-1 p-2">
            {filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                currentUserId={currentUserId}
                isActive={conversation.id === activeConversationId}
                onArchive={
                  onArchiveConversation ? () => onArchiveConversation(conversation.id) : undefined
                }
                onDelete={
                  onDeleteConversation ? () => onDeleteConversation(conversation.id) : undefined
                }
                onMute={
                  onMuteConversation
                    ? (muted) => onMuteConversation(conversation.id, muted)
                    : undefined
                }
                onPin={
                  onPinConversation
                    ? (pinned) => onPinConversation(conversation.id, pinned)
                    : undefined
                }
                onSelect={() => onSelectConversation(conversation.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
