/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises, @typescript-eslint/no-misused-promises, jsx-a11y/no-autofocus, @next/next/no-img-element */
'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@skillancer/ui';
import {
  Copy,
  Download,
  Edit,
  ExternalLink,
  File,
  Mic,
  MoreVertical,
  Play,
  Reply,
  Smile,
  Trash2,
} from 'lucide-react';
import { useCallback, useState } from 'react';

import { StatusIcon } from './read-receipts';

import type { Message, MessageAttachment, MessageReaction, LinkPreview } from '@/lib/api/messages';

// ============================================================================
// Types
// ============================================================================

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  isGrouped?: boolean | undefined;
  onEdit?: ((messageId: string, content: string) => Promise<void>) | undefined;
  onDelete?: ((messageId: string) => Promise<void>) | undefined;
  onReact?: ((messageId: string, emoji: string) => Promise<void>) | undefined;
  onReply?: (() => void) | undefined;
}

// ============================================================================
// Quick Reactions
// ============================================================================

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

interface QuickReactionsProps {
  onReact: (emoji: string) => void;
  onClose: () => void;
}

function QuickReactions({ onReact, onClose }: Readonly<QuickReactionsProps>) {
  return (
    <div
      aria-label="Quick reactions"
      className="flex items-center gap-0.5 rounded-full border bg-white px-1 py-0.5 shadow-lg dark:bg-gray-900"
      role="toolbar"
      onBlur={onClose}
      onMouseLeave={onClose}
    >
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          className="hover:bg-muted rounded-full p-1.5 text-lg transition-colors hover:scale-125"
          type="button"
          onClick={() => onReact(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Attachment Renderer
// ============================================================================

interface AttachmentRendererProps {
  attachment: MessageAttachment;
  isOwn: boolean;
}

function AttachmentRenderer({ attachment, isOwn }: Readonly<AttachmentRendererProps>) {
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Image
  if (attachment.type.startsWith('image/')) {
    return (
      <a
        className="group relative block overflow-hidden rounded-lg"
        href={attachment.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        <img
          alt={attachment.name}
          className="max-h-64 max-w-full object-cover transition-opacity group-hover:opacity-90"
          loading="lazy"
          src={attachment.thumbnail || attachment.url}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <ExternalLink className="h-6 w-6 text-white" />
        </div>
      </a>
    );
  }

  // Voice
  if (attachment.type.startsWith('audio/')) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-white/10 p-2">
        <Button className="h-10 w-10 rounded-full" size="icon" variant="ghost">
          <Play className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="bg-muted-foreground/30 h-1 rounded-full">
            <div className="bg-primary h-full w-0 rounded-full" />
          </div>
          {attachment.duration && (
            <span className="text-xs opacity-70">{formatDuration(attachment.duration)}</span>
          )}
        </div>
        <Mic className="h-4 w-4 opacity-50" />
      </div>
    );
  }

  // File
  return (
    <a
      className={cn(
        'flex items-center gap-3 rounded-lg p-2 transition-colors',
        isOwn ? 'bg-white/10 hover:bg-white/20' : 'bg-muted/50 hover:bg-muted'
      )}
      href={attachment.url}
      rel="noopener noreferrer"
      target="_blank"
    >
      <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
        <File className="text-primary h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.name}</p>
        <p className="text-xs opacity-70">{formatFileSize(attachment.size)}</p>
      </div>
      <Download className="h-4 w-4 opacity-50" />
    </a>
  );
}

// ============================================================================
// Link Preview
// ============================================================================

interface LinkPreviewCardProps {
  preview: LinkPreview;
  isOwn: boolean;
}

function LinkPreviewCard({ preview, isOwn }: Readonly<LinkPreviewCardProps>) {
  return (
    <a
      className={cn(
        'mt-2 block overflow-hidden rounded-lg border transition-colors',
        isOwn ? 'border-white/20 hover:border-white/30' : 'hover:bg-muted/50'
      )}
      href={preview.url}
      rel="noopener noreferrer"
      target="_blank"
    >
      {preview.image && (
        <img
          alt={preview.title}
          className="h-32 w-full object-cover"
          loading="lazy"
          src={preview.image}
        />
      )}
      <div className="p-2">
        {preview.siteName && <p className="text-muted-foreground text-xs">{preview.siteName}</p>}
        {preview.title && <p className="text-sm font-medium">{preview.title}</p>}
        {preview.description && (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{preview.description}</p>
        )}
      </div>
    </a>
  );
}

// ============================================================================
// Reactions Display
// ============================================================================

interface ReactionsDisplayProps {
  reactions: MessageReaction[];
  isOwn: boolean;
}

function ReactionsDisplay({ reactions, isOwn }: Readonly<ReactionsDisplayProps>) {
  if (reactions.length === 0) return null;

  // Group reactions by emoji
  const grouped = reactions.reduce(
    (acc, reaction) => {
      const existing = acc.find((r) => r.emoji === reaction.emoji);
      if (existing) {
        existing.count++;
        existing.users.push(reaction.userName);
      } else {
        acc.push({
          emoji: reaction.emoji,
          count: 1,
          users: [reaction.userName],
        });
      }
      return acc;
    },
    [] as { emoji: string; count: number; users: string[] }[]
  );

  return (
    <div className={cn('mt-1 flex flex-wrap gap-1', isOwn ? 'justify-end' : 'justify-start')}>
      {grouped.map((reaction) => (
        <button
          key={reaction.emoji}
          className="flex items-center gap-1 rounded-full border bg-white px-1.5 py-0.5 text-xs transition-colors hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700"
          title={reaction.users.join(', ')}
          type="button"
        >
          <span>{reaction.emoji}</span>
          {reaction.count > 1 && <span className="text-muted-foreground">{reaction.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Reply Preview
// ============================================================================

interface ReplyPreviewProps {
  replyTo: NonNullable<Message['replyTo']>;
  isOwn: boolean;
}

function ReplyPreviewInBubble({ replyTo, isOwn }: Readonly<ReplyPreviewProps>) {
  return (
    <div
      className={cn(
        'mb-1 rounded-lg border-l-2 px-2 py-1',
        isOwn ? 'border-white/50 bg-white/10' : 'border-primary/50 bg-muted/50'
      )}
    >
      <p className="text-xs font-medium opacity-70">{replyTo.senderName}</p>
      <p className="line-clamp-1 text-xs opacity-60">{replyTo.content}</p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function MessageBubble({
  message,
  isOwn,
  isGrouped = false,
  onEdit,
  onDelete,
  onReact,
  onReply,
}: Readonly<MessageBubbleProps>) {
  const [showReactions, setShowReactions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content);
  }, [message.content]);

  const handleEdit = useCallback(async () => {
    if (!onEdit || !editContent.trim()) return;
    await onEdit(message.id, editContent);
    setIsEditing(false);
  }, [message.id, editContent, onEdit]);

  const handleDelete = useCallback(async () => {
    if (!onDelete) return;
    await onDelete(message.id);
  }, [message.id, onDelete]);

  const handleReact = useCallback(
    async (emoji: string) => {
      if (!onReact) return;
      await onReact(message.id, emoji);
      setShowReactions(false);
    },
    [message.id, onReact]
  );

  const formatTime = (date: string): string => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Deleted message
  if (message.isDeleted) {
    return (
      <div className={cn('flex gap-2 px-4 py-1', isOwn ? 'justify-end' : 'justify-start')}>
        <div className="text-muted-foreground rounded-lg bg-gray-100 px-3 py-2 text-sm italic dark:bg-gray-800">
          This message was deleted
        </div>
      </div>
    );
  }

  // System message
  if (message.type === 'SYSTEM' || message.type === 'CONTRACT_EVENT') {
    return (
      <div className="flex justify-center px-4 py-2">
        <div className="text-muted-foreground rounded-full bg-gray-100 px-4 py-1 text-center text-sm dark:bg-gray-800">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative flex gap-2 px-4',
        isOwn ? 'justify-end' : 'justify-start',
        isGrouped ? 'py-0.5' : 'py-1'
      )}
    >
      {/* Avatar (non-own, non-grouped) */}
      {!isOwn && !isGrouped && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage alt={message.senderName} src={message.senderAvatar} />
          <AvatarFallback className="text-xs">{getInitials(message.senderName)}</AvatarFallback>
        </Avatar>
      )}

      {/* Spacer for grouped messages */}
      {!isOwn && isGrouped && <div className="w-8" />}

      {/* Message Content */}
      <div className={cn('max-w-[70%]', isOwn ? 'items-end' : 'items-start')}>
        {/* Sender name (non-own, non-grouped) */}
        {!isOwn && !isGrouped && (
          <p className="text-muted-foreground mb-0.5 text-xs">{message.senderName}</p>
        )}

        {/* Bubble */}
        <div
          className={cn(
            'relative rounded-2xl px-3 py-2',
            isOwn ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm',
            isGrouped && isOwn && 'rounded-br-2xl rounded-tr-sm',
            isGrouped && !isOwn && 'rounded-bl-2xl rounded-tl-sm'
          )}
        >
          {/* Reply Preview */}
          {message.replyTo && <ReplyPreviewInBubble isOwn={isOwn} replyTo={message.replyTo} />}

          {/* Edit Mode */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                className="w-full resize-none rounded border bg-white p-2 text-sm text-black"
                rows={2}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleEdit}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Text Content */}
              <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>

              {/* Attachments */}
              {message.attachments.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.attachments.map((attachment) => (
                    <AttachmentRenderer key={attachment.id} attachment={attachment} isOwn={isOwn} />
                  ))}
                </div>
              )}

              {/* Link Previews */}
              {message.linkPreviews.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.linkPreviews.map((preview) => (
                    <LinkPreviewCard key={preview.url} isOwn={isOwn} preview={preview} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Time & Status */}
          <div
            className={cn(
              'mt-1 flex items-center gap-1 text-xs opacity-60',
              isOwn ? 'justify-end' : 'justify-start'
            )}
          >
            <span>{formatTime(message.createdAt)}</span>
            {message.isEdited && <span>(edited)</span>}
            {isOwn && <StatusIcon status={message.status} />}
          </div>
        </div>

        {/* Reactions */}
        <ReactionsDisplay isOwn={isOwn} reactions={message.reactions} />
      </div>

      {/* Actions (visible on hover) */}
      <div
        className={cn(
          'absolute top-0 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100',
          isOwn ? 'left-4' : 'right-4'
        )}
      >
        {/* Quick React Button */}
        <div className="relative">
          <Button
            className="h-7 w-7"
            size="icon"
            variant="ghost"
            onClick={() => setShowReactions(!showReactions)}
          >
            <Smile className="h-4 w-4" />
          </Button>
          {showReactions && (
            <div className={cn('absolute bottom-full mb-1', isOwn ? 'right-0' : 'left-0')}>
              <QuickReactions onClose={() => setShowReactions(false)} onReact={handleReact} />
            </div>
          )}
        </div>

        {/* Reply Button */}
        {onReply && (
          <Button className="h-7 w-7" size="icon" variant="ghost" onClick={onReply}>
            <Reply className="h-4 w-4" />
          </Button>
        )}

        {/* More Options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-7 w-7" size="icon" variant="ghost">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isOwn ? 'start' : 'end'}>
            <DropdownMenuItem onClick={handleCopy}>
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </DropdownMenuItem>
            {isOwn && onEdit && (
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            {isOwn && onDelete && (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
